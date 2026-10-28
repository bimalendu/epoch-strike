// Level 12 - Age of Sail: the Pirate Armada. Fight along the quay (cutlass pirates leap at you, buccaneers shoot from the
// rails, deck cannons lob balls), then cross the armada ship by ship: the hulls are too far apart to jump, so you ride
// ROPE SWINGS between them (step on when the plank comes in, ride across, step off). Gulls dive at you in mid-swing.
// The last deck is rammed alongside the Ghost Galleon.
//
// The shore is a rocky coast: 22-degree rises, a 45-degree ramp up the harbour wall to the cannon battery and a steep scree bank down
// to the dock. The ships (and the rope swings between them) are level, as the decks of a ship are.

import { LevelBuilder } from '../levelgen.js';

export const armada = {
  name: 'PIRATE ARMADA',
  era: 'AGE OF SAIL',
  theme: 'pirate',
  seed: 112,
  music: 'armada',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 11 });

    // --- 1. The quay: a rocky coast, and the first cutlass ---
    let s = b.flat(14);
    s.capsule('E', 6, 6);
    s.prompt('PIRATES LEAP WHEN YOU COME CLOSE. SHOOT THEM BEFORE THEY LAND', 2, 22);
    b.prop('banner', s.x0 + 4);
    b.slope(2, { angle: 22 });
    s = b.flat(10);
    s.enemy('pirate', 4);
    s.medalsAbove(2, 3, 2, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(12);
    s.enemy('buccaneer', 6);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The harbour: a 45-degree ramp up the harbour wall to the cannon battery, and a flock of gulls ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('DECK CANNONS LOB BALLS IN AN ARC. WATCH THE BARREL TURN, THEN MOVE', 1, 24);
    s.enemy('pirate', 6);
    b.slope(3, { angle: 45 });
    s = b.flat(18);
    s.enemy('deckcannon', 5);
    s.enemy('pirate', 12);
    s.enemy('gull', 9, { row: 5 });
    s.capsule('S', 3, b.rowAbove(8));
    s.medalsAbove(7, 4, 2, 2, 2);
    b.prop('banner', s.x0 + 8, { h: 80 });
    b.slope(-3, { angle: 45 });
    s = b.flat(12);
    s.enemy('buccaneer', 6);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, b.gy - 4, 3);

    // --- 3. The gangway: down the scree bank to the dock ---
    b.slope(2, { angle: 45 });
    b.flat(3);
    b.slope(-2, { angle: 67 });
    s = b.flat(16);
    s.enemy('buccaneer', 4);
    s.enemy('pirate', 11);
    s.capsule('M', 8, 6);
    b.pit(5, { fill: 'spikes' });
    b.platform(b.x - 5, b.gy - 4, 3, { kind: 'one-way' });

    // --- 4. The first ship: the rope swing ---
    s = b.flat(24);
    s.checkpoint(1);
    s.prompt('THE SHIPS ARE TOO FAR APART. STEP ON THE PLANK WHEN IT SWINGS IN, RIDE IT ACROSS, STEP OFF', 12, 12);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 11);
    b.block(s.x0 + 6, 2, 1);
    s.enemy('pirate', 9);
    s.enemy('buccaneer', 15);
    s.enemy('deckcannon', 20);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.swing(8, { period: 3.8 });

    // --- 5. The second ship: buccaneers on the poop deck ---
    s = b.flat(26);
    s.checkpoint(1);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 12);
    const poop = b.platform(s.x0 + 14, 10, 6);
    b.addEnemy('buccaneer', poop.x0 + 1, { row: 10 });
    b.addEnemy('buccaneer', poop.x0 + 4, { row: 10 });
    s.enemy('pirate', 7);
    s.enemy('pirate', 11);
    s.enemy('gull', 18, { row: 5 });
    s.capsule('R', 6, 6);
    s.medals(15, 8, 4, 2);
    b.block(s.x0 + 22, 2, 1);
    s.enemy('deckcannon', 24);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.swing(10, { period: 3.4 });

    // --- 6. The third ship: a cutlass gauntlet ---
    s = b.flat(24);
    s.checkpoint(1);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 10);
    s.enemy('pirate', 6);
    s.enemy('buccaneer', 12);
    s.enemy('pirate', 15);
    s.enemy('gull', 14, { row: 5 });
    s.enemy('deckcannon', 21);
    s.capsule('H', 10, 6);
    b.block(s.x0 + 17, 2, 2);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.swing(11, { period: 3.4 });

    // --- 7. The fourth ship: the flagship's escort ---
    s = b.flat(28);
    s.checkpoint(1);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 8);
    b.prop('mast', s.x0 + 19, { h: 130 });
    const rail = b.platform(s.x0 + 12, 10, 5);
    b.addEnemy('buccaneer', rail.x0 + 2, { row: 10 });
    s.enemy('pirate', 5);
    s.enemy('pirate', 10);
    s.enemy('gull', 16, { row: 5 });
    s.enemy('buccaneer', 21);
    s.enemy('deckcannon', 25);
    s.medals(5, 8, 4, 2, 2);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.swing(9, { period: 3.6 });

    // --- 8. Boarding the Ghost Galleon ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('THE GHOST GALLEON! SHOOT THE SPIRIT LANTERN ON ITS BOW. JUMP THE LOW BALLS, GO PRONE UNDER THE HIGH ONES', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('ghostgalleon');
    b.prop('prow', arena.x0 + 1, { dir: -1 });
    b.prop('mast', arena.x0 + 8, { h: 160 });
    return b.finish();
  },
};
