// World events and sounds: what the simulation tells the scene (and the speakers) when the player shoots, jumps, gets
// hurt, picks something up or a boss changes phase, and the contract between World and PlayScene: every event type the
// world pushes is either handled by the play scene (or the hint system) or is on the short list of purely informational ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { makeInput, run, seconds } from '../support/helpers.js';
import { spawnArena } from '../support/fixtures.js';
import { spawnPickup } from '../../src/game/pickups.js';
import { damageEnemy } from '../../src/game/enemies.js';
import { World } from '../../src/game/world.js';
import { buildLevel } from '../../src/game/levels.js';
import { TILE } from '../../src/game/constants.js';
import { WEAPONS } from '../../src/game/weapons.js';
import { T } from '../../src/game/tiles.js';
import { SFX } from '../../src/engine/audio.js';

const FLOOR = 14 * TILE;
const sfxNames = (events) => events.filter((e) => e.type === 'sfx').map((e) => e.name);
const ofType = (events, type) => events.filter((e) => e.type === type);

// ---------------------------------------------------------------------------------------------------------------
// What the player's actions sound like
// ---------------------------------------------------------------------------------------------------------------

test('firing plays the active weapon\'s shot sound and really fires a bullet', () => {
  const w = spawnArena();
  const events = run(w, makeInput(), 3, ['fire'], { keepSfx: true });
  assert.ok(sfxNames(events).includes(WEAPONS.rifle.sfx));
  assert.ok(w.bullets.length > 0);
});

test('a weapon with its own sound plays that one, not the default shot', () => {
  const w = spawnArena();
  const [id, def] = Object.entries(WEAPONS).find(([, d]) => d.sfx && d.sfx !== 'shoot');
  w.player.slots[0] = id;
  const events = run(w, makeInput(), 3, ['fire'], { keepSfx: true });
  assert.ok(sfxNames(events).includes(def.sfx), `${id} plays ${def.sfx}`);
  assert.ok(!sfxNames(events).includes('shoot'));
});

test('jumping plays the jump sound, and landing plays the land sound', () => {
  const w = spawnArena();
  const input = makeInput();
  run(w, input, 5, []); // settle on the floor
  const up = run(w, input, 2, ['jump'], { keepSfx: true });
  assert.ok(sfxNames(up).includes('jump'));
  const down = run(w, input, seconds(1.5), [], { keepSfx: true });
  assert.ok(sfxNames(down).includes('land'));
});

test('holding jump makes one jump and one sound, not a stream of them', () => {
  const w = spawnArena();
  const input = makeInput();
  run(w, input, 5, []);
  const events = run(w, input, seconds(1), ['jump'], { keepSfx: true });
  assert.equal(sfxNames(events).filter((n) => n === 'jump').length, 1);
});

test('being hit plays the death sound and raises playerDied with the cause', () => {
  const w = spawnArena([], { god: false });
  run(w, makeInput(), 3, []);
  w.player.invuln = 0;
  assert.equal(w.hurtPlayer('enemy'), true);
  const events = w.events.splice(0);
  assert.ok(sfxNames(events).includes('die'));
  const died = ofType(events, 'playerDied');
  assert.equal(died.length, 1);
  assert.equal(died[0].cause, 'enemy');
});

test('a god-mode or invulnerable soldier makes no hurt sound and raises no playerDied', () => {
  const god = spawnArena([], { god: true });
  god.hurtPlayer('enemy');
  assert.deepEqual(god.events, []);
  const shielded = spawnArena([], { god: false });
  shielded.player.invuln = 1;
  shielded.hurtPlayer('enemy');
  assert.deepEqual(shielded.events, []);
});

test('standing on spikes raises a hazard event', () => {
  const w = spawnArena([], { god: true });
  run(w, makeInput(), 3, []);
  w.setTile(Math.floor(w.player.x / TILE), 14, T.SPIKE);
  w.player.y = FLOOR + 4; // sink the feet into the spike tile
  const events = run(w, makeInput(), 2, []);
  assert.ok(ofType(events, 'hazard').length >= 1);
});

test('a smart bomb sounds, flashes the screen and raises a bomb event', () => {
  const w = spawnArena();
  const events = run(w, makeInput(), 2, ['bomb'], { keepSfx: true });
  assert.ok(sfxNames(events).includes('bomb'));
  assert.equal(ofType(events, 'bomb').length, 1);
  assert.ok(w.bombFlash > 0);
});

