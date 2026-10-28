// Level 2 boss: the Magma Golem. A walking furnace: its chest door only opens while it is venting or resting.
//
//   slam  fists up (tele), then a shockwave each way and fire geysers erupting around the player
//   lob   spits arcing fireballs aimed with a ballistic lead
//   rain  molten rocks fall at the player's feet, each with a floor warning
//   vent  (phase 2+) chest door wide open and jets of flame on both flanks: shoot from a distance

import { shockwave, geyser, dropRock, bossShoot } from '../boss.js';
import { ballisticAngle } from '../ai.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  return bs.state === 'idle' || (bs.state === 'attack' && bs.atk === 'vent');
}

export const golem = {
  id: 'golem',
  arch: 'boss',
  boss: true,
  tpl: 'golem',
  name: 'MAGMA GOLEM',
  hp: 165,
  w: 58,
  h: 80,
  score: 9000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['slam', 'lob', 'rain'], cd: [1.3, 1.9] },
    { hp: 0.66, attacks: ['slam', 'lob', 'rain', 'vent'], cd: [1.0, 1.5] },
    { hp: 0.33, attacks: ['slam', 'lob', 'rain', 'vent'], cd: [0.8, 1.2] },
  ],

  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 8 * f;
    const b = e.x + 30 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 42, y1: e.y - 14 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 100) {
      e.vx = -50;
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
    if (Math.abs(dx) > 190) e.vx = Math.sign(dx) * 32;
    else if (Math.abs(dx) < 80) e.vx = -Math.sign(dx) * 26;
    else e.vx = 0;
    if (e.x < L.x0 + 45 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 45 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    slam: {
      tele: 0.95,
      dur: 1.5,
      start(e, w) {
        const L = w.bossArena;
        w.camera.shake(6, 0.45);
        w.sfx('bigBoom');
        shockwave(w, e.x + 28 * e.face, L.floorY, e.face, 130);
        shockwave(w, e.x - 28 * e.face, L.floorY, -e.face, 130);
        const n = e.bs.phase >= 2 ? 5 : e.bs.phase >= 1 ? 3 : 2;
        const px = w.player.x;
        for (let i = 0; i < n; i++) {
          const x = px + (i - (n - 1) / 2) * 46;
          if (x > L.x0 + 14 && x < L.x1 - 14) geyser(w, x, L.floorY, { delay: 0.85 + i * 0.12 });
        }
      },
    },

    lob: {
      tele: 0.75,
      dur: 1.5,
      start(e) {
        e.shotsLeft = e.bs.phase >= 1 ? 4 : 3;
        e.shotT = 0;
      },
      tick(e, w, t, dt) {
        e.shotT -= dt;
        if (e.shotsLeft > 0 && e.shotT <= 0) {
          e.shotT = 0.34;
          e.shotsLeft--;
          const mx = e.x + 30 * e.face;
          const my = e.y - 62;
          const p = w.player;
          const v = 190 * w.bulletMul;
          const a = ballisticAngle(p.x - mx, p.y - p.h * 0.5 - my, v, 250);
          bossShoot(w, mx, my, a, 190, { kind: 'fire', col: '#ff8a1e', r: 3, g: 250 });
          w.sfx('enemyShoot');
        }
      },
    },

    rain: {
      tele: 0.85,
      dur: 3.0,
      start(e) {
        e.rainT = 0;
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        e.rainT -= dt;
        if (e.rainT <= 0 && t < 2.2) {
          e.rainT = e.bs.phase >= 2 ? 0.32 : 0.48;
          const x = Math.max(L.x0 + 16, Math.min(L.x1 - 16, w.player.x + (w.rand() - 0.5) * 150));
          dropRock(w, x, { delay: 0.9, kind: 'rock' });
        }
      },
    },

    vent: {
      tele: 0.9,
      dur: 2.6,
      start(e, w) {
        w.sfx('roar');
        e.ventT = 0;
      },
      tick(e, w, t, dt) {
        const L = w.bossArena;
        e.ventT -= dt;
        if (e.ventT <= 0 && t < 1.9) {
          e.ventT = 0.55;
          for (const s of [-1, 1]) {
            const x = e.x + s * (34 + w.rand() * 34);
            if (x > L.x0 + 10 && x < L.x1 - 10) geyser(w, x, L.floorY, { delay: 0.6, height: 70 });
          }
        }
      },
    },
  },
};
