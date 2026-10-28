// The Industrial batch (Levels 13-16) redesigned around its biomes: canyon country before the train, slag heaps before the factory,
// shell-torn ground in no man's land and dunes on the landing beach. The places that need level ground (the train and its forced
// scroll, the belts, vents and presses, the gas and shell barrage fields, the tank road and every boss arena) must stay level, and
// every level must still be crossable on foot.
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
const countOf = (level, type) => level.spawns.filter((s) => s.type === type).length;

/** True when any column in [x0, x1) pixels holds a slope tile. */
function hasSlopeBetween(level, x0, x1) {
  for (let x = Math.floor(x0 / TILE); x < Math.ceil(x1 / TILE); x++) {
    for (let y = 0; y < level.rows; y++) if (SLOPE[level.tiles[y * level.cols + x]]) return true;
  }
  return false;
}

/** True when column `x` (in tiles) has a tile of one of `ids` anywhere in it. */
function columnHas(level, x, ids) {
  for (let y = 0; y < level.rows; y++) if (ids.includes(level.tiles[y * level.cols + x])) return true;
  return false;
}

test('Level 13 (Desert Train): dunes, a mesa climbed at 45 degrees with a scree slide, and a level train under forced scroll', () => {
  const lvl = buildLevel(12);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2, 'the scree slide off the mesa');
  const train = lvl.zones.find((z) => z.type === 'autoscroll');
  assert.ok(train && !hasSlopeBetween(lvl, train.x0, train.x1), 'the train rolls on level car roofs');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'));
});

test('Level 14 (Steam Factory): slag heaps outside, and the belts, vents, presses and foundry inside stay level', () => {
  const lvl = buildLevel(13);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 3);
  assert.ok(steepCount(lvl) >= 2, 'a slag slide');
  for (let x = 0; x < lvl.cols; x++) {
    if (columnHas(lvl, x, [T.CONV_L, T.CONV_R])) assert.ok(!hasSlopeBetween(lvl, x * TILE, (x + 1) * TILE), `a belt at column ${x} lies on a slope`);
  }
  for (const v of lvl.zones.filter((z) => z.type === 'vent')) assert.ok(!hasSlopeBetween(lvl, v.x - TILE, v.x + TILE), `a slope beside the vent at ${v.x}`);
  for (const p of lvl.spawns.filter((s) => s.type === 'press')) assert.ok(!hasSlopeBetween(lvl, p.x - TILE, p.x + TILE), `a slope under the press at ${p.x}`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
});

test('Level 15 (Trench Line): shell-torn ground with crater rims and collapsed-parapet scree, and both gas barrage fields level', () => {
  const lvl = buildLevel(14);
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2);
  const barrages = lvl.zones.filter((z) => z.type === 'barrage');
  assert.equal(barrages.length, 2);
  for (const z of barrages) assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `gas barrage at ${z.x0} lands on level ground`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
});

test('Level 16 (Coastal Assault): dunes, a shingle bank, a 45-degree seawall climb and a scree bank; barrages, tank road and arena level', () => {
  const lvl = buildLevel(15);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 8);
  assert.ok(steepCount(lvl) >= 2);
  const level = lvl.zones.filter((z) => z.type === 'barrage' || z.type === 'tank');
  assert.equal(level.length, 5, 'four barrage fields and the tank road');
  for (const z of level) assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `${z.type} zone at ${z.x0} is level`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
  assert.equal(lvl.spawns.filter((s) => s.item === '1up').length, 1, 'the hidden 1UP above the seawall');
});

test('the Industrial levels keep the lives economy of the originals: the same medals, capsules, cast and hidden 1UP', () => {
  const medals = (lvl) => lvl.spawns.filter((s) => s.type === 'pickup' && s.item === 'medal').length;
  assert.deepEqual([12, 13, 14, 15].map((i) => medals(buildLevel(i))), [15, 15, 15, 17]);
  assert.deepEqual([12, 13, 14, 15].map((i) => countOf(buildLevel(i), 'capsule')), [6, 6, 6, 7]);
  assert.equal(countOf(buildLevel(15), 'stormtrooper'), 9);
  assert.equal(countOf(buildLevel(13), 'press'), 5);
});
