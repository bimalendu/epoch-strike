// Boss art for Week 11: the Armored Locomotive (level 13), the Iron Furnace Engine (level 14) and the War Zeppelin (level 15).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade, mix } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const IRON = '#aab2c0';
const BRASS = '#c8a040';
const CHAR = '#14100e';

/** Where loose part `i` has got to while the boss falls apart: it drifts out, rises, then drops back. */
function toss(dead, i, dir = 1) {
  return { x: Math.round(dir * (i - 1) * dead.fly * 0.5), y: -Math.round(dead.fly * (0.7 + i * 0.15) - dead.k * dead.k * 40) };
}

// ---------------------------------------------------------------------------------------------------------------
// Armored Locomotive: front of the engine to the left (local +x)
// ---------------------------------------------------------------------------------------------------------------
const LOCO_MARKS = [
  { x: 24, y: -58, kind: 'crack', phase: 1 },
  { x: -44, y: -64, kind: 'crack', phase: 1 },
  { x: -10, y: -58, kind: 'plate', phase: 1 },
  { x: -56, y: -44, kind: 'scorch', phase: 2 },
  { x: 6, y: -64, kind: 'smoke', phase: 2 },
  { x: 14, y: -44, kind: 'spark', phase: 2 },
];

function drawLocomotive(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const t = pose.bs.age;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const plate = burn(pose.rage ? '#3a2c30' : '#2e3038');
  const plateD = shade(plate, -0.45);
  const plateL = shade(plate, 0.4);
  const iron = burn(IRON);
  const brass = burn(BRASS);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const rolling = Math.abs(e.vx) > 2;
  const spin = (rolling ? e.x * 0.09 : t * 1.5) % (Math.PI * 2);
  const bob = breathe(pose, 1); // the idling engine shudders on its frame
  const stackT = toss(dead, 0, -1);
  const lampT = toss(dead, 1, 1);
  const domeT = toss(dead, 2, 1);

  // ---- frame and drive wheels, a connecting rod across them
  B.slab(-60, -20, 124, 6, '#15151a');
  for (const wx of [-34, -6, 22]) {
    B.disc(wx, -14, 14, '#15151a');
    B.disc(wx, -14, 12, '#5a5a66');
    B.disc(wx, -14, 9, '#2a2a32');
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4;
      B.line(wx - Math.cos(a) * 11, -14 - Math.sin(a) * 11, wx + Math.cos(a) * 11, -14 + Math.sin(a) * 11, iron, 1);
    }
    B.disc(wx, -14, 2, brass);
  }
  const rodY = -14 + Math.round(Math.sin(spin) * 5);
  B.r(-36, rodY - 1, 60, 3, iron);
  // pilot wheels under the cowcatcher
  B.disc(46, -8, 7, '#15151a');
  B.disc(46, -8, 5, '#5a5a66');

  // ---- smokestack, behind the boiler so its foot never shows a seam
  B.part(24 + stackT.x, -104 + bob + stackT.y, 12, 46, plate);
  B.r(25 + stackT.x, -103 + bob + stackT.y, 2, 44, plateL);
  B.part(20 + stackT.x, -112 + bob + stackT.y, 20, 8, plateD);

  // ---- boiler: a long drum with brass bands, rounded at the front
  B.part(-24, -62, 82, 36, plate);
  for (const x of [-12, 8, 28]) {
    B.r(x, -62, 4, 36, brass);
    B.r(x, -62, 1, 36, shade(brass, 0.4));
  }
  for (let x = -22; x < 34; x += 10) for (const y of [-58, -44, -32]) B.r(x, y, 1, 1, iron);
  if (pose.rage && !dead.k) {
    ctx.globalAlpha = baseAlpha * 0.35;
    B.r(-22, -60, 56, 32, hot);
    ctx.globalAlpha = baseAlpha;
  }

  // ---- smokebox door: the weak point. It glows when it is open and is shuttered when it is shut
  B.part(34, -60, 28, 52, plate);
  B.r(34, -60, 28, 3, plateL);
  for (const [x, y] of [[36, -58], [58, -58], [36, -11], [58, -11]]) B.r(x, y, 1, 1, iron);
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(48, -33, 24, hot);
    ctx.globalAlpha = baseAlpha;
  }
  weakPoint(B, 36, -56, 24, 46, { open, col: flash ? '#fff2c0' : hot, age: t, hit: e.flash || 0 });
  if (open) {
    B.r(44, -38, 8, 2, '#ffe27a');
    B.r(44, -30, 8, 2, '#ffe27a');
  }
  B.r(61, -35, 3, 3, brass); // the handle
  // cowcatcher: a wedge of bars
  for (let i = 0; i < 5; i++) B.r(61 + i, -20 + i * 2, 10 - i * 2, 2, i % 2 ? plateD : iron);

  // ---- headlamp on top of the smokebox
  const lampLit = atk === 'cannon' && act ? '#ffffff' : blink(t, 1.2) ? '#8a7a40' : '#ffe27a';
  B.part(46 + lampT.x, -78 + bob + lampT.y, 12, 14, brass);
  B.r(52 + lampT.x, -75 + bob + lampT.y, 5, 8, lampLit);
  B.part(44 + lampT.x, -80 + bob + lampT.y, 16, 3, plateD);

  // ---- steam dome and whistle
  B.part(-2 + domeT.x, -72 + domeT.y, 14, 10, brass);
  B.part(2 + domeT.x, -78 + domeT.y, 6, 6, plateD);
  // smoke drifting up and back from the stack
  ctx.globalAlpha = baseAlpha * 0.55;
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.9 + i * 0.2) % 1;
    B.r(30 - Math.round(ph * 24) - 6 + stackT.x, -112 + bob - Math.round(ph * 30) - 4 + stackT.y, 10 + Math.round(ph * 8), 8 + Math.round(ph * 5), i % 2 ? '#6a6a76' : '#4a4a56');
  }
  ctx.globalAlpha = baseAlpha;
  if (atk === 'coal' && act) {
    B.r(26, -118 + bob + (flash ? -2 : 0), 8, 6, flash ? '#ffd23a' : hot); // an ember at the lip
  }

  // ---- cab: tall, red-trimmed, a lit window, the gatling on its roof
  B.part(-60, -96, 38, 76, plate);
  B.r(-60, -96, 3, 76, plateD);
  B.part(-64, -100 + bob, 46, 6, burn('#8a1a20')); // roof overhang
  B.r(-64, -100 + bob, 46, 1, burn('#c8282e'));
  B.part(-52, -84, 22, 22, '#15151a');
  B.r(-50, -82, 18, 18, burn(pose.mid ? '#ffcc5a' : '#7ac0d8'));
  B.r(-42, -82, 2, 18, '#15151a');
  B.r(-50, -74, 18, 2, '#15151a');
  for (let y = -60; y < -22; y += 8) B.r(-60, y, 38, 1, plateD);
  // gatling: a barrel cluster that turns toward the soldier
  const gx = -34;
  const gy = -106 + bob;
  B.part(gx - 5, gy - 2, 12, 6, '#2a2a32');
  const len = 18;
  const shoot = atk === 'cannon' && act;
  const jit = shoot ? Math.round(Math.sin(t * 60) * 1) : 0;
  B.stroke(gx + 6, gy + 1, gx + 6 + len, gy + 1 + jit, '#2a2a32', 3);
  B.line(gx + 6, gy, gx + 6 + len, gy + jit, iron, 1);
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
  damageMarks(B, pose, LOCO_MARKS);
}

