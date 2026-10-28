// Frame-cost probe for tests and `npm run perf`. Wall-clock time in Node says little about a browser, so the guard is
// built on counts that do carry over: how many canvas calls a frame makes and whether a frame creates canvases (a
// canvas made inside a draw function is the classic cause of GC stutter; every sprite must come from a cache).

import { setCanvasFactory } from '../src/engine/gfx.js';
import { SoftCanvas } from './softcanvas.js';
import { renderWorld } from '../src/game/render.js';
import { drawHud } from '../src/game/art/hud.js';

/** A context wrapper that counts calls by kind. */
export function countingCtx(ctx) {
  const n = { fillRect: 0, drawImage: 0, other: 0, total: 0 };
  const proxy = new Proxy(ctx, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      return (...args) => {
        const kind = prop === 'fillRect' || prop === 'drawImage' ? prop : 'other';
        n[kind]++;
        n.total++;
        return v.apply(target, args);
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: proxy, counts: n };
}

/** Count canvases created while `fn` runs. */
export function countCanvases(fn) {
  let made = 0;
  setCanvasFactory((w, h) => {
    made++;
    return new SoftCanvas(w, h);
  });
  try {
    fn();
  } finally {
    setCanvasFactory((w, h) => new SoftCanvas(w, h));
  }
  return made;
}

/** Render one frame of a world (scene + HUD) and report what it cost. */
export function probeFrame(world, run = null, canvas = null) {
  const c = canvas || new SoftCanvas(480, 270);
  const { ctx, counts } = countingCtx(c.getContext('2d'));
  let made = 0;
  made = countCanvases(() => {
    renderWorld(ctx, world);
    drawHud(ctx, world, run);
  });
  return { ...counts, canvasesCreated: made };
}
