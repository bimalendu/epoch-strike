// Procedural pixel art for the player (24x32 sprites, feet on the bottom row, facing right).
// Every frame is drawn flat and then run through `bake` (outline + top-left light), which pads it by PAD on the left, top
// and right. Guns are separate sprites (`guns.js`); the arm is drawn live along the aim.

import { Painter, blit, lineTo } from '../../engine/gfx.js';
import { bake, PAD } from './bake.js';
import { gunSprites, gunIndex, GUN_ORIGIN, GUN, GUNL } from './guns.js';
import { weaponDef } from '../weapons.js';

export { GUN, GUNL };

const SK = '#e9a97a', SKD = '#b5784f', SKL = '#f6c9a0', BAN = '#d92b2b', BAND = '#9c1c1c', BANL = '#f05a4a', HAIR = '#2b1d14';
const PANTS = '#2f55c8', PANTSD = '#223f96', PANTSL = '#4a72e0', BOOT = '#161616', BOOTL = '#3c3c44', BELT = '#7a4a1e', BELTL = '#a8702e';
const BUCKLE = '#e0b030', EYE = '#1a1a1a';

const RECOIL_TIME = 0.05; // seconds after a shot that the gun is pulled back 1 px

let cache = null;

/** Head with the bandana knot; `tail` = length of the two bandana tails (0..6), `flutter` = -1/0/1 rows they ride up or down. */
function head(p, dx = 0, dy = 0, tail = 4, flutter = 0) {
  p.ellipse(13 + dx, 6 + dy, 4, 4, SK);
  p.rect(9 + dx, 5 + dy, 1, 3, SKD); // shaded back of the head
  p.px(10 + dx, 6 + dy, SKD); // ear
  p.px(15 + dx, 8 + dy, SKL); // cheek light
  p.px(14 + dx, 6 + dy, '#f4f0f0');
  p.px(15 + dx, 6 + dy, EYE);
  p.px(17 + dx, 7 + dy, SKD); // nose
  p.px(16 + dx, 9 + dy, SKD); // mouth
  p.rect(9 + dx, 2 + dy, 9, 1, HAIR);
  p.px(8 + dx, 3 + dy, HAIR);
  p.rect(9 + dx, 3 + dy, 9, 2, BAN);
  p.rect(10 + dx, 3 + dy, 6, 1, BANL);
  p.rect(9 + dx, 4 + dy, 9, 1, BAND);
  p.rect(8 + dx, 3 + dy, 2, 3, BAN); // knot
  p.px(8 + dx, 5 + dy, BAND);
  if (tail > 0) {
    p.rect(8 - tail + dx, 4 + dy + flutter, tail, 1, BAN);
    p.rect(8 - tail + 1 + dx, 5 + dy + flutter * 2, Math.max(1, tail - 1), 1, BAND);
  }
}

function torso(p, dy = 0, backArm = 0) {
  p.rect(12, 10 + dy, 3, 1, SKD);
  // back arm, behind the chest
  p.rect(8, 12 + dy + backArm, 2, 5, SKD);
  p.px(8, 17 + dy + backArm, SK);
  p.rect(10, 11 + dy, 7, 9, SK);
  p.rect(10, 11 + dy, 1, 9, SKD);
  p.rect(15, 12 + dy, 1, 2, SKL); // chest light
  p.rect(12, 14 + dy, 4, 1, SKD); // pectoral line
  p.rect(13, 16 + dy, 1, 3, SKD); // abs
  p.rect(12, 17 + dy, 3, 1, SKD);
  p.line(10, 11 + dy, 16, 17 + dy, BELT, 1); // bandolier
  p.px(13, 14 + dy, BELTL);
  p.px(15, 16 + dy, BELTL);
  p.rect(10, 19 + dy, 7, 2, BELT);
  p.rect(10, 19 + dy, 7, 1, BELTL);
  p.rect(13, 19 + dy, 2, 2, BUCKLE);
  p.px(13, 19 + dy, '#fff0a0');
}

function leg(p, x, y, w, h, boot) {
  p.rect(x, y, w, h, PANTS);
  p.rect(x, y, 1, h, PANTSD);
  p.rect(x + w - 1, y, 1, h, PANTSL);
  if (h >= 4) p.px(x + 1, y + (h >> 1), PANTSD); // knee crease
  if (boot) {
    p.rect(boot.x, boot.y, boot.w, 3, BOOT);
    p.rect(boot.x, boot.y, boot.w, 1, BOOTL);
  }
}

