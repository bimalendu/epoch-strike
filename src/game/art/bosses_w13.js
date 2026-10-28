// Boss art for Week 13: the Missile Silo Mech (level 17), the Gunship Helicopter (18) and the AI Core Hydra (19).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade, mix } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const NEON = '#ff4ad8';
const CYAN = '#4af0ff';

// ---------------------------------------------------------------------------------------------------------------
// Missile Silo Mech
// ---------------------------------------------------------------------------------------------------------------
const SILO_MARKS = [
  { x: -30, y: -100, kind: 'crack', phase: 1 },
  { x: 14, y: -104, kind: 'plate', phase: 1 },
  { x: 24, y: -56, kind: 'scorch', phase: 1 },
  { x: -20, y: -108, kind: 'smoke', phase: 2 },
  { x: 14, y: -44, kind: 'crack', phase: 2 },
  { x: 24, y: -110, kind: 'spark', phase: 2 },
];

function drawSiloMech(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const t = e.bs ? e.bs.age : 0;
  const f = e.face;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const body = burn(pose.rage ? '#6a5258' : '#566678');
  const dark = shade(body, -0.38);
  const light = shade(body, 0.3);
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = (walking && frame % 2 === 1 ? 1 : 0) + (breathe(pose, 1) > 0 ? 1 : 0);
  const meltdown = atk === 'meltdown' && act;
  const flashRed = (meltdown || (atk === 'salvo' && state === 'tele')) && flick(t, 10) % 2 === 0;
  const fly = dead.fly;
  const k2 = dead.k * dead.k * 40;

  // ---- legs: the front one lifts for a stomp
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  const lift = atk === 'stomp' && state === 'tele' ? Math.round(20 * tele) : 0;
  B.part(-26 + la, -50, 15, 44, dark);
  B.part(-30 + la, -8, 26, 8, shade(dark, -0.3));
  B.part(8 + lb, -50 - lift, 15, 44, body);
  B.part(4 + lb, -8 - lift, 28, 8, dark);
  for (const hy of [-36, -24]) B.r(8 + lb, hy - lift, 15, 2, dark); // hydraulic bands
  // ---- pelvis
  B.part(-32, -62 - bob, 64, 14, dark);
  // ---- torso
  B.part(-36, -106 - bob, 72, 46, body);
  B.r(-36, -106 - bob, 3, 46, dark);
  B.r(30, -106 - bob, 6, 46, dark);
  for (const rx of [-30, -18, 10, 22]) B.r(rx, -64 - bob, 2, 2, light); // rivets
  // painted hazard stripe across the belly
  for (let i = 0; i < 6; i++) B.r(-34 + i * 12, -62 - bob, 6, 2, burn('#e8b82a'));
  // ---- reactor core behind shutters: the weak point rect is x -6..26, y -94..-60
  B.part(-8, -96, 36, 38, '#14141f');
  const core = meltdown ? '#ff3a2a' : NEON;
  weakPoint(B, -6, -94, 32, 34, { open, col: core, age: t, hit: e.flash });
  if (open) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    B.disc(10, -77, 15, meltdown ? '#ff3a2a' : shade(NEON, -0.25));
    B.disc(10, -77, 10, meltdown ? '#ff9a3a' : NEON);
    B.disc(10, -77, 5, pulse > 0.5 ? '#ffffff' : '#ffd0f4');
  } else {
    B.r(8, -80, 4, 4, flashRed ? '#ff3a2a' : '#5a1a1a');
  }
  // ---- head: a sensor dome at the front of the roof; it is thrown clear when the mech dies
  const hx = Math.round(dead.fly * 0.5);
  const hyy = -Math.round(fly * 0.9 - k2);
  B.part(8 + hx, -120 - bob + hyy, 22, 14, dark);
  B.r(14 + hx, -116 - bob + hyy, 16, 4, '#14141f');
  const lamp = dead.k > 0.2 ? '#4a1a1a' : pose.rage || act ? '#ff3a3a' : blink(t, 1.1) ? '#14141f' : '#ffd23a';
  B.r(18 + hx, -115 - bob + hyy, 12, 2, lamp);
  B.r(12 + hx, -128 - bob + hyy, 2, 8, dark);
  B.r(10 + hx, -130 - bob + hyy, 6, 2, flashRed ? '#ff3a2a' : '#c8d0d8');
  // ---- the shoulder racks at the back: lids lift to show the missile noses
  const lidsOpen = (atk === 'salvo' || atk === 'silo') && act;
  const lid = lidsOpen ? Math.round(10 * Math.min(1, tele + 0.2)) : 0;
  const rx0 = -Math.round(fly * 0.4);
  const ry0 = -Math.round(fly * 0.6 - k2);
  B.part(-36 + rx0, -118 - bob + ry0, 32, 14, dark);
  if (lidsOpen) {
    B.r(-38, -126 - bob - lid / 2, 4, 12, shade(body, 0.1));
    B.r(-6, -126 - bob - lid / 2, 4, 12, shade(body, 0.1));
    for (let i = 0; i < 4; i++) {
      B.r(-34 + i * 8, -124 - bob - lid / 2, 4, 8, '#e8ecf0');
      B.r(-34 + i * 8, -128 - bob - lid / 2, 4, 4, Math.floor(t * 12 + i) % 2 ? '#ff3a2a' : '#c0262e');
    }
  } else {
    for (let i = 0; i < 4; i++) B.r(-34 + i * 8 + rx0, -116 - bob + ry0, 4, 2, '#8a94a4');
  }
  // ---- the silo vent on the roof: a column of heat while it launches, a thin steam wisp while it idles
  if (atk === 'silo' && act) {
    const h = 14 + Math.round(26 * Math.min(1, tele));
    B.r(-30, -118 - bob - h, 8, h, '#ff9a3a');
    B.r(-28, -118 - bob - h, 4, h, '#ffee9a');
  } else if (state === 'idle') {
    const u = (t * 0.6) % 1;
    B.disc(-26 + Math.round(Math.sin(t * 3) * 2), -122 - bob - Math.round(u * 16), 1 + Math.round(u * 2), u < 0.6 ? '#c8d0d8' : '#8a94a4');
  }
  // ---- gatling arm on the facing side
  let gx = 0.8;
  let gy = 0.55;
  if (e.gaX !== undefined && atk === 'gatling' && act) {
    gx = e.gaX * f;
    gy = e.gaY;
  } else if (atk === 'gatling' && state === 'tele') {
    gx = 0.95;
    gy = 0.1;
  }
  if (dead.k > 0) {
    gx = 0.5;
    gy = 0.85;
  }
  const sx = 34;
  const sy = -88 - bob;
  B.disc(sx, sy, 7, dark);
  B.disc(sx, sy, 4, light);
  const len = 24;
  const ex = sx + gx * len;
  const ey = sy + gy * len;
  B.stroke(sx, sy, ex, ey, dark, 8);
  B.line(sx + 2, sy - 2, ex, ey - 2, body, 4);
  const spin = Math.floor(t * 40) % 3;
  for (let i = -1; i <= 1; i++) {
    const ox = -gy * i * 2.5;
    const oy = gx * i * 2.5;
    B.line(ex + ox, ey + oy, ex + gx * 8 + ox, ey + gy * 8 + oy, i === spin - 1 ? '#e8ecf0' : '#6a727e', 2);
  }
  if (atk === 'gatling' && state === 'attack' && Math.floor(t * 30) % 2 === 0) B.disc(ex + gx * 11, ey + gy * 11, 3, '#ffe27a');
  // ---- stomp: the planted leg throws a ring of dust (a hint that the core is open)
  if (atk === 'stomp' && state === 'attack' && e.sm && e.sm.stuck) {
    for (let i = 0; i < 3; i++) B.r(26 + i * 6, -4 - i * 2, 6, 3, '#c8c0a8');
  }
  // ---- meltdown: glowing seams all over the hull
  if (meltdown) {
    for (const sy2 of [-100, -86, -70]) B.r(-34, sy2 - bob, 4, 1, flick(t, 14) % 2 ? '#ff9a3a' : '#ff3a2a');
    for (const sy2 of [-96, -80]) B.r(28, sy2 - bob, 6, 1, '#ff9a3a');
  }
  damageMarks(B, pose, SILO_MARKS);
}

