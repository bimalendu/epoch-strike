// Living things in the picture: flocks of birds, pterosaurs, bats, gulls and crows crossing the sky, fish leaping out of a lake,
// fireflies blinking over the ground, and the shimmer of falling water on a waterfall.
//
// None of them is simulated. Each is a pure function of the world's clock, the camera and `hash2`, the same way the ambient
// particles are, so nothing is stored, nothing touches the gameplay random stream, and a replay looks the same. They are all drawn
// live with a handful of rectangles each (at most MAX_CALLS canvas calls a frame in all, which a test checks), and not at all at
// low effects quality (the renderer skips them).
//
// A theme lists what lives there: `theme.life = ['birds', 'fish', ...]` (kinds are keys of CREATURES, 'fireflies' and 'fish' are
// handled on their own). Waterfalls shimmer whenever a theme has a 'waterfall' layer.

import { hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { flick } from './flash.js';
import { fallRect } from './scenery_nature.js';

/** The most canvas calls the life of one frame may make. */
export const MAX_CALLS = 100;

const WRAP = VIEW_W + 80; // creatures fly across this much and wrap, so they are off screen when they do

/** Where a creature is: it flies along at `speed` px/s (negative: leftward), anchored to the sky with parallax `par`. */
function flightX(slot, time, camX, speed, par) {
  const x0 = hash2(slot, 1, 7) * WRAP;
  return ((((x0 + time * speed - camX * par) % WRAP) + WRAP) % WRAP) - 40;
}

const rect = (ctx, x, y, w, h) => ctx.fillRect(Math.round(x), Math.round(y), w, h);

// ---- sprites: each is a few rectangles, drawn with ctx.fillStyle already set ----
const SPRITES = {
  /** A small bird: two wings and a body, the wings up or down. */
  bird(ctx, x, y, flap) {
    rect(ctx, x - 1, y, 3, 1);
    if (flap) {
      rect(ctx, x - 3, y - 1, 2, 1);
      rect(ctx, x + 2, y - 1, 2, 1);
    } else {
      rect(ctx, x - 3, y + 1, 2, 1);
      rect(ctx, x + 2, y + 1, 2, 1);
    }
  },
  /** A pterosaur: long wings with a bend in them, a crested head and a short tail. */
  pterosaur(ctx, x, y, flap, dir) {
    rect(ctx, x - 3, y, 7, 2); // body
    rect(ctx, x + 4 * dir - (dir < 0 ? 2 : 0), y - 1, 3, 2); // head
    rect(ctx, x + 6 * dir - (dir < 0 ? 1 : 0), y, 2, 1); // beak
    rect(ctx, x + (dir > 0 ? 3 : -3), y - 3, 1, 2); // crest
    rect(ctx, x - 4 * dir, y + 1, 3, 1); // tail
    if (flap) {
      rect(ctx, x - 9, y - 4, 6, 1);
      rect(ctx, x - 13, y - 6, 5, 1);
      rect(ctx, x + 2, y - 4, 6, 1);
      rect(ctx, x + 8, y - 6, 5, 1);
    } else {
      rect(ctx, x - 9, y + 2, 6, 1);
      rect(ctx, x - 13, y + 4, 5, 1);
      rect(ctx, x + 2, y + 2, 6, 1);
      rect(ctx, x + 8, y + 4, 5, 1);
    }
  },
  /** A bat: a body and two scalloped wings. */
  bat(ctx, x, y, flap) {
    rect(ctx, x - 1, y, 2, 2);
    rect(ctx, x - 1, y - 1, 1, 1);
    rect(ctx, x, y - 1, 1, 1);
    if (flap) {
      rect(ctx, x - 5, y - 2, 4, 1);
      rect(ctx, x + 1, y - 2, 4, 1);
      rect(ctx, x - 6, y - 1, 1, 2);
      rect(ctx, x + 5, y - 1, 1, 2);
    } else {
      rect(ctx, x - 5, y + 1, 4, 1);
      rect(ctx, x + 1, y + 1, 4, 1);
      rect(ctx, x - 6, y, 1, 2);
      rect(ctx, x + 5, y, 1, 2);
    }
  },
  /** A gull: long bent wings, in the shape of an M when they are up. */
  gull(ctx, x, y, flap) {
    rect(ctx, x - 1, y, 3, 1);
    if (flap) {
      rect(ctx, x - 4, y - 2, 3, 1);
      rect(ctx, x + 2, y - 2, 3, 1);
      rect(ctx, x - 5, y - 1, 1, 1);
      rect(ctx, x + 5, y - 1, 1, 1);
    } else {
      rect(ctx, x - 4, y, 3, 1);
      rect(ctx, x + 2, y, 3, 1);
      rect(ctx, x - 5, y + 1, 1, 1);
      rect(ctx, x + 5, y + 1, 1, 1);
    }
  },
};

/**
 * What lives in the sky. `group` flies in a loose V, `solo` creatures fly alone; `speed` is px/s, `par` the parallax against
 * the camera, `band` the heights (px from the top) they fly at, `rate` how fast the wings beat, `wobble` how much they bob, and `color` the silhouette.
 */
const CREATURES = {
  birds: { sprite: 'bird', group: 5, solo: 1, speed: 16, par: 0.06, band: [30, 100], rate: 5, wobble: 2, color: '#2a3a44' },
  gulls: { sprite: 'gull', group: 0, solo: 4, speed: 20, par: 0.08, band: [60, 130], rate: 3, wobble: 5, color: '#f4f4f0' },
  crows: { sprite: 'bird', group: 3, solo: 1, speed: 24, par: 0.07, band: [40, 110], rate: 7, wobble: 3, color: '#14141a' },
  pterosaurs: { sprite: 'pterosaur', group: 0, solo: 2, speed: 28, par: 0.08, band: [40, 100], rate: 2, wobble: 6, color: '#3a4a3c' },
  bats: { sprite: 'bat', group: 0, solo: 5, speed: 12, par: 0.12, band: [20, 150], rate: 9, wobble: 14, color: '#1a1424' },
};

/** The sky creatures of a theme, drawn behind the terrain. */
function drawCreatures(ctx, kind, time, camX) {
  const c = CREATURES[kind];
  if (!c) return;
  ctx.fillStyle = c.color;
  const sprite = SPRITES[c.sprite];
  const dirOf = (slot) => (hash2(slot, 9, 7) < 0.5 ? -1 : 1);
  const yOf = (slot, t) => c.band[0] + hash2(slot, 2, 7) * (c.band[1] - c.band[0]) + Math.sin(t * (0.6 + hash2(slot, 3, 7) * 0.8) + slot) * c.wobble;
  // a group flies as a V behind its leader
  for (let g = 0; g < (c.group ? 1 : 0); g++) {
    const dir = dirOf(100 + g);
    const lx = flightX(100 + g, time, camX, c.speed * dir, c.par);
    const ly = yOf(100 + g, time);
    for (let k = 0; k < c.group; k++) {
      const rank = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      sprite(ctx, lx - dir * rank * 6, ly + side * rank * 3, flick(time + k * 0.17, c.rate) % 2 === 0, dir);
    }
  }
  for (let i = 0; i < c.solo; i++) {
    const dir = dirOf(i);
    sprite(ctx, flightX(i, time, camX, c.speed * dir * (0.8 + hash2(i, 4, 7) * 0.5), c.par), yOf(i, time), flick(time + i * 0.31, c.rate) % 2 === 0, dir);
  }
}

// ---- things tied to a layer ----
/** The x offset a parallax layer is drawn at (the same sum `drawParallax` uses), so things on it move with it. */
function layerOffset(layer, camX) {
  const speed = layer.s || 0.1;
  let x = -Math.floor((camX * speed) % VIEW_W);
  if (x > 0) x -= VIEW_W;
  return x;
}

/** Fish leaping out of a lake: each arcs up and splashes back every few seconds, drawn on the lake layer's own scroll. */
function drawFish(ctx, theme, time, camX) {
  const lake = theme.layers.find((l) => l.k === 'lake');
  if (!lake) return;
  const x0 = layerOffset(lake, camX);
  ctx.fillStyle = '#e8f4ff';
  for (let i = 0; i < 2; i++) {
    const period = 6 + hash2(i, 1, 21) * 5;
    const t = (time + hash2(i, 2, 21) * period) % period;
    if (t > 0.9) continue;
    const u = t / 0.9;
    const px = Math.floor(hash2(Math.floor((time + hash2(i, 2, 21) * period) / period), i, 22) * VIEW_W);
    const x = px + Math.round(u * 16);
    const y = lake.y + 4 - Math.round(Math.sin(u * Math.PI) * 13);
    for (const dx of [x0, x0 + VIEW_W]) {
      rect(ctx, x + dx, y, 3, 2);
      rect(ctx, x + dx - (u < 0.5 ? 1 : -3), y - (u < 0.5 ? 1 : -1), 1, 1); // the tail
    }
    if (u < 0.2 || u > 0.8) {
      ctx.fillStyle = '#ffffff';
      for (const dx of [x0, x0 + VIEW_W]) rect(ctx, (u < 0.5 ? px : px + 16) + dx - 2, lake.y + 3, 5, 1); // the splash
      ctx.fillStyle = '#e8f4ff';
    }
  }
}

/** The shimmer of falling water: pale streaks sliding down the waterfall, over exactly the rectangle its layer painted. */
function drawShimmer(ctx, theme, time, camX) {
  for (const layer of theme.layers) {
    if (layer.k !== 'waterfall') continue;
    const x0 = layerOffset(layer, camX);
    const f = fallRect(layer);
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < f.w; s += 3) {
      const speed = 38 + hash2(s, 5, 23) * 30;
      const y = (time * speed + hash2(s, 6, 23) * f.h) % f.h;
      if (y > f.h - 5) continue;
      for (const dx of [x0, x0 + VIEW_W]) rect(ctx, f.x + dx + s, f.y + y, 1, 4);
    }
  }
}

