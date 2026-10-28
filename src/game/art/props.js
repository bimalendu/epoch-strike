// Set dressing: things that stand in the level but do nothing (ship masts, dragon prows, banners). A level lists them
// with `b.prop(kind, col, opts)`; they are drawn behind the enemies and the soldier, and sway with the world clock.

import { lineTo } from '../../engine/gfx.js';
import { shade } from './common.js';
import { TILE, VIEW_W } from '../constants.js';
import { PROPS_W13 } from './props_w13.js';

function mast(ctx, p, x, y, t) {
  const h = p.h || 150;
  ctx.fillStyle = '#4a2e18';
  ctx.fillRect(x - 2, y - h, 4, h);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 2, y - h, 1, h);
  // yard arm and a billowing striped sail
  ctx.fillStyle = '#4a2e18';
  ctx.fillRect(x - 31, y - h + 14, 62, 3);
  const top = y - h + 17;
  for (let i = 0; i < 11; i++) {
    const sway = Math.round(Math.sin(t * 1.6 + i * 0.6) * 2);
    ctx.fillStyle = i % 2 ? '#f0ead0' : '#b8302a';
    ctx.fillRect(x - 28 + i * 5, top, 5, 50 + sway + Math.round(Math.sin(i * 0.5) * 5));
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x - 28, top + 38, 55, 4);
  // a pennant and rigging down to the rails
  const fl = Math.round(Math.sin(t * 5) * 2);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x + 2, y - h - 2, 10 + fl, 3);
  ctx.fillRect(x + 2, y - h + 1, 6 + fl, 2);
  lineTo(ctx, x, y - h + 6, x - 46, y - 3, '#2a1a10', 1);
  lineTo(ctx, x, y - h + 6, x + 46, y - 3, '#2a1a10', 1);
}

// a carved dragon head on a curved post at the end of a longship (dir: +1 the head looks right, -1 left)
function prow(ctx, p, x, y, t) {
  const d = p.dir || 1;
  const r = (lx, ly, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(d > 0 ? x + lx : x - lx - w, y + ly, w, h);
  };
  const wood = '#6a4424';
  r(-2, -46, 5, 46, wood);
  r(-2, -46, 1, 46, '#9a6a38');
  r(0, -54, 5, 10, wood); // the neck curls out
  r(2, -62, 12, 9, wood); // the head
  r(2, -62, 12, 2, '#9a6a38');
  r(10, -58, 8, 4, wood); // snout
  r(10, -54, 7, 2, shade(wood, -0.4)); // jaw
  r(12, -55, 2, 2, '#f0ead0'); // fang
  r(6, -60, 2, 2, '#ffd23a'); // eye
  r(3, -67, 2, 6, '#f0ead0'); // horn
  r(-2, -50, 2, 3, '#b8302a');
  r(-1, -36 + Math.round(Math.sin(t * 2) * 1), 3, 3, '#ffd23a'); // gold studs
  r(-1, -24, 3, 3, '#ffd23a');
}

// a tall red silk banner on a pole, rippling
function banner(ctx, p, x, y, t) {
  const h = p.h || 64;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 1, y - h, 3, h);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x - 2, y - h - 3, 5, 3);
  for (let i = 0; i < 12; i++) {
    const wave = Math.round(Math.sin(t * 3 + i * 0.7) * (1 + i * 0.15));
    ctx.fillStyle = i % 4 === 3 ? '#8a1a1e' : '#c8282e';
    ctx.fillRect(x + 2 + i, y - h + 2 + wave, 1, 26);
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(x + 2 + i, y - h + 2 + wave + 26, 1, 2 + (i % 2));
  }
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x + 6, y - h + 11 + Math.round(Math.sin(t * 3 + 4) * 1), 4, 4);
  ctx.fillRect(x + 7, y - h + 9 + Math.round(Math.sin(t * 3 + 4) * 1), 2, 8);
}

