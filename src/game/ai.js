// Enemy behaviours. Every enemy "skin" in enemy_defs.js names one of these archetypes and tunes it with numbers:
//   runner   charges the player (raptors, gladiators, ninjas)
//   shooter  stops, aims, fires after a telegraph (archers, musketeers, cyborgs)
//   turret   fixed, rotates toward the player, optional open/close cycle (plants, cannons, bunkers)
//   flyer    sine, dive, hover or swoop paths (pterosaurs, kites, drones)
//   heavy    slow, armoured, weak point (elephants, brutes, tanks)
//   spawner  emits enemies until destroyed (hives, doors, portals)
//   faller   hangs overhead, shakes when the player passes beneath, then drops (icicles)
//   charger  walks, rears up, then charges in a line (war elephants, rival chariots)
//   launcher fires firework rockets that burst into falling sparks (firecrates)
//   breacher lurks under the water, ripples, then leaps out in an arc (sea serpents)
//   duelist  stalks, raises its blade (telegraph), dashes in a flat slash, then rests (samurai)
//   mine     lies in the ground, pops up and bursts when a soldier comes close (landmines)
//   capsule  the flying weapon capsule
// Bosses (boss.js) reuse the same bullet helpers.

import { TILE, VIEW_W, STEALTH } from './constants.js';
import { SOLID, ONEWAY } from './tiles.js';
import { moveBody, floorNear } from './physics.js';
import { spawnEnemy, killEnemy } from './enemies.js';
import { launchRocket, fuseForRise } from './rocket.js';
import { smoke, explosion, ring, spark, pushPx } from './fx.js';

const GRAV = 1000;
const MAX_FALL = 420;

// ---- helpers ----
export function groundPhysics(e, world, dt) {
  e.vy += GRAV * e.gdir * dt;
  e.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, e.vy));
  moveBody(world, e, dt);
  if (e.grounded && Math.abs(e.vx) > 1) e.anim += dt * 9;
}

export function floorAhead(world, e, dist = 3) {
  return floorNear(world, e.x + e.face * (e.w / 2 + dist), e.y);
}

/** Launch direction (radians) to hit (dx, dy) with a gravity-affected shot of speed v. Falls back to a flat aim. */
export function ballisticAngle(dx, dy, v, g, high = false) {
  const x = Math.abs(dx);
  const h = -dy; // height above the muzzle
  const disc = v * v * v * v - g * (g * x * x + 2 * h * v * v);
  if (x < 1 || disc < 0) return Math.atan2(dy, dx);
  const tanPhi = (v * v + (high ? 1 : -1) * Math.sqrt(disc)) / (g * x);
  const phi = Math.atan(tanPhi);
  return Math.atan2(-Math.sin(phi), Math.sign(dx || 1) * Math.cos(phi));
}

/** Muzzle position and aim angle toward the player for an enemy. */
export function aimAtPlayer(world, e, ox, oy) {
  const p = world.player;
  const tx = p.x;
  const ty = p.y - p.h * 0.5;
  const bd = e.def.bullet || {};
  if (bd.g) {
    const v = (bd.speed || 120) * world.bulletMul;
    return ballisticAngle(tx - ox, ty - oy, v, bd.g, !!bd.high);
  }
  return Math.atan2(ty - oy, tx - ox);
}

/** Spawn one enemy bullet from (ox, oy) at angle `a`. Bullet data comes from def.bullet. */
export function fireBullet(world, e, ox, oy, a, speedMul = 1) {
  const bd = e.def.bullet || {};
  const sp = (bd.speed || 90) * world.bulletMul * speedMul;
  const c = Math.cos(a);
  const s = Math.sin(a);
  e.aimX = c;
  e.aimY = s;
  world.spawnEnemyBullet({
    x: ox + c * 8,
    y: oy + s * 8,
    vx: c * sp,
    vy: s * sp,
    r: bd.r || 2,
    col: bd.col,
    kind: bd.kind || 'orb',
    g: bd.g || 0,
    life: bd.life,
    ghost: !!bd.ghost,
  });
  world.sfx(bd.sfx || 'enemyShoot');
}

/** Fire one aimed enemy bullet at the player (optionally fanned by `offset` radians). */
export function fireAtPlayer(world, e, offset = 0, speedMul = 1) {
  const ox = e.x + e.face * 8;
  const oy = e.y - e.h * 0.62;
  fireBullet(world, e, ox, oy, aimAtPlayer(world, e, ox, oy) + offset, speedMul);
}

