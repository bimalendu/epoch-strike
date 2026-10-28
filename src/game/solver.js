// Level solver: finds every spot a player can stand on and every jump, fall or drop between them, using
// the same movement numbers as the game (with a safety margin). Used by the tests to prove each level can
// be crossed on foot, and by the bot to get a path to follow.
//
// A "spot" is a tile the player can stand on top of (feet at the tile's top edge): solid ground, a one-way
// platform (water is not standable: the player sinks to the riverbed), with two free tiles above it and no hazard on top.
// A slope cell is a spot too, with its own surface line: neighbouring spots whose surfaces meet are joined by a 'walk', and
// a steep slope is joined only downhill, by a one-way 'slide' (the soldier cannot climb one).

import { TILE, PLAYER } from './constants.js';
import { SOLID, ONEWAY, HURT, SLOPE, STEEP, floorHeight, slopeSpan, uphillDir } from './tiles.js';
import { surfaceAt, SLOPE_STEP } from './physics.js';

const MARGIN = 0.93; // shave the jump a little: the solver must not need pixel-perfect play
const RUN = PLAYER.RUN * MARGIN;
const JUMP_V = PLAYER.JUMP_V * Math.sqrt(MARGIN);
const GRAV = PLAYER.GRAV;
const MAX_FALL = PLAYER.MAX_FALL;
const HALF_W = PLAYER.W / 2;
const BODY_H = PLAYER.H;
const STEP = 1 / 120;
const MAX_STEPS = 260;

/** Horizontal distance a full running jump covers while the feet end `dy` px above the start. */
export function jumpReach(dy) {
  const disc = JUMP_V * JUMP_V - 2 * GRAV * dy;
  if (disc < 0) return 0;
  return RUN * ((JUMP_V + Math.sqrt(disc)) / GRAV);
}

/** Highest ledge a jump can reach, in pixels. */
export function jumpHeight() {
  return (JUMP_V * JUMP_V) / (2 * GRAV);
}

/** The terrain as it is once every rising-lava zone has finished rising (the worst case the route must survive). */
export function finalTiles(level) {
  const zones = (level.zones || []).filter((z) => z.type === 'lavaRise');
  if (!zones.length) return level.tiles;
  const tiles = level.tiles.slice();
  for (const z of zones) {
    for (let y = z.endRow; y < level.rows; y++) {
      for (let x = Math.floor(z.x0 / TILE); x < Math.ceil(z.x1 / TILE); x++) {
        const i = y * level.cols + x;
        tiles[i] = 5; // T.LAVA
      }
    }
  }
  return tiles;
}

export class LevelGrid {
  constructor(level) {
    this.level = level;
    this.cols = level.cols;
    this.rows = level.rows;
    this.tiles = finalTiles(level);
  }

  id(x, y) {
    if (x < 0 || x >= this.cols) return 1; // map edges are walls
    if (y < 0 || y >= this.rows) return 0;
    return this.tiles[y * this.cols + x];
  }

  /** The same lookup under the name the physics queries (`surfaceAt`, `solidPoint`) expect of a world. */
  tile(x, y) {
    return this.id(x, y);
  }

  /** Is this level built with slopes? Levels without any skip all of the slope checks below. */
  get hasSlopes() {
    if (this._hasSlopes === undefined) this._hasSlopes = this.tiles.some((t) => SLOPE[t]);
    return this._hasSlopes;
  }

  /** Two free tiles above (x, y), nothing solid or hurtful: room to stand. */
  headroom(x, y) {
    const a1 = this.id(x, y - 1);
    const a2 = this.id(x, y - 2);
    return !(SOLID[a1] || SOLID[a2] || HURT[a1] || HURT[a2]);
  }

  /** A flat spot: solid ground or a one-way platform with room above and no ramp on top of it. */
  isSpot(x, y) {
    const t = this.id(x, y);
    if (!(SOLID[t] || ONEWAY[t])) return false; // water is never something to stand on: the player sinks to the bed
    if (SLOPE[this.id(x, y - 1)]) return false; // the ramp cell above is the surface; this tile is the fill under it
    return this.headroom(x, y);
  }

  /** A slope cell with room above it. */
  isRamp(x, y) {
    return !!SLOPE[this.id(x, y)] && this.headroom(x, y);
  }
}

