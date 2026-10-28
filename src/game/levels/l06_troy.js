// Level 6 - Ancient Greece: the Siege of Troy. A tower level: the whole stage is one screen wide and the way is up.
// Seventeen switchback floors climb the wall of the city; each has a four-tile hole at alternating ends, so every
// floor means a full walk across before the jump up. Shield-bearing hoplites block the way (their shields stop shots
// from the front: shoot down at them, jump them, or shoot from behind) and archers lob arrows down the shaft.
// The Bronze Colossus waits on the ramparts at the top.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

const ROWS = 72;
const GROUND = 68;
const ARENA_ROW = 14;
const FLOORS = 17;
const HOLE = 4; // width of the opening each floor leaves for the climb

const floorRow = (k) => GROUND - 3 - 3 * k;

export const troy = {
  name: 'SIEGE OF TROY',
  era: 'ANCIENT GREECE',
  theme: 'troy',
  seed: 106,
  music: 'troy',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 5 }, { rows: ROWS, gy: GROUND });
    b.flat(30);
    b.rect(0, 0, 2, GROUND, T.WALL);
    b.rect(28, 0, 2, GROUND, T.WALL);
    b.addPrompt('THE WAY IS UP. FIND EACH FLOOR\'S OPENING', 2, 26, { rows: [GROUND - 14, GROUND + 1] });
    b.addPrompt('SHIELDS BLOCK SHOTS FROM THE FRONT. SHOOT DOWN AT THEM', 2, 26, { rows: [GROUND - 34, GROUND - 14] });

    for (let k = 0; k < FLOORS; k++) {
      const row = floorRow(k);
      const holeLeft = k % 2 === 0;
      // the floor spans the shaft except for its hole (cols 2..27 are the inside of the tower)
      const a = holeLeft ? 2 + HOLE : 2;
      const z = holeLeft ? 28 : 28 - HOLE;
      b.platform(a, row, z - a, { kind: 'solid' });

      if (k === FLOORS - 1) {
        // the last floor sits right under the arena: only the strip below the one-way entry has headroom
        b.addEnemy('hoplite', 12, { row });
        b.addEnemy('archer', 9, { row });
        continue;
      }
      switch (k % 4) {
        case 0:
          b.addEnemy('hoplite', a + 10, { row });
          break;
        case 1:
          b.addEnemy('hoplite', a + 6, { row });
          b.addEnemy('archer', a + 17, { row });
          break;
        case 2:
          b.addEnemy('hoplite', a + 5, { row });
          b.addEnemy('hoplite', a + 14, { row });
          if (k >= 8) b.addEnemy('trooper', a + 19, { row });
          break;
        default:
          b.addEnemy('archer', a + 8, { row });
          b.addEnemy('hoplite', a + 16, { row });
          b.addEnemy('drone', a + 11, { row: row - 1 });
      }
      if (k % 2 === 0) for (let i = 0; i < 3; i++) b.addPickup('medal', a + 8 + i * 2, row - 1);
    }

    // weapons along the climb: capsules fly across the shaft
    const capRow = (k) => floorRow(k) - 1; // capsules fly along the two-row corridor above a floor
    b.addCapsule('E', 27, capRow(1));
    b.addCapsule('S', 27, capRow(5));
    b.addCapsule('M', 27, capRow(8));
    b.addCapsule('B', 27, capRow(11));
    b.addCapsule('H', 27, capRow(15));
    b.addPickup('bomb', 12, floorRow(10) - 1);
    b.addEnemy('pod', 14, { row: floorRow(12), item: 'E' });
    b.addCheckpoint(8, floorRow(4));
    b.addCheckpoint(6, floorRow(9));
    b.addCheckpoint(6, floorRow(13));

    // the ramparts: the last floor opens into the arena through a one-way strip
    b.bossArenaAt('colossus', ARENA_ROW, { entry: [2, 16] });
    return b.finish();
  },
};
