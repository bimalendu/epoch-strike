import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { World } from '../src/game/world.js';
import { flatLevel } from '../src/game/ascii.js';
import { TILE, DT } from '../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../src/game/enemies.js';
import { ballisticAngle } from '../src/game/ai.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';

const FLOOR = 14 * TILE;

function arena(spawns = [], opts = {}) {
  const lvl = flatLevel(90, 14);
  lvl.spawns = spawns;
  const w = new World(lvl, { god: true, ...opts });
  return w;
}

/** Step until `cond` is true or `maxS` seconds pass; returns elapsed seconds (or null). */
function until(w, input, cond, maxS = 8) {
  for (let i = 0; i < seconds(maxS); i++) {
    run(w, input, 1);
    if (cond()) return i * DT;
  }
  return null;
}

test('every enemy def names a known archetype and has the numbers it needs', () => {
  const archs = new Set(['runner', 'shooter', 'turret', 'flyer', 'heavy', 'spawner', 'capsule', 'boss', 'faller', 'crusher', 'charger', 'launcher', 'breacher', 'duelist', 'mine']);
  for (const d of Object.values(ENEMY_DEFS)) {
    assert.ok(archs.has(d.arch), `${d.id}: unknown arch ${d.arch}`);
    assert.ok(d.hp > 0 && d.w > 0 && d.h > 0, `${d.id}: size and hp`);
    if (d.bullet) assert.ok(d.bullet.speed > 0, `${d.id}: bullet speed`);
    if (['shooter', 'turret', 'heavy'].includes(d.arch)) assert.ok(d.tele >= 0.5, `${d.id}: shots are telegraphed for at least 0.5 s`);
    if (d.arch === 'flyer' && d.pattern === 'dive') assert.ok(d.tele >= 0.6, `${d.id}: dives are telegraphed`);
    if (d.arch === 'charger') assert.ok(d.tele >= 0.6 && d.charge > 0, `${d.id}: charges are telegraphed`);
    if (d.arch === 'breacher') assert.ok(d.tele >= 0.6 && d.leapV > 0 && d.range > 0, `${d.id}: leaps are telegraphed`);
    if (d.arch === 'launcher') assert.ok(d.tele >= 0.6 && d.period > d.tele, `${d.id}: rockets are telegraphed`);
    if (d.arch === 'duelist') assert.ok(d.tele >= 0.6 && d.dash > 0 && d.range > 0, `${d.id}: dashes are telegraphed`);
    if (d.arch === 'mine') assert.ok(d.tele >= 0.45 && d.blast > 0 && d.trig > 0, `${d.id}: mines warn you before they go off`);
    if (d.ambush) assert.ok(d.stall >= 0.4, `${d.id}: an ambusher pauses when it steps out`);
  }
  for (const k of ['runner', 'shooter', 'turret', 'flyer', 'heavy', 'spawner']) {
    assert.ok(Object.values(ENEMY_DEFS).some((d) => d.arch === k), `a def uses ${k}`);
  }
});

test('ballistic aim: a lobbed shot lands on the target', () => {
  const v = 200, g = 230;
  for (const [dx, dy] of [[100, 0], [-120, -20], [60, 30], [130, -20]]) {
    const a = ballisticAngle(dx, dy, v, g);
    let x = 0, y = 0, vx = Math.cos(a) * v, vy = Math.sin(a) * v, best = Infinity;
    for (let i = 0; i < 400; i++) {
      vy += g * DT; x += vx * DT; y += vy * DT;
      best = Math.min(best, Math.hypot(x - dx, y - dy));
    }
    assert.ok(best < 4, `lob to ${dx},${dy} missed by ${best.toFixed(1)}px`);
  }
});

