// Gamepad support in a real browser. The Gamepad API cannot be driven by Playwright, so an init script replaces
// `navigator.getGamepads` with a controllable fake (standard mapping, 17 buttons, 4 axes) and exposes `window.__pad` to
// press buttons and tilt the stick. Because the API is mocked the specs behave the same in Chromium, Firefox and WebKit.
// Covered: the control labels switch from keyboard names to pad names when a pad connects, the stick and the face
// buttons drive the player, START pauses, and unplugging the pad (`gamepaddisconnected`) opens the pause menu.
import { test, expect } from './fixtures.js';

/** Standard-mapping button indices used by padActions (src/engine/input.js). */
const BTN = { A: 0, B: 1, X: 2, Y: 3, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = { present: false, axes: [0, 0, 0, 0], pressed: new Set() };
    const pad = {
      id: 'Mock Pad (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      get axes() {
        return state.axes.slice();
      },
      get buttons() {
        return Array.from({ length: 17 }, (_, i) => ({ pressed: state.pressed.has(i), touched: state.pressed.has(i), value: state.pressed.has(i) ? 1 : 0 }));
      },
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => (state.present ? [pad, null, null, null] : []) });
    window.__pad = {
      /** Plug the pad in and tell the page, like the browser does after the first button press. */
      connect() {
        state.present = true;
        window.dispatchEvent(new Event('gamepadconnected'));
      },
      /** Unplug it. Real browsers fire the event and stop listing the pad. */
      disconnect() {
        state.present = false;
        window.dispatchEvent(new Event('gamepaddisconnected'));
      },
      /** Unplug without the event (getGamepads just returns nothing). */
      vanish() {
        state.present = false;
      },
      press(i) {
        state.pressed.add(i);
      },
      release(i) {
        state.pressed.delete(i);
      },
      stick(x, y) {
        state.axes = [x, y, 0, 0];
      },
    };
  });
});

/** Press a pad button long enough for several 60 Hz polls. */
async function tapButton(gamePage, index, holdMs = 120) {
  await gamePage.page.evaluate((i) => window.__pad.press(i), index);
  await gamePage.page.waitForTimeout(holdMs);
  await gamePage.page.evaluate((i) => window.__pad.release(i), index);
  await gamePage.page.waitForTimeout(80);
}

const pad = (gamePage, fn, ...args) => gamePage.page.evaluate(([f, a]) => window.__pad[f](...a), [fn, args]);
const label = (gamePage, action) => gamePage.page.evaluate((a) => window.__game.input.label(a), action);

/** Connect the pad, then A on the title and A on the menu's START to reach Level 1. */
async function startLevelWithPad(gamePage) {
  await gamePage.open();
  await gamePage.waitForScene('TitleScene');
  await pad(gamePage, 'connect');
  await gamePage.page.waitForTimeout(300); // the title ignores confirm for its first 0.2 s
  await tapButton(gamePage, BTN.A);
  await gamePage.waitForScene('MenuScene');
  await tapButton(gamePage, BTN.A);
  await gamePage.waitForScene('PlayScene');
  await gamePage.page.waitForFunction(() => window.__game.scene.world);
  await gamePage.page.waitForTimeout(400); // land and settle
}

const paused = (gamePage) => gamePage.page.evaluate(() => window.__game.scene.paused);

