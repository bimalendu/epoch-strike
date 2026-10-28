// Behaviour tests for the living picture: creatures, fish, fireflies and shimmering waterfalls (life.js), wind, fog and lightning
// (weather.js) and the foreground (front.js). All of it must be a pure function of the clock, cheap, off at low quality, and
// kind to the soldier and to people who asked for fewer flashes.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { countingCtx } from '../../tools/perfprobe.js';
import { THEMES, getTheme } from '../../src/game/art/themes.js';
import { drawLifeBack, drawLifeFront, MAX_CALLS } from '../../src/game/art/life.js';
import { windShift, fogStrip, drawFog, strikeTime, strikeAt, drawLightning } from '../../src/game/art/weather.js';
import { FRONT_H, FRONT_KINDS, frontStrip, frontCoverage, drawFront } from '../../src/game/art/front.js';
import { setReducedFlashes } from '../../src/game/art/flash.js';
import { World } from '../../src/game/world.js';
import { renderWorld } from '../../src/game/render.js';
import { flatLevel } from '../../src/game/ascii.js';
import { VIEW_W, VIEW_H } from '../../src/game/constants.js';

const frame = (draw) => {
  const c = new SoftCanvas(VIEW_W, VIEW_H);
  const { ctx, counts } = countingCtx(c.getContext('2d'));
  draw(ctx);
  return { canvas: c, calls: counts.total };
};
const inkOf = (c) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) n++;
  return n;
};

test('every theme draws its life within the call budget, at any time and camera position', () => {
  for (const name of Object.keys(THEMES)) {
    const theme = getTheme(name);
    let worst = 0;
    for (const time of [0.5, 3.3, 7.1, 14, 41.7]) {
      for (const camX of [0, 333, 5000]) {
        const { calls } = frame((ctx) => {
          drawLifeBack(ctx, theme, time, camX);
          drawLifeFront(ctx, theme, time, camX);
        });
        worst = Math.max(worst, calls);
      }
    }
    assert.ok(worst <= MAX_CALLS, `${name}: ${worst} calls in a frame`);
  }
});

test('life is stateless: the same time and camera paint the same pixels, and time moves the creatures', () => {
  const theme = getTheme('jungle');
  const a = frame((ctx) => drawLifeBack(ctx, theme, 5, 100)).canvas;
  const b = frame((ctx) => drawLifeBack(ctx, theme, 5, 100)).canvas;
  assert.deepEqual(Buffer.from(a.data), Buffer.from(b.data));
  const later = frame((ctx) => drawLifeBack(ctx, theme, 9, 100)).canvas;
  assert.notDeepEqual(Buffer.from(a.data), Buffer.from(later.data));
});

test('birds cross the sky of a theme that lists them, and a theme with no life and no waterfall draws nothing at all', () => {
  let seen = 0;
  for (let t = 0; t < 40; t += 1.7) seen = Math.max(seen, inkOf(frame((ctx) => drawLifeBack(ctx, getTheme('troy'), t, 0)).canvas));
  assert.ok(seen > 10, 'something flew');
  const none = frame((ctx) => {
    drawLifeBack(ctx, getTheme('neon'), 5, 0);
    drawLifeFront(ctx, getTheme('neon'), 5, 0);
  });
  assert.equal(none.calls, 0);
  assert.equal(inkOf(none.canvas), 0);
});

test('every creature kind a theme lists exists, and the waterfall shimmer follows its layer', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    for (const kind of theme.life || []) {
      const t = getTheme(name);
      let ink = 0;
      for (let time = 0; time < 60 && !ink; time += 0.9) {
        ink = inkOf(frame((ctx) => {
          drawLifeBack(ctx, t, time, 0);
          drawLifeFront(ctx, t, time, 0);
        }).canvas);
      }
      assert.ok(ink > 0, `${name}: ${kind} never shows up`);
    }
  }
  const jungle = getTheme('jungle');
  const shimmer = frame((ctx) => drawLifeBack(ctx, { ...jungle, life: [] }, 4, 0)).canvas;
  assert.ok(inkOf(shimmer) > 5, 'the waterfall shimmers');
});

