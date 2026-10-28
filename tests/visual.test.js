// Visual polish: hit flashes, combat juice, world rendering, HUD feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { SoftCanvas } from '../tools/softcanvas.js';
import { drawEnemy } from '../src/game/art/enemies.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';
import { Enemy } from '../src/game/enemies.js';
import { hitMix } from '../src/game/art/hit.js';
import { lightenedCopy } from '../src/engine/gfx.js';
import { makeGame, stepN } from '../tools/shots.mjs';
import { registerRoutes } from '../src/scenes/routes.js';
import { HIT_STOP, BOSS_SLOWMO } from '../src/scenes/play.js';
import { Run } from '../src/game/run.js';
import { World } from '../src/game/world.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { killEnemy } from '../src/game/enemies.js';
import { drawFx } from '../src/game/art/fx.js';
import { makeInput, run as runWorld } from './helpers.js';
import { THEMES, getTheme } from '../src/game/art/themes.js';
import { skyCanvas, clearSkyCache } from '../src/game/art/sky.js';
import { drawSky } from '../src/game/art/tilelayer.js';
import { sceneryLayer } from '../src/game/art/scenery.js';
import { drawShadows } from '../src/game/art/shadow.js';
import { drawVignette, drawHurt } from '../src/game/art/vignette.js';
import { BULLET_GLOW } from '../src/game/art/glow.js';
import { BULLET_ART } from '../src/game/art/bullets.js';
import { renderWorld } from '../src/game/render.js';
import { warmTasks } from '../src/game/art/warm.js';
import { mix } from '../src/game/art/common.js';

/** Total brightness and number of visible pixels of a canvas. */
function measure(c) {
  let sum = 0;
  let px = 0;
  for (let i = 0; i < c.data.length; i += 4) {
    if (c.data[i + 3] === 0) continue;
    px++;
    sum += c.data[i] + c.data[i + 1] + c.data[i + 2];
  }
  return { sum, px };
}

function drawDef(def, flash) {
  const c = new SoftCanvas(120, 120);
  const e = new Enemy(def, 60, 80, { face: 1 });
  e.ang = -1;
  e.open = true;
  if (def.arch === 'breacher') {
    e.base = 90;
    e.state = 'leap';
    e.vy = -60;
    e.trail = Array.from({ length: 12 }, (_, i) => ({ x: 60 - i * 2, y: 76 + i * 3 }));
  }
  e.flash = flash;
  drawEnemy(c.getContext('2d'), e, 0, 0);
  return measure(c);
}

// nothing flashes that a bullet cannot hurt: the stone blocks, and an icicle (one hit point, it shatters)
const NEVER_FLASH = new Set(['crusher', 'press', 'icicle']);

test('hit flash: every enemy and boss is brighter for a moment after a hit, and keeps its outline', () => {
  for (const def of Object.values(ENEMY_DEFS)) {
    if (NEVER_FLASH.has(def.id)) continue;
    const calm = drawDef(def, 0);
    const hit = drawDef(def, 0.11);
    assert.equal(hit.px, calm.px, `${def.id}: the flash must not change the silhouette`);
    assert.ok(hit.sum > calm.sum, `${def.id}: ${hit.sum} should be brighter than ${calm.sum}`);
  }
});

test('hit flash: full strength for the first frames only, and a boss only brightens', () => {
  const grunt = { def: { boss: false }, flash: 0.12 };
  const late = { def: { boss: false }, flash: 0.03 };
  const boss = { def: { boss: true }, flash: 0.08 };
  assert.ok(hitMix(grunt) > hitMix(boss) && hitMix(boss) > 0);
  assert.equal(hitMix(late), 0, 'the flash ends before e.flash runs out');
  assert.equal(hitMix({ def: { boss: false }, flash: 0 }), 0);
});

test('lightenedCopy mixes colours toward white and keeps alpha', () => {
  const src = new SoftCanvas(2, 1);
  src.data.set([200, 100, 0, 255, 0, 0, 0, 0]);
  const out = lightenedCopy(src, 0.5);
  assert.deepEqual([...out.data.slice(0, 4)], [228, 178, 128, 255]);
  assert.equal(out.data[7], 0, 'a transparent pixel stays transparent');
});

