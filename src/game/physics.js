// Axis-separated AABB movement against the tile grid, one-way platforms and moving platforms.
// A body is { x (centre), y (bottom/feet), w, h, vx, vy, gdir (+1 gravity down, -1 up) }.

import { TILE } from './constants.js';
import { SOLID, ONEWAY, SLOPE, STEEP, floorHeight, uphillDir } from './tiles.js';

const EPS = 0.001;
/** A grounded body walks up a lip or a slope cell edge this many px tall without being stopped. */
export const SLOPE_STEP = 8;
/** The tallest lip a body can walk up on a slope, and (+1) the furthest it follows the ground down: a wide body (the tank) overlaps higher ground sooner than the soldier does. */
const stepFor = (b) => Math.max(SLOPE_STEP, b.w / 2 + 2);
/** Horizontal speed (px/s) at which a body slides down a steep slope. */
export const STEEP_SLIDE = 110;

/**
 * The ground surface at pixel column `px` near the feet at `py`: scans the cell above the feet, the feet cell and the cell
 * below for the first slope with a surface there, or solid tile. Returns { id, tx, ty, y } (the tile and its cell) with y the surface in world px, or
 * null when there is nothing within reach. Ramps are not solid tiles, so the answer for them is the line across the cell.
 */
export function surfaceAt(world, px, py) {
  const tx = Math.floor(px / TILE);
  const local = px - tx * TILE;
  const row0 = Math.floor((py - EPS) / TILE) - 1;
  for (let ty = row0; ty <= row0 + 2; ty++) {
    const t = world.tile(tx, ty);
    if (SLOPE[t]) {
      const h = floorHeight(t, local);
      if (h > 0) return { id: t, tx, ty, y: (ty + 1) * TILE - h };
    } else if (SOLID[t]) {
      return { id: t, tx, ty, y: ty * TILE };
    }
  }
  return null;
}

/** Is the point inside solid ground? A slope tile is solid below its line and empty above it. */
export function solidPoint(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const t = world.tile(tx, ty);
  if (SLOPE[t]) return (ty + 1) * TILE - y <= floorHeight(t, x - tx * TILE);
  return !!SOLID[t];
}

/** Is there footing at pixel column `px` for a body standing at feet height `py`: a solid or one-way tile, or a nearby slope. */
export function floorNear(world, px, py) {
  const t = world.tile(Math.floor(px / TILE), Math.floor((py + 2) / TILE));
  if (SOLID[t] || ONEWAY[t]) return true;
  if (!world.hasSlopes) return false;
  const s = surfaceAt(world, px, py);
  return !!s && s.y - py <= SLOPE_STEP + 2 && py - s.y <= TILE;
}

/**
 * Move a body by its velocity and resolve collisions.
 * Sets: grounded (standing on a surface in the gravity direction), hitWall (-1/0/1), hitCeil, platform.
 */
export function moveBody(world, b, dt) {
  const gdir = b.gdir || 1;
  // Everything slope-related is gated here: a level without slopes takes none of those branches.
  const slopes = !!world.hasSlopes && gdir === 1 && b.mode !== 'fly';
  const wasGrounded = b.grounded === true;
  if (slopes && wasGrounded && b.vy >= 0) slideDownSteep(world, b);
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
    // a body standing on a slope walks up the lip where the slope meets level ground instead of treating it as a wall
    const lip = slopes && wasGrounded && b.onSlope;
    const step = stepFor(b);
    if (b.vx > 0) {
      const tx = Math.floor((b.x + hw - EPS) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (SOLID[world.tile(tx, ty)] && !(lip && ty === ty1 && b.y - ty * TILE <= step)) {
          b.x = tx * TILE - hw;
          b.vx = 0;
          b.hitWall = 1;
          break;
        }
      }
    } else {
      const tx = Math.floor((b.x - hw) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (SOLID[world.tile(tx, ty)] && !(lip && ty === ty1 && b.y - ty * TILE <= step)) {
          b.x = (tx + 1) * TILE + hw;
          b.vx = 0;
          b.hitWall = -1;
          break;
        }
      }
    }
  }

  if (slopes && b.vx !== 0 && !b.hitWall) walkIntoSlope(world, b);

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
  if (slopes) settleOnSlope(world, b, wasGrounded);
}

/** A grounded body on a steep slope is pulled down it: input can only add to the slide, never fight it. */
function slideDownSteep(world, b) {
  const s = surfaceAt(world, b.x, b.y);
  if (!s || !STEEP[s.id] || Math.abs(b.y - s.y) > 4) return;
  const down = -uphillDir(s.id);
  if (b.vx * down < STEEP_SLIDE) b.vx = down * STEEP_SLIDE;
}

/**
 * After the horizontal move, resolve the body against the slope under it. A shallow slope (or a steep one entered from above)
 * lifts the feet onto the surface; walking into a steep slope uphill, or into a slope too tall to step on, is a wall.
 */
function walkIntoSlope(world, b) {
  const dir = Math.sign(b.vx);
  const lead = surfaceAt(world, b.x + dir * (b.w / 2), b.y);
  if (lead && STEEP[lead.id] && b.y - lead.y > 1 && dir === uphillDir(lead.id)) return blockBySlope(b, dir);
  const s = surfaceAt(world, b.x, b.y);
  if (!s || !SLOPE[s.id]) return;
  const pen = b.y - s.y; // how far the feet are below the surface
  if (pen > stepFor(b)) return blockBySlope(b, dir);
  if (pen > 0) b.y = s.y;
}

function blockBySlope(b, dir) {
  b.x = b.prevX;
  b.vx = 0;
  b.hitWall = dir;
}

/**
 * The last step of moveBody on a level with slopes: land on a slope, or follow the ground down so a walker stays grounded.
 * A body that has just walked off the foot of a slope onto level ground follows it the last few px too.
 */
function settleOnSlope(world, b, wasGrounded) {
  const wasOnSlope = b.onSlope;
  b.onSlope = 0;
  if (b.vy < 0) return; // rising: not on the ground
  const s = surfaceAt(world, b.x, b.y);
  if (!s) return;
  const gap = s.y - b.y; // positive: the surface is below the feet
  const follows = wasGrounded && gap > 0 && gap <= stepFor(b) + 1;
  if (SLOPE[s.id] ? (gap <= 0 ? -gap <= TILE : follows) : wasOnSlope && !b.grounded && follows) {
    b.y = s.y;
    b.vy = 0;
    b.grounded = true;
    b.onSlope = SLOPE[s.id] ? s.id : 0;
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
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = world.tile(tx, ty);
      if (SOLID[t] || (SLOPE[t] && rectHitsSlope(t, tx, ty, l, r, b))) return true;
    }
  }
  return false;
}

/** Does a rectangle (left l, right r, bottom b) reach below the line of slope tile `t` at cell (tx, ty)? */
function rectHitsSlope(t, tx, ty, l, r, b) {
  const left = Math.max(l, tx * TILE);
  const right = Math.min(r, (tx + 1) * TILE);
  const highest = Math.max(floorHeight(t, left - tx * TILE), floorHeight(t, right - tx * TILE));
  return b > (ty + 1) * TILE - highest + EPS;
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
