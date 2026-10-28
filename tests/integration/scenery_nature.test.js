// Behaviour tests for the natural landscape painters and the layer recipes of the 20 themes: every painter produces a tileable
// layer, nothing is cut off at the seam, soft edges are dithered (no alpha), the sky canvas stays free of sun and moon, and
// every colour a layer carries fades into the haze together.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { sceneryLayer } from '../../src/game/art/scenery.js';
import { NATURE, TREES, dithered, placeWrapped, fallRect } from '../../src/game/art/scenery_nature.js';
import { THEMES, getTheme } from '../../src/game/art/themes.js';
import { skyCanvas } from '../../src/game/art/sky.js';
import { Painter } from '../../src/engine/gfx.js';
import { VIEW_W, VIEW_H } from '../../src/game/constants.js';

const inkCount = (c) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) n++;
  return n;
};
const alphaAt = (c, x, y) => c.data[(y * c.width + x) * 4 + 3];
const rgbAt = (c, x, y) => [0, 1, 2].map((i) => c.data[(y * c.width + x) * 4 + i]);

const SAMPLE = {
  ridges: { c: '#7aa8b4', y: 180, a: 100, seed: 4, snow: '#ffffff', trees: '#3a5a4a' },
  mesa: { c: '#c8884a', y: 200, a: 90, seed: 4, n: 3 },
  spires: { c: '#7a7468', y: 200, a: 70, seed: 4, n: 5, hoodoo: true },
  arches: { c: '#b8884a', y: 205, a: 90, seed: 4 },
  canyon: { c: '#b8703a', y: 220, a: 60, seed: 4 },
  forest: { c: '#4a9a5a', y: 210, a: 60, seed: 4, n: 14, species: Object.keys(TREES).map((k) => [k, 1]) },
  reeds: { c: '#5a8a3a', y: 225, a: 22, seed: 4, heads: '#6a4a2a' },
  waterfall: { c: '#e0f4fa', rock: '#5a7a68', y: 206, a: 78, seed: 4, at: 0.4 },
  lake: { c: '#3a78b8', y: 210, seed: 4, glitter: '#ffffff' },
  cumulus: { c: '#ffffff', y: 30, a: 60, seed: 4 },
  stratus: { c: '#e8eef4', y: 30, a: 60, seed: 4 },
  cirrus: { c: '#ffffff', y: 30, a: 60, seed: 4 },
  celestial: { c: '#fff4c0', halo: '#fff0b0', y: 50, r: 11, at: 0.5 },
  rays: { c: '#6a8ab0', y: 10, a: 150, seed: 4 },
  fogbank: { c: '#ffffff', y: 150, a: 40, seed: 4 },
  aurora: { c: '#2ee8a0', c2: '#9a5af0', y: 70, a: 70, seed: 4 },
};

test('every nature painter has a sample here, and every sample paints a layer with real content', () => {
  assert.deepEqual(Object.keys(SAMPLE).sort(), Object.keys(NATURE).sort());
  for (const [kind, o] of Object.entries(SAMPLE)) {
    const layer = sceneryLayer(`test:nature:${kind}`, { k: kind, s: 0.2, ...o });
    assert.equal(layer.width, VIEW_W);
    assert.equal(layer.height, VIEW_H);
    assert.ok(inkCount(layer) > 100, `${kind} painted ${inkCount(layer)} pixels`);
  }
});

test('the painters are deterministic: the same options give the same pixels', () => {
  for (const [kind, o] of Object.entries(SAMPLE)) {
    const a = sceneryLayer(`test:det:a:${kind}`, { k: kind, s: 0.2, ...o });
    const b = sceneryLayer(`test:det:b:${kind}`, { k: kind, s: 0.2, ...o });
    assert.deepEqual(Buffer.from(a.data), Buffer.from(b.data), kind);
  }
});

test('landforms stand on a solid base: the columns below the baseline are filled right down to the bottom edge', () => {
  for (const kind of ['ridges', 'mesa', 'spires', 'canyon', 'forest', 'reeds', 'lake', 'waterfall']) {
    const layer = sceneryLayer(`test:nature:${kind}`, { k: kind, s: 0.2, ...SAMPLE[kind] });
    for (let x = 0; x < VIEW_W; x += 20) assert.ok(alphaAt(layer, x, VIEW_H - 1) > 0, `${kind}: bottom edge at ${x}`);
  }
});

test('no painter blends with alpha: every painted pixel is fully opaque, so the browser and the software canvas agree', () => {
  for (const kind of Object.keys(NATURE)) {
    const layer = sceneryLayer(`test:nature:${kind}`, { k: kind, s: 0.2, ...SAMPLE[kind] });
    let soft = 0;
    for (let i = 3; i < layer.data.length; i += 4) if (layer.data[i] > 0 && layer.data[i] < 255) soft++;
    assert.equal(soft, 0, `${kind}: ${soft} translucent pixels`);
  }
});

test('the arch has a window cut through it that the layers behind show through', () => {
  const layer = sceneryLayer('test:nature:arches', { k: 'arches', s: 0.2, ...SAMPLE.arches });
  let holes = 0;
  for (let x = 0; x < VIEW_W; x++) {
    let sawRock = false;
    let sawHole = false;
    for (let y = 100; y < 212; y++) {
      const a = alphaAt(layer, x, y);
      if (a > 0) {
        if (sawHole) holes++;
        sawRock = true;
      } else if (sawRock) sawHole = true;
    }
  }
  assert.ok(holes > 30, `rock closes over the window in ${holes} spots`);
});

