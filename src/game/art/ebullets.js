// Enemy bullet art. A bullet's `kind` (set from the enemy def's bullet.kind) picks the painter.

import { shade } from './common.js';

function orb(ctx, b, x, y) {
  const r = b.r || 2;
  const col = b.col || '#ff5a3c';
  ctx.fillStyle = col;
  if (r <= 2) {
    ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 1, 1);
  } else {
    ctx.fillRect(x - 2, y - 3, 5, 7);
    ctx.fillRect(x - 3, y - 2, 7, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

function plasma(ctx, b, x, y) {
  const r = b.r || 2;
  const col = b.col || '#ff4adc';
  ctx.fillStyle = shade(col, -0.35);
  ctx.fillRect(x - r - 1, y - 1, r * 2 + 3, 3);
  ctx.fillRect(x - 1, y - r - 1, 3, r * 2 + 3);
  ctx.fillStyle = col;
  ctx.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function spit(ctx, b, x, y) {
  const col = b.col || '#b8ff3a';
  ctx.fillStyle = shade(col, -0.45);
  ctx.fillRect(x - 3, y - 2, 6, 5);
  ctx.fillStyle = col;
  ctx.fillRect(x - 2, y - 2, 5, 4);
  ctx.fillRect(x - 1, y - 3, 3, 6);
  ctx.fillStyle = '#f4ffd0';
  ctx.fillRect(x - 1, y - 2, 2, 1);
  // drip trail
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = col;
  const n = Math.hypot(b.vx, b.vy) || 1;
  ctx.fillRect(Math.round(x - (b.vx / n) * 5), Math.round(y - (b.vy / n) * 5), 2, 2);
  ctx.globalAlpha = 1;
}

// an arrow: thin shaft along the flight path, iron head, feather tail
function arrow(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -8; i <= 3; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    ctx.fillStyle = i > 1 ? '#e8eef4' : i < -5 ? '#f2ecd8' : '#8a6a3a';
    ctx.fillRect(px, py, i > 1 ? 2 : 1, i > 1 ? 2 : 1);
  }
  ctx.fillStyle = '#c0262e';
  ctx.fillRect(Math.round(x - dx * 7 + dy), Math.round(y - dy * 7 - dx), 1, 1);
  ctx.fillRect(Math.round(x - dx * 7 - dy), Math.round(y - dy * 7 + dx), 1, 1);
}

function cannon(ctx, b, x, y) {
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(x - 3, y - 2, 7, 5);
  ctx.fillRect(x - 2, y - 3, 5, 7);
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = '#8a8a98';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function bolt(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = i >= 3 ? '#e8e8f0' : '#8a6a3a';
    ctx.fillRect(Math.round(x + dx * i), Math.round(y + dy * i), 2, 2);
  }
}

function bullet(ctx, b, x, y) {
  const horiz = Math.abs(b.vx) > Math.abs(b.vy) * 2;
  ctx.fillStyle = '#ffe9a0';
  if (horiz) ctx.fillRect(x - 2, y, 5, 2);
  else ctx.fillRect(x, y - 2, 2, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
}

function fire(ctx, b, x, y) {
  ctx.fillStyle = '#d8381a';
  ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = '#ff8a1e';
  ctx.fillRect(x - 1, y - 2, 3, 4);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function bomb(ctx, b, x, y) {
  ctx.fillStyle = '#22222a';
  ctx.fillRect(x - 2, y - 3, 5, 6);
  ctx.fillRect(x - 3, y - 2, 7, 4);
  ctx.fillStyle = '#6a6a7a';
  ctx.fillRect(x - 1, y - 2, 2, 2);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(x, y - 4, 1, 1);
}

// a low shockwave rolling along the floor
function wave(ctx, b, x, y) {
  const dir = Math.sign(b.vx) || 1;
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(x - 5, y - 1, 10, 7);
  ctx.fillStyle = '#b89858';
  ctx.fillRect(x - 5 * dir - (dir > 0 ? 0 : 0), y + 2, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2 * dir - 1, y - 4, 3, 6);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(x + 2 * dir - 1, y - 7, 2, 7);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x - 8 * dir - 1, y + 1, 3, 5);
  ctx.globalAlpha = 1;
}

function rock(ctx, b, x, y) {
  ctx.fillStyle = '#4a3a34';
  ctx.fillRect(x - 4, y - 3, 9, 7);
  ctx.fillRect(x - 3, y - 4, 7, 9);
  ctx.fillStyle = '#7a6a5e';
  ctx.fillRect(x - 3, y - 3, 4, 2);
  ctx.fillStyle = '#2a201c';
  ctx.fillRect(x, y + 1, 4, 3);
}

// one segment of an erupting fire column
function flame(ctx, b, x, y) {
  const wob = Math.floor(b.life * 30) % 2;
  ctx.fillStyle = '#d8381a';
  ctx.fillRect(x - 4 + wob, y - 5, 8 - wob * 2, 10);
  ctx.fillStyle = '#ff8a1e';
  ctx.fillRect(x - 3, y - 5, 6, 9);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(x - 1, y - 4, 3, 7);
}

function ice(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = i > 1 ? '#ffffff' : i > -2 ? '#bfeaff' : '#6ab4e8';
    ctx.fillRect(Math.round(x + dx * i) - 1, Math.round(y + dy * i) - 1, 3, 3);
  }
}

// a slash of a giant claw: three diagonal streaks that flash white then fade
function claw(ctx, b, x, y) {
  const fade = Math.max(0, Math.min(1, (b.life ?? 0.3) / 0.3));
  ctx.globalAlpha = 0.4 + 0.6 * fade;
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i > 8 ? '#ffffff' : i > 3 ? '#e8d8ff' : '#a878e8';
      ctx.fillRect(Math.round(x + k * 6 - 5 + i * 0.8), Math.round(y - 9 + i * 1.5 + k), 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// a firework rocket: stick, painted head and a trail of sparks pointing back along the flight
function rocket(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  const col = b.col || '#ff4a4a';
  for (let i = -3; i <= 4; i++) {
    ctx.fillStyle = i >= 3 ? col : i >= 0 ? '#e8e0c8' : '#8a5a2a';
    ctx.fillRect(Math.round(x + dx * i) - 1, Math.round(y + dy * i) - 1, 3, 3);
  }
  const f = Math.floor((b.life || 0) * 40) % 2;
  ctx.fillStyle = f ? '#ffe27a' : '#ffffff';
  ctx.fillRect(Math.round(x - dx * 6) - 1, Math.round(y - dy * 6) - 1, 3, 3);
  ctx.fillStyle = '#ff8a1e';
  ctx.fillRect(Math.round(x - dx * 9), Math.round(y - dy * 9), 2, 2);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(Math.round(x - dx * 12), Math.round(y - dy * 12), 2, 2);
  ctx.globalAlpha = 1;
}

// one spark of a firework burst: a bright four-pointed star that twinkles
function sparkle(ctx, b, x, y) {
  const col = b.col || '#ffd23a';
  const tw = Math.floor((b.life || 0) * 24) % 2;
  ctx.fillStyle = col;
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
  if (tw) {
    ctx.fillStyle = col;
    ctx.fillRect(x - 3, y, 7, 1);
    ctx.fillRect(x, y - 3, 1, 7);
  }
}

// a bundle of firecrackers dropped from a kite
function cracker(ctx, b, x, y) {
  ctx.fillStyle = '#c0262e';
  ctx.fillRect(x - 2, y - 3, 5, 7);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x - 2, y - 1, 5, 1);
  ctx.fillRect(x - 2, y + 2, 5, 1);
  ctx.fillStyle = '#7a1018';
  ctx.fillRect(x - 2, y - 3, 1, 7);
  ctx.fillStyle = Math.floor((b.life || 0) * 30) % 2 ? '#ffffff' : '#ffb02e';
  ctx.fillRect(x, y - 5, 1, 2);
}

// a thrown axe, spinning end over end
function axe(ctx, b, x, y) {
  const a = (b.life || 0) * -16;
  const hx = Math.cos(a);
  const hy = Math.sin(a);
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(Math.round(x + hx * i), Math.round(y + hy * i), 2, 2);
  }
  for (let i = -1; i <= 3; i++) {
    ctx.fillStyle = i === 3 ? '#ffffff' : '#c8d0dc';
    ctx.fillRect(Math.round(x + hx * 4 - hy * i) - 1, Math.round(y + hy * 4 + hx * i) - 1, 3, 3);
  }
}

// a swell rolling along the deck: a breaking wave with a foam crest
function surf(ctx, b, x, y) {
  const dir = Math.sign(b.vx) || -1;
  const t = Math.floor((b.life || 0) * 8) % 2;
  ctx.fillStyle = '#2f78b8';
  ctx.fillRect(x - 9, y - 5, 18, 12);
  ctx.fillStyle = '#6ab4e8';
  ctx.fillRect(x - 8, y - 9, 14, 6);
  ctx.fillRect(x - 6 * -dir - (dir > 0 ? 6 : 0), y - 13, 6, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 5 * -dir - (dir > 0 ? 3 : 0), y - 15 + t, 4, 3);
  ctx.fillRect(x - 8, y - 10, 5, 2);
  ctx.fillStyle = '#1f5088';
  ctx.fillRect(x - 9, y + 4, 18, 3);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 10 * dir, y - 2 + t * 2, 4, 2);
  ctx.globalAlpha = 1;
}

// one segment of a tentacle erupting through the deck: purple, dotted with suckers
function tentacle(ctx, b, x, y) {
  const wob = Math.floor((b.life || 0) * 24) % 2;
  ctx.fillStyle = '#4a1a6a';
  ctx.fillRect(x - 5 + wob, y - 5, 10 - wob * 2, 10);
  ctx.fillStyle = '#8a3aa8';
  ctx.fillRect(x - 4, y - 5, 8, 9);
  ctx.fillStyle = '#c88ae0';
  ctx.fillRect(x - 3, y - 4, 2, 2);
  ctx.fillStyle = '#f0d8f8';
  ctx.fillRect(x + 1, y + 1, 2, 2);
}

// a flaming boulder: grey stone wrapped in fire, trailing sparks back along its flight
function boulder(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  const f = Math.floor((b.life || 0) * 30) % 2;
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(Math.round(x - dx * 8) - 1, Math.round(y - dy * 8) - 1, 3, 3);
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#ff6a1e';
  ctx.fillRect(Math.round(x - dx * 12) - 1, Math.round(y - dy * 12) - 1, 3, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = f ? '#ff8a1e' : '#ffd23a';
  ctx.fillRect(x - 5, y - 4, 10, 8);
  ctx.fillRect(x - 4, y - 5, 8, 10);
  ctx.fillStyle = '#5a5a66';
  ctx.fillRect(x - 3, y - 3, 7, 7);
  ctx.fillStyle = '#8a8a96';
  ctx.fillRect(x - 3, y - 3, 3, 2);
  ctx.fillStyle = '#34343c';
  ctx.fillRect(x + 1, y + 1, 3, 3);
}

// a crossbow bolt: short, stout, fast
function quarrel(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -5; i <= 4; i++) {
    ctx.fillStyle = i >= 3 ? '#f4f4fa' : i <= -4 ? '#c8c0a8' : '#5a3e22';
    ctx.fillRect(Math.round(x + dx * i), Math.round(y + dy * i), 2, 2);
  }
}

// a throwing star, spinning
function shuriken(ctx, b, x, y) {
  const spin = Math.floor((b.life || 0) * 20) % 2;
  ctx.fillStyle = '#dfe6ee';
  if (spin) {
    ctx.fillRect(x - 3, y - 1, 7, 3);
    ctx.fillRect(x - 1, y - 3, 3, 7);
  } else {
    ctx.fillRect(x - 3, y - 3, 3, 3);
    ctx.fillRect(x + 1, y - 3, 3, 3);
    ctx.fillRect(x - 3, y + 1, 3, 3);
    ctx.fillRect(x + 1, y + 1, 3, 3);
  }
  ctx.fillStyle = '#6a7280';
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
}

// one segment of a lightning strike: a jagged white-blue bolt
function lightning(ctx, b, x, y) {
  const j = Math.floor((b.life || 0) * 40) % 3 - 1;
  ctx.fillStyle = '#6a9aff';
  ctx.fillRect(x - 4 + j, y - 5, 8, 10);
  ctx.fillStyle = '#bfe0ff';
  ctx.fillRect(x - 2 - j, y - 5, 5, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1 + j, y - 5, 3, 10);
}

// chain shot: two iron balls on a chain, tumbling
function chain(ctx, b, x, y) {
  const a = (b.life || 0) * 14;
  const dx = Math.cos(a) * 6;
  const dy = Math.sin(a) * 6;
  ctx.fillStyle = '#8a8a96';
  for (let i = -2; i <= 2; i++) ctx.fillRect(Math.round(x + (dx * i) / 2.4), Math.round(y + (dy * i) / 2.4), 1, 1);
  for (const sg of [-1, 1]) {
    const bx = Math.round(x + dx * sg);
    const by = Math.round(y + dy * sg);
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(bx - 3, by - 2, 6, 5);
    ctx.fillRect(bx - 2, by - 3, 4, 7);
    ctx.fillStyle = '#8a8a98';
    ctx.fillRect(bx - 2, by - 2, 2, 2);
  }
}

// one segment of a ghost-fire column: green spirit flame
function spirit(ctx, b, x, y) {
  const wob = Math.floor((b.life || 0) * 30) % 2;
  ctx.fillStyle = '#1a8a6a';
  ctx.fillRect(x - 4 + wob, y - 5, 8 - wob * 2, 10);
  ctx.fillStyle = '#4af0b8';
  ctx.fillRect(x - 3, y - 5, 6, 9);
  ctx.fillStyle = '#d8fff0';
  ctx.fillRect(x - 1, y - 4, 3, 7);
}

// a stick of dynamite, tumbling, its fuse sparking
function dynamite(ctx, b, x, y) {
  const a = Math.floor((b.life || 0) * 14) % 4;
  ctx.fillStyle = '#c0262e';
  if (a % 2) ctx.fillRect(x - 4, y - 1, 8, 3);
  else ctx.fillRect(x - 1, y - 4, 3, 8);
  ctx.fillStyle = '#f4f0dc';
  if (a % 2) ctx.fillRect(x - 1, y - 1, 2, 3);
  else ctx.fillRect(x - 1, y - 1, 3, 2);
  ctx.fillStyle = Math.floor((b.life || 0) * 30) % 2 ? '#ffe27a' : '#ff8a1e';
  ctx.fillRect(a % 2 ? x + 4 : x, a % 2 ? y - 2 : y - 6, 2, 2);
}

// a column of scalding steam: layered white puffs
function steam(ctx, b, x, y) {
  const w = Math.floor((b.life || 0) * 20) % 2;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#c8d8e4';
  ctx.fillRect(x - 5 + w, y - 5, 10 - w * 2, 10);
  ctx.fillStyle = '#f0f6fa';
  ctx.fillRect(x - 3, y - 4, 6, 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 3 + w, 3, 4);
}

// a lump of burning coal
function coal(ctx, b, x, y) {
  ctx.fillStyle = '#15151a';
  ctx.fillRect(x - 3, y - 3, 7, 6);
  ctx.fillRect(x - 2, y - 4, 5, 8);
  ctx.fillStyle = Math.floor((b.life || 0) * 16) % 2 ? '#ff8a1e' : '#e0381a';
  ctx.fillRect(x - 2, y - 2, 2, 2);
  ctx.fillRect(x + 1, y, 2, 2);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x, y - 4, 1, 1);
}

