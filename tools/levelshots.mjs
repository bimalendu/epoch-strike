// Play a level with the bot and save screenshots at chosen x positions:
//   node tools/levelshots.mjs <levelIndex> [outDir] [x1 x2 ...]    (x in tiles)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installSoftCanvas, SoftCanvas } from './softcanvas.js';
import { encodePNG } from './png.js';
import { playBot } from './bot.js';
import { buildLevel, levelCount } from '../src/game/levels.js';
import { renderWorld } from '../src/game/render.js';
import { drawHud } from '../src/game/art/hud.js';
import { Run } from '../src/game/run.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';

installSoftCanvas();

export function shootLevel(index, outDir, xs, { prefix = `level${String(index + 1).padStart(2, '0')}`, scale = 2 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const level = buildLevel(index);
  const canvas = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = canvas.getContext('2d');
  const run = new Run();
  const todo = xs.map((t) => t * 16).sort((a, b) => a - b);
  const files = [];
  playBot(level, {
    onFrame(world) {
      if (todo.length && world.player.x >= todo[0]) {
        const tx = Math.round(todo.shift() / 16);
        ctx.clearRect(0, 0, VIEW_W, VIEW_H);
        renderWorld(ctx, world);
        drawHud(ctx, world, run, { prompt: (world.promptAt() || '').replace(/\{(\w+)\}/g, (_, a) => a.toUpperCase()) || null });
        const file = resolve(outDir, `${prefix}_x${String(tx).padStart(3, '0')}.png`);
        writeFileSync(file, encodePNG(canvas, scale));
        files.push(file);
      }
    },
  });
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = Number(process.argv[2] ?? 0);
  if (index >= levelCount()) throw new Error(`no level ${index}`);
  const out = resolve(process.argv[3] || 'docs/levels');
  const xs = process.argv.slice(4).map(Number);
  const files = shootLevel(index, out, xs.length ? xs : [10, 60, 120, 190, 215, 245, 290]);
  for (const f of files) console.log('wrote', f);
}