/**
 * The shared "wait, telegraph, fire a burst" state machine used by shooters, heavies and turrets.
 * cfg: { range, tele, fireEvery, burst, fan, spread, gap } ; `muzzle(e)` -> {x, y}; `angle(e, m)` -> radians.
 */
function fireMachine(e, world, dt, cfg, muzzle, angle) {
  const p = world.player;
  const visible = world.onScreen(e.x, e.cy, -8);
  e.t -= dt;
  if (world.alarmT > 0) e.t -= dt * STEALTH.FIRE_BOOST; // the alarm is ringing: every gun reloads faster
  if (e.state === 'idle') {
    if (visible && p.alive && e.t <= 0 && Math.abs(p.x - e.x) < (cfg.range || 280) && e.open !== false) {
      e.state = 'tele';
      e.t = cfg.tele ?? 0.55;
      e.shots = cfg.burst || 1;
      if (cfg.teleSfx) world.sfx('telegraph');
    }
  } else if (e.state === 'tele') {
    const m = muzzle(e);
    const a = angle(e, m);
    e.aimX = Math.cos(a);
    e.aimY = Math.sin(a);
    if (e.t <= 0) {
      const n = cfg.fan || 1;
      for (let i = 0; i < n; i++) {
        const off = n > 1 ? (i - (n - 1) / 2) * (cfg.spread || 0.25) : 0;
        fireBullet(world, e, m.x, m.y, a + off);
      }
      e.shots--;
      if (e.shots > 0) {
        e.t = cfg.gap ?? 0.13;
      } else {
        e.state = 'idle';
        e.t = (cfg.fireEvery ?? 2) * (0.85 + world.rand() * 0.3);
      }
    }
  }
}

// ---- runner ----
export function runner(e, world, dt) {
  const d = e.def;
  const p = world.player;
  if (d.ambush) {
    // hidden in the shadows until the soldier comes close, then steps out in a puff of smoke and pauses a moment
    if (e.waiting === undefined) {
      e.waiting = true;
      e.hidden = true;
      e.noContact = true;
    }
    if (e.waiting) {
      const near = p.alive && Math.abs(p.x - e.x) < d.ambush && Math.abs(p.y - e.y) < 100 && world.onScreen(e.x, e.y, 0);
      if (!near) {
        e.vx = 0;
        groundPhysics(e, world, dt);
        return;
      }
      e.waiting = false;
      e.hidden = false;
      e.noContact = false;
      e.stall = d.stall ?? 0.45;
      e.face = p.x >= e.x ? 1 : -1;
      smoke(world, e.x, e.y - 12, 10);
      world.sfx('telegraph');
    }
    if (e.stall > 0) {
      e.stall -= dt;
      e.vx = 0;
      groundPhysics(e, world, dt);
      return;
    }
  }
  const dx = p.x - e.x;
  const near = p.alive && Math.abs(dx) < (d.aggro ?? 260) && Math.abs(p.y - e.y) < 100;
  if (near) e.face = dx >= 0 ? 1 : -1;
  const rage = d.enrage && e.hp <= e.maxHp / 2 ? 1.5 : 1; // berserkers speed up once they are hurt
  const sp = d.speed * e.speedMul * rage;
  let vx = e.face * sp;
  if (d.still && !near) vx = 0; // terracotta soldiers stand like statues until the soldier comes close
  e.jumpCd -= dt;
  if (e.grounded) {
    const edge = !floorAhead(world, e);
    if (e.hitWall || edge) {
      if (d.jump && e.jumpCd <= 0) {
        e.vy = -(d.jumpV || 300) * e.gdir;
        e.jumpCd = 0.9;
      } else if (!near) {
        e.face = -e.face;
        vx = e.face * sp;
      } else {
        vx = 0;
      }
    } else if (d.jump && near && Math.abs(dx) < (d.leapRange || 80) && e.jumpCd <= 0) {
      e.vy = -(d.jumpV || 300) * e.gdir;
      e.jumpCd = 1.1;
    }
  }
  e.vx = e.grounded || e.vy * e.gdir > 0 ? vx : e.vx;
  if (!e.grounded && e.jumpCd > 0) e.vx = vx * 1.1;
  groundPhysics(e, world, dt);
}

