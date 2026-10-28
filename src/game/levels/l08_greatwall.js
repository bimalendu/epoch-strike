// Level 8 - Imperial China: the Great Wall. A long run along the battlements: terracotta guards that stand like statues
// until you come close, kite soldiers dropping firecrackers, and crates of fireworks whose rockets burst into falling
// sparks (watch the rocket, step away from where it will burst). The middle of the wall is a forced march; then a breach
// in the stonework, a statue garden, and the Dragon Kite Fortress waiting over the last tower.

import { LevelBuilder } from '../levelgen.js';

export const greatWall = {
  name: 'THE GREAT WALL',
  era: 'IMPERIAL CHINA',
  theme: 'greatwall',
  seed: 108,
  music: 'greatwall',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 7 });

    // --- 1. The gate: a guard of clay wakes up ---
    let s = b.flat(34);
    s.capsule('E', 6, 6);
    s.prompt('CLAY GUARDS WAKE WHEN YOU COME CLOSE. THEIR SHIELDS STOP FLAT SHOTS', 2, 20);
    s.enemy('terracotta', 18);
    s.enemy('archer', 28);
    s.medals(8, 11, 3, 2);
    b.prop('banner', s.x0 + 5);
    b.prop('banner', s.x0 + 22);
    b.pit(3, { fill: 'spikes' });

    // --- 2. Fireworks: the first crates ---
    s = b.flat(34);
    s.checkpoint(1);
    s.prompt('WATCH THE ROCKET. SPARKS RAIN DOWN WHERE IT BURSTS', 1, 18);
    s.enemy('firecrate', 8);
    s.enemy('archer', 17);
    s.enemy('firecrate', 24);
    s.enemy('terracotta', 29);
    b.prop('banner', s.x0 + 12);
    b.prop('banner', s.x0 + 31, { h: 80 });
    s.capsule('S', 14, 6);
    s.medals(10, 10, 4, 2, 2);

    // --- 3. The watchtower: kites over the battlements ---
    s = b.flat(10);
    b.up(2);
    s = b.flat(14);
    s.enemy('archer', 6);
    s.enemy('firecrate', 11);
    b.prop('banner', s.x0 + 1, { h: 84 });
    b.prop('banner', s.x0 + 13, { h: 84 });
    b.platform(s.x0 + 3, 9, 6);
    b.down(2);
    s = b.flat(8);
    s.enemy('kitesoldier', 4, { row: 7 });
    s.enemy('kitesoldier', 8, { row: 6 });
    b.pit(3, { fill: 'spikes' });
    s = b.flat(18);
    s.checkpoint(1);
    s.enemy('terracotta', 8);
    s.enemy('kitesoldier', 11, { row: 7 });
    s.medals(5, 11, 3, 2);

    // --- 4. The forced march along the crenellations ---
    s = b.flat(8);
    s.prompt('THE WALL BREAKS BEHIND YOU. KEEP MOVING', 0, 14);
    const march0 = b.x;
    s.enemy('firecrate', 6);
    for (let i = 0; i < 5; i++) {
      s = b.flat(8);
      b.block(s.x0 + 3, 2, 1); // a merlon to hop
      if (i % 2 === 1) b.prop('banner', s.x0 + 6);
      if (i % 2 === 0) s.enemy('firecrate', 6);
      if (i === 1) s.enemy('archer', 5);
      if (i === 2) s.capsule('M', 5, 6);
      if (i === 3) {
        s.enemy('kitesoldier', 4, { row: 7 });
        s.enemy('kitesoldier', 7, { row: 6 });
      }
      if (i === 4) s.enemy('terracotta', 6);
      if (i < 4) b.pit(3, { fill: 'spikes' });
    }
    s = b.flat(10);
    const march1 = b.x;
    b.autoscroll(march0, march1, 42);
    s.checkpoint(2);
    s.capsule('R', 5, 6);

    // --- 5. The breach: the wall has fallen away, cross on timbers ---
    s = b.flat(8);
    b.pit(5, { fill: 'spikes' });
    b.platform(b.x - 4, 11, 3);
    s = b.flat(10);
    s.enemy('archer', 6);
    s.enemy('kitesoldier', 3, { row: 7 });
    b.pit(5);
    b.platform(b.x - 5, 11, 3, { kind: 'one-way' });
    s = b.flat(12);
    s.checkpoint(1);
    s.enemy('firecrate', 5);
    s.enemy('kitesoldier', 7, { row: 6 });
    s.enemy('terracotta', 10);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(14);
    s.medals(4, 10, 4, 2, 2);
    s.enemy('drone', 8, { row: 6 });

    // --- 6. The statue garden: a line of clay soldiers, rockets behind ---
    s = b.flat(36);
    s.checkpoint(1);
    s.prompt('MORE GUARDS ARE WAKING. SHOOT FROM ABOVE OR GET BEHIND THEM', 1, 18);
    s.enemy('terracotta', 8);
    s.enemy('terracotta', 14);
    s.enemy('firecrate', 19);
    s.enemy('terracotta', 24);
    s.enemy('archer', 30, { row: 13 });
    s.capsule('H', 12, 6);
    b.prop('banner', s.x0 + 3);
    b.prop('banner', s.x0 + 33, { h: 80 });
    b.platform(s.x0 + 16, 10, 8);
    s.medals(18, 8, 3, 2);

    // --- 7. The last tower and the dragon ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('A DRAGON KITE! SHOOT UP AT THE PEARL IN ITS BROW', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('dragonkite');
    b.prop('banner', arena.x0 + 1, { h: 84 });
    b.prop('banner', arena.x1 - 3, { h: 84 });
    b.platform(arena.x0 + 4, 10, 5);
    b.platform(arena.x1 - 9, 10, 5);
    return b.finish();
  },
};
