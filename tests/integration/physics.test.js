import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { levelFromAscii, flatLevel } from '../../src/game/ascii.js';
import { PLAYER, TILE } from '../../src/game/constants.js';

const FLOOR_Y = 14 * TILE;

function flatWorld(cols = 60) {
  const w = new World(flatLevel(cols, 14));
  return { w, input: makeInput() };
}

test('player falls and lands on the ground', () => {
  const { w, input } = flatWorld();
  w.player.y = 100;
  run(w, input, seconds(1));
  assert.equal(w.player.grounded, true);
  assert.ok(Math.abs(w.player.y - FLOOR_Y) < 0.01, `y=${w.player.y}`);
});

test('player runs at ~160 px/s', () => {
  const { w, input } = flatWorld();
  run(w, input, 10);
  const x0 = w.player.x;
  run(w, input, seconds(1), ['right']);
  assert.ok(Math.abs(w.player.x - x0 - PLAYER.RUN) < 3, `moved ${w.player.x - x0}`);
});

test('jump peaks near 59px and a full hop takes ~0.65s', () => {
  const { w, input } = flatWorld();
  run(w, input, 10);
  const y0 = w.player.y;
  let minY = y0;
  let frames = 0;
  input.script = { jump: true };
  for (let i = 0; i < 120; i++) {
    input.poll();
    w.update(input, 1 / 60);
    w.events.length = 0;
    minY = Math.min(minY, w.player.y);
    frames++;
    if (i > 3 && w.player.grounded) break;
  }
  const peak = y0 - minY;
  assert.ok(peak > 52 && peak < 62, `peak ${peak}`);
  assert.ok(frames > 36 && frames < 46, `airtime frames ${frames}`);
});

test('releasing jump early cuts the hop short', () => {
  const { w, input } = flatWorld();
  run(w, input, 10);
  const y0 = w.player.y;
  run(w, input, 3, ['jump']);
  let minY = y0;
  input.script = {};
  for (let i = 0; i < 60; i++) {
    input.poll();
    w.update(input, 1 / 60);
    minY = Math.min(minY, w.player.y);
  }
  assert.ok(y0 - minY < 40, `short hop peak ${y0 - minY}`);
});

test('solid walls stop horizontal movement', () => {
  const lvl = levelFromAscii([
    '..........',
    '..........',
    '..........',
    '.P....#...',
    '##########',
  ]);
  const w = new World(lvl);
  const input = makeInput();
  run(w, input, seconds(3), ['right']);
  assert.ok(w.player.x < 6 * TILE - PLAYER.W / 2 + 0.01, `x=${w.player.x}`);
  assert.equal(w.player.hitWall, 1);
});

function gapWorld(gap) {
  const rows = [];
  for (let y = 0; y < 17; y++) rows.push('.'.repeat(40));
  const floor = (x0, x1) => {
    for (let y = 14; y < 17; y++) rows[y] = rows[y].slice(0, x0) + '#'.repeat(x1 - x0) + rows[y].slice(x1);
  };
  floor(0, 10);
  floor(10 + gap, 40);
  rows[13] = 'P' + rows[13].slice(1);
  return new World(levelFromAscii(rows));
}

function tryGap(gap) {
  const w = gapWorld(gap);
  const input = makeInput();
  // run to the very edge, then jump while holding right and keep Jump held until we land
  let airborne = false;
  for (let i = 0; i < 600; i++) {
    const edgeX = 10 * TILE - 2;
    if (!airborne && w.player.x >= edgeX && w.player.grounded) airborne = true;
    run(w, input, 1, airborne ? ['right', 'jump'] : ['right']);
    if (airborne && w.player.grounded && w.player.x > (10 + gap) * TILE) return true;
    if (w.player.y > 17 * TILE) return false;
  }
  return false;
}

test('gaps up to MAX_GAP_TILES are jumpable, much wider gaps are not', () => {
  assert.equal(tryGap(3), true);
  assert.equal(tryGap(4), true);
  assert.equal(tryGap(5), true);
  assert.equal(tryGap(8), false);
});

