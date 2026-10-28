// Unit tests for src/game/tiles.js: the tile id enum, the SOLID / ONEWAY / HURT / LIQUID property tables and
// conveyorDir, and that those tables stay mutually consistent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { T, SOLID, ONEWAY, HURT, LIQUID, SLOPE, STEEP, conveyorDir, floorHeight, uphillDir } from '../../src/game/tiles.js';

const ids = Object.values(T);

test('tile ids are unique small integers that fit the property tables', () => {
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(Number.isInteger(id) && id >= 0 && id < SOLID.length, `id ${id}`);
});

test('conveyorDir is +1 for CONV_R, -1 for CONV_L', () => {
  assert.equal(conveyorDir(T.CONV_R), 1);
  assert.equal(conveyorDir(T.CONV_L), -1);
});

test('conveyorDir is 0 for every other tile id, and for ids outside the enum', () => {
  for (const id of ids) if (id !== T.CONV_R && id !== T.CONV_L) assert.equal(conveyorDir(id), 0, `tile ${id}`);
  for (const odd of [-1, 15, 99, undefined, null]) assert.equal(conveyorDir(odd), 0);
});

test('both conveyors are solid, so a body can stand on them', () => {
  assert.equal(SOLID[T.CONV_R], 1);
  assert.equal(SOLID[T.CONV_L], 1);
});

test('air is not solid, hurtful, liquid or one-way', () => {
  assert.equal(SOLID[T.AIR] + ONEWAY[T.AIR] + HURT[T.AIR] + LIQUID[T.AIR], 0);
});

test('the solid tiles are ground, ice, both conveyors, wall and door', () => {
  const solid = ids.filter((id) => SOLID[id]).sort((a, b) => a - b);
  assert.deepEqual(solid, [T.SOLID, T.ICE, T.CONV_R, T.CONV_L, T.WALL, T.DOOR].sort((a, b) => a - b));
});

test('the hurt tiles are exactly spikes and lava', () => {
  assert.deepEqual(ids.filter((id) => HURT[id]).sort((a, b) => a - b), [T.SPIKE, T.LAVA].sort((a, b) => a - b));
});

test('hurt tiles are not solid: the player enters them and dies, rather than standing on them', () => {
  for (const id of ids) if (HURT[id]) assert.equal(SOLID[id], 0, `tile ${id}`);
});

test('one-way platforms are not in the solid table (they are handled separately in moveBody)', () => {
  for (const id of ids) if (ONEWAY[id]) assert.equal(SOLID[id], 0, `tile ${id}`);
  assert.equal(ONEWAY[T.PLATFORM], 1);
});

test('water is liquid and neither solid nor hurtful', () => {
  assert.equal(LIQUID[T.WATER], 1);
  assert.equal(SOLID[T.WATER] + HURT[T.WATER], 0);
});

test('no tile is both one-way and hurtful or liquid', () => {
  for (const id of ids) {
    if (ONEWAY[id]) assert.equal(HURT[id] + LIQUID[id], 0, `tile ${id}`);
  }
});

const slopeIds = ids.filter((id) => SLOPE[id]);
const steepIds = ids.filter((id) => STEEP[id]);

test('there are ten slope tiles, four of them steep, and none is in the solid, one-way, hurt or liquid tables', () => {
  assert.equal(slopeIds.length, 10);
  assert.equal(steepIds.length, 4);
  for (const id of steepIds) assert.equal(SLOPE[id], 1, 'every steep tile is also a slope');
  for (const id of slopeIds) assert.equal(SOLID[id] + ONEWAY[id] + HURT[id] + LIQUID[id], 0, `tile ${id}`);
});

test('floorHeight is -1 for tiles that are not slopes', () => {
  for (const id of ids) if (!SLOPE[id]) assert.equal(floorHeight(id, 8), -1, `tile ${id}`);
});

test('floorHeight stays within the cell (0..16) and never falls in the uphill direction', () => {
  for (const id of slopeIds) {
    const dir = uphillDir(id);
    let prev = floorHeight(id, dir > 0 ? 0 : 16);
    for (let step = 1; step <= 16; step++) {
      const x = dir > 0 ? step : 16 - step;
      const h = floorHeight(id, x);
      assert.ok(h >= 0 && h <= 16, `tile ${id} x ${x} h ${h}`);
      assert.ok(h >= prev, `tile ${id} rises toward its uphill side`);
      prev = h;
    }
  }
});

test('the 45-degree ramps rise one px per px, and the 22-degree cells half a px per px', () => {
  assert.equal(floorHeight(T.RAMP45_R, 0), 0);
  assert.equal(floorHeight(T.RAMP45_R, 10), 10);
  assert.equal(floorHeight(T.RAMP45_L, 4), 12);
  assert.equal(floorHeight(T.RAMP22_R_LO, 16), 8);
  assert.equal(floorHeight(T.RAMP22_R_HI, 0), 8);
  assert.equal(floorHeight(T.RAMP22_R_HI, 16), 16);
  assert.equal(floorHeight(T.RAMP22_L_LO, 0), 8);
});

test('a steep slope climbs two tiles over one column: the low cell fills by x = 8 and the high cell starts there', () => {
  assert.equal(floorHeight(T.STEEP_R_LO, 4), 8);
  assert.equal(floorHeight(T.STEEP_R_LO, 8), 16);
  assert.equal(floorHeight(T.STEEP_R_LO, 16), 16);
  assert.equal(floorHeight(T.STEEP_R_HI, 4), 0, 'empty before the surface starts');
  assert.equal(floorHeight(T.STEEP_R_HI, 12), 8);
  assert.equal(floorHeight(T.STEEP_L_LO, 12), 8);
  assert.equal(floorHeight(T.STEEP_L_HI, 4), 8);
});

test('neighbouring slope cells meet edge to edge, so the walkable line is continuous', () => {
  // [left cell, right cell, rise in px across the pair of cells' shared edge: the right cell's start must equal the left cell's end]
  const pairs = [
    [T.RAMP45_R, T.RAMP45_R],
    [T.RAMP22_R_LO, T.RAMP22_R_HI],
    [T.RAMP22_L_HI, T.RAMP22_L_LO],
    [T.RAMP45_L, T.RAMP45_L],
  ];
  for (const [left, right] of pairs) {
    const end = floorHeight(left, 16);
    const start = floorHeight(right, 0);
    if (left === right) assert.equal(end === 16 || end === 0, true, 'a 45 ramp ends at a cell edge');
    else assert.equal(end, start, `${left} -> ${right}`);
  }
  // steep: the high cell sits one row above the low cell, so its start (0) is the low cell's top (16)
  assert.equal(floorHeight(T.STEEP_R_LO, 16), 16);
  assert.equal(floorHeight(T.STEEP_R_HI, 8), 0);
  assert.equal(floorHeight(T.STEEP_R_HI, 16), 16);
});

test('uphillDir is +1 for the _R tiles, -1 for the _L tiles and 0 for everything else', () => {
  for (const id of [T.RAMP45_R, T.RAMP22_R_LO, T.RAMP22_R_HI, T.STEEP_R_LO, T.STEEP_R_HI]) assert.equal(uphillDir(id), 1, `tile ${id}`);
  for (const id of [T.RAMP45_L, T.RAMP22_L_LO, T.RAMP22_L_HI, T.STEEP_L_LO, T.STEEP_L_HI]) assert.equal(uphillDir(id), -1, `tile ${id}`);
  assert.equal(uphillDir(T.SOLID), 0);
});
