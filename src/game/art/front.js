// The foreground: thin silhouettes of grass, ferns, rocks, rubble or cables along the bottom edge of the screen, drawn over the
// actors to give the picture depth. They scroll faster than the camera (1.25x), are painted once per theme into a cached strip,
// and are drawn as a dither, which reads as translucent without any alpha. They never cover the play: they are at most
// FRONT_H px tall, and they fade out (and then vanish) as the soldier's feet come within FADE_FROM px of the bottom edge.
//
// A theme asks for one with `theme.front = { kind, c }`; `kind` is one of FRONT_KINDS.

import { Painter } from '../../engine/gfx.js';
import { hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { shade } from './common.js';
import { dithered } from './scenery_nature.js';

export const FRONT_H = 18;
export const FRONT_SPEED = 1.25;
const FADE_FROM = 70; // px above the bottom edge where the soldier's feet start to thin the foreground
const HIDE_BELOW = 40; // and where it is gone

const h = (i, seed) => hash2(i, seed, 313);

/** Blades: tufts of tall grass at irregular spacing. */
function blades(p, c, seed) {
  for (let x = 0; x < VIEW_W; x += 3) {
    if (h(x, seed) < 0.35) continue;
    const ht = 6 + Math.floor(h(x, seed + 1) * (FRONT_H - 6));
    const lean = Math.floor(h(x, seed + 2) * 5) - 2;
    p.rect(x, FRONT_H - ht, 1, ht, c);
    p.rect(x + Math.sign(lean), FRONT_H - ht - 1, 1, 2, c);
    if (ht > 12) p.rect(x + lean, FRONT_H - ht - 2, 1, 2, shade(c, 0.12));
  }
}

/** Fern fronds: a stem with leaflets stepping out on both sides. */
function ferns(p, c, seed) {
  for (let i = 0; i < 9; i++) {
    const x = Math.floor((i + h(i, seed) * 0.7) * (VIEW_W / 9));
    const ht = 10 + Math.floor(h(i, seed + 1) * 8);
    p.rect(x, FRONT_H - ht, 1, ht, c);
    for (let y = 0; y < ht - 2; y += 3) {
      const len = Math.max(2, Math.floor(((ht - y) / ht) * 6));
      p.rect(x - len, FRONT_H - ht + y + 2, len, 1, c);
      p.rect(x + 1, FRONT_H - ht + y + 3, len, 1, shade(c, 0.1));
    }
  }
}

/** Rounded boulders and slabs of rock along the foot of the picture. */
function rocks(p, c, seed) {
  for (let i = 0; i < 10; i++) {
    const x = Math.floor((i + h(i, seed) * 0.6) * (VIEW_W / 10));
    const w = 10 + Math.floor(h(i, seed + 1) * 18);
    const ht = 5 + Math.floor(h(i, seed + 2) * 9);
    for (let row = 0; row < ht; row++) {
      const inset = Math.floor(Math.pow(1 - row / ht, 2) * w * 0.3);
      p.rect(x + inset, FRONT_H - row - 1, w - inset * 2, 1, row === ht - 1 ? shade(c, 0.12) : c);
    }
  }
}

/** Broken masonry and twisted metal: angular chunks, with a stick or two sticking up. */
function rubble(p, c, seed) {
  for (let i = 0; i < 12; i++) {
    const x = Math.floor((i + h(i, seed) * 0.6) * (VIEW_W / 12));
    const w = 6 + Math.floor(h(i, seed + 1) * 14);
    const ht = 3 + Math.floor(h(i, seed + 2) * 8);
    for (let row = 0; row < ht; row++) p.rect(x + Math.floor(row * 0.6), FRONT_H - row - 1, w - Math.floor(row * 0.9), 1, c);
    if (h(i, seed + 3) < 0.5) p.rect(x + Math.floor(w * 0.5), FRONT_H - ht - 5, 1, 6, c);
  }
}

/** Overhead cables looping between poles: the poles rise out of the bottom edge and the wires sag between them. */
function cables(p, c, seed) {
  const gap = 96;
  for (let x = 12; x < VIEW_W; x += gap) {
    p.rect(x, 2, 2, FRONT_H - 2, c);
    p.rect(x - 3, 2, 8, 1, c);
    for (let k = 1; k < gap; k++) {
      const sag = Math.round(Math.sin((k / gap) * Math.PI) * 5);
      p.rect((x + k) % VIEW_W, 3 + sag, 1, 1, c);
    }
  }
  void seed;
}

/** Drifts of snow along the bottom edge. */
function drifts(p, c, seed) {
  for (let x = 0; x < VIEW_W; x++) {
    const ht = Math.round(5 + Math.sin(x * 0.07 + seed) * 3 + Math.sin(x * 0.19) * 1.5);
    p.rect(x, FRONT_H - ht, 1, ht, c);
  }
}

export const FRONT_KINDS = { grass: blades, ferns, rocks, rubble, cables, drifts };

const cache = new Map();

/**
 * A painter that draws only the pixels the ordered dither lets through at `coverage`: whatever is painted through it comes out
 * thinned, which looks translucent without using alpha (and without reading pixels back, which a browser canvas cannot do here).
 */
function thinned(p, coverage) {
  return {
    rect(x, y, w, hh, color) {
      for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + w; xx++) if (dithered(xx, yy, coverage)) p.rect(xx, yy, 1, 1, color);
    },
  };
}

/** A theme's foreground at a coverage (0..1): a dither of its silhouettes (cached per theme and coverage). */
export function frontStrip(themeId, front, coverage) {
  const key = `${themeId}|${coverage}`;
  let c = cache.get(key);
  if (!c) {
    const p = new Painter(VIEW_W, FRONT_H);
    FRONT_KINDS[front.kind](coverage >= 1 ? p : thinned(p, coverage), front.c, themeId.length * 7 + 3);
    c = p.canvas;
    cache.set(key, c);
  }
  return c;
}

/**
 * How much of the foreground to show for a soldier whose feet are at screen height `feetY`: all of it (as a dither) when they are
 * well up the screen, thinner as they come down, none when they are near the bottom edge.
 */
export function frontCoverage(feetY) {
  const fromBottom = VIEW_H - feetY;
  if (fromBottom <= HIDE_BELOW) return 0;
  if (fromBottom >= FADE_FROM) return 0.7;
  return 0.3;
}

/** Draw the foreground strip, scrolled at 1.25x the camera. Two images at most. */
export function drawFront(ctx, theme, camX, feetY) {
  const front = theme.front;
  if (!front) return;
  const coverage = frontCoverage(feetY);
  if (coverage <= 0) return;
  const img = frontStrip(theme.id, front, coverage);
  const x = -Math.floor((((camX * FRONT_SPEED) % VIEW_W) + VIEW_W) % VIEW_W);
  ctx.drawImage(img, x, VIEW_H - FRONT_H);
  ctx.drawImage(img, x + VIEW_W, VIEW_H - FRONT_H);
}
