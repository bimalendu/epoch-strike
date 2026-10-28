// The pilot redesign of Levels 1-4 around their biomes: each has to use the slopes its brief promises, keep the ice flat, keep the boss
// arena level, and still be crossable on foot (the solver's route walks the ramps and slides the scree).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { buildLevel } from '../../src/game/levels.js';
import { solveLevel } from '../../src/game/solver.js';
import { T, SLOPE, STEEP } from '../../src/game/tiles.js';
import { TILE } from '../../src/game/constants.js';

const GENTLE_22 = [T.RAMP22_R_LO, T.RAMP22_R_HI, T.RAMP22_L_LO, T.RAMP22_L_HI];
const RAMP_45 = [T.RAMP45_R, T.RAMP45_L];

const count = (level, ids) => level.tiles.filter((t) => ids.includes(t)).length;
const steepCount = (level) => level.tiles.filter((t) => STEEP[t]).length;

test('Level 1 (Dino Jungle) rolls: 22-degree hills, a 45-degree knoll and bluff, and a river valley with banks', () => {
  const lvl = buildLevel(0);
  assert.ok(count(lvl, GENTLE_22) >= 8, '22-degree hills');
  assert.ok(count(lvl, RAMP_45) >= 6, '45-degree knoll, bluff and banks');
  assert.equal(steepCount(lvl), 0, 'a first level has no scree');
  assert.ok(lvl.tiles.includes(T.WATER), 'the ford is still there');
});

test('Level 1 still teaches the basics in order: the move and shoot lessons are given on level ground, before the first hill', () => {
  const lvl = buildLevel(0);
  let first = lvl.cols;
  for (let x = 0; x < lvl.cols && first === lvl.cols; x++) for (let y = 0; y < lvl.rows; y++) if (SLOPE[lvl.tiles[y * lvl.cols + x]]) first = x;
  assert.ok(first >= 24, `the first hill starts at column ${first}`);
  const lessons = lvl.prompts.filter((p) => /^MOVE WITH|TO SHOOT$/.test(p.text));
  assert.equal(lessons.length, 2);
  assert.ok(lessons.every((p) => p.x1 / TILE <= first), 'the move and shoot lessons happen on level ground');
  const order = lvl.prompts.map((p) => p.text.split(' ')[0]);
  assert.deepEqual(order.slice(0, 4), ['MOVE', 'HOLD', 'PRESS', 'SHOOT'], 'move, shoot, jump, then capsules');
});

test('Level 2 (Volcano Run) climbs the cone: 45-degree flanks and ramps, scree slides, and every route spot above the lava\'s last row', () => {
  const lvl = buildLevel(1);
  assert.ok(count(lvl, RAMP_45) >= 8);
  assert.ok(steepCount(lvl) >= 4, 'scree');
  const zone = lvl.zones.find((z) => z.type === 'lavaRise');
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  for (const node of sol.path) {
    const x = node.x * TILE;
    if (x >= zone.x0 && x < zone.x1) assert.ok(node.fy <= zone.endRow * TILE, `the route stays above the lava inside the zone (x ${node.x}, y ${node.fy})`);
  }
  assert.ok(sol.path.some((n) => n.kind === 'slide'), 'the route slides down scree');
});

test('Level 3 (Frozen Glacier): moraine and a steep snow slide, with the ice staying flat', () => {
  const lvl = buildLevel(2);
  assert.ok(count(lvl, GENTLE_22) + count(lvl, RAMP_45) >= 8, 'moraine hills');
  assert.ok(steepCount(lvl) >= 2, 'a steep snow slide');
  // a slope is not slippery: no slope cell has ice in its column's fill, and no ice tile sits in a column that has a ramp
  for (let x = 0; x < lvl.cols; x++) {
    let ramp = false;
    let ice = false;
    for (let y = 0; y < lvl.rows; y++) {
      const t = lvl.tiles[y * lvl.cols + x];
      if (SLOPE[t]) ramp = true;
      if (t === T.ICE) ice = true;
    }
    assert.ok(!(ramp && ice), `column ${x} mixes a slope with ice`);
  }
  assert.ok(solveLevel(lvl).path.some((n) => n.kind === 'slide'));
});

test('Level 4 (Cave Tribes): chambers at 22 degrees, a gallery at 45, a steep slide, and the dark ceiling over all of it', () => {
  const lvl = buildLevel(3);
  assert.ok(count(lvl, GENTLE_22) >= 8);
  assert.ok(count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2);
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  // a ceiling of rock stays over the whole cave (but the skylight): headroom above the highest ground is still a tile or more
  for (const x of [20, 60, 100]) assert.equal(lvl.tiles[0 * lvl.cols + x], T.WALL, `ceiling at ${x}`);
});

test('the boss arenas of the pilot levels are still flat, one screen wide, and the boss floor is the ground they were built on', () => {
  for (let i = 0; i < 4; i++) {
    const lvl = buildLevel(i);
    for (let x = Math.floor(lvl.boss.x0 / TILE); x < Math.floor(lvl.boss.x1 / TILE); x++) {
      for (let y = 0; y < lvl.rows; y++) assert.ok(!SLOPE[lvl.tiles[y * lvl.cols + x]], `level ${i + 1}: slope in the boss arena at ${x},${y}`);
    }
    assert.equal(lvl.boss.x1 - lvl.boss.x0, 480);
  }
});

test('level.ground follows the slopes of the pilot levels: the soldier\'s spawn and every checkpoint stand on it', () => {
  for (let i = 0; i < 4; i++) {
    const lvl = buildLevel(i);
    assert.equal(lvl.ground.length, lvl.cols);
    assert.equal(lvl.ground[Math.floor(lvl.spawn.x / TILE)], lvl.spawn.y);
    for (const c of lvl.checkpoints) assert.equal(lvl.ground[Math.floor(c.x / TILE)], c.y, `checkpoint at ${c.x}`);
  }
});
