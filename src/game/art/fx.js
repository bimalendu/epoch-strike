// Effect art: explosion frame sets (pre-rendered), muzzle flashes, rings, popups and the dying soldier.

import { Painter, blit, lineTo } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { playerSprites } from './player.js';

const SIZES = [18, 32, 56];
const FRAMES = 6;
let booms = null;

function buildBooms() {
  booms = SIZES.map((s) => {
    const frames = [];
    for (let i = 0; i < FRAMES; i++) {
      const p = new Painter(s * 2, s * 2);
      const k = i / (FRAMES - 1);
      const r = Math.round(s * (0.45 + 0.55 * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.5)));
      const c = s;
      if (k < 0.85) {
        p.ellipse(c, c, r, r, k < 0.5 ? '#e0381a' : '#7a2a1a');
        p.ellipse(c, c, Math.round(r * 0.78), Math.round(r * 0.78), k < 0.5 ? '#ff8a1e' : '#c0481e');
        if (k < 0.6) p.ellipse(c, c, Math.round(r * 0.5), Math.round(r * 0.5), '#ffd23a');
        if (k < 0.3) p.ellipse(c, c, Math.round(r * 0.28), Math.round(r * 0.28), '#ffffff');
      } else {
        p.ctx.globalAlpha = 0.55;
        p.ellipse(c, c, r, r, '#4a3a38');
        p.ellipse(c, c, Math.round(r * 0.55), Math.round(r * 0.55), '#2a2020');
        p.ctx.globalAlpha = 1;
      }
      frames.push(p.canvas);
    }
    return frames;
  });
}

/** Paint the explosion frame sets now instead of at the first explosion. */
export function warmFx() {
  if (!booms) buildBooms();
}

export function drawFx(ctx, world, ox, oy) {
  if (!booms) buildBooms();
  for (const f of world.fx) {
    const x = Math.round(f.x - ox), y = Math.round(f.y - oy);
    switch (f.k) {
      case 'px': {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life / (f.max * 0.5)));
        ctx.fillStyle = f.col;
        ctx.fillRect(x, y, f.s, f.s);
        ctx.globalAlpha = 1;
        break;
      }
      case 'boom': {
        const set = booms[f.size] || booms[0];
        const idx = Math.min(FRAMES - 1, Math.floor((f.t / f.dur) * FRAMES));
        const img = set[idx];
        blit(ctx, img, x - img.width / 2, y - img.height / 2);
        break;
      }
      case 'ring': {
        const k = f.t / f.dur;
        const r = Math.round(4 + (f.r1 - 4) * k);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.col;
        // pixel ring: 4 arcs approximated by stepping angles
        const steps = Math.max(16, r * 2);
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 2, 2);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'text': {
        ctx.globalAlpha = Math.min(1, f.life / 0.3);
        drawText(ctx, f.text, x, y, f.col, 1, 'center', '#000000');
        ctx.globalAlpha = 1;
        break;
      }
      case 'warn': {
        // flashing floor marker: a bar and an arrow pointing at the spot, blinking faster as time runs out
        const rate = 6 + (1 - f.life / f.max) * 12;
        const on = Math.floor(f.t * rate) % 2 === 0;
        ctx.fillStyle = on ? '#ff3a2a' : '#ffd23a';
        ctx.fillRect(x - 9, y - 2, 19, 3);
        ctx.fillRect(x - 1, y - 12, 3, 8);
        ctx.fillRect(x - 3, y - 8, 7, 2);
        ctx.fillRect(x - 2, y - 6, 5, 2);
        break;
      }
      case 'zap': {
        // a jagged arc between two enemies, redrawn with fresh jitter every frame
        const dx = f.x1 - f.x0;
        const dy = f.y1 - f.y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const steps = Math.max(3, Math.round(len / 6));
        const tick = Math.floor(f.life * 60);
        let px = f.x0 - ox;
        let py = f.y0 - oy;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const j = i === steps ? 0 : ((tick * 5 + i * 11 + f.seed) % 7) - 3;
          const qx = f.x0 + dx * t + nx * j - ox;
          const qy = f.y0 + dy * t + ny * j - oy;
          lineTo(ctx, px, py, qx, qy, i % 2 ? '#ffffff' : '#7ac0ff', 1);
          px = qx;
          py = qy;
        }
        break;
      }
      case 'flash': {
        ctx.fillStyle = f.col;
        ctx.fillRect(x - 2, y - 2, 5, 5);
        break;
      }
      case 'muzzle': {
        // a bright core with a spike along the aim for the first frames, then a smaller one
        const big = f.life > f.max * 0.5;
        ctx.fillStyle = f.col;
        for (let i = 1, n = big ? 4 : 2; i <= n; i++) {
          ctx.fillRect(Math.round(x + f.dx * i * 2 - 1), Math.round(y + f.dy * i * 2 - 1), 2, 2);
        }
        if (big) {
          ctx.fillRect(Math.round(x - f.dy * 2 - 1), Math.round(y + f.dx * 2 - 1), 2, 2);
          ctx.fillRect(Math.round(x + f.dy * 2 - 1), Math.round(y - f.dx * 2 - 1), 2, 2);
        }
        ctx.fillStyle = '#ffffff';
        const r = big ? 2 : 1;
        ctx.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
        break;
      }
      case 'beam': {
        const k = f.t / f.dur;
        const w = Math.max(2, Math.round(14 * (1 - k)));
        ctx.globalAlpha = 0.55 * (1 - k * 0.6);
        ctx.fillStyle = '#bfeaff';
        ctx.fillRect(x - (w >> 1), y - 48, w, 48);
        ctx.globalAlpha = 1 - k * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 48, 2, 48);
        ctx.globalAlpha = 1;
        break;
      }
      case 'corpse': {
        const S = playerSprites();
        const img = S.ball[Math.floor(f.t * 12) % 4];
        blit(ctx, img, x - 12, y - 16, f.face < 0, false);
        break;
      }
      default:
    }
  }
}