/** Everything that lives behind the terrain: creatures in the sky, fish in the lake, falling water. */
export function drawLifeBack(ctx, theme, time, camX) {
  const life = theme.life;
  if (life) {
    for (const kind of life) {
      if (kind === 'fish') drawFish(ctx, theme, time, camX);
      else if (kind !== 'fireflies') drawCreatures(ctx, kind, time, camX);
    }
  }
  drawShimmer(ctx, theme, time, camX);
}

/** Fireflies drift and blink in front of the terrain, close to the ground, scrolling with the world a little slower than the camera. */
export function drawLifeFront(ctx, theme, time, camX) {
  if (!theme.life || !theme.life.includes('fireflies')) return;
  for (let i = 0; i < 12; i++) {
    const x = ((((hash2(i, 1, 31) * VIEW_W * 1.5 + Math.sin(time * 0.5 + i * 2) * 14 - camX * 0.85) % VIEW_W) + VIEW_W) % VIEW_W);
    const y = 150 + hash2(i, 2, 31) * 70 + Math.sin(time * 0.8 + i * 1.7) * 8;
    if (flick(time + hash2(i, 3, 31) * 4, 3) % 3 === 0) continue; // dark between blinks
    ctx.fillStyle = '#fff6a0';
    rect(ctx, x, y, 1, 1);
    if (flick(time + hash2(i, 3, 31) * 4, 3) % 3 === 1) {
      ctx.fillStyle = '#b8c860';
      rect(ctx, x - 1, y, 3, 1);
      rect(ctx, x, y - 1, 1, 3);
    }
  }
  void VIEW_H;
}
