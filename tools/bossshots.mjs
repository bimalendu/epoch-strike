// Photograph a boss fight at its key moments: `node tools/bossshots.mjs <levelIndex> [outDir] [scale]`.
// A god-mode bot fights the boss; a frame is saved the first time each (state, attack, phase) combination shows.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installSoftCanvas, SoftCanvas } from './softcanvas.js';
import { encodePNG } from './png.js';
import { fightBoss } from './bossbot.js';
import { buildLevel } from '../src/game/levels.js';
import { renderWorld } from '../src/game/render.js';
import { drawHud } from '../src/game/art/hud.js';
import { Run } from '../src/game/run.js';
import { VIEW_W, VIEW_H } from '../src/game/constants.js';

installSoftCanvas();

export function shootBoss(index, outDir, { scale = 2, max = 14, style = 'ground' } = {}) {
  mkdirSync(outDir, { recursive: true });
  const level = buildLevel(index);
  const canvas = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = canvas.getContext('2d');
  const run = new Run();
  const seen = new Set();
  const files = [];
  const prefix = `boss${String(index + 1).padStart(2, '0')}`;
  const snap = (world, name) => {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    renderWorld(ctx, world);
    drawHud(ctx, world, run, {});
    const file = resolve(outDir, `${prefix}_${name}.png`);
    writeFileSync(file, encodePNG(canvas, scale));
    files.push(file);
  };
  fightBoss(level, {
    style,
    onFrame(world, frame) {
      const b = world.boss;
      if (!b || !b.bs || files.length >= max) return;
      const bs = b.bs;
      // wait a few frames into a state so the pose is visible
      const key = `${bs.state}-${bs.atk || ''}-${bs.phase}`;
      const ready = bs.state === 'enter' ? bs.age > 0.9 : bs.state === 'tele' ? bs.t < bs.teleMax * 0.35 : bs.state === 'attack' ? bs.elapsed > 0.35 : bs.state === 'phase' ? bs.t < 1 : bs.state === 'dying' ? bs.t < 2 : bs.state === 'idle' ? bs.cd < 0.5 : false;
      if (!ready || seen.has(key)) return;
      if (bs.state === 'idle' && seen.has(`idle-${bs.phase}`)) return;
      seen.add(key);
      if (bs.state === 'idle') seen.add(`idle-${bs.phase}`);
      snap(world, `${String(files.length + 1).padStart(2, '0')}_${bs.state}${bs.atk ? '_' + bs.atk : ''}_p${bs.phase}`);
    },
  });
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = shootBoss(Number(process.argv[2] ?? 0), resolve(process.argv[3] || 'docs/bosses'), { scale: Number(process.argv[4] || 2), style: process.argv[5] || 'ground' });
  for (const f of files) console.log('wrote', f);
}
