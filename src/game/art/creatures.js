// Painters for non-humanoid enemies: beasts, flyers, plants, pods, brutes and nests.
// Each painter takes an enemy def and returns { idle, run: [frames], w, h, ox, hot?, draw? }.
//   hot  - bright variant shown while the enemy telegraphs an attack
//   draw - optional custom renderer (turrets that aim), called as draw(ctx, enemy, camX, camY, frames)
// Sprites face right; drawEnemy mirrors them when the enemy faces left. Feet sit on the bottom row.

import { Painter, blit, lineTo } from '../../engine/gfx.js';
import { shade } from './common.js';
import { flashCtx } from './hit.js';

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

// ---- raptor (runner) ----
function raptorFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(32, 22);
  const B = hot ? shade(pal.body, 0.3) : pal.body;
  const D = shade(B, -0.38);
  const L = pal.belly;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // legs first so the body overlaps the hip
  const leg = (hx, hy, fx, fy, col) => {
    p.line(hx, hy, fx, fy, col, 3);
    p.rect(fx - 1, 20, 5, 2, shade(col, -0.3)); // foot
    p.px(fx + 4, 21, '#ece6d0'); // claw
  };
  switch (frame) {
    case 0: leg(14, 14, 19, 19, B); leg(13, 14, 8, 19, D); break;
    case 1: leg(14, 14, 15, 19, B); leg(13, 14, 12, 17, D); break;
    case 2: leg(14, 14, 9, 19, D); leg(13, 14, 19, 19, B); break;
    case 3: leg(14, 14, 11, 17, D); leg(13, 14, 15, 19, B); break;
    default: leg(14, 14, 15, 19, B); leg(13, 14, 10, 19, D);
  }
  // tail, body, belly
  p.rect(0, 10 + bob, 6, 2, B);
  p.rect(4, 8 + bob, 6, 4, B);
  p.rect(0, 11 + bob, 4, 1, D);
  p.ellipse(15, 10 + bob, 7, 5, B);
  p.rect(10, 13 + bob, 11, 2, L);
  for (let x = 9; x <= 19; x += 4) p.rect(x, 6 + bob, 2, 3, pal.stripe);
  // neck and head
  p.rect(20, 4 + bob, 5, 7, B);
  p.rect(23, 1 + bob, 8, 6, B);
  p.rect(25, 6 + bob, 7, 2, D);
  for (const x of [26, 28, 30]) p.px(x, 6 + bob, '#ffffff');
  p.rect(26, 2 + bob, 2, 2, pal.eye);
  p.px(27, 3 + bob, '#111111');
  p.rect(20, 1 + bob, 4, 2, pal.crest);
  p.rect(22, 0 + bob, 3, 1, pal.crest);
  // little arm
  p.rect(21, 11 + bob, 3, 1, D);
  p.px(24, 12 + bob, '#ece6d0');
  return p.canvas;
}

function raptor(def) {
  const run = [0, 1, 2, 3].map((i) => raptorFrame(def, i));
  return { idle: raptorFrame(def, -1), run, hot: raptorFrame(def, -1, true), w: 32, h: 22, ox: 16 };
}

// ---- drone (flyer) ----
function droneFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(22, 14);
  const body = hot ? '#ffffff' : pal.body;
  // rotor blur
  const rw = 16 - (frame % 2) * 4;
  p.rect(11 - rw / 2, 2 + (frame > 1 ? 1 : 0), rw, 1, '#d8e0f0');
  p.rect(10, 3, 2, 2, '#7a8298');
  // hull
  p.ellipse(11, 8, 8, 4, shade(body, -0.35));
  p.ellipse(11, 7, 8, 4, body);
  p.ellipse(11, 6, 5, 2, shade(body, 0.3));
  // eye: pulses with the frame
  const eye = hot ? '#ff2a2a' : pal.eye;
  p.rect(9, 7, 4, 3, '#14101c');
  p.rect(10, 8, 2, 1, eye);
  if (frame % 2 === 0) p.px(10, 8, '#ffffff');
  // thrusters
  p.rect(2, 9, 2, 2, '#4a4a5e');
  p.rect(18, 9, 2, 2, '#4a4a5e');
  p.px(3, 11 + (frame % 2), '#ffb84a');
  p.px(18, 11 + (frame % 2), '#ffb84a');
  return p.canvas;
}

