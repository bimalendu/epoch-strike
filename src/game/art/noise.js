// One-dimensional noise for the parallax scenery. Every function returns an array of VIEW_W values that wraps: the value
// after the last column is the first column's, so a layer tiles across the screen with no seam.

import { hash2 } from '../../engine/rng.js';
import { VIEW_W } from '../constants.js';

const W = VIEW_W;

/** Smooth value noise, `cells` lumps wide at the base, summed over `octaves` (each twice as fine and half as strong). Values 0..1. */
export function wrapNoise(seed, cells, octaves = 2) {
  const out = new Float32Array(W);
  for (let o = 0; o < octaves; o++) {
    const n = cells * (1 << o);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(hash2(i, o, seed));
    const amp = 1 / (1 << o);
    for (let x = 0; x < W; x++) {
      const f = (x / W) * n;
      const i = Math.floor(f);
      const t = f - i;
      const s = t * t * (3 - 2 * t);
      out[x] += (pts[i % n] * (1 - s) + pts[(i + 1) % n] * s) * amp;
    }
  }
  const norm = 2 - 1 / (1 << (octaves - 1));
  for (let x = 0; x < W; x++) out[x] /= norm;
  return out;
}

/**
 * Ridged noise: each octave is folded about its middle so the crests are sharp and the valleys round, which is what mountains
 * look like. Values 0..1, with the peaks near 1.
 */
export function ridged(seed, cells, octaves = 3) {
  const out = new Float32Array(W);
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = wrapNoise(seed + o * 31, cells * (1 << o), 1);
    const amp = 1 / (1 << o);
    total += amp;
    for (let x = 0; x < W; x++) {
      const f = 1 - Math.abs(layer[x] * 2 - 1);
      out[x] += f * f * amp; // squared: narrower, sharper crests
    }
  }
  for (let x = 0; x < W; x++) out[x] /= total;
  return out;
}

/** Read `arr` at a fractional, wrapping position. */
export function sampleWrap(arr, x) {
  const f = ((x % W) + W) % W;
  const i = Math.floor(f);
  const t = f - i;
  return arr[i] * (1 - t) + arr[(i + 1) % W] * t;
}

/** Domain warp: read `arr` at positions pushed sideways by a second noise, `amount` px at most, so features lean and fold. */
export function warped(arr, seed, amount = 24, cells = 4) {
  const w = wrapNoise(seed + 97, cells, 2);
  const out = new Float32Array(W);
  for (let x = 0; x < W; x++) out[x] = sampleWrap(arr, x + (w[x] - 0.5) * 2 * amount);
  return out;
}

/** Wrapping box blur of radius `r` columns. */
export function smooth(arr, r = 1) {
  const out = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += arr[(x + k + W) % W];
    out[x] = sum / (2 * r + 1);
  }
  return out;
}

/**
 * A cheap erosion pass: `count` narrow V-shaped gullies cut into the heights (0..1), each up to `depth` deep and about
 * `width` columns wide, the way rain cuts channels down a slope. The input array is not changed.
 */
export function gullies(arr, seed, count = 10, depth = 0.18, width = 5) {
  const out = Float32Array.from(arr);
  for (let i = 0; i < count; i++) {
    const c = Math.floor(hash2(i, 7, seed) * W);
    const w = width * (0.6 + hash2(i, 8, seed) * 0.8);
    const d = depth * (0.5 + hash2(i, 9, seed) * 0.5);
    for (let k = -Math.ceil(w); k <= Math.ceil(w); k++) {
      const cut = d * Math.max(0, 1 - Math.abs(k) / w);
      const x = (c + k + W) % W;
      out[x] = Math.max(0, out[x] - cut * out[x]);
    }
  }
  return out;
}

/** Quantise heights (0..1) into `steps` flat terraces, with each tread `soft` of a step sloping into the next: canyon walls and mesas. */
export function terraced(arr, steps = 5, soft = 0.25) {
  const out = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const f = arr[x] * steps;
    const i = Math.floor(f);
    const t = f - i;
    const ease = t < 1 - soft ? 0 : (t - (1 - soft)) / soft;
    out[x] = (i + ease) / steps;
  }
  return out;
}
