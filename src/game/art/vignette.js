// Screen-edge darkening (one cached overlay) and the red flash of a hit, which is the same shape in red.

import { Painter } from '../../engine/gfx.js';
import { VIEW_W, VIEW_H } from '../constants.js';

// elliptical distance from the centre at which each step of darkness starts: many faint steps, so no edge shows
const RINGS = Array.from({ length: 24 }, (_, i) => 0.5 + i * 0.04);
const cache = new Map();

function build(col, alpha) {
  const p = new Painter(VIEW_W, VIEW_H);
  p.ctx.globalAlpha = alpha;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  for (let y = 0; y < VIEW_H; y++) {
    const dy = ((y + 0.5 - cy) / cy) ** 2;
    for (const t of RINGS) {
      if (t <= dy) {
        p.rect(0, y, VIEW_W, 1, col);
        continue;
      }
      const half = Math.round(cx * Math.sqrt(t - dy));
      if (half >= cx) continue;
      p.rect(0, y, cx - half, 1, col);
      p.rect(cx + half, y, cx - half, 1, col);
    }
  }
  p.ctx.globalAlpha = 1;
  return p.canvas;
}

function get(name) {
  let c = cache.get(name);
  if (!c) {
    c = name === 'red' ? build('#d01010', 0.025) : build('#000000', 0.011);
    cache.set(name, c);
  }
  return c;
}

/** Paint one of the two overlays now ('dark' or 'red'); each is its own warm-up task because they are a few ms apiece. */
export function warmVignette(name = 'dark') {
  get(name);
}

export function drawVignette(ctx) {
  ctx.drawImage(get('dark'), 0, 0);
}

/** The red edge flash after a death: `k` runs 0 (just hit) .. 1 (gone). */
export function drawHurt(ctx, k) {
  ctx.globalAlpha = Math.max(0, 1 - k);
  ctx.drawImage(get('red'), 0, 0);
  ctx.globalAlpha = 1;
}
