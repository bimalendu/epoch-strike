// A boss-fight bot: stands where it can hit the weak point and holds fire. In god mode it measures the
// "ideal" kill time (every exposed moment is used). A human dodging attacks needs 1.5-2x that.
//
//   const r = fightBoss(level, { weapon: 'rifle' });   // r.killed, r.time, r.phases, r.attacks ...

import { Input } from '../src/engine/input.js';
import { World } from '../src/game/world.js';
import { TILE, DT } from '../src/game/constants.js';
import { T } from '../src/game/tiles.js';

/** Runs of one-way platform tiles inside the boss arena, as [{ x0, x1, y }] in pixels (y = standing surface). */
export function arenaLedges(level, arena = level.boss) {
  const L = arena;
  const out = [];
  const c0 = Math.floor(L.x0 / TILE);
  const c1 = Math.floor(L.x1 / TILE);
  const floorRow = Math.floor(L.floorY / TILE);
  for (let row = 1; row < floorRow; row++) {
    let start = -1;
    for (let c = c0; c <= c1; c++) {
      const on = c < c1 && level.tiles[row * level.cols + c] === T.PLATFORM;
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        out.push({ x0: start * TILE, x1: c * TILE, y: row * TILE });
        start = -1;
      }
    }
  }
  return out;
}

/**
 * style: 'ground' stands and fires level; 'jump' bounces while firing (for weak points above standing height);
 * 'ledge' climbs onto the nearest arena ledge and fires from it; 'under' (flying bosses) stands beneath the weak point
 * and holds UP, so the bullets climb straight through it.
 */
export function fightBoss(level, { god = true, seconds = 300, weapon = null, difficulty = 'normal', dodge = false, style: styleOpt = 'ground', onFrame = null, arena = null, rush = false } = {}) {
  // arena: which arena of a boss rush to start in (default: the level's own boss, the last one); rush: carry on through
  // the rest of the arenas to the level's end instead of stopping when the first boss falls
  const arenas = [...(level.rush || []), level.boss];
  const L0 = arenas[arena === null ? arenas.length - 1 : arena];
  let L = L0;
  const start = { x: L0.x0 + 3 * TILE, y: L0.floorY };
  const world = new World(level, { god, difficulty, start, loadout: weapon ? { slots: [weapon, null], slot: 0, bombs: 0 } : undefined });
  const input = new Input();
  input.script = {};
  const attacks = new Map();
  const phases = [];
  let lastAtk = null;
  let frames = 0;
  const events = [];
  const ledgeCache = new Map();
  for (; frames < seconds / DT && !world.cleared; frames++) {
    const p = world.player;
    const b = world.boss;
    L = world.bossArena || L;
    // style may be a map { bossId: style } (boss rushes) or one style for every boss
    const style = typeof styleOpt === 'string' ? styleOpt : (b && styleOpt[b.def.id.replace(/^echo_/, '')]) || 'ground';
    if (!ledgeCache.has(L)) ledgeCache.set(L, arenaLedges(level, L));
    const ledges = style === 'ledge' ? ledgeCache.get(L) : [];
    const out = { fire: true };
    if (!b) {
      out.right = true;
    } else if (style === 'under') {
      const wb = b.def.weakBox(b);
      const f = b.face || 1;
      const tx = wb ? (wb.x0 + wb.x1) / 2 : b.x + f * 38;
      const clampX = Math.max(L.x0 + 14, Math.min(L.x1 - 14, tx));
      if (Math.abs(p.x - clampX) > 5) out[p.x < clampX ? 'right' : 'left'] = true;
      out.up = true;
    } else if (style === 'ledge' && ledges.length) {
      // climb onto the ledge nearest the boss and shoot from there
      let best = ledges[0];
      for (const l of ledges) if (Math.abs((l.x0 + l.x1) / 2 - b.x) < Math.abs((best.x0 + best.x1) / 2 - b.x) - 30) best = l;
      const on = p.grounded && Math.abs(p.y - best.y) < 3 && p.x > best.x0 && p.x < best.x1;
      const cx = (best.x0 + best.x1) / 2;
      if (on) {
        const want = b.x > p.x ? 1 : -1;
        if (p.face !== want) out[want > 0 ? 'right' : 'left'] = true; // turn without leaving the ledge
      } else {
        // walk to the ledge's near edge, then jump up onto it
        const fromLeft = p.x < cx;
        const edge = fromLeft ? best.x0 - 10 : best.x1 + 10;
        if (Math.abs(p.x - edge) > 6 && p.y >= L.floorY - 3) out[p.x < edge ? 'right' : 'left'] = true;
        else if (p.grounded || p.vy < 0) {
          out.jump = true;
          out[fromLeft ? 'right' : 'left'] = true;
        } else out[fromLeft ? 'right' : 'left'] = true;
      }
    } else {
      const side = p.x <= b.x ? -1 : 1;
      const desired = Math.max(L.x0 + 20, Math.min(L.x1 - 20, b.x + side * 120));
      // Stand about 120 px from the boss. The band is lopsided on purpose: turning to face the boss means tapping toward
      // it, which nudges the soldier closer, so being up to 20 px closer than ideal is fine. (A symmetric 8 px band made
      // the bot dither back and forth on one spot, facing away on the frames it fired.)
      const closer = (p.x - desired) * -side; // > 0 when nearer the boss than the ideal spot
      if (closer < -8 || closer > 20) out[p.x < desired ? 'right' : 'left'] = true;
      else if (p.face !== -side) out[-side > 0 ? 'right' : 'left'] = true;
      if (style === 'jump' && (p.grounded || p.vy < 0)) out.jump = true;
      if (style === 'jump') out.fire = true;
      if (dodge && world.ebullets.some((e) => Math.abs(e.x - p.x) < 40 && e.y > p.y - 40 && p.grounded)) out.jump = true;
    }
    input.script = out;
    input.poll();
    world.update(input, DT);
    for (const e of world.events) if (e.type !== 'sfx') events.push(e);
    world.events.length = 0;
    const bb = world.boss;
    if (bb && bb.bs) {
      if (bb.bs.atk && bb.bs.atk !== lastAtk) attacks.set(bb.bs.atk, (attacks.get(bb.bs.atk) || 0) + 1);
      lastAtk = bb.bs.atk;
      if (phases.at(-1) !== bb.bs.phase) phases.push(bb.bs.phase);
    }
    if (onFrame) onFrame(world, frames);
    if (!rush && events.some((e) => e.type === 'bossDefeated' && e.echo)) break; // an echo is down: that was the fight
  }
  const defeated = events.find((e) => e.type === 'bossDefeated');
  return {
    killed: !!defeated,
    time: defeated ? defeated.time : null,
    defeats: events.filter((e) => e.type === 'bossDefeated'),
    seconds: frames * DT,
    phases,
    attacks,
    events,
    world,
  };
}
