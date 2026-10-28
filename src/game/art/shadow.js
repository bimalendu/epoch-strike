// Contact shadows: two thin translucent rows under whatever is standing on the ground.

import { TILE } from '../constants.js';

/** Does `e` stand on the floor (and so cast a shadow)? Flyers, swimmers and ceiling-walkers do not. */
function stands(e) {
  return e.alive && !e.hidden && e.grounded && !e.def.flyer && !e.def.noShadow && e.gdir > 0;
}

function shadow(ctx, x, y, w) {
  const half = Math.min(w, TILE * 5) >> 1;
  ctx.fillRect(x - half, y, half * 2, 1);
  ctx.fillRect(x - half + 2, y + 1, half * 2 - 4, 1);
}

/** Draw every shadow of a frame (call before the sprites, so they stand on top of it). */
export function drawShadows(ctx, world, ox, oy) {
  const p = world.player;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.3;
  if (p.alive && p.grounded && p.mode !== 'fly') shadow(ctx, Math.round(p.x - ox), Math.round(p.y - oy), p.mode === 'tank' ? 28 : 12);
  for (const e of world.enemies) if (stands(e)) shadow(ctx, Math.round(e.x - ox), Math.round(e.y - oy), e.w);
  ctx.globalAlpha = 1;
}
