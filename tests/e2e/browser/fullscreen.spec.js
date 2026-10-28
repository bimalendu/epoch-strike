// Fullscreen (F or F11, wired in src/main.js): F enters fullscreen and F leaves it again, and the canvas is refitted to
// the new viewport on `fullscreenchange`. When the browser REFUSES the request (iframe without `allow=fullscreen`,
// permissions policy, no user activation) the returned promise rejects; that must not surface as an unhandled
// rejection (the fixture fails every test on a `pageerror`).
import { test, expect } from './fixtures.js';

const canvasWidth = (g) => g.page.evaluate(() => document.getElementById('game').getBoundingClientRect().width);

test('F enters and leaves fullscreen and the canvas refits', async ({ gamePage: g, browserName, isMobile }) => {
  test.skip(browserName === 'webkit', 'headless WebKit has no usable Fullscreen API');
  test.skip(isMobile, 'a phone viewport is fixed; window sizing is a desktop concern');
  await g.open();
  await g.page.setViewportSize({ width: 960, height: 540 });
  await g.page.waitForFunction(() => document.getElementById('game').getBoundingClientRect().width === 960);
  const windowed = await canvasWidth(g);

  await g.page.keyboard.press('KeyF'); // enter
  const entered = await g.page
    .waitForFunction(() => document.fullscreenElement !== null, null, { timeout: 3000 })
    .then(() => true, () => false);
  test.skip(!entered, 'this headless browser did not grant fullscreen');

  // headless browsers keep the window size in fullscreen, so prove the refit by making the canvas stale and checking that
  // the fullscreenchange handler (not a resize) puts it back; the same on the way out
  const stale = () => document.getElementById('game').style.setProperty('width', '1px');
  await g.page.evaluate(stale);
  await g.page.keyboard.press('KeyF'); // leave fullscreen
  await g.page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 3000 });
  await g.page.waitForFunction((w) => document.getElementById('game').getBoundingClientRect().width === w, windowed);
  const ratio = await g.page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect();
    return r.width / r.height;
  });
  expect(ratio).toBeCloseTo(16 / 9, 2);

  await g.page.evaluate(stale);
  await g.page.keyboard.press('KeyF'); // and enter once more
  await g.page.waitForFunction(() => document.fullscreenElement !== null, null, { timeout: 3000 });
  await g.page.waitForFunction((w) => document.getElementById('game').getBoundingClientRect().width === w, windowed);
  await g.page.keyboard.press('KeyF');
  await g.page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 3000 });
});

test('a refused fullscreen request leaves the game running with no unhandled rejection', async ({ gamePage: g }) => {
  await g.page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied'));
    window.__unhandled = [];
    window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason && e.reason.message)));
  });
  await g.open();
  await g.waitForScene('TitleScene');
  await g.press('KeyF');
  await g.page.waitForTimeout(300); // let the rejected promise reach the unhandled-rejection hook
  expect(await g.page.evaluate(() => window.__unhandled)).toEqual([]);
  expect(await g.page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(await g.sceneName()).toBe('TitleScene'); // still running: Enter still works
  await g.page.waitForTimeout(300);
  await g.press('Enter');
  await g.waitForScene('MenuScene');
});

test('a refused exit request leaves the game running with no unhandled rejection', async ({ gamePage: g }) => {
  await g.page.addInitScript(() => {
    // pretend we are fullscreen and make leaving fail
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
    document.exitFullscreen = () => Promise.reject(new Error('cannot exit'));
    window.__unhandled = [];
    window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason && e.reason.message)));
  });
  await g.open();
  await g.waitForScene('TitleScene');
  await g.press('KeyF');
  await g.page.waitForTimeout(300);
  expect(await g.page.evaluate(() => window.__unhandled)).toEqual([]);
  expect(await g.sceneName()).toBe('TitleScene');
});