// ---- shooter ----
export function shooter(e, world, dt) {
  const d = e.def;
  const p = world.player;
  const dx = p.x - e.x;
  if (p.alive) e.face = dx >= 0 ? 1 : -1;
  const visible = world.onScreen(e.x, e.y, -8);
  let vx = 0;
  if (d.speed > 0 && visible && Math.abs(dx) > (d.keep || 150) && e.state === 'idle') {
    vx = e.face * d.speed;
    if (!floorAhead(world, e)) vx = 0;
  }
  fireMachine(
    e,
    world,
    dt,
    d,
    (en) => ({ x: en.x + en.face * 8, y: en.y - en.h * 0.62 }),
    (en, m) => aimAtPlayer(world, en, m.x, m.y),
  );
  e.vx = vx;
  groundPhysics(e, world, dt);
}

// ---- turret ----
export function turret(e, world, dt) {
  const d = e.def;
  const p = world.player;
  if (e.ang === undefined) e.ang = d.arc ? (d.arc[0] + d.arc[1]) / 2 : e.face > 0 ? 0 : Math.PI;
  // open / closed cycle (pillboxes are only vulnerable and dangerous while open)
  if (d.cycle) {
    if (e.cycleT === undefined) {
      e.open = false;
      e.cycleT = d.cycle.closed * (0.4 + 0.6 * ((e.x / TILE) % 3) / 3);
    }
    e.cycleT -= dt;
    if (e.cycleT <= 0) {
      e.open = !e.open;
      e.cycleT = e.open ? d.cycle.open : d.cycle.closed;
      if (e.open && world.onScreen(e.x, e.cy, 0)) world.sfx('capsule');
      if (!e.open && e.state === 'tele') {
        // the slit shuts on a burst that has not finished: it never fires through armour
        e.state = 'idle';
        e.t = 0.4;
      }
    }
  } else {
    e.open = true;
  }
  e.facing = p.x >= e.x ? 1 : -1;
  const mx = e.x + (d.muzzleX || 0) * e.facing;
  const my = e.y - (d.muzzleY ?? e.h * 0.7) * (e.gdir || 1);
  const want = aimAtPlayer(world, e, mx, my);
  // rotate toward the target angle, staying inside the allowed arc
  let target = want;
  if (d.arc) {
    const [lo, hi] = d.arc;
    const v = normalize(want, lo);
    // outside the arc: swing to whichever end is nearer (going the short way round)
    target = v <= hi ? v : v - hi < lo + Math.PI * 2 - v ? hi : lo;
  }
  let diff = normalize(target - e.ang, -Math.PI);
  const step = (d.turn || 3) * dt;
  e.ang += Math.max(-step, Math.min(step, diff));
  fireMachine(
    e,
    world,
    dt,
    d,
    () => ({ x: mx + Math.cos(e.ang) * (d.barrel || 8), y: my + Math.sin(e.ang) * (d.barrel || 8) }),
    () => e.ang,
  );
  // plants and bunkers do not move
  e.vx = 0;
  e.vy = 0;
}

/** Wrap an angle into [base, base + 2PI). */
function normalize(a, base) {
  const t = Math.PI * 2;
  return ((((a - base) % t) + t) % t) + base;
}

// ---- flyer ----
export function flyer(e, world, dt) {
  const d = e.def;
  const p = world.player;
  e.age = (e.age || 0) + dt;
  e.anim += dt * (d.flap || 10);
  if (e.baseY === undefined) {
    e.baseY = e.y;
    e.phase = e.spec.phase ?? world.rand() * 6;
  }
  const bob = Math.sin(e.age * (d.freq || 2.2) + e.phase) * (e.spec.amp ?? d.amp ?? 18);
  switch (d.pattern) {
    case 'dive':
      flyDive(e, world, dt, bob);
      break;
    case 'hover':
      flyHover(e, world, dt, bob);
      break;
    case 'swoop': {
      e.x += e.face * d.speed * dt * (0.8 + 0.4 * Math.sin(e.age * 1.7));
      e.y = e.baseY + bob + Math.sin(e.age * 5.1) * 6;
      break;
    }
    default: // sine
      e.x += e.face * d.speed * dt;
      e.y = e.baseY + bob;
  }
  // flyers that bomb or shoot while crossing the screen
  if (d.dropEvery && d.pattern !== 'dive' && world.onScreen(e.x, e.y, -10) && p.alive) {
    e.t -= dt;
    if (e.t <= 0 && Math.abs(p.x - e.x) < 40) {
      e.t = d.dropEvery;
      world.spawnEnemyBullet({ x: e.x, y: e.y + 4, vx: 0, vy: 30, g: 260, r: 2, kind: d.dropKind || 'bomb', col: d.bullet?.col });
      world.sfx('enemyShoot');
    }
  }
  if ((d.pattern === 'sine' || d.pattern === 'swoop') && d.bullet && d.fireEvery) {
    e.t -= dt;
    if (e.state === 'tele') {
      if (e.t <= 0) {
        fireBullet(world, e, e.x, e.y, aimAtPlayer(world, e, e.x, e.y));
        e.state = 'idle';
        e.t = d.fireEvery;
      }
    } else if (e.t <= 0 && world.onScreen(e.x, e.y, -20) && p.alive) {
      e.state = 'tele';
      e.t = d.tele ?? 0.5;
    }
  }
}

