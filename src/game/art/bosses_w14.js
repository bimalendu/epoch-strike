// Boss art for Level 20: the Rift Warlord (level 20). Same conventions as bosses.js: a Brush in boss-local coordinates
// (origin = centre of the feet, +x = facing, -y = up).

import { shade, mix } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const PINK = '#ff4ad8';
const HOT = '#ffd0f4';

const WARLORD_MARKS = [
  { x: -18, y: -72, kind: 'crack', phase: 1 },
  { x: -8, y: -90, kind: 'plate', phase: 1 },
  { x: 16, y: -88, kind: 'crack', phase: 1 },
  { x: -22, y: -42, kind: 'scorch', phase: 2 },
  { x: -26, y: -92, kind: 'smoke', phase: 2 },
  { x: 22, y: -64, kind: 'spark', phase: 2 },
];

function drawWarlord(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const t = pose.bs.age;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const stuck = !!e.cl && e.cl.stuck && atk === 'cleave' && state === 'attack';
  // the Warlord blinks out for a moment while it winds up to teleport
  if (atk === 'blink' && state === 'tele' && Math.floor(t * 18) % 3 === 0) return;
  const steel = burn(pose.rage ? '#3a2438' : '#2c2840');
  const dark = shade(steel, -0.4);
  const light = shade(steel, 0.55);
  const trim = burn(pose.rage ? '#ff7ab0' : '#9a6ae0');
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
  const hb = bob + (breathe(pose, 1) > 0 ? 1 : 0); // head and shoulders ride a breath higher than the hips
  const nova = atk === 'nova' && act;
  const roar = atk === 'summon' && act;
  const raised = (atk === 'cleave' && state === 'tele') || (atk === 'beams' && act);
  // loose parts: both horns and the front pauldron fly off when it falls
  const hornL = { x: -Math.round(dead.fly * 0.9), y: -Math.round(dead.fly * 0.8 - dead.k * dead.k * 40) };
  const hornR = { x: Math.round(dead.fly * 0.9), y: -Math.round(dead.fly * 1.0 - dead.k * dead.k * 40) };
  const pauld = { x: Math.round(dead.fly * 0.6), y: -Math.round(dead.fly * 0.6 - dead.k * dead.k * 40) };

  // ---- cape: hangs from the shoulders behind, rippling; ragged edge burns pink in the last phase
  for (let i = 0; i < 9; i++) {
    const x = -34 + i * 4;
    const sway = Math.round(Math.sin(t * 5 + i * 0.7) * (2 + i * 0.25));
    const len = 84 + (i % 3) * 5 + (walking ? 4 : 0);
    B.r(x + sway - (walking ? 3 : 0), -96 - bob, 4, len, burn(i % 2 ? '#3a1058' : '#4a1a6a'));
    if (pose.rage && Math.floor(t * 11 + i) % 3 === 0) B.r(x + sway, -96 - bob + len - 6, 3, 6, burn(PINK));
  }
  // ---- legs and boots
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.part(-18 + la, -28, 13, 28, dark);
  B.part(-20 + la, -8, 17, 8, shade(dark, -0.3));
  B.part(5 + lb, -28, 13, 28, steel);
  B.part(3 + lb, -8, 19, 8, dark);
  // ---- skirt of plates, as wide as the chest
  B.part(-26, -46 - bob, 56, 20, dark);
  for (let i = 0; i < 7; i++) B.slab(-26 + i * 8, -46 - bob, 7, 18, i % 2 ? steel : shade(steel, 0.12));
  B.r(-26, -46 - bob, 56, 2, trim);
  // ---- torso
  B.part(-26, -92 - bob, 56, 48, steel);
  B.r(-26, -91 - bob, 4, 46, dark);
  B.r(26, -91 - bob, 4, 46, dark);
  B.r(-20, -86 - bob, 14, 2, trim); // rune line on the back plate
  B.r(-20, -78 - bob, 10, 2, trim);
  // ---- the Rift Heart: the weak point, as wide as the box that takes the hits (x -4..30, y -50..-12)
  weakPoint(B, -4, -50, 34, 38, { open: open || nova, col: nova ? '#ffffff' : PINK, age: t, hit: e.flash || 0 });
  if (open || nova) {
    for (let y = -46; y <= -16; y += 2) {
      const half = Math.round(13 * (1 - Math.abs(y + 31) / 17));
      if (half > 0) B.r(13 - half, y, half * 2, 2, nova ? '#ffe8ff' : HOT);
    }
    if (nova) {
      ctx.globalAlpha = 0.4;
      B.disc(13, -31, 14 + Math.round(tele * 12), PINK);
      ctx.globalAlpha = 1;
    }
  } else {
    B.r(10, -48, 6, 2, burn(pose.rage ? '#ff4a6a' : trim));
    B.r(10, -16, 6, 2, burn(pose.rage ? '#ff4a6a' : trim));
  }
  // ---- pauldrons with spikes
  B.part(-36, -98 - hb, 20, 14, dark);
  B.part(14 + pauld.x, -98 - hb + pauld.y, 24, 16, steel);
  for (let i = 0; i < 3; i++) {
    B.r(-32 + i * 6, -104 - hb, 2, 6, trim);
    B.r(18 + i * 7 + pauld.x, -105 - hb + pauld.y, 2, 7, trim);
  }
  // ---- head: horned helm with a slit of light
  const hy = -118 - hb - (roar ? 2 : 0) + (dead.k ? Math.round(dead.k * 6) : 0);
  B.r(-5, hy + 20, 16, 8, dark); // neck
  B.part(-9, hy, 24, 22, dark);
  B.part(15, hy + 6, 4, 10, dark);
  B.r(-4, hy + 8, 18, 3, '#14061f');
  B.r(-2, hy + 9, 14, 1, blink(t, 2) && state === 'idle' ? '#14061f' : burn(pose.rage || act ? '#ff3a3a' : PINK));
  B.part(-12 + hornL.x, hy - 10 + hornL.y, 3, 14, trim); // horns sweep up and out
  B.part(-14 + hornL.x, hy - 16 + hornL.y, 3, 8, trim);
  B.part(14 + hornR.x, hy - 10 + hornR.y, 3, 14, trim);
  B.part(16 + hornR.x, hy - 16 + hornR.y, 3, 8, trim);
  if (roar) B.r(-2, hy + 14, 14, 3, PINK);
  // ---- arms
  const sx = 24;
  const sy = -88 - hb;
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
  B.stroke(-30, sy + 4, -14 + (nova || roar ? -14 : 0), nova || roar ? -96 : -60, dark, 6);
  B.disc(-14 + (nova || roar ? -14 : 0), nova || roar ? -96 : -60, 4, steel);
  // the sword arm
  B.stroke(sx, sy + 4, hx, hyy, steel, 7);
  B.line(sx, sy + 2, hx, hyy - 2, light, 2);
  B.disc(hx, hyy, 5, dark);
  // ---- the rift blade: a dark blade with an edge of tearing light and a few sparks
  B.line(hx, hyy, tipx, tipy, '#14061f', 7);
  B.line(hx + 1, hyy, tipx + 1, tipy, burn(PINK), 2);
  B.line(hx - 1, hyy, tipx - 1, tipy, burn('#7a2aa0'), 1);
  const gdx = tipx - hx;
  const gdy = tipy - hyy;
  const gl = Math.hypot(gdx, gdy) || 1;
  B.line(hx - (gdy / gl) * 7 + (gdx / gl) * 8, hyy + (gdx / gl) * 7 + (gdy / gl) * 8, hx + (gdy / gl) * 7 + (gdx / gl) * 8, hyy - (gdx / gl) * 7 + (gdy / gl) * 8, trim, 3); // cross-guard
  if (stuck && Math.floor(t * 16) % 2 === 0) {
    B.r(tipx - 6, 0, 3, 2, HOT);
    B.r(tipx + 5, -3, 3, 2, PINK);
  }
  if (raised && Math.floor(t * 20) % 2 === 0) B.disc(tipx, tipy, 3, HOT);
  // ---- rift motes: sparks of torn light drift up off the blade while it waits
  if (state === 'idle') {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i / 3) % 1;
      B.r(tipx + Math.round(Math.sin(t * 3 + i * 2) * 4) - 1, tipy - 4 - Math.round(ph * 22), 2, 2, ph < 0.6 ? PINK : '#7a2aa0');
    }
  }
  // ---- phase 3: cracks of light across the armour
  if (pose.rage) {
    B.r(-14, -70 - bob, 2, 10, burn(PINK));
    B.r(-12, -62 - bob, 6, 2, burn(PINK));
    B.r(-6, -90 - bob, 2, 8, burn(PINK));
  }
  damageMarks(B, pose, WARLORD_MARKS);
}

export function registerBossesW14(painters) {
  painters.warlord = () => bossFrames(140, 150, drawWarlord);
}
