// Level 8 boss: the Dragon Kite Fortress. A paper-and-bamboo dragon the size of a barge, a pagoda strapped to its back.
// It flies, so shoot UP: stand under its head and hold up (or fire diagonally). The glowing pearl in its brow is the
// weak point; the dragon shuts it behind a gold plate whenever it is busy with fireworks or on the way down.
//
//   breath    the dragon lowers its head and spits aimed fireballs
//   rockets   shuts the pearl, and the pagoda fires rockets that burst over your head (the floor marks show where)
//   lunge     pulls back, marks the floor, then dives onto the mark and crashes there: the head is open and low,
//             but the crash sends a shockwave along the floor each way, so jump it
//   summon    (phase 2+) calls kite soldiers in from both edges

import { bossShoot, warnMark, angleToPlayer, shockwave } from '../boss.js';
import { launchRocket } from '../rocket.js';
import { spawnEnemy } from '../enemies.js';

const HOVER = 56; // feet height above the floor while hovering (the box then spans 56..116 px above the floor)

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') {
    if (bs.atk === 'breath' || bs.atk === 'summon') return true;
    if (bs.atk === 'lunge' && e.dv && (e.dv.mode === 'crash' || e.dv.mode === 'rise')) return true;
  }
  return false;
}

export const dragonkite = {
  id: 'dragonkite',
  arch: 'boss',
  boss: true,
  tpl: 'dragonkite',
  name: 'DRAGON KITE FORTRESS',
  hp: 80,
  w: 110,
  h: 60,
  score: 15000,
  armor: 0.2,
  noBurn: true,
  flyer: true,
  phases: [
    { hp: 1.0, attacks: ['breath', 'rockets', 'lunge'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['breath', 'rockets', 'lunge', 'summon'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['breath', 'rockets', 'lunge', 'summon'], cd: [0.8, 1.2] },
  ],

  /** The head and neck, in world pixels: low enough to hit from the floor after a crash. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 22 * f;
    const b = e.x + 54 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 56, y1: e.y - 10 };
  },

  enter(e, w, dt) {
    const L = w.bossArena;
    e.face = -1;
    e.tgt = { x: L.x1 - 130, y: L.floorY - HOVER };
    e.fs = 1.8;
    return Math.abs(e.x - e.tgt.x) < 14 && Math.abs(e.y - e.tgt.y) < 8;
  },

  idle(e, w) {
    const p = w.player;
    const L = w.bossArena;
    e.face = p.x >= e.x ? 1 : -1;
    const age = e.bs.age;
    const cx = (L.x0 + L.x1) / 2;
    e.tgt = { x: cx + Math.sin(age * 0.8) * 140, y: L.floorY - HOVER + Math.sin(age * 1.9) * 5 };
    e.fs = 2.4;
  },

  /** A flyer: no gravity. It eases toward e.tgt, except while diving or crashed, which tick() drives directly. */
  move(e, w, dt) {
    const L = w.bossArena;
    const bs = e.bs;
    if (bs.state === 'dying') {
      e.vy = Math.min(320, (e.vy || 0) + 520 * dt);
      e.y = Math.min(L.floorY, e.y + e.vy * dt);
      return;
    }
    const dv = e.dv;
    if (dv && (dv.mode === 'dive' || dv.mode === 'crash')) return;
    if (!e.tgt) return;
    const k = Math.min(1, (e.fs || 2) * dt);
    e.x += (e.tgt.x - e.x) * k;
    e.y += (e.tgt.y - e.y) * k;
  },

  attacks: {
    breath: {
      tele: 0.9,
      dur: 2.6,
      teleStart(e, w) {
        const L = w.bossArena;
        e.tgt = { x: e.x, y: L.floorY - HOVER + 22 }; // the head dips to take aim
        e.fs = 3;
      },
      start(e) {
        e.nb = 0;
      },
      tick(e, w, t) {
        const total = e.bs.phase >= 2 ? 5 : 3;
        if (e.nb < total && t >= 0.1 + e.nb * 0.5) {
          e.nb++;
          e.face = w.player.x >= e.x ? 1 : -1;
          const hx = e.x + e.face * 52;
          const hy = e.y - 34;
          bossShoot(w, hx, hy, angleToPlayer(w, hx, hy), 135, { kind: 'fire', r: 3, col: '#ff8a1e', life: 3 });
          w.sfx('roar');
        }
      },
    },

    rockets: {
      tele: 1.0,
      dur: 3.2,
      teleStart(e, w) {
        const L = w.bossArena;
        e.tgt = { x: e.x, y: L.floorY - HOVER - 16 }; // lifts up, tubes rising from the pagoda
        e.fs = 3;
      },
      start(e) {
        e.nr = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        const total = 3 + e.bs.phase;
        const gap = 0.42;
        if (e.nr < total && t >= 0.05 + e.nr * gap) {
          const p = w.player;
          const k = e.nr++;
          // the first rocket goes where the soldier stands, the rest fan out to either side of that spot
          const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 62;
          const tx = Math.max(L.x0 + 24, Math.min(L.x1 - 24, p.x + off));
          const fuse = 1.05;
          warnMark(w, tx, L.floorY, fuse);
          launchRocket(w, e.x - e.face * 8, e.y - 74, { tx, ty: L.floorY - 92, fuse, n: e.bs.phase >= 2 ? 8 : 6 });
        }
      },
    },

    lunge: {
      tele: 1.0,
      dur: 7,
      teleStart(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const tx = Math.max(L.x0 + 70, Math.min(L.x1 - 70, p.x));
        e.lx = tx;
        e.dv = null;
        warnMark(w, tx, L.floorY, 1.0); // where it will land
        // wind back and up, away from the mark
        const side = e.x >= tx ? 1 : -1;
        e.tgt = { x: Math.max(L.x0 + 60, Math.min(L.x1 - 60, tx + side * 150)), y: L.floorY - HOVER - 26 };
        e.fs = 4;
      },
      start(e, w) {
        e.face = e.lx >= e.x ? 1 : -1;
        e.dv = { mode: 'dive', t: 0, sx: e.x, sy: e.y, dur: 0.55, hold: 0 };
        w.sfx('roar');
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        const dv = e.dv;
        if (!dv) return;
        if (dv.mode === 'dive') {
          dv.t += dt;
          const u = Math.min(1, dv.t / dv.dur);
          const k = u * u;
          e.x = dv.sx + (e.lx - dv.sx) * k;
          e.y = dv.sy + (L.floorY - dv.sy) * k;
          if (u >= 1) {
            dv.mode = 'crash';
            dv.hold = e.bs.phase >= 2 ? 1.1 : 1.5;
            w.camera.shake(6, 0.4);
            w.sfx('bigBoom');
            // the crash throws a shockwave along the floor each way
            shockwave(w, e.x - 30, L.floorY, -1, 140);
            shockwave(w, e.x + 30, L.floorY, 1, 140);
          }
        } else if (dv.mode === 'crash') {
          dv.hold -= dt;
          if (dv.hold <= 0) {
            dv.mode = 'rise';
            e.tgt = { x: e.x, y: L.floorY - HOVER };
            e.fs = 3;
          }
        } else if (dv.mode === 'rise') {
          if (Math.abs(e.y - (L.floorY - HOVER)) < 8) e.bs.t = 0;
        }
      },
      end(e, w) {
        const L = w.bossArena;
        e.dv = null;
        e.tgt = { x: e.x, y: L.floorY - HOVER };
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
        [[-1, 100], [1, 128]].forEach(([side, up]) => {
          const x = side < 0 ? cam.x - 16 : cam.x + 480 + 16;
          const k = spawnEnemy(w, { type: 'kitesoldier', x, y: L.floorY - up, face: -side });
          k.hp = k.maxHp = 1;
        });
      },
    },
  },
};
