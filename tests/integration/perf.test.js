// Week 15 (performance): the art warm-up, steady-state allocation and per-frame cost budgets.
//
// Wall-clock time in Node says little about a phone, so the budgets are counts that carry over: canvas calls per frame
// and canvases created while playing. The two wall-clock checks (the simulation step, and a bot-driven boss fight) are
// not in milliseconds: they are in units of a calibration loop timed in the same process, so a slow or busy machine
// scales the limit with it. The limits stay roughly fifty times what the game needs, so only a real accident trips them.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { probeFrame, countCanvases, countingCtx } from '../../tools/perfprobe.js';
import { fightBoss } from '../../tools/bossbot.js';
import { buildLevel } from '../../src/game/levels.js';
import { World } from '../../src/game/world.js';
import { Input } from '../../src/engine/input.js';
import { createWarmer, warmTasks } from '../../src/game/art/warm.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { THEMES } from '../../src/game/art/themes.js';
import { renderWorld } from '../../src/game/render.js';
import { explosion, debris, smoke, spark, updateFx } from '../../src/game/fx.js';
import { flatLevel } from '../../src/game/ascii.js';

const BUDGET = {
  peakCalls: 2600, // canvas calls in the busiest frame of a level or boss fight (the cave's dark veil is the biggest part)
  avgCalls: 1400,
  simAvgMs: 1.0, // average simulation step; measured around 0.02 (see the CALIBRATION note below)
  tileVariants: 16, // tiny tile sprites painted lazily when lava or doors change a tile's neighbours
};

// ---- calibration -------------------------------------------------------------------------------------------------
// A fixed amount of plain arithmetic, timed here and now. On the machine these budgets were set on it costs about 19 ns
// per iteration, so `simAvgMs: 1.0` is the same as SIM_BUDGET_ITERS iterations. Asking "how many calibration iterations
// does one step cost" gives the same answer on a laptop, a CI runner or a throttled VM.
const CAL_ITERS = 400_000;
const REFERENCE_NS_PER_ITER = 19; // where the millisecond budgets above were measured
const SIM_BUDGET_ITERS = (BUDGET.simAvgMs * 1e6) / REFERENCE_NS_PER_ITER;

function calibrationNsPerIter() {
  const a = new Float64Array(4096);
  let best = Infinity;
  let sink = 0;
  for (let rep = 0; rep < 5; rep++) {
    const t0 = performance.now();
    for (let i = 0; i < CAL_ITERS; i++) {
      const j = i & 4095;
      a[j] = a[j] * 0.999 + Math.sqrt(i + 1);
      sink += a[j] % 7;
    }
    best = Math.min(best, performance.now() - t0);
  }
  assert.ok(Number.isFinite(sink));
  return (best * 1e6) / CAL_ITERS;
}

/** Cost of `ms` in calibration iterations, using the slower of two calibrations taken around the measurement. */
function inIterations(ms, calBefore, calAfter) {
  return (ms * 1e6) / Math.max(calBefore, calAfter);
}

test('calibration: the reference loop is stable enough to scale a budget by (two runs agree within a factor of three)', () => {
  const a = calibrationNsPerIter();
  const b = calibrationNsPerIter();
  assert.ok(a > 0 && b > 0);
  assert.ok(Math.max(a, b) / Math.min(a, b) < 3, `${a.toFixed(1)} vs ${b.toFixed(1)} ns per iteration`);
});

test('warm-up: one task per enemy def and backdrop layer, plus the player, effects, HUD and pickups', () => {
  const tasks = warmTasks();
  const names = tasks.map((t) => t.name);
  for (const id of Object.keys(ENEMY_DEFS)) assert.ok(names.includes(`enemy ${id}`), `enemy ${id}`);
  for (const [id, theme] of Object.entries(THEMES)) {
    (theme.layers || []).forEach((_, i) => assert.ok(names.includes(`scenery ${id}:${i}`), `scenery ${id}:${i}`));
  }
  for (const n of ['player', 'effects', 'hud', 'pickups']) assert.ok(names.includes(n), n);
  assert.ok(tasks.length > Object.keys(ENEMY_DEFS).length);
});

test('warm-up: runs in small slices that respect the time budget and finishes', () => {
  let clock = 0;
  const tasks = Array.from({ length: 10 }, (_, i) => ({ name: `t${i}`, run: () => { clock += 2; } })); // each task "costs" 2 ms
  const ran = [];
  tasks.forEach((t, i) => { const r = t.run; t.run = () => { ran.push(i); r(); }; });
  const warmer = createWarmer(tasks, () => clock);
  assert.equal(warmer.total, 10);
  assert.equal(warmer.done, false);
  let left = warmer.step(5); // 2 ms each: the third task crosses 5 ms, so three run
  assert.deepEqual(ran, [0, 1, 2]);
  assert.equal(left, 7);
  left = warmer.step(0); // a zero budget still makes progress (one task)
  assert.deepEqual(ran, [0, 1, 2, 3]);
  let steps = 0;
  while (!warmer.done && steps++ < 100) warmer.step(5);
  assert.equal(warmer.done, true);
  assert.equal(warmer.remaining, 0);
  assert.deepEqual(ran, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'in order, each exactly once');
  assert.equal(warmer.step(5), 0, 'stepping a finished warmer is harmless');
  assert.equal(ran.length, 10);
});

