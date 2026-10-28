// Level 15 boss: the War Zeppelin. A battle airship the Rift has raised over no man's land, cruising above the trench with
// its gondola low enough to be shot from the ground: stand under it and fire UP (or jump and shoot). The gondola is the
// weak point; it stays open except while the zeppelin is busy with bombs, shells or the barrage.
//
//   guns      the gondola machine guns fire three aimed bursts of three (the gondola is open)
//   bombs     it sweeps across the arena dropping bombs in a line (a floor mark shows each landing spot)
//   gas       the top deck lobs gas shells that leave poison clouds lingering where they land
//   biplanes  (phase 2+) two biplanes launch from the hangar and strafe you, dropping bombs (the gondola is open)
//   barrage   (phase 3) a curtain of shells falls from above, one mark at a time, sweeping across the arena

import { bossShoot, warnMark, dropRock } from '../boss.js';
import { launchRocket, gasCloud } from '../rocket.js';
import { spawnEnemy } from '../enemies.js';

const HOVER = 66; // the box spans 66..136 px above the floor: the gondola is a jump-and-shoot away

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  return bs.state === 'attack' && (bs.atk === 'guns' || bs.atk === 'biplanes');
}

export const zeppelin = {
  id: 'zeppelin',
  arch: 'boss',
  boss: true,
  tpl: 'zeppelin',
  name: 'WAR ZEPPELIN',
  hp: 125,
  w: 130,
  h: 70,
  score: 26000,
  armor: 0.2,
  noBurn: true,
  flyer: true,
  phases: [
    { hp: 1.0, attacks: ['guns', 'bombs', 'gas'], cd: [1.2, 1.8] },
    { hp: 0.62, attacks: ['guns', 'bombs', 'gas', 'biplanes'], cd: [1.0, 1.5] },
    { hp: 0.3, attacks: ['guns', 'bombs', 'gas', 'biplanes', 'barrage'], cd: [0.8, 1.2] },
  ],

  /** The gondola slung under the envelope. */
  weakBox(e) {
    if (!exposed(e)) return null;
    return { x0: e.x - 28, x1: e.x + 28, y0: e.y - 32, y1: e.y - 2 };
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
    e.tgt = { x: cx + Math.sin(age * 0.7) * 150, y: L.floorY - HOVER + Math.sin(age * 1.7) * 4 };
    e.fs = 2.2;
  },

  /** A flyer: no gravity. It eases toward e.tgt, except during a bomb run, which drives x directly. */
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
    guns: {
      tele: 0.9,
      dur: 3.4,
      start(e) {
        e.gn = 0;
      },
      tick(e, w, t) {
        const total = 9;
        if (e.gn < total && t >= 0.1 + Math.floor(e.gn / 3) * 0.95 + (e.gn % 3) * 0.14) {
          e.gn++;
          const x = e.x;
          const y = e.y - 12;
          const p = w.player;
          const a = Math.atan2(p.y - p.h * 0.5 - y, p.x - x) + ((e.gn % 3) - 1) * 0.05;
          bossShoot(w, x, y, a, 180, { kind: 'bullet', r: 2, col: '#ffcc3a', life: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    bombs: {
      tele: 1.0,
      dur: 4.6,
      teleStart(e, w) {
        const L = w.bossArena;
        // line up at the far end of the arena from the soldier, then sweep across to the other
        const right = w.player.x < (L.x0 + L.x1) / 2;
        e.sw = { dir: right ? -1 : 1, vx: 0 };
        e.tgt = { x: right ? L.x1 - 60 : L.x0 + 60, y: L.floorY - HOVER };
        e.fs = 3.2;
      },
      start(e) {
        e.sw.vx = e.sw.dir * 95;
        e.bn = 0;
      },
      tick(e, w, t) {
        const L = w.bossArena;
        if (e.x < L.x0 + 30 || e.x > L.x1 - 30) e.sw.vx = 0; // the run is over at the arena's end
        if (e.sw.vx && t >= 0.2 + e.bn * 0.42) {
          e.bn++;
          warnMark(w, e.x, L.floorY, 0.6);
          w.spawnEnemyBullet({ x: e.x, y: e.y - 4, vx: 0, vy: 30, g: 260, r: 3, kind: 'bomb', life: 3 });
          w.sfx('enemyShoot');
        }
      },
      end(e) {
        e.sw = null;
      },
    },

    gas: {
      tele: 1.0,
      dur: 3.2,
      start(e, w) {
        const L = w.bossArena;
        const p = w.player;
        const n = 2 + e.bs.phase; // 2, 3, 4 shells
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 62;
          const tx = Math.max(L.x0 + 22, Math.min(L.x1 - 22, p.x + off));
          w.after(i * 0.35, () => {
            const fuse = 1.15;
            warnMark(w, tx, L.floorY, fuse);
            launchRocket(w, e.x, e.y - 90, { tx, ty: L.floorY - 3, fuse, kind: 'shell', r: 3, col: '#a8c858', onBurst: (ww, bx) => gasCloud(ww, bx, L.floorY, 3.2) });
          });
        }
        w.sfx('rumble');
      },
    },

    biplanes: {
      tele: 0.9,
      dur: 1.8,
      when: (e, w) => w.crowd() <= w.enemyCap - 2,
      start(e, w) {
        const cam = w.camera;
        const L = w.bossArena;
        w.sfx('roar');
        for (let i = 0; i < 2; i++) {
          const b = spawnEnemy(w, { type: 'biplane', x: cam.x + 480 + 24 + i * 70, y: L.floorY - 96 - i * 26, face: -1 });
          b.hp = b.maxHp = 2;
        }
      },
    },

    barrage: {
      tele: 1.0,
      dur: 3.6,
      start(e, w) {
        const L = w.bossArena;
        const dir = w.player.x < (L.x0 + L.x1) / 2 ? 1 : -1;
        for (let i = 0; i < 7; i++) {
          const x = dir > 0 ? L.x0 + 30 + i * 58 : L.x1 - 30 - i * 58;
          dropRock(w, x, { delay: 0.9 + i * 0.24, kind: 'shell' });
        }
        w.camera.shake(2, 0.8);
        w.sfx('rumble');
      },
    },
  },
};
