// Level 19 - The Cyber Age: the Cyber Megacity. The city has become a machine. Ceiling guns hang under the skyway slabs,
// robot hounds sprint down the data streets and sentinels walk the avenues. Two gravity halls flip the world: you fall up,
// walk along the ceiling over a floor of spikes (orb mines drift through the dark) and fall back down at the far end. Then
// a hoverbike: you ride the skyway in free flight with the camera rolling on, dodging laser emitters, hover-bikers and
// mines, and set down in front of the AI Core Hydra. The era's weapon is the Plasma Cannon.
//
// The megastructure has tiers: a 45-degree ramp up to the first, a steep maintenance chute down from it, and another ramp up to the
// server decks. The skyway slabs, the gravity halls (the world flips, so the floor must be flat) and the hoverbike run are level.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';
import { TILE } from '../constants.js';

export const cyberCity = {
  name: 'CYBER MEGACITY',
  era: 'THE CYBER AGE',
  theme: 'megacity',
  seed: 119,
  music: 'cyber',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 18 });

    // --- 1. The data streets: a ramp up to the first tier, and a maintenance chute down the far side ---
    let s = b.flat(12);
    s.capsule('E', 8, 6);
    s.prompt('CYBER-HOUNDS SPRINT AT YOU AND LEAP. SENTINELS ARE ARMOURED: SHOOT THE GLOWING CORE', 4, 34);
    b.prop('serverstack', s.x0 + 8);
    b.slope(2, { angle: 45 });
    s = b.flat(16);
    s.enemy('cyberhound', 4);
    s.enemy('cyborg', 10);
    b.prop('neonsign', s.x0 + 8, { col: '#4af0ff' });
    s.medalsAbove(3, 3, 2, 2);
    b.slope(-2, { angle: 67 });
    s = b.flat(20);
    s.enemy('sentinel', 6);
    s.enemy('cyberhound', 14);
    b.prop('serverstack', s.x0 + 14, { h: 80 });
    b.pit(3, { fill: 'spikes' });

    // --- 2. The skyway slabs: ceiling guns ---
    s = b.flat(46);
    s.checkpoint(1);
    s.prompt('CEILING GUNS HANG UNDER THE SLABS. SHOOT THEM OR RUN UNDER THEM', 2, 30);
    // a floating slab, 144 px above the street, with guns hung from its underside
    const slab0 = s.x0 + 10;
    b.rect(slab0, 7, 28, 2, T.SOLID);
    const slabBottom = 9 * TILE;
    for (const c of [13, 20, 27, 34]) b.addSpawn({ type: 'ceilgun', x: (s.x0 + c) * TILE + TILE / 2, y: slabBottom + 14, gdir: -1, face: -1 });
    s.enemy('cyberhound', 16);
    s.enemy('cyborg', 30);
    s.enemy('cyborg', 41);
    s.capsule('S', 6, 6);
    s.medals(18, 11, 4, 2);

    // --- 3. The first gravity hall ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('A GRAVITY HALL! YOU FALL UP AND WALK ALONG THE CEILING. THE FLOOR IS SPIKES. AIM STILL FOLLOWS THE SCREEN', 1, 34);
    s.enemy('cyberhound', 9);
    const hall = b.flipHall(18);
    hall.enemy('orbmine', 11, { row: 8 });
    hall.enemy('orbmine', 16, { row: 8 });
    s = b.flat(12);
    s.checkpoint(1);
    s.enemy('cyborg', 6);
    s.enemy('cyberhound', 10);

    // --- 4. The server canyon: a 45-degree ramp up to the deck tier, and a gentle way down ---
    s = b.flat(8);
    s.prompt('MORE SENTINELS. THE ARMOUR SHRUGS OFF EVERYTHING BUT THE CORE', 2, 28);
    b.prop('serverstack', s.x0 + 4, { h: 90 });
    b.slope(3, { angle: 45 });
    s = b.flat(20);
    const deck = b.platform(s.x0 + 2, b.gy - 4, 10);
    b.addEnemy('cyborg', deck.x0 + 3, { row: b.gy - 4 });
    b.addEnemy('cyborg', deck.x0 + 7, { row: b.gy - 4 });
    b.prop('serverstack', s.x0 + 14);
    s.enemy('sentinel', 12);
    s.capsule('B', 8, b.rowAbove(8));
    s.medalsAbove(14, 3, 2, 2);
    b.slope(-3, { angle: 22 });
    s = b.flat(10);
    s.enemy('cyberhound', 3);
    s.enemy('cyborg', 7);

    // --- 5. The second gravity hall, longer ---
    s = b.flat(12);
    s.checkpoint(1);
    s.enemy('cyberhound', 8);
    const hall2 = b.flipHall(22);
    hall2.enemy('orbmine', 9, { row: 8 });
    hall2.enemy('orbmine', 14, { row: 8 });
    hall2.enemy('orbmine', 19, { row: 8 });
    s = b.flat(14);
    s.checkpoint(1);
    s.capsule('R', 6, 6);
    s.enemy('cyborg', 9);

    // --- 6. The hoverbike skyway ---
    s = b.flat(10);
    s.prompt('A HOVERBIKE! FLY WITH THE STICK, SHOOT, AND DODGE THE LASERS. YOU HAVE TWO HITS OF ARMOUR', 1, 34);
    b.prop('hoverpad', s.x0 + 5);
    const run = b.hoverRun(112, { speed: 56 });
    const c = (dx) => run.x0 + dx;
    // laser emitters: from the ceiling and from the road, never both in the same beat
    b.beam(c(18), { from: 'top', length: 104, period: 3.6, phase: 1.0 });
    b.beam(c(30), { from: 'floor', length: 100, period: 3.6, phase: 2.8 });
    b.beam(c(42), { from: 'top', length: 104, period: 3.6, phase: 1.0 });
    b.beam(c(54), { from: 'floor', length: 100, period: 3.6, phase: 2.8 });
    b.beam(c(66), { from: 'top', length: 104, period: 3.6, phase: 1.0 });
    b.beam(c(78), { from: 'floor', length: 100, period: 3.6, phase: 2.8 });
    b.beam(c(90), { from: 'top', length: 104, period: 3.6, phase: 1.0 });
    b.beam(c(100), { from: 'floor', length: 100, period: 3.6, phase: 2.8 });
    run.enemy('hunter', 12, { row: 4 });
    run.enemy('hoverbiker', 20, { row: 6 });
    run.enemy('orbmine', 26, { row: 8 });
    run.enemy('hunter', 34, { row: 5 });
    run.enemy('hoverbiker', 38, { row: 5 });
    run.enemy('gunchopper', 48, { row: 4 });
    run.enemy('orbmine', 52, { row: 7 });
    run.enemy('hoverbiker', 60, { row: 7 });
    run.enemy('hunter', 64, { row: 4 });
    run.enemy('gunchopper', 72, { row: 5 });
    run.enemy('orbmine', 76, { row: 8 });
    run.enemy('hoverbiker', 84, { row: 6 });
    run.enemy('hunter', 90, { row: 5 });
    run.enemy('hoverbiker', 98, { row: 5 });
    run.capsule('S', 14, 6);
    run.capsule('E', 56, 6);
    run.capsule('B', 86, 6);

    // --- 7. Touchdown ---
    s = b.flat(26);
    s.checkpoint(1);
    s.prompt('ON FOOT AGAIN. THE AI CORE HYDRA IS AHEAD', 1, 22);
    s.enemy('cyberhound', 10);
    s.enemy('sentinel', 18);
    s.enemy('cyborg', 22);
    s.capsule('E', 6, 6);
    s.medals(8, 9, 3, 2);

    // --- 8. The AI Core Hydra ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('THE AI CORE HYDRA! SHOOT THE EYE IN ITS CHEST. THE HEADS SLAM DOWN AND STICK: HIT THEM TOO', 0, 14);
    s.capsule('B', 3, 6);
    const arena = b.bossArena('hydra');
    b.prop('serverstack', arena.x0 + 2, { h: 80 });
    return b.finish();
  },
};
