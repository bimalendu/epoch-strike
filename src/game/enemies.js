// Enemy entities: creation, per-frame update, damage and death. The behaviours themselves live in ai.js
// (the ARCH registry maps an enemy def's `arch` name to its update function).

import { TILE, VIEW_W, VIEW_H } from './constants.js';
import { enemyDef } from './enemy_defs.js';
import { explosion, spark } from './fx.js';
import { spawnPickup, randomWeaponItem } from './pickups.js';
import { ARCH, mineBlast } from './ai.js';
import { bossDamage, bossDown } from './boss.js';
import { snooze } from './stealth.js';

export class Enemy {
  constructor(def, x, y, spec = {}) {
    this.def = def;
    this.id = def.id;
    this.arch = def.arch;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = def.w || 12;
    this.h = def.h || 26;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.face = spec.face || -1;
    this.gdir = spec.gdir || 1;
    this.alive = true;
    this.state = 'idle';
    this.t = def.firstDelay !== undefined ? def.firstDelay : 0.9;
    this.tele = def.tele || 0;
    this.anim = 0;
    this.flash = 0;
    this.grounded = false;
    this.hitWall = 0;
    this.jumpCd = 0;
    this.aimX = this.face;
    this.aimY = 0;
    this.shots = 0;
    this.spec = spec;
    this.hidden = !!spec.hidden;
    this.speedMul = 1;
    this.burnT = 0; // Flame weapon: seconds of burning left
    this.burnAcc = 0;
  }

  hitBox() {
    return { x0: this.x - this.w / 2, y0: this.y - this.h, x1: this.x + this.w / 2, y1: this.y };
  }

  /** The part that hurts on touch: bosses with a driver or rider standing above the body can make it shorter. */
  contactBox() {
    const h = this.def.contactH ?? this.h;
    return { x0: this.x - this.w / 2, y0: this.y - h, x1: this.x + this.w / 2, y1: this.y };
  }

  /** Centre of mass (aim target / effects). */
  get cy() {
    return this.y - this.h / 2;
  }
}

export function spawnEnemy(world, spec) {
  const def = enemyDef(spec.type);
  const e = new Enemy(def, spec.x, spec.y, spec);
  if (def.firstDelay === undefined) e.t = 0.6 + world.rand() * 0.6; // seeded: replays stay deterministic
  world.enemies.push(e);
  return e;
}

export function updateEnemies(world, dt) {
  const cam = world.camera;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.burnAcc += dt;
      if (e.burnAcc >= 0.2) {
        e.burnAcc -= 0.2;
        spark(world, e.x, e.cy, '#ff8a1e', 2, 30);
        damageEnemy(world, e, 0.3, null, true);
        if (!e.alive) continue;
      }
    }
    if (e.spec.sleeper && snooze(world, e, dt)) continue; // a guard that has not been woken does nothing
    const fn = ARCH[e.arch];
    if (fn) fn(e, world, dt);
    // despawn far behind the camera or far below the map
    if (e.x < cam.x - 160 || e.y > world.rows * TILE + 80 || e.x > cam.x + VIEW_W + 700) e.alive = false;
    // towers: whatever is left far below the climb (or far above it) is gone, so it cannot crowd the screen or snipe
    if (cam.tall && !e.def.boss && (e.y > cam.y + VIEW_H + 280 || e.y < cam.y - 420)) e.alive = false;
  }
}

/** Damage an enemy; returns true if it died. */
export function damageEnemy(world, e, dmg, bullet, quiet = false) {
  if (!e.alive) return false;
  if (e.def.indestructible) {
    if (bullet) spark(world, bullet.x, bullet.y, '#cfd8e0', 2);
    world.sfx('hitBoss');
    return false;
  }
  if (e.def.armorFront && bullet) {
    // shielded from the front: bullets travelling against facing are blocked
    if (Math.sign(bullet.vx) === -e.face && Math.abs(bullet.vx) > Math.abs(bullet.vy) * 1.2) {
      spark(world, bullet.x, bullet.y, '#cfd8e0', 3);
      world.sfx('hitBoss');
      return false;
    }
  }
  if (e.def.boss) {
    // bosses have their own rules: invulnerable intros, weak points, armour chip damage
    dmg = bossDamage(world, e, dmg, bullet);
    if (dmg <= 0) return false;
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.hp <= 0) bossDown(world, e);
    return false;
  }
  if (e.def.cycle && !e.open && bullet) {
    // closed pillboxes shrug bullets off
    spark(world, bullet.x, bullet.y, '#cfd8e0', 2);
    world.sfx('hitBoss');
    return false;
  }
  if (e.def.weak && bullet && !bullet.armorPierce) {
    // armoured: only shots that land on the glowing weak point do full damage
    const w = e.def.weak;
    const x0 = e.x + Math.min(w.x0 * e.face, w.x1 * e.face);
    const x1 = e.x + Math.max(w.x0 * e.face, w.x1 * e.face);
    const y0 = e.y + w.y0;
    const y1 = e.y + w.y1;
    if (!(bullet.x >= x0 && bullet.x <= x1 && bullet.y >= y0 && bullet.y <= y1)) {
      dmg *= e.def.armor ?? 0.25;
      spark(world, bullet.x, bullet.y, '#cfd8e0', 2);
    }
  }
  e.hp -= dmg;
  e.flash = 0.12;
  if (e.hp > 0) {
    if (!quiet) {
      spark(world, bullet ? bullet.x : e.x, bullet ? bullet.y : e.cy, '#ffe27a', 3);
      world.sfx('hit');
    }
    return false;
  }
  killEnemy(world, e);
  return true;
}

export function killEnemy(world, e, silent = false) {
  if (!e.alive) return;
  e.alive = false;
  const size = e.h > 40 ? 1 : 0;
  explosion(world, e.x, e.cy, size);
  if (!silent) world.sfx(size ? 'bigBoom' : 'boom');
  world.events.push({ type: 'kill', id: e.id, arch: e.arch, score: e.def.score ?? 100, x: e.x, y: e.cy, enemy: e });
  // enemies carrying an item (capsules, pillboxes) release it
  const item = e.spec.item === 'random' ? randomWeaponItem(world) : e.spec.item;
  if (item) spawnPickup(world, item, e.x, e.cy + 6, { vy: -140 });
  if (e.def.arch === 'mine') mineBlast(world, e);
  if (e.def.onDeath) e.def.onDeath(world, e);
}
