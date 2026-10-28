// Level 2 - Cretaceous: Volcano Run. Lava pits, fire lizards and diving pterosaurs, then the Eruption Climb:
// the camera is forced forward while lava floods the valley floor, so the high road of platforms is the only safe way.

import { LevelBuilder } from '../levelgen.js';

/** Ten tiles of lava with a two-tile rock island in the middle (each leap is four tiles). */
function lavaIsland(b) {
  b.pit(5, { fill: 'lava' });
  b.pit(5, { fill: 'lava' });
  b.platform(b.x - 6, 11, 2);
}

export const volcanoRun = {
  name: 'VOLCANO RUN',
  era: 'CRETACEOUS',
  theme: 'volcano',
  seed: 102,
  music: 'volcano',
  bulletScale: 0.9,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 1 });

    // --- 1. Ash plain ---
    let s = b.flat(28);
    s.enemy('firelizard', 12).enemy('firelizard', 19);
    s.enemy('ptero', 22, { row: 6 });
    s.capsule('M', 4, 6);
    s.medals(8, 11, 3, 2);
    b.pit(3, { fill: 'lava' });

    // --- 2. Broken ground over lava ---
    s = b.flat(16);
    s.enemy('raptor', 6).enemy('raptor', 9);
    s.enemy('drone', 12, { row: 8 });
    lavaIsland(b);
    s = b.flat(20);
    s.checkpoint(1);
    s.enemy('firelizard', 9).enemy('firelizard', 15);
    s.enemy('ptero', 12, { row: 5 });
    s.capsule('S', 3, 7);
    s.capsule('E', 12, 6);

    // --- 3. Eruption Climb ---
    s = b.flat(8);
    s.prompt('RUN! THE LAVA IS RISING', 0, 14);
    const zx0 = b.x;
    const valley = b.flat(84);
    const zx1 = b.x;
    for (let k = 0; k < 12; k++) b.platform(zx0 + 2 + k * 7, 10, 5);
    for (let k = 0; k < 5; k++) b.platform(zx0 + 8 + k * 14, 7, 4);
    valley.enemy('firelizard', 20).enemy('firelizard', 44).enemy('firelizard', 66);
    b.addEnemy('ptero', zx0 + 14, { row: 6 });
    b.addEnemy('ptero', zx0 + 36, { row: 5 });
    b.addEnemy('ptero', zx0 + 58, { row: 6 });
    b.addEnemy('drone', zx0 + 26, { row: 8 });
    b.addEnemy('drone', zx0 + 48, { row: 8 });
    b.addEnemy('drone', zx0 + 70, { row: 7 });
    b.addEnemy('striker', zx0 + 40, { row: 6 });
    b.addEnemy('striker', zx0 + 64, { row: 5 });
    b.addCapsule('R', zx0 + 10, 5);
    b.addCapsule('random', zx0 + 52, 5);
    for (let k = 0; k < 5; k++) b.addPickup('medal', zx0 + 10 + k * 14, 6);
    b.lavaRise(zx0, zx1, { endRow: 11, interval: 3 });
    b.autoscroll(zx0, zx1, 42);

    // --- 4. Cooled ground: a bunker and the last lava gap ---
    s = b.flat(24);
    s.checkpoint(1);
    s.enemy('pod', 12, { item: 'F' });
    s.enemy('trooper', 18);
    s.enemy('firelizard', 6).enemy('firelizard', 9);
    b.pit(4, { fill: 'lava' });
    s = b.flat(14);
    s.capsule('B', 3, 6);
    s.enemy('ptero', 8, { row: 6 });
    s.enemy('raptor', 10);
    lavaIsland(b);

    // --- 5. Approach and arena: the Magma Golem ---
    s = b.flat(22);
    s.prompt('THE GROUND SHAKES...', 4, 14);
    s.pickup('bomb', 8, 11);
    s.capsule('S', 12, 7);
    b.bossArena('golem');
    return b.finish();
  },
};