function drone(def) {
  const run = [0, 1, 2, 3].map((i) => droneFrame(def, i));
  return { idle: run[0], run, hot: droneFrame(def, 0, true), w: 22, h: 14, ox: 11 };
}

// ---- spitting plant (turret) ----
function plantBase() {
  const p = new Painter(28, 18);
  const g1 = '#2f7a2a';
  const g2 = '#4fae3a';
  const g3 = '#1f5a20';
  // three leaves around the stem
  for (const [x, w, h] of [[2, 5, 9], [20, 5, 9], [9, 10, 6]]) {
    p.rect(x, 18 - h, w, h, g1);
    p.rect(x + 1, 18 - h - 2, w - 2, 2, g2);
    p.rect(x, 18 - h, 1, h, g3);
  }
  p.rect(11, 8, 6, 10, g1);
  p.rect(11, 8, 1, 10, g3);
  p.rect(16, 8, 1, 10, g2);
  p.rect(9, 16, 10, 2, g3);
  return p.canvas;
}

function drawPlant(ctx, e, ox, oy, f) {
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  blit(ctx, f.idle, x - f.ox, y - f.h);
  const a = e.ang === undefined ? -Math.PI / 2 : e.ang;
  const hx = x + Math.cos(a) * 9;
  const hy = y - 14 + Math.sin(a) * 9;
  lineTo(ctx, x, y - 6, hx, hy, '#1f5a20', 4);
  lineTo(ctx, x, y - 6, hx, hy, '#3a9a30', 2);
  const tw = e.state === 'tele' && e.def.tele ? 1 - Math.max(0, e.t) / e.def.tele : 0;
  const bulb = tw > 0 && Math.floor(tw * 12) % 2 === 0 ? '#ff7a5a' : '#c0392b';
  disc(ctx, hx, hy, 5, shade(bulb, -0.35));
  disc(ctx, hx, hy - 1, 4, bulb);
  disc(ctx, hx - 1, hy - 2, 1, '#ffb0a0');
  // mouth
  const mx = hx + Math.cos(a) * 4;
  const my = hy + Math.sin(a) * 4;
  disc(ctx, mx, my, 2, '#2a0a0a');
  if (tw > 0) disc(ctx, mx, my, 1 + (tw > 0.5 ? 1 : 0), '#d8ff5a');
  ctx.globalAlpha = 1;
}

function plant() {
  const base = plantBase();
  return { idle: base, run: [base], w: 28, h: 18, ox: 14, draw: drawPlant };
}

