// Unit tests for src/game/camera.js against a stub world: snapping, clamping to the map, narrow maps, arena locks,
// autoscroll, the forward-only rule, a fixed y, and screen shake (decay and its opt-outs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../../src/game/camera.js';
import { TILE, VIEW_W, DT } from '../../src/game/constants.js';
import { rng } from '../../src/engine/rng.js';

const stubWorld = (cols, rows = 17, extra = {}) => ({ cols, rows, autoscroll: null, fxRand: rng(1), ...extra });
const at = (x, y = 200) => ({ x, y });
const settle = (cam, w, p, frames = 600) => {
  for (let i = 0; i < frames; i++) cam.update(w, p, DT);
};

test('a new camera starts at the origin with maxX from the map width', () => {
  const cam = new Camera(stubWorld(100));
  assert.equal(cam.x, 0);
  assert.equal(cam.maxX, 100 * TILE - VIEW_W);
});

test('snap puts the player at 42% of the view', () => {
  const cam = new Camera(stubWorld(200));
  cam.snap(at(1000));
  assert.equal(cam.x, 1000 - VIEW_W * 0.42);
});

test('snap clamps at the left edge of the map', () => {
  const cam = new Camera(stubWorld(200));
  cam.snap(at(10));
  assert.equal(cam.x, 0);
});

test('snap clamps at the right edge of the map', () => {
  const cam = new Camera(stubWorld(200));
  cam.snap(at(200 * TILE));
  assert.equal(cam.x, cam.maxX);
});

test('update clamps the camera to [0, maxX] however far the player runs', () => {
  const cam = new Camera(stubWorld(60));
  settle(cam, stubWorld(60), at(60 * TILE + 500));
  assert.equal(cam.x, cam.maxX);
  assert.ok(cam.x >= 0);
});

test('a map narrower than the view pins the camera at 0', () => {
  const w = stubWorld(10); // 160 px < 480 px
  const cam = new Camera(w);
  assert.equal(cam.maxX, 0);
  cam.snap(at(150));
  assert.equal(cam.x, 0);
  settle(cam, w, at(150));
  assert.equal(cam.x, 0);
});

test('the camera follows the player forward', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  settle(cam, w, at(1000));
  assert.ok(Math.abs(cam.x - (1000 - VIEW_W * 0.42)) < 1);
});

test('the camera never scrolls back when the player retreats', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  settle(cam, w, at(1000));
  const x = cam.x;
  settle(cam, w, at(300));
  assert.equal(cam.x, x);
});

test('the camera moves a fraction of the gap per frame, not all at once', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  cam.update(w, at(1000), DT);
  assert.ok(cam.x > 0 && cam.x < 1000 - VIEW_W * 0.42);
});

test('an arena lock keeps the camera inside [lockMin, lockMax]', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  cam.lockMin = 500;
  cam.lockMax = 600;
  settle(cam, w, at(100));
  assert.equal(cam.x, 500); // pulled up to lockMin even though the player is far behind
  settle(cam, w, at(2000));
  assert.equal(cam.x, 600);
});

test('lockMax below lockMin collapses to lockMin', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  cam.lockMin = 700;
  cam.lockMax = 400;
  settle(cam, w, at(1500));
  assert.equal(cam.x, 700);
});

test('PINNED: a lockMin beyond the map end wins over maxX, so the camera can sit past the map', () => {
  const w = stubWorld(60);
  const cam = new Camera(w);
  cam.lockMin = 5000;
  settle(cam, w, at(100), 5);
  assert.equal(cam.x, 5000); // current behaviour: hi is raised to lo; level scripts never lock past the map
});

test('a lock with only lockMax set still lets the camera start at 0', () => {
  const w = stubWorld(200);
  const cam = new Camera(w);
  cam.lockMax = 100;
  settle(cam, w, at(2000));
  assert.equal(cam.x, 100);
});

test('autoscroll advances at least its speed even if the player stands still', () => {
  const w = stubWorld(400, 17, { autoscroll: { active: true, speed: 60 } });
  const cam = new Camera(w);
  cam.update(w, at(0), 1);
  assert.equal(cam.x, 60);
  cam.update(w, at(0), 1);
  assert.equal(cam.x, 120);
});

test('autoscroll gives way to a player running ahead of the minimum speed', () => {
  const w = stubWorld(400, 17, { autoscroll: { active: true, speed: 10 } });
  const cam = new Camera(w);
  cam.update(w, at(2000), DT);
  assert.ok(cam.x > 10 * DT * 2, `x ${cam.x}`);
});