test.describe('control labels', () => {
  test('start as keyboard names and become pad names when a pad connects', async ({ gamePage }, testInfo) => {
    await gamePage.open();
    // the phone project starts on the touch names (JUMP, PAUSE) because its touch UI is up
    const mobile = testInfo.project.name === 'mobile';
    expect(await label(gamePage, 'jump')).toBe(mobile ? 'JUMP' : 'Z');
    expect(await label(gamePage, 'pause')).toBe(mobile ? 'PAUSE' : 'ESC');
    await pad(gamePage, 'connect');
    expect(await label(gamePage, 'jump')).toBe('A');
    expect(await label(gamePage, 'fire')).toBe('X');
    expect(await label(gamePage, 'switch')).toBe('Y');
    expect(await label(gamePage, 'bomb')).toBe('B');
    expect(await label(gamePage, 'pause')).toBe('START');
    expect(await label(gamePage, 'move')).toBe('STICK');
    expect(await gamePage.page.evaluate(() => window.__game.input.fill('{jump} TO JUMP, {fire} TO SHOOT'))).toBe('A TO JUMP, X TO SHOOT');
  });

  test('switch back to keyboard names as soon as a key is pressed', async ({ gamePage }) => {
    await gamePage.open();
    await pad(gamePage, 'connect');
    expect(await label(gamePage, 'jump')).toBe('A');
    await gamePage.press('ArrowRight');
    expect(await label(gamePage, 'jump')).toBe('Z');
  });

  test('using the pad after a key press switches the labels back to the pad (not just the connect event)', async ({ gamePage }) => {
    await gamePage.open();
    await pad(gamePage, 'connect');
    await gamePage.press('ArrowRight');
    expect(await label(gamePage, 'jump')).toBe('Z');
    await pad(gamePage, 'stick', 1, 0);
    await gamePage.page.waitForTimeout(150);
    await pad(gamePage, 'stick', 0, 0);
    expect(await label(gamePage, 'jump')).toBe('A');
  });

  test('a pad that is not connected is ignored', async ({ gamePage }, testInfo) => {
    await gamePage.open();
    await gamePage.waitForScene('TitleScene');
    await gamePage.page.waitForTimeout(300);
    await gamePage.page.evaluate(() => window.__pad.press(0)); // never connected: getGamepads lists nothing
    await gamePage.page.waitForTimeout(300);
    expect(await gamePage.sceneName()).toBe('TitleScene');
    expect(await label(gamePage, 'jump')).toBe(testInfo.project.name === 'mobile' ? 'JUMP' : 'Z');
  });
});

test.describe('driving the game with a pad', () => {
  test('A and the menu: the title and the menu accept the pad to start a level', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    expect(await gamePage.sceneName()).toBe('PlayScene');
    expect(await paused(gamePage)).toBe(false);
  });

  test('the left stick pushed right walks right and pushed left walks left, with a dead zone in the middle', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);

    const start = await gamePage.playerState();
    await pad(gamePage, 'stick', 0.2, 0.1); // inside the dead zone
    await gamePage.page.waitForTimeout(400);
    const idle = await gamePage.playerState();
    expect(Math.abs(idle.x - start.x), 'a light touch inside the dead zone does nothing').toBeLessThan(1);

    await pad(gamePage, 'stick', 1, 0);
    // poll rather than sleep: a loaded machine steps the game slower than wall-clock time
    await expect.poll(async () => (await gamePage.playerState()).x, { message: 'walked right', timeout: 5000 }).toBeGreaterThan(idle.x + 20);
    const right = await gamePage.playerState();

    await pad(gamePage, 'stick', -1, 0);
    await expect.poll(async () => (await gamePage.playerState()).x, { message: 'walked back left', timeout: 5000 }).toBeLessThan(right.x - 10);

    await pad(gamePage, 'stick', 0, 0);
    await gamePage.page.waitForTimeout(400);
    const a = await gamePage.playerState();
    await gamePage.page.waitForTimeout(300);
    const b = await gamePage.playerState();
    expect(Math.abs(b.x - a.x), 'stands still with the stick centred').toBeLessThan(1);
  });

  test('the D-pad also walks', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    const before = await gamePage.playerState();
    await pad(gamePage, 'press', BTN.RIGHT);
    await gamePage.page.waitForTimeout(500);
    await pad(gamePage, 'release', BTN.RIGHT);
    expect((await gamePage.playerState()).x).toBeGreaterThan(before.x + 15);
  });

  test('A jumps', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    const before = await gamePage.playerState();
    await pad(gamePage, 'press', BTN.A);
    let minY = before.y;
    for (let i = 0; i < 8; i++) {
      await gamePage.page.waitForTimeout(40);
      minY = Math.min(minY, (await gamePage.playerState()).y);
    }
    await pad(gamePage, 'release', BTN.A);
    expect(minY).toBeLessThan(before.y - 8);
  });

  test('X fires bullets and holding the stick at the same time keeps walking', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    const before = await gamePage.playerState();
    expect(await gamePage.page.evaluate(() => window.__game.scene.world.bullets.length)).toBe(0);
    await pad(gamePage, 'stick', 1, 0);
    await pad(gamePage, 'press', BTN.X);
    await gamePage.page.waitForTimeout(500);
    const bullets = await gamePage.page.evaluate(() => window.__game.scene.world.bullets.length);
    const after = await gamePage.playerState();
    await pad(gamePage, 'release', BTN.X);
    await pad(gamePage, 'stick', 0, 0);
    expect(bullets, 'shots in the air').toBeGreaterThan(0);
    expect(after.x, 'and still walking').toBeGreaterThan(before.x + 20);
  });

  test('the triggers and Y/B map to the weapon swap and bomb actions', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    const held = async (i) => {
      await pad(gamePage, 'press', i);
      await gamePage.page.waitForTimeout(100);
      const h = await gamePage.page.evaluate(() => ({ ...window.__game.input.held }));
      await pad(gamePage, 'release', i);
      await gamePage.page.waitForTimeout(60);
      return h;
    };
    expect((await held(BTN.Y)).switch).toBe(true);
    expect((await held(BTN.B)).bomb).toBe(true);
    expect((await held(7)).fire, 'right trigger fires').toBe(true);
    expect((await held(5)).fire, 'right bumper fires').toBe(true);
  });
});

