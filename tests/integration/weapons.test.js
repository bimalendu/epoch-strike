import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { flatLevel } from '../../src/game/ascii.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { WEAPONS, weaponDef } from '../../src/game/weapons.js';
import { TILE } from '../../src/game/constants.js';

function arena() {
  const world = new World(flatLevel(80, 14), { god: true });
  return { world, input: makeInput() };
}

function fireOnce(world, id) {
  world.player.slots = [id, null];
  world.player.slot = 0;
  world.bullets.length = 0;
  world.player.fireT = 0;
  world.playerFire();
  return world.bullets.slice();
}

test('every pickup weapon fires its own pattern', () => {
  const { world } = arena();
  assert.equal(fireOnce(world, 'rifle').length, 1);
  assert.equal(fireOnce(world, 'machine').length, 1);
  assert.equal(fireOnce(world, 'laser').length, 1);
  assert.equal(fireOnce(world, 'flame').length, 1);
  assert.equal(fireOnce(world, 'homing').length, 1);
  const fan = fireOnce(world, 'spread');
  assert.equal(fan.length, 5, 'spread is a 5-way fan');
  const angles = fan.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] > angles[i - 1] + 0.1, 'bullets fan out');
});

test('machine gun fires faster than the rifle, and rapid adds 50%', () => {
  const { world, input } = arena();
  const count = (id, rapid) => {
    world.player.slots = [id, null];
    world.player.slot = 0;
    world.player.rapid = rapid;
    world.player.fireT = 0;
    world.bullets.length = 0;
    let shots = 0;
    input.script = { fire: true };
    for (let i = 0; i < 60; i++) {
      input.poll();
      const before = world.player.fireT;
      world.update(input);
      if (world.player.fireT > before || (before <= 0 && world.player.fireT > 0)) shots++;
      world.events.length = 0;
    }
    return shots;
  };
  const rifle = count('rifle', false);
  const mg = count('machine', false);
  const rapidRifle = count('rifle', true);
  assert.ok(mg > rifle * 1.6, `mg ${mg} vs rifle ${rifle}`);
  assert.ok(rapidRifle >= Math.round(rifle * 1.35), `rapid ${rapidRifle} vs ${rifle}`);
});

test('laser pierces a line of enemies', () => {
  const { world, input } = arena();
  const y = 14 * TILE;
  const es = [14, 16, 18].map((tx) => spawnEnemy(world, { type: 'rifleman', x: tx * TILE, y }));
  es.forEach((e) => { e.t = 99; }); // stay quiet
  fireOnce(world, 'laser');
  run(world, input, seconds(0.6));
  assert.ok(es.every((e) => !e.alive), 'all three died to one beam');
});

test('a rifle shot only hits the first enemy in line', () => {
  const { world, input } = arena();
  const y = 14 * TILE;
  const es = [14, 16].map((tx) => spawnEnemy(world, { type: 'rifleman', x: tx * TILE, y }));
  es.forEach((e) => { e.t = 99; });
  fireOnce(world, 'rifle');
  run(world, input, seconds(0.7));
  assert.equal(es[0].hp, 1);
  assert.equal(es[1].hp, 2);
});

test('flame sets enemies burning and the burn finishes them', () => {
  const { world, input } = arena();
  const e = spawnEnemy(world, { type: 'rifleman', x: 7 * TILE, y: 14 * TILE });
  e.t = 99;
  const [b] = fireOnce(world, 'flame');
  b.x = e.x;
  b.y = e.cy; // put the flame on the target
  run(world, input, 2);
  assert.ok(e.burnT > 0 || !e.alive, 'ignited');
  run(world, input, seconds(2.5));
  assert.equal(e.alive, false, 'burned to death');
});

test('homing missiles curve toward the nearest enemy', () => {
  const { world, input } = arena();
  const e = spawnEnemy(world, { type: 'rifleman', x: world.player.x + 150, y: 14 * TILE - 70 });
  e.t = 99;
  world.player.aimX = 1;
  world.player.aimY = 0;
  const [b] = fireOnce(world, 'homing');
  run(world, input, seconds(1.6));
  assert.equal(e.alive, false, 'the missile found its target');
  assert.ok(b.dead);
});