function flatWorld(theme = 'jungle', opts = {}) {
  const b = new LevelBuilder({ id: 1, theme, name: 'flat', seed: 3 });
  b.flat(60);
  b.exit();
  return new World(b.finish(), { god: false, ...opts });
}

function playScene() {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 1);
  return { game, canvas, world: () => game.scene.world };
}

test('muzzle flash: a shot adds a flash in the weapon colour that is drawn along the aim and gone within a few frames', () => {
  const w = flatWorld();
  const input = makeInput();
  runWorld(w, input, 5);
  runWorld(w, input, 1, ['fire']);
  const f = w.fx.find((x) => x.k === 'muzzle');
  assert.ok(f, 'firing leaves a muzzle flash');
  assert.equal(f.col, '#ffe66b', 'the rifle flashes in its own colour');
  assert.ok(f.dx > 0.9, 'aimed forward');
  const c = new SoftCanvas(480, 270);
  drawFx(c.getContext('2d'), w, w.camera.rx, w.camera.ry);
  assert.ok(measure(c).px >= 8, 'it draws a few pixels');
  runWorld(w, input, 8);
  assert.ok(!w.fx.includes(f), 'the first flash has faded');
});

test('kills: a pop ring and pieces in the enemy\'s own colours', () => {
  const w = flatWorld();
  const def = ENEMY_DEFS.trooper;
  const e = new Enemy(def, 100, 100, {});
  w.enemies.push(e);
  killEnemy(w, e);
  assert.ok(w.fx.some((f) => f.k === 'ring' && f.col === '#ffffff'), 'a white pop ring');
  const own = new Set(Object.values(def.pal).filter((v) => typeof v === 'string'));
  assert.ok(w.fx.some((f) => f.k === 'px' && own.has(f.col)), 'debris in the trooper\'s colours');
});

test('respawn: the soldier beams in with a column of light', () => {
  const w = flatWorld();
  w.killPlayer('test');
  w.fx.length = 0;
  w.respawnPlayer(w.player.x, w.player.y);
  assert.ok(w.fx.some((f) => f.k === 'beam'));
  runWorld(w, makeInput(), 40);
  assert.ok(!w.fx.some((f) => f.k === 'beam'), 'it is over in under a second');
});

test('hit-stop: a death holds the world still for a few frames, then time runs again', () => {
  const { game, world } = playScene();
  const w = world();
  w.killPlayer('test');
  stepN(game, 1); // the scene reads the death and starts the hit-stop
  const t0 = w.time;
  stepN(game, HIT_STOP.death);
  assert.equal(w.time, t0, 'nothing moved during the hit-stop');
  stepN(game, 3);
  assert.ok(w.time > t0, 'the world is running again');
});

test('boss events: a phase change freezes briefly, and a boss going down plays in slow motion', () => {
  const { game, world } = playScene();
  const w = world();
  const scene = game.scene;
  scene.onEvent({ type: 'bossPhase', id: 'x', phase: 1 });
  assert.equal(scene.freezeF, HIT_STOP.phase);
  stepN(game, HIT_STOP.phase);
  scene.onEvent({ type: 'bossDying', id: 'x' });
  stepN(game, HIT_STOP.bossDown); // the freeze first
  const t0 = w.time;
  const n = Math.round(BOSS_SLOWMO * 60);
  stepN(game, n);
  const advanced = Math.round((w.time - t0) * 60);
  assert.ok(advanced >= n / 2 - 2 && advanced <= n / 2 + 2, `half speed: ${advanced} world frames in ${n} scene frames`);
  stepN(game, 30);
  assert.equal(scene.slowT <= 0, true);
});

// ---- world rendering ----

const hex = (r, g, b) => '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
function colourAt(c, x, y) {
  const i = (y * c.width + x) * 4;
  return hex(c.data[i], c.data[i + 1], c.data[i + 2]);
}
function whiteCanvas(w = 480, h = 270) {
  const c = new SoftCanvas(w, h);
  c.data.fill(255);
  return c;
}