// ---- rift pod (turret with an open/closed cycle) ----
function drawPod(ctx, e, ox, oy) {
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  const shell = '#565a70';
  const dark = '#2a2c3a';
  // base ring
  ctx.fillStyle = dark;
  ctx.fillRect(x - 13, y - 4, 26, 4);
  ctx.fillStyle = '#7a7e96';
  ctx.fillRect(x - 13, y - 4, 26, 1);
  if (e.open) {
    // plates swung aside, glowing core and a barrel that tracks the player
    ctx.fillStyle = shell;
    ctx.fillRect(x - 14, y - 12, 5, 8);
    ctx.fillRect(x + 9, y - 12, 5, 8);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 8, y - 9, 16, 5);
    disc(ctx, x, y - 9, 5, '#5a1a7a');
    disc(ctx, x, y - 9, 3, '#c03aff');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 10, 2, 2);
    const a = e.ang === undefined ? -Math.PI / 2 : e.ang;
    lineTo(ctx, x, y - 9, x + Math.cos(a) * 9, y - 9 + Math.sin(a) * 9, '#9a9ab0', 3);
    lineTo(ctx, x + Math.cos(a) * 6, y - 9 + Math.sin(a) * 6, x + Math.cos(a) * 9, y - 9 + Math.sin(a) * 9, '#e0e0f0', 1);
    const tw = e.state === 'tele' && e.def.tele ? 1 - Math.max(0, e.t) / e.def.tele : 0;
    if (tw > 0.3) disc(ctx, x + Math.cos(a) * 11, y - 9 + Math.sin(a) * 11, 2, tw > 0.7 ? '#ffffff' : '#ff9ad8');
  } else {
    // closed dome with a seam; the light blinks when it is about to open
    for (let r = 0; r < 8; r++) {
      const half = Math.round(13 * Math.sqrt(1 - ((7 - r) / 8) * ((7 - r) / 8)));
      ctx.fillStyle = r < 2 ? '#7a7e96' : shell;
      ctx.fillRect(x - half, y - 5 - (7 - r), half * 2, 1);
    }
    ctx.fillStyle = dark;
    ctx.fillRect(x, y - 13, 1, 9);
    const soon = e.cycleT !== undefined && e.cycleT < 0.6 && Math.floor(e.cycleT * 10) % 2 === 0;
    ctx.fillStyle = soon ? '#ff5aff' : '#6a2a8a';
    ctx.fillRect(x - 2, y - 9, 5, 2);
  }
  ctx.globalAlpha = 1;
}

function pod() {
  const p = new Painter(2, 2); // not used: the pod is drawn directly
  return { idle: p.canvas, run: [p.canvas], w: 26, h: 14, ox: 13, draw: drawPod };
}

// ---- rift brute (heavy) ----
function bruteFrame(def, frame) {
  const pal = def.pal;
  const p = new Painter(44, 44);
  const S = pal.skin;
  const SD = shade(S, -0.4);
  const A = pal.armor;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // legs
  const stride = frame === -1 ? 0 : [3, 0, -3, 0][frame];
  p.rect(14 + stride, 30, 7, 14, SD);
  p.rect(14 + stride, 40, 9, 4, '#1a1620');
  p.rect(23 - stride, 30, 7, 14, S);
  p.rect(23 - stride, 40, 9, 4, '#1a1620');
  // torso
  p.ellipse(22, 20 + bob, 12, 12, S);
  p.rect(10, 24 + bob, 24, 8, shade(S, -0.2));
  // chest core (the weak point): placed to line up with def.weak
  p.rect(24, 10 + bob, 12, 14, A);
  p.rect(26, 12 + bob, 8, 10, '#3a0a4a');
  p.rect(27, 13 + bob, 6, 8, '#ff4adc');
  p.rect(28, 14 + bob, 3, 3, '#ffffff');
  // shoulder plates
  p.rect(8, 6 + bob, 10, 6, A);
  p.rect(8, 6 + bob, 10, 1, shade(A, 0.4));
  p.rect(28, 4 + bob, 10, 6, A);
  p.rect(28, 4 + bob, 10, 1, shade(A, 0.4));
  // arms
  p.rect(6, 12 + bob, 6, 16, SD);
  p.rect(5, 26 + bob, 8, 5, S);
  p.rect(33, 14 + bob, 6, 14, S);
  p.rect(33, 26 + bob, 8, 5, S);
  // head
  p.ellipse(31, 5 + bob, 6, 5, S);
  p.rect(33, 4 + bob, 4, 2, '#ff4a4a');
  p.rect(30, 0 + bob, 2, 3, '#e8e0d0');
  p.rect(36, 0 + bob, 2, 3, '#e8e0d0');
  return p.canvas;
}

function brute(def) {
  const run = [0, 1, 2, 3].map((i) => bruteFrame(def, i));
  return { idle: bruteFrame(def, -1), run, w: 44, h: 44, ox: 22 };
}

