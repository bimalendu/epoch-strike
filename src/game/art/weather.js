// Weather: a wind that sways the falling leaves, snow and petals, banks of low fog that drift across the screen, and the flicker
// and bolt of lightning in a storm. Like the ambient particles, all of it is a pure function of the world's clock (and `hash2`):
// nothing is stored, so it never touches the simulation's random stream, and a replay looks the same.
//
// A theme asks for weather with `theme.weather = { fog: colour, lightning: true }`.

import { Painter } from '../../engine/gfx.js';
import { hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { NATURE } from './scenery_nature.js';
import { flick, reducedFlashes } from './flash.js';

/**
 * How far the wind has pushed things sideways at time `t`, in px: two slow swells added together, so gusts come and go and the
 * push reverses now and then. Bounded, so a falling leaf drifts back and forth rather than away.
 */
export function windShift(t) {
  return Math.sin(t * 0.35) * 26 + Math.sin(t * 0.9 + 1.3) * 9;
}

const FOG_H = 40;
const fogCache = new Map();

/** One tileable strip of fog for a theme (cached): the same dithered banks the scenery layers use. */
export function fogStrip(themeId, color) {
  const key = `${themeId}|${color}`;
  let c = fogCache.get(key);
  if (!c) {
    const p = new Painter(VIEW_W, FOG_H);
    NATURE.fogbank(p, { c: color, y: 4, a: FOG_H - 8, seed: 41 + themeId.length, bands: 1, density: 0.6, cells: 4 });
    c = p.canvas;
    fogCache.set(key, c);
  }
  return c;
}

/** Banks of fog drifting along the ground, in front of the scenery and behind the actors. Two images. */
export function drawFog(ctx, theme, camX, time) {
  const w = theme.weather;
  if (!w || !w.fog) return;
  const img = fogStrip(theme.id, w.fog);
  const x = -Math.floor((((camX * 0.4 + time * 7) % VIEW_W) + VIEW_W) % VIEW_W);
  const y = (w.fogY ?? 176) + Math.round(Math.sin(time * 0.2) * 3);
  ctx.drawImage(img, x, y);
  ctx.drawImage(img, x + VIEW_W, y);
}

/** Seconds between one storm flash and the next window (a strike lands somewhere inside each). */
const STORM_PERIOD = 11;
const STRIKE_LENGTH = 0.36;

/** When the strike in the storm window `k` begins, in seconds. */
export function strikeTime(k) {
  return k * STORM_PERIOD + 2 + hash2(k, 3, 91) * (STORM_PERIOD - 5);
}

/** Is a lightning strike happening at `time`? Returns its progress 0..1, or -1 for none. */
export function strikeAt(time) {
  const k = Math.floor(time / STORM_PERIOD);
  const t = time - strikeTime(k);
  return t >= 0 && t < STRIKE_LENGTH ? t / STRIKE_LENGTH : -1;
}

/**
 * Lightning: a jagged white bolt out of the top of the sky and, in the first moments of a strike, a brief pale wash over
 * everything. The strike blinks twice; with the reduced-flashes option the blink slows to the safe rate and the wash is gone
 * (the bolt alone remains).
 */
export function drawLightning(ctx, theme, camX, time) {
  const w = theme.weather;
  if (!w || !w.lightning) return;
  const u = strikeAt(time);
  if (u < 0) return;
  const k = Math.floor(time / STORM_PERIOD);
  if (flick(time - strikeTime(k), 14) % 2 !== 0) return; // the second of the two blinks
  const x0 = 60 + Math.floor(hash2(k, 4, 91) * (VIEW_W - 120));
  let x = x0;
  ctx.fillStyle = '#f4f8ff';
  for (let y = 0; y < 150; y += 6) {
    const step = Math.floor(hash2(k, y, 92) * 9) - 4;
    ctx.fillRect(x, y, 2, 7);
    ctx.fillRect(Math.min(x, x + step), y + 5, Math.abs(step) + 2, 2);
    x += step;
  }
  if (!reducedFlashes()) {
    ctx.globalAlpha = 0.16 * (1 - u);
    ctx.fillStyle = '#e8f0ff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  void camX;
}
