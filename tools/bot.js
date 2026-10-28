// A level-crossing bot. It plans a route with the solver (the same movement model as the game), then plays
// it frame by frame through the normal Input -> World path. Used by the tests to prove every level can be
// crossed on foot, and by the screenshot tools to pose the player in mid-level.
//
//   const r = playBot(level, { god: true });   // r.cleared, r.time, r.falls, r.world ...

import { Input } from '../src/engine/input.js';
import { World } from '../src/game/world.js';
import { TILE, DT, VIEW_W } from '../src/game/constants.js';
import { solveLevel } from '../src/game/solver.js';

export class Bot {
  constructor(level, { goalX = undefined } = {}) {
    this.level = level;
    this.goalX = goalX;
    this.path = null;
    this.idx = 0;
    this.replans = 0;
    this.lastPlanSpot = null;
    this.jumpHold = 0;
    this.dropT = 0;
    this.lastJump = false;
    this.side = 0; // wall climbs: the wall the bot is heading for next
    this.kicks = 0;
    this.swTarget = 'plank'; // rope swings: what the bot is jumping toward
  }

  plan(p) {
    const sol = solveLevel(this.level, { goalX: this.goalX, from: { x: p.x, y: p.y } });
    this.path = sol.path;
    this.idx = 0;
    this.replans++;
    this.lastPlanSpot = `${Math.floor(p.x / TILE)},${Math.round(p.y / TILE)}`;
    return sol.goal !== null;
  }

  /**
   * Is the soldier standing on route node `n`? A flat node needs the feet on its tile's top edge; a slope node is a whole cell
   * whose surface line passes through it, so the feet only have to be inside the cell's rows (the soldier's row is not a
   * round number there).
   */
  standingOn(n, p) {
    if (Math.floor(p.x / TILE) !== n.x) return false;
    if (n.slope) return p.y > n.y * TILE - 1 && p.y <= (n.y + 1) * TILE + 1;
    return Math.round(p.y / TILE) === n.y;
  }

  /** Is (sx, sy) on the straight walk between the current route node and the next? */
  onWalkLeg(sx, sy) {
    const a = this.path[this.idx];
    const b = this.path[this.idx + 1];
    if ((a && a.slope) || (b && b.slope)) return false; // ramps are walked cell by cell: every cell is a node
    // the run-up into a gravity hall (a 'flip' link) and the fall on the far side count as part of the walk
    if (a && b && b.kind === 'flip') return a.y === sy && sy === b.y && sx >= a.x && sx * TILE <= b.data.x1 + 6 * TILE;
    if (!a || !b || b.kind !== 'walk' || a.y !== sy || b.y !== sy) return false;
    return sx >= Math.min(a.x, b.x) && sx <= Math.max(a.x, b.x);
  }

  /** Locked in a wave arena: walk at the nearest enemy and shoot it. (God mode, so contact does not matter.) */
  hunt(world, out) {
    const p = world.player;
    let best = null;
    for (const e of world.enemies) {
      if (!e.alive || e.def.indestructible || (best && Math.abs(e.x - p.x) >= Math.abs(best.x - p.x))) continue;
      best = e;
    }
    this.path = null; // plan again from wherever the fight ends
    if (!best) return out;
    const dx = best.x - p.x;
    p.face = dx >= 0 ? 1 : -1; // the bot just turns to face its target; a bullet spawns in front of the soldier
    if (best.def.armorFront && Math.abs(dx) < 110) {
      // a shield stops flat shots: hop toward it, aiming down over the top (and from behind once past it)
      out.down = true;
      out[dx >= 0 ? 'right' : 'left'] = true;
      if (p.grounded) out.jump = true;
      return out;
    }
    if (best.y < (world.arena ? world.arena.floorY : p.y) - 30) {
      // a target up on a ledge: walk under its edge and jump up onto the ledge (holding jump to the top of the arc)
      if (Math.abs(dx) > 28) out[dx > 0 ? 'right' : 'left'] = true;
      if (p.grounded || p.vy < 0) out.jump = true;
      return out;
    }
    if (Math.abs(dx) < 16) out[dx >= 0 ? 'left' : 'right'] = true; // too close to shoot: back off
    else if (Math.abs(dx) > 90) out[dx > 0 ? 'right' : 'left'] = true;
    if (best.h < 14 && Math.abs(dx) < 220 && p.grounded) out.down = true; // low targets need a prone shot
    return out;
  }

  /** The action set for this frame. */
  act(world) {
    const out = this._act(world);
    this.lastJump = !!out.jump;
    return out;
  }

