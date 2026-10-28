// Shared Playwright fixture. `gamePage` opens the game, fails the test on any page error, console error, failed
// request or request to another origin, and waits until `window.__game` (src/main.js) exists.
import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend({
  gamePage: async ({ page, baseURL }, use) => {
    const problems = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()}`));
    page.on('request', (req) => {
      if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) problems.push(`other origin: ${req.url()}`);
    });

    const api = {
      page,
      /** Open the game (relative to baseURL, so it also works under the Pages sub-path) and wait for the Game object. */
      async open(path = './') {
        await page.goto(path);
        await page.waitForFunction(() => window.__game && window.__game.scene);
        return api;
      },
      /** Class name of the active scene, e.g. 'TitleScene'. */
      sceneName: () => page.evaluate(() => window.__game.scene.constructor.name),
      waitForScene: (name, timeout = 5000) =>
        page.waitForFunction((n) => window.__game.scene && window.__game.scene.constructor.name === n, name, { timeout }),
      /** Press and release a key with a short hold so the game's per-frame input poll sees it. */
      async press(key, holdMs = 80) {
        await page.keyboard.down(key);
        await page.waitForTimeout(holdMs);
        await page.keyboard.up(key);
        await page.waitForTimeout(40);
      },
      /** Hold keys for `ms` milliseconds. */
      async hold(keys, ms) {
        for (const k of [].concat(keys)) await page.keyboard.down(k);
        await page.waitForTimeout(ms);
        for (const k of [].concat(keys)) await page.keyboard.up(k);
      },
      /** The player's position and speed once a PlayScene is up. */
      playerState: () =>
        page.evaluate(() => {
          const w = window.__game.scene.world;
          return w ? { x: w.player.x, y: w.player.y, vx: w.player.vx, vy: w.player.vy } : null;
        }),
      problems,
    };
    await use(api);
    expect(problems, 'the page logged errors, failed requests or left its origin').toEqual([]);
  },
});