function flyHover(e, world, dt, bob) {
  const d = e.def;
  const p = world.player;
  // keep station ahead of the player at a set offset, then shoot
  const cam = world.camera;
  const goalX = Math.min(cam.x + VIEW_W - 30, Math.max(cam.x + 30, p.x + (d.offsetX ?? 90) * (e.spec.side || 1)));
  const goalY = e.baseY + bob;
  const k = Math.min(1, (d.follow ?? 1.6) * dt);
  e.x += (goalX - e.x) * k;
  e.y += (goalY - e.y) * k;
  e.face = p.x >= e.x ? 1 : -1;
  if (d.bullet) {
    fireMachine(
      e,
      world,
      dt,
      d,
      (en) => ({ x: en.x, y: en.y + 4 }),
      (en, m) => aimAtPlayer(world, en, m.x, m.y),
    );
  }
}

function flyDive(e, world, dt, bob) {
  const d = e.def;
  const p = world.player;
  if (!e.state || e.state === 'idle') e.state = 'cruise';
  switch (e.state) {
    case 'cruise': {
      e.x += e.face * d.speed * dt;
      e.y = e.baseY + bob;
      const dx = p.x - e.x;
      if (p.alive && world.onScreen(e.x, e.y, -10) && Math.abs(dx) < (d.diveRange || 110) && Math.sign(dx) === e.face) {
        e.state = 'tele';
        e.t = d.tele ?? 0.7;
        e.tx = p.x;
        e.ty = p.y - 12;
        world.sfx('telegraph');
      }
      break;
    }
    case 'tele': // hang in the air, flashing
      e.t -= dt;
      e.y += (e.baseY - 6 - e.y) * Math.min(1, 4 * dt);
      if (e.t <= 0) {
        const dx = e.tx - e.x;
        const dy = e.ty - e.y;
        const n = Math.hypot(dx, dy) || 1;
        e.vx = (dx / n) * d.diveSpeed;
        e.vy = (dy / n) * d.diveSpeed;
        e.state = 'dive';
        e.t = 1.1;
      }
      break;
    case 'dive':
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.t -= dt;
      if (e.t <= 0 || e.y >= e.ty + 20 || world.solidAtPx(e.x, e.y)) {
        e.state = 'retreat';
        e.t = 0;
      }
      break;
    default: // retreat: climb away in the facing direction
      e.vy += (-d.speed * 1.2 - e.vy) * Math.min(1, 3 * dt);
      e.x += e.face * d.speed * 1.3 * dt;
      e.y += e.vy * dt * 0.7;
  }
}

// ---- heavy ----
export function heavy(e, world, dt) {
  const d = e.def;
  const p = world.player;
  const dx = p.x - e.x;
  if (p.alive) e.face = dx >= 0 ? 1 : -1;
  const visible = world.onScreen(e.x, e.y, -8);
  let vx = 0;
  if (visible && d.speed > 0 && Math.abs(dx) > (d.keep || 40) && e.state === 'idle' && e.grounded) {
    vx = e.face * d.speed;
    if (!floorAhead(world, e) || e.hitWall) vx = 0;
  }
  if (d.bullet) {
    fireMachine(
      e,
      world,
      dt,
      d,
      (en) => ({ x: en.x + en.face * (d.muzzleX ?? 14), y: en.y - (d.muzzleY ?? en.h * 0.6) }),
      (en, m) => aimAtPlayer(world, en, m.x, m.y),
    );
  }
  e.vx = vx;
  groundPhysics(e, world, dt);
}

