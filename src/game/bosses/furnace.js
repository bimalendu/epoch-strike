// Level 14 boss: the Iron Furnace Engine. A tracked smelter the size of a house, run by no one: its furnace mouth faces the
// soldier across the foundry floor. The mouth is the weak point, and it is open whenever the engine is not hiding behind
// its own pressure.
//
//   belch     the mouth swings wide and fire marches out along the floor, column after column (the mouth is open)
//   piston    heavy ingots drop from the ceiling onto marked spots (the mouth is shut)
//   slag      molten slag rains onto marked spots and leaves burning puddles that stay for a couple of seconds (shut)
//   summon    (phase 2+) the hopper tips and two workers run out, already swinging (the mouth is open)
//   overload  (phase 3) the whole floor vents steam but for one gap: the flashing marks show where it is safe (shut)

import { geyser, dropRock } from '../boss.js';
import { spawnEnemy } from '../enemies.js';

const HOME = 62; // engine centre, from the arena's right edge

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'belch' || bs.atk === 'summon');
}

function puddle(w, x, floorY) {
  for (const dx of [-8, 0, 8]) {
    w.spawnEnemyBullet({ x: x + dx, y: floorY - 5, vx: 0, vy: 0, r: 5, kind: 'flame', col: '#ff8a1e', persist: true, ghost: true, life: 2.3 });
  }
}

export const furnace = {
  id: 'furnace',
  arch: 'boss',
  boss: true,
  tpl: 'furnace',
  name: 'IRON FURNACE ENGINE',
  hp: 150,
  w: 112,
  h: 118,
  score: 24000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['belch', 'piston', 'slag'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['belch', 'piston', 'slag', 'summon'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['belch', 'piston', 'slag', 'summon', 'overload'], cd: [0.8, 1.2] },
  ],

  /** The furnace mouth at the front, low enough for a standing soldier. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 56, x1: e.x - 34, y0: e.y - 52, y1: e.y - 12 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - HOME) {
      e.vx = -30;
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
    belch: {
      tele: 1.0,
      dur: 3.0,
      start(e, w) {
        const L = w.bossArena;
        const n = 5 + e.bs.phase; // 5, 6, 7 columns, marching toward the soldier
        for (let i = 0; i < n; i++) {
          const x = e.x - 68 - i * 34;
          if (x > L.x0 + 10) geyser(w, x, L.floorY, { delay: 0.6 + i * 0.2, height: 52, hold: 0.6, col: '#ff8a1e', kind: 'flame' });
        }
        w.sfx('rumble');
      },
    },

    piston: {
      tele: 0.9,
      dur: 2.8,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 3 + e.bs.phase;
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(e.x - 70, p.x + (i - (n - 1) / 2) * 52));
          dropRock(w, x, { delay: 0.9 + i * 0.22, kind: 'rock' });
        }
        w.camera.shake(2, 0.5);
      },
    },

    slag: {
      tele: 0.9,
      dur: 3.2,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 2 + e.bs.phase;
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(e.x - 70, p.x + (i - (n - 1) / 2) * 60));
          const delay = 0.9 + i * 0.3;
          dropRock(w, x, { delay, kind: 'slag' });
          w.after(delay + 0.8, () => puddle(w, x, L.floorY)); // where the slag lands it burns for a while
        }
        w.sfx('rumble');
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
        for (let i = 0; i < 2; i++) {
          const k = spawnEnemy(w, { type: 'worker', x: cam.x - 14 - i * 26, y: L.floorY, face: 1 });
          k.hp = k.maxHp = 1;
        }
      },
    },

    overload: {
      tele: 1.0,
      dur: 3.0,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const lo = L.x0 + 16;
        const hi = e.x - 70;
        // the safe gap lies within an easy run of the soldier, never right on top of them
        const gap = Math.max(lo + 30, Math.min(hi - 30, p.x + (w.rand() < 0.5 ? -1 : 1) * (50 + w.rand() * 50)));
        for (let x = lo; x <= hi; x += 34) {
          if (Math.abs(x - gap) < 34) continue;
          geyser(w, x, L.floorY, { delay: 1.0, height: 68, hold: 0.7, col: '#e8f0f8', kind: 'steam' });
        }
        w.camera.shake(3, 0.8);
        w.sfx('rumble');
      },
    },
  },
};
