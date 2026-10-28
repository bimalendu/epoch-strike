// Level 3 - Ice Age: Frozen Glacier. Slippery ice floors, icicles that drop when you walk under them, ice cannons
// and sabre-tooth packs, ending in the Mammoth Walker's frozen arena.
//
// The land is a glacier's: snow-covered moraine hills at 22 and 45 degrees, crevasses, seracs (blocks of ice standing on the snow) and a
// steep snow slide down the end of the serac field. The ice itself stays flat, because a slope is not slippery and a slippery slope
// is not a puzzle: slopes are snow, and the long ice floors are level.

import { LevelBuilder } from '../levelgen.js';
import { T } from '../tiles.js';

const SHELF_ROW = 3;
const ICICLE_TIP = (SHELF_ROW + 1) * 16 + 22; // pixels: hangs just under the shelf

export const frozenGlacier = {
  name: 'FROZEN GLACIER',
  era: 'ICE AGE',
  theme: 'glacier',
  seed: 103,
  music: 'glacier',
  bulletScale: 0.95,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 2 });
    const icicles = (seg, dxs) => {
      b.platform(seg.x0 + dxs[0] - 2, SHELF_ROW, dxs[dxs.length - 1] - dxs[0] + 5, { kind: 'solid', tile: T.ICE });
      for (const dx of dxs) seg.spawn({ type: 'icicle', y: ICICLE_TIP }, dx);
    };

    // --- 1. Snowfield: moraine hills, a serac or two, and a crevasse ---
    let s = b.flat(14);
    s.enemy('sabre', 12);
    s.capsule('S', 4, 6);
    b.block(s.x0 + 8, 2, 2, T.ICE); // a serac to hop over
    b.slope(1, { angle: 22 });
    s = b.flat(6);
    s.medalsAbove(0, 3, 2, 2);
    b.slope(-1, { angle: 22 });
    s = b.flat(6);
    s.enemy('sabre', 4);
    b.pit(3);

    // --- 2. The ice slide ---
    s = b.flat(8);
    s.prompt('ICE: YOU WILL SLIDE', 0, 12);
    s = b.flat(52, { tile: T.ICE });
    icicles(s, [10, 13, 16, 19]);
    s.enemy('icecannon', 28).enemy('icecannon', 40);
    s.enemy('sabre', 24);
    s.capsule('R', 8, 6);
    s.medals(30, 10, 4, 2, 2);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(14);
    s.checkpoint(1);
    s.enemy('sabre', 6).enemy('sabre', 9);
    s.enemy('drone', 11, { row: 8 });

    // --- 3. Glacier steps: up the snow onto the ice tongue, then up again and down a long 45-degree moraine ---
    b.slope(2, { angle: 45 });
    s = b.flat(16, { tile: T.ICE });
    icicles(s, [4, 7, 10]);
    s.enemy('icecannon', 12);
    b.slope(1, { angle: 22 });
    s = b.flat(12);
    s.enemy('sabre', 5).enemy('sabre', 8);
    s.capsule('M', 4, 5);
    s.capsule('E', 9, 6);
    b.slope(-3, { angle: 45 });

    // --- 4. Frozen ford ---
    s = b.flat(8);
    b.pit(5, { fill: 'water' });
    s = b.flat(10);
    s.enemy('drone', 3, { row: 8 }).enemy('striker', 8, { row: 6 });
    b.pit(5, { fill: 'water' });

    // --- 5. Cannon ridge, a crevasse, and the serac field with its steep snow slide ---
    s = b.flat(46, { tile: T.ICE });
    s.checkpoint(1);
    icicles(s, [8, 11, 14]);
    icicles(s, [30, 33, 36]);
    s.enemy('icecannon', 18).enemy('icecannon', 26);
    s.enemy('sabre', 20).enemy('sabre', 23);
    s.enemy('striker', 24, { row: 6 });
    s.capsule('B', 5, 6);
    b.pit(3);
    b.flat(4);
    b.slope(2, { angle: 45 });
    s = b.flat(10);
    s.enemy('pod', 5, { item: 'L' });
    s.enemy('trooper', 8);
    b.block(s.x0 + 1, 2, 1, T.ICE);
    b.slope(-2, { angle: 67 }); // the steep snow slide down the end of the serac field

    // --- 6. Approach and arena: the Mammoth Walker (on ice) ---
    s = b.flat(20);
    s.prompt('THE ICE TREMBLES...', 4, 14);
    s.pickup('bomb', 8, 11);
    s.capsule('S', 12, 7);
    b.groundTile = T.ICE;
    b.bossArena('mammoth');
    return b.finish();
  },
};
