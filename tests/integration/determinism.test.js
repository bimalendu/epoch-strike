// Determinism: World.update is a pure function of the level, the options and the scripted input. The same seed and the
// same input must give a bit-identical world after N frames (on levels from different eras), different input must give a
// different world (so the hash is not blind), and a Run saved at a checkpoint must come back exactly as it was saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeInput, run } from '../support/helpers.js';
import { makeGame, stepN } from '../support/fixtures.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { World } from '../../src/game/world.js';
import { Run } from '../../src/game/run.js';
import { buildLevel } from '../../src/game/levels.js';
import { SaveData, MemoryStorage } from '../../src/game/save.js';
import { levelCount } from '../../src/game/levels.js';
import { rng } from '../../src/engine/rng.js';

// one level per era band: the jungle, a castle, a modern base
const LEVELS = [0, 9, 17];
const FRAMES = 60 * 6;

/** A SHA-1 over everything the simulation moves: the soldier, every enemy, bullet and pickup, the clock and the camera. */
function stateHash(w) {
  const r = (n) => Math.round(n * 1000) / 1000; // sub-micro-pixel noise is not a difference worth reporting
  const p = w.player;
  const parts = [
    w.tick, r(w.time), r(p.x), r(p.y), r(p.vx), r(p.vy), p.alive, p.weapon, p.bombs, r(p.invuln), r(w.camera.x), r(w.camera.y),
    w.cleared, w.checkpoints.map((c) => c.hit),
    w.enemies.map((e) => [e.id, r(e.x), r(e.y), r(e.hp), e.alive]),
    w.bullets.map((b) => [r(b.x), r(b.y)]),
    w.ebullets.map((b) => [r(b.x), r(b.y)]),
    w.pickups.map((k) => [k.item, r(k.x), r(k.y)]),
  ];
  return createHash('sha1').update(JSON.stringify(parts)).digest('hex');
}

/** Plays `frames` frames of a fixed script (run right, fire, hop every 70 frames) and returns the final world. */
function play(levelIndex, frames, { script = null, opts = {} } = {}) {
  const w = new World(buildLevel(levelIndex), { god: true, ...opts });
  const input = makeInput();
  for (let f = 0; f < frames; f++) {
    const keys = script ? script(f) : ['right', 'fire', ...(f % 70 < 10 ? ['jump'] : [])];
    run(w, input, 1, keys);
  }
  return w;
}

for (const index of LEVELS) {
  test(`level ${index + 1}: two worlds built from the same level and fed the same input end in the same state`, () => {
    const a = play(index, FRAMES);
    const b = play(index, FRAMES);
    assert.equal(a.tick, FRAMES);
    assert.equal(stateHash(a), stateHash(b));
    assert.ok(a.player.x > 100, 'the soldier actually moved, so the hash covers real play');
  });

  test(`level ${index + 1}: the hash checkpoints agree all the way through, not only at the end`, () => {
    const a = new World(buildLevel(index), { god: true });
    const b = new World(buildLevel(index), { god: true });
    const ia = makeInput();
    const ib = makeInput();
    for (let f = 0; f < FRAMES; f++) {
      const keys = ['right', 'fire', ...(f % 70 < 10 ? ['jump'] : [])];
      run(a, ia, 1, keys);
      run(b, ib, 1, keys);
      if (f % 60 === 59) assert.equal(stateHash(a), stateHash(b), `diverged by frame ${f + 1}`);
    }
  });

  test(`level ${index + 1}: different input gives a different state (the hash can tell worlds apart)`, () => {
    const runner = play(index, FRAMES);
    const idler = play(index, FRAMES, { script: () => [] });
    assert.notEqual(stateHash(runner), stateHash(idler));
  });
}

test('the visual effects quality does not change the simulation', () => {
  const high = play(9, FRAMES, { opts: { fx: 'high' } });
  const low = play(9, FRAMES, { opts: { fx: 'low' } });
  assert.equal(stateHash(high), stateHash(low));
});

test('a different difficulty plays out differently (the options reach the simulation)', () => {
  // twice the usual run: difficulty only shows once the first enemy fights back, and the castle's first foes stand on its far hill
  const normal = play(9, FRAMES * 2, { opts: { difficulty: 'normal' } });
  const hard = play(9, FRAMES * 2, { opts: { difficulty: 'hard' } });
  assert.notEqual(stateHash(normal), stateHash(hard));
});

