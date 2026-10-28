// Level 2 - Cretaceous: Volcano Run. Lava pits, fire lizards and diving pterosaurs, then the Eruption Climb:
// the camera is forced forward while lava floods the cone, so the crags above it are the only safe way.
//
// The ground is a volcano's: ash dunes at 22 degrees, a 45-degree climb up the cone's flank, and on the cone a ridge of crags joined by
// ramps and scree (steep slopes the soldier slides down, so the climb never lets them stand still), all above the rising lava.

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

    // --- 1. Ash plain with a dune ---
    let s = b.flat(8);
    s.capsule('M', 4, 6);
    b.slope(1, { angle: 22 });
    s = b.flat(6);
    s.enemy('firelizard', 2);
    s.medalsAbove(0, 3, 2, 2);
    b.slope(-1, { angle: 22 });
    s = b.flat(8);
    s.enemy('firelizard', 4);
    s.enemy('ptero', 6, { row: 6 });
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

    // --- 3. Eruption Climb: up the cone's flank, then along a ridge of crags, ramps and scree above the rising lava ---
    s = b.flat(8);
    s.prompt('RUN! THE LAVA IS RISING', 0, 14);
    b.slope(3, { angle: 45 }); // the flank: the ground is now row 10, clear of the lava's last row (11)
    const zx0 = b.x;
    const crags = []; // the level stretches the lizards stand on
    // a crag: level rock, a 45-degree ramp up, a ledge, then a steep slide back down
    crags.push(b.flat(5));
    b.slope(2, { angle: 45 });
    crags.push(b.flat(5));
    b.slope(-2, { angle: 67 });
    crags.push(b.flat(4));
    b.pit(3, { fill: 'lava' });
    // a long rise at 22 degrees and the same way down
    crags.push(b.flat(4));
    b.slope(2, { angle: 22 });
    crags.push(b.flat(4));
    b.slope(-2, { angle: 22 });
    crags.push(b.flat(3));
    b.pit(4, { fill: 'lava' });
    // the high crest of the cone: a three-tile ramp, a short ledge and a ramp down
    crags.push(b.flat(5));
    b.slope(3, { angle: 45 });
    crags.push(b.flat(4));
    b.slope(-3, { angle: 45 });
    crags.push(b.flat(3));
    b.pit(3, { fill: 'lava' });
    crags.push(b.flat(8));
    b.slope(2, { angle: 45 });
    crags.push(b.flat(6));
    b.slope(-2, { angle: 67 });
    crags.push(b.flat(6));
    const zx1 = b.x;
    crags[1].enemy('firelizard', 2);
    crags[5].enemy('firelizard', 1);
    crags[9].enemy('firelizard', 1);
    b.addEnemy('ptero', zx0 + 14, { row: 3 });
    b.addEnemy('ptero', zx0 + 36, { row: 2 });
    b.addEnemy('ptero', zx0 + 58, { row: 3 });
    b.addEnemy('drone', zx0 + 26, { row: 5 });
    b.addEnemy('drone', zx0 + 48, { row: 5 });
    b.addEnemy('drone', zx0 + 66, { row: 4 });
    b.addEnemy('striker', zx0 + 40, { row: 3 });
    b.addEnemy('striker', zx0 + 64, { row: 2 });
    b.addCapsule('R', zx0 + 10, 3);
    b.addCapsule('random', zx0 + 52, 3);
    crags[0].medalsAbove(1, 1, 2);
    crags[3].medalsAbove(1, 1, 2);
    crags[6].medalsAbove(1, 1, 2);
    crags[8].medalsAbove(2, 1, 2);
    crags[11].medalsAbove(2, 1, 2);
    b.lavaRise(zx0, zx1, { endRow: 11, interval: 3 });
    b.autoscroll(zx0, zx1, 42);

    // --- 4. Cooled ground: down the far side of the cone, a bunker and the last lava gap ---
    b.slope(-3, { angle: 45 });
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
