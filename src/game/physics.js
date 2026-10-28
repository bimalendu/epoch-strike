// Axis-separated AABB movement against the tile grid, one-way platforms and moving platforms.
// A body is { x (centre), y (bottom/feet), w, h, vx, vy, gdir (+1 gravity down, -1 up) }.

import { TILE } from './constants.js';
import { SOLID, ONEWAY } from './tiles.js';

const EPS = 0.001;

/**
 * Move a body by its velocity and resolve collisions.
 * Sets: grounded (standing on a surface in the gravity direction), hitWall (-1/0/1), hitCeil, platform.
 */
export function moveBody(world, b, dt) {
  const gdir = b.gdir || 1;
  b.prevX = b.x;
  b.prevY = b.y;
  b.hitWall = 0;
  b.hitCeil = false;
  b.grounded = false;
  b.platform = null;

  // ---- X ----
  b.x += b.vx * dt;
  if (b.vx !== 0) {
    const hw = b.w / 2;
    const top = b.y - b.h;
    const ty0 = Math.floor(top / TILE);
    const ty1 = Math.floor((b.y - EPS) / TILE);
    if (b.vx > 0) {
      const tx = Math.floor((b.x + hw - EPS) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (SOLID[world.tile(tx, ty)]) {
          b.x = tx * TILE - hw;
          b.vx = 0;
          b.hitWall = 1;
          break;
        }
      }
    } else {
      const tx = Math.floor((b.x - hw) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (SOLID[world.tile(tx, ty)]) {
          b.x = (tx + 1) * TILE + hw;
          b.vx = 0;
          b.hitWall = -1;
          break;
        }
      }
    }
  }

  // ---- Y ----
  b.y += b.vy * dt;
  const hw = b.w / 2;
  const tx0 = Math.floor((b.x - hw) / TILE);
  const tx1 = Math.floor((b.x + hw - EPS) / TILE);

  if (b.vy > 0) {
    const ty = Math.floor((b.y - EPS) / TILE);
    let landed = false;
    for (let tx = tx0; tx <= tx1 && !landed; tx++) {
      const t = world.tile(tx, ty);
      if (SOLID[t]) landed = true;
      else if (ONEWAY[t] && gdir === 1 && !b.drop && b.prevY <= ty * TILE + 0.01 && b.y > ty * TILE) landed = true;
    }
    if (landed) {
      b.y = ty * TILE;
      b.vy = 0;
      if (gdir === 1) b.grounded = true;
      else b.hitCeil = true;
    } else if (gdir === 1 && world.platforms && world.platforms.length) {
      landOnPlatforms(world, b);
    }
  } else if (b.vy < 0) {
    const ty = Math.floor((b.y - b.h) / TILE);
    let hit = false;
    for (let tx = tx0; tx <= tx1 && !hit; tx++) if (SOLID[world.tile(tx, ty)]) hit = true;
    if (hit) {
      b.y = (ty + 1) * TILE + b.h;
      b.vy = 0;
      if (gdir === -1) b.grounded = true;
      else b.hitCeil = true;
    }
  } else if (gdir === 1 && world.platforms && world.platforms.length) {
    landOnPlatforms(world, b);
  }
}

function landOnPlatforms(world, b) {
  if (b.drop) return;
  const hw = b.w / 2;
  for (const p of world.platforms) {
    if (b.x + hw <= p.x || b.x - hw >= p.x + p.w) continue;
    const prevTop = p.prevY !== undefined ? p.prevY : p.y;
    if (b.prevY <= prevTop + 1 && b.y >= p.y - 0.01 && b.y <= p.y + 10) {
      b.y = p.y;
      b.vy = 0;
      b.grounded = true;
      b.platform = p;
      return;
    }
  }
}

/** True if the rectangle overlaps any solid tile. */
export function rectSolid(world, l, t, r, b) {
  const tx0 = Math.floor(l / TILE), tx1 = Math.floor((r - EPS) / TILE);
  const ty0 = Math.floor(t / TILE), ty1 = Math.floor((b - EPS) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) if (SOLID[world.tile(tx, ty)]) return true;
  }
  return false;
}

/** True if the rectangle overlaps any tile whose property table entry is set. */
export function rectHas(world, table, l, t, r, b) {
  const tx0 = Math.floor(l / TILE), tx1 = Math.floor((r - EPS) / TILE);
  const ty0 = Math.floor(t / TILE), ty1 = Math.floor((b - EPS) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) if (table[world.tile(tx, ty)]) return true;
  }
  return false;
}

export function overlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}