// ---------------------------------------------------------------------------------------------------------------
// Saving a Run and resuming it
// ---------------------------------------------------------------------------------------------------------------

/** Plays Level 1 through the real scenes until the first checkpoint is reached; returns the game and the play scene. */
function playToFirstCheckpoint() {
  const { game } = makeGame();
  registerRoutes(game);
  const r = new Run();
  game.go('play', { run: r, levelIndex: 0, god: true });
  stepN(game, 2);
  for (let i = 0; i < 60 * 90 && !game.scene.run.checkpoint; i++) stepN(game, 1, ['right', 'fire', ...(i % 70 < 10 ? ['jump'] : [])]);
  assert.ok(game.scene.run.checkpoint, 'a checkpoint was reached');
  return { game, scene: game.scene };
}

test('a Run written at a checkpoint and read back is the same run, field for field', () => {
  const { scene } = playToFirstCheckpoint();
  scene.run.score.add(4200);
  scene.run.collectMedal();
  const saved = scene.run.toJSON();
  const store = new MemoryStorage();
  const save = new SaveData(store);
  save.saveResume(scene.run);
  const back = new SaveData(store).resume; // through JSON and the sanitiser, as a real reload would
  assert.deepEqual(back, saved);
  assert.deepEqual(Run.fromJSON(back).toJSON(), saved, 'restoring then saving again changes nothing');
});

test('resuming at a checkpoint puts the soldier where the straight-through run reached it, with the same checkpoints taken', () => {
  const { scene } = playToFirstCheckpoint();
  const straight = scene.world;
  const cp = scene.run.checkpoint;
  const resumed = new World(scene.level, { start: { x: cp.x, y: cp.y }, loadout: scene.run.loadout, god: true });
  assert.equal(resumed.player.x, cp.x);
  assert.deepEqual(
    resumed.checkpoints.map((c) => c.hit),
    straight.checkpoints.map((c) => c.hit),
    'the checkpoint that was reached counts as taken, the later ones do not',
  );
  assert.equal(resumed.player.weapon, straight.player.weapon, 'the loadout carries over');
  assert.equal(resumed.player.bombs, straight.player.bombs);
});

test('two worlds resumed from the same checkpoint then play out identically', () => {
  const { scene } = playToFirstCheckpoint();
  const cp = scene.run.checkpoint;
  const resume = () => play(0, FRAMES, { opts: { start: { x: cp.x, y: cp.y }, loadout: scene.run.loadout } });
  assert.equal(stateHash(resume()), stateHash(resume()));
});

// ---------------------------------------------------------------------------------------------------------------
// Property: random play, not only the one fixed script. Each case picks a level and a button script from its seed (keys
// are held for a few frames at a time, so the soldier runs, jumps, shoots and drops bombs in a human-ish pattern). The
// same case run twice must end in the same state, and at low and high effects quality too.
// ---------------------------------------------------------------------------------------------------------------
test('property: random scripted play on random levels is deterministic, and the effects quality never changes it (16 seeded cases)', () => {
  const KEYS = ['left', 'right', 'right', 'right', 'up', 'down', 'jump', 'fire', 'fire', 'switch', 'bomb'];
  const hashes = new Set();
  for (let seed = 1; seed <= 16; seed++) {
    const r = rng(seed * 7919);
    const level = r.int(0, levelCount() - 1);
    // a script is a list of (keys, hold-for) bursts, shared by every run of this case
    const bursts = Array.from({ length: 60 }, () => ({ keys: Array.from({ length: r.int(1, 3) }, () => r.pick(KEYS)), hold: r.int(3, 25) }));
    const script = (f) => {
      let t = f;
      for (const b of bursts) {
        if (t < b.hold) return b.keys;
        t -= b.hold;
      }
      return [];
    };
    const frames = 60 * 5;
    const a = play(level, frames, { script });
    const b = play(level, frames, { script });
    const lo = play(level, frames, { script, opts: { fx: 'low' } });
    const hi = play(level, frames, { script, opts: { fx: 'high' } });
    assert.equal(stateHash(a), stateHash(b), `seed ${seed} (level ${level + 1}): two runs differ`);
    assert.equal(stateHash(lo), stateHash(hi), `seed ${seed} (level ${level + 1}): effects quality changed the simulation`);
    hashes.add(stateHash(a));
  }
  assert.ok(hashes.size >= 12, `the cases play out differently from each other, so the hash covers real play (${hashes.size} distinct)`);
});
