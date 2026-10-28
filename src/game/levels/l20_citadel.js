// Level 20 - The End of Time: the Warlord's Citadel. The Rift has dragged soldiers from every age into the Warlord's
// citadel: dinosaurs and legionaries, samurai and gunslingers, cyborgs and sentinels. Fight through the Rift Gate and the
// Hall of Ages, then climb the Rift Stair: three ECHOES of old guardians (REX-7, the Bronze Colossus and the Super-Heavy
// Tank, each a faster fight than the original) guard it in turn. Beyond them waits the Rift Warlord. The era's weapon is
// the Plasma Cannon.
//
// The citadel stands on a broken crag: 22-degree rises and a 45-degree climb at the gate with a scree slide down the rift's edge, and
// terraces up the Hall of Ages. The rift bridge, the three echo arenas on the stair and the Warlord's arena are level.

import { LevelBuilder } from '../levelgen.js';

export const citadel = {
  name: 'WARLORD CITADEL',
  era: 'THE END OF TIME',
  theme: 'citadel',
  seed: 120,
  music: 'citadel',
  bossMusic: 'finale',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 19 });

    // --- 1. The Rift Gate: raiders from every age, on the broken crag below the citadel ---
    let s = b.flat(12);
    s.capsule('E', 8, 6);
    s.prompt('THE RIFT HAS DRAGGED EVERY AGE INTO THE CITADEL. THE PLASMA CANNON IS YOURS AGAIN', 4, 34);
    b.prop('banner', s.x0 + 10, { col: '#ff4aa8' });
    b.slope(2, { angle: 22 });
    s = b.flat(10);
    s.enemy('raptor', 3);
    s.enemy('hoplite', 7);
    s.medalsAbove(1, 3, 2, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(10);
    s.enemy('gunslinger', 4);
    s.enemy('cyborg', 8);
    b.prop('banner', s.x0 + 6, { col: '#ff4aa8' });
    b.slope(3, { angle: 45 });
    s = b.flat(6);
    s.enemy('knight', 3);
    b.slope(-2, { angle: 67 }); // a scree slide down the rift's broken edge
    b.slope(-1, { angle: 45 });
    b.flat(6);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The Hall of Ages: four alcoves, four eras, on terraces up the citadel's flank ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('THE HALL OF AGES. EVERY ALCOVE HOLDS A DIFFERENT WAR', 2, 28);
    s.enemy('spitter', 4);
    s.enemy('raptor', 7);
    b.slope(2, { angle: 22 });
    s = b.flat(26);
    const deck1 = b.platform(s.x0 + 1, b.gy - 4, 8);
    b.addEnemy('archer', deck1.x0 + 3, { row: b.gy - 4 });
    b.addEnemy('crossbowman', deck1.x0 + 6, { row: b.gy - 4 });
    s.enemy('samurai', 10);
    s.enemy('ninja', 14);
    s.enemy('bayonet', 18);
    s.enemy('flamer', 21);
    s.capsule('S', 6, b.rowAbove(8));
    s.medalsAbove(12, 4, 2, 2, 2);
    b.slope(-2, { angle: 45 });
    s = b.flat(24);
    const deck2 = b.platform(s.x0 + 2, b.gy - 4, 8);
    b.addEnemy('sniperbot', deck2.x0 + 4, { row: b.gy - 4 });
    s.enemy('stormtrooper', 12);
    s.enemy('cyberhound', 16);
    s.enemy('sentinel', 21);
    b.pit(4, { fill: 'spikes' });

    // --- 3. The Rift Bridge: gaps in the floor with the sky full of machines ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('THE FLOOR TEARS OPEN OVER THE VOID. JUMP THE GAPS AND SHOOT THE FLYERS', 1, 28);
    s.enemy('hunter', 8, { row: 5 });
    s.enemy('cyborg', 12);
    b.pit(5, { fill: 'spikes' });
    s = b.flat(12);
    s.enemy('recon', 5, { row: 6 });
    s.enemy('gunchopper', 9, { row: 4 });
    b.pit(5, { fill: 'spikes' });
    s = b.flat(14);
    s.enemy('hunter', 4, { row: 5 });
    s.enemy('fighter', 8, { row: 4 });
    s.enemy('guard', 11);
    s.capsule('B', 3, 6);
    b.pit(4, { fill: 'spikes' });
    s = b.flat(32);
    s.checkpoint(1);
    s.enemy('terracotta', 6);
    s.enemy('sentinel', 14);
    s.enemy('cyborg', 20);
    s.enemy('cyberhound', 25);
    s.enemy('ninja', 29);
    s.capsule('E', 4, 6);
    s.medals(10, 10, 3, 2);

    // --- 4. The Rift Stair: three echoes of old guardians ---
    s = b.flat(18);
    s.checkpoint(1);
    s.prompt('THE RIFT STAIR. THREE ECHOES OF OLD GUARDIANS HOLD IT, EACH A FASTER FIGHT THAN THE ORIGINAL', 1, 38);
    s.capsule('E', 6, 6);
    s.capsule('S', 12, 6);
    b.echoArena('echo_trex', { hp: 40 });
    s = b.flat(14);
    s.prompt('ECHO BROKEN. THE NEXT ONE WAITS AHEAD', 1, 28);
    s.capsule('E', 5, 6);
    s.enemy('raptor', 9);
    b.echoArena('echo_colossus', { hp: 60 });
    s = b.flat(14);
    s.capsule('E', 5, 6);
    s.capsule('B', 9, 6);
    s.enemy('stormtrooper', 10);
    b.echoArena('echo_supertank', { hp: 64 });

    // --- 5. The Warlord ---
    s = b.flat(22);
    s.checkpoint(1);
    s.prompt('THE RIFT WARLORD! ITS HEART IS ARMOURED EXCEPT WHEN IT HAS SPENT AN ATTACK. SHOOT THE HEART', 1, 40);
    s.capsule('E', 6, 6);
    s.capsule('R', 12, 6);
    s.capsule('B', 16, 6);
    b.prop('banner', s.x0 + 5, { col: '#ff4aa8' });
    const arena = b.bossArena('warlord');
    b.prop('banner', arena.x0 + 2, { col: '#ff4aa8' });
    return b.finish();
  },
};
