// Boss art. Bosses are drawn straight onto the canvas from rectangles every frame (they are big, animated by
// pose and few on screen), through a Brush that works in boss-local coordinates:
//   origin = centre of the feet, +x = the way the boss faces, -y = up. Mirroring for face < 0 is automatic.

import { Painter, lineTo } from '../../engine/gfx.js';
import { shade, mix } from './common.js';
import { flashCtx } from './hit.js';
import { flick } from './flash.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const inks = new Map();
/** The outline colour for a fill: the fill darkened hard. Cached, because a boss asks for the same few colours every frame. */
function ink(col) {
  let c = inks.get(col);
  if (!c) {
    c = mix(shade(col, -0.7), '#120e18', 0.5);
    inks.set(col, c);
  }
  return c;
}

export function brush(ctx, cx, cy, face) {
  const mx = (lx, w = 0) => Math.round(face > 0 ? cx + lx : cx - lx - w);
  const B = {
    r(lx, ly, w, h, col) {
      ctx.fillStyle = col;
      ctx.fillRect(mx(lx, w), Math.round(cy + ly), w, h);
    },
    disc(lx, ly, rad, col) {
      ctx.fillStyle = col;
      for (let y = -rad; y <= rad; y++) {
        const half = Math.round(Math.sqrt(Math.max(0, rad * rad - y * y)));
        ctx.fillRect(mx(lx - half, half * 2 + 1), Math.round(cy + ly + y), half * 2 + 1, 1);
      }
    },
    line(x0, y0, x1, y1, col, t = 1) {
      const ax = face > 0 ? cx + x0 : cx - x0;
      const bx = face > 0 ? cx + x1 : cx - x1;
      lineTo(ctx, ax, cy + y0, bx, cy + y1, col, t);
    },
    /** A silhouette mass: 1 px dark outline, the fill, a lit top edge and a shaded bottom edge (4 calls). */
    part(lx, ly, w, h, col) {
      B.r(lx - 1, ly - 1, w + 2, h + 2, ink(col));
      B.r(lx, ly, w, h, col);
      if (h > 3) {
        B.r(lx, ly, w, 1, shade(col, 0.22));
        B.r(lx, ly + h - 1, w, 1, shade(col, -0.25));
      }
    },
    /** An inner panel: the fill with a lit top and a shaded bottom, no outline (3 calls). */
    slab(lx, ly, w, h, col) {
      B.r(lx, ly, w, h, col);
      if (h > 3) {
        B.r(lx, ly, w, 1, shade(col, 0.22));
        B.r(lx, ly + h - 1, w, 1, shade(col, -0.25));
      }
    },
    /** A line with a dark under-stroke one pixel out on every side. */
    stroke(x0, y0, x1, y1, col, t = 1) {
      const ax = face > 0 ? cx + x0 : cx - x0;
      const bx = face > 0 ? cx + x1 : cx - x1;
      lineTo(ctx, ax - 1, cy + y0 - 1, bx - 1, cy + y1 - 1, ink(col), t + 2);
      lineTo(ctx, ax, cy + y0, bx, cy + y1, col, t);
    },
  };
  return B;
}

/** Shared per-frame state for drawing: pose timers, flash, jitter while dying. */
export function bossPose(e) {
  const bs = e.bs || { state: 'idle', age: 0, atk: null, t: 0, teleMax: 1, phase: 0 };
  const tele = bs.state === 'tele' ? 1 - Math.max(0, bs.t) / (bs.teleMax || 1) : bs.state === 'attack' ? 1 : 0;
  return { bs, tele, atk: bs.atk, state: bs.state, rage: bs.phase >= 2, mid: bs.phase >= 1 };
}

/** Wrap a boss draw function with hit-flash and death jitter. */
export function drawBoss(fn) {
  return (ctx, e, ox, oy, f) => {
    const pose = bossPose(e);
    let jx = 0;
    if (pose.state === 'dying') jx = Math.round(Math.sin(e.bs.age * 70) * 2);
    ctx = flashCtx(ctx, e);
    fn(ctx, e, Math.round(e.x - ox) + jx, Math.round(e.y - oy), pose, f);
    ctx.globalAlpha = 1;
  };
}

function dummy() {
  const p = new Painter(2, 2);
  return p.canvas;
}

export function bossFrames(w, h, draw) {
  const c = dummy();
  return { idle: c, run: [c], w, h, ox: w / 2, draw: drawBoss(draw) };
}

const WHITE = '#f4f0dc';

// ---- REX-7 ----
const TREX_MARKS = [
  { x: -18, y: -58, kind: 'crack', phase: 1 },
  { x: 14, y: -62, kind: 'plate', phase: 1 },
  { x: -2, y: -34, kind: 'scorch', phase: 2 },
  { x: -34, y: -58, kind: 'smoke', phase: 2 },
  { x: 40, y: -90, kind: 'spark', phase: 2 },
];

function drawTrex(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const skin = burn(pose.rage ? '#8a5a38' : '#5a7a3a');
  const dark = shade(skin, -0.32);
  const belly = burn('#c8c090');
  const armor = burn('#6a6e88');
  const glow = '#ff4adc';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const breath = breathe(pose, 1);
  const bob = (walking && frame % 2 === 1 ? 1 : 0) + (breath > 0 ? 1 : 0);

  let headUp = 0;
  let mouth = 0;
  let lift = 0;
  const { atk, tele, state } = pose;
  if (state === 'tele' || state === 'attack') {
    if (atk === 'stomp') lift = state === 'tele' ? Math.round(15 * tele) : 0;
    if (atk === 'spit') {
      headUp = Math.round(8 * tele);
      mouth = state === 'attack' ? 9 : Math.round(4 * tele);
    }
    if (atk === 'charge') headUp = -Math.round(9 * tele);
    if (atk === 'roar') {
      headUp = Math.round(12 * tele);
      mouth = 11;
    }
  }
  if (state === 'phase') {
    headUp = 12;
    mouth = 11;
  }
  if (state === 'dying') {
    headUp = 8 + Math.round(dead.k * 6);
    mouth = 6 + Math.round(dead.k * 5);
  }

  // tail
  B.part(-52, -62 - bob, 30, 16, skin);
  B.part(-70, -57 - bob, 20, 10, skin);
  B.part(-82, -53 - bob, 14, 6, skin);
  B.r(-52, -49 - bob, 30, 3, dark);
  // back leg
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.part(-16 + la, -26, 14, 21, dark);
  B.part(-16 + la, -5, 22, 5, shade(dark, -0.25));
  // torso
  B.part(-28, -66 - bob, 56, 42, skin);
  B.slab(-6, -46 - bob, 34, 22, belly);
  // armour plates along the back: they are what flies off when it falls
  for (let i = 0; i < 4; i++) {
    const fx = Math.round((i - 1.5) * dead.fly * 0.5);
    const fy = -Math.round(dead.fly * (0.7 + i * 0.15) - dead.k * dead.k * 40);
    B.part(-26 + i * 13 + fx, -74 - bob + fy, 9, 9, armor);
    B.r(-23 + i * 13 + fx, -70 - bob + fy, 3, 4, dead.k > 0.2 ? '#4a1a40' : glow);
  }
  // front leg (the stomping one)
  B.part(6 + lb, -26 - lift, 14, 21, skin);
  B.part(6 + lb, -5 - lift, 24, 5, dark);
  for (const x of [22, 26]) B.r(x + lb, -2 - lift, 2, 2, WHITE);
  // arm
  B.part(24, -44 - bob, 12, 4, skin);
  B.r(34, -43 - bob, 3, 3, WHITE);
  // neck and head
  const hy = -96 - headUp - bob;
  B.part(10, hy + 12, 18, -hy - 54 + bob > 0 ? -hy - 54 + bob : 8, skin);
  B.part(14, hy, 36, 16, skin);
  B.part(46, hy + 3, 7, 11, skin);
  B.part(16, hy - 3, 16, 4, armor);
  B.r(20, hy - 2, 3, 2, glow);
  if (mouth > 0) B.r(18, hy + 16, 30, mouth, '#3a0a14');
  B.part(16, hy + 16 + mouth, 32, 7, dark);
  for (let i = 0; i < 6; i++) {
    B.r(20 + i * 5, hy + 16, 2, 3, WHITE);
    B.r(22 + i * 5, hy + 14 + mouth + 2, 2, 3, WHITE);
  }
  // an eye: it blinks now and then while it idles, and goes white as a charge winds up
  const eyeFlash = atk === 'charge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  if (state === 'idle' && blink(pose.bs.age)) {
    B.r(34, hy + 5, 6, 1, dark);
  } else {
    B.r(34, hy + 3, 6, 5, eyeFlash ? '#ffffff' : pose.rage || atk === 'charge' ? '#ff3a3a' : '#ffd23a');
    B.r(37, hy + 4, 2, 3, '#111111');
  }
  // steam from the nostril: the signature puff
  if (state === 'idle') {
    const t = (pose.bs.age * 0.7) % 1;
    if (t < 0.7) B.disc(54, hy + 3 - Math.round(t * 10), 1 + (t > 0.35 ? 1 : 0), '#dfe6ee');
  }
  if (atk === 'spit' && (state === 'tele' || state === 'attack')) {
    B.disc(54, hy + 17 + mouth / 2, 2 + Math.round(tele * 3), glow);
    B.disc(54, hy + 17 + mouth / 2, 1, '#ffffff');
  }
  // belly core: armoured plate when closed, pulsing when open
  const open = e.def.weakBox(e) !== null;
  weakPoint(B, 8, -38, 22, 26, { open, col: glow, age: pose.bs.age, hit: e.flash || 0 });
  if (open) B.r(14, -31, 10, 12, '#ffffff');
  else for (const [x, y] of [[10, -34], [26, -34], [10, -18], [26, -18]]) B.r(x, y, 2, 2, shade(armor, 0.5));
  damageMarks(B, pose, TREX_MARKS);
}

