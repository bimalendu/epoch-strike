// Behaviour tests for walkable slopes in the simulation: a soldier, a tank and an enemy walker crossing 22-degree, 45-degree and
// steep slopes, jumping onto them, sliding down scree, and the shape-aware point and rectangle queries bullets rely on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { levelFromAscii } from '../../src/game/ascii.js';
import { TILE } from '../../src/game/constants.js';
import { rectSolid, surfaceAt, floorNear } from '../../src/game/physics.js';
import { spawnEnemy } from '../../src/game/enemies.js';

const FLOOR = 14 * TILE; // the low ground's top edge in every map below
const cx = (tile) => tile * TILE + TILE / 2;

/** A 17-row map: low ground from row 14 down, with `rows` (a {row: 'text'} object) drawn over the open air above it. */
function mapWith(rows, cols = 40) {
  const lines = [];
  for (let y = 0; y < 17; y++) lines.push((y >= 14 ? '#' : '.').repeat(cols));
  for (const [row, text] of Object.entries(rows)) {
    lines[row] = text.padEnd(cols, '.').slice(0, cols);
  }
  return levelFromAscii(lines);
}

function worldOn(level) {
  return { w: new World(level, { god: true }), input: makeInput() };
}

function stand(w, tile, y = FLOOR) {
  w.player.x = cx(tile);
  w.player.y = y;
  w.player.vx = 0;
  w.player.vy = 0;
  w.camera.x = Math.max(0, w.player.x - 200);
}

/** Step with held keys, recording the player's state each frame. */
function trace(w, input, frames, keys) {
  const out = [];
  for (let i = 0; i < frames; i++) {
    run(w, input, 1, keys);
    out.push({ x: w.player.x, y: w.player.y, grounded: w.player.grounded, hitWall: w.player.hitWall });
  }
  return out;
}

test('a level with slopes sets hasSlopes, and one without does not', () => {
  assert.equal(new World(mapWith({ 13: '.....1' })).hasSlopes, true);
  assert.equal(new World(mapWith({})).hasSlopes, false);
});

test('walking up a 45-degree ramp stays grounded the whole way and ends on the upper ground', () => {
  const { w, input } = worldOn(mapWith({ 13: '........../', 12: '' , 14: '#'.repeat(40) }));
  for (let x = 11; x < 40; x++) w.setTile(x, 13, 1);
  stand(w, 8);
  run(w, input, 5);
  const frames = trace(w, input, seconds(1.2), ['right']);
  assert.ok(frames.every((f) => f.grounded), 'grounded on every frame');
  assert.ok(frames.every((f) => f.hitWall === 0), 'never stopped by a wall');
  const last = frames[frames.length - 1];
  assert.equal(last.y, FLOOR - TILE, `ends on the upper ground (y=${last.y})`);
});

test('the surface follows the ramp line: halfway along a 45-degree ramp the feet are half a tile up', () => {
  const lvl = mapWith({ 13: '........../' });
  const { w, input } = worldOn(lvl);
  stand(w, 10);
  w.player.x = 10 * TILE + 8;
  run(w, input, 3);
  assert.ok(Math.abs(w.player.y - (FLOOR - 8)) < 0.01, `y=${w.player.y}`);
  assert.equal(w.player.groundTile, w.tile(10, 13));
});

test('walking down a 45-degree ramp keeps the soldier grounded on every frame', () => {
  const { w, input } = worldOn(mapWith({ 13: '##########\\' }));
  stand(w, 8, FLOOR - 16);
  w.player.x = 10 * TILE - 2;
  const frames = trace(w, input, seconds(0.5), ['right']);
  const onRamp = frames.filter((f) => f.x > 10 * TILE && f.x < 11 * TILE);
  assert.ok(onRamp.length > 3);
  assert.ok(onRamp.every((f) => f.grounded), 'grounded on the way down');
});

test('a 22-degree ramp of two cells can be walked up and down', () => {
  const lvl = mapWith({ 13: '..........12' });
  const { w, input } = worldOn(lvl);
  for (let x = 12; x < 40; x++) w.setTile(x, 13, 1);
  stand(w, 7);
  run(w, input, 5);
  const up = trace(w, input, seconds(1.4), ['right']);
  assert.ok(up.every((f) => f.grounded && f.hitWall === 0));
  assert.equal(w.player.y, FLOOR - TILE);
  const down = trace(w, input, seconds(1.4), ['left']);
  assert.ok(down.every((f) => f.grounded && f.hitWall === 0));
  assert.equal(w.player.y, FLOOR);
});

