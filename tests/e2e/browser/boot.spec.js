// @smoke: the page boots cleanly in a real browser: every module loads with a JavaScript MIME type, the canvas has the
// 480x270 backing store and the title scene is showing.
import { test, expect } from './fixtures.js';

test('boots to the title scene with a 480x270 canvas and no errors @smoke', async ({ gamePage }) => {
  const modules = [];
  gamePage.page.on('response', (res) => {
    if (res.url().endsWith('.js')) modules.push({ url: res.url(), status: res.status(), type: res.headers()['content-type'] });
  });
  await gamePage.open();
  await gamePage.waitForScene('TitleScene');

  expect(modules.length).toBeGreaterThan(20);
  for (const m of modules) {
    expect(m.status, m.url).toBe(200);
    expect(m.type, m.url).toMatch(/javascript/);
  }
  const size = await gamePage.page.evaluate(() => ({ w: document.getElementById('game').width, h: document.getElementById('game').height }));
  expect(size).toEqual({ w: 480, h: 270 });
});