// ---- MAGMA GOLEM ----
const GOLEM_MARKS = [
  { x: -20, y: -66, kind: 'crack', phase: 1 },
  { x: -36, y: -82, kind: 'plate', phase: 1 },
  { x: -6, y: -50, kind: 'scorch', phase: 2 },
  { x: 28, y: -84, kind: 'smoke', phase: 2 },
  { x: 14, y: -62, kind: 'spark', phase: 2 },
];

function drawGolem(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const rock = burn(pose.rage ? '#5a3a34' : '#4a4048');
  const dark = shade(rock, -0.4);
  const light = shade(rock, 0.25);
  const lava = pose.rage ? '#ffe27a' : '#ff8a1e';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const breath = breathe(pose, 1);
  const bob = (walking && frame % 2 === 1 ? 1 : 0) + (breath > 0 ? 1 : 0);
  const { atk, tele, state } = pose;
  let armUp = 0;
  if ((state === 'tele' || state === 'attack') && atk === 'slam') armUp = state === 'tele' ? Math.round(60 * tele) : 0;
  if (state === 'phase') armUp = 60;
  const venting = state === 'attack' && atk === 'vent';
  const open = e.def.weakBox(e) !== null;
  // loose parts: the head and the near shoulder pop off as it falls
  const hfx = Math.round(dead.fly * 0.5);
  const hfy = -Math.round(dead.fly * 0.9 - dead.k * dead.k * 36);
  const sfx = -Math.round(dead.fly * 0.6);
  const sfy = -Math.round(dead.fly * 0.6 - dead.k * dead.k * 30);

  // legs
  const la = walking ? [-2, 0, 2, 0][frame] : 0;
  const lb = walking ? [2, 0, -2, 0][frame] : 0;
  B.part(-20 + la, -32, 17, 32, dark);
  B.part(-22 + la, -9, 22, 9, shade(dark, -0.25));
  B.part(4 + lb, -32, 19, 32, rock);
  B.part(4 + lb, -9, 24, 9, dark);
  for (const [x, y] of [[-17 + la, -26], [8 + lb, -24], [14 + lb, -12]]) B.r(x, y, 5, 1, lava);
  // torso
  B.part(-28, -76 - bob, 58, 46, rock);
  B.r(-28, -34 - bob, 58, 4, dark);
  for (const [x, y, w] of [[-22, -66, 8], [-8, -58, 6], [16, -70, 9], [-18, -44, 10]]) {
    B.r(x, y - bob, w, 1, lava);
    B.r(x + w - 1, y - bob, 1, 5, lava);
  }
  // furnace door (the weak point): a lit fire mouth when open, a bolted shutter when shut
  weakPoint(B, 8, -42, 22, 28, { open, col: '#ff8a1e', age: pose.bs.age, hit: e.flash || 0 });
  if (open) {
    const lick = flick(pose.bs.age, 10) % 2;
    B.r(10, -38, 18, 20, lick ? '#ff8a1e' : '#ffb03a');
    B.r(13, -36, 12, 14, '#ffe27a');
    B.r(16, -32, 6, 8, '#ffffff');
  } else {
    const glow = state === 'tele' && atk === 'vent' ? '#ffd23a' : lava;
    for (let y = -37; y < -18; y += 7) B.r(11, y, 16, 1, glow);
    B.r(18, -42, 2, 28, '#1a1a22');
  }
  // shoulders
  B.part(-38 + sfx, -84 - bob + sfy, 22, 20, light);
  B.part(18, -84 - bob, 22, 20, light);
  // arms and fists
  if (armUp > 0) {
    B.part(-36, -64 - armUp - bob, 12, 26 + armUp, dark);
    B.part(-40, -80 - armUp, 18, 18, rock);
    B.part(30, -64 - armUp - bob, 12, 26 + armUp, rock);
    B.part(26, -80 - armUp, 18, 18, light);
  } else {
    B.part(-38, -64 - bob, 13, 38, dark);
    B.part(-42, -30, 19, 18, rock);
    B.part(30, -64 - bob, 13, 38, rock);
    B.part(30, -30, 19, 18, light);
    B.r(-38, -18, 11, 1, lava);
  }
  // head
  const hb = bob;
  B.part(-10 + hfx, -104 - hb + hfy, 6, 8, dark);
  B.part(14 + hfx, -104 - hb + hfy, 6, 8, dark);
  B.part(-8 + hfx, -98 - hb + hfy, 26, 20, rock);
  const eye = state === 'tele' ? (flick(tele, 12) % 2 ? '#ffffff' : '#ffd23a') : dead.k > 0.3 ? '#4a2a14' : '#ffd23a';
  const blinking = state === 'idle' && blink(pose.bs.age);
  B.r(-1 + hfx, -92 - hb + hfy + (blinking ? 2 : 0), 6, blinking ? 1 : 4, eye);
  B.r(9 + hfx, -92 - hb + hfy + (blinking ? 2 : 0), 6, blinking ? 1 : 4, eye);
  B.r(2 + hfx, -84 - hb + hfy, 10, 2, lava);
  if (venting) {
    B.r(-6, -112 - bob, 4, 10, lava);
    B.r(4, -118 - bob, 4, 14, '#ffd23a');
    B.r(12, -110 - bob, 4, 8, lava);
  }
  // embers drift up off the shoulders: the signature puff
  if (state !== 'dying') {
    for (let i = 0; i < 3; i++) {
      const u = (pose.bs.age * 0.6 + i * 0.34) % 1;
      B.r(-30 + i * 28 + Math.round(Math.sin(pose.bs.age * 3 + i * 2) * 2), -88 - bob - Math.round(u * 22), 1, 1, u < 0.5 ? '#ffb03a' : '#c0521a');
    }
  }
  damageMarks(B, pose, GOLEM_MARKS);
}

// ---- MAMMOTH WALKER ----
const MAMMOTH_MARKS = [
  { x: -30, y: -72, kind: 'crack', phase: 1 },
  { x: 2, y: -78, kind: 'plate', phase: 1 },
  { x: 22, y: -64, kind: 'scorch', phase: 2 },
  { x: -22, y: -98, kind: 'smoke', phase: 2 },
  { x: 34, y: -76, kind: 'spark', phase: 2 },
];

