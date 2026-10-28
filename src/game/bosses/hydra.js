// Level 19 boss: the AI Core Hydra. The megacity's central mind has grown three snake-necked heads out of its server stack.
// The heads are its weapons and its guard: the eye in the stack's chest is open while the heads are busy, shut while the top
// head sweeps its beam or the storm is up, and a head that slams into the floor is stuck there for a moment, wide open.
//
//   lunge   a head rears over the marked spot and slams down: a shockwave each way; it sticks in the street (an open target)
//   spit    all three heads spit a burst of aimed plasma
//   sweep   the top head fans a sweep of laser bolts down the street (the eye is shut)
//   storm   (phase 2+) lightning forks down the street in marked columns (the eye is shut)
//   summon  (phase 3) two cyberhounds are dumped into the street

import { shockwave, geyser, warnMark, bossShoot, angleToPlayer } from '../boss.js';
import { spawnEnemy } from '../enemies.js';
import { smoke } from '../fx.js';

const NECK_BASE = { x: 30, y: -70 }; // where the necks leave the stack, in boss-local coordinates

/** Where head i sits at rest, in absolute pixels. */
export function restPos(e, i) {
  const f = e.face || -1;
  const r = [
    { x: 64, y: -92 },
    { x: 46, y: -128 },
    { x: 84, y: -60 },
  ][i];
  return { x: e.x + f * r.x, y: e.y + r.y };
}

/** Is the eye in the stack's chest open to shots right now? */
function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') return bs.atk === 'spit' || bs.atk === 'summon' || bs.atk === 'lunge';
  return false;
}

