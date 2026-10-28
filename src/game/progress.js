// How far through a level the soldier is, for the HUD's progress bar. Pure: it reads a World and changes nothing.
//
// A level ends at the same place the solver aims for: the exit column or the boss arena's trigger.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * @returns {null | {frac: number, checkpoints: {f: number, hit: boolean}[], arenas: {f: number, done: boolean}[]}}
 *   `frac` is the soldier's progress 0..1; every marker is a fraction along the same bar. Null when the level has no end
 *   to measure against (the testbed).
 */
export function levelProgress(world) {
  const L = world.level;
  const p = world.player;
  const goal = L.exitX ?? (L.boss ? L.boss.trigger : undefined);
  const start = L.spawn.x;
  if (goal === undefined || !(Math.abs(goal - start) > 1)) return null;
  const at = (o) => clamp01((o.x - start) / (goal - start));
  return {
    frac: at(p),
    checkpoints: world.checkpoints.map((c) => ({ f: at(c), hit: !!c.hit })),
    // every boss arena but the last (the last one is the end of the bar)
    arenas: world.arenas.slice(0, -1).map((a, i) => ({ f: at({ x: a.trigger ?? a.x0 }), done: i < world.arenaIdx })),
  };
}