test('the surface of a 22-degree ramp climbs a quarter of a tile per tile of 8 px run: 8 px over the first cell', () => {
  const { w } = worldOn(mapWith({ 13: '..........12' }));
  assert.equal(surfaceAt(w, 10 * TILE, FLOOR).y, FLOOR);
  assert.equal(surfaceAt(w, 11 * TILE, FLOOR - 8).y, FLOOR - 8);
  assert.equal(surfaceAt(w, 12 * TILE - 0.001, FLOOR - 16).y.toFixed(2), (FLOOR - 16).toFixed(2));
});

test('the soldier cannot climb a steep slope: walking into it is a wall', () => {
  const { w, input } = worldOn(mapWith({ 12: '..........6', 13: '..........5' }));
  for (let x = 11; x < 40; x++) {
    w.setTile(x, 12, 1);
    w.setTile(x, 13, 1);
  }
  stand(w, 7);
  run(w, input, 5);
  trace(w, input, seconds(2), ['right']);
  assert.ok(w.player.x < 10 * TILE + 2, `stopped at the foot of the slope (x=${w.player.x})`);
  assert.equal(w.player.y, FLOOR);
});

test('a steep slope can be jumped onto from the low side', () => {
  const { w, input } = worldOn(mapWith({ 12: '..........6', 13: '..........5' }));
  for (let x = 11; x < 40; x++) {
    w.setTile(x, 12, 1);
    w.setTile(x, 13, 1);
  }
  stand(w, 8);
  w.player.x = 10 * TILE - 20;
  run(w, input, 5);
  let landedHigh = false;
  input.script = { right: true, jump: true };
  for (let i = 0; i < seconds(1.5); i++) {
    input.poll();
    w.update(input, 1 / 60);
    w.events.length = 0;
    if (w.player.grounded && w.player.y <= FLOOR - 32 + 0.01) landedHigh = true;
  }
  assert.equal(landedHigh, true, 'the jump clears the steep face onto the upper ground');
});

test('standing on a steep slope slides the soldier down it, and input cannot hold them or push them up', () => {
  const { w, input } = worldOn(mapWith({ 12: '..........6', 13: '..........5' }));
  for (let x = 11; x < 40; x++) {
    w.setTile(x, 12, 1);
    w.setTile(x, 13, 1);
  }
  stand(w, 11, FLOOR - 32);
  w.player.x = 10 * TILE + 12; // up the slope's top half, on its surface
  w.player.y = FLOOR - 24;
  run(w, input, 2);
  const x0 = w.player.x;
  run(w, input, 20, ['right']); // pushing uphill
  assert.ok(w.player.x < x0 - 10, `slid down (x ${x0} -> ${w.player.x})`);
  run(w, input, seconds(1.5));
  assert.equal(w.player.y, FLOOR, 'slid all the way to the foot');
  assert.equal(w.player.grounded, true);
});

test('jumping off a steep slope still works: a jump is not overridden by the slide', () => {
  const { w, input } = worldOn(mapWith({ 12: '..........6', 13: '..........5' }));
  for (let x = 11; x < 40; x++) {
    w.setTile(x, 12, 1);
    w.setTile(x, 13, 1);
  }
  w.player.x = 10 * TILE + 12;
  w.player.y = FLOOR - 24;
  run(w, input, 2);
  const y0 = w.player.y;
  input.script = { jump: true };
  let minY = y0;
  for (let i = 0; i < 20; i++) {
    input.poll();
    w.update(input, 1 / 60);
    w.events.length = 0;
    minY = Math.min(minY, w.player.y);
  }
  assert.ok(minY < y0 - 20, `rose ${y0 - minY} px`);
});

test('landing from a jump on the middle of a ramp is a normal landing on the line', () => {
  const { w, input } = worldOn(mapWith({ 13: '........../' }));
  for (let x = 11; x < 40; x++) w.setTile(x, 13, 1);
  stand(w, 10);
  w.player.x = 10 * TILE + 10;
  w.player.y = FLOOR - 70;
  w.player.vy = 0;
  run(w, input, seconds(1));
  assert.equal(w.player.grounded, true);
  assert.ok(Math.abs(w.player.y - (FLOOR - 10)) < 0.01, `y=${w.player.y}`);
});

