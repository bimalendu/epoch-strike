// Painters for the castle siege (level 10): the catapult turret. Drawn per frame so the arm can be winched back
// while it telegraphs and fling forward once the boulder is away.

import { Painter, lineTo } from '../../engine/gfx.js';
import { shade } from './common.js';
import { flashCtx } from './hit.js';

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

function drawCatapult(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  const face = e.facing || 1;
  const tele = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
  const reloading = e.state !== 'tele' && e.t > (d.fireEvery || 3) * 0.55; // just fired: the cup is empty
  ctx = flashCtx(ctx, e);
  const R = (lx, ly, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(face > 0 ? x + lx : x - lx - w, y + ly, w, h);
  };
  // wooden frame with cross-bracing
  R(-13, -9, 26, 4, pal.body);
  R(-13, -9, 26, 1, shade(pal.body, 0.4));
  R(-13, -6, 26, 1, shade(pal.body, -0.4));
  R(-11, -14, 3, 6, shade(pal.body, -0.15));
  R(8, -14, 3, 6, shade(pal.body, -0.15));
  lineTo(ctx, face > 0 ? x - 10 : x + 10, y - 6, face > 0 ? x + 4 : x - 4, y - 18, shade(pal.body, -0.3), 1);
  // wheels
  disc(ctx, x - 9, y - 3, 4, '#2a1a10');
  disc(ctx, x + 9, y - 3, 4, '#2a1a10');
  disc(ctx, x - 9, y - 3, 2, shade(pal.body, 0.25));
  disc(ctx, x + 9, y - 3, 2, shade(pal.body, 0.25));
  // axle post and the throwing arm. Local angle 0 = forward, drawn mirrored for facing left.
  const cocked = Math.PI - 0.55; // winched back and down
  const released = -1.05; // flung up and forward
  const a = tele > 0 ? released + (cocked - released) * tele : reloading ? released + 0.9 : released;
  const px = x;
  const py = y - 15;
  const L = 17;
  const ex = px + Math.cos(a) * L * face;
  const ey = py + Math.sin(a) * L;
  lineTo(ctx, px - Math.cos(a) * 5 * face, py - Math.sin(a) * 5, ex, ey, '#3a2412', 3);
  lineTo(ctx, px, py, ex, ey, pal.body, 2);
  disc(ctx, px, py, 2, pal.metal);
  // counterweight on the short end
  disc(ctx, Math.round(px - Math.cos(a) * 6 * face), Math.round(py - Math.sin(a) * 6), 2, pal.stone);
  // the cup: holds a boulder until it is thrown
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(Math.round(ex) - 2, Math.round(ey), 5, 2);
  if (!reloading || tele > 0) {
    const hot = tele > 0.6;
    disc(ctx, Math.round(ex), Math.round(ey) - 2, 3, hot ? pal.glow : pal.stone);
    if (hot) disc(ctx, Math.round(ex), Math.round(ey) - 2, 1, '#ffffff');
  }
  ctx.globalAlpha = 1;
}

function catapult() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 30, h: 22, ox: 15, draw: drawCatapult };
}

export function registerMedieval(painters) {
  painters.catapult = catapult;
}
