// Level 20 boss: the Rift Warlord, master of the End of Time. A towering armoured tyrant whose blade is a tear in the world
// and whose chest holds the Rift Heart, the crystal that is pulling every era into the citadel. Its armour covers the heart
// except in the moments after it has spent itself on an attack; the heart then sits at a standing soldier's gun height.
//
//   cleave   raises its blade, then drives it into the floor: a shockwave each way (jump), and a moment later a rift
//            crescent flies across at chest height (go prone or jump). The blade is wedged in the floor: the heart is open
//   blink    marks a spot behind the soldier, vanishes and reappears there; after a beat it fires a fan of rift bolts
//            (the heart is open while it recovers)
//   summon   tears the world open at both edges of the screen: two soldiers from forgotten ages step through
//   beams    (phase 2+) rift beams stab down through marked columns, one after another, from floor to sky (armoured)
//   nova     (phase 3) the heart charges, then three expanding rings of bolts, each with a gap that is aimed at the soldier
//            and moves between rings (armoured)

import { shockwave, bossShoot, geyser, warnMark } from '../boss.js';
import { spawnEnemy } from '../enemies.js';
import { groundPhysics } from '../ai.js';
import { ring, flash, smoke, spark } from '../fx.js';

const ERA_TROOPS = ['raptor', 'knight', 'ninja', 'bayonet', 'stormtrooper', 'cyborg'];
const PINK = '#ff4ad8';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'attack') {
    if (bs.atk === 'cleave') return !!e.cl && e.cl.stuck;
    if (bs.atk === 'blink') return !!e.bk && e.bk.mode === 'back';
    return bs.atk === 'summon';
  }
  return false;
}

