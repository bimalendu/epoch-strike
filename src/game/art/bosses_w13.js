// Boss art for Week 13: the Missile Silo Mech (level 17), the Gunship Helicopter (18) and the AI Core Hydra (19).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';

const NEON = '#ff4ad8';
const CYAN = '#4af0ff';

// ---------------------------------------------------------------------------------------------------------------
// Missile Silo Mech
// ---------------------------------------------------------------------------------------------------------------
function drawSiloMech(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const f = e.face;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const body = pose.rage ? '#6a5258' : '#566678';
  const dark = shade(body, -0.38);
  const light = shade(body, 0.3);
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
  const meltdown = atk === 'meltdown' && act;
  const flashRed = (meltdown || (atk === 'salvo' && state === 'tele')) && flick(t, 10) % 2 === 0;

  // ---- legs: the front one lifts for a stomp
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  const lift = atk === 'stomp' && state === 'tele' ? Math.round(20 * tele) : 0;
  B.r(-26 + la, -50, 15, 44, dark);
  B.r(-30 + la, -8, 26, 8, shade(dark, -0.3));
  B.r(-26 + la, -50, 15, 2, light);
  B.r(8 + lb, -50 - lift, 15, 44, body);
  B.r(8 + lb, -50 - lift, 15, 2, light);
  B.r(4 + lb, -8 - lift, 28, 8, dark);
  B.r(4 + lb, -8 - lift, 28, 1, light);
  for (const hy of [-36, -24]) B.r(8 + lb, hy - lift, 15, 2, dark); // hydraulic bands
  // ---- pelvis
  B.r(-32, -62 - bob, 64, 14, dark);
  B.r(-32, -62 - bob, 64, 2, light);
  // ---- torso
  B.r(-36, -106 - bob, 72, 46, body);
  B.r(-36, -106 - bob, 72, 3, light);
  B.r(-36, -106 - bob, 3, 46, dark);
  B.r(30, -106 - bob, 6, 46, dark);
  for (const rx of [-30, -18, 10, 22]) B.r(rx, -64 - bob, 2, 2, light); // rivets
  // painted hazard stripe across the belly
  for (let i = 0; i < 6; i++) B.r(-34 + i * 12, -62 - bob, 6, 2, '#e8b82a');
  // ---- reactor core behind shutters: x -6..26, y -94..-60
  B.r(-8, -96 - bob, 36, 38, '#14141f');
  if (open) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    B.disc(10, -77 - bob, 15, meltdown ? '#ff3a2a' : shade(NEON, -0.25));
    B.disc(10, -77 - bob, 10, meltdown ? '#ff9a3a' : NEON);
    B.disc(10, -77 - bob, 5, pulse > 0.5 ? '#ffffff' : '#ffd0f4');
  } else {
    B.r(-6, -94 - bob, 32, 34, '#4a5260');
    for (let y = -92; y < -62; y += 6) B.r(-6, y - bob, 32, 2, '#2a3038');
    B.r(-6, -94 - bob, 32, 1, '#8a94a4');
    B.r(8, -80 - bob, 4, 4, flashRed ? '#ff3a2a' : '#5a1a1a');
  }
  // ---- head: a sensor dome at the front of the roof
  B.r(8, -120 - bob, 22, 14, dark);
  B.r(8, -120 - bob, 22, 2, light);
  B.r(14, -116 - bob, 16, 4, '#14141f');
  B.r(18, -115 - bob, 12, 2, pose.rage || act ? '#ff3a3a' : '#ffd23a');
  B.r(12, -128 - bob, 2, 8, dark);
  B.r(10, -130 - bob, 6, 2, flashRed ? '#ff3a2a' : '#c8d0d8');
  // ---- the shoulder racks at the back: lids lift to show the missile noses
  const lidsOpen = (atk === 'salvo' || atk === 'silo') && act;
  const lid = lidsOpen ? Math.round(10 * Math.min(1, tele + 0.2)) : 0;
  B.r(-36, -118 - bob, 32, 14, dark);
  B.r(-36, -118 - bob, 32, 2, light);
  if (lidsOpen) {
    B.r(-38, -126 - bob - lid / 2, 4, 12, shade(body, 0.1));
    B.r(-6, -126 - bob - lid / 2, 4, 12, shade(body, 0.1));
    for (let i = 0; i < 4; i++) {
      B.r(-34 + i * 8, -124 - bob - lid / 2, 4, 8, '#e8ecf0');
      B.r(-34 + i * 8, -128 - bob - lid / 2, 4, 4, Math.floor(t * 12 + i) % 2 ? '#ff3a2a' : '#c0262e');
    }
  } else {
    for (let i = 0; i < 4; i++) B.r(-34 + i * 8, -116 - bob, 4, 2, '#8a94a4');
  }
  // ---- the silo vent on the roof: a column of heat while it launches
  if (atk === 'silo' && act) {
    const h = 14 + Math.round(26 * Math.min(1, tele));
    B.r(-30, -118 - bob - h, 8, h, '#ff9a3a');
    B.r(-28, -118 - bob - h, 4, h, '#ffee9a');
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
  const sx = 34;
  const sy = -88 - bob;
  B.disc(sx, sy, 7, dark);
  B.disc(sx, sy, 4, light);
  const len = 24;
  const ex = sx + gx * len;
  const ey = sy + gy * len;
  B.line(sx, sy, ex, ey, dark, 8);
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
}

