// Level 12 boss: the Ghost Galleon. A drowned warship the Rift has hauled back from the bottom of the sea, rammed alongside
// the last deck of the armada: green lanterns, tattered sails, a crew of spectres. The hull shrugs off shot; the weak point
// is the spirit lantern hung from the figurehead at the bow, low enough for an ordinary standing shot.
//
//   broadside  the gun ports glow, then cannonballs roar out flat along the deck, one low (jump it) and one high (go prone),
//              alternating. The lantern is open: this is the moment to shoot, between dodges
//   chain      the crow's nest lobs chain shot in arcs onto marked spots around you
//   ghostfire  (the lantern is hooded) columns of green spirit fire burst from the deck in marked places
//   spectres   (phase 2+) two ghostly pirates drop over the rail and run at you; one hit each
//   maelstrom  (phase 3) a spectral wave races along the deck while the deck burns under your feet: step out of the fire,
//              then jump the wave. The lantern is hooded

import { geyser, bossShoot, warnMark, shockwave } from '../boss.js';
import { ballisticAngle } from '../ai.js';
import { spawnEnemy } from '../enemies.js';

const HOME = 66; // galleon centre, from the arena's right edge
const LOW = 7; // height above the deck of the low port's cannonball
const HIGH = 22; // ... and of the high port's: a prone soldier is only 12 px tall

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'broadside' || bs.atk === 'chain' || bs.atk === 'spectres');
}

export const ghostgalleon = {
  id: 'ghostgalleon',
  arch: 'boss',
  boss: true,
  tpl: 'ghostgalleon',
  name: 'GHOST GALLEON',
  hp: 150,
  w: 112,
  h: 124,
  score: 20000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['broadside', 'chain', 'ghostfire'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['broadside', 'chain', 'ghostfire', 'spectres'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['broadside', 'chain', 'ghostfire', 'spectres', 'maelstrom'], cd: [0.8, 1.2] },
  ],

  /** The spirit lantern at the figurehead, low on the bow. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 56, x1: e.x - 38, y0: e.y - 44, y1: e.y - 8 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - HOME) {
      e.vx = -28;
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
    broadside: {
      tele: 1.0,
      dur: 4.4,
      start(e) {
        e.bsN = 0;
      },
      tick(e, w, t) {
        const total = 2 + e.bs.phase + 1; // 3, 4, 5 balls, alternating low and high
        if (e.bsN < total && t >= 0.1 + e.bsN * 0.85) {
          const k = e.bsN++;
          const high = k % 2 === 1;
          const L = w.bossArena;
          bossShoot(w, e.x - 64, L.floorY - (high ? HIGH : LOW), Math.PI, 175, { kind: 'cannon', r: 3, col: '#ffb02e', life: 4 });
          w.camera.shake(2, 0.15);
          w.sfx('bigBoom');
        }
      },
    },

    chain: {
      tele: 0.9,
      dur: 2.8,
      start(e) {
        e.ch = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = 3 + e.bs.phase;
        if (e.ch < total && t >= 0.1 + e.ch * 0.34) {
          const k = e.ch++;
          const p = w.player;
          const x = e.x - 6;
          const y = e.y - 116;
          const off = (k % 3 - 1) * 44;
          const tx = Math.max(L.x0 + 10, Math.min(e.x - 70, p.x + off));
          const sp = 215;
          const a = ballisticAngle(tx - x, L.floorY - 8 - y, sp * w.bulletMul, 280, true);
          warnMark(w, tx, L.floorY, 0.9);
          bossShoot(w, x, y, a, sp, { kind: 'chain', g: 280, r: 3, life: 4 });
          w.sfx('shootBolt');
        }
      },
    },

    ghostfire: {
      tele: 1.0,
      dur: 2.6,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 3 + e.bs.phase; // 3, 4, 5 columns around the soldier
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(e.x - 72, p.x + (i - (n - 1) / 2) * 54));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.16, height: 72, hold: 0.6, col: '#4af0b8', kind: 'spirit' });
        }
        w.sfx('rumble');
      },
    },

    spectres: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        w.camera.shake(2, 0.5);
        for (let i = 0; i < 2; i++) {
          const s = spawnEnemy(w, { type: 'spectre', x: cam.x - 14 - i * 26, y: L.floorY, face: 1 });
          s.hp = s.maxHp = 1;
        }
      },
    },

    maelstrom: {
      tele: 1.0,
      dur: 4.2,
      start(e) {
        e.ml = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        if (e.ml < 2 && t >= 0.05 + e.ml * 1.5) {
          e.ml++;
          // the deck burns where the soldier stands, and a wave follows along the planks
          geyser(w, w.player.x, L.floorY, { delay: 0.9, height: 72, hold: 0.55, col: '#4af0b8', kind: 'spirit' });
          warnMark(w, L.x0 + 40, L.floorY, 0.5);
          shockwave(w, e.x - 66, L.floorY, -1, 150, { kind: 'surf', r: 6 });
          w.camera.shake(3, 0.25);
          w.sfx('stomp');
        }
      },
    },
  },
};
