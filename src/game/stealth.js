// Searchlights, the alarm and sleeping guards (Level 17: the Arctic Missile Base).
//
// A searchlight tower sweeps a pool of light to and fro along the ground between two columns. A soldier who stays in the
// pool for STEALTH.SPOT_TIME seconds sets off the alarm: for STEALTH.ALARM_TIME seconds every gun in the base reloads
// faster, sleeping guards wake, and two snow troopers run in from the edges of the screen. The beam lights only the strip
// near the ground (up on a high ledge the soldier is in the dark) and a solid tile between the lamp and the soldier throws
// a shadow (a crate is cover). Guards marked `sleeper` stand silently until the alarm rings, they are hurt, or the soldier
// walks right up to them: a quiet soldier gets past them for free.

import { TILE, VIEW_W, STEALTH } from './constants.js';
import { solidPoint } from './physics.js';
import { popup } from './fx.js';
import { spawnEnemy } from './enemies.js';
import { groundPhysics } from './ai.js';

/** Where the centre of the pool of light is on the ground at time t. */
export function beamX(z, t) {
  const mid = (z.a + z.b) / 2;
  const amp = (z.b - z.a) / 2;
  return mid + amp * Math.sin((t / z.period) * Math.PI * 2 + (z.phase || 0));
}

/** Is there a clear line between two points (no solid tile on the way)? */
export function clearLine(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 1; i < n; i++) {
    const x = x0 + (dx * i) / n;
    const y = y0 + (dy * i) / n;
    if (solidPoint(world, x, y)) return false;
  }
  return true;
}

/** Is the soldier standing in the pool of light at x = tx right now? */
export function inBeam(world, z, tx) {
  const p = world.player;
  if (!p.alive) return false;
  if (Math.abs(p.x - tx) > STEALTH.RADIUS + p.w / 2) return false;
  if (p.y < z.floorY - STEALTH.BAND || p.y > z.floorY + 4) return false; // up on a ledge: in the dark
  return clearLine(world, z.lampX, z.lampY, p.x, p.y - Math.min(p.h, 20) * 0.5);
}

/** Per-frame update of one 'searchlight' zone. */
export function updateSearchlight(world, z, dt) {
  const p = world.player;
  z.tx = beamX(z, world.time);
  if (z.meter === undefined) z.meter = 0;
  const watching = p.alive && p.x >= z.x0 && p.x < z.x1;
  if (!watching || world.alarmT > 0) {
    z.meter = Math.max(0, z.meter - dt * 2);
    z.lit = false;
    return;
  }
  z.lit = inBeam(world, z, z.tx);
  if (z.lit) z.meter = Math.min(STEALTH.SPOT_TIME, z.meter + dt);
  else z.meter = Math.max(0, z.meter - dt * 1.2);
  if (z.meter >= STEALTH.SPOT_TIME && world.alarmCool <= 0) raiseAlarm(world, z);
}

/** The alarm rings: guards wake, guns reload faster, reinforcements run in. */
export function raiseAlarm(world, z = null) {
  const p = world.player;
  world.alarmT = STEALTH.ALARM_TIME;
  world.alarmCool = STEALTH.COOLDOWN;
  if (z) z.meter = 0;
  popup(world, p.x, p.y - 44, 'SPOTTED!', '#ff4a4a');
  world.sfx('warning');
  world.camera.shake(2, 0.4);
  world.events.push({ type: 'alarm' });
  const cam = world.camera;
  const floorY = z ? z.floorY : p.y;
  const type = (z && z.troop) || 'snowtrooper';
  for (const side of [-1, 1]) {
    if (world.crowd() >= world.enemyCap) break;
    const e = spawnEnemy(world, { type, x: side < 0 ? cam.x - 14 : cam.x + VIEW_W + 14, y: floorY, face: -side });
    e.alarmBorn = true;
  }
}

/** Count the alarm down (called every frame by World.update). */
export function updateAlarm(world, dt) {
  if (world.alarmT > 0) world.alarmT = Math.max(0, world.alarmT - dt);
  if (world.alarmCool > 0) world.alarmCool = Math.max(0, world.alarmCool - dt);
}

/**
 * A guard marked `sleeper` does nothing until it is woken. Returns true while it is still asleep (the caller skips its
 * behaviour). Waking: the alarm, any damage, or the soldier walking up to it.
 */
export function snooze(world, e, dt) {
  if (!e.spec.sleeper || e.woke) return false;
  const p = world.player;
  const close = p.alive && Math.abs(p.x - e.x) < STEALTH.WAKE_R && Math.abs(p.y - e.y) < 44;
  if (world.alarmT > 0 || e.hp < e.maxHp || close) {
    e.woke = true;
    e.t = 0.6; // a moment to shake the sleep off before the first shot
    popup(world, e.x, e.y - e.h - 6, '!', '#ff4a4a');
    return false;
  }
  e.vx = 0;
  groundPhysics(e, world, dt);
  return true;
}
