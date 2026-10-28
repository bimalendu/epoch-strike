import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Painter, lightenedCopy, readPixels } from '../src/engine/gfx.js';
import { bake, bakeFrames } from '../src/game/art/bake.js';

const px = (img, x, y) => {
  const d = readPixels(img);
  const i = (y * img.width + x) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};

function block() {
  // a 6x6 canvas with a 4x4 block at (1,1)
  return new Painter(6, 6).rect(1, 1, 4, 4, '#c08040').canvas;
}

test('bake pads left, top and right but not the bottom', () => {
  const b = bake(block());
  assert.equal(b.width, 8);
  assert.equal(b.height, 7);
});

test('bake outlines only transparent pixels that touch the sprite', () => {
  const src = block();
  const b = bake(src);
  // sprite pixel (1,1) lands at (2,2); its left, top, right and bottom neighbours are the outline
  for (const [x, y] of [[1, 2], [2, 1], [5, 2], [2, 5]]) assert.equal(px(b, x, y)[3], 255, `outline at ${x},${y}`);
  assert.ok(px(b, 1, 2)[0] < 0x60, 'outline is dark');
  // pixels away from the sprite stay clear, and so do diagonal corners
  assert.equal(px(b, 0, 0)[3], 0);
  assert.equal(px(b, 7, 6)[3], 0);
  assert.equal(px(b, 1, 1)[3], 0);
});

test('bake lights the top edge and shades the bottom edge, and leaves the interior alone', () => {
  const b = bake(block());
  const base = [0xc0, 0x80, 0x40];
  const top = px(b, 3, 2);
  const mid = px(b, 3, 3);
  const bottom = px(b, 3, 5);
  assert.ok(top[0] > base[0], 'top lightened');
  assert.deepEqual(mid.slice(0, 3), base);
  assert.ok(bottom[0] < base[0], 'bottom darkened');
});

test('bake is deterministic', () => {
  const a = readPixels(bake(block()));
  const b = readPixels(bake(block()));
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('bakeFrames moves the anchors by the pad and shares baked frames', () => {
  const c = block();
  const f = bakeFrames({ idle: c, run: [c, c], w: 6, h: 6, ox: 3 });
  assert.equal(f.ox, 4);
  assert.equal(f.h, 7);
  assert.equal(f.idle.height, 7);
  assert.equal(f.run[0], f.idle);
  const boss = { idle: new Painter(2, 2).canvas, run: [], w: 80, h: 90, ox: 40 };
  assert.equal(bakeFrames(boss), boss);
});

test('lightenedCopy mixes toward white and keeps alpha', () => {
  const l = lightenedCopy(block(), 0.5);
  assert.deepEqual(px(l, 2, 2), [0xe0, 0xc0, 0xa0, 255]);
  assert.deepEqual(px(l, 0, 0), [0, 0, 0, 0]);
});
