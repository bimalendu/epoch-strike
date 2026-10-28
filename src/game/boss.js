// Boss framework. A boss is an enemy whose def has `boss: true` and `arch: 'boss'`; this file runs its life:
//
//   enter  walks in while a WARNING banner shows (invulnerable)
//   idle   cooldown between attacks; the weak point is usually exposed here
//   tele   telegraph: the pose and sound announce the next attack (>= 0.6 s, enforced by the tests)
//   attack runs the attack's tick() for `dur` seconds
//   phase  invulnerable roar + shake when health drops under the next phase threshold
//   dying  explosions for a few seconds, then the level is cleared
//
// A def supplies the numbers and the attack library (see bosses/trex.js for the full shape):
//   phases: [{ hp: 1, attacks: ['stomp', ...], cd: [min, max] }, { hp: 0.66, ... }, ...]
//   attacks: { name: { tele, dur, start?(e, w), tick?(e, w, t, dt), end?(e, w), when?(e, w) } }
//   weakBox?(e): absolute pixel rect {x0,y0,x1,y1} that takes full damage right now, or null (armour only)
//   move?(e, w, dt): per-frame body physics (defaults to ground physics)
//   idle?(e, w, dt): behaviour while waiting between attacks
//   enter?(e, w, dt): walk-in; return true when in place
//   onPhase?(e, w, phaseIndex)

import { ARCH, groundPhysics } from './ai.js';
import { explosion, spark, ring, popup } from './fx.js';
import { killEnemy } from './enemies.js';

export const MIN_BOSS_TELE = 0.6; // every attack announces itself at least this long
const ENTER_MIN = 1.8;
const PHASE_TIME = 1.5;
const DEATH_TIME = 3.0;

// ---- helpers for attack scripts ----

/** An enemy bullet fired by a boss; speed is scaled by the difficulty like every other enemy bullet. */
export function bossShoot(world, x, y, angle, speed, props = {}) {
  const sp = speed * world.bulletMul;
  return world.spawnEnemyBullet({
    x,
    y,
    vx: Math.cos(angle) * sp,
    vy: Math.sin(angle) * sp,
    r: 3,
    kind: 'plasma',
    col: '#ff4adc',
    ...props,
  });
}

/** Angle from a point to the player's body. */
export function angleToPlayer(world, x, y) {
  const p = world.player;
  return Math.atan2(p.y - p.h * 0.5 - y, p.x - x);
}

/** A flashing marker on the floor that warns where something is about to land or erupt. */
export function warnMark(world, x, y, time = 0.8) {
  world.fx.push({ k: 'warn', x, y, t: 0, life: time, max: time });
}

/** A low shockwave that runs along the floor: the player has to jump it. */
export function shockwave(world, x, floorY, dir, speed = 150, props = {}) {
  return world.spawnEnemyBullet({
    x,
    y: floorY - 5,
    vx: dir * speed * world.bulletMul,
    vy: 0,
    r: 5,
    kind: 'wave',
    persist: true,
    life: 4,
    ...props,
  });
}

/** A column of fire that erupts from the floor at x after `delay` seconds (a warning mark shows first). */
export function geyser(world, x, floorY, { delay = 0.8, height = 80, hold = 0.55, col = '#ff8a1e', kind = 'flame' } = {}) {
  warnMark(world, x, floorY, delay);
  world.after(delay, () => {
    world.sfx('boom');
    for (let y = floorY - 4; y > floorY - height; y -= 9) {
      world.spawnEnemyBullet({ x, y, vx: 0, vy: 0, r: 4, kind, col, persist: true, ghost: true, life: hold });
    }
  });
}

/** A rock that falls from the top of the screen onto x after `delay` seconds. */
export function dropRock(world, x, { delay = 0.9, kind = 'rock', col } = {}) {
  const cam = world.camera;
  warnMark(world, x, world.bossArena ? world.bossArena.floorY : cam.y + 220, delay);
  world.after(delay, () => {
    world.spawnEnemyBullet({ x, y: cam.y - 8, vx: 0, vy: 80, g: 520, r: 4, kind, col, life: 3 });
  });
}

// ---- the state machine ----

function phaseFor(e) {
  const frac = e.hp / e.maxHp;
  let idx = 0;
  e.def.phases.forEach((p, i) => {
    if (frac <= p.hp + 1e-9) idx = i;
  });
  return idx;
}

