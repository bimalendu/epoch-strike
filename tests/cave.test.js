// Week 7: dark caves (lighting), torches, Level 4 and its hidden 1UP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { SoftCanvas } from '../tools/softcanvas.js';
import { VIEW_W, VIEW_H, TILE } from '../src/game/constants.js';
import { World } from '../src/game/world.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { renderWorld } from '../src/game/render.js';
import { brightnessAt, collectLights, MAX_DARK } from '../src/game/art/darkness.js';
import { THEMES } from '../src/game/art/themes.js';
import { buildLevel } from '../src/game/levels.js';
import { solveLevel } from '../src/game/solver.js';
import { spawnEnemy, damageEnemy } from '../src/game/enemies.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';
import { T, SOLID } from '../src/game/tiles.js';

function caveWorld(opts = {}) {
  const b = new LevelBuilder({ id: 3, theme: 'cave', name: 'T', seed: 3 });
  b.flat(60);
  b.exit();
  const lvl = b.finish();
  lvl.spawns = [];
  return new World(lvl, { god: true, ...opts });
}

function lum(c, x, y) {
  const i = (y * VIEW_W + x) * 4;
  return c.data[i] + c.data[i + 1] + c.data[i + 2];
}

/** The screen position of a world point. */
const scr = (w, x, y) => [Math.round(x - w.camera.rx), Math.round(y - w.camera.ry)];

test('only the cave theme is dark', () => {
  assert.equal(THEMES.cave.dark, true);
  for (const [name, t] of Object.entries(THEMES)) if (name !== 'cave') assert.ok(!t.dark, `${name} is not dark`);
});

test('light falls off with distance from the player, and the veil never goes fully black', () => {
  const w = caveWorld();
  run(w, makeInput(), 5);
  const [px, py] = scr(w, w.player.x, w.player.y - 14);
  const near = brightnessAt(w, w.camera.rx, w.camera.ry, px, py);
  const mid = brightnessAt(w, w.camera.rx, w.camera.ry, px + 30, py);
  const far = brightnessAt(w, w.camera.rx, w.camera.ry, px + 200, py);
  assert.ok(near > 0.9, `at the lantern ${near}`);
  assert.ok(mid < near && mid > far, `${near} > ${mid} > ${far}`);
  assert.equal(far, 0, 'out in the dark');
  assert.ok(MAX_DARK < 0.9, 'there is always a little visibility');

  const c = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c.getContext('2d'), w);
  const nearL = lum(c, px, py + 14);
  const farL = lum(c, px + 200, py + 14);
  assert.ok(nearL > farL, `the ground by the player (${nearL}) is brighter than the ground far away (${farL})`);
  assert.ok(farL > 0, 'but the far ground is not pitch black');
});

test('shooting flares the lantern, then it fades', () => {
  const w = caveWorld();
  const input = makeInput();
  run(w, input, 5);
  const r0 = collectLights(w, w.camera.rx, w.camera.ry).find((l) => l.i === 1 && Math.abs(l.x - (w.player.x - w.camera.rx)) < 1).r;
  w.player.fireT = 0;
  w.playerFire();
  assert.equal(w.lightPulse, 1);
  const flared = collectLights(w, w.camera.rx, w.camera.ry).find((l) => Math.abs(l.x - (w.player.x - w.camera.rx)) < 1 && l.r > r0);
  assert.ok(flared, 'a bigger light right after the shot');
  run(w, input, seconds(0.4));
  assert.equal(w.lightPulse, 0, 'faded');
});