test('reaching a checkpoint plays its jingle and raises one checkpoint event, once', () => {
  const w = new World(buildLevel(0), { god: true });
  const cp = w.level.checkpoints[0];
  w.player.x = cp.x + 4;
  w.player.y = cp.y;
  const input = makeInput();
  const events = run(w, input, 3, [], { keepSfx: true });
  assert.ok(sfxNames(events).includes('checkpoint'));
  assert.equal(ofType(events, 'checkpoint').length, 1);
  assert.equal(ofType(run(w, input, 3, [], { keepSfx: true }), 'checkpoint').length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// Pickups and kills
// ---------------------------------------------------------------------------------------------------------------

function collect(item) {
  const w = spawnArena();
  const p = w.player;
  spawnPickup(w, item, p.x, p.y, { float: true });
  return run(w, makeInput(), 3, [], { keepSfx: true });
}

test('collecting a weapon letter plays the weapon sound and raises a pickup event naming the item', () => {
  const events = collect('S');
  assert.ok(sfxNames(events).includes('weapon'));
  assert.deepEqual(ofType(events, 'pickup').map((e) => e.item), ['S']);
});

test('collecting a medal plays the medal sound and raises a medal event', () => {
  const events = collect('medal');
  assert.ok(sfxNames(events).includes('medal'));
  assert.equal(ofType(events, 'medal').length, 1);
});

test('collecting the hidden 1UP raises the oneup event', () => {
  assert.equal(ofType(collect('1up'), 'oneup').length, 1);
});

test('killing an enemy raises a kill event carrying its score, and sounds an explosion', () => {
  const w = spawnArena([{ type: 'grunt', x: 160, y: FLOOR }]);
  run(w, makeInput(), 5, []);
  const e = w.enemies[0];
  w.events.length = 0;
  damageEnemy(w, e, 999, { x: e.x, y: e.cy, vx: 0, vy: 0 });
  const events = w.events.splice(0);
  const kills = ofType(events, 'kill');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].enemy, e);
  assert.ok(kills[0].score > 0);
  assert.ok(sfxNames(events).some((n) => n === 'boom' || n === 'bigBoom'));
});

// ---------------------------------------------------------------------------------------------------------------
// Boss events
// ---------------------------------------------------------------------------------------------------------------

/** A god-mode world dropped into the arena of level `index`, stepped until the boss has walked in and finished its entrance. */
function bossFight(index) {
  const level = buildLevel(index);
  const L = level.boss;
  const w = new World(level, { god: true, start: { x: L.x0 + 3 * TILE, y: L.floorY } });
  const input = makeInput();
  const seen = [];
  for (let k = 0; k < 400 && !w.boss; k++) seen.push(...run(w, input, 1, ['right'], { keepSfx: true }));
  assert.ok(w.boss, 'the boss came in');
  const entering = seen.length;
  for (let k = 0; k < seconds(10) && w.boss.bs.state === 'enter'; k++) seen.push(...run(w, input, 1, [], { keepSfx: true }));
  return { w, input, seen, entering };
}

test('a boss walking in raises bossStart with the warning sound', () => {
  const { seen } = bossFight(0);
  assert.equal(ofType(seen, 'bossStart').length, 1);
  assert.ok(sfxNames(seen).includes('warning'));
});

test('a boss crossing a phase threshold raises one bossPhase event with the new phase and sounds the big explosion', () => {
  const { w, input } = bossFight(0);
  const b = w.boss;
  assert.equal(b.bs.phase, 0);
  b.hp = Math.floor(b.maxHp * b.def.phases[1].hp) - 1; // wound it just past the second phase's threshold
  const seen = [];
  for (let k = 0; k < 6; k++) seen.push(...run(w, input, 1, [], { keepSfx: true }));
  const phases = ofType(seen, 'bossPhase');
  assert.equal(phases.length, 1);
  assert.equal(phases[0].phase, 1);
  assert.equal(phases[0].id, b.id);
  assert.ok(sfxNames(seen).includes('bigBoom'));
});

test('a boss killed without the soldier dying raises bossDying and then bossDefeated with noDeath', () => {
  const { w, input } = bossFight(0);
  const b = w.boss;
  b.hp = 0.01;
  const seen = [];
  damageEnemy(w, b, 5, { x: b.x, y: b.cy, vx: 0, vy: 0 }, true);
  seen.push(...w.events.splice(0));
  for (let k = 0; k < seconds(8) && !ofType(seen, 'bossDefeated').length; k++) seen.push(...run(w, input, 1, [], { keepSfx: true }));
  assert.equal(ofType(seen, 'bossDying').length, 1);
  const done = ofType(seen, 'bossDefeated');
  assert.equal(done.length, 1);
  assert.equal(done[0].noDeath, true);
});

// ---------------------------------------------------------------------------------------------------------------
// The World -> PlayScene contract (static scan of src/, cross-checked at runtime)
// ---------------------------------------------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

function sourceFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...sourceFiles(join(dir, ent.name)));
    else if (ent.name.endsWith('.js')) out.push(join(dir, ent.name));
  }
  return out;
}

