// Level 10 - Medieval Europe: the Castle Siege. You are the besieger: fight across the field under catapult fire (a red
// mark shows where each flaming boulder will land, so keep moving), wade the moat, storm the gatehouse past knights
// in plate (their shields stop flat shots) and crossbowmen on the ramparts, then cross the inner bailey under a second,
// heavier barrage. The Siege Tower Titan waits in the keep's yard.

import { LevelBuilder } from '../levelgen.js';

export const castle = {
  name: 'CASTLE SIEGE',
  era: 'MEDIEVAL EUROPE',
  theme: 'castle',
  seed: 110,
  music: 'castle',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 9 });

    // --- 1. Outside the walls: the first knight ---
    let s = b.flat(34);
    s.capsule('E', 6, 6);
    s.prompt('KNIGHTS BLOCK FLAT SHOTS. SHOOT FROM ABOVE OR GET BEHIND THEM', 2, 22);
    s.enemy('knight', 20);
    s.enemy('crossbowman', 29);
    s.medals(8, 11, 3, 2);
    b.prop('banner', s.x0 + 4);
    b.prop('banner', s.x0 + 26);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The siege field: the first barrage ---
    s = b.flat(44);
    s.checkpoint(1);
    s.prompt('CATAPULTS! A RED MARK SHOWS WHERE A BOULDER LANDS. KEEP MOVING', 1, 24);
    s.enemy('crossbowman', 12);
    s.enemy('knight', 22);
    s.enemy('crossbowman', 31);
    s.enemy('knight', 40);
    s.capsule('S', 14, 6);
    s.medals(24, 10, 4, 2, 2);
    b.barrage(s.x0 + 3, s.x1, { period: 4.0, volley: 2 });
    b.prop('banner', s.x0 + 18, { h: 80 });

    // --- 3. The moat: wade it, or hop the planks the besiegers laid ---
    s = b.flat(8);
    s.enemy('crossbowman', 5);
    const moat = b.pit(5, { fill: 'water' });
    b.platform(moat.x0 + 1, 10, 3);
    s = b.flat(20);
    s.checkpoint(1);
    s.enemy('knight', 8);
    s.enemy('drone', 14, { row: 6 });
    s.capsule('M', 4, 6);
    s.medals(10, 11, 3, 2);

    // --- 4. The gatehouse: three tiers of ramparts ---
    b.up(2);
    s = b.flat(14);
    s.enemy('crossbowman', 5);
    s.enemy('crossbowman', 11);
    b.prop('banner', s.x0 + 1, { h: 84 });
    b.up(2);
    s = b.flat(14);
    s.checkpoint(1);
    s.enemy('catapult', 9);
    s.enemy('knight', 4);
    b.platform(s.x0 + 2, 6, 6);
    s.capsule('R', 6, 5);
    b.down(4);
    s = b.flat(10);
    s.enemy('crossbowman', 6, { row: 13 });
    b.pit(3, { fill: 'spikes' });

    // --- 5. The inner bailey: the second, heavier barrage ---
    s = b.flat(52);
    s.checkpoint(1);
    s.prompt('THE KEEP\'S CATAPULTS TARGET YOU TOO. DO NOT STAND STILL', 1, 24);
    s.enemy('knight', 10);
    s.enemy('crossbowman', 17);
    s.enemy('knight', 26);
    s.enemy('crossbowman', 33);
    s.enemy('drone', 38, { row: 6 });
    s.enemy('knight', 46);
    s.capsule('H', 8, 6);
    s.medals(14, 10, 4, 2, 2);
    b.barrage(s.x0 + 2, s.x1, { period: 3.4, volley: 3, spread: 58 });
    b.block(s.x0 + 22, 2, 1);
    b.prop('banner', s.x0 + 8);
    b.prop('banner', s.x0 + 40, { h: 80 });

    // --- 6. The wall walk: a gauntlet of merlons and gaps, crossbowmen above ---
    s = b.flat(8);
    s.checkpoint(1);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(10);
    s.enemy('crossbowman', 6);
    b.block(s.x0 + 3, 2, 1);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);
    s = b.flat(12);
    s.checkpoint(1);
    s.enemy('knight', 8);
    s.enemy('crossbowman', 4, { row: 13 });
    b.pit(5);
    b.platform(b.x - 5, 11, 3, { kind: 'one-way' });
    s = b.flat(14);
    s.enemy('catapult', 6);
    s.enemy('crossbowman', 11);
    s.capsule('B', 3, 6);
    s.medals(5, 10, 4, 2, 2);

    // --- 7. The tower yard: the Siege Tower Titan ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('THE SIEGE TOWER ROLLS! SHOOT THE GLOWING RAM PORT AT ITS FOOT', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('siegetower');
    b.prop('banner', arena.x0 + 1, { h: 84 });
    b.prop('banner', arena.x1 - 3, { h: 84 });
    b.platform(arena.x0 + 3, 10, 5);
    return b.finish();
  },
};