test('an inactive autoscroll behaves like normal following', () => {
  const w = stubWorld(400, 17, { autoscroll: { active: false, speed: 60 } });
  const cam = new Camera(w);
  settle(cam, w, at(0), 120);
  assert.equal(cam.x, 0);
});

test('autoscroll stops at the end of the map', () => {
  const w = stubWorld(40, 17, { autoscroll: { active: true, speed: 500 } });
  const cam = new Camera(w);
  settle(cam, w, at(0), 120);
  assert.equal(cam.x, cam.maxX);
});

test('the camera never scrolls vertically: y stays 0 however high or low the player is', () => {
  const w = stubWorld(100, 60);
  const cam = new Camera(w);
  settle(cam, w, at(100, 800), 300);
  assert.equal(cam.y, 0);
  settle(cam, w, at(100, 60 * TILE + 999), 300);
  assert.equal(cam.y, 0);
});

test('shake sets a render offset bounded by its magnitude', () => {
  const w = stubWorld(100);
  const cam = new Camera(w);
  cam.shake(4, 1);
  cam.update(w, at(100), DT);
  assert.ok(Math.abs(cam.ox) <= 4 && Math.abs(cam.oy) <= 4);
  assert.equal(cam.shakeMag, 4);
});

test('shake offsets come from the world\'s cosmetic stream, so the same seed shakes the same way and gameplay randomness is untouched', () => {
  const offsets = (seed) => {
    const w = stubWorld(100, 17, { fxRand: rng(seed) });
    const cam = new Camera(w);
    cam.shake(8, 1);
    const seen = [];
    for (let i = 0; i < 20; i++) {
      cam.update(w, at(100), DT);
      seen.push([cam.ox, cam.oy]);
    }
    return seen;
  };
  assert.deepEqual(offsets(5), offsets(5));
  assert.notDeepEqual(offsets(5), offsets(6));
  // Math.random must not be consulted at all
  const real = Math.random;
  Math.random = () => assert.fail('camera shake used Math.random');
  try { offsets(5); } finally { Math.random = real; }
});

test('shake decays: the offset is zero once its time has run out', () => {
  const w = stubWorld(100);
  const cam = new Camera(w);
  cam.shake(6, 0.25);
  settle(cam, w, at(100), 30); // 0.5 s
  assert.equal(cam.shakeT <= 0, true);
  assert.equal(cam.ox, 0);
  assert.equal(cam.oy, 0);
});

test('shake amplitude tapers over its final quarter second', () => {
  const w = stubWorld(100);
  const cam = new Camera(w);
  cam.shake(100, 1);
  let tailMax = 0;
  for (let i = 0; i < 60; i++) {
    cam.update(w, at(100), DT);
    if (cam.shakeT < 0.05 && cam.shakeT > 0) tailMax = Math.max(tailMax, Math.abs(cam.ox), Math.abs(cam.oy));
  }
  assert.ok(tailMax <= 100 * 0.05 * 4 + 1, `tail ${tailMax}`);
});

test('a stronger shake wins and a longer time wins; weaker ones do not shorten it', () => {
  const cam = new Camera(stubWorld(100));
  cam.shake(2, 0.5);
  cam.shake(5, 0.2);
  assert.equal(cam.shakeMag, 5);
  assert.equal(cam.shakeT, 0.5);
  cam.shake(1, 0.1);
  assert.equal(cam.shakeMag, 5);
  assert.equal(cam.shakeT, 0.5);
});

test('shakeEnabled=false suppresses shake entirely', () => {
  const w = stubWorld(100, 17, { shakeEnabled: false });
  const cam = new Camera(w);
  cam.shake(8, 1);
  assert.equal(cam.shakeT, 0);
  cam.update(w, at(100), DT);
  assert.equal(cam.ox, 0);
  assert.equal(cam.oy, 0);
});

test('flashesReduced halves shake magnitude', () => {
  const cam = new Camera(stubWorld(100, 17, { flashesReduced: true }));
  cam.shake(8, 1);
  assert.equal(cam.shakeMag, 4);
});

test('rx and ry are the rounded origin plus the shake offset', () => {
  const cam = new Camera(stubWorld(100));
  cam.x = 10.6;
  cam.y = 3.4;
  cam.ox = 2;
  cam.oy = -1;
  assert.equal(cam.rx, 13);
  assert.equal(cam.ry, 2);
});
