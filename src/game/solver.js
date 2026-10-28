// Level solver: finds every spot a player can stand on and every jump, fall or drop between them, using
// the same movement numbers as the game (with a safety margin). Used by the tests to prove each level can
// be crossed on foot, and by the bot to get a path to follow.
//
// A "spot" is a tile the player can stand on top of (feet at the tile's top edge): solid ground, a one-way
// platform (water is not standable: the player sinks to the riverbed), with two free tiles above it and no hazard on top.

import { TILE, PLAYER } from './constants.js';
import { SOLID, ONEWAY, HURT } from './tiles.js';

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

  isSpot(x, y) {
    const t = this.id(x, y);
    if (!(SOLID[t] || ONEWAY[t])) return false; // water is never something to stand on: the player sinks to the bed
    const a1 = this.id(x, y - 1);
    const a2 = this.id(x, y - 2);
    if (SOLID[a1] || SOLID[a2] || HURT[a1] || HURT[a2]) return false;
    return true;
  }
}

/** Collect all spots, indexed by column. */
export function findSpots(grid) {
  const byCol = [];
  const all = [];
  for (let x = 0; x < grid.cols; x++) {
    byCol[x] = [];
    for (let y = 0; y < grid.rows; y++) {
      if (grid.isSpot(x, y)) {
        const s = { x, y, key: y * grid.cols + x };
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
    const nx = x + Math.sign(dx) * Math.min(Math.abs(dx), RUN * STEP);
    if (blocked(grid, nx, y)) return false; // ran into a wall
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
    // falling: did the feet cross the top edge of a tile?
    const fx0 = Math.floor((x - HALF_W + 0.001) / TILE);
    const fx1 = Math.floor((x + HALF_W - 0.001) / TILE);
    const r0 = Math.ceil(prevY / TILE);
    const r1 = Math.floor(y / TILE);
    for (let r = r0; r <= r1; r++) {
      let landed = false;
      let onTarget = false;
      for (let tx = fx0; tx <= fx1; tx++) {
        const t = grid.id(tx, r);
        if (HURT[t]) return false;
        if (SOLID[t] || (ONEWAY[t] && !dropping)) {
          landed = true;
          if (tx === b.x && r === b.y) onTarget = true;
        }
      }
      if (landed) return onTarget;
    }
    if (y > grid.rows * TILE + 40) return false;
  }
  return false;
}

/** Can the player get from spot a to spot b? Returns 'walk' | 'jump' | 'fall' | 'drop' | null. */
export function hopKind(grid, a, b) {
  if (a === b) return null;
  const ay = a.y * TILE;
  const ax = a.x * TILE + TILE / 2;
  const dxTiles = b.x - a.x;
  const dyPx = ay - b.y * TILE; // positive: b is higher
  if (a.y === b.y) {
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
    if (simulate(grid, ax + off, ay, b, JUMP_V)) return 'jump';
  }
  if (dyPx < 0) {
    // walking off the ledge: the body has to clear the tile before it falls
    if (simulate(grid, ax + dir * (TILE / 2 + HALF_W + 0.5), ay, b, 0)) return 'fall';
    if (ONEWAY[grid.id(a.x, a.y)]) {
      for (const off of [0, dir * 4, dir * 8]) if (simulate(grid, ax + off, ay, b, 0, ay)) return 'drop';
    }
  }
  return null;
}

/** Towers end at a height, not a column. */
function defaultGoalY(level) {
  return level.exitY ?? (level.boss ? level.boss.triggerY : undefined);
}

function defaultGoalX(level) {
  if (defaultGoalY(level) !== undefined) return undefined;
  return level.exitX ?? (level.boss ? level.boss.trigger : undefined);
}

/**
 * Breadth-first search of the level from its spawn point.
 * `from` ({x, y} in pixels, feet position) overrides the level's spawn as the starting point.
 * Returns { reach: Map(key -> {spot, from, kind}), spots, start, goal, path } where `goal` is the first
 * reachable spot at or beyond `goalX` pixels (when given) and `path` the moves leading to it.
 */
export function solveLevel(level, { goalX = defaultGoalX(level), goalY = defaultGoalY(level), extraLinks = level.links || [], from = null } = {}) {
  const grid = new LevelGrid(level);
  const { byCol, all } = findSpots(grid);
  const origin = from || level.spawn; // `from` lets a bot re-plan from wherever it is standing
  const sx = Math.floor(origin.x / TILE);
  const sy = Math.round(origin.y / TILE);
  const start = all.find((s) => s.x === sx && s.y === sy) || nearest(all, sx, sy);
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
  const queue = [start];
  let goal = null;
  while (queue.length) {
    const a = queue.shift();
    if (!goal && ((goalX !== undefined && a.x * TILE + TILE / 2 >= goalX) || (goalY !== undefined && a.y * TILE <= goalY))) goal = a;
    const tryTo = (b, kind, data) => {
      if (reach.has(b.key)) return;
      reach.set(b.key, { spot: b, from: a, kind, data });
      queue.push(b);
    };
    const R = 9;
    for (let dx = -R; dx <= R; dx++) {
      const col = byCol[a.x + dx];
      if (!col) continue;
      for (const b of col) {
        if (reach.has(b.key)) continue;
        const k = hopKind(grid, a, b);
        if (k) tryTo(b, k);
      }
    }
    for (const l of linkMap.get(a.key) || []) tryTo(l.to, l.kind, l.data);
  }
  let path = [];
  if (goal) {
    for (let n = reach.get(goal.key); n; n = n.from && reach.get(n.from.key)) path.push({ x: n.spot.x, y: n.spot.y, kind: n.kind, data: n.data });
    path.reverse();
  }
  return { reach, spots: all, start, goal, path, grid };
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
