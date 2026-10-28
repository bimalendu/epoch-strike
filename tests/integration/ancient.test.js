// Ancient-era mechanics: wave arenas, chargers, shields, the Ballista Bolt and the chariot ride.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { WEAPONS, eraWeaponFor } from '../../src/game/weapons.js';
import { TILE, VIEW_W, enemyCapFor } from '../../src/game/constants.js';
import { playBot } from '../../tools/bot.js';

function arenaLevel(waves) {
  const b = new LevelBuilder({ id: 6, theme: 'colosseum', seed: 3 });
  b.flat(12);
  const seg = b.arenaWaves(waves);
  b.flat(12);
  b.exit();
  return { level: b.finish(), seg };
}

const WAVES = [
  [{ type: 'gladiator', side: 'R' }, { type: 'gladiator', side: 'R' }],
  [{ type: 'gladiator', side: 'L' }, { type: 'gladiator', side: 'R' }, { type: 'scarab', side: 'R' }],
];

test('wave arena: locks the camera, runs the waves in order, then lets the player on', () => {
  const { level, seg } = arenaLevel(WAVES);
  const w = new World(level, { god: true });
  const input = makeInput();
  const x0 = seg.x0 * TILE;
  w.player.x = x0 + 4 * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const events = [];
  let locked = false;
  let maxAlive = 0;
  for (let k = 0; k < seconds(40) && !w.arena?.state?.startsWith('d') && !events.some((e) => e.type === 'arenaClear'); k++) {
    // shoot whatever is nearest: stand still and spray both ways
    const e0 = w.enemies.find((e) => e.alive);
    const keys = ['fire'];
    if (e0) keys.push(e0.x > w.player.x ? 'right' : 'left');
    events.push(...run(w, input, 1, keys));
    if (w.camera.lockMin === x0 && w.camera.lockMax === x0) locked = true;
    maxAlive = Math.max(maxAlive, w.enemies.filter((e) => e.alive).length);
    if (w.arena) assert.ok(w.player.x <= x0 + VIEW_W, 'the player cannot leave through the right');
  }
  assert.ok(locked, 'camera was locked on the arena');
  assert.deepEqual(events.filter((e) => e.type === 'arenaWave').map((e) => e.n), [1, 2]);
  assert.ok(events.some((e) => e.type === 'arenaClear'), 'cleared');
  assert.equal(w.camera.lockMin, null, 'lock lifted');
  assert.ok(maxAlive <= enemyCapFor(6), `cap respected (${maxAlive})`);
});

test('wave arena: the next wave waits until the last one is dead, and waves come in from the named side', () => {
  const { level, seg } = arenaLevel(WAVES);
  const w = new World(level, { god: true });
  const input = makeInput();
  w.player.x = seg.x0 * TILE + 4 * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  for (let k = 0; k < seconds(4) && !w.enemies.some((e) => e.alive); k++) run(w, input, 1);
  const first = w.enemies.filter((e) => e.alive);
  assert.equal(first.length, 2, 'wave 1');
  assert.ok(first.every((e) => e.x > w.camera.x + VIEW_W), 'wave 1 comes from the right edge');
  run(w, input, seconds(2));
  assert.equal(w.arena.wave, 0, 'still wave 1 while its enemies live');
  for (const e of first) damageEnemy(w, e, 99, null);
  let atSpawn = null;
  for (let k = 0; k < seconds(4) && !atSpawn; k++) {
    run(w, input, 1);
    if (w.arena.wave === 1) atSpawn = w.enemies.filter((e) => e.alive);
  }
  assert.ok(atSpawn, 'wave 2 started');
  assert.ok(atSpawn.some((e) => e.x < w.camera.x), 'wave 2 has an enemy coming from the left');
  assert.ok(atSpawn.some((e) => e.x > w.camera.x + VIEW_W), 'and one from the right');
});

test('the bot clears a wave arena and finishes the level', () => {
  const { level } = arenaLevel(WAVES);
  const r = playBot(level, { seconds: 120 });
  assert.ok(r.cleared, 'level cleared');
  assert.equal(r.falls, 0);
});

test('charger: an elephant telegraphs for at least 0.6 s, then charges and stops at the arena wall', () => {
  const { level, seg } = arenaLevel([[{ type: 'elephant', side: 'R' }]]);
  const w = new World(level);
  w.god = true;
  const input = makeInput();
  w.player.x = seg.x0 * TILE + 3 * TILE + 8;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const seen = { tele: 0, charge: 0, rest: 0 };
  let teleStart = null;
  let teleLen = 0;
  for (let k = 0; k < seconds(20); k++) {
    run(w, input, 1);
    const el = w.enemies.find((e) => e.id === 'elephant' && e.alive);
    if (!el) continue;
    if (el.state === 'tele' && teleStart === null) teleStart = w.time;
    if (el.state === 'charge' && teleStart !== null && !teleLen) teleLen = w.time - teleStart;
    seen[el.state] = (seen[el.state] || 0) + 1;
    assert.ok(el.x <= w.camera.x + VIEW_W - el.w / 2 + 0.5 || !el.entered, 'never leaves through the right');
  }
  assert.ok(seen.tele > 0 && seen.charge > 0 && seen.rest > 0, JSON.stringify(seen));
  assert.ok(teleLen >= 0.6, `telegraph ${teleLen.toFixed(2)} s`);
});

