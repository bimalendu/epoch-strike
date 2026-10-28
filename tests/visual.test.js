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
import { drawHud } from '../src/game/art/hud.js';
import { Toasts } from '../src/scenes/toasts.js';
import { Hints, HINTS, HINT_TIME } from '../src/scenes/hints.js';
import { SaveData, MemoryStorage, SAVE_KEY } from '../src/game/save.js';
import { levelProgress } from '../src/game/progress.js';
import { buildLevel, levelCount } from '../src/game/levels.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';

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

// ---- HUD and onboarding ----

test('toasts: one banner at a time, a repeated text is not queued twice, and each one goes away on its own', () => {
  const t = new Toasts();
  t.push('CHECKPOINT');
  t.push('CHECKPOINT');
  t.push('LAST LIFE');
  assert.equal(t.queue.length, 2, 'CHECKPOINT and LAST LIFE: the repeat was dropped');
  t.update(0.01);
  assert.equal(t.cur.text, 'CHECKPOINT');
  const c = whiteCanvas();
  t.update(0.4);
  t.draw(c.getContext('2d'), 36);
  assert.ok(measure(c).sum < 480 * 270 * 3 * 255, 'it draws something');
  t.update(2);
  assert.equal(t.cur, null, 'it has gone');
  t.update(0.01);
  assert.equal(t.cur.text, 'LAST LIFE', 'then the next one');
  for (let i = 0; i < 10; i++) t.push(`T${i}`);
  assert.ok(t.queue.length <= 3, 'the queue is short');
});

function hintWorld(over = {}) {
  return { player: { slots: ['rifle', null], mode: 'foot', alive: true }, ...over };
}

test('hints: shown once per save, wait while something else is on the banner, and are remembered', () => {
  const storage = new MemoryStorage();
  const save = new SaveData(storage);
  const h = new Hints(save);
  const w = hintWorld();
  h.observe(w, { type: 'pickup', item: 'S' });
  assert.equal(h.queue.length, 0, 'one weapon: nothing to swap to');
  w.player.slots = ['rifle', 'spread'];
  h.observe(w, { type: 'pickup', item: 'S' });
  h.update(0.1, true);
  assert.equal(h.text, null, 'blocked by a tutorial prompt');
  h.update(0.1, false);
  assert.match(h.text, /\{switch\}/);
  assert.ok(save.hintSeen('swap'), 'remembered as soon as it is shown');
  h.update(HINT_TIME + 0.1, false);
  assert.equal(h.text, null);
  h.observe(w, { type: 'pickup', item: 'S' });
  assert.equal(h.queue.length, 0, 'never again');
  assert.ok(new SaveData(storage).hintSeen('swap'), 'and it survives a reload');
  // state-based hints watch the world on plain frames
  const t = new Hints(new SaveData(new MemoryStorage()));
  t.observe(hintWorld({ player: { slots: ['rifle', null], mode: 'tank', alive: true } }));
  assert.equal(t.queue[0].id, 'tank');
  for (const id of new Set(HINTS.map((x) => x.id))) assert.match(id, /^[a-z0-9-]{1,24}$/);
  assert.equal(new Set(HINTS.map((x) => x.id)).size, HINTS.length, 'ids are unique');
});

test('save: the list of shown hints is cleaned on load', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, hints: ['swap', 7, 'BAD ID', 'x'.repeat(40), 'swap', 'bomb', null] }));
  assert.deepEqual(new SaveData(storage).data.hints, ['swap', 'bomb']);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, hints: 'rubbish' }));
  assert.deepEqual(new SaveData(storage).data.hints, []);
  const s = new SaveData(new MemoryStorage());
  for (let i = 0; i < 50; i++) s.markHint(`h${i}`);
  assert.ok(s.data.hints.length <= 32, 'the list cannot grow without end');
});

