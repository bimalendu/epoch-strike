// Level 7 - Ancient Rome: the Colosseum. Two wave arenas (the camera locks and gladiators, hoplites and a war elephant
// pour in until every wave is dead), a chariot ride at full speed past rival chariots, then the Chariot Champion in
// the main arena. Shoot the driver from the ledges: the chariot cannot reach you there.

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

    // --- 1. The gladiators' gate ---
    let s = b.flat(32);
    s.capsule('E', 6, 6);
    s.prompt('GLADIATORS RUSH YOU. KEEP YOUR DISTANCE', 2, 14);
    s.enemy('gladiator', 14).enemy('gladiator', 20);
    s.enemy('hoplite', 26);
    s.medals(9, 11, 3, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The promenade: archers on the balconies ---
    s = b.flat(30);
    s.checkpoint(1);
    b.platform(s.x0 + 6, 10, 7);
    b.platform(s.x0 + 18, 10, 7);
    s.enemy('archer', 8, { row: 10 }).enemy('archer', 21, { row: 10 });
    s.enemy('gladiator', 12).enemy('gladiator', 16);
    s.enemy('drone', 24, { row: 7 });
    s.capsule('S', 4, 6);
    s.medals(7, 8, 4, 2);

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

    // --- 6. The gate of the champions ---
    s = b.flat(24);
    s.checkpoint(1);
    s.enemy('hoplite', 6).enemy('hoplite', 10).enemy('gladiator', 15);
    s.enemy('archer', 12, { row: 10 });
    b.platform(s.x0 + 9, 10, 7);
    s.capsule('H', 4, 6);
    s.medals(8, 8, 3, 2);

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
