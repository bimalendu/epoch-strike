// Unit tests for the pure collision queries in src/game/physics.js: overlap (AABB), rectSolid and rectHas
// (tile-grid probes). Covers touching edges, the EPS seam rule at tile boundaries, and coordinates outside the map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { overlap, rectSolid, rectHas } from '../../src/game/physics.js';
import { T, SOLID, HURT } from '../../src/game/tiles.js';
import { TILE } from '../../src/game/constants.js';

const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

/** A fake world whose only tile is `id` at (tx, ty); everything else is `elsewhere`. */
const gridWith = (tx, ty, id, elsewhere = T.AIR) => ({ tile: (x, y) => (x === tx && y === ty ? id : elsewhere) });

test('overlap: boxes that share area overlap', () => {
  assert.equal(overlap(box(0, 0, 10, 10), box(5, 5, 15, 15)), true);
});

test('overlap: one box fully inside another overlaps', () => {
  assert.equal(overlap(box(0, 0, 20, 20), box(5, 5, 8, 8)), true);
  assert.equal(overlap(box(5, 5, 8, 8), box(0, 0, 20, 20)), true);
});

test('overlap: boxes that only touch along an edge do not overlap', () => {
  assert.equal(overlap(box(0, 0, 10, 10), box(10, 0, 20, 10)), false);
  assert.equal(overlap(box(0, 0, 10, 10), box(0, 10, 10, 20)), false);
  assert.equal(overlap(box(10, 0, 20, 10), box(0, 0, 10, 10)), false);
});

test('overlap: boxes that only touch at a corner do not overlap', () => {
  assert.equal(overlap(box(0, 0, 10, 10), box(10, 10, 20, 20)), false);
});

test('overlap: a gap on either axis means no overlap', () => {
  assert.equal(overlap(box(0, 0, 10, 10), box(11, 0, 20, 10)), false);
  assert.equal(overlap(box(0, 0, 10, 10), box(0, 11, 10, 20)), false);
});

test('overlap: is symmetric and works with negative coordinates', () => {
  const a = box(-10, -10, 0, 0);
  const b = box(-5, -5, 5, 5);
  assert.equal(overlap(a, b), true);
  assert.equal(overlap(b, a), true);
  assert.equal(overlap(box(-10, -10, -1, -1), box(0, 0, 5, 5)), false);
});

test('rectSolid: a rectangle inside a solid tile is solid', () => {
  const w = gridWith(2, 3, T.SOLID);
  assert.equal(rectSolid(w, 2 * TILE + 2, 3 * TILE + 2, 2 * TILE + 6, 3 * TILE + 6), true);
});

test('rectSolid: a rectangle in open air is not solid', () => {
  assert.equal(rectSolid(gridWith(2, 3, T.SOLID), 0, 0, 10, 10), false);
});

test('rectSolid: touching a solid tile edge to edge does not count (the EPS seam)', () => {
  const w = gridWith(2, 0, T.SOLID);
  // right edge exactly on the tile's left edge
  assert.equal(rectSolid(w, 2 * TILE - 8, 0, 2 * TILE, 8), false);
  // left edge exactly on the tile's right edge
  assert.equal(rectSolid(w, 3 * TILE, 0, 3 * TILE + 8, 8), false);
  // bottom edge exactly on the tile's top edge, with the tile in row 1
  assert.equal(rectSolid(gridWith(0, 1, T.SOLID), 0, 0, 8, TILE), false);
});

test('rectSolid: sinking even a hair into the tile does count', () => {
  const w = gridWith(2, 0, T.SOLID);
  assert.equal(rectSolid(w, 2 * TILE - 8, 0, 2 * TILE + 0.01, 8), true);
  assert.equal(rectSolid(gridWith(0, 1, T.SOLID), 0, 0, 8, TILE + 0.01), true);
});

test('rectSolid: a rectangle spanning a seam sees the solid tile on either side', () => {
  const w = gridWith(1, 0, T.SOLID);
  assert.equal(rectSolid(w, TILE - 4, 0, TILE + 4, 8), true);
});

test('rectSolid: one-way platforms, spikes, water and air are not solid; wall, ice, conveyors and doors are', () => {
  for (const id of [T.AIR, T.PLATFORM, T.SPIKE, T.WATER, T.LAVA, T.QUICK]) {
    assert.equal(rectSolid(gridWith(0, 0, id), 1, 1, 5, 5), false, `tile ${id}`);
  }
  for (const id of [T.SOLID, T.ICE, T.CONV_R, T.CONV_L, T.WALL, T.DOOR]) {
    assert.equal(rectSolid(gridWith(0, 0, id), 1, 1, 5, 5), true, `tile ${id}`);
  }
});

test('rectSolid: negative coordinates are queried at negative tile indices (the world decides what lives there)', () => {
  const seen = [];
  const w = { tile: (x, y) => (seen.push([x, y]), T.AIR) };
  rectSolid(w, -TILE - 4, -TILE - 4, -2, -2);
  assert.ok(seen.some(([x, y]) => x === -2 && y === -2));
  assert.ok(seen.some(([x, y]) => x === -1 && y === -1));
});

test('rectSolid: a world that reports solid outside the map makes out-of-map rectangles solid', () => {
  const w = { tile: (x, y) => (x < 0 || y < 0 ? T.SOLID : T.AIR) };
  assert.equal(rectSolid(w, -20, 0, -10, 10), true);
  assert.equal(rectSolid(w, 5, 5, 10, 10), false);
});

test('rectHas: finds a tile flagged in the given table', () => {
  assert.equal(rectHas(gridWith(1, 1, T.SPIKE), HURT, TILE + 2, TILE + 2, TILE + 8, TILE + 8), true);
  assert.equal(rectHas(gridWith(1, 1, T.SPIKE), SOLID, TILE + 2, TILE + 2, TILE + 8, TILE + 8), false);
});

test('rectHas: uses the same touching-is-not-overlap rule as rectSolid', () => {
  const w = gridWith(1, 0, T.LAVA);
  assert.equal(rectHas(w, HURT, 0, 0, TILE, 8), false);
  assert.equal(rectHas(w, HURT, 0, 0, TILE + 0.01, 8), true);
});

test('rectHas: a degenerate zero-area rectangle on a tile interior still reports that tile', () => {
  // pins current behaviour: the tile range is computed from the corners, so a point probe works
  assert.equal(rectHas(gridWith(0, 0, T.SPIKE), HURT, 4, 4, 4, 4), true);
});
