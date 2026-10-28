// Art-only helpers for boss painters: readable weak points, damage marks, idle life and the death collapse.
// They read the pose (`bossPose`) and the boss's own timers and never write to the world.

import { shade } from './common.js';
import { flick } from './flash.js';
import { DEATH_TIME } from '../boss.js';

const HOUSING = '#23222e';

/**
 * A weak point at the rect `weakBox` uses (boss-local, so the hitbox is unchanged). Open: the boss's own colour `col`
 * pulses (a blink that honours reduced flashes) and a ring expands while `hit > 0`. Closed: dark housing with shutter slats.
 * `col` is kept as the base colour on purpose: `BOSS_MIX` leaves bosses mostly unwashed so weak points read by colour.
 */
export function weakPoint(B, lx, ly, w, h, { open, col, age = 0, hit = 0 }) {
  B.r(lx - 1, ly - 1, w + 2, h + 2, HOUSING);
  B.r(lx - 1, ly - 1, w + 2, 1, shade(HOUSING, 0.35));
  if (!open) {
    B.r(lx, ly, w, h, shade(HOUSING, -0.3));
    for (let y = 1; y < h; y += 2) B.r(lx, ly + y, w, 1, shade(HOUSING, 0.18));
    return;
  }
  const on = flick(age, 5) % 2 === 0;
  B.r(lx, ly, w, h, on ? col : shade(col, -0.18));
  B.r(lx, ly, w, 1, shade(col, 0.5));
  if (w > 4 && h > 4) B.r(lx + 1, ly + 1, w - 2, h - 2, col);
  if (hit > 0) {
    const g = hit > 0.04 ? 2 : 1;
    const c = shade(col, 0.6);
    B.r(lx - g, ly - g, w + g * 2, 1, c);
    B.r(lx - g, ly + h + g - 1, w + g * 2, 1, c);
    B.r(lx - g, ly - g, 1, h + g * 2, c);
    B.r(lx + w + g - 1, ly - g, 1, h + g * 2, c);
  }
}

/**
 * Damage that shows as the fight goes on. Each mark `{x, y, kind, phase}` appears once the boss reaches that phase.
 * kinds: crack, plate (a missing armour plate), scorch, smoke (rising puffs), spark (blinks).
 */
export function damageMarks(B, pose, marks) {
  const { phase } = pose.bs;
  const age = pose.bs.age;
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (phase < m.phase) continue;
    const { x, y } = m;
    switch (m.kind) {
      case 'crack':
        B.r(x, y, 1, 3, '#16121c');
        B.r(x + 1, y + 3, 1, 3, '#16121c');
        B.r(x, y + 6, 1, 2, '#16121c');
        break;
      case 'plate':
        B.r(x, y, 6, 5, '#1b1822');
        B.r(x, y, 6, 1, '#3a3648');
        B.r(x + 1, y + 2, 2, 1, '#0c0a10');
        break;
      case 'scorch':
        B.r(x, y, 7, 4, '#1a1612');
        B.r(x + 1, y - 1, 4, 1, '#2a231c');
        break;
      case 'smoke': {
        const t = (age * 0.9 + i * 0.37) % 1;
        B.disc(x + Math.round(Math.sin(age * 2 + i) * 1.5), y - Math.round(t * 14), 1 + Math.round(t * 2), t < 0.6 ? '#4a4650' : '#6a6670');
        break;
      }
      case 'spark':
        if (flick(age + i * 0.11, 9) % 3 === 0) {
          B.r(x, y, 2, 2, '#ffe27a');
          B.r(x - 1, y + 1, 4, 1, '#ff8a1e');
        }
        break;
      default:
    }
  }
}

/** A whole-pixel idle bob for a standing boss: 0 while it acts, +-amp while it idles. */
export function breathe(pose, amp = 1) {
  if (pose.state !== 'idle') return 0;
  return Math.round(Math.sin(pose.bs.age * 2.2) * amp);
}

/** True for a moment every few seconds (eye blinks, vent flaps). `seed` offsets the cycle. */
export function blink(age, seed = 0) {
  return (age + seed) % 3.4 < 0.14;
}

/**
 * The death collapse: `{k, sink, char, fly}`. `k` is 0..1 progress through the dying timer, `sink` pixels the body settles,
 * `char` how far colours are burnt toward black (0..0.55) and `fly` how far loose parts have flown (pixels, eases out).
 * Everything is 0 outside the dying state.
 */
export function collapse(pose) {
  if (pose.state !== 'dying') return { k: 0, sink: 0, char: 0, fly: 0 };
  const k = Math.max(0, Math.min(1, 1 - pose.bs.t / DEATH_TIME));
  return { k, sink: Math.round(k * 10), char: 0.55 * k, fly: Math.round(40 * (1 - (1 - k) * (1 - k))) };
}