// ---------------------------------------------------------------------------------------------------------------
// Iron Furnace Engine: a tracked smelter, the furnace mouth on the front (local +x)
// ---------------------------------------------------------------------------------------------------------------
const FURNACE_MARKS = [
  { x: -22, y: -60, kind: 'crack', phase: 1 },
  { x: 10, y: -50, kind: 'plate', phase: 1 },
  { x: -44, y: -44, kind: 'scorch', phase: 2 },
  { x: 24, y: -92, kind: 'smoke', phase: 2 },
  { x: -4, y: -36, kind: 'spark', phase: 2 },
];

function drawFurnace(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const t = pose.bs.age;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const hull = burn(pose.rage ? '#5a3a34' : '#4a4e5c');
  const hullD = shade(hull, -0.45);
  const hullL = shade(hull, 0.35);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const rolling = Math.abs(e.vx) > 2;
  const bob = breathe(pose, 1);
  const chim = [toss(dead, 0, -1), toss(dead, 2, 1)];
  const hopT = toss(dead, 1, -1);

  // ---- tracks: a belt of links over a row of wheels
  B.part(-56, -18, 112, 18, '#1c1c22');
  const off = Math.floor((rolling ? e.x * 0.5 : t * 4) % 8);
  for (let x = -56 + off; x < 56; x += 8) B.r(x, -2, 4, 2, '#3a3a46');
  for (let x = -46; x <= 46; x += 23) {
    B.disc(x, -9, 7, '#2a2a32');
    B.disc(x, -9, 4, '#6a6e7e');
    B.disc(x, -9, 1, burn('#c8a040'));
  }

  // ---- two chimneys with smoke drifting back; their feet hide behind the body
  const stacks = [-36, -14];
  stacks.forEach((cxm, k) => {
    const o = chim[k];
    B.part(cxm - 6 + o.x, -126 + bob + o.y, 12, 42, burn('#3a3a46'));
    B.r(cxm - 5 + o.x, -125 + bob + o.y, 2, 40, burn('#6a6e7e'));
    B.part(cxm - 8 + o.x, -130 + bob + o.y, 16, 5, burn('#2a2a32'));
  });
  ctx.globalAlpha = baseAlpha * 0.5;
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.8 + i * 0.2) % 1;
    stacks.forEach((cxm, k) => {
      B.r(cxm - 5 - Math.round(ph * 22) + chim[k].x, -134 + bob - Math.round(ph * 26) + chim[k].y, 10 + Math.round(ph * 8), 8, i % 2 ? '#6a6a76' : '#4a4a56');
    });
  }
  ctx.globalAlpha = baseAlpha;

  // ---- hopper at the back: the conveyor that feeds the workers in
  B.part(-62 + hopT.x, -70 + hopT.y, 12, 40, burn('#3a3a46'));
  B.part(-66 + hopT.x, -74 + hopT.y, 18, 6, burn('#2a2a32'));
  if (atk === 'summon' && act) B.r(-64 + hopT.x, -60 + hopT.y, 8, 10, flash ? '#ffd23a' : '#c8a040');

  // ---- body: a riveted iron box, stepped at the back
  B.part(-52, -92, 104, 74, hull);
  B.r(-52, -92, 4, 74, hullD);
  B.r(-52, -24, 104, 6, hullD);
  for (let y = -86; y < -26; y += 12) B.r(-48, y, 96, 1, hullD);
  for (let x = -46; x < 50; x += 12) for (const y of [-88, -30]) B.r(x, y, 2, 2, '#9aa0b0');
  // hazard stripe along the base
  for (let x = -52; x < 52; x += 12) {
    B.r(x, -26, 6, 3, burn('#ffd23a'));
    B.r(x + 6, -26, 6, 3, '#15151a');
  }
  // pressure gauges, glowing hotter as the engine rages
  for (const gx of [-30, -12]) {
    B.disc(gx, -76 + bob, 8, '#15151a');
    B.disc(gx, -76 + bob, 6, burn('#e8e8ee'));
    B.line(gx, -76 + bob, gx + (pose.rage ? 4 : 2), -80 + bob, '#c8282e', 1);
  }
  B.part(6, -82 + bob, 30, 12, '#2a2a32');
  B.r(8, -80 + bob, 26, 8, pose.rage && flash ? '#ff5a2a' : '#4a6a4a');
  B.r(30, -78 + bob, 3, 3, blink(t, 0.7) ? '#2a3a2a' : burn('#7aff7a')); // a status lamp that winks

  // ---- the furnace mouth: the weak point. A door frame down the whole front, white-hot fire behind the open door
  const mx = 40;
  B.part(mx - 8, -58, 26, 50, '#15151a');
  B.r(mx - 8, -58, 26, 2, hullL);
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(mx + 6, -32, 26, hot);
    ctx.globalAlpha = baseAlpha;
  }
  weakPoint(B, 34, -52, 22, 40, { open, col: flash ? '#fff2c0' : hot, age: t, hit: e.flash || 0 });
  if (open) {
    B.r(38, -46, 14, 28, '#ffe27a');
    B.r(41, -40, 8, 16, '#ffffff');
    if (atk === 'belch' && act) {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 4 + i * 0.2) % 1;
        B.r(mx + 14 + Math.round(ph * 24), -40 - ((i * 5) % 14), 6 + Math.round(ph * 4), 6, i % 2 ? '#ffd23a' : hot);
      }
    }
  }
  // a brass hinge at each corner
  for (const y of [-54, -16]) B.part(mx - 9, y, 3, 4, burn('#c8a040'));

  // ---- piston arms: shuddering behind the plates while pistons come down
  if (atk === 'piston' && act) {
    for (const px of [-40, -20, 0, 20]) {
      const jit = Math.round(Math.sin(t * 40 + px) * 1);
      B.part(px - 2 + jit, -100, 5, 10, IRON);
      B.part(px - 3, -96, 7, 6, flash ? '#ffd23a' : '#c8a040');
    }
  }
  // ---- slag: a crucible on a crane over the roof
  if (atk === 'slag' && act) {
    B.stroke(0, -128, 22, -112, '#2a2a32', 3);
    B.part(16, -112, 14, 12, '#3a3a46');
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
  damageMarks(B, pose, FURNACE_MARKS);
}

