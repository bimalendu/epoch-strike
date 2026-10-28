import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Painter, lightenedCopy, readPixels } from '../src/engine/gfx.js';
import { bake, bakeFrames } from '../src/game/art/bake.js';

const px = (img, x, y) => {
  const d = readPixels(img);
  const i = (y * img.width + x) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};

function block() {
  // a 6x6 canvas with a 4x4 block at (1,1)
  return new Painter(6, 6).rect(1, 1, 4, 4, '#c08040').canvas;
}

test('bake pads left, top and right but not the bottom', () => {
  const b = bake(block());
  assert.equal(b.width, 8);
  assert.equal(b.height, 7);
});

test('bake outlines only transparent pixels that touch the sprite', () => {
  const src = block();
  const b = bake(src);
  // sprite pixel (1,1) lands at (2,2); its left, top, right and bottom neighbours are the outline
  for (const [x, y] of [[1, 2], [2, 1], [5, 2], [2, 5]]) assert.equal(px(b, x, y)[3], 255, `outline at ${x},${y}`);
  assert.ok(px(b, 1, 2)[0] < 0x60, 'outline is dark');
  // pixels away from the sprite stay clear, and so do diagonal corners
  assert.equal(px(b, 0, 0)[3], 0);
  assert.equal(px(b, 7, 6)[3], 0);
  assert.equal(px(b, 1, 1)[3], 0);
});

test('bake lights the top edge and shades the bottom edge, and leaves the interior alone', () => {
  const b = bake(block());
  const base = [0xc0, 0x80, 0x40];
  const top = px(b, 3, 2);
  const mid = px(b, 3, 3);
  const bottom = px(b, 3, 5);
  assert.ok(top[0] > base[0], 'top lightened');
  assert.deepEqual(mid.slice(0, 3), base);
  assert.ok(bottom[0] < base[0], 'bottom darkened');
});

test('bake is deterministic', () => {
  const a = readPixels(bake(block()));
  const b = readPixels(bake(block()));
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('bakeFrames moves the anchors by the pad and shares baked frames', () => {
  const c = block();
  const f = bakeFrames({ idle: c, run: [c, c], w: 6, h: 6, ox: 3 });
  assert.equal(f.ox, 4);
  assert.equal(f.h, 7);
  assert.equal(f.idle.height, 7);
  assert.equal(f.run[0], f.idle);
  const boss = { idle: new Painter(2, 2).canvas, run: [], w: 80, h: 90, ox: 40 };
  assert.equal(bakeFrames(boss), boss);
});

test('lightenedCopy mixes toward white and keeps alpha', () => {
  const l = lightenedCopy(block(), 0.5);
  assert.deepEqual(px(l, 2, 2), [0xe0, 0xc0, 0xa0, 255]);
  assert.deepEqual(px(l, 0, 0), [0, 0, 0, 0]);
});

// ---- player ----
import { WEAPONS } from '../src/game/weapons.js';
import { playerSprites, drawPlayer } from '../src/game/art/player.js';
import { gunSprites, GUN_ART } from '../src/game/art/guns.js';
import { SoftCanvas } from '../tools/softcanvas.js';

test('every weapon has gun art at five angles, and an unknown weapon falls back to the rifle', () => {
  for (const id of Object.keys(WEAPONS)) {
    assert.ok(GUN_ART[id], `${id} has gun art`);
    assert.equal(gunSprites(id).length, 5);
  }
  assert.equal(gunSprites('no-such-weapon').length, 5);
});

test('the player has all its frames, baked', () => {
  const S = playerSprites();
  assert.equal(S.idle.length, 2);
  assert.equal(S.run.length, 6);
  assert.equal(S.ball.length, 8);
  assert.equal(S.dead.length, 4);
  for (const img of [...S.idle, ...S.run, ...S.ball, ...S.dead, S.prone]) {
    assert.equal(img.width, 26);
    assert.equal(img.height, 33);
  }
});

test('drawPlayer draws every weapon at the eight aims, upright and on the ceiling', () => {
  const c = new SoftCanvas(120, 80);
  const ctx = c.getContext('2d');
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  for (const id of Object.keys(WEAPONS)) {
    for (const [ax, ay] of dirs) {
      for (const gdir of [1, -1]) {
        for (const fireT of [0, WEAPONS[id].cooldown]) {
          const n = Math.hypot(ax, ay);
          const pl = {
            face: ax < 0 ? -1 : 1, gdir, mode: 'foot', grounded: true, inWater: false, prone: false, vx: 0, anim: 0,
            weapon: id, fireT, rapid: false, x: 60, y: 60,
            spriteTop() { return this.gdir > 0 ? this.y - 32 : this.y - 30; },
            shoulder() { return { x: this.x + this.face * 2, y: this.y - 21 }; },
            aimVec() { return { x: ax / n, y: ay / n }; },
          };
          assert.doesNotThrow(() => drawPlayer(ctx, pl, 0, 0, 1.2));
        }
      }
    }
  }
});

// ---- pickups ----
import { PICKUPS, pickupInfo } from '../src/game/pickups.js';
import { pickupIcon, drawPickup, warmPickups } from '../src/game/art/pickups.js';

test('every weapon and power-up badge is a 15x15 tile, and the five era badges all differ', () => {
  warmPickups();
  const era = ['spear', 'ballista', 'crossbow', 'tesla', 'plasma'];
  for (const [item, d] of Object.entries(PICKUPS)) {
    if (d.kind !== 'weapon' && d.kind !== 'rapid' && d.kind !== 'barrier') continue;
    const img = pickupIcon(item);
    assert.equal(img.width, 15, item);
    assert.equal(img.height, 15, item);
  }
  const sigs = era.map((id) => Array.from(readPixels(pickupIcon(id))).join(','));
  assert.equal(new Set(sigs).size, era.length);
  // the five icons also differ from each other once the colour is taken out: compare the lit icon pixels
  const lit = era.map((id) => {
    const d = readPixels(pickupIcon(id));
    let s = '';
    for (let y = 10; y < 13; y++) for (let x = 2; x < 13; x++) s += d[(y * 15 + x) * 4] > 200 || d[(y * 15 + x) * 4 + 1] > 200 ? 1 : 0;
    return s;
  });
  assert.equal(new Set(lit).size, era.length);
});

test('drawPickup draws every pickup at every moment of its animation', () => {
  const c = new SoftCanvas(60, 40);
  const ctx = c.getContext('2d');
  for (const item of Object.keys(PICKUPS)) {
    for (let t = 0; t < 3.5; t += 0.037) {
      const pk = { item, def: pickupInfo(item), x: 30, y: 30, t, float: true };
      assert.doesNotThrow(() => drawPickup(ctx, pk, 0, 0));
    }
  }
});