test('progress: every level has a bar that starts empty, ends full and keeps its markers in order', () => {
  for (let i = 0; i < levelCount(); i++) {
    const L = buildLevel(i);
    const w = new World(L, {});
    const pr = levelProgress(w);
    assert.ok(pr, `level ${i + 1} has a bar`);
    assert.equal(pr.vertical, (L.exitY ?? (L.boss ? L.boss.triggerY : undefined)) !== undefined, `level ${i + 1}: climbing or running`);
    assert.ok(pr.frac < 0.02, `level ${i + 1} starts at the start (${pr.frac})`);
    const f = pr.checkpoints.map((c) => c.f);
    for (const v of f) assert.ok(v >= 0 && v <= 1, `level ${i + 1} checkpoint ${v}`);
    assert.equal(pr.arenas.length, w.arenas.length - 1, `level ${i + 1}: a skull per boss arena before the last`);
    // standing at the goal fills the bar
    if (pr.vertical) w.player.y = L.exitY ?? L.boss.triggerY;
    else w.player.x = L.exitX ?? L.boss.trigger;
    assert.equal(levelProgress(w).frac, 1, `level ${i + 1} ends full`);
  }
});

test('HUD: plates, the progress bar, the title card, the weapon label and the boss entrance', () => {
  const w = new World(buildLevel(1), {});
  const run = new Run();
  const hud = (extra, canvas = whiteCanvas(), world = w) => {
    drawHud(canvas.getContext('2d'), world, run, extra);
    return canvas;
  };
  // a plate behind the corner clusters
  const plain = hud({});
  assert.notEqual(colourAt(plain, 78, 8), '#ffffff', 'the lives plate');
  assert.equal(colourAt(plain, 120, 8), '#ffffff', 'but only behind the lives');
  // the bar along the bottom, gone while a prompt is up
  assert.notEqual(colourAt(plain, 240, VIEW_H - 5), '#ffffff', 'progress bar');
  assert.equal(colourAt(hud({ prompt: 'JUMP' }), 240, VIEW_H - 5), '#ffffff', 'hidden under a prompt');
  // the title card wipes in, holds, and wipes out
  const card = (t) => hud({ card: { t, total: 2.2, title: 'DINO JUNGLE', subtitle: 'CRETACEOUS', number: 1 } });
  assert.equal(colourAt(card(2.2), 40, 100), '#ffffff', 'not there yet');
  assert.notEqual(colourAt(card(1.2), 40, 90), '#ffffff', 'band at full width');
  assert.equal(colourAt(card(0.0001), 40, 90), '#ffffff', 'gone again');
  // the weapon label
  const label = (l) => measure(hud({ weaponLabel: l })).sum;
  assert.ok(label({ text: 'SPREAD', color: '#00ff00', t: 1 }) < label(null), 'named under the slots');
  assert.equal(label({ text: 'SPREAD', color: '#00ff00', t: 0 }), label(null), 'and not once it has faded');
  // a boss: letterbox bars during the entrance, and a trail where health was lost
  const boss = { maxHp: 80, echo: false, def: { name: 'REX-7', phases: [{ hp: 1 }, { hp: 0.5 }] }, bs: { state: 'enter', age: 0.1, shownHp: 40, phase: 0 } };
  const bw = { ...w, boss, player: w.player, level: { ...w.level, era: 'CRETACEOUS' } };
  assert.equal(colourAt(hud({ intro: 1 }, whiteCanvas(), bw), 240, 0), '#000000', 'top bar');
  assert.equal(colourAt(hud({ intro: 1 }, whiteCanvas(), bw), 240, VIEW_H - 1), '#000000', 'bottom bar');
  assert.equal(colourAt(hud({ intro: 0 }, whiteCanvas(), bw), 240, 0), '#ffffff', 'no bars once it has arrived');
  boss.bs.state = 'idle';
  const bx = Math.round((VIEW_W - 220) / 2);
  assert.equal(colourAt(hud({ trail: 60 }, whiteCanvas(), bw), bx + Math.round(220 * 0.6), 38), '#ffffff', 'the trail (white) where health was');
  assert.equal(colourAt(hud({ trail: 0 }, whiteCanvas(), bw), bx + Math.round(220 * 0.6), 38), '#4a1218', 'the empty part of the bar');
});

