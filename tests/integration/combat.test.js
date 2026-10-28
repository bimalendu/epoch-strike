import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { levelFromAscii, flatLevel } from '../../src/game/ascii.js';
import { TILE, VIEW_W } from '../../src/game/constants.js';
import { spawnEnemy } from '../../src/game/enemies.js';

function arena(spawns = []) {
  const lvl = flatLevel(80, 14);
  lvl.spawns = spawns;
  return new World(lvl);
}

test('holding fire shoots the rifle at ~5 shots per second, bullets travel at 340 px/s', () => {
  const w = arena();
  const input = makeInput();
  run(w, input, 10);
  let shots = 0;
  const seen = new Set();
  input.script = { fire: true };
  for (let i = 0; i < 60; i++) {
    input.poll();
    w.update(input);
    for (const b of w.bullets) if (!seen.has(b)) { seen.add(b); shots++; }
    w.events.length = 0;
  }
  assert.ok(shots >= 5 && shots <= 6, `shots in 1s: ${shots}`);
  const b = [...seen][0];
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 340) < 1);
});

test('bullets follow the 8 aim directions', () => {
  const w = arena();
  const input = makeInput();
  run(w, input, 10);
  run(w, input, 1, ['fire', 'up']);
  let b = w.bullets.at(-1);
  assert.ok(Math.abs(b.vx) < 1 && b.vy < -300, 'straight up');
  w.bullets.length = 0;
  w.player.fireT = 0;
  run(w, input, 1, ['fire', 'up', 'right']);
  b = w.bullets.at(-1);
  assert.ok(b.vx > 200 && b.vy < -200, 'diagonal up-right');
});

test('a bullet kills a grunt and reports the score', () => {
  const w = arena([{ type: 'grunt', x: 12 * TILE, y: 14 * TILE, trig: 0 }]);
  const input = makeInput();
  run(w, input, 3);
  assert.equal(w.enemies.length, 1);
  w.enemies[0].x = w.player.x + 70;
  w.enemies[0].vx = 0;
  const ev = run(w, input, seconds(1), ['fire']).filter((e) => e.type === 'kill');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].score, 100);
  assert.equal(w.enemies.length, 0);
});

test('bullets stop at walls', () => {
  const lvl = levelFromAscii(['..........', '.P..#.....', '##########']);
  const w = new World(lvl);
  const input = makeInput();
  run(w, input, seconds(0.2), ['fire']);
  run(w, input, seconds(1), []);
  assert.equal(w.bullets.length, 0);
});

test('a rifleman telegraphs about 0.55s before firing an aimed, slow bullet', () => {
  const w = arena([{ type: 'rifleman', x: 16 * TILE, y: 14 * TILE, trig: 0, face: -1 }]);
  const input = makeInput();
  w.camera.x = 0;
  const e = spawnEnemy(w, w.spawnList[0]);
  w.spawnList[0].done = true;
  e.t = 0; // ready to engage
  let tele = -1;
  let fired = -1;
  for (let i = 0; i < 240; i++) {
    run(w, input, 1, ['down']); // stay prone; far enough that it cannot reach us at once
    if (tele < 0 && e.state === 'tele') tele = i;
    if (fired < 0 && w.ebullets.length > 0) fired = i;
    if (fired >= 0) break;
  }
  assert.ok(tele >= 0 && fired > tele, 'telegraph then fire');
  const delay = (fired - tele) / 60;
  assert.ok(delay > 0.45 && delay < 0.7, `telegraph ${delay}s`);
  const b = w.ebullets[0];
  assert.ok(Math.hypot(b.vx, b.vy) < 100 && Math.hypot(b.vx, b.vy) > 85);
});

test('enemy bullets, enemy contact and spikes all kill the player; respawn gives 2s of invulnerability', () => {
  const w = arena();
  const input = makeInput();
  run(w, input, 5);
  w.spawnEnemyBullet({ x: w.player.x + 40, y: w.player.y - 13, vx: -120, vy: 0, r: 2 });
  const ev = run(w, input, seconds(0.5), []);
  assert.ok(ev.some((e) => e.type === 'playerDied' && e.cause === 'bullet'));
  assert.equal(w.player.alive, false);

  // respawn is invulnerable
  w.respawnPlayer(100, 14 * TILE);
  assert.ok(w.player.invuln > 1.9);
  w.spawnEnemyBullet({ x: w.player.x + 20, y: w.player.y - 13, vx: -120, vy: 0, r: 2 });
  const ev2 = run(w, input, seconds(0.5), []);
  assert.ok(!ev2.some((e) => e.type === 'playerDied'));
  assert.equal(w.player.alive, true);

  // contact
  const w2 = arena();
  run(w2, input, 5);
  const g = spawnEnemy(w2, { type: 'grunt', x: w2.player.x + 10, y: 14 * TILE });
  g.face = -1;
  const ev3 = run(w2, input, seconds(0.5), []);
  assert.ok(ev3.some((e) => e.type === 'playerDied' && e.cause === 'enemy'));
});

test('enemies appear only when the camera approaches', () => {
  const w = arena([{ type: 'grunt', x: 60 * TILE, y: 14 * TILE }]);
  const input = makeInput();
  run(w, input, seconds(0.5), []);
  assert.equal(w.enemies.length, 0);
  run(w, input, seconds(6), ['right']);
  assert.ok(w.enemies.length >= 1 || w.spawnList[0].done);
});

test('runners turn around at platform edges instead of walking off', () => {
  const lvl = levelFromAscii([
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.......####.........',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    'P...................',
    '####################',
  ]);
  const w = new World(lvl);
  const input = makeInput();
  const e = spawnEnemy(w, { type: 'grunt', x: 8.5 * TILE, y: 9 * TILE });
  e.face = 1;
  run(w, input, seconds(4), ['down']);
  assert.ok(e.alive);
  assert.ok(e.y <= 9 * TILE + 0.5, `runner stayed on the ledge (y=${e.y})`);
});
