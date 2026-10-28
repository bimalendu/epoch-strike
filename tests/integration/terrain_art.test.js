// Behaviour tests for the organic terrain art: slope sprites in every theme, chamfered corners, strata, fringes and undersides
// in the baked tile layer, and that patching the layer after a change gives exactly what a full rebuild paints.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { THEMES, getTheme } from '../../src/game/art/themes.js';
import { tileSprite, TOP, LEFT, RIGHT } from '../../src/game/art/tilepaint.js';
import { buildTileLayer, getTileLayer } from '../../src/game/art/tilelayer.js';
import { T, SLOPE, floorHeight } from '../../src/game/tiles.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { World } from '../../src/game/world.js';
import { RELIEF_REACH } from '../../src/game/art/relief.js';

const slopeIds = Object.values(T).filter((id) => SLOPE[id]);
const alphaAt = (canvas, x, y) => canvas.data[(y * canvas.width + x) * 4 + 3];
const rgbAt = (canvas, x, y) => [0, 1, 2].map((i) => canvas.data[(y * canvas.width + x) * 4 + i]);
const isMagenta = (canvas) => {
  let n = 0;
  for (let i = 0; i < canvas.data.length; i += 4) if (canvas.data[i] === 255 && canvas.data[i + 1] === 0 && canvas.data[i + 2] === 255) n++;
  return n > 100;
};

test('every theme paints every slope id: never the magenta fallback, cut along the slope line, solid below it', () => {
  for (const name of Object.keys(THEMES)) {
    const theme = getTheme(name);
    for (const id of slopeIds) {
      for (let v = 0; v < 4; v++) {
        const sprite = tileSprite(theme, id, TOP, v, T);
        assert.ok(!isMagenta(sprite), `${name}: slope ${id} fell back to magenta`);
        for (let x = 0; x < 16; x++) {
          const surface = 16 - Math.round(floorHeight(id, x + 0.5)); // first solid row in this column
          if (surface > 5) assert.equal(alphaAt(sprite, x, 0), 0, `${name} ${id}: clear above the line at column ${x}`); // (a fringe grows up to 5 px above it)
          if (surface < 15) assert.equal(alphaAt(sprite, x, 15) > 0, true, `${name} ${id}: solid at the bottom of column ${x}`);
          if (surface <= 12) assert.ok(alphaAt(sprite, x, surface + 2) > 0, `${name} ${id}: ground just under the line at column ${x}`);
        }
      }
    }
  }
});

test('a slope sprite has a lit cap along its line: the surface pixel is lighter than the ground under it', () => {
  const sprite = tileSprite(getTheme('jungle'), T.RAMP45_R, TOP, 0, T);
  const lum = ([r, g, b]) => r + g + b;
  const top = 16 - Math.round(floorHeight(T.RAMP45_R, 8.5)); // the surface row in column 8
  assert.ok(lum(rgbAt(sprite, 8, top + 1)) > lum(rgbAt(sprite, 8, 15)), 'the cap is lighter than the dirt under it');
  assert.equal(alphaAt(sprite, 8, top + 1) > 0 && alphaAt(sprite, 8, 15) > 0, true);
});

test('a slope sprite is cached, and the cache is keyed by the variant the painter used', () => {
  const theme = getTheme('jungle');
  assert.equal(tileSprite(theme, T.RAMP22_R_LO, TOP, 5, T), tileSprite(theme, T.RAMP22_R_LO, TOP, 9, T), '5 and 9 are the same variant');
  assert.notEqual(tileSprite(theme, T.RAMP22_R_LO, TOP, 5, T), tileSprite(theme, T.RAMP22_R_LO, TOP, 6, T));
  assert.equal(tileSprite(theme, T.SOLID, TOP, 3, T), tileSprite(theme, T.SOLID, TOP, 7, T));
});

test('earth, rock and sand lose their exposed top corners (a 2 px chamfer); masonry keeps square ones', () => {
  for (const [name, round] of [['jungle', true], ['volcano', true], ['pyramid', true], ['troy', true], ['castle', false]]) {
    const theme = getTheme(name);
    const both = tileSprite(theme, T.SOLID, TOP | LEFT | RIGHT, 0, T);
    assert.equal(alphaAt(both, 0, 0) === 0, round, `${name}: top left corner`);
    assert.equal(alphaAt(both, 15, 0) === 0, round, `${name}: top right corner`);
    const middle = tileSprite(theme, T.SOLID, TOP, 0, T);
    assert.ok(alphaAt(middle, 0, 0) > 0 && alphaAt(middle, 15, 0) > 0, `${name}: a tile between two others stays square`);
  }
});

