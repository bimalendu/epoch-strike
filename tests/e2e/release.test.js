// Week 16 (release): the shipped site is complete and self-contained, the browser entry point boots and plays against a fake
// DOM, and the repository carries what a release needs (README, credits, licence, CI and Pages workflows). The Pages artifact
// is only index.html, style.css and src/; nothing is installed to play or to run `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoftCanvas, installSoftCanvas } from '../../tools/softcanvas.js';
import { VIEW_W, VIEW_H } from '../../src/game/constants.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

// ---------------------------------------------------------------------------------------------------------------
// The static site
// ---------------------------------------------------------------------------------------------------------------
/** Every module main.js pulls in, found by following its import statements. */
function importClosure(entry) {
  const seen = new Set();
  const bad = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const re = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (!spec.startsWith('.')) {
        bad.push(`${relative(ROOT, file)} imports "${spec}"`);
        continue;
      }
      const target = resolve(dirname(file), spec);
      if (!existsSync(target)) bad.push(`${relative(ROOT, file)} imports missing ${spec}`);
      else queue.push(target);
    }
    // dynamic imports with a literal path
    const dyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = dyn.exec(src))) {
      if (!m[1].startsWith('.')) bad.push(`${relative(ROOT, file)} dynamically imports "${m[1]}"`);
      else queue.push(resolve(dirname(file), m[1]));
    }
  }
  return { files: [...seen], bad };
}

test('the page loads one module and one stylesheet, and both exist', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['src/main.js']);
  assert.deepEqual(styles, ['style.css']);
  assert.ok(existsSync(join(ROOT, 'src/main.js')) && existsSync(join(ROOT, 'style.css')));
  assert.match(html, /<canvas id="game"/);
  for (const id of ['touch', 'stick', 'knob', 'pausebtn']) assert.ok(html.includes(`id="${id}"`), `#${id} is in the page`);
  assert.match(html, /<title>Epoch Strike<\/title>/);
});

test('everything the game imports lives under src/ with relative paths, so the Pages bundle (index.html, style.css, src/) is complete', () => {
  const { files, bad } = importClosure(join(ROOT, 'src/main.js'));
  assert.deepEqual(bad, [], 'no bare specifiers (no npm packages), no dangling imports');
  assert.ok(files.length > 100, `${files.length} modules`);
  for (const f of files) assert.ok(relative(join(ROOT, 'src'), f).startsWith('..') === false, `${relative(ROOT, f)} is inside src/`);
  // the modules the game imports never reach into tools/ or tests/
  for (const f of files) assert.ok(!/\/(tools|tests)\//.test(f), f);
});

test('package.json: nothing is installed to play or ship (the browser-test runner is the only allowed devDependency), a test script, and the dev scripts exist', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.type, 'module');
  // the game and `npm test` need no install; the allowed devDependencies are the browser-test runner (`npm run e2e`) and the
  // mutation tester (`npm run mutate`, run by hand, never in CI)
  const DEV_TOOLS = ['@playwright/test', '@stryker-mutator/core'];
  assert.ok(!pkg.dependencies && !pkg.peerDependencies && !pkg.optionalDependencies, 'no runtime, peer or optional dependencies');
  assert.deepEqual(Object.keys(pkg.devDependencies || {}).filter((name) => !DEV_TOOLS.includes(name)), [], `the only devDependencies allowed are ${DEV_TOOLS.join(' and ')}`);
  assert.equal(pkg.scripts.test, 'node --test');
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    if (name === 'test') continue; // node's own runner
    if (name === 'e2e' || name.startsWith('e2e:')) { // the browser specs, run by Playwright (the one allowed devDependency)
      assert.ok(cmd.startsWith('playwright test'), `script ${name} runs playwright`);
      continue;
    }
    if (name === 'mutate') { // Stryker over the unit tests (stryker.config.json); on demand, not in CI
      assert.equal(cmd, 'stryker run');
      assert.ok(existsSync(join(ROOT, 'stryker.config.json')), 'the config exists');
      continue;
    }
    if (name === 'coverage') { // the same suite with a coverage floor on src/ (the CI `test` job runs it)
      assert.ok(cmd.startsWith('node --test --experimental-test-coverage'), 'coverage runs node --test with coverage');
      assert.match(cmd, /--test-coverage-include="src\/\*\*"/, 'only src/ counts');
      for (const k of ['lines', 'branches', 'functions']) assert.match(cmd, new RegExp(`--test-coverage-${k}=\\d+`), `a ${k} threshold`);
      continue;
    }
    if (name.startsWith('test:')) { // per-layer runs of the same runner
      assert.ok(cmd.startsWith('node --test "tests/') && cmd.endsWith('.test.js"'), `script ${name} runs --test over a tests/ folder`);
      continue;
    }
    const file = cmd.match(/node (\S+)/)?.[1];
    assert.ok(file && existsSync(join(ROOT, file)), `script ${name} runs ${file}`);
  }
  assert.ok(pkg.engines.node);
});

