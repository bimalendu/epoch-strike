// Level 3 boss: the Mammoth Walker, a frost-armoured war machine. The reactor hatch under its belly opens while it
// recovers; its attacks all work with the ice.
//
//   charge  tusks glow, then a long slide into the wall; ice chunks rain down on impact and the hatch is open while it
//           is dazed
//   breath  trunk raised, a sweeping spray of ice shards
//   stomp   shockwaves along the floor and falling ice
//   howl    (phase 2+) calls two sabre-tooths; the hatch stays open while it bellows

import { shockwave, dropRock, bossShoot, angleToPlayer } from '../boss.js';
import { spawnEnemy } from '../enemies.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack' && bs.atk === 'howl') return true;
  if (bs.state === 'attack' && bs.atk === 'charge' && e.cs && e.cs.mode === 'stun') return true;
  return false;
}

export const mammoth = {
  id: 'mammoth',
  arch: 'boss',
  boss: true,
  tpl: 'mammoth',
  name: 'MAMMOTH WALKER',
  hp: 90,
  w: 80,
  h: 84,
  score: 10000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['stomp', 'breath', 'charge'], cd: [1.3, 2.0] },
    { hp: 0.66, attacks: ['stomp', 'breath', 'charge', 'howl'], cd: [1.0, 1.6] },
    { hp: 0.33, attacks: ['stomp', 'breath', 'charge', 'howl'], cd: [0.8, 1.3] },
  ],

  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 6 * f;
    const b = e.x + 34 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 40, y1: e.y - 12 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 100) {
      e.vx = -55;
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
    if (Math.abs(dx) > 180) e.vx = Math.sign(dx) * 34;
    else if (Math.abs(dx) < 90) e.vx = -Math.sign(dx) * 28;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    stomp: {
      tele: 0.9,
      dur: 1.2,
      start(e, w) {
        const L = w.bossArena;
        w.camera.shake(6, 0.45);
        w.sfx('bigBoom');
        shockwave(w, e.x + 36 * e.face, L.floorY, e.face, 140);
        shockwave(w, e.x - 36 * e.face, L.floorY, -e.face, 140);
        const n = e.bs.phase >= 1 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          dropRock(w, L.x0 + 40 + w.rand() * (L.x1 - L.x0 - 80), { delay: 0.8 + i * 0.25, kind: 'ice', col: '#bfeaff' });
        }
      },
    },

    breath: {
      tele: 0.85,
      dur: 2.0,
      start(e) {
        e.shotT = 0;
        e.sweep = 0;
      },
      tick(e, w, t, dt) {
        e.shotT -= dt;
        if (e.shotT <= 0 && t < 1.6) {
          e.shotT = 0.17;
          const mx = e.x + 46 * e.face;
          const my = e.y - 70;
          const base = angleToPlayer(w, mx, my);
          const sweep = Math.sin(t * 3.2) * 0.32;
          bossShoot(w, mx, my, base + sweep, 125, { kind: 'ice', col: '#bfeaff', r: 3 });
          w.sfx('enemyShoot');
        }
      },
    },

    charge: {
      tele: 1.0,
      dur: 9,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.cs = { mode: 'run', t: 0 };
        e.vx = e.face * (e.bs.phase >= 2 ? 205 : 175);
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        const cs = e.cs;
        if (cs.mode === 'run') {
          const wall = (e.face < 0 && e.x <= L.x0 + 44) || (e.face > 0 && e.x >= L.x1 - 44) || e.hitWall;
          if (wall) {
            cs.mode = 'stun';
            cs.t = 1.8;
            e.vx = 0;
            w.camera.shake(8, 0.6);
            w.sfx('bigBoom');
            for (let i = 0; i < 4; i++) dropRock(w, L.x0 + 50 + w.rand() * (L.x1 - L.x0 - 100), { delay: 0.8 + i * 0.25, kind: 'ice', col: '#bfeaff' });
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

    howl: {
      tele: 0.9,
      dur: 1.9,
      when: (e, w) => w.crowd() < w.enemyCap - 1,
      start(e, w) {
        const L = w.bossArena;
        w.camera.shake(3, 0.8);
        w.sfx('roar');
        for (const x of [L.x1 - 30, L.x0 + 30]) spawnEnemy(w, { type: 'sabre', x, y: L.floorY, face: x > L.cam + 240 ? -1 : 1 });
      },
    },
  },
};