test('deeper ground is darker: topsoil, subsoil and bedrock are three different tiles', () => {
  const theme = getTheme('jungle');
  const lum = (c) => {
    let total = 0;
    for (let i = 0; i < c.data.length; i += 4) total += c.data[i] + c.data[i + 1] + c.data[i + 2];
    return total;
  };
  const [a, b, c] = [0, 1, 2].map((band) => lum(tileSprite(theme, T.SOLID, 0, 0, T, band)));
  assert.ok(a > b && b > c, `${a} > ${b} > ${c}`);
});

/** A hill with an overhang: ground, a slope, and a ledge with open air underneath it. */
function reliefLevel(theme) {
  const b = new LevelBuilder({ id: 1, theme, name: 'R', seed: 9 });
  b.flat(8);
  b.slope(2, { angle: 45 });
  b.flat(6);
  b.slope(-2, { angle: 22 }); // 4 columns
  b.flat(8);
  b.pit(4);
  b.flat(8);
  b.exit();
  const level = b.finish();
  // carve a cave under the top of the hill so the ground has an open underside
  for (let x = 12; x < 16; x++) for (let y = 15; y < 17; y++) level.tiles[y * level.cols + x] = 0;
  return level;
}

test('the baked layer grows grass above exposed ground, and nothing above ground that has something on it', () => {
  const w = new World(reliefLevel('jungle'));
  const layer = getTileLayer(w);
  const topRow = 13 * 16; // the flat start of the level
  let blades = 0;
  for (let x = 0; x < 8 * 16; x++) for (let y = topRow - RELIEF_REACH; y < topRow; y++) if (alphaAt(layer, x, y) > 0) blades++;
  assert.ok(blades > 30, `grass and decor above the ground (${blades} px)`);
  // a spike on the ground: the fringe must not overwrite the spike's own tile
  const w2 = new World(reliefLevel('jungle'));
  w2.setTile(3, 12, T.SPIKE);
  const before = Buffer.from(getTileLayer(w2).data);
  const rebuilt = buildTileLayer(w2);
  assert.deepEqual(Buffer.from(rebuilt.data), before, 'patching in the spike matches a rebuild');
  const spikeTop = [...Array(16).keys()].some((x) => alphaAt(rebuilt, 3 * 16 + x, 12 * 16 + 10) > 0);
  assert.equal(spikeTop, true, 'the spike is drawn');
});

test('an overhang gets roots or stalactites hanging under it', () => {
  for (const [name] of [['jungle'], ['cave'], ['glacier']]) {
    const w = new World(reliefLevel(name));
    const layer = getTileLayer(w);
    // the carved cave's ceiling is the ground at row 14 over columns 12..15; things hang into row 15
    let ink = 0;
    for (let x = 12 * 16; x < 16 * 16; x++) for (let y = 15 * 16; y < 15 * 16 + RELIEF_REACH; y++) if (alphaAt(layer, x, y) > 0) ink++;
    assert.ok(ink > 5, `${name}: ${ink} px hang under the overhang`);
  }
});

test('patching the baked layer after changes around slopes, overhangs and deep ground gives exactly a full rebuild', () => {
  for (const name of ['jungle', 'glacier', 'cave', 'pyramid', 'factory']) {
    const w = new World(reliefLevel(name));
    const layer = getTileLayer(w);
    const edits = [[3, 14, 0], [9, 13, 0], [10, 12, T.SOLID], [13, 14, T.SOLID], [14, 15, T.SOLID], [20, 13, 0], [12, 16, T.SOLID]];
    for (const [x, y, id] of edits) w.setTile(x, y, id);
    assert.equal(w.tilesDirty, true);
    const patched = getTileLayer(w);
    assert.equal(patched, layer, `${name}: patched in place`);
    assert.deepEqual(Buffer.from(patched.data), Buffer.from(buildTileLayer(w).data), `${name}: patched == rebuilt`);
  }
});

test('burying the ground under a hill changes the bands below it, and the patch follows', () => {
  const w = new World(reliefLevel('jungle'));
  getTileLayer(w);
  const x = 2;
  const col = [];
  for (let y = 13; y < 17; y++) col.push(w.tile(x, y));
  w.setTile(x, 13, 0); // remove the surface tile: the one under it becomes the surface and the ones below shallower
  assert.deepEqual(col.length, 4);
  assert.deepEqual(Buffer.from(getTileLayer(w).data), Buffer.from(buildTileLayer(w).data));
});

test('slope cells in the layer are never painted with the magenta fallback in any theme', () => {
  for (const name of Object.keys(THEMES)) {
    const w = new World(reliefLevel(name));
    assert.ok(!isMagenta(getTileLayer(w)), name);
  }
});