function init(e, world) {
  e.bs = {
    state: 'enter',
    age: 0,
    t: 0,
    phase: 0,
    atk: null,
    last: null,
    cd: 1,
    shownHp: 0,
    dead: false,
    elapsed: 0,
    exposed: false,
    fightT: 0, // seconds since the intro ended (the kill-time clock)
  };
  e.noBurn = true;
  if (e.def.init) e.def.init(e, world);
}

function pickAttack(e, world) {
  const d = e.def;
  const bs = e.bs;
  const phase = d.phases[bs.phase];
  let pool = phase.attacks.filter((n) => !d.attacks[n].when || d.attacks[n].when(e, world));
  if (pool.length > 1) pool = pool.filter((n) => n !== bs.last);
  if (!pool.length) pool = phase.attacks;
  return pool[Math.floor(world.rand() * pool.length)];
}

function beginAttack(e, world) {
  const bs = e.bs;
  const name = pickAttack(e, world);
  const atk = e.def.attacks[name];
  bs.atk = name;
  bs.last = name;
  bs.state = 'tele';
  bs.t = Math.max(MIN_BOSS_TELE, atk.tele);
  bs.teleMax = bs.t;
  world.sfx('telegraph');
  if (atk.teleStart) atk.teleStart(e, world);
}

function endAttack(e, world) {
  const bs = e.bs;
  const atk = e.def.attacks[bs.atk];
  if (atk && atk.end) atk.end(e, world);
  bs.state = 'idle';
  const [lo, hi] = e.def.phases[bs.phase].cd;
  bs.cd = lo + world.rand() * (hi - lo);
  bs.atk = null;
}

export function bossInvulnerable(e) {
  const s = e.bs ? e.bs.state : 'enter';
  return s === 'enter' || s === 'phase' || s === 'dying';
}

function startDying(e, world) {
  const bs = e.bs;
  if (bs.state === 'dying') return;
  const atk = e.def.attacks[bs.atk];
  if (atk && atk.end) atk.end(e, world);
  bs.state = 'dying';
  bs.t = DEATH_TIME;
  bs.blastT = 0;
  e.noContact = true;
  e.vx = 0;
  world.ebullets.length = 0;
  world.camera.shake(7, DEATH_TIME);
  world.sfx('bigBoom');
  world.events.push({ type: 'bossDying', id: e.id });
}

/** Called by damageEnemy when a boss runs out of health. */
export function bossDown(world, e) {
  if (!e.bs) init(e, world);
  startDying(e, world);
}

function finish(e, world) {
  e.bs.dead = true;
  explosion(world, e.x, e.cy, 2);
  killEnemy(world, e);
  world.boss = null;
  const noDeath = world.bossDeaths === 0;
  const echo = !!e.echo;
  world.events.push({ type: 'bossDefeated', id: e.id, noDeath, time: e.bs.fightT, echo });
  if (echo) {
    world.nextArena(); // a boss rush goes on: the camera is freed and the next arena waits ahead
  } else {
    world.bossDone = true;
    world.clearTimer = 1.4;
  }
}

