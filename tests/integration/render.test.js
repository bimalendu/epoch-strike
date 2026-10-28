import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { VIEW_W, VIEW_H } from '../../src/game/constants.js';
import { THEMES } from '../../src/game/art/themes.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { World } from '../../src/game/world.js';
import { renderWorld } from '../../src/game/render.js';
import { buildTileLayer } from '../../src/game/art/tilelayer.js';
import { drawEnemy, drawEnemyBullet } from '../../src/game/art/enemies.js';
import { EBULLET_ART } from '../../src/game/art/ebullets.js';
import { ENEMY_DEFS, enemyDef } from '../../src/game/enemy_defs.js';
import { Enemy } from '../../src/game/enemies.js';
import { drawHud } from '../../src/game/art/hud.js';
import { buildLevel } from '../../src/game/levels.js';
import { drawBullet, BULLET_ART } from '../../src/game/art/bullets.js';
import { drawBike } from '../../src/game/art/bike.js';
import { WEAPONS } from '../../src/game/weapons.js';
import { flatLevel } from '../../src/game/ascii.js';
import { makeInput, run } from '../support/helpers.js';

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

// ---- gameplay overlays that only appear in certain player states -------------------------------------------------

const countOn = (c) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) n++;
  return n;
};

/** Pixels that differ between two same-sized canvases. */
function diffPixels(a, b) {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  }
  return n;
}

/** Renders level 1's first frame; `tweak(world)` changes the state first. Time is pinned so two renders are comparable. */
function frameWith(tweak = () => {}) {
  const w = new World(buildLevel(0));
  w.time = 1.25;
  tweak(w);
  const c = new SoftCanvas(VIEW_W, VIEW_H);
  renderWorld(c.getContext('2d'), w);
  return { c, w };
}

test('a frame renders identically twice, so the overlay diffs below measure only the state they change', () => {
  assert.equal(diffPixels(frameWith().c, frameWith().c), 0);
});

test('riding a chariot draws the car under the soldier; a prone soldier is not on the car', () => {
  const plain = frameWith();
  const ride = frameWith((w) => { w.chariot = true; });
  assert.ok(diffPixels(plain.c, ride.c) > 150, 'the 30 px car and its wheels appear');
  const prone = frameWith((w) => { w.chariot = true; w.player.prone = true; });
  const pronePlain = frameWith((w) => { w.player.prone = true; });
  assert.equal(diffPixels(prone.c, pronePlain.c), 0, 'no car while prone');
});

test('standing in quicksand draws sand to the thighs, and the drowning meter turns red past 70 per cent', () => {
  const plain = frameWith();
  const sunk = frameWith((w) => { w.player.inQuick = true; });
  assert.ok(diffPixels(plain.c, sunk.c) > 60, 'sand covers the legs');
  const meterOnly = (t) => frameWith((w) => { w.player.quickT = t; });
  assert.equal(diffPixels(plain.c, meterOnly(0.3).c), 0, 'no meter in the first 0.4 s');
  const early = meterOnly(0.5);
  const late = meterOnly(2.4);
  assert.ok(diffPixels(plain.c, early.c) > 20, 'the meter shows');
  assert.ok(diffPixels(early.c, late.c) > 20, 'and fills further');
  const redIn = (f) => {
    let n = 0;
    for (let i = 0; i < f.c.data.length; i += 4) if (f.c.data[i] > 200 && f.c.data[i + 1] < 90 && f.c.data[i + 2] < 70) n++; // the vignette tints it a little
    return n;
  };
  assert.ok(redIn(early) <= redIn(plain) + 1, 'yellow while there is time');
  assert.ok(redIn(late) > redIn(plain) + 10, 'red when nearly under');
});

test('the barrier bubble is drawn while it lasts and blinks in its last two seconds', () => {
  const plain = frameWith();
  const on = frameWith((w) => { w.player.barrier = 5; });
  assert.ok(diffPixels(plain.c, on.c) > 40, 'the bubble shows');
  // below 2 s it flickers: one of two instants a sixteenth of a second apart has no bubble
  const instants = [1.99, 1.86].map((b) => diffPixels(plain.c, frameWith((w) => { w.player.barrier = b; }).c));
  assert.ok(Math.min(...instants) === 0 && Math.max(...instants) > 40, `blink phases ${instants}`);
});

test('the tank is drawn in place of the soldier, mirrors with facing and smokes when nearly wrecked', () => {
  const foot = frameWith();
  const tank = frameWith((w) => w.player.mountTank());
  assert.ok(diffPixels(foot.c, tank.c) > 300, 'a tank is a lot bigger than a soldier');
  const left = frameWith((w) => { w.player.mountTank(); w.player.face = -1; });
  assert.ok(diffPixels(tank.c, left.c) > 20, 'facing flips the hull and barrel');
  const hurt = frameWith((w) => { w.player.mountTank(); w.player.tankHp = 1; });
  assert.ok(diffPixels(tank.c, hurt.c) > 10, 'one hit from wreck adds smoke');
});

test('a hoverbike with one hit left trails smoke and sparks that a healthy bike does not', () => {
  const draw = (hp, t) => {
    const c = new SoftCanvas(120, 80);
    drawBike(c.getContext('2d'), 60, 60, 1, { x: 1, y: 0 }, t, hp);
    return c;
  };
  const healthy = draw(2, 0);
  assert.ok(countOn(healthy) > 100);
  for (const t of [0, 1.2, 2.4]) assert.ok(diffPixels(draw(2, t), draw(1, t)) > 8, `smoke at t=${t}`);
});

