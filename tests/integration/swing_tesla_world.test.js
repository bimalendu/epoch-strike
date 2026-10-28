// Rope swings and the Tesla Coil's chain lightning as they behave INSIDE a running World (the pure helpers are covered in
// tests/unit/swing.test.js and tests/unit/tesla.test.js): the plank carries whoever rides it and lets go of whoever does
// not, and a Tesla chain works on a crowd that the world's enemy cap has limited.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { flatLevel } from '../../src/game/ascii.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { CHAIN_HOPS } from '../../src/game/tesla.js';
import { TILE } from '../../src/game/constants.js';

// ---------------------------------------------------------------------------------------------------------------
// A rider on a swing
// ---------------------------------------------------------------------------------------------------------------

/** A world with one rope swing over a 9-tile chasm, and the soldier standing on the plank moving toward the far ledge. */
function rider({ god = true } = {}) {
  const b = new LevelBuilder({ id: 11, theme: 'pirate', seed: 7 });
  b.flat(14);
  b.flat(6);
  const sw = b.swing(9, { period: 3.6 });
  b.flat(6);
  b.flat(10);
  b.exit();
  const w = new World(b.finish(), { god });
  const pl = w.platforms[0];
  const input = makeInput();
  for (let k = 0; k < seconds(8); k++) {
    run(w, input, 1);
    if (pl.x + pl.w / 2 < sw.x0 * TILE + 44 && pl.vx > 20) break; // the plank is coming in from the left ledge
  }
  w.player.x = pl.x + pl.w / 2;
  w.player.y = pl.y;
  w.player.vy = 0;
  w.camera.snap(w.player);
  run(w, input, 2);
  assert.equal(w.player.platform, pl, 'the soldier is standing on the plank');
  return { w, pl, input };
}

test('a rider stays at the same spot on the plank, frame after frame, as it swings', () => {
  const { w, pl, input } = rider();
  const offset = w.player.x - (pl.x + pl.w / 2);
  const yGap = w.player.y - pl.y;
  for (let f = 0; f < seconds(1.5); f++) {
    run(w, input, 1);
    assert.equal(w.player.platform, pl, `still on the plank at frame ${f}`);
    assert.ok(Math.abs(w.player.x - (pl.x + pl.w / 2) - offset) < 1.5, `x drifted at frame ${f}`);
    assert.ok(Math.abs(w.player.y - pl.y - yGap) < 1.5, `y drifted at frame ${f}`);
  }
});

test('the plank rises and falls along its arc and the rider rises and falls with it', () => {
  const { w, pl, input } = rider();
  const ys = [];
  const plankYs = [];
  for (let f = 0; f < seconds(3.6); f++) {
    run(w, input, 1);
    ys.push(w.player.y);
    plankYs.push(pl.y);
  }
  const span = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(span(plankYs) > 3, 'the plank really moves up and down');
  assert.ok(Math.abs(span(ys) - span(plankYs)) < 3, 'the rider covers the same height');
});

test('a soldier who jumps clear of the plank is no longer carried by it', () => {
  const { w, pl, input } = rider();
  run(w, input, 2, ['jump']);
  assert.equal(w.player.platform, null, 'airborne');
  const x0 = w.player.x;
  const plankX0 = pl.x;
  run(w, input, 6, []);
  const plankMoved = pl.x - plankX0;
  assert.ok(Math.abs(plankMoved) > 1, 'the plank kept swinging');
  assert.ok(Math.abs(w.player.x - x0) < Math.abs(plankMoved) * 0.5, 'but the jumper did not follow it');
});

test('a soldier killed on the plank is not dragged along by it', () => {
  const { w, pl, input } = rider({ god: false });
  w.player.invuln = 0;
  w.player.barrier = 0;
  w.killPlayer('test');
  const x0 = w.player.x;
  const plankX0 = pl.x;
  run(w, input, 30, []);
  assert.ok(Math.abs(pl.x - plankX0) > 3, 'the plank swung on');
  assert.ok(Math.abs(w.player.x - x0) < 1, 'the body stayed where it fell');
});

test('the planks keep their own clock whether or not anyone rides them: the same swing on every run', () => {
  const a = rider().pl;
  const b = rider().pl;
  assert.equal(a.t, b.t);
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
});

// ---------------------------------------------------------------------------------------------------------------
// Tesla chain lightning on a capped crowd
// ---------------------------------------------------------------------------------------------------------------

const FLOOR = 14 * TILE;

/** A flat arena whose enemy cap is `cap`, holding `count` tough grunts packed close together in front of the soldier. */
function crowd({ cap, count, tesla = true }) {
  const lvl = flatLevel(90, 14);
  lvl.enemyCap = cap;
  lvl.spawns = Array.from({ length: count }, (_, i) => ({ type: 'grunt', x: 150 + i * 14, y: FLOOR, face: -1 }));
  const w = new World(lvl, { god: true });
  if (tesla) {
    w.player.slots[0] = 'tesla';
    w.player.slot = 0;
  }
  return { w, input: makeInput() };
}

const grunts = (w) => w.enemies.filter((e) => e.alive);

test('a capped world only lets cap-many enemies in at once, even when many more are waiting to spawn', () => {
  const { w, input } = crowd({ cap: 3, count: 8 });
  run(w, input, 10);
  assert.equal(w.enemyCap, 3);
  assert.equal(w.crowd(), 3);
});

test('a Tesla bolt into a capped crowd hurts the victim and at most CHAIN_HOPS others, and never adds an enemy', () => {
  const { w, input } = crowd({ cap: 4, count: 4 });
  run(w, input, 10);
  const list = grunts(w);
  assert.equal(list.length, 4);
  for (const e of list) e.hp = e.maxHp = 50; // survive the whole exchange so damage can be counted
  const before = list.length;
  run(w, input, 1, ['fire']);
  run(w, input, seconds(0.5), []); // the bolt flies, hits and arcs
  const hurt = list.filter((e) => e.hp < e.maxHp);
  assert.ok(hurt.length >= 2, `the bolt hit and chained (${hurt.length} hurt)`);
  assert.ok(hurt.length <= 1 + CHAIN_HOPS, `no more than the hit plus ${CHAIN_HOPS} arcs (${hurt.length} hurt)`);
  assert.equal(grunts(w).length, before, 'lightning creates no enemies');
});

test('as chain kills open slots, the crowd refills but never rises above the cap', () => {
  const { w, input } = crowd({ cap: 3, count: 9 });
  let peak = 0;
  let kills = 0;
  for (let f = 0; f < seconds(8); f++) {
    const events = run(w, input, 1, f % 12 === 0 ? ['fire'] : []);
    kills += events.filter((e) => e.type === 'kill').length;
    peak = Math.max(peak, w.crowd());
  }
  assert.ok(kills >= 3, `the coil actually cleared enemies (${kills})`);
  assert.ok(peak <= 3, `the crowd peaked at ${peak} with a cap of 3`);
  assert.ok(peak >= 1);
});

test('with the cap at 1 there is nobody to chain to: only the one enemy is hurt', () => {
  const { w, input } = crowd({ cap: 1, count: 5 });
  run(w, input, 10);
  const [only] = grunts(w);
  only.hp = only.maxHp = 50;
  run(w, input, 1, ['fire']);
  run(w, input, seconds(0.5), []);
  assert.equal(grunts(w).length, 1);
  assert.ok(only.hp < only.maxHp);
  assert.equal(w.fx.filter((f) => f.k === 'zap').length, 0, 'no arcs');
});