function drawMammoth(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const fur = burn(pose.rage ? '#7a5a4c' : '#6a5a54');
  const dark = shade(fur, -0.38);
  const ice = '#9ad4f0';
  const glow = '#9ae0ff';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const breath = breathe(pose, 1);
  const bob = (walking && frame % 2 === 1 ? 1 : 0) + (breath > 0 ? 1 : 0);
  const { atk, tele, state } = pose;
  let trunkUp = 0;
  let headDown = 0;
  if ((state === 'tele' || state === 'attack') && atk === 'breath') trunkUp = Math.round(28 * tele);
  if ((state === 'tele' || state === 'attack') && atk === 'howl') trunkUp = 30;
  if ((state === 'tele' || state === 'attack') && atk === 'charge') headDown = Math.round(8 * tele);
  if (state === 'phase') trunkUp = 30;
  const open = e.def.weakBox(e) !== null;
  const tfx = Math.round(dead.fly * 0.7);
  const tfy = -Math.round(dead.fly * 0.5 - dead.k * dead.k * 24);

  // legs (back pair darker)
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.part(-40 + la, -38, 17, 38, dark);
  B.part(-42 + la, -8, 21, 8, shade(dark, -0.2));
  B.part(-16 + lb, -38, 17, 38, dark);
  B.part(-18 + lb, -8, 21, 8, shade(dark, -0.2));
  B.part(8 + la, -38, 18, 38, fur);
  B.part(6 + la, -8, 22, 8, dark);
  B.part(32 + lb, -38, 18, 38, fur);
  B.part(30 + lb, -8, 22, 8, dark);
  // body and hump
  B.part(-30, -96 - bob, 56, 16, fur);
  B.part(-42, -82 - bob, 90, 48, fur);
  B.r(-42, -40 - bob, 90, 6, dark);
  // shaggy fringe
  for (let x = -40; x < 46; x += 6) B.r(x, -36 - bob, 3, 5 + ((x / 6) & 1) * 3, dark);
  // frost armour plates and spikes along the back: they fly off when it falls
  for (let i = 0; i < 5; i++) {
    const x = -34 + i * 15;
    const fx = Math.round((i - 2) * dead.fly * 0.4);
    const fy = -Math.round(dead.fly * (0.7 + i * 0.12) - dead.k * dead.k * 40);
    const y = -102 - bob + (i % 2) * 3 + fy;
    B.part(x + fx, y, 10, 9, ice);
    B.r(x + fx, y, 10, 1, '#ffffff');
    B.r(x + fx + 4, y - 4, 2, 4, '#ffffff');
  }
  B.r(-20, -84 - bob, 4, 4, glow);
  B.r(8, -84 - bob, 4, 4, glow);
  // belly hatch (weak point): a frozen core that burns when open
  weakPoint(B, 6, -40, 28, 28, { open, col: '#5ad8ff', age: pose.bs.age, hit: e.flash || 0 });
  if (open) B.r(14, -32, 12, 14, '#ffffff');
  else {
    B.r(19, -40, 2, 28, '#3a4a68');
    for (const [x, y] of [[8, -38], [30, -38], [8, -16], [30, -16]]) B.r(x, y, 2, 2, '#e8f4ff');
  }
  // head, tusks, trunk, eye
  const hy = -86 + headDown;
  B.part(38, hy - bob, 34, 34, fur);
  B.part(44, hy - 8 - bob, 22, 10, ice);
  B.r(44, hy - 8 - bob, 22, 1, '#ffffff');
  const eyeFlash = atk === 'charge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  if (state === 'idle' && blink(pose.bs.age)) {
    B.r(56, hy + 10 - bob, 5, 1, dark);
  } else {
    B.r(56, hy + 8 - bob, 5, 5, eyeFlash ? '#ffffff' : pose.rage || atk === 'charge' ? '#ff3a3a' : '#ffd23a');
    B.r(58, hy + 9 - bob, 2, 3, '#111111');
  }
  const tuskGlow = atk === 'charge' && state === 'tele' ? glow : '#f4f0dc';
  B.part(52, hy + 24 - bob, 22, 4, tuskGlow);
  B.part(70, hy + 14 - bob, 4, 12, tuskGlow);
  B.r(72, hy + 10 - bob, 3, 5, tuskGlow);
  // trunk: hangs down, or rears up to breathe
  if (trunkUp > 0) {
    const t = trunkUp;
    B.part(68, hy + 8 - bob, 10, 12, fur);
    B.part(72, hy - t * 0.4 - bob, 10, 14 + t * 0.4, fur);
    B.part(74, hy - t - 4 - bob, 10, 12, shade(fur, 0.1));
    if (state === 'attack' && atk === 'breath') B.disc(80, hy - t - 4 - bob, 3 + (Math.floor(pose.bs.age * 20) % 2), glow);
    if (state === 'tele' && atk === 'breath') B.disc(80, hy - t - 4 - bob, 2, '#ffffff');
  } else {
    B.part(66 + tfx, hy + 8 - bob + tfy, 10, 14, fur);
    B.part(70 + tfx, hy + 20 - bob + tfy, 9, 16, fur);
    B.part(68 + tfx, hy + 34 - bob + tfy, 9, 14, shade(fur, -0.1));
    // cold breath curls off the trunk tip while it idles
    if (state === 'idle') {
      const u = (pose.bs.age * 0.6) % 1;
      if (u < 0.75) B.disc(76 + Math.round(Math.sin(pose.bs.age * 4) * 1.5) + Math.round(u * 6), hy + 49 - bob - Math.round(u * 12), 1 + (u > 0.4 ? 1 : 0), u < 0.4 ? '#e8f4ff' : '#b8d8ec');
    }
  }
  damageMarks(B, pose, MAMMOTH_MARKS);
}

// ---- CAVE BEAR HIVE ----
const BEAR_MARKS = [
  { x: -22, y: -42, kind: 'crack', phase: 1 },
  { x: -30, y: -38, kind: 'plate', phase: 1 },
  { x: -6, y: -28, kind: 'scorch', phase: 2 },
  { x: -26, y: -46, kind: 'smoke', phase: 2 },
  { x: 8, y: -34, kind: 'spark', phase: 2 },
];

