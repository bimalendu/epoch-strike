// Level 15 - The First World War: the Trench Line. Bayonet charges and rifle fire from the sandbags, flamethrowers that
// only reach a short way, mortars lobbing shells, and across no man's land the artillery lays down GAS: a mark shows where
// each shell lands and the cloud lingers for a few seconds, so get out of it or over it. Biplanes strafe and bomb in
// passing. The War Zeppelin hangs over the last trench.
//
// The ground is shell-torn: 22-degree rises behind the wire, crater rims climbed at 45 degrees, and scree where a parapet has
// collapsed. The gas-barrage fields (a shell needs level ground to land on) and the last trench are level.

import { LevelBuilder } from '../levelgen.js';

export const trench = {
  name: 'TRENCH LINE',
  era: 'THE FIRST WORLD WAR',
  theme: 'trench',
  seed: 115,
  music: 'trench',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 14 });

    // --- 1. The front line: the first bayonets, on the shell-torn rise behind the wire ---
    let s = b.flat(12);
    s.capsule('E', 6, 6);
    s.prompt('BAYONET CHARGES! SHOOT THEM BEFORE THEY GET CLOSE', 2, 22);
    b.block(s.x0 + 9, 2, 1);
    b.slope(2, { angle: 22 });
    s = b.flat(8);
    s.enemy('bayonet', 4);
    s.medalsAbove(1, 3, 2, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(14);
    b.block(s.x0 + 3, 2, 1);
    s.enemy('infantry', 9);
    b.pit(3, { fill: 'spikes' }); // barbed wire

    // --- 2. No man's land: a crater rim to cross, then the first gas shells ---
    b.flat(4);
    b.slope(2, { angle: 45 });
    b.flat(3);
    b.slope(-2, { angle: 45 });
    s = b.flat(46);
    s.checkpoint(1);
    s.prompt('GAS SHELLS! A MARK SHOWS WHERE ONE LANDS. LEAVE THE CLOUD OR JUMP IT', 2, 28);
    b.barrage(s.x0 + 3, s.x1, { gas: true, period: 4.2, volley: 2, spread: 70, fuse: 1.4, first: 1.8, linger: 3.2 });
    s.enemy('infantry', 12);
    s.enemy('mortar', 20);
    s.enemy('bayonet', 27);
    s.enemy('biplane', 30, { row: 4 });
    s.enemy('infantry', 38);
    s.capsule('S', 14, 6);
    s.medals(24, 10, 4, 2, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 3. The enemy trench: the parapet has collapsed in a scree slide, then flamethrowers ---
    b.flat(4);
    b.slope(2, { angle: 45 });
    b.flat(3);
    b.slope(-2, { angle: 67 });
    b.flat(2);
    b.down(2);
    s = b.flat(34);
    s.checkpoint(1);
    s.prompt('FLAMETHROWERS ONLY REACH A SHORT WAY. KEEP YOUR DISTANCE AND SHOOT', 2, 22);
    s.enemy('bayonet', 6);
    s.enemy('flamer', 12);
    b.block(s.x0 + 16, 2, 1);
    s.enemy('flamer', 22);
    s.enemy('infantry', 29);
    s.capsule('R', 10, 6);
    b.up(2);

    // --- 4. The second field: biplanes and a firing step ---
    s = b.flat(34);
    s.checkpoint(1);
    s.prompt('BIPLANES DROP BOMBS AS THEY PASS OVERHEAD. SHOOT THEM DOWN OR RUN CLEAR', 2, 24);
    b.barrage(s.x0 + 3, s.x1, { gas: true, period: 4.6, volley: 2, spread: 76, fuse: 1.4, first: 2.2, linger: 3.0 });
    const step = b.platform(s.x0 + 8, 10, 6);
    b.addEnemy('infantry', step.x0 + 1, { row: 10 });
    b.addEnemy('infantry', step.x0 + 4, { row: 10 });
    s.enemy('bayonet', 16);
    s.enemy('biplane', 20, { row: 4 });
    s.enemy('biplane', 26, { row: 5 });
    s.enemy('mortar', 30);
    s.medals(10, 8, 4, 2);
    b.pit(5, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);

    // --- 4b. The communication trench: a gauntlet of flames under the guns ---
    b.down(2);
    s = b.flat(30);
    s.checkpoint(1);
    s.enemy('bayonet', 5);
    s.enemy('flamer', 10);
    s.enemy('infantry', 15);
    b.block(s.x0 + 18, 2, 1);
    s.enemy('bayonet', 22);
    s.enemy('flamer', 26);
    s.capsule('M', 8, 6);
    b.up(2);
    s = b.flat(10);
    s.enemy('mortar', 6);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);

    // --- 5. The bunker line, on a low ridge above the trenches ---
    s = b.flat(10);
    s.checkpoint(1);
    s.enemy('infantry', 6);
    b.slope(2, { angle: 22 });
    s = b.flat(14);
    s.enemy('bayonet', 3);
    s.enemy('bayonet', 7);
    s.enemy('mortar', 11);
    s.capsule('H', 6, b.rowAbove(7));
    s.medalsAbove(2, 4, 2, 2, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(18);
    s.enemy('flamer', 4);
    s.enemy('infantry', 10);
    s.enemy('mortar', 15);
    b.block(s.x0 + 12, 2, 1);

    // --- 6. The War Zeppelin ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('THE WAR ZEPPELIN! STAND UNDER THE GONDOLA AND FIRE UP. WATCH THE SKY', 1, 14);
    s.capsule('B', 7, 6);
    b.bossArena('zeppelin');
    return b.finish();
  },
};
