// Unit tests for the pure-ish parts of src/game/stealth.js (Level 17 stealth): beamX sweep bounds, clearLine,
// inBeam, updateSearchlight's spot meter, raiseAlarm, updateAlarm's countdowns and snooze (sleeping guards).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { spawnArena } from '../support/fixtures.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { STEALTH, DT, TILE } from '../../src/game/constants.js';
import { T } from '../../src/game/tiles.js';
import { beamX, clearLine, inBeam, updateSearchlight, raiseAlarm, updateAlarm, snooze } from '../../src/game/stealth.js';

const FLOOR = 14 * TILE;

/** A flat arena with the soldier standing on the floor at x, and a searchlight zone that covers the whole map. */
function setup(px = 200) {
  const w = spawnArena();
  w.player.x = px;
  w.player.y = FLOOR;
  w.player.alive = true;
  const z = { type: 'searchlight', x0: 0, x1: 1000, a: 100, b: 300, period: 4, phase: 0, floorY: FLOOR, lampX: 200, lampY: 40 };
  return [w, z];
}

// ---- beamX ----

test('beamX starts at the middle of its range and sweeps between a and b', () => {
  const z = { a: 100, b: 300, period: 4 };
  assert.equal(beamX(z, 0), 200);
  assert.ok(Math.abs(beamX(z, 1) - 300) < 1e-9);
  assert.ok(Math.abs(beamX(z, 3) - 100) < 1e-9);
  assert.ok(Math.abs(beamX(z, 4) - 200) < 1e-9);
});

test('beamX never leaves [a, b] over a long run', () => {
  const z = { a: 120, b: 260, period: 3.3, phase: 1.1 };
  for (let t = 0; t < 60; t += DT) {
    const x = beamX(z, t);
    assert.ok(x >= z.a - 1e-9 && x <= z.b + 1e-9, `t ${t} x ${x}`);
  }
});

test('beamX honours the phase offset', () => {
  const z = { a: 100, b: 300, period: 4, phase: Math.PI / 2 };
  assert.ok(Math.abs(beamX(z, 0) - 300) < 1e-9);
});

// ---- clearLine / inBeam ----

test('clearLine is true across open air and false through a solid tile', () => {
  const [w] = setup();
  assert.equal(clearLine(w, 10, 10, 200, 200), true);
  // a solid tile in the way (stub world)
  const blocked = { tile: (x, y) => (x === 5 && y === 5 ? T.SOLID : T.AIR) };
  assert.equal(clearLine(blocked, 5 * TILE - 40, 5 * TILE + 8, 5 * TILE + 40, 5 * TILE + 8), false);
});

test('inBeam: the soldier on the ground under the pool is lit', () => {
  const [w, z] = setup(200);
  assert.equal(inBeam(w, z, 200), true);
});

test('inBeam: the pool covers RADIUS plus half the soldier\'s width, no more', () => {
  const [w, z] = setup(200);
  const reach = STEALTH.RADIUS + w.player.w / 2;
  assert.equal(inBeam(w, z, 200 + reach - 1), true);
  assert.equal(inBeam(w, z, 200 + reach + 1), false);
  assert.equal(inBeam(w, z, 200 - reach - 1), false);
});

test('inBeam: a soldier higher than BAND above the ground is in the dark', () => {
  const [w, z] = setup(200);
  w.player.y = FLOOR - STEALTH.BAND - 1;
  assert.equal(inBeam(w, z, 200), false);
  w.player.y = FLOOR - STEALTH.BAND + 1;
  assert.equal(inBeam(w, z, 200), true);
});

test('inBeam: a dead soldier is never lit', () => {
  const [w, z] = setup(200);
  w.player.alive = false;
  assert.equal(inBeam(w, z, 200), false);
});

// ---- updateSearchlight ----

test('updateSearchlight moves the pool to beamX at the world clock', () => {
  const [w, z] = setup();
  w.time = 1;
  updateSearchlight(w, z, DT);
  assert.ok(Math.abs(z.tx - 300) < 1e-9);
});

