// Painters for the coastal assault (level 16): concrete bunkers, anti-tank guns, landmines and the dive bomber.
// Sprites face right; custom draws mirror themselves with the enemy's facing.

import { Painter, lineTo } from '../../engine/gfx.js';
import { shade } from './common.js';
import { flashCtx } from './hit.js';

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy + 0.25));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// ---- concrete bunker: a squat dome with a gun slit that opens and closes ----
function drawBunker(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  const f = e.facing || e.face || 1;
  // the sandbag skirt and the concrete body
  ctx.fillStyle = pal.dark;
  ctx.fillRect(x - 17, y - 14, 34, 14);
  ctx.fillStyle = pal.body;
  ctx.fillRect(x - 16, y - 13, 32, 12);
  ctx.fillRect(x - 12, y - 17, 24, 4);
  ctx.fillRect(x - 9, y - 18, 18, 1);
  ctx.fillStyle = shade(pal.body, 0.35);
  ctx.fillRect(x - 12, y - 17, 24, 1);
  ctx.fillRect(x - 16, y - 13, 32, 1);
  ctx.fillStyle = shade(pal.body, -0.25);
  ctx.fillRect(x - 16, y - 5, 32, 1);
  for (const gx of [-12, -3, 7]) ctx.fillRect(x + gx, y - 12, 1, 6); // board marks in the concrete
  // the gun slit, on the facing side
  const sx = x + f * 6 - 8;
  ctx.fillStyle = pal.slit;
  ctx.fillRect(sx, y - 12, 16, e.open ? 5 : 2);
  if (e.open) {
    // the machine gun pokes out along its aim
    const a = e.ang === undefined ? (f > 0 ? 0 : Math.PI) : e.ang;
    const gx = x + f * 6;
    const gy = y - 10;
    lineTo(ctx, gx, gy, gx + Math.cos(a) * 14, gy + Math.sin(a) * 14, '#2a2a2e', 2);
    lineTo(ctx, gx + Math.cos(a) * 9, gy + Math.sin(a) * 9, gx + Math.cos(a) * 14, gy + Math.sin(a) * 14, '#8a8a96', 2);
    const tw = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
    if (tw > 0) disc(ctx, Math.round(gx + Math.cos(a) * 16), Math.round(gy + Math.sin(a) * 16), tw > 0.6 ? 2 : 1, tw > 0.6 ? '#ffffff' : pal.glow);
  } else {
    // steel shutter lines
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(sx, y - 12, 16, 1);
    ctx.fillRect(sx, y - 11, 16, 1);
  }
  ctx.globalAlpha = 1;
}

function bunker() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 36, h: 20, ox: 18, draw: drawBunker };
}

// ---- anti-tank gun: a long barrel behind a sloped shield, on two spoked wheels ----
function drawAtGun(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  const f = e.facing || e.face || 1;
  const a = e.ang === undefined ? (f > 0 ? 0 : Math.PI) : e.ang;
  // trail legs
  lineTo(ctx, x - f * 4, y - 7, x - f * 15, y - 1, shade(pal.body, -0.4), 2);
  // barrel (long) with a muzzle brake
  const px = x + f * 2;
  const py = y - 11;
  const ex = px + Math.cos(a) * 24;
  const ey = py + Math.sin(a) * 24;
  lineTo(ctx, px, py, ex, ey, shade(pal.metal, -0.4), 4);
  lineTo(ctx, px, py, ex, ey, pal.metal, 2);
  lineTo(ctx, px + Math.cos(a) * 20, py + Math.sin(a) * 20, ex, ey, '#8a8a92', 4);
  // wheel
  disc(ctx, x, y - 5, 5, '#22221c');
  disc(ctx, x, y - 5, 3, pal.metal);
  disc(ctx, x, y - 5, 1, '#8a8a82');
  // shield: two sloped plates
  ctx.fillStyle = pal.body;
  ctx.fillRect(x + f * 3 - 2, y - 15, 4, 12);
  ctx.fillStyle = shade(pal.body, 0.35);
  ctx.fillRect(x + f * 3 - 2 + (f > 0 ? 0 : 3), y - 15, 1, 12);
  ctx.fillStyle = shade(pal.body, -0.3);
  ctx.fillRect(x + f * 3 - 2, y - 9, 4, 1);
  // a crewman's helmet peeking over the shield
  ctx.fillStyle = '#4a5240';
  ctx.fillRect(x - f * 4 - 3, y - 17, 6, 3);
  const tw = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
  if (tw > 0) disc(ctx, Math.round(ex + Math.cos(a) * 3), Math.round(ey + Math.sin(a) * 3), tw > 0.6 ? 3 : 2, tw > 0.6 ? '#ffffff' : pal.glow);
  ctx.globalAlpha = 1;
}

