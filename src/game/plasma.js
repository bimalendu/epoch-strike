// The Plasma Cannon (era 5: levels 17-20): a fast, armour-piercing bolt that bursts in a small ball of plasma where it
// lands, hurting the other ordinary enemies standing next to the victim (never a boss: the burst is a crowd-clearer).

import { damageEnemy } from './enemies.js';
import { ring, spark } from './fx.js';

export const PLASMA_R = 22; // px from the burst
export const PLASMA_SPLASH = 0.9;

/** A plasma bolt hit enemy `hit` (or a wall): the burst scorches the others near it. */
export function plasmaBurst(b, world, hit = null) {
  ring(world, b.x, b.y, '#ff9af0', PLASMA_R, 0.22);
  spark(world, b.x, b.y, '#ffd8ff', 4, 70);
  for (const e of world.enemies) {
    if (!e.alive || e.hidden || e.waiting || e === hit || e.def.boss) continue;
    if (Math.hypot(e.x - b.x, e.cy - b.y) > PLASMA_R + e.w / 2) continue;
    damageEnemy(world, e, PLASMA_SPLASH, { x: b.x, y: b.y, vx: 0, vy: 0 }, true);
  }
}