export const warlord = {
  id: 'warlord',
  arch: 'boss',
  boss: true,
  tpl: 'warlord',
  name: 'RIFT WARLORD',
  hp: 140,
  w: 56,
  h: 112,
  score: 50000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['cleave', 'blink', 'summon'], cd: [1.2, 1.8] },
    { hp: 0.64, attacks: ['cleave', 'blink', 'summon', 'beams'], cd: [1.0, 1.5] },
    { hp: 0.32, attacks: ['cleave', 'blink', 'beams', 'nova', 'summon'], cd: [0.8, 1.2] },
  ],

  /** The Rift Heart in the lower chest: a standing soldier's level shot reaches it while the armour is open. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x - f * 4;
    const b = e.x + f * 30; // out to the front edge of the body, or a fast bullet is spent on the armour first
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 50, y1: e.y - 12 };
  },

  move(e, w, dt) {
    groundPhysics(e, w, dt);
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 120) {
      e.vx = -44;
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
    if (Math.abs(dx) > 200) e.vx = Math.sign(dx) * 36;
    else if (Math.abs(dx) < 90) e.vx = -Math.sign(dx) * 28;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    cleave: {
      tele: 1.0,
      dur: 2.8,
      teleStart(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        e.cl = { stuck: false };
      },
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        w.camera.shake(6, 0.5);
        w.sfx('bigBoom');
        shockwave(w, e.x + 34 * e.face, L.floorY, e.face, 140);
        shockwave(w, e.x - 34 * e.face, L.floorY, -e.face, 140);
        ring(w, e.x + 34 * e.face, L.floorY - 6, PINK, 30, 0.35);
        e.cl.stuck = true; // the blade is wedged in the floor: the heart is open
        // a rift crescent follows at chest height: prone under it, or jump it
        const volleys = e.bs.phase >= 2 ? 2 : 1;
        for (let i = 0; i < volleys; i++) {
          w.after(0.55 + i * 0.7, () => {
            if (!e.alive || !e.cl) return;
            const f = w.player.x >= e.x ? 1 : -1;
            w.sfx('enemyShoot');
            w.spawnEnemyBullet({ x: e.x + f * 36, y: L.floorY - 22, vx: f * 175 * w.bulletMul, vy: 0, r: 5, kind: 'crescent', col: PINK, life: 3.2 });
          });
        }
      },
      end(e) {
        e.cl = null;
      },
    },

    blink: {
      tele: 0.9,
      dur: 2.4,
      teleStart(e, w) {
        const L = w.bossArena;
        const p = w.player;
        // behind the soldier, on the far side from where the Warlord stands now
        const side = e.x >= p.x ? -1 : 1;
        let tx = p.x + side * 72;
        if (tx < L.x0 + 40 || tx > L.x1 - 40) tx = p.x - side * 72; // no room that way: the other side
        tx = Math.max(L.x0 + 40, Math.min(L.x1 - 40, tx));
        e.bk = { mode: 'gone', t: 0, tx, fired: false };
        warnMark(w, tx, L.floorY, 0.9);
        flash(w, e.x, e.y - 50, '#ffffff');
      },
      start(e, w) {
        const bk = e.bk;
        ring(w, e.x, e.y - 50, PINK, 40, 0.3);
        smoke(w, e.x, e.y - 20, 6);
        e.x = bk.tx;
        e.vx = 0;
        e.face = w.player.x >= e.x ? 1 : -1;
        ring(w, e.x, e.y - 50, '#ffffff', 40, 0.35);
        flash(w, e.x, e.y - 50, PINK);
        w.sfx('bigBoom');
        w.camera.shake(3, 0.3);
        bk.mode = 'back';
        bk.t = 0;
      },
      tick(e, w, t, dt) {
        const bk = e.bk;
        if (!bk) return;
        bk.t += dt;
        e.vx = 0;
        e.face = w.player.x >= e.x ? 1 : -1;
        if (!bk.fired && bk.t >= 0.7) {
          bk.fired = true;
          // a fan of rift bolts aimed at the soldier from the heart
          const f = e.face;
          const x = e.x + f * 18;
          const y = e.y - 34;
          const p = w.player;
          const a0 = Math.atan2(p.y - p.h * 0.5 - y, p.x - x);
          const n = e.bs.phase >= 1 ? 7 : 5;
          for (let i = 0; i < n; i++) bossShoot(w, x, y, a0 + (i - (n - 1) / 2) * 0.2, 150, { r: 3, col: PINK });
          w.sfx('enemyShoot');
        }
      },
      end(e) {
        e.bk = null;
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
        const pool = ERA_TROOPS.slice();
        [-1, 1].forEach((side) => {
          const pick = pool.splice(Math.floor(w.rand() * pool.length), 1)[0];
          const x = side < 0 ? cam.x + 24 : cam.x + 480 - 24;
          const n = spawnEnemy(w, { type: pick, x, y: L.floorY, face: -side });
          n.waiting = false; // no lurking: they arrive swinging
          n.hp = n.maxHp = Math.min(n.maxHp, 2);
          ring(w, x, L.floorY - 14, PINK, 26, 0.4);
          smoke(w, x, L.floorY - 12, 8);
        });
      },
    },

    beams: {
      tele: 1.1,
      dur: 3.0,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = e.bs.phase >= 2 ? 6 : 4;
        const dir = Math.sign(p.x - e.x) || 1;
        // the first beam falls where the soldier stands; the others march away from the Warlord, forcing a run through
        for (let i = 0; i < n; i++) {
          const x = Math.max(L.x0 + 16, Math.min(L.x1 - 16, p.x + dir * (i - 1) * 54));
          geyser(w, x, L.floorY, { delay: 0.9 + i * 0.3, height: 230, hold: 0.5, col: PINK, kind: 'beam' });
        }
        w.sfx('rumble');
        w.camera.shake(2, 0.6);
      },
    },

    nova: {
      tele: 1.2,
      dur: 3.6,
      start(e, w) {
        const f = e.face;
        const cx = e.x + f * 12;
        const cy = e.y - 38;
        w.sfx('rumble');
        for (let k = 0; k < 3; k++) {
          w.after(0.1 + k * 0.85, () => {
            if (!e.alive || !e.bs || e.bs.state === 'dying') return;
            const p = w.player;
            const a0 = Math.atan2(p.y - p.h * 0.5 - cy, p.x - cx) + [0, 0.55, -0.55][k];
            const N = 20;
            ring(w, cx, cy, PINK, 30, 0.35);
            w.sfx('bigBoom');
            for (let i = 0; i < N; i++) {
              const a = (i / N) * Math.PI * 2;
              let d = Math.abs(a - a0) % (Math.PI * 2);
              if (d > Math.PI) d = Math.PI * 2 - d;
              if (d < 0.42) continue; // the gap
              bossShoot(w, cx, cy, a, 100, { r: 3, col: PINK, life: 5 });
            }
            spark(w, cx, cy, '#ffffff', 6, 90);
          });
        }
      },
    },
  },
};