test('updateSearchlight: the tx it sets always lies within the sweep bounds', () => {
  const [w, z] = setup();
  for (let i = 0; i < 600; i++) {
    w.time = i * DT;
    updateSearchlight(w, z, DT);
    assert.ok(z.tx >= z.a - 1e-9 && z.tx <= z.b + 1e-9);
  }
});

test('standing in the pool fills the meter and sets lit', () => {
  const [w, z] = setup(200);
  w.time = 0; // pool centred at 200
  updateSearchlight(w, z, 0.2);
  assert.equal(z.lit, true);
  assert.ok(Math.abs(z.meter - 0.2) < 1e-9);
});

test('staying lit for SPOT_TIME rings the alarm and resets the meter', () => {
  const [w, z] = setup(200);
  w.time = 0;
  let frames = 0;
  while (w.alarmT <= 0 && frames < 200) {
    updateSearchlight(w, z, DT);
    frames++;
  }
  assert.ok(w.alarmT > 0, 'alarm rang');
  assert.ok(Math.abs(frames * DT - STEALTH.SPOT_TIME) < 2 * DT, `rang after ${frames * DT}s`);
  assert.equal(z.meter, 0);
  assert.equal(w.alarmT, STEALTH.ALARM_TIME);
  assert.equal(w.alarmCool, STEALTH.COOLDOWN);
});

test('stepping out of the pool drains the meter, slower than it filled', () => {
  const [w, z] = setup(200);
  w.time = 0;
  updateSearchlight(w, z, 0.3);
  w.player.x = 280; // outside the lit circle
  updateSearchlight(w, z, 0.1);
  assert.equal(z.lit, false);
  assert.ok(Math.abs(z.meter - (0.3 - 0.1 * 1.2)) < 1e-9);
});

test('the meter never goes below zero', () => {
  const [w, z] = setup(200);
  w.player.x = 400;
  updateSearchlight(w, z, 5);
  assert.equal(z.meter, 0);
});

test('a soldier outside the zone columns is not watched and drains faster', () => {
  const [w, z] = setup(200);
  w.time = 0;
  updateSearchlight(w, z, 0.3);
  z.x0 = 500;
  updateSearchlight(w, z, 0.1);
  assert.equal(z.lit, false);
  assert.ok(Math.abs(z.meter - (0.3 - 0.2)) < 1e-9);
});

test('while the alarm is already ringing the light cannot raise it again', () => {
  const [w, z] = setup(200);
  w.time = 0;
  w.alarmT = 3;
  for (let i = 0; i < 120; i++) updateSearchlight(w, z, DT);
  assert.equal(z.meter, 0);
  assert.equal(z.lit, false);
});

test('during the cooldown a full meter does not ring the alarm', () => {
  const [w, z] = setup(200);
  w.time = 0;
  w.alarmCool = 5;
  for (let i = 0; i < 120; i++) updateSearchlight(w, z, DT);
  assert.equal(w.alarmT, 0);
  assert.equal(z.meter, STEALTH.SPOT_TIME);
});

// ---- raiseAlarm ----

test('raiseAlarm posts an alarm event and sends two troopers in from the screen edges', () => {
  const [w, z] = setup(200);
  const before = w.enemies.length;
  raiseAlarm(w, z);
  assert.ok(w.events.some((e) => e.type === 'alarm'));
  const added = w.enemies.slice(before);
  assert.equal(added.length, 2);
  assert.ok(added.every((e) => e.alarmBorn && e.id === 'snowtrooper'));
  const xs = added.map((e) => e.x).sort((a, b) => a - b);
  assert.ok(xs[0] < w.camera.x && xs[1] > w.camera.x + 480);
});

test('raiseAlarm spawns no reinforcements once the enemy cap is reached', () => {
  const [w, z] = setup(200);
  w.enemyCap = 0;
  const before = w.enemies.length;
  raiseAlarm(w, z);
  assert.equal(w.enemies.length, before);
  assert.ok(w.alarmT > 0);
});

// ---- updateAlarm ----

