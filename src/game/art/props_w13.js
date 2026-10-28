// Set dressing for the last era group: the missile base, Neon City and the Cyber Megacity (see props.js).

import { shade } from './common.js';
import { drawParkedBike } from './bike.js';

// a missile silo: a concrete collar with a pair of blast doors cracked open and a missile nose showing
function silo(ctx, p, x, y, t) {
  const w = p.w || 36;
  ctx.fillStyle = '#6a7686';
  ctx.fillRect(x - w / 2, y - 10, w, 10);
  ctx.fillStyle = '#9aa6b6';
  ctx.fillRect(x - w / 2, y - 10, w, 2);
  ctx.fillStyle = '#4a5666';
  ctx.fillRect(x - w / 2, y - 3, w, 3);
  // the open doors, tilted up either side
  ctx.fillStyle = '#58626e';
  ctx.fillRect(x - w / 2 - 3, y - 16, 5, 8);
  ctx.fillRect(x + w / 2 - 2, y - 16, 5, 8);
  // the missile
  ctx.fillStyle = '#e8ecf0';
  ctx.fillRect(x - 5, y - 38, 10, 28);
  ctx.fillStyle = '#c4cad2';
  ctx.fillRect(x + 2, y - 38, 3, 28);
  ctx.fillStyle = '#c0262e';
  ctx.fillRect(x - 5, y - 46, 10, 8);
  ctx.fillRect(x - 3, y - 50, 6, 4);
  ctx.fillRect(x - 1, y - 52, 2, 2);
  ctx.fillStyle = '#2a2e38';
  ctx.fillRect(x - 5, y - 28, 10, 2);
  // a warning beacon on the collar
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff3a2a' : '#5a1a14';
  ctx.fillRect(x + w / 2 - 6, y - 13, 3, 3);
}

// a rotating radar dish on a lattice mast
function radar(ctx, p, x, y, t) {
  const h = p.h || 80;
  ctx.fillStyle = '#3a4656';
  ctx.fillRect(x - 2, y - h, 4, h);
  for (let i = 0; i < h; i += 10) {
    ctx.fillStyle = '#2a3440';
    ctx.fillRect(x - 5, y - i - 2, 10, 1);
  }
  ctx.fillStyle = '#c8d4e0';
  const swing = Math.cos(t * 0.9);
  const half = Math.round(11 * Math.abs(swing));
  ctx.fillRect(x - half, y - h - 6, half * 2 + 1, 3);
  ctx.fillRect(x - Math.round(half * 0.7), y - h - 4, Math.round(half * 1.4) + 1, 3);
  ctx.fillStyle = '#8a96a6';
  ctx.fillRect(x - 1, y - h - 4, 2, 5);
  ctx.fillStyle = '#ff3a2a';
  ctx.fillRect(x - 1, y - h - 10, 2, 2);
}

// a stack of supply crates
function crates(ctx, p, x, y) {
  const n = p.n || 2;
  for (let i = 0; i < n; i++) {
    const cx = x - n * 8 + i * 16;
    ctx.fillStyle = '#5a6a4a';
    ctx.fillRect(cx, y - 14, 15, 14);
    ctx.fillStyle = '#7a8a64';
    ctx.fillRect(cx, y - 14, 15, 2);
    ctx.fillStyle = '#3a4632';
    ctx.fillRect(cx, y - 8, 15, 1);
    ctx.fillRect(cx + 7, y - 14, 1, 14);
  }
  if (n > 1) {
    ctx.fillStyle = '#6a7a58';
    ctx.fillRect(x - 6, y - 28, 14, 14);
    ctx.fillStyle = '#8a9a74';
    ctx.fillRect(x - 6, y - 28, 14, 2);
    ctx.fillStyle = '#3a4632';
    ctx.fillRect(x + 1, y - 28, 1, 14);
  }
}

// a cylindrical fuel tank on a cradle, frosted along the top
function fueltank(ctx, p, x, y) {
  ctx.fillStyle = '#3a4656';
  ctx.fillRect(x - 22, y - 4, 44, 4);
  ctx.fillStyle = '#8a98a8';
  ctx.fillRect(x - 24, y - 24, 48, 20);
  ctx.fillRect(x - 22, y - 26, 44, 2);
  ctx.fillStyle = '#c8d4e0';
  ctx.fillRect(x - 24, y - 24, 48, 3);
  ctx.fillStyle = '#6a7686';
  ctx.fillRect(x - 24, y - 8, 48, 4);
  ctx.fillStyle = '#e8f4ff';
  ctx.fillRect(x - 20, y - 27, 14, 2);
  ctx.fillRect(x + 6, y - 28, 10, 2);
  ctx.fillStyle = '#c0262e';
  ctx.fillRect(x - 4, y - 18, 8, 6);
}