// ---- spawner ----
export function spawner(e, world, dt) {
  const d = e.def;
  e.anim += dt;
  if (!world.onScreen(e.x, e.cy, -4)) return;
  e.t -= dt;
  e.kids = (e.kids || []).filter((k) => k.alive);
  if (e.t <= 0 && e.kids.length < (d.max || 3) && world.enemies.length < (world.enemyCap || 10)) {
    e.t = d.interval * (0.85 + world.rand() * 0.3);
    e.puff = 0.25;
    const kid = spawnEnemy(world, {
      type: d.spawns,
      x: e.x + (d.spawnDx || 0) * e.face,
      y: e.y - (d.spawnDy || 0),
      face: e.face,
      gdir: e.gdir,
      ...(d.spawnSpec || {}),
    });
    e.kids.push(kid);
    world.sfx('capsule');
  }
  if (e.puff > 0) e.puff -= dt;
  const p = world.player;
  if (p.alive) e.face = p.x >= e.x ? 1 : -1;
  e.vx = e.vy = 0;
}

// ---- faller: icicles and other things that wait overhead, shake, then drop ----
export function faller(e, world, dt) {
  const d = e.def;
  const p = world.player;
  if (e.state === 'idle') {
    e.noContact = true;
    if (p.alive && Math.abs(p.x - e.x) < (d.trigger ?? 30) && p.y > e.y && world.onScreen(e.x, e.y, 0)) {
      e.state = 'tele';
      e.t = d.tele ?? 0.7;
      world.sfx('telegraph');
    }
  } else if (e.state === 'tele') {
    e.noContact = true;
    e.t -= dt;
    if (e.t <= 0) {
      e.state = 'fall';
      e.vy = 40;
      e.noContact = false;
    }
  } else {
    e.vy = Math.min(d.maxFall ?? 480, e.vy + 900 * dt);
    e.y += e.vy * dt;
    const t = world.tile(Math.floor(e.x / TILE), Math.floor(e.y / TILE));
    if (SOLID[t] || ONEWAY[t] || e.y > world.rows * TILE) {
      // shatter on whatever it hit
      for (let i = 0; i < 6; i++) {
        pushPx(world, { k: 'px', x: e.x, y: e.y - 2, vx: (world.fxRand() - 0.5) * 120, vy: -60 - world.fxRand() * 80, g: 400, life: 0.5, max: 0.5, col: world.fxRand() < 0.5 ? '#ffffff' : '#bfeaff', s: 2 });
      }
      world.sfx('shatter');
      e.alive = false;
    }
  }
}

// ---- crusher: a stone block that hangs overhead and slams down on a rhythm ----
//   spec.drop = how far it falls (px), spec.period = seconds between slams, spec.phase = seconds to offset the rhythm.
//   up -> shake for `tele` s (dust, floor marker) -> fall -> rest on the floor -> rise. Only the fall and the rest crush.
export function crusher(e, world, dt) {
  const d = e.def;
  const drop = e.spec.drop ?? 64;
  if (e.top === undefined) {
    e.top = e.y; // bottom edge of the block while raised
    e.state = 'up';
    e.t = (e.spec.phase ?? 0) + (d.up ?? 1.2);
  }
  e.noContact = true; // the block hurts through its own rule below, not by touch
  const p = world.player;
  switch (e.state) {
    case 'up':
      e.y = e.top;
      e.t -= dt;
      if (e.t <= 0 && world.onScreen(e.x, e.y, 20)) {
        e.state = 'tele';
        e.t = d.tele ?? 0.8;
        world.sfx('rumble');
      } else if (e.t <= 0) e.t = 0.2;
      break;
    case 'tele': {
      e.t -= dt;
      e.shake = Math.sin(e.t * 90) > 0 ? 1 : -1;
      if (e.t <= 0) {
        e.state = 'fall';
        e.vy = 60;
        e.shake = 0;
      }
      break;
    }
    case 'fall':
      e.vy = Math.min(520, e.vy + 1800 * dt);
      e.y += e.vy * dt;
      if (e.y >= e.top + drop) {
        e.y = e.top + drop;
        e.state = 'rest';
        e.t = d.rest ?? 0.55;
        world.camera.shake(3, 0.2);
        world.sfx('stomp');
        for (let i = 0; i < 8; i++) {
          pushPx(world, { k: 'px', x: e.x + (world.fxRand() - 0.5) * e.w, y: e.y, vx: (world.fxRand() - 0.5) * 90, vy: -30 - world.fxRand() * 50, g: 300, life: 0.45, max: 0.45, col: '#d8c08a', s: 2 });
        }
      }
      break;
    case 'rest':
      e.t -= dt;
      if (e.t <= 0) e.state = 'rise';
      break;
    default: // rise
      e.y -= 55 * dt;
      if (e.y <= e.top) {
        e.y = e.top;
        e.state = 'up';
        e.t = d.up ?? 1.2;
      }
  }
  // the crush: only while it is falling or resting on the floor
  if ((e.state === 'fall' || e.state === 'rest') && p.alive) {
    const hb = p.hurtBox();
    const b = e.hitBox();
    if (hb.x1 > b.x0 + 2 && hb.x0 < b.x1 - 2 && hb.y1 > b.y0 + 4 && hb.y0 < b.y1) world.hurtPlayer('crushed');
  }
  e.vx = 0;
}