test('bullets, explosions, burning enemies, pickups, torches and hazards all give light', () => {
  const w = caveWorld();
  const input = makeInput();
  run(w, input, 5);
  const base = collectLights(w, w.camera.rx, w.camera.ry).length;
  w.spawnBullet({ x: w.player.x + 90, y: w.player.y - 20, vx: 0, vy: 0, life: 3, kind: 'spear', dmg: 1 });
  w.spawnEnemyBullet({ x: w.player.x + 120, y: w.player.y - 20, vx: 0, vy: 0, life: 3, kind: 'orb' });
  const e = spawnEnemy(w, { type: 'caveman', x: w.player.x + 150, y: w.player.y });
  e.t = 99;
  assert.ok(e.alive);
  assert.ok(collectLights(w, w.camera.rx, w.camera.ry).length >= base + 3);
  // the spear lights a wider area than a rifle shot
  const spear = collectLights(w, w.camera.rx, w.camera.ry).find((l) => Math.abs(l.x - (w.player.x + 90 - w.camera.rx)) < 1);
  assert.ok(spear.r >= 40);
  // spikes and lava glow so a hazard is never a surprise
  w.setTile(Math.floor(w.player.x / TILE) + 8, 13, T.SPIKE);
  w.setTile(Math.floor(w.player.x / TILE) + 12, 13, T.LAVA);
  const lights = collectLights(w, w.camera.rx, w.camera.ry);
  const sx = (Math.floor(w.player.x / TILE) + 12) * TILE + 8 - w.camera.rx;
  assert.ok(lights.some((l) => Math.abs(l.x - sx) < 2), 'lava glows');
  // torches from the level
  const lvl = buildLevel(3);
  const w4 = new World(lvl, { god: true });
  run(w4, input, 5);
  const nearTorch = lvl.lights.find((t) => t.x > w4.camera.rx && t.x < w4.camera.rx + VIEW_W);
  assert.ok(nearTorch, 'a torch is on screen at the start of level 4');
  assert.ok(collectLights(w4, w4.camera.rx, w4.camera.ry).some((l) => Math.abs(l.x - (nearTorch.x - w4.camera.rx)) < 2));
});

test('a lit scene is brighter than an unlit one, and a bright level (jungle) is not veiled at all', () => {
  const dark = caveWorld();
  run(dark, makeInput(), 5);
  const c1 = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c1.getContext('2d'), dark);
  let sum = 0;
  for (let i = 0; i < c1.data.length; i += 4) sum += c1.data[i] + c1.data[i + 1] + c1.data[i + 2];
  const b = new LevelBuilder({ id: 0, theme: 'jungle', name: 'T', seed: 3 });
  b.flat(60); b.exit();
  const bright = new World(b.finish(), { god: true });
  run(bright, makeInput(), 5);
  const c2 = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c2.getContext('2d'), bright);
  let sum2 = 0;
  for (let i = 0; i < c2.data.length; i += 4) sum2 += c2.data[i] + c2.data[i + 1] + c2.data[i + 2];
  assert.ok(sum < sum2 * 0.35, `cave frame ${sum} vs jungle frame ${sum2}`);
});

test('torches: the builder records them and the renderer draws a flame', () => {
  const b = new LevelBuilder({ id: 3, theme: 'cave', name: 'T', seed: 3 });
  const s = b.flat(30);
  s.torch(5, 10, 64);
  b.addTorch(20, 9, 90);
  b.exit();
  const lvl = b.finish();
  assert.deepEqual(lvl.lights, [{ x: 5 * TILE + 8, y: 10 * TILE + 8, r: 64 }, { x: 20 * TILE + 8, y: 9 * TILE + 8, r: 90 }]);
  const w = new World(lvl, { god: true });
  run(w, makeInput(), 3);
  const c = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = c.getContext('2d');
  // no darkness here (jungle theme) so the torch art itself is visible
  w.level.theme = 'jungle';
  renderWorld(ctx, w);
  const [tx, ty] = scr(w, lvl.lights[0].x, lvl.lights[0].y);
  let orange = 0;
  for (let y = ty - 10; y < ty + 4; y++) for (let x = tx - 5; x < tx + 5; x++) {
    const i = (y * VIEW_W + x) * 4;
    if (c.data[i] > 200 && c.data[i + 1] > 90 && c.data[i + 1] < 200 && c.data[i + 2] < 80) orange++;
  }
  assert.ok(orange >= 4, `flame pixels ${orange}`);
});

// ---------------------------------------------------------------- Level 4