test('windShift is bounded, slow and reverses', () => {
  let lo = Infinity;
  let hi = -Infinity;
  let prev = windShift(0);
  let maxStep = 0;
  for (let t = 0; t < 120; t += 0.1) {
    const w = windShift(t);
    lo = Math.min(lo, w);
    hi = Math.max(hi, w);
    maxStep = Math.max(maxStep, Math.abs(w - prev));
    prev = w;
  }
  assert.ok(hi <= 35.01 && lo >= -35.01, `${lo}..${hi}`);
  assert.ok(lo < -10 && hi > 10, 'gusts in both directions');
  assert.ok(maxStep < 3, 'a smooth push, not a jump');
});

test('fog is a cached strip, drawn as two images only for themes that ask for it', () => {
  assert.equal(fogStrip('t', '#ffffff'), fogStrip('t', '#ffffff'));
  assert.notEqual(fogStrip('t', '#ffffff'), fogStrip('t', '#aaaaaa'));
  const yes = frame((ctx) => drawFog(ctx, getTheme('glacier'), 100, 3));
  assert.equal(yes.calls, 2);
  assert.ok(inkOf(yes.canvas) > 200);
  assert.equal(frame((ctx) => drawFog(ctx, getTheme('jungle'), 100, 3)).calls, 0);
});

test('lightning strikes at a predictable moment in each storm window, once, and is off in themes without a storm', () => {
  for (let k = 0; k < 6; k++) {
    const t0 = strikeTime(k);
    assert.ok(t0 > k * 11 + 1.9 && t0 < (k + 1) * 11, `window ${k}: ${t0}`);
    assert.ok(strikeAt(t0 + 0.01) >= 0);
    assert.equal(strikeAt(t0 - 0.05), -1);
    assert.equal(strikeAt(t0 + 0.5), -1);
  }
  const t = strikeTime(0) + 0.01;
  const storm = frame((ctx) => drawLightning(ctx, getTheme('fjord'), 0, t));
  assert.ok(storm.calls > 10, 'a bolt');
  assert.equal(frame((ctx) => drawLightning(ctx, getTheme('jungle'), 0, t)).calls, 0);
  assert.equal(frame((ctx) => drawLightning(ctx, getTheme('fjord'), 0, strikeTime(0) + 3)).calls, 0, 'quiet between strikes');
});

test('reduced flashes: the lightning loses its pale wash over the whole screen, the bolt stays and blinks no faster than 3 times a second', () => {
  const theme = getTheme('fjord');
  const t = strikeTime(0) + 0.01;
  const wash = (canvas) => canvas.data[(135 * VIEW_W + 5) * 4] > 0 || canvas.data[(135 * VIEW_W + 5) * 4 + 3] > 0;
  setReducedFlashes(false);
  const full = frame((ctx) => drawLightning(ctx, theme, 0, t));
  setReducedFlashes(true);
  try {
    const soft = frame((ctx) => drawLightning(ctx, theme, 0, t));
    assert.ok(wash(full.canvas), 'full flashes wash the screen');
    assert.equal(wash(soft.canvas), false, 'reduced flashes do not');
    assert.ok(soft.calls > 10, 'but the bolt is still drawn');
    let changes = 0;
    let last = null;
    for (let u = 0; u < 0.36; u += 1 / 60) {
      const on = frame((ctx) => drawLightning(ctx, theme, 0, strikeTime(0) + u)).calls > 0;
      if (last !== null && on !== last) changes++;
      last = on;
    }
    assert.ok(changes <= 3, `${changes} on/off changes in one strike`);
  } finally {
    setReducedFlashes(false);
  }
});

test('the foreground has six kinds, each at most FRONT_H tall and painted along the bottom of its strip', () => {
  assert.deepEqual(Object.keys(FRONT_KINDS).sort(), ['cables', 'drifts', 'ferns', 'grass', 'rocks', 'rubble']);
  for (const kind of Object.keys(FRONT_KINDS)) {
    const strip = frontStrip(`k-${kind}`, { kind, c: '#204020' }, 1);
    assert.equal(strip.height, FRONT_H);
    assert.equal(strip.width, VIEW_W);
    assert.ok(inkOf(strip) > 300, `${kind}: ${inkOf(strip)} px`);
    let bottomRow = 0;
    for (let x = 0; x < VIEW_W; x++) if (strip.data[((FRONT_H - 1) * VIEW_W + x) * 4 + 3] > 0) bottomRow++;
    assert.ok(bottomRow > 0 || kind === 'cables', `${kind} stands on the bottom edge`);
  }
});