// ---- charger: walks toward the player, rears up (telegraph), then charges in a straight line ----
//   War elephants stop at the arena wall and are winded for `rest` s; rival chariots (passThrough) thunder across the
//   whole screen and leave it. d: speed (walk), charge (px/s), chargeT, tele, rest, walkT, minCharge.
export function charger(e, world, dt) {
  const d = e.def;
  const p = world.player;
  const cam = world.camera;
  const dx = p.x - e.x;
  e.t -= dt;
  e.vx = 0;
  if (!e.charger) {
    e.charger = true;
    e.state = 'idle';
    e.t = e.spec.delay ?? (d.passThrough ? 0.5 + world.rand() * 0.5 : 1.0);
  }
  const visible = world.onScreen(e.x, e.cy, -8);
  const inside = e.x > cam.x + e.w / 2 && e.x < cam.x + VIEW_W - e.w / 2;
  if (inside) e.entered = true;
  switch (e.state) {
    case 'idle':
      if (d.passThrough) {
        // already facing the way it will run: toward the middle of the screen
        e.face = e.x > cam.x + VIEW_W / 2 ? -1 : 1;
        if (e.t <= 0 && p.alive) {
          e.state = 'tele';
          e.t = d.tele;
          world.sfx('telegraph');
        }
        break;
      }
      if (p.alive) e.face = dx >= 0 ? 1 : -1;
      if (d.speed > 0 && floorAhead(world, e)) e.vx = e.face * d.speed * e.speedMul;
      if (e.t <= 0 && visible && p.alive && Math.abs(dx) > (d.minCharge ?? 70)) {
        e.state = 'tele';
        e.t = d.tele;
        world.sfx('telegraph');
      }
      break;
    case 'tele':
      if (!d.passThrough && p.alive) e.face = dx >= 0 ? 1 : -1; // commits to a direction when the wind-up ends
      if (e.t <= 0) {
        e.state = 'charge';
        e.t = d.chargeT;
        e.anim = 0;
        world.sfx('stomp');
      }
      break;
    case 'charge':
      e.vx = e.face * d.charge * e.speedMul;
      e.anim += dt * 9;
      if (d.passThrough) {
        // it leaves the screen on the far side (or, at the very start of a level, runs off the end of the world)
        const gone = e.face < 0 ? e.x < cam.x - 40 : e.x > cam.x + VIEW_W + 40;
        if ((gone && e.entered) || (e.entered && e.hitWall) || e.t <= -4) e.alive = false;
      } else if (e.t <= 0 || e.hitWall) {
        e.state = 'rest';
        e.t = d.rest;
      }
      break;
    default: // rest
      if (e.t <= 0) {
        e.state = 'idle';
        e.t = d.walkT ?? 1.8;
      }
  }
  groundPhysics(e, world, dt);
  if (!d.passThrough && e.entered) {
    // arena walls: a charger never leaves the screen it entered
    const lo = cam.x + e.w / 2;
    const hi = cam.x + VIEW_W - e.w / 2;
    if (e.x < lo || e.x > hi) {
      e.x = Math.min(hi, Math.max(lo, e.x));
      if (e.state === 'charge') {
        e.state = 'rest';
        e.t = d.rest;
        world.camera.shake(3, 0.25);
        world.sfx('stomp');
      }
    }
  }
}

