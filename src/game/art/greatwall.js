// Painters for the Great Wall's enemies that are not plain humanoids: the firecracker crate and the kite soldier.
// Sprites face right (the kite is symmetrical enough that drawEnemy's mirroring just flips the tail).

import { Painter } from '../../engine/gfx.js';
import { shade } from './common.js';

// ---- firecrate: a red lacquered crate with a bamboo launch tube ----
function crateFrame(def, { hot = false, kick = 0 } = {}) {
  const pal = def.pal;
  const p = new Painter(22, 26);
  const B = hot ? shade(pal.body, 0.35) : pal.body;
  // bamboo tube, angled slightly, poking out of the lid
  p.rect(9, 1 + kick, 4, 10, pal.tube);
  p.rect(9, 1 + kick, 4, 1, shade(pal.tube, 0.4));
  p.rect(9, 4 + kick, 4, 1, shade(pal.tube, -0.35));
  p.rect(9, 8 + kick, 4, 1, shade(pal.tube, -0.35));
  // the fuse and its glow
  p.rect(11, 0 + kick, 1, 2, '#2a2a2a');
  p.px(11, kick ? 0 : -0, hot ? '#ffffff' : '#ffb02e');
  // crate
  p.rect(2, 10, 18, 16, B);
  p.rect(2, 10, 18, 2, shade(B, 0.3));
  p.rect(2, 24, 18, 2, shade(B, -0.4));
  p.rect(2, 10, 1, 16, shade(B, -0.3));
  p.rect(2, 16, 18, 2, pal.trim); // gold band
  p.rect(9, 12, 4, 2, pal.trim);
  p.rect(5, 20, 3, 3, pal.trim); // a lucky coin
  p.rect(14, 20, 3, 3, pal.trim);
  return p.canvas;
}

function firecrate(def) {
  const idle = crateFrame(def);
  return { idle, run: [idle], hot: crateFrame(def, { hot: true }), w: 22, h: 26, ox: 11 };
}

// ---- kite soldier: a diamond paper kite, a rider hanging underneath with a satchel of crackers ----
function kiteFrame(def, frame) {
  const pal = def.pal;
  const p = new Painter(32, 34);
  const wob = frame === 1 ? 1 : 0;
  // the diamond (rows widen then narrow)
  const rows = [2, 4, 6, 8, 10, 12, 14, 14, 12, 10, 8, 6, 4, 2];
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i];
    p.rect(14 - w / 2 + 1 + (i > 6 ? wob : 0), 1 + i, w, 1, i < 7 ? pal.paper : shade(pal.paper, -0.18));
  }
  // bamboo ribs and a golden knot
  p.rect(15, 1, 1, 14, pal.rib);
  p.rect(7, 7, 17, 1, pal.rib);
  p.rect(14, 7, 3, 3, pal.trim);
  // little decorative eyes
  p.px(10, 5, pal.trim);
  p.px(20, 5, pal.trim);
  // streamer tail
  for (let i = 0; i < 4; i++) p.rect(26 + i - wob, 13 + i * 2 + (i & 1 ? 0 : 1), 2, 2, i % 2 ? pal.trim : pal.paper);
  // strings to the rider
  p.line(15, 15, 12, 21, '#e8e0c8', 1);
  p.line(15, 15, 18, 21, '#e8e0c8', 1);
  // the rider: cap, face, body, dangling legs, a satchel
  p.rect(10, 21, 8, 2, pal.cloth);
  p.rect(11, 23, 6, 3, pal.skin);
  p.px(15, 24, '#111111');
  p.rect(10, 26, 8, 5, pal.cloth);
  p.rect(10, 26, 1, 5, shade(pal.cloth, -0.35));
  p.rect(18, 27, 4, 4, '#c0262e'); // satchel of firecrackers
  p.rect(19, 25, 1, 2, '#ffb02e');
  p.rect(11 - wob, 31, 3, 3, '#222222');
  p.rect(15 + wob, 31, 3, 3, '#222222');
  return p.canvas;
}

function kite(def) {
  const f0 = kiteFrame(def, 0);
  const f1 = kiteFrame(def, 1);
  return { idle: f0, run: [f0, f1], w: 32, h: 34, ox: 16 };
}

export function registerGreatWall(painters) {
  painters.firecrate = firecrate;
  painters.kite = kite;
}
