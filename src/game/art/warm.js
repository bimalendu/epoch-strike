// Art warm-up. Every sprite, backdrop layer and enemy frame set is painted on first use and cached; painting a
// 480x270 parallax layer or a 140x150 boss sheet in the middle of a fight is a visible hitch. This module lists all of
// that work as small tasks that the browser runs a few milliseconds per frame while the title screen is up, so by the
// time a level starts everything is already in the caches. Nothing here is required for correctness: a sprite that was
// not warmed in time is simply painted when it is first drawn, as before.

import { THEMES } from './themes.js';
import { sceneryLayer } from './scenery.js';
import { enemyFrames } from './enemies.js';
import { ENEMY_DEFS } from '../enemy_defs.js';
import '../bosses.js'; // registers every boss def before the list below is built
import { playerSprites } from './player.js';
import { gunSprites } from './guns.js';
import { WEAPONS } from '../weapons.js';
import { warmFx, warmFall } from './fx.js';
import { warmHitFrames } from './hit.js';
import { skyCanvas } from './sky.js';
import { warmRelief } from './relief.js';
import { fogStrip } from './weather.js';
import { frontStrip } from './front.js';
import { warmGlow } from './glow.js';
import { warmVignette } from './vignette.js';
import { warmHud } from './hud.js';
import { warmPickups } from './pickups.js';

/** The list of warm-up tasks, cheapest-first isn't important: each is one cache fill. */
export function warmTasks() {
  const tasks = [];
  for (const [id, theme] of Object.entries(THEMES)) {
    (theme.layers || []).forEach((layer, i) => tasks.push({ name: `scenery ${id}:${i}`, run: () => sceneryLayer(`${theme.id || id}:${i}`, layer, theme) }));
  }
  for (const [id, theme] of Object.entries(THEMES)) tasks.push({ name: `sky ${id}`, run: () => skyCanvas({ ...theme, id }) });
  for (const [id, theme] of Object.entries(THEMES)) tasks.push({ name: `relief ${id}`, run: () => warmRelief(theme.id || id, theme) });
  for (const [id, theme] of Object.entries(THEMES)) {
    if (theme.weather && theme.weather.fog) tasks.push({ name: `fog ${id}`, run: () => fogStrip(theme.id || id, theme.weather.fog) });
    if (theme.front) tasks.push({ name: `front ${id}`, run: () => [0.7, 0.3].forEach((c) => frontStrip(theme.id || id, theme.front, c)) });
  }
  for (const [id, def] of Object.entries(ENEMY_DEFS)) tasks.push({ name: `enemy ${id}`, run: () => { const f = enemyFrames(def); warmHitFrames(f); warmFall(f); } });
  tasks.push({ name: 'player', run: () => playerSprites() });
  for (const id of Object.keys(WEAPONS)) tasks.push({ name: `gun ${id}`, run: () => gunSprites(id) });
  tasks.push({ name: 'effects', run: () => warmFx() });
  tasks.push({ name: 'hud', run: () => warmHud() });
  tasks.push({ name: 'glow', run: () => warmGlow() });
  tasks.push({ name: 'vignette', run: () => warmVignette('dark') });
  tasks.push({ name: 'vignette red', run: () => warmVignette('red') });
  tasks.push({ name: 'pickups', run: () => warmPickups() });
  return tasks;
}

/**
 * A time-sliced runner. `step(budgetMs)` runs tasks until the budget is spent (always at least one) and returns how many
 * are left; call it once per animation frame until `done`.
 */
export function createWarmer(tasks = warmTasks(), now = () => globalThis.performance.now()) {
  let i = 0;
  return {
    get total() { return tasks.length; },
    get done() { return i >= tasks.length; },
    get remaining() { return tasks.length - i; },
    step(budgetMs = 5) {
      const t0 = now();
      while (i < tasks.length) {
        tasks[i++].run();
        if (now() - t0 >= budgetMs) break;
      }
      return tasks.length - i;
    },
  };
}
