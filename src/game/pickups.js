// Pickups: weapon letters, R (rapid), B (barrier), bombs, medals and the 1UP heart.
// They drop from shot capsules (the flying kind) and destroyed pillboxes, or sit in the level.

import { TILE, PICKUP_RULES, SCORE, TANK } from './constants.js';
import { moveBody, overlap } from './physics.js';
import { weaponDef, weaponByLetter, eraWeaponFor, WEAPONS } from './weapons.js';
import { popup, ring } from './fx.js';

const WEAPON_LETTERS = ['M', 'S', 'L', 'F', 'H'];

/** Everything that can be picked up, keyed by item id. */
export const PICKUPS = {
  M: { kind: 'weapon', weapon: 'machine' },
  S: { kind: 'weapon', weapon: 'spread' },
  L: { kind: 'weapon', weapon: 'laser' },
  F: { kind: 'weapon', weapon: 'flame' },
  H: { kind: 'weapon', weapon: 'homing' },
  // 'E' is a placeholder for the era weapon of the current level; spawnPickup turns it into one of these
  spear: { kind: 'weapon', weapon: 'spear' },
  ballista: { kind: 'weapon', weapon: 'ballista' },
  crossbow: { kind: 'weapon', weapon: 'crossbow' },
  tesla: { kind: 'weapon', weapon: 'tesla' },
  plasma: { kind: 'weapon', weapon: 'plasma' },
  R: { kind: 'rapid', letter: 'R', color: '#ff9a1e' },
  B: { kind: 'barrier', letter: 'B', color: '#4aa8ff' },
  bomb: { kind: 'bomb', color: '#9aa4b8' },
  medal: { kind: 'medal', color: '#ffd23a' },
  '1up': { kind: 'life', color: '#ff4a6a' },
  tank: { kind: 'tank', color: '#8a9a5a', label: 'TANK' }, // a parked tank: touch it to climb in
};

export function pickupInfo(item) {
  const d = PICKUPS[item];
  if (!d) throw new Error(`Unknown pickup: ${item}`);
  if (d.kind === 'weapon') {
    const w = weaponDef(d.weapon);
    return { ...d, letter: w.letter, color: w.badge || w.color, label: w.name };
  }
  return d;
}

export class Pickup {
  constructor(item, x, y, opts = {}) {
    this.item = item;
    this.def = pickupInfo(item);
    this.x = x;
    this.y = y; // bottom
    this.w = item === 'tank' ? 30 : 12;
    this.h = item === 'tank' ? 20 : 12;
    this.vx = opts.vx || 0;
    this.vy = opts.vy ?? -120;
    this.gdir = 1;
    this.float = !!opts.float; // placed in the level: hovers instead of falling
    this.t = 0;
    this.alive = true;
    this.grounded = false;
  }

  box() {
    return { x0: this.x - this.w / 2, y0: this.y - this.h, x1: this.x + this.w / 2, y1: this.y };
  }
}

/** Create a pickup in the world. Medals do not exist on Hard. */
export function spawnPickup(world, item, x, y, opts = {}) {
  if (item === 'E') item = eraItem(world.level.id);
  if (item === 'medal' && !world.diff.medals) return null;
  const pk = new Pickup(item, x, y, opts);
  world.pickups.push(pk);
  return pk;
}

/** Item id of the era weapon for a level. */
export function eraItem(levelIndex) {
  const id = eraWeaponFor(levelIndex);
  return WEAPONS[id].item || WEAPONS[id].letter;
}

/** Pick a random weapon letter for capsules that did not name one. */
export function randomWeaponItem(world) {
  return WEAPON_LETTERS[Math.floor(world.rand() * WEAPON_LETTERS.length)];
}

export function updatePickups(world, dt) {
  const p = world.player;
  const hb = p.alive ? p.hurtBox() : null;
  for (const pk of world.pickups) {
    pk.t += dt;
    if (!pk.float) {
      pk.vy = Math.min(300, pk.vy + 700 * dt);
      pk.vx *= pk.grounded ? 0.8 : 1;
      moveBody(world, pk, dt);
      if (pk.grounded) pk.vy = 0;
      if (pk.y > world.rows * TILE + 64) pk.alive = false;
    }
    if (pk.x < world.camera.x - 80) pk.alive = false;
    if (hb && pk.alive && overlap(hb, pk.box())) collectPickup(world, pk);
  }
  let w = 0;
  for (let i = 0; i < world.pickups.length; i++) if (world.pickups[i].alive) world.pickups[w++] = world.pickups[i];
  world.pickups.length = w;
}

/** Apply a pickup to the player. Score and lives are handled by the scene through events. */
export function collectPickup(world, pk) {
  const p = world.player;
  const d = pk.def;
  pk.alive = false;
  const tx = p.x;
  const ty = p.y - 38;
  switch (d.kind) {
    case 'weapon': {
      const r = p.giveWeapon(d.weapon);
      world.sfx('weapon');
      popup(world, tx, ty, d.label, d.color);
      if (r === 'dup') world.events.push({ type: 'bonus', points: SCORE.DUPLICATE_WEAPON, x: tx, y: ty });
      break;
    }
    case 'rapid':
      p.rapid = true;
      world.sfx('pickup');
      popup(world, tx, ty, 'RAPID FIRE', d.color);
      break;
    case 'barrier':
      p.barrier = PICKUP_RULES.BARRIER_SECONDS;
      world.sfx('pickup');
      popup(world, tx, ty, 'BARRIER', d.color);
      break;
    case 'bomb':
      if (p.bombs < PICKUP_RULES.MAX_BOMBS) {
        p.bombs++;
        popup(world, tx, ty, 'BOMB', d.color);
      } else {
        world.events.push({ type: 'bonus', points: SCORE.DUPLICATE_WEAPON, x: tx, y: ty });
      }
      world.sfx('pickup');
      break;
    case 'medal':
      world.sfx('medal');
      world.events.push({ type: 'medal', x: pk.x, y: pk.y - 6 });
      break;
    case 'tank':
      if (p.mode === 'tank') {
        if (p.tankHp < TANK.HP) popup(world, tx, ty - 10, 'REPAIRED', d.color); // a spare tank is a repair
        p.tankHp = TANK.HP;
      } else {
        // a tank parked at the start of a tank road belongs to that road (it is left at the far end)
        const road = world.zones.find((z) => z.type === 'tank' && Math.abs(z.x0 - pk.x) < 3 * TILE) || null;
        p.mountTank(road);
        popup(world, tx, ty - 10, 'TANK!', '#ffd23a');
      }
      world.sfx('weapon');
      break;
    case 'life':
      world.events.push({ type: 'oneup', x: pk.x, y: pk.y - 6 });
      ring(world, pk.x, pk.y - 6, '#ff9ab0', 28, 0.5);
      break;
    default:
      break;
  }
  world.events.push({ type: 'pickup', item: pk.item });
}

export { weaponByLetter };
