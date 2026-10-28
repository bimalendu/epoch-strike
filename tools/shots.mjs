// Render deterministic screenshots with the software canvas: `npm run shots [outDir]`.
// Used for docs/screenshots and for eyeballing art without a browser.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installSoftCanvas, SoftCanvas } from './softcanvas.js';
import { encodePNG } from './png.js';
import { Input } from '../src/engine/input.js';
import { Game } from '../src/game/game.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';

installSoftCanvas();

export function makeGame() {
  const canvas = new SoftCanvas(VIEW_W, VIEW_H);
  const input = new Input();
  input.script = {};
  const game = new Game({ canvas, input });
  return { game, canvas, input };
}

export function snapshot(game, canvas, file, scale = 2) {
  canvas.getContext('2d').clearRect(0, 0, VIEW_W, VIEW_H);
  game.render();
  writeFileSync(file, encodePNG(canvas, scale));
}

export function stepN(game, n, keys = []) {
  const s = {};
  for (const k of keys) s[k] = true;
  game.input.script = s;
  for (let i = 0; i < n; i++) game.step();
}

// ---- when run directly ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = resolve(process.argv[2] || 'docs/screenshots');
  mkdirSync(out, { recursive: true });
  const { registerRoutes } = await import('../src/scenes/routes.js');
  const { Run } = await import('../src/game/run.js');
  const { TILE } = await import('../src/game/constants.js');
  const { game, canvas } = makeGame();
  registerRoutes(game);
  const shot = (name) => {
    snapshot(game, canvas, resolve(out, `${name}.png`));
    console.log('wrote', `${name}.png`);
  };
  const tap = (key) => { stepN(game, 1, [key]); stepN(game, 1); };

  game.go('title');
  stepN(game, 90);
  shot('title');

  game.go('menu');
  stepN(game, 30);
  shot('menu');

  // gameplay: god mode so the screenshot shows the soldier mid-run with the HUD
  const run = new Run();
  run.score.add(12340);
  game.go('play', { run, levelIndex: -1, god: true });
  stepN(game, 2);
  const w = game.scene.world;
  w.player.giveWeapon('spread');
  w.player.rapid = true;
  w.player.barrier = 6;
  stepN(game, 150);
  shot('play-title-card');
  stepN(game, 100, ['right', 'fire']);
  shot('play');

  tap('pause');
  stepN(game, 2);
  shot('pause');

  game.go('results', { run, levelIndex: -1, world: w });
  stepN(game, 240);
  shot('results');

  game.go('options', { back: 'menu' });
  stepN(game, 5);
  shot('options');

  game.go('controls');
  stepN(game, 5);
  shot('controls');

  game.save.addScore('ABC', 123400, 4);
  game.save.addScore('XYZ', 45600, 2);
  game.go('scores', { highlight: 1 });
  stepN(game, 30);
  shot('scores');

  run.score.add(60000);
  game.go('nameentry', { run });
  stepN(game, 30);
  shot('nameentry');

  game.go('gameover', { run, levelIndex: -1, world: w });
  stepN(game, 20);
  shot('continue');
}
