// Level 6 boss: the Bronze Colossus, a siege statue the Rift has woken at the top of the tower. Its armour shrugs off
// everything except the glowing ichor seam at its heel: shoot low, at the leading ankle and greave. The seam is
// shielded only while the foot is lifted to stomp.
//
//   stomp    foot up, then down: a shockwave each way (phase 2+: rubble falls from the parapet too)
//   discus   hurls bronze discs at your chest, one at a time (phase 3: three)
//   spear    raises a spear overhead and lobs it in an arc onto where you stand, marked on the floor
//   molten   (phase 2+) bronze geysers burst from the floor around you
//   hail     (phase 3) a salvo of rubble crashes down across the arena, each stone with a floor marker

import { shockwave, geyser, dropRock, bossShoot, angleToPlayer, warnMark } from '../boss.js';
import { ballisticAngle } from '../ai.js';

function exposed(e) {
  const bs = e.bs;
  if (!bs) return false;
  if (bs.state === 'idle') return true;
  if (bs.state === 'tele' && bs.atk === 'stomp') return false;
  if (bs.state === 'attack' && (bs.atk === 'stomp' || bs.atk === 'hail')) return false;
  return bs.state === 'attack' || bs.state === 'tele';
}

export const colossus = {
  id: 'colossus',
  arch: 'boss',
  boss: true,
  tpl: 'colossus',
  name: 'BRONZE COLOSSUS',
  hp: 140,
  w: 58,
  h: 112,
  score: 14000,
  armor: 0.2,
  noBurn: true,
  phases: [
    { hp: 1.0, attacks: ['stomp', 'discus', 'spear'], cd: [1.3, 1.9] },
    { hp: 0.66, attacks: ['stomp', 'discus', 'spear', 'molten'], cd: [1.0, 1.5] },
    { hp: 0.33, attacks: ['stomp', 'discus', 'spear', 'molten', 'hail'], cd: [0.8, 1.2] },
  ],

  /** The heel seam and the greave above it, on the leading leg, in world pixels. */
  weakBox(e) {
    if (!exposed(e)) return null;
    const f = e.face;
    const a = e.x + 4 * f;
    const b = e.x + 34 * f;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: e.y - 40, y1: e.y };
  },

  enter(e, w) {
    const L = w.bossArena;
    e.face = -1;
    if (e.x > L.x1 - 110) {
      e.vx = -40;
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
    if (Math.abs(dx) > 200) e.vx = Math.sign(dx) * 26;
    else if (Math.abs(dx) < 90) e.vx = -Math.sign(dx) * 22;
    else e.vx = 0;
    if (e.x < L.x0 + 50 && e.vx < 0) e.vx = 0;
    if (e.x > L.x1 - 50 && e.vx > 0) e.vx = 0;
  },

  attacks: {
    stomp: {
      tele: 0.95,
      dur: 1.5,
      start(e, w) {
        const L = w.bossArena;
        e.face = w.player.x >= e.x ? 1 : -1;
        w.camera.shake(6, 0.45);
        w.sfx('bigBoom');
        shockwave(w, e.x + 30 * e.face, L.floorY, e.face, 135);
        shockwave(w, e.x - 30 * e.face, L.floorY, -e.face, 135);
        if (e.bs.phase >= 1) {
          const n = e.bs.phase >= 2 ? 3 : 2;
          for (let i = 0; i < n; i++) dropRock(w, L.x0 + 50 + w.rand() * (L.x1 - L.x0 - 100), { delay: 0.8 + i * 0.3, kind: 'rock' });
        }
      },
    },

    discus: {
      tele: 0.8,
      dur: 2.4,
      start(e) {
        e.ds = 0;
      },
      tick(e, w, t) {
        const total = e.bs.phase >= 2 ? 3 : 2;
        if (e.ds < total && t >= 0.15 + e.ds * 0.6) {
          e.ds++;
          e.face = w.player.x >= e.x ? 1 : -1;
          const x = e.x + 34 * e.face;
          const y = e.y - 64;
          bossShoot(w, x, y, angleToPlayer(w, x, y), 165, { kind: 'orb', col: '#e0a840', r: 4 });
          w.sfx('enemyShoot');
        }
      },
    },

    spear: {
      tele: 1.0,
      dur: 1.7,
      start(e, w) {
        e.face = w.player.x >= e.x ? 1 : -1;
        const x = e.x + 30 * e.face;
        const y = e.y - 100;
        const p = w.player;
        const v = 300 * w.bulletMul;
        const a = ballisticAngle(p.x - x, p.y - p.h * 0.5 - y, v, 420);
        warnMark(w, p.x, w.bossArena.floorY, 1.0);
        bossShoot(w, x, y, a, 300, { kind: 'bolt', g: 420, r: 4, life: 4 });
        w.sfx('swing');
      },
    },

    molten: {
      tele: 0.9,
      dur: 2.0,
      start(e, w) {
        const L = w.bossArena;
        const n = e.bs.phase >= 2 ? 5 : 3;
        const px = w.player.x;
        for (let i = 0; i < n; i++) {
          const x = px + (i - (n - 1) / 2) * 46;
          if (x > L.x0 + 14 && x < L.x1 - 14) geyser(w, x, L.floorY, { delay: 0.85 + i * 0.12, col: '#ffb02e' });
        }
      },
    },

    hail: {
      tele: 1.0,
      dur: 2.4,
      start(e, w) {
        const L = w.bossArena;
        const span = L.x1 - L.x0 - 80;
        for (let i = 0; i < 5; i++) dropRock(w, L.x0 + 40 + ((i * 0.37 + w.rand() * 0.25) % 1) * span, { delay: 0.8 + i * 0.28, kind: 'rock' });
        w.camera.shake(4, 0.6);
        w.sfx('rumble');
      },
    },
  },
};