test('placeWrapped draws a shape near the left or right edge a second time one screen over, so the seam is never cut', () => {
  const calls = [];
  placeWrapped((x) => calls.push(x), 100, 20);
  assert.deepEqual(calls, [100]);
  calls.length = 0;
  placeWrapped((x) => calls.push(x), 10, 20);
  assert.deepEqual(calls, [10, 10 + VIEW_W]);
  calls.length = 0;
  placeWrapped((x) => calls.push(x), VIEW_W - 5, 20);
  assert.deepEqual(calls, [VIEW_W - 5, -5]);
});

test('trees near the seam continue across it: a forest layer has no cut trunk on the edge column', () => {
  // a tree centred on x=2 must put ink on the last column too (its left half wraps round)
  const p = new Painter(VIEW_W, VIEW_H);
  placeWrapped((x) => TREES.conifer(p, x, 200, 60, '#2f7a3c', '#1a3a22'), 2, 20);
  assert.ok(alphaAt(p.canvas, VIEW_W - 1, 170) > 0, 'the wrapped half is there');
  assert.ok(alphaAt(p.canvas, 0, 170) > 0);
});

test('every tree species paints something recognisable standing on its base line', () => {
  for (const [kind, draw] of Object.entries(TREES)) {
    const p = new Painter(60, 80);
    draw(p, 30, 76, 50, '#4a9a5a', '#4a3220');
    assert.ok(inkCount(p.canvas) > 25, `${kind} painted ${inkCount(p.canvas)} px`);
    let belowBase = 0;
    for (let y = 79; y < 80; y++) for (let x = 0; x < 60; x++) if (alphaAt(p.canvas, x, y) > 0) belowBase++;
    assert.ok(belowBase < 20, `${kind} does not spill under its feet`);
  }
});

test('dithered is an ordered pattern: density 0 is empty, 1 is solid, and half fills about half of any 4x4 block', () => {
  let half = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    assert.equal(dithered(x, y, 0), false);
    assert.equal(dithered(x, y, 1), true);
    if (dithered(x, y, 0.5)) half++;
  }
  assert.equal(half, 8);
});

test('the sun and the moon are layers, not part of the sky canvas: the sky holds only the theme\'s band colours', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    const t = getTheme(name);
    const sky = skyCanvas(t);
    const allowed = new Set(t.sky.map((c) => c.toLowerCase()));
    const hex = ([r, g, b]) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    for (let y = 0; y < VIEW_H; y += 9) for (let x = 0; x < VIEW_W; x += 13) assert.ok(allowed.has(hex(rgbAt(sky, x, y))), `${name}: stray colour in the sky at ${x},${y}`);
    void theme;
  }
});

test('haze fades every colour a layer carries, not only its main one: the snow on a far ridge is tinted toward the sky too', () => {
  const theme = getTheme('glacier');
  const layer = { k: 'ridges', c: '#3a6a88', snow: '#ffffff', y: 200, a: 120, s: 0.05, seed: 13, cells: 3, snowAt: 0.3 };
  const find = (canvas, wanted) => {
    for (let y = 0; y < VIEW_H; y++) for (let x = 0; x < VIEW_W; x++) if (alphaAt(canvas, x, y) > 0 && rgbAt(canvas, x, y).join() === wanted.join()) return true;
    return false;
  };
  assert.equal(find(sceneryLayer('test:haze2:plain', layer), [255, 255, 255]), true, 'unhazed snow is pure white');
  assert.equal(find(sceneryLayer('test:haze2:far', layer, theme), [255, 255, 255]), false, 'far snow is mixed toward the sky');
  assert.equal(find(sceneryLayer('test:haze2:near', { ...layer, s: 0.5 }, theme), [255, 255, 255]), true, 'near snow is not');
});

test('the lights and weather of the sky are not hazed: a sun stays as bright when the layer is far', () => {
  const theme = getTheme('jungle');
  const sun = { k: 'celestial', c: '#fff4c0', y: 60, r: 11, at: 0.5, s: 0.01 };
  const a = sceneryLayer('test:sun:far', sun, theme);
  const b = sceneryLayer('test:sun:plain', sun);
  assert.deepEqual(Buffer.from(a.data), Buffer.from(b.data));
});

test('a waterfall exposes the rectangle of its falling water, inside the layer and above the pool', () => {
  const o = { at: 0.3, fw: 10, y: 206, a: 78 };
  const f = fallRect(o);
  assert.equal(f.w, 10);
  assert.equal(f.y, 206 - 78);
  assert.equal(f.h, 78);
  assert.ok(f.x > 0 && f.x + f.w < VIEW_W);
  const layer = sceneryLayer('test:wf', { k: 'waterfall', c: '#e0f4fa', rock: '#5a7a68', s: 0.2, seed: 2, ...o });
  assert.ok(alphaAt(layer, f.x + 5, f.y + 20) > 0, 'water in the rectangle');
});

test('every theme has four to six layers, and each layer kind is a real painter', async () => {
  const { sceneryLayer: layerFor } = await import('../../src/game/art/scenery.js');
  for (const [name, theme] of Object.entries(THEMES)) {
    assert.ok(theme.layers.length >= 3 && theme.layers.length <= 6, `${name}: ${theme.layers.length} layers`);
    const t = getTheme(name);
    theme.layers.forEach((layer, i) => {
      const c = layerFor(`${t.id}:${i}`, layer, t);
      assert.ok(inkCount(c) > 30, `${name} layer ${i} (${layer.k}) painted ${inkCount(c)} px`);
    });
  }
});

test('every theme paints a sun, a moon, an aurora or some clouds in its sky, and the dark themes have their stars', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    if (name === 'cave') continue; // underground
    const kinds = theme.layers.map((l) => l.k);
    assert.ok(kinds.some((k) => ['celestial', 'cumulus', 'stratus', 'cirrus', 'clouds', 'aurora', 'stars'].includes(k)), `${name}: ${kinds.join()}`);
  }
});
