// Painters for the last era group (levels 17-20): the Arctic missile base, Neon City and the Cyber Megacity.
// Sprites face right; frame-based painters are mirrored by drawEnemy, custom draws mirror themselves.

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

// ---- snowmobile: a low sled with a windscreen and a driver, thundering across the screen (drawn directly) ----
function drawSnowmobile(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const f = e.face >= 0 ? 1 : -1;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  const r = (dx, dy, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h);
  };
  ctx = flashCtx(ctx, e);
  const tele = e.state === 'tele';
  const shake = tele ? (Math.floor((e.t || 0) * 40) % 2 ? 1 : -1) : 0;
  const bob = e.state === 'charge' ? (Math.floor(e.anim * 2) % 2) : 0;
  // the ski and the track
  r(-18, -3 + bob + shake, 36, 3, pal.dark);
  r(12, -5 + bob + shake, 10, 2, pal.trim);
  r(20, -7 + bob + shake, 3, 3, pal.trim);
  r(-16, -4 + bob, 26, 4, '#6a6a76');
  for (let i = 0; i < 6; i++) r(-15 + i * 4, -3 + bob, 2, 2, '#2a2a34');
  // the body
  r(-18, -11 + bob + shake, 34, 8, pal.body);
  r(-18, -11 + bob + shake, 34, 1, shade(pal.body, 0.4));
  r(-18, -4 + bob + shake, 34, 1, shade(pal.body, -0.35));
  r(10, -14 + bob + shake, 8, 4, pal.body); // the bonnet
  r(10, -14 + bob + shake, 8, 1, shade(pal.body, 0.4));
  r(4, -16 + bob + shake, 5, 6, '#7ac8e8'); // the windscreen
  r(4, -16 + bob + shake, 5, 1, '#e8fbff');
  // the headlamp
  r(17, -12 + bob + shake, 3, 2, tele && Math.floor((e.t || 0) * 18) % 2 ? '#ffffff' : pal.glow);
  // the driver, leaning forward in a white suit
  r(-8, -20 + bob + shake, 7, 9, '#e8ecf4');
  r(-7, -25 + bob + shake, 5, 5, '#e8ecf4');
  r(-5, -23 + bob + shake, 3, 2, '#14141c');
  r(-2, -17 + bob + shake, 9, 2, '#e8ecf4');
  // a tail of kicked-up snow while it charges
  if (e.state === 'charge') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) r(-22 - i * 5, -3 - ((Math.floor(e.anim * 3) + i) % 3) * 2, 3, 2, '#ffffff');
  }
  ctx.globalAlpha = 1;
}

function snowmobile() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 44, h: 26, ox: 22, draw: drawSnowmobile };
}

// ---- SAM rack: a tracked launcher whose rack of two missiles follows the aim ----
function drawRack(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  ctx = flashCtx(ctx, e);
  const a = e.ang === undefined ? -Math.PI / 2 : e.ang;
  // the tracked hull
  ctx.fillStyle = '#22262a';
  ctx.fillRect(x - 14, y - 6, 28, 6);
  ctx.fillStyle = '#3a3e44';
  ctx.fillRect(x - 13, y - 6, 26, 2);
  for (let i = -12; i < 12; i += 4) {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(x + i, y - 2, 2, 2);
  }
  ctx.fillStyle = pal.body;
  ctx.fillRect(x - 11, y - 11, 22, 6);
  ctx.fillStyle = shade(pal.body, 0.35);
  ctx.fillRect(x - 11, y - 11, 22, 1);
  // two missiles side by side on the swivelling rack
  const px = x;
  const py = y - 13;
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  for (const off of [-2.5, 2.5]) {
    const sx = px + nx * off;
    const sy = py + ny * off;
    const ex = sx + Math.cos(a) * 15;
    const ey = sy + Math.sin(a) * 15;
    lineTo(ctx, sx, sy, ex, ey, '#c8ccd2', 3);
    lineTo(ctx, sx, sy, ex, ey, '#f0f2f4', 1);
    lineTo(ctx, sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, ex, ey, '#c0262e', 3);
  }
  disc(ctx, px, py, 3, pal.metal);
  const tw = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
  if (tw > 0) disc(ctx, Math.round(px + Math.cos(a) * 17), Math.round(py + Math.sin(a) * 17), tw > 0.6 ? 3 : 2, tw > 0.6 ? '#ffffff' : pal.glow);
  ctx.globalAlpha = 1;
}

