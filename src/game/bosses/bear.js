// Level 4 boss: the Cave Bear Hive. A cave bear the Rift has grown a pulsing hive on: the hive crowns its head and
// shoulders, well above where a standing soldier's rifle points. Shoot it from a ledge or from the air while it is
// open (between attacks, while it swarms, and when it is dazed after a charge). Ground-level shots only chip armour.
//
//   swipe   rears up, then two claw slashes in front of it
//   swarm   the hive swells open and releases cave bats (phase 2: more of them)
//   lunge   crouches with burning eyes, charges, crashes into the wall: stalactites fall and it is dazed
//   quake   (phase 2) rears and slams: shockwaves along the floor both ways plus falling rock

import { shockwave, dropRock } from '../boss.js';
import { spawnEnemy } from '../enemies.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack' && bs.atk === 'swarm') return true;
  if (bs.state === 'attack' && bs.atk === 'lunge' && e.cs && e.cs.mode === 'stun') return true;
  return false;
}

/** One claw slash: a short-lived harmless-to-walls hazard in front of the bear. */
function slash(w, x, y) {
  w.spawnEnemyBullet({ x, y, vx: 0, vy: 0, r: 7, kind: 'claw', persist: true, ghost: true, life: 0.3 });
}

export const bear = {
  id: 'bear',
  arch: 'boss',
  boss: true,
  tpl: 'bear',
  name: 'CAVE BEAR HIVE',
  hp: 180,
  w: 56,
  h: 62,
  score: 10000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['swipe', 'swarm', 'lunge'], cd: [1.3, 2.0] },
    { hp: 0.5, attacks: ['swipe', 'swarm', 'lunge', 'quake'], cd: [0.9, 1.5] },
  ],

  /** The hive crown, in world pixels, while it is open. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 2 * f;
    const b = e.x + 30 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 64, y1: e.y - 38 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 110) {
      e.vx = -60;
      return false;
    }
    e.vx = 0;
    return true;
  },

  idle(e, w) {
    const p = w.player;
    const L = w.bossArena;
    e.face = p.x >= e.x ? 1 : -1;
    const dx = p.x - e.x;
    if (Math.abs(dx) > 170) e.vx = Math.sign(dx) * 36;
    else if (Math.abs(dx) < 80) e.vx = -Math.sign(dx) * 30;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    swipe: {
      tele: 0.8,
      dur: 1.1,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.vx = e.face * 120; // a step forward as the paw comes down
        e.sw = 0;
      },
      tick(e, w, t) {
        if (t > 0.3) e.vx = 0;
        const f = e.face;
        if (e.sw === 0 && t >= 0.12) {
          e.sw = 1;
          w.sfx('swing');
          slash(w, e.x + 44 * f, e.y - 26);
          slash(w, e.x + 58 * f, e.y - 10);
        } else if (e.sw === 1 && t >= 0.6) {
          e.sw = 2;
          w.sfx('swing');
          slash(w, e.x + 46 * f, e.y - 44);
          slash(w, e.x + 58 * f, e.y - 24);
        }
      },
      end(e) {
        e.vx = 0;
      },
    },

    swarm: {
      tele: 0.8,
      dur: 2.4,
      when: (e, w) => w.crowd() < w.enemyCap - 1,
      start(e, w) {
        e.sp = 0;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
      },
      tick(e, w, t) {
        const total = e.bs.phase >= 1 ? 4 : 3;
        const due = Math.min(total, Math.floor(t / 0.55) + 1);
        while (e.sp < due && t < 2.0) {
          e.sp++;
          if (w.crowd() >= w.enemyCap) break;
          spawnEnemy(w, { type: 'bat', x: e.x + 14 * e.face, y: e.y - 66, face: e.face });
          w.sfx('swing');
        }
      },
    },

    lunge: {
      tele: 1.0,
      dur: 9,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.cs = { mode: 'run', t: 0 };
        e.vx = e.face * (e.bs.phase >= 1 ? 215 : 185);
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        const cs = e.cs;
        if (cs.mode === 'run') {
          cs.t += dt;
          const wall = (e.face < 0 && e.x <= L.x0 + 44) || (e.face > 0 && e.x >= L.x1 - 44) || e.hitWall;
          if (wall || cs.t > 2.4) {
            cs.mode = 'stun';
            cs.t = 1.8;
            e.vx = 0;
            if (wall) {
              w.camera.shake(7, 0.6);
              w.sfx('bigBoom');
              for (let i = 0; i < 3; i++) {
                dropRock(w, L.x0 + 50 + w.rand() * (L.x1 - L.x0 - 100), { delay: 0.8 + i * 0.3, kind: 'rock' });
              }
            }
          }
        } else {
          cs.t -= dt;
          e.vx = 0;
          if (cs.t <= 0) e.bs.t = 0;
        }
      },
      end(e) {
        e.vx = 0;
        e.cs = null;
      },
    },

    quake: {
      tele: 0.95,
      dur: 1.3,
      start(e, w) {
        const L = w.bossArena;
        w.camera.shake(6, 0.5);
        w.sfx('bigBoom');
        shockwave(w, e.x + 34 * e.face, L.floorY, e.face, 150);
        shockwave(w, e.x - 34 * e.face, L.floorY, -e.face, 150);
        for (let i = 0; i < 3; i++) {
          dropRock(w, L.x0 + 40 + w.rand() * (L.x1 - L.x0 - 80), { delay: 0.8 + i * 0.3, kind: 'rock' });
        }
      },
    },
  },
};
