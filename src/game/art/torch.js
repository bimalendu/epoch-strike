// Wall torches (level.lights): an iron bracket with a flickering flame. Drawn on every level that has them.

import { Painter, blit } from '../../engine/gfx.js';

let frames = null;

function build() {
  const make = (f) => {
    const p = new Painter(9, 16);
    p.rect(3, 9, 3, 6, '#5a4630'); // handle
    p.rect(2, 8, 5, 2, '#2a2630'); // iron cup
    p.rect(3, 15, 3, 1, '#2a2630');
    const h = 6 + (f % 2);
    p.rect(3, 8 - h, 3, h, '#d8381a');
    p.rect(2, 7 - h + 3, 5, h - 2, '#d8381a');
    p.rect(3, 8 - h + 1, 3, h - 1, '#ff8a1e');
    p.rect(4, 8 - h + 3, 1, h - 3, '#ffe27a');
    if (f === 2) p.px(2, 1, '#ffb02e');
    if (f === 0) p.px(6, 2, '#ffb02e');
    return p.canvas;
  };
  return [make(0), make(1), make(2)];
}

export function drawTorches(ctx, world, ox, oy) {
  const list = world.level.lights;
  if (!list || !list.length) return;
  if (!frames) frames = build();
  const f = Math.floor(world.time * 9) % 3;
  for (const t of list) {
    const x = Math.round(t.x - ox) - 4;
    if (x < -10 || x > 490) continue;
    blit(ctx, frames[f], x, Math.round(t.y - oy) - 8);
  }
}
