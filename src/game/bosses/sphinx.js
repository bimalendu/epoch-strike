// Level 5 boss: the Animated Sphinx. A stone guardian the Rift has woken. Its gem-crowned face is the weak point, and
// it sits at head height: shoot up at it (diagonal fire, or jump and fire) while it is open. Shots into its stone body
// only chip.
//
//   paw      raises a paw, then slams it: a shockwave along the floor (phase 2+: a second wave right behind)
//   riddle   the gem flares and it fires a fan of golden glyphs at you
//   scarabs  opens its jaws and lets scarab beetles pour out (shoot them low, or jump them)
//   spout    (phase 2+) sand geysers erupt where you stand and around you, each with a floor warning
//   pounce   (phase 3) crouches, leaps at where you stand, lands with a shockwave each way and is dazed

import { shockwave, geyser, bossShoot, angleToPlayer } from '../boss.js';
import { spawnEnemy } from '../enemies.js';

const SAND = '#e8c878';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack' && (bs.atk === 'riddle' || bs.atk === 'scarabs')) return true;
  if (bs.state === 'attack' && bs.atk === 'pounce' && e.cs && e.cs.mode === 'stun') return true;
  return false;
}

export const sphinx = {
  id: 'sphinx',
  arch: 'boss',
  boss: true,
  tpl: 'sphinx',
  name: 'ANIMATED SPHINX',
  hp: 150,
  w: 70,
  h: 72,
  score: 12000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['paw', 'riddle', 'scarabs'], cd: [1.3, 1.9] },
    { hp: 0.66, attacks: ['paw', 'riddle', 'scarabs', 'spout'], cd: [1.0, 1.5] },
    { hp: 0.33, attacks: ['paw', 'riddle', 'spout', 'pounce'], cd: [0.8, 1.2] },
  ],

  /** The face and the gem on its brow, in world pixels, while it is open. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 8 * f;
    const b = e.x + 34 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 68, y1: e.y - 38 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 120) {
      e.vx = -48;
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
    if (Math.abs(dx) > 180) e.vx = Math.sign(dx) * 30;
    else if (Math.abs(dx) < 90) e.vx = -Math.sign(dx) * 26;
    else e.vx = 0;
    if (e.x < L.x0 + 55 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 55 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    paw: {
      tele: 0.9,
      dur: 1.3,
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        const f = e.face;
        w.camera.shake(4, 0.3);
        w.sfx('stomp');
        shockwave(w, e.x + 46 * f, L.floorY, f, 140);
        if (e.bs.phase >= 1) {
          w.after(0.42, () => {
            if (e.alive && e.bs && e.bs.state === 'attack') shockwave(w, e.x + 46 * f, L.floorY, f, 140);
          });
        }
      },
    },

    riddle: {
      tele: 0.8,
      dur: 2.2,
      start(e) {
        e.rd = 0;
      },
      tick(e, w, t) {
        const volleys = e.bs.phase >= 2 ? 3 : 2;
        const times = [0.25, 1.0, 1.7];
        if (e.rd < volleys && t >= times[e.rd]) {
          e.rd++;
          e.face = w.player.x >= e.x ? 1 : -1;
          const x = e.x + 30 * e.face;
          const y = e.y - 52;
          const a = angleToPlayer(w, x, y);
          for (const off of [-0.24, 0, 0.24]) bossShoot(w, x, y, a + off, 120, { kind: 'orb', col: '#ffd23a', r: 3 });
          w.sfx('enemyShoot');
        }
      },
    },

    scarabs: {
      tele: 0.8,
      dur: 2.6,
      when: (e, w) => w.crowd() < w.enemyCap - 1,
      start(e) {
        e.sp = 0;
      },
      tick(e, w, t) {
        const total = e.bs.phase >= 1 ? 4 : 3;
        const due = Math.min(total, Math.floor(t / 0.6) + 1);
        while (e.sp < due && t < 2.2) {
          e.sp++;
          if (w.crowd() >= w.enemyCap) break;
          spawnEnemy(w, { type: 'scarab', x: e.x + 34 * e.face, y: e.y, face: e.face });
          w.sfx('swing');
        }
      },
    },

    spout: {
      tele: 0.9,
      dur: 2.0,
      start(e, w) {
        const L = w.bossArena;
        const n = e.bs.phase >= 2 ? 5 : 3;
        const px = w.player.x;
        for (let i = 0; i < n; i++) {
          const x = px + (i - (n - 1) / 2) * 44;
          if (x > L.x0 + 14 && x < L.x1 - 14) geyser(w, x, L.floorY, { delay: 0.85 + i * 0.12, col: SAND });
        }
      },
    },

    pounce: {
      tele: 1.0,
      dur: 6,
      start(e, w) {
        const dx = w.player.x - e.x;
        e.face = dx >= 0 ? 1 : -1;
        e.vy = -360;
        e.vx = Math.max(-190, Math.min(190, dx / 0.7));
        e.cs = { mode: 'air', t: 0 };
        w.sfx('roar');
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        const cs = e.cs;
        if (cs.mode === 'air') {
          cs.t += dt;
          if (cs.t > 0.15 && e.grounded) {
            cs.mode = 'stun';
            cs.t = 1.7;
            e.vx = 0;
            w.camera.shake(7, 0.5);
            w.sfx('bigBoom');
            shockwave(w, e.x + 40, L.floorY, 1, 150);
            shockwave(w, e.x - 40, L.floorY, -1, 150);
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
  },
};
