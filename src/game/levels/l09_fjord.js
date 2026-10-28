// Level 9 - Viking Age: the Fjord Raid. Fight along the docks (berserkers that speed up when hurt, axe throwers on the
// piers), ford a river patrolled by sea serpents (they ripple before they strike), then cross three longship decks on
// a heaving sea: a swell races along the deck every few seconds and has to be jumped (the bulwarks are cover).
// The last ship carries the Kraken.

import { LevelBuilder } from '../levelgen.js';

export const fjord = {
  name: 'FJORD RAID',
  era: 'VIKING AGE',
  theme: 'fjord',
  seed: 109,
  music: 'viking',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 8 });
    const wet = () => b.gy + 1; // the row of the water surface in a ford

    // --- 1. The landing beach ---
    let s = b.flat(34);
    s.capsule('E', 6, 6);
    s.prompt('BERSERKERS RUN FASTER WHEN HURT. KEEP SHOOTING', 2, 20);
    s.enemy('berserker', 16);
    s.enemy('axethrower', 25);
    s.medals(9, 11, 3, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The first ford: the water ripples, then a serpent breaks out ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('THE WATER RIPPLES. A SERPENT IS ABOUT TO LEAP', 4, 14);
    s.enemy('axethrower', 10);
    const ford = b.pit(5, { fill: 'water' });
    b.addEnemy('serpent', ford.x0 + 2, { row: wet() });
    b.platform(ford.x0 + 1, 10, 3);
    s = b.flat(20);
    s.enemy('berserker', 8);
    s.enemy('berserker', 13);
    s.capsule('S', 6, 6);
    s.medals(6, 10, 4, 2, 2);

    // --- 3. The piers ---
    b.up(2);
    s = b.flat(16);
    s.checkpoint(1);
    s.enemy('axethrower', 5);
    s.enemy('axethrower', 11);
    b.platform(s.x0 + 4, 9, 7);
    b.down(2);
    s = b.flat(14);
    s.enemy('berserker', 6);
    s.enemy('drone', 10, { row: 6 });
    b.pit(4, { fill: 'water' });
    b.addEnemy('serpent', b.x - 2, { row: wet() });
    s = b.flat(16);
    s.enemy('berserker', 8);
    s.enemy('axethrower', 13);
    s.capsule('M', 5, 6);

    // --- 4. The longships: three decks on a heaving sea ---
    s = b.flat(12);
    s.checkpoint(1);
    s.prompt('THE SEA HEAVES. JUMP THE SWELLS OR SHELTER BEHIND A BULWARK', 0, 18);
    const sea0 = b.x;
    // ship one
    s = b.flat(20);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 11);
    b.block(s.x0 + 8, 2, 1);
    b.block(s.x0 + 15, 2, 1);
    s.enemy('berserker', 11);
    s.enemy('axethrower', 17);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.pit(4, { fill: 'water' });
    b.addEnemy('serpent', b.x - 2, { row: wet() });
    // ship two
    s = b.flat(22);
    s.checkpoint(1);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 10);
    b.block(s.x0 + 6, 2, 1);
    b.block(s.x0 + 14, 2, 1);
    s.enemy('berserker', 9);
    s.enemy('berserker', 16);
    s.capsule('R', 7, 6);
    s.medals(10, 10, 3, 2);
    b.prop('prow', s.x1 - 2, { dir: 1 });
    b.pit(5, { fill: 'water' });
    b.addEnemy('serpent', b.x - 3, { row: wet() });
    b.platform(b.x - 4, 11, 3);
    // ship three
    s = b.flat(22);
    b.prop('prow', s.x0 + 1, { dir: -1 });
    b.prop('mast', s.x0 + 9);
    b.block(s.x0 + 5, 2, 1);
    b.block(s.x0 + 13, 2, 1);
    s.enemy('axethrower', 8);
    s.enemy('berserker', 12);
    s.enemy('drone', 16, { row: 6 });
    b.prop('prow', s.x1 - 2, { dir: 1 });
    s = b.flat(8);
    const sea1 = b.x;
    b.swells(sea0, sea1, { period: 4.4, speed: 105 });

    // --- 5. The flagship's gangway ---
    s = b.flat(18);
    s.checkpoint(1);
    s.enemy('berserker', 6);
    s.enemy('berserker', 11);
    s.capsule('H', 4, 6);
    s.medals(8, 11, 3, 2);
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('THE KRAKEN RISES! SHOOT ITS EYE FROM THE CROW\'S NEST', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('kraken');
    b.prop('mast', arena.x0 + 8, { h: 160 });
    b.prop('prow', arena.x0 + 1, { dir: -1 });
    b.platform(arena.x0 + 3, 10, 5);
    b.platform(arena.x0 + 12, 10, 5);
    return b.finish();
  },
};
