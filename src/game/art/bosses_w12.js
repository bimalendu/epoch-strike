// Boss art for Week 12: the Super-Heavy Tank (level 16).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';

const STEEL = '#8a92a0';

// ---------------------------------------------------------------------------------------------------------------
// Super-Heavy Tank: the front of the hull to the left in the world (local +x)
// ---------------------------------------------------------------------------------------------------------------
function drawSuperTank(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const hull = pose.rage ? '#5a5048' : '#566450';
  const hullD = shade(hull, -0.4);
  const hullL = shade(hull, 0.35);
  const hot = pose.rage ? '#ff5a2a' : '#ff9a2a';
  const rolling = Math.abs(e.vx) > 2;
  const tread = Math.floor((rolling ? e.x * 0.6 : t * 2) % 6);

  // ---- tracks: a long dark band with road wheels and a tread pattern that creeps when it moves
  B.r(-62, -22, 120, 22, '#1c1c18');
  B.r(-62, -22, 120, 2, '#4a4a3e');
  B.r(-66, -16, 6, 12, '#1c1c18');
  B.r(56, -16, 6, 12, '#1c1c18');
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
  B.r(-56, -26, 112, 5, hullD);
  B.r(-56, -26, 112, 1, hullL);

  // ---- hull: a long low box with a sloped glacis plate at the front
  B.r(-58, -46, 110, 22, hull);
  B.r(-58, -46, 110, 3, hullL);
  B.r(-58, -26, 110, 2, hullD);
  for (let i = 0; i < 4; i++) B.r(52 + i, -46 + i * 6, 12 - i * 3, 6, i % 2 ? hullD : hull); // the sloped nose
  B.r(52, -46, 12, 2, hullL);
  for (const rx of [-50, -36, -22, 8, 22, 38]) B.r(rx, -42, 1, 1, hullL); // rivets
  // engine deck at the back: grilles, and exhaust smoke while it revs
  B.r(-58, -52, 28, 6, hullD);
  for (let x = -56; x < -32; x += 4) B.r(x, -51, 2, 4, '#14140f');
  const revving = (atk === 'crush' && act) || rolling;
  if (revving) {
    ctx.globalAlpha = baseAlpha * 0.6;
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.4 + i * 0.25) % 1;
      B.r(-60 - Math.round(ph * 14), -56 - Math.round(ph * 26), 6 + Math.round(ph * 6), 6 + Math.round(ph * 4), i % 2 ? '#4a4a46' : '#2c2c2a');
    }
    ctx.globalAlpha = baseAlpha;
  }
  // the rear troop hatch
  const troops = atk === 'troops' && act;
  B.r(-54, -56, 12, 4, troops ? (flash ? '#ffe27a' : '#14140f') : hullD);

  // ---- twin sponson cannons low on the glacis: a low barrel and a high one
  const cannon = atk === 'cannon' && act;
  B.r(52, -12, 20, 5, hullD);
  B.r(52, -12, 20, 2, STEEL);
  B.r(66, -13, 8, 7, '#2a2a30');
  B.r(52, -25, 20, 5, hullD);
  B.r(52, -25, 20, 2, STEEL);
  B.r(66, -26, 8, 7, '#2a2a30');
  if (cannon && tele > 0.5) {
    // the barrel that is about to fire glows at the muzzle
    const hiNext = (e.cn || 0) % 2 === 1;
    B.r(72, hiNext ? -23 : -10, 3, 3, flash ? '#ffffff' : hot);
  }

  // ---- the driver's visor on the glacis: the weak point. Hot and open when it can be hit, a steel plate when it is shut
  B.r(46, -46, 22, 10, '#14140f');
  B.r(48, -44, 18, 6, open ? (flash ? '#fff2c0' : hot) : '#3a3e46');
  if (open) {
    ctx.globalAlpha = baseAlpha * 0.28;
    B.disc(58, -40, 16, hot);
    ctx.globalAlpha = baseAlpha;
    B.r(50, -44, 14, 1, '#ffe27a');
  } else {
    B.r(48, -42, 18, 1, '#5a5e66');
    B.r(48, -40, 18, 1, '#5a5e66');
  }

  // ---- turret: a squat tower with a thick mantlet, the main gun levelled over the nose
  B.r(-30, -78, 66, 34, hull);
  B.r(-30, -78, 66, 3, hullL);
  B.r(-30, -50, 66, 6, hullD);
  B.r(36, -74, 5, 26, hullD);
  B.r(-34, -70, 4, 18, hullD);
  B.r(-24, -86, 34, 8, hull);
  B.r(-24, -86, 34, 2, hullL);
  B.r(32, -72, 16, 18, hullD); // mantlet
  B.r(32, -72, 16, 2, STEEL);
  B.r(46, -66, 38, 6, '#2a2a30'); // the long main gun
  B.r(46, -66, 38, 2, STEEL);
  B.r(80, -68, 8, 10, '#3a3a42'); // muzzle brake
  // a white star on the turret side
  B.r(-4, -66, 9, 3, '#e8e8d8');
  B.r(-1, -69, 3, 9, '#e8e8d8');
  // the commander's cupola and the roof machine gun
  B.r(-20, -92, 14, 6, hullD);
  B.r(-20, -92, 14, 1, STEEL);
  const mg = atk === 'mg' && act;
  B.r(18, -82, 10, 4, '#2a2a30');
  B.r(24, -81, 14, 2, '#2a2a30');
  if (mg && Math.floor(t * 26) % 2 === 0 && state === 'attack') B.r(38, -83, 5, 5, '#ffe27a');
  else if (mg && tele > 0.4) B.r(38, -81, 3, 3, flash ? '#ffffff' : hot);
  // mortar tubes on the turret roof
  const mortar = atk === 'mortar' && act;
  B.r(-8, -94, 5, 10, '#2a2a30');
  B.r(0, -96, 5, 12, '#2a2a30');
  B.r(8, -94, 5, 10, '#2a2a30');
  if (mortar && tele > 0.3) {
    for (const mx of [-8, 0, 8]) B.r(mx + 1, -98 + (mx === 0 ? -2 : 0), 3, 3, flash ? '#ffffff' : hot);
  }

  // ---- flamethrower nozzles at the nose
  const flame = atk === 'flame' && act;
  B.r(60, -33, 8, 3, '#2a2a30');
  B.r(60, -17, 8, 3, '#2a2a30');
  if (flame && tele > 0.4) {
    B.r(68, -33, 3, 3, flash ? '#ffffff' : '#ff8a1e');
    B.r(68, -17, 3, 3, flash ? '#ffffff' : '#ff8a1e');
  }

  // ---- enraged: glowing seams and a rust-red glow behind the turret
  if (pose.rage) {
    ctx.globalAlpha = baseAlpha * 0.35;
    B.r(-28, -76, 62, 28, hot);
    ctx.globalAlpha = baseAlpha;
    B.r(-58, -30, 110, 1, hot);
  }
}

export function registerBossesW12(painters) {
  painters.supertank = () => bossFrames(190, 130, drawSuperTank);
}