// a neon sign on a short pole: blinking letters made of bars
function neonsign(ctx, p, x, y, t) {
  const h = p.h || 70;
  const col = p.col || '#ff4ad8';
  ctx.fillStyle = '#20243a';
  ctx.fillRect(x - 1, y - h, 3, h);
  ctx.fillStyle = '#10121e';
  ctx.fillRect(x - 16, y - h - 18, 32, 18);
  const on = Math.floor(t * 3 + x * 0.01) % 7 !== 0;
  ctx.fillStyle = on ? col : shade(col, -0.6);
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 12 + i * 7, y - h - 14, 4, 10);
  ctx.fillStyle = on ? '#ffffff' : shade(col, -0.4);
  ctx.fillRect(x - 12, y - h - 10, 22, 1);
  ctx.globalAlpha = on ? 0.18 : 0.05;
  ctx.fillStyle = col;
  ctx.fillRect(x - 22, y - h - 24, 44, 30);
  ctx.globalAlpha = 1;
}

// a billboard on two legs showing a scrolling band of colour
function billboard(ctx, p, x, y, t) {
  const h = p.h || 56;
  const w = p.w || 56;
  ctx.fillStyle = '#20243a';
  ctx.fillRect(x - w / 2 + 6, y - h, 3, h);
  ctx.fillRect(x + w / 2 - 9, y - h, 3, h);
  ctx.fillStyle = '#10121e';
  ctx.fillRect(x - w / 2, y - h - 30, w, 30);
  const cols = ['#ff4ad8', '#4af0ff', '#ffe27a', '#7aff9a'];
  for (let i = 0; i < 7; i++) {
    const k = (i + Math.floor(t * 4)) % cols.length;
    ctx.fillStyle = cols[k];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x - w / 2 + 3 + i * Math.floor((w - 6) / 7), y - h - 27, Math.floor((w - 6) / 7) - 1, 24);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - w / 2 + 3, y - h - 16, w - 6, 1);
}

// a street lamp with a cold neon head
function streetlamp(ctx, p, x, y, t) {
  const h = p.h || 56;
  ctx.fillStyle = '#2a2e42';
  ctx.fillRect(x - 1, y - h, 3, h);
  ctx.fillRect(x - 1, y - h, 12, 3);
  ctx.fillStyle = '#4af0ff';
  ctx.fillRect(x + 6, y - h + 3, 6, 2);
  ctx.globalAlpha = 0.16 + 0.04 * Math.sin(t * 3 + x);
  ctx.fillRect(x + 2, y - h + 5, 14, 22);
  ctx.globalAlpha = 1;
}

// a server stack: a rack of blinking lights (the Cyber Megacity's furniture)
function serverstack(ctx, p, x, y, t) {
  const h = p.h || 64;
  ctx.fillStyle = '#14141f';
  ctx.fillRect(x - 12, y - h, 24, h);
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(x - 11, y - h + 1, 22, h - 1);
  ctx.fillStyle = '#6a6e96';
  ctx.fillRect(x - 11, y - h + 1, 22, 2);
  for (let row = 0; row < Math.floor(h / 8) - 1; row++) {
    ctx.fillStyle = '#20203a';
    ctx.fillRect(x - 9, y - h + 6 + row * 8, 18, 1);
    for (let c = 0; c < 4; c++) {
      const on = Math.floor(t * 3 + row * 1.3 + c * 2.1 + x * 0.02) % 3 === 0;
      ctx.fillStyle = on ? (c % 2 ? '#4af0ff' : '#ff4ad8') : '#26264a';
      ctx.fillRect(x - 7 + c * 4, y - h + 8 + row * 8, 2, 2);
    }
  }
}

// the parked hoverbike at the start of the skyway
function hoverpad(ctx, p, x, y, t) {
  drawParkedBike(ctx, x + 18, y, t);
  ctx.fillStyle = '#4af0ff';
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3);
  ctx.fillRect(x - 6, y - 1, 64, 1);
  ctx.globalAlpha = 1;
}

export const PROPS_W13 = { silo, radar, crates, fueltank, neonsign, billboard, streetlamp, serverstack, hoverpad };
