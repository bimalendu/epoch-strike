// Unit tests for chainZap in src/game/tesla.js (the Tesla Coil's chain lightning) on a minimal flat arena:
// hop limit, range, and which enemies are skipped (bosses, hidden, waiting, non-contact, dead, off-screen).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { spawnArena } from '../support/fixtures.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { chainZap, CHAIN_RANGE, CHAIN_HOPS, CHAIN_DMG } from '../../src/game/tesla.js';

const FLOOR = 14 * 16; // flatLevel(…, 14): floor row 14
const bolt = {};

/** Arena with a grunt placed at each x (all on the floor, camera at 0 so x in 0..480 is on screen). Returns [world, enemies]. */
function arenaWith(xs) {
  const w = spawnArena();
  const list = xs.map((x) => {
    const e = spawnEnemy(w, { type: 'grunt', x, y: FLOOR });
    e.hp = e.maxHp = 10; // survive any number of zaps so we can count damage
    return e;
  });
  return [w, list];
}
const zaps = (w) => w.fx.filter((f) => f.k === 'zap');
const hurt = (list) => list.filter((e) => e.hp < e.maxHp);

test('the chain jumps to the nearest enemy within range and hurts it for CHAIN_DMG', () => {
  const [w, [a, b]] = arenaWith([100, 100 + CHAIN_RANGE - 10]);
  chainZap(bolt, w, a);
  assert.equal(a.hp, a.maxHp, 'the first victim is hit by the bolt itself, not by the chain');
  assert.ok(Math.abs(b.maxHp - b.hp - CHAIN_DMG) < 1e-9);
  assert.equal(zaps(w).length, 1);
});

test('the arc runs from the first victim to the next one', () => {
  const [w, [a, b]] = arenaWith([100, 150]);
  chainZap(bolt, w, a);
  const z = zaps(w)[0];
  assert.equal(z.x0, a.x);
  assert.equal(z.y0, a.cy);
  assert.equal(z.x1, b.x);
  assert.equal(z.y1, b.cy);
});

test('an enemy beyond CHAIN_RANGE is not zapped', () => {
  const [w, [a, far]] = arenaWith([100, 100 + CHAIN_RANGE + 2]);
  chainZap(bolt, w, a);
  assert.equal(hurt([far]).length, 0);
  assert.equal(zaps(w).length, 0);
});

test('with a lone enemy there is nothing to chain to', () => {
  const [w, [a]] = arenaWith([100]);
  chainZap(bolt, w, a);
  assert.equal(zaps(w).length, 0);
  assert.equal(a.hp, a.maxHp);
});

test('the chain makes at most CHAIN_HOPS hops, hitting nearest-first along a line of enemies', () => {
  const xs = [100, 150, 200, 250, 300, 350];
  const [w, list] = arenaWith(xs);
  chainZap(bolt, w, list[0]);
  assert.equal(zaps(w).length, CHAIN_HOPS);
  assert.deepEqual(list.map((e) => e.hp < e.maxHp), [false, true, true, false, false, false].slice(0, list.length));
});

test('each hop picks the nearest unhit enemy to the previous victim', () => {
  const [w, [a, far, near]] = arenaWith([100, 170, 130]);
  chainZap(bolt, w, a);
  const z = zaps(w);
  assert.equal(z[0].x1, near.x);
  assert.equal(z[1].x1, far.x);
});

test('it never zaps the same enemy twice and never zaps the first victim', () => {
  const [w, list] = arenaWith([100, 120, 140]);
  chainZap(bolt, w, list[1]);
  const targets = zaps(w).map((z) => z.x1);
  assert.equal(new Set(targets).size, targets.length);
  assert.ok(!targets.includes(list[1].x));
  assert.equal(list[1].hp, list[1].maxHp);
  assert.ok(Math.abs(list[0].maxHp - list[0].hp - CHAIN_DMG) < 1e-9);
  assert.ok(Math.abs(list[2].maxHp - list[2].hp - CHAIN_DMG) < 1e-9);
});

test('bosses are skipped', () => {
  const [w, [a, boss, grunt]] = arenaWith([100, 110, 160]);
  boss.def = { ...boss.def, boss: true };
  chainZap(bolt, w, a);
  assert.equal(boss.hp, boss.maxHp);
  assert.ok(grunt.hp < grunt.maxHp, 'it reaches past the boss to the next enemy');
});

test('hidden enemies are skipped', () => {
  const [w, [a, hidden]] = arenaWith([100, 110]);
  hidden.hidden = true;
  chainZap(bolt, w, a);
  assert.equal(hidden.hp, hidden.maxHp);
  assert.equal(zaps(w).length, 0);
});

test('waiting enemies are skipped', () => {
  const [w, [a, waiting]] = arenaWith([100, 110]);
  waiting.waiting = true;
  chainZap(bolt, w, a);
  assert.equal(waiting.hp, waiting.maxHp);
});

test('dead enemies are skipped', () => {
  const [w, [a, dead]] = arenaWith([100, 110]);
  dead.alive = false;
  chainZap(bolt, w, a);
  assert.equal(dead.hp, dead.maxHp);
});

test('non-contact enemies (such as capsules) are skipped', () => {
  const [w, [a, c]] = arenaWith([100, 110]);
  c.def = { ...c.def, contact: false };
  chainZap(bolt, w, a);
  assert.equal(c.hp, c.maxHp);
});

test('off-screen enemies are skipped even when within range', () => {
  const [w, [a, off]] = arenaWith([400, 400 + 60]);
  w.camera.x = 0;
  off.x = 484 + 10; // just beyond the right edge (+6 px inset) but within 78 px of a
  chainZap(bolt, w, a);
  assert.equal(off.hp, off.maxHp);
});

test('an enemy just inside the screen edge can be chained', () => {
  const [w, [a, edge]] = arenaWith([440, 470]);
  chainZap(bolt, w, a);
  assert.ok(edge.hp < edge.maxHp);
});

test('the camera position decides what counts as on screen', () => {
  const [w, [a, b]] = arenaWith([700, 740]);
  chainZap(bolt, w, a);
  assert.equal(b.hp, b.maxHp, 'off screen with the camera at 0');
  w.camera.x = 500;
  chainZap(bolt, w, a);
  assert.ok(b.hp < b.maxHp, 'on screen once the camera has scrolled');
});

test('chain zap effects are short-lived arcs with a seed', () => {
  const [w, [a]] = arenaWith([100, 140]);
  chainZap(bolt, w, a);
  const z = zaps(w)[0];
  assert.ok(z.life > 0 && z.life === z.max);
  assert.ok(Number.isInteger(z.seed) && z.seed >= 0 && z.seed < 1000);
});
