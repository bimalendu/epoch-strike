// Helpers for specs that drive the game by hand instead of letting the requestAnimationFrame loop run it.
// `freezeLoop` stops the real loop (so nothing moves between a test's steps); `stepGame` / `renderGame` then advance the
// same fixed 1/60 s steps the loop would, so a frame is a pure function of the scripted input.

/** Stop the game's rAF loop. The callback already in flight finishes, schedules nothing, and the page is still. */
export async function freezeLoop(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
  // one animation frame lets the in-flight loop callback run and end
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 60)));
}

/** Run `n` fixed steps with the given actions held ('right', 'fire', ...), then draw once. */
export function stepGame(page, n, keys = []) {
  return page.evaluate(
    ([count, held]) => {
      const game = window.__game;
      const script = {};
      for (const k of held) script[k] = true;
      game.input.script = script;
      for (let i = 0; i < count; i++) game.step();
      game.render();
    },
    [n, keys],
  );
}

/** Start a level in god mode with a fresh Run and drive it `n` steps. */
export function startLevel(page, levelIndex, n = 0, keys = []) {
  return page.evaluate(
    async ([index, count, held]) => {
      const { Run } = await import('/src/game/run.js');
      const game = window.__game;
      game.input.script = {};
      game.save.setOption('shake', false); // the camera shake draws on Math.random, so frames would differ run to run
      game.go('play', { run: new Run(), levelIndex: index, god: true });
      const script = {};
      for (const k of held) script[k] = true;
      game.input.script = script;
      for (let i = 0; i < count + 1; i++) game.step();
      game.render();
    },
    [levelIndex, n, keys],
  );
}