test('updateAlarm counts the alarm and the cooldown down by dt', () => {
  const [w] = setup();
  w.alarmT = 1;
  w.alarmCool = 2;
  updateAlarm(w, 0.25);
  assert.equal(w.alarmT, 0.75);
  assert.equal(w.alarmCool, 1.75);
});

test('updateAlarm stops at zero and never goes negative', () => {
  const [w] = setup();
  w.alarmT = 0.1;
  w.alarmCool = 0.1;
  updateAlarm(w, 1);
  assert.equal(w.alarmT, 0);
  assert.equal(w.alarmCool, 0);
  updateAlarm(w, 1);
  assert.equal(w.alarmT, 0);
});

test('the alarm lasts ALARM_TIME seconds and the cooldown COOLDOWN seconds', () => {
  const [w, z] = setup();
  raiseAlarm(w, z);
  let t = 0;
  while (w.alarmT > 0) {
    updateAlarm(w, DT);
    t += DT;
  }
  assert.ok(Math.abs(t - STEALTH.ALARM_TIME) < 2 * DT);
  assert.ok(w.alarmCool > 0, 'the cooldown outlasts the alarm');
  while (w.alarmCool > 0) {
    updateAlarm(w, DT);
    t += DT;
  }
  assert.ok(Math.abs(t - STEALTH.COOLDOWN) < 2 * DT);
});

// ---- snooze ----

const sleeper = (w, x = 300) => {
  const e = spawnEnemy(w, { type: 'grunt', x, y: FLOOR, sleeper: true });
  return e;
};

test('snooze: an ordinary guard (not a sleeper) is never held asleep', () => {
  const [w] = setup(100);
  const e = spawnEnemy(w, { type: 'grunt', x: 400, y: FLOOR });
  assert.equal(snooze(w, e, DT), false);
});

test('snooze: a sleeper far from the soldier stays asleep and does not move', () => {
  const [w] = setup(50);
  const e = sleeper(w, 400);
  e.vx = 40;
  assert.equal(snooze(w, e, DT), true);
  assert.equal(e.vx, 0);
  assert.equal(e.woke, undefined);
});

test('snooze: it wakes when the soldier comes within WAKE_R', () => {
  const [w] = setup(400 - STEALTH.WAKE_R + 2);
  const e = sleeper(w, 400);
  assert.equal(snooze(w, e, DT), false);
  assert.equal(e.woke, true);
  assert.equal(e.t, 0.6);
});

test('snooze: just outside WAKE_R it stays asleep', () => {
  const [w] = setup(400 - STEALTH.WAKE_R - 2);
  const e = sleeper(w, 400);
  assert.equal(snooze(w, e, DT), true);
});

test('snooze: a soldier on a ledge more than 44 px away vertically does not wake it', () => {
  const [w] = setup(400);
  w.player.y = FLOOR - 60;
  const e = sleeper(w, 400);
  assert.equal(snooze(w, e, DT), true);
});

test('snooze: the alarm wakes a sleeper', () => {
  const [w] = setup(50);
  const e = sleeper(w, 400);
  w.alarmT = 2;
  assert.equal(snooze(w, e, DT), false);
  assert.equal(e.woke, true);
});

test('snooze: damage wakes a sleeper', () => {
  const [w] = setup(50);
  const e = sleeper(w, 400);
  e.hp = e.maxHp - 0.5;
  assert.equal(snooze(w, e, DT), false);
});

test('snooze: once woken it stays awake', () => {
  const [w] = setup(50);
  const e = sleeper(w, 400);
  w.alarmT = 1;
  snooze(w, e, DT);
  w.alarmT = 0;
  assert.equal(snooze(w, e, DT), false);
});

test('snooze: waking pops a "!" above the guard', () => {
  const [w] = setup(50);
  const e = sleeper(w, 400);
  w.alarmT = 1;
  snooze(w, e, DT);
  assert.ok(w.fx.some((f) => f.k === 'text' && f.text === '!'));
});

test('snooze: a dead soldier cannot wake a sleeper by proximity', () => {
  const [w] = setup(400);
  w.player.alive = false;
  const e = sleeper(w, 400);
  assert.equal(snooze(w, e, DT), true);
});
