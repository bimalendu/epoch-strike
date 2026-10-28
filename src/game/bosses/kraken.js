// Level 9 boss: the Kraken. It hauls itself over the stern of the longship, its great head high above the deck: shoot it
// from a crow's-nest ledge (or jump-shoot). The eye is the weak point; the head ducks behind the rail whenever the
// tentacles are working.
//
//   slam      marks the deck, then tentacles burst up through the planks under and around you
//   ink       rears up and lobs clouds of ink in an arc across the deck (the eye is open)
//   sweep     a tidal surge races along the deck from the Kraken: jump it (twice, three times in later phases)
//   boarders  (phase 2+) the Rift sends berserkers over the side

import { geyser, bossShoot, warnMark, shockwave } from '../boss.js';
import { ballisticAngle } from '../ai.js';
import { spawnEnemy } from '../enemies.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'ink' || bs.atk === 'boarders');
}

export const kraken = {
  id: 'kraken',
  arch: 'boss',
  boss: true,
  tpl: 'kraken',
  name: 'THE KRAKEN',
  hp: 80,
  w: 76,
  h: 96,
  score: 16000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['slam', 'ink', 'sweep'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['slam', 'ink', 'sweep', 'boarders'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['slam', 'ink', 'sweep', 'boarders'], cd: [0.8, 1.2] },
  ],

  /** The eye and the dome of the head, high above the deck. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 34, x1: e.x + 34, y0: e.y - 94, y1: e.y - 48 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 52) {
      e.vx = -26;
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
    slam: {
      tele: 1.0,
      dur: 2.6,
      start(e, w) {
        const L = w.bossArena;
        const n = 2 + e.bs.phase + 1; // 3, 4, 5
        const px = w.player.x;
        for (let i = 0; i < n; i++) {
          let x = px + (i - (n - 1) / 2) * 54;
          x = Math.max(L.x0 + 16, Math.min(L.x1 - 96, x));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.16, height: 100, hold: 0.6, col: '#8a3aa8', kind: 'tentacle' });
        }
      },
    },

    ink: {
      tele: 0.9,
      dur: 2.8,
      start(e) {
        e.ink = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = e.bs.phase >= 2 ? 6 : 4;
        if (e.ink < total && t >= 0.1 + e.ink * 0.38) {
          const k = e.ink++;
          const p = w.player;
          const x = e.x - 20;
          const y = e.y - 80;
          const off = (k % 3 - 1) * 46;
          const tx = Math.max(L.x0 + 10, Math.min(L.x1 - 90, p.x + off));
          const sp = 215;
          const a = ballisticAngle(tx - x, L.floorY - 6 - y, sp * w.bulletMul, 300);
          bossShoot(w, x, y, a, sp, { kind: 'spit', g: 300, r: 3, col: '#5a2a8a', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    sweep: {
      tele: 0.9,
      dur: 3.4,
      start(e) {
        e.sw = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = e.bs.phase >= 1 ? 3 : 2;
        const gap = e.bs.phase >= 2 ? 1.05 : 1.25;
        if (e.sw < total && t >= 0.05 + e.sw * gap) {
          e.sw++;
          warnMark(w, L.x0 + 40, L.floorY, 0.5);
          shockwave(w, e.x - 44, L.floorY, -1, e.bs.phase >= 2 ? 150 : 130, { kind: 'surf', r: 6 });
          w.camera.shake(3, 0.25);
          w.sfx('stomp');
        }
      },
    },

    boarders: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        for (let i = 0; i < 2; i++) {
          const b = spawnEnemy(w, { type: 'berserker', x: cam.x - 14 - i * 26, y: L.floorY, face: 1 });
          b.hp = b.maxHp = 2;
        }
      },
    },
  },
};