function drawBear(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const fur = burn(pose.rage ? '#7a4a36' : '#6b5040');
  const dark = shade(fur, -0.4);
  const light = shade(fur, 0.22);
  const hive = burn('#8a3a9a');
  const glow = '#ff4adc';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const breath = breathe(pose, 1);
  const bob = (walking && frame % 2 === 1 ? 1 : 0) + (breath > 0 ? 1 : 0);
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  let rear = 0; // how far the front of the body is raised
  let crouch = 0;
  let mouth = 0;
  if (act && (atk === 'swipe' || atk === 'quake')) rear = state === 'tele' ? Math.round(18 * tele) : atk === 'swipe' ? 14 : 0;
  if (act && atk === 'lunge') crouch = state === 'tele' ? Math.round(7 * tele) : 5;
  if (act && atk === 'swarm') mouth = 6;
  if (state === 'phase') { rear = 20; mouth = 8; }
  if (state === 'dying') mouth = 6;
  const open = e.def.weakBox(e) !== null;
  // loose parts: the head lolls off and the hive pods burst away
  const hfx = Math.round(dead.fly * 0.35);
  const hfy = -Math.round(dead.fly * 0.5 - dead.k * dead.k * 22);

  // back legs (dark) and front legs
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.part(-30 + la, -20 + crouch, 14, 20 - crouch, dark);
  B.part(-32 + la, -4, 18, 4, shade(dark, -0.25));
  B.part(-14 + lb, -20 + crouch, 12, 20 - crouch, dark);
  B.part(-16 + lb, -4, 16, 4, shade(dark, -0.25));
  // body
  B.part(-34, -46 - bob + crouch, 60, 30, fur);
  B.r(-34, -22 - bob + crouch, 60, 6, dark);
  for (let x = -32; x < 24; x += 7) B.r(x, -17 - bob + crouch, 3, 3 + ((x / 7) & 1) * 2, dark); // shaggy underside
  // front legs (the raised pair when rearing)
  B.part(12 + lb, -22 - rear + crouch, 14, 22, fur);
  if (rear > 8) {
    // the paw swings up: arm and claws
    B.part(18, -34 - rear, 12, 14 + rear * 0.5, fur);
    for (let i = 0; i < 3; i++) B.r(28 + i * 3, -36 - rear + i, 2, 6, '#f4f0dc');
  } else {
    B.part(10 + lb, -4, 20, 4, shade(fur, -0.3));
    for (const x of [26, 29]) B.r(x + lb, -2, 2, 2, WHITE);
  }
  // shoulder hump and head
  const hy = -44 - rear + crouch;
  B.part(0, -52 - rear * 0.6 + crouch, 28, 14, fur);
  B.part(22 + hfx, hy - bob + hfy, 26, 24, fur);
  B.part(40 + hfx, hy + 10 - bob + hfy, 12, 10, shade(fur, 0.12)); // snout
  B.r(50 + hfx, hy + 11 - bob + hfy, 3, 3, '#111111');
  B.part(36 + hfx, hy - 3 - bob + hfy, 5, 6, fur); // ear
  B.r(38 + hfx, hy - 1 - bob + hfy, 2, 3, dark);
  if (mouth) {
    B.r(40 + hfx, hy + 20 - bob + hfy, 12, mouth, '#3a1018');
    B.r(41 + hfx, hy + 20 - bob + hfy, 2, 3, WHITE);
    B.r(47 + hfx, hy + 20 - bob + hfy, 2, 3, WHITE);
  } else {
    B.r(40 + hfx, hy + 19 - bob + hfy, 12, 2, dark);
    B.r(42 + hfx, hy + 21 - bob + hfy, 2, 2, WHITE);
    B.r(48 + hfx, hy + 21 - bob + hfy, 2, 2, WHITE);
  }
  const eyeFlash = atk === 'lunge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  if (state === 'idle' && blink(pose.bs.age)) B.r(33 + hfx, hy + 8 - bob, 5, 1, dark);
  else B.r(33 + hfx, hy + 6 - bob + hfy, 5, 4, eyeFlash ? '#ffffff' : pose.rage || atk === 'lunge' ? '#ff3a3a' : dead.k > 0.3 ? '#4a1a40' : glow);
  // the hive: purple pods crowning the shoulders, bright and swollen when open. The housing sits exactly on the weak box.
  const pulse = flick(pose.bs.age, 8) % 2;
  const hy0 = -64 - rear * 0.6 + crouch;
  weakPoint(B, 2, -64, 28, 26, { open, col: glow, age: pose.bs.age, hit: e.flash || 0 });
  B.part(-2, hy0 + 10 - bob, 34, 14, shade(hive, -0.35));
  let pi = 0;
  for (const [x, y, rw] of [[0, 8, 11], [10, 0, 13], [22, 6, 10], [13, 10, 9], [4, 14, 8]]) {
    const fx = Math.round(dead.fly * (pi - 2) * 0.3);
    const fy = -Math.round(dead.fly * (0.6 + pi * 0.1) - dead.k * dead.k * 40);
    pi++;
    B.part(x + fx, hy0 + y - bob + fy, rw, rw - 1, open ? (pulse ? '#ff7aea' : glow) : hive);
    if (open) B.r(x + fx + (rw >> 1) - 1, hy0 + y + (rw >> 1) - 1 - bob + fy, 3, 3, '#ffffff');
    else B.r(x + fx + (rw >> 1), hy0 + y + (rw >> 1) - bob + fy, 2, 2, shade(hive, -0.5));
  }
  // spores drift up off the hive: the signature puff
  if (state === 'idle') {
    for (let i = 0; i < 3; i++) {
      const u = (pose.bs.age * 0.5 + i * 0.33) % 1;
      B.r(4 + i * 10 + Math.round(Math.sin(pose.bs.age * 3 + i * 2) * 3), hy0 - 2 - bob - Math.round(u * 18), 1, 1, u < 0.6 ? '#e08aea' : '#8a4a9a');
    }
  }
  damageMarks(B, pose, BEAR_MARKS);
}

// ---- Animated Sphinx ----
const SPHINX_MARKS = [
  { x: -30, y: -36, kind: 'crack', phase: 1 },
  { x: -12, y: -38, kind: 'plate', phase: 1 },
  { x: -22, y: -24, kind: 'scorch', phase: 2 },
  { x: -46, y: -40, kind: 'smoke', phase: 2 },
  { x: 0, y: -30, kind: 'spark', phase: 2 },
];