// ---------------------------------------------------------------------------------------------------------------
// War Zeppelin: a long envelope above, the gondola slung under it (the weak point)
// ---------------------------------------------------------------------------------------------------------------
const ZEP_MARKS = [
  { x: -50, y: -100, kind: 'crack', phase: 1 },
  { x: 28, y: -98, kind: 'plate', phase: 1 },
  { x: 40, y: -72, kind: 'crack', phase: 1 },
  { x: -72, y: -70, kind: 'scorch', phase: 2 },
  { x: 62, y: -88, kind: 'smoke', phase: 2 },
  { x: -24, y: -62, kind: 'spark', phase: 2 },
];

function drawZeppelin(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const t = pose.bs.age;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const canvas = burn(pose.rage ? '#7a6a66' : '#8a8e90');
  const canvasD = shade(canvas, -0.35);
  const canvasL = shade(canvas, 0.3);
  const bob = Math.round(Math.sin(t * 1.9) * 1);
  const finT = toss(dead, 0, -1);
  const deckT = toss(dead, 1, 1);
  const podT = toss(dead, 2, 1);

  // ---- envelope: a long ellipse with a dark rim, ribbed, lit from above
  const RX = 104;
  const RY = 32;
  const CY = -76 + bob;
  const out = shade(canvasD, -0.6);
  for (let y = -RY - 1; y <= RY + 1; y++) {
    const half = Math.round((RX + 1) * Math.sqrt(1 - (y / (RY + 1)) * (y / (RY + 1))));
    B.r(-half, CY + y, half * 2 + 1, 1, out);
  }
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
  B.r(-70, CY + 4, 140, 3, burn('#3a3a40'));
  B.disc(10, CY - 2, 9, '#15151a');
  B.disc(10, CY - 2, 6, burn('#c0262e'));
  B.r(8, CY - 4, 5, 5, '#15151a');
  // tail fins: top, bottom and a rudder (the top fin carries a beacon)
  B.part(-122 + finT.x, CY - 22 + finT.y, 22, 20, canvasD);
  B.part(-118 + finT.x, CY - 24 + finT.y, 14, 4, canvasD);
  B.r(-114 + finT.x, CY - 28 + finT.y, 2, 3, blink(t, 1.7) ? '#4a1a1a' : burn('#ff3a3a'));
  B.part(-122, CY + 4, 22, 18, canvasD);
  B.part(-124, CY - 4, 8, 10, burn('#3a3a40'));
  // ---- top gun deck: a cannon that points up while shells are lobbed
  B.part(-14 + deckT.x, CY - RY - 6 + deckT.y, 26, 7, burn('#3a3a40'));
  const lob = atk === 'gas' && act;
  B.stroke(deckT.x, CY - RY - 4 + deckT.y, (lob ? 12 : 16) + deckT.x, CY - RY - (lob ? 20 : 12) + deckT.y, '#2a2a32', 4);
  if (lob && flash) B.r(10, CY - RY - 24, 5, 5, '#ffe27a');
  // ---- engine pods with spinning propellers and a puff of exhaust trailing back
  [-62, 46].forEach((px, k) => {
    const o = k ? podT : { x: 0, y: 0 };
    B.part(px - 12 + o.x, CY + RY - 2 + o.y, 24, 14, burn('#4a4e5a'));
    B.part(px - 16 + o.x, CY + RY + 2 + o.y, 5, 6, '#2a2a32');
    const spin = Math.floor(t * 30) % 2;
    B.r(px + 12 + o.x, CY + RY - 2 + (spin ? 0 : 5) + o.y, 2, 14 - (spin ? 0 : 10), '#d8d8e0');
    B.r(px - 2 + o.x, CY + RY - 6 + o.y, 4, 6, '#2a2a32');
    const ph = (t * 1.3 + k * 0.45) % 1;
    ctx.globalAlpha = baseAlpha * (1 - ph) * 0.8;
    B.disc(px - 20 - Math.round(ph * 14) + o.x, CY + RY + 5 - Math.round(ph * 4) + o.y, 1 + Math.round(ph * 3), '#cfd4da');
    ctx.globalAlpha = baseAlpha;
  });
  // ---- hangar doors under the envelope's nose, open while it launches planes
  const hangar = atk === 'biplanes' && act;
  B.part(56, CY + RY - 8, 28, 10, hangar ? (flash ? '#ffd23a' : '#15151a') : burn('#3a3a40'));
  if (hangar) B.r(58, CY + RY - 6, 24, 6, '#5a4a3a');

  // ---- gondola: slung under the envelope on struts. It is the weak point, so the whole car is its housing
  B.stroke(-24, CY + RY - 2, -22, -30, '#2a2a32', 2);
  B.stroke(24, CY + RY - 2, 22, -30, '#2a2a32', 2);
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(0, -17, 30, '#ff9a2a');
    ctx.globalAlpha = baseAlpha;
  }
  B.part(-30, -33, 60, 32, burn('#2a2e38'));
  weakPoint(B, -28, -32, 56, 30, { open, col: flash ? '#fff2c0' : '#ff9a2a', age: t, hit: e.flash || 0 });
  // windows: lit amber (dark panes in the glow when it is open), flaring white when the guns fire
  const fire = atk === 'guns' && act && flash;
  for (let i = 0; i < 5; i++) {
    const lit = open ? '#6a2a10' : fire ? '#ffffff' : i === 3 && blink(t, 0.4) ? '#6a5a30' : '#ffcc5a';
    B.r(-24 + i * 11, -26, 8, 8, lit);
  }
  if (open) B.r(-14, -8, 28, 3, '#ffe27a');
  // twin guns hanging at the gondola's nose
  const shoot = atk === 'guns' && act;
  B.part(29, -22, 12, 3, '#2a2a32');
  B.part(29, -17, 12, 3, '#2a2a32');
  if (shoot && Math.floor(t * 30) % 2 === 0) B.r(41, -22, 5, 8, '#ffe27a');
  // a bomb rack under the gondola during a bomb run
  if (atk === 'bombs' && act) {
    for (let i = 0; i < 3; i++) B.part(-14 + i * 12, 1, 6, 5, flash ? '#ffd23a' : '#2a2a32');
  }
  damageMarks(B, pose, ZEP_MARKS);
}

export function registerBossesW11(painters) {
  painters.locomotive = () => bossFrames(170, 170, drawLocomotive);
  painters.furnace = () => bossFrames(170, 170, drawFurnace);
  painters.zeppelin = () => bossFrames(270, 170, drawZeppelin);
}
