// Player bullet art, one painter per bullet kind. Weapons register kinds here as they are added.

import { blit } from '../../engine/gfx.js';

function rifle(ctx, b, x, y) {
  const horiz = Math.abs(b.vx) > Math.abs(b.vy) * 2.2;
  const vert = Math.abs(b.vy) > Math.abs(b.vx) * 2.2;
  ctx.fillStyle = '#ffe66b';
  if (horiz) ctx.fillRect(x - 3, y - 1, 6, 2);
  else if (vert) ctx.fillRect(x - 1, y - 3, 2, 6);
  else {
    const s = Math.sign(b.vx) * Math.sign(b.vy) >= 0 ? 1 : -1;
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i, y + i * s, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
}

function mg(ctx, b, x, y) {
  const horiz = Math.abs(b.vx) > Math.abs(b.vy) * 2.2;
  const vert = Math.abs(b.vy) > Math.abs(b.vx) * 2.2;
  ctx.fillStyle = '#cfe8ff';
  if (horiz) ctx.fillRect(x - 3, y, 6, 1);
  else if (vert) ctx.fillRect(x, y - 3, 1, 6);
  else ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
}

function spread(ctx, b, x, y) {
  ctx.fillStyle = '#4fd84a';
  ctx.fillRect(x - 1, y - 2, 3, 5);
  ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillStyle = '#d8ffd0';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

function laser(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n, dy = b.vy / n;
  for (let i = -10; i <= 10; i += 2) {
    const px = Math.round(x + dx * i), py = Math.round(y + dy * i);
    ctx.fillStyle = Math.abs(i) < 5 ? '#e8fbff' : '#5ad8ff';
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
}

function flame(ctx, b, x, y) {
  const age = 1 - Math.max(0, Math.min(1, b.life / 0.3)); // 0 fresh .. 1 spent
  const r = 1 + Math.round(age * 3);
  ctx.globalAlpha = 1 - age * 0.55;
  ctx.fillStyle = age < 0.35 ? '#ffe27a' : age < 0.7 ? '#ff8a1e' : '#d8381a';
  ctx.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
  if (age < 0.5) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function homing(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n, dy = b.vy / n;
  // smoky trail behind the head
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.6 - i * 0.15;
    ctx.fillStyle = '#d8d0ff';
    ctx.fillRect(Math.round(x - dx * i * 3) - 1, Math.round(y - dy * i * 3) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#b58aff';
  ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x + dx), Math.round(y + dy), 2, 2);
}

// a flaming spear: wooden shaft, stone-and-fire head, embers falling behind it
function spear(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -13; i <= 4; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    const head = i > 1;
    ctx.fillStyle = i > 3 ? '#ffffff' : head ? '#fff2a8' : i > -2 ? '#ff9a1e' : i > -6 ? '#a8742a' : '#6b4a2b';
    const t = head ? 3 : 2;
    ctx.fillRect(px - (t >> 1), py - (t >> 1), t, t);
  }
  // embers
  const f = Math.floor((b.life || 0) * 40);
  ctx.fillStyle = '#ff6a1a';
  ctx.fillRect(Math.round(x - dx * 15) + (f % 3) - 1, Math.round(y - dy * 15) + ((f >> 1) % 3) - 1, 1, 1);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(Math.round(x - dx * 18) - ((f >> 2) % 2), Math.round(y - dy * 18) + (f % 2), 1, 1);
}

// a ballista bolt: iron head, ash shaft, bronze fletching
function ballista(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -12; i <= 5; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    const head = i > 1;
    ctx.fillStyle = head ? (i > 3 ? '#ffffff' : '#dfe6ee') : i < -9 ? '#c8944a' : '#a8844a';
    const t = head ? 4 : 2;
    ctx.fillRect(px - (t >> 1), py - (t >> 1), t, t);
  }
  ctx.fillStyle = '#c8944a';
  ctx.fillRect(Math.round(x - dx * 10 + dy * 2) - 1, Math.round(y - dy * 10 - dx * 2) - 1, 2, 2);
  ctx.fillRect(Math.round(x - dx * 10 - dy * 2) - 1, Math.round(y - dy * 10 + dx * 2) - 1, 2, 2);
  // a streak of air behind it
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x - dx * 17), Math.round(y - dy * 17), 3, 1);
  ctx.globalAlpha = 1;
}

// a crossbow quarrel: short, stubby, steel head and a notched tail
function crossbow(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -6; i <= 3; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    ctx.fillStyle = i >= 2 ? '#f4f8ff' : i >= 0 ? '#b8c8e0' : '#8a6a3a';
    const t = i >= 1 ? 3 : 2;
    ctx.fillRect(px - (t >> 1), py - (t >> 1), t, t);
  }
  ctx.fillStyle = '#d8e4f4';
  ctx.fillRect(Math.round(x - dx * 6 + dy * 2), Math.round(y - dy * 6 - dx * 2), 1, 1);
  ctx.fillRect(Math.round(x - dx * 6 - dy * 2), Math.round(y - dy * 6 + dx * 2), 1, 1);
}

// a Tesla Coil bolt: a short crackle of blue-white lightning along its heading
function tesla(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  const tick = Math.floor((b.life || 0) * 40);
  for (let i = -9; i <= 5; i++) {
    const j = ((tick * 7 + i * 13) % 5) - 2; // jitter, different each frame
    const px = Math.round(x + dx * i + dy * j * 0.8);
    const py = Math.round(y + dy * i - dx * j * 0.8);
    ctx.fillStyle = i > 1 ? '#ffffff' : i > -4 ? '#bfe4ff' : '#4a8ae8';
    ctx.fillRect(px - 1, py - 1, i > -3 ? 2 : 1, i > -3 ? 2 : 1);
  }
}

// a tank shell: a fat brass-tipped round with a short orange tail
function tankshell(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  for (let i = -7; i <= 3; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    ctx.fillStyle = i < -3 ? '#ff8a1e' : i < 1 ? '#ffd23a' : '#fff4b8';
    const t = i < -3 ? 2 : 3;
    ctx.fillRect(px - (t >> 1), py - (t >> 1), t, t);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x + dx * 3), Math.round(y + dy * 3), 1, 1);
}

// a Plasma Cannon bolt: a pulsing magenta core in a white-hot head with a fading violet tail
function plasma(ctx, b, x, y) {
  const n = Math.hypot(b.vx, b.vy) || 1;
  const dx = b.vx / n;
  const dy = b.vy / n;
  const pulse = Math.floor((b.life || 0) * 30) % 2;
  for (let i = -10; i <= 3; i++) {
    const px = Math.round(x + dx * i);
    const py = Math.round(y + dy * i);
    const t = i > -2 ? 5 + pulse : i > -6 ? 4 : 2;
    ctx.fillStyle = i > 0 ? '#ffffff' : i > -3 ? '#ffd8ff' : i > -7 ? '#ff6af0' : '#8a2ad0';
    ctx.fillRect(px - (t >> 1), py - (t >> 1), t, t);
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff9af0';
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 5, 10, 10);
  ctx.globalAlpha = 1;
}

export const BULLET_ART = {
  plasma,
  tankshell,
  tesla,
  crossbow,
  ballista,
  spear,
  rifle,
  mg,
  spread,
  laser,
  flame,
  homing,
  // <<BULLET_ART>> (registry: new bullet kinds are added above this line)
};

export function drawBullet(ctx, b, ox, oy) {
  const fn = BULLET_ART[b.kind] || rifle;
  fn(ctx, b, Math.round(b.x - ox), Math.round(b.y - oy), ox, oy);
}