test('sky: dithered bands in one drawImage, using only the theme\'s own colours, identical on every build', () => {
  for (const [id, theme] of Object.entries(THEMES)) {
    const t = { ...theme, id };
    clearSkyCache();
    const a = skyCanvas(t);
    const first = Buffer.from(a.data);
    clearSkyCache();
    assert.deepEqual(Buffer.from(skyCanvas(t).data), first, `${id}: a rebuilt sky differs`);
    const seen = new Set();
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x += 3) seen.add(colourAt(a, x, y));
    for (const col of seen) assert.ok(t.sky.includes(col), `${id}: ${col} is not a sky colour`);
    assert.equal(colourAt(a, 5, 0), t.sky[0], `${id}: top row is the first band`);
    assert.equal(colourAt(a, 5, 269), t.sky[t.sky.length - 1], `${id}: bottom row is the last band`);
    // across the first band edge both colours appear: it is blended, not stepped
    const edge = Math.ceil(270 / t.sky.length);
    const mixed = new Set();
    for (let y = edge - 4; y < edge + 4; y++) for (let x = 0; x < 16; x++) mixed.add(colourAt(a, x, y));
    assert.ok(mixed.has(t.sky[0]) && mixed.has(t.sky[1]), `${id}: the edge between bands 0 and 1 is dithered`);
  }
  let calls = 0;
  drawSky({ drawImage() { calls++; }, fillRect() { calls += 100; }, set fillStyle(v) { calls += 100; } }, getTheme('jungle'));
  assert.equal(calls, 1, 'the sky costs one canvas call');
});

