// Level 13 - The Wild West: the Desert Train. Gunslingers fire two shots in a row, dynamiters lob sticks with a fizzing fuse,
// sharpshooters line up long shots (their aim takes a full second), and bandits hide in roof hatches until you step close.
// Then the train itself: the camera rolls on with the engine and you run its car roofs from the tail to the tender, across
// couplings you have to jump. The Armored Locomotive waits on the last roof.
//
// The country before the tracks is canyon land: 22-degree dunes, a mesa climbed at 45 degrees with a scree slide down its far side.
// The train itself (forced scroll, car roofs and couplings) and the locomotive's roof are level, as a train is.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

export const train = {
  name: 'DESERT TRAIN',
  era: 'THE WILD WEST',
  theme: 'train',
  seed: 113,
  music: 'wildwest',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 12 });

    // --- 1. The outpost: the first gunslingers, on the dunes outside it ---
    let s = b.flat(14);
    s.capsule('E', 6, 6);
    s.prompt('GUNSLINGERS FIRE TWO SHOTS IN A ROW. KEEP MOVING', 2, 24);
    b.prop('cactus', s.x0 + 10);
    b.slope(2, { angle: 22 });
    s = b.flat(10);
    s.enemy('gunslinger', 4);
    s.medalsAbove(1, 3, 2, 2);
    b.prop('cactus', s.x0 + 8);
    b.slope(-2, { angle: 22 });
    s = b.flat(14);
    s.enemy('gunslinger', 6);
    b.prop('pole', s.x0 + 10);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The water tower on its mesa: a 45-degree climb, dynamite and a sharpshooter, and a scree slide down the far side ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('DYNAMITE! WATCH THE THROWING ARM, THEN RUN CLEAR OF THE FUSE', 1, 24);
    s.enemy('bandit', 6);
    b.slope(4, { angle: 45 });
    s = b.flat(26);
    b.prop('tower', s.x0 + 14);
    s.enemy('dynamiter', 4);
    s.enemy('vulture', 12, { row: 5 });
    const ledge = b.platform(s.x0 + 18, b.gy - 4, 6);
    b.addEnemy('sharpshooter', ledge.x0 + 3, { row: b.gy - 4 });
    s.capsule('S', 8, b.rowAbove(8));
    s.medalsAbove(5, 4, 2, 2, 2);
    b.slope(-4, { angle: 67 });
    s = b.flat(12);
    s.enemy('gunslinger', 5);
    b.prop('cactus', s.x0 + 9);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, b.gy - 4, 3);

    // --- 3. The rail yard: a last rise, then down to the tracks ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('THE TRAIN IS PULLING OUT. JUMP ON AND RUN FOR THE ENGINE', 4, 18);
    b.prop('pole', s.x0 + 3);
    b.slope(1, { angle: 22 });
    b.flat(4);
    b.slope(-1, { angle: 22 });
    s = b.flat(14);
    s.enemy('sharpshooter', 3);
    s.enemy('bandit', 8);
    s.enemy('dynamiter', 12);
    b.pit(3, { fill: 'spikes' });

    // --- 4. The train: car after car, the camera rolling on with it (the cars, and the locomotive's roof, are plate metal) ---
    b.groundTile = T.WALL;
    const train0 = b.x;
    // a boxcar with two bandits in the roof hatches
    s = b.flat(18);
    s.prompt('BANDITS HIDE IN THE ROOF HATCHES. THEY POP OUT WHEN YOU GET CLOSE', 2, 14);
    b.prop('hatch', s.x0 + 6);
    b.prop('hatch', s.x0 + 12);
    s.enemy('bandit', 6);
    s.enemy('bandit', 12);
    s.enemy('gunslinger', 16);
    s.capsule('R', 8, 6);
    b.pit(3, { fill: 'spikes' });
    // a flatcar with a gatling gun behind sandbags
    s = b.flat(16);
    s.checkpoint(1);
    b.block(s.x0 + 3, 2, 1);
    s.enemy('gatling', 13);
    s.enemy('sharpshooter', 7);
    s.enemy('vulture', 10, { row: 5 });
    s.medals(4, 10, 4, 2);
    b.pit(4, { fill: 'spikes' });
    // a boxcar of dynamite throwers
    s = b.flat(18);
    b.prop('hatch', s.x0 + 5);
    b.prop('hatch', s.x0 + 11);
    b.prop('hatch', s.x0 + 15);
    s.enemy('bandit', 5);
    s.enemy('dynamiter', 9);
    s.enemy('bandit', 11);
    s.enemy('bandit', 15);
    s.capsule('M', 7, 6);
    b.pit(3, { fill: 'spikes' });
    // a cattle car with a raised walkway
    s = b.flat(16);
    s.checkpoint(1);
    const walk = b.platform(s.x0 + 5, 10, 8);
    b.addEnemy('gunslinger', walk.x0 + 2, { row: 10 });
    b.addEnemy('sharpshooter', walk.x0 + 6, { row: 10 });
    s.enemy('gunslinger', 3);
    s.enemy('vulture', 12, { row: 5 });
    b.pit(4, { fill: 'spikes' });
    // a boxcar, then the coal tender
    s = b.flat(18);
    b.prop('hatch', s.x0 + 4);
    b.prop('hatch', s.x0 + 10);
    s.enemy('bandit', 4);
    s.enemy('bandit', 10);
    s.enemy('gunslinger', 14);
    s.capsule('H', 9, 6);
    b.pit(3, { fill: 'spikes' });
    s = b.flat(16);
    s.checkpoint(1);
    b.block(s.x0 + 4, 3, 2); // the coal pile
    s.enemy('dynamiter', 7);
    s.enemy('dynamiter', 13);
    s.enemy('sharpshooter', 10);
    s.medals(5, 8, 4, 2, 2);
    s = b.flat(8);
    b.autoscroll(train0, b.x, 46);

    // --- 5. The Armored Locomotive ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('THE ARMORED LOCOMOTIVE! SHOOT THE SMOKEBOX DOOR WHILE IT GLOWS. STEAM SHUTS IT', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('locomotive');
    b.prop('pole', arena.x0 + 6, { h: 90 });
    return b.finish();
  },
};
