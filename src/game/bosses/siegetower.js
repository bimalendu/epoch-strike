// Level 10 boss: the Siege Tower Titan. A castle-high siege tower the Rift has woken, rolling on three great wheels, archers
// on its roof and a drawbridge on its face. Its timber shrugs off almost everything: the weak point is the Rift core in
// the ram port at the foot of the tower, which is open whenever the tower is not busy with fire.
//
//   ram        creaks, then rolls forward and bangs to a halt (the floor marks show how far); the ram port gapes while it rests
//   arrows     the roof archers loose a volley that lands around you (each arrow's landing spot is marked)
//   oil        tips a cauldron: a trail of burning oil bursts from the floor in front of the tower (the port is shut)
//   drawbridge (phase 2+) the bridge crashes down and a knight marches out
//   siege      (phase 3) catapults off screen lob flaming boulders onto marked spots around you (the port is shut)

import { geyser, bossShoot, warnMark, dropRock } from '../boss.js';
import { ballisticAngle } from '../ai.js';
import { spawnEnemy } from '../enemies.js';
import { launchRocket } from '../rocket.js';
import { VIEW_W } from '../constants.js';

const HOME = 74; // tower centre, from the arena's right edge

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') {
    if (bs.atk === 'ram') return !!e.rm && e.rm.mode !== 'roll';
    return bs.atk === 'arrows' || bs.atk === 'drawbridge';
  }
  return false;
}

export const siegetower = {
  id: 'siegetower',
  arch: 'boss',
  boss: true,
  tpl: 'siegetower',
  name: 'SIEGE TOWER TITAN',
  hp: 130,
  w: 76,
  h: 118,
  score: 17000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['ram', 'arrows', 'oil'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['ram', 'arrows', 'oil', 'drawbridge'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['ram', 'arrows', 'oil', 'drawbridge', 'siege'], cd: [0.8, 1.2] },
  ],

  /** The ram port at the foot of the tower's face: low enough to be hit by an ordinary standing shot. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + f * 12;
    const b = e.x + f * 36;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 42, y1: e.y - 6 };
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

  idle(e, w) {
    const L = w.bossArena;
    e.face = w.player.x >= e.x ? 1 : -1;
    const home = L.x1 - HOME;
    const dx = home - e.x;
    e.vx = Math.abs(dx) > 5 ? Math.sign(dx) * 48 : 0;
  },

  attacks: {
    ram: {
      tele: 1.0,
      dur: 3.5,
      teleStart(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        // the whole stretch it will cover is marked, with the last mark where the front of the tower stops
        for (let k = 1; k <= 4; k++) warnMark(w, Math.max(L.x0 + 8, Math.min(L.x1 - 8, e.x + e.face * (38 + k * 26))), L.floorY, 0.95);
      },
      start(e, w) {
        e.rm = { mode: 'roll', t: 0 };
        w.sfx('roar');
      },
      tick(e, w, t, dt) {
        const rm = e.rm;
        if (!rm) return;
        const L = w.bossArena;
        rm.t += dt;
        if (rm.mode === 'roll') {
          e.vx = e.face * 215;
          if (rm.t >= 0.5) {
            rm.mode = 'rest';
            rm.t = 0;
            e.vx = 0;
            w.camera.shake(5, 0.4);
            w.sfx('bigBoom');
            // timber shakes loose from the roof
            dropRock(w, Math.max(L.x0 + 30, Math.min(L.x1 - 30, w.player.x)), { delay: 0.8, kind: 'rock' });
          }
        } else if (rm.mode === 'rest') {
          e.vx = 0;
          if (rm.t >= 1.3) {
            rm.mode = 'back';
            rm.t = 0;
          }
        } else {
          const dx = L.x1 - HOME - e.x;
          e.vx = Math.abs(dx) > 4 ? Math.sign(dx) * 75 : 0;
        }
      },
      end(e) {
        e.rm = null;
        e.vx = 0;
      },
    },

    arrows: {
      tele: 0.9,
      dur: 2.8,
      start(e) {
        e.ar = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = 3 + e.bs.phase;
        if (e.ar < total && t >= 0.1 + e.ar * 0.34) {
          const k = e.ar++;
          const p = w.player;
          const x = e.x + e.face * 20;
          const y = e.y - 124;
          const off = (k % 3 - 1) * 42;
          const tx = Math.max(L.x0 + 10, Math.min(L.x1 - 10, p.x + off));
          const sp = 215;
          const a = ballisticAngle(tx - x, L.floorY - 8 - y, sp * w.bulletMul, 280, true);
          warnMark(w, tx, L.floorY, 0.9);
          bossShoot(w, x, y, a, sp, { kind: 'arrow', g: 280, r: 2, life: 4 });
          w.sfx('shootBolt');
        }
      },
    },

    oil: {
      tele: 1.0,
      dur: 2.4,
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        const n = e.bs.phase >= 2 ? 6 : 5;
        for (let k = 0; k < n; k++) {
          const x = e.x + e.face * (44 + k * 20);
          if (x > L.x0 + 10 && x < L.x1 - 10) geyser(w, x, L.floorY, { delay: 0.8 + k * 0.13, height: 56, hold: 0.7, col: '#ff8a1e', kind: 'flame' });
        }
        w.sfx('rumble');
      },
    },

    drawbridge: {
      tele: 0.9,
      dur: 2.2,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        w.camera.shake(4, 0.4);
        w.sfx('bigBoom');
        const k = spawnEnemy(w, { type: 'knight', x: Math.max(L.x0 + 20, Math.min(L.x1 - 20, e.x + e.face * 56)), y: L.floorY, face: e.face });
        k.hp = k.maxHp = 3;
      },
    },

    siege: {
      tele: 1.0,
      dur: 3.0,
      start(e, w) {
        const L = w.bossArena;
        const cam = w.camera;
        const p = w.player;
        for (let i = 0; i < 3; i++) {
          const tx = Math.max(L.x0 + 22, Math.min(L.x1 - 22, p.x + (i - 1) * 70 + (i === 1 ? 0 : 0)));
          w.after(i * 0.35, () => {
            const c = w.camera;
            warnMark(w, tx, L.floorY, 1.3);
            launchRocket(w, c.x + VIEW_W + 34, L.floorY - 64, { tx, ty: L.floorY - 3, fuse: 1.3, n: 6, burstSpeed: 58, col: '#ff8a1e', kind: 'boulder', r: 4 });
          });
        }
        void cam;
        w.sfx('rumble');
      },
    },
  },
};