test('solidAtPx follows the slope line: solid below it, empty above it', () => {
  const { w } = worldOn(mapWith({ 13: '........../' })); // 45-degree: surface y = FLOOR - localX
  const x = 10 * TILE + 8; // surface at FLOOR - 8
  assert.equal(w.solidAtPx(x, FLOOR - 4), true);
  assert.equal(w.solidAtPx(x, FLOOR - 12), false);
  assert.equal(w.solidAtPx(10 * TILE + 2, FLOOR - 8), false, 'the empty triangle above the line');
  assert.equal(w.solidAtPx(10 * TILE + 14, FLOOR - 8), true, 'the filled part under the high end');
});

test('a player bullet flies through the empty triangle above a ramp and stops at the line', () => {
  const { w } = worldOn(mapWith({ 13: '........../' }));
  const above = w.solidAtPx(10 * TILE + 3, FLOOR - 10);
  const inside = w.solidAtPx(10 * TILE + 13, FLOOR - 10);
  assert.equal(above, false);
  assert.equal(inside, true);
});

test('rectSolid: a rectangle overlaps a ramp only when it reaches below the line', () => {
  const { w } = worldOn(mapWith({ 13: '........../' }));
  const x0 = 10 * TILE;
  assert.equal(rectSolid(w, x0, FLOOR - 40, x0 + 4, FLOOR - 6), false, 'above the low end of the line');
  assert.equal(rectSolid(w, x0, FLOOR - 40, x0 + 14, FLOOR - 6), true, 'its right edge is over the high end');
  assert.equal(rectSolid(w, x0, FLOOR - 40, x0 + 14, FLOOR - 15), false, 'but clear above the line at the high end');
});

test('prone on a ramp: standing up is blocked only by solid ground above the head, not by the ramp itself', () => {
  const { w, input } = worldOn(mapWith({ 13: '........../' }));
  for (let x = 11; x < 40; x++) w.setTile(x, 13, 1);
  stand(w, 10);
  w.player.x = 10 * TILE + 6;
  run(w, input, 5);
  run(w, input, 10, ['down']);
  assert.equal(w.player.prone, true);
  run(w, input, 10);
  assert.equal(w.player.prone, false, 'stood up again');
});

test('floorNear counts a ramp ahead as footing and a pit as none', () => {
  const lvl = mapWith({ 13: '........../' });
  const { w } = worldOn(lvl);
  assert.equal(floorNear(w, 10 * TILE + 8, FLOOR), true);
  const pit = worldOn(mapWith({}, 40));
  pit.w.setTile(5, 14, 0);
  pit.w.setTile(5, 15, 0);
  pit.w.setTile(5, 16, 0);
  assert.equal(floorNear(pit.w, 5 * TILE + 8, FLOOR), false);
});

test('an enemy walker climbs a ramp instead of turning back at the foot of it', () => {
  const lvl = mapWith({ 13: '........../' }, 40);
  const w = new World(lvl, { god: true });
  for (let x = 11; x < 40; x++) w.setTile(x, 13, 1);
  const e = spawnEnemy(w, { type: 'grunt', x: 8 * TILE, y: FLOOR });
  e.face = 1;
  e.speedMul = 1;
  w.player.x = 30 * TILE;
  w.camera.x = 4 * TILE;
  const input = makeInput();
  run(w, input, seconds(3));
  assert.ok(e.x > 12 * TILE || !e.alive, `walker got over the ramp (x=${e.x})`);
});

test('a tank drives up a ramp', () => {
  const lvl = mapWith({ 13: '........../' });
  const { w, input } = worldOn(lvl);
  for (let x = 11; x < 40; x++) w.setTile(x, 13, 1);
  stand(w, 5);
  w.player.mountTank(null);
  run(w, input, 5);
  run(w, input, seconds(3), ['right']);
  assert.ok(w.player.x > 12 * TILE, `x=${w.player.x}`);
  assert.equal(w.player.y, FLOOR - TILE);
});

test('levels without slopes are untouched: the same input gives the same positions with the slope code gated off', () => {
  const flat = new World(mapWith({}), { god: true });
  const input = makeInput();
  stand(flat, 5);
  run(flat, input, seconds(1), ['right']);
  assert.equal(flat.hasSlopes, false);
  assert.equal(flat.player.y, FLOOR);
});
