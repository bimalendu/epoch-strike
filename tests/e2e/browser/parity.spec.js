// Parity: CLAUDE.md promises the game renders identically in a browser and in the software canvas (tools/softcanvas.js).
// The software frames come from tools/parity.mjs (`npm run parity` writes fixtures/parity.json); the very same scenario
// function is shipped into the page and run there with a real <canvas>, driven by hand in fixed steps (not the rAF loop).
// Frames: title, Level 1 at step 120, one frame for each later era group, and a boss entrance.
//
// A pixel "differs" when any channel is off by more than CHANNEL_SLACK; at most MAX_DIFF_RATIO (0.1%) of the pixels may differ.
//
// Why a channel slack at all: measured against the software canvas, large soft-edged areas (the sky and the haze on the
// parallax layers, which are painted into offscreen canvases and composited with drawImage) are off by a few levels:
// up to 9 of 255 in Chromium and Firefox, up to 1 in WebKit. The likely cause is that a browser stores those layers as
// premultiplied 8-bit and rounds every composite while the software canvas blends in floating point. On Level 5 about
// 85 pixels per frame (0.07%) in Chromium and WebKit are off by 17-38 (a dotted row of the warm sky); side by side the
// frames are indistinguishable. A slack of 16 keeps the 0.1% rule meaningful: any real drawing difference (a missing
// sprite, a shifted layer, a wrong colour) changes thousands of pixels by far more than that.
import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { parityScenario, renderSoftFrames, unpackFrames, FIXTURE_PATH } from '../../../tools/parity.mjs';
import { encodePNG } from '../../../tools/png.js';
import { freezeLoop } from './frame.js';

const MAX_DIFF_RATIO = 0.001;
const CHANNEL_SLACK = 16;

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const expected = unpackFrames(fixture);

/** Count pixels where any RGBA channel differs by more than `slack`; also report the biggest channel difference. */
function compare(a, b, slack) {
  let differing = 0;
  let worst = 0;
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    if (d > slack) differing++;
    if (d > worst) worst = d;
  }
  return { differing, worst, ratio: differing / (a.length / 4) };
}

const fromBase64 = (s) => new Uint8ClampedArray(Buffer.from(s, 'base64'));

test.describe('browser and software canvas render the same frames', () => {
  test('the stored fixture is what the software canvas renders now (run `npm run parity` after changing art)', async () => {
    const fresh = await renderSoftFrames();
    expect(Object.keys(fresh).sort()).toEqual(Object.keys(expected).sort());
    for (const name of Object.keys(fresh)) {
      expect(Buffer.from(fresh[name]).equals(Buffer.from(expected[name])), `${name} drifted from fixtures/parity.json`).toBe(true);
    }
  });

  test('every parity frame in a real browser matches the software canvas', async ({ gamePage }, testInfo) => {
    await gamePage.open();
    await gamePage.waitForScene('TitleScene');
    await freezeLoop(gamePage.page);

    const rendered = await gamePage.page.evaluate(async (source) => {
      const scenario = (0, eval)(`(${source})`);
      const [{ Game }, { Input }, { registerRoutes }, { Run }] = await Promise.all([
        import('/src/game/game.js'),
        import('/src/engine/input.js'),
        import('/src/scenes/routes.js'),
        import('/src/game/run.js'),
      ]);
      const frames = await scenario(
        { Game, Input, registerRoutes, Run },
        () => {
          const c = document.createElement('canvas');
          c.width = 480;
          c.height = 270;
          return c;
        },
        (canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
      );
      const out = {};
      for (const [name, data] of Object.entries(frames)) {
        let bin = '';
        for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
        out[name] = btoa(bin);
      }
      return out;
    }, parityScenario.toString());

    expect(Object.keys(rendered).sort()).toEqual(Object.keys(expected).sort());
    const report = [];
    for (const name of Object.keys(expected)) {
      const actual = fromBase64(rendered[name]);
      const r = compare(actual, expected[name], CHANNEL_SLACK);
      report.push(`${name}: ${r.differing} px differ (${(r.ratio * 100).toFixed(3)}%), worst channel delta ${r.worst}`);
      if (r.ratio > MAX_DIFF_RATIO) {
        await testInfo.attach(`${name}-browser.png`, { body: encodePNG({ width: 480, height: 270, data: actual }), contentType: 'image/png' });
        await testInfo.attach(`${name}-software.png`, { body: encodePNG({ width: 480, height: 270, data: expected[name] }), contentType: 'image/png' });
      }
      expect.soft(r.ratio, `${name}: ${r.differing} pixels differ, worst channel delta ${r.worst}`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
    }
    testInfo.annotations.push({ type: 'parity', description: report.join('; ') });
  });
});
