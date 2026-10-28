// The soldier's tank: a squat olive-drab tank with a rounded turret, drawn procedurally. The hull is a pre-rendered
// sprite (44x24, facing right, origin at the bottom centre); the tracks, barrel and rider are drawn on top each frame.

import { Painter, blit, lineTo } from '../../engine/gfx.js';
import { shade } from './common.js';

const OLIVE = '#62803c';
const OLIVE_D = '#3e5626';
const OLIVE_L = '#8cae52';
const TRACK = '#23231d';
const TRACK_L = '#4a4a3c';
const STEEL = '#7c8274';

export const TANK_W = 44;
export const TANK_H = 24;

let hullImg = null;

function hull() {
  if (hullImg) return hullImg;
  const p = new Painter(TANK_W, TANK_H);
  // tracks with rounded ends
  p.rect(5, 15, 34, 9, TRACK);
  p.rect(3, 17, 38, 5, TRACK);
  p.rect(6, 14, 32, 1, TRACK_L);
  p.rect(4, 16, 1, 1, TRACK_L);
  p.rect(39, 16, 1, 1, TRACK_L);
  // road wheels
  for (const wx of [9, 16, 23, 30, 36]) {
    p.ellipse(wx, 19, 3, 3, '#33332a');
    p.ellipse(wx, 19, 1, 1, '#7a7a66');
  }
  // lower hull
  p.rect(7, 10, 31, 6, OLIVE);
  p.rect(7, 10, 31, 1, OLIVE_L);
  p.rect(7, 15, 31, 1, OLIVE_D);
  // sloped front plate
  p.rect(38, 11, 3, 5, OLIVE_D);
  p.rect(37, 10, 2, 1, OLIVE_L);
  p.px(41, 13, OLIVE_D);
  // engine deck at the back: louvres and an exhaust
  p.rect(7, 8, 9, 2, OLIVE_D);
  for (let x = 8; x < 15; x += 2) p.rect(x, 9, 1, 1, '#1c2412');
  p.rect(3, 8, 3, 2, STEEL);
  p.rect(2, 7, 2, 2, STEEL);
  // turret
  p.rect(16, 4, 15, 6, OLIVE);
  p.rect(17, 3, 12, 1, OLIVE);
  p.rect(16, 4, 15, 1, OLIVE_L);
  p.rect(16, 9, 15, 1, OLIVE_D);
  p.rect(30, 5, 2, 4, OLIVE_D);
  // star
  p.rect(22, 6, 3, 1, '#e8e8d8');
  p.rect(23, 5, 1, 3, '#e8e8d8');
  // hatch ring
  p.rect(19, 2, 5, 1, STEEL);
  return (hullImg = p.canvas);
}

/**
 * Draw the player's tank. (x, y) = bottom centre in screen pixels; `aim` = barrel direction; `t` = track phase.
 * hp: remaining armour (smoke when low); rider: draw the soldier's head in the hatch.
 */
export function drawTank(ctx, x, y, face, aim, t, hp = 4, rider = true, moving = true) {
  const flip = face < 0;
  const left = Math.round(x) - TANK_W / 2;
  const top = Math.round(y) - TANK_H;
  blit(ctx, hull(), left, top, flip, false);
  // moving tread marks along the top and bottom of the track
  const s = flip ? -1 : 1;
  const off = moving ? Math.floor(t * 18) % 5 : 0;
  ctx.fillStyle = TRACK_L;
  for (let i = 0; i < 8; i++) {
    const tx = 6 + ((i * 5 + off) % 34);
    ctx.fillRect(Math.round(x) + s * (tx - 22) - (flip ? 1 : 0), top + 22, 2, 1);
  }
  // barrel from the turret pivot
  const px = Math.round(x) + s * 3;
  const py = top + 8;
  const len = 19;
  const ex = px + aim.x * len;
  const ey = py + aim.y * len;
  lineTo(ctx, px, py, ex, ey, '#3c4a2a', 3);
  lineTo(ctx, px + aim.x * 4, py + aim.y * 4, px + aim.x * (len - 1), py + aim.y * (len - 1), OLIVE, 1);
  lineTo(ctx, px + aim.x * (len - 3), py + aim.y * (len - 3), ex, ey, STEEL, 3);
  // the rider in the hatch
  if (rider) {
    const hx = Math.round(x) - s * 4;
    ctx.fillStyle = '#1b1018';
    ctx.fillRect(hx - 3, top - 4, 7, 6);
    ctx.fillRect(hx - 3 - s * 3, top - 3, 5, 3);
    ctx.fillStyle = '#e9a97a';
    ctx.fillRect(hx - 2, top - 3, 5, 4);
    ctx.fillStyle = '#b5784f';
    ctx.fillRect(hx - s * 2, top - 1, 1, 2);
    ctx.fillStyle = '#d92b2b';
    ctx.fillRect(hx - 2, top - 3, 5, 2);
    ctx.fillRect(hx - 2 - s * 3, top - 2, 3, 1);
    ctx.fillStyle = '#f05a4a';
    ctx.fillRect(hx - 1, top - 3, 3, 1);
    ctx.fillStyle = '#f4f0f0';
    ctx.fillRect(hx, top - 1, 1, 1);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(hx + s, top - 1, 1, 1);
  }
  if (hp <= 1) {
    // a wounded tank trails smoke and a flicker of fire from the engine deck
    ctx.fillStyle = '#6a6a62';
    const k = Math.floor(t * 9) % 3;
    ctx.fillRect(Math.round(x) - s * 18 - k, top + 2 - k * 3, 3, 3);
    ctx.fillRect(Math.round(x) - s * 20 + k, top - 4 - k * 2, 2, 2);
    if (Math.floor(t * 14) % 2 === 0) {
      ctx.fillStyle = '#ff8a1e';
      ctx.fillRect(Math.round(x) - s * 16, top + 7, 2, 2);
    }
  }
}

let parked = null;

/** A parked tank (the pickup at the start of a tank road): hull plus a level barrel. Image origin x = ox. */
export function parkedTankSprite() {
  if (parked) return parked;
  const p = new Painter(TANK_W + 18, TANK_H);
  blit(p.ctx, hull(), 0, 0);
  lineTo(p.ctx, 25, 8, 43, 8, '#3c4a2a', 3);
  lineTo(p.ctx, 40, 8, 44, 8, STEEL, 3);
  // an empty hatch, and a soldier's cap hung on it
  p.rect(19, 2, 5, 1, shade(STEEL, 0.2));
  p.rect(20, 1, 3, 1, '#d92b2b');
  parked = p.canvas;
  parked.ox = TANK_W / 2;
  return parked;
}
