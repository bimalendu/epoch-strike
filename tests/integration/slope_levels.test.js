// Behaviour tests for slopes in the level pipeline: the LevelBuilder's slope() and its refusals, the solver's walk and slide
// links across them, jumps that land on them, the bot crossing them, and a seeded property test over random courses.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { solveLevel, joinKind, reachableNear } from '../../src/game/solver.js';
import { T, SLOPE } from '../../src/game/tiles.js';
import { TILE, MAX_STEP_UP_TILES, MAX_GAP_TILES } from '../../src/game/constants.js';
import { playBot } from '../../tools/bot.js';
import { rng } from '../../src/engine/rng.js';

const at = (lvl, x, y) => lvl.tiles[y * lvl.cols + x];

/** Flat ground, then a slope of `dh` tiles at `angle`, then more flat ground and the exit. Starts high when the slope goes down. */
function courseWith(dh, angle, { pit = 0 } = {}) {
  const b = new LevelBuilder({ id: 1, name: 'S', theme: 'jungle' });
  if (dh < 0) {
    b.flat(2);
    b.up(MAX_STEP_UP_TILES);
  }
  b.flat(8);
  const seg = b.slope(dh, { angle });
  b.flat(8);
  if (pit) b.pit(pit);
  b.flat(6);
  b.exit();
  return { b, seg, level: b.finish() };
}

// ---- the builder ----
test('slope(): a 45-degree slope up lays one ramp cell per tile climbed, with solid ground underneath', () => {
  const { seg, level } = courseWith(3, 45);
  assert.equal(seg.len, 3);
  for (let i = 0; i < 3; i++) {
    const x = seg.x0 + i;
    const row = 13 - 1 - i;
    assert.equal(at(level, x, row), T.RAMP45_R, `ramp cell of column ${i}`);
    assert.equal(at(level, x, row - 1), T.AIR, 'air above');
    assert.equal(at(level, x, row + 1), T.SOLID, 'ground below');
  }
});

test('slope(): a 45-degree slope down uses the left-rising ramps and ends on ground three tiles lower', () => {
  const { seg, level } = courseWith(-3, 45);
  for (let i = 0; i < 3; i++) assert.equal(at(level, seg.x0 + i, 10 + i), T.RAMP45_L);
  assert.equal(level.ground[seg.x1 + 1], 13 * TILE);
});

test('slope(): a 22-degree slope takes two columns per tile, a low cell then a high one', () => {
  const { seg, level } = courseWith(2, 22);
  assert.equal(seg.len, 4);
  assert.equal(at(level, seg.x0, 12), T.RAMP22_R_LO);
  assert.equal(at(level, seg.x0 + 1, 12), T.RAMP22_R_HI);
  assert.equal(at(level, seg.x0 + 2, 11), T.RAMP22_R_LO);
  assert.equal(at(level, seg.x0 + 3, 11), T.RAMP22_R_HI);
});

test('slope(): a steep slope climbs two tiles per column, with its low cell under its high cell', () => {
  const { seg, level } = courseWith(2, 67);
  assert.equal(seg.len, 1);
  assert.equal(at(level, seg.x0, 12), T.STEEP_R_LO);
  assert.equal(at(level, seg.x0, 11), T.STEEP_R_HI);
  assert.equal(at(level, seg.x0, 13), T.SOLID);
});

test('slope(): level.ground holds the surface height at the middle of every column, in px, and -1 over a pit', () => {
  const { seg, level } = courseWith(2, 45, { pit: 3 });
  assert.equal(level.ground[0], 13 * TILE);
  assert.equal(level.ground[seg.x0], 13 * TILE - 8, 'half a tile up the first ramp cell');
  assert.equal(level.ground[seg.x0 + 1], 13 * TILE - 24);
  assert.equal(level.ground[seg.x1 + 2], 11 * TILE);
  assert.ok(level.ground.includes(-1), 'the pit');
  assert.equal(level.ground.length, level.cols);
});

