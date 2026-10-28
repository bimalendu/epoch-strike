// The Modern batch (Levels 17-20) redesigned around its biomes: snow drifts and an ice ridge, a city built on hills, a megastructure with
// tiers, and a citadel on a broken crag. The places that need level ground (the searchlight roads, the rooftop chase, the gravity halls,
// the hoverbike run, the three echo arenas and every boss arena) must stay level, and every level must still be crossable on foot.
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

test('Level 17 (Arctic Missile Base): drifts, an ice ridge climbed at 45 degrees and a steep slide, with the searchlight roads level', () => {
  const lvl = buildLevel(16);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2, 'the ice slide down to the gate');
  const lights = lvl.zones.filter((z) => z.type === 'searchlight');
  assert.equal(lights.length, 3);
  for (const z of lights) assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `searchlight road at ${z.x0} is level`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'));
  assert.equal(lvl.spawns.filter((s) => s.item === '1up').length, 1, 'the hidden 1UP above the silos');
});

test('Level 18 (Neon City): a city on hills with overpass and fire-escape ramps and a rubble slide, and the rooftop chase level', () => {
  const lvl = buildLevel(17);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 8);
  assert.ok(steepCount(lvl) >= 2, 'a rubble pile to slide down');
  const chase = lvl.zones.find((z) => z.type === 'autoscroll');
  assert.ok(chase && !hasSlopeBetween(lvl, chase.x0, chase.x1), 'the chase crosses level rooftops');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
});

test('Level 19 (Cyber Megacity): ramps to the tiers and a maintenance chute, with the gravity halls and the hoverbike run level', () => {
  const lvl = buildLevel(18);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2, 'the maintenance chute');
  const level = lvl.zones.filter((z) => z.type === 'gravity' || z.type === 'hover');
  assert.equal(level.length, 3, 'two gravity halls and the hoverbike run');
  for (const z of level) assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `${z.type} zone at ${z.x0} is level`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
  assert.equal(countOf(lvl, 'ceilgun'), 4, 'the ceiling guns are still hung under the slab');
});

test('Level 20 (Warlord\'s Citadel): a broken crag with a scree slide and terraces, and all four arenas of the boss rush level', () => {
  const lvl = buildLevel(19);
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 4);
  assert.ok(steepCount(lvl) >= 2);
  assert.deepEqual(lvl.rush.map((a) => a.type), ['echo_trex', 'echo_colossus', 'echo_supertank']);
  for (const a of [...lvl.rush, lvl.boss]) assert.ok(!hasSlopeBetween(lvl, a.x0, a.x1), `the arena at ${a.x0} is level`);
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'));
});

test('the Modern levels keep the lives economy of the originals: the same medals, capsules and cast', () => {
  const medals = (lvl) => lvl.spawns.filter((s) => s.type === 'pickup' && s.item === 'medal').length;
  assert.deepEqual([16, 17, 18, 19].map((i) => medals(buildLevel(i))), [17, 14, 13, 10]);
  assert.deepEqual([16, 17, 18, 19].map((i) => countOf(buildLevel(i), 'capsule')), [7, 8, 9, 12]);
  assert.equal(countOf(buildLevel(17), 'cyborg'), 15);
  assert.equal(countOf(buildLevel(18), 'hoverbiker'), 5);
});
