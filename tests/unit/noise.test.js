// Unit tests for src/game/art/noise.js: the wrapping one-dimensional noise behind the parallax landforms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapNoise, ridged, sampleWrap, warped, smooth, gullies, terraced } from '../../src/game/art/noise.js';
import { VIEW_W } from '../../src/game/constants.js';

const range = (arr) => [Math.min(...arr), Math.max(...arr)];

test('wrapNoise: VIEW_W values between 0 and 1, the same for the same seed and different for another', () => {
  const a = wrapNoise(5, 4, 3);
  assert.equal(a.length, VIEW_W);
  const [lo, hi] = range(a);
  assert.ok(lo >= 0 && hi <= 1, `${lo}..${hi}`);
  assert.deepEqual(Array.from(wrapNoise(5, 4, 3)), Array.from(a));
  assert.notDeepEqual(Array.from(wrapNoise(6, 4, 3)), Array.from(a));
});

test('wrapNoise wraps: the step from the last column to the first is no bigger than a step inside', () => {
  for (const seed of [1, 7, 19, 33]) {
    const a = wrapNoise(seed, 5, 3);
    let widest = 0;
    for (let x = 0; x < VIEW_W - 1; x++) widest = Math.max(widest, Math.abs(a[x + 1] - a[x]));
    assert.ok(Math.abs(a[0] - a[VIEW_W - 1]) <= widest + 1e-6, `seed ${seed}`);
  }
});

test('ridged: stays in 0..1, wraps, and has sharper crests than plain noise (a larger share of steep columns)', () => {
  const r = ridged(3, 4, 3);
  const [lo, hi] = range(r);
  assert.ok(lo >= 0 && hi <= 1);
  let widest = 0;
  for (let x = 0; x < VIEW_W - 1; x++) widest = Math.max(widest, Math.abs(r[x + 1] - r[x]));
  assert.ok(Math.abs(r[0] - r[VIEW_W - 1]) <= widest + 1e-6);
  const steep = (a) => {
    let n = 0;
    for (let x = 1; x < VIEW_W - 1; x++) if (Math.abs(a[x + 1] - a[x - 1]) > 0.05) n++;
    return n;
  };
  assert.ok(steep(r) > steep(wrapNoise(3, 4, 3)) * 0.5, 'ridged noise has real slopes');
});

test('sampleWrap interpolates between columns and wraps both ways', () => {
  const a = Float32Array.from({ length: VIEW_W }, (_, i) => i / VIEW_W);
  assert.equal(sampleWrap(a, 10), a[10]);
  assert.ok(Math.abs(sampleWrap(a, 10.5) - (a[10] + a[11]) / 2) < 1e-6);
  assert.equal(sampleWrap(a, VIEW_W + 10), a[10]);
  assert.equal(sampleWrap(a, -VIEW_W + 10), a[10]);
  assert.ok(Math.abs(sampleWrap(a, -1) - a[VIEW_W - 1]) < 1e-6);
});

test('warped moves features sideways without changing the range, and amount 0 changes nothing', () => {
  const a = wrapNoise(2, 4, 2);
  assert.deepEqual(Array.from(warped(a, 2, 0)), Array.from(a));
  const w = warped(a, 2, 30);
  assert.notDeepEqual(Array.from(w), Array.from(a));
  const [lo, hi] = range(w);
  const [alo, ahi] = range(a);
  assert.ok(lo >= alo - 1e-6 && hi <= ahi + 1e-6);
});

test('smooth lowers the largest step between neighbouring columns and keeps the average', () => {
  const a = wrapNoise(9, 12, 3);
  const s = smooth(a, 2);
  const widest = (arr) => Math.max(...Array.from(arr, (v, i) => Math.abs(arr[(i + 1) % VIEW_W] - v)));
  assert.ok(widest(s) < widest(a));
  const mean = (arr) => Array.from(arr).reduce((p, q) => p + q, 0) / VIEW_W;
  assert.ok(Math.abs(mean(s) - mean(a)) < 1e-4);
});

test('gullies only ever lowers the heights, cuts some of them, and leaves the input alone', () => {
  const a = wrapNoise(4, 4, 2);
  const copy = Array.from(a);
  const g = gullies(a, 4, 10, 0.2, 5);
  assert.deepEqual(Array.from(a), copy);
  let cut = 0;
  for (let x = 0; x < VIEW_W; x++) {
    assert.ok(g[x] <= a[x] + 1e-9);
    if (g[x] < a[x] - 0.01) cut++;
  }
  assert.ok(cut > 10, `${cut} columns cut`);
});

test('terraced snaps heights onto flat steps', () => {
  const a = Float32Array.from({ length: VIEW_W }, (_, i) => i / VIEW_W);
  const t = terraced(a, 4, 0.2);
  let flat = 0;
  for (const v of t) if (Math.abs(v * 4 - Math.round(v * 4)) < 1e-6) flat++;
  assert.ok(flat > VIEW_W * 0.7, `${flat} of ${VIEW_W} columns sit on a tread, the rest on the short slopes between them`);
  for (let x = 1; x < VIEW_W; x++) assert.ok(t[x] >= t[x - 1] - 1e-9, 'never drops on a rising input');
});