// ---- rift nest (spawner) ----
function nestFrame(def, beat) {
  const p = new Painter(32, 28);
  const B = def.pal.body;
  p.ellipse(16, 20, 14, 8, shade(B, -0.45));
  p.ellipse(16, 15 - beat, 11, 11 + beat, B);
  p.ellipse(16, 12 - beat, 7, 6, shade(B, 0.25));
  // mouth
  p.ellipse(16, 17, 6, 4, '#14080e');
  p.ellipse(16, 17, 3, 2, def.pal.glow);
  // veins
  p.line(5, 12, 9, 17, shade(B, -0.3), 1);
  p.line(27, 12, 23, 17, shade(B, -0.3), 1);
  p.rect(10, 26, 12, 2, shade(B, -0.5));
  return p.canvas;
}

function drawNest(ctx, e, ox, oy, f) {
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  blit(ctx, f.run[Math.floor(e.anim * 1.6) % 2], x - f.ox, y - f.h);
  if (e.puff > 0) disc(ctx, x, y - 11, 4 + Math.round(e.puff * 8), e.def.pal.glow);
  ctx.globalAlpha = 1;
}

function nest(def) {
  const run = [nestFrame(def, 0), nestFrame(def, 1)];
  return { idle: run[0], run, w: 32, h: 28, ox: 16, draw: drawNest };
}

// ---- sabre-tooth cat (runner) ----
function sabreFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(36, 22);
  const B = hot ? shade(pal.body, 0.3) : pal.body;
  const D = shade(B, -0.4);
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // legs: gallop pairs
  const o = frame < 0 ? [0, 0, 0, 0] : [[3, -3, -2, 2], [0, 0, 0, 0], [-3, 3, 2, -2], [0, 0, 0, 0]][frame];
  p.rect(7 + o[0], 14, 4, 8, D);
  p.rect(12 + o[1], 14, 4, 8, B);
  p.rect(22 + o[2], 14, 4, 8, D);
  p.rect(27 + o[3], 14, 4, 8, B);
  for (const x of [7 + o[0], 12 + o[1], 22 + o[2], 27 + o[3]]) p.rect(x, 20, 5, 2, shade(D, -0.2));
  // body and tail
  p.ellipse(18, 11 + bob, 11, 6, B);
  p.rect(10, 14 + bob, 16, 2, pal.belly);
  p.rect(0, 6 + bob, 7, 3, B);
  p.rect(1, 5 + bob, 3, 2, D);
  for (let x = 12; x <= 22; x += 5) p.rect(x, 6 + bob, 2, 4, pal.stripe);
  // head with the fangs
  p.rect(27, 3 + bob, 9, 8, B);
  p.rect(33, 6 + bob, 3, 4, pal.belly);
  p.rect(28, 2 + bob, 3, 3, D);
  p.rect(30, 5 + bob, 2, 2, '#ffe27a');
  p.px(31, 5 + bob, '#111111');
  p.rect(32, 10 + bob, 1, 5, '#ffffff');
  p.rect(35, 10 + bob, 1, 5, '#ffffff');
  return p.canvas;
}

function sabre(def) {
  const run = [0, 1, 2, 3].map((i) => sabreFrame(def, i));
  return { idle: sabreFrame(def, -1), run, hot: sabreFrame(def, -1, true), w: 36, h: 22, ox: 18 };
}

// ---- pterosaur (flyer) ----
function pteroFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(40, 22);
  const B = hot ? '#ffffff' : pal.body;
  const W = hot ? '#ffd0d0' : pal.wing;
  const up = [-1, 0, 1, 0][frame] ?? 0;
  // wings: swept back, flap between up and down
  const wy = 10 + up * 5;
  p.rect(10, wy - 3, 16, 3, W);
  p.rect(6, wy - 1, 14, 3, W);
  p.rect(14, wy - 6 + (up > 0 ? 4 : 0), 8, 3, shade(W, -0.15));
  p.rect(2, wy + 2, 10, 2, shade(W, -0.2));
  // body and head with a long crest
  p.ellipse(20, 12, 8, 3, B);
  p.rect(26, 8, 9, 5, B);
  p.rect(33, 10, 7, 2, shade(B, -0.3));
  p.rect(14, 4, 14, 2, shade(B, -0.1));
  p.rect(10, 5, 6, 2, shade(B, -0.1));
  p.px(31, 9, '#ffee44');
  p.rect(8, 11, 6, 2, shade(B, -0.3));
  return p.canvas;
}

