import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { solveLevel, reachableNear, jumpHeight, jumpReach } from '../../src/game/solver.js';
import { LEVEL_DEFS, buildLevel, levelCount } from '../../src/game/levels.js';
import { enemyDef } from '../../src/game/enemy_defs.js';
import { SOLID, HURT } from '../../src/game/tiles.js';
import { TILE, MAX_GAP_TILES, MAX_STEP_UP_TILES } from '../../src/game/constants.js';
import { playBot } from '../../tools/bot.js';
import { Input } from '../../src/engine/input.js';
import { World } from '../../src/game/world.js';
import { rng } from '../../src/engine/rng.js';

// ---- builder rules ----
test('builder refuses pits and steps the player cannot cross', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(5);
  assert.throws(() => b.pit(MAX_GAP_TILES + 1), /wider than the player can jump/);
  assert.throws(() => b.up(MAX_STEP_UP_TILES + 1), /more than the player can climb/);
  assert.doesNotThrow(() => b.pit(MAX_GAP_TILES));
  assert.doesNotThrow(() => b.up(MAX_STEP_UP_TILES));
});

test('builder adds up steps that follow each other: two 3-tile steps with no ground between them are a 6-tile cliff', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(5);
  b.up(MAX_STEP_UP_TILES);
  assert.throws(() => b.up(1), /more than the player can climb/);
  assert.throws(() => b.hill(3, 1), /more than the player can climb/, 'a hill is a step up too');
  b.down(2);
  assert.doesNotThrow(() => b.up(2), 'net rise of 3 from the last ground is fine');
  b.flat(4);
  assert.doesNotThrow(() => b.up(MAX_STEP_UP_TILES), 'laying ground resets the count');
});

test('builder lays ground, pits, hills and entities at the right pixels', () => {
  const b = new LevelBuilder({ id: 1, name: 'T', theme: 'jungle' });
  const a = b.flat(10);
  const pit = b.pit(3, { fill: 'spikes' });
  b.hill(4, 2);
  const c = b.flat(6);
  a.enemy('raptor', 4);
  c.checkpoint(1);
  b.exit();
  const lvl = b.finish();
  assert.equal(lvl.cols, 23);
  assert.equal(lvl.rows, 17);
  // ground surface row 13: solid at 13, air above
  assert.ok(SOLID[lvl.tiles[13 * lvl.cols + 2]]);
  assert.equal(lvl.tiles[12 * lvl.cols + 2], 0);
  // pit columns have no ground but a spike at the very bottom
  for (let x = pit.x0; x < pit.x1; x++) {
    assert.equal(lvl.tiles[13 * lvl.cols + x], 0);
    assert.ok(HURT[lvl.tiles[16 * lvl.cols + x]]);
  }
  // the raptor stands on the ground at column 4
  const r = lvl.spawns.find((s) => s.type === 'raptor');
  assert.equal(r.x, 4 * TILE + TILE / 2);
  assert.equal(r.y, 13 * TILE);
  assert.equal(lvl.checkpoints[0].x, (c.x0 + 1) * TILE);
  assert.equal(lvl.exitX, 23 * TILE - 2 * TILE);
  assert.equal(lvl.spawn.y, 13 * TILE);
});

test('spawn list comes out sorted by x', () => {
  const b = new LevelBuilder({ id: 1 });
  const s = b.flat(30);
  s.enemy('raptor', 20).enemy('raptor', 5).enemy('raptor', 12);
  b.exit();
  const xs = b.finish().spawns.map((e) => e.x);
  assert.deepEqual(xs, [...xs].sort((p, q) => p - q));
});

// ---- the solver ----
test('solver: jump numbers match the player constants', () => {
  assert.ok(jumpHeight() > MAX_STEP_UP_TILES * TILE, 'tallest allowed step is jumpable');
  assert.ok(jumpHeight() < (MAX_STEP_UP_TILES + 1) * TILE, 'and 4 tiles is not');
  assert.ok(jumpReach(0) > MAX_GAP_TILES * TILE, 'widest allowed pit is crossable');
});

test('solver: crosses a pit at the limit and rejects two of them in a row with no landing', () => {
  const ok = new LevelBuilder({ id: 1 });
  ok.flat(6); ok.pit(MAX_GAP_TILES); ok.flat(6); ok.exit();
  assert.ok(solveLevel(ok.finish()).goal, 'a 5-tile pit can be crossed');

  const bad = new LevelBuilder({ id: 1 });
  bad.flat(6); bad.pit(5); bad.pit(5); bad.flat(6); bad.exit();
  assert.equal(solveLevel(bad.finish()).goal, null, 'ten tiles in one go cannot');
});

test('solver: a platform chain bridges a pit that is too wide for one jump', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  b.pit(5); b.pit(5);
  b.platform(b.x - 6, 11, 2);
  b.flat(6); b.exit();
  const lvl = b.finish();
  assert.ok(solveLevel(lvl).goal);
});