test('weapon slots: pick up, swap, switch and lose the active one on death', () => {
  const { world } = arena();
  const p = world.player;
  assert.deepEqual(p.slots, ['rifle', null]);
  assert.equal(p.switchWeapon(), false, 'nothing to switch to yet');
  assert.equal(p.giveWeapon('spread'), 'new');
  assert.equal(p.weapon, 'spread');
  assert.equal(p.giveWeapon('laser'), 'swap', 'both slots full: replaces the active weapon');
  assert.deepEqual(p.slots, ['rifle', 'laser']);
  assert.equal(p.giveWeapon('rifle'), 'dup');
  assert.equal(p.weapon, 'rifle');
  assert.equal(p.switchWeapon(), true);
  assert.equal(p.weapon, 'laser');
  p.rapid = true;
  world.killPlayer('test');
  assert.equal(p.weapon, 'rifle', 'the active weapon drops back to the rifle');
  assert.equal(p.rapid, false);
  assert.deepEqual(p.slots.filter(Boolean), ['rifle']);
});

test('dying with a weapon in each slot keeps the other weapon', () => {
  const { world } = arena();
  const p = world.player;
  p.slots = ['machine', 'spread'];
  p.slot = 1;
  world.killPlayer('test');
  assert.deepEqual(p.slots, ['machine', 'rifle']);
  assert.equal(p.weapon, 'rifle');
});

test('the switch button swaps weapons in game', () => {
  const { world, input } = arena();
  world.player.giveWeapon('spread');
  assert.equal(world.player.weapon, 'spread');
  run(world, input, 2, ['switch']);
  assert.equal(world.player.weapon, 'rifle');
});

test('the loadout carries over and restores', () => {
  const { world } = arena();
  const p = world.player;
  p.giveWeapon('flame');
  p.bombs = 2;
  const l = p.loadout();
  const w2 = new World(flatLevel(40, 14), { loadout: l });
  assert.equal(w2.player.weapon, 'flame');
  assert.equal(w2.player.bombs, 2);
  assert.equal(w2.player.slots[0], 'rifle');
});

test('weapon definitions are complete', () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    assert.ok(w.name && w.cooldown > 0 && typeof w.fire === 'function', id);
    assert.equal(weaponDef(id), w);
  }
});

// ---------------------------------------------------------------- era weapons

import { eraWeaponFor, eraGroupOf } from '../../src/game/weapons.js';
import { spawnPickup, pickupInfo, PICKUPS } from '../../src/game/pickups.js';
import { levelCount } from '../../src/game/levels.js';

test('an E pickup resolves to the weapon of the era the level is in', () => {
  assert.equal(eraGroupOf(0), 0);
  assert.equal(eraGroupOf(3), 0);
  assert.equal(eraGroupOf(4), 1);
  assert.equal(eraGroupOf(19), 4);
  assert.equal(eraWeaponFor(0), 'spear');
  assert.equal(eraWeaponFor(3), 'spear');
  const { world } = arena();
  world.level.id = 2;
  const pk = spawnPickup(world, 'E', 100, 100);
  assert.equal(pk.item, 'spear');
  assert.equal(pickupInfo(pk.item).label, 'FIRE SPEAR');
  assert.equal(PICKUPS.spear.weapon, 'spear');
});

test('every level has an era weapon that is registered, named, and fires', () => {
  const { world } = arena();
  for (let i = 0; i < Math.max(levelCount(), 4); i++) {
    const id = eraWeaponFor(i);
    assert.ok(WEAPONS[id], `level ${i + 1} era weapon ${id} exists`);
    assert.equal(WEAPONS[id].letter, 'E');
    assert.ok(WEAPONS[id].name.length > 0);
    assert.ok(fireOnce(world, id).length >= 1, `${id} fires`);
  }
});

test('Fire Spear: heavy, piercing, ignites, and beats the rifle on damage per second', () => {
  const { world, input } = arena();
  const [b] = fireOnce(world, 'spear');
  assert.equal(b.kind, 'spear');
  assert.ok(b.dmg >= 3 && b.pierce >= 2);
  assert.ok(WEAPONS.spear.cooldown > WEAPONS.rifle.cooldown, 'a heavier, slower throw');
  assert.ok(b.dmg / WEAPONS.spear.cooldown > 1 / WEAPONS.rifle.cooldown, 'more damage per second than the rifle');
  // two riflemen in a line: one spear passes through both and sets them burning
  const y = 14 * TILE;
  const es = [14, 16].map((tx) => spawnEnemy(world, { type: 'rifleman', x: tx * TILE, y }));
  es.forEach((e) => { e.t = 99; e.hp = e.maxHp = 40; e.noBurn = false; });
  world.bullets.length = 0;
  fireOnce(world, 'spear');
  run(world, input, seconds(0.8));
  assert.ok(es.every((e) => e.hp < 40), `both hit (${es.map((e) => e.hp)})`);
  assert.ok(es.every((e) => e.burnT > 0), 'both burning');
});

test('Fire Spear carries a light for dark levels', () => {
  assert.ok(WEAPONS.spear.light > 20);
});
