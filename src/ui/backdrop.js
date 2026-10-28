// Shared animated backdrop for the title, menus and results: a night sky with stars, a pulsing time rift
// and the five eras as tiny silhouettes along the horizon.

import { VIEW_W, VIEW_H } from '../game/constants.js';
import { hash2 } from '../engine/rng.js';

const BANDS = ['#0a0a1e', '#0e0c26', '#130e2e', '#1a1036', '#22123a', '#2c143e', '#3a1642', '#4a1a44'];

function stars(ctx, t) {
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash2(i, 1) * VIEW_W);
    const y = Math.floor(hash2(i, 2) * (VIEW_H - 70));
    const tw = Math.sin(t * 2 + i) > 0.6 ? '#ffffff' : '#7a7aa0';
    ctx.fillStyle = tw;
    ctx.fillRect(x, y, 1, 1);
  }
}

function rift(ctx, t) {
  const cx = VIEW_W / 2;
  const cy = 92;
  for (let i = 0; i < 5; i++) {
    const r = 26 + i * 10 + Math.sin(t * 1.6 + i) * 3;
    ctx.globalAlpha = 0.16 - i * 0.025;
    ctx.fillStyle = i % 2 ? '#ff4aa8' : '#4ac8ff';
    ctx.fillRect(Math.round(cx - r * 1.5), Math.round(cy - r * 0.45), Math.round(r * 3), Math.round(r * 0.9));
    ctx.fillRect(Math.round(cx - r * 0.45), Math.round(cy - r), Math.round(r * 0.9), Math.round(r * 2));
  }
  ctx.globalAlpha = 1;
}

// tiny silhouettes, one per era group (drawn with rects only), base on y
function dino(ctx, x, y) {
  ctx.fillRect(x, y - 8, 12, 5);
  ctx.fillRect(x + 8, y - 13, 6, 6);
  ctx.fillRect(x + 12, y - 12, 4, 3);
  ctx.fillRect(x - 6, y - 6, 7, 3);
  ctx.fillRect(x + 2, y - 3, 3, 3);
  ctx.fillRect(x + 8, y - 3, 3, 3);
}
function pyramid(ctx, x, y) {
  for (let i = 0; i < 9; i++) ctx.fillRect(x + i, y - 2 - i * 2, 20 - i * 2, 2);
}
function castle(ctx, x, y) {
  ctx.fillRect(x, y - 14, 5, 14);
  ctx.fillRect(x + 15, y - 14, 5, 14);
  ctx.fillRect(x + 5, y - 9, 10, 9);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + i * 2, y - 17, 1, 3);
    ctx.fillRect(x + 15 + i * 2, y - 17, 1, 3);
  }
}
function factory(ctx, x, y) {
  ctx.fillRect(x, y - 10, 20, 10);
  ctx.fillRect(x + 3, y - 20, 4, 10);
  ctx.fillRect(x + 12, y - 16, 4, 6);
}
function tower(ctx, x, y) {
  ctx.fillRect(x, y - 22, 6, 22);
  ctx.fillRect(x + 8, y - 14, 6, 14);
  ctx.fillRect(x + 16, y - 18, 5, 18);
  ctx.fillRect(x + 2, y - 26, 2, 4);
}

export function drawBackdrop(ctx, t = 0, { rifts = true, horizon = true } = {}) {
  const h = Math.ceil(VIEW_H / BANDS.length);
  for (let i = 0; i < BANDS.length; i++) {
    ctx.fillStyle = BANDS[i];
    ctx.fillRect(0, i * h, VIEW_W, h);
  }
  stars(ctx, t);
  if (rifts) rift(ctx, t);
  if (horizon) {
    ctx.fillStyle = '#0b0714';
    ctx.fillRect(0, VIEW_H - 24, VIEW_W, 24);
    const eras = [dino, pyramid, castle, factory, tower];
    const step = VIEW_W / eras.length;
    eras.forEach((fn, i) => fn(ctx, Math.round(step * i + step / 2 - 10), VIEW_H - 24));
  }
}