function drawSphinx(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const stone = burn(pose.rage ? '#b8885a' : '#c8a468');
  const dark = shade(stone, -0.38);
  const light = shade(stone, 0.28);
  const gold = burn('#e8c040');
  const blue = burn('#2a5aa8');
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const walkBob = walking && frame % 2 === 1 ? 1 : 0;
  const breath = breathe(pose, 1);
  const bob = walkBob + (breath > 0 ? 1 : 0); // the body breathes, the head stays on its weak box
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  let paw = 0; // how high the near paw is raised
  let crouch = 0;
  let mouth = 0;
  let lift = 0; // head thrown back
  if (act && atk === 'paw') paw = state === 'tele' ? Math.round(24 * tele) : 4;
  if (act && atk === 'pounce') crouch = state === 'tele' ? Math.round(8 * tele) : 0;
  if (act && atk === 'scarabs') mouth = 7;
  if (act && atk === 'riddle') lift = 3;
  if (state === 'phase') { lift = 4; mouth = 8; }
  if (state === 'dying') mouth = 6;
  if (!e.grounded) crouch = -5;
  const open = e.def.weakBox(e) !== null;
  // loose parts: the crown, the false beard and the tail tip
  const cfx = Math.round(dead.fly * 0.3);
  const cfy = -Math.round(dead.fly * 1.1 - dead.k * dead.k * 38);
  const bfx = Math.round(dead.fly * 0.7);
  const bfy = -Math.round(dead.fly * 0.4 - dead.k * dead.k * 18);
  const tfx = -Math.round(dead.fly * 0.8);
  const tfy = -Math.round(dead.fly * 0.8 - dead.k * dead.k * 30);

  // tail curling behind
  B.part(-60, -14, 14, 4, dark);
  B.part(-64 + tfx, -22 + tfy, 6, 10, dark);
  B.part(-66 + tfx, -26 + tfy, 6, 6, stone);
  // hind leg and haunch
  B.part(-50, -30 + crouch, 24, 30 - crouch, dark);
  B.part(-52, -4, 26, 4, shade(dark, -0.25));
  // body
  B.part(-52, -40 - bob + crouch, 62, 28, stone);
  B.r(-52, -16 - bob + crouch, 62, 4, dark);
  // carved hieroglyph bands
  for (let x = -46; x < 4; x += 10) {
    B.r(x, -32 - bob + crouch, 3, 3, dark);
    B.r(x + 4, -28 - bob + crouch, 2, 5, dark);
  }
  // far forepaw
  B.part(6, -10, 40, 10, dark);
  B.r(42, -4, 6, 4, shade(dark, -0.2));
  // near forepaw: extended, or raised for the slam
  if (paw > 10) {
    B.part(10, -34 - paw, 12, 26 + paw, stone);
    for (let i = 0; i < 3; i++) B.r(10 + i * 4, -38 - paw, 3, 5, '#f4f0dc');
  } else {
    B.part(4, -14 + paw, 44, 14 - paw, stone);
    for (let i = 0; i < 3; i++) B.r(44 + i * 1, -3 + i * 0, 2, 3, '#f4f0dc');
  }
  // chest and neck
  B.part(2, -52 - bob + crouch, 18, 40, stone);
  B.r(2, -52 - bob + crouch, 3, 40, light);
  // head: striped royal headdress (nemes) round a stone face. The face is the weak point, behind a visor.
  const hy = -78 - walkBob + crouch + (lift ? -lift : 0);
  B.part(2, hy + 8, 16, 34 + crouch, blue); // rear lappet, behind the face
  for (let i = 0; i < 8; i++) B.r(2, hy + 10 + i * 4, 16, 1, gold);
  B.part(8 + cfx, hy + cfy, 32, 11, gold); // the crown, striped blue
  for (let i = 0; i < 6; i++) B.r(10 + i * 5 + cfx, hy + cfy, 2, 11, blue);
  // the weak box is the face and the lappet beside it: a lit shutter behind the face, which blazes through when open
  weakPoint(B, 8, -68, 26, 30, { open, col: '#ff4adc', age: pose.bs.age, hit: e.flash || 0 });
  B.part(20, hy + 10, 22, 30, stone);
  B.r(21, hy + 11, 20, 2, dark); // brow band
  if (open) {
    ctx.globalAlpha = 0.55;
    B.r(21, hy + 13, 20, 26, flick(pose.bs.age, 9) % 2 ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  }
  B.r(38, hy + 22, 6, 10, shade(stone, 0.14)); // nose
  B.r(43, hy + 28, 2, 3, dark);
  // eyes with kohl; Rift light, red when enraged, a white blink while it winds up
  const eye = pose.rage || atk === 'pounce' ? '#ff3a3a' : '#ff4adc';
  const blinking = state === 'idle' && blink(pose.bs.age);
  B.r(29, hy + 18, 9, 4, '#14141c');
  B.r(32, hy + (blinking ? 20 : 19), 5, blinking ? 1 : 2, state === 'tele' && flick(tele, 14) % 2 === 0 ? '#ffffff' : dead.k > 0.3 ? '#4a1a40' : eye);
  // mouth and the false beard
  if (mouth) {
    B.r(30, hy + 33, 13, mouth, '#2a1008');
    B.r(32, hy + 33, 2, 3, '#f4f0dc');
    B.r(39, hy + 33, 2, 3, '#f4f0dc');
  } else {
    B.r(30, hy + 34, 13, 2, dark);
  }
  B.part(36 + bfx, hy + 40 + bfy, 7, 14, blue);
  B.r(36 + bfx, hy + 40 + bfy, 7, 2, gold);
  // the brow gem: dull blue-grey when closed, blazing pink-white when open
  B.r(26 + cfx, hy - 5 + cfy, 8, 10, '#14141c'); // its setting
  B.r(27 + cfx, hy - 4 + cfy, 6, 8, open ? (flick(pose.bs.age, 9) % 2 ? '#ff9af0' : '#ff4adc') : '#5a6a8a');
  B.r(28 + cfx, hy - 3 + cfy, 3, 3, open ? '#ffffff' : '#9aaac8');
  if (open) {
    ctx.globalAlpha = 0.25;
    B.disc(30, hy, 6, '#ff4adc');
    ctx.globalAlpha = 1;
  }
  // sand trickles off the haunch: the signature puff
  if (state === 'idle') {
    for (let i = 0; i < 3; i++) {
      const u = (pose.bs.age * 0.7 + i * 0.31) % 1;
      B.r(-46 + i * 11, -42 - bob + Math.round(u * 22), 1, 1, u < 0.5 ? '#e8d09a' : '#c8a468');
    }
  }
  damageMarks(B, pose, SPHINX_MARKS);
}

// ---- Bronze Colossus ----
const COLOSSUS_MARKS = [
  { x: -14, y: -84, kind: 'crack', phase: 1 },
  { x: -20, y: -70, kind: 'plate', phase: 1 },
  { x: 2, y: -62, kind: 'scorch', phase: 2 },
  { x: -22, y: -100, kind: 'smoke', phase: 2 },
  { x: 10, y: -88, kind: 'spark', phase: 2 },
];

function drawColossus(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const bronze = burn(pose.rage ? '#c0602a' : '#b87333');
  const dark = shade(bronze, -0.42);
  const mid = shade(bronze, -0.18);
  const light = shade(bronze, 0.32);
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const step = walking ? [-3, 0, 3, 0][frame] : 0;
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  let lift = 0; // front foot raised for the stomp
  let kneel = 0; // upper body lowered
  let armsUp = 0;
  if (act && atk === 'stomp') lift = state === 'tele' ? Math.round(16 * tele) : 0;
  if (act && atk === 'molten') kneel = state === 'tele' ? Math.round(10 * tele) : 10;
  if (act && atk === 'hail') armsUp = state === 'tele' ? Math.round(30 * tele) : 30;
  if (state === 'phase') armsUp = 34;
  const open = e.def.weakBox(e) !== null;
  const up = kneel + (breathe(pose, 1) > 0 ? 1 : 0); // the upper body breathes
  // loose parts: the helm, the spear and the far shield
  const hfx = Math.round(dead.fly * 0.4);
  const hfy = -Math.round(dead.fly * 1.0 - dead.k * dead.k * 36);
  const sfx = Math.round(dead.fly * 0.9);
  const sfy = -Math.round(dead.fly * 0.6 - dead.k * dead.k * 30);
  const wfx = -Math.round(dead.fly * 0.7);
  const wfy = -Math.round(dead.fly * 0.7 - dead.k * dead.k * 26);
  const disc = (x, y, r, col) => {
    B.disc(x, y, r + 1, ink(col));
    B.disc(x, y, r, col);
  };

  // far shield, behind the body
  disc(-30 + wfx, -74 + up + wfy, 13, dark);
  B.disc(-30 + wfx, -74 + up + wfy, 10, mid);
  B.disc(-30 + wfx, -74 + up + wfy, 3, light);
  // legs: the back one dark, the front one lit; the front foot lifts for the stomp
  B.part(-26 + step, -46 + kneel, 18, 46 - kneel, dark);
  B.part(-30 + step, -5, 24, 5, shade(dark, -0.3));
  for (const y of [-38, -24, -12]) B.r(-26 + step, y, 18, 2, shade(dark, -0.3));
  const fl = lift;
  B.part(2 - step, -46 + kneel, 20, 46 - kneel - fl, mid);
  B.r(2 - step, -45 + kneel, 4, 44 - kneel - fl, light);
  for (const y of [-38, -24, -12]) B.r(2 - step, y - fl, 20, 2, dark);
  // the heel seam and the greave: a hatch over the leading shin, glowing ichor when open
  weakPoint(B, 4, -40 - fl, 30, 40, { open, col: '#ff4adc', age: pose.bs.age, hit: e.flash || 0 });
  if (open) B.r(10, -34, 18, 28, '#ffd0f6');
  else for (const [x, y] of [[6, -38], [30, -38], [6, -4], [30, -4]]) B.r(x, y - fl, 2, 2, light);
  B.part(0 - step, -5 - fl, 28, 5, dark);
  B.r(0 - step, -5 - fl, 28, 1, mid);
  // skirt of bronze straps
  B.part(-28, -54 + kneel, 54, 10, mid);
  for (let x = -26; x < 24; x += 8) B.r(x, -44 + kneel, 6, 6, dark);
  // torso: a muscled cuirass
  B.part(-24, -92 + up, 46, 40 + (kneel - up), bronze);
  B.r(-24, -91 + up, 3, 39, light);
  B.r(-24, -56 + up, 46, 4, dark);
  B.r(-2, -86 + up, 2, 26, dark); // the sternum line
  B.r(-14, -80 + up, 10, 3, dark);
  B.r(6, -80 + up, 10, 3, dark);
  B.r(-12, -68 + up, 22, 2, dark);
  // pauldrons
  disc(-22, -90 + up, 9, mid);
  disc(22, -90 + up, 9, mid);
  B.r(14, -99 + up, 16, 3, light);
  // near arm and its weapon
  const ay = -86 + up - armsUp;
  B.part(20, ay, 10, 24 + armsUp / 2, mid);
  const planted = !(act && (atk === 'spear' || atk === 'discus'));
  if (atk === 'discus' && act) {
    disc(36, -66 + kneel, 8, '#e0a840');
    B.disc(36, -66 + kneel, 3, '#fff2a8');
  } else if (act && atk === 'spear') {
    B.stroke(22, -70, 56, -122, '#7a5a2a', 3);
    B.part(54, -128, 6, 8, '#dfe6ee');
  } else if (planted && !armsUp) {
    B.stroke(40 + sfx, -2 + sfy, 40 + sfx, -126 + sfy, '#7a5a2a', 3);
    B.part(37 + sfx, -136 + sfy, 7, 12, '#dfe6ee');
    B.part(26, -80 + up, 14, 6, mid);
  }
  // head: a crested Corinthian helm with burning eyes
  const hy = -118 + up;
  B.part(-4 + hfx, hy + hfy, 16, 10, dark); // crest base
  for (let i = 0; i < 8; i++) B.r(-4 + i * 2 + hfx, hy + hfy - (i & 1) * 3 - 2, 2, 5 + (i & 1) * 3, dead.char ? burn('#c0262e') : '#c0262e');
  B.part(-8 + hfx, hy + 8 + hfy, 24, 20, bronze);
  B.part(-10 + hfx, hy + 24 + hfy, 6, 8, dark);
  B.part(12 + hfx, hy + 18 + hfy, 6, 12, mid); // cheek guard
  const eye = pose.rage ? '#ff3a3a' : '#ff4adc';
  const blinking = state === 'idle' && blink(pose.bs.age);
  B.r(6 + hfx, hy + 16 + hfy, 10, 3, '#14141c');
  if (!blinking) B.r(9 + hfx, hy + 16 + hfy, 6, 3, state === 'tele' && flick(tele, 14) % 2 === 0 ? '#ffffff' : dead.k > 0.3 ? '#4a1a40' : eye);
  // steam hisses off the far pauldron: the signature puff
  if (state === 'idle') {
    const u = (pose.bs.age * 0.6) % 1;
    if (u < 0.8) B.disc(-24 + Math.round(Math.sin(pose.bs.age * 3) * 2), -100 + up - Math.round(u * 16), 1 + (u > 0.4 ? 1 : 0), u < 0.4 ? '#e8e8f0' : '#b8b8c8');
  }
  damageMarks(B, pose, COLOSSUS_MARKS);
}

// ---- Chariot Champion ----
const CHAMPION_MARKS = [
  { x: -27, y: -21, kind: 'crack', phase: 1 },
  { x: -9, y: -20, kind: 'plate', phase: 1 },
  { x: -23, y: -15, kind: 'scorch', phase: 2 },
  { x: -31, y: -26, kind: 'smoke', phase: 2 },
  { x: -3, y: -26, kind: 'spark', phase: 2 },
];

function drawChampion(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const horse = burn(pose.rage ? '#4a2a1a' : '#6a3a22');
  const horseD = shade(horse, -0.4);
  const bard = burn('#c8923a'); // bronze barding
  const wood = burn('#8a2a2a');
  const trim = '#ffd23a';
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const cs = e.cs;
  const running = act && atk === 'charge' && cs && cs.mode === 'run';
  const stun = act && atk === 'charge' && cs && cs.mode === 'stun';
  const rear = act && atk === 'charge' && state === 'tele' ? Math.round(14 * tele) : cs && cs.mode === 'turn' ? 8 : 0;
  const gallop = running ? Math.floor(e.x / 9) % 2 : walkPhase(e);
  const open = e.def.weakBox(e) !== null;
  const breath = breathe(pose, 1) > 0 ? 1 : 0;
  // loose parts: the wheel rolls off, the helm and the trim post are thrown
  const wfx = -Math.round(dead.fly * 1.1);
  const wfy = -Math.round(dead.fly * 0.3 - dead.k * dead.k * 8);
  const hfx = Math.round(dead.fly * 0.3);
  const hfy = -Math.round(dead.fly * 1.0 - dead.k * dead.k * 36);
  const pfx = -Math.round(dead.fly * 0.5);
  const pfy = -Math.round(dead.fly * 0.7 - dead.k * dead.k * 26);

  // two horses abreast (the far one darker), legs galloping
  for (const off of [-6, 0]) {
    const body = off ? horseD : horse;
    const lift = off ? 0 : rear;
    const hb = off ? 0 : breath; // the near horse breathes
    B.part(8 + off, -26 - lift - hb, 28, 11, body);
    B.part(30 + off, -34 - lift - hb, 7, 10, body); // neck
    B.part(35 + off, -35 - lift - hb, 9, 6, body); // head
    B.r(37 + off, -38 - lift - hb, 2, 3, body);
    B.r(41 + off, -34 - lift - hb, 1, 1, state === 'idle' && blink(pose.bs.age, off) ? body : '#ffd23a');
    B.r(28 + off, -34 - lift - hb, 4, 10, '#14141c'); // mane
    B.slab(10 + off, -26 - lift - hb, 12, 5, bard);
    B.r(4 + off, -24 - lift, 5, 3, '#14141c'); // tail
    const l0 = gallop ? 2 : -2;
    B.part(11 + off + l0, -16 - lift, 4, 16 + lift, shade(body, -0.15));
    B.part(31 + off - l0, -16 - lift, 4, 16 + lift, body);
    B.r(10 + off + l0, -3, 6, 3, '#14141c');
    B.r(30 + off - l0, -3, 6, 3, '#14141c');
    // breath steams off the muzzle while it idles
    if (off === 0 && state === 'idle') {
      const u = (pose.bs.age * 0.7) % 1;
      if (u < 0.7) B.disc(47 + Math.round(u * 5), -34 - hb - Math.round(u * 6), 1 + (u > 0.35 ? 1 : 0), u < 0.35 ? '#e8eef4' : '#b8c4d0');
    }
  }
  // the yoke pole
  B.stroke(-4, -16, 14, -16, '#7a5a2a', 1);
  // the chariot car
  B.part(-30, -22, 30, 14, wood);
  B.r(-30, -10, 30, 2, trim);
  B.r(-30, -22, 3, 14, shade(wood, -0.3));
  for (let i = 0; i < 3; i++) B.r(-24 + i * 9, -18, 5, 3, trim);
  B.part(-32 + pfx, -26 + pfy, 4, 12, trim);
  // big spoked wheel
  const wr = 11;
  const a = (e.x * 0.09) % Math.PI + (dead.k > 0 ? dead.fly * 0.2 : 0);
  const wx = -14 + wfx;
  const wy = -wr + 1 + wfy;
  B.disc(wx, wy, wr + 1, ink('#2a1a10'));
  B.disc(wx, wy, wr, '#2a1a10');
  B.disc(wx, wy, wr - 2, '#8a6a3a');
  B.disc(wx, wy, wr - 4, '#2a1a10');
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 4;
    B.line(wx - Math.cos(ang) * (wr - 2), wy - Math.sin(ang) * (wr - 2), wx + Math.cos(ang) * (wr - 2), wy + Math.sin(ang) * (wr - 2), '#8a6a3a', 1);
  }
  B.r(wx - 1, wy - 1, 3, 3, trim);
  // the weak point: a shield screen behind the driver, bright when he is exposed
  weakPoint(B, -26, -68, 22, 36, { open, col: '#ff4adc', age: pose.bs.age, hit: e.flash || 0 });
  // the champion: red-crested helm, bronze cuirass, reins to the horses
  const sway = stun ? 3 : 0;
  const dy = (stun ? 6 : 0) + breath;
  B.part(-24 + sway, -32 + dy, 8, 10, '#7a2018'); // legs, braced in the car
  B.part(-26 + sway, -52 + dy, 12, 20, '#a83a2a');
  B.slab(-26 + sway, -46 + dy, 12, 8, bard);
  B.part(-24 + sway + hfx, -64 + dy + hfy, 8, 12, '#d89a68');
  B.part(-26 + sway + hfx, -68 + dy + hfy, 12, 6, bard);
  for (let i = 0; i < 6; i++) B.r(-26 + sway + i * 2 + hfx, -74 + dy + hfy - (i & 1) * 2, 2, 7, dead.char ? burn('#c0262e') : '#c0262e');
  const eye = pose.rage ? '#ff3a3a' : '#ff4adc';
  if (!(state === 'idle' && blink(pose.bs.age, 1.1))) B.r(-20 + sway + hfx, -60 + dy + hfy, 4, 2, stun ? '#ffffff' : dead.k > 0.3 ? '#4a1a40' : eye);
  // arms: reins forward, or a javelin overhead
  if (act && atk === 'javelins') {
    const up = state === 'tele' ? tele : 1;
    B.stroke(-18, -48 + dy, -4 + up * 10, -64 - up * 12, '#dfe6ee', 2);
    B.r(-6 + up * 10, -68 - up * 12, 5, 3, '#dfe6ee');
    B.part(-20, -50, 8, 4, '#d89a68');
  } else {
    B.line(-16, -44 + dy, 6, -30, '#14141c', 1);
    B.line(-16, -44 + dy, 6, -34, '#14141c', 1);
    B.part(-18, -46 + dy, 6, 5, '#d89a68');
  }
  if (act && atk === 'summon') B.part(-10, -76, 8, 3, trim); // a horn raised
  if (stun) {
    // dazed: stars circling the driver's head
    const t = pose.bs.age * 8;
    for (let i = 0; i < 3; i++) B.r(-24 + Math.round(Math.cos(t + i * 2.1) * 10), -82 + Math.round(Math.sin(t + i * 2.1) * 3), 3, 3, '#ffe27a');
  }
  damageMarks(B, pose, CHAMPION_MARKS);
}

