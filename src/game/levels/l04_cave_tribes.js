// Level 4 - Stone Age: Cave Tribes. The first dark level: the caves are black except where light reaches, and every
// shot you fire lights them for an instant (the Fire Spear's flight lights them for longer). The Rift has possessed
// the tribes, so their eyes glow. Torches mark checkpoints and trouble. A hidden 1UP sits up a skylight chimney, and
// the Cave Bear Hive waits in a torch-lit cavern with two ledges to shoot its high hive from.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

const CEIL_ROWS = 3; // rows of rock overhead (the last one is ragged)

export const caveTribes = {
  name: 'CAVE TRIBES',
  era: 'STONE AGE',
  theme: 'cave',
  seed: 104,
  music: 'cave',
  bulletScale: 0.95,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 3 });
    const chimneys = []; // [x0, x1) columns left open to the sky

    // --- 1. Cave mouth: learn that shooting lights the way ---
    let s = b.flat(34);
    s.torch(5, 10, 64).torch(22, 10, 64);
    s.prompt('IT IS DARK. SHOOTING LIGHTS THE WAY', 3, 16);
    s.capsule('E', 8, 6);
    s.enemy('caveman', 18).enemy('caveman', 24);
    s.medals(12, 11, 3, 2);
    b.pit(3);

    // --- 2. Bone pit: a spear thrower over the spikes ---
    s = b.flat(24);
    s.torch(3, 10, 56).torch(16, 10, 56);
    s.enemy('spearman', 12).enemy('caveman', 8);
    s.enemy('bat', 18, { row: 7 });
    const pit = b.pit(4, { fill: 'spikes' });
    b.addTorch(pit.x0 + 2, 10, 50);
    b.platform(pit.x0 - 1, 10, 6);
    s = b.flat(16);
    s.checkpoint(1);
    s.torch(2, 10, 70);
    s.enemy('spearman', 8).enemy('caveman', 11);
    s.medals(-4, 8, 4, 1, 2);

    // --- 3. Underground stream: bats over the water ---
    s = b.flat(8);
    s.torch(3, 10, 56);
    b.pit(5, { fill: 'water' });
    s = b.flat(12);
    s.enemy('bat', 3, { row: 7 }).enemy('bat', 6, { row: 8 }).enemy('bat', 9, { row: 6 });
    s.enemy('spearman', 8);
    s.capsule('M', 4, 6);
    b.pit(5, { fill: 'water' });

    // --- 4. Mammoth-bone hall: ledges with throwers, cavemen below ---
    s = b.flat(46);
    s.checkpoint(2);
    s.torch(2, 10, 70).torch(20, 10, 64).torch(40, 10, 64);
    b.platform(s.x0 + 8, 10, 7);
    b.platform(s.x0 + 22, 10, 8);
    b.platform(s.x0 + 24, 7, 4);
    s.enemy('spearman', 10, { row: 10 });
    s.enemy('spearman', 25, { row: 7 });
    s.enemy('caveman', 15).enemy('caveman', 18).enemy('caveman', 30).enemy('caveman', 33);
    s.enemy('bat', 28, { row: 8 }).enemy('bat', 36, { row: 7 });
    s.capsule('S', 14, 6);
    s.pickup('bomb', 26, 6);
    s.medals(10, 9, 3, 2);
    b.pit(3);

    // --- 5. Hidden skylight: a chimney of ledges up to a 1UP (the bright shaft gives it away) ---
    s = b.flat(30);
    s.torch(4, 10, 56);
    s.enemy('caveman', 12).enemy('caveman', 16);
    s.enemy('spearman', 22);
    const cx = s.x0 + 22;
    chimneys.push([cx - 2, cx + 10]);
    b.platform(cx, 11, 4);
    b.platform(cx + 4, 8, 4);
    b.platform(cx + 1, 6, 4);
    b.addPickup('1up', cx + 2, 5);
    b.addTorch(cx + 6, 6, 64); // a shaft of light falls from above
    b.pit(4, { fill: 'lava' });
    b.pit(4, { fill: 'lava' });
    b.platform(b.x - 5, 11, 2);

    // --- 6. Lava seam: a glowing crossing, then the tribe's last stand ---
    s = b.flat(30);
    s.checkpoint(1);
    s.torch(3, 10, 60).torch(22, 10, 64);
    s.enemy('caveman', 8).enemy('caveman', 11).enemy('spearman', 16);
    s.enemy('bat', 14, { row: 7 }).enemy('bat', 20, { row: 8 }).enemy('bat', 24, { row: 6 });
    s.capsule('B', 6, 6);
    s.enemy('pod', 26, { item: 'E' });

    // --- 7. Approach and arena: the Cave Bear Hive ---
    s = b.flat(18);
    s.torch(2, 10, 70).torch(14, 10, 70);
    s.prompt('SOMETHING HUGE IS BREATHING...', 2, 14);
    s.prompt('LOW GROUND. USE THE LEDGES', 8, 10);
    s.capsule('H', 9, 6);
    const arena = b.bossArena('bear');
    b.platform(arena.x0 + 6, 11, 5);
    b.platform(arena.x1 - 11, 11, 5);
    for (const dx of [2, 15, 28]) b.addTorch(arena.x0 + dx, 9, 120);

    // cave ceiling: rock overhead everywhere except the skylight chimney and the open boss cavern
    for (let x = 0; x < arena.x0; x++) {
      if (chimneys.some(([a, z]) => x >= a && x < z)) continue;
      for (let y = 0; y < CEIL_ROWS - 1; y++) b.set(x, y, T.WALL);
      if ((x * 7 + (x >> 2)) % 5 < 2) b.set(x, CEIL_ROWS - 1, T.WALL);
    }
    return b.finish();
  },
};
