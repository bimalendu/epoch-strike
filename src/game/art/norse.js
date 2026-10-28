// Painters for the Viking fjord: the sea serpent (drawn per frame from a trail of positions) and its ripples.

import { shade } from './common.js';
import { Painter } from '../../engine/gfx.js';
import { flashCtx } from './hit.js';

// The serpent is a chain of discs following the path the head has flown, with a fanged head on the end.
function drawSerpent(ctx, e, ox, oy, f) {
  const pal = e.def.pal;
  const base = Math.round(e.base - oy);
  const wx = (x) => Math.round(x - ox);
  const hot = e.state === 'tele';
  if (e.state === 'tele') {
    // a swelling ripple on the surface where it will break through
    const k = e.t / (e.def.tele || 0.8);
    const w = Math.round(26 - 14 * k);
    ctx.fillStyle = '#e8f4ff';
    ctx.fillRect(wx(e.x) - w, base, w * 2, 1);
    ctx.fillStyle = '#6ab4e8';
    ctx.fillRect(wx(e.x) - w + 3, base + 2, w * 2 - 6, 1);
    if (Math.floor(e.t * 14) % 2 === 0) {
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(wx(e.x) - 1, base - 3, 3, 3); // an eye just breaking the surface
    }
    return;
  }
  if (e.state !== 'leap' || !e.trail || e.trail.length < 2) return;
  ctx = flashCtx(ctx, e);
  const dark = pal.body;
  const lit = shade(pal.body, 0.3);
  // body discs along the trail, thinning toward the tail; nothing is drawn below the waterline
  for (let i = e.trail.length - 1; i >= 1; i--) {
    const p = e.trail[i];
    if (p.y > e.base + 2) continue;
    const r = Math.max(2, 5 - Math.floor(i / 4));
    const cx = wx(p.x);
    const cy = Math.round(p.y - oy) - 2;
    ctx.fillStyle = i % 3 === 0 ? shade(dark, -0.25) : dark;
    ctx.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 1);
    ctx.fillStyle = pal.belly;
    ctx.fillRect(cx - r + 1, cy + 1, r * 2 - 2, 2);
    if (i % 4 === 0) {
      ctx.fillStyle = pal.fin;
      ctx.fillRect(cx - 1, cy - r - 2, 3, 3);
    }
  }
  // the head
  const head = e.trail[0];
  const hx = wx(head.x);
  const hy = Math.round(head.y - oy) - 4;
  const dir = e.face >= 0 ? 1 : -1;
  const down = e.vy > 0;
  const r = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(dir > 0 ? hx + x : hx - x - w, hy + y, w, h);
  };
  r(-6, -6, 14, 11, dark);
  r(-6, -6, 14, 2, lit);
  r(6, -3, 9, 5, dark); // snout
  r(5, 2, 9, down ? 6 : 3, shade(dark, -0.35)); // jaw, gaping on the way down
  r(8, 2, 2, 3, '#ffffff');
  r(12, 2, 2, 3, '#ffffff');
  r(-1, -4, 3, 3, hot ? '#ffffff' : pal.eye);
  r(-8, -8, 4, 6, pal.fin); // crest
  r(-10, -4, 4, 5, pal.fin);
  ctx.globalAlpha = 1;
}

function serpent() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 16, h: 18, ox: 8, draw: drawSerpent };
}

export function registerNorse(painters) {
  painters.serpent = serpent;
}
