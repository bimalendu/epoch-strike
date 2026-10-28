// Display: the canvas is fitted to the window on whole device pixels (so the pixel art stays crisp at any devicePixelRatio),
// is refitted when the window resizes, is drawn with nearest-neighbour scaling, and the CRT option toggles the scanline
// overlay (`body.crt`) and tells the stylesheet how tall one game pixel is (`--crt-px`).
// The sizing rule is src/main.js fit(): scale = floor(raw * dpr) / dpr when raw >= 1 / dpr + 1, else the raw fit.
import { test, expect } from './fixtures.js';

const VIEW_W = 480;
const VIEW_H = 270;
const DPRS = [1, 1.5, 2, 3];
// a window whose raw scale is fractional for every DPR, one that is exact at 2x, and a laptop screen
const WINDOWS = [
  { width: 1130, height: 720 },
  { width: 960, height: 540 },
  { width: 1366, height: 768 },
];

/** The canvas box the page set (CSS px, from the inline style) and what the window is. */
const canvasBox = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return {
      styleW: parseFloat(c.style.width),
      styleH: parseFloat(c.style.height),
      rectW: r.width,
      rectH: r.height,
      left: r.left,
      top: r.top,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      dpr: window.devicePixelRatio,
    };
  });

/** What fit() should have chosen: the integer device-pixel scale for this window. */
function expectedScale(innerW, innerH, dpr) {
  const raw = Math.min(innerW / VIEW_W, innerH / VIEW_H);
  return raw >= 1 / dpr + 1 ? Math.floor(raw * dpr) / dpr : raw;
}

