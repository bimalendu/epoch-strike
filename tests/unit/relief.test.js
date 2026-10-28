// Unit tests for src/game/art/relief.js: the fringe and underside painters, the strata bands and the decor sprites.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { Painter } from '../../src/engine/gfx.js';
import {
  FRINGES, UNDERSIDES, DECOR, RELIEF_REACH, STRATA_DEPTHS, strataBand, strataStyle, paintStrata, fringeStrip, undersideStrip, decorSprite, warmRelief,
} from '../../src/game/art/relief.js';
import { THEMES } from '../../src/game/art/themes.js';

/** Count the opaque pixels of a canvas, and note the topmost and bottommost rows that hold any. */
function inkOf(canvas) {
  let count = 0;
  let first = -1;
  let last = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.data[(y * canvas.width + x) * 4 + 3] > 0) {
        count++;
        if (first < 0) first = y;
        last = y;
      }
    }
  }
  return { count, first, last };
}

const FLAT_TOPS = new Array(16).fill(RELIEF_REACH);
const FLAT_BOTTOMS = new Array(16).fill(0);

test('every fringe shape paints something on a flat strip, and stays inside the strip', () => {
  for (const [shape, paint] of Object.entries(FRINGES)) {
    let most = 0;
    for (let v = 0; v < 4; v++) {
      const p = new Painter(16, RELIEF_REACH);
      paint(p, '#4fae3a', v, FLAT_TOPS);
      most = Math.max(most, inkOf(p.canvas).count);
    }
    assert.ok(most > 4, `${shape} fringe drew ${most} pixels`);
  }
});

test('a fringe grows up from the surface line: nothing is painted below it', () => {
  for (const [shape, paint] of Object.entries(FRINGES)) {
    const p = new Painter(16, 16);
    paint(p, '#4fae3a', 1, new Array(16).fill(10));
    assert.ok(inkOf(p.canvas).last < 10, `${shape} stayed above row 10`);
  }
});

test('a fringe on a slope follows the slope line', () => {
  const tops = Array.from({ length: 16 }, (_, x) => 16 - x); // a 45-degree ramp rising to the right
  const p = new Painter(16, 16);
  FRINGES.grass(p, '#4fae3a', 2, tops);
  for (let x = 0; x < 16; x++) {
    for (let y = tops[x]; y < 16; y++) assert.equal(p.canvas.data[(y * 16 + x) * 4 + 3], 0, `no growth under the line at ${x},${y}`);
  }
  assert.ok(inkOf(p.canvas).count > 0);
});

test('a fringe never paints above the top of the painter, however tall the surface is clipped', () => {
  const p = new Painter(16, 16);
  FRINGES.grass(p, '#4fae3a', 3, new Array(16).fill(1));
  assert.ok(inkOf(p.canvas).first >= 0 && inkOf(p.canvas).last <= 0);
});

test('every underside shape paints something that hangs from the top edge of its strip', () => {
  for (const [shape, paint] of Object.entries(UNDERSIDES)) {
    let most = 0;
    let first = 99;
    for (let v = 0; v < 4; v++) {
      const p = new Painter(16, RELIEF_REACH);
      paint(p, '#a8c8d8', v, FLAT_BOTTOMS);
      const ink = inkOf(p.canvas);
      most = Math.max(most, ink.count);
      if (ink.count) first = Math.min(first, ink.first);
    }
    assert.ok(most > 4, `${shape} drew ${most} pixels`);
    assert.equal(first, 0, `${shape} hangs from the strip's top row`);
  }
});

test('strips are cached per theme and variant, and differ between variants', () => {
  const fr = { shape: 'grass', c: '#4fae3a' };
  assert.equal(fringeStrip('t', fr, 0), fringeStrip('t', fr, 0));
  assert.notEqual(fringeStrip('t', fr, 0), fringeStrip('t', fr, 1));
  assert.notEqual(fringeStrip('t', fr, 0), fringeStrip('u', fr, 0));
  const un = { shape: 'roots', c: '#3a2412' };
  assert.equal(undersideStrip('t', un, 2), undersideStrip('t', un, 2));
  assert.equal(fringeStrip('t', fr, 0).height, RELIEF_REACH);
  assert.equal(undersideStrip('t', un, 0).width, 16);
});

