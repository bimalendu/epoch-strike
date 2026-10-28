import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { World } from '../src/game/world.js';
import { flatLevel } from '../src/game/ascii.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { spawnPickup, PICKUPS, pickupInfo } from '../src/game/pickups.js';
import { TILE, PICKUP_RULES } from '../src/game/constants.js';

function arena(opts = {}) {
  const world = new World(flatLevel(80, 14), { god: false, ...opts });
  return { world, input: makeInput() };
}

function dropAtPlayer(world, item) {
  const p = world.player;
  return spawnPickup(world, item, p.x, p.y, { float: true });
}

test('a shot capsule releases its item, which falls to the ground and can be collected', () => {
  const { world, input } = arena({ god: true });
  const p = world.player;
  const cap = spawnEnemy(world, { type: 'capsule', x: p.x + 80, y: p.y - 60, item: 'S', face: -1 });
  assert.equal(cap.def.contact, false, 'capsules never hurt');
  // shoot upward-right at it
  p.aimX = 1;
  p.aimY = 0;
  cap.baseY = p.y - 20; // lower it into the line of fire
  cap.y = cap.baseY;
  cap.spec.amp = 0;
  run(world, input, seconds(0.6), ['fire']);
  assert.equal(cap.alive, false, 'the capsule was shot down');
  assert.equal(world.pickups.length, 1, 'it dropped its item');
  assert.equal(world.pickups[0].item, 'S');
  assert.equal(p.weapon, 'rifle', 'not collected yet');
  run(world, input, seconds(2));
  const item = world.pickups[0];
  assert.ok(item.grounded, 'the item fell and landed');
  // walk over it
  p.x = item.x;
  run(world, input, 3);
  assert.equal(p.weapon, 'spread');
  assert.equal(world.pickups.length, 0);
});

test('collecting a weapon letter equips it', () => {
  const { world, input } = arena();
  dropAtPlayer(world, 'L');
  run(world, input, 2);
  assert.equal(world.player.weapon, 'laser');
  assert.equal(world.pickups.length, 0);
});

test('picking up a weapon you already carry pays a small bonus instead', () => {
  const { world, input } = arena();
  world.player.giveWeapon('laser');
  dropAtPlayer(world, 'L');
  const ev = run(world, input, 2);
  assert.ok(ev.some((e) => e.type === 'bonus' && e.points === 500));
});

test('R gives +50% fire rate until death', () => {
  const { world, input } = arena();
  dropAtPlayer(world, 'R');
  run(world, input, 2);
  assert.equal(world.player.rapid, true);
  world.killPlayer('test');
  assert.equal(world.player.rapid, false);
});

test('B makes the player invincible for 10 seconds', () => {
  const { world, input } = arena();
  dropAtPlayer(world, 'B');
  run(world, input, 2);
  assert.ok(world.player.barrier > 9.5);
  assert.equal(world.hurtPlayer('enemy'), false);
  assert.equal(world.player.alive, true);
  run(world, input, seconds(PICKUP_RULES.BARRIER_SECONDS + 0.5));
  assert.equal(world.player.barrier, 0);
  world.player.invuln = 0;
  assert.equal(world.hurtPlayer('enemy'), true);
});

test('bombs stack to 3; extra ones are worth points', () => {
  const { world, input } = arena();
  const p = world.player;
  assert.equal(p.bombs, PICKUP_RULES.START_BOMBS);
  dropAtPlayer(world, 'bomb');
  run(world, input, 2);
  dropAtPlayer(world, 'bomb');
  run(world, input, 2);
  assert.equal(p.bombs, 3);
  dropAtPlayer(world, 'bomb');
  const ev = run(world, input, 2);
  assert.equal(p.bombs, 3);
  assert.ok(ev.some((e) => e.type === 'bonus'));
});

test('medals and the 1UP heart raise events for the run to handle', () => {
  const { world, input } = arena();
  dropAtPlayer(world, 'medal');
  let ev = run(world, input, 2);
  assert.ok(ev.some((e) => e.type === 'medal'));
  dropAtPlayer(world, '1up');
  ev = run(world, input, 2);
  assert.ok(ev.some((e) => e.type === 'oneup'));
});

test('there are no medals on Hard', () => {
  const { world } = arena({ difficulty: 'hard' });
  assert.equal(spawnPickup(world, 'medal', 100, 100), null);
  assert.ok(spawnPickup(world, 'bomb', 100, 100));
});

test('level data can place floating pickups', () => {
  const level = flatLevel(80, 14);
  level.spawns = [{ type: 'pickup', item: 'medal', x: 12 * TILE, y: 12 * TILE }];
  const world = new World(level, {});
  const input = makeInput();
  run(world, input, 2);
  assert.equal(world.pickups.length, 1);
  const y0 = world.pickups[0].y;
  run(world, input, 30);
  assert.equal(world.pickups[0].y, y0, 'floating pickups stay put');
});

test('the smart bomb clears bullets and damages everything on screen', () => {
  const { world, input } = arena({ god: true });
  const p = world.player;
  const near = spawnEnemy(world, { type: 'rifleman', x: p.x + 120, y: 14 * TILE });
  near.t = 99;
  const far = spawnEnemy(world, { type: 'rifleman', x: p.x + 900, y: 14 * TILE });
  far.t = 99;
  world.spawnEnemyBullet({ x: p.x + 60, y: p.y - 20, vx: 0, vy: 0, life: 5 });
  assert.equal(p.bombs, 1);
  const ev = run(world, input, 2, ['bomb']);
  assert.ok(ev.some((e) => e.type === 'bomb'));
  assert.equal(p.bombs, 0);
  assert.equal(world.ebullets.length, 0);
  assert.equal(near.alive, false);
  assert.equal(far.alive, true, 'enemies off screen are untouched');
});

test('with no bombs left the button does nothing', () => {
  const { world, input } = arena();
  world.player.bombs = 0;
  const ev = run(world, input, 2, ['bomb']);
  assert.ok(!ev.some((e) => e.type === 'bomb'));
});

test('every pickup definition resolves', () => {
  for (const id of Object.keys(PICKUPS)) assert.ok(pickupInfo(id).kind);
  assert.throws(() => pickupInfo('nope'));
});