export function bossUpdate(e, world, dt) {
  if (!e.bs) init(e, world);
  const d = e.def;
  const bs = e.bs;
  bs.age += dt;
  if (bs.state !== 'enter' && bs.state !== 'dying') bs.fightT += dt;

  // health bar fills during the intro, then follows the real value
  if (bs.state === 'enter') bs.shownHp = Math.min(e.hp, bs.shownHp + (e.maxHp * dt) / 1.4);
  else bs.shownHp = e.hp;

  if (e.echo && bs.state !== 'dying' && Math.floor(bs.age * 9) !== Math.floor((bs.age - dt) * 9)) {
    spark(world, e.x + (world.rand() - 0.5) * e.w, e.y - world.rand() * e.h, '#c06bff', 1, 40);
  }
  bs.exposed = false;
  switch (bs.state) {
    case 'enter': {
      const there = d.enter ? d.enter(e, world, dt) : true;
      if (there && bs.age >= ENTER_MIN) {
        bs.state = 'idle';
        bs.cd = 0.9;
        e.vx = 0;
      }
      break;
    }
    case 'idle': {
      if (d.idle) d.idle(e, world, dt);
      bs.cd -= dt;
      if (bs.cd <= 0) beginAttack(e, world);
      break;
    }
    case 'tele': {
      e.vx = 0;
      bs.t -= dt;
      if (bs.t <= 0) {
        const atk = d.attacks[bs.atk];
        bs.state = 'attack';
        bs.t = atk.dur;
        bs.elapsed = 0;
        if (atk.start) atk.start(e, world);
      }
      break;
    }
    case 'attack': {
      const atk = d.attacks[bs.atk];
      bs.t -= dt;
      bs.elapsed += dt;
      if (atk.tick) atk.tick(e, world, bs.elapsed, dt);
      if (bs.t <= 0) endAttack(e, world);
      break;
    }
    case 'phase': {
      e.vx = 0;
      bs.t -= dt;
      if (bs.t <= 0) {
        bs.state = 'idle';
        bs.cd = 0.8;
      }
      break;
    }
    case 'dying': {
      bs.t -= dt;
      bs.blastT -= dt;
      if (bs.blastT <= 0) {
        bs.blastT = 0.14;
        const rx = e.x + (world.rand() - 0.5) * e.w * 1.4;
        const ry = e.y - world.rand() * e.h;
        explosion(world, rx, ry, world.rand() < 0.3 ? 1 : 0);
        world.sfx(world.rand() < 0.4 ? 'bigBoom' : 'boom');
      }
      if (bs.t <= 0) finish(e, world);
      break;
    }
    default:
  }

  // phase change
  if (bs.state !== 'dying' && bs.state !== 'enter' && bs.state !== 'phase') {
    const want = phaseFor(e);
    if (want > bs.phase) {
      const atk = d.attacks[bs.atk];
      if (atk && bs.state === 'attack' && atk.end) atk.end(e, world);
      bs.phase = want;
      bs.state = 'phase';
      bs.t = PHASE_TIME;
      bs.atk = null;
      world.ebullets.length = 0;
      world.camera.shake(5, PHASE_TIME);
      world.sfx('bigBoom');
      ring(world, e.x, e.cy, '#ffffff', 90, 0.6);
      popup(world, e.x, e.y - e.h - 10, 'ENRAGED', '#ff6a6a');
      world.events.push({ type: 'bossPhase', id: e.id, phase: want });
      if (d.onPhase) d.onPhase(e, world, want);
    }
  }

  if (d.move) d.move(e, world, dt);
  else groundPhysics(e, world, dt);
  // never leave the arena
  const L = world.bossArena;
  if (L && bs.state !== 'enter') e.x = Math.max(L.x0 + e.w / 2 + 2, Math.min(L.x1 - e.w / 2 - 2, e.x));
}

/** Does a player bullet (its whole box, not just its centre) touch the boss's current weak point? */
export function bulletHitsWeak(b, wb) {
  const hw = (b.w || 0) / 2;
  const hh = (b.h || 0) / 2;
  return b.x + hw >= wb.x0 && b.x - hw <= wb.x1 && b.y + hh >= wb.y0 && b.y - hh <= wb.y1;
}

/** Does a player bullet at (x, y) hit the boss's current weak point? */
export function inWeakBox(e, x, y) {
  const wb = e.def.weakBox ? e.def.weakBox(e) : null;
  return !!wb && x >= wb.x0 && x <= wb.x1 && y >= wb.y0 && y <= wb.y1;
}

/** Damage rules for bosses (called from damageEnemy). Returns the damage to apply, or 0 to bounce the shot. */
export function bossDamage(world, e, dmg, bullet) {
  if (bossInvulnerable(e)) {
    if (bullet) spark(world, bullet.x, bullet.y, '#cfd8e0', 3);
    world.sfx('hitBoss');
    return 0;
  }
  const wb = e.def.weakBox ? e.def.weakBox(e) : null;
  if (wb && bullet) {
    if (bulletHitsWeak(bullet, wb)) {
      world.sfx('hit');
      spark(world, bullet.x, bullet.y, '#ff9aee', 4);
      return dmg;
    }
    spark(world, bullet.x, bullet.y, '#cfd8e0', 2);
    world.sfx('hitBoss');
    return dmg * (e.def.armor ?? 0.2);
  }
  if (!wb && bullet) {
    // no weak point defined right now: armour everywhere
    spark(world, bullet.x, bullet.y, '#cfd8e0', 2);
    world.sfx('hitBoss');
    return dmg * (e.def.armor ?? 0.2);
  }
  return dmg; // smart bombs and other non-bullet damage ignore armour
}

ARCH.boss = bossUpdate;