export const hydra = {
  id: 'hydra',
  arch: 'boss',
  boss: true,
  tpl: 'hydra',
  name: 'AI CORE HYDRA',
  hp: 180,
  w: 96,
  h: 100,
  score: 34000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['lunge', 'spit', 'sweep'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['lunge', 'spit', 'sweep', 'storm'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['lunge', 'spit', 'sweep', 'storm', 'summon'], cd: [0.8, 1.2] },
  ],

  /** The eye in the chest at street height, or the head that is stuck in the street. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const bs = e.bs;
    if (bs.atk === 'lunge' && e.lg && e.lg.mode === 'stuck') {
      const h = e.hd[e.lg.i];
      return { x0: h.x - 16, x1: h.x + 16, y0: h.y - 22, y1: h.y + 4 };
    }
    const a = e.x + e.face * 14;
    const b = e.x + e.face * 46;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 52, y1: e.y - 14 };
  },

  init(e) {
    e.face = -1;
    e.hd = [0, 1, 2].map((i) => ({ ...restPos(e, i) }));
    e.ht = e.hd.map((h) => ({ x: h.x, y: h.y, k: 3 }));
  },

  /** Stationary: it only turns toward the soldier. The heads ease toward their targets. */
  move(e, w, dt) {
    const L = w.bossArena;
    e.vx = 0;
    e.vy = 0;
    e.y = L.floorY;
    if (e.bs.state !== 'enter') e.face = w.player.x >= e.x ? 1 : -1;
    if (!e.hd) return;
    const idleish = e.bs.state !== 'attack' && e.bs.state !== 'tele';
    for (let i = 0; i < 3; i++) {
      const h = e.hd[i];
      if (idleish || !e.lg) {
        // ambling in place
      }
      const t = e.ht[i];
      const k = Math.min(1, (t.k || 3) * dt);
      h.x += (t.x - h.x) * k;
      h.y += (t.y - h.y) * k;
    }
    // at rest the heads weave gently
    if (e.bs.state === 'idle' || e.bs.state === 'phase') {
      for (let i = 0; i < 3; i++) {
        const r = restPos(e, i);
        e.ht[i] = { x: r.x + Math.sin(e.bs.age * 1.3 + i * 2.1) * 6, y: r.y + Math.cos(e.bs.age * 1.7 + i) * 5, k: 3 };
      }
    }
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 62) {
      e.x -= 0.8;
      return false;
    }
    return true;
  },

  attacks: {
    lunge: {
      tele: 1.0,
      dur: 2.8,
      teleStart(e, w) {
        const L = w.bossArena;
        const x = Math.max(L.x0 + 30, Math.min(L.x1 - 120, w.player.x));
        const i = 0;
        e.lg = { i, x, mode: 'rear' };
        warnMark(w, x, L.floorY, 1.0);
        // the head rears back over the mark
        e.ht[i] = { x, y: L.floorY - 124, k: 4 };
      },
      start(e, w) {
        const L = w.bossArena;
        const lg = e.lg;
        e.ht[lg.i] = { x: lg.x, y: L.floorY - 6, k: 22 };
        lg.mode = 'slam';
        lg.t = 0;
      },
      tick(e, w, t, dt) {
        const lg = e.lg;
        if (!lg) return;
        const L = w.bossArena;
        const h = e.hd[lg.i];
        lg.t += dt;
        if (lg.mode === 'slam') {
          // the head hits the street: a shockwave each way, a crush if it lands on the soldier
          const p = w.player;
          if (p.alive) {
            const hb = p.hurtBox();
            if (hb.x1 > h.x - 14 && hb.x0 < h.x + 14 && hb.y1 > h.y - 22 && hb.y0 < h.y + 6 && lg.t > 0.08) w.hurtPlayer('crushed');
          }
          if (h.y > L.floorY - 16) {
            lg.mode = 'stuck';
            lg.t = 0;
            w.camera.shake(6, 0.45);
            w.sfx('bigBoom');
            smoke(w, h.x, L.floorY - 4, 8);
            shockwave(w, h.x + 20, L.floorY, 1, 140);
            shockwave(w, h.x - 20, L.floorY, -1, 140);
          }
        } else if (lg.mode === 'stuck') {
          if (lg.t > 1.3) {
            lg.mode = 'rise';
            const r = restPos(e, lg.i);
            e.ht[lg.i] = { x: r.x, y: r.y, k: 3 };
          }
        }
      },
      end(e) {
        e.lg = null;
        for (let i = 0; i < 3; i++) e.ht[i] = { ...restPos(e, i), k: 3 };
      },
    },

    spit: {
      tele: 0.8,
      dur: 2.6,
      start(e) {
        e.sp = 0;
      },
      tick(e, w, t) {
        // three bursts of three, one head after another
        const total = 9;
        if (e.sp < total && t >= 0.1 + Math.floor(e.sp / 3) * 0.75 + (e.sp % 3) * 0.16) {
          const i = Math.floor(e.sp / 3);
          e.sp++;
          const h = e.hd[i];
          const a = angleToPlayer(w, h.x, h.y);
          bossShoot(w, h.x, h.y, a, 150, { kind: 'plasma', r: 3, col: '#ff4ad8', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    sweep: {
      tele: 1.0,
      dur: 2.8,
      teleStart(e, w) {
        const L = w.bossArena;
        // the top head rises and aims along the street
        e.ht[1] = { x: e.x + e.face * 70, y: L.floorY - 134, k: 3 };
      },
      start(e) {
        e.sw = 0;
      },
      tick(e, w, t) {
        const total = 11;
        if (e.sw < total && t >= 0.1 + e.sw * 0.14) {
          const h = e.hd[1];
          const f = e.face;
          // from steeply down at the near street to flat along the far street
          const k = e.sw / (total - 1);
          const ang = f < 0 ? Math.PI - (0.35 + k * 0.5) : 0.35 + k * 0.5;
          e.sw++;
          bossShoot(w, h.x, h.y, ang, 185, { kind: 'laser', r: 2, col: '#ff4a8a', life: 4 });
          w.sfx('shootPlasma');
        }
      },
      end(e) {
        for (let i = 0; i < 3; i++) e.ht[i] = { ...restPos(e, i), k: 3 };
      },
    },

    storm: {
      tele: 1.1,
      dur: 2.6,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = e.bs.phase >= 2 ? 5 : 4;
        const xs = [p.x, p.x - 70, p.x + 70, p.x - 140, p.x + 140];
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(L.x1 - 16, xs[i]));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.17, height: 150, hold: 0.55, col: '#ff6ad8', kind: 'lightning' });
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
          const n = spawnEnemy(w, { type: 'cyberhound', x, y: L.floorY, face: -side });
          n.hp = n.maxHp = 1;
          smoke(w, x, L.floorY - 8, 8);
        });
      },
    },
  },
};

export { NECK_BASE };
