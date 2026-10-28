// The hoverbike (Level 19's skyway): during a 'hover' zone the soldier flies a neon hoverbike anywhere inside the screen
// while the camera rolls on. Like the tank it has hit points: a bullet or blast that would have killed the soldier knocks
// one off (BIKE.HP), and the last one wrecks the bike and throws the soldier clear onto the road below.

import { BIKE } from './constants.js';
import { explosion, spark, smoke, popup, ring, flash } from './fx.js';

/** A hit on a soldier on a hoverbike. Returns true when it was absorbed (or the bike went up), false if there is no bike. */
export function hitBike(world, cause) {
  const p = world.player;
  if (p.mode !== 'fly') return false;
  p.bikeHp--;
  world.sfx('hitBoss');
  world.camera.shake(2, 0.2);
  spark(world, p.x, p.y - 6, '#4af0ff', 6, 90);
  smoke(world, p.x, p.y - 8, 3);
  if (p.bikeHp <= 0) {
    wreckBike(world);
  } else {
    p.invuln = BIKE.HIT_INVULN;
    popup(world, p.x, p.y - 26, 'BIKE HIT', '#ffb04a');
  }
  world.events.push({ type: 'bikeHit', hp: p.bikeHp, cause });
  return true;
}

/** The bike blows up; the soldier is thrown clear and survives. */
export function wreckBike(world) {
  const p = world.player;
  const x = p.x;
  const y = p.y;
  explosion(world, x, y - 6, 1);
  ring(world, x, y - 6, '#4af0ff', 34, 0.35);
  flash(world, x, y - 6, '#ffffff');
  world.sfx('bigBoom');
  world.camera.shake(4, 0.4);
  p.leaveBike();
  p.vy = -150;
  p.vx = -p.face * 40;
  p.grounded = false;
  p.invuln = BIKE.EJECT_INVULN;
  popup(world, x, y - 34, 'BIKE LOST', '#ff6a4a');
  world.events.push({ type: 'bikeLost' });
}

/** The hover zone covering x, or null. */
export function hoverZoneAt(world, x) {
  for (const z of world.zones) if (z.type === 'hover' && x >= z.x0 && x < z.x1) return z;
  return null;
}