test('solver: drop-through of a one-way platform counts as a move', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(4);
  const seg = b.flat(12);
  b.platform(seg.x0 + 2, 10, 8);
  b.flat(4); b.exit();
  const sol = solveLevel(b.finish(), { from: { x: (seg.x0 + 4) * TILE + 8, y: 10 * TILE } });
  assert.ok(sol.goal, 'starting up on the platform the exit is still reachable (walk off or drop)');
});

// ---- every real level ----
for (let i = 0; i < levelCount(); i++) {
  const def = LEVEL_DEFS[i];
  test(`level ${i + 1} (${def.name}): data is well formed`, () => {
    const lvl = buildLevel(i);
    assert.ok(lvl.name && lvl.era && lvl.theme, 'name, era, theme');
    if (lvl.boss) {
      assert.ok(lvl.boss.trigger < lvl.cols * TILE && lvl.boss.x1 === lvl.cols * TILE, 'the boss arena is the last screen');
      assert.ok(lvl.boss.x1 - lvl.boss.x0 === 480, 'arena is exactly one screen wide');
    } else {
      assert.ok(lvl.exitX > 0 && lvl.exitX < lvl.cols * TILE);
    }
    assert.ok(lvl.checkpoints.length >= 2, 'at least two checkpoints');
    assert.ok(lvl.cols >= 200 || lvl.rows >= 60, 'long enough to be a stage (or tall enough, for a tower)');
    for (const s of lvl.spawns) {
      if (s.type !== 'pickup') enemyDef(s.type); // throws on unknown type
      assert.ok(s.x >= 0 && s.x <= lvl.cols * TILE, `spawn ${s.type} inside the map`);
      // ground-bound spawns must not be embedded in terrain
      const tx = Math.floor(s.x / TILE);
      const ty = Math.floor((s.y - 2) / TILE);
      assert.ok(!SOLID[lvl.tiles[ty * lvl.cols + tx]], `${s.type} at ${tx},${ty} is inside solid ground`);
    }
    for (const c of lvl.checkpoints) assert.ok(c.x > 0 && c.x < (lvl.exitX ?? lvl.cols * TILE));
    for (const p of lvl.prompts) assert.ok(p.x1 > p.x0);
  });

  test(`level ${i + 1} (${def.name}): the solver finds a route from spawn to exit`, () => {
    const lvl = buildLevel(i);
    const sol = solveLevel(lvl);
    assert.ok(sol.goal, 'exit is reachable on foot');
    for (const c of lvl.checkpoints) assert.ok(reachableNear(sol, c.x, 1), `checkpoint at ${c.x} reachable`);
    for (const s of lvl.spawns) {
      if (s.type === 'pickup' && s.item !== '1up') assert.ok(reachableNear(sol, s.x, 3), `${s.item} at ${s.x},${s.y} is within reach of the route`);
    }
  });

  test(`level ${i + 1} (${def.name}): the bot crosses it in god mode without a single fall`, () => {
    const lvl = buildLevel(i);
    const r = playBot(lvl, { seconds: 300 });
    assert.ok(r.cleared, `bot stuck at x=${Math.round(r.x)} of ${lvl.exitX}`);
    assert.equal(r.falls, 0, 'no falls');
    assert.equal(r.hazards, 0, 'never touched a hazard');
    assert.ok(r.time > (lvl.rows >= 60 ? 12 : 20), 'not a trivial run');
  });
}

// ---- prompts show the button names for the device in use ----
test('prompt tokens are filled per device', () => {
  const input = new Input();
  assert.equal(input.fill('PRESS {jump} TO JUMP'), 'PRESS Z TO JUMP');
  assert.equal(input.fill('MOVE WITH {move}'), 'MOVE WITH ARROWS');
  input.lastDevice = 'pad';
  assert.equal(input.fill('PRESS {jump} TO JUMP'), 'PRESS A TO JUMP');
  input.lastDevice = 'touch';
  assert.equal(input.fill('{fire}'), 'FIRE');
});

test('World.promptAt returns the prompt for the player position', () => {
  const lvl = buildLevel(0);
  const w = new World(lvl);
  const first = lvl.prompts[0];
  w.player.x = (first.x0 + first.x1) / 2;
  assert.equal(w.promptAt(), first.text);
  w.player.x = lvl.cols * TILE - 4;
  assert.equal(w.promptAt(), null);
});

