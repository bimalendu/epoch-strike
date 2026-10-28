// Level 13 - The Wild West: the Desert Train. Gunslingers fire two shots in a row, dynamiters lob sticks with a fizzing fuse,
// sharpshooters line up long shots (their aim takes a full second), and bandits hide in roof hatches until you step close.
// Then the train itself: the camera rolls on with the engine and you run its car roofs from the tail to the tender, across
// couplings you have to jump. The Armored Locomotive waits on the last roof.

import { LevelBuilder } from '../levelgen.js';

export const train = {
  name: 'DESERT TRAIN',
  era: 'THE WILD WEST',
  theme: 'train',
  seed: 113,
  music: 'wildwest',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 12 });

    // --- 1. The outpost: the first gunslingers ---
    let s = b.flat(38);
    s.capsule('E', 6, 6);
    s.prompt('GUNSLINGERS FIRE TWO SHOTS IN A ROW. KEEP MOVING', 2, 24);
    s.enemy('gunslinger', 18);
    s.enemy('gunslinger', 30);
    s.medals(8, 11, 3, 2);
    b.prop('cactus', s.x0 + 10);
    b.prop('cactus', s.x0 + 24);
    b.prop('pole', s.x0 + 34);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The water tower: dynamite and a sharpshooter ---
    s = b.flat(42);
    s.checkpoint(1);
    s.prompt('DYNAMITE! WATCH THE THROWING ARM, THEN RUN CLEAR OF THE FUSE', 1, 24);
    b.prop('tower', s.x0 + 20);
    s.enemy('bandit', 8);
    s.enemy('dynamiter', 14);
    s.enemy('vulture', 22, { row: 5 });
    const ledge = b.platform(s.x0 + 27, 10, 6);
    b.addEnemy('sharpshooter', ledge.x0 + 3, { row: 10 });
    s.enemy('gunslinger', 36);
    s.capsule('S', 12, 6);
    s.medals(22, 8, 4, 2);
    b.prop('cactus', s.x0 + 38);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 10, 3);

    // --- 3. The rail yard ---
    s = b.flat(24);
    s.checkpoint(1);
    s.prompt('THE TRAIN IS PULLING OUT. JUMP ON AND RUN FOR THE ENGINE', 4, 18);
    s.enemy('sharpshooter', 9);
    s.enemy('bandit', 15);
    s.enemy('dynamiter', 20);
    b.prop('pole', s.x0 + 3);
    b.pit(3, { fill: 'spikes' });

    // --- 4. The train: car after car, the camera rolling on with it ---
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
