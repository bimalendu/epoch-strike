import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { SoftCanvas } from '../tools/softcanvas.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';
import { THEMES } from '../src/game/art/themes.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { World } from '../src/game/world.js';
import { renderWorld } from '../src/game/render.js';
import { buildTileLayer } from '../src/game/art/tilelayer.js';
import { drawEnemy, drawEnemyBullet } from '../src/game/art/enemies.js';
import { EBULLET_ART } from '../src/game/art/ebullets.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';
import { Enemy } from '../src/game/enemies.js';
import { drawHud } from '../src/game/art/hud.js';
import { buildLevel } from '../src/game/levels.js';

function distinctColours(canvas) {
  const seen = new Set();
  for (let i = 0; i < canvas.data.length; i += 4) seen.add((canvas.data[i] << 16) | (canvas.data[i + 1] << 8) | canvas.data[i + 2]);
  return seen.size;
}

function showcase(theme) {
  const b = new LevelBuilder({ id: 1, theme, name: theme, seed: 3 });
  b.flat(20);
  b.platform(8, 10, 4);
  b.pit(3, { fill: 'spikes' });
  b.flat(30);
  b.exit();
  return b.finish();
}

test('every theme renders a frame with sky, scenery and terrain (not blank)', () => {
  for (const name of Object.keys(THEMES)) {
    const w = new World(showcase(name));
    const c = new SoftCanvas(VIEW_W, VIEW_H);
    renderWorld(c.getContext('2d'), w);
    assert.ok(distinctColours(c) >= 12, `${name}: only ${distinctColours(c)} colours`);
  }
});

test('terrain art is cached: a second frame does not rebuild the tile layer, a changed tile patches it in place', () => {
  const w = new World(showcase('jungle'));
  const c = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c.getContext('2d'), w);
  const layer = w.tileLayer;
  assert.ok(layer);
  renderWorld(c.getContext('2d'), w);
  assert.equal(w.tileLayer, layer);
  assert.equal(w.tilesDirty, false);
  // find a solid tile with air above it and bury it
  let tx = -1;
  let ty = -1;
  for (let y = 1; y < w.rows && tx < 0; y++) for (let x = 2; x < w.cols - 2; x++) if (w.tile(x, y) === 1 && w.tile(x, y - 1) === 0) { tx = x; ty = y; break; }
  assert.ok(tx >= 0, 'the showcase has some ground');
  const alpha = () => layer.data[(ty * 16 + 8) * layer.width * 4 + (tx * 16 + 8) * 4 + 3];
  assert.ok(alpha() > 0, 'the tile is painted');
  w.setTile(tx, ty, 0);
  assert.equal(w.tilesDirty, true);
  renderWorld(c.getContext('2d'), w);
  assert.equal(w.tileLayer, layer, 'the same canvas is patched, not rebuilt');
  assert.equal(w.tilesDirty, false);
  assert.equal(w.dirtyTiles.length, 0);
  assert.equal(alpha(), 0, 'the cell is empty now');
  // the patch is exactly what a full rebuild would paint
  const fresh = buildTileLayer(w);
  assert.deepEqual(Buffer.from(layer.data), Buffer.from(fresh.data), 'patched layer == rebuilt layer');
});

test('terrain art: water and lava swaps never touch the baked layer; lava over ground does, and patches match a rebuild', () => {
  const w = new World(showcase('volcano'));
  const c = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c.getContext('2d'), w);
  const layer = w.tileLayer;
  let ax = -1;
  let ay = -1;
  for (let y = 1; y < w.rows && ax < 0; y++) for (let x = 2; x < w.cols - 2; x++) if (w.tile(x, y) === 0) { ax = x; ay = y; break; }
  w.setTile(ax, ay, 5); // lava into air
  w.setTile(ax, ay, 4); // then water
  w.setTile(ax, ay, 0);
  assert.equal(w.tilesDirty, false, 'liquid <-> air swaps leave the baked art alone');
  // lava over a run of ground, row by row, with decor and neighbours changing shape
  const spots = [];
  for (let y = 1; y < w.rows; y++) for (let x = 2; x < w.cols - 2; x++) if (w.tile(x, y) === 1 && spots.length < 12 && x % 3 === 0) spots.push([x, y]);
  for (const [x, y] of spots) w.setTile(x, y, 5);
  assert.equal(w.tilesDirty, true);
  renderWorld(c.getContext('2d'), w);
  assert.equal(w.tileLayer, layer);
  assert.deepEqual(Buffer.from(layer.data), Buffer.from(buildTileLayer(w).data), 'patched == rebuilt after a dozen changes');
  // a flood of changes falls back to a rebuild (a different canvas, same picture)
  for (let y = 0; y < w.rows; y++) for (let x = 2; x < 60; x++) w.setTile(x, y, y % 2 ? 1 : 0);
  renderWorld(c.getContext('2d'), w);
  assert.notEqual(w.tileLayer, layer);
  assert.deepEqual(Buffer.from(w.tileLayer.data), Buffer.from(buildTileLayer(w).data));
});

test('every enemy def draws something visible, in both facings', () => {
  for (const def of Object.values(ENEMY_DEFS)) {
    for (const face of [-1, 1]) {
      const c = new SoftCanvas(120, 120);
      const e = new Enemy(def, 60, 80, { face });
      e.ang = -1;
      e.open = true;
      if (def.arch === 'breacher') {
        // a serpent is only drawn once it has surfaced: pose it mid-leap with a trail behind its head
        e.base = 90;
        e.state = 'leap';
        e.vy = -60;
        e.trail = Array.from({ length: 12 }, (_, i) => ({ x: 60 - face * i * 2, y: 76 + i * 3 }));
      }
      drawEnemy(c.getContext('2d'), e, 0, 0);
      let px = 0;
      for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) px++;
      assert.ok(px > 30, `${def.id} (face ${face}) drew ${px} pixels`);
    }
  }
});

test('every enemy bullet kind draws a few pixels', () => {
  for (const kind of Object.keys(EBULLET_ART)) {
    const c = new SoftCanvas(40, 40);
    drawEnemyBullet(c.getContext('2d'), { x: 20, y: 20, vx: 50, vy: 10, r: 2, kind }, 0, 0);
    let px = 0;
    for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) px++;
    assert.ok(px >= 6, `${kind}: ${px} pixels`);
  }
});

test('level 1 renders and the HUD prompt banner darkens the bottom strip', () => {
  const lvl = buildLevel(0);
  const w = new World(lvl);
  const lum = (c, x, y) => {
    const i = (y * VIEW_W + x) * 4;
    return c.data[i] + c.data[i + 1] + c.data[i + 2];
  };
  const plain = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(plain.getContext('2d'), w);
  drawHud(plain.getContext('2d'), w, null, {});
  const withBanner = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(withBanner.getContext('2d'), w);
  drawHud(withBanner.getContext('2d'), w, null, { prompt: 'PRESS Z TO JUMP' });
  assert.ok(distinctColours(plain) >= 20);
  const x = VIEW_W / 2 - 40;
  const y = VIEW_H - 28;
  assert.ok(lum(withBanner, x, y) < lum(plain, x, y), 'banner background is darker than the scenery behind it');
});
