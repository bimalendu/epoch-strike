// Unit tests for src/game/tiles.js: the tile id enum, the SOLID / ONEWAY / HURT / LIQUID property tables and
// conveyorDir, and that those tables stay mutually consistent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { T, SOLID, ONEWAY, HURT, LIQUID, conveyorDir } from '../../src/game/tiles.js';

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
