// Soft glows behind bullets and pickups in the neon, cave, volcano and factory themes (`theme.glow`) at high effects
// quality. A glow is a pre-rendered disc of four nested alpha steps in a washed-out version of the colour (a saturated one
// goes muddy over a dark sky), so it is one drawImage.

import { Painter } from '../../engine/gfx.js';
import { mix } from './common.js';

// player bullet kind -> its colour (the weapon's own `color`)
export const BULLET_GLOW = {
  rifle: '#ffe66b', mg: '#cfe8ff', spread: '#4fd84a', laser: '#5ad8ff', flame: '#ff9a1e', homing: '#b58aff',
  spear: '#ffb04a', ballista: '#e8d8a0', crossbow: '#c8d8f0', tesla: '#9ad8ff', plasma: '#ff9af0', tankshell: '#ffb04a',
};
export const ENEMY_BULLET_GLOW = '#ff5a3a';
export const PICKUP_GLOW = '#ffe27a';
const R_BULLET = 8;
const R_ENEMY = 8;
const R_PICKUP = 14;

const cache = new Map();

function sprite(col, r) {
  const key = `${col}|${r}`;
  let c = cache.get(key);
  if (!c) {
    const p = new Painter(r * 2 + 1, r * 2 + 1);
    p.ctx.globalAlpha = 0.085;
    const light = mix(col, '#ffffff', 0.4);
    for (const k of [1, 0.75, 0.5, 0.25]) p.ellipse(r, r, Math.round(r * k), Math.round(r * k), light);
    p.ctx.globalAlpha = 1;
    c = p.canvas;
    cache.set(key, c);
  }
  return c;
}

/** Paint every glow sprite now instead of at the first bullet. */
export function warmGlow() {
  for (const col of new Set(Object.values(BULLET_GLOW))) sprite(col, R_BULLET);
  sprite(ENEMY_BULLET_GLOW, R_ENEMY);
  sprite(PICKUP_GLOW, R_PICKUP);
}

function draw(ctx, x, y, col, r) {
  ctx.drawImage(sprite(col, r), Math.round(x) - r, Math.round(y) - r);
}

export function drawPickupGlows(ctx, world, ox, oy) {
  for (const pk of world.pickups) draw(ctx, pk.x - ox, pk.y - oy - 8, PICKUP_GLOW, R_PICKUP);
}

/** Glows behind every shot in the air (call before the bullets themselves are drawn). */
export function drawBulletGlows(ctx, world, ox, oy) {
  for (const b of world.bullets) draw(ctx, b.x - ox, b.y - oy, BULLET_GLOW[b.kind] || BULLET_GLOW.rifle, R_BULLET);
  for (const b of world.ebullets) if (!b.ghost) draw(ctx, b.x - ox, b.y - oy, ENEMY_BULLET_GLOW, R_ENEMY);
}
