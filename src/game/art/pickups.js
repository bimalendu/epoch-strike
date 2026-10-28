// Pickup sprites (weapon letters, R, B, bomb, medal, 1UP heart) and the flying capsule.

import { Painter, blit } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { shade } from './common.js';
import { pickupInfo, PICKUPS } from '../pickups.js';
import { parkedTankSprite } from './tank.js';

const cache = new Map();
const INK = '#0d0d14';

// the era (E) weapons: an 11x3 icon along the bottom of the badge, since the letter is the same for all five
const ERA_ICONS = {
  spear: ['........#..', '###########', '........#..'],
  ballista: ['##.......#.', '###########', '##.......#.'],
  crossbow: ['.....#.....', '...#######.', '.....#.....'],
  tesla: ['..#.#.#.#..', '.#########.', '..#.#.#.#..'],
  plasma: ['...#####...', '..#######..', '...#####...'],
};

/** A 15x15 weapon / power-up tile: rounded ink border, bevelled gradient face, the letter and a small icon underneath. */
function badge(letter, color, weapon, kind) {
  const p = new Painter(15, 15);
  p.rect(1, 0, 13, 15, INK);
  p.rect(0, 1, 15, 13, INK);
  p.rect(1, 1, 13, 13, shade(color, -0.35));
  p.rect(1, 1, 13, 8, color);
  p.rect(1, 1, 13, 3, shade(color, 0.22));
  p.rect(1, 1, 13, 1, shade(color, 0.55)); // lit top edge
  p.rect(1, 1, 1, 12, shade(color, 0.4)); // lit left edge
  p.rect(13, 2, 1, 12, shade(color, -0.55)); // shaded right edge
  p.rect(2, 13, 12, 1, shade(color, -0.6)); // shaded bottom edge
  p.px(1, 13, shade(color, -0.2));
  // the icon along the bottom
  const icon = shade(color, 0.6);
  const shadow = shade(color, -0.65);
  if (ERA_ICONS[weapon]) {
    ERA_ICONS[weapon].forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') p.px(2 + i, 10 + j, icon);
    });
  } else if (kind === 'barrier') {
    p.rect(5, 10, 5, 2, shadow); p.rect(6, 12, 3, 1, shadow);
    p.rect(5, 9, 5, 2, icon); p.rect(6, 11, 3, 1, icon); p.px(7, 12, icon);
  } else if (kind === 'rapid') {
    for (const x of [4, 7, 10]) {
      p.rect(x, 11, 2, 1, shadow); p.rect(x + 1, 12, 2, 1, shadow);
      p.rect(x, 10, 2, 1, icon); p.rect(x + 1, 11, 2, 1, icon);
    }
  }
  drawText(p.ctx, letter, 8, 2, '#ffffff', 1, 'center', shade(color, -0.8));
  return p.canvas;
}

/** Six frames of a diagonal glint sweeping across a finished badge. */
function shineFrames(base) {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const p = new Painter(15, 15);
    p.ctx.drawImage(base, 0, 0);
    p.ctx.globalAlpha = 0.6;
    p.ctx.fillStyle = '#ffffff';
    const x0 = -7 + k * 4;
    for (let y = 1; y <= 13; y++) {
      const x = x0 + (13 - y);
      for (const xx of [x, x + 1]) if (xx >= 1 && xx <= 13) p.ctx.fillRect(xx, y, 1, 1);
    }
    p.ctx.globalAlpha = 1;
    out.push(p.canvas);
  }
  return out;
}

/** The coin turning on its ribbon: wide, narrowing, edge-on, narrowing (4 frames, 11x14 each). */
function medalFrames() {
  const out = [];
  for (const rx of [4, 3, 1, 3]) {
    const p = new Painter(13, 16);
    p.rect(3, 0, 3, 5, '#d92b2b');
    p.rect(7, 0, 3, 5, '#2b5fd9');
    p.rect(3, 0, 1, 5, '#f05a4a');
    p.rect(7, 0, 1, 5, '#5a8aef');
    p.rect(1, 3, 1, 1, null);
    p.ellipse(6, 10, rx + 1, 5, '#6a4410');
    p.ellipse(6, 10, rx, 4, '#a8741a');
    if (rx > 1) {
      p.ellipse(6, 10, rx - 1, 3, '#ffd23a');
      p.rect(6 - (rx - 2), 8, 1, 1, '#fff6c0');
      p.rect(6, 7, 1, 7, '#fff2a8');
      if (rx > 2) p.rect(4, 10, 5, 1, '#fff2a8');
    } else {
      p.rect(6, 7, 1, 7, '#ffd23a');
    }
    out.push(p.canvas);
  }
  return out;
}

/** The 1UP heart, relaxed and beating (one pixel bigger all round). */
function heartFrames() {
  const out = [];
  for (const g of [0, 1]) {
    const p = new Painter(15, 14);
    const c = '#ff4a6a';
    const o = '#7a1030';
    const at = (x, y, w, h, col) => p.rect(x + 1 - g, y + 1 - g, w + g * 2, h + g * 2, col);
    // outline first (everything one pixel out), then the fill
    for (const [x, y, w, h] of [[1, 1, 4, 4], [8, 1, 4, 4], [0, 2, 13, 3], [1, 5, 11, 2], [2, 7, 9, 2], [4, 9, 5, 1], [5, 10, 3, 1]]) {
      p.rect(x + 1 - g - 1, y + 1 - g - 1, w + g * 2 + 2, h + g * 2 + 2, o);
    }
    for (const [x, y, w, h] of [[1, 1, 4, 4], [8, 1, 4, 4], [0, 2, 13, 3], [1, 5, 11, 2], [2, 7, 9, 2], [4, 9, 5, 1], [5, 10, 3, 1]]) at(x, y, w, h, c);
    at(2, 2, 2, 2, '#ffd0d8');
    at(2, 2, 1, 1, '#ffffff');
    at(0, 5, 1, 1, '#c02848');
    at(12, 5, 1, 1, '#c02848');
    at(3, 8, 7, 1, '#c02848');
    at(4, 9, 5, 1, '#a82040');
    out.push(p.canvas);
  }
  return out;
}

