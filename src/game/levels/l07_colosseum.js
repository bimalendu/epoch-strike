// Level 7 - Ancient Rome: the Colosseum. Two wave arenas (the camera locks and gladiators, hoplites and a war elephant
// pour in until every wave is dead), a chariot ride at full speed past rival chariots, then the Chariot Champion in
// the main arena. Shoot the driver from the ledges: the chariot cannot reach you there.
//
// The way in is over Rome's seven hills: a gentle rise at the gate and a 45-degree ramp up to the terrace of the promenade. The
// wave arenas, the chariot ride and the champion's arena are level, because they are fought on the sand.

import { LevelBuilder } from '../levelgen.js';

export const colosseum = {
  name: 'THE COLOSSEUM',
  era: 'ANCIENT ROME',
  theme: 'colosseum',
  seed: 107,
  music: 'colosseum',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 6 });

    // --- 1. The gladiators' gate: up an olive-covered rise and down the far side ---
    let s = b.flat(12);
    s.capsule('E', 6, 6);
    s.prompt('GLADIATORS RUSH YOU. KEEP YOUR DISTANCE', 2, 14);
    b.slope(1, { angle: 22 });
    s = b.flat(6);
    s.enemy('gladiator', 3);
    s.medalsAbove(0, 3, 2, 2);
    b.slope(-1, { angle: 22 });
    s = b.flat(16);
    s.enemy('gladiator', 4);
    s.enemy('hoplite', 11);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The promenade: a 45-degree ramp up to the terrace, archers on the balconies ---
    s = b.flat(8);
    s.checkpoint(1);
    b.slope(2, { angle: 45 });
    s = b.flat(26);
    const balcony = b.gy - 4;
    b.platform(s.x0 + 6, balcony, 7);
    b.platform(s.x0 + 18, balcony, 7);
    s.enemy('archer', 8, { row: balcony }).enemy('archer', 21, { row: balcony });
    s.enemy('gladiator', 12).enemy('gladiator', 16);
    s.enemy('drone', 24, { row: b.rowAbove(7) });
    s.capsule('S', 4, b.rowAbove(8));
    s.medalsAbove(7, 4, 4, 2);
    b.slope(-2, { angle: 45 });
    b.flat(2);

    // --- 3. First arena: three waves ---
    s = b.flat(8);
    s.prompt('THE GATES CLOSE. SURVIVE EVERY WAVE', 0, 10);
    let arena = b.arenaWaves([
      [{ type: 'gladiator', side: 'R' }, { type: 'gladiator', side: 'R' }, { type: 'gladiator', side: 'L' }],
      [{ type: 'gladiator', side: 'L' }, { type: 'gladiator', side: 'L' }, { type: 'gladiator', side: 'R' }, { type: 'archer', dx: 24, y: 10 * 16 }],
      [{ type: 'elephant', side: 'R', item: 'R' }, { type: 'gladiator', side: 'L' }],
    ]);
    b.platform(arena.x0 + 5, 10, 6);
    b.platform(arena.x1 - 11, 10, 6);
    s = b.flat(6);

    // --- 4. The chariot ride: the camera drives on at full gallop ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('YOU ARE ON A CHARIOT. JUMP THE GAPS', 0, 12);
    const rideStart = b.x;
    s.enemy('rivalchariot', 8);
    b.pit(3, { fill: 'spikes' });
    s = b.flat(12);
    s.enemy('archer', 6, { row: 10 });
    b.platform(s.x0 + 3, 10, 6);
    s.capsule('M', 5, 6);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(12);
    s.enemy('rivalchariot', 10);
    s.enemy('drone', 6, { row: 7 });
    s.medals(3, 9, 4, 2, 2);
    b.block(s.x0 + 6, 2, 2);
    s = b.flat(10);
    b.pit(3, { fill: 'spikes' });
    s = b.flat(14);
    s.enemy('rivalchariot', 12);
    s.enemy('archer', 4, { row: 10 });
    b.platform(s.x0 + 1, 10, 6);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(14);
    s.enemy('gladiator', 6);
    s.enemy('drone', 10, { row: 6 });
    const rideEnd = b.x;
    b.chariot(rideStart, rideEnd, 72);
    s = b.flat(8);

    // --- 5. Second arena: the elephants come ---
    arena = b.arenaWaves([
      [{ type: 'gladiator', side: 'L' }, { type: 'gladiator', side: 'R' }, { type: 'drone', side: 'R', y: 7 * 16 }, { type: 'drone', side: 'L', y: 6 * 16 }],
      [{ type: 'elephant', side: 'L' }, { type: 'gladiator', side: 'R' }, { type: 'gladiator', side: 'R' }],
      [{ type: 'elephant', side: 'R' }, { type: 'gladiator', side: 'L' }, { type: 'gladiator', side: 'L', item: 'B' }, { type: 'archer', dx: 24, y: 10 * 16 }],
    ]);
    b.platform(arena.x0 + 4, 10, 6);
    b.platform(arena.x0 + 13, 10, 5);
    b.platform(arena.x1 - 10, 10, 6);
    s = b.flat(6);

    // --- 6. The gate of the champions: the last rise before the sand ---
    s = b.flat(6);
    s.checkpoint(1);
    s.enemy('hoplite', 4);
    b.slope(2, { angle: 22 });
    s = b.flat(18);
    const gallery = b.gy - 4;
    b.platform(s.x0 + 9, gallery, 7);
    s.enemy('hoplite', 3).enemy('gladiator', 8);
    s.enemy('archer', 12, { row: gallery });
    s.capsule('H', 4, b.rowAbove(8));
    s.medalsAbove(5, 3, 3, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(4);

    // --- 7. Approach and arena: the Chariot Champion ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('THE CHAMPION RIDES. SHOOT THE DRIVER FROM THE LEDGES', 1, 14);
    s.capsule('B', 7, 6);
    arena = b.bossArena('champion');
    b.platform(arena.x0 + 6, 11, 5);
    b.platform(arena.x1 - 11, 11, 5);
    return b.finish();
  },
};