// The Dragon Kite Fortress: a segmented paper dragon, a pagoda on its back, a glowing pearl in its brow.
const KITE_MARKS = [
  { x: -17, y: -50, kind: 'crack', phase: 1 },
  { x: -36, y: -29, kind: 'plate', phase: 1 },
  { x: -8, y: -46, kind: 'scorch', phase: 2 },
  { x: 2, y: -58, kind: 'smoke', phase: 2 },
  { x: -26, y: -32, kind: 'spark', phase: 2 },
];

function drawDragonKite(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const t = pose.bs.age;
  const red = burn(pose.rage ? '#c01826' : '#d8342a');
  const redD = shade(red, -0.42);
  const redL = shade(red, 0.3);
  const gold = '#ffd23a';
  const paper = burn('#f4e8c8');
  const jade = burn('#2a7a5a');
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const dv = e.dv;
  const diving = act && atk === 'lunge' && dv && dv.mode === 'dive';
  const crashed = act && atk === 'lunge' && dv && dv.mode === 'crash';
  const breath = act && atk === 'breath';
  const rockets = act && atk === 'rockets';
  const puff = breathe(pose, 1) > 0 ? 1 : 0;
  const wob = (i, k = 3) => Math.round(Math.sin(t * 3 + i * 0.9) * k);
  // loose parts: the head is thrown clear, the pagoda roof and the whiskers follow
  const hfx = Math.round(dead.fly * 0.7);
  const hfy = -Math.round(dead.fly * 0.6 - dead.k * dead.k * 30);
  const rfx = -Math.round(dead.fly * 0.4);
  const rfy = -Math.round(dead.fly * 1.1 - dead.k * dead.k * 40);
  const disc = (x, y, r, col) => {
    B.disc(x, y, r + 1, ink(col));
    B.disc(x, y, r, col);
  };

  // trailing ribbon tail
  for (let i = 0; i < 9; i++) {
    const x = -48 - i * 7;
    const y = -26 + Math.round(Math.sin(t * 4 + i * 0.8) * (2 + i * 0.7)) + (diving ? -i : 0);
    B.part(x, y, 8, 6 - (i > 5 ? 2 : 0), i % 2 ? gold : red);
    if (i > 6) B.r(x + 2, y - 3 - (i & 1), 3, 3, paper);
  }
  // body segments, tail to neck, drawn from the back so the front overlaps
  const segs = [];
  for (let i = 0; i < 6; i++) segs.push([-40 + i * 12, -26 + wob(i) - (i === 5 ? 8 : 0), i === 0 ? 6 : 9]);
  for (const [x, y, r] of segs) {
    B.r(x - 1, y - r - 4, 5, 6, ink(gold)); // dorsal fin, outlined
    B.r(x - 1 + 1, y - r - 3, 3, 4, gold);
    disc(x, y, r, redD);
    B.disc(x, y - 1, r - 1, red);
    B.r(x - r + 3, y - r + 1, r, 2, redL);
    B.r(x - 3, y + 2, 7, r - 3, paper); // belly plate
  }
  // claws under two segments
  for (const i of [2, 4]) {
    const [x, y] = segs[i];
    const kick = Math.round(Math.sin(t * 5 + i) * 1.5);
    B.part(x - 2 + kick, y + 8, 4, 6, redD);
    B.r(x - 4 + kick, y + 13, 3, 2, paper);
    B.r(x + kick, y + 13, 3, 2, paper);
    B.r(x + 4 + kick, y + 12, 2, 2, paper);
  }
  // the pagoda strapped to the back
  B.part(-24, -39, 34, 4, '#4a2e1a');
  B.part(-20, -51, 26, 12, red);
  B.r(-20, -41, 26, 2, gold);
  B.r(-14, -49, 4, 6, '#2a1a10');
  B.r(-2, -49, 4, 6, '#2a1a10');
  B.part(-26 + rfx, -56 + rfy, 38, 5, jade);
  B.part(-22 + rfx, -61 + rfy, 30, 5, shade(jade, -0.15));
  B.r(-8 + rfx, -67 + rfy, 2, 7, gold);
  B.r(-30 + rfx, -53 + rfy, 4, 2, jade); // upturned eaves
  B.r(10 + rfx, -53 + rfy, 4, 2, jade);
  const lant = Math.floor(t * 3) % 2;
  B.r(-24, -45, 3, 5, lant ? '#ff6a4a' : '#ffb02e');
  // incense curls up off the roof peak: the signature puff
  if (state === 'idle') {
    const u = (t * 0.5) % 1;
    B.disc(-7 + Math.round(Math.sin(t * 3) * 2), -69 - puff - Math.round(u * 16), 1 + (u > 0.5 ? 1 : 0), u < 0.5 ? '#e8e0d0' : '#a8a098');
  }
  // rocket tubes rise from the roof while the fireworks are being readied
  if (rockets) {
    const up = state === 'tele' ? tele : 1;
    for (let k = -1; k <= 1; k++) {
      const h = Math.round(10 + 8 * up);
      B.part(-10 + k * 8 + 1, -61 - h, 3, h, '#9a7a3a');
      B.r(-10 + k * 8 + 1, -63 - h, 3, 2, red);
      if (Math.floor(t * 20) % 2) B.r(-10 + k * 8 + 2, -65 - h, 1, 2, '#ffe27a');
    }
  }
  // the weak box spans head and neck: a hanging gold-and-jade cage behind the head, its slats open to the pearl's light
  weakPoint(B, 22, -56, 32, 46, { open, col: '#ff4adc', age: t, hit: e.flash || 0 });
  // the head, up on the neck
  const jaw = breath ? Math.round(3 + 6 * (state === 'tele' ? tele : 1)) : 3;
  const hy = (diving ? 6 : crashed ? 8 : 0) + puff;
  B.part(22, -34 + hy, 12, 24, red); // neck
  B.r(24, -34 + hy, 2, 24, redL);
  for (let y = -30; y < -10; y += 5) B.r(23, y + hy, 10, 1, redD); // scales
  B.part(26 + hfx, -46 + hy + hfy, 24, 18, red); // skull
  B.part(46 + hfx, -40 + hy + hfy, 14, 8, red); // snout
  B.part(30 + hfx, -29 + hy + hfy, 28, jaw, redD); // lower jaw
  B.r(48 + hfx, -31 + hy + hfy, 2, 3, paper); // fangs
  B.r(54 + hfx, -31 + hy + hfy, 2, 3, paper);
  B.r(56 + hfx, -41 + hy + hfy, 2, 2, '#2a0a0a'); // nostril
  if (breath) {
    ctx.globalAlpha = 0.85;
    B.r(52, -30 + hy, 8, jaw - 1, Math.floor(t * 18) % 2 ? '#ffd23a' : '#ff8a1e');
    ctx.globalAlpha = 1;
  }
  // horns, mane, brow, eye
  B.part(30 + hfx, -56 + hy + hfy, 3, 10, paper);
  B.part(36 + hfx, -58 + hy + hfy, 3, 12, paper);
  for (let i = 0; i < 4; i++) B.part(24 - i * 4 + hfx, -50 + hy + hfy + (i & 1) * 3, 5, 3, gold);
  B.r(40 + hfx, -45 + hy + hfy, 8, 2, redD);
  if (state === 'idle' && blink(t, 0.7)) {
    B.r(42 + hfx, -42 + hy + hfy, 4, 1, '#1a0a0a');
  } else {
    B.r(42 + hfx, -43 + hy + hfy, 4, 3, '#fff6c8');
    B.r(44 + hfx, -42 + hy + hfy, 2, 2, pose.rage ? '#ff2a2a' : '#1a0a0a');
  }
  // whiskers, trailing back and waving
  for (const s of [0, 1]) {
    B.stroke(58 + hfx, -36 + hy + hfy + s * 3, 68 + hfx + wob(s, 2), -28 + hy + hfy + s * 6 + wob(s + 2, 3), '#fff6c8', 1);
  }
  // the pearl: bright and pulsing when the weak point is open, hidden behind a gold plate when shut
  if (open) {
    const pulse = flick(t, 9) % 2;
    B.disc(40, -37 + hy, 5, ink('#ff4adc'));
    B.disc(40, -37 + hy, 4, pulse ? '#ffffff' : '#ff9af0');
    B.r(38, -39 + hy, 2, 2, '#ffffff');
  } else {
    B.part(34 + hfx, -42 + hy + hfy, 12, 10, gold);
    B.r(38 + hfx, -38 + hy + hfy, 4, 3, redD);
  }
  if (diving) {
    // speed streaks
    for (let i = 0; i < 4; i++) B.r(-60 - i * 10, -50 + i * 9, 24, 1, '#ffffff');
  }
  if (crashed) {
    const s = t * 8;
    for (let i = 0; i < 3; i++) B.r(36 + Math.round(Math.cos(s + i * 2.1) * 12), -62 + Math.round(Math.sin(s + i * 2.1) * 3), 3, 3, '#ffe27a');
    for (let i = 0; i < 5; i++) B.r(-50 + i * 24, -3 - (i & 1) * 2, 8, 3, '#d8c08a');
  }
  damageMarks(B, pose, KITE_MARKS);
}