test('rival chariot: warns, runs the length of the screen and leaves; it can be shot down', () => {
  const b = new LevelBuilder({ id: 6, theme: 'colosseum', seed: 3 });
  b.flat(40);
  b.exit();
  const level = b.finish();
  const w = new World(level, { god: true });
  const input = makeInput();
  w.player.x = 10 * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const c = spawnEnemy(w, { type: 'rivalchariot', x: w.camera.x + VIEW_W + 30, y: 13 * TILE, face: -1, delay: 0.1 });
  let charged = false;
  let teleT = 0;
  let last = 0;
  for (let k = 0; k < seconds(8) && c.alive; k++) {
    run(w, input, 1);
    if (c.state === 'tele') teleT += 1 / 60;
    if (c.state === 'charge') charged = true;
    last = c.x;
  }
  assert.ok(teleT >= 0.8, `telegraphed ${teleT.toFixed(2)} s`);
  assert.ok(charged && !c.alive, 'it charged and left');
  assert.ok(last < w.camera.x + 40, 'it crossed the screen');
  // and a bullet hurts it
  const c2 = spawnEnemy(w, { type: 'rivalchariot', x: w.camera.x + 200, y: 13 * TILE, face: -1 });
  assert.equal(damageEnemy(w, c2, ENEMY_DEFS.rivalchariot.hp, null), true);
});

test('hoplite: the shield stops shots from the front but not diagonal or rear shots', () => {
  const b = new LevelBuilder({ id: 5, theme: 'troy', seed: 1 });
  b.flat(40);
  b.exit();
  const w = new World(b.finish(), { god: true });
  const h = spawnEnemy(w, { type: 'hoplite', x: 200, y: 13 * TILE, face: -1 });
  const hp = h.hp;
  damageEnemy(w, h, 1, { x: 190, y: 13 * TILE - 14, vx: 340, vy: 0 });
  assert.equal(h.hp, hp, 'a flat shot from the front is blocked');
  damageEnemy(w, h, 1, { x: 190, y: 13 * TILE - 14, vx: 240, vy: -240 });
  assert.equal(h.hp, hp - 1, 'a 45-degree shot gets over the shield');
  damageEnemy(w, h, 1, { x: 210, y: 13 * TILE - 14, vx: -340, vy: 0 });
  assert.equal(h.hp, hp - 2, 'a shot from behind lands');
});

test('Ballista Bolt: the ancient era weapon pierces a line of enemies and punches through armour', () => {
  for (const i of [4, 5, 6, 7]) assert.equal(eraWeaponFor(i), 'ballista');
  const wd = WEAPONS.ballista;
  assert.equal(wd.letter, 'E');
  assert.equal(wd.era, 1);
  const b = new LevelBuilder({ id: 5, theme: 'troy', seed: 1 });
  b.flat(40);
  b.exit();
  const w = new World(b.finish(), { god: true });
  const input = makeInput();
  // a brute's armour takes only 25% of a body hit; the bolt ignores that
  const brute = spawnEnemy(w, { type: 'brute', x: 14 * TILE, y: 13 * TILE, face: -1 });
  const grunts = [10, 12].map((tx) => spawnEnemy(w, { type: 'grunt', x: tx * TILE, y: 13 * TILE, face: -1 }));
  [brute, ...grunts].forEach((e) => { e.t = 99; e.state = 'idle'; });
  grunts.forEach((e) => { e.hp = e.maxHp = 50; e.speedMul = 0; });
  w.player.slots[0] = 'ballista';
  w.player.slot = 0;
  w.player.x = 4 * TILE;
  w.player.y = 13 * TILE;
  const hp0 = brute.hp;
  run(w, input, seconds(0.12), ['fire']);
  run(w, input, seconds(0.7));
  assert.ok(grunts.every((e) => e.hp < 50), 'the bolt passed through both grunts');
  assert.ok(brute.hp <= hp0 - 4 + 0.01, `armour ignored (brute ${hp0} -> ${brute.hp})`);
  assert.ok(wd.cooldown > 0.4 && wd.fire, 'heavy and slow to reload');
});

test('archer: a lobbed, telegraphed arrow', () => {
  const d = ENEMY_DEFS.archer;
  assert.equal(d.bullet.kind, 'arrow');
  assert.ok(d.bullet.g > 0 && d.tele >= 0.65);
});
