// `npm run perf [levelIndex [seconds]]` - simulation time and canvas-call counts per level on a scripted run, plus the boss fights.
// `seconds` shortens both runs (default 30 s of play and a 90 s boss fight); the smoke test uses it.
import { installSoftCanvas, SoftCanvas } from './softcanvas.js';
import { probeFrame } from './perfprobe.js';
installSoftCanvas();
const { buildLevel, LEVEL_DEFS } = await import('../src/game/levels.js');
const { World } = await import('../src/game/world.js');
const { Input } = await import('../src/engine/input.js');
const { fightBoss } = await import('./bossbot.js');

export function profileLevel(index, { frames = 60 * 30, warm = 120, every = 6 } = {}) {
  const lvl = buildLevel(index);
  const w = new World(lvl, { god: true });
  const input = new Input();
  const canvas = new SoftCanvas(480, 270);
  let simSum = 0, simMax = 0, peak = 0, sum = 0, n = 0, canvases = 0;
  for (let f = 0; f < frames; f++) {
    input.script = { right: true, fire: true, jump: f % 70 < 10 };
    input.poll();
    const t0 = performance.now();
    w.update(input, 1 / 60);
    const dt = performance.now() - t0;
    w.events.length = 0;
    if (f >= warm) { simSum += dt; simMax = Math.max(simMax, dt); }
    if (f % every === 0) {
      const r = probeFrame(w, null, canvas);
      if (f >= warm) { peak = Math.max(peak, r.total); sum += r.total; n++; canvases += r.canvasesCreated; }
    }
  }
  return { simAvg: simSum / (frames - warm), simMax, drawPeak: peak, drawAvg: sum / n, canvases };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2] !== undefined ? [Number(process.argv[2])] : LEVEL_DEFS.map((_, i) => i);
  const short = process.argv[3] !== undefined ? Number(process.argv[3]) : null;
  for (const i of which) {
    const r = profileLevel(i, short ? { frames: Math.round(short * 60) } : {});
    console.log(String(i).padStart(2), LEVEL_DEFS[i].name.padEnd(22), `sim avg ${r.simAvg.toFixed(3)} ms (max ${r.simMax.toFixed(2)})`, `| canvas calls avg ${r.drawAvg.toFixed(0)} peak ${r.drawPeak}`, `| canvases created ${r.canvases}`);
  }
  console.log('-- boss fights (peak canvas calls in a frame, canvases created after warm-up)');
  for (const i of which) {
    const lvl = buildLevel(i);
    if (!lvl.boss) continue;
    const canvas = new SoftCanvas(480, 270);
    let peak = 0, created = 0, frames = 0;
    const r = fightBoss(lvl, {
      seconds: short || 90,
      onFrame: (w, f) => {
        frames = f;
        if (f % 5 !== 0) return;
        const p = probeFrame(w, null, canvas);
        if (f > 300) { peak = Math.max(peak, p.total); created += p.canvasesCreated; }
      },
    });
    console.log(String(i).padStart(2), LEVEL_DEFS[i].name.padEnd(22), `peak ${peak}`, `canvases ${created}`, r.killed ? `killed ${r.time.toFixed(0)}s` : 'not killed');
  }
}
