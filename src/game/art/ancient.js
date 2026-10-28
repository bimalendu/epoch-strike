// Painters for the ancient-world enemies that are not plain humanoids: the scarab, the war elephant and the
// rival chariot. Sprites face right; drawEnemy mirrors them when the enemy faces left.

import { Painter, blit } from '../../engine/gfx.js';
import { VIEW_W } from '../constants.js';
import { shade } from './common.js';

// ---- scarab beetle (runner that leaps) ----
function scarabFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(16, 12);
  const B = hot ? shade(pal.body, 0.35) : pal.body;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const o = frame < 0 ? [0, 0, 0] : [[1, -1, 1], [0, 0, 0], [-1, 1, -1], [0, 0, 0]][frame];
  // legs
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 3;
    p.rect(x + o[i], 9, 1, 3, '#14202a');
  }
  // shell
  p.ellipse(8, 7 + bob, 6, 4, B);
  p.rect(3, 8 + bob, 11, 1, shade(B, -0.4));
  p.rect(8, 3 + bob, 1, 8, shade(B, -0.45));
  p.rect(5, 4 + bob, 2, 1, pal.shell);
  p.rect(10, 4 + bob, 2, 1, pal.shell);
  // head with pincers
  p.rect(13, 6 + bob, 3, 3, shade(B, -0.3));
  p.px(14, 7 + bob, '#ff4a4a');
  p.rect(15, 9 + bob, 1, 2, '#e8e0c0');
  return p.canvas;
}

function scarab(def) {
  const run = [0, 1, 2, 3].map((i) => scarabFrame(def, i));
  return { idle: scarabFrame(def, -1), run, hot: scarabFrame(def, -1, true), w: 16, h: 12, ox: 8 };
}

// ---- war elephant (charger) ----
function elephantFrame(def, frame, { hot = false, rear = false } = {}) {
  const pal = def.pal;
  const W = 72;
  const H = 56;
  const p = new Painter(W, H);
  const B = hot ? shade(pal.body, 0.35) : pal.body;
  const D = shade(B, -0.35);
  const lift = rear ? 6 : 0; // front of the body rises when it rears
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const gait = frame < 0 ? [0, 0, 0, 0] : [[3, -3, -3, 3], [0, 0, 0, 0], [-3, 3, 3, -3], [0, 0, 0, 0]][frame];
  // legs (back pair darker)
  const leg = (x, dx, col) => {
    p.rect(x + dx, 40, 8, 16, col);
    p.rect(x + dx, 53, 8, 3, shade(col, -0.3));
    p.rect(x + dx + 1, 53, 6, 1, '#e8e0c8'); // toenails
  };
  leg(12, gait[0], D);
  leg(26, gait[1], B);
  leg(44, gait[2], D);
  leg(56, gait[3], B);
  // body
  p.ellipse(34, 30 + bob, 28, 15, B);
  p.rect(10, 38 + bob, 50, 2, D);
  // war blanket and howdah
  p.rect(16, 18 + bob, 36, 14, pal.cloth);
  p.rect(16, 18 + bob, 36, 2, shade(pal.cloth, 0.35));
  p.rect(16, 30 + bob, 36, 2, pal.trim);
  for (let x = 18; x < 50; x += 6) p.rect(x, 24 + bob, 3, 3, pal.trim);
  p.rect(24, 8 + bob, 20, 11, '#8a5a2a');
  p.rect(24, 8 + bob, 20, 2, '#c8944a');
  p.rect(26, 6 + bob, 2, 3, pal.trim);
  p.rect(40, 6 + bob, 2, 3, pal.trim);
  // head, trunk, tusk, ear
  const hy = 14 - lift;
  p.ellipse(56, hy + 10 + bob, 11, 11, B);
  p.ellipse(50, hy + 12 + bob, 6, 9, D); // ear
  p.rect(62, hy + 12 + bob, 6, 8 - (rear ? 0 : 0), B);
  p.rect(66, hy + 19 + bob, 5, 12 + (rear ? 4 : 0), B);
  p.rect(68, hy + 30 + bob + (rear ? 4 : 0), 4, 3, D);
  p.rect(60, hy + 19 + bob, 9, 2, '#e8e0c8'); // tusk
  p.rect(67, hy + 16 + bob, 3, 4, '#e8e0c8');
  p.rect(58, hy + 7 + bob, 3, 3, '#ffe27a');
  p.px(59, hy + 8 + bob, '#111111');
  p.rect(53, hy + bob, 12, 3, pal.cloth); // headpiece
  p.rect(53, hy + bob, 12, 1, pal.trim);
  // tail
  p.rect(5, 26 + bob, 3, 10, D);
  return p.canvas;
}

