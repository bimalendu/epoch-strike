// Level 17 boss: the Missile Silo Mech. A walking launch complex the Rift has bolted legs onto: shoulder racks full of
// missiles, a gatling arm, and a reactor core behind steel shutters in its chest. The core is above what a soldier can
// hit from the floor: climb onto one of the base's two catwalks (or jump-shoot) and fire from there when it opens.
//
//   salvo     the shoulder hatches open and a spread of missiles arcs over to marked spots (shutters closed)
//   stomp     slams a foot down: a shockwave each way (the leg sticks for a moment: the core is open)
//   gatling   the arm cannon rakes the screen with long bursts (the shutters open to vent heat)
//   silo      (phase 2+) launches a rain of missiles straight up that come down on marked spots (shutters closed)
//   meltdown  (phase 3) the reactor overloads: columns of fire erupt from the floor (the core is open, the base is not safe)

import { shockwave, geyser, dropRock, warnMark, bossShoot, angleToPlayer } from '../boss.js';
import { launchRocket, burst } from '../rocket.js';
import { groundPhysics } from '../ai.js';
import { TILE } from '../constants.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') {
    if (bs.atk === 'stomp') return !!e.sm && e.sm.stuck;
    return bs.atk === 'gatling' || bs.atk === 'meltdown';
  }
  return false;
}

export const silomech = {
  id: 'silomech',
  arch: 'boss',
  boss: true,
  tpl: 'silomech',
  name: 'MISSILE SILO MECH',
  hp: 95,
  w: 64,
  h: 112,
  score: 30000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['salvo', 'stomp', 'gatling'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['salvo', 'stomp', 'gatling', 'silo'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['salvo', 'stomp', 'gatling', 'silo', 'meltdown'], cd: [0.8, 1.2] },
  ],

  /** The reactor core in its chest: a standing soldier's shot passes under it; a soldier on a catwalk hits it square. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const a = e.x - e.face * 6;
    const b = e.x + e.face * 26;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 94, y1: e.y - 60 };
  },

  /** Ground physics, except that the mech is far too heavy for the catwalks: it always lands on the floor. */
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
    if (Math.abs(dx) > 190) e.vx = Math.sign(dx) * 36;
    else if (Math.abs(dx) < 80) e.vx = -Math.sign(dx) * 28;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    salvo: {
      tele: 1.0,
      dur: 3.0,
      teleStart(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
      },
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 3 + e.bs.phase; // 3, 4, 5 missiles
        for (let i = 0; i < n; i++) {
          const tx = Math.max(L.x0 + 24, Math.min(L.x1 - 24, p.x + (i - (n - 1) / 2) * 60));
          w.after(i * 0.3, () => {
            if (!e.alive) return;
            const fuse = 1.2;
            warnMark(w, tx, L.floorY, fuse);
            launchRocket(w, e.x - e.face * 14, e.y - 108, {
              tx,
              ty: L.floorY - 3,
              fuse,
              kind: 'rocket',
              r: 3,
              col: '#ff9a3a',
              onBurst: (ww, bx, by) => burst(ww, bx, by, 5, 50 * ww.bulletMul, '#ff9a3a'),
            });
          });
        }
      },
    },

    stomp: {
      tele: 1.0,
      dur: 2.4,
      teleStart(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.sm = { stuck: false };
      },
      start(e, w) {
        const L = w.bossArena;
        w.camera.shake(6, 0.45);
        w.sfx('bigBoom');
        shockwave(w, e.x + 40 * e.face, L.floorY, e.face, 140);
        shockwave(w, e.x - 40 * e.face, L.floorY, -e.face, 140);
        e.sm.stuck = true; // the leg is wedged in the concrete: the core is open for a breath
        if (e.bs.phase >= 1) {
          const xs = [L.x0 + 5 * TILE, L.x1 - 5 * TILE];
          for (let i = 0; i < 2; i++) dropRock(w, xs[i], { delay: 0.9 + i * 0.25, kind: 'rock' });
        }
      },
      end(e) {
        e.sm = null;
      },
    },

    gatling: {
      tele: 0.9,
      dur: 3.2,
      teleStart(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
      },
      start(e) {
        e.gn = 0;
      },
      tick(e, w, t) {
        const total = 14;
        if (e.gn < total && t >= 0.15 + e.gn * 0.17) {
          e.gn++;
          const x = e.x + e.face * 40;
          const y = e.y - 66;
          const a = angleToPlayer(w, x, y) + (((e.gn * 7) % 5) - 2) * 0.03;
          e.gaX = Math.cos(a);
          e.gaY = Math.sin(a);
          bossShoot(w, x, y, a, 175, { kind: 'bullet', r: 2, col: '#ffcc3a', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    silo: {
      tele: 1.0,
      dur: 3.4,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        w.sfx('rumble');
        w.camera.shake(2, 0.8);
        const n = 5;
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 20, Math.min(L.x1 - 20, p.x + (i - 2) * 58 + (i % 2 ? 14 : -14)));
          dropRock(w, x, { delay: 0.9 + i * 0.28, kind: 'bomb' });
        }
      },
    },

    meltdown: {
      tele: 1.1,
      dur: 3.2,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        w.sfx('rumble');
        w.camera.shake(3, 0.8);
        // flames in columns across the middle of the base: the catwalks and the gaps between columns are safe
        let k = 0;
        for (const d of [-2, -1, 1, 2]) {
          const x = Math.max(L.x0 + 90, Math.min(L.x1 - 90, p.x + d * 52));
          geyser(w, x, L.floorY, { delay: 0.9 + k * 0.14, height: 80, hold: 0.6, kind: 'flame' });
          k++;
        }
      },
    },
  },
};