// The Kraken: a purple head and mantle heaved over the stern of the ship, tentacles reaching across the deck.
const KRAKEN_MARKS = [
  { x: -20, y: -84, kind: 'crack', phase: 1 },
  { x: -6, y: -78, kind: 'plate', phase: 1 },
  { x: -20, y: -56, kind: 'scorch', phase: 2 },
  { x: -32, y: -76, kind: 'smoke', phase: 2 },
  { x: 8, y: -84, kind: 'spark', phase: 2 },
];

function drawKraken(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const t = pose.bs.age;
  const rise = pose.state === 'enter' ? Math.max(0, 1 - pose.bs.age / 1.4) * 70 : 0; // it rears up out of the sea
  const B = brush(ctx, cx, cy + rise + dead.sink, e.face);
  const burn = (c) => (dead.char ? mix(c, '#14100e', dead.char) : c);
  const body = burn(pose.rage ? '#8a2a6a' : '#6a3a98');
  const bodyD = shade(body, -0.4);
  const bodyL = shade(body, 0.3);
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const slam = act && atk === 'slam';
  const sweep = act && atk === 'sweep';
  const ink_ = act && atk === 'ink';
  const puff = breathe(pose, 1) > 0 ? 1 : 0;
  const duck = (slam || sweep ? 14 : ink_ ? -4 : 0) + puff; // the head sinks behind the rail while the tentacles work
  const wob = (k, a = 2) => Math.round(Math.sin(t * 3 + k) * a);
  // loose parts: the fins are torn away, the beak spits out and one tentacle is flung
  const ffx = -Math.round(dead.fly * 0.8);
  const ffy = -Math.round(dead.fly * 0.9 - dead.k * dead.k * 34);
  const bfx = Math.round(dead.fly * 0.9);
  const bfy = -Math.round(dead.fly * 0.5 - dead.k * dead.k * 20);
  const tfx = Math.round(dead.fly * 0.6);
  const tfy = -Math.round(dead.fly * 0.8 - dead.k * dead.k * 24);

  // a tentacle: a chain of discs from (x0,y0) to (x1,y1), bowed by `bend`, thinning to the tip; outlined in one pass, filled in the next
  const tent = (x0, y0, x1, y1, bend, k, r0 = 7) => {
    const n = 12;
    const at = (i) => {
      const u = i / n;
      return [x0 + (x1 - x0) * u + wob(k + u * 5, 2), y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * bend, Math.max(2, Math.round(r0 * (1 - u * 0.7)))];
    };
    for (let i = 0; i <= n; i += 3) {
      const [x, y, r] = at(i);
      B.disc(x, y, r + 1, ink(body));
    }
    for (let i = 0; i <= n; i++) {
      const [x, y, r] = at(i);
      B.disc(x, y, r, i % 2 ? shade(body, -0.15) : body);
      if (i % 2 === 0 && i < n - 2) B.disc(x + 1, y + Math.round(r * 0.5), 1, '#e8c8f0'); // suckers
    }
  };

  // tentacles first, so the head overlaps their roots
  const lift = slam ? Math.round(30 * (state === 'tele' ? tele : 1)) : 0;
  tent(10, -22, 96, -6 - lift * 0.3, 18 + lift, 0, 7);
  tent(0, -30, 70, -12 - lift, 26 + lift * 0.6, 1.7, 7);
  tent(20 + tfx, -14 + tfy, 120 + tfx, (sweep ? -5 : -3 - lift * 0.2) + tfy, sweep ? 3 : 10, 3.1, 6);
  tent(-14, -26, 42, -4 - lift * 0.5, 22, 4.4, 6);
  if (sweep) tent(30, -8, 150 - Math.round(20 * (state === 'tele' ? 1 - tele : 0)), -6, 2, 5, 6); // a long arm stretched low across the deck
  // the weak box is the eye and the dome of the head: a bone-white socket plate behind the mantle, lit when open
  weakPoint(B, -34, -94 + (open ? 0 : duck), 68, 46, { open, col: '#ff4adc', age: t, hit: e.flash || 0 });
  // fins on the mantle
  B.part(-34 + ffx, -76 + duck + ffy, 8, 14, bodyD);
  B.part(-38 + ffx, -72 + duck + ffy, 6, 8, body);
  // mantle and head
  B.disc(-4, -62 + duck, 33, ink(body));
  B.disc(-4, -62 + duck, 32, bodyD);
  B.disc(-2, -64 + duck, 30, body);
  B.disc(-8, -72 + duck, 16, bodyL);
  for (const [sx, sy] of [[-14, -80], [4, -84], [-24, -64], [8, -52], [-6, -56]]) B.disc(sx, sy + duck, 2, bodyD); // mottling
  // the eye
  if (open) {
    const pulse = flick(t, 9) % 2;
    B.disc(20, -60 + duck, 11, ink('#fff6e0'));
    B.disc(20, -60 + duck, 10, '#fff6e0');
    B.disc(21, -60 + duck, 6, pulse ? '#ff4adc' : '#c0189a');
    if (blink(t)) B.r(10, -61 + duck, 20, 3, bodyD);
    else B.r(20, -64 + duck, 3, 8, '#1a0a1a');
  } else {
    B.disc(20, -60 + duck, 10, bodyD);
    B.r(10, -62 + duck, 20, 4, shade(body, -0.55)); // a heavy lid
    B.r(12, -63 + duck, 16, 1, '#e8c8f0');
  }
  // beak and the funnel under it
  B.part(26 + bfx, -44 + duck + bfy, 12, 8, '#e0c890');
  B.part(30 + bfx, -38 + duck + bfy, 6, 6, '#b89858');
  B.r(36 + bfx, -44 + duck + bfy, 3, 4, '#2a1a10');
  if (ink_) {
    ctx.globalAlpha = 0.8;
    B.disc(40, -34 + duck, 4 + (Math.floor(t * 10) % 3), '#2a1a4a');
    ctx.globalAlpha = 1;
  }
  // bubbles rise past the beak: the signature puff
  if (state === 'idle') {
    for (let i = 0; i < 2; i++) {
      const u = (t * 0.6 + i * 0.5) % 1;
      B.disc(44 + i * 6 + Math.round(Math.sin(t * 4 + i * 3) * 2), -32 + duck - Math.round(u * 24), 1 + (u > 0.6 ? 1 : 0), u < 0.6 ? '#c8e8f8' : '#e8f4fc');
    }
  }
  // sea spray at the stern
  for (let i = 0; i < 6; i++) B.slab(-30 + i * 12, -4 + ((Math.floor(t * 8) + i) % 3), 8, 4, i % 2 ? '#ffffff' : '#bfe0f4');
  damageMarks(B, pose, KRAKEN_MARKS);
}

function walkPhase(e) {
  return Math.abs(e.vx) > 2 && e.grounded ? Math.floor(e.anim) % 2 : 0;
}

export function registerBosses(painters) {
  painters.kraken = () => bossFrames(170, 120, drawKraken);
  painters.dragonkite = () => bossFrames(160, 90, drawDragonKite);
  painters.champion = () => bossFrames(130, 100, drawChampion);
  painters.colossus = () => bossFrames(120, 150, drawColossus);
  painters.sphinx = () => bossFrames(140, 100, drawSphinx);
  painters.bear = () => bossFrames(110, 100, drawBear);
  painters.golem = () => bossFrames(100, 120, drawGolem);
  painters.mammoth = () => bossFrames(140, 120, drawMammoth);
  painters.trex = () => bossFrames(90, 100, drawTrex);
  // <<BOSS_PAINTERS>>
}
