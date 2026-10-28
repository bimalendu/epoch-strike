// The sky: a theme's colour bands, blended into each other with a 4x4 Bayer dither instead of hard steps.
// Built once per theme into a 480x270 canvas, so drawing the sky is one drawImage.

import { Painter } from '../../engine/gfx.js';
import { VIEW_W, VIEW_H } from '../constants.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cache = new Map();

/** A 4 px wide strip of the sky (the dither pattern repeats every 4 px, so the strip tiles across the screen). */
function strip(bands) {
  const n = bands.length;
  const h = Math.ceil(VIEW_H / n);
  const z = Math.max(2, Math.round(h / 4)); // rows of blend either side of a band edge
  const p = new Painter(4, VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    const i = Math.min(n - 1, Math.floor(y / h));
    const next = (i + 1) * h; // where the next band starts
    if (i < n - 1 && y >= next - z) {
      // approaching the next band: more and more of its pixels
      const t = (y - (next - z) + 0.5) / (2 * z);
      for (let x = 0; x < 4; x++) p.rect(x, y, 1, 1, t > (BAYER[(y & 3) * 4 + x] + 0.5) / 16 ? bands[i + 1] : bands[i]);
    } else if (i > 0 && y < i * h + z) {
      // just past the edge: the rest of the blend
      const t = (y - (i * h - z) + 0.5) / (2 * z);
      for (let x = 0; x < 4; x++) p.rect(x, y, 1, 1, t > (BAYER[(y & 3) * 4 + x] + 0.5) / 16 ? bands[i] : bands[i - 1]);
    } else {
      p.rect(0, y, 4, 1, bands[i]);
    }
  }
  return p.canvas;
}

/** The sky of a theme as one canvas (cached by theme id). */
export function skyCanvas(theme) {
  const key = theme.id || theme.sky.join();
  let c = cache.get(key);
  if (!c) {
    const s = strip(theme.sky);
    const p = new Painter(VIEW_W, VIEW_H);
    for (let x = 0; x < VIEW_W; x += 4) p.ctx.drawImage(s, x, 0);
    c = p.canvas;
    cache.set(key, c);
  }
  return c;
}

export function clearSkyCache() {
  cache.clear();
}
