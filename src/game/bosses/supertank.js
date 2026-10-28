// Level 16 boss: the Super-Heavy Tank. A land battleship the Rift has parked on the beach head: a hull as long as a
// longship, a turret like a tower, twin sponson cannons low on the glacis plate and a machine gun on the roof. The weak
// point is the driver's port on the front plate, a hand's breadth off the sand: an ordinary standing shot reaches it
// whenever the visor is up, which is when the tank is idle, hosing you with the roof gun, or unloading troops.
//
//   cannon    the twin sponsons fire one after the other, a LOW shell to jump and a HIGH shell to go prone under (visor shut)
//   mg        the roof gun fires three bursts of four, aimed at you (the visor is up)
//   mortar    the turret lobs shells onto marked spots round you; each bursts into falling sparks (visor shut)
//   crush     (phase 2+) the engine screams, the tank lurches forward and its treads throw a shockwave: jump it (visor shut)
//   troops    (phase 2+) the rear hatch drops two stormtroopers who run in from the left (the visor is up)
//   flame     (phase 3) the hull flamethrowers sweep a row of fire columns across the sand, with gaps to stand in (visor shut)

import { geyser, bossShoot, warnMark, shockwave } from '../boss.js';
import { launchRocket } from '../rocket.js';
import { spawnEnemy } from '../enemies.js';

const HOME = 78; // tank centre, from the arena's right edge

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'mg' || bs.atk === 'troops');
}

export const supertank = {
  id: 'supertank',
  arch: 'boss',
  boss: true,
  tpl: 'supertank',
  name: 'SUPER-HEAVY TANK',
  hp: 150,
  w: 128,
  h: 84,
  score: 28000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['cannon', 'mg', 'mortar'], cd: [1.2, 1.8] },
    { hp: 0.64, attacks: ['cannon', 'mg', 'mortar', 'crush', 'troops'], cd: [1.0, 1.5] },
    { hp: 0.32, attacks: ['cannon', 'mg', 'mortar', 'crush', 'troops', 'flame'], cd: [0.8, 1.2] },
  ],

  /** The driver's port on the front plate, low enough for a standing soldier. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 64, x1: e.x - 38, y0: e.y - 46, y1: e.y - 16 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - HOME) {
      e.vx = -34;
      return false;
    }
    e.vx = 0;
    return true;
  },

  idle(e) {
    e.vx = 0;
    e.face = -1;
  },

  attacks: {
    cannon: {
      tele: 1.0,
      dur: 3.2,
      start(e) {
        e.cn = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const n = e.bs.phase >= 2 ? 3 : 2;
        // low, high, (low): 0.95 s apart, so each can be answered before the next arrives
        if (e.cn < n && t >= 0.1 + e.cn * 0.95) {
          const high = e.cn % 2 === 1;
          bossShoot(w, e.x - 72, L.floorY - (high ? 22 : 9), Math.PI, 175, { kind: 'shell', r: 4, col: '#ffb02e', life: 4 });
          w.sfx('enemyShoot');
          w.camera.shake(1.5, 0.15);
          e.cn++;
        }
      },
    },

    mg: {
      tele: 0.8,
      dur: 3.6,
      start(e) {
        e.gb = 0;
      },
      tick(e, w, t) {
        const bursts = 3;
        if (e.gb < bursts * 4 && t >= 0.1 + Math.floor(e.gb / 4) * 1.0 + (e.gb % 4) * 0.14) {
          e.gb++;
          const x = e.x - 30;
          const y = e.y - 76;
          const p = w.player;
          const a = Math.atan2(p.y - p.h * 0.5 - y, p.x - x) + ((e.gb % 4) - 1.5) * 0.04;
          bossShoot(w, x, y, a, 190, { kind: 'bullet', r: 2, col: '#ffcc3a', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    mortar: {
      tele: 1.0,
      dur: 3.0,
      start(e) {
        e.mt = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = 3 + e.bs.phase;
        if (e.mt < total && t >= 0.1 + e.mt * 0.4) {
          const k = e.mt++;
          const p = w.player;
          const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 58; // the first at the soldier, the rest either side
          const tx = Math.max(L.x0 + 14, Math.min(e.x - 76, p.x + off));
          const fuse = 1.2;
          warnMark(w, tx, L.floorY, fuse);
          launchRocket(w, e.x + 4, e.y - 86, { tx, ty: L.floorY - 3, fuse, n: 7, burstSpeed: 60, col: '#ffb02e', kind: 'shell', r: 3 });
        }
      },
    },

    crush: {
      tele: 1.1,
      dur: 3.0,
      when: (e) => e.bs.phase >= 1,
      start(e) {
        e.cr = 0;
        e.vx = -95;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        if (e.cr === 0 && t >= 0.55) {
          e.cr = 1;
          e.vx = 0;
          shockwave(w, e.x - 70, L.floorY, -1, 135);
          w.camera.shake(4, 0.3);
          w.sfx('stomp');
        } else if (e.cr === 1 && t >= 1.0) {
          e.cr = 2;
          e.vx = 50; // the treads drag it back to its post
        } else if (e.cr === 2 && e.x >= L.x1 - HOME) {
          e.cr = 3;
          e.vx = 0;
        }
      },
      end(e, w) {
        e.vx = 0;
        const L = w.bossArena;
        if (e.x < L.x1 - HOME) e.x = Math.min(L.x1 - HOME, e.x + 4);
      },
    },

    troops: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => e.bs.phase >= 1 && w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        for (let i = 0; i < 2; i++) {
          const s = spawnEnemy(w, { type: 'stormtrooper', x: cam.x - 14 - i * 26, y: L.floorY, face: 1 });
          s.hp = s.maxHp = 1;
        }
      },
    },

    flame: {
      tele: 1.0,
      dur: 2.8,
      when: (e) => e.bs.phase >= 2,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        // a row of columns across the sand, 34 px apart, with the gap nearest the soldier left open to stand in
        const gapAt = Math.round((e.x - 90 - p.x) / 34);
        for (let i = 0; i < 7; i++) {
          if (i === gapAt) continue;
          const x = e.x - 90 - i * 34;
          if (x < L.x0 + 10) continue;
          geyser(w, x, L.floorY, { delay: 0.8 + i * 0.12, height: 80, hold: 0.55 });
        }
        w.sfx('rumble');
      },
    },
  },
};
