// Level 17 - The Cold War: the Arctic Missile Base. A fenced compound on the ice. Searchlight towers sweep pools of light
// along the road: a soldier who lingers in the light sets off the alarm (guards wake, every gun reloads faster and snow
// troopers run in from both sides), but a quick dash, a crate or a high walkway keeps you in the dark. Sleeping guards
// stand quietly until the alarm, a shot, or you walking up to them: the catwalks overhead let you slip past. Snowmobiles
// thunder across the screen, SAM sites lob missiles, and at the end the Missile Silo Mech lumbers out of its silo.
// The era's weapon is the Plasma Cannon.

import { LevelBuilder } from '../levelgen.js';

export const missileBase = {
  name: 'ARCTIC MISSILE BASE',
  era: 'THE COLD WAR',
  theme: 'arctic',
  seed: 117,
  music: 'coldwar',
  bulletScale: 1.0,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 16 });

    // --- 1. The perimeter: the first searchlight ---
    let s = b.flat(48);
    s.capsule('E', 8, 6);
    b.prop('radar', s.x0 + 42, { h: 96 });
    s.prompt('A SEARCHLIGHT! STAY OUT OF THE LIGHT OR THE ALARM RINGS. CRATES CAST SHADOWS', 4, 30);
    b.searchlight(s.x0 + 16, s.x0 + 38, { tower: s.x0 + 27, height: 9, period: 7 });
    b.block(s.x0 + 22, 2, 2); // crates to duck behind
    b.block(s.x0 + 33, 2, 2);
    s.enemy('guard', 18);
    s.enemy('snowtrooper', 30);
    s.enemy('recon', 26, { row: 6 });
    s.medals(12, 10, 3, 2);
    b.pit(3, { fill: 'spikes' }); // an ice crevasse

    // --- 2. The sleeping guards: a low road past them, a high road over them ---
    s = b.flat(44);
    s.checkpoint(1);
    s.prompt('THE GUARDS ARE ASLEEP. TAKE THE WALKWAY OVER THEIR HEADS, OR SHOOT FIRST AND BE QUICK', 2, 32);
    b.prop('fueltank', s.x0 + 12);
    b.platform(s.x0 + 12, 10, 26); // the catwalk: 48 px up, out of their hearing
    s.enemy('guard', 14, { sleeper: true });
    s.enemy('guard', 18, { sleeper: true });
    s.enemy('sentrygun', 26, { sleeper: true });
    s.enemy('guard', 33, { sleeper: true });
    s.enemy('snowtrooper', 37, { sleeper: true });
    s.capsule('S', 10, 5);
    s.medals(20, 8, 4, 2, 2);
    b.pit(3, { fill: 'spikes' });

    // --- 3. The motor pool: snowmobiles under a second searchlight ---
    s = b.flat(48);
    s.checkpoint(1);
    s.prompt('SNOWMOBILES CHARGE ACROSS THE WHOLE SCREEN. JUMP THEM', 3, 28);
    b.searchlight(s.x0 + 10, s.x0 + 36, { tower: s.x0 + 23, height: 9, period: 6, phase: 1.5 });
    b.prop('crates', s.x0 + 8, { n: 2 });
    b.prop('fueltank', s.x0 + 42);
    s.enemy('snowmobile', 16);
    s.enemy('snowtrooper', 22);
    s.enemy('guard', 28, { sleeper: true });
    s.enemy('snowmobile', 38);
    s.capsule('R', 6, 6);
    s.medals(14, 10, 3, 2);

    // --- 4. The radar ridge: SAM sites and sentry guns ---
    b.up(2);
    s = b.flat(46);
    s.checkpoint(1);
    s.prompt('SAM SITES LOB MISSILES. SENTRY GUNS COVER THE ROAD', 2, 26);
    b.prop('radar', s.x0 + 6, { h: 110 });
    const ridge = b.platform(s.x0 + 14, 9, 8);
    b.addEnemy('guard', ridge.x0 + 3, { row: 9 });
    s.enemy('samsite', 12);
    s.enemy('sentrygun', 22);
    s.enemy('guard', 26);
    s.enemy('snowtrooper', 31);
    s.enemy('samsite', 40);
    s.enemy('recon', 34, { row: 5 });
    s.capsule('B', 18, 5);
    s.medals(28, 8, 3, 2);
    b.down(2);

    // --- 5. The silo row: the missiles are warming up ---
    s = b.flat(48);
    s.checkpoint(1);
    s.prompt('THE SILOS ARE OPENING. RECON DRONES WATCH FROM ABOVE', 2, 28);
    for (const c of [8, 16, 24, 32]) b.prop('silo', s.x0 + c);
    s.enemy('recon', 12, { row: 7 });
    s.enemy('recon', 22, { row: 6 });
    s.enemy('recon', 34, { row: 7 });
    s.enemy('samsite', 19);
    s.enemy('guard', 28);
    s.enemy('sentrygun', 44);
    s.enemy('snowtrooper', 38);
    s.capsule('E', 3, 6);
    // a secret: a stair of catwalks to a hidden 1UP above the silos
    b.platform(s.x0 + 5, 10, 3);
    b.platform(s.x0 + 9, 7, 3);
    const top = b.platform(s.x0 + 13, 4, 3);
    b.addPickup('1up', top.x0 + 1, 3);
    s.medals(26, 9, 4, 2, 2);
    b.pit(4, { fill: 'spikes' });

    // --- 6. The main gate: the last searchlight and the last guards ---
    s = b.flat(44);
    s.checkpoint(1);
    s.prompt('THE MAIN GATE. DON\'T GET SPOTTED NOW', 2, 26);
    b.searchlight(s.x0 + 8, s.x0 + 32, { tower: s.x0 + 20, height: 9, period: 5.5, phase: 3 });
    b.block(s.x0 + 14, 2, 2);
    b.block(s.x0 + 27, 2, 2);
    s.enemy('guard', 11, { sleeper: true });
    s.enemy('guard', 24, { sleeper: true });
    s.enemy('sentrygun', 30, { sleeper: true });
    s.enemy('samsite', 36);
    s.enemy('snowtrooper', 40);
    s.capsule('B', 17, 5);

    // --- 7. The Missile Silo Mech ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('THE MISSILE SILO MECH! ITS CORE IS HIGH: CLIMB A CATWALK AND SHOOT WHEN THE SHUTTERS OPEN', 0, 14);
    s.capsule('E', 3, 6);
    const arena = b.bossArena('silomech');
    b.prop('radar', arena.x0 + 2, { h: 100 });
    b.platform(arena.x0 + 3, b.gy - 3, 5);
    b.platform(arena.x1 - 8, b.gy - 3, 5);
    return b.finish();
  },
};
