// Boss art for Level 16: the Super-Heavy Tank (level 16).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade, mix } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const STEEL = '#8a92a0';
const CHAR = '#14100e';

// the hull is marked low, below the turret ring; the turret has its own marks because it breathes
const TANK_MARKS = [
  { x: -46, y: -42, kind: 'crack', phase: 1 },
  { x: -12, y: -40, kind: 'plate', phase: 1 },
  { x: -30, y: -34, kind: 'scorch', phase: 2 },
  { x: -50, y: -54, kind: 'smoke', phase: 2 },
];
const TURRET_MARKS = [
  { x: 10, y: -74, kind: 'crack', phase: 1 },
  { x: 20, y: -52, kind: 'spark', phase: 2 },
];

/** Where the i-th loose part has flown to while the tank dies: spread sideways, thrown up, then falling back. */
function flung(dead, i, dir = 0) {
  const side = dir || (i % 2 ? 1 : -1);
  return { x: Math.round(side * dead.fly * (0.35 + (i % 3) * 0.15)), y: -Math.round(dead.fly * (0.7 + i * 0.1) - dead.k * dead.k * 40) };
}

// ---------------------------------------------------------------------------------------------------------------
// Super-Heavy Tank: the front of the hull to the left in the world (local +x)
// ---------------------------------------------------------------------------------------------------------------
function drawSuperTank(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const up = Math.max(0, breathe(pose, 1));
  const T = brush(ctx, cx, cy + dead.sink - up, e.face); // the turret rises a pixel with each breath
  const t = pose.bs.age;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const hull = burn(pose.rage ? '#5a5048' : '#566450');
  const hullD = shade(hull, -0.4);
  const hullL = shade(hull, 0.35);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const steel = burn(STEEL);
  const gun = burn('#2a2a30');
  const rolling = Math.abs(e.vx) > 2;
  const tread = Math.floor((rolling ? e.x * 0.6 : t * 2) % 6);

  // ---- tracks: a long dark band with road wheels and a tread pattern that creeps when it moves
  B.part(-62, -22, 120, 22, '#1c1c18');
  B.r(-62, -22, 120, 2, '#4a4a3e');
  B.part(-66, -16, 6, 12, '#1c1c18');
  B.part(56, -16, 6, 12, '#1c1c18');
  for (let i = 0; i < 20; i++) B.r(-60 + i * 6 + tread - 6 + 6, -1, 3, 1, '#4a4a3e');
  for (let i = 0; i < 20; i++) B.r(-60 + i * 6 + tread - 6 + 6, -21, 3, 1, '#4a4a3e');
  for (const wx of [-50, -30, -10, 10, 30, 48]) {
    B.disc(wx, -11, 8, '#2c2c26');
    B.disc(wx, -11, 5, '#44443a');
    B.disc(wx, -11, 2, '#7a7a68');
  }
  B.disc(-58, -12, 6, '#2c2c26'); // rear sprocket
  B.disc(58, -12, 6, '#2c2c26'); // front idler
  // armoured skirt over the wheels
  B.part(-56, -26, 112, 5, hullD);

  // ---- hull: a long low box with a sloped glacis plate at the front
  B.part(-58, -46, 110, 22, hull);
  B.r(-58, -26, 110, 2, hullD);
  for (let i = 0; i < 4; i++) B.r(52 + i, -46 + i * 6, 12 - i * 3, 6, i % 2 ? hullD : hull); // the sloped nose
  B.r(52, -46, 12, 2, hullL);
  for (const rx of [-50, -36, -22, 8, 22, 38]) B.r(rx, -42, 1, 1, hullL); // rivets
  // engine deck at the back: grilles, and exhaust smoke (a wisp at idle, thick while it revs)
  B.part(-58, -52, 28, 6, hullD);
  for (let x = -56; x < -32; x += 4) B.r(x, -51, 2, 4, '#14140f');
  const revving = (atk === 'crush' && act) || rolling;
  if (revving) {
    ctx.globalAlpha = baseAlpha * 0.6;
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.4 + i * 0.25) % 1;
      B.r(-60 - Math.round(ph * 14), -56 - Math.round(ph * 26), 6 + Math.round(ph * 6), 6 + Math.round(ph * 4), i % 2 ? '#4a4a46' : '#2c2c2a');
    }
    ctx.globalAlpha = baseAlpha;
  } else if (state === 'idle') {
    ctx.globalAlpha = baseAlpha * 0.6;
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.8 + i * 0.5) % 1;
      B.disc(-52 - Math.round(ph * 6), -58 - Math.round(ph * 14), 1 + Math.round(ph * 2), ph < 0.5 ? '#4a4a46' : '#6a6a66');
    }
    ctx.globalAlpha = baseAlpha;
  }
  // the rear troop hatch
  const troops = atk === 'troops' && act;
  B.part(-54, -56, 12, 4, troops ? (flash ? '#ffe27a' : '#14140f') : hullD);

  // ---- twin sponson cannons low on the glacis: a low barrel and a high one (they come out from behind the armour plate)
  const cannon = atk === 'cannon' && act;
  B.part(52, -12, 20, 5, hullD);
  B.r(52, -12, 20, 2, steel);
  B.part(66, -13, 8, 7, gun);
  B.part(52, -25, 20, 5, hullD);
  B.r(52, -25, 20, 2, steel);
  B.part(66, -26, 8, 7, gun);
  if (cannon && tele > 0.5) {
    // the barrel that is about to fire glows at the muzzle
    const hiNext = (e.cn || 0) % 2 === 1;
    B.r(72, hiNext ? -23 : -10, 3, 3, flash ? '#ffffff' : hot);
  }

  // ---- the front armour plate over the driver's port: the weak point. Hot and open when it can be hit, shuttered when shut
  weakPoint(B, 38, -46, 26, 30, { open, col: hot, age: t, hit: e.flash || 0 });
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.28;
    B.disc(51, -31, 22, hot);
    ctx.globalAlpha = baseAlpha;
    B.r(42, -42, 18, 1, '#ffe27a');
    B.r(46, -36, 10, 14, flash ? '#fff2c0' : shade(hot, 0.35));
  } else {
    B.r(40, -31, 22, 2, burn('#5a5e66'));
    B.r(40, -22, 4, 4, steel);
    B.r(58, -22, 4, 4, steel);
  }

  // ---- turret: a squat tower with a thick mantlet, the main gun levelled over the nose
  T.part(-30, -78, 66, 34, hull);
  T.r(-30, -50, 66, 6, hullD);
  T.r(36, -74, 5, 26, hullD);
  T.r(-34, -70, 4, 18, hullD);
  T.part(-24, -86, 34, 8, hull);
  T.part(32, -72, 16, 18, hullD); // mantlet
  T.r(32, -72, 16, 2, steel);
  const mainGun = flung(dead, 0, 1);
  T.part(46 + mainGun.x, -66 + mainGun.y, 38, 6, gun); // the long main gun
  T.r(46 + mainGun.x, -66 + mainGun.y, 38, 2, steel);
  T.part(80 + mainGun.x, -68 + mainGun.y, 8, 10, burn('#3a3a42')); // muzzle brake
  // a white star on the turret side
  T.r(-4, -66, 9, 3, burn('#e8e8d8'));
  T.r(-1, -69, 3, 9, burn('#e8e8d8'));
  // the commander's cupola (with a lamp that blinks at idle) and the roof machine gun
  const cup = flung(dead, 1, -1);
  T.part(-20 + cup.x, -92 + cup.y, 14, 6, hullD);
  T.r(-20 + cup.x, -92 + cup.y, 14, 1, steel);
  T.r(-8 + cup.x, -90 + cup.y, 2, 2, state === 'idle' && blink(t, 1.2) ? '#ff3a3a' : '#5a1a1a');
  const mg = atk === 'mg' && act;
  T.part(18, -82, 10, 4, gun);
  T.r(24, -81, 14, 2, gun);
  if (mg && Math.floor(t * 26) % 2 === 0 && state === 'attack') T.r(38, -83, 5, 5, '#ffe27a');
  else if (mg && tele > 0.4) T.r(38, -81, 3, 3, flash ? '#ffffff' : hot);
  // mortar tubes on the turret roof
  const mortar = atk === 'mortar' && act;
  const tubes = flung(dead, 2, 1);
  T.part(-8 + tubes.x, -94 + tubes.y, 5, 10, gun);
  T.part(0 + tubes.x, -96 + tubes.y, 5, 12, gun);
  T.part(8 + tubes.x, -94 + tubes.y, 5, 10, gun);
  if (mortar && tele > 0.3) {
    for (const mx of [-8, 0, 8]) T.r(mx + 1, -98 + (mx === 0 ? -2 : 0), 3, 3, flash ? '#ffffff' : hot);
  }

  // ---- flamethrower nozzles at the nose
  const flame = atk === 'flame' && act;
  B.r(60, -33, 8, 3, gun);
  B.r(60, -17, 8, 3, gun);
  if (flame && tele > 0.4) {
    B.r(68, -33, 3, 3, flash ? '#ffffff' : '#ff8a1e');
    B.r(68, -17, 3, 3, flash ? '#ffffff' : '#ff8a1e');
  }

  // ---- enraged: glowing seams and a rust-red glow behind the turret
  if (pose.rage) {
    ctx.globalAlpha = baseAlpha * 0.35;
    T.r(-28, -76, 62, 28, hot);
    ctx.globalAlpha = baseAlpha;
    B.r(-58, -30, 110, 1, hot);
  }
  damageMarks(B, pose, TANK_MARKS);
  damageMarks(T, pose, TURRET_MARKS);
}

export function registerBossesW12(painters) {
  painters.supertank = () => bossFrames(190, 130, drawSuperTank);
}
