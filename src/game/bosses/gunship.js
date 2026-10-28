// Level 18 boss: the Gunship Helicopter. A Rift-modified attack helicopter that hangs over the neon avenue with its chin
// turret low enough to be shot from the ground: stand under it and fire UP (or jump and shoot). The chin turret is the
// weak point; it is open except while the rocket pods or the carpet run have the gunship's attention.
//
//   strafe    sweeps across the arena raking the street with its chain gun (a line of tracer fire straight down)
//   rockets   (pods out, turret closed) a fan of rockets streaks down to marked spots on the street
//   hunters   launches two hunter drones from its tail
//   carpet    (phase 3) a curtain of bombs falls from above, one mark at a time, sweeping across the arena

import { bossShoot, warnMark, dropRock } from '../boss.js';
import { launchRocket, burst } from '../rocket.js';
import { spawnEnemy } from '../enemies.js';

const HOVER = 62; // the box spans 62..106 px above the floor: the chin turret is a jump-and-shoot away

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'strafe' || bs.atk === 'hunters');
}

export const gunship = {
  id: 'gunship',
  arch: 'boss',
  boss: true,
  tpl: 'gunship',
  name: 'GUNSHIP HELICOPTER',
  hp: 130,
  w: 100,
  h: 44,
  score: 32000,
  armor: 0.2,
  noBurn: true,
  flyer: true,
  phases: [
    { hp: 1.0, attacks: ['strafe', 'rockets', 'hunters'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['strafe', 'rockets', 'hunters'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['strafe', 'rockets', 'hunters', 'carpet'], cd: [0.8, 1.2] },
  ],

  /** The chin turret slung under the nose. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const a = e.x - e.face * 4;
    const b = e.x + e.face * 32;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 30, y1: e.y - 2 };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    e.tgt = { x: L.x1 - 150, y: L.floorY - HOVER };
    e.fs = 1.6;
    return Math.abs(e.x - e.tgt.x) < 14 && Math.abs(e.y - e.tgt.y) < 8;
  },

  idle(e, w) {
    const L = w.bossArena;
    const age = e.bs.age;
    e.face = w.player.x >= e.x ? 1 : -1;
    const cx = (L.x0 + L.x1) / 2;
    e.tgt = { x: cx + Math.sin(age * 0.8) * 150, y: L.floorY - HOVER + Math.sin(age * 1.9) * 5 };
    e.fs = 2.4;
  },

  /** A flyer: no gravity. It eases toward e.tgt, except during a strafing run, which drives x directly. */
  move(e, w, dt) {
    const L = w.bossArena;
    const bs = e.bs;
    if (bs.state === 'dying') {
      e.vy = Math.min(320, (e.vy || 0) + 520 * dt);
      e.y = Math.min(L.floorY, e.y + e.vy * dt);
      return;
    }
    if (e.sw && e.sw.vx) {
      e.x += e.sw.vx * dt;
      e.y += (L.floorY - HOVER - e.y) * Math.min(1, 3 * dt);
      return;
    }
    if (!e.tgt) return;
    const k = Math.min(1, (e.fs || 2) * dt);
    e.x += (e.tgt.x - e.x) * k;
    e.y += (e.tgt.y - e.y) * k;
  },

  attacks: {
    strafe: {
      tele: 1.0,
      dur: 4.4,
      teleStart(e, w) {
        const L = w.bossArena;
        // line up at the far end of the arena from the soldier, then sweep across to the other
        const right = w.player.x < (L.x0 + L.x1) / 2;
        e.sw = { dir: right ? -1 : 1, vx: 0 };
        e.tgt = { x: right ? L.x1 - 60 : L.x0 + 60, y: L.floorY - HOVER };
        e.fs = 3.2;
      },
      start(e) {
        e.sw.vx = e.sw.dir * 88;
        e.bn = 0;
        e.face = e.sw.dir;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        if (e.x < L.x0 + 30 || e.x > L.x1 - 30) e.sw.vx = 0; // the run is over at the arena's end
        if (e.sw.vx && t >= 0.15 + e.bn * 0.2) {
          e.bn++;
          const a = Math.PI / 2 + e.sw.dir * 0.1;
          bossShoot(w, e.x + e.face * 22, e.y - 4, a, 190, { kind: 'bullet', r: 2, col: '#ffcc3a', life: 3 });
          w.sfx('enemyShoot');
        }
      },
      end(e) {
        e.sw = null;
      },
    },

    rockets: {
      tele: 1.0,
      dur: 3.2,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 3 + e.bs.phase;
        for (let i = 0; i < n; i++) {
          const tx = Math.max(L.x0 + 22, Math.min(L.x1 - 22, p.x + (i - (n - 1) / 2) * 56));
          w.after(i * 0.28, () => {
            if (!e.alive) return;
            const fuse = 1.1;
            warnMark(w, tx, L.floorY, fuse);
            launchRocket(w, e.x, e.y - 10, {
              tx,
              ty: L.floorY - 3,
              fuse,
              kind: 'rocket',
              r: 3,
              col: '#ff4ad8',
              onBurst: (ww, bx, by) => burst(ww, bx, by, 5, 50 * ww.bulletMul, '#ff4ad8'),
            });
          });
        }
        w.sfx('rumble');
      },
    },

    hunters: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        for (let i = 0; i < 2; i++) {
          const b = spawnEnemy(w, { type: 'hunter', x: cam.x + 480 + 24 + i * 60, y: L.floorY - 100 - i * 26, face: -1 });
          b.hp = b.maxHp = 1;
        }
      },
    },

    carpet: {
      tele: 1.0,
      dur: 3.6,
      start(e, w) {
        const L = w.bossArena;
        const dir = w.player.x < (L.x0 + L.x1) / 2 ? 1 : -1;
        for (let i = 0; i < 7; i++) {
          const x = dir > 0 ? L.x0 + 30 + i * 58 : L.x1 - 30 - i * 58;
          dropRock(w, x, { delay: 0.9 + i * 0.24, kind: 'bomb' });
        }
        w.camera.shake(2, 0.8);
        w.sfx('rumble');
      },
    },
  },
};