function bombIcon() {
  const p = new Painter(13, 13);
  p.rect(1, 0, 11, 13, INK);
  p.rect(0, 1, 13, 11, INK);
  p.rect(1, 1, 11, 11, '#3a4050');
  p.rect(1, 1, 11, 1, '#5a6478');
  p.rect(1, 1, 1, 11, '#5a6478');
  p.ellipse(6, 7, 4, 4, '#2a2e3a');
  p.ellipse(6, 7, 3, 3, '#9aa4b8');
  p.ellipse(5, 6, 2, 2, '#d8dde8');
  p.px(4, 5, '#ffffff');
  p.rect(5, 2, 3, 2, '#d8dde8');
  p.rect(5, 2, 3, 1, '#ffffff');
  p.rect(8, 1, 1, 2, '#6a4a2a'); // fuse
  return p.canvas;
}

function sprite(item) {
  let s = cache.get(item);
  if (s) return s;
  const d = pickupInfo(item);
  if (d.kind === 'medal') s = medalFrames();
  else if (d.kind === 'life') s = heartFrames();
  else if (d.kind === 'bomb') s = bombIcon();
  else if (d.kind === 'tank') s = parkedTankSprite();
  else {
    const base = badge(d.letter, d.color, d.weapon, d.kind);
    s = Object.assign(base, { shine: shineFrames(base) });
  }
  cache.set(item, s);
  return s;
}

/** Paint every pickup badge now instead of when one first comes into view. */
export function warmPickups() {
  for (const item of Object.keys(PICKUPS)) sprite(item);
}

/** Small icon of an item (used by the HUD for the carried weapons): a single still image. */
export function pickupIcon(item) {
  const s = sprite(item);
  return Array.isArray(s) ? s[0] : s;
}

const SHINE_EVERY = 1.6; // seconds between glints on a badge
const SHINE_FPS = 22;

export function drawPickup(ctx, pk, ox, oy) {
  let img = sprite(pk.item);
  const bob = pk.float ? Math.round(Math.sin(pk.t * 4) * 2) : 0;
  let twinkle = false;
  if (Array.isArray(img)) {
    img = img[Math.floor(pk.t * (pk.def.kind === 'life' ? 6 : 8)) % img.length];
  } else if (img.shine) {
    const t = (pk.t + (Math.round(pk.x) % 7) * 0.2) % SHINE_EVERY; // not every badge in step
    const k = Math.floor(t * SHINE_FPS);
    if (k < img.shine.length) img = img.shine[k];
    twinkle = t > 0.3 && t < 0.42;
  }
  const x = Math.round(pk.x - ox - (img.ox ?? img.width / 2));
  const y = Math.round(pk.y - oy - img.height + bob);
  blit(ctx, img, x, y);
  if (twinkle) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + img.width - 3, y - 1, 1, 3);
    ctx.fillRect(x + img.width - 4, y, 3, 1);
  }
}

// ---- the flying capsule (an enemy template, see enemy_defs.js) ----

function capsuleFrame(flap, blink) {
  const p = new Painter(22, 16);
  const wingY = flap ? 2 : 5;
  // wings: a lit top, a shaded underside and a strut down to the pod
  for (const x of [2, 14]) {
    p.rect(x, wingY, 6, 3, '#aab4c8');
    p.rect(x, wingY, 6, 1, '#ffffff');
    p.rect(x, wingY + 2, 6, 1, '#6a7488');
    p.rect(x + 2, wingY + 3, 2, 8 - wingY, '#6a7488');
  }
  // jet flame at the tail
  p.rect(0, 10, 3, 2, flap ? '#ff9a2a' : '#ff6a1e');
  p.rect(0, 10, 2, 1, '#ffee9a');
  if (flap) p.px(0, 11, '#ffee9a');
  // pod: dark rim, shaded belly, light top and a seam
  p.ellipse(11, 10, 8, 5, '#3a4254');
  p.ellipse(11, 10, 7, 4, '#6a7488');
  p.ellipse(11, 9, 7, 3, '#aab4c8');
  p.rect(5, 8, 12, 1, '#e8eef8');
  p.rect(7, 7, 6, 1, '#ffffff');
  p.rect(5, 12, 12, 1, '#4a5468');
  p.rect(16, 9, 1, 3, '#4a5468');
  // beacon
  p.rect(9, 6, 4, 4, '#3a1010');
  p.rect(9, 7, 4, 3, blink ? '#ff4a3a' : '#7a1a1a');
  p.px(10, 7, blink ? '#ffd0c0' : '#a02a2a');
  return p.canvas;
}

export function capsulePainter() {
  const a = capsuleFrame(true, true);
  const b = capsuleFrame(false, false);
  return { idle: a, run: [a, b], w: 22, h: 16, ox: 11 };
}