/** Build the spot record for the tile at (x, y): its ends (lx,ly)-(rx,ry) in px, and the centre (cx,fy) the planner aims for. */
function makeSpot(grid, x, y) {
  const t = grid.id(x, y);
  const span = slopeSpan(t);
  const lx = x * TILE + (span ? span[0] : 0);
  const rx = x * TILE + (span ? span[1] : TILE);
  const edgeY = (px) => (span ? (y + 1) * TILE - floorHeight(t, px - x * TILE) : y * TILE);
  const ly = edgeY(lx);
  const ry = edgeY(rx);
  return { x, y, key: y * grid.cols + x, lx, ly, rx, ry, cx: (lx + rx) / 2, fy: (ly + ry) / 2, slope: !!span, steep: !!STEEP[t] };
}

/** Height (px, feet) of a spot's surface at pixel column `px`, clamped to the spot's span. */
function standY(spot, px) {
  if (spot.rx === spot.lx) return spot.ly;
  const f = Math.min(1, Math.max(0, (px - spot.lx) / (spot.rx - spot.lx)));
  return spot.ly + (spot.ry - spot.ly) * f;
}

/** Collect all spots, indexed by column. */
export function findSpots(grid) {
  const byCol = [];
  const all = [];
  for (let x = 0; x < grid.cols; x++) {
    byCol[x] = [];
    for (let y = 0; y < grid.rows; y++) {
      if (grid.isSpot(x, y) || (grid.hasSlopes && grid.isRamp(x, y))) {
        const s = makeSpot(grid, x, y);
        byCol[x].push(s);
        all.push(s);
      }
    }
  }
  return { byCol, all };
}

/** Does the body box at (cx, feetY) overlap a blocking tile? Returns the tile found, or null. */
function blocked(grid, cx, feetY, ignoreOneway) {
  const x0 = Math.floor((cx - HALF_W + 0.001) / TILE);
  const x1 = Math.floor((cx + HALF_W - 0.001) / TILE);
  const y0 = Math.floor((feetY - BODY_H + 0.001) / TILE);
  const y1 = Math.floor((feetY - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = grid.id(tx, ty);
      if (SOLID[t] || HURT[t]) return { tx, ty, t };
    }
  }
  return null;
}

/**
 * What a slope does to a body that has just moved horizontally to `nx` with its feet at `y`, mirroring `moveBody`: the new feet
 * height (lifted onto the ramp when it is within a step), or null when the slope stops it (a steep face from below, or a ramp
 * taller than a step).
 */
function slopeAhead(grid, nx, y, dir) {
  const lead = surfaceAt(grid, nx + dir * HALF_W, y);
  if (lead && STEEP[lead.id] && y - lead.y > 1 && dir === uphillDir(lead.id)) return null;
  const s = surfaceAt(grid, nx, y);
  if (!s || !SLOPE[s.id]) return y;
  const pen = y - s.y;
  if (pen > SLOPE_STEP) return null;
  return pen > 0 ? s.y : y;
}

/**
 * Simulate one move from standing at (ax, ay) pixels toward target spot b, with launch speed v0
 * (JUMP_V for a jump, 0 for walking off a ledge). `dropFrom` set = pressing Down+Jump on a one-way platform
 * (one-way tiles are ignored for the first 20 px of the fall). Returns true if the body lands on b.
 */
function simulate(grid, ax, ay, b, v0, dropFrom) {
  const lo = b.x * TILE + 3;
  const hi = b.x * TILE + TILE - 3;
  let x = ax;
  let y = ay;
  let vy = -v0;
  let dropping = dropFrom !== undefined;
  for (let i = 0; i < MAX_STEPS; i++) {
    // horizontal: run toward the target tile and stop once over it
    const goal = Math.min(hi, Math.max(lo, x));
    const dx = goal - x;
    const move = Math.sign(dx) * Math.min(Math.abs(dx), RUN * STEP);
    const nx = x + move;
    if (blocked(grid, nx, y)) return false; // ran into a wall
    if (grid.hasSlopes && move !== 0) {
      y = slopeAhead(grid, nx, y, Math.sign(move)); // lifted onto a ramp, or null when the slope is a wall
      if (y === null) return false;
    }
    x = nx;
    // vertical
    const prevY = y;
    vy = Math.min(MAX_FALL, vy + GRAV * STEP);
    y += vy * STEP;
    if (vy < 0) {
      if (blocked(grid, x, y)) return false; // bumped a ceiling
      continue;
    }
    if (dropping && y > dropFrom + 20) dropping = false;
    // falling: did the feet cross the top edge of a tile, or the line of a slope?
    const fx0 = Math.floor((x - HALF_W + 0.001) / TILE);
    const fx1 = Math.floor((x + HALF_W - 0.001) / TILE);
    const r0 = Math.ceil(prevY / TILE);
    const r1 = Math.floor(y / TILE);
    let solidRow = -1; // the first tile row the feet crossed with ground in it
    let solidOnTarget = false;
    for (let r = r0; r <= r1 && solidRow < 0; r++) {
      for (let tx = fx0; tx <= fx1; tx++) {
        const t = grid.id(tx, r);
        if (HURT[t]) return false;
        if (SOLID[t] || (ONEWAY[t] && !dropping)) {
          solidRow = r;
          if (tx === b.x && r === b.y) solidOnTarget = true;
        }
      }
    }
    if (grid.hasSlopes) {
      // a ramp under the middle of the body is landed on before the fill beneath it, unless higher ground is crossed first
      const surf = surfaceAt(grid, x, y);
      if (surf && SLOPE[surf.id] && y >= surf.y && prevY <= surf.y + 0.5 && (solidRow < 0 || solidRow * TILE > surf.y)) {
        return surf.tx === b.x && surf.ty === b.y;
      }
    }
    if (solidRow >= 0) return solidOnTarget;
    if (y > grid.rows * TILE + 40) return false;
  }
  return false;
}