test('the HUD shows TANK armour pips, a barrier timer that shrinks, and the arena wave counter', () => {
  const hud = (tweak, extra = {}) => {
    const w = new World(buildLevel(0));
    tweak(w);
    const c = new SoftCanvas(VIEW_W, VIEW_H);
    drawHud(c.getContext('2d'), w, null, extra);
    return c;
  };
  const base = hud(() => {});
  assert.ok(diffPixels(base, hud(() => {}, { god: true })) > 10, 'GOD tag');
  assert.ok(diffPixels(hud(() => {}, { god: false }), base) === 0, 'no tag without god');
  assert.ok(diffPixels(base, hud((w) => w.player.mountTank())) > 40, 'TANK label and pips');
  const pips = (hp) => hud((w) => { w.player.mountTank(); w.player.tankHp = hp; });
  assert.ok(diffPixels(pips(1), pips(3)) > 10, 'fewer pips lit with less armour');
  const full = hud((w) => { w.player.barrier = 10; });
  const half = hud((w) => { w.player.barrier = 5; });
  assert.ok(diffPixels(base, full) > 100, 'a bar appears');
  assert.ok(diffPixels(full, half) > 20, 'and shrinks with time');
  const arena = (wave, boss = null) => hud((w) => {
    w.arena = { state: 'fighting', wave, waves: [[], [], []] };
    w.boss = boss;
  });
  assert.ok(diffPixels(base, arena(0)) > 30, 'WAVE n/m shows while fighting');
  assert.ok(diffPixels(arena(0), arena(1)) > 5, 'and counts up');
  assert.equal(diffPixels(arena(2), arena(99)), 0, 'it never reads past the last wave');
});

test('every player bullet kind draws at all angles, differs from the rifle and falls back to it when unknown', () => {
  const at = (kind, vx, vy) => {
    const c = new SoftCanvas(40, 40);
    drawBullet(c.getContext('2d'), { x: 20, y: 20, vx, vy, kind, life: 0.2 }, 0, 0);
    return c;
  };
  for (const kind of Object.keys(BULLET_ART)) {
    for (const [vx, vy] of [[300, 0], [-300, 0], [0, -300], [200, -200], [-200, -200], [200, 200]]) {
      assert.ok(countOn(at(kind, vx, vy)) >= 4, `${kind} at ${vx},${vy}`);
    }
    if (kind !== 'rifle') assert.ok(diffPixels(at(kind, 300, 0), at('rifle', 300, 0)) > 0, `${kind} looks different from the rifle`);
  }
  assert.equal(diffPixels(at('no-such-kind', 300, 0), at('rifle', 300, 0)), 0);
});

test('every kind a weapon fires, and the tank shell, has bullet art', () => {
  const kinds = new Set();
  const fire = (setup) => {
    const w = new World(flatLevel(40, 14), { god: true });
    w.player.y = 14 * 16;
    w.player.x = 80;
    setup(w.player);
    run(w, makeInput(), 12, ['fire']);
    for (const b of w.bullets) kinds.add(b.kind);
  };
  for (const id of Object.keys(WEAPONS)) fire((p) => { p.weapon = id; });
  fire((p) => p.mountTank());
  assert.ok(kinds.has('tankshell') && kinds.has('rifle'));
  assert.ok(kinds.size >= Object.keys(WEAPONS).length, `fired only ${[...kinds]}`);
  for (const k of kinds) assert.ok(BULLET_ART[k], `no art for bullet kind "${k}"`);
});

test('every enemy def draws in each state it can be in, in both facings, and its warning state looks different from idle', () => {
  const STATES = ['idle', 'tele', 'attack', 'charge', 'leap', 'lurk', 'rest', 'dive'];
  const drawn = (def, state, face, flash = 0, x = 100) => {
    const c = new SoftCanvas(200, 160);
    const e = new Enemy(def, x, 110, { face });
    e.state = state;
    e.t = (def.tele || 0.8) * 0.5;
    e.ang = -1;
    e.open = true;
    e.flash = flash;
    e.base = 120;
    e.vy = -60;
    e.trail = Array.from({ length: 12 }, (_, i) => ({ x: 100 - face * i * 2, y: 106 + i * 3 }));
    drawEnemy(c.getContext('2d'), e, 0, 0);
    return c;
  };
  for (const def of Object.values(ENEMY_DEFS)) {
    for (const face of [-1, 1]) {
      for (const state of STATES) {
        assert.doesNotThrow(() => drawn(def, state, face), `${def.id} ${state} face ${face}`);
      }
      assert.doesNotThrow(() => drawn(def, 'idle', face, 0.1), `${def.id} flashing`);
    }
  }
  // the ones whose telegraph is drawn rather than a different frame
  for (const id of ['catapult', 'serpent', 'elephant', 'rivalchariot']) {
    const def = ENEMY_DEFS[id];
    // a rival chariot only flags its charge from the screen edge, so it is drawn just off-screen
    const x = id === 'rivalchariot' ? -30 : 100;
    assert.ok(diffPixels(drawn(def, 'idle', 1, 0, x), drawn(def, 'tele', 1, 0, x)) > 0, `${id}: the warning shows`);
  }
});

test('enemyDef returns a def by id and throws a clear error for an unknown type', () => {
  assert.equal(enemyDef('grunt').id, 'grunt');
  assert.throws(() => enemyDef('no-such-enemy'), /Unknown enemy type: no-such-enemy/);
});
