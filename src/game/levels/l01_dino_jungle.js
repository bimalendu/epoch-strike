// Level 1 - Cretaceous: Dino Jungle. Teaches moving, jumping, shooting, aiming up, dropping through
// platforms, weapon capsules and checkpoints, then raises the heat with plants, drones, a pod and a river ford.
// Rift drones are the first sign that something is wrong with time itself.

import { LevelBuilder } from '../levelgen.js';

export const dinoJungle = {
  name: 'DINO JUNGLE',
  era: 'CRETACEOUS',
  theme: 'jungle',
  seed: 101,
  music: 'jungle',
  bulletScale: 0.85,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 0 });

    // --- 1. Tutorial meadow: nothing here can hurt you but one lone raptor ---
    let s = b.flat(34);
    s.prompt('MOVE WITH {move}', 1, 8);
    s.prompt('HOLD {fire} TO SHOOT', 9, 10);
    s.prompt('PRESS {jump} TO JUMP', 24, 9);
    s.enemy('raptor', 20);
    s.medals(12, 11, 3, 2);
    b.pit(2);

    // --- 2. First pit crossed: raptors in pairs and the first weapon capsule ---
    s = b.flat(26);
    s.capsule('S', 3, 7);
    s.enemy('raptor', 9).enemy('raptor', 13);
    s.prompt('SHOOT CAPSULES FOR WEAPONS', 1, 12);
    s.enemy('raptor', 21);
    b.up(1);
    s = b.flat(10);
    s.medals(2, 11, 4, 2);
    b.down(1);

    // --- 3. Spikes, with a high road over them ---
    s = b.flat(8);
    s.checkpoint(1);
    const pit = b.pit(4, { fill: 'spikes' });
    b.platform(pit.x0 - 1, 10, 6);
    s = b.flat(14);
    s.medals(-4, 8, 4, 1, 2);
    s.enemy('raptor', 6);

    // --- 4. Two-storey ledge: drop through the one-way platform ---
    s = b.flat(30);
    b.platform(s.x0 + 6, 10, 8);
    b.platform(s.x0 + 8, 7, 5);
    s.prompt('{down} + {jump} DROPS THROUGH PLATFORMS', 2, 16);
    s.enemy('raptor', 10);
    s.pickup('bomb', 10, 6);
    s.enemy('raptor', 20).enemy('raptor', 23);

    // --- 5. Rift drones appear ---
    s = b.flat(30);
    s.prompt('{up} + {fire} AIMS UP', 1, 14);
    s.enemy('drone', 12, { row: 9 });
    s.enemy('drone', 19, { row: 8 });
    s.enemy('drone', 24, { row: 9 });
    s.capsule('R', 8, 6);
    s.enemy('raptor', 16);
    b.pit(3);

    // --- 6. Spitting plants guard the path ---
    s = b.flat(32);
    s.checkpoint(1);
    s.enemy('spitter', 9);
    s.enemy('spitter', 17);
    s.enemy('raptor', 13);
    s.enemy('drone', 22, { row: 9 });
    s.capsule('M', 4, 6);
    b.up(2);
    s = b.flat(10);
    s.enemy('spitter', 5);
    b.down(2);

    // --- 7. River ford: wade through the swamp ---
    s = b.flat(6);
    b.pit(5, { fill: 'water' });
    s = b.flat(8);
    s.enemy('raptor', 3).enemy('raptor', 5);
    s.medals(0, 11, 3, 2);
    b.pit(5, { fill: 'water' });

    // --- 8. Rift pod bunker with a weapon inside ---
    s = b.flat(34);
    s.enemy('pod', 14, { item: 'L' });
    s.enemy('trooper', 24);
    s.enemy('raptor', 6).enemy('raptor', 8);
    s.capsule('B', 4, 6);
    s.checkpoint(2);

    // --- 9. Last stretch: divers, packs and a spiked run ---
    s = b.flat(10);
    s.enemy('striker', 6, { row: 7 });
    b.pit(3, { fill: 'spikes' });
    b.platform(s.x1, 10, 3);
    s = b.flat(24);
    s.enemy('raptor', 5).enemy('raptor', 8).enemy('raptor', 11);
    s.enemy('striker', 12, { row: 7 });
    s.enemy('spitter', 18);
    s.enemy('drone', 20, { row: 9 });
    s.capsule('random', 2, 6);

    // --- 10. The approach and the arena: REX-7 ---
    s = b.flat(22);
    s.prompt('SOMETHING HUGE IS COMING...', 4, 14);
    s.pickup('bomb', 8, 11);
    s.capsule('S', 12, 7);
    b.bossArena('trex');
    return b.finish();
  },
};
