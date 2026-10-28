// Losing focus must not leave the player running into a wall of enemies: a window `blur` or the tab becoming hidden
// (`visibilitychange`) opens the pause menu of the level and lets go of every held key, because the matching key-up
// would never arrive. Both events are dispatched on the real page; for visibility the document's `hidden` flag is
// overridden first, as the browser itself would report it.
import { test, expect } from './fixtures.js';

async function startLevel(g) {
  await g.open();
  await g.waitForScene('TitleScene');
  await g.page.waitForTimeout(300);
  await g.press('Enter');
  await g.waitForScene('MenuScene');
  await g.press('Enter');
  await g.waitForScene('PlayScene');
}

const isPaused = (g) => g.page.evaluate(() => window.__game.scene.paused);
const rightHeld = (g) => g.page.evaluate(() => window.__game.input.held.right);

test('window blur pauses the level and releases held keys', async ({ gamePage: g }) => {
  await startLevel(g);
  await g.page.keyboard.down('ArrowRight');
  await g.page.waitForFunction(() => window.__game.input.held.right === true);
  expect(await isPaused(g)).toBe(false);

  await g.page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await g.page.waitForFunction(() => window.__game.scene.paused === true);
  await g.page.waitForFunction(() => window.__game.input.held.right === false);
  expect(await rightHeld(g)).toBe(false);

  // the key is still physically down, but the game must not see it again until it is pressed anew
  await g.page.waitForTimeout(200);
  expect(await rightHeld(g)).toBe(false);
  await g.page.keyboard.up('ArrowRight');
});

test('the tab being hidden pauses the level and releases held keys', async ({ gamePage: g }) => {
  await startLevel(g);
  await g.page.keyboard.down('ArrowRight');
  await g.page.waitForFunction(() => window.__game.input.held.right === true);

  await g.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await g.page.waitForFunction(() => window.__game.scene.paused === true);
  await g.page.waitForFunction(() => window.__game.input.held.right === false);
  await g.page.keyboard.up('ArrowRight');
});

test('becoming visible again does not pause a level that is running', async ({ gamePage: g }) => {
  await startLevel(g);
  await g.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await g.page.waitForTimeout(200);
  expect(await isPaused(g)).toBe(false);
});

test('a blurred, paused level resumes from the pause menu', async ({ gamePage: g }) => {
  await startLevel(g);
  await g.page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await g.page.waitForFunction(() => window.__game.scene.paused === true);
  await g.press('Enter'); // RESUME is the first item
  await g.page.waitForFunction(() => window.__game.scene.paused === false);
  expect(await g.sceneName()).toBe('PlayScene');
});
