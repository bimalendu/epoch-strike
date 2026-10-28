// Level 18 - The Modern Age: Neon City. A rain-slick boulevard of cyborg gunmen, snipers behind glass and laser turrets,
// then a rooftop chase: the camera drives on at a run while you leap the street gaps between towers, and attack
// helicopters hang over the skyline shooting down at you. The Gunship Helicopter waits over the last avenue.
// The era's weapon is the Plasma Cannon.

import { LevelBuilder } from '../levelgen.js';

export const neonCity = {
  name: 'NEON CITY',
  era: 'THE MODERN AGE',
  theme: 'neon',
  seed: 118,
  music: 'neon',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 17 });

    // --- 1. The boulevard ---
    let s = b.flat(46);
    s.capsule('E', 8, 6);
    s.prompt('CYBORGS FIRE FAST BURSTS. KEEP MOVING AND USE THE COVER', 4, 28);
    b.prop('neonsign', s.x0 + 10, { col: '#ff4ad8' });
    b.prop('streetlamp', s.x0 + 20);
    b.prop('neonsign', s.x0 + 34, { col: '#4af0ff', h: 90 });
    b.block(s.x0 + 18, 2, 2); // a planter and a bench to take cover behind
    b.block(s.x0 + 30, 2, 2);
    s.enemy('cyborg', 14);
    s.enemy('cyborg', 24);
    s.enemy('hunter', 20, { row: 6 });
    s.enemy('cyborg', 38);
    s.medals(12, 10, 3, 2);
    b.pit(3, { fill: 'spikes' }); // a roadworks trench

    // --- 2. The underpass: snipers behind glass, laser turrets in the walls ---
    s = b.flat(44);
    s.checkpoint(1);
    s.prompt('SNIPERS AIM FOR A SECOND, THEN FIRE FAST. LASER TURRETS COVER THE ROAD', 2, 30);
    b.prop('streetlamp', s.x0 + 12);
    b.prop('billboard', s.x0 + 30);
    const deck = b.platform(s.x0 + 14, 10, 14);
    b.addEnemy('sniperbot', deck.x0 + 3, { row: 10 });
    b.addEnemy('cyborg', deck.x0 + 10, { row: 10 });
    s.enemy('laserturret', 8);
    s.enemy('cyborg', 20);
    s.enemy('laserturret', 33);
    s.enemy('hunter', 26, { row: 6 });
    s.enemy('cyborg', 40);
    s.capsule('S', 16, 5);
    s.medals(18, 8, 4, 2, 2);

    // --- 3. Chop shop alley ---
    b.pit(3, { fill: 'spikes' });
    s = b.flat(40);
    s.checkpoint(1);
    s.prompt('DRONES DIVE AT YOU WHEN YOU PASS UNDER THEM. SHOOT THEM FIRST', 2, 28);
    b.block(s.x0 + 12, 3, 2);
    b.block(s.x0 + 24, 2, 3);
    s.enemy('hunter', 10, { row: 5 });
    s.enemy('hunter', 16, { row: 6 });
    s.enemy('cyborg', 18);
    s.enemy('sniperbot', 28, { row: 13 });
    s.enemy('hunter', 30, { row: 5 });
    s.enemy('laserturret', 36);
    s.capsule('R', 4, 6);

    // --- 4. Up the fire escape ---
    b.up(3);
    s = b.flat(12);
    s.checkpoint(1);
    s.prompt('THE ROOFTOP CHASE! THE SCREEN KEEPS SCROLLING. JUMP THE GAPS, DO NOT FALL BEHIND', 0, 30);
    s.capsule('B', 6, 5);
    s.enemy('cyborg', 9);

    // --- 5. The rooftop chase: the camera drives on ---
    const rideStart = b.x;
    s = b.flat(14);
    s.enemy('cyborg', 6);
    s.enemy('hunter', 10, { row: 3 });
    b.prop('billboard', s.x0 + 8);
    b.pit(4);
    s = b.flat(12);
    b.block(s.x0 + 5, 2, 2); // an air-conditioning unit
    s.enemy('gunchopper', 6, { row: 3 });
    s.enemy('cyborg', 9);
    b.pit(5);
    b.down(1);
    s = b.flat(12);
    s.enemy('hunter', 5, { row: 4 });
    s.enemy('cyborg', 8);
    s.capsule('S', 7, 3);
    b.pit(4);
    b.up(1);
    s = b.flat(14);
    b.block(s.x0 + 4, 2, 2);
    b.block(s.x0 + 9, 2, 2);
    s.enemy('sniperbot', 11);
    s.enemy('gunchopper', 8, { row: 2 });
    b.prop('neonsign', s.x0 + 2, { col: '#ffe27a', h: 80 });
    b.pit(5);
    s = b.flat(12);
    s.enemy('cyborg', 4);
    s.enemy('hunter', 7, { row: 3 });
    s.enemy('hunter', 10, { row: 4 });
    s.medals(2, 6, 4, 2, 2);
    b.pit(4);
    b.down(1);
    s = b.flat(14);
    b.block(s.x0 + 6, 3, 2);
    s.enemy('gunchopper', 5, { row: 3 });
    s.enemy('cyborg', 10);
    s.capsule('R', 2, 3);
    b.pit(5);
    s = b.flat(12);
    s.enemy('laserturret', 8);
    s.enemy('hunter', 4, { row: 4 });
    b.pit(4);
    b.up(1);
    s = b.flat(14);
    b.prop('billboard', s.x0 + 6);
    s.enemy('cyborg', 5);
    s.enemy('gunchopper', 9, { row: 2 });
    s.enemy('sniperbot', 12);
    const rideEnd = b.x;
    b.autoscroll(rideStart, rideEnd, 50);

    // --- 6. Back down to the avenue ---
    b.down(3);
    s = b.flat(24);
    s.checkpoint(1);
    s.prompt('THE CHASE IS OVER. CATCH YOUR BREATH', 1, 20);
    s.enemy('cyborg', 12);
    s.enemy('hunter', 16, { row: 5 });
    s.enemy('laserturret', 21);
    s.capsule('E', 6, 6);
    s.medals(9, 9, 3, 2);

    // --- 7. The Gunship Helicopter ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('THE GUNSHIP! SHOOT THE COCKPIT AND CHIN TURRET FROM UNDERNEATH. IT CLOSES UP TO FIRE ROCKETS', 0, 14);
    s.capsule('E', 3, 6);
    const arena = b.bossArena('gunship');
    b.prop('streetlamp', arena.x0 + 2);
    b.prop('streetlamp', arena.x1 - 3);
    return b.finish();
  },
};