function atgun() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 30, h: 22, ox: 15, draw: drawAtGun };
}

// ---- landmine: a flat steel disc in the sand with a blinking light; it hops out of the ground when triggered ----
function drawMine(ctx, e, ox, oy) {
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy) - Math.round(e.lift || 0);
  ctx = flashCtx(ctx, e);
  const tele = e.state === 'tele';
  if (tele) {
    // spikes of sand and a soft shadow where it was
    ctx.fillStyle = '#a88c58';
    ctx.fillRect(x - 8, Math.round(e.y - oy) - 1, 16, 1);
  }
  ctx.fillStyle = '#22221e';
  ctx.fillRect(x - 7, y - 4, 14, 4);
  ctx.fillStyle = '#4a4e42';
  ctx.fillRect(x - 6, y - 5, 12, 3);
  ctx.fillStyle = '#6a6e5e';
  ctx.fillRect(x - 6, y - 5, 12, 1);
  // pressure plate and the warning light
  ctx.fillStyle = '#2a2a26';
  ctx.fillRect(x - 2, y - 7, 5, 2);
  const blink = tele ? Math.floor((e.t || 0) * 24) % 2 === 0 : Math.floor((e.age || 0) * 1.4) % 2 === 0;
  ctx.fillStyle = blink ? '#ff3a2a' : '#6a1a14';
  ctx.fillRect(x, y - 8, 1, 1);
  ctx.globalAlpha = 1;
}

function mine() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 16, h: 8, ox: 8, draw: drawMine };
}

// ---- dive bomber: a monoplane with a long nose, a glazed canopy, and bombs under the wings ----
function fighterFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(46, 24);
  const B = hot ? '#ffffff' : pal.body;
  const W = hot ? '#fff0d8' : pal.wing;
  const R = pal.accent;
  // tail
  p.rect(2, 5, 3, 8, shade(B, -0.1));
  p.rect(2, 11, 10, 2, shade(W, -0.1));
  // fuselage, nose and the spinner
  p.ellipse(23, 12, 17, 3, B);
  p.rect(8, 10, 30, 5, B);
  p.rect(8, 14, 30, 1, shade(B, -0.3));
  p.rect(10, 10, 26, 1, shade(B, 0.3));
  p.rect(38, 10, 3, 5, shade(B, -0.2));
  p.rect(41, frame % 2 ? 6 : 8, 2, frame % 2 ? 13 : 9, hot ? '#ffffff' : '#c8c8d0');
  // cranked wing, seen edge-on, with a roundel
  p.rect(14, 15, 22, 3, W);
  p.rect(14, 17, 22, 1, shade(W, -0.3));
  p.rect(18, 15, 3, 3, R);
  p.rect(19, 16, 1, 1, '#14141a');
  // canopy and pilot
  p.rect(22, 6, 9, 4, '#9ad0e8');
  p.rect(22, 6, 9, 1, '#d8f0fa');
  p.rect(26, 7, 3, 3, '#d8a070');
  // twin bombs and landing wheel
  p.rect(20, 18, 3, 4, '#2a2a30');
  p.rect(28, 18, 3, 4, '#2a2a30');
  p.px(21, 22, '#c0262e');
  p.px(29, 22, '#c0262e');
  p.ellipse(24, 20, 2, 2, '#1a1a1e');
  return p.canvas;
}

function fighter(def) {
  const run = [0, 1, 2, 3].map((i) => fighterFrame(def, i));
  return { idle: run[0], run, hot: fighterFrame(def, 0, true), w: 46, h: 24, ox: 23 };
}

export function registerCoast(painters) {
  painters.bunker = bunker;
  painters.atgun = atgun;
  painters.mine = mine;
  painters.fighter = fighter;
}