function ptero(def) {
  const run = [0, 1, 2, 3].map((i) => pteroFrame(def, i));
  return { idle: run[1], run, hot: pteroFrame(def, 1, true), w: 40, h: 22, ox: 20 };
}

// ---- giant cave bat (flyer) ----
function batFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(26, 16);
  const B = hot ? '#ffffff' : pal.body;
  const W = hot ? '#ffd0f0' : pal.wing;
  const up = [-1, 0, 1, 0][frame] ?? 0;
  const wy = 7 - up * 3;
  // wings: two scalloped fans either side of the body
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : 15;
    p.rect(x0, wy - 2 * (side * up < 0 ? 0 : 1), 11, 3, W);
    p.rect(x0 + (side < 0 ? 0 : 1), wy + 1, 10, 2, shade(W, -0.2));
    p.rect(x0 + (side < 0 ? 1 : 2), wy + 3, 2, 2, shade(W, -0.2));
    p.rect(x0 + (side < 0 ? 5 : 6), wy + 3, 2, 3, shade(W, -0.2));
    p.rect(x0 + (side < 0 ? 9 : 2), wy + 3, 1, 2, shade(W, -0.2));
  }
  p.ellipse(13, 8, 3, 4, B); // body
  p.rect(11, 3, 2, 3, shade(B, -0.1)); // ears
  p.rect(14, 3, 2, 3, shade(B, -0.1));
  p.rect(12, 5, 4, 3, B);
  p.px(12, 6, pal.eye);
  p.px(15, 6, pal.eye);
  p.px(13, 9, '#f4f0dc'); // fangs
  p.px(15, 9, '#f4f0dc');
  return p.canvas;
}

function bat(def) {
  const run = [0, 1, 2, 3].map((i) => batFrame(def, i));
  return { idle: run[1], run, hot: batFrame(def, 1, true), w: 26, h: 16, ox: 13 };
}

// ---- crusher: a carved stone slab on a shaft (drawn directly: it moves a long way) ----
function drawCrusher(ctx, e, ox, oy) {
  const d = e.def;
  const x = Math.round(e.x - ox) + (e.shake || 0);
  const bottom = Math.round(e.y - oy);
  const top = bottom - d.h;
  const pal = d.pal; // a factory press has a palette of its own: riveted iron instead of carved sandstone
  const sand = pal ? pal.main : '#c8a468';
  const dark = pal ? pal.dark : '#7a5a30';
  // shaft up to the ceiling
  ctx.fillStyle = '#3a2e22';
  ctx.fillRect(x - 3, 0, 6, Math.max(0, top));
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(x - 3, 0, 2, Math.max(0, top));
  // the floor marker while it winds up
  if (e.state === 'tele' || e.state === 'fall') {
    const fy = Math.round(e.top + (e.spec.drop ?? 64) - oy);
    ctx.fillStyle = Math.floor((e.t || 0) * 16) % 2 === 0 ? '#ff4a3a' : '#ffd23a';
    ctx.fillRect(x - 12, fy - 1, 24, 2);
    ctx.fillRect(x - 2, fy - 6, 4, 4);
  }
  // slab
  ctx.fillStyle = dark;
  ctx.fillRect(x - 15, top - 1, 30, d.h + 2);
  ctx.fillStyle = sand;
  ctx.fillRect(x - 14, top, 28, d.h);
  ctx.fillStyle = pal ? pal.light : '#e8d098';
  ctx.fillRect(x - 14, top, 28, 3);
  ctx.fillStyle = dark;
  if (pal) {
    // rivets and a hazard stripe along the bottom edge
    for (const gx of [-11, -3, 5, 11]) for (const gy of [6, 14]) ctx.fillRect(x + gx, top + gy, 2, 2);
    for (let i = -14; i < 14; i += 8) {
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(x + i, bottom - 5, 4, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(x + i + 4, bottom - 5, 4, 4);
    }
  } else {
    for (const gx of [-9, -1, 7]) {
      ctx.fillRect(x + gx, top + 7, 3, 3);
      ctx.fillRect(x + gx - 1, top + 12, 5, 2);
      ctx.fillRect(x + gx + 1, top + 15, 1, 5);
    }
  }
  // teeth along the underside
  ctx.fillStyle = pal ? pal.light : '#d8d0b0';
  for (let i = -12; i < 14; i += 6) ctx.fillRect(x + i, bottom, 4, 3);
  ctx.fillStyle = pal ? pal.dark : '#8a8070';
  for (let i = -12; i < 14; i += 6) ctx.fillRect(x + i + 1, bottom + 2, 2, 2);
}

function crusherPainter() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 30, h: 26, ox: 15, draw: drawCrusher };
}