// legs for the six run poses: contact, drive, passing, contact (narrower), drive, passing
const LEGS = [
  (p) => {
    leg(p, 13, 21, 3, 4); leg(p, 15, 25, 3, 4, { x: 15, y: 29, w: 5 });
    leg(p, 10, 21, 3, 4); leg(p, 8, 25, 3, 4, { x: 6, y: 29, w: 5 });
  },
  (p) => {
    leg(p, 12, 21, 3, 8, { x: 11, y: 29, w: 5 });
    leg(p, 10, 21, 3, 4); leg(p, 8, 25, 3, 3, { x: 7, y: 27, w: 5 });
  },
  (p) => {
    leg(p, 10, 21, 3, 8, { x: 9, y: 29, w: 5 });
    leg(p, 13, 21, 3, 4); leg(p, 13, 25, 3, 3, { x: 12, y: 27, w: 5 });
  },
  (p) => {
    leg(p, 10, 21, 3, 4); leg(p, 12, 25, 3, 4, { x: 12, y: 29, w: 5 });
    leg(p, 13, 21, 3, 4); leg(p, 14, 25, 3, 4, { x: 14, y: 29, w: 5 });
  },
  (p) => {
    leg(p, 14, 21, 3, 8, { x: 13, y: 29, w: 5 });
    leg(p, 10, 21, 3, 4); leg(p, 9, 25, 3, 3, { x: 8, y: 27, w: 5 });
  },
  (p) => {
    leg(p, 11, 21, 3, 8, { x: 10, y: 29, w: 5 });
    leg(p, 13, 21, 3, 4); leg(p, 15, 25, 3, 3, { x: 15, y: 27, w: 5 });
  },
];
const RUN_BOB = [0, 0, -1, 0, 0, -1];
const RUN_ARM = [2, 0, -1, -2, 0, 1]; // back arm swing
const RUN_TAIL = [0, -1, 0, 1, 0, -1];

/** The tucked somersault: a rolled ball of body with the knees and the bandana showing, `k` of 8 steps round. */
function ballFrame(k) {
  const p = new Painter(24, 32);
  const th = (k * Math.PI) / 4;
  const c = Math.cos(th), s = Math.sin(th);
  const cx = 12, cy = 16;
  const at = (d) => [Math.round(cx + c * d), Math.round(cy + s * d)];
  p.ellipse(cx, cy, 5, 5, SK);
  p.ellipse(cx, cy, 5, 5, SK);
  const [hx, hy] = at(-5);
  const [kx, ky] = at(4);
  p.ellipse(kx, ky, 3, 3, PANTS);
  const [bx, by] = at(7);
  p.rect(bx - 1, by - 1, 3, 2, BOOT);
  p.ellipse(hx, hy, 3, 3, SK);
  const [ax, ay] = at(-3);
  p.ellipse(ax, ay, 2, 2, SKD);
  // belt and bandana
  const [mx, my] = at(1);
  p.rect(mx - 2, my, 4, 1, BELT);
  p.rect(hx - 2, hy - 1, 5, 2, BAN);
  p.px(hx, hy - 1, BANL);
  const [tx, ty] = at(-9);
  p.rect(tx - 1, ty, 3, 1, BAN);
  const [wx, wy] = at(-11);
  p.px(wx, wy, BAND);
  // the shaded side of the roll
  const [ex, ey] = at(2);
  p.px(ex + Math.round(-s * 4), ey + Math.round(c * 4), SKD);
  return p.canvas;
}

/** A limp body in four 90-degree turns, arms and legs flung out. */
function deadFrame(k) {
  const p = new Painter(24, 32);
  const cx = 12, cy = 16;
  const rot = (x, y, w, h) => {
    for (let i = 0; i < k; i++) {
      const nx = -y - h, ny = x;
      x = nx; y = ny;
      const t = w; w = h; h = t;
    }
    return [cx + x, cy + y, w, h];
  };
  const part = (x, y, w, h, col) => p.rect(...rot(x, y, w, h), col);
  part(-9, 3, 5, 3, PANTS); part(-9, 3, 5, 1, PANTSL);
  part(-11, 3, 3, 3, BOOT);
  part(-6, -6, 4, 3, PANTS);
  part(-8, -7, 3, 3, BOOT);
  part(-4, -3, 8, 6, SK);
  part(-4, -3, 8, 1, SKL);
  part(-4, 2, 8, 1, SKD);
  part(-4, 1, 8, 2, BELT);
  part(4, -8, 2, 6, SK); // arms flung up
  part(4, 3, 2, 5, SKD);
  const [hx, hy] = rot(5, -2, 1, 1);
  p.ellipse(hx, hy, 3, 3, SK);
  const [bx, by, bw, bh] = rot(5, -3, 3, 2);
  p.rect(bx - 1, by - 1, bw + 2, bh + 1, BAN);
  p.px(hx + 1, hy + 1, EYE);
  return p.canvas;
}

