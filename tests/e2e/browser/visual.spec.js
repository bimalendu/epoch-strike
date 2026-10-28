// Visual regression (Chromium only): a screenshot of the game canvas for the title, the menu, the first frame of Level 1
// and a boss entrance. The loop is frozen and the scenes are stepped by hand in fixed 1/60 s steps, so each frame is a
// pure function of the code. Only the canvas element is captured (never the page), at exactly 2x (a 960x540 window), so
// fonts and browser chrome of the host OS do not matter and one baseline serves every platform
// (see snapshotPathTemplate in playwright.config.js). Update with `npm run e2e:update -- visual --project=chromium`.
import { test, expect } from './fixtures.js';
import { freezeLoop, startLevel, stepGame } from './frame.js';

test.beforeEach(({}, testInfo) => {
  // the mobile project is Chromium too, so look at the project's name rather than the browser's
  test.skip(testInfo.project.name !== 'chromium', 'pixel baselines are kept for the desktop Chromium project only');
});
test.use({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });

/** Open the game, stop the real loop and hand the canvas back. */
async function frozenGame(gamePage) {
  await gamePage.open();
  await gamePage.waitForScene('TitleScene');
  await freezeLoop(gamePage.page);
  return gamePage.page.locator('#game');
}

test('title screen', async ({ gamePage }) => {
  const canvas = await frozenGame(gamePage);
  await gamePage.page.evaluate(() => window.__game.go('title'));
  await stepGame(gamePage.page, 90);
  await expect(canvas).toHaveScreenshot('title.png');
});

test('main menu', async ({ gamePage }) => {
  const canvas = await frozenGame(gamePage);
  await gamePage.page.evaluate(() => window.__game.go('menu'));
  await stepGame(gamePage.page, 30);
  await expect(canvas).toHaveScreenshot('menu.png');
});

test('first frame of Level 1', async ({ gamePage }) => {
  const canvas = await frozenGame(gamePage);
  await startLevel(gamePage.page, 0, 0);
  expect(await gamePage.sceneName()).toBe('PlayScene');
  await expect(canvas).toHaveScreenshot('level01-first-frame.png');
});

test('boss entrance (Level 1)', async ({ gamePage }) => {
  const canvas = await frozenGame(gamePage);
  await startLevel(gamePage.page, 0, 140); // past the level's name card
  // put the soldier just short of the arena's trigger line, walk in and step until the boss's name plate is up
  const state = await gamePage.page.evaluate(() => {
    const game = window.__game;
    const world = game.scene.world;
    const arena = game.scene.level.boss;
    world.player.x = arena.trigger - 4;
    world.player.y = arena.floorY;
    world.camera.snap(world.player);
    game.input.script = { right: true };
    for (let i = 0; i < 900; i++) {
      game.step();
      const bs = world.boss && world.boss.bs;
      if (bs && bs.state === 'enter' && bs.age > 0.9) break;
    }
    game.render();
    return world.boss && world.boss.bs ? world.boss.bs.state : 'no boss';
  });
  expect(state).toBe('enter');
  await expect(canvas).toHaveScreenshot('boss01-intro.png');
});