test('haze: far scenery fades toward the sky at its horizon, the nearest layer does not', () => {
  const theme = getTheme('jungle');
  const far = { k: 'hills', c: '#2f7a3c', y: 190, a: 40, s: 0.08, seed: 4 };
  const near = { k: 'hills', c: '#2f7a3c', y: 190, a: 40, s: 0.5, seed: 4 };
  const dist = (c1, c2) => {
    const n1 = parseInt(c1.slice(1), 16), n2 = parseInt(c2.slice(1), 16);
    return Math.abs((n1 >> 16) - (n2 >> 16)) + Math.abs(((n1 >> 8) & 255) - ((n2 >> 8) & 255)) + Math.abs((n1 & 255) - (n2 & 255));
  };
  const probe = (c) => colourAt(c, 240, 262); // inside the hill
  const sky = theme.sky[Math.floor(190 / Math.ceil(270 / theme.sky.length))];
  const plain = sceneryLayer('test:haze:plain', far);
  const farHazed = sceneryLayer('test:haze:far', far, theme);
  assert.equal(probe(plain), '#2f7a3c');
  assert.ok(dist(probe(farHazed), sky) < dist(probe(plain), sky), 'the far hill is closer to the sky colour');
  assert.equal(probe(sceneryLayer('test:haze:near', near, theme)), '#2f7a3c', 'a near layer is untouched');
  assert.equal(probe(sceneryLayer('test:haze:off', far, { ...theme, haze: 0 })), '#2f7a3c', 'haze: 0 switches it off');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('shadows: a soldier and an enemy standing on the floor get one, a flyer does not', () => {
  const c = whiteCanvas();
  const stand = { alive: true, hidden: false, grounded: true, gdir: 1, def: {}, x: 100, y: 100, w: 12 };
  const fly = { alive: true, hidden: false, grounded: false, gdir: 1, def: { flyer: true }, x: 200, y: 100, w: 12 };
  const world = { player: { alive: true, grounded: true, mode: 'foot', x: 50, y: 100 }, enemies: [stand, fly] };
  drawShadows(c.getContext('2d'), world, 0, 0);
  assert.notEqual(colourAt(c, 50, 100), '#ffffff', 'the soldier\'s feet');
  assert.notEqual(colourAt(c, 100, 100), '#ffffff', 'the enemy\'s feet');
  assert.equal(colourAt(c, 200, 100), '#ffffff', 'a flyer casts none');
  assert.equal(colourAt(c, 100, 98), '#ffffff', 'the shadow lies on the ground, not on the sprite');
  world.player.grounded = false;
  const d = whiteCanvas();
  drawShadows(d.getContext('2d'), world, 0, 0);
  assert.equal(colourAt(d, 50, 100), '#ffffff', 'a jumping soldier casts none');
});

function renderAt(world) {
  const c = new SoftCanvas(480, 270);
  renderWorld(c.getContext('2d'), world);
  return c;
}
/** How many pixels of two renders differ in the ring between `r0` and `r1` px from (x, y). */
function ringDiff(a, b, x, y, r0, r1) {
  let n = 0;
  for (let py = Math.max(0, y - r1); py <= Math.min(269, y + r1); py++) {
    for (let px = Math.max(0, x - r1); px <= Math.min(479, x + r1); px++) {
      const d = Math.max(Math.abs(px - x), Math.abs(py - y));
      if (d < r0 || d > r1) continue;
      if (colourAt(a, px, py) !== colourAt(b, px, py)) n++;
    }
  }
  return n;
}

test('glow: bullets get a halo in a glow theme at high quality, and not in other themes or at low quality', () => {
  const shot = (theme, fx, withBullet) => {
    const w = flatWorld(theme, { fx });
    if (withBullet) w.spawnBullet({ x: 150, y: 120, vx: 0, vy: 0, dmg: 1, life: 5, kind: 'rifle' });
    return renderAt(w);
  };
  for (const [theme, fx, expectGlow] of [['neon', 'high', true], ['neon', 'low', false], ['jungle', 'high', false]]) {
    const halo = ringDiff(shot(theme, fx, true), shot(theme, fx, false), 150, 120, 5, 9);
    if (expectGlow) assert.ok(halo > 20, `${theme}/${fx}: ${halo} halo pixels`);
    else assert.equal(halo, 0, `${theme}/${fx}: ${halo} halo pixels`);
  }
  for (const id of Object.keys(THEMES)) assert.equal(typeof !!getTheme(id).glow, 'boolean');
  for (const kind of Object.keys(BULLET_GLOW)) assert.ok(BULLET_ART[kind], `glow colour for unknown bullet kind ${kind}`);
});

test('vignette: the corners are darker than the middle, and a hurt flash is red and fades away', () => {
  const c = whiteCanvas();
  drawVignette(c.getContext('2d'));
  assert.equal(colourAt(c, 240, 135), '#ffffff', 'the middle is untouched');
  assert.ok(c.data[0] < c.data[(135 * 480 + 240) * 4] - 20, 'the corner is darker');
  const h = whiteCanvas();
  drawHurt(h.getContext('2d'), 0);
  assert.ok(h.data[0] > h.data[1] + 10, 'red at the corner: more red than green');
  const gone = whiteCanvas();
  drawHurt(gone.getContext('2d'), 1);
  assert.equal(colourAt(gone, 0, 0), '#ffffff', 'faded');
});

test('rendering: low effects quality has no vignette; a death flashes the edges red for a moment only', () => {
  const hi = flatWorld('jungle', { fx: 'high' });
  const lo = flatWorld('jungle', { fx: 'low' });
  assert.ok(renderAt(hi).data[0] < renderAt(lo).data[0], 'the vignette darkens the corner at high quality only');
  hi.killPlayer('test');
  hi.deathT = 0.05;
  const hurt = renderAt(hi);
  hi.deathT = 1;
  const later = renderAt(hi);
  assert.ok(hurt.data[0] - hurt.data[1] > later.data[0] - later.data[1] + 5, 'redder right after a death than a moment later');
  hi.deathT = 2;
  assert.deepEqual(Buffer.from(renderAt(hi).data), Buffer.from(later.data), 'the flash is over: nothing changes with time');
});

test('warm-up covers the sky of every theme, the glow sprites and the vignettes', () => {
  const names = warmTasks().map((t) => t.name);
  for (const id of Object.keys(THEMES)) assert.ok(names.includes(`sky ${id}`), `sky ${id}`);
  assert.ok(names.includes('glow') && names.includes('vignette') && names.includes('vignette red'));
});
