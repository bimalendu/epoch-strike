// Level 5 - Ancient Egypt: Pyramid of Ra. Quicksand that drowns whoever stands still, tomb halls where stone crushers
// slam down on a rhythm (watch the floor markers), mummies and scarab swarms, and a hidden 1UP up a sarcophagus
// stair. The Animated Sphinx guards the end: shoot up at its gem from the two sandstone ledges.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

const CEIL_ROWS = 3;

/** A stone crusher hung over column `col`; it falls from row 10 to the floor, `phase` seconds out of step. */
function crusher(b, col, phase = 0) {
  b.addEnemy('crusher', col, { row: 10, drop: (b.gy - 10) * 16, phase });
}

export const pyramid = {
  name: 'PYRAMID OF RA',
  era: 'ANCIENT EGYPT',
  theme: 'pyramid',
  seed: 105,
  music: 'pyramid',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 4 });
    const tombs = []; // [x0, x1) columns with a stone ceiling

    // --- 1. Desert road: a first taste of sand ---
    let s = b.flat(30);
    s.capsule('E', 6, 6);
    s.enemy('scarab', 14).enemy('scarab', 16);
    s.enemy('mummy', 22);
    s.prompt('QUICKSAND. KEEP MOVING OR YOU SINK', 24, 8);
    s.medals(10, 11, 3, 2);
    b.quicksand(4);
    s = b.flat(16);
    s.checkpoint(1);
    s.enemy('mummy', 6).enemy('mummy', 10);
    s.enemy('scarab', 13);

    // --- 2. The dune ridge: sand below, a safe stone road above ---
    s = b.flat(14);
    s.enemy('drone', 8, { row: 7 });
    s.enemy('mummy', 10);
    const sand = b.quicksand(7);
    b.platform(sand.x0 - 1, 10, 4);
    b.platform(sand.x0 + 4, 10, 5);
    s = b.flat(22);
    s.enemy('mummy', 4).enemy('mummy', 8);
    s.enemy('drone', 12, { row: 6 }).enemy('drone', 16, { row: 8 });
    s.capsule('M', 3, 6);
    s.medals(-8, 8, 4, 2, 2);

    // --- 3. The tomb door: the first crusher, with a lesson ---
    s = b.flat(8);
    s.checkpoint(2);
    s.prompt('WATCH THE FLOOR MARKS. RUN WHEN IT RISES', 0, 12);
    s = b.flat(34);
    tombs.push([s.x0, s.x1]);
    crusher(b, s.x0 + 10, 0);
    crusher(b, s.x0 + 24, 0.6);
    s.enemy('mummy', 4).enemy('mummy', 17);
    s.enemy('scarab', 28);

    // --- 4. Hall of crushers ---
    s = b.flat(52);
    tombs.push([s.x0, s.x1]);
    s.checkpoint(1);
    for (let i = 0; i < 4; i++) crusher(b, s.x0 + 8 + i * 9, i * 0.45);
    s.enemy('mummy', 5).enemy('mummy', 22).enemy('mummy', 31);
    s.enemy('scarab', 15).enemy('scarab', 18).enemy('scarab', 40);
    s.capsule('S', 14, 6);
    s.pickup('bomb', 44, 11);
    s.enemy('trooper', 46);

    // --- 5. Sarcophagus stair: a hidden 1UP up the middle of the tomb ---
    s = b.flat(30);
    s.enemy('mummy', 8).enemy('mummy', 12);
    s.enemy('drone', 18, { row: 6 });
    const cx = s.x0 + 18;
    b.platform(cx, 11, 4);
    b.platform(cx + 4, 8, 4);
    b.platform(cx + 1, 5, 4);
    b.addPickup('1up', cx + 2, 4);
    s.medals(2, 11, 3, 2);

    // --- 6. Treasury sands: the widest quicksand, and stone ledges to avoid it ---
    s = b.flat(8);
    s.checkpoint(1);
    s.enemy('mummy', 4);
    const wide = b.quicksand(8);
    b.platform(wide.x0 + 1, 10, 3);
    b.platform(wide.x0 + 4, 9, 3);
    s = b.flat(16);
    s.enemy('mummy', 4).enemy('scarab', 7).enemy('scarab', 9);
    s.enemy('drone', 11, { row: 7 });
    s.capsule('B', 3, 6);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(20);
    s.enemy('mummy', 5).enemy('mummy', 9).enemy('trooper', 13);
    s.enemy('pod', 16, { item: 'E' });
    s.medals(2, 10, 3, 2);

    // --- 7. Approach and arena: the Animated Sphinx ---
    s = b.flat(18);
    s.checkpoint(1);
    s.prompt('THE GUARDIAN WAKES. SHOOT UP AT ITS GEM', 2, 14);
    s.capsule('H', 8, 6);
    const arena = b.bossArena('sphinx');
    b.platform(arena.x0 + 6, 11, 5);
    b.platform(arena.x1 - 11, 11, 5);

    // tomb ceilings
    for (const [a, z] of tombs) {
      for (let x = a; x < z; x++) {
        for (let y = 0; y < CEIL_ROWS - 1; y++) b.set(x, y, T.WALL);
        if ((x * 5 + (x >> 2)) % 4 < 2) b.set(x, CEIL_ROWS - 1, T.WALL);
      }
    }
    return b.finish();
  },
};