// a stone lantern with a warm glow (the shadow castle's garden)
function lantern(ctx, p, x, y, t) {
  const h = p.h || 28;
  ctx.fillStyle = '#5a566a';
  ctx.fillRect(x - 2, y - h, 5, h);
  ctx.fillStyle = '#6e6a82';
  ctx.fillRect(x - 6, y - h - 8, 13, 3); // roof
  ctx.fillRect(x - 4, y - h - 11, 9, 3);
  ctx.fillRect(x - 2, y - h - 13, 5, 2);
  ctx.fillStyle = '#3a364a';
  ctx.fillRect(x - 5, y - h - 5, 11, 7); // the lamp box
  const f = Math.floor(t * 9 + x) % 3;
  ctx.fillStyle = f === 0 ? '#ffd88a' : '#ffb85a';
  ctx.fillRect(x - 3, y - h - 4, 7, 5);
  ctx.fillStyle = '#fff4c8';
  ctx.fillRect(x - 1, y - h - 3, 3, 3);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffb85a';
  ctx.fillRect(x - 14, y - h - 14, 29, 22);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#6e6a82';
  ctx.fillRect(x - 5, y - 3, 11, 3); // base
}

// a torii gate: two red pillars, a curved double lintel
function torii(ctx, p, x, y) {
  const h = p.h || 76;
  const w = p.w || 44;
  const red = '#b8262e';
  ctx.fillStyle = red;
  ctx.fillRect(x - w / 2, y - h, 6, h);
  ctx.fillRect(x + w / 2 - 6, y - h, 6, h);
  ctx.fillStyle = '#8a1a20';
  ctx.fillRect(x - w / 2, y - h, 2, h);
  ctx.fillRect(x + w / 2 - 6, y - h, 2, h);
  ctx.fillStyle = '#14141c';
  ctx.fillRect(x - w / 2 - 8, y - h - 6, w + 16, 6); // kasagi, the top beam
  ctx.fillRect(x - w / 2 - 12, y - h - 9, 8, 3);
  ctx.fillRect(x + w / 2 + 4, y - h - 9, 8, 3);
  ctx.fillStyle = red;
  ctx.fillRect(x - w / 2 - 2, y - h + 10, w + 4, 5); // nuki, the lower tie beam
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x - 3, y - h + 5, 7, 5); // the plaque
}

// a saguaro cactus: a trunk with two raised arms
function cactus(ctx, p, x, y) {
  const h = p.h || 34;
  ctx.fillStyle = '#2f7a3c';
  ctx.fillRect(x - 3, y - h, 7, h);
  ctx.fillRect(x - 11, y - h + 12, 4, 3);
  ctx.fillRect(x - 11, y - h + 6, 3, 9);
  ctx.fillRect(x + 7, y - h + 16, 4, 3);
  ctx.fillRect(x + 8, y - h + 8, 3, 11);
  ctx.fillRect(x - 7, y - h + 12, 4, 3);
  ctx.fillStyle = '#4aa056';
  ctx.fillRect(x - 3, y - h, 2, h);
  ctx.fillRect(x - 11, y - h + 6, 1, 9);
  ctx.fillRect(x + 8, y - h + 8, 1, 11);
  ctx.fillStyle = '#e8e0b0';
  for (let i = 4; i < h; i += 7) ctx.fillRect(x + 2, y - h + i, 1, 1);
}

// a roof hatch on a train car: a raised box with a plank lid (propped open when an outlaw is about)
function hatch(ctx, p, x, y) {
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x - 9, y - 6, 19, 6);
  ctx.fillStyle = '#6a4a30';
  ctx.fillRect(x - 8, y - 5, 17, 4);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(x - 8, y - 5, 17, 1);
  ctx.fillStyle = '#3a3a46';
  ctx.fillRect(x - 1, y - 6, 3, 2);
}