// ---- launcher: a crate of fireworks. Fuse hisses (telegraph), then a rocket climbs and bursts into falling sparks ----
//   d: period (s between rockets), tele, range, rise (px the rocket climbs), burst (sparks). spec.rise overrides, spec.tilt drifts it sideways.
export function launcher(e, world, dt) {
  const d = e.def;
  const p = world.player;
  const visible = world.onScreen(e.x, e.cy, -8);
  e.t -= dt;
  if (e.state === 'idle') {
    if (visible && p.alive && e.t <= 0 && Math.abs(p.x - e.x) < (d.range ?? 300)) {
      e.state = 'tele';
      e.t = d.tele ?? 0.85;
      world.sfx('telegraph');
    }
  } else if (e.state === 'tele') {
    // a hissing fuse: sparks spit from the tube
    if (world.rand() < 0.5) {
      pushPx(world, { k: 'px', x: e.x + (world.fxRand() - 0.5) * 3, y: e.y - e.h - 2, vx: (world.fxRand() - 0.5) * 50, vy: -30 - world.fxRand() * 40, g: 160, life: 0.3, max: 0.3, col: world.fxRand() < 0.5 ? '#ffe27a' : '#ffffff', s: 1 });
    }
    if (e.t <= 0) {
      const rise = e.spec.rise ?? d.rise ?? 100;
      const tilt = (e.spec.tilt ?? 0) * (e.face || 1);
      const fuse = fuseForRise(rise);
      launchRocket(world, e.x, e.y - e.h, { tx: e.x + tilt, ty: e.y - e.h - rise, fuse, n: d.burst ?? 6, burstSpeed: d.burstSpeed ?? 52 });
      e.recoil = 0.2;
      e.state = 'idle';
      e.t = (d.period ?? 3.2) * (0.9 + world.rand() * 0.2);
    }
  }
  if (e.recoil > 0) e.recoil -= dt;
  e.vx = 0;
  groundPhysics(e, world, dt);
}

// ---- breacher: hides under the water, ripples where it will surface (telegraph), then leaps out in an arc ----
//   Spawned with y = the water surface. d: range, tele, rest, leapV (up), leapVx (toward the soldier), g, depth.
export function breacher(e, world, dt) {
  const d = e.def;
  const p = world.player;
  if (e.base === undefined) {
    e.base = e.y;
    e.state = 'lurk';
    e.t = 0.4 + world.rand() * 0.8;
    e.trail = [];
  }
  e.anim += dt * 6;
  e.t -= dt;
  const visible = world.onScreen(e.x, e.base, -8);
  const surf = (n, vyMul = 1) => {
    for (let i = 0; i < n; i++) {
      pushPx(world, { k: 'px', x: e.x + (world.fxRand() - 0.5) * 14, y: e.base, vx: (world.fxRand() - 0.5) * 60, vy: (-50 - world.fxRand() * 70) * vyMul, g: 360, life: 0.5, max: 0.5, col: world.fxRand() < 0.5 ? '#ffffff' : '#bfe0f4', s: 2 });
    }
  };
  switch (e.state) {
    case 'lurk':
      e.hidden = true;
      e.noContact = true;
      e.vx = e.vy = 0;
      e.y = e.base + (d.depth ?? 14);
      if (visible && p.alive && e.t <= 0 && Math.abs(p.x - e.x) < (d.range ?? 150)) {
        e.state = 'tele';
        e.t = d.tele ?? 0.8;
        e.face = p.x >= e.x ? 1 : -1;
        world.sfx('telegraph');
      }
      break;
    case 'tele': // bubbles and a swelling ripple on the surface
      if (world.rand() < 0.45) surf(1, 0.5);
      if (e.t <= 0) {
        e.state = 'leap';
        e.hidden = false;
        e.noContact = false;
        e.y = e.base;
        e.vy = -d.leapV;
        e.vx = e.face * d.leapVx;
        e.trail = [];
        surf(8);
        world.sfx('stomp');
      }
      break;
    default: {
      e.vy += (d.g ?? 520) * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.trail.unshift({ x: e.x, y: e.y });
      if (e.trail.length > 16) e.trail.length = 16;
      if (e.vy > 0 && e.y >= e.base) {
        surf(7);
        e.state = 'lurk';
        e.t = d.rest ?? 1.8;
        e.hidden = true;
        e.noContact = true;
        e.trail = [];
      }
    }
  }
}