// ---- cannon on a carriage (turret that aims) ----
function drawCannon(ctx, e, ox, oy, f) {
  const d = e.def;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  const pal = d.pal;
  ctx = flashCtx(ctx, e);
  const a = e.ang === undefined ? -Math.PI / 2 : e.ang;
  // carriage
  ctx.fillStyle = shade(pal.body, -0.35);
  ctx.fillRect(x - 12, y - 6, 24, 6);
  ctx.fillStyle = pal.body;
  ctx.fillRect(x - 11, y - 8, 22, 5);
  ctx.fillStyle = shade(pal.body, 0.35);
  ctx.fillRect(x - 11, y - 8, 22, 1);
  disc(ctx, x - 7, y - 2, 3, '#2a2a32');
  disc(ctx, x + 7, y - 2, 3, '#2a2a32');
  disc(ctx, x - 7, y - 2, 1, pal.metal);
  disc(ctx, x + 7, y - 2, 1, pal.metal);
  // barrel
  const bx = x + Math.cos(a) * 13;
  const by = y - 12 + Math.sin(a) * 13;
  lineTo(ctx, x, y - 12, bx, by, shade(pal.metal, -0.45), 5);
  lineTo(ctx, x, y - 12, bx, by, pal.metal, 3);
  disc(ctx, x, y - 12, 4, pal.body);
  disc(ctx, x, y - 12, 2, shade(pal.body, 0.4));
  const tw = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
  if (tw > 0) disc(ctx, bx + Math.cos(a) * 3, by + Math.sin(a) * 3, 1 + (tw > 0.6 ? 2 : 1), tw > 0.6 ? '#ffffff' : pal.glow);
  ctx.globalAlpha = 1;
}

function cannon() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 26, h: 16, ox: 13, draw: drawCannon };
}

// ---- icicle (faller) ----
function drawIcicle(ctx, e, ox, oy) {
  let x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  const shaking = e.state === 'tele';
  if (shaking) x += Math.floor(e.t * 40) % 2 === 0 ? -1 : 1;
  const h = e.def.h;
  // a tapering spear, tip at the bottom
  for (let i = 0; i < h; i++) {
    const half = Math.max(0, Math.round(4 * (1 - i / h) ** 0.7));
    ctx.fillStyle = i < 3 ? '#e8f8ff' : '#9ad4f0';
    ctx.fillRect(x - half, y - h + i, half * 2 + 1, 1);
    if (half > 1) {
      ctx.fillStyle = '#dff4ff';
      ctx.fillRect(x - half + 1, y - h + i, 1, 1);
      ctx.fillStyle = '#6aa8d0';
      ctx.fillRect(x + half, y - h + i, 1, 1);
    }
  }
  if (shaking && Math.floor(e.t * 16) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - h + 2, 2, 6);
  }
}

function icicle() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 10, h: 22, ox: 5, draw: drawIcicle };
}

export function registerCreatures(painters) {
  painters.sabre = sabre;
  painters.ptero = ptero;
  painters.bat = bat;
  painters.crusher = crusherPainter;
  painters.cannon = cannon;
  painters.icicle = icicle;
  painters.raptor = raptor;
  painters.drone = drone;
  painters.plant = plant;
  painters.pod = pod;
  painters.brute = brute;
  painters.nest = nest;
}
