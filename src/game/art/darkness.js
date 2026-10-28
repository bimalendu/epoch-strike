// Dark levels (the caves): the whole frame is covered by a dark veil that thins out around light sources.
// Lights come from the player (a small lantern glow that flares when shooting), bullets, explosions, burning
// enemies, torches, glowing creatures, pickups, checkpoints, lava and spikes. The veil is drawn as coarse 4 px
// cells merged into runs so it stays cheap, and it never goes fully black so silhouettes stay readable.

import { VIEW_W, VIEW_H, TILE } from '../constants.js';
import { T } from '../tiles.js';

const CELL = 4;
const COLS = VIEW_W / CELL;
const ROWS = Math.ceil(VIEW_H / CELL);
const LEVELS = 8; // quantised veil strengths
const VEIL = '#03040b';
export const MAX_DARK = 0.82;

const grid = new Float32Array(COLS * ROWS);

// radius (px) of the light a player bullet casts, by kind
const BULLET_LIGHT = { plasma: 34, tesla: 30, crossbow: 20, ballista: 22, spear: 46, flame: 38, laser: 30, homing: 28, spread: 18, mg: 14, rifle: 16 };

/** Collect lights in screen coordinates: [{ x, y, r, i }] where i is the peak brightness 0..1. */
export function collectLights(world, ox, oy) {
  const out = [];
  const add = (x, y, r, i = 1) => {
    const sx = x - ox;
    const sy = y - oy;
    if (sx < -r || sx > VIEW_W + r || sy < -r || sy > VIEW_H + r) return;
    out.push({ x: sx, y: sy, r, i });
  };
  const p = world.player;
  if (p.alive) {
    // the lantern glow flares with every shot and fades over about a fifth of a second
    const pulse = world.lightPulse || 0;
    add(p.x, p.y - 14, 44 + 56 * pulse, 1);
  }
  for (const b of world.bullets) add(b.x, b.y, BULLET_LIGHT[b.kind] || 16, 0.95);
  for (const b of world.ebullets) add(b.x, b.y, b.kind === 'fire' || b.kind === 'flame' ? 30 : 17, 0.9);
  for (const f of world.fx) {
    if (f.k === 'boom') add(f.x, f.y, 34 + f.size * 22, Math.max(0, 1 - f.t / f.dur));
    else if (f.k === 'flash') add(f.x, f.y, 40, 0.9);
    else if (f.k === 'ring') add(f.x, f.y, 22, 0.5);
  }
  for (const e of world.enemies) {
    if (!e.alive || e.hidden) continue;
    if (e.burnT > 0) add(e.x, e.cy, 36, 0.9);
    else add(e.x, e.cy, e.def.boss ? 70 : (e.def.glow ?? 18) + 8, e.def.boss ? 0.85 : 0.75); // glowing eyes: nothing hides in the dark
  }
  for (const pk of world.pickups) add(pk.x, pk.y - 6, 20, 0.8);
  const L = world.level;
  if (L.lights) {
    const flick = 1 + Math.sin(world.time * 11) * 0.04 + Math.sin(world.time * 23.7) * 0.03;
    for (const t of L.lights) add(t.x, t.y, (t.r || 56) * flick, 1);
  }
  if (L.checkpoints) for (const c of L.checkpoints) add(c.x, c.y - 10, 38, 0.8);
  // hazards glow a little so a pit of spikes or lava is never a surprise
  const x0 = Math.floor(ox / TILE);
  const y0 = Math.max(0, Math.floor(oy / TILE));
  const x1 = Math.ceil((ox + VIEW_W) / TILE);
  const y1 = Math.min(world.rows - 1, Math.ceil((oy + VIEW_H) / TILE));
  let glow = 0;
  for (let ty = y0; ty <= y1 && glow < 40; ty++) {
    for (let tx = x0; tx <= x1 && glow < 40; tx++) {
      const t = world.tile(tx, ty);
      if (t === T.LAVA) {
        if (world.tile(tx, ty - 1) !== T.LAVA) { add(tx * TILE + 8, ty * TILE + 4, 26, 0.85); glow++; }
      } else if (t === T.SPIKE && (tx & 1) === 0) {
        add(tx * TILE + 8, ty * TILE + 8, 15, 0.5);
        glow++;
      }
    }
  }
  return out;
}

/** Fill the light grid: 0 = dark .. 1 = fully lit. */
export function lightGrid(lights) {
  grid.fill(0);
  for (const l of lights) {
    const cx0 = Math.max(0, Math.floor((l.x - l.r) / CELL));
    const cx1 = Math.min(COLS - 1, Math.ceil((l.x + l.r) / CELL));
    const cy0 = Math.max(0, Math.floor((l.y - l.r) / CELL));
    const cy1 = Math.min(ROWS - 1, Math.ceil((l.y + l.r) / CELL));
    const r2 = l.r * l.r;
    for (let cy = cy0; cy <= cy1; cy++) {
      const dy = cy * CELL + CELL / 2 - l.y;
      for (let cx = cx0; cx <= cx1; cx++) {
        const dx = cx * CELL + CELL / 2 - l.x;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const k = 1 - d2 / r2; // 1 at the centre, 0 at the edge
        const v = Math.min(1, k * 1.35) * l.i;
        const idx = cy * COLS + cx;
        if (v > grid[idx]) grid[idx] = v;
      }
    }
  }
  return grid;
}

export function drawDarkness(ctx, world, ox, oy) {
  const g = lightGrid(collectLights(world, ox, oy));
  ctx.fillStyle = VEIL;
  for (let cy = 0; cy < ROWS; cy++) {
    let runStart = 0;
    let runQ = -1;
    for (let cx = 0; cx <= COLS; cx++) {
      const q = cx < COLS ? Math.round((1 - g[cy * COLS + cx]) * (LEVELS - 1)) : -2;
      if (q !== runQ) {
        if (runQ > 0) {
          ctx.globalAlpha = (runQ / (LEVELS - 1)) * MAX_DARK;
          ctx.fillRect(runStart * CELL, cy * CELL, (cx - runStart) * CELL, CELL);
        }
        runStart = cx;
        runQ = q;
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Brightness 0..1 of the screen point (sx, sy) under the veil: what the tests look at. */
export function brightnessAt(world, ox, oy, sx, sy) {
  const g = lightGrid(collectLights(world, ox, oy));
  return g[Math.floor(sy / CELL) * COLS + Math.floor(sx / CELL)];
}
