// Procedural pixel art for the player (24x32 sprites, feet on the bottom row, facing right).

import { Painter, blit, lineTo } from '../../engine/gfx.js';

const SK = '#e9a97a', SKD = '#b5784f', BAN = '#d92b2b', BAND = '#9c1c1c', HAIR = '#2b1d14';
const PANTS = '#2f55c8', PANTSD = '#223f96', BOOT = '#161616', BELT = '#7a4a1e', BUCKLE = '#e0b030';
export const GUN = '#2a2a2e', GUNL = '#9a9aa6';

let cache = null;

function head(p, dx = 0, dy = 0) {
  p.ellipse(13 + dx, 6 + dy, 4, 4, SK);
  p.px(15 + dx, 6 + dy, '#1a1a1a');
  p.rect(9 + dx, 2 + dy, 9, 2, HAIR);
  p.rect(9 + dx, 3 + dy, 9, 2, BAN);
  p.rect(5 + dx, 4 + dy, 5, 1, BAN);
  p.rect(3 + dx, 5 + dy, 4, 1, BAND);
}

function torso(p, dy = 0) {
  p.rect(12, 10 + dy, 3, 1, SKD);
  p.rect(10, 11 + dy, 7, 9, SK);
  p.rect(10, 11 + dy, 1, 9, SKD);
  p.px(13, 14 + dy, SKD);
  p.rect(13, 16 + dy, 1, 3, SKD);
  p.rect(10, 19 + dy, 7, 2, BELT);
  p.px(13, 19 + dy, BUCKLE);
}

function leg(p, x, y, w, h, boot) {
  p.rect(x, y, w, h, PANTS);
  p.rect(x, y, 1, h, PANTSD);
  if (boot) p.rect(boot.x, boot.y, boot.w, 3, BOOT);
}

function build() {
  const S = { run: [], ball: [] };

  // idle
  let p = new Painter(24, 32);
  head(p);
  torso(p);
  leg(p, 10, 21, 3, 8, { x: 9, y: 29, w: 5 });
  leg(p, 14, 21, 3, 8, { x: 13, y: 29, w: 5 });
  S.idle = p.canvas;

  // run cycle
  const runs = [
    () => {
      // stride: right leg forward, left back
      leg(p, 13, 21, 3, 4);
      leg(p, 15, 25, 3, 4, { x: 15, y: 29, w: 5 });
      leg(p, 10, 21, 3, 4);
      leg(p, 8, 25, 3, 4, { x: 6, y: 29, w: 5 });
    },
    () => {
      // passing: back leg lifted
      leg(p, 10, 21, 3, 8, { x: 9, y: 29, w: 5 });
      leg(p, 13, 21, 3, 4);
      leg(p, 13, 25, 3, 3, { x: 12, y: 27, w: 5 });
    },
    () => {
      // stride: left leg forward, right back
      leg(p, 10, 21, 3, 4);
      leg(p, 12, 25, 3, 4, { x: 12, y: 29, w: 5 });
      leg(p, 13, 21, 3, 4);
      leg(p, 15, 25, 3, 4, { x: 14, y: 29, w: 5 });
    },
    () => {
      // passing: front leg lifted
      leg(p, 14, 21, 3, 8, { x: 13, y: 29, w: 5 });
      leg(p, 10, 21, 3, 4);
      leg(p, 9, 25, 3, 3, { x: 8, y: 27, w: 5 });
    },
  ];
  for (let i = 0; i < 4; i++) {
    p = new Painter(24, 32);
    const bob = i % 2 === 1 ? -1 : 0;
    head(p, 0, bob);
    torso(p, bob);
    runs[i]();
    S.run.push(p.canvas);
  }

  // somersault ball (4 rotations)
  for (let k = 0; k < 4; k++) {
    p = new Painter(24, 32);
    const cx = 12, cy = 16, r = 6;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r + 1) continue;
        const half = [y > 0, x < 0, y < 0, x > 0][k];
        p.px(cx + x, cy + y, half ? PANTS : SK);
      }
    }
    p.px(cx + [-2, -4, 2, 4][k], cy + [4, -2, -4, 2][k], BAN);
    p.px(cx + [2, 4, -2, -4][k], cy + [-4, 2, 4, -2][k], SKD);
    S.ball.push(p.canvas);
  }

  // prone
  p = new Painter(24, 32);
  p.rect(0, 25, 3, 5, BOOT);
  p.rect(3, 25, 9, 5, PANTS);
  p.rect(3, 25, 9, 1, PANTSD);
  p.rect(12, 24, 7, 6, SK);
  p.rect(12, 24, 7, 1, SKD);
  p.rect(11, 26, 1, 2, BELT);
  p.ellipse(20, 26, 3, 3, SK);
  p.rect(18, 23, 5, 2, BAN);
  p.rect(14, 24, 4, 1, BAND);
  p.px(22, 26, '#1a1a1a');
  S.prone = p.canvas;

  return S;
}

export function playerSprites() {
  if (!cache) cache = build();
  return cache;
}

/** Draw the player (body + aimed gun arm). ox/oy = camera origin. */
export function drawPlayer(ctx, pl, ox, oy) {
  const S = playerSprites();
  const flipX = pl.face < 0;
  const flipY = pl.gdir < 0;
  const top = pl.spriteTop() - oy;
  const x = pl.x - ox;

  if (pl.mode === 'tank' || pl.mode === 'fly') return; // the tank and the hoverbike draw their rider

  const inAir = !pl.grounded && !pl.inWater;
  let img;
  if (pl.prone) img = S.prone;
  else if (inAir) img = S.ball[Math.floor(pl.anim) % 4];
  else if (pl.grounded && Math.abs(pl.vx) > 1) img = S.run[Math.floor(pl.anim) % 4];
  else img = S.idle;

  blit(ctx, img, x - 12, top, flipX, flipY);

  if (!inAir) {
    const sh = pl.shoulder();
    const d = pl.aimVec();
    const sx = sh.x - ox, sy = sh.y - oy;
    // arm then gun barrel
    lineTo(ctx, sx, sy, sx + d.x * 4, sy + d.y * 4, SK, 3);
    lineTo(ctx, sx + d.x * 3, sy + d.y * 3, sx + d.x * 14, sy + d.y * 14, GUN, 2);
    lineTo(ctx, sx + d.x * 10, sy + d.y * 10, sx + d.x * 14, sy + d.y * 14, GUNL, 1);
  }
}