test('slope(): entities placed on a slope stand on its line', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  const seg = b.slope(2, { angle: 45 });
  b.flat(6);
  seg.enemy('grunt', 0).enemy('grunt', 1);
  b.exit();
  const grunts = b.finish().spawns.filter((s) => s.type === 'grunt');
  assert.deepEqual(grunts.map((g) => g.y), [13 * TILE - 8, 13 * TILE - 24]);
});

test('slope(): refuses what does not fit the grid or the player', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  assert.throws(() => b.slope(0), /whole number/);
  assert.throws(() => b.slope(1.5), /whole number/);
  assert.throws(() => b.slope(2, { angle: 30 }), /use 22, 45 or 67/);
  assert.throws(() => b.slope(3, { angle: 67 }), /does not fit the tile grid/);
  assert.throws(() => b.slope(4, { angle: 67 }), /cannot be climbed/);
  assert.throws(() => b.slope(20), /leaves the level/);
  assert.throws(() => b.slope(-6), /leaves the level/);
  assert.doesNotThrow(() => b.slope(MAX_STEP_UP_TILES - 1, { angle: 67 }));
});

test('slope(): steps right after a steep climb add up to its height, and ground in between resets the count', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  b.slope(2, { angle: 67 });
  assert.throws(() => b.up(2), /more than the player can climb/);
  b.flat(3);
  assert.doesNotThrow(() => b.up(2));
});

test('slope(): a gentle slope is a continuous route, so a step right after it counts from its top', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  b.slope(6, { angle: 45 });
  assert.doesNotThrow(() => b.up(MAX_STEP_UP_TILES));
});

test('zones that need level ground refuse a slope', () => {
  const b = new LevelBuilder({ id: 1 });
  const flat = b.flat(8);
  const seg = b.slope(1, { angle: 45 });
  b.flat(20);
  assert.throws(() => b.tankRoad(seg.x0 - 2, seg.x0 + 4), /needs level ground/);
  assert.throws(() => b.searchlight(seg.x0 - 3, seg.x0 + 3), /needs level ground/);
  assert.throws(() => b.swells(seg.x0 - 2, seg.x0 + 2), /needs level ground/);
  assert.throws(() => b.barrage(seg.x0 - 2, seg.x0 + 2), /needs level ground/);
  assert.throws(() => seg.checkpoint(0), /needs level ground/);
  assert.throws(() => b.spikes(seg, 0, 1), /needs level ground/);
  assert.throws(() => b.block(seg.x0, 1, 1), /needs level ground/);
  assert.doesNotThrow(() => flat.checkpoint(2));
  assert.doesNotThrow(() => b.tankRoad(seg.x1 + 1, seg.x1 + 10, { supply: false }));
});

test('a gravity hall will not start on a slope', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  b.slope(1, { angle: 45 });
  assert.throws(() => b.flipHall(14), /needs level ground/);
});

test('laying flat ground over a column that was a slope clears the slope', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(4);
  b.slope(1, { angle: 45 });
  assert.equal(b.isSlope(4), true);
  b.x = 4;
  b.gy = 13;
  b.flat(1);
  assert.equal(b.isSlope(4), false);
});