// a telegraph pole with two cross-arms and drooping wire
function pole(ctx, p, x, y) {
  const h = p.h || 70;
  ctx.fillStyle = '#4a2e18';
  ctx.fillRect(x - 1, y - h, 3, h);
  ctx.fillRect(x - 9, y - h + 4, 19, 2);
  ctx.fillRect(x - 6, y - h + 12, 13, 2);
  ctx.fillStyle = '#8a8a96';
  for (const dx of [-8, 0, 8]) ctx.fillRect(x + dx, y - h + 2, 1, 2);
  ctx.fillStyle = '#1a1a22';
  for (let i = -40; i <= 40; i++) ctx.fillRect(x + i, y - h + 6 + Math.round(((i * i) / 1600) * 6 * -1 + 6), 1, 1);
}

// a water tower: a barrel on four legs with a spout
function tower(ctx, p, x, y) {
  const h = p.h || 90;
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(x - 15, y - h + 24, 3, h - 24);
  ctx.fillRect(x + 13, y - h + 24, 3, h - 24);
  ctx.fillRect(x - 11, y - h + 24, 2, h - 24);
  ctx.fillRect(x + 9, y - h + 24, 2, h - 24);
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 15, y - 14 - i * 22, 31, 2);
  ctx.fillStyle = '#6a4424';
  ctx.fillRect(x - 17, y - h, 35, 26);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(x - 17, y - h, 35, 3);
  ctx.fillStyle = '#2a1a10';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 17, y - h + 5 + i * 6, 35, 1);
  ctx.fillStyle = '#4a4a56';
  ctx.fillRect(x + 18, y - h + 20, 10, 3);
  ctx.fillRect(x + 26, y - h + 20, 3, 10);
  ctx.fillStyle = '#3a3a46';
  ctx.fillRect(x - 19, y - h - 4, 39, 4);
}

// a great cog turning slowly behind the walkway
function gear(ctx, p, x, y, t) {
  const r = p.r || 22;
  const cy = y - (p.h || 40);
  const teeth = 10;
  const a0 = t * 0.5 * (p.dir || 1);
  ctx.fillStyle = '#2a2a34';
  for (let i = 0; i < teeth; i++) {
    const a = a0 + (i / teeth) * Math.PI * 2;
    const tx = Math.round(x + Math.cos(a) * (r + 3));
    const ty = Math.round(cy + Math.sin(a) * (r + 3));
    ctx.fillRect(tx - 3, ty - 3, 6, 6);
  }
  for (let yy = -r; yy <= r; yy++) {
    const half = Math.round(Math.sqrt(r * r - yy * yy));
    ctx.fillRect(x - half, cy + yy, half * 2 + 1, 1);
  }
  ctx.fillStyle = '#4a4a58';
  for (let yy = -r + 4; yy <= r - 4; yy++) {
    const half = Math.round(Math.sqrt((r - 4) * (r - 4) - yy * yy));
    ctx.fillRect(x - half, cy + yy, half * 2 + 1, 1);
  }
  ctx.fillStyle = '#2a2a34';
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * Math.PI) / 2;
    for (let k = 0; k < r - 4; k += 2) ctx.fillRect(Math.round(x + Math.cos(a) * k) - 1, Math.round(cy + Math.sin(a) * k) - 1, 3, 3);
  }
  ctx.fillStyle = '#c8a040';
  ctx.fillRect(x - 3, cy - 3, 7, 7);
}

// a standing steam pipe with a valve wheel and a pressure gauge
function pipes(ctx, p, x, y) {
  const h = p.h || 64;
  ctx.fillStyle = '#3a3a46';
  ctx.fillRect(x - 4, y - h, 9, h);
  ctx.fillStyle = '#6a6e7e';
  ctx.fillRect(x - 4, y - h, 3, h);
  ctx.fillStyle = '#c8a040';
  for (const yy of [8, 30, 52]) ctx.fillRect(x - 6, y - h + yy, 13, 3);
  ctx.fillStyle = '#c8282e';
  ctx.fillRect(x + 5, y - h + 18, 8, 2);
  ctx.fillRect(x + 8, y - h + 15, 2, 8);
  ctx.fillStyle = '#e8e8ee';
  ctx.fillRect(x - 3, y - h + 38, 7, 7);
  ctx.fillStyle = '#c8282e';
  ctx.fillRect(x, y - h + 40, 1, 3);
}

