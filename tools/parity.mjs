// Browser/software-canvas parity frames. CLAUDE.md promises that the game renders identically in a browser and in
// tools/softcanvas.js; this file renders a fixed set of frames headlessly so tests/e2e/browser/parity.spec.js can
// compare them with the same frames rendered by a real browser.
//
//   npm run parity            write tests/e2e/browser/fixtures/parity.json (the software-canvas frames)
//
// `parityScenario` is the single description of the frames. It is self-contained (it only touches what it is handed), so
// the spec can ship its source into the page and run the very same code there with the browser's canvas.
import { writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { installSoftCanvas, SoftCanvas } from './softcanvas.js';
import { Input } from '../src/engine/input.js';
import { Game } from '../src/game/game.js';
import { registerRoutes } from '../src/scenes/routes.js';
import { Run } from '../src/game/run.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';

export const FIXTURE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/e2e/browser/fixtures/parity.json');

/** Level indexes shown, one per era group (groups of four levels), all at the same frame. */
export const ERA_LEVELS = [0, 4, 8, 12, 16];

/**
 * Render every parity frame. No outer references, so `String(parityScenario)` can be evaluated inside a page.
 * @param {{Game: Function, Input: Function, registerRoutes: Function, Run: Function}} mods the game classes (from Node or from the page)
 * @param {() => {width: number, height: number}} makeCanvas a fresh 480x270 canvas
 * @param {(canvas: object) => Uint8ClampedArray} readPixels the canvas's RGBA bytes
 * @returns {Promise<Record<string, Uint8ClampedArray>>} frame name -> RGBA bytes
 */
export async function parityScenario(mods, makeCanvas, readPixels) {
  const out = {};
  const boot = () => {
    const canvas = makeCanvas();
    const input = new mods.Input();
    input.script = {};
    const game = new mods.Game({ canvas, input });
    mods.registerRoutes(game);
    game.save.setOption('shake', false); // the camera shake draws on Math.random, which no two renders share
    return { game, canvas };
  };
  const step = (game, n, keys = []) => {
    const held = {};
    for (const k of keys) held[k] = true;
    game.input.script = held;
    for (let i = 0; i < n; i++) game.step();
  };
  const grab = (name, game, canvas) => {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    game.render();
    out[name] = Uint8ClampedArray.from(readPixels(canvas));
  };

  // the title screen, 1.5 s in
  {
    const { game, canvas } = boot();
    game.go('title');
    step(game, 90);
    grab('title', game, canvas);
  }
  // Level 1, 120 frames after the level starts (the name card is still up)
  const play = (levelIndex) => {
    const b = boot();
    b.game.go('play', { run: new mods.Run(), levelIndex, god: true });
    return b;
  };
  {
    const { game, canvas } = play(0);
    step(game, 120);
    grab('level01_f120', game, canvas);
  }
  // one frame per later era group: run right while firing for five seconds
  for (const levelIndex of [4, 8, 12, 16]) {
    const { game, canvas } = play(levelIndex);
    step(game, 300, ['right', 'fire']);
    grab(`level${String(levelIndex + 1).padStart(2, '0')}_f300`, game, canvas);
  }
  // a boss entrance: put the player just short of the arena's trigger line, walk in and wait for the name plate to be up
  {
    const { game, canvas } = play(0);
    step(game, 140); // past the level's name card
    const w = game.scene.world;
    const arena = game.scene.level.boss;
    w.player.x = arena.trigger - 4;
    w.player.y = arena.floorY;
    w.camera.snap(w.player);
    let entered = false;
    for (let i = 0; i < 900 && !entered; i++) {
      step(game, 1, ['right']);
      const bs = w.boss && w.boss.bs;
      entered = !!bs && bs.state === 'enter' && bs.age > 0.9;
    }
    if (!entered) throw new Error('parity: the boss never made its entrance');
    grab('boss01_enter', game, canvas);
  }
  return out;
}

/** Render every parity frame with the software canvas. */
export async function renderSoftFrames() {
  installSoftCanvas();
  return parityScenario(
    { Game, Input, registerRoutes, Run },
    () => new SoftCanvas(VIEW_W, VIEW_H),
    (canvas) => canvas.data,
  );
}

/** Pack frames into the JSON fixture shape (zlib-deflated RGBA, base64). */
export function packFrames(frames) {
  const packed = {};
  for (const [name, data] of Object.entries(frames)) packed[name] = deflateSync(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { level: 9 }).toString('base64');
  return { version: 1, width: VIEW_W, height: VIEW_H, frames: packed };
}

/** The inverse of packFrames: frame name -> RGBA bytes. */
export function unpackFrames(fixture) {
  const frames = {};
  for (const [name, b64] of Object.entries(fixture.frames)) frames[name] = new Uint8ClampedArray(inflateSync(Buffer.from(b64, 'base64')));
  return frames;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const frames = await renderSoftFrames();
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  const json = JSON.stringify(packFrames(frames));
  writeFileSync(FIXTURE_PATH, json);
  console.log(`wrote ${FIXTURE_PATH} (${Object.keys(frames).length} frames, ${(json.length / 1024).toFixed(0)} KB)`);
}