  /**
   * Climb a wall-jump shaft (a 'wall' link): jump up beside the exit wall, kick off it toward the far wall, kick back,
   * and so on up until the feet clear the exit wall's top, then step over it. Jump has to be released between kicks.
   */
  climb(world, p, next, out) {
    const d = next.data;
    const exit = d.exit || 1;
    if (this.side === 0) this.side = exit;
    out.fire = true;
    const top = d.topY;
    const clear = p.y < top - 4; // feet above the exit wall's top
    if (p.grounded) {
      this.side = exit;
      this.kicks = 0;
      out[exit > 0 ? 'right' : 'left'] = true;
      const atWall = exit > 0 ? p.x >= d.x1 - p.w / 2 - 3 : p.x <= d.x0 + p.w / 2 + 3;
      if (atWall) out.jump = !this.lastJump;
      return out;
    }
    if (clear && p.x > d.x0) {
      out[exit > 0 ? 'right' : 'left'] = true; // over the top: walk onto the wall
      return out;
    }
    if (p.kickT > 0) {
      // just kicked: hold the button for the full rise and keep heading for the other wall
      out.jump = true;
      out[this.side > 0 ? 'right' : 'left'] = true;
      return out;
    }
    if (p.wallDir !== 0) {
      // touching a wall: kick off it (a fresh press, so release first), then head for the other wall
      if (!this.lastJump) {
        out.jump = true;
        this.side = -p.wallDir;
        this.kicks++;
      }
      out[p.wallDir > 0 ? 'right' : 'left'] = true;
      return out;
    }
    out[this.side > 0 ? 'right' : 'left'] = true;
    if (p.vy < 0) out.jump = true; // keep the kick held for its full height
    return out;
  }

  /**
   * Cross a chasm on a rope-swing plank (a 'swing' link): wait at the ledge edge until the plank swings in, hop on, stand
   * still while it carries the soldier across, hop off as it reaches the far ledge.
   */
  ride(world, p, cur, next, out) {
    const d = next.data;
    const pl = world.platforms[d.i];
    out.fire = true;
    const nearEdge = (cur.x + 1) * TILE; // right edge of the ledge the bot is standing on
    const farEdge = next.x * TILE;
    const pc = pl.x + pl.w / 2;
    if (p.platform === pl) {
      const toFar = farEdge - (pl.x + pl.w);
      if (toFar <= 16 && Math.abs(pl.y - d.y) <= 10) {
        out.right = true;
        out.jump = true;
        this.swTarget = 'far';
      } else if (Math.abs(p.x - pc) > 8) out[p.x < pc ? 'right' : 'left'] = true;
      return out;
    }
    if (p.grounded) {
      const toPlank = pl.x - nearEdge;
      this.swTarget = 'plank';
      if (toPlank <= 14 && Math.abs(pl.y - d.y) <= 12) {
        out.right = true;
        out.jump = true;
      } else if (p.x < nearEdge - p.w / 2 - 3) out.right = true; // walk out to the edge and wait
      return out;
    }
    // in the air
    if (this.swTarget === 'far') {
      if (p.x < farEdge + 8) out.right = true;
    } else if (Math.abs(p.x - pc) > 4) out[p.x < pc ? 'right' : 'left'] = true;
    if (p.vy < 0) out.jump = true;
    return out;
  }

  /**
   * On a hoverbike (a 'hover' zone): hold the bike on its lane, about 40% of the way across the screen, shooting ahead. The
   * camera rolls on by itself, so the bot only has to keep station; the road below is the solver's route, so nothing else
   * is needed.
   */
  fly(world, p, out) {
    const z = p.bikeZone;
    const lane = z && z.lane !== undefined ? z.lane : p.y;
    // hold station about 40% of the way across the screen, but never fall behind the start of the skyway (the camera only rolls on once the bike is over it)
    const tx = Math.max(world.camera.x + VIEW_W * 0.4, z ? z.x0 + 30 : 0);
    if (p.x < tx - 6) out.right = true;
    else if (p.x > tx + 6) out.left = true;
    else p.face = 1;
    if (p.y > lane + 3) out.up = true;
    else if (p.y < lane - 3) out.down = true;
    return out;
  }