// ---------------------------------------------------------------------------------------------------------------
// Repository contents
// ---------------------------------------------------------------------------------------------------------------
test('the release files exist and say the right things', () => {
  for (const f of ['README.md', 'CREDITS.md', 'LICENSE', 'docs/ARCHITECTURE.md', '.gitignore']) assert.ok(existsSync(join(ROOT, f)), f);
  const readme = read('README.md');
  for (const word of ['npm start', 'npm test', 'Controls', 'Lives', '20 eras', 'Warlord', 'GitHub Actions']) assert.ok(readme.includes(word), `README mentions ${word}`);
  assert.match(read('CREDITS.md'), /no third-party assets/i);
  assert.match(read('LICENSE'), /MIT License/);
});

test('README: every relative link and image points at a file that exists, and the level table matches the game', async () => {
  const readme = read('README.md');
  const targets = [...readme.matchAll(/\]\((?!https?:|#)([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 4);
  for (const t of targets) assert.ok(existsSync(join(ROOT, t)), `README links to ${t}`);
  installSoftCanvas();
  const { LEVEL_DEFS, buildLevel } = await import('../../src/game/levels.js');
  const { ENEMY_DEFS } = await import('../../src/game/enemy_defs.js');
  await import('../../src/game/bosses.js'); // registers the boss defs
  const rows = [...readme.matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
  assert.equal(rows.length, 20, 'twenty rows in the level table');
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  rows.forEach((m, i) => {
    assert.equal(Number(m[1]), i + 1);
    assert.equal(norm(m[2]), norm(LEVEL_DEFS[i].name), `level ${i + 1} name`);
    assert.equal(norm(m[3]), norm(LEVEL_DEFS[i].era), `level ${i + 1} era`);
    if (i < 19) assert.equal(norm(m[4]), norm(ENEMY_DEFS[buildLevel(i).boss.type].name), `level ${i + 1} boss`);
  });
});

test('workflows: CI runs the tests on every push and pull request; Pages tests, then publishes exactly the static files', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /pull_request/);
  assert.match(ci, /npm run coverage/, 'the test job runs the suite through the coverage gate, so it tests once and enforces the floor');
  assert.match(ci, /node-version: 22/);
  const pages = read('.github/workflows/pages.yml');
  assert.match(pages, /npm test/, 'a failing build is never published');
  assert.match(pages, /cp index\.html style\.css _site\//);
  assert.match(pages, /cp -r src _site\/src/);
  assert.match(pages, /actions\/upload-pages-artifact@v3/);
  assert.match(pages, /actions\/deploy-pages@v4/);
  assert.match(pages, /pages: write/);
  assert.match(pages, /id-token: write/);
  assert.ok(pages.indexOf('npm test') < pages.indexOf('upload-pages-artifact'), 'tests run before the upload');
  // the browser job is separate from `test`, installs the locked dependencies and runs the Playwright suite
  assert.match(ci, /^  e2e:/m, 'a separate e2e job');
  assert.match(ci, /npm ci/);
  assert.match(ci, /npx playwright install --with-deps/);
  assert.match(ci, /npm run e2e/);
  // after the deploy, the live site is smoke-tested in a browser
  assert.match(pages, /^  smoke:/m, 'a smoke job after the deploy');
  assert.match(pages, /needs: deploy/);
  assert.match(pages, /--grep @smoke/);
  assert.match(pages, /BASE_URL: \$\{\{ needs\.deploy\.outputs\.page_url \}\}/);
  assert.ok(pages.indexOf('upload-pages-artifact') < pages.indexOf('smoke:'), 'smoke runs after the site is published');
  // both files are valid enough for a quick structural check: no tabs (YAML forbids them) and a `jobs:` section
  for (const y of [ci, pages]) {
    assert.ok(!y.includes('\t'), 'no tabs in YAML');
    assert.match(y, /^jobs:/m);
  }
});

test('the repository holds no stray large files or secrets', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    if (n === '.git' || n === 'node_modules') return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  for (const f of walk(ROOT)) {
    const size = statSync(f).size;
    assert.ok(size < 2_000_000, `${relative(ROOT, f)} is ${size} bytes`);
    if (/\.(js|mjs|json|md|html|css|yml)$/.test(f)) {
      const text = readFileSync(f, 'utf8');
      assert.ok(!/(ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(text), `no secrets in ${relative(ROOT, f)}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Booting src/main.js against a fake DOM, the way a browser does
// ---------------------------------------------------------------------------------------------------------------
class Target {
  constructor() {
    this.l = {};
  }

  addEventListener(t, fn) {
    (this.l[t] ||= []).push(fn);
  }

  fire(t, ev = {}) {
    const e = { preventDefault() {}, code: '', repeat: false, ...ev };
    for (const fn of this.l[t] || []) fn(e);
  }
}

test('main.js boots in a fake browser: title -> menu -> play, pause on blur, F goes fullscreen, M mutes, art warms up', async () => {
  installSoftCanvas();
  const win = new Target();
  Object.assign(win, { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 });
  const doc = new Target();
  const canvas = new SoftCanvas(VIEW_W, VIEW_H);
  const calls = { fullscreen: 0, exit: 0 };
  const css = {};
  const classes = new Set();
  const root = { requestFullscreen: () => { calls.fullscreen++; return Promise.resolve(); }, style: { setProperty: (k, v) => { css[k] = v; } } };
  Object.assign(doc, {
    hidden: false,
    fullscreenElement: null,
    documentElement: root,
    body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } },
    exitFullscreen: () => { calls.exit++; },
    getElementById: (id) => (id === 'game' ? canvas : null),
  });
  let raf = null;
  let now = 0;
  const saved = {};
  const set = (k, v) => {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  };
  set('window', win);
  set('document', doc);
  set('requestAnimationFrame', (fn) => { raf = fn; return 1; });
  try {
    await import('../../src/main.js');
    assert.ok(raf, 'the loop is scheduled');
    now = performance.now(); // rAF timestamps share performance.now()'s timebase
    const frame = (ms = 1000 / 60) => {
      now += ms;
      const fn = raf;
      raf = null;
      fn(now);
      assert.ok(raf, 'and it reschedules itself');
    };
    const game = win.__game;
    assert.ok(game, 'the game is exposed for debugging');
    frame(); // the first step puts the title scene up
    assert.ok(game.scene, 'a scene is up');
    assert.equal(game.scene.constructor.name, 'TitleScene');
    // the canvas is sized to a whole multiple of the device pixels
    // 1280x720 at devicePixelRatio 2: the largest whole device-pixel multiple (5 device px per game px) is 2.5 css px
    assert.equal(canvas.style.width, `${VIEW_W * 2.5}px`);
    assert.equal(canvas.style.height, `${VIEW_H * 2.5}px`);
    // the CRT filter's scanlines follow the pixel grid, and the page class follows the option
    assert.equal(css['--crt-px'], '2.5px');
    assert.equal(css['--crt-top'], `${(720 - VIEW_H * 2.5) / 2}px`);
    assert.equal(classes.has('crt'), false, 'off by default');
    game.save.setOption('crt', 'scanlines');
    game.applyDisplay();
    assert.equal(classes.has('crt'), true, 'on after the option is changed');
    game.save.setOption('crt', 'off');
    game.applyDisplay();
    assert.equal(classes.has('crt'), false);

    // the art warm-up runs a few ms per frame while the title is up, and finishes
    assert.ok(win.__warmer && win.__warmer.total > 100);
    const before = win.__warmer.remaining;
    for (let i = 0; i < 400 && !win.__warmer.done; i++) frame();
    assert.ok(win.__warmer.remaining < before, 'progress was made');
    assert.equal(win.__warmer.done, true, 'and it finished');

    // keys: confirm on the title -> main menu -> START
    const press = (code, frames = 3) => {
      win.fire('keydown', { code });
      for (let i = 0; i < frames; i++) frame();
      win.fire('keyup', { code });
      frame();
      frame();
    };
    for (let i = 0; i < 30; i++) frame();
    press('Enter');
    assert.equal(game.scene.constructor.name, 'MenuScene');
    press('Enter'); // START (the first item)
    assert.equal(game.scene.constructor.name, 'PlayScene');

    // play: hold right and fire for a few seconds, jump now and then
    win.fire('keydown', { code: 'ArrowRight' });
    win.fire('keydown', { code: 'KeyX' });
    const x0 = game.scene.world.player.x;
    for (let i = 0; i < 240; i++) {
      if (i % 60 === 30) win.fire('keydown', { code: 'KeyZ' });
      if (i % 60 === 40) win.fire('keyup', { code: 'KeyZ' });
      frame();
    }
    assert.ok(game.scene.world.player.x > x0 + 30, 'the soldier ran to the right');
    assert.ok(game.scene.world.bullets.length + game.scene.world.fx.length > 0, 'and shot');

    // leaving the window pauses and releases the keys
    assert.equal(game.scene.paused, false);
    win.fire('blur');
    frame();
    assert.equal(game.scene.paused, true, 'paused when the window lost focus');
    const t = game.scene.world.time;
    for (let i = 0; i < 30; i++) frame();
    assert.equal(game.scene.world.time, t, 'time stands still');

    // hotkeys
    win.fire('keydown', { code: 'KeyF' });
    assert.equal(calls.fullscreen, 1);
    doc.fullscreenElement = root;
    win.fire('keydown', { code: 'KeyF' });
    assert.equal(calls.exit, 1);
    assert.equal(game.muted, false);
    win.fire('keydown', { code: 'KeyM' });
    assert.equal(game.muted, true);
    win.fire('keydown', { code: 'KeyM' });
    assert.equal(game.muted, false);

    // a long stretch of frames after a stall: the loop clamps the catch-up instead of freezing
    frame(5000);
    assert.ok(Number.isFinite(game.scene.world.time));
    // resizing re-fits the canvas
    win.innerWidth = 480;
    win.innerHeight = 270;
    win.fire('resize');
    assert.ok(parseFloat(canvas.style.width) <= 480 + 1e-9);
  } finally {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
});
