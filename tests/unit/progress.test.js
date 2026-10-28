// Unit tests for src/game/progress.js (levelProgress, the HUD progress bar) using hand-made fake worlds:
// null when there is nothing to measure, 0 at the start, 1 at the goal, clamping, markers, and the vertical branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { levelProgress } from '../../src/game/progress.js';

const fake = ({ level = {}, player = { x: 0, y: 0 }, checkpoints = [], arenas = [], arenaIdx = 0 } = {}) => ({
  level: { spawn: { x: 100, y: 500 }, ...level },
  player,
  checkpoints,
  arenas,
  arenaIdx,
});

const side = (px, extra = {}) => fake({ level: { exitX: 1100, ...extra }, player: { x: px, y: 500 } });

test('a level with no exit and no boss (the testbed) has no progress bar', () => {
  assert.equal(levelProgress(fake()), null);
});

test('goal equal to start gives null', () => {
  assert.equal(levelProgress(fake({ level: { exitX: 100 } })), null);
});

test('a goal less than a pixel from the start gives null', () => {
  assert.equal(levelProgress(fake({ level: { exitX: 100.5 } })), null);
});

test('horizontal: 0 at the spawn, 1 at the exit, linear between', () => {
  assert.equal(levelProgress(side(100)).frac, 0);
  assert.equal(levelProgress(side(1100)).frac, 1);
  assert.equal(levelProgress(side(600)).frac, 0.5);
  assert.equal(levelProgress(side(100)).vertical, false);
});

test('horizontal: clamped before the start and past the goal', () => {
  assert.equal(levelProgress(side(-300)).frac, 0);
  assert.equal(levelProgress(side(9999)).frac, 1);
});

test('a boss trigger stands in for the exit when there is no exitX', () => {
  const p = levelProgress(fake({ level: { boss: { trigger: 1100 } }, player: { x: 600, y: 500 } }));
  assert.equal(p.frac, 0.5);
});

test('exitX takes priority over the boss trigger', () => {
  const p = levelProgress(fake({ level: { exitX: 1100, boss: { trigger: 5000 } }, player: { x: 600, y: 500 } }));
  assert.equal(p.frac, 0.5);
});

test('a goal to the left of the spawn still measures progress toward it', () => {
  const p = levelProgress(fake({ level: { exitX: -900 }, player: { x: -400, y: 0 } }));
  assert.equal(p.frac, 0.5);
});

test('vertical: climbing from the spawn height to exitY runs 0 to 1 going up', () => {
  const mk = (py) => fake({ level: { exitY: 100 }, player: { x: 0, y: py } });
  assert.equal(levelProgress(mk(500)).frac, 0);
  assert.equal(levelProgress(mk(300)).frac, 0.5);
  assert.equal(levelProgress(mk(100)).frac, 1);
  assert.equal(levelProgress(mk(100)).vertical, true);
});

test('vertical: clamped when below the start or above the goal', () => {
  const mk = (py) => fake({ level: { exitY: 100 }, player: { x: 0, y: py } });
  assert.equal(levelProgress(mk(900)).frac, 0);
  assert.equal(levelProgress(mk(-50)).frac, 1);
});

test('vertical: a boss triggerY works when exitY is absent, and ignores x entirely', () => {
  const p = levelProgress(fake({ level: { boss: { triggerY: 100, trigger: 9999 } }, player: { x: 7777, y: 300 } }));
  assert.equal(p.vertical, true);
  assert.equal(p.frac, 0.5);
});

test('checkpoints are placed as fractions and carry their hit flag', () => {
  const w = fake({
    level: { exitX: 1100 },
    player: { x: 100, y: 0 },
    checkpoints: [{ x: 600, y: 0, hit: true }, { x: 1100, y: 0 }, { x: 5000, y: 0 }],
  });
  assert.deepEqual(levelProgress(w).checkpoints, [
    { f: 0.5, hit: true },
    { f: 1, hit: false },
    { f: 1, hit: false },
  ]);
});

test('arenas list every arena but the last, marking those already cleared', () => {
  const w = fake({
    level: { exitX: 1100 },
    player: { x: 100, y: 0 },
    arenas: [{ trigger: 350 }, { x0: 850 }, { trigger: 1100 }],
    arenaIdx: 1,
  });
  const a = levelProgress(w).arenas;
  assert.equal(a.length, 2);
  assert.deepEqual(a, [{ f: 0.25, done: true }, { f: 0.75, done: false }]);
});

test('arenas is empty with a single arena or none', () => {
  assert.deepEqual(levelProgress(fake({ level: { exitX: 1100 }, arenas: [{ trigger: 1100 }] })).arenas, []);
  assert.deepEqual(levelProgress(fake({ level: { exitX: 1100 } })).arenas, []);
});

test('vertical arenas use triggerY (falling back to floorY) for their marker', () => {
  const w = fake({
    level: { exitY: 100 },
    player: { x: 0, y: 500 },
    arenas: [{ triggerY: 300 }, { floorY: 200 }, { triggerY: 100 }],
  });
  assert.deepEqual(levelProgress(w).arenas.map((a) => a.f), [0.5, 0.75]);
});
