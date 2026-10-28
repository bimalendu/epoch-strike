// Level 11 boss: the Oni Warlord, a horned demon in tiger-skin the Rift has dragged into the keep's roof garden. It stands
// taller than a soldier can shoot from the floor: the Rift gem in its chest is out of reach of level shots from the ground.
// Climb onto one of the garden's two stone ledges (or jump-shoot) and fire from there.
//
//   smash    raises its iron kanabo and brings it down: a shockwave each way (the club sticks in the floor for a moment: the
//            gem is open). Later phases drop rocks onto both ledges as well
//   leap     crouches, marks the floor, then jumps and lands on the mark with a shockwave each way; open while it recovers
//   thunder  raises both arms and calls lightning down in marked columns (they reach the ledges; the gem is covered)
//   summon   (phase 2+) roars and two ninjas drop in through smoke

import { shockwave, geyser, dropRock, warnMark } from '../boss.js';
import { spawnEnemy } from '../enemies.js';
import { groundPhysics } from '../ai.js';
import { smoke } from '../fx.js';
import { TILE } from '../constants.js';

const GRAV = 1000; // the same gravity the ground physics uses

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') {
    if (bs.atk === 'smash') return !!e.sm && e.sm.stuck;
    if (bs.atk === 'leap') return !!e.lp && e.lp.mode === 'rest';
    return bs.atk === 'summon';
  }
  return false;
}

export const oni = {
  id: 'oni',
  arch: 'boss',
  boss: true,
  tpl: 'oni',
  name: 'ONI WARLORD',
  hp: 150,
  w: 54,
  h: 104,
  score: 18000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['smash', 'leap', 'thunder'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['smash', 'leap', 'thunder', 'summon'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['smash', 'leap', 'thunder', 'summon'], cd: [0.8, 1.2] },
  ],

  /** The Rift gem in its chest: a standing soldier's shot passes beneath it, a soldier on a ledge hits it square. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + f * 4;
    const b = e.x + f * 26;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 68, y1: e.y - 36 };
  },

  /** Ground physics, except that the Oni is too heavy for the garden's wooden ledges: it always lands on the floor. */
  move(e, w, dt) {
    e.drop = 0.1;
    groundPhysics(e, w, dt);
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
    if (Math.abs(dx) > 190) e.vx = Math.sign(dx) * 38;
    else if (Math.abs(dx) < 80) e.vx = -Math.sign(dx) * 30;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    smash: {
      tele: 1.0,
      dur: 2.4,
      teleStart(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.sm = { stuck: false };
      },
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        w.camera.shake(6, 0.45);
        w.sfx('bigBoom');
        shockwave(w, e.x + 36 * e.face, L.floorY, e.face, 140);
        shockwave(w, e.x - 36 * e.face, L.floorY, -e.face, 140);
        e.sm.stuck = true; // the club is wedged in the floor: the chest is open for a breath
        if (e.bs.phase >= 1) {
          // rocks shake down onto both ledges
          const n = e.bs.phase >= 2 ? 3 : 2;
          const xs = [L.x0 + 5 * TILE, L.x1 - 5 * TILE, w.player.x];
          for (let i = 0; i < n; i++) dropRock(w, Math.max(L.x0 + 20, Math.min(L.x1 - 20, xs[i])), { delay: 0.9 + i * 0.25, kind: 'rock' });
        }
      },
      end(e) {
        e.sm = null;
      },
    },

    leap: {
      tele: 0.9,
      dur: 3.0,
      teleStart(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        e.lx = Math.max(L.x0 + 40, Math.min(L.x1 - 40, w.player.x));
        warnMark(w, e.lx, L.floorY, 0.9);
        e.lp = { mode: 'crouch', t: 0 };
      },
      start(e, w) {
        const T = 0.85;
        e.vx = (e.lx - e.x) / T;
        e.vy = -(GRAV * T) / 2;
        e.lp = { mode: 'air', t: 0 };
        w.sfx('roar');
      },
      tick(e, w, t, dt) {
        const lp = e.lp;
        if (!lp) return;
        const L = w.bossArena;
        lp.t += dt;
        if (lp.mode === 'air') {
          if (lp.t > 0.2 && e.grounded) {
            lp.mode = 'rest';
            lp.t = 0;
            e.vx = 0;
            w.camera.shake(7, 0.5);
            w.sfx('bigBoom');
            shockwave(w, e.x + 34, L.floorY, 1, 135);
            shockwave(w, e.x - 34, L.floorY, -1, 135);
          }
        } else if (lp.mode === 'rest') {
          e.vx = 0;
        }
      },
      end(e) {
        e.lp = null;
        e.vx = 0;
      },
    },

    thunder: {
      tele: 1.1,
      dur: 2.6,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = e.bs.phase >= 2 ? 5 : 3;
        const xs = [p.x, L.x0 + 5 * TILE, L.x1 - 5 * TILE, p.x - 64, p.x + 64];
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(L.x1 - 16, xs[i]));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.17, height: 150, hold: 0.55, col: '#9ad0ff', kind: 'lightning' });
        }
        w.sfx('rumble');
        w.camera.shake(2, 0.6);
      },
    },

    summon: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        [-1, 1].forEach((side) => {
          const x = side < 0 ? cam.x + 24 : cam.x + 480 - 24;
          const n = spawnEnemy(w, { type: 'ninja', x, y: L.floorY, face: -side });
          n.waiting = false; // no lurking: they arrive swinging
          n.hp = n.maxHp = 1;
          smoke(w, x, L.floorY - 12, 10);
        });
      },
    },
  },
};