function build() {
  const S = { idle: [], run: [], ball: [], dead: [] };
  const done = (p) => bake(p.canvas);

  // idle: two breathing frames (the head and chest ride up a pixel)
  for (let i = 0; i < 2; i++) {
    const p = new Painter(24, 32);
    head(p, 0, i, 3, i);
    torso(p, 0, 0);
    leg(p, 10, 21, 3, 8, { x: 9, y: 29, w: 5 });
    leg(p, 14, 21, 3, 8, { x: 13, y: 29, w: 5 });
    S.idle.push(done(p));
  }

  // run cycle, six frames
  for (let i = 0; i < 6; i++) {
    const p = new Painter(24, 32);
    const bob = RUN_BOB[i];
    head(p, 0, bob, 6, RUN_TAIL[i]);
    torso(p, bob, RUN_ARM[i]);
    LEGS[i](p);
    S.run.push(done(p));
  }

  for (let k = 0; k < 8; k++) S.ball.push(bake(ballFrame(k)));
  for (let k = 0; k < 4; k++) S.dead.push(bake(deadFrame(k)));

  // prone
  const p = new Painter(24, 32);
  p.rect(0, 25, 3, 5, BOOT);
  p.rect(0, 25, 3, 1, BOOTL);
  p.rect(3, 25, 9, 5, PANTS);
  p.rect(3, 25, 9, 1, PANTSL);
  p.rect(3, 29, 9, 1, PANTSD);
  p.rect(12, 24, 7, 6, SK);
  p.rect(12, 24, 7, 1, SKL);
  p.rect(12, 29, 7, 1, SKD);
  p.rect(11, 26, 1, 3, BELT);
  p.line(13, 24, 17, 28, BELT, 1); // bandolier
  p.ellipse(20, 26, 3, 3, SK);
  p.px(18, 28, SKD);
  p.rect(18, 23, 5, 2, BAN);
  p.rect(19, 23, 3, 1, BANL);
  p.rect(14, 24, 4, 1, BAND);
  p.rect(12, 23, 2, 1, BAND);
  p.px(22, 26, EYE);
  p.px(21, 26, '#f4f0f0');
  S.prone = done(p);

  return S;
}

export function playerSprites() {
  if (!cache) cache = build();
  return cache;
}

/** Draw the player (body + aimed gun arm). ox/oy = camera origin; `time` = world time, for the idle breathing. */
export function drawPlayer(ctx, pl, ox, oy, time = 0) {
  const S = playerSprites();
  const flipX = pl.face < 0;
  const flipY = pl.gdir < 0;
  const top = pl.spriteTop() - oy;
  const x = pl.x - ox;

  if (pl.mode === 'tank' || pl.mode === 'fly') return; // the tank and the hoverbike draw their rider

  const inAir = !pl.grounded && !pl.inWater;
  let img;
  if (pl.prone) img = S.prone;
  else if (inAir) img = S.ball[Math.floor(pl.anim) % S.ball.length];
  else if (pl.grounded && Math.abs(pl.vx) > 1) img = S.run[Math.floor(pl.anim) % S.run.length];
  else img = S.idle[Math.floor(time * 1.6) % S.idle.length];

  // the pad is on top, so a flipped (ceiling-walking) sprite has its feet row at `top` without it
  blit(ctx, img, x - 12 - PAD, top - (flipY ? 0 : PAD), flipX, flipY);

  if (!inAir) {
    const sh = pl.shoulder();
    const d = pl.aimVec();
    const wd = weaponDef(pl.weapon);
    const cd = wd.cooldown / (pl.rapid ? 1.5 : 1);
    const kick = pl.fireT > 0 && cd - pl.fireT < RECOIL_TIME ? 1 : 0;
    const sx = sh.x - ox - d.x * kick, sy = sh.y - oy - d.y * kick;
    // arm (shaded underside, then the lit forearm) then the gun sprite
    lineTo(ctx, sx, sy + 1, sx + d.x * 4, sy + d.y * 4 + 1, '#b5784f', 3);
    lineTo(ctx, sx, sy, sx + d.x * 4, sy + d.y * 4, '#e9a97a', 3);
    const g = gunSprites(pl.weapon)[gunIndex(d.x, d.y)];
    const mirror = d.x < -0.01 || (Math.abs(d.x) <= 0.01 && flipX);
    blit(ctx, g, Math.round(sx) - GUN_ORIGIN, Math.round(sy) - GUN_ORIGIN, mirror, false);
  }
}
