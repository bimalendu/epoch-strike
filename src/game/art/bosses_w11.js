// Boss art for Week 11: the Armored Locomotive (level 13), the Iron Furnace Engine (level 14) and the War Zeppelin (level 15).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade } from './common.js';
import { brush, bossFrames } from './bosses.js';

const IRON = '#aab2c0';
const BRASS = '#c8a040';

// ---------------------------------------------------------------------------------------------------------------
// Armored Locomotive: front of the engine to the left (local +x)
// ---------------------------------------------------------------------------------------------------------------
function drawLocomotive(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && Math.floor(t * 10) % 2 === 0;
  const plate = pose.rage ? '#3a2c30' : '#2e3038';
  const plateD = shade(plate, -0.45);
  const plateL = shade(plate, 0.4);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const rolling = Math.abs(e.vx) > 2;
  const spin = (rolling ? e.x * 0.09 : t * 1.5) % (Math.PI * 2);

  // ---- frame and drive wheels, a connecting rod across them
  B.r(-60, -20, 124, 6, '#15151a');
  B.r(-60, -20, 124, 1, plateL);
  for (const wx of [-34, -6, 22]) {
    B.disc(wx, -14, 14, '#15151a');
    B.disc(wx, -14, 12, '#5a5a66');
    B.disc(wx, -14, 9, '#2a2a32');
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4;
      B.line(wx - Math.cos(a) * 11, -14 - Math.sin(a) * 11, wx + Math.cos(a) * 11, -14 + Math.sin(a) * 11, IRON, 1);
    }
    B.disc(wx, -14, 2, BRASS);
  }
  const rodY = -14 + Math.round(Math.sin(spin) * 5);
  B.r(-36, rodY - 1, 60, 3, IRON);
  // pilot wheels under the cowcatcher
  B.disc(46, -8, 7, '#15151a');
  B.disc(46, -8, 5, '#5a5a66');
  // cowcatcher: a wedge of bars
  for (let i = 0; i < 6; i++) B.r(56 + i, -20 + i * 2, 12 - i * 2, 2, i % 2 ? plateD : IRON);

  // ---- boiler: a long drum with brass bands, rounded at the front
  B.r(-24, -62, 82, 36, plate);
  B.r(-24, -62, 82, 3, plateL);
  B.r(-24, -30, 82, 4, plateD);
  B.r(58, -58, 2, 28, plate);
  B.r(60, -52, 1, 16, plateD);
  for (const x of [-12, 8, 28, 46]) {
    B.r(x, -62, 4, 36, BRASS);
    B.r(x, -62, 1, 36, shade(BRASS, 0.4));
  }
  for (let x = -22; x < 56; x += 10) for (const y of [-58, -44, -32]) B.r(x, y, 1, 1, IRON);
  if (pose.rage) {
    ctx.globalAlpha = baseAlpha * 0.35;
    B.r(-22, -60, 78, 32, hot);
    ctx.globalAlpha = baseAlpha;
  }

  // ---- smokebox door: the weak point. It glows when it is open, and is wrapped in steam when it is shut
  B.disc(50, -34, 14, '#15151a');
  B.disc(50, -34, 12, plateL);
  B.disc(50, -34, 9, open ? (flash ? '#fff2c0' : hot) : '#3a3a44');
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(50, -34, 20, hot);
    ctx.globalAlpha = baseAlpha;
    B.r(46, -38, 8, 2, '#ffe27a');
    B.r(46, -32, 8, 2, '#ffe27a');
  } else {
    B.r(44, -36, 12, 2, '#5a5a66');
    B.r(44, -32, 12, 2, '#5a5a66');
  }
  B.r(57, -35, 3, 3, BRASS); // the handle

  // ---- headlamp on top of the smokebox
  B.r(46, -78, 12, 14, '#15151a');
  B.r(47, -77, 10, 12, BRASS);
  B.r(52, -75, 5, 8, atk === 'cannon' && act ? '#ffffff' : '#ffe27a');
  B.r(44, -80, 16, 3, plateD);

  // ---- steam dome, whistle and smokestack
  B.r(-2, -72, 14, 10, BRASS);
  B.r(-2, -72, 14, 2, shade(BRASS, 0.4));
  B.r(2, -78, 6, 6, plateD);
  B.r(24, -104, 12, 42, plate);
  B.r(20, -112, 20, 8, plateD);
  B.r(20, -112, 20, 2, plateL);
  B.r(24, -104, 2, 42, plateL);
  // smoke drifting up and back from the stack
  ctx.globalAlpha = baseAlpha * 0.55;
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.9 + i * 0.2) % 1;
    B.r(30 - Math.round(ph * 24) - 6, -112 - Math.round(ph * 30) - 4, 10 + Math.round(ph * 8), 8 + Math.round(ph * 5), i % 2 ? '#6a6a76' : '#4a4a56');
  }
  ctx.globalAlpha = baseAlpha;
  if (atk === 'coal' && act) {
    B.r(26, -118 + (flash ? -2 : 0), 8, 6, flash ? '#ffd23a' : hot); // an ember at the lip
  }

  // ---- cab: tall, red-trimmed, a lit window, the gatling on its roof
  B.r(-60, -96, 38, 76, plate);
  B.r(-60, -96, 38, 3, plateL);
  B.r(-60, -96, 3, 76, plateD);
  B.r(-64, -100, 46, 6, '#8a1a20'); // roof overhang
  B.r(-64, -100, 46, 1, '#c8282e');
  B.r(-52, -84, 22, 22, '#15151a');
  B.r(-50, -82, 18, 18, pose.mid ? '#ffcc5a' : '#7ac0d8');
  B.r(-42, -82, 2, 18, '#15151a');
  B.r(-50, -74, 18, 2, '#15151a');
  for (let y = -60; y < -22; y += 8) B.r(-60, y, 38, 1, plateD);
  // gatling: a barrel cluster that turns toward the soldier
  const gx = -34;
  const gy = -106;
  B.r(gx - 5, gy - 2, 12, 6, '#15151a');
  const len = 18;
  const shoot = atk === 'cannon' && act;
  const jit = shoot ? Math.round(Math.sin(t * 60) * 1) : 0;
  B.line(gx + 6, gy + 1, gx + 6 + len, gy + 1 + jit, '#2a2a32', 3);
  B.line(gx + 6, gy, gx + 6 + len, gy + jit, IRON, 1);
  if (shoot && Math.floor(t * 30) % 2 === 0) B.r(gx + 6 + len, gy - 2 + jit, 5, 5, '#ffe27a');

  // ---- steam: vents on the boiler jet up while the steam attack winds up and runs
  if (atk === 'steam' && act) {
    ctx.globalAlpha = baseAlpha * 0.8;
    for (const x of [-8, 14, 38]) {
      B.r(x - 1, -66, 3, 4, '#c8d8e4');
      for (let i = 0; i < 4; i++) {
        const ph = (t * 3 + i * 0.25 + x * 0.01) % 1;
        B.r(x - 3 + Math.round(Math.sin(t * 7 + i) * 2), -68 - Math.round(ph * 30), 7 + Math.round(ph * 5), 6, '#f0f6fa');
      }
    }
    // and a cloud over the door
    for (let i = 0; i < 6; i++) B.r(40 + ((i * 7) % 18) + Math.round(Math.sin(t * 5 + i) * 2), -50 + ((i * 5) % 22), 10, 8, '#e4eef4');
    ctx.globalAlpha = baseAlpha;
  }

  // ---- derail: sparks from under the wheels
  if (atk === 'derail' && act) {
    for (let i = 0; i < 10; i++) {
      const ph = (t * 5 + i * 0.37) % 1;
      B.r(46 + Math.round(ph * 26) + (i % 3), -6 - Math.round(Math.sin(ph * 3.14) * 12) - (i % 4), 2, 2, i % 2 ? '#ffe27a' : '#ff8a1e');
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Iron Furnace Engine: a tracked smelter, the furnace mouth on the front (local +x)
// ---------------------------------------------------------------------------------------------------------------
function drawFurnace(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && Math.floor(t * 10) % 2 === 0;
  const hull = pose.rage ? '#5a3a34' : '#4a4e5c';
  const hullD = shade(hull, -0.45);
  const hullL = shade(hull, 0.35);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const rolling = Math.abs(e.vx) > 2;

  // ---- tracks: a belt of links over a row of wheels
  B.r(-56, -18, 112, 18, '#15151a');
  B.r(-56, -18, 112, 2, '#3a3a46');
  const off = Math.floor((rolling ? e.x * 0.5 : t * 4) % 8);
  for (let x = -56 + off; x < 56; x += 8) B.r(x, -2, 4, 2, '#3a3a46');
  for (let x = -46; x <= 46; x += 23) {
    B.disc(x, -9, 7, '#2a2a32');
    B.disc(x, -9, 4, '#6a6e7e');
    B.disc(x, -9, 1, '#c8a040');
  }

  // ---- body: a riveted iron box, stepped at the back
  B.r(-52, -92, 104, 74, hull);
  B.r(-52, -92, 104, 3, hullL);
  B.r(-52, -92, 4, 74, hullD);
  B.r(-52, -24, 104, 6, hullD);
  for (let y = -86; y < -26; y += 12) B.r(-48, y, 96, 1, hullD);
  for (let x = -46; x < 50; x += 12) for (const y of [-88, -30]) B.r(x, y, 2, 2, '#9aa0b0');
  // hazard stripe along the base
  for (let x = -52; x < 52; x += 12) {
    B.r(x, -26, 6, 3, '#ffd23a');
    B.r(x + 6, -26, 6, 3, '#15151a');
  }
  // pressure gauges, glowing hotter as the engine rages
  for (const gx of [-30, -12]) {
    B.disc(gx, -76, 8, '#15151a');
    B.disc(gx, -76, 6, '#e8e8ee');
    B.line(gx, -76, gx + (pose.rage ? 4 : 2), -80, '#c8282e', 1);
  }
  B.r(6, -82, 30, 12, '#2a2a32');
  B.r(8, -80, 26, 8, pose.rage && flash ? '#ff5a2a' : '#4a6a4a');

  // ---- two chimneys with smoke drifting back
  for (const cxm of [-36, -14]) {
    B.r(cxm - 6, -126, 12, 36, '#3a3a46');
    B.r(cxm - 8, -130, 16, 5, '#2a2a32');
    B.r(cxm - 6, -126, 2, 36, '#6a6e7e');
  }
  ctx.globalAlpha = baseAlpha * 0.5;
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.8 + i * 0.2) % 1;
    for (const cxm of [-36, -14]) B.r(cxm - 5 - Math.round(ph * 22), -134 - Math.round(ph * 26), 10 + Math.round(ph * 8), 8, i % 2 ? '#6a6a76' : '#4a4a56');
  }
  ctx.globalAlpha = baseAlpha;

  // ---- hopper at the back: the conveyor that feeds the workers in
  B.r(-62, -70, 12, 40, '#3a3a46');
  B.r(-66, -74, 18, 6, '#2a2a32');
  if (atk === 'summon' && act) B.r(-64, -60, 8, 10, flash ? '#ffd23a' : '#c8a040');

  // ---- the furnace mouth: an arched door that swings open to show white-hot fire
  const mx = 40;
  B.r(mx - 6, -64, 24, 46, '#15151a');
  B.r(mx - 4, -62, 20, 3, hullL);
  if (open) {
    B.r(mx - 3, -58, 16, 40, flash ? '#fff2c0' : hot);
    B.r(mx, -52, 10, 30, '#ffe27a');
    B.r(mx + 2, -46, 6, 20, '#ffffff');
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(mx + 6, -38, 24, hot);
    ctx.globalAlpha = baseAlpha;
    if (atk === 'belch' && act) {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 4 + i * 0.2) % 1;
        B.r(mx + 14 + Math.round(ph * 24), -40 - ((i * 5) % 14), 6 + Math.round(ph * 4), 6, i % 2 ? '#ffd23a' : hot);
      }
    }
  } else {
    // the door plates swung shut, a seam of light between them
    B.r(mx - 3, -58, 8, 40, '#3a3a46');
    B.r(mx + 5, -58, 8, 40, '#33333e');
    B.r(mx + 4, -58, 1, 40, shade(hot, -0.3));
    B.r(mx - 3, -58, 16, 2, '#6a6e7e');
  }
  // a brass hinge at each corner
  for (const y of [-58, -22]) B.r(mx - 6, y, 3, 4, '#c8a040');

  // ---- piston arms: shuddering behind the plates while pistons come down
  if (atk === 'piston' && act) {
    for (const px of [-40, -20, 0, 20]) {
      const jit = Math.round(Math.sin(t * 40 + px) * 1);
      B.r(px - 2 + jit, -100, 5, 10, '#aab2c0');
      B.r(px - 3, -96, 7, 6, flash ? '#ffd23a' : '#c8a040');
    }
  }
  // ---- slag: a crucible on a crane over the roof
  if (atk === 'slag' && act) {
    B.line(0, -128, 22, -112, '#2a2a32', 3);
    B.r(16, -112, 14, 12, '#3a3a46');
    B.r(18, -112, 10, 3, flash ? '#ffe27a' : hot);
  }
  // ---- overload: steam hisses from every seam
  if (atk === 'overload' && act) {
    ctx.globalAlpha = baseAlpha * 0.8;
    for (let i = 0; i < 9; i++) {
      const ph = (t * 3 + i * 0.13) % 1;
      B.r(-46 + i * 11 + Math.round(Math.sin(t * 8 + i) * 2), -94 - Math.round(ph * 24), 8 + Math.round(ph * 6), 6, '#f0f6fa');
    }
    ctx.globalAlpha = baseAlpha;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// War Zeppelin: a long envelope above, the gondola slung under it (the weak point)
// ---------------------------------------------------------------------------------------------------------------
function drawZeppelin(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && Math.floor(t * 10) % 2 === 0;
  const canvas = pose.rage ? '#7a6a66' : '#8a8e90';
  const canvasD = shade(canvas, -0.35);
  const canvasL = shade(canvas, 0.3);
  const bob = Math.round(Math.sin(t * 1.9) * 1);

  // ---- envelope: a long ellipse, ribbed, lit from above
  const RX = 104;
  const RY = 32;
  const CY = -76 + bob;
  for (let y = -RY; y <= RY; y++) {
    const half = Math.round(RX * Math.sqrt(1 - (y / RY) * (y / RY)));
    const col = y < -RY * 0.55 ? canvasL : y > RY * 0.35 ? canvasD : canvas;
    B.r(-half, CY + y, half * 2, 1, col);
  }
  for (let x = -88; x <= 88; x += 16) {
    const half = Math.round(RY * Math.sqrt(1 - (x / RX) * (x / RX)));
    B.r(x, CY - half, 1, half * 2, canvasD);
  }
  // a broad stripe and the emblem
  B.r(-70, CY + 4, 140, 3, '#3a3a40');
  B.disc(10, CY - 2, 9, '#15151a');
  B.disc(10, CY - 2, 6, '#c0262e');
  B.r(8, CY - 4, 5, 5, '#15151a');
  // tail fins: top, bottom and a rudder
  B.r(-122, CY - 22, 22, 20, canvasD);
  B.r(-118, CY - 24, 14, 4, canvasD);
  B.r(-122, CY + 4, 22, 18, canvasD);
  B.r(-124, CY - 4, 8, 10, '#3a3a40');
  // ---- top gun deck: a cannon that points up while shells are lobbed
  B.r(-14, CY - RY - 6, 26, 7, '#3a3a40');
  B.r(-14, CY - RY - 6, 26, 1, '#9a9aa6');
  const lob = atk === 'gas' && act;
  B.line(0, CY - RY - 4, lob ? 12 : 16, CY - RY - (lob ? 20 : 12), '#2a2a32', 4);
  if (lob && flash) B.r(10, CY - RY - 24, 5, 5, '#ffe27a');
  // ---- engine pods with spinning propellers
  for (const px of [-62, 46]) {
    B.r(px - 12, CY + RY - 2, 24, 14, '#4a4e5a');
    B.r(px - 12, CY + RY - 2, 24, 2, '#8a8e9a');
    B.r(px - 16, CY + RY + 2, 5, 6, '#2a2a32');
    const spin = Math.floor(t * 30) % 2;
    B.r(px + 12, CY + RY - 2 + (spin ? 0 : 5), 2, 14 - (spin ? 0 : 10), '#d8d8e0');
    B.r(px - 2, CY + RY - 6, 4, 6, '#2a2a32');
  }
  // ---- hangar doors under the envelope's nose, open while it launches planes
  const hangar = atk === 'biplanes' && act;
  B.r(56, CY + RY - 8, 28, 10, hangar ? (flash ? '#ffd23a' : '#15151a') : '#3a3a40');
  if (hangar) B.r(58, CY + RY - 6, 24, 6, '#5a4a3a');

  // ---- gondola: slung under the envelope on struts, the weak point
  B.line(-24, CY + RY - 2, -22, -28, '#15151a', 2);
  B.line(24, CY + RY - 2, 22, -28, '#15151a', 2);
  B.r(-30, -32 + bob, 60, 28, '#2a2e38');
  B.r(-30, -32 + bob, 60, 3, '#6a6e7e');
  B.r(-28, -29 + bob, 56, 20, '#4a4e5c');
  // windows: lit amber, flaring white when the guns fire
  for (let i = 0; i < 5; i++) B.r(-24 + i * 11, -26 + bob, 8, 8, atk === 'guns' && act && flash ? '#ffffff' : '#ffcc5a');
  // the glowing core hatch on the underside
  B.r(-14, -8 + bob, 28, 6, open ? (flash ? '#fff2c0' : '#ff9a2a') : '#33333e');
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(0, -6 + bob, 22, '#ff9a2a');
    ctx.globalAlpha = baseAlpha;
  }
  // twin guns hanging at the gondola's nose
  const shoot = atk === 'guns' && act;
  B.r(26, -22 + bob, 12, 3, '#15151a');
  B.r(26, -17 + bob, 12, 3, '#15151a');
  if (shoot && Math.floor(t * 30) % 2 === 0) B.r(38, -22 + bob, 5, 8, '#ffe27a');
  // a bomb rack under the gondola during a bomb run
  if (atk === 'bombs' && act) {
    for (let i = 0; i < 3; i++) B.r(-14 + i * 12, -2 + bob, 6, 5, flash ? '#ffd23a' : '#15151a');
  }
}

export function registerBossesW11(painters) {
  painters.locomotive = () => bossFrames(170, 170, drawLocomotive);
  painters.furnace = () => bossFrames(170, 170, drawFurnace);
  painters.zeppelin = () => bossFrames(270, 170, drawZeppelin);
}