function rack() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 30, h: 18, ox: 15, draw: drawRack };
}

// ---- ceiling gun: the sentry gun hung upside down from a slab, aiming down (honours gdir) ----
function drawCeilGun(ctx, e, ox, oy) {
  const d = e.def;
  const pal = d.pal;
  const x = Math.round(e.x - ox);
  const top = Math.round(e.y - e.h - oy); // the ceiling line
  ctx = flashCtx(ctx, e);
  const a = e.ang === undefined ? Math.PI / 2 : e.ang;
  // mounting plate and housing
  ctx.fillStyle = shade(pal.body, -0.4);
  ctx.fillRect(x - 12, top, 24, 5);
  ctx.fillStyle = pal.body;
  ctx.fillRect(x - 10, top + 4, 20, 3);
  ctx.fillStyle = shade(pal.body, 0.35);
  ctx.fillRect(x - 10, top + 4, 20, 1);
  // the barrel pivots below the plate
  const px = x;
  const py = top + 9;
  const bx = px + Math.cos(a) * 13;
  const by = py + Math.sin(a) * 13;
  lineTo(ctx, px, py, bx, by, shade(pal.metal, -0.45), 5);
  lineTo(ctx, px, py, bx, by, pal.metal, 3);
  disc(ctx, px, py, 4, pal.body);
  disc(ctx, px, py, 2, shade(pal.body, 0.4));
  // a status light on the plate
  ctx.fillStyle = Math.floor((e.age || e.t || 0) * 3) % 2 ? pal.glow : '#4a1a3a';
  ctx.fillRect(x + 9, top + 1, 2, 2);
  const tw = e.state === 'tele' && d.tele ? 1 - Math.max(0, e.t) / d.tele : 0;
  if (tw > 0) disc(ctx, Math.round(bx + Math.cos(a) * 3), Math.round(by + Math.sin(a) * 3), tw > 0.6 ? 3 : 2, tw > 0.6 ? '#ffffff' : pal.glow);
  ctx.globalAlpha = 1;
}

function ceilgun() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 26, h: 16, ox: 13, draw: drawCeilGun };
}

// ---- gunchopper: a small attack helicopter with a spinning rotor and a glass bubble ----
function copterFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(44, 22);
  const body = hot ? '#ffffff' : pal.body;
  // rotor blur and mast
  const rw = frame % 2 ? 38 : 30;
  p.rect(22 - rw / 2, 1, rw, 1, '#d8e0f0');
  p.rect(22 - rw / 2 + 3, 2, rw - 6, 1, '#7a8298');
  p.rect(21, 3, 2, 3, '#5a5e72');
  // tail boom and rotor
  p.rect(1, 9, 16, 3, shade(body, -0.15));
  p.rect(1, 6, 3, 6, shade(body, -0.3));
  const tr = frame % 2 ? 0 : 3;
  p.rect(1, 6 + tr, 1, 4, '#d8e0f0');
  // cabin
  p.ellipse(25, 11, 11, 6, shade(body, -0.35));
  p.ellipse(25, 10, 11, 6, body);
  p.ellipse(25, 9, 7, 3, shade(body, 0.3));
  // the glass bubble in the nose, with the pilot's glow
  p.ellipse(32, 11, 5, 4, pal.glass);
  p.ellipse(33, 10, 3, 2, shade(pal.glass, 0.5));
  // accent stripe, stub wing with a rocket pod, skids
  p.rect(16, 11, 12, 1, pal.accent);
  p.rect(20, 14, 9, 2, '#4a4a5e');
  p.rect(28, 15, 5, 2, '#2a2a38');
  p.px(33, 16, hot ? '#ff2a2a' : pal.accent);
  p.rect(17, 18, 18, 1, '#2a2a38');
  p.rect(19, 16, 1, 2, '#2a2a38');
  p.rect(32, 16, 1, 2, '#2a2a38');
  return p.canvas;
}