// a blob of molten slag, trailing orange
function slag(ctx, b, x, y) {
  const f = Math.floor((b.life || 0) * 14) % 2;
  ctx.fillStyle = '#a02a10';
  ctx.fillRect(x - 4, y - 3, 9, 7);
  ctx.fillRect(x - 3, y - 4, 7, 9);
  ctx.fillStyle = f ? '#ff8a1e' : '#e0501a';
  ctx.fillRect(x - 3, y - 3, 7, 7);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x - 1, y - 2, 3, 3);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(x + (f ? 4 : 5), y - 1, 1, 1);
  ctx.fillRect(x - (f ? 5 : 6), y + 1, 1, 1);
}

// an artillery shell, nose first along its heading
function shell(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -5; i <= 4; i++) {
    ctx.fillStyle = i >= 3 ? '#c8a040' : i >= -3 ? '#6a6a4a' : '#3a3a32';
    const t = i >= 3 ? 2 : 3;
    ctx.fillRect(Math.round(x + dx * i) - (t >> 1), Math.round(y + dy * i) - (t >> 1), t, t);
  }
  ctx.fillStyle = '#a8c858';
  ctx.fillRect(Math.round(x - dx * 1) - 1, Math.round(y - dy * 1) - 1, 2, 2);
}

// a puff of poison gas: sickly green, shifting a little every frame
function gas(ctx, b, x, y) {
  const f = Math.floor((b.life || 0) * 8 + x * 0.3) % 3;
  ctx.globalAlpha = Math.min(0.75, 0.25 + (b.life || 0) * 0.5);
  ctx.fillStyle = '#6a8a2a';
  ctx.fillRect(x - 8 + (f === 1 ? 1 : 0), y - 7, 16, 14);
  ctx.fillRect(x - 6, y - 9 + f, 12, 18);
  ctx.fillStyle = '#a8c858';
  ctx.fillRect(x - 6, y - 6, 10, 9);
  ctx.fillStyle = '#d0e890';
  ctx.fillRect(x - 3 + f, y - 4, 5, 4);
  ctx.globalAlpha = 1;
}

