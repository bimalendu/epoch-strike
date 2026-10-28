// Draws a World to a canvas context. Kept separate from the simulation so tests can run without it.

import { VIEW_W, VIEW_H, PLAYER } from './constants.js';
import { drawPlayer } from './art/player.js';
import { drawTank } from './art/tank.js';
import { drawBike } from './art/bike.js';
import { drawSearchlights, drawSleepers, drawAlarm, drawEmitters } from './art/stealth.js';
import { drawEnemy, drawEnemyBullet } from './art/enemies.js';
import { drawBullet } from './art/bullets.js';
import { drawFx } from './art/fx.js';
import { drawPickup } from './art/pickups.js';
import { getTheme } from './art/themes.js';
import { drawDarkness } from './art/darkness.js';
import { drawTorches } from './art/torch.js';
import { drawProps, drawSwings, drawVents } from './art/props.js';
import { drawSky, drawParallax, drawTerrain, drawLiquids, drawAmbient } from './art/tilelayer.js';

export function renderWorld(ctx, world) {
  const cam = world.camera;
  const ox = cam.rx, oy = cam.ry;

  const theme = getTheme(world.level.theme);
  drawSky(ctx, theme);
  drawParallax(ctx, theme, cam.x, cam.y, cam.tall);
  drawTerrain(ctx, world, ox, oy);
  drawLiquids(ctx, world, ox, oy);
  drawProps(ctx, world, ox, oy);
  drawSwings(ctx, world, ox, oy);
  drawVents(ctx, world, ox, oy);
  drawSearchlights(ctx, world, ox, oy);
  drawEmitters(ctx, world, ox, oy);

  drawTorches(ctx, world, ox, oy);
  for (const pk of world.pickups) drawPickup(ctx, pk, ox, oy);
  for (const e of world.enemies) if (e.alive && !e.hidden) drawEnemy(ctx, e, ox, oy);
  drawSleepers(ctx, world, ox, oy);
  if (world.player.alive) {
    const p = world.player;
    const blink = p.invuln > 0 && p.barrier <= 0 && Math.floor(p.invuln * 15) % 2 === 0;
    // on a chariot ride the soldier stands on a car, a few pixels above the road
    const ride = world.chariot && !p.prone;
    if (ride) drawRideCar(ctx, p, ox, oy, world.time);
    if (!blink && p.mode === 'tank') drawTank(ctx, p.x - ox, p.y - oy, p.face, p.aimVec(), p.anim * 0.5, p.tankHp, true, p.grounded && Math.abs(p.vx) > 1);
    else if (!blink && p.mode === 'fly') drawBike(ctx, p.x - ox, p.y - oy, p.face, p.aimVec(), p.anim, p.bikeHp, { x: p.x - ox + p.face * 3, y: p.y - oy - 14 });
    else if (!blink) drawPlayer(ctx, p, ox, oy + (ride ? RIDE_LIFT : 0));
    if (p.barrier > 0 && (p.barrier > 2 || Math.floor(p.barrier * 8) % 2 === 0)) drawBarrier(ctx, p, ox, oy, world.time);
  }
  if (world.player.alive) drawQuicksand(ctx, world.player, ox, oy);
  for (const b of world.bullets) drawBullet(ctx, b, ox, oy);
  for (const b of world.ebullets) drawEnemyBullet(ctx, b, ox, oy);
  drawFx(ctx, world, ox, oy);
  drawAlarm(ctx, world, ox, oy);
  if (theme.dark) drawDarkness(ctx, world, ox, oy);
  drawAmbient(ctx, theme, cam.x, world.time);
  if (world.bombFlash > 0) {
    ctx.globalAlpha = Math.min(1, world.bombFlash * 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}

const RIDE_LIFT = 7;

/** The war chariot the soldier rides during a 'chariot' zone: a red car on two spoked wheels (cosmetic). */
function drawRideCar(ctx, p, ox, oy, time) {
  const x = Math.round(p.x - ox);
  const floor = Math.round((p.grounded ? p.y : (p.safeY ?? p.y)) - oy);
  const top = floor - RIDE_LIFT;
  ctx.fillStyle = '#5a1a1a';
  ctx.fillRect(x - 15, top, 30, 5);
  ctx.fillStyle = '#8a2a2a';
  ctx.fillRect(x - 15, top, 30, 3);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x - 15, top + 3, 30, 1);
  ctx.fillRect(x - 17, top - 5, 3, 9); // rear rail
  ctx.fillStyle = '#7a5a2a';
  ctx.fillRect(x + 15, top + 1, 8, 2); // yoke pole out front
  for (const wx of [-9, 9]) {
    const cx = x + wx;
    const cy = floor - 6;
    ctx.fillStyle = '#2a1a10';
    for (let dy = -6; dy <= 6; dy++) {
      const half = Math.round(Math.sqrt(36 - dy * dy));
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    ctx.fillStyle = '#8a6a3a';
    for (let dy = -4; dy <= 4; dy++) {
      const half = Math.round(Math.sqrt(16 - dy * dy));
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    ctx.fillStyle = '#2a1a10';
    const a = time * 14 + (wx > 0 ? 0.6 : 0);
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * Math.PI) / 3;
      for (let t = -4; t <= 4; t += 2) ctx.fillRect(Math.round(cx + Math.cos(ang) * t), Math.round(cy + Math.sin(ang) * t), 1, 1);
    }
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(cx, cy, 1, 1);
  }
}

/** Sand up to the soldier's thighs, and a drowning meter that fills while they stand in it. */
function drawQuicksand(ctx, p, ox, oy) {
  if (!p.inQuick && p.quickT <= 0.05) return;
  const x = Math.round(p.x - ox);
  const y = Math.round(p.y - oy);
  if (p.inQuick) {
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(x - 9, y - 9, 18, 9);
    ctx.fillStyle = '#e8c878';
    ctx.fillRect(x - 9, y - 9, 18, 2);
    ctx.fillStyle = '#a07a38';
    ctx.fillRect(x - 6, y - 5, 4, 1);
    ctx.fillRect(x + 1, y - 3, 5, 1);
  }
  if (p.quickT > 0.4) {
    const f = Math.min(1, p.quickT / PLAYER.QUICK_DROWN);
    const by = Math.round(p.spriteTop() - oy) - 7;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 9, by - 1, 18, 5);
    ctx.fillStyle = f > 0.7 ? '#ff3a2a' : '#ffd23a';
    ctx.fillRect(x - 8, by, Math.round(16 * f), 3);
  }
}

/** The B pickup's shield: a shimmering bubble round the soldier. */
function drawBarrier(ctx, p, ox, oy, time) {
  const cx = Math.round(p.x - ox);
  const cy = Math.round(p.y - oy - 14);
  const r = 17;
  ctx.fillStyle = '#6ac4ff';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + time * 3;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2 + time * 8);
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * (r + 2)), 2, 2);
  }
  ctx.globalAlpha = 0.15;
  ctx.fillRect(cx - 9, cy - 13, 19, 27);
  ctx.globalAlpha = 1;
}