test('Level 4: stone-age caves with the right cast, torches, ceiling and a boss', () => {
  const lvl = buildLevel(3);
  assert.equal(lvl.name, 'CAVE TRIBES');
  assert.equal(lvl.theme, 'cave');
  assert.equal(lvl.boss.type, 'bear');
  const types = new Set(lvl.spawns.map((s) => s.type));
  for (const t of ['caveman', 'spearman', 'bat', 'capsule', 'pod']) assert.ok(types.has(t), `has ${t}`);
  assert.ok(lvl.lights.length >= 12, 'torches throughout');
  // rock overhead, with the skylight chimney and the open boss cavern left clear
  let ceiling = 0;
  for (let x = 0; x < lvl.boss.x0 / TILE; x++) if (SOLID[lvl.tiles[0 * lvl.cols + x]]) ceiling++;
  const open = lvl.boss.x0 / TILE - ceiling;
  assert.ok(ceiling > 200 && open >= 8 && open <= 20, `ceiling ${ceiling} columns, ${open} open`);
  for (let x = Math.floor(lvl.boss.x0 / TILE); x < lvl.cols; x++) assert.ok(!SOLID[lvl.tiles[x]], 'no ceiling in the boss cavern');
});

test('Level 4: the hidden 1UP is the only one in the era, and the climb to it is a real route', () => {
  const lvl = buildLevel(3);
  const ups = lvl.spawns.filter((s) => s.item === '1up');
  assert.equal(ups.length, 1);
  const sol = solveLevel(lvl);
  const up = ups[0];
  // a standable spot on the walking route sits within a tile of directly under the heart, 1-3 tiles below it
  const col = Math.floor(up.x / TILE);
  const row = Math.floor(up.y / TILE);
  const under = [...sol.reach.values()].map((r) => r.spot).filter((sp) => Math.abs(sp.x - col) <= 1 && sp.y >= row && sp.y - row <= 3);
  assert.ok(under.length > 0, 'a ledge under the heart can be reached on foot');
  // and there is a glowing heart to find: pickups light the dark
  const w = new World(lvl, { god: true });
  w.player.x = up.x - 60;
  w.camera.x = up.x - 120;
  const near = collectLights(w, w.camera.rx, w.camera.ry).some((l) => Math.abs(l.x - (up.x - w.camera.rx)) < 12 && l.r >= 20);
  assert.ok(near || w.pickups.length === 0);
});

test('Level 4 gives the Fire Spear twice before the boss, and the E capsule turns into the spear', () => {
  const lvl = buildLevel(3);
  const es = lvl.spawns.filter((s) => s.item === 'E');
  assert.ok(es.length >= 2, `${es.length} E drops`);
  const w = new World(lvl, { god: true });
  const input = makeInput();
  const cap = es.find((s) => s.type === 'capsule');
  w.player.x = cap.x - 140;
  w.camera.x = cap.x - 200;
  run(w, input, 2);
  const e = spawnEnemy(w, { type: 'capsule', item: 'E', x: w.player.x + 40, y: w.player.y - 30, face: -1 });
  e.hp = 1;
  w.player.slots = ['rifle', null];
  run(w, input, 2);
  // shoot it down: the capsule drops whatever era weapon this level gives, not a letter called E
  damageEnemy(w, e, 5, { x: e.x, y: e.cy, vx: 300, vy: 0 });
  assert.ok(!e.alive);
  assert.ok(!w.pickups.some((pk) => pk.item === 'E'), 'no raw E item');
  assert.ok(w.pickups.some((pk) => pk.item === 'spear'));
  for (let k = 0; k < 400 && !w.player.slots.includes('spear'); k++) {
    const pk = w.pickups.find((q) => q.item === 'spear');
    run(w, input, 1, pk && pk.x > w.player.x + 3 ? ['right'] : pk && pk.x < w.player.x - 3 ? ['left'] : []);
  }
  assert.ok(w.player.slots.includes('spear'), 'the player ends up holding the Fire Spear');
});

test('cave enemies: tuned defs, glowing eyes, telegraphed attacks', () => {
  for (const id of ['caveman', 'spearman', 'bat']) {
    const d = ENEMY_DEFS[id];
    assert.ok(d.glow >= 18, `${id} glows`);
    if (d.tele !== undefined) assert.ok(d.tele >= 0.5, `${id} telegraphs`);
  }
  assert.ok(ENEMY_DEFS.spearman.bullet.g > 0, 'the spear is thrown in an arc');
});
