// Level 16 - The Second World War: the Coastal Assault. You hit the beach from a landing craft: landmines hop out of the
// sand when you step near them (run on, or shoot them from afar), naval guns off the coast lay shells where you stand
// (a mark shows each landing spot), and machine-gun bunkers only fire while their slit is open. Fight up the seawall,
// then take a tank: it hops, carries a splash cannon and soaks four hits, and anything it drives into is crushed. The
// Super-Heavy Tank waits at the end of the road.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

export const coast = {
  name: 'COASTAL ASSAULT',
  era: 'THE SECOND WORLD WAR',
  theme: 'beach',
  seed: 116,
  music: 'assault',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 15 });

    // --- 1. The landing: mines in the sand ---
    let s = b.flat(44);
    s.capsule('E', 8, 6);
    b.prop('landing', s.x0 + 5);
    s.prompt('LANDMINES POP UP WHEN YOU STEP NEAR AND BURST. KEEP MOVING OR SHOOT THEM', 10, 26);
    s.enemy('mine', 16);
    s.enemy('garrison', 22);
    s.enemy('mine', 27);
    s.enemy('mine', 30);
    s.enemy('grenadier', 36);
    b.prop('hedgehog', s.x0 + 13);
    b.prop('hedgehog', s.x0 + 24);
    b.prop('sandbags', s.x0 + 22, { n: 3 });
    s.medals(10, 11, 3, 2);
    b.pit(3, { fill: 'water' }); // the surf

    // --- 2. The beach: naval gunfire and the first dragon's teeth ---
    s = b.flat(48);
    s.checkpoint(1);
    s.prompt('NAVAL GUNS! A MARK SHOWS WHERE EACH SHELL LANDS. KEEP MOVING', 2, 26);
    b.barrage(s.x0 + 3, s.x1, { shell: true, period: 4.4, volley: 2, spread: 72, fuse: 1.4, first: 2.2 });
    s.enemy('garrison', 8);
    b.block(s.x0 + 14, 2, 1, T.WALL); // concrete dragon's teeth
    s.enemy('mine', 18);
    s.enemy('grenadier', 20);
    s.enemy('stormtrooper', 26);
    b.prop('wire', s.x0 + 30, { w: 40 });
    const bluff = b.platform(s.x0 + 32, 10, 6);
    b.addEnemy('bazooka', bluff.x0 + 3, { row: 10 });
    s.enemy('fighter', 24, { row: 4 });
    s.enemy('garrison', 42);
    s.capsule('S', 16, 6);
    s.medals(12, 9, 4, 2, 2);
    b.prop('hedgehog', s.x0 + 6);
    b.prop('hedgehog', s.x0 + 38);
    b.pit(3, { fill: 'spikes' }); // barbed wire

    // --- 3. The seawall: bunkers and the first anti-tank gun ---
    b.up(3);
    s = b.flat(40);
    s.checkpoint(1);
    s.prompt('BUNKERS FIRE ONLY WHILE THE SLIT IS OPEN. SHOOT THEM THEN', 3, 24);
    b.barrage(s.x0 + 3, s.x1, { shell: true, period: 4.6, volley: 2, spread: 72, fuse: 1.4, first: 2.4 });
    s.enemy('bunker', 10);
    s.enemy('grenadier', 18);
    s.enemy('stormtrooper', 22);
    s.enemy('atgun', 32);
    s.enemy('garrison', 27);
    b.prop('sandbags', s.x0 + 17, { n: 3 });
    b.prop('sandbags', s.x0 + 30, { n: 3 });
    s.capsule('R', 6, 5);
    s.medals(24, 8, 3, 2);
    // a secret: a stair of ledges to a hidden 1UP above the wall
    const l1 = b.platform(s.x0 + 5, 7, 3);
    const l2 = b.platform(s.x0 + 9, 4, 3);
    b.addPickup('1up', l2.x0 + 1, 3);
    void l1;
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 8, 3);

    // --- 4. The bunker line ---
    s = b.flat(44);
    s.checkpoint(1);
    s.prompt('ANTI-TANK GUNS FIRE FLAT SHELLS. JUMP THEM OR LIE DOWN', 2, 24);
    s.enemy('bunker', 7);
    s.enemy('garrison', 13);
    const nest = b.platform(s.x0 + 16, 7, 6);
    b.addEnemy('bazooka', nest.x0 + 2, { row: 7 });
    b.addEnemy('grenadier', nest.x0 + 5, { row: 7 });
    s.enemy('atgun', 24);
    s.enemy('stormtrooper', 28);
    s.enemy('stormtrooper', 31);
    s.enemy('bunker', 36);
    s.enemy('fighter', 20, { row: 4 });
    s.capsule('B', 18, 4);
    s.medals(20, 5, 4, 2, 2);
    b.prop('wire', s.x0 + 26, { w: 40 });
    b.down(3);

    // --- 5. The motor pool: take a tank ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('A TANK! WALK INTO IT TO CLIMB IN. IT TAKES FOUR HITS AND CRUSHES INFANTRY', 1, 22);
    s.enemy('garrison', 9);
    b.prop('sandbags', s.x0 + 11, { n: 3 });

    // the tank road: flat sand from here to the ramp, with no pits or steps (the tank hops but cannot climb)
    const road0 = b.x;
    s = b.flat(30);
    s.enemy('stormtrooper', 10);
    s.enemy('stormtrooper', 13);
    s.enemy('garrison', 20);
    s.enemy('garrison', 25);
    s.prompt('FIRE THE CANNON WITH THE FIRE BUTTON. AIM IT UP WITH UP', 2, 24);
    b.prop('hedgehog', s.x0 + 6);
    b.prop('hedgehog', s.x0 + 16);
    s = b.flat(24);
    s.checkpoint(1);
    s.prompt('SHOOT MINES FROM A DISTANCE, OR HOP THEM', 2, 20);
    s.enemy('mine', 5);
    s.enemy('mine', 9);
    s.enemy('mine', 13);
    s.enemy('mine', 17);
    s.enemy('atgun', 21);
    s.enemy('grenadier', 11);
    b.barrage(s.x0 + 2, s.x1, { shell: true, period: 4.8, volley: 1, spread: 72, fuse: 1.5, first: 3.0 });
    s = b.flat(32);
    s.checkpoint(1);
    const ridge = b.platform(s.x0 + 6, 9, 8);
    b.addEnemy('bazooka', ridge.x0 + 1, { row: 9 });
    b.addEnemy('bazooka', ridge.x0 + 6, { row: 9 });
    s.enemy('bunker', 18);
    s.enemy('fighter', 16, { row: 4 });
    s.enemy('fighter', 24, { row: 5 });
    s.enemy('stormtrooper', 22);
    s.enemy('atgun', 29);
    s.capsule('H', 12, 5);
    b.prop('wire', s.x0 + 10, { w: 40 });
    s = b.flat(12);
    s.enemy('garrison', 4);
    s.enemy('stormtrooper', 8);
    b.tankRoad(road0, b.x);

    // --- 6. The ramp: on foot again, for the last gun line ---
    s = b.flat(36);
    s.checkpoint(1);
    s.prompt('ON FOOT AGAIN. THE SUPER-HEAVY TANK IS AHEAD. A SPARE TANK WAITS BY THE GATE', 2, 30);
    b.barrage(s.x0 + 3, s.x1, { shell: true, period: 4.4, volley: 2, spread: 72, fuse: 1.4, first: 2.0 });
    s.enemy('bunker', 10);
    s.enemy('grenadier', 16);
    s.enemy('bazooka', 22);
    s.enemy('stormtrooper', 26);
    s.capsule('E', 8, 6);
    s.medals(14, 10, 3, 2);
    s.pickup('tank', 31, b.gy);

    // --- 7. The Super-Heavy Tank ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('THE SUPER-HEAVY TANK! SHOOT THE GLOWING VISOR. IT SHUTS FOR CANNON AND MORTARS', 0, 14);
    s.capsule('B', 3, 6);
    b.bossArena('supertank');
    return b.finish();
  },
};
