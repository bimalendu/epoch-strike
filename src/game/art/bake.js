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

const isImage = (v) => v && typeof v === 'object' && typeof v.width === 'number' && typeof v.height === 'number' && !Array.isArray(v);

/**
 * A baked copy of an enemy frame set `{idle, run[], hot?, w, h, ox, ...}`: every image in it (`idle`, `run`, `hot` and any
 * other canvas field, such as the elephant's `rear`) is baked once, frames shared between fields stay shared, and the
 * anchors move by the pad. Boss sets (2x2 placeholders drawn per frame) are returned as they are.
 */
export function bakeFrames(f) {
  if (!f.idle || f.idle.width <= 2) return f;
  const seen = new Map();
  const one = (img) => {
    let b = seen.get(img);
    if (!b) {
      b = bake(img);
      seen.set(img, b);
    }
    return b;
  };
  const out = { ...f };
  for (const [k, v] of Object.entries(f)) {
    if (isImage(v)) out[k] = one(v);
    else if (Array.isArray(v) && v.length && v.every(isImage)) out[k] = v.map(one);
  }
  if (f.ox !== undefined) out.ox = f.ox + PAD;
  if (f.h !== undefined) out.h = f.h + PAD;
  if (f.w !== undefined) out.w = f.w + PAD * 2;
  return out;
}

/**
 * A copy of `img` turned a quarter turn (clockwise, or counter-clockwise when `ccw`) and cropped to what is visible, so a
 * body that has fallen over lies on the ground instead of floating above it. For death animations.
 */
export function turned(img, ccw = false) {
  const w = img.width;
  const h = img.height;
  const src = readPixels(img);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return canvasFromPixels(new Uint8ClampedArray(4), 1, 1);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      // clockwise: (x, y) -> (ch - 1 - y, x); counter-clockwise: (x, y) -> (y, cw - 1 - x); the result is ch wide, cw tall
      const nx = ccw ? y : ch - 1 - y;
      const ny = ccw ? cw - 1 - x : x;
      const o = (ny * ch + nx) * 4;
      const i = ((y + y0) * w + x + x0) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = src[i + 3];
    }
  }
  return canvasFromPixels(out, ch, cw);
}
