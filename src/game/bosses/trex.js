// Level 1 boss: REX-7, a T-Rex wrapped in Rift armour. The glowing belly core is the weak point and is only open
// while the beast is recovering (between attacks, after a wall-crash, while it roars for help).
//
//   stomp   foot raised (tele), slams down: shockwaves race along the floor both ways. Jump them.
//   spit    head rears back, then a fan of Rift plasma. Keep moving.
//   charge  head down, eyes flash red, then a full-speed run at the player. It crashes into the wall, rocks
//           rain down and the core is exposed while it is stunned.
//   roar    (phase 2+) calls two Rift drones; the core stays open while it roars.

import { shockwave, bossShoot, angleToPlayer, dropRock } from '../boss.js';
import { spawnEnemy } from '../enemies.js';
import { TILE } from '../constants.js';

function arena(w) {
  return w.bossArena;
}

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack' && bs.atk === 'roar') return true;
  if (bs.state === 'attack' && bs.atk === 'charge' && e.cs && e.cs.mode === 'stun') return true;
  return false;
}

export const trex = {
  id: 'trex',
  arch: 'boss',
  boss: true,
  tpl: 'trex',
  name: 'REX-7',
  hp: 80,
  w: 60,
  h: 66,
  score: 8000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['stomp', 'spit', 'charge'], cd: [1.3, 2.0] },
    { hp: 0.66, attacks: ['stomp', 'spit', 'charge', 'roar'], cd: [1.0, 1.6] },
    { hp: 0.33, attacks: ['stomp', 'spit', 'charge', 'roar'], cd: [0.8, 1.3] },
  ],

  /** The belly core, in world pixels, while it is open. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 8 * f;
    const b = e.x + 30 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 38, y1: e.y - 12 };
  },

  enter(e, w, dt) {
    const L = arena(w);
    const home = L.x1 - 90;
    e.face = -1;
    if (e.x > home) {
      e.vx = -70;
      return false;
    }
    e.vx = 0;
    return true;
  },

  idle(e, w, dt) {
    const p = w.player;
    const L = arena(w);
    e.face = p.x >= e.x ? 1 : -1;
    const dx = p.x - e.x;
    // keep a respectful distance: close in when far away, back off when the player is right under its nose
    if (Math.abs(dx) > 170) e.vx = Math.sign(dx) * 38;
    else if (Math.abs(dx) < 70) e.vx = -Math.sign(dx) * 30;
    else e.vx = 0;
    if (e.x < L.x0 + 40 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 40 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    stomp: {
      tele: 0.85,
      dur: 0.9,
      start(e, w) {
        const L = arena(w);
        w.camera.shake(5, 0.4);
        w.sfx('bigBoom');
        shockwave(w, e.x + 24 * e.face, L.floorY, e.face, 150);
        shockwave(w, e.x - 24 * e.face, L.floorY, -e.face, 150);
        if (e.bs.phase >= 1) {
          w.after(0.55, () => {
            if (!e.alive) return;
            w.sfx('bigBoom');
            w.camera.shake(4, 0.3);
            shockwave(w, e.x + 24 * e.face, L.floorY, e.face, 170);
            shockwave(w, e.x - 24 * e.face, L.floorY, -e.face, 170);
          });
        }
      },
    },

    spit: {
      tele: 0.75,
      dur: 1.1,
      start(e, w) {
        e.shotsLeft = e.bs.phase >= 1 ? 3 : 2;
        e.shotT = 0;
      },
      tick(e, w, t, dt) {
        e.shotT -= dt;
        if (e.shotsLeft > 0 && e.shotT <= 0) {
          e.shotT = 0.36;
          e.shotsLeft--;
          const mx = e.x + 44 * e.face;
          const my = e.y - 56;
          const a = angleToPlayer(w, mx, my);
          const n = e.bs.phase >= 2 ? 5 : 3;
          for (let i = 0; i < n; i++) bossShoot(w, mx, my, a + (i - (n - 1) / 2) * 0.22, 115, { r: 3 });
          w.sfx('enemyShoot');
        }
      },
    },

    charge: {
      tele: 0.95,
      dur: 8,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.cs = { mode: 'run', t: 0 };
        e.vx = e.face * (e.bs.phase >= 2 ? 215 : 185);
      },
      tick(e, w, t, dt) {
        const L = arena(w);
        const cs = e.cs;
        if (cs.mode === 'run') {
          const wall = (e.face < 0 && e.x <= L.x0 + 34) || (e.face > 0 && e.x >= L.x1 - 34) || e.hitWall;
          if (wall) {
            cs.mode = 'stun';
            cs.t = 1.7;
            e.vx = 0;
            w.camera.shake(7, 0.5);
            w.sfx('bigBoom');
            // the impact shakes rocks loose
            for (let i = 0; i < 3; i++) dropRock(w, L.x0 + 60 + w.rand() * (L.x1 - L.x0 - 120), { delay: 0.8 + i * 0.3 });
          }
        } else {
          cs.t -= dt;
          e.vx = 0;
          if (cs.t <= 0) e.bs.t = 0; // attack over
        }
      },
      end(e, w) {
        e.vx = 0;
        e.cs = null;
      },
    },

    roar: {
      tele: 0.8,
      dur: 1.7,
      when: (e, w) => w.crowd() < w.enemyCap - 1,
      start(e, w) {
        const L = arena(w);
        w.camera.shake(3, 0.8);
        w.sfx('bigBoom');
        for (const x of [L.x0 + 90, L.x1 - 110]) {
          spawnEnemy(w, { type: 'drone', x, y: 7 * TILE, face: -1 });
        }
      },
    },
  },
};