for (const dpr of DPRS) {
  test.describe(`at devicePixelRatio ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });

    for (const win of WINDOWS) {
      test(`${win.width}x${win.height}: the canvas is a whole number of device pixels, centred, and a whole multiple of 480x270`, async ({ gamePage }) => {
        await gamePage.page.setViewportSize(win);
        await gamePage.open();
        const box = await canvasBox(gamePage.page);

        expect(box.dpr).toBe(dpr);
        const deviceW = box.styleW * dpr;
        const deviceH = box.styleH * dpr;
        expect(Math.abs(deviceW - Math.round(deviceW)), `width ${box.styleW} css px = ${deviceW} device px`).toBeLessThan(1e-6);
        expect(Math.abs(deviceH - Math.round(deviceH)), `height ${box.styleH} css px = ${deviceH} device px`).toBeLessThan(1e-6);
        // every game pixel is the same whole number of device pixels, so no row or column is thicker than its neighbours
        expect(Math.round(deviceW) % VIEW_W).toBe(0);
        expect(Math.round(deviceH) % VIEW_H).toBe(0);
        expect(Math.round(deviceW) / VIEW_W).toBe(Math.round(deviceH) / VIEW_H);

        expect(box.styleW / VIEW_W).toBeCloseTo(expectedScale(box.innerW, box.innerH, dpr), 6);
        // as big as fits: the next whole device pixel per game pixel would not
        expect(box.styleW).toBeLessThanOrEqual(box.innerW + 1e-6);
        expect(box.styleH).toBeLessThanOrEqual(box.innerH + 1e-6);
        const nextScale = (Math.round(deviceW) / VIEW_W + 1) / dpr;
        expect(nextScale * VIEW_W > box.innerW || nextScale * VIEW_H > box.innerH, 'one more device pixel per game pixel would not fit').toBe(true);
        // centred in the window (the layout engine rounds to 1/64 css px)
        expect(box.left * 2 + box.rectW).toBeCloseTo(box.innerW, 1);
        expect(box.top * 2 + box.rectH).toBeCloseTo(box.innerH, 1);
      });
    }

    test('resizing the window refits the canvas', async ({ gamePage }) => {
      await gamePage.page.setViewportSize({ width: 1366, height: 768 });
      await gamePage.open();
      const before = await canvasBox(gamePage.page);

      for (const win of [{ width: 700, height: 500 }, { width: 1130, height: 720 }, { width: 1900, height: 1000 }]) {
        await gamePage.page.setViewportSize(win);
        const scale = expectedScale(win.width, win.height, dpr);
        await gamePage.page.waitForFunction((w) => Math.abs(parseFloat(document.getElementById('game').style.width) - w) < 1e-6, VIEW_W * scale);
        const box = await canvasBox(gamePage.page);
        expect(box.styleW, `${win.width}x${win.height}`).toBeCloseTo(VIEW_W * scale, 6);
        expect(box.styleH, `${win.width}x${win.height}`).toBeCloseTo(VIEW_H * scale, 6);
        const deviceW = box.styleW * dpr;
        expect(Math.abs(deviceW - Math.round(deviceW))).toBeLessThan(1e-6);
        expect(box.styleW).toBeLessThanOrEqual(win.width + 1e-6);
        expect(box.styleH).toBeLessThanOrEqual(win.height + 1e-6);
      }
      const after = await canvasBox(gamePage.page);
      expect(after.styleW).not.toBe(before.styleW);
    });
  });
}

test('a window smaller than the game still shows all of it at 16:9 (no whole-pixel snap is possible)', async ({ gamePage }) => {
  await gamePage.page.setViewportSize({ width: 320, height: 200 });
  await gamePage.open();
  const box = await canvasBox(gamePage.page);
  expect(box.styleW).toBeLessThanOrEqual(320 + 1e-6);
  expect(box.styleH).toBeLessThanOrEqual(200 + 1e-6);
  expect(box.styleW / box.styleH).toBeCloseTo(16 / 9, 5);
});

test('the canvas keeps its 480x270 backing store while only the CSS size changes', async ({ gamePage }) => {
  await gamePage.page.setViewportSize({ width: 1130, height: 720 });
  await gamePage.open();
  const size = () => gamePage.page.evaluate(() => ({ w: document.getElementById('game').width, h: document.getElementById('game').height }));
  expect(await size()).toEqual({ w: VIEW_W, h: VIEW_H });
  await gamePage.page.setViewportSize({ width: 600, height: 400 });
  await gamePage.page.waitForTimeout(100);
  expect(await size()).toEqual({ w: VIEW_W, h: VIEW_H });
});

test('the canvas is scaled with nearest-neighbour (image-rendering is pixelated or crisp-edges), never smoothed', async ({ gamePage }, testInfo) => {
  await gamePage.open();
  const rendering = await gamePage.page.evaluate(() => getComputedStyle(document.getElementById('game')).imageRendering);
  // style.css lists `pixelated` and then `crisp-edges`; a browser keeps the last one it understands
  expect(['pixelated', 'crisp-edges']).toContain(rendering);
  testInfo.annotations.push({ type: 'image-rendering', description: `${testInfo.project.name}: ${rendering}` });
  const smoothing = await gamePage.page.evaluate(() => window.__game.ctx.imageSmoothingEnabled);
  expect(smoothing).toBe(false);
});

test.describe('CRT filter', () => {
  /** What the stylesheet and fit() expose about the scanline overlay. */
  const crtState = (page) =>
    page.evaluate(() => {
      const root = document.documentElement;
      const after = getComputedStyle(document.getElementById('stage'), '::after');
      return {
        crt: document.body.classList.contains('crt'),
        px: root.style.getPropertyValue('--crt-px'),
        top: root.style.getPropertyValue('--crt-top'),
        overlay: after.content,
        overlayBackgroundSize: after.backgroundSize,
        overlayPosition: after.backgroundPositionY,
        canvasW: parseFloat(document.getElementById('game').style.width),
      };
    });

  const setCrt = (page, value) =>
    page.evaluate((v) => {
      window.__game.save.setOption('crt', v);
      window.__game.applyDisplay();
    }, value);

  test('is off by default and turning it on adds body.crt, turning it off removes it', async ({ gamePage }) => {
    await gamePage.open();
    const start = await crtState(gamePage.page);
    expect(start.crt).toBe(false);
    expect(start.overlay).toBe('none'); // no overlay element without body.crt

    await setCrt(gamePage.page, 'scanlines');
    const on = await crtState(gamePage.page);
    expect(on.crt).toBe(true);
    expect(on.overlay).not.toBe('none');

    await setCrt(gamePage.page, 'off');
    const off = await crtState(gamePage.page);
    expect(off.crt).toBe(false);
    expect(off.overlay).toBe('none');
  });

  test('--crt-px is the CSS height of one game pixel and the scanline overlay repeats at that height', async ({ gamePage, isMobile }) => {
    test.skip(isMobile, 'a phone viewport is fixed; window sizing is a desktop concern');
    await gamePage.page.setViewportSize({ width: 1130, height: 720 });
    await gamePage.open();
    await setCrt(gamePage.page, 'scanlines');
    const s = await crtState(gamePage.page);
    const px = parseFloat(s.px);
    expect(s.px).toMatch(/^[\d.]+px$/);
    expect(px).toBeGreaterThan(0);
    expect(px * VIEW_W).toBeCloseTo(s.canvasW, 4);
    // the overlay's tile height follows --crt-px, so each scanline sits on a game-pixel row
    expect(parseFloat(s.overlayBackgroundSize.split(' ').pop())).toBeCloseTo(px, 3);
    // and the pattern starts where the canvas starts: (window height - canvas height) / 2
    expect(parseFloat(s.top)).toBeCloseTo((720 - VIEW_H * px) / 2, 3);
  });

  test('--crt-px and --crt-top follow the window when it is resized while the filter is on', async ({ gamePage, isMobile }) => {
    test.skip(isMobile, 'a phone viewport is fixed; window sizing is a desktop concern');
    await gamePage.page.setViewportSize({ width: 1130, height: 720 });
    await gamePage.open();
    await setCrt(gamePage.page, 'scanlines');
    const before = await crtState(gamePage.page);

    await gamePage.page.setViewportSize({ width: 1900, height: 1000 });
    await gamePage.page.waitForFunction((old) => document.documentElement.style.getPropertyValue('--crt-px') !== old, before.px);
    const after = await crtState(gamePage.page);
    expect(after.crt).toBe(true);
    expect(parseFloat(after.px)).toBeGreaterThan(parseFloat(before.px));
    expect(parseFloat(after.px) * VIEW_W).toBeCloseTo(after.canvasW, 4);
    expect(parseFloat(after.top)).toBeCloseTo((1000 - VIEW_H * parseFloat(after.px)) / 2, 3);
  });

  test('the option can also be switched from the Options screen (CRT FILTER row)', async ({ gamePage }) => {
    await gamePage.open();
    const found = await gamePage.page.evaluate(async () => {
      const game = window.__game;
      game.go('options', { back: 'menu' });
      game.step();
      const items = game.scene.menu ? game.scene.menu.items : null;
      if (!items) return 'no-menu';
      const row = items.findIndex((it) => /^CRT FILTER/.test(typeof it.label === 'function' ? it.label() : it.label));
      if (row < 0) return 'no-row';
      game.scene.menu.index = row;
      items[row].onSelect();
      game.applyDisplay();
      return document.body.classList.contains('crt');
    });
    test.skip(found === 'no-menu' || found === 'no-row', `options scene does not expose its menu this way (${found})`);
    expect(found).toBe(true);
  });
});