// ---------------------------------------------------------------------------------------------------------------
// Gunship Helicopter
// ---------------------------------------------------------------------------------------------------------------
function drawGunship(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const { atk, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const hull = pose.rage ? '#4a2a4c' : '#3a3a5a';
  const dark = shade(hull, -0.4);
  const light = shade(hull, 0.35);
  const spin = Math.floor(t * 30) % 2;
  const podsOut = atk === 'rockets' && act;
  const firing = atk === 'strafe' && state === 'attack';

  // ---- main rotor: a blurred disc, two shades alternating
  B.r(-54 + spin * 5, -50, 108 - spin * 10, 1, '#d8e0f0');
  B.r(-46 + spin * 3, -49, 92 - spin * 6, 1, '#8a92b0');
  B.r(-4, -48, 8, 9, '#5a5e72');
  B.r(-8, -41, 16, 3, dark);
  // ---- tail boom, fin and tail rotor
  B.r(-72, -32, 46, 9, hull);
  B.r(-72, -32, 46, 1, light);
  B.r(-72, -23, 46, 1, dark);
  B.r(-76, -50, 7, 24, hull);
  B.r(-76, -50, 7, 1, light);
  B.r(-80, -40 + spin * 6, 2, 14, '#d8e0f0');
  B.r(-24, -32, 4, 6, dark);
  // ---- fuselage
  B.r(-30, -44, 66, 32, dark);
  B.r(-30, -46, 64, 32, hull);
  B.r(-26, -48, 56, 3, light);
  B.r(34, -40, 10, 22, hull);
  B.r(44, -32, 6, 12, hull);
  B.r(-30, -26, 64, 2, pose.rage ? '#ff3a3a' : NEON);
  // engine cowling
  B.r(-18, -56, 30, 9, dark);
  B.r(-18, -56, 30, 1, light);
  for (let i = 0; i < 5; i++) B.r(-14 + i * 6, -54, 2, 5, '#14141f');
  // ---- cockpit canopy: it glows when the soldier can hit it
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);
  B.r(20, -44, 24, 20, open ? shade(CYAN, -0.1) : '#2a5a7a');
  B.r(20, -44, 24, 3, '#d8fbff');
  B.r(24, -38, 6, 8, '#14141f'); // the pilot, a silhouette
  B.r(28, -40, 4, 4, '#14141f');
  if (open) {
    ctx.globalAlpha = 0.35 + 0.25 * pulse;
    B.r(18, -46, 28, 24, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // ---- stub wings with rocket pods; the pods swing out and show their missiles when they are about to fire
  B.r(-14, -18, 36, 5, dark);
  B.r(-14, -18, 36, 1, light);
  B.r(-12, podsOut ? -14 : -13, 32, 8, '#2a2a3a');
  for (let i = 0; i < 4; i++) {
    B.r(-10 + i * 8, podsOut ? -12 : -11, 5, 5, '#8a8aa6');
    if (podsOut) B.r(-10 + i * 8, -8, 5, 3, Math.floor(t * 12 + i) % 2 ? '#ff3a2a' : '#c0262e');
  }
  // ---- chin turret under the nose
  B.r(-4, -12, 36, 4, open ? '#2a2a3a' : '#6a6e8a');
  B.r(24, -8, 16, 3, '#8a8aa6');
  B.r(36, -9, 4, 5, '#2a2a3a');
  if (firing && Math.floor(t * 34) % 2 === 0) B.disc(42, -7, 3, '#ffe27a');
  // ---- skids
  B.r(-26, -3, 62, 2, '#2a2a38');
  B.r(-18, -9, 2, 7, '#2a2a38');
  B.r(24, -9, 2, 7, '#2a2a38');
}

// ---------------------------------------------------------------------------------------------------------------
// AI Core Hydra
// ---------------------------------------------------------------------------------------------------------------
const BASES = [
  { x: 38, y: -84 },
  { x: 28, y: -92 },
  { x: 42, y: -64 },
];

function drawHydra(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const f = e.face;
  const { atk, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const stack = pose.rage ? '#4a3a58' : '#3a3a5a';
  const dark = shade(stack, -0.4);
  const light = shade(stack, 0.4);
  const hot = pose.rage ? '#ff3a5a' : NEON;
  const stuck = e.lg && e.lg.mode === 'stuck' ? e.lg.i : -1;

  // ---- the server stack: a tall rack with rows of blinking lights
  B.r(-50, -10, 100, 10, dark);
  B.r(-44, -96, 88, 88, stack);
  B.r(-44, -96, 88, 3, light);
  B.r(-44, -96, 3, 88, dark);
  B.r(41, -96, 3, 88, dark);
  for (let row = 0; row < 9; row++) {
    const y = -90 + row * 9;
    B.r(-40, y, 80, 1, dark);
    for (let c = 0; c < 6; c++) {
      const on = Math.floor(t * 4 + row * 1.7 + c * 2.3) % 3 === 0;
      B.r(-37 + c * 5, y + 3, 2, 2, on ? (c % 2 ? CYAN : hot) : shade(stack, -0.15));
    }
  }
  B.r(-44, -104, 88, 8, dark);
  B.r(-44, -104, 88, 1, light);
  // ---- the eye in the chest (x 14..46, y -52..-14): open or shuttered
  B.r(12, -54, 36, 42, '#14141f');
  if (open) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    B.disc(30, -33, 15, shade(hot, -0.3));
    B.disc(30, -33, 10, hot);
    B.disc(30, -33, 5, pulse > 0.5 ? '#ffffff' : '#ffd0f4');
  } else {
    B.r(14, -52, 32, 38, '#4a4a68');
    for (let y = -50; y < -16; y += 6) B.r(14, y, 32, 2, '#26263a');
    B.r(14, -52, 32, 1, '#9aa0c8');
    B.r(28, -36, 4, 4, '#5a1a2a');
  }
  // ---- necks and heads (absolute positions come from the attack code)
  if (!e.hd) return;
  for (let i = 0; i < 3; i++) {
    const h = e.hd[i];
    const hx = (h.x - e.x) * f;
    const hy = h.y - e.y;
    const b = BASES[i];
    // a quadratic curve from the stack to the head, bowing upward
    const kx = (b.x + hx) / 2 + 6;
    const ky = Math.min(b.y, hy) - 22;
    let px = b.x;
    let py = b.y;
    for (let s = 1; s <= 12; s++) {
      const u = s / 12;
      const qx = (1 - u) * (1 - u) * b.x + 2 * (1 - u) * u * kx + u * u * hx;
      const qy = (1 - u) * (1 - u) * b.y + 2 * (1 - u) * u * ky + u * u * hy;
      B.line(px, py, qx, qy, dark, 7);
      B.line(px, py - 1, qx, qy - 1, s % 2 ? '#5a5a82' : '#6a6a96', 4);
      if (s % 3 === 0) B.r(Math.round(qx) - 1, Math.round(qy) - 1, 2, 2, i === stuck ? '#ffffff' : CYAN);
      px = qx;
      py = qy;
    }
    // the head: a wedge with a visor and a jaw that opens when it attacks
    const spitting = atk === 'spit' && act;
    const slam = i === 0 && (atk === 'lunge' && act);
    const mouth = spitting || slam ? 5 : 1;
    B.r(hx - 12, hy - 8, 26, 12, '#4a4a6a');
    B.r(hx - 12, hy - 8, 26, 2, '#9aa0c8');
    B.r(hx + 12, hy - 5, 7, 7, '#4a4a6a');
    B.r(hx - 6, hy - 6, 14, 3, '#14141f');
    B.r(hx - 2, hy - 5, 10, 1, i === stuck || (i === 1 && atk === 'sweep' && act) ? '#ffffff' : hot);
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

export function registerBossesW13(painters) {
  painters.silomech = () => bossFrames(110, 150, drawSiloMech);
  painters.gunship = () => bossFrames(170, 70, drawGunship);
  painters.hydra = () => bossFrames(260, 190, drawHydra);
}
