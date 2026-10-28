// Unit tests for src/game/swing.js: the rope-swing plank. Covers the pendulum period, the amplitude bound, the
// carried-movement return value, and the degenerate inputs (dt = 0, period = 0) that must not produce NaN or Infinity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSwing, stepSwing } from '../../src/game/swing.js';
import { DT } from '../../src/game/constants.js';

const spec = { ax: 200, ay: 20, len: 100, theta: 0.6, period: 2, w: 40 };
const finite = (pl) => [pl.x, pl.y, pl.vx, pl.vy, pl.t].every(Number.isFinite);

test('makeSwing starts at the rope centre line when the phase is 0', () => {
  const pl = makeSwing(spec, 3);
  assert.equal(pl.i, 3);
  assert.equal(pl.kind, 'swing');
  assert.ok(Math.abs(pl.x - (spec.ax - spec.w / 2)) < 1e-9);
  assert.ok(Math.abs(pl.y - (spec.ay + spec.len)) < 1e-9);
  assert.equal(pl.prevX, pl.x);
  assert.equal(pl.prevY, pl.y);
});

test('a non-zero phase starts the swing off-centre', () => {
  const pl = makeSwing({ ...spec, phase: Math.PI / 2 }, 0);
  assert.ok(pl.x + spec.w / 2 > spec.ax + 10);
});

test('omega is two pi over the period', () => {
  assert.ok(Math.abs(makeSwing(spec).omega - Math.PI) < 1e-12);
});

test('the plank returns to its start after exactly one period', () => {
  const pl = makeSwing({ ...spec, phase: 0.7 });
  const { x, y } = pl;
  const n = Math.round(spec.period / DT);
  for (let i = 0; i < n; i++) stepSwing(pl, DT);
  assert.ok(Math.abs(pl.x - x) < 1e-6 && Math.abs(pl.y - y) < 1e-6, `${pl.x},${pl.y} vs ${x},${y}`);
});

test('at a quarter period the plank is at its peak angle', () => {
  const pl = makeSwing(spec);
  const n = Math.round(spec.period / 4 / DT);
  for (let i = 0; i < n; i++) stepSwing(pl, DT);
  const reach = spec.len * Math.sin(spec.theta);
  assert.ok(Math.abs(pl.x + spec.w / 2 - spec.ax - reach) < 0.5, `x ${pl.x}`);
});

test('over many steps the plank stays within the amplitude and never rises above the anchor circle', () => {
  const pl = makeSwing({ ...spec, phase: 1.3 });
  const reach = spec.len * Math.sin(spec.theta) + 1e-6;
  for (let i = 0; i < 2000; i++) {
    stepSwing(pl, DT);
    const centre = pl.x + spec.w / 2;
    assert.ok(Math.abs(centre - spec.ax) <= reach, `centre ${centre}`);
    assert.ok(pl.y <= spec.ay + spec.len + 1e-9, `y ${pl.y}`);
    assert.ok(pl.y >= spec.ay + spec.len * Math.cos(spec.theta) - 1e-6, `y ${pl.y}`);
    assert.ok(Math.hypot(centre - spec.ax, pl.y - spec.ay) - spec.len < 1e-6, 'the plank stays on the rope circle');
  }
});

test('stepSwing returns the movement it made and records the velocity', () => {
  const pl = makeSwing({ ...spec, phase: 0.3 });
  const x = pl.x;
  const y = pl.y;
  const { dx, dy } = stepSwing(pl, DT);
  assert.ok(Math.abs(dx - (pl.x - x)) < 1e-12 && Math.abs(dy - (pl.y - y)) < 1e-12);
  assert.ok(Math.abs(pl.vx - dx / DT) < 1e-9);
  assert.ok(Math.abs(pl.vy - dy / DT) < 1e-9);
});

test('stepSwing advances the swing clock', () => {
  const pl = makeSwing(spec);
  stepSwing(pl, 0.25);
  stepSwing(pl, 0.25);
  assert.ok(Math.abs(pl.t - 0.5) < 1e-12);
});

test('dt = 0 moves nothing and leaves every field finite', () => {
  const pl = makeSwing({ ...spec, phase: 0.4 });
  stepSwing(pl, DT);
  const before = { x: pl.x, y: pl.y, t: pl.t };
  const r = stepSwing(pl, 0);
  assert.deepEqual(r, { dx: 0, dy: 0 });
  assert.deepEqual({ x: pl.x, y: pl.y, t: pl.t }, before);
  assert.ok(finite(pl));
});

test('a negative dt is ignored rather than running the swing backwards', () => {
  const pl = makeSwing(spec);
  stepSwing(pl, DT);
  const t = pl.t;
  assert.deepEqual(stepSwing(pl, -1), { dx: 0, dy: 0 });
  assert.equal(pl.t, t);
});

test('period = 0 hangs the plank still instead of producing NaN or Infinity', () => {
  const pl = makeSwing({ ...spec, period: 0 });
  assert.ok(finite(pl));
  for (let i = 0; i < 10; i++) stepSwing(pl, DT);
  assert.ok(finite(pl));
  assert.ok(Math.abs(pl.x + spec.w / 2 - spec.ax) < 1e-9);
});