// ---- the solver ----
test('joinKind: surfaces that meet end to end walk, and scree is only joined going down', () => {
  const flatLeft = { lx: 0, ly: 100, rx: 16, ry: 100, steep: false };
  const rampUp = { lx: 16, ly: 100, rx: 32, ry: 84, steep: false };
  const steepUp = { lx: 16, ly: 100, rx: 24, ry: 84, steep: true };
  const steepDown = { lx: 16, ly: 84, rx: 24, ry: 100, steep: true };
  assert.equal(joinKind(flatLeft, rampUp), 'walk');
  assert.equal(joinKind(rampUp, flatLeft), 'walk');
  assert.equal(joinKind(flatLeft, steepUp), null, 'cannot climb scree');
  assert.equal(joinKind(steepUp, flatLeft), 'slide', 'sliding out at its foot');
  assert.equal(joinKind(steepUp, { lx: 24, ly: 84, rx: 40, ry: 84, steep: false }), null, 'but not out of its high end onto the ledge');
  assert.equal(joinKind({ lx: 0, ly: 60, rx: 16, ry: 60, steep: false }, steepDown), null, 'a ledge at the wrong height does not meet');
  assert.equal(joinKind({ lx: 0, ly: 84, rx: 16, ry: 84, steep: false }, steepDown), 'slide', 'down from a ledge');
  assert.equal(joinKind(steepDown, { lx: 24, ly: 100, rx: 40, ry: 100, steep: false }), 'slide', 'and out at the foot');
  assert.equal(joinKind(flatLeft, { lx: 40, ly: 100, rx: 56, ry: 100, steep: false }), null, 'a gap is not joined');
});

test('solver: walks up and down every gentle angle, with a walk link per ramp cell', () => {
  for (const [dh, angle] of [[2, 45], [-2, 45], [2, 22], [-2, 22], [5, 45]]) {
    const { level } = courseWith(dh, angle);
    const sol = solveLevel(level);
    assert.ok(sol.goal, `${angle} degrees, dh ${dh}: a route exists`);
    const slopeNodes = sol.path.filter((n) => n.slope);
    assert.ok(slopeNodes.length >= Math.abs(dh), `${angle}/${dh}: the route walks the ramp cell by cell`);
    assert.ok(slopeNodes.every((n) => n.kind === 'walk'));
  }
});

test('solver: a steep slope down is slid, and the route says so', () => {
  const { level } = courseWith(-2, 67);
  const sol = solveLevel(level);
  assert.ok(sol.goal);
  assert.ok(sol.path.some((n) => n.kind === 'slide'), 'a slide leg');
});

test('solver: a steep slope up is not walked: the route jumps onto the ledge instead', () => {
  const { level } = courseWith(2, 67);
  const sol = solveLevel(level);
  assert.ok(sol.goal);
  assert.ok(!sol.path.some((n) => n.kind === 'slide'));
  assert.ok(sol.path.some((n) => n.kind === 'jump'));
});

test('solver: scree cannot be climbed, so a ledge above the jump height behind a steep slope is unreachable', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(8);
  b.slope(MAX_STEP_UP_TILES - 1, { angle: 67 });
  b.flat(4);
  b.exit();
  const level = b.finish();
  // raise the ledge: turn the top two rows above the ledge into an overhang that makes the jump impossible
  const x = level.cols - 6;
  for (let y = 0; y < 12; y++) level.tiles[y * level.cols + x] = T.SOLID;
  assert.equal(solveLevel(level).goal, null);
});

test('solver: a jump can land in the middle of a ramp', () => {
  const b = new LevelBuilder({ id: 1 });
  b.flat(6);
  b.pit(2);
  b.slope(2, { angle: 45 });
  b.flat(6);
  b.exit();
  const level = b.finish();
  const sol = solveLevel(level);
  assert.ok(sol.goal);
  assert.ok([...sol.reach.values()].some((n) => n.kind === 'jump' && n.spot.slope), 'a jump lands on a ramp cell');
});

test('solver: spots on a ramp know their height', () => {
  const { level } = courseWith(2, 45);
  const sol = solveLevel(level);
  const ramp = sol.path.filter((n) => n.slope).map((n) => n.fy);
  assert.deepEqual(ramp, [13 * TILE - 8, 13 * TILE - 24]);
});

test('solver: the fill under a ramp is not somewhere to stand', () => {
  const { level, seg } = courseWith(2, 45);
  const sol = solveLevel(level);
  const fill = [...sol.reach.values()].filter((n) => n.spot.x === seg.x0 && !n.spot.slope && n.spot.y === 13);
  assert.equal(fill.length, 0);
});

