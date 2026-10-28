// The Medieval batch (Levels 9-12) redesigned around its biomes: a fjord shore with pine slopes and scree, a castle on its mound with
// earthworks round the moat, a moonlit mountainside under the Shadow Castle, and a rocky coast before the pirate fleet. The places that
// need level ground (the longship decks and their swells, the barrage fields, the wall-jump shafts, the rope-swing decks and every
// boss arena) must stay level, and every level must still be crossable on foot.
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

/** True when any column in [x0, x1) pixels holds a slope tile. */
function hasSlopeBetween(level, x0, x1) {
  for (let x = Math.floor(x0 / TILE); x < Math.ceil(x1 / TILE); x++) {
    for (let y = 0; y < level.rows; y++) if (SLOPE[level.tiles[y * level.cols + x]]) return true;
  }
  return false;
}

const countOf = (level, type) => level.spawns.filter((s) => s.type === type).length;

test('Level 9 (Fjord Raid): pine slopes at 22 degrees, a 45-degree cliff path with scree down to the river, and level longship decks', () => {
  const lvl = buildLevel(8);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 6);
  assert.ok(steepCount(lvl) >= 2, 'scree slides down to the river bank');
  const swells = lvl.zones.find((z) => z.type === 'swells');
  assert.ok(swells && !hasSlopeBetween(lvl, swells.x0, swells.x1), 'the swells race along level decks');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1), 'the Kraken\'s deck is level');
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'));
  assert.equal(countOf(lvl, 'serpent'), 4, 'every ford keeps its serpent');
});

test('Level 10 (Castle Siege): meadow rises, a siege mound, earthworks round the moat and a gatehouse mound, with the barrage fields level', () => {
  const lvl = buildLevel(9);
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 8);
  const barrages = lvl.zones.filter((z) => z.type === 'barrage');
  assert.equal(barrages.length, 2, 'both barrage fields are still there');
  for (const z of barrages) assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `barrage at ${z.x0} lands on level ground`);
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
  assert.equal(countOf(lvl, 'catapult'), 2);
});

test('Level 11 (Shadow Castle): a mountainside of 22 and 45 degrees with a scree slide, and the wall-jump shafts still work', () => {
  const lvl = buildLevel(10);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 8);
  assert.ok(steepCount(lvl) >= 2);
  const shafts = lvl.links.filter((l) => l.kind === 'wall');
  assert.equal(shafts.length, 3, 'the three shafts are still there');
  for (const s of shafts) assert.ok(!hasSlopeBetween(lvl, s.data.x0 - 2 * TILE, s.data.x1 + 4 * TILE), `no slope touches the shaft at ${s.data.x0}`);
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'));
  assert.equal(lvl.spawns.filter((s) => s.item === '1up').length, 1, 'the 1UP at the top of the watchtower');
});

test('Level 12 (Pirate Armada): a rocky coast with a harbour ramp and a scree bank, while the ships and their rope swings stay level', () => {
  const lvl = buildLevel(11);
  assert.ok(count(lvl, GENTLE_22) >= 4 && count(lvl, RAMP_45) >= 8);
  assert.ok(steepCount(lvl) >= 2);
  const swings = lvl.links.filter((l) => l.kind === 'swing');
  assert.equal(swings.length, 4, 'four rope swings between the ships');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  const firstSwing = Math.min(...swings.map((l) => l.data?.x0 ?? l.from[0] * TILE));
  assert.ok(!hasSlopeBetween(lvl, firstSwing - 24 * TILE, lvl.boss.x1), 'every deck from the first ship to the galleon is level');
  assert.ok(solveLevel(lvl).goal);
});

test('the Medieval levels keep the lives economy of the originals: the same medals, capsules and hidden 1UP', () => {
  const medals = (lvl) => lvl.spawns.filter((s) => s.type === 'pickup' && s.item === 'medal').length;
  assert.deepEqual([8, 9, 10, 11].map((i) => medals(buildLevel(i))), [13, 18, 17, 15]);
  assert.deepEqual([8, 9, 10, 11].map((i) => countOf(buildLevel(i), 'capsule')), [6, 7, 6, 6]);
  assert.equal(buildLevel(10).spawns.filter((s) => s.item === '1up').length, 1);
});