test.describe('pausing', () => {
  test('START opens the pause menu and START again... resumes through the menu', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    await tapButton(gamePage, BTN.START);
    expect(await paused(gamePage)).toBe(true);
    // the world is frozen while paused
    const a = await gamePage.playerState();
    await pad(gamePage, 'stick', 1, 0);
    await gamePage.page.waitForTimeout(300);
    const b = await gamePage.playerState();
    await pad(gamePage, 'stick', 0, 0);
    expect(b.x).toBeCloseTo(a.x, 5);
    // RESUME is the first entry: A selects it
    await tapButton(gamePage, BTN.A);
    expect(await paused(gamePage)).toBe(false);
  });

  test('unplugging the pad (gamepaddisconnected) pauses the game', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    expect(await paused(gamePage)).toBe(false);
    await pad(gamePage, 'disconnect');
    await gamePage.page.waitForFunction(() => window.__game.scene.paused === true);
    expect(await paused(gamePage)).toBe(true);
  });

  test('an unplugged pad that was holding the stick leaves nothing stuck: resuming on the keyboard stands still', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    await pad(gamePage, 'stick', 1, 0);
    await gamePage.page.waitForTimeout(300);
    await pad(gamePage, 'disconnect');
    await gamePage.page.waitForFunction(() => window.__game.scene.paused === true);
    // resume with the keyboard (Enter confirms RESUME)
    await gamePage.press('Enter');
    await gamePage.page.waitForFunction(() => window.__game.scene.paused === false);
    const a = await gamePage.playerState();
    await gamePage.page.waitForTimeout(500);
    const b = await gamePage.playerState();
    expect(Math.abs(b.x - a.x), 'no phantom stick input after the unplug').toBeLessThan(1);
  });

  test('the title screen survives an unplug (only the play scene pauses)', async ({ gamePage }) => {
    await gamePage.open();
    await pad(gamePage, 'connect');
    await pad(gamePage, 'disconnect');
    await gamePage.page.waitForTimeout(200);
    expect(await gamePage.sceneName()).toBe('TitleScene');
  });

  test('a pad that silently stops being listed (no event) stops driving the player', async ({ gamePage }) => {
    await startLevelWithPad(gamePage);
    await pad(gamePage, 'stick', 1, 0);
    await gamePage.page.waitForTimeout(200);
    await pad(gamePage, 'vanish');
    await gamePage.page.waitForTimeout(100);
    const a = await gamePage.playerState();
    await gamePage.page.waitForTimeout(400);
    const b = await gamePage.playerState();
    expect(Math.abs(b.x - a.x)).toBeLessThan(1);
  });
});
