// Draws a level's backdrop and terrain: sky, parallax scenery, a pre-rendered tile layer (rebuilt when tiles
// change), animated liquids and ambient particles. Pure functions of the world state, no simulation here.

import { Painter, createCanvas } from '../../engine/gfx.js';
import { hash2 } from '../../engine/rng.js';
import { TILE, VIEW_W, VIEW_H } from '../constants.js';
import { T, SOLID } from '../tiles.js';
import { getTheme } from './themes.js';
import { tileSprite, TOP, LEFT, RIGHT, BOTTOM } from './tilepaint.js';
import { sceneryLayer } from './scenery.js';
import { skyCanvas } from './sky.js';
import { shade } from './common.js';

const FILLED = new Uint8Array(16);
[T.SOLID, T.WALL, T.ICE, T.DOOR, T.CONV_R, T.CONV_L, T.QUICK].forEach((t) => (FILLED[t] = 1));
const DYNAMIC = new Uint8Array(16);
[T.WATER, T.LAVA].forEach((t) => (DYNAMIC[t] = 1));

// ---- decor sprites sitting on top of ground tiles ----
const DECOR = {
  tuft(p, c) {
    p.rect(1, 3, 1, 3, c); p.rect(3, 1, 1, 5, c); p.rect(5, 2, 1, 4, c); p.rect(7, 4, 1, 2, c);
    p.rect(3, 1, 1, 1, shade(c, 0.35));
  },
  flower(p, c) {
    p.rect(3, 3, 1, 4, '#3a8a3a'); p.rect(2, 1, 3, 3, c); p.rect(3, 2, 1, 1, '#ffffff');
  },
  pebbles(p, c) {
    p.rect(1, 3, 3, 2, c); p.rect(1, 3, 3, 1, shade(c, 0.3)); p.rect(5, 4, 2, 1, shade(c, -0.2));
  },
  bones(p, c) {
    p.rect(1, 3, 6, 1, c); p.rect(0, 2, 2, 3, c); p.rect(6, 2, 2, 3, c); p.rect(3, 1, 2, 2, c);
  },
  crystal(p, c) {
    p.rect(2, 2, 2, 5, c); p.rect(1, 4, 1, 3, shade(c, -0.25)); p.rect(4, 3, 1, 4, shade(c, -0.25));
    p.rect(2, 1, 1, 1, shade(c, 0.5)); p.px(2, 3, '#ffffff');
  },
  snowpile(p, c) {
    p.rect(1, 4, 6, 2, c); p.rect(2, 3, 4, 1, c); p.rect(1, 5, 6, 1, shade(c, -0.1));
  },
};
const decorCache = new Map();
function decorSprite(kind, color) {
  const key = `${kind}|${color}`;
  let c = decorCache.get(key);
  if (!c) {
    const p = new Painter(8, 7);
    (DECOR[kind] || DECOR.pebbles)(p, color);
    c = p.canvas;
    decorCache.set(key, c);
  }
  return c;
}

function filledAt(world, x, y) {
  if (x < 0 || x >= world.cols) return 1; // map edges read as continuing walls
  if (y < 0) return 0;
  if (y >= world.rows) return 1;
  return FILLED[world.tiles[y * world.cols + x]];
}

/** Paint one cell of the baked layer: its tile sprite (chosen by which neighbours are solid) and any decor on top. */
function paintCell(ctx, world, theme, seed, tx, ty) {
  const id = world.tiles[ty * world.cols + tx];
  if (!id || DYNAMIC[id]) return;
  let mask = 0;
  if (!filledAt(world, tx, ty - 1)) mask |= TOP;
  if (!filledAt(world, tx - 1, ty)) mask |= LEFT;
  if (!filledAt(world, tx + 1, ty)) mask |= RIGHT;
  if (!filledAt(world, tx, ty + 1)) mask |= BOTTOM;
  const v = Math.floor(hash2(tx, ty, seed) * 1000);
  ctx.drawImage(tileSprite(theme, id, mask, v, T), tx * TILE, ty * TILE);
  // decor on the exposed top of solid ground
  if (id === T.SOLID && mask & TOP && theme.decor) {
    const r = hash2(tx, ty, seed + 99);
    let acc = 0;
    for (const d of theme.decor) {
      acc += d.p;
      if (r < acc) {
        ctx.drawImage(decorSprite(d.k, d.c), tx * TILE + Math.floor(hash2(tx, 5, seed) * 6), ty * TILE - 6);
        break;
      }
    }
  }
}