/**
 * Do two spots join up on foot? Their surfaces have to meet at a shared end (same x, same height). Between ordinary spots
 * that is a 'walk'; a steep spot can be entered only going down and left only from its low end, and that is a one-way
 * 'slide'. Returns the kind, or null when they do not join.
 */
export function joinKind(a, b) {
  let meetY;
  let aOther;
  let bFar;
  if (Math.abs(a.rx - b.lx) < 0.01 && Math.abs(a.ry - b.ly) < 0.5) {
    meetY = a.ry;
    aOther = a.ly;
    bFar = b.ry;
  } else if (Math.abs(a.lx - b.rx) < 0.01 && Math.abs(a.ly - b.ry) < 0.5) {
    meetY = a.ly;
    aOther = a.ry;
    bFar = b.ly;
  } else return null;
  if (!a.steep && !b.steep) return 'walk';
  if (a.steep && !(aOther < meetY - 0.5)) return null; // leaving a steep slope only at its low end
  if (b.steep && !(bFar > meetY + 0.5)) return null; // and entering one only to go down it
  return 'slide';
}

/** Can the player get from spot a to spot b? Returns 'walk' | 'jump' | 'fall' | 'drop' | null. (Slides are `joinKind`.) */
export function hopKind(grid, a, b) {
  if (a === b || a.steep || b.steep) return null; // nobody stands on scree: it is only slid down
  const ax = a.cx;
  const ay = a.fy;
  const dxTiles = b.x - a.x;
  const dyPx = ay - b.fy; // positive: b is higher
  if (a.y === b.y && !a.slope && !b.slope) {
    // continuous ground at the same height: just walk
    const step = dxTiles > 0 ? 1 : -1;
    let ok = true;
    for (let x = a.x + step; x !== b.x + step; x += step) {
      if (!grid.isSpot(x, a.y)) {
        ok = false;
        break;
      }
    }
    if (ok) return 'walk';
  }
  if (dyPx > jumpHeight()) return null;
  const gap = Math.max(0, Math.abs(dxTiles) * TILE - TILE); // empty distance between the two tiles
  if (gap > jumpReach(dyPx) + TILE) return null;
  const dir = dxTiles >= 0 ? 1 : -1;
  // jump from 4 px past the tile centre (where a bot or a player running toward the gap naturally takes off) or from the centre
  for (const off of [dir * 4, 0]) {
    if (simulate(grid, ax + off, standY(a, ax + off), b, JUMP_V)) return 'jump';
  }
  if (dyPx < 0) {
    // walking off the ledge: the body has to clear the tile before it falls
    const edgeX = dir > 0 ? a.rx : a.lx;
    if (simulate(grid, edgeX + dir * (HALF_W + 0.5), standY(a, edgeX), b, 0)) return 'fall';
    if (ONEWAY[grid.id(a.x, a.y)]) {
      for (const off of [0, dir * 4, dir * 8]) if (simulate(grid, ax + off, ay, b, 0, ay)) return 'drop';
    }
  }
  return null;
}

function defaultGoalX(level) {
  return level.exitX ?? (level.boss ? level.boss.trigger : undefined);
}

/**
 * Breadth-first search of the level from its spawn point.
 * `from` ({x, y} in pixels, feet position) overrides the level's spawn as the starting point.
 * Returns { reach: Map(key -> {spot, from, kind}), spots, start, goal, path } where `goal` is the first
 * reachable spot at or beyond `goalX` pixels (when given) and `path` the moves leading to it.
 */
