// Boss art for Week 14: the Rift Warlord (level 20). Same conventions as bosses.js: a Brush in boss-local coordinates
// (origin = centre of the feet, +x = facing, -y = up).

import { shade } from './common.js';
import { brush, bossFrames } from './bosses.js';

const PINK = '#ff4ad8';
const HOT = '#ffd0f4';

function drawWarlord(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const stuck = !!e.cl && e.cl.stuck && atk === 'cleave' && state === 'attack';
  // the Warlord blinks out for a moment while it winds up to teleport
  if (atk === 'blink' && state === 'tele' && Math.floor(t * 18) % 3 === 0) return;
  const steel = pose.rage ? '#3a2438' : '#2c2840';
  const dark = shade(steel, -0.4);
  const light = shade(steel, 0.55);
  const trim = pose.rage ? '#ff7ab0' : '#9a6ae0';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
  const nova = atk === 'nova' && act;
  const roar = atk === 'summon' && act;
  const raised = (atk === 'cleave' && state === 'tele') || (atk === 'beams' && act);

  // ---- cape: hangs from the shoulders behind, rippling; ragged edge burns pink in the last phase
  for (let i = 0; i < 9; i++) {
    const x = -34 + i * 4;
    const sway = Math.round(Math.sin(t * 5 + i * 0.7) * (2 + i * 0.25));
    const len = 84 + (i % 3) * 5 + (walking ? 4 : 0);
    B.r(x + sway - (walking ? 3 : 0), -96 - bob, 4, len, i % 2 ? '#3a1058' : '#4a1a6a');
    if (pose.rage && Math.floor(t * 11 + i) % 3 === 0) B.r(x + sway, -96 - bob + len - 6, 3, 6, PINK);
  }
  // ---- legs and boots
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.r(-18 + la, -28, 13, 28, dark);
  B.r(-20 + la, -8, 17, 8, shade(dark, -0.3));
  B.r(-18 + la, -28, 13, 2, light);
  B.r(5 + lb, -28, 13, 28, steel);
  B.r(3 + lb, -8, 19, 8, dark);
  B.r(5 + lb, -28, 13, 2, light);
  // ---- skirt of plates
  B.r(-26, -46 - bob, 52, 20, dark);
  for (let i = 0; i < 6; i++) B.r(-26 + i * 9, -46 - bob, 8, 18, i % 2 ? steel : shade(steel, 0.12));
  B.r(-26, -46 - bob, 52, 2, trim);
  // ---- torso
  B.r(-26, -92 - bob, 52, 48, steel);
  B.r(-26, -92 - bob, 52, 3, light);
  B.r(-26, -92 - bob, 4, 48, dark);
  B.r(22, -92 - bob, 4, 48, dark);
  B.r(-20, -86 - bob, 14, 2, trim); // rune line on the back plate
  B.r(-20, -78 - bob, 10, 2, trim);
  // ---- the Rift Heart cavity down the front: x 2..22, y -58..-12
  B.r(0, -60 - bob, 26, 50, '#14061f');
  if (open || nova) {
    const pulse = 0.5 + 0.5 * Math.sin(t * (pose.mid ? 12 : 8));
    const heartCol = nova ? '#ffffff' : pulse > 0.5 ? PINK : shade(PINK, -0.25);
    for (let y = -58; y <= -14; y += 2) {
      const half = Math.round(10 * (1 - Math.abs(y + 36) / 24));
      if (half > 0) B.r(13 - half, y - bob, half * 2, 2, heartCol);
    }
    for (let y = -46; y <= -26; y += 2) B.r(11, y - bob, 4, 2, HOT);
    if (nova) {
      ctx.globalAlpha = 0.4;
      B.disc(13, -36 - bob, 14 + Math.round(tele * 12), PINK);
      ctx.globalAlpha = 1;
    }
  } else {
    // shutters of black iron slide over the heart
    B.r(2, -58 - bob, 22, 22, '#3a3448');
    B.r(2, -34 - bob, 22, 22, '#2a2638');
    B.r(2, -36 - bob, 22, 2, '#14061f');
    B.r(2, -58 - bob, 22, 1, '#8a82a8');
    B.r(2, -34 - bob, 22, 1, '#8a82a8');
    B.r(10, -48 - bob, 6, 2, pose.rage ? '#ff4a6a' : trim);
    B.r(10, -24 - bob, 6, 2, pose.rage ? '#ff4a6a' : trim);
  }
  // ---- pauldrons with spikes
  B.r(-36, -98 - bob, 20, 14, dark);
  B.r(-36, -98 - bob, 20, 2, light);
  B.r(14, -98 - bob, 24, 16, steel);
  B.r(14, -98 - bob, 24, 2, light);
  for (let i = 0; i < 3; i++) {
    B.r(-32 + i * 6, -104 - bob, 2, 6, trim);
    B.r(18 + i * 7, -105 - bob, 2, 7, trim);
  }
  // ---- head: horned helm with a slit of light
  const hy = -118 - bob - (roar ? 2 : 0);
  B.r(-9, hy, 24, 22, dark);
  B.r(-9, hy, 24, 2, light);
  B.r(15, hy + 6, 4, 10, dark);
  B.r(-4, hy + 8, 18, 3, '#14061f');
  B.r(-2, hy + 9, 14, 1, pose.rage || act ? '#ff3a3a' : PINK);
  B.r(-12, hy - 10, 3, 14, trim); // horns sweep up and out
  B.r(-14, hy - 16, 3, 8, trim);
  B.r(14, hy - 10, 3, 14, trim);
  B.r(16, hy - 16, 3, 8, trim);
  if (roar) B.r(-2, hy + 14, 14, 3, PINK);
  // ---- arms
  const sx = 24;
  const sy = -88 - bob;
  let hx = 30;
  let hyy = -62;
  let tipx = 50;
  let tipy = -26;
  if (raised) {
    const k = atk === 'cleave' ? tele : 1;
    hx = 24 - Math.round(14 * k);
    hyy = -62 - Math.round(36 * k);
    tipx = 14 - Math.round(40 * k) + 26;
    tipy = -26 - Math.round(100 * k);
    if (atk === 'beams') {
      tipx = 20;
      tipy = -150;
    }
  } else if (stuck) {
    hx = 34;
    hyy = -48;
    tipx = 44;
    tipy = 2;
  } else if (nova) {
    hx = 40;
    hyy = -78;
    tipx = 60;
    tipy = -60;
  } else if (roar) {
    hx = 38;
    hyy = -96;
    tipx = 56;
    tipy = -124;
  }
  // the back arm reaches across the body
  B.line(-30, sy + 4, -14 + (nova || roar ? -14 : 0), nova || roar ? -96 : -60, dark, 6);
  B.disc(-14 + (nova || roar ? -14 : 0), nova || roar ? -96 : -60, 4, steel);
  // the sword arm
  B.line(sx, sy + 4, hx, hyy, steel, 7);
  B.line(sx, sy + 2, hx, hyy - 2, light, 2);
  B.disc(hx, hyy, 5, dark);
  // ---- the rift blade: a dark blade with an edge of tearing light and a few sparks
  B.line(hx, hyy, tipx, tipy, '#14061f', 7);
  B.line(hx + 1, hyy, tipx + 1, tipy, PINK, 2);
  B.line(hx - 1, hyy, tipx - 1, tipy, '#7a2aa0', 1);
  const gdx = tipx - hx;
  const gdy = tipy - hyy;
  const gl = Math.hypot(gdx, gdy) || 1;
  B.line(hx - (gdy / gl) * 7 + (gdx / gl) * 8, hyy + (gdx / gl) * 7 + (gdy / gl) * 8, hx + (gdy / gl) * 7 + (gdx / gl) * 8, hyy - (gdx / gl) * 7 + (gdy / gl) * 8, trim, 3); // cross-guard
  if (stuck && Math.floor(t * 16) % 2 === 0) {
    B.r(tipx - 6, 0, 3, 2, HOT);
    B.r(tipx + 5, -3, 3, 2, PINK);
  }
  if (raised && Math.floor(t * 20) % 2 === 0) B.disc(tipx, tipy, 3, HOT);
  // ---- phase 3: cracks of light across the armour
  if (pose.rage) {
    B.r(-14, -70 - bob, 2, 10, PINK);
    B.r(-12, -62 - bob, 6, 2, PINK);
    B.r(-6, -90 - bob, 2, 8, PINK);
  }
}

export function registerBossesW14(painters) {
  painters.warlord = () => bossFrames(140, 150, drawWarlord);
}