// a stick grenade, tumbling end over end
function grenade(ctx, b, x, y) {
  const a = Math.floor((b.life || 0) * 12) % 4;
  const horiz = a % 2 === 0;
  ctx.fillStyle = '#8a6a3a';
  if (horiz) ctx.fillRect(x - 4, y, 8, 2);
  else ctx.fillRect(x, y - 4, 2, 8);
  ctx.fillStyle = '#6a6e62';
  if (horiz) ctx.fillRect(a === 0 ? x + 2 : x - 4, y - 2, 3, 6);
  else ctx.fillRect(x - 2, a === 1 ? y + 2 : y - 4, 6, 3);
  ctx.fillStyle = '#9a9e92';
  if (horiz) ctx.fillRect(a === 0 ? x + 2 : x - 4, y - 2, 3, 1);
  else ctx.fillRect(x - 2, a === 1 ? y + 2 : y - 4, 6, 1);
}

// a laser bolt: a short bright streak along its flight with a white core (kind 'laser')
function laser(ctx, b, x, y) {
  const col = b.col || '#4af0ff';
  const sp = Math.hypot(b.vx || 1, b.vy || 0) || 1;
  const ux = (b.vx || 1) / sp;
  const uy = (b.vy || 0) / sp;
  for (let i = 0; i < 7; i++) {
    const k = i * 1.6;
    ctx.globalAlpha = 1 - i * 0.11;
    ctx.fillStyle = i < 2 ? '#ffffff' : col;
    ctx.fillRect(Math.round(x - ux * k) - 1, Math.round(y - uy * k) - 1, i < 3 ? 3 : 2, i < 3 ? 3 : 2);
  }
  ctx.globalAlpha = 1;
}

