// Level 14 - The Industrial Age: the Steam Factory. Workers swing wrenches, foremen hide behind a steel apron (shoot them
// from above or from behind), riveters line the gantries. The floor fights back: conveyor belts carry you with them or
// against you, steam vents flash and then burst (cross between the bursts), iron presses slam down on a rhythm and a
// foundry channel of molten metal has to be hopped on iron platforms. The Iron Furnace Engine guards the smelter.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

/** An iron press hung over column `col`; it falls from row 10 to the floor, `phase` seconds out of step. */
function press(b, col, phase = 0) {
  b.addEnemy('press', col, { row: 10, drop: (b.gy - 10) * 16, phase });
}

export const factory = {
  name: 'STEAM FACTORY',
  era: 'THE INDUSTRIAL AGE',
  theme: 'factory',
  seed: 114,
  music: 'factory',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 13 });

    // --- 1. The factory gate ---
    let s = b.flat(36);
    s.capsule('E', 6, 6);
    s.prompt('WORKERS SWING THEIR WRENCHES. SHOOT THEM BEFORE THEY CLOSE IN', 2, 22);
    s.enemy('worker', 14);
    s.enemy('worker', 22);
    s.enemy('riveter', 30);
    s.medals(8, 11, 3, 2);
    b.prop('gear', s.x0 + 12, { r: 20, h: 70 });
    b.prop('pipes', s.x0 + 26);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The foremen's hall ---
    s = b.flat(40);
    s.checkpoint(1);
    s.prompt('FOREMEN HIDE BEHIND A STEEL APRON. SHOOT FROM ABOVE OR GET BEHIND THEM', 1, 24);
    s.enemy('worker', 8);
    s.enemy('foreman', 14);
    const gantry = b.platform(s.x0 + 20, 10, 8);
    b.addEnemy('riveter', gantry.x0 + 3, { row: 10 });
    b.addEnemy('riveter', gantry.x0 + 6, { row: 10 });
    s.enemy('foreman', 32);
    s.enemy('drone', 26, { row: 6 });
    s.capsule('S', 14, 6);
    s.medals(21, 8, 4, 2);
    b.prop('pipes', s.x0 + 4);
    b.prop('gear', s.x0 + 30, { r: 24, h: 76, dir: -1 });
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);

    // --- 3. The conveyor hall: belts against you, then with you ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('CONVEYOR BELTS PUSH THE SOLDIER. RUN WITH THEM OR AGAINST THEM', 2, 18);
    s.enemy('riveter', 8);
    s = b.flat(20, { top: T.CONV_L }); // the belt runs toward you
    s.enemy('worker', 8);
    s.enemy('worker', 15);
    s.capsule('R', 10, 6);
    b.pit(3, { fill: 'lava' });
    s = b.flat(22, { top: T.CONV_R }); // and this one carries you along
    s.enemy('riveter', 9);
    s.enemy('foreman', 16);
    s.enemy('drone', 12, { row: 6 });
    s.medals(5, 10, 4, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 4. The steam vents ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('STEAM VENTS: A MARK FLASHES, THEN THE COLUMN BURSTS. CROSS BETWEEN BURSTS', 1, 22);
    s = b.flat(40);
    for (const [i, col] of [6, 12, 18, 24, 30].entries()) b.vent(s.x0 + col, { period: 3.6, phase: [0.8, 2.2, 0.4, 1.8, 3.0][i] });
    s.enemy('riveter', 16);
    s.enemy('worker', 22);
    s.enemy('riveter', 36);
    s.capsule('M', 20, 6);
    b.prop('pipes', s.x0 + 9);
    b.prop('pipes', s.x0 + 27);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);

    // --- 5. The press line ---
    s = b.flat(42);
    s.checkpoint(1);
    s.prompt('IRON PRESSES SLAM DOWN ON A RHYTHM. WAIT FOR THE MARK TO CLEAR', 1, 24);
    for (const [col, ph] of [[8, 0], [15, 0.8], [22, 1.6], [29, 0.4], [36, 1.2]]) press(b, s.x0 + col, ph);
    s.enemy('worker', 12);
    s.enemy('riveter', 25);
    s.enemy('foreman', 33);
    s.capsule('H', 18, 6);
    b.pit(4, { fill: 'lava' });
    b.platform(b.x - 4, 11, 3);

    // --- 6. The foundry channel: molten metal under iron platforms, slag cannons overhead ---
    s = b.flat(12);
    s.checkpoint(1);
    s.prompt('A CHANNEL OF MOLTEN METAL. HOP THE IRON PLATFORMS AND WATCH THE SLAG CANNONS', 0, 14);
    s.enemy('slagcannon', 9);
    b.pit(5, { fill: 'lava' });
    b.platform(b.x - 4, 10, 3);
    s = b.flat(12);
    s.enemy('worker', 6);
    s.enemy('slagcannon', 10);
    b.pit(5, { fill: 'lava' });
    b.platform(b.x - 5, 11, 3, { kind: 'one-way' });
    s = b.flat(16);
    s.checkpoint(1);
    s.enemy('foreman', 6);
    s.enemy('riveter', 12);
    s.enemy('drone', 9, { row: 6 });
    s.medals(5, 9, 4, 2, 2);

    // --- 7. The Iron Furnace Engine ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('THE IRON FURNACE ENGINE! SHOOT ITS MOUTH WHILE IT IS OPEN. PRESSURE SHUTS IT', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('furnace');
    b.prop('gear', arena.x0 + 6, { r: 26, h: 80 });
    b.prop('pipes', arena.x0 + 12, { h: 76 });
    return b.finish();
  },
};
