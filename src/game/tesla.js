// The Tesla Coil's chain lightning: a bolt that hits an enemy jumps on to the nearest others around it.

import { damageEnemy } from './enemies.js';

export const CHAIN_RANGE = 78; // px from one victim to the next
export const CHAIN_HOPS = 2;
export const CHAIN_DMG = 0.8;

/** Called when a Tesla bolt hits enemy `e`: arcs to up to CHAIN_HOPS other living, visible, non-boss enemies. */
export function chainZap(b, world, e) {
  let fx = e.x;
  let fy = e.cy;
  const done = new Set([e]);
  for (let hop = 0; hop < CHAIN_HOPS; hop++) {
    let best = null;
    let bd = CHAIN_RANGE * CHAIN_RANGE;
    for (const t of world.enemies) {
      if (!t.alive || t.hidden || t.waiting || done.has(t) || t.def.boss || t.def.contact === false) continue;
      if (!world.onScreen(t.x, t.cy, -6)) continue;
      const dx = t.x - fx;
      const dy = t.cy - fy;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best) break;
    done.add(best);
    world.fx.push({ k: 'zap', x0: fx, y0: fy, x1: best.x, y1: best.cy, life: 0.16, max: 0.16, seed: Math.floor(world.rand() * 1000) });
    damageEnemy(world, best, CHAIN_DMG, { x: best.x, y: best.cy, vx: 0, vy: 0 });
    fx = best.x;
    fy = best.cy;
  }
}