export function solveLevel(level, { goalX = defaultGoalX(level), extraLinks = level.links || [], from = null } = {}) {
  const grid = new LevelGrid(level);
  const { byCol, all } = findSpots(grid);
  const origin = from || level.spawn; // `from` lets a bot re-plan from wherever it is standing
  const sx = Math.floor(origin.x / TILE);
  const sy = Math.round(origin.y / TILE);
  const start = (grid.hasSlopes && spotUnder(byCol, origin.x, origin.y)) || all.find((s) => s.x === sx && s.y === sy) || nearest(all, sx, sy);
  const linkMap = new Map();
  for (const l of extraLinks) {
    const from = all.find((s) => s.x === l.from[0] && s.y === l.from[1]);
    const to = all.find((s) => s.x === l.to[0] && s.y === l.to[1]);
    if (from && to) {
      if (!linkMap.has(from.key)) linkMap.set(from.key, []);
      linkMap.get(from.key).push({ to, kind: l.kind || 'link', data: l.data });
      if (l.both) {
        if (!linkMap.has(to.key)) linkMap.set(to.key, []);
        linkMap.get(to.key).push({ to: from, kind: l.kind || 'link', data: l.data });
      }
    }
  }
  const reach = new Map();
  if (!start) return { reach, spots: all, start: null, goal: null, path: [], grid };
  reach.set(start.key, { spot: start, from: null, kind: 'start' });
  // On a level with slopes the search runs in layers so that walking and sliding are free: every spot reachable on foot is
  // found before any jump from the same layer, and the route walks up a ramp instead of leaping over it.
  const layered = grid.hasSlopes;
  const queue = [start];
  let pending = []; // hops found in this layer: { b, a, kind, data }, taken on when the layer ends
  const pendingKeys = new Set();
  let goal = null;
  while (queue.length || pending.length) {
    if (!queue.length) {
      for (const e of pending) {
        if (reach.has(e.b.key)) continue;
        reach.set(e.b.key, { spot: e.b, from: e.a, kind: e.kind, data: e.data });
        queue.push(e.b);
      }
      pending = [];
      pendingKeys.clear();
      continue;
    }
    const a = queue.shift();
    if (!goal && goalX !== undefined && a.x * TILE + TILE / 2 >= goalX) goal = a;
    const tryTo = (b, kind, data) => {
      if (reach.has(b.key)) return;
      if (layered && kind !== 'walk' && kind !== 'slide') {
        if (!pendingKeys.has(b.key)) pending.push({ b, a, kind, data });
        pendingKeys.add(b.key);
        return;
      }
      reach.set(b.key, { spot: b, from: a, kind, data });
      queue.push(b);
    };
    if (layered) {
      // joined surfaces: ramps are walked cell by cell, and scree is slid down
      for (let dx = -1; dx <= 1; dx++) {
        for (const b of byCol[a.x + dx] || []) {
          const k = b !== a && !reach.has(b.key) && joinKind(a, b);
          if (k) tryTo(b, k);
        }
      }
    }
    const R = 9;
    for (let dx = -R; dx <= R; dx++) {
      const col = byCol[a.x + dx];
      if (!col) continue;
      for (const b of col) {
        if (reach.has(b.key) || pendingKeys.has(b.key)) continue;
        const k = hopKind(grid, a, b);
        if (k) tryTo(b, k);
      }
    }
    for (const l of linkMap.get(a.key) || []) tryTo(l.to, l.kind, l.data);
  }
  let path = [];
  if (goal) {
    for (let n = reach.get(goal.key); n; n = n.from && reach.get(n.from.key)) path.push({ x: n.spot.x, y: n.spot.y, fy: n.spot.fy, slope: n.spot.slope, kind: n.kind, data: n.data });
    path.reverse();
  }
  return { reach, spots: all, start, goal, path, grid };
}

/** The spot a body at pixel (x, y) is standing on, if any: in its column, with the surface at that x within a few px of the feet. */
export function spotUnder(byCol, x, y) {
  let best = null;
  let bd = 6;
  for (const s of byCol[Math.floor(x / TILE)] || []) {
    const d = Math.abs(standY(s, x) - y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

function nearest(all, x, y) {
  let best = null;
  let bd = Infinity;
  for (const s of all) {
    const d = Math.abs(s.x - x) + Math.abs(s.y - y) * 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Is there a reachable spot within `tol` columns of pixel x (used to check checkpoints and pickups)? */
export function reachableNear(solution, xPx, tolCols = 2) {
  const col = Math.floor(xPx / TILE);
  for (const { spot } of solution.reach.values()) if (Math.abs(spot.x - col) <= tolCols) return true;
  return false;
}
