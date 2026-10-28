// Searchlights, the alarm and the sleeping guards' snores: the Arctic Missile Base's look (see stealth.js).

import { VIEW_W, VIEW_H, STEALTH } from '../constants.js';
import { drawText } from '../../engine/font.js';

/** The towers, the cones of light and the pools they make on the ground. Drawn under the characters. */
export function drawSearchlights(ctx, world, ox, oy) {
  for (const z of world.zones) {
    if (z.type !== 'searchlight') continue;
    const lx = z.lampX - ox;
    const ly = z.lampY - oy;
    const fy = z.floorY - oy;
    if (lx < -80 || lx > VIEW_W + 80 || (z.tx !== undefined && z.tx - ox < -80) || (z.tx !== undefined && z.tx - ox > VIEW_W + 80)) {
      // off screen: still draw the tower when it is near, the beam only when it is
      if (lx < -20 || lx > VIEW_W + 20) continue;
    }
    // the tower: a lattice mast with a lamp housing on top
    ctx.fillStyle = '#10161e';
    ctx.fillRect(Math.round(lx) - 2, Math.round(ly), 4, Math.round(fy - ly));
    ctx.fillStyle = '#3a4a5e';
    ctx.fillRect(Math.round(lx) - 2, Math.round(ly), 1, Math.round(fy - ly));
    for (let y = Math.round(ly) + 8; y < fy; y += 10) {
      ctx.fillStyle = '#2a3646';
      ctx.fillRect(Math.round(lx) - 4, y, 8, 1);
    }
    ctx.fillStyle = '#10161e';
    ctx.fillRect(Math.round(lx) - 6, Math.round(ly) - 5, 12, 7);
    ctx.fillStyle = '#5a6a80';
    ctx.fillRect(Math.round(lx) - 6, Math.round(ly) - 5, 12, 1);
    if (z.tx === undefined) continue;
    const tx = z.tx - ox;
    const R = z.radius ?? STEALTH.RADIUS;
    const hot = z.lit || (z.meter || 0) > 0.05;
    // the cone, drawn as one-pixel scanlines from the lamp down to the pool
    const h = Math.max(1, fy - ly);
    ctx.fillStyle = hot ? '#ffd8b0' : '#f4f0d0';
    ctx.globalAlpha = hot ? 0.2 : 0.14;
    for (let y = Math.round(ly); y < Math.round(fy); y++) {
      const k = (y - ly) / h;
      const cx = lx + (tx - lx) * k;
      const half = 1 + R * k;
      ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
    }
    // the pool of light on the ground: a bright flattened ellipse
    ctx.globalAlpha = hot ? 0.42 : 0.3;
    ctx.fillStyle = hot ? '#fff0d8' : '#fffbe0';
    for (let dy = -4; dy <= 2; dy++) {
      const half = Math.round(R * Math.sqrt(Math.max(0, 1 - (dy * dy) / 20)));
      ctx.fillRect(Math.round(tx - half), Math.round(fy) + dy - 1, half * 2, 1);
    }
    ctx.globalAlpha = 1;
  }
}

/** "Zzz" over every guard that has not been woken. */
export function drawSleepers(ctx, world, ox, oy) {
  for (const e of world.enemies) {
    if (!e.alive || !e.spec.sleeper || e.woke) continue;
    const x = Math.round(e.x - ox) + 4;
    const y = Math.round(e.y - e.h - oy) - 2;
    if (x < -10 || x > VIEW_W + 10) continue;
    const ph = (world.time * 0.9 + e.x * 0.05) % 1;
    for (let i = 0; i < 3; i++) {
      const k = (ph + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      drawText(ctx, 'Z', x + Math.round(k * 7), y - Math.round(k * 12) - 4, '#e8f4ff', i === 0 ? 1 : 1, 'left', '#000000');
    }
    ctx.globalAlpha = 1;
  }
}

/** The meter over the soldier while the light is on them, and the red pulse of an alarm. Drawn over everything. */
export function drawAlarm(ctx, world, ox, oy) {
  const p = world.player;
  let meter = 0;
  for (const z of world.zones) if (z.type === 'searchlight' && (z.meter || 0) > meter) meter = z.meter;
  if (p.alive && meter > 0.03) {
    const f = Math.min(1, meter / STEALTH.SPOT_TIME);
    const x = Math.round(p.x - ox);
    const by = Math.round(p.spriteTop() - oy) - 9;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 9, by - 1, 18, 5);
    ctx.fillStyle = f > 0.7 ? '#ff3a2a' : '#ffd23a';
    ctx.fillRect(x - 8, by, Math.round(16 * f), 3);
    drawText(ctx, '!', x, by - 9, f > 0.7 ? '#ff3a2a' : '#ffd23a', 1, 'center', '#000000');
  }
  if (world.alarmT > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 9);
    const a = Math.min(1, world.alarmT / 1.0);
    ctx.globalAlpha = (0.1 + 0.12 * pulse) * a;
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(0, 0, VIEW_W, 5);
    ctx.fillRect(0, VIEW_H - 5, VIEW_W, 5);
    ctx.fillRect(0, 0, 5, VIEW_H);
    ctx.fillRect(VIEW_W - 5, 0, 5, VIEW_H);
    ctx.globalAlpha = 1;
    if (Math.floor(world.time * 3) % 2 === 0) drawText(ctx, 'ALARM', VIEW_W / 2, 48, '#ff4a4a', 1, 'center', '#000000');
  }
}

/** The laser emitters of the Cyber Megacity: a housing on the ceiling or the road, charging a glow before it fires. */
export function drawEmitters(ctx, world, ox, oy) {
  for (const z of world.zones) {
    if (z.type !== 'beam') continue;
    const x = Math.round(z.x - ox);
    if (x < -20 || x > VIEW_W + 20) continue;
    const y = Math.round(z.y - oy);
    const down = z.dir > 0;
    const col = z.col || '#ff4ad8';
    const charge = z.t !== undefined && z.t > z.period - (z.tele ?? 0.9); // the mark is flashing: the beam is coming
    ctx.fillStyle = '#14141f';
    ctx.fillRect(x - 7, down ? y : y - 6, 14, 6);
    ctx.fillStyle = '#4a4a6a';
    ctx.fillRect(x - 7, down ? y : y - 6, 14, 1);
    ctx.fillStyle = charge && Math.floor(world.time * 16) % 2 ? '#ffffff' : col;
    ctx.fillRect(x - 3, down ? y + 4 : y - 6, 6, 2);
  }
}