// a Czech hedgehog: three steel beams crossed, rusted at the joint
function hedgehog(ctx, p, x, y) {
  const c = '#4a4e52';
  lineTo(ctx, x - 7, y, x + 7, y - 13, c, 3);
  lineTo(ctx, x + 7, y, x - 7, y - 13, c, 3);
  lineTo(ctx, x, y - 1, x, y - 14, '#5a5e62', 3);
  ctx.fillStyle = '#8a4a2a';
  ctx.fillRect(x - 1, y - 8, 3, 3);
  ctx.fillStyle = '#7a8084';
  ctx.fillRect(x - 7, y - 1, 1, 1);
  ctx.fillRect(x + 6, y - 1, 1, 1);
}

// a coil of barbed wire between two stakes
function wire(ctx, p, x, y) {
  const w = p.w || 36;
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x - w / 2, y - 14, 2, 14);
  ctx.fillRect(x + w / 2 - 2, y - 14, 2, 14);
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < w - 4; k += 2) {
      const yy = y - 11 + i * 4 + (k % 4 === 0 ? 0 : 1);
      ctx.fillStyle = '#9a9aa2';
      ctx.fillRect(x - w / 2 + 2 + k, yy, 2, 1);
    }
    for (let k = 3; k < w - 4; k += 8) {
      ctx.fillStyle = '#c8c8d0';
      ctx.fillRect(x - w / 2 + k, y - 12 + i * 4, 1, 3);
    }
  }
}

// a stack of sandbags (p.w tiles of bags wide, two courses high)
function sandbags(ctx, p, x, y) {
  const n = p.n || 4;
  for (let row = 0; row < 2; row++) {
    const cnt = n - row;
    for (let i = 0; i < cnt; i++) {
      const bx = x - (cnt * 9) / 2 + i * 9;
      const by = y - 6 - row * 5;
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(bx, by, 9, 6);
      ctx.fillStyle = '#9a8a62';
      ctx.fillRect(bx + 1, by, 7, 5);
      ctx.fillStyle = '#b8a878';
      ctx.fillRect(bx + 1, by, 7, 1);
      ctx.fillStyle = '#7a6a48';
      ctx.fillRect(bx + 4, by + 2, 1, 2);
    }
  }
}

// a beached landing craft: a grey hull with its bow ramp down on the sand
function landing(ctx, p, x, y, t) {
  const d = p.dir || 1;
  const r = (lx, ly, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(d > 0 ? x + lx : x - lx - w, y + ly, w, h);
  };
  r(-60, -26, 66, 26, '#5a6068'); // hull
  r(-60, -26, 66, 3, '#7a8088');
  r(-60, -4, 66, 4, '#3a3e44');
  r(-52, -20, 2, 14, '#3a3e44');
  r(-40, -20, 2, 14, '#3a3e44');
  r(-28, -20, 2, 14, '#3a3e44');
  r(-14, -30, 18, 4, '#6a7078'); // wheelhouse
  r(-14, -38, 18, 8, '#4a5058');
  r(-12, -35, 5, 3, '#9ad0e8');
  r(6, -12, 22, 3, '#4a4e54'); // the ramp, down on the sand
  r(6, -12, 22, 1, '#7a8088');
  // spray
  const f = Math.round(Math.sin(t * 3) * 2);
  r(-66 + f, -3, 6, 2, '#e8f4ff');
  r(-62, -6 + f, 4, 2, '#c8e4f8');
}

export const PROPS = { hedgehog, wire, sandbags, landing, mast, prow, banner, lantern, torii, cactus, hatch, pole, tower, gear, pipes, ...PROPS_W13 };

