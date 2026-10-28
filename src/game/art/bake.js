// Sprite baking: a pixel pass that gives a finished sprite a dark outline and top-left lighting.
//
// Painters draw flat rectangles; `bake` runs once per cached frame (never during play) and adds what rectangles can't:
//   - an outline on every transparent pixel that touches the sprite, in the neighbour's colour darkened toward ink;
//   - light from the top left: an edge facing up lightens, an edge facing down or right darkens.
// The result is 1 px wider on each side and 1 px taller at the top. The bottom is not padded, so a sprite's feet stay on
// the floor row; `bakeFrames` shifts a frame set's anchors (`ox`, `h`) by the pad so blits land in the same place.

import { readPixels, canvasFromPixels } from '../../engine/gfx.js';

export const PAD = 1;

const INK = [18, 14, 24];
const DARKEN = 0.3; // outline = neighbour * DARKEN, then mixed with ink
const INK_MIX = 0.5;
const LIT = 0.15; // top edge
const SHADED = 0.12; // bottom and right edges

/**
 * A baked copy of `img` (w + 2 by h + 1). Pure: the same input gives the same pixels.
 * @param {{outline?: boolean, light?: boolean}} [opt]
 */
export function bake(img, { outline = true, light = true } = {}) {
  const sw = img.width;
  const sh = img.height;
  const w = sw + PAD * 2;
  const h = sh + PAD;
  const src = readPixels(img);
  const out = new Uint8ClampedArray(w * h * 4);

  const opaque = (x, y) => x >= 0 && y >= 0 && x < sw && y < sh && src[(y * sw + x) * 4 + 3] > 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      if (src[i + 3] === 0) continue;
      const o = ((y + PAD) * w + x + PAD) * 4;
      let k = 0;
      if (light) {
        if (!opaque(x, y - 1)) k = LIT;
        else if (!opaque(x, y + 1) || !opaque(x + 1, y)) k = -SHADED;
      }
      for (let c = 0; c < 3; c++) {
        const v = src[i + c];
        out[o + c] = k >= 0 ? v + (255 - v) * k : v * (1 + k);
      }
      out[o + 3] = src[i + 3];
    }
  }

  if (outline) {
    const dirs = [[0, 1], [-1, 0], [1, 0], [0, -1]];
    for (let y = -PAD; y < sh; y++) {
      for (let x = -PAD; x < sw + PAD; x++) {
        if (opaque(x, y)) continue;
        const o = ((y + PAD) * w + x + PAD) * 4;
        if (out[o + 3] > 0) continue;
        for (const [dx, dy] of dirs) {
          if (!opaque(x + dx, y + dy)) continue;
          const n = ((y + dy) * sw + x + dx) * 4;
          for (let c = 0; c < 3; c++) out[o + c] = src[n + c] * DARKEN * (1 - INK_MIX) + INK[c] * INK_MIX;
          out[o + 3] = 255;
          break;
        }
      }
    }
  }
  return canvasFromPixels(out, w, h);
}

/**
 * A baked copy of an enemy frame set `{idle, run[], hot?, w, h, ox, ...}`: every frame is baked once (frames shared between
 * fields stay shared) and the anchors move by the pad. Boss sets (2x2 placeholders drawn per frame) are returned as they are.
 */
export function bakeFrames(f) {
  if (!f.idle || f.idle.width <= 2) return f;
  const seen = new Map();
  const one = (img) => {
    if (!img) return img;
    let b = seen.get(img);
    if (!b) {
      b = bake(img);
      seen.set(img, b);
    }
    return b;
  };
  const out = { ...f, idle: one(f.idle), run: (f.run || []).map(one) };
  if (f.hot) out.hot = one(f.hot);
  out.ox = f.ox + PAD;
  out.h = f.h + PAD;
  out.w = f.w + PAD * 2;
  return out;
}