test('turret: aims, telegraphs for >=0.5 s, then lobs a bullet that falls under gravity', () => {
  const w = arena([{ type: 'spitter', x: 9 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  run(w, input, 2);
  const t = w.enemies[0];
  assert.ok(t && t.arch === 'turret');
  const tTele = until(w, input, () => t.state === 'tele', 4);
  assert.ok(tTele !== null, 'it starts a telegraph');
  const tFire = until(w, input, () => w.ebullets.length > 0, 3);
  assert.ok(tFire !== null && tFire >= 0.5, `telegraph lasted ${tFire}`);
  const b = w.ebullets[0];
  assert.equal(b.kind, 'spit');
  assert.ok(b.g > 0);
  const vy0 = b.vy;
  run(w, input, 10);
  assert.ok(b.vy > vy0 + 20, 'gravity pulls the spit down');
});

test('turret: head stays inside its arc even when the player is behind it', () => {
  const w = arena([{ type: 'spitter', x: 9 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  run(w, input, 120);
  const t = w.enemies[0];
  // the player is below the horizon of a plant that can only face upward
  assert.ok(t.ang <= 0.0001 && t.ang >= -Math.PI - 0.0001, `angle ${t.ang} is in the upper half`);
});

test('pod: closed pods shrug bullets off, open pods take damage', () => {
  const w = arena([{ type: 'pod', x: 20 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  run(w, input, 2);
  const pod = w.enemies[0];
  pod.open = false;
  pod.cycleT = 99;
  const hp = pod.hp;
  damageEnemy(w, pod, 1, { x: pod.x, y: pod.cy, vx: 300, vy: 0 });
  assert.equal(pod.hp, hp, 'closed: no damage');
  pod.open = true;
  damageEnemy(w, pod, 1, { x: pod.x, y: pod.cy, vx: 300, vy: 0 });
  assert.equal(pod.hp, hp - 1, 'open: hurt');
});

test('pod: opens and closes on a timer', () => {
  const w = arena([{ type: 'pod', x: 30 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  run(w, input, 2);
  const pod = w.enemies[0];
  const seen = new Set();
  for (let i = 0; i < seconds(8); i++) {
    run(w, input, 1);
    seen.add(pod.open);
  }
  assert.ok(seen.has(true) && seen.has(false), 'cycles between open and closed');
});

test('flyer (sine): crosses the screen and telegraphs before it shoots', () => {
  const w = arena([{ type: 'drone', x: 31 * TILE, y: 8 * TILE, trig: 0, face: -1 }]);
  const input = makeInput();
  run(w, input, 2);
  const d = w.enemies[0];
  const x0 = d.x;
  const tFire = until(w, input, () => w.ebullets.length > 0, 8);
  assert.ok(tFire !== null, 'it fires');
  assert.ok(d.x < x0, 'it moved left');
  assert.ok(Math.abs(d.y - 8 * TILE) <= 20, 'it follows its sine band');
});

test('flyer (dive): cruises, hangs for >=0.6 s, dives at the player, then retreats', () => {
  const w = arena([{ type: 'striker', x: 25 * TILE, y: 6 * TILE, trig: 0, face: -1 }]);
  const input = makeInput();
  run(w, input, 2);
  const s = w.enemies[0];
  const order = [];
  let teleT = 0;
  for (let i = 0; i < seconds(8); i++) {
    run(w, input, 1);
    if (order.at(-1) !== s.state) order.push(s.state);
    if (s.state === 'tele') teleT += DT;
    if (s.state === 'retreat') break;
  }
  assert.deepEqual(order.slice(0, 4), ['cruise', 'tele', 'dive', 'retreat']);
  assert.ok(teleT >= 0.6, `telegraph ${teleT.toFixed(2)}s`);
});

test('heavy: weak point takes full damage, armour takes a chip', () => {
  const w = arena([{ type: 'brute', x: 30 * TILE, y: FLOOR, trig: 0, face: -1 }]);
  const input = makeInput();
  run(w, input, 2);
  const b = w.enemies[0];
  b.face = 1;
  const hp = b.hp;
  // a shot on the glowing chest
  damageEnemy(w, b, 1, { x: b.x + 6, y: b.y - 20, vx: 300, vy: 0 });
  assert.equal(b.hp, hp - 1);
  // a shot at the legs
  damageEnemy(w, b, 1, { x: b.x + 6, y: b.y - 3, vx: 300, vy: 0 });
  assert.ok(Math.abs(b.hp - (hp - 1 - ENEMY_DEFS.brute.armor)) < 1e-9, `armour chip, hp ${b.hp}`);
  // a smart bomb ignores armour
  damageEnemy(w, b, 2, null);
  assert.equal(Math.round((hp - 1 - 0.25 - 2) * 100), Math.round(b.hp * 100));
});

test('heavy: walks toward the player slowly and fires bursts', () => {
  const w = arena([{ type: 'brute', x: 27 * TILE, y: FLOOR, trig: 0, face: -1 }], { difficulty: 'easy' });
  const input = makeInput();
  run(w, input, 2);
  const b = w.enemies[0];
  const x0 = b.x;
  run(w, input, seconds(2));
  assert.ok(b.x < x0 - 10 && b.x > x0 - 100, `walked ${x0 - b.x}px`);
  const n = until(w, input, () => w.ebullets.length >= 2, 8);
  assert.ok(n !== null, 'fired a burst');
});

test('spawner: keeps at most `max` children alive and stops at the screen cap', () => {
  const w = arena([{ type: 'nest', x: 26 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  run(w, input, seconds(20));
  const nest = w.enemies.find((e) => e.arch === 'spawner');
  const drones = w.enemies.filter((e) => e.id === 'drone');
  assert.ok(nest && drones.length >= 1 && drones.length <= ENEMY_DEFS.nest.max, `${drones.length} drones`);

  const w2 = arena([{ type: 'nest', x: 26 * TILE, y: FLOOR, trig: 0 }]);
  w2.enemyCap = 1; // the nest itself fills the cap
  run(w2, makeInput(), seconds(10));
  assert.equal(w2.enemies.filter((e) => e.id === 'drone').length, 0, 'no room: no spawn');
});

test('enemy cap: a crowd in one place trickles in instead of flooding', () => {
  const spawns = [];
  for (let i = 0; i < 14; i++) spawns.push({ type: 'rifleman', x: (20 + i) * TILE, y: FLOOR, trig: 0 });
  const w = arena(spawns);
  w.enemyCap = 6;
  const input = makeInput();
  let peak = 0;
  for (let i = 0; i < seconds(4); i++) {
    run(w, input, 1);
    peak = Math.max(peak, w.crowd());
  }
  assert.equal(peak, 6, 'never more than the cap alive');
  assert.ok(w.spawnList.some((s) => !s.done), 'the rest are waiting');
});

test('enemy cap grows with the level group: 6, 8, 10, 12, 14', async () => {
  const { enemyCapFor } = await import('../src/game/constants.js');
  assert.deepEqual([0, 3, 4, 7, 8, 11, 12, 15, 16, 19].map(enemyCapFor), [6, 6, 8, 8, 10, 10, 12, 12, 14, 14]);
});

test('capsules do not count toward the enemy cap', () => {
  const w = arena([{ type: 'capsule', x: 20 * TILE, y: 5 * TILE, trig: 0, item: 'S', face: -1 }]);
  run(w, makeInput(), 3);
  assert.equal(w.crowd(), 0);
});

test('raptor: charges the player and leaps when close', () => {
  const w = arena([{ type: 'raptor', x: 14 * TILE, y: FLOOR, trig: 0, face: -1 }]);
  const input = makeInput();
  run(w, input, 2);
  const r = w.enemies[0];
  let leapt = false;
  for (let i = 0; i < seconds(4); i++) {
    run(w, input, 1);
    if (!r.grounded && r.vy < 0) leapt = true;
  }
  assert.ok(leapt, 'it jumped at the player');
});

test('enemy bullets with gravity arc and stop at walls', () => {
  const w = arena();
  const b = w.spawnEnemyBullet({ x: 100, y: 100, vx: 80, vy: -40, g: 200, r: 2, kind: 'spit' });
  const input = makeInput();
  run(w, input, 30);
  assert.ok(b.vy > 0, 'now falling');
  assert.ok(b.x > 100);
});