// ---------------------------------------------------------------------------------------------------------------
// Gunship Helicopter
// ---------------------------------------------------------------------------------------------------------------
const GUNSHIP_MARKS = [
  { x: -8, y: -42, kind: 'crack', phase: 1 },
  { x: 36, y: -36, kind: 'plate', phase: 1 },
  { x: -56, y: -30, kind: 'scorch', phase: 1 },
  { x: -52, y: -34, kind: 'smoke', phase: 2 },
  { x: 2, y: -56, kind: 'smoke', phase: 2 },
  { x: -20, y: -34, kind: 'spark', phase: 2 },
];

function drawGunship(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const t = e.bs ? e.bs.age : 0;
  const { atk, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const hull = burn(pose.rage ? '#4a2a4c' : '#3a3a5a');
  const dark = shade(hull, -0.4);
  const light = shade(hull, 0.35);
  const spin = dead.k > 0.5 ? 0 : Math.floor(t * 30) % 2; // the rotor winds down as it dies
  const podsOut = atk === 'rockets' && act;
  const firing = atk === 'strafe' && state === 'attack';
  const bob = breathe(pose, 1) > 0 ? 1 : 0;
  const fly = dead.fly;
  const k2 = dead.k * dead.k * 40;

  // ---- main rotor: a blurred disc, two shades alternating; it lifts off the mast when the ship dies
  const ry = -Math.round(fly * 0.5 - k2 * 0.5) - bob;
  const rx = Math.round(fly * 0.3);
  B.r(-54 + spin * 5 + rx, -50 + ry, 108 - spin * 10, 1, '#d8e0f0');
  B.r(-46 + spin * 3 + rx, -49 + ry, 92 - spin * 6, 1, '#8a92b0');
  B.part(-4, -48 - bob, 8, 9, '#5a5e72');
  B.r(-8, -41 - bob, 16, 3, dark);
  // ---- tail boom, fin and tail rotor
  const tx = -Math.round(fly * 0.35);
  const ty = Math.round(dead.k * 8);
  B.part(-72 + tx, -32 + ty, 46, 9, hull);
  B.part(-76 + tx, -50 + ty, 7, 24, hull);
  B.r(-80 + tx, -40 + spin * 6 + ty, 2, 14, '#d8e0f0');
  B.r(-24, -32, 4, 6, dark);
  // ---- fuselage
  B.part(-30, -46 - bob, 64, 32, hull);
  B.r(-26, -45 - bob, 56, 1, light);
  B.part(34, -40 - bob, 10, 22, hull);
  B.part(44, -32 - bob, 6, 12, hull);
  B.r(-30, -26 - bob, 64, 2, pose.rage ? '#ff3a3a' : NEON);
  // engine cowling
  B.part(-18, -56 - bob, 30, 9, dark);
  for (let i = 0; i < 5; i++) B.r(-14 + i * 6, -54 - bob, 2, 5, '#14141f');
  // exhaust: a warm shimmer that drifts off the cowling while it hovers
  if (state === 'idle') {
    const u = (t * 0.8) % 1;
    B.disc(-18 - Math.round(u * 10), -58 - bob - Math.round(u * 4), 1 + (u > 0.5 ? 1 : 0), u < 0.5 ? '#ffb86a' : '#8a8aa6');
  }
  // ---- cockpit canopy: it glows when the soldier can hit it
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);
  B.part(20, -44 - bob, 24, 20, open ? shade(CYAN, -0.1) : '#2a5a7a');
  B.r(21, -43 - bob, 22, 2, '#d8fbff');
  B.r(24, -38 - bob, 6, 8, '#14141f'); // the pilot, a silhouette
  B.r(28, -40 - bob, 4, 4, '#14141f');
  if (open) {
    ctx.globalAlpha = 0.35 + 0.25 * pulse;
    B.r(18, -46 - bob, 28, 24, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // ---- avionics bay under the cabin: the weak point rect x -4..32, y -30..-2
  weakPoint(B, -4, -30, 36, 28, { open, col: CYAN, age: t, hit: e.flash });
  // ---- stub wings with rocket pods; the pods swing out and show their missiles when they are about to fire
  B.part(-14, -18, 36, 5, dark);
  B.part(-12, podsOut ? -14 : -13, 32, 8, '#2a2a3a');
  for (let i = 0; i < 4; i++) {
    B.r(-10 + i * 8, podsOut ? -12 : -11, 5, 5, '#8a8aa6');
    if (podsOut) B.r(-10 + i * 8, -8, 5, 3, Math.floor(t * 12 + i) % 2 ? '#ff3a2a' : '#c0262e');
  }
  // ---- chin turret under the nose
  B.part(-4, -12, 36, 4, open ? '#2a2a3a' : '#6a6e8a');
  B.part(24, -8, 16, 3, '#8a8aa6');
  B.r(36, -9, 4, 5, '#2a2a3a');
  if (firing && Math.floor(t * 34) % 2 === 0) B.disc(42, -7, 3, '#ffe27a');
  // ---- skids
  B.r(-26, -3, 62, 2, '#2a2a38');
  B.r(-26, -3, 62, 1, '#4a4a5c');
  B.r(-18, -9, 2, 7, '#2a2a38');
  B.r(24, -9, 2, 7, '#2a2a38');
  damageMarks(B, pose, GUNSHIP_MARKS);
}

// ---------------------------------------------------------------------------------------------------------------
// AI Core Hydra
// ---------------------------------------------------------------------------------------------------------------
const BASES = [
  { x: 38, y: -84 },
  { x: 28, y: -92 },
  { x: 42, y: -64 },
];

const HYDRA_MARKS = [
  { x: -30, y: -90, kind: 'crack', phase: 1 },
  { x: -10, y: -64, kind: 'plate', phase: 1 },
  { x: 20, y: -96, kind: 'scorch', phase: 1 },
  { x: -34, y: -60, kind: 'smoke', phase: 2 },
  { x: 2, y: -36, kind: 'crack', phase: 2 },
  { x: -22, y: -28, kind: 'spark', phase: 2 },
];

function drawHydra(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const t = e.bs ? e.bs.age : 0;
  const f = e.face;
  const { atk, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const stack = burn(pose.rage ? '#4a3a58' : '#3a3a5a');
  const dark = shade(stack, -0.4);
  const light = shade(stack, 0.4);
  const hot = pose.rage ? '#ff3a5a' : NEON;
  const stuck = e.lg && e.lg.mode === 'stuck' ? e.lg.i : -1;
  const chestOpen = open && stuck < 0;
  const fly = dead.fly;
  const k2 = dead.k * dead.k * 40;
  const lightsOut = dead.k > 0.25;

  // ---- the server stack: a tall rack with rows of blinking lights
  B.part(-50, -10, 100, 10, dark);
  B.part(-44, -96, 88, 88, stack);
  B.r(-44, -96, 3, 88, dark);
  B.r(41, -96, 3, 88, dark);
  for (let row = 0; row < 9; row++) {
    const y = -90 + row * 9;
    B.r(-40, y, 80, 1, dark);
    for (let c = 0; c < 6; c++) {
      const on = !lightsOut && Math.floor(t * 4 + row * 1.7 + c * 2.3) % 3 === 0;
      B.r(-37 + c * 5, y + 3, 2, 2, on ? (c % 2 ? CYAN : hot) : shade(stack, -0.15));
    }
  }
  // the roof cap lifts off when the stack dies; a vent on it breathes out a wisp
  const cy2 = -Math.round(fly * 0.8 - k2);
  const cxo = -Math.round(fly * 0.3);
  B.part(-44 + cxo, -104 + cy2, 88, 8, dark);
  if (state === 'idle') {
    const u = (t * 0.7) % 1;
    B.disc(-30 + Math.round(Math.sin(t * 2.5) * 2), -108 - Math.round(u * 14), 1 + Math.round(u * 2), u < 0.6 ? '#9a9ac0' : '#6a6a8a');
  }
  // ---- the eye in the chest (x 14..46, y -52..-14): open or shuttered
  B.r(12, -54, 36, 42, '#14141f');
  weakPoint(B, 14, -52, 32, 38, { open: chestOpen, col: hot, age: t, hit: e.flash });
  if (chestOpen) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    B.disc(30, -33, 15, shade(hot, -0.3));
    B.disc(30, -33, 10, hot);
    B.disc(30, -33, 5, pulse > 0.5 ? '#ffffff' : '#ffd0f4');
  } else if (!blink(t, 0.6)) {
    B.r(28, -36, 4, 4, '#5a1a2a');
  }
  // ---- necks and heads (absolute positions come from the attack code)
  if (e.hd) {
    for (let i = 0; i < 3; i++) {
      const h = e.hd[i];
      const hx = (h.x - e.x) * f;
      const hy = h.y - e.y + Math.round(dead.k * dead.k * 18); // the heads droop as the stack dies
      const b = BASES[i];
      // a quadratic curve from the stack to the head, bowing upward
      const kx = (b.x + hx) / 2 + 6;
      const ky = Math.min(b.y, hy) - 22;
      // a stuck head's weak point sits behind it, so the glow frames the head
      if (i === stuck) weakPoint(B, hx - 16, hy - 22, 32, 26, { open, col: hot, age: t, hit: e.flash });
      let px = b.x;
      let py = b.y;
      for (let s = 1; s <= 12; s++) {
        const u = s / 12;
        const qx = (1 - u) * (1 - u) * b.x + 2 * (1 - u) * u * kx + u * u * hx;
        const qy = (1 - u) * (1 - u) * b.y + 2 * (1 - u) * u * ky + u * u * hy;
        B.stroke(px, py, qx, qy, dark, 7);
        B.line(px, py - 1, qx, qy - 1, burn(s % 2 ? '#5a5a82' : '#6a6a96'), 4);
        if (s % 3 === 0) B.r(Math.round(qx) - 1, Math.round(qy) - 1, 2, 2, i === stuck ? '#ffffff' : lightsOut ? '#26263a' : CYAN);
        px = qx;
        py = qy;
      }
      // the head: a wedge with a visor and a jaw that opens when it attacks
      const spitting = atk === 'spit' && act;
      const slam = i === 0 && atk === 'lunge' && act;
      const mouth = spitting || slam ? 5 : 1;
      B.part(hx - 12, hy - 8, 26, 12, burn('#4a4a6a'));
      B.part(hx + 12, hy - 5, 7, 7, burn('#4a4a6a'));
      B.r(hx - 6, hy - 6, 14, 3, '#14141f');
      B.r(hx - 2, hy - 5, 10, 1, lightsOut ? '#26263a' : i === stuck || (i === 1 && atk === 'sweep' && act) ? '#ffffff' : hot);
      B.r(hx - 10, hy + 4, 24, mouth, '#26263a');
      for (let k = 0; k < 4; k++) B.r(hx - 6 + k * 6, hy + 4, 2, 2, '#e8ecf0');
      if (i === 1 && atk === 'sweep' && act) {
        // the beam emitter charges
        B.disc(hx + 20, hy - 1, 3 + Math.floor(Math.sin(t * 30) + 1), '#ffffff');
      }
      if (i === stuck) {
        // the stuck head sparks
        if (flick(t, 12) % 2 === 0) B.r(hx - 14, hy - 12, 4, 2, '#ffe27a');
        B.r(hx + 6, hy - 11, 3, 3, '#ffe27a');
      }
    }
  }
  damageMarks(B, pose, HYDRA_MARKS);
}

export function registerBossesW13(painters) {
  painters.silomech = () => bossFrames(110, 150, drawSiloMech);
  painters.gunship = () => bossFrames(170, 70, drawGunship);
  painters.hydra = () => bossFrames(260, 190, drawHydra);
}
