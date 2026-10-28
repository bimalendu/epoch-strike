// Level 7 boss: the Chariot Champion. The Rift's gladiator, riding a war chariot. Only the driver is vulnerable, and
// he stands above the horses: shoot from the two stone ledges (the chariot cannot reach you there) or from the air.
// Shots into the horses and the car only chip.
//
//   charge    horses rear, then the chariot thunders across to the far wall (phase 2+: out and back); jump it or
//             stand on a ledge. Crashing into the wall dazes the driver: that is the moment to shoot
//   javelins  stops and hurls javelins in arcs onto where you stand
//   oil       flings pots of burning oil: fire bursts from the floor under and around you (it reaches the ledges)
//   summon    (phase 2+) a horn blast calls gladiators in from both sides of the arena

import { geyser, bossShoot, warnMark } from '../boss.js';
import { ballisticAngle } from '../ai.js';
import { spawnEnemy } from '../enemies.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack' && (bs.atk === 'javelins' || bs.atk === 'oil' || bs.atk === 'summon')) return true;
  if (bs.state === 'attack' && bs.atk === 'charge' && e.cs && e.cs.mode === 'stun') return true;
  return false;
}

export const champion = {
  id: 'champion',
  arch: 'boss',
  boss: true,
  tpl: 'champion',
  name: 'CHARIOT CHAMPION',
  hp: 70,
  w: 64,
  h: 72, // tall enough for shots to reach the driver standing above the car ...
  contactH: 30, // ... but only the horses and car hurt on touch, so a soldier on a ledge is safe
  score: 13000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['charge', 'javelins', 'oil'], cd: [1.2, 1.8] },
    { hp: 0.66, attacks: ['charge', 'javelins', 'oil', 'summon'], cd: [1.0, 1.5] },
    { hp: 0.33, attacks: ['charge', 'javelins', 'oil', 'summon'], cd: [0.8, 1.2] },
  ],

  /** The driver's head and chest, in world pixels. They sit above the car and behind the horses. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x - 26 * f;
    const b = e.x - 4 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 68, y1: e.y - 32 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 120) {
      e.vx = -90;
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
    if (Math.abs(dx) > 200) e.vx = Math.sign(dx) * 44;
    else if (Math.abs(dx) < 110) e.vx = -Math.sign(dx) * 40;
    else e.vx = 0;
    if (e.x < L.x0 + 60 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 60 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    charge: {
      tele: 0.95,
      dur: 14,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        const speed = e.bs.phase >= 2 ? 265 : 225;
        e.cs = { mode: 'run', legs: e.bs.phase >= 1 ? 2 : 1, speed, t: 0 };
        e.vx = e.face * speed;
        w.sfx('stomp');
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        const cs = e.cs;
        if (cs.mode === 'run') {
          cs.t += dt;
          e.vx = e.face * cs.speed;
          const wall = (e.face < 0 && e.x <= L.x0 + 40) || (e.face > 0 && e.x >= L.x1 - 40) || e.hitWall;
          if (wall || cs.t > 3.2) {
            cs.legs--;
            e.vx = 0;
            w.camera.shake(5, 0.35);
            w.sfx('bigBoom');
            if (cs.legs > 0) {
              cs.mode = 'turn';
              cs.t = 0.6; // skids round: a short, visible pause before the run back
            } else {
              cs.mode = 'stun';
              cs.t = 1.6;
            }
          }
        } else if (cs.mode === 'turn') {
          cs.t -= dt;
          e.vx = 0;
          if (cs.t <= 0) {
            e.face = -e.face;
            cs.mode = 'run';
            cs.t = 0;
            w.sfx('stomp');
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

    javelins: {
      tele: 0.8,
      dur: 2.4,
      start(e) {
        e.jv = 0;
      },
      tick(e, w, t) {
        const total = e.bs.phase >= 2 ? 4 : 3;
        if (e.jv < total && t >= 0.15 + e.jv * 0.5) {
          e.jv++;
          e.face = w.player.x >= e.x ? 1 : -1;
          const x = e.x - 8 * e.face;
          const y = e.y - 60;
          const p = w.player;
          const sp = 270 * w.bulletMul;
          const a = ballisticAngle(p.x - x, p.y - p.h * 0.5 - y, sp, 380);
          warnMark(w, p.x, w.bossArena.floorY, 0.8);
          bossShoot(w, x, y, a, 270, { kind: 'bolt', g: 380, r: 3, life: 4 });
          w.sfx('swing');
        }
      },
    },

    oil: {
      tele: 0.9,
      dur: 2.1,
      start(e, w) {
        const L = w.bossArena;
        const n = e.bs.phase >= 2 ? 5 : 3;
        const px = w.player.x;
        for (let i = 0; i < n; i++) {
          const x = px + (i - (n - 1) / 2) * 46;
          if (x > L.x0 + 14 && x < L.x1 - 14) geyser(w, x, L.floorY, { delay: 0.85 + i * 0.12, height: 96 });
        }
      },
    },

    summon: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 3,
      start(e, w) {
        const cam = w.camera;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        const L = w.bossArena;
        for (const side of ['L', 'R']) {
          const x = side === 'L' ? cam.x - 14 : cam.x + 480 + 14;
          const g = spawnEnemy(w, { type: 'gladiator', x, y: L.floorY, face: side === 'L' ? 1 : -1 });
          g.hp = g.maxHp = 2;
        }
      },
    },
  },
};
