// Level 13 boss: the Armored Locomotive. The Rift has bolted iron plate over a runaway steam engine and uncoupled it from the
// train: it stands across the tender roof with its boiler glowing, a gatling on the cab and a smokestack that spits coal. The
// weak point is the smokebox door on its front, a hand's breadth above the roof: an ordinary standing shot reaches it
// whenever the engine is not wreathed in steam.
//
//   cannon   the cab gatling swings round and fires three bursts of three, aimed at you (the door is open)
//   steam    vents on the boiler hiss, then columns of scalding steam burst from the roof in marked places (the door is shut)
//   coal     the smokestack lobs burning coal in high arcs onto marked spots around you (the door is open)
//   outlaws  (phase 2+) the roof hatches fling open and two bandits drop in, already running
//   derail   (phase 3) the wheels throw a surge of sparks along the roof, twice: jump each one (the door is shut)

import { geyser, bossShoot, warnMark, shockwave } from '../boss.js';
import { ballisticAngle } from '../ai.js';
import { spawnEnemy } from '../enemies.js';

const HOME = 66; // engine centre, from the arena's right edge

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'cannon' || bs.atk === 'coal' || bs.atk === 'outlaws');
}

export const locomotive = {
  id: 'locomotive',
  arch: 'boss',
  boss: true,
  tpl: 'locomotive',
  name: 'ARMORED LOCOMOTIVE',
  hp: 150,
  w: 120,
  h: 104,
  score: 22000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['cannon', 'steam', 'coal'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['cannon', 'steam', 'coal', 'outlaws'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['cannon', 'steam', 'coal', 'outlaws', 'derail'], cd: [0.8, 1.2] },
  ],

  /** The smokebox door at the front of the boiler, low enough for a standing soldier. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 60, x1: e.x - 36, y0: e.y - 56, y1: e.y - 10 };
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
      tele: 0.9,
      dur: 3.6,
      start(e) {
        e.gb = 0;
      },
      tick(e, w, t) {
        const bursts = 3;
        if (e.gb < bursts * 3 && t >= 0.1 + Math.floor(e.gb / 3) * 0.95 + (e.gb % 3) * 0.16) {
          e.gb++;
          const x = e.x + 22;
          const y = e.y - 98;
          const p = w.player;
          const a = Math.atan2(p.y - p.h * 0.5 - y, p.x - x) + ((e.gb % 3) - 1) * 0.06;
          bossShoot(w, x, y, a, 185, { kind: 'bullet', r: 2, col: '#ffcc3a', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    steam: {
      tele: 1.0,
      dur: 2.6,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 3 + e.bs.phase;
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(e.x - 70, p.x + (i - (n - 1) / 2) * 54));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.16, height: 68, hold: 0.6, col: '#e8f0f8', kind: 'steam' });
        }
        w.sfx('rumble');
      },
    },

    coal: {
      tele: 0.9,
      dur: 2.8,
      start(e) {
        e.cl = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = 3 + e.bs.phase;
        if (e.cl < total && t >= 0.1 + e.cl * 0.34) {
          const k = e.cl++;
          const p = w.player;
          const x = e.x + 26;
          const y = e.y - 104;
          const off = (k % 3 - 1) * 44;
          const tx = Math.max(L.x0 + 10, Math.min(e.x - 70, p.x + off));
          const sp = 215;
          const a = ballisticAngle(tx - x, L.floorY - 8 - y, sp * w.bulletMul, 280, true);
          warnMark(w, tx, L.floorY, 0.9);
          bossShoot(w, x, y, a, sp, { kind: 'coal', g: 280, r: 3, life: 4 });
          w.sfx('shootBolt');
        }
      },
    },

    outlaws: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        for (let i = 0; i < 2; i++) {
          const b = spawnEnemy(w, { type: 'bandit', x: cam.x - 14 - i * 26, y: L.floorY, face: 1 });
          b.waiting = false; // they are already running
          b.hidden = false;
          b.noContact = false;
          b.stall = 0;
          b.hp = b.maxHp = 1;
        }
      },
    },

    derail: {
      tele: 1.0,
      dur: 3.8,
      start(e) {
        e.dr = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        if (e.dr < 2 && t >= 0.05 + e.dr * 1.1) {
          const k = e.dr++;
          warnMark(w, L.x0 + 40, L.floorY, 0.5);
          shockwave(w, e.x - 66, L.floorY, -1, k === 0 ? 115 : 150);
          w.camera.shake(3, 0.25);
          w.sfx('stomp');
        }
      },
    },
  },
};
