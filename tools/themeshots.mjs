// Render a showcase frame for every theme: `node tools/themeshots.mjs [outDir] [theme...]`
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePNG } from './png.js';
import { resolve } from 'node:path';
import { makeGame, snapshot, stepN } from './shots.mjs';
import { Run } from '../src/game/run.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { THEMES } from '../src/game/art/themes.js';
import { World } from '../src/game/world.js';
import { renderWorld } from '../src/game/render.js';
import { T } from '../src/game/tiles.js';

const out = resolve(process.argv[2] || 'docs/themes');
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });

function showcase(theme) {
  const b = new LevelBuilder({ id: 1, theme, name: theme.toUpperCase(), seed: 7 });
  b.flat(14);
  b.up(2);
  const p = b.flat(8);
  b.down(2);
  b.flat(4);
  b.platform(p.x0 + 1, 9, 5);
  b.platform(p.x0 + 6, 6, 4);
  const pit = b.pit(3, { fill: 'spikes' });
  b.flat(8);
  b.spikes(new (b.flat(6).constructor)(b, b.x - 6, b.x), 2, 2);
  b.block(b.x - 3, 2, 2);
  const pool = b.pit(4);
  for (let x = pool.x0; x < pool.x1; x++) { b.set(x, 15, T.WATER); b.set(x, 16, T.WATER); b.set(x, 14, T.WATER); }
  b.flat(20);
  b.exit();
  void pit;
  return b.finish();
}

const { game, canvas } = makeGame();
for (const name of Object.keys(THEMES)) {
  if (only.length && !only.includes(name)) continue;
  const level = showcase(name);
  const world = new World(level, {});
  world.camera.x = 28;
  world.player.x = 190;
  world.player.y = 13 * 16;
  world.time = 2;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 480, 270);
  renderWorld(ctx, world);
  game.scene = { draw() {} };
  const file = resolve(out, `${name}.png`);
  writeFileSync(file, encodePNG(canvas, 2));
  console.log('wrote', name);
}
void Run; void stepN;
