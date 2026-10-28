// @smoke: the keyboard drives the real game in a real browser. Real key events (using the bindings in
// src/engine/input.js) take the game from the title screen through the menu into a level; holding Right moves the
// player and Jump lifts them; Escape opens the pause menu and QUIT TO MENU goes back. The keys the game uses must
// not also scroll the page (arrows, Space) or navigate away (Backspace).
import { test, expect } from './fixtures.js';

/** Title -> menu -> level 1, with real Enter presses. */
async function startLevel(g) {
  await g.open();
  await g.waitForScene('TitleScene');
  await g.page.waitForTimeout(300); // the title ignores confirm for its first 0.2 s
  await g.press('Enter');
  await g.waitForScene('MenuScene');
  await g.press('Enter'); // START is the first menu item
  await g.waitForScene('PlayScene');
}

test('real key presses take the game from title to menu to a level @smoke', async ({ gamePage: g }) => {
  await startLevel(g);
  expect(await g.sceneName()).toBe('PlayScene');
  expect(await g.playerState()).not.toBeNull();
});

test('holding Right moves the player and Z (jump) lifts them off the ground', async ({ gamePage: g }) => {
  await startLevel(g);
  const before = await g.playerState();
  await g.hold('ArrowRight', 600);
  const after = await g.playerState();
  expect(after.x).toBeGreaterThan(before.x + 10);

  // jump from standing still and sample the height at the top of the arc
  await g.page.waitForFunction(() => Math.abs(window.__game.scene.world.player.vx) < 1);
  const ground = await g.playerState();
  await g.page.keyboard.down('KeyZ');
  const apex = await g.page.evaluate(
    () =>
      new Promise((resolve) => {
        const p = window.__game.scene.world.player;
        const start = p.y;
        let min = p.y;
        const t0 = performance.now();
        const tick = () => {
          min = Math.min(min, p.y);
          if (performance.now() - t0 > 500) resolve(start - min);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  await g.page.keyboard.up('KeyZ');
  expect(ground.vy).toBeLessThanOrEqual(1);
  expect(apex).toBeGreaterThan(8); // pixels risen above the standing height
});

test('Escape pauses the level and QUIT TO MENU returns to the main menu', async ({ gamePage: g }) => {
  await startLevel(g);
  await g.press('Escape');
  await g.page.waitForFunction(() => window.__game.scene.paused === true);

  // the pause menu is RESUME, RESTART LEVEL, OPTIONS, QUIT TO MENU
  for (let i = 0; i < 3; i++) await g.press('ArrowDown');
  await g.press('Enter');
  await g.waitForScene('MenuScene');
});

test('arrow keys and Space never scroll the page and Backspace never navigates away', async ({ gamePage: g }) => {
  await startLevel(g);
  // make the document scrollable so a leaked default action would visibly scroll it
  await g.page.evaluate(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const pad = document.createElement('div');
    pad.id = 'scroll-pad';
    pad.style.cssText = 'height:4000px;width:4000px;position:absolute;top:0;left:0;pointer-events:none';
    document.body.appendChild(pad);
  });
  const urlBefore = g.page.url();
  // this listener is added after the game's, so it sees whether the game called preventDefault()
  await g.page.evaluate(() => {
    window.__seen = {};
    window.addEventListener('keydown', (e) => (window.__seen[e.code] = e.defaultPrevented));
  });
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Space', 'Backspace']) await g.press(key);
  const scroll = await g.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, seen: window.__seen }));
  expect(scroll.x).toBe(0);
  expect(scroll.y).toBe(0);
  expect(g.page.url()).toBe(urlBefore);
  // every one of those keys was claimed by the game
  for (const code of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Space', 'Backspace']) {
    expect(scroll.seen[code], code).toBe(true);
  }
});