test('solver: checkpoints and pickups on the ground beyond a slope are reachable', () => {
  const { level } = courseWith(2, 45);
  const sol = solveLevel(level);
  assert.equal(reachableNear(sol, (level.cols - 3) * TILE, 1), true);
});

test('solver: the search from the middle of a ramp starts on the ramp cell', () => {
  const { level, seg } = courseWith(2, 45);
  const sol = solveLevel(level, { from: { x: seg.x0 * TILE + 8, y: 13 * TILE - 8 } });
  assert.equal(sol.start.slope, true);
  assert.equal(sol.start.x, seg.x0);
});

// ---- the bot ----
test('bot: crosses every angle up and down without a fall or hazard, walking the ramps and sliding the scree', () => {
  for (const [dh, angle] of [[2, 45], [-2, 45], [3, 22], [-3, 22], [2, 67], [-2, 67], [-4, 67], [6, 45]]) {
    const { level } = courseWith(dh, angle, { pit: 3 });
    const r = playBot(level, { seconds: 90 });
    assert.ok(r.cleared, `${angle} degrees, dh ${dh}: reached the exit (stuck at x=${Math.round(r.x)})`);
    assert.equal(r.falls, 0, `${angle}/${dh}: no falls`);
    assert.equal(r.hazards, 0);
    assert.ok(r.replans <= 2, `${angle}/${dh}: followed its route (${r.replans} plans)`);
  }
});

// ---- property: random courses with slopes ----
function randomSlopeCourse(seed) {
  const r = rng(seed);
  const b = new LevelBuilder({ id: 1, name: 'P', theme: 'jungle', seed });
  const refused = [];
  b.flat(r.int(4, 8));
  for (let i = r.int(4, 9); i > 0; i--) {
    const op = r.pick(['slope', 'slope', 'slope', 'pit', 'up', 'down', 'hill']);
    const angle = r.pick([22, 45, 45, 67]);
    const dh = (angle === 67 ? 2 : r.int(1, 3)) * r.pick([1, 1, -1]);
    try {
      if (op === 'slope') b.slope(dh, { angle });
      else if (op === 'pit') b.pit(r.int(1, MAX_GAP_TILES + 1), { fill: r.pick(['spikes', null]) });
      else if (op === 'up') b.up(r.int(1, MAX_STEP_UP_TILES));
      else if (op === 'down') b.down(r.int(1, 2));
      else b.hill(r.int(2, 4), r.int(1, 2));
    } catch (e) {
      refused.push({ op, dh, angle, message: e.message });
    }
    b.flat(r.int(3, 6));
    if (b.gy > b.rows - 5) {
      b.up(Math.min(MAX_STEP_UP_TILES, b.gy - (b.rows - 7)));
      b.flat(3);
    }
    if (b.gy < 5) {
      b.down(2);
      b.flat(3);
    }
  }
  b.exit();
  return { level: b.finish(), refused };
}

test('property: every accepted random course with slopes has a route (200 seeded courses)', () => {
  let slopes = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { level } = randomSlopeCourse(seed);
    slopes += level.tiles.filter((t) => SLOPE[t]).length > 0 ? 1 : 0;
    assert.ok(solveLevel(level).goal, `seed ${seed}: no route to the exit`);
  }
  assert.ok(slopes > 150, `most courses have slopes (${slopes})`);
});

test('property: the bot crosses accepted random courses with slopes without a fall or hazard (25 seeded courses)', () => {
  for (let seed = 300; seed < 325; seed++) {
    const { level } = randomSlopeCourse(seed);
    const r = playBot(level, { seconds: 150 });
    assert.ok(r.cleared, `seed ${seed}: stuck at x=${Math.round(r.x)}`);
    assert.equal(r.falls, 0, `seed ${seed}: fell`);
    assert.equal(r.hazards, 0, `seed ${seed}: touched a hazard`);
  }
});