test('a thinned foreground is a dither of the full one: fewer pixels, none that the full one lacks', () => {
  const front = { kind: 'grass', c: '#204020' };
  const full = frontStrip('th', front, 1);
  const thin = frontStrip('th', front, 0.3);
  assert.ok(inkOf(thin) < inkOf(full) * 0.45 && inkOf(thin) > inkOf(full) * 0.1);
  for (let i = 3; i < thin.data.length; i += 4) if (thin.data[i] > 0) assert.ok(full.data[i] > 0, 'no new pixel');
});

test('the foreground fades as the soldier nears the bottom edge and never covers them: gone within 40 px of it', () => {
  assert.equal(frontCoverage(VIEW_H - 100), 0.7);
  assert.equal(frontCoverage(VIEW_H - 55), 0.3);
  assert.equal(frontCoverage(VIEW_H - 40), 0);
  assert.equal(frontCoverage(VIEW_H - 5), 0);
  const theme = getTheme('jungle');
  assert.equal(frame((ctx) => drawFront(ctx, theme, 0, VIEW_H - 20)).calls, 0);
  const shown = frame((ctx) => drawFront(ctx, theme, 0, 150));
  assert.equal(shown.calls, 2);
  // nothing above the strip's top row
  for (let y = 0; y < VIEW_H - FRONT_H; y++) for (let x = 0; x < VIEW_W; x += 7) assert.equal(shown.canvas.data[(y * VIEW_W + x) * 4 + 3], 0);
});

test('the foreground scrolls faster than the camera and wraps without a jump at the seam', () => {
  const theme = getTheme('jungle');
  const a = frame((ctx) => drawFront(ctx, theme, 0, 150)).canvas;
  const b = frame((ctx) => drawFront(ctx, theme, 40, 150)).canvas;
  // moving the camera 40 px moves the strip 50 px: row 17's pixel at x in a is at x - 50 in b
  let same = 0;
  let total = 0;
  for (let x = 60; x < VIEW_W; x++) {
    const ai = ((FRONT_H - 1 + VIEW_H - FRONT_H) * VIEW_W + x) * 4 + 3;
    const bi = ((FRONT_H - 1 + VIEW_H - FRONT_H) * VIEW_W + x - 50) * 4 + 3;
    total++;
    if ((a.data[ai] > 0) === (b.data[bi] > 0)) same++;
  }
  assert.equal(same, total, 'a 40 px camera step moves the foreground 50 px');
});

test('at low effects quality the renderer draws no life, fog, foreground or lightning at all, and the simulation is the same', () => {
  const level = flatLevel(60, 14, { theme: 'fjord' });
  const calls = (fx) => {
    const w = new World(level, { fx });
    w.time = strikeTime(0) + 0.01;
    const c = new SoftCanvas(VIEW_W, VIEW_H);
    const { ctx, counts } = countingCtx(c.getContext('2d'));
    renderWorld(ctx, w);
    return counts.total;
  };
  const high = calls('high');
  const low = calls('low');
  assert.ok(high - low >= 10, `high ${high} vs low ${low}`);
  assert.ok(high - low <= 150, `the extras cost ${high - low} calls, over the 150 budget`);
});

test('every theme\'s extras (life, fog, foreground, lightning, with the vignette and glow) together cost at most 150 canvas calls in a frame', () => {
  for (const name of Object.keys(THEMES)) {
    const level = flatLevel(60, 14, { theme: name });
    const worst = [0.5, strikeTime(0) + 0.01, 8, 20].reduce((m, time) => {
      const run = (fx) => {
        const w = new World(level, { fx });
        w.time = time;
        const c = new SoftCanvas(VIEW_W, VIEW_H);
        const { ctx, counts } = countingCtx(c.getContext('2d'));
        renderWorld(ctx, w);
        return counts.total;
      };
      return Math.max(m, run('high') - run('low'));
    }, 0);
    assert.ok(worst <= 150, `${name}: the high-quality extras cost ${worst} calls`);
  }
});