/** Pre-render every static tile of the level into one canvas. */
export function buildTileLayer(world) {
  const theme = getTheme(world.level.theme);
  const w = world.cols * TILE;
  const h = world.rows * TILE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const seed = world.level.seed || 1;
  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) paintCell(ctx, world, theme, seed, tx, ty);
  }
  return canvas;
}

/** More changed tiles than this in one frame and a full rebuild is cheaper than patching. */
const PATCH_LIMIT = 48;

/**
 * Bring the baked layer up to date after tiles changed, repainting only the neighbourhood of each changed cell (a tile's
 * sprite depends on which of its four neighbours are solid, and decor sits on the tile above). Rising lava used to
 * rebuild the whole level canvas for every row it climbed.
 */
function patchTileLayer(world, canvas) {
  const theme = getTheme(world.level.theme);
  const ctx = canvas.getContext('2d');
  const seed = world.level.seed || 1;
  const cells = new Set();
  for (const idx of world.dirtyTiles) {
    const cx = idx % world.cols;
    const cy = Math.floor(idx / world.cols);
    // wipe the changed cell and the strip of the cell above that its decor reached into
    ctx.clearRect(cx * TILE, cy * TILE - 6, TILE, TILE + 6);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < world.cols && y >= 0 && y < world.rows) cells.add(y * world.cols + x);
      }
    }
  }
  // repaint in reading order so decor lands on top of the tile above it
  for (const idx of [...cells].sort((a, b) => a - b)) paintCell(ctx, world, theme, seed, idx % world.cols, Math.floor(idx / world.cols));
}

export function getTileLayer(world) {
  if (!world.tileLayer) {
    world.tileLayer = buildTileLayer(world);
    world.tilesDirty = false;
    world.dirtyTiles.length = 0;
  } else if (world.tilesDirty) {
    if (world.dirtyTiles.length > PATCH_LIMIT) world.tileLayer = buildTileLayer(world);
    else patchTileLayer(world, world.tileLayer);
    world.tilesDirty = false;
    world.dirtyTiles.length = 0;
  }
  return world.tileLayer;
}

// ---- backdrop ----
export function drawSky(ctx, theme) {
  ctx.drawImage(skyCanvas(theme), 0, 0);
}

export function drawParallax(ctx, theme, camX, camY, tall) {
  theme.layers.forEach((layer, i) => {
    const img = sceneryLayer(`${theme.id}:${i}`, layer, theme);
    const speed = layer.s || 0.1;
    let x = -Math.floor((camX * speed) % VIEW_W);
    if (x > 0) x -= VIEW_W;
    const y = tall ? -Math.floor(camY * speed * 0.6) : 0;
    for (let dx = x; dx < VIEW_W; dx += VIEW_W) ctx.drawImage(img, dx, y);
    if (y + VIEW_H < VIEW_H && layer.c) {
      ctx.fillStyle = layer.c;
      ctx.fillRect(0, y + VIEW_H, VIEW_W, VIEW_H);
    }
  });
}

export function drawTerrain(ctx, world, ox, oy) {
  const layer = getTileLayer(world);
  const sx = Math.max(0, ox);
  const sy = Math.max(0, oy);
  const sw = Math.min(VIEW_W, layer.width - sx);
  const sh = Math.min(VIEW_H, layer.height - sy);
  if (sw > 0 && sh > 0) ctx.drawImage(layer, sx, sy, sw, sh, sx - ox, sy - oy, sw, sh);
}