/** Floor grates where steam vents erupt, always visible so the soldier knows where they are. */
export function drawVents(ctx, world, ox, oy) {
  for (const z of world.zones) {
    if (z.type !== 'vent') continue;
    const x = Math.round(z.x - ox);
    if (x < -20 || x > VIEW_W + 20) continue;
    const y = Math.round(z.floorY - oy);
    ctx.fillStyle = '#15151a';
    ctx.fillRect(x - 8, y - 2, 17, 3);
    ctx.fillStyle = '#6a6e7e';
    for (let i = -6; i <= 6; i += 3) ctx.fillRect(x + i, y - 2, 2, 2);
    // a lazy wisp between eruptions
    const ph = ((world.time * 0.8 + z.x * 0.01) % 1);
    ctx.globalAlpha = 0.35 * (1 - ph);
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(x - 2 + Math.round(Math.sin(world.time * 3 + z.x) * 2), y - 4 - Math.round(ph * 10), 4, 3);
    ctx.globalAlpha = 1;
  }
}

/** Rope-swing planks: a V of rope up to the anchor block, a line off the top of the screen, and the plank itself. */
export function drawSwings(ctx, world, ox, oy) {
  const list = world.platforms;
  if (!list || !list.length) return;
  for (const pl of list) {
    if (pl.kind !== 'swing') continue;
    const ax = Math.round(pl.ax - ox);
    const ay = Math.round(pl.ay - oy);
    if (ax < -140 || ax > VIEW_W + 140) continue;
    const x = Math.round(pl.x - ox);
    const y = Math.round(pl.y - oy);
    const rope = '#c8b080';
    const ropeD = '#6a5030';
    // up to the rigging: a stout line from the anchor off the top of the screen
    ctx.fillStyle = ropeD;
    ctx.fillRect(ax - 1, -4, 3, ay + 4);
    ctx.fillStyle = rope;
    ctx.fillRect(ax - 1, -4, 1, ay + 4);
    // the anchor block
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(ax - 4, ay - 3, 9, 7);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(ax - 3, ay - 2, 7, 2);
    ctx.fillStyle = '#aab2c0';
    ctx.fillRect(ax - 1, ay, 3, 3);
    // the two ropes down to the plank
    lineTo(ctx, ax, ay + 3, x + 4, y, ropeD, 2);
    lineTo(ctx, ax, ay + 3, x + pl.w - 4, y, ropeD, 2);
    lineTo(ctx, ax, ay + 3, x + 4, y, rope, 1);
    lineTo(ctx, ax, ay + 3, x + pl.w - 4, y, rope, 1);
    // the plank: boards with rope lashings and iron end caps
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(x, y, pl.w, 6);
    ctx.fillStyle = '#9a6a38';
    ctx.fillRect(x, y, pl.w, 2);
    ctx.fillStyle = '#6a4424';
    for (let k = 12; k < pl.w - 6; k += 12) ctx.fillRect(x + k, y + 2, 1, 4);
    ctx.fillStyle = rope;
    ctx.fillRect(x + 3, y - 1, 3, 7);
    ctx.fillRect(x + pl.w - 6, y - 1, 3, 7);
    ctx.fillStyle = '#6a7280';
    ctx.fillRect(x, y + 2, 2, 4);
    ctx.fillRect(x + pl.w - 2, y + 2, 2, 4);
  }
}

/** Draw every prop that is on screen. */
export function drawProps(ctx, world, ox, oy) {
  const list = world.level.props;
  if (!list || !list.length) return;
  for (const p of list) {
    if (p.x < ox - 80 || p.x > ox + VIEW_W + 80) continue;
    const fn = PROPS[p.kind];
    if (fn) fn(ctx, p, Math.round(p.x - ox), Math.round(p.y - oy), world.time || 0);
  }
}

export const PROP_TILE = TILE;