function copter(def) {
  const run = [0, 1, 2, 3].map((i) => copterFrame(def, i));
  return { idle: run[0], run, hot: copterFrame(def, 0, true), w: 44, h: 22, ox: 22 };
}

// ---- cyberhound: a four-legged robot hound with a glowing visor ----
function houndFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(32, 18);
  const body = hot ? '#ffffff' : pal.body;
  const st = frame < 0 ? 0 : [0, 2, 0, -2][frame];
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // legs: two pairs swinging opposite ways
  for (const [lx, sw] of [[7, st], [11, -st], [20, -st], [24, st]]) {
    p.rect(lx + Math.round(sw / 2), 11 + bob, 2, 4, pal.dark);
    p.rect(lx + sw, 14, 3, 2, pal.trim);
  }
  // tail antenna
  p.rect(3, 6 + bob, 4, 1, pal.dark);
  p.rect(2, 4 + bob, 1, 3, pal.trim);
  // torso
  p.rect(5, 6 + bob, 19, 6, shade(body, -0.3));
  p.rect(5, 6 + bob, 19, 5, body);
  p.rect(5, 6 + bob, 19, 1, shade(body, 0.4));
  p.rect(8, 8 + bob, 12, 1, pal.trim);
  // head: a wedge with a visor and jaws
  p.rect(23, 4 + bob, 7, 6, body);
  p.rect(23, 4 + bob, 7, 1, shade(body, 0.4));
  p.rect(29, 7 + bob, 2, 3, shade(body, -0.3));
  p.rect(24, 5 + bob, 5, 2, '#0e0e18');
  p.rect(26, 5 + bob, 3, 1, hot ? '#ffffff' : pal.eye);
  p.rect(23, 9 + bob, 7, 2, pal.dark);
  p.px(27, 10 + bob, '#e8e8f0');
  p.px(29, 10 + bob, '#e8e8f0');
  // ears
  p.rect(23, 2 + bob, 2, 3, pal.dark);
  return p.canvas;
}

function hound(def) {
  const run = [0, 1, 2, 3].map((i) => houndFrame(def, i));
  return { idle: houndFrame(def, -1), run, hot: houndFrame(def, -1, true), w: 32, h: 18, ox: 16 };
}

// ---- sentinel: a tall two-legged security mech with a glowing core in its chest (the weak point) ----
function sentinelFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(40, 48);
  const body = hot ? '#ffffff' : pal.body;
  const st = frame < 0 ? 0 : [0, 2, 0, -2][frame];
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // legs
  p.rect(12 + st, 32 + bob, 6, 11, pal.dark);
  p.rect(22 - st, 32 + bob, 6, 11, pal.dark);
  p.rect(11 + st, 43, 9, 4, pal.trim);
  p.rect(21 - st, 43, 9, 4, pal.trim);
  p.rect(12 + st, 32 + bob, 6, 1, shade(pal.dark, 0.5));
  // hips and torso
  p.rect(10, 28 + bob, 20, 5, shade(body, -0.3));
  p.rect(8, 11 + bob, 24, 18, shade(body, -0.25));
  p.rect(8, 11 + bob, 23, 17, body);
  p.rect(8, 11 + bob, 24, 2, shade(body, 0.4));
  p.rect(8, 11 + bob, 2, 18, shade(body, -0.35));
  // the core: pulses before it fires
  const hotCore = hot || (frame >= 0 && frame % 2 === 0);
  p.rect(15, 15 + bob, 10, 8, '#14141f');
  p.rect(16, 16 + bob, 8, 6, hotCore ? '#ffd0f4' : pal.core);
  p.rect(18, 17 + bob, 4, 4, '#ffffff');
  // shoulders and the arm cannon on the facing side
  p.rect(4, 9 + bob, 8, 6, pal.trim);
  p.rect(28, 9 + bob, 8, 6, pal.trim);
  p.rect(4, 9 + bob, 8, 1, shade(pal.trim, 0.4));
  p.rect(30, 14 + bob, 8, 4, shade(body, -0.35));
  p.rect(34, 15 + bob, 6, 2, pal.dark);
  p.px(39, 16 + bob, hot ? '#ffffff' : pal.core);
  p.rect(1, 14 + bob, 5, 12, shade(body, -0.2));
  // the head: a narrow visored helm
  p.rect(14, 1 + bob, 12, 10, body);
  p.rect(14, 1 + bob, 12, 1, shade(body, 0.4));
  p.rect(15, 4 + bob, 10, 3, '#0e0e18');
  p.rect(17, 5 + bob, 6, 1, hot ? '#ffffff' : pal.core);
  p.rect(19, -1 + bob, 2, 3, pal.trim);
  return p.canvas;
}