// ---- duelist: a samurai that stalks, telegraphs, and dashes in a flat slash ----
export function duelist(e, world, dt) {
  const d = e.def;
  const p = world.player;
  const dx = p.x - e.x;
  const visible = world.onScreen(e.x, e.y, -8);
  e.t -= dt;
  let vx = 0;
  switch (e.state) {
    case 'tele':
      vx = 0;
      if (e.t <= 0) {
        e.state = 'dash';
        e.t = d.dashT ?? 0.45;
        world.sfx('swing');
      }
      break;
    case 'dash':
      vx = e.face * (d.dash ?? 240);
      if (e.t <= 0 || e.hitWall || !floorAhead(world, e, 6)) {
        e.state = 'rest';
        e.t = d.rest ?? 1.1;
        vx = 0;
      }
      break;
    case 'rest':
      vx = 0;
      if (e.t <= 0) {
        e.state = 'idle';
        e.t = 0.3;
      }
      break;
    default: {
      // stalk the soldier, blade up, until close enough to strike
      if (p.alive && Math.abs(dx) < (d.aggro ?? 300) && Math.abs(p.y - e.y) < 90) {
        e.face = dx >= 0 ? 1 : -1;
        if (visible && Math.abs(dx) < (d.range ?? 150) && Math.abs(dx) > 24 && e.t <= 0) {
          e.state = 'tele';
          e.t = d.tele ?? 0.7;
          world.sfx('telegraph');
        } else if (Math.abs(dx) > 40 && visible && floorAhead(world, e)) {
          vx = e.face * d.speed;
        }
      }
    }
  }
  e.vx = vx;
  groundPhysics(e, world, dt);
}

// ---- mine: a landmine lying in the ground ----
//   It sits quietly until a soldier (or a tank) is within `trig` px of it, then pops out of the ground and beeps for `tele`
//   seconds before it bursts, so running on is safe and a shot from a distance (one hit point) sets it off harmlessly.
//   def.blast = radius of the burst in px.
export function mine(e, world, dt) {
  const d = e.def;
  const p = world.player;
  e.noContact = true; // it hurts through its own burst, never by touch
  if (e.lift === undefined) e.lift = 0;
  e.age = (e.age || 0) + dt;
  if (e.state === 'idle') {
    if (p.alive && world.onScreen(e.x, e.y, 0) && Math.abs(p.x - e.x) < (d.trig ?? 26) + p.w / 2 && p.y > e.y - 24 && p.y < e.y + 14) {
      e.state = 'tele';
      e.t = d.tele ?? 0.5;
      world.sfx('telegraph');
    }
  } else if (e.state === 'tele') {
    e.t -= dt;
    e.lift = Math.min(10, e.lift + 70 * dt);
    if (e.t <= 0) killEnemy(world, e); // d.onDeath does the damage
  }
  e.vx = 0;
  e.vy = 0;
}

/** The burst of a mine (also when it is shot): hurts a soldier or tank within `blast` px and sets off nearby mines. */
export function mineBlast(world, e) {
  const r = e.def.blast ?? 30;
  const cx = e.x;
  const cy = e.y - 6;
  ring(world, cx, cy, '#ffd890', r, 0.3);
  explosion(world, cx, cy, 1);
  spark(world, cx, cy, '#d8c08a', 8, 90);
  world.camera.shake(3, 0.25);
  const p = world.player;
  if (p.alive) {
    const hb = p.hurtBox();
    const nx = Math.max(hb.x0, Math.min(cx, hb.x1));
    const ny = Math.max(hb.y0, Math.min(cy, hb.y1));
    if (Math.hypot(nx - cx, ny - cy) <= r) world.hurtPlayer('mine');
  }
  for (const o of world.enemies) {
    if (!o.alive || o === e || o.def.id !== 'mine' || o.state === 'tele') continue;
    if (Math.hypot(o.x - cx, o.y - cy) <= r) {
      o.state = 'tele';
      o.t = 0.15; // a chain reaction, a beat later
    }
  }
}

// ---- the flying weapon capsule ----
export function capsule(e, world, dt) {
  e.age = (e.age || 0) + dt;
  e.anim += dt * 6; // wing flap
  if (e.baseY === undefined) e.baseY = e.y;
  const sp = e.def.speed * (e.spec.speedMul || 1);
  e.x += e.face * sp * dt;
  e.y = e.baseY + Math.sin(e.age * 2.6 + (e.spec.phase || 0)) * (e.spec.amp ?? 22);
}

export const ARCH = {
  runner,
  shooter,
  turret,
  flyer,
  heavy,
  spawner,
  capsule,
  faller,
  crusher,
  charger,
  launcher,
  breacher,
  duelist,
  mine,
  // <<ARCH>> (registry: new archetypes are added above this line)
};