function drawElephant(ctx, e, ox, oy, f) {
  let img = e.state === 'charge' ? f.run[Math.floor(e.anim * 1.6) % f.run.length]
    : Math.abs(e.vx) > 1 ? f.run[Math.floor(e.anim) % f.run.length] : f.idle;
  if (e.state === 'tele') img = Math.floor(e.t * 14) % 2 === 0 ? f.hotRear : f.rear;
  if (e.flash > 0 && Math.floor(e.flash * 60) % 2 === 0) ctx.globalAlpha = 0.45;
  blit(ctx, img, e.x - ox - f.ox, e.y - oy - f.h, e.face < 0, false);
  ctx.globalAlpha = 1;
  if (e.state === 'charge' && Math.floor(e.anim * 3) % 2 === 0) {
    // dust kicked up behind it
    ctx.fillStyle = '#c8b080';
    const bx = Math.round(e.x - ox - e.face * 34);
    ctx.fillRect(bx, Math.round(e.y - oy) - 3, 4, 3);
    ctx.fillRect(bx - e.face * 5, Math.round(e.y - oy) - 6, 3, 3);
  }
}

function elephant(def) {
  const run = [0, 1, 2, 3].map((i) => elephantFrame(def, i));
  return {
    idle: elephantFrame(def, -1),
    run,
    rear: elephantFrame(def, -1, { rear: true }),
    hotRear: elephantFrame(def, -1, { rear: true, hot: true }),
    w: 72,
    h: 56,
    ox: 36,
    draw: drawElephant,
  };
}

// ---- rival chariot: two horses and a driver, drawn directly (it crosses the whole screen) ----
function drawChariot(ctx, e, ox, oy) {
  const d = e.def;
  const dir = e.face || -1;
  const cx = Math.round(e.x - ox);
  const by = Math.round(e.y - oy);
  // a flashing marker at the screen edge while it is still off-screen and about to charge
  if (e.state === 'tele' && (cx < 4 || cx > VIEW_W - 4)) {
    const mx = cx < 4 ? 8 : VIEW_W - 12;
    ctx.fillStyle = Math.floor(e.t * 12) % 2 === 0 ? '#ff4a3a' : '#ffd23a';
    ctx.fillRect(mx, by - 40, 5, 14);
    ctx.fillRect(mx, by - 22, 5, 5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(mx + 2, by - 38, 1, 9);
  }
  // r(lx, ly, w, h): a rectangle in chariot-local space, +x toward the front of the horses
  const r = (lx, ly, w, h, col) => {
    ctx.fillStyle = col;
    const x0 = dir > 0 ? cx + lx : cx - lx - w;
    ctx.fillRect(x0, by + ly, w, h);
  };
  const t = e.state === 'charge' ? e.anim * 1.4 : e.t;
  const gallop = e.state === 'charge' ? Math.floor(t * 2) % 2 : 0;
  const pal = d.pal;
  // horses (two, one behind the other)
  for (const off of [0, -5]) {
    const body = off ? shade(pal.horse, -0.25) : pal.horse;
    r(2 + off, -22, 18, 9, body);
    r(15 + off, -27, 5, 8, body); // neck
    r(19 + off, -27, 6, 4, body); // head
    r(20 + off, -29, 2, 2, body); // ear
    r(22 + off, -26, 1, 1, '#111111');
    r(0 + off, -21, 3, 3, shade(body, -0.35)); // tail
    r(15 + off, -27, 2, 6, pal.mane);
    // legs, galloping
    r(4 + off + (gallop ? 2 : -1), -13, 3, 13, shade(body, -0.2));
    r(12 + off + (gallop ? -2 : 1), -13, 3, 13, body);
    r(8 + off, -13, 3, 12 + (gallop ? 0 : 1), shade(body, -0.35));
  }
  // yoke and chariot box
  r(-6, -17, 10, 2, '#7a5a2a');
  r(-24, -20, 20, 12, pal.body);
  r(-24, -20, 20, 2, shade(pal.body, 0.4));
  r(-24, -10, 20, 2, pal.trim);
  r(-26, -20, 3, 8, pal.trim);
  // wheel, spokes turning
  const wx = -15;
  const a = (e.x * 0.12) % Math.PI;
  ctx.fillStyle = '#3a2a1a';
  for (let i = 0; i < 6; i++) {
    const ang = a + (i * Math.PI) / 3;
    for (let k = -6; k <= 6; k += 2) {
      const sx = Math.round(Math.cos(ang) * k);
      const sy = Math.round(Math.sin(ang) * k);
      ctx.fillRect(dir > 0 ? cx + wx + sx : cx - wx - sx, by - 7 + sy, 1, 1);
    }
  }
  r(wx - 7, -8, 14, 1, '#8a6a3a');
  r(wx - 7, -1, 14, 1, '#8a6a3a');
  r(wx - 1, -8, 2, 2, '#ffd23a');
  // the driver
  r(-18, -34, 7, 14, pal.cloth);
  r(-17, -39, 6, 5, '#d89a68');
  r(-18, -42, 8, 3, pal.crest);
  r(-12, -30, 12, 1, '#dfe6ee'); // a spear held forward
}

function chariot() {
  const p = new Painter(2, 2);
  return { idle: p.canvas, run: [p.canvas], w: 44, h: 28, ox: 22, draw: drawChariot };
}

export function registerAncient(painters) {
  painters.scarab = scarab;
  painters.elephant = elephant;
  painters.chariot = chariot;
}