/** Water and lava: drawn live so their surface can move. */
export function drawLiquids(ctx, world, ox, oy) {
  const theme = getTheme(world.level.theme);
  const tx0 = Math.max(0, Math.floor(ox / TILE));
  const tx1 = Math.min(world.cols - 1, Math.floor((ox + VIEW_W) / TILE));
  const ty0 = Math.max(0, Math.floor(oy / TILE));
  const ty1 = Math.min(world.rows - 1, Math.floor((oy + VIEW_H) / TILE));
  const t = world.time;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = world.tiles[ty * world.cols + tx];
      if (!DYNAMIC[id]) continue;
      const pal = id === T.WATER ? theme.water : theme.lava;
      const above = ty > 0 ? world.tiles[(ty - 1) * world.cols + tx] : 0;
      const x = tx * TILE - ox;
      const y = ty * TILE - oy;
      const surface = above !== id;
      ctx.fillStyle = surface ? pal.base : pal.deep;
      ctx.fillRect(x, y, TILE, TILE);
      if (surface) {
        // wavy bright surface line
        ctx.fillStyle = pal.top;
        for (let i = 0; i < TILE; i += 2) {
          const wob = Math.round(Math.sin(t * 3 + (tx * TILE + i) * 0.35) * 1);
          ctx.fillRect(x + i, y + wob, 2, 2);
        }
        ctx.fillStyle = pal.base;
        ctx.fillRect(x, y + 3, TILE, 1);
      } else if (((tx * 7 + ty * 3 + Math.floor(t * 2)) & 3) === 0) {
        ctx.fillStyle = pal.base;
        ctx.fillRect(x + 4, y + 6, 6, 1);
      }
    }
  }
}

// ---- ambient particles: pure functions of time, so they need no state ----
export function drawAmbient(ctx, theme, camX, time) {
  const kind = theme.fx;
  if (!kind) return;
  const n = kind === 'rain' ? 70 : 34;
  for (let i = 0; i < n; i++) {
    const hx = hash2(i, 1, 5);
    const hy = hash2(i, 2, 5);
    const sp = 0.6 + hash2(i, 3, 5) * 0.8;
    let x;
    let y;
    switch (kind) {
      case 'snow':
        x = (hx * VIEW_W + time * 14 * sp - camX * 0.5 + 4000) % VIEW_W;
        y = (hy * VIEW_H + time * 28 * sp) % VIEW_H;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.floor(x + Math.sin(time + i) * 3), Math.floor(y), 2, 2);
        break;
      case 'rain':
        x = (hx * VIEW_W - time * 60 * sp - camX * 0.6 + 8000) % VIEW_W;
        y = (hy * VIEW_H + time * 330 * sp) % VIEW_H;
        ctx.fillStyle = '#bcd0e8';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 5);
        ctx.globalAlpha = 1;
        break;
      case 'embers':
        x = (hx * VIEW_W + Math.sin(time * 0.8 + i) * 10 - camX * 0.7 + 8000) % VIEW_W;
        y = VIEW_H - ((hy * VIEW_H + time * 40 * sp) % VIEW_H);
        ctx.fillStyle = i % 3 === 0 ? '#ffd23a' : '#ff6a1a';
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 2);
        break;
      case 'leaves':
        x = (hx * VIEW_W + time * 18 * sp - camX * 0.6 + 8000) % VIEW_W;
        y = (hy * VIEW_H + time * 22 * sp) % VIEW_H;
        ctx.fillStyle = i % 2 ? '#5aa84a' : '#8ac850';
        ctx.fillRect(Math.floor(x + Math.sin(time * 1.5 + i) * 4), Math.floor(y), 2, 1);
        break;
      case 'petals':
        x = (hx * VIEW_W + time * 20 * sp - camX * 0.6 + 8000) % VIEW_W;
        y = (hy * VIEW_H + time * 20 * sp) % VIEW_H;
        ctx.fillStyle = i % 2 ? '#ff9ac8' : '#ffd0e4';
        ctx.fillRect(Math.floor(x + Math.sin(time * 1.2 + i) * 5), Math.floor(y), 2, 2);
        break;
      default: // dust
        x = (hx * VIEW_W + time * 24 * sp - camX * 0.8 + 8000) % VIEW_W;
        y = (hy * VIEW_H * 0.8 + Math.sin(time + i) * 3) % VIEW_H;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        ctx.globalAlpha = 1;
    }
  }
}

export { SOLID };
