// The rideable tank (Level 16, and the Super-Heavy Tank's arena). The soldier climbs in by touching a parked tank; while
// mounted they drive slower and wider, hop instead of jumping, and fire the tank's cannon instead of the carried weapon.
// The tank has TANK.HP hits of armour: a bullet, blast or touch that would have killed the soldier knocks one off
// instead, and the last one wrecks the tank and throws the soldier clear. Falling into a pit, quicksand and the like are
// still fatal. Infantry that the tank drives into are crushed.

import { TANK } from './constants.js';
import { explosion, spark, smoke, popup, ring, flash } from './fx.js';
import { damageEnemy } from './enemies.js';

/** Causes of death that no armour helps against. */
const FATAL = new Set(['fell', 'quicksand']);

/** The cannon: a heavy shell with a small blast that also catches enemies standing near the hit. */
export const TANK_GUN = {
  name: 'TANK CANNON',
  cooldown: TANK.COOLDOWN,
  sfx: 'shootBolt',
  fire(world, m) {
    world.spawnBullet({
      x: m.x,
      y: m.y,
      vx: m.dx * TANK.SHELL_SPEED,
      vy: m.dy * TANK.SHELL_SPEED,
      dmg: TANK.SHELL_DMG,
      w: 8,
      h: 6,
      life: 1.1,
      kind: 'tankshell',
      onHit: shellBlast,
      onWall: shellBlast,
    });
  },
};

/** Blast around a shell: hurts the other ordinary enemies within TANK.SPLASH_R (never a boss). */
export function shellBlast(b, world, hit = null) {
  explosion(world, b.x, b.y, 0);
  ring(world, b.x, b.y, '#ffd890', TANK.SPLASH_R, 0.25);
  for (const e of world.enemies) {
    if (!e.alive || e.hidden || e === hit || e.def.boss) continue;
    if (Math.hypot(e.x - b.x, e.cy - b.y) > TANK.SPLASH_R + e.w / 2) continue;
    damageEnemy(world, e, TANK.SPLASH_DMG, { x: b.x, y: b.y, vx: 0, vy: 0 });
  }
}

/** A hit on a mounted soldier. Returns true when the hit was absorbed (or the tank went up), false if it is fatal. */
export function hitTank(world, cause) {
  const p = world.player;
  if (p.mode !== 'tank' || FATAL.has(cause)) return false;
  p.tankHp--;
  world.sfx('hitBoss');
  world.camera.shake(2, 0.2);
  spark(world, p.x, p.y - 12, '#ffcf6a', 6, 90);
  smoke(world, p.x + (world.rand() - 0.5) * 16, p.y - 20, 4);
  if (p.tankHp <= 0) {
    wreckTank(world);
  } else {
    p.invuln = TANK.HIT_INVULN;
    popup(world, p.x, p.y - 34, p.tankHp === 1 ? 'TANK FAILING!' : 'TANK HIT', '#ffb04a');
  }
  world.events.push({ type: 'tankHit', hp: p.tankHp });
  return true;
}

/** The tank blows up; the soldier is thrown clear and survives. */
export function wreckTank(world) {
  const p = world.player;
  const x = p.x;
  const y = p.y;
  explosion(world, x, y - 10, 2);
  ring(world, x, y - 10, '#ffb04a', 42, 0.4);
  flash(world, x, y - 12, '#ffffff');
  world.sfx('bigBoom');
  world.camera.shake(5, 0.45);
  p.leaveTank();
  p.vy = -230;
  p.vx = -p.face * 70;
  p.grounded = false;
  p.invuln = TANK.EJECT_INVULN;
  popup(world, x, y - 40, 'TANK LOST', '#ff6a4a');
  world.events.push({ type: 'tankLost' });
}

/** A mounted soldier drives into infantry: crush them. True if this enemy is crushed (so it does not hurt the tank). */
export function crushable(world, e) {
  const p = world.player;
  if (p.mode !== 'tank' || !e.def.crush || e.def.boss) return false;
  damageEnemy(world, e, 99, { x: e.x, y: e.cy, vx: 0, vy: 0 });
  world.sfx('stomp');
  spark(world, e.x, e.cy, '#c8c0a8', 4, 60);
  return true;
}

/** Zone covering x, or null. */
export function tankZoneAt(world, x) {
  for (const z of world.zones) if (z.type === 'tank' && x >= z.x0 && x < z.x1) return z;
  return null;
}