test('one-way platforms: pass up through, land on top, drop with Down+Jump', () => {
  const lvl = levelFromAscii([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '....====..',
    '..........',
    '.P........',
    '##########',
  ]);
  const w = new World(lvl);
  const input = makeInput();
  // walk under the platform and jump up through it
  run(w, input, seconds(0.5), ['right']);
  assert.ok(w.player.x > 3 * TILE);
  // jump straight up repeatedly until we land on the platform
  let onTop = false;
  for (let i = 0; i < 120 && !onTop; i++) {
    run(w, input, 1, ['jump']);
    if (w.player.grounded && w.player.y < 14 * TILE) onTop = true;
  }
  assert.equal(onTop, true, 'should stand on the platform');
  assert.ok(Math.abs(w.player.y - 12 * TILE) < 0.01, `standing y=${w.player.y}`);
  // drop through
  run(w, input, 3, []);
  run(w, input, 1, ['down', 'jump']);
  run(w, input, seconds(0.6), ['down']);
  assert.ok(w.player.y > 14 * TILE, `dropped to y=${w.player.y}`);
});

test('pressing Down on the ground goes prone and shrinks the hitbox', () => {
  const { w, input } = flatWorld();
  run(w, input, 10);
  assert.equal(w.player.h, PLAYER.H);
  run(w, input, 5, ['down']);
  assert.equal(w.player.prone, true);
  assert.equal(w.player.h, PLAYER.PRONE_H);
  run(w, input, 5, []);
  assert.equal(w.player.prone, false);
  assert.equal(w.player.h, PLAYER.H);
});

test('8-way aim follows the d-pad', () => {
  const { w, input } = flatWorld();
  run(w, input, 10);
  run(w, input, 2, ['up']);
  assert.deepEqual([w.player.aimX, w.player.aimY], [0, -1]);
  run(w, input, 2, ['up', 'right']);
  assert.deepEqual([w.player.aimX, w.player.aimY], [1, -1]);
  run(w, input, 2, ['down', 'right']);
  assert.deepEqual([w.player.aimX, w.player.aimY], [1, 1]);
  run(w, input, 2, ['left']);
  assert.deepEqual([w.player.aimX, w.player.aimY], [-1, 0]);
});

test('spikes raise a hazard event; falling out of the map raises fell', () => {
  const lvl = levelFromAscii([
    '..........',
    '..........',
    '.P.^^.....',
    '####..####',
  ]);
  const w = new World(lvl);
  const input = makeInput();
  const ev = run(w, input, seconds(1), ['right']);
  assert.ok(ev.some((e) => e.type === 'hazard'), 'hazard event');
  const w2 = new World(lvl);
  w2.player.x = 5.5 * TILE; // above the pit (cols 4-5), clear of the spikes at cols 3-4
  w2.player.y = 3 * TILE;
  const ev2 = run(w2, input, seconds(2), []);
  assert.ok(ev2.some((e) => e.type === 'fell'), 'fell event');
});

test('ice is slippery and conveyors carry the player', () => {
  const lvl = levelFromAscii([
    '....................',
    '.P..................',
    'IIIIIIIIII>>>>>>>>>>',
  ]);
  const w = new World(lvl);
  const input = makeInput();
  run(w, input, seconds(0.5), ['right']);
  const vAtRelease = w.player.vx;
  run(w, input, 6, []);
  assert.ok(w.player.vx > 0 && w.player.vx < vAtRelease, `ice slide vx=${w.player.vx}`);
  // conveyor
  const w2 = new World(lvl);
  w2.player.x = 12 * TILE;
  w2.player.y = 2 * TILE;
  run(w2, input, 30, []);
  const x0 = w2.player.x;
  run(w2, input, 30, []);
  assert.ok(w2.player.x > x0 + 20, 'carried right by conveyor');
});

test('flipped gravity lets the player stand on the ceiling', () => {
  const lvl = levelFromAscii(['##########', '..........', '.P........', '##########']);
  const w = new World(lvl);
  const input = makeInput();
  w.player.gdir = -1;
  run(w, input, seconds(1), []);
  assert.equal(w.player.grounded, true);
  assert.ok(Math.abs(w.player.y - w.player.h - TILE) < 0.01, `y=${w.player.y}`);
});

test('the camera never scrolls backwards and the player cannot leave it on the left', () => {
  const { w, input } = flatWorld(120);
  run(w, input, seconds(3), ['right']);
  const cx = w.camera.x;
  assert.ok(cx > 50);
  run(w, input, seconds(2), ['left']);
  assert.ok(w.camera.x >= cx - 0.01);
  assert.ok(w.player.x >= w.camera.x + w.player.w / 2);
});
