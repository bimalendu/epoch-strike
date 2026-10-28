// Firework rockets (the Great Wall's signature hazard). A rocket flies a short arc, then bursts into a ring of sparks
// that drift outwards and fall back down. Both the rocket and every spark hurt, so the safe place to stand is
// away from where the burst will be: the rocket's whole flight is visible for about a second beforehand.
//
// The burst point is chosen by the caller: crates burst straight above themselves, the Dragon Kite Fortress bursts
// them over the soldier's head.

import { spark, ring } from './fx.js';

export const SPARK_COLS = ['#ff4a4a', '#ffd23a', '#4ae0ff', '#7aff7a', '#ff7ad8'];
export const ROCKET_G = 240;

/**
 * Launch a rocket from (x, y) so that it bursts at (tx, ty) after `fuse` seconds.
 * opts: { tx, ty, fuse, n (sparks), burstSpeed, col, kind (bullet art, 'rocket' by default), r, onBurst (replaces the spark ring) }
 */
export function launchRocket(world, x, y, { tx = x, ty = y - 100, fuse = 1, n = 6, burstSpeed = 52, col = null, kind = 'rocket', r = 3, onBurst = null } = {}) {
  const c = col || SPARK_COLS[Math.floor(world.rand() * SPARK_COLS.length)];
  const vx = (tx - x) / fuse;
  const vy = (ty - y) / fuse - 0.5 * ROCKET_G * fuse;
  world.sfx('shootBolt');
  let age = 0;
  return world.spawnEnemyBullet({
    x,
    y,
    vx,
    vy,
    g: ROCKET_G,
    r,
    kind,
    col: c,
    life: fuse + 1,
    update(b, w, dt) {
      age += dt;
      if (age >= fuse && !b.dead) {
        b.dead = true;
        if (onBurst) onBurst(w, b.x, b.y);
        else burst(w, b.x, b.y, n, burstSpeed * w.bulletMul, c);
      }
    },
  });
}

/** The burst itself: a ring of falling sparks. */
export function burst(world, x, y, n = 6, speed = 52, col = '#ffd23a') {
  world.sfx('boom');
  ring(world, x, y, col, 26, 0.35);
  spark(world, x, y, '#ffffff', 5, 60);
  const off = world.rand() * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    world.spawnEnemyBullet({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      g: 170,
      r: 2,
      kind: 'spark',
      col: i % 2 ? col : '#ffffff',
      life: 1.15,
    });
  }
}

/** How long a rocket launched straight up to `rise` px takes to reach its top. */
export function fuseForRise(rise) {
  return Math.sqrt((2 * rise) / ROCKET_G);
}

/** A lingering cloud of poison gas on the floor at x: a block of puffs about 40 px wide and 36 px tall. It hurts until it thins. */
export function gasCloud(world, x, floorY, linger = 3.4) {
  world.sfx('boom');
  ring(world, x, floorY - 10, '#a8c858', 30, 0.4);
  for (let row = 0; row < 3; row++) {
    for (let k = -1; k <= 1; k++) {
      const dx = k * 13 + (row % 2) * 6 - 3;
      world.spawnEnemyBullet({ x: x + dx, y: floorY - 7 - row * 12, vx: 0, vy: 0, r: 7, kind: 'gas', persist: true, ghost: true, life: linger - row * 0.25 });
    }
  }
}