test('warm-up: after it has run, painting the same art again creates no canvases', () => {
  const first = createWarmer();
  while (!first.done) first.step(1000);
  const again = countCanvases(() => {
    const second = createWarmer();
    while (!second.done) second.step(1000);
  });
  assert.equal(again, 0, 'everything came from the caches');
});

test('steady state: after the warm-up a level makes (almost) no canvases while it is played', () => {
  const warmer = createWarmer();
  while (!warmer.done) warmer.step(1000);
  const canvas = new SoftCanvas(480, 270);
  for (const index of [0, 1, 3, 5, 11, 15, 19]) {
    const world = new World(buildLevel(index), { god: true });
    const input = new Input();
    probeFrame(world, null, canvas); // the first frame bakes this level's terrain
    let made = 0;
    let peak = 0;
    let sum = 0;
    let n = 0;
    for (let f = 0; f < 60 * 8; f++) {
      input.script = { right: true, fire: true, jump: f % 70 < 10 };
      input.poll();
      world.update(input, 1 / 60);
      world.events.length = 0;
      if (f % 8 === 0) {
        const r = probeFrame(world, null, canvas);
        made += r.canvasesCreated;
        peak = Math.max(peak, r.total);
        sum += r.total;
        n++;
      }
    }
    assert.ok(made <= BUDGET.tileVariants, `level ${index + 1}: ${made} canvases created while playing`);
    assert.ok(peak <= BUDGET.peakCalls, `level ${index + 1}: peak ${peak} canvas calls in one frame`);
    assert.ok(sum / n <= BUDGET.avgCalls, `level ${index + 1}: average ${(sum / n).toFixed(0)} calls per frame`);
  }
});

test('boss fights: draw-call budget and no per-frame allocation, with the simulation far inside a frame', () => {
  const warmer = createWarmer();
  while (!warmer.done) warmer.step(1000);
  const canvas = new SoftCanvas(480, 270);
  for (const index of [0, 8, 12, 19]) {
    const level = buildLevel(index);
    const calBefore = calibrationNsPerIter();
    let peak = 0;
    let made = 0;
    let probed = false;
    const t0 = performance.now();
    const r = fightBoss(level, {
      seconds: 40,
      onFrame: (w, f) => {
        if (f % 20 !== 0) return;
        const p = probeFrame(w, null, canvas);
        if (!probed) { probed = true; return; } // the first probe bakes the level's terrain
        peak = Math.max(peak, p.total);
        made += p.canvasesCreated;
      },
    });
    const ms = performance.now() - t0;
    const frames = r.seconds * 60;
    assert.ok(peak <= BUDGET.peakCalls, `boss ${index + 1}: peak ${peak} calls`);
    assert.ok(made <= BUDGET.tileVariants, `boss ${index + 1}: ${made} canvases created`);
    // the whole loop includes ~frames/20 renders; the sim alone is far less. A loose bound that still catches an accident
    const iters = inIterations(ms / frames, calBefore, calibrationNsPerIter());
    assert.ok(iters < 10 * SIM_BUDGET_ITERS, `boss ${index + 1}: ${(ms / frames).toFixed(2)} ms per frame (${Math.round(iters)} calibration iterations) including the bot and probes`);
  }
});

test('simulation: an average step takes a small fraction of the 16.7 ms frame on every kind of level', () => {
  for (const index of [0, 3, 7, 11, 15, 19]) {
    const world = new World(buildLevel(index), { god: true });
    const input = new Input();
    for (let f = 0; f < 120; f++) { // warm the JIT
      input.script = { right: true, fire: true };
      input.poll();
      world.update(input, 1 / 60);
      world.events.length = 0;
    }
    const calBefore = calibrationNsPerIter();
    const t0 = performance.now();
    const frames = 60 * 10;
    for (let f = 0; f < frames; f++) {
      input.script = { right: true, fire: true, jump: f % 70 < 10 };
      input.poll();
      world.update(input, 1 / 60);
      world.events.length = 0;
    }
    const avg = (performance.now() - t0) / frames;
    const iters = inIterations(avg, calBefore, calibrationNsPerIter());
    assert.ok(iters < SIM_BUDGET_ITERS, `level ${index + 1}: ${avg.toFixed(3)} ms per step (${Math.round(iters)} calibration iterations, limit ${Math.round(SIM_BUDGET_ITERS)})`);
  }
});

test('effects storm: the particle budget keeps the fx draw cost bounded however many explosions go off', () => {
  const lvl = flatLevel(120, 14);
  lvl.spawns = [];
  const calls = (quality) => {
    const w = new World(lvl, { fx: quality, god: true });
    const c = new SoftCanvas(480, 270);
    for (let i = 0; i < 400; i++) {
      explosion(w, 40 + (i % 40) * 8, 150, 2);
      debris(w, 100, 100, ['#fff', '#fa0'], 40);
      smoke(w, 200, 100, 30);
      spark(w, 300, 100, '#fff', 30);
      if (i % 4 === 0) updateFx(w, 1 / 60);
    }
    const { ctx, counts } = countingCtx(c.getContext('2d'));
    renderWorld(ctx, w);
    return { total: counts.total, live: w.fx.length, px: w.fxCount };
  };
  const high = calls('high');
  const low = calls('low');
  assert.ok(high.px <= 700 && low.px <= 160, `particles ${high.px} / ${low.px}`);
  assert.ok(high.total <= BUDGET.peakCalls + 700, `high quality storm: ${high.total} calls`);
  assert.ok(low.total < high.total, 'low quality draws less');
  assert.ok(low.total <= 900, `low quality storm: ${low.total} calls`);
});
