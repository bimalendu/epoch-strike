// The soldier's hoverbike (Level 19): a low neon-blue bike on a cushion of light, with the soldier crouched on it.
// (x, y) = bottom centre of the hitbox in screen pixels. Everything is fillRect, mirrored by the facing.

import { lineTo } from '../../engine/gfx.js';

const HULL = '#1c2a46';
const HULL_L = '#34507c';
const HULL_D = '#0e1628';
const GLOW = '#4af0ff';

/** Draw the hoverbike with its rider. `aim` is the unit vector of the gun; `hp` the armour left (smoke when low). */
export function drawBike(ctx, x, y, face, aim, t, hp = 2, shoulder = null) {
  const s = face < 0 ? -1 : 1;
  const px = Math.round(x);
  const py = Math.round(y);
  // r(dx, dy, w, h): a rectangle given in bike-local coordinates (+x = the way it faces, -y = up), mirrored by the facing
  const r = (dx, dy, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(s > 0 ? px + dx : px - dx - w, py + dy, w, h);
  };
  const bob = Math.round(Math.sin(t * 0.9) * 1);
  // the cushion of light under the bike
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.3);
  r(-15, 0 + bob, 30, 2, GLOW);
  ctx.globalAlpha = 0.18;
  r(-11, 2 + bob, 22, 2, GLOW);
  ctx.globalAlpha = 1;
  // rear thruster flame
  const flick = Math.floor(t * 1.5) % 3;
  r(-24 - flick, -5 + bob, 7 + flick, 2, '#ff9a2a');
  r(-21 - flick, -4 + bob, 4 + flick, 1, '#ffee9a');
  // chassis
  r(-17, -7 + bob, 34, 5, HULL);
  r(-17, -7 + bob, 34, 1, HULL_L);
  r(-17, -3 + bob, 34, 1, HULL_D);
  r(-17, -6 + bob, 34, 1, GLOW); // the light strip along the flank
  r(14, -6 + bob, 6, 3, HULL); // the nose
  r(19, -5 + bob, 3, 2, HULL_L);
  r(21, -5 + bob, 2, 1, '#ffffff');
  // rear fin and the engine pod
  r(-17, -12 + bob, 5, 6, HULL_D);
  r(-17, -12 + bob, 5, 1, HULL_L);
  r(-13, -10 + bob, 9, 3, HULL_L);
  // the windscreen
  r(8, -11 + bob, 5, 4, '#2a6a9a');
  r(8, -11 + bob, 5, 1, '#9ae8ff');
  // the soldier, crouched low behind the screen: legs, torso, head with a red headband
  r(-4, -11 + bob, 7, 4, '#2a3a6a');
  r(-3, -17 + bob, 6, 6, '#3a5a9a');
  r(-3, -17 + bob, 6, 1, '#6a8ac8');
  r(-3, -23 + bob, 7, 7, '#1b1018');
  r(-6, -22 + bob, 3, 3, '#1b1018');
  r(-2, -22 + bob, 5, 5, '#e9a97a');
  r(-2, -19 + bob, 1, 2, '#b5784f');
  r(-2, -22 + bob, 5, 2, '#d92b2b');
  r(-1, -22 + bob, 3, 1, '#f05a4a');
  r(-5, -21 + bob, 3, 1, '#d92b2b');
  r(0, -19 + bob, 1, 1, '#f4f0f0');
  r(1, -19 + bob, 1, 1, '#1a1a1a');
  // the aimed gun
  const sh = shoulder || { x: px + s * 3, y: py - 14 };
  const sx = Math.round(sh.x);
  const sy = Math.round(sh.y) + bob;
  lineTo(ctx, sx, sy, sx + aim.x * 4, sy + aim.y * 4, '#e9a97a', 3);
  lineTo(ctx, sx + aim.x * 3, sy + aim.y * 3, sx + aim.x * 14, sy + aim.y * 14, '#2a2a30', 2);
  lineTo(ctx, sx + aim.x * 10, sy + aim.y * 10, sx + aim.x * 14, sy + aim.y * 14, '#8a8a96', 1);
  if (hp <= 1) {
    // a wounded bike trails smoke and sparks
    ctx.fillStyle = '#6a6a72';
    const k = Math.floor(t * 0.9) % 3;
    ctx.fillRect(px - s * 18 - k, py - 10 - k * 3, 3, 3);
    ctx.fillRect(px - s * 22 + k, py - 14 - k * 2, 2, 2);
    if (Math.floor(t * 1.4) % 2 === 0) {
      ctx.fillStyle = '#ffee6a';
      ctx.fillRect(px - s * 10, py - 8, 2, 2);
    }
  }
}

/** A parked hoverbike on its pad (the boarding point at the start of a skyway): the same bike, empty, with its light strip dim. */
export function drawParkedBike(ctx, x, y, t) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = HULL_D;
  ctx.fillRect(px - 20, py - 3, 40, 3);
  ctx.fillStyle = GLOW;
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2);
  ctx.fillRect(px - 20, py - 3, 40, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = HULL;
  ctx.fillRect(px - 15, py - 10, 30, 5);
  ctx.fillStyle = HULL_L;
  ctx.fillRect(px - 15, py - 10, 30, 1);
  ctx.fillStyle = GLOW;
  ctx.fillRect(px - 15, py - 9, 30, 1);
  ctx.fillStyle = HULL;
  ctx.fillRect(px + 12, py - 9, 6, 3);
  ctx.fillStyle = HULL_D;
  ctx.fillRect(px - 15, py - 15, 5, 6);
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(px + 6, py - 14, 5, 4);
  ctx.fillStyle = '#9ae8ff';
  ctx.fillRect(px + 6, py - 14, 5, 1);
}
