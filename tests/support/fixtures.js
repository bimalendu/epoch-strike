// Shared test fixtures: builders that several suites used to copy-paste. Helpers whose shape differs between
// suites (the per-era `field` builders, the `arena` variants that return `{ world, input }`) stay local.
import { World } from '../../src/game/world.js';
import { flatLevel } from '../../src/game/ascii.js';
import { LEVEL_DEFS, buildLevel } from '../../src/game/levels.js';
import { TILE } from '../../src/game/constants.js';
import { makeGame, stepN } from '../../tools/shots.mjs';

export { makeGame, stepN };

/** Press one action for a single frame, then release for a frame so the next press is an edge. */
export function tap(game, key = 'confirm') {
  stepN(game, 1, [key]);
  stepN(game, 1, []);
}

/** Index of the level whose boss has the given type id. */
export const bossIndex = (id) => LEVEL_DEFS.findIndex((_, i) => buildLevel(i).boss && buildLevel(i).boss.type === id);

/** A god-mode world on a flat floor `cols` wide with `rows` rows above the floor line, holding the given spawns. */
export function spawnArena(spawns = [], opts = {}, cols = 90, rows = 14) {
  const lvl = flatLevel(cols, rows);
  lvl.spawns = spawns;
  return new World(lvl, { god: true, ...opts });
}

/**
 * Builds a `stand(world, xTiles, centre?)` that parks the player on a floor at `floorY` pixels and snaps the camera.
 * `centre` shifts half a tile right; `zeroVy` also cancels any vertical speed.
 */
export function makeStand(floorY, { centre = false, zeroVy = false } = {}) {
  return (w, xTiles, centreArg = centre) => {
    w.player.x = xTiles * TILE + (centreArg ? TILE / 2 : 0);
    w.player.y = floorY;
    if (zeroVy) w.player.vy = 0;
    w.camera.snap(w.player);
  };
}
