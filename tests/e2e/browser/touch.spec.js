// On-screen touch controls (#touch, src/engine/input.js `_attachTouch`).
//
// The mobile project (Pixel 7: coarse pointer + touch) is where the controls must show up and work. Real touches are sent
// through the Chrome DevTools Protocol (`Input.dispatchTouchEvent`), which is the only way to hold several fingers at
// once, so the multi-touch specs run in Chromium only (the mobile project is Chromium; Firefox and WebKit skip them).
// A desktop pointer must never see the controls unless the player turns them on in Options.
import { test, expect } from './fixtures.js';

const isMobile = (testInfo) => testInfo.project.name === 'mobile';

/** A finger-level touch driver on one CDP session. Every event carries the full list of fingers currently down. */
async function fingers(page) {
  const cdp = await page.context().newCDPSession(page);
  const down = new Map(); // id -> {x, y}
  const send = (type) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [...down].map(([id, p]) => ({ x: p.x, y: p.y, id })),
    });
  return {
    async start(id, x, y) {
      down.set(id, { x, y });
      await send('touchStart');
    },
    async move(id, x, y) {
      down.set(id, { x, y });
      await send('touchMove');
    },
    async end(id) {
      // CDP: touchEnd takes no points and lifts every finger; to lift one, send the remaining ones in a touchMove
      down.delete(id);
      if (down.size === 0) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await send('touchMove');
    },
    /** Press and release one finger, holding long enough for several 60 Hz input polls. */
    async tap(x, y, holdMs = 120) {
      const id = 90 + down.size;
      await this.start(id, x, y);
      await page.waitForTimeout(holdMs);
      await this.end(id);
      await page.waitForTimeout(60);
    },
  };
}

/** Centre of an element in CSS pixels (the coordinates Input.dispatchTouchEvent uses). */
async function centre(page, selector) {
  const box = await page.locator(selector).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height };
}

/** Title -> menu -> Level 1 with taps on the on-screen FIRE button (it confirms in menus). */
async function startLevelWithTouch(gamePage, touch) {
  await gamePage.open();
  await gamePage.waitForScene('TitleScene');
  const fire = await centre(gamePage.page, '.tbtn[data-act="fire"]');
  await gamePage.page.waitForTimeout(300); // the title ignores confirm for its first 0.2 s
  await touch.tap(fire.x, fire.y);
  await gamePage.waitForScene('MenuScene');
  await touch.tap(fire.x, fire.y); // START is the first entry of a fresh save
  await gamePage.waitForScene('PlayScene');
  await gamePage.page.waitForFunction(() => window.__game.scene.world);
  return fire;
}

