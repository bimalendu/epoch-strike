// Hit flash: an enemy or boss that was just shot turns white for a few frames.
//
// Sprites are flashed with a cached white copy of the frame (`lightenedCopy`). Painters that draw rectangles every frame
// (bosses, turrets that aim) get `flashCtx`: the same canvas subset, but every colour is mixed toward white and every
// image is swapped for its white copy. Both are art only; the simulation only ever sets `e.flash`.

import { lightenedCopy } from '../../engine/gfx.js';
import { shade } from './common.js';
import { reducedFlashes } from './flash.js';

const SPRITE_MIX = 0.8; // how white a flashed sprite goes
const BOSS_MIX = 0.5; // bosses read their weak points by colour, so a boss only brightens
const SOFT = 0.5; // reduced flashes: half as white
const SOFT_OVERLAY = 0.45; // ... and a sprite is its own colours with the white copy faded over it
const FULL = 0.06; // seconds of `e.flash` left while the flash is at full strength (a hit sets 0.12, a boss hit 0.08)
const BOSS_FULL = 0.04;

const copies = new WeakMap();

/** The white copy of a sprite, painted on first use (`warmHitFrames` paints them while the title screen is up). */
export function hitImage(img) {
  let c = copies.get(img);
  if (!c) {
    c = lightenedCopy(img, SPRITE_MIX);
    copies.set(img, c);
  }
  return c;
}

/** Paint the white copies of an enemy's frame set now. */
export function warmHitFrames(f) {
  for (const img of [f.idle, ...(f.run || []), f.hot]) if (img && img.width > 2) hitImage(img);
}

/** How white to draw `e` this frame: 0 when it has not just been hit. */
export function hitMix(e) {
  if (!(e.flash > 0)) return 0;
  const mix = e.def.boss ? (e.flash > BOSS_FULL ? BOSS_MIX : 0) : e.flash > FULL ? SPRITE_MIX : 0;
  return reducedFlashes() ? mix * SOFT : mix;
}

const colours = new Map();
function lighten(col, amt) {
  if (typeof col !== 'string' || col.length !== 7 || col[0] !== '#') return col;
  const key = col + amt;
  let c = colours.get(key);
  if (!c) {
    c = shade(col, amt);
    colours.set(key, c);
  }
  return c;
}

/** A canvas context that draws everything lighter. One shared instance: painters never nest. */
class LightCtx {
  constructor() {
    this.t = null;
    this.amt = 0;
    this.soft = false;
  }
  set fillStyle(v) { this.t.fillStyle = lighten(v, this.amt); }
  get fillStyle() { return this.t.fillStyle; }
  set globalAlpha(v) { this.t.globalAlpha = v; }
  get globalAlpha() { return this.t.globalAlpha; }
  fillRect(x, y, w, h) { this.t.fillRect(x, y, w, h); }
  drawImage(img, ...a) {
    if (img.width <= 2) {
      this.t.drawImage(img, ...a);
    } else if (this.soft) {
      // reduced flashes: the sprite as it is, with its white copy faded over the top
      const g = this.t.globalAlpha;
      this.t.drawImage(img, ...a);
      this.t.globalAlpha = g * SOFT_OVERLAY;
      this.t.drawImage(hitImage(img), ...a);
      this.t.globalAlpha = g;
    } else {
      this.t.drawImage(hitImage(img), ...a);
    }
  }
  save() { this.t.save(); }
  restore() { this.t.restore(); }
  translate(x, y) { this.t.translate(x, y); }
  scale(x, y) { this.t.scale(x, y); }
}
const light = new LightCtx();

/** `ctx` itself, or a whitened view of it while `e` is flashing. Painters start with `ctx = flashCtx(ctx, e)`. */
export function flashCtx(ctx, e) {
  const amt = hitMix(e);
  if (!amt) return ctx;
  light.t = ctx;
  light.amt = amt;
  light.soft = reducedFlashes();
  return light;
}
