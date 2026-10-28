// Unit tests for src/engine/rng.js: the seeded mulberry32 stream (next/int/range/chance/pick/sign/weighted) and the
// per-tile hash2 noise. Gameplay determinism rests on these, so each helper is pinned on its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, hash2 } from '../../src/engine/rng.js';

const take = (r, n) => Array.from({ length: n }, () => r());

test('the same seed produces the same sequence', () => {
  assert.deepEqual(take(rng(42), 50), take(rng(42), 50));
});

test('different seeds diverge', () => {
  assert.notDeepEqual(take(rng(1), 10), take(rng(2), 10));
});

test('the default seed is 1', () => {
  assert.deepEqual(take(rng(), 10), take(rng(1), 10));
});

test('next() stays in [0, 1)', () => {
  const r = rng(7);
  for (let i = 0; i < 5000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v}`);
  }
});

test('int(lo, hi) is inclusive on both ends and never leaves them', () => {
  const r = rng(3);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(2, 5);
    assert.ok(Number.isInteger(v) && v >= 2 && v <= 5, `value ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test('int(n, n) always returns n', () => {
  const r = rng(9);
  for (let i = 0; i < 50; i++) assert.equal(r.int(4, 4), 4);
});

test('range(lo, hi) stays in [lo, hi)', () => {
  const r = rng(5);
  for (let i = 0; i < 2000; i++) {
    const v = r.range(-3, 7);
    assert.ok(v >= -3 && v < 7, `value ${v}`);
  }
});

test('chance(0) never fires and chance(1) always does', () => {
  const r = rng(11);
  for (let i = 0; i < 500; i++) {
    assert.equal(r.chance(0), false);
    assert.equal(r.chance(1), true);
  }
});

test('chance(p) fires about p of the time', () => {
  const r = rng(12);
  let hits = 0;
  for (let i = 0; i < 10000; i++) if (r.chance(0.3)) hits++;
  assert.ok(Math.abs(hits / 10000 - 0.3) < 0.03, `rate ${hits / 10000}`);
});

test('pick reaches every element of the list', () => {
  const r = rng(13);
  const items = ['a', 'b', 'c', 'd', 'e'];
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(r.pick(items));
  assert.deepEqual([...seen].sort(), items);
});

test('pick of an empty list throws a clear error instead of returning undefined', () => {
  assert.throws(() => rng(1).pick([]), /empty/);
});

test('sign only returns -1 or +1 and produces both', () => {
  const r = rng(14);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(r.sign());
  assert.deepEqual([...seen].sort(), [-1, 1]);
});

test('weighted follows its proportions', () => {
  const r = rng(15);
  const counts = { a: 0, b: 0, c: 0 };
  const N = 20000;
  for (let i = 0; i < N; i++) counts[r.weighted({ a: 1, b: 2, c: 7 })]++;
  assert.ok(Math.abs(counts.a / N - 0.1) < 0.02, `a ${counts.a / N}`);
  assert.ok(Math.abs(counts.b / N - 0.2) < 0.02, `b ${counts.b / N}`);
  assert.ok(Math.abs(counts.c / N - 0.7) < 0.02, `c ${counts.c / N}`);
});

test('weighted never picks a key whose weight is zero', () => {
  const r = rng(16);
  for (let i = 0; i < 2000; i++) assert.equal(r.weighted({ never: 0, always: 3 }), 'always');
});

test('weighted with a single key returns it', () => {
  assert.equal(rng(1).weighted({ only: 5 }), 'only');
});

test('weighted of an empty table or all-zero weights throws a clear error', () => {
  assert.throws(() => rng(1).weighted({}), /positive weight/);
  assert.throws(() => rng(1).weighted({ a: 0, b: 0 }), /positive weight/);
});

test('hash2 is repeatable for the same inputs', () => {
  assert.equal(hash2(12, 34, 5), hash2(12, 34, 5));
});

test('hash2 depends on x, y and seed', () => {
  const base = hash2(12, 34, 5);
  assert.notEqual(hash2(13, 34, 5), base);
  assert.notEqual(hash2(12, 35, 5), base);
  assert.notEqual(hash2(12, 34, 6), base);
});

test('hash2 stays in [0, 1) across a grid including negative coordinates', () => {
  for (let x = -40; x <= 40; x++) {
    for (let y = -40; y <= 40; y++) {
      const v = hash2(x, y, 3);
      assert.ok(v >= 0 && v < 1, `hash2(${x}, ${y}) = ${v}`);
    }
  }
});

test('hash2 is spread out: its mean over a grid is near one half', () => {
  let sum = 0;
  let n = 0;
  for (let x = -30; x < 30; x++) for (let y = -30; y < 30; y++, n++) sum += hash2(x, y);
  assert.ok(Math.abs(sum / n - 0.5) < 0.05, `mean ${sum / n}`);
});