test.describe('touch controls on a phone', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(!isMobile(testInfo), 'needs a coarse pointer and touch: only the mobile project has them');
    test.skip(browserName !== 'chromium', 'touches are sent through the Chrome DevTools Protocol');
  });

  test('the controls are visible from the start, with the stick and all five buttons', async ({ gamePage }) => {
    await gamePage.open();
    await expect(gamePage.page.locator('#touch')).toBeVisible();
    await expect(gamePage.page.locator('#stick')).toBeVisible();
    for (const act of ['jump', 'fire', 'switch', 'bomb', 'pause']) {
      await expect(gamePage.page.locator(`.tbtn[data-act="${act}"]`), act).toBeVisible();
    }
    expect(await gamePage.page.evaluate(() => window.__game.input.label('jump'))).toBe('JUMP');
  });

  test('touch alone gets from the title screen into Level 1', async ({ gamePage }) => {
    const touch = await fingers(gamePage.page);
    await startLevelWithTouch(gamePage, touch);
    expect(await gamePage.sceneName()).toBe('PlayScene');
  });

  test('the JUMP button lifts the player off the ground', async ({ gamePage }) => {
    const touch = await fingers(gamePage.page);
    await startLevelWithTouch(gamePage, touch);
    await gamePage.page.waitForTimeout(500); // settle on the ground
    const before = await gamePage.playerState();
    const jump = await centre(gamePage.page, '.tbtn[data-act="jump"]');

    await touch.start(1, jump.x, jump.y);
    let minY = before.y;
    for (let i = 0; i < 8; i++) {
      await gamePage.page.waitForTimeout(40);
      minY = Math.min(minY, (await gamePage.playerState()).y);
    }
    await touch.end(1);
    await expect(gamePage.page.locator('.tbtn[data-act="jump"]')).not.toHaveClass(/down/);
    expect(minY, 'the soldier rose').toBeLessThan(before.y - 8);
  });

  test('dragging the stick right walks the player right, and letting go stops them', async ({ gamePage }) => {
    const touch = await fingers(gamePage.page);
    await startLevelWithTouch(gamePage, touch);
    await gamePage.page.waitForTimeout(300);
    const before = await gamePage.playerState();
    const stick = await centre(gamePage.page, '#stick');

    await touch.start(1, stick.x, stick.y);
    await touch.move(1, stick.x + stick.w * 0.45, stick.y);
    await gamePage.page.waitForTimeout(600);
    const knob = await gamePage.page.evaluate(() => document.getElementById('knob').style.transform);
    const moving = await gamePage.playerState();
    await touch.end(1);
    await gamePage.page.waitForTimeout(500);
    const stopped = await gamePage.playerState();
    await gamePage.page.waitForTimeout(300);
    const later = await gamePage.playerState();

    expect(moving.x, 'walked right while the stick was held').toBeGreaterThan(before.x + 20);
    expect(knob, 'the knob follows the finger').toContain('translate');
    expect(await gamePage.page.evaluate(() => document.getElementById('knob').style.transform), 'the knob recentres').toBe('');
    expect(Math.abs(later.x - stopped.x), 'stopped after release').toBeLessThan(1);
  });

  test('a dragged stick left walks the player left', async ({ gamePage }) => {
    const touch = await fingers(gamePage.page);
    await startLevelWithTouch(gamePage, touch);
    // walk right first so there is room to go back
    const stick = await centre(gamePage.page, '#stick');
    await touch.start(1, stick.x, stick.y);
    await touch.move(1, stick.x + stick.w * 0.45, stick.y);
    await gamePage.page.waitForTimeout(500);
    await touch.move(1, stick.x - stick.w * 0.45, stick.y);
    await gamePage.page.waitForTimeout(100);
    const a = await gamePage.playerState();
    await gamePage.page.waitForTimeout(400);
    const b = await gamePage.playerState();
    await touch.end(1);
    expect(b.x).toBeLessThan(a.x - 10);
  });

  test('the stick and FIRE work at the same time (two fingers)', async ({ gamePage }) => {
    const touch = await fingers(gamePage.page);
    await startLevelWithTouch(gamePage, touch);
    await gamePage.page.waitForTimeout(300);
    const before = await gamePage.playerState();
    const stick = await centre(gamePage.page, '#stick');
    const fire = await centre(gamePage.page, '.tbtn[data-act="fire"]');

    await touch.start(1, stick.x, stick.y);
    await touch.move(1, stick.x + stick.w * 0.45, stick.y);
    await touch.start(2, fire.x, fire.y);
    await gamePage.page.waitForTimeout(500);
    const held = await gamePage.page.evaluate(() => ({ ...window.__game.input.held }));
    const bullets = await gamePage.page.evaluate(() => window.__game.scene.world.bullets.length);
    const after = await gamePage.playerState();
    await touch.end(2);
    await gamePage.page.waitForTimeout(100);
    const stillMoving = await gamePage.page.evaluate(() => window.__game.input.held.right);
    await touch.end(1);

    expect(held.right && held.fire, 'both actions held at once').toBe(true);
    expect(bullets, 'shots are in the air').toBeGreaterThan(0);
    expect(after.x, 'and the soldier is still walking').toBeGreaterThan(before.x + 20);
    expect(stillMoving, 'lifting the FIRE finger leaves the stick held').toBe(true);
  });

  test('the Options setting overrides the device: OFF hides the controls and ON shows them again', async ({ gamePage }) => {
    await gamePage.open();
    const touchEl = gamePage.page.locator('#touch');
    await expect(touchEl).toBeVisible();
    await gamePage.page.evaluate(() => window.__game.input.setTouchMode('off'));
    await expect(touchEl).toBeHidden();
    await gamePage.page.evaluate(() => window.__game.input.setTouchMode('on'));
    await expect(touchEl).toBeVisible();
    await gamePage.page.evaluate(() => window.__game.input.setTouchMode('auto'));
    await expect(touchEl, 'AUTO on a touch device shows them').toBeVisible();
  });

  test('the context menu is suppressed on the stick and every button, including on a long press', async ({ gamePage }) => {
    await gamePage.open();
    const results = await gamePage.page.evaluate(() => {
      const out = {};
      for (const sel of ['#stick', '#knob', '#touch', ...[...document.querySelectorAll('.tbtn')].map((b) => `.tbtn[data-act="${b.dataset.act}"]`)]) {
        const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.querySelector(sel).dispatchEvent(ev);
        out[sel] = ev.defaultPrevented;
      }
      return out;
    });
    for (const [sel, prevented] of Object.entries(results)) expect(prevented, `contextmenu on ${sel} is cancelled`).toBe(true);

    // a real long press: whatever contextmenu event the browser raises must be cancelled
    await gamePage.page.evaluate(() => {
      window.__ctx = [];
      document.addEventListener('contextmenu', (e) => setTimeout(() => window.__ctx.push(e.defaultPrevented), 0), true);
    });
    const touch = await fingers(gamePage.page);
    const jump = await centre(gamePage.page, '.tbtn[data-act="jump"]');
    await touch.tap(jump.x, jump.y, 900);
    const seen = await gamePage.page.evaluate(() => window.__ctx);
    expect(seen.every(Boolean), `long press contextmenu events: ${JSON.stringify(seen)}`).toBe(true);
  });

  test('the page cannot scroll or zoom: touch-action none, no zoom in the viewport, a swipe and a pinch change nothing', async ({ gamePage }) => {
    await gamePage.open();
    const page = gamePage.page;

    // declared intent
    const viewport = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
    expect(viewport).toMatch(/user-scalable=no/);
    expect(viewport).toMatch(/maximum-scale=1\b/);
    const touchAction = await page.evaluate(() =>
      Object.fromEntries(
        ['html', 'body', '#stick', '.tbtn[data-act="jump"]'].map((s) => [s, getComputedStyle(document.querySelector(s)).touchAction]),
      ),
    );
    for (const [sel, ta] of Object.entries(touchAction)) expect(ta, `touch-action of ${sel}`).toBe('none');
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).toBe('hidden');

    // observed behaviour: a vertical swipe on the canvas and a two-finger pinch move nothing
    const touch = await fingers(page);
    const vp = page.viewportSize();
    await touch.start(1, vp.width / 2, vp.height * 0.6);
    for (let i = 1; i <= 8; i++) await touch.move(1, vp.width / 2, vp.height * 0.6 - i * 30);
    await touch.end(1);
    await touch.start(2, vp.width / 2 - 20, vp.height / 2);
    await touch.start(3, vp.width / 2 + 20, vp.height / 2);
    for (let i = 1; i <= 8; i++) {
      await touch.move(2, vp.width / 2 - 20 - i * 15, vp.height / 2);
      await touch.move(3, vp.width / 2 + 20 + i * 15, vp.height / 2);
    }
    await touch.end(3);
    await touch.end(2);
    await page.waitForTimeout(200);
    const view = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      scale: window.visualViewport.scale,
      overflows: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    }));
    expect(view.scale, 'pinch must not zoom').toBe(1);
    expect(view.scrollY).toBe(0);
    expect(view.scrollX).toBe(0);
    expect(view.overflows, 'the document is no taller than the screen').toBe(false);
  });
});