function sceneFixture() {
  const f = playScene();
  return { ...f, scene: f.game.scene, run: f.game.scene.run, toastTexts: () => [f.game.scene.toasts.cur, ...f.game.scene.toasts.queue].filter(Boolean).map((t) => t.text) };
}

test('play scene: toasts for a checkpoint, the era weapon, the ninth medal and the last life, and for nothing else', () => {
  const { scene, run, toastTexts } = sceneFixture();
  scene.onEvent({ type: 'checkpoint', x: 10, y: 10 });
  scene.onEvent({ type: 'pickup', item: 'M' });
  assert.deepEqual(toastTexts(), ['CHECKPOINT'], 'an ordinary weapon names itself in a popup already');
  scene.onEvent({ type: 'pickup', item: 'spear' });
  assert.ok(toastTexts().includes('ERA WEAPON: FIRE SPEAR'));
  run.lives.medals = 3;
  scene.onEvent({ type: 'medal', x: 0, y: 0 });
  assert.ok(!toastTexts().some((t) => t.includes('MEDAL')), 'the fourth medal is not news');
  run.lives.medals = 8;
  scene.onEvent({ type: 'medal', x: 0, y: 0 });
  assert.ok(toastTexts().includes('1 MEDAL TO A 1UP'));
  run.lives.lives = 3;
  scene.onEvent({ type: 'playerDied', cause: 'test' });
  assert.ok(!toastTexts().includes('LAST LIFE'), 'two left');
  scene.onEvent({ type: 'playerDied', cause: 'test' });
  assert.ok(toastTexts().includes('LAST LIFE'));
});

test('play scene: a new weapon is named under the slots for a moment, and a first-time hint waits for the level card', () => {
  const { game, scene, world } = sceneFixture();
  const w = world();
  assert.equal(scene.weaponLabel.t, 0, 'nothing to say about the weapon you start with');
  w.player.giveWeapon('spread');
  w.events.push({ type: 'pickup', item: 'S' });
  stepN(game, 1);
  assert.equal(scene.weaponLabel.text, 'SPREAD');
  assert.ok(scene.weaponLabel.t > 1);
  assert.equal(scene.hints.text, null, 'the level card is still on screen');
  assert.ok(scene.hints.queue.some((h) => h.id === 'swap'));
  stepN(game, 60 * 3);
  assert.match(scene.hints.text, /SWAPS BETWEEN/);
  assert.ok(scene.weaponLabel.t <= 0, 'the label has faded');
  game.render();
  assert.ok(game.save.hintSeen('swap'));
});

test('play scene: the boss entrance and damage trail follow the boss, and are gone without one', () => {
  const { game, scene, world } = sceneFixture();
  const w = world();
  stepN(game, 3);
  assert.equal(scene.introK, 0);
  w.boss = { maxHp: 100, hp: 100, bs: { state: 'enter', shownHp: 100 } };
  scene.updateHudState(w, 1 / 60);
  scene.updateHudState(w, 1 / 60);
  assert.ok(scene.introK > 0.05, 'bars closing in');
  assert.equal(scene.trail, 100);
  w.boss.bs.state = 'idle';
  w.boss.bs.shownHp = 70; // took 30
  scene.updateHudState(w, 1 / 60);
  assert.equal(scene.trail, 100, 'the trail holds for a moment');
  for (let i = 0; i < 60 * 3; i++) scene.updateHudState(w, 1 / 60);
  assert.equal(scene.trail, 70, 'then drains down to the real health');
  w.boss = null;
  scene.updateHudState(w, 1 / 60);
  assert.equal(scene.trail, 0);
});