test('strata bands: topsoil for the first two tiles, subsoil down to six, then bedrock', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 7, 20].map(strataBand), [0, 0, 1, 1, 1, 2, 2, 2]);
  assert.deepEqual(STRATA_DEPTHS, [2, 6]);
});

test('strataStyle darkens deeper bands, honours a theme\'s own colours, and leaves the topsoil alone', () => {
  const s = { kind: 'earth', base: '#6b4a2b', dark: '#4a3220', top: '#4fae3a' };
  assert.equal(strataStyle(s, 0), s);
  assert.notEqual(strataStyle(s, 1).base, s.base);
  assert.notEqual(strataStyle(s, 2).base, strataStyle(s, 1).base);
  assert.equal(strataStyle({ ...s, sub: '#123456' }, 1).base, '#123456');
  assert.equal(strataStyle({ ...s, deep: '#654321' }, 2).base, '#654321');
  assert.equal(strataStyle(s, 1).top, undefined, 'no grass cap below the surface');
});

test('paintStrata adds stones to the deeper bands, a fossil sometimes in bedrock, and nothing to topsoil', () => {
  const base = { base: '#6b4a2b', dark: '#4a3220', under: { shape: 'roots', c: '#3a2412' } };
  const p0 = new Painter(16, 16);
  paintStrata(p0, base, 0, 3);
  assert.equal(inkOf(p0.canvas).count, 0);
  const p1 = new Painter(16, 16);
  paintStrata(p1, base, 1, 3);
  assert.ok(inkOf(p1.canvas).count > 0);
  const inks = new Set();
  for (let v = 0; v < 40; v++) {
    const bedrock = new Painter(16, 16);
    paintStrata(bedrock, { ...base, under: null }, 2, v);
    inks.add(inkOf(bedrock.canvas).count);
  }
  assert.ok(inks.size > 3, 'bedrock tiles differ from one another: stones in different places, and a fossil in some');
});

test('every decor kind draws something in an 8x7 sprite, and an unknown kind draws pebbles', () => {
  for (const kind of Object.keys(DECOR)) {
    const c = decorSprite(kind, '#88aa66');
    assert.equal(c.width, 8);
    assert.equal(c.height, 7);
    assert.ok(inkOf(c).count > 3, `${kind} drew something`);
  }
  assert.deepEqual(Buffer.from(decorSprite('no-such-thing', '#88aa66').data), Buffer.from(decorSprite('pebbles', '#88aa66').data));
  assert.equal(decorSprite('fern', '#2f8a3a'), decorSprite('fern', '#2f8a3a'), 'cached');
});

test('every decor kind a theme asks for exists', () => {
  for (const [id, theme] of Object.entries(THEMES)) {
    for (const d of theme.decor || []) assert.ok(DECOR[d.k], `${id}: decor kind ${d.k}`);
  }
});

test('every fringe and underside shape a theme asks for exists', () => {
  for (const [id, theme] of Object.entries(THEMES)) {
    const s = theme.tiles.solid;
    if (s.fringe) assert.ok(FRINGES[s.fringe.shape], `${id}: fringe ${s.fringe.shape}`);
    if (s.under) assert.ok(UNDERSIDES[s.under.shape], `${id}: underside ${s.under.shape}`);
  }
});

test('warmRelief fills the caches a theme needs, so painting them again makes nothing new', () => {
  const theme = THEMES.jungle;
  warmRelief('jungle', theme);
  const before = fringeStrip('jungle', theme.tiles.solid.fringe, 3);
  warmRelief('jungle', theme);
  assert.equal(fringeStrip('jungle', theme.tiles.solid.fringe, 3), before);
});