test.describe('touch controls on a desktop', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(isMobile(testInfo), 'the mobile project has a coarse pointer');
  });

  test('AUTO keeps the controls hidden for a mouse and keyboard player', async ({ gamePage }) => {
    await gamePage.open();
    await expect(gamePage.page.locator('#touch')).toBeHidden();
    expect(await gamePage.page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    expect(await gamePage.page.evaluate(() => window.__game.input.touchMode)).toBe('auto');
    expect(await gamePage.page.evaluate(() => window.__game.input.label('jump'))).toBe('Z');
  });

  test('ON shows them for a desktop player and OFF hides them again; the choice is the saved option', async ({ gamePage }) => {
    await gamePage.open();
    const touchEl = gamePage.page.locator('#touch');
    await gamePage.page.evaluate(() => {
      window.__game.save.setOption('touch', 'on');
      window.__game.input.setTouchMode('on');
    });
    await expect(touchEl).toBeVisible();
    await gamePage.page.evaluate(() => {
      window.__game.save.setOption('touch', 'off');
      window.__game.input.setTouchMode('off');
    });
    await expect(touchEl).toBeHidden();
  });

  test('the first real touch reveals the controls under AUTO and OFF still wins', async ({ gamePage }) => {
    await gamePage.open();
    const touchEl = gamePage.page.locator('#touch');
    await expect(touchEl).toBeHidden();
    await gamePage.page.evaluate(() => window.dispatchEvent(new Event('touchstart')));
    await expect(touchEl).toBeVisible();
    expect(await gamePage.page.evaluate(() => window.__game.input.label('fire'))).toBe('FIRE');
    await gamePage.page.evaluate(() => window.__game.input.setTouchMode('off'));
    await expect(touchEl).toBeHidden();
  });
});
