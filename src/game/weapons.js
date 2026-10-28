// Player weapons. Each weapon has a cooldown and a fire() that spawns bullets through the world.
// Week 2: Rifle. Week 4: Machine Gun, Spread, Laser, Flame, Homing (the pickup letters M S L F H).
// Weeks 7-13 add the era weapons (E) through the registry below: one per group of four levels, picked up as an
// 'E' capsule that resolves to the weapon of the era you are in (see eraWeaponFor).

import { chainZap } from './tesla.js';
import { plasmaBurst } from './plasma.js';

const TAU = Math.PI * 2;

function angleOf(m) {
  return Math.atan2(m.dy, m.dx);
}

function shoot(world, m, angle, speed, props) {
  return world.spawnBullet({
    x: m.x,
    y: m.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ...props,
  });
}

/** Burning enemies take a little damage over time (see enemies.js). */
function ignite(b, world, e) {
  if (e.def.noBurn) return;
  e.burnT = 1.6;
}

/** Steer a homing missile toward the nearest visible enemy. */
function steer(b, world, dt) {
  let best = null;
  let bestD = 280 * 280;
  for (const e of world.enemies) {
    if (!e.alive || e.hidden || e.def.contact === false) continue;
    if (!world.onScreen(e.x, e.cy, -6)) continue;
    const dx = e.x - b.x;
    const dy = e.cy - b.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  b.speed = Math.min(b.maxSpeed, b.speed + 240 * dt);
  if (best) {
    const want = Math.atan2(best.cy - b.y, best.x - b.x);
    let diff = want - b.ang;
    diff = ((((diff + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    const turn = b.turn * dt;
    b.ang += Math.max(-turn, Math.min(turn, diff));
  }
  b.vx = Math.cos(b.ang) * b.speed;
  b.vy = Math.sin(b.ang) * b.speed;
}

export const WEAPONS = {
  rifle: {
    name: 'RIFLE',
    letter: '',
    color: '#ffe66b',
    cooldown: 0.2,
    sfx: 'shoot',
    fire(world, m) {
      world.spawnBullet({ x: m.x, y: m.y, vx: m.dx * 340, vy: m.dy * 340, dmg: 1, life: 1.2, kind: 'rifle' });
    },
  },

  machine: {
    name: 'MACHINE GUN',
    letter: 'M',
    color: '#cfe8ff',
    badge: '#4a7ad8',
    cooldown: 0.105,
    sfx: 'shootMg',
    fire(world, m) {
      const a = angleOf(m) + (world.rand() - 0.5) * 0.13;
      shoot(world, m, a, 360, { dmg: 1, life: 0.85, kind: 'mg' });
    },
  },

  spread: {
    name: 'SPREAD',
    letter: 'S',
    color: '#7dff7a',
    badge: '#2fa84a',
    cooldown: 0.34,
    sfx: 'shootSpread',
    fire(world, m) {
      const a = angleOf(m);
      for (let i = -2; i <= 2; i++) shoot(world, m, a + i * 0.21, 300, { dmg: 1, life: 0.75, kind: 'spread' });
    },
  },

  laser: {
    name: 'LASER',
    letter: 'L',
    color: '#5ad8ff',
    badge: '#1f9ac8',
    cooldown: 0.42,
    sfx: 'shootLaser',
    fire(world, m) {
      const a = angleOf(m);
      // a long thin hitbox along the beam's direction
      const w = Math.max(5, Math.abs(m.dx) * 22);
      const h = Math.max(5, Math.abs(m.dy) * 22);
      shoot(world, m, a, 640, { dmg: 3, life: 0.5, pierce: 8, w, h, kind: 'laser' });
    },
  },

  flame: {
    name: 'FLAME',
    letter: 'F',
    color: '#ff9a1e',
    badge: '#e0701a',
    cooldown: 0.06,
    sfx: 'shootFlame',
    fire(world, m) {
      const a = angleOf(m) + (world.rand() - 0.5) * 0.4;
      const sp = 150 + world.rand() * 70;
      shoot(world, m, a, sp, { dmg: 0.35, life: 0.3, pierce: 3, w: 9, h: 9, kind: 'flame', onHit: ignite });
    },
  },

  homing: {
    name: 'HOMING',
    letter: 'H',
    color: '#b58aff',
    badge: '#8a5ae0',
    cooldown: 0.55,
    sfx: 'shootHoming',
    fire(world, m) {
      const a = angleOf(m);
      shoot(world, m, a, 150, {
        dmg: 3,
        life: 2.2,
        w: 6,
        h: 6,
        kind: 'homing',
        ang: a,
        speed: 150,
        maxSpeed: 250,
        turn: 4.2,
        update: steer,
      });
    },
  },

  // ---- era weapons: the 'E' capsule gives the one for the current era ----
  spear: {
    name: 'FIRE SPEAR',
    letter: 'E',
    item: 'spear',
    era: 0,
    color: '#ffb04a',
    badge: '#d8641a',
    cooldown: 0.34,
    sfx: 'shootSpear',
    light: 46, // lights dark caves while in flight
    fire(world, m) {
      const a = angleOf(m);
      shoot(world, m, a, 380, { dmg: 3, life: 0.9, pierce: 2, w: 10, h: 6, g: 70, kind: 'spear', onHit: ignite });
    },
  },
  ballista: {
    name: 'BALLISTA BOLT',
    letter: 'E',
    item: 'ballista',
    era: 1,
    color: '#e8d8a0',
    badge: '#b08a3a',
    cooldown: 0.5,
    sfx: 'shootBolt',
    light: 22,
    fire(world, m) {
      const a = angleOf(m);
      // a heavy iron-shod bolt: flat and fast, punches through a whole line of enemies and through armour plates
      shoot(world, m, a, 520, { dmg: 4, life: 0.75, pierce: 6, w: 16, h: 6, kind: 'ballista', armorPierce: true });
    },
  },
  crossbow: {
    name: 'CROSSBOW VOLLEY',
    letter: 'E',
    item: 'crossbow',
    era: 2,
    color: '#c8d8f0',
    badge: '#6a82a8',
    cooldown: 0.46,
    sfx: 'shootBolt',
    light: 20,
    fire(world, m) {
      const a = angleOf(m);
      // three quarrels loosed together in a tight fan: a wall of steel at short range, a few stray bolts at long range
      for (let i = -1; i <= 1; i++) shoot(world, m, a + i * 0.13, 470, { dmg: 1.2, life: 0.7, pierce: 1, w: 12, h: 5, kind: 'crossbow' });
    },
  },
  tesla: {
    name: 'TESLA COIL',
    letter: 'E',
    item: 'tesla',
    era: 3,
    color: '#9ad8ff',
    badge: '#4a8ae8',
    cooldown: 0.17,
    sfx: 'lightning',
    light: 30,
    fire(world, m) {
      const a = angleOf(m);
      // a short-ranged bolt that arcs on to the nearest enemies around whatever it hits
      shoot(world, m, a, 520, { dmg: 1.3, life: 0.5, w: 10, h: 8, kind: 'tesla', onHit: chainZap });
    },
  },
  plasma: {
    name: 'PLASMA CANNON',
    letter: 'E',
    item: 'plasma',
    era: 4,
    color: '#ff9af0',
    badge: '#c030c8',
    cooldown: 0.25,
    sfx: 'shootPlasma',
    light: 34,
    fire(world, m) {
      const a = angleOf(m);
      // a bright bolt that punches through armour and bursts where it lands, scorching the crowd around the victim
      shoot(world, m, a, 470, { dmg: 2.3, life: 0.8, pierce: 1, w: 12, h: 10, kind: 'plasma', armorPierce: true, onHit: plasmaBurst, onWall: plasmaBurst });
    },
  },
  // <<WEAPONS>> (registry: new weapons are added above this line)
};

/** Weapon id of an era group: levels 1-4 -> 0 (Fire Spear), 5-8 -> 1, 9-12 -> 2, 13-16 -> 3, 17-20 -> 4. */
export function eraGroupOf(levelIndex) {
  return levelIndex < 0 ? 0 : Math.min(4, Math.floor(levelIndex / 4));
}

/** The era weapon a level's 'E' capsule gives. Falls back to the newest weapon defined so far. */
export function eraWeaponFor(levelIndex) {
  const group = eraGroupOf(levelIndex);
  let best = null;
  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id];
    if (w.era === undefined) continue;
    if (w.era === group) return id;
    if (w.era < group) best = id;
  }
  return best || 'spear';
}

export function weaponDef(id) {
  return WEAPONS[id] || WEAPONS.rifle;
}

/** Weapon ids that can drop as pickups, keyed by their letter. */
export function weaponByLetter(letter) {
  for (const id of Object.keys(WEAPONS)) if (WEAPONS[id].letter === letter) return id;
  return null;
}