// a segment of a stabbing laser beam (kind 'beam'): a pulsing column of light, 8 px per piece
function beam(ctx, b, x, y) {
  const col = b.col || '#ff4ad8';
  const pulse = 0.5 + 0.5 * Math.sin((b.life || 0) * 40 + b.y * 0.2);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = col;
  ctx.fillRect(x - 6, y - 5, 12, 10);
  ctx.globalAlpha = 0.6 + 0.3 * pulse;
  ctx.fillRect(x - 4, y - 5, 8, 10);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 5, 3, 10);
}

// a rift crescent: a curved slash of violet light that flies edge-first (kind 'crescent')
function crescent(ctx, b, x, y) {
  const f = (b.vx || 1) >= 0 ? 1 : -1;
  const col = b.col || '#ff4ad8';
  const pulse = Math.floor((b.life || 0) * 20) % 2;
  // the bow of the crescent faces the way it flies: bars that curve back toward the tips
  const bars = [[0, 12], [-2, 10], [-4, 8], [-6, 5], [-8, 3]];
  for (const [dx, h] of bars) {
    const bx = x + f * dx - (f < 0 ? 2 : 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.fillRect(bx - 1, y - Math.round(h / 2) - 1, 4, h + 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.fillRect(bx, y - Math.round(h / 2), 2, h);
  }
  ctx.fillStyle = pulse ? '#ffffff' : '#ffd0f4';
  ctx.fillRect(x - (f < 0 ? 1 : 0), y - 5, 1, 10);
}

export const EBULLET_ART = {
  crescent,
  laser,
  beam,
  grenade,
  shell,
  gas,
  slag,
  dynamite,
  steam,
  coal,
  chain,
  spirit,
  shuriken,
  lightning,
  boulder,
  quarrel,
  axe,
  surf,
  tentacle,
  rocket,
  spark: sparkle,
  cracker,
  claw,
  orb,
  plasma,
  spit,
  cannon,
  bolt,
  bullet,
  fire,
  bomb,
  wave,
  rock,
  flame,
  ice,
  arrow,
  // <<EBULLET_ART>> (registry: new enemy bullet kinds are added above this line)
};

export function drawEnemyBulletArt(ctx, b, ox, oy) {
  const fn = EBULLET_ART[b.kind] || orb;
  fn(ctx, b, Math.round(b.x - ox), Math.round(b.y - oy));
}
