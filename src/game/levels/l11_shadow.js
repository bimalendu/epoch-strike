// Level 11 - Feudal Japan: the Shadow Castle. A night raid on a keep full of ninjas: some wait in the shadows and only
// step out when you come close (a puff of smoke, then they strike), samurai guard the courtyard and dash in a flat slash
// after a long wind-up, and the road climbs through the keep by WALL JUMPS: kick off the stone, zig-zag up a shaft,
// land on the wall top. One tall tower beside the road hides a 1UP at the top. The Oni Warlord holds the roof garden.
//
// The castle stands on a mountainside: the road climbs 22-degree rises and a 45-degree stone stair, and a cliff drops a steep scree
// slide. The wall-jump shafts stay where the road is level (their height is measured from the ground), and so does the arena.

import { LevelBuilder } from '../levelgen.js';

export const shadowCastle = {
  name: 'SHADOW CASTLE',
  era: 'FEUDAL JAPAN',
  theme: 'shadowcastle',
  seed: 111,
  music: 'shadow',
  bulletScale: 1.0,
  wallJump: true,
  build(def) {
    const b = new LevelBuilder({ ...def, id: 10 });

    // --- 1. The torii gate: the first ambush, on a moonlit rise ---
    let s = b.flat(12);
    s.capsule('E', 6, 6);
    s.prompt('NINJAS HIDE IN THE SHADOWS. THEY STEP OUT WHEN YOU COME CLOSE', 2, 24);
    b.prop('torii', s.x0 + 5);
    b.slope(2, { angle: 22 });
    s = b.flat(8);
    s.enemy('ninja', 4);
    s.medalsAbove(1, 3, 2, 2);
    b.prop('lantern', s.x0 + 3);
    b.slope(-2, { angle: 22 });
    s = b.flat(16);
    s.enemy('shinobi', 8);
    b.prop('lantern', s.x0 + 4);
    b.pit(3, { fill: 'spikes' });

    // --- 2. The hillside courtyard: a 45-degree stone stair up to the samurai guard ---
    s = b.flat(14);
    s.checkpoint(1);
    s.prompt('SAMURAI RAISE THEIR BLADE, THEN DASH. JUMP OVER THE SLASH AND SHOOT THEM IN THE BACK', 1, 26);
    s.enemy('samurai', 10);
    b.prop('lantern', s.x0 + 6);
    b.slope(3, { angle: 45 });
    s = b.flat(16);
    s.enemy('ninja', 3).enemy('ninja', 10);
    s.capsule('S', 5, b.rowAbove(8));
    s.medalsAbove(6, 4, 2, 2, 2);
    b.prop('lantern', s.x0 + 2);
    b.prop('lantern', s.x0 + 14);
    b.slope(-3, { angle: 45 });
    s = b.flat(10);
    s.enemy('shinobi', 5);
    b.prop('lantern', s.x0 + 4);

    // --- 3. The first shaft: wall jumps ---
    s = b.flat(12);
    s.checkpoint(1);
    s.prompt('WALL JUMP: PRESS {jump} WHILE TOUCHING A WALL IN MID-AIR TO KICK OFF IT', 0, 14);
    s.enemy('shinobi', 8);
    b.shaft({ w: 3, h: 6 });
    s = b.flat(12);
    s.enemy('ninja', 6);
    s.enemy('samurai', 11);
    b.pit(3, { fill: 'spikes' });

    // (continued) the castle cliff: up the rock and down a steep scree slide, then flat ground before the spikes
    b.slope(2, { angle: 45 });
    b.flat(4);
    b.slope(-2, { angle: 67 });
    b.flat(4);
    b.pit(3, { fill: 'spikes' });

    // --- 4. Rooftops over the moat of spikes ---
    s = b.flat(10);
    s.checkpoint(1);
    s.enemy('shinobi', 6);
    s.capsule('M', 4, 6);
    b.pit(4, { fill: 'spikes' });
    b.platform(b.x - 4, 11, 3);
    s = b.flat(10);
    s.enemy('ninja', 5);
    b.prop('lantern', s.x0 + 2);
    b.pit(5, { fill: 'spikes' });
    b.platform(b.x - 5, 11, 3, { kind: 'one-way' });
    s = b.flat(14);
    s.enemy('samurai', 8);
    s.enemy('shinobi', 12);
    s.medals(3, 10, 3, 2);

    // --- 5. The inner keep: a taller shaft with an ambush in the hollow ---
    s = b.flat(8);
    s.checkpoint(1);
    s.prompt('NINJAS WAIT INSIDE THE TOWER TOO. KICK OFF THE WALLS TO CLIMB OUT', 0, 14);
    const keep = b.shaft({ w: 3, h: 7 });
    b.addEnemy('ninja', keep.inner0 + 1);
    b.addEnemy('shinobi', keep.x0, { row: b.gy - 9 });
    s = b.flat(12);
    s.capsule('R', 5, 6);
    s.enemy('ninja', 8);
    s.medals(6, 10, 3, 2);

    // --- 6. The watchtower: a walk-through shaft with a gleam at the top ---
    s = b.flat(10);
    s.checkpoint(1);
    s.prompt('A TOWER YOU CAN CLIMB. SOMETHING GLEAMS AT THE TOP', 2, 14);
    const tower = b.shaft({ w: 3, h: 11, through: true });
    b.addPickup('1up', tower.xr + 1, tower.top);
    s = b.flat(12);
    s.enemy('samurai', 6);
    s.enemy('shinobi', 10);

    // --- 7. The roof garden approach: one last rise under the lanterns ---
    s = b.flat(12);
    s.checkpoint(1);
    s.enemy('ninja', 8);
    b.prop('lantern', s.x0 + 4);
    b.slope(2, { angle: 22 });
    s = b.flat(12);
    s.enemy('samurai', 3).enemy('ninja', 9);
    s.capsule('H', 6, b.rowAbove(8));
    s.medalsAbove(4, 4, 2, 2, 2);
    b.slope(-2, { angle: 22 });
    s = b.flat(16);
    s.enemy('shinobi', 4).enemy('samurai', 10);
    b.prop('lantern', s.x0 + 2);
    b.prop('torii', s.x0 + 14);

    // --- 8. The Oni Warlord ---
    s = b.flat(16);
    s.checkpoint(1);
    s.prompt('AN ONI! ITS GEM IS OUT OF REACH OF LEVEL SHOTS. FIRE FROM A STONE LEDGE', 1, 14);
    s.capsule('B', 7, 6);
    const arena = b.bossArena('oni');
    b.prop('lantern', arena.x0 + 2);
    b.prop('lantern', arena.x1 - 3);
    b.platform(arena.x0 + 3, b.gy - 2, 5);
    b.platform(arena.x1 - 8, b.gy - 2, 5);
    return b.finish();
  },
};
