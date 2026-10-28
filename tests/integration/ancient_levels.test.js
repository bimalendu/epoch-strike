// The Ancient batch (Levels 5-8) redesigned around its biomes: rolling desert dunes with the quicksand in the hollows, a hillside
// assault on Troy, Rome's hills before the sand, and the Great Wall following its ridge. Every level must use the slopes its brief
// promises, keep the places that need level ground (tombs, arenas, the chariot ride, the forced march) level, and still be crossable.
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

/** True when any column in [x0, x1) pixels holds a slope tile. */
function hasSlopeBetween(level, x0, x1) {
  for (let x = Math.floor(x0 / TILE); x < Math.ceil(x1 / TILE); x++) {
    for (let y = 0; y < level.rows; y++) if (SLOPE[level.tiles[y * level.cols + x]]) return true;
  }
  return false;
}

test('Level 5 (Pyramid of Ra): dunes at 22 and 45 degrees, quicksand in the hollows, and the tomb halls still level', () => {
  const lvl = buildLevel(4);
  assert.ok(count(lvl, GENTLE_22) >= 8, '22-degree dunes');
  assert.ok(count(lvl, RAMP_45) >= 6, '45-degree ridge and sarcophagus ramp');
  assert.ok(lvl.tiles.includes(T.QUICK), 'the quicksand is still there');
  // the crushers hang over a flat floor: no slope under any of them or within a tile of it
  for (const c of lvl.spawns.filter((s) => s.type === 'crusher')) {
    assert.ok(!hasSlopeBetween(lvl, c.x - TILE, c.x + TILE), `slope next to the crusher at ${c.x}`);
  }
  assert.ok(solveLevel(lvl).goal);
});

test('Level 5 keeps its hidden 1UP up the sarcophagus stair and it can still be reached', () => {
  const lvl = buildLevel(4);
  const up = lvl.spawns.filter((s) => s.item === '1up');
  assert.equal(up.length, 1);
  const sol = solveLevel(lvl);
  assert.ok(sol.path.some((n) => Math.abs(n.x * TILE - up[0].x) < 4 * TILE), 'the route passes the stair');
});

test('Level 6 (Siege of Troy) is a hillside assault: it runs left to right up slopes, with scree to slide down, not a tower', () => {
  const lvl = buildLevel(5);
  assert.ok(lvl.cols >= 250, `a long level (${lvl.cols} columns)`);
  assert.ok(lvl.rows < 60, 'no longer a tower');
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 8);
  assert.ok(lvl.tiles.some((t) => STEEP[t]), 'a scree slide into the siege trench');
  const sol = solveLevel(lvl);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'), 'the route slides down the scree');
  // the hill is climbed: the highest route node stands well above the beach it started from
  const start = Math.max(...sol.path.slice(0, 5).map((n) => n.fy));
  assert.ok(start - Math.min(...sol.path.map((n) => n.fy)) >= 5 * TILE, 'at least five tiles of climb');
});

test('Level 6 keeps its cast: hoplites with shields and archers on the terraces, with the Colossus waiting in a level courtyard', () => {
  const lvl = buildLevel(5);
  assert.equal(lvl.spawns.filter((s) => s.type === 'hoplite').length, 21);
  assert.equal(lvl.spawns.filter((s) => s.type === 'archer').length, 9);
  assert.equal(lvl.boss.type, 'colossus');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1), 'the boss arena is level');
});

test('Level 7 (The Colosseum): the way in is hills, while the wave arenas, the chariot ride and the champion\'s arena stay level', () => {
  const lvl = buildLevel(6);
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 4);
  for (const z of lvl.zones.filter((z) => z.type === 'waves' || z.type === 'chariot')) {
    assert.ok(!hasSlopeBetween(lvl, z.x0, z.x1), `${z.type} zone at ${z.x0} is on level ground`);
  }
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
});

test('Level 8 (The Great Wall) follows its ridge, with rubble heaps at the breach, and the forced march stays level', () => {
  const lvl = buildLevel(7);
  assert.ok(count(lvl, GENTLE_22) >= 8 && count(lvl, RAMP_45) >= 12);
  const march = lvl.zones.find((z) => z.type === 'autoscroll');
  assert.ok(march, 'the forced march is still there');
  assert.ok(!hasSlopeBetween(lvl, march.x0, march.x1), 'the march runs along level crenellations');
  assert.ok(!hasSlopeBetween(lvl, lvl.boss.x0, lvl.boss.x1));
  assert.ok(solveLevel(lvl).goal);
});

test('the Ancient levels keep the lives economy of the originals: the same medals, capsules and checkpoints', () => {
  const medals = (lvl) => lvl.spawns.filter((s) => s.type === 'pickup' && s.item === 'medal').length;
  assert.deepEqual([4, 5, 6, 7].map((i) => medals(buildLevel(i))), [13, 24, 14, 17]);
  assert.deepEqual([4, 5, 6, 7].map((i) => buildLevel(i).spawns.filter((s) => s.type === 'capsule').length), [5, 5, 5, 6]);
});