function sentinel(def) {
  const run = [0, 1, 2, 3].map((i) => sentinelFrame(def, i));
  return { idle: sentinelFrame(def, -1), run, hot: sentinelFrame(def, -1, true), w: 40, h: 48, ox: 20 };
}

// ---- orb mine: a spiked floating sphere with a blinking red light ----
function orbFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(18, 18);
  const body = hot ? '#ffffff' : pal.body;
  p.ellipse(9, 9, 6, 6, shade(body, -0.35));
  p.ellipse(9, 8, 6, 6, body);
  p.ellipse(8, 6, 3, 2, shade(body, 0.4));
  // spikes
  for (const [sx, sy] of [[9, 0], [9, 16], [0, 9], [16, 9], [3, 3], [14, 3], [3, 14], [14, 14]]) p.rect(sx, sy, 2, 2, '#8a8aa6');
  const blink = frame % 2 === 0;
  p.rect(7, 7, 4, 4, blink ? pal.light : shade(pal.light, -0.6));
  if (blink) p.px(8, 8, '#ffffff');
  return p.canvas;
}

function orb(def) {
  const run = [0, 1, 2, 3].map((i) => orbFrame(def, i));
  return { idle: run[0], run, hot: orbFrame(def, 0, true), w: 18, h: 18, ox: 9 };
}

// ---- hover-biker: an enemy soldier on a neon hoverbike (flyer) ----
function bikerFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(40, 24);
  const body = hot ? '#ffffff' : pal.body;
  // glow cushion and exhaust
  p.rect(8, 20, 24, 1, shade(pal.glow, -0.2));
  p.rect(12, 21, 16, 1, shade(pal.glow, -0.5));
  const fl = frame % 3;
  p.rect(0, 14, 5 + fl, 2, '#ff9a2a');
  p.rect(2, 14, 3 + fl, 1, '#ffee9a');
  // chassis
  p.rect(4, 13, 30, 5, shade(body, -0.35));
  p.rect(4, 13, 30, 4, body);
  p.rect(4, 13, 30, 1, shade(body, 0.4));
  p.rect(4, 15, 30, 1, pal.glow);
  p.rect(30, 14, 7, 3, body);
  p.rect(36, 15, 2, 1, '#ffffff');
  p.rect(3, 8, 5, 6, shade(body, -0.35));
  // windscreen
  p.rect(25, 8, 5, 5, '#2a6a9a');
  p.rect(25, 8, 5, 1, '#9ae8ff');
  // the rider, hunched, in a dark suit with a glowing visor
  p.rect(14, 8, 8, 5, pal.suit);
  p.rect(15, 3, 6, 6, pal.suit);
  p.rect(18, 4, 3, 2, hot ? '#ffffff' : pal.glow);
  p.rect(21, 9, 8, 2, pal.suit);
  return p.canvas;
}

function biker(def) {
  const run = [0, 1, 2, 3].map((i) => bikerFrame(def, i));
  return { idle: run[0], run, hot: bikerFrame(def, 0, true), w: 40, h: 24, ox: 20 };
}

export function registerModern(painters) {
  painters.snowmobile = snowmobile;
  painters.rack = rack;
  painters.ceilgun = ceilgun;
  painters.copter = copter;
  painters.hound = hound;
  painters.sentinel = sentinel;
  painters.orb = orb;
  painters.biker = biker;
}
