// Pickup sprites (weapon letters, R, B, bomb, medal, 1UP heart) and the flying capsule.

import { Painter, blit } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { shade } from './common.js';
import { pickupInfo, PICKUPS } from '../pickups.js';
import { parkedTankSprite } from './tank.js';

const cache = new Map();

function badge(letter, color) {
  const p = new Painter(15, 15);
  p.rect(0, 0, 15, 15, '#0d0d14');
  p.rect(1, 1, 13, 13, shade(color, -0.35));
  p.rect(1, 1, 13, 7, color);
  p.rect(1, 1, 13, 1, shade(color, 0.5));
  p.px(0, 0, null);
  drawText(p.ctx, letter, 8, 4, '#ffffff', 1, 'center', '#000000');
  return p.canvas;
}

function medal() {
  const p = new Painter(11, 14);
  p.rect(2, 0, 3, 5, '#d92b2b');
  p.rect(6, 0, 3, 5, '#2b5fd9');
  p.ellipse(5, 9, 4, 4, '#a8741a');
  p.ellipse(5, 9, 3, 3, '#ffd23a');
  p.rect(5, 6, 1, 6, '#fff2a8');
  p.rect(3, 8, 5, 1, '#fff2a8');
  p.px(4, 7, '#fff2a8');
  p.px(6, 7, '#fff2a8');
  return p.canvas;
}

function heart() {
  const p = new Painter(13, 12);
  const c = '#ff4a6a';
  p.rect(1, 1, 4, 4, c);
  p.rect(8, 1, 4, 4, c);
  p.rect(0, 2, 13, 3, c);
  p.rect(1, 5, 11, 2, c);
  p.rect(2, 7, 9, 2, c);
  p.rect(4, 9, 5, 1, c);
  p.rect(5, 10, 3, 1, c);
  p.rect(2, 2, 2, 2, '#ffb0c0');
  p.rect(0, 5, 1, 1, '#a82040');
  p.rect(12, 5, 1, 1, '#a82040');
  p.rect(3, 8, 7, 1, '#c02848');
  p.rect(4, 9, 5, 1, '#a82040');
  return p.canvas;
}

function bombIcon() {
  const p = new Painter(13, 13);
  p.rect(0, 0, 13, 13, '#0d0d14');
  p.rect(1, 1, 11, 11, '#3a4050');
  p.ellipse(6, 7, 4, 4, '#9aa4b8');
  p.ellipse(5, 6, 2, 2, '#d8dde8');
  p.rect(5, 2, 3, 2, '#d8dde8');
  p.px(8, 1, '#ffb02e');
  p.px(9, 0, '#ff5a1e');
  return p.canvas;
}

function sprite(item) {
  let s = cache.get(item);
  if (s) return s;
  const d = pickupInfo(item);
  if (d.kind === 'medal') s = medal();
  else if (d.kind === 'life') s = heart();
  else if (d.kind === 'bomb') s = bombIcon();
  else if (d.kind === 'tank') s = parkedTankSprite();
  else s = badge(d.letter, d.color);
  cache.set(item, s);
  return s;
}

/** Paint every pickup badge now instead of when one first comes into view. */
export function warmPickups() {
  for (const item of Object.keys(PICKUPS)) sprite(item);
}

/** Small icon of an item (used by the HUD for the carried weapons). */
export function pickupIcon(item) {
  return sprite(item);
}

export function drawPickup(ctx, pk, ox, oy) {
  const img = sprite(pk.item);
  const bob = pk.float ? Math.round(Math.sin(pk.t * 4) * 2) : 0;
  let pulse = 0;
  if (pk.def.kind === 'life') pulse = Math.floor(pk.t * 6) % 2;
  blit(ctx, img, pk.x - ox - (img.ox ?? img.width / 2), pk.y - oy - img.height + bob - pulse);
}

// ---- the flying capsule (an enemy template, see enemy_defs.js) ----

function capsuleFrame(flap, blink) {
  const p = new Painter(22, 16);
  const wingY = flap ? 2 : 5;
  // wings
  p.rect(2, wingY, 6, 3, '#c8d0dc');
  p.rect(14, wingY, 6, 3, '#c8d0dc');
  p.rect(2, wingY, 6, 1, '#ffffff');
  p.rect(14, wingY, 6, 1, '#ffffff');
  // pod
  p.ellipse(11, 10, 8, 5, '#6a7488');
  p.ellipse(11, 9, 7, 4, '#aab4c8');
  p.rect(5, 8, 12, 1, '#e8eef8');
  p.rect(5, 12, 12, 1, '#4a5468');
  // beacon
  p.rect(9, 7, 4, 4, blink ? '#ff4a3a' : '#7a1a1a');
  p.px(10, 8, blink ? '#ffd0c0' : '#a02a2a');
  return p.canvas;
}

export function capsulePainter() {
  const a = capsuleFrame(true, true);
  const b = capsuleFrame(false, false);
  return { idle: a, run: [a, b], w: 22, h: 16, ox: 11 };
}