const read = (f) => readFileSync(f, 'utf8');

/** Event types pushed anywhere under src/game: `events.push({ type: 'x'`. */
function pushedEventTypes() {
  const types = new Set();
  for (const f of sourceFiles(join(SRC, 'game'))) for (const m of read(f).matchAll(/events\.push\(\s*\{\s*type:\s*'([A-Za-z]+)'/g)) types.add(m[1]);
  return types;
}

/** Event types the play scene reacts to: its `case 'x':` labels plus the types the hint list tests for. */
function handledEventTypes() {
  const types = new Set();
  for (const m of read(join(SRC, 'scenes/play.js')).matchAll(/case\s+'([A-Za-z]+)'\s*:/g)) types.add(m[1]);
  for (const m of read(join(SRC, 'scenes/hints.js')).matchAll(/e\.type\s*===\s*'([A-Za-z]+)'/g)) types.add(m[1]);
  return types;
}

/**
 * Events that exist only to be observed (tests, effects, future UI): they carry no rule for the scene, because the
 * sound or the visual that goes with them is made by the code that raised them. Anything NEW has to be handled in
 * PlayScene.onEvent or be added here on purpose.
 */
const INFORMATIONAL = new Set(['sfx', 'fell', 'hazard', 'bomb', 'alarm', 'lavaRise', 'arenaWave', 'tankHit', 'tankLost', 'bikeHit', 'bikeLost']);

test('every event type the world pushes is handled by the play scene or is listed as informational', () => {
  const pushed = pushedEventTypes();
  const handled = handledEventTypes();
  assert.ok(pushed.size >= 20, `the scan found the events (${pushed.size})`);
  const orphans = [...pushed].filter((t) => !handled.has(t) && !INFORMATIONAL.has(t));
  assert.deepEqual(orphans, [], 'new event types need a PlayScene handler (or an entry in INFORMATIONAL)');
});

test('the informational list holds no stale entries: each type is still pushed, and none has quietly gained a handler', () => {
  const pushed = pushedEventTypes();
  const handled = handledEventTypes();
  for (const t of INFORMATIONAL) {
    assert.ok(pushed.has(t), `${t} is no longer pushed anywhere`);
    assert.ok(!handled.has(t), `${t} is handled now, so take it off the informational list`);
  }
});

test('every case label in PlayScene.onEvent is an event the world really pushes (no dead handlers)', () => {
  const pushed = pushedEventTypes();
  const dead = [...handledEventTypes()].filter((t) => !pushed.has(t));
  assert.deepEqual(dead, []);
});

test('at runtime, every event type seen while playing is one the static scan knows about', () => {
  const known = pushedEventTypes();
  const seen = new Set();
  const note = (events) => events.forEach((e) => seen.add(e.type));
  // a stretch of Level 1, a pickup, a bomb, a death and a boss fight between them touch most event kinds
  const w = new World(buildLevel(0), { god: false });
  const input = makeInput();
  for (let f = 0; f < seconds(40); f++) note(run(w, input, 1, ['right', 'fire', ...(f % 70 < 10 ? ['jump'] : [])], { keepSfx: true }));
  w.player.bombs = 1;
  note(run(w, input, 2, ['bomb'], { keepSfx: true }));
  w.player.invuln = 0;
  w.player.barrier = 0;
  w.killPlayer('test');
  note(w.events.splice(0));
  const fight = bossFight(0);
  note(fight.seen);
  assert.ok(seen.size >= 6, `a useful variety of events was seen (${[...seen].join(', ')})`);
  for (const t of seen) assert.ok(known.has(t), `runtime event "${t}" is not in the static scan`);
});

// ---------------------------------------------------------------------------------------------------------------
// Every sound the game asks for exists
// ---------------------------------------------------------------------------------------------------------------

test('every sfx name used in src/game is a real preset (a typo would be silent in the browser)', () => {
  const used = new Set();
  for (const f of sourceFiles(join(SRC, 'game'))) {
    const src = read(f);
    for (const m of src.matchAll(/\bsfx\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) used.add(m[1]);
    for (const m of src.matchAll(/\bsfx:\s*'([A-Za-z0-9_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 20, `the scan found the sound names (${used.size})`);
  assert.deepEqual([...used].filter((n) => !SFX[n]), []);
});