  _act(world) {
    const p = world.player;
    const out = { fire: true };
    if (!p.alive) return {};
    if (world.arena && world.arena.state === 'fighting') return this.hunt(world, out);
    if (p.mode === 'fly') return this.fly(world, p, out);
    // a gravity hall: the soldier is walking on the ceiling; keep going until gravity returns at the far end
    if (p.gdir < 0) {
      out.right = true;
      return out;
    }
    if (!this.path) this.plan(p);

    const wallLeg = this.path[this.idx + 1];
    const inShaft = !!wallLeg && wallLeg.kind === 'wall' && p.x >= wallLeg.data.x0 && p.x <= wallLeg.data.x1 && p.y >= wallLeg.data.topY + TILE;
    if (p.grounded && !inShaft && !p.platform) {
      const sx = Math.floor(p.x / TILE);
      const sy = Math.round(p.y / TILE);
      let k = -1;
      for (let i = Math.max(0, this.idx - 1); i < this.path.length; i++) {
        if (this.standingOn(this.path[i], p)) {
          k = i;
          break;
        }
      }
      if (k >= 0) this.idx = k;
      else if (this.onWalkLeg(sx, sy)) {
        // somewhere along a long flat walk between two route nodes: nothing to do
      } else if (this.lastPlanSpot !== `${sx},${sy}`) this.plan(p); // off the route: plan again from here
    }

    const next = this.path[this.idx + 1];
    if (!next) {
      out.right = true; // standing on the goal: nudge toward the exit line
      return out;
    }
    const cur = this.path[this.idx];
    const kind = next.kind;
    if (kind === 'flip') {
      // a gravity hall: walk on through it; once the far side's landing column has been passed the leg is done
      if (p.x >= next.x * TILE) {
        this.idx++;
        return this._act(world);
      }
      out.right = true;
      return out;
    }
    if (kind === 'wall') return this.climb(world, p, next, out);
    if (kind === 'swing') return this.ride(world, p, cur, next, out);
    const cx = next.x * TILE + TILE / 2;
    const lo = next.x * TILE + 3;
    const hi = next.x * TILE + TILE - 3;

    if (!p.grounded) {
      // in the air: steer over the target tile, keep the jump button held while rising for full height
      if (p.x < lo) out.right = true;
      else if (p.x > hi) out.left = true;
      if (this.jumpHold > 0 && p.vy < 0) out.jump = true;
      return out;
    }
    this.jumpHold = 0;

    const dir = Math.sign(cx - p.x) || 0;
    if (dir > 0) out.right = true;
    if (dir < 0) out.left = true;

    if (kind === 'jump') {
      // take off 4 px past the tile centre, the launch point the solver verified
      const c = cur.x * TILE + TILE / 2;
      // (a steep face can stop the soldier before that point: pressed against it, jump)
      const atLip = next.x === cur.x || p.hitWall !== 0 || (next.x > cur.x ? p.x >= c + 4 : p.x <= c - 4);
      if (atLip) {
        out.jump = true;
        this.jumpHold = 1;
      }
    } else if (kind === 'drop') {
      out.left = out.right = false;
      out.down = true;
      out.jump = true;
    }
    return out;
  }
}

/**
 * Run the bot through a level from the start. God mode (default) means enemies cannot hurt it, so this
 * measures terrain only. Returns the finished world plus counters.
 */
export function playBot(level, { god = true, seconds = 400, difficulty = 'normal', until = null, onFrame = null } = {}) {
  const world = new World(level, { god, difficulty });
  const input = new Input();
  input.script = {};
  const bot = new Bot(level);
  const max = Math.round(seconds / DT);
  let falls = 0;
  let hazards = 0;
  let bestX = world.player.x;
  let bestY = world.player.y;
  let lastProgress = 0;
  let frame = 0;
  for (; frame < max && !world.cleared && !world.boss; frame++) {
    input.script = bot.act(world);
    input.poll();
    world.update(input, DT);
    for (const e of world.events) if (e.type === 'hazard') hazards++;
    world.events.length = 0;
    const p = world.player;
    if (p.y > world.rows * TILE + 30) {
      falls++;
      world.respawnPlayer(p.safeX, p.safeY);
      bot.path = null;
    }
    if (p.x > bestX + 1) {
      bestX = p.x;
      lastProgress = frame;
    }
    if (p.y < bestY - 1) {
      bestY = p.y; // towers: climbing is progress too
      lastProgress = frame;
    }
    if (world.arena) lastProgress = frame; // a wave fight is progress too
    if (frame - lastProgress > 60 * 12) break; // stuck for 12 s
    if (onFrame) onFrame(world, frame);
    if (until && until(world, frame)) break;
  }
  return {
    cleared: world.cleared || !!world.boss, // a boss level is 'crossed' when the boss fight starts
    time: world.time,
    x: world.player.x,
    falls,
    hazards,
    replans: bot.replans,
    stuck: !world.cleared && frame < max,
    frames: frame,
    world,
  };
}
