// Level 6 - Ancient Greece: the Siege of Troy. A hillside assault: the army lands on the shore and climbs the slopes below the
// city, through olive terraces and a ravine, up to the foot of the wall, over the rampart and down into the courtyard where the
// Bronze Colossus waits. Shield-bearing hoplites block the way (their shields stop shots from the front: shoot down at them from
// above, jump them, or shoot from behind) and archers lob arrows down the hill from the terraces above.
//
// The hill is the level: gentle 22-degree slopes through the olive groves, a 45-degree climb to the first terrace, a scree
// slide down into the siege trench, and the long climb to the wall. The arena at the end is level, as every boss arena is.

import { LevelBuilder } from '../levelgen.js';

export const troy = {
  name: 'SIEGE OF TROY',
  era: 'ANCIENT GREECE',
  theme: 'troy',
  seed: 106,
  music: 'troy',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 5 });
    const shore = b.gy; // the ground row of the beach and the courtyard

    // --- 1. The beachhead: hoplites hold the shore ---
    let s = b.flat(26);
    s.prompt('THE WALLS OF TROY. THE WAY IS UP THE HILL', 2, 20);
    s.capsule('E', 8, 6);
    s.enemy('hoplite', 14).enemy('hoplite', 19);
    s.medals(8, 11, 3, 2);
    b.slope(1, { angle: 22 });

    // --- 2. Olive groves: gentle slopes, one terrace above another ---
    s = b.flat(8);
    s.enemy('hoplite', 3).enemy('hoplite', 6);
    b.slope(1, { angle: 22 });
    s = b.flat(12);
    s.prompt('SHIELDS BLOCK SHOTS FROM THE FRONT. SHOOT DOWN AT THEM', 2, 22);
    s.enemy('hoplite', 5).enemy('hoplite', 9);
    s.enemy('archer', 11);
    s.capsule('S', 4, b.rowAbove(8));
    s.medalsAbove(2, 3, 2, 2);

    // --- Skirmish line: a stream between two olive banks ---
    b.flat(8);
    b.slope(1, { angle: 22 });
    b.flat(4);
    b.slope(-1, { angle: 22 });
    b.flat(3);
    b.pit(4, { fill: 'water' });
    b.flat(6);

    // --- 3. The first terrace: a 45-degree climb, archers watching from the top ---
    b.slope(2, { angle: 45 });
    s = b.flat(14);
    s.enemy('archer', 3).enemy('archer', 10);
    s.enemy('hoplite', 6).enemy('hoplite', 12);
    s.enemy('drone', 8, { row: b.rowAbove(7) });
    s.medalsAbove(1, 3, 2, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 4. The siege trench: slide down the scree, then fight on the floor of the ditch ---
    s = b.flat(6);
    s.enemy('hoplite', 3);
    b.slope(-2, { angle: 67 });
    s = b.flat(14);
    s.checkpoint(1);
    s.enemy('hoplite', 4).enemy('hoplite', 8).enemy('hoplite', 11);
    s.enemy('archer', 13);
    s.enemy('drone', 9, { row: b.rowAbove(6) });
    s.capsule('M', 6, b.rowAbove(8));
    s.medalsAbove(3, 3, 2, 2, 2);

    // --- Switchbacks: the goat track doubles back up the slope ---
    b.flat(4);
    b.slope(1, { angle: 45 });
    b.flat(6);
    b.slope(-1, { angle: 45 });
    b.flat(4);
    b.slope(1, { angle: 22 });
    b.flat(5);
    b.slope(-1, { angle: 22 });
    b.flat(6);

    // --- 5. The long climb: a 45-degree slope and a gentle one up to the foot of the wall ---
    b.slope(2, { angle: 45 });
    s = b.flat(6);
    s.enemy('hoplite', 3);
    b.slope(1, { angle: 22 });
    s = b.flat(16);
    s.enemy('hoplite', 4).enemy('hoplite', 8);
    s.enemy('archer', 6).enemy('archer', 12);
    s.enemy('drone', 10, { row: b.rowAbove(7) });
    s.capsule('B', 3, b.rowAbove(6));
    s.pickup('bomb', 13, b.gy - 2);
    s.medalsAbove(7, 3, 2, 2);

    // --- 6. The foot of the wall: a battered scarp of stone to climb, and the rampart over it ---
    s = b.flat(8);
    s.enemy('pod', 5, { item: 'E' });
    s.enemy('trooper', 2);
    b.slope(1, { angle: 45 });
    s = b.flat(10);
    s.checkpoint(1);
    s.enemy('hoplite', 4).enemy('hoplite', 7);
    s.enemy('archer', 9);
    s.medalsAbove(1, 3, 2, 2, 2);
    b.slope(1, { angle: 22 });

    // --- 7. The rampart: hoplites hold the wall-walk, the way down is the ramp into the courtyard ---
    s = b.flat(22);
    s.enemy('hoplite', 4).enemy('hoplite', 9).enemy('hoplite', 13);
    s.enemy('archer', 7).enemy('archer', 17);
    s.enemy('drone', 12, { row: b.rowAbove(4) });
    s.enemy('trooper', 19);
    s.medalsAbove(2, 3, 2, 2);
    b.slope(b.gy - shore, { angle: 45 }); // down the ramp from the wall-walk to the courtyard

    // --- Inside the gate: a wall-walk of broken steps ---
    b.flat(6);
    b.slope(2, { angle: 22 });
    b.flat(6);
    b.slope(-2, { angle: 22 });
    b.flat(4);
    b.pit(3, { fill: 'spikes' });
    b.flat(8);

    // --- 8. The courtyard and the Bronze Colossus ---
    s = b.flat(18);
    s.checkpoint(1);
    s.prompt('THE BRONZE COLOSSUS STIRS...', 2, 14);
    s.enemy('hoplite', 10);
    s.capsule('H', 8, 7);
    s.medals(3, 11, 3, 2);
    const arena = b.bossArena('colossus');
    b.platform(arena.x0 + 6, 11, 5);
    b.platform(arena.x1 - 11, 11, 5);
    return b.finish();
  },
};