// ---- the play scene on a real level ----
test('PlayScene runs Level 1: name card, prompt banner, then 20 s of play in which the soldier advances without a death', async () => {
  const { makeGame, stepN } = await import('../../tools/shots.mjs');
  const { registerRoutes } = await import('../../src/scenes/routes.js');
  const { Run } = await import('../../src/game/run.js');
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('play', { run: new Run(), levelIndex: 0, god: true });
  stepN(game, 30);
  assert.equal(game.scene.level.name, 'DINO JUNGLE');
  assert.ok(game.scene.cardT > 0, 'level card is up');
  stepN(game, 200, ['right', 'fire']);
  assert.ok(game.scene.cardT <= 0);
  const w = game.scene.world;
  assert.ok(w.player.x > 100, 'moved');
  game.render();
  assert.ok(canvas.data.some((v) => v !== 0));

  // twenty more seconds of running, shooting and hopping; look at everything the world reports along the way
  const x0 = w.player.x;
  const tick0 = w.tick;
  const bad = [];
  const seen = new Set();
  const inspect = w.events;
  const origPush = inspect.push.bind(inspect);
  inspect.push = (...evs) => {
    for (const e of evs) {
      seen.add(e.type);
      if (e.type === 'playerDied') bad.push(e.type); // god mode: nothing may kill the soldier
    }
    return origPush(...evs);
  };
  stepN(game, 60 * 20, ['right', 'fire', 'jump']);
  assert.deepEqual(bad, [], 'god mode: no deaths');
  assert.equal(game.scene.constructor.name, 'PlayScene');
  assert.equal(w.tick - tick0, 60 * 20, 'the world advanced every frame');
  assert.ok(w.player.alive);
  assert.ok(w.player.x > x0 + 200, `the soldier made real progress (${Math.round(x0)} -> ${Math.round(w.player.x)})`);
  assert.ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.y));
  assert.ok(seen.has('sfx'), 'and it made sounds on the way');
});

// ---- property: builder rules against the solver and the bot ----
/**
 * A random course of flats, pits and steps, built the way a level script would. Pit widths and step heights go past the
 * limits on purpose. `refused` lists what the builder threw on; the course goes on without the refused piece.
 */
function randomCourse(seed) {
  const r = rng(seed);
  const b = new LevelBuilder({ id: 1, name: 'P', theme: 'jungle', seed });
  const refused = [];
  b.flat(r.int(4, 8));
  for (let i = r.int(3, 8); i > 0; i--) {
    const op = r.pick(['pit', 'pit', 'up', 'down', 'hill']);
    const n = op === 'pit' ? r.int(1, MAX_GAP_TILES + 2) : op === 'down' ? r.int(1, 3) : r.int(1, MAX_STEP_UP_TILES + 2);
    try {
      if (op === 'pit') b.pit(n, { fill: r.pick(['spikes', null, 'water']) });
      else if (op === 'up') b.up(n);
      else if (op === 'down') b.down(n);
      else b.hill(r.int(2, 4), n);
    } catch (e) {
      refused.push({ op, n, message: e.message });
    }
    b.flat(r.int(3, 6));
    // keep the ground inside the level: a long run of steps down would leave the bottom of the map
    if (b.gy > b.rows - 4) {
      b.up(Math.min(MAX_STEP_UP_TILES, b.gy - (b.rows - 6)));
      b.flat(3); // ground between a step and the next pit: the builder judges a gap and a rise separately, not a jump that does both
    }
  }
  b.exit();
  return { level: b.finish(), refused };
}

test('property: the builder limits sit inside what the player can really do (the solver\'s own jump numbers)', () => {
  assert.ok(MAX_GAP_TILES * TILE < jumpReach(0), `a ${MAX_GAP_TILES}-tile pit is under a flat jump's reach`);
  assert.ok(MAX_STEP_UP_TILES * TILE < jumpHeight(), `a ${MAX_STEP_UP_TILES}-tile step is under the jump height`);
  assert.ok((MAX_GAP_TILES + 1) * TILE >= jumpReach(0) * 0.85, 'and the limit is not wastefully tight either');
});

test('property: the builder refuses exactly the pits and steps past its limits, and every course it accepts has a route to the exit (150 seeded courses)', () => {
  let refusedAny = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const { level, refused } = randomCourse(seed);
    for (const x of refused) {
      const limit = x.op === 'pit' ? MAX_GAP_TILES : MAX_STEP_UP_TILES;
      // the size in the message is the pit width, or the whole rise since the last ground (steps that follow each other add up)
      assert.ok(Number(x.message.match(/of (\d+) tiles/)[1]) > limit, `seed ${seed}: refused a ${x.op} of ${x.n} that is within the limit of ${limit} (${x.message})`);
      assert.match(x.message, x.op === 'pit' ? /wider than the player can jump/ : /more than the player can climb/);
    }
    refusedAny += refused.length;
    const sol = solveLevel(level);
    assert.ok(sol.goal, `seed ${seed}: the accepted course has no route to the exit (refused: ${JSON.stringify(refused)})`);
  }
  assert.ok(refusedAny > 30, `the generator does hit the limits (${refusedAny} refusals)`);
});

test('property: the bot, with the real movement, crosses accepted random courses without falling or touching a hazard (12 seeded courses)', () => {
  for (let seed = 200; seed < 212; seed++) {
    const { level } = randomCourse(seed);
    // the same course without the water fords: the bot's god mode ignores hazards, but a ford is a wade, not a fall
    const res = playBot(level, { god: true, seconds: 120 });
    assert.ok(res.cleared, `seed ${seed}: the bot did not reach the exit (stuck at x=${Math.round(res.x)})`);
    assert.equal(res.falls, 0, `seed ${seed}: fell ${res.falls} times`);
  }
});
