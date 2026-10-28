// Boss art. Bosses are drawn straight onto the canvas from rectangles every frame (they are big, animated by
// pose and few on screen), through a Brush that works in boss-local coordinates:
//   origin = centre of the feet, +x = the way the boss faces, -y = up. Mirroring for face < 0 is automatic.

import { Painter, lineTo } from '../../engine/gfx.js';
import { shade, mix } from './common.js';
import { flashCtx } from './hit.js';
import { flick } from './flash.js';

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
function drawTrex(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const skin = pose.rage ? '#8a5a38' : '#5a7a3a';
  const dark = shade(skin, -0.32);
  const belly = '#c8c090';
  const armor = '#6a6e88';
  const glow = '#ff4adc';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;

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
    headUp = 8;
    mouth = 6;
  }

  // tail
  B.r(-52, -62 - bob, 30, 16, skin);
  B.r(-70, -57 - bob, 20, 10, skin);
  B.r(-82, -53 - bob, 14, 6, skin);
  B.r(-52, -49 - bob, 30, 3, dark);
  // back leg
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.r(-16 + la, -26, 14, 21, dark);
  B.r(-16 + la, -5, 22, 5, shade(dark, -0.25));
  // torso
  B.r(-28, -66 - bob, 56, 42, skin);
  B.r(-28, -66 - bob, 56, 3, shade(skin, 0.2));
  B.r(-6, -46 - bob, 34, 22, belly);
  for (let i = 0; i < 4; i++) {
    B.r(-26 + i * 13, -74 - bob, 9, 9, armor);
    B.r(-26 + i * 13, -74 - bob, 9, 2, shade(armor, 0.4));
    B.r(-23 + i * 13, -70 - bob, 3, 4, glow);
  }
  // front leg (the stomping one)
  B.r(6 + lb, -26 - lift, 14, 21, skin);
  B.r(6 + lb, -5 - lift, 24, 5, dark);
  for (const x of [22, 26]) B.r(x + lb, -2 - lift, 2, 2, WHITE);
  // arm
  B.r(24, -44 - bob, 12, 4, skin);
  B.r(34, -43 - bob, 3, 3, WHITE);
  // neck and head
  const hy = -96 - headUp - bob;
  B.r(10, hy + 12, 18, -hy - 54 + bob > 0 ? -hy - 54 + bob : 8, skin);
  B.r(14, hy, 36, 16, skin);
  B.r(14, hy, 36, 3, shade(skin, 0.2));
  B.r(46, hy + 3, 7, 11, skin);
  B.r(16, hy - 3, 16, 4, armor);
  B.r(20, hy - 2, 3, 2, glow);
  if (mouth > 0) B.r(18, hy + 16, 30, mouth, '#3a0a14');
  B.r(16, hy + 16 + mouth, 32, 7, dark);
  for (let i = 0; i < 6; i++) {
    B.r(20 + i * 5, hy + 16, 2, 3, WHITE);
    B.r(22 + i * 5, hy + 14 + mouth + 2, 2, 3, WHITE);
  }
  const eyeFlash = atk === 'charge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  B.r(34, hy + 3, 6, 5, eyeFlash ? '#ffffff' : pose.rage || atk === 'charge' ? '#ff3a3a' : '#ffd23a');
  B.r(37, hy + 4, 2, 3, '#111111');
  if (atk === 'spit' && (state === 'tele' || state === 'attack')) {
    B.disc(54, hy + 17 + mouth / 2, 2 + Math.round(tele * 3), glow);
    B.disc(54, hy + 17 + mouth / 2, 1, '#ffffff');
  }
  // belly core: armoured plate when closed, pulsing when open
  const open = e.def.weakBox(e) !== null;
  if (open) {
    const pulse = flick(e.bs.age, 8) % 2;
    B.r(8, -38, 22, 26, '#3a0a4a');
    B.r(10, -36, 18, 22, pulse ? '#ff4adc' : '#ff80ea');
    B.r(14, -31, 10, 12, '#ffffff');
  } else {
    B.r(8, -38, 22, 26, armor);
    B.r(8, -38, 22, 3, shade(armor, 0.4));
    B.r(8, -12, 22, 2, shade(armor, -0.4));
    B.r(18, -38, 2, 26, shade(armor, -0.35));
    for (const [x, y] of [[10, -34], [26, -34], [10, -18], [26, -18]]) B.r(x, y, 2, 2, shade(armor, 0.5));
  }
}

// ---- MAGMA GOLEM ----
function drawGolem(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const rock = pose.rage ? '#5a3a34' : '#4a4048';
  const dark = shade(rock, -0.4);
  const light = shade(rock, 0.25);
  const lava = pose.rage ? '#ffe27a' : '#ff8a1e';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
  const { atk, tele, state } = pose;
  let armUp = 0;
  if ((state === 'tele' || state === 'attack') && atk === 'slam') armUp = state === 'tele' ? Math.round(60 * tele) : 0;
  if (state === 'phase') armUp = 60;
  const venting = state === 'attack' && atk === 'vent';

  // legs
  const la = walking ? [-2, 0, 2, 0][frame] : 0;
  const lb = walking ? [2, 0, -2, 0][frame] : 0;
  B.r(-20 + la, -32, 17, 32, dark);
  B.r(-22 + la, -9, 22, 9, shade(dark, -0.25));
  B.r(4 + lb, -32, 19, 32, rock);
  B.r(4 + lb, -9, 24, 9, dark);
  for (const [x, y] of [[-17 + la, -26], [8 + lb, -24], [14 + lb, -12]]) B.r(x, y, 5, 1, lava);
  // torso
  B.r(-28, -76 - bob, 58, 46, rock);
  B.r(-28, -76 - bob, 58, 4, light);
  B.r(-28, -34 - bob, 58, 4, dark);
  for (const [x, y, w] of [[-22, -66, 8], [-8, -58, 6], [16, -70, 9], [-18, -44, 10]]) {
    B.r(x, y - bob, w, 1, lava);
    B.r(x + w - 1, y - bob, 1, 5, lava);
  }
  // furnace door (the weak point)
  const open = e.def.weakBox(e) !== null;
  if (open) {
    const lick = flick(e.bs.age, 10) % 2;
    B.r(8, -46 - bob, 22, 30, '#2a0a06');
    B.r(10, -44 - bob, 18, 26, lick ? '#ff8a1e' : '#ffb03a');
    B.r(13, -40 - bob, 12, 18, '#ffe27a');
    B.r(16, -36 - bob, 6, 10, '#ffffff');
    B.r(8, -48 - bob, 22, 3, rock);
  } else {
    B.r(8, -46 - bob, 22, 30, '#34343e');
    B.r(8, -46 - bob, 22, 3, '#6a6a7a');
    for (let y = -40; y < -18; y += 7) B.r(11, y - bob, 16, 2, state === 'tele' && atk === 'vent' ? '#ffd23a' : lava);
    B.r(18, -46 - bob, 2, 30, '#1a1a22');
  }
  // shoulders
  B.r(-38, -84 - bob, 22, 20, light);
  B.r(-38, -84 - bob, 22, 3, shade(light, 0.3));
  B.r(18, -84 - bob, 22, 20, light);
  B.r(18, -84 - bob, 22, 3, shade(light, 0.3));
  // arms and fists
  if (armUp > 0) {
    B.r(-36, -64 - armUp - bob, 12, 26 + armUp, dark);
    B.r(-40, -80 - armUp, 18, 18, rock);
    B.r(30, -64 - armUp - bob, 12, 26 + armUp, rock);
    B.r(26, -80 - armUp, 18, 18, light);
  } else {
    B.r(-38, -64 - bob, 13, 38, dark);
    B.r(-42, -30, 19, 18, rock);
    B.r(30, -64 - bob, 13, 38, rock);
    B.r(30, -30, 19, 18, light);
    B.r(-38, -18, 11, 1, lava);
  }
  // head
  B.r(-8, -98 - bob, 26, 20, rock);
  B.r(-8, -98 - bob, 26, 3, light);
  B.r(-10, -104 - bob, 6, 8, dark);
  B.r(14, -104 - bob, 6, 8, dark);
  const eye = state === 'tele' ? (flick(tele, 12) % 2 ? '#ffffff' : '#ffd23a') : '#ffd23a';
  B.r(-1, -92 - bob, 6, 4, eye);
  B.r(9, -92 - bob, 6, 4, eye);
  B.r(2, -84 - bob, 10, 2, lava);
  if (venting) {
    B.r(-6, -112 - bob, 4, 10, lava);
    B.r(4, -118 - bob, 4, 14, '#ffd23a');
    B.r(12, -110 - bob, 4, 8, lava);
  }
}

// ---- MAMMOTH WALKER ----
function drawMammoth(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const fur = pose.rage ? '#7a5a4c' : '#6a5a54';
  const dark = shade(fur, -0.38);
  const ice = '#9ad4f0';
  const glow = '#9ae0ff';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
  const { atk, tele, state } = pose;
  let trunkUp = 0;
  let headDown = 0;
  if ((state === 'tele' || state === 'attack') && atk === 'breath') trunkUp = Math.round(28 * tele);
  if ((state === 'tele' || state === 'attack') && atk === 'howl') trunkUp = 30;
  if ((state === 'tele' || state === 'attack') && atk === 'charge') headDown = Math.round(8 * tele);
  if (state === 'phase') trunkUp = 30;

  // legs (back pair darker)
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.r(-40 + la, -38, 17, 38, dark);
  B.r(-42 + la, -8, 21, 8, shade(dark, -0.2));
  B.r(-16 + lb, -38, 17, 38, dark);
  B.r(-18 + lb, -8, 21, 8, shade(dark, -0.2));
  B.r(8 + la, -38, 18, 38, fur);
  B.r(6 + la, -8, 22, 8, dark);
  B.r(32 + lb, -38, 18, 38, fur);
  B.r(30 + lb, -8, 22, 8, dark);
  // body and hump
  B.r(-42, -82 - bob, 90, 48, fur);
  B.r(-30, -96 - bob, 56, 16, fur);
  B.r(-42, -82 - bob, 90, 3, shade(fur, 0.2));
  B.r(-42, -40 - bob, 90, 6, dark);
  // shaggy fringe
  for (let x = -40; x < 46; x += 6) B.r(x, -36 - bob, 3, 5 + ((x / 6) & 1) * 3, dark);
  // frost armour plates and spikes along the back
  for (let i = 0; i < 5; i++) {
    const x = -34 + i * 15;
    B.r(x, -102 - bob + (i % 2) * 3, 10, 9, ice);
    B.r(x, -102 - bob + (i % 2) * 3, 10, 2, '#ffffff');
    B.r(x + 4, -106 - bob + (i % 2) * 3, 2, 4, '#ffffff');
  }
  B.r(-20, -84 - bob, 4, 4, glow);
  B.r(8, -84 - bob, 4, 4, glow);
  // belly hatch (weak point)
  const open = e.def.weakBox(e) !== null;
  if (open) {
    const pulse = flick(e.bs.age, 8) % 2;
    B.r(6, -42 - bob, 28, 30, '#0a2a3a');
    B.r(8, -40 - bob, 24, 26, pulse ? '#5ad8ff' : '#9ae8ff');
    B.r(14, -34 - bob, 12, 14, '#ffffff');
  } else {
    B.r(6, -42 - bob, 28, 30, '#7a8aa8');
    B.r(6, -42 - bob, 28, 3, '#cfe4f4');
    B.r(6, -14 - bob, 28, 2, '#4a5a78');
    B.r(19, -42 - bob, 2, 30, '#3a4a68');
    for (const [x, y] of [[8, -38], [30, -38], [8, -18], [30, -18]]) B.r(x, y - bob, 2, 2, '#e8f4ff');
  }
  // head, tusks, trunk, eye
  const hy = -86 + headDown;
  B.r(38, hy - bob, 34, 34, fur);
  B.r(38, hy - bob, 34, 3, shade(fur, 0.2));
  B.r(44, hy - 8 - bob, 22, 10, ice);
  B.r(44, hy - 8 - bob, 22, 2, '#ffffff');
  const eyeFlash = atk === 'charge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  B.r(56, hy + 8 - bob, 5, 5, eyeFlash ? '#ffffff' : pose.rage || atk === 'charge' ? '#ff3a3a' : '#ffd23a');
  B.r(58, hy + 9 - bob, 2, 3, '#111111');
  const tuskGlow = atk === 'charge' && state === 'tele' ? glow : '#f4f0dc';
  B.r(52, hy + 24 - bob, 22, 4, tuskGlow);
  B.r(70, hy + 14 - bob, 4, 12, tuskGlow);
  B.r(72, hy + 10 - bob, 3, 5, tuskGlow);
  // trunk: hangs down, or rears up to breathe
  if (trunkUp > 0) {
    const t = trunkUp;
    B.r(68, hy + 8 - bob, 10, 12, fur);
    B.r(72, hy - t * 0.4 - bob, 10, 14 + t * 0.4, fur);
    B.r(74, hy - t - 4 - bob, 10, 12, shade(fur, 0.1));
    if (state === 'attack' && atk === 'breath') B.disc(80, hy - t - 4 - bob, 3 + (Math.floor(e.bs.age * 20) % 2), glow);
    if (state === 'tele' && atk === 'breath') B.disc(80, hy - t - 4 - bob, 2, '#ffffff');
  } else {
    B.r(66, hy + 8 - bob, 10, 14, fur);
    B.r(70, hy + 20 - bob, 9, 16, fur);
    B.r(68, hy + 34 - bob, 9, 14, shade(fur, -0.1));
  }
}

// ---- CAVE BEAR HIVE ----
function drawBear(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const fur = pose.rage ? '#7a4a36' : '#6b5040';
  const dark = shade(fur, -0.4);
  const light = shade(fur, 0.22);
  const hive = '#8a3a9a';
  const glow = '#ff4adc';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
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

  // back legs (dark) and front legs
  const la = walking ? [-3, 0, 3, 0][frame] : 0;
  const lb = walking ? [3, 0, -3, 0][frame] : 0;
  B.r(-30 + la, -20 + crouch, 14, 20 - crouch, dark);
  B.r(-32 + la, -4, 18, 4, shade(dark, -0.25));
  B.r(-14 + lb, -20 + crouch, 12, 20 - crouch, dark);
  B.r(-16 + lb, -4, 16, 4, shade(dark, -0.25));
  // body
  B.r(-34, -46 - bob + crouch, 60, 30, fur);
  B.r(-34, -46 - bob + crouch, 60, 3, light);
  B.r(-34, -22 - bob + crouch, 60, 6, dark);
  for (let x = -32; x < 24; x += 7) B.r(x, -17 - bob + crouch, 3, 3 + ((x / 7) & 1) * 2, dark); // shaggy underside
  // front legs (the raised pair when rearing)
  B.r(12 + lb, -22 - rear + crouch, 14, 22 + (rear > 0 ? 0 : 0), fur);
  if (rear > 8) {
    // the paw swings up: arm and claws
    B.r(18, -34 - rear, 12, 14 + rear * 0.5, fur);
    for (let i = 0; i < 3; i++) B.r(28 + i * 3, -36 - rear + i, 2, 6, '#f4f0dc');
  } else {
    B.r(10 + lb, -4, 20, 4, shade(fur, -0.3));
    for (const x of [26, 29]) B.r(x + lb, -2, 2, 2, WHITE);
  }
  // shoulder hump and head
  const hy = -44 - rear + crouch;
  B.r(0, -52 - rear * 0.6 + crouch, 28, 14, fur);
  B.r(22, hy - bob, 26, 24, fur);
  B.r(22, hy - bob, 26, 3, light);
  B.r(40, hy + 10 - bob, 12, 10, shade(fur, 0.12)); // snout
  B.r(50, hy + 11 - bob, 3, 3, '#111111');
  B.r(36, hy - 3 - bob, 5, 6, fur); // ear
  B.r(38, hy - 1 - bob, 2, 3, dark);
  if (mouth) {
    B.r(40, hy + 20 - bob, 12, mouth, '#3a1018');
    B.r(41, hy + 20 - bob, 2, 3, WHITE);
    B.r(47, hy + 20 - bob, 2, 3, WHITE);
  } else {
    B.r(40, hy + 19 - bob, 12, 2, dark);
    B.r(42, hy + 21 - bob, 2, 2, WHITE);
    B.r(48, hy + 21 - bob, 2, 2, WHITE);
  }
  const eyeFlash = atk === 'lunge' && state === 'tele' && flick(tele, 12) % 2 === 0;
  B.r(33, hy + 6 - bob, 5, 4, eyeFlash ? '#ffffff' : pose.rage || atk === 'lunge' ? '#ff3a3a' : glow);
  // the hive: purple pods crowning the shoulders, bright and swollen when open
  const pulse = flick((e.bs ? e.bs.age : 0), 8) % 2;
  const hy0 = -64 - rear * 0.6 + crouch;
  B.r(-2, hy0 + 10 - bob, 34, 14, shade(hive, -0.35));
  for (const [x, y, rw] of [[0, 8, 11], [10, 0, 13], [22, 6, 10], [13, 10, 9], [4, 14, 8]]) {
    B.r(x, hy0 + y - bob, rw, rw - 1, open ? (pulse ? '#ff7aea' : '#ff4adc') : hive);
    B.r(x, hy0 + y - bob, rw, 2, open ? '#ffd0f6' : shade(hive, 0.35));
    if (open) B.r(x + (rw >> 1) - 1, hy0 + y + (rw >> 1) - 1 - bob, 3, 3, '#ffffff');
    else B.r(x + (rw >> 1), hy0 + y + (rw >> 1) - bob, 2, 2, shade(hive, -0.5));
  }
}

// ---- Animated Sphinx ----
function drawSphinx(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const stone = pose.rage ? '#b8885a' : '#c8a468';
  const dark = shade(stone, -0.38);
  const light = shade(stone, 0.28);
  const gold = '#e8c040';
  const blue = '#2a5aa8';
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const frame = Math.floor(e.anim) % 4;
  const bob = walking && frame % 2 === 1 ? 1 : 0;
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

  // tail curling behind
  B.r(-60, -14, 14, 4, dark);
  B.r(-64, -22, 6, 10, dark);
  B.r(-66, -26, 6, 6, stone);
  // hind leg and haunch
  B.r(-50, -30 + crouch, 24, 30 - crouch, dark);
  B.r(-52, -4, 26, 4, shade(dark, -0.25));
  // body
  B.r(-52, -40 - bob + crouch, 62, 28, stone);
  B.r(-52, -40 - bob + crouch, 62, 3, light);
  B.r(-52, -16 - bob + crouch, 62, 4, dark);
  // carved hieroglyph bands
  for (let x = -46; x < 4; x += 10) {
    B.r(x, -32 - bob + crouch, 3, 3, dark);
    B.r(x + 4, -28 - bob + crouch, 2, 5, dark);
  }
  // far forepaw
  B.r(6, -10, 40, 10, dark);
  B.r(42, -4, 6, 4, shade(dark, -0.2));
  // near forepaw: extended, or raised for the slam
  if (paw > 10) {
    B.r(10, -34 - paw, 12, 26 + paw, stone);
    B.r(10, -34 - paw, 12, 3, light);
    for (let i = 0; i < 3; i++) B.r(10 + i * 4, -38 - paw, 3, 5, '#f4f0dc');
  } else {
    B.r(4, -14 + paw, 44, 14 - paw, stone);
    B.r(4, -14 + paw, 44, 3, light);
    for (let i = 0; i < 3; i++) B.r(44 + i * 1, -3 + i * 0, 2, 3, '#f4f0dc');
  }
  // chest and neck
  B.r(2, -52 - bob + crouch, 18, 40, stone);
  B.r(2, -52 - bob + crouch, 3, 40, light);
  // head: striped royal headdress (nemes) round a stone face
  const hy = -78 - bob + crouch + (lift ? -lift : 0);
  B.r(2, hy + 8, 16, 34 + crouch, blue); // rear lappet, behind the face
  for (let i = 0; i < 8; i++) B.r(2, hy + 10 + i * 4, 16, 1, gold);
  B.r(2, hy + 8, 16, 2, shade(gold, -0.2));
  B.r(8, hy, 32, 11, gold); // the crown, striped blue
  for (let i = 0; i < 6; i++) B.r(10 + i * 5, hy, 2, 11, blue);
  B.r(8, hy, 32, 2, shade(gold, 0.35));
  B.r(20, hy + 10, 22, 30, shade(stone, -0.12)); // face shadow
  B.r(21, hy + 10, 20, 29, stone);
  B.r(21, hy + 10, 20, 2, light);
  B.r(21, hy + 11, 20, 2, dark); // brow band
  B.r(38, hy + 22, 6, 10, shade(stone, 0.14)); // nose
  B.r(43, hy + 28, 2, 3, dark);
  // eyes with kohl; Rift light, red when enraged, a white blink while it winds up
  const eye = pose.rage || atk === 'pounce' ? '#ff3a3a' : '#ff4adc';
  B.r(29, hy + 18, 9, 4, '#14141c');
  B.r(32, hy + 19, 5, 2, state === 'tele' && flick(tele, 14) % 2 === 0 ? '#ffffff' : eye);
  B.r(21, hy + 18, 4, 4, dark);
  // mouth and the false beard
  if (mouth) {
    B.r(30, hy + 33, 13, mouth, '#2a1008');
    B.r(32, hy + 33, 2, 3, '#f4f0dc');
    B.r(39, hy + 33, 2, 3, '#f4f0dc');
  } else {
    B.r(30, hy + 34, 13, 2, dark);
  }
  B.r(36, hy + 40, 7, 14, blue);
  B.r(36, hy + 40, 7, 2, gold);
  // the brow gem (the weak point): dull blue-grey when closed, blazing pink-white when open
  const pulse = flick((e.bs ? e.bs.age : 0), 9) % 2;
  B.r(26, hy - 5, 8, 10, '#14141c'); // its setting
  B.r(27, hy - 4, 6, 8, open ? (pulse ? '#ff9af0' : '#ff4adc') : '#5a6a8a');
  B.r(28, hy - 3, 3, 3, open ? '#ffffff' : '#9aaac8');
  if (open) {
    ctx.globalAlpha = 0.25;
    B.disc(30, hy, 6, '#ff4adc');
    ctx.globalAlpha = 1;
  }
}

// ---- Bronze Colossus ----
function drawColossus(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const bronze = pose.rage ? '#c0602a' : '#b87333';
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
  const pulse = flick((e.bs ? e.bs.age : 0), 9) % 2;

  // far shield, behind the body
  B.disc(-30, -74 + kneel, 13, dark);
  B.disc(-30, -74 + kneel, 10, mid);
  B.disc(-30, -74 + kneel, 3, light);
  // legs: the back one dark, the front one lit; the front foot lifts for the stomp
  B.r(-26 + step, -46 + kneel, 18, 46 - kneel, dark);
  B.r(-30 + step, -5, 24, 5, shade(dark, -0.3));
  for (const y of [-38, -24, -12]) B.r(-26 + step, y, 18, 2, shade(dark, -0.3));
  const fl = lift;
  B.r(2 - step, -46 + kneel - 0, 20, 46 - kneel - fl, mid);
  B.r(2 - step, -46 + kneel, 4, 46 - kneel - fl, light);
  for (const y of [-38, -24, -12]) B.r(2 - step, y - fl, 20, 2, dark);
  B.r(0 - step, -5 - fl, 28, 5, dark);
  B.r(0 - step, -5 - fl, 28, 1, mid);
  // the heel seam: ichor glowing in the greave
  const seam = open ? (pulse ? '#ffd0f6' : '#ff4adc') : '#5a3a4a';
  B.r(15 - step, -36 - fl, 5, 30, '#14141c');
  B.r(16 - step, -35 - fl, 3, 28, seam);
  if (open) {
    ctx.globalAlpha = 0.22;
    B.disc(17 - step, -22 - fl, 10, '#ff4adc');
    ctx.globalAlpha = 1;
  }
  // skirt of bronze straps
  B.r(-28, -54 + kneel, 54, 10, mid);
  for (let x = -26; x < 24; x += 8) B.r(x, -44 + kneel, 6, 6, dark);
  B.r(-28, -54 + kneel, 54, 2, light);
  // torso: a muscled cuirass
  B.r(-24, -92 + kneel, 46, 40, bronze);
  B.r(-24, -92 + kneel, 46, 3, light);
  B.r(-24, -92 + kneel, 3, 40, light);
  B.r(-24, -56 + kneel, 46, 4, dark);
  B.r(-2, -86 + kneel, 2, 26, dark); // the sternum line
  B.r(-14, -80 + kneel, 10, 3, dark);
  B.r(6, -80 + kneel, 10, 3, dark);
  B.r(-12, -68 + kneel, 22, 2, dark);
  // pauldrons
  B.disc(-22, -90 + kneel, 9, mid);
  B.disc(22, -90 + kneel, 9, mid);
  B.r(14, -99 + kneel, 16, 3, light);
  // near arm and its weapon
  const ay = -86 + kneel - armsUp;
  B.r(20, ay, 10, 24 + armsUp / 2, mid);
  B.r(20, ay, 10, 3, light);
  const planted = !(act && (atk === 'spear' || atk === 'discus'));
  if (atk === 'discus' && act) {
    B.disc(36, -66 + kneel, 8, '#e0a840');
    B.disc(36, -66 + kneel, 3, '#fff2a8');
  } else if (act && atk === 'spear') {
    B.line(22, -70, 56, -122, '#7a5a2a', 3);
    B.r(54, -128, 6, 8, '#dfe6ee');
  } else if (planted && !armsUp) {
    B.line(40, -2, 40, -126, '#7a5a2a', 3);
    B.r(37, -136, 7, 12, '#dfe6ee');
    B.r(26, -80 + kneel, 14, 6, mid);
  }
  // head: a crested Corinthian helm with burning eyes
  const hy = -118 + kneel;
  B.r(-8, hy + 8, 24, 20, bronze);
  B.r(-8, hy + 8, 24, 3, light);
  B.r(-10, hy + 24, 6, 8, dark);
  B.r(12, hy + 18, 6, 12, mid); // cheek guard
  B.r(-4, hy, 16, 10, dark); // crest base
  for (let i = 0; i < 8; i++) B.r(-4 + i * 2, hy - (i & 1) * 3 - 2, 2, 5 + (i & 1) * 3, '#c0262e');
  const eye = pose.rage ? '#ff3a3a' : '#ff4adc';
  B.r(6, hy + 16, 10, 3, '#14141c');
  B.r(9, hy + 16, 6, 3, state === 'tele' && flick(tele, 14) % 2 === 0 ? '#ffffff' : eye);
}

// ---- Chariot Champion ----
function drawChampion(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const horse = pose.rage ? '#4a2a1a' : '#6a3a22';
  const horseD = shade(horse, -0.4);
  const bard = '#c8923a'; // bronze barding
  const wood = '#8a2a2a';
  const trim = '#ffd23a';
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const cs = e.cs;
  const running = act && atk === 'charge' && cs && cs.mode === 'run';
  const stun = act && atk === 'charge' && cs && cs.mode === 'stun';
  const rear = act && atk === 'charge' && state === 'tele' ? Math.round(14 * tele) : cs && cs.mode === 'turn' ? 8 : 0;
  const gallop = running ? Math.floor(e.x / 9) % 2 : walkPhase(e);
  const open = e.def.weakBox(e) !== null;
  const pulse = flick((e.bs ? e.bs.age : 0), 9) % 2;

  // two horses abreast (the far one darker), legs galloping
  for (const off of [-6, 0]) {
    const body = off ? horseD : horse;
    const lift = off ? 0 : rear;
    B.r(8 + off, -26 - lift, 28, 11, body);
    B.r(8 + off, -26 - lift, 28, 2, shade(body, 0.25));
    B.r(30 + off, -34 - lift, 7, 10, body); // neck
    B.r(35 + off, -35 - lift, 9, 6, body); // head
    B.r(37 + off, -38 - lift, 2, 3, body);
    B.r(41 + off, -34 - lift, 1, 1, '#ffd23a');
    B.r(28 + off, -34 - lift, 4, 10, '#14141c'); // mane
    B.r(10 + off, -26 - lift, 12, 5, bard);
    B.r(10 + off, -26 - lift, 12, 1, shade(bard, 0.35));
    B.r(4 + off, -24 - lift, 5, 3, '#14141c'); // tail
    const l0 = gallop ? 2 : -2;
    B.r(11 + off + l0, -16 - lift, 4, 16 + lift, shade(body, -0.15));
    B.r(31 + off - l0, -16 - lift, 4, 16 + lift, body);
    B.r(10 + off + l0, -3, 6, 3, '#14141c');
    B.r(30 + off - l0, -3, 6, 3, '#14141c');
  }
  // the yoke pole
  B.r(-4, -17, 18, 2, '#7a5a2a');
  // the chariot car
  B.r(-30, -22, 30, 14, wood);
  B.r(-30, -22, 30, 2, shade(wood, 0.4));
  B.r(-30, -10, 30, 2, trim);
  B.r(-32, -26, 4, 12, trim);
  B.r(-30, -22, 3, 14, shade(wood, -0.3));
  for (let i = 0; i < 3; i++) B.r(-24 + i * 9, -18, 5, 3, trim);
  // big spoked wheel
  const wr = 11;
  const a = (e.x * 0.09) % Math.PI;
  B.disc(-14, -wr + 1, wr, '#2a1a10');
  B.disc(-14, -wr + 1, wr - 2, '#8a6a3a');
  B.disc(-14, -wr + 1, wr - 4, '#2a1a10');
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 4;
    B.line(-14 - Math.cos(ang) * (wr - 2), -wr + 1 - Math.sin(ang) * (wr - 2), -14 + Math.cos(ang) * (wr - 2), -wr + 1 + Math.sin(ang) * (wr - 2), '#8a6a3a', 1);
  }
  B.r(-15, -wr, 3, 3, trim);
  // the champion: red-crested helm, bronze cuirass, reins to the horses
  const sway = stun ? 3 : 0;
  const dy = stun ? 6 : 0;
  B.r(-26 + sway, -52 + dy, 12, 20, '#a83a2a');
  B.r(-26 + sway, -52 + dy, 12, 3, '#c85a3a');
  B.r(-26 + sway, -46 + dy, 12, 8, bard);
  B.r(-24 + sway, -64 + dy, 8, 12, '#d89a68');
  B.r(-26 + sway, -68 + dy, 12, 6, bard);
  for (let i = 0; i < 6; i++) B.r(-26 + sway + i * 2, -74 + dy - (i & 1) * 2, 2, 7, '#c0262e');
  const eye = pose.rage ? '#ff3a3a' : '#ff4adc';
  B.r(-20 + sway, -60 + dy, 4, 2, stun ? '#ffffff' : eye);
  // arms: reins forward, or a javelin overhead
  if (act && atk === 'javelins') {
    const up = state === 'tele' ? tele : 1;
    B.line(-18, -48 + dy, -4 + up * 10, -64 - up * 12, '#dfe6ee', 2);
    B.r(-6 + up * 10, -68 - up * 12, 5, 3, '#dfe6ee');
    B.r(-20, -50, 8, 4, '#d89a68');
  } else {
    B.line(-16, -44 + dy, 6, -30, '#14141c', 1);
    B.line(-16, -44 + dy, 6, -34, '#14141c', 1);
    B.r(-18, -46 + dy, 6, 5, '#d89a68');
  }
  if (act && atk === 'summon') B.r(-10, -76, 8, 3, trim); // a horn raised
  if (stun) {
    // dazed: stars circling the driver's head
    const t = (e.bs ? e.bs.age : 0) * 8;
    for (let i = 0; i < 3; i++) B.r(-24 + Math.round(Math.cos(t + i * 2.1) * 10), -82 + Math.round(Math.sin(t + i * 2.1) * 3), 3, 3, '#ffe27a');
  }
  // the weak point glows while the driver is open
  if (open) {
    ctx.globalAlpha = 0.2;
    B.disc(-20, -50, 18, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  }
}

// The Dragon Kite Fortress: a segmented paper dragon, a pagoda on its back, a glowing pearl in its brow.
function drawDragonKite(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const red = pose.rage ? '#c01826' : '#d8342a';
  const redD = shade(red, -0.42);
  const redL = shade(red, 0.3);
  const gold = '#ffd23a';
  const paper = '#f4e8c8';
  const jade = '#2a7a5a';
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const dv = e.dv;
  const diving = act && atk === 'lunge' && dv && dv.mode === 'dive';
  const crashed = act && atk === 'lunge' && dv && dv.mode === 'crash';
  const breath = act && atk === 'breath';
  const rockets = act && atk === 'rockets';
  const wob = (i, k = 3) => Math.round(Math.sin(t * 3 + i * 0.9) * k);

  // trailing ribbon tail
  for (let i = 0; i < 9; i++) {
    const x = -48 - i * 7;
    const y = -26 + Math.round(Math.sin(t * 4 + i * 0.8) * (2 + i * 0.7)) + (diving ? -i : 0);
    B.r(x, y, 8, 6 - (i > 5 ? 2 : 0), i % 2 ? gold : red);
    if (i > 6) B.r(x + 2, y - 3 - (i & 1), 3, 3, paper);
  }
  // body segments, tail to neck, drawn from the back so the front overlaps
  const segs = [];
  for (let i = 0; i < 6; i++) segs.push([-40 + i * 12, -26 + wob(i) - (i === 5 ? 8 : 0), i === 0 ? 6 : 9]);
  for (const [x, y, r] of segs) {
    B.disc(x, y, r, redD);
    B.disc(x, y - 1, r - 1, red);
    B.r(x - r + 3, y - r + 1, r, 2, redL);
    B.r(x - 3, y + 2, 7, r - 3, paper); // belly plate
    B.r(x - 1, y - r - 3, 3, 4, gold); // dorsal fin
  }
  // claws under two segments
  for (const i of [2, 4]) {
    const [x, y] = segs[i];
    const kick = Math.round(Math.sin(t * 5 + i) * 1.5);
    B.r(x - 2 + kick, y + 8, 4, 6, redD);
    B.r(x - 4 + kick, y + 13, 3, 2, paper);
    B.r(x + kick, y + 13, 3, 2, paper);
    B.r(x + 4 + kick, y + 12, 2, 2, paper);
  }
  // the pagoda strapped to the back
  B.r(-24, -39, 34, 4, '#4a2e1a');
  B.r(-20, -51, 26, 12, red);
  B.r(-20, -51, 26, 2, redL);
  B.r(-20, -41, 26, 2, gold);
  B.r(-14, -49, 4, 6, '#2a1a10');
  B.r(-2, -49, 4, 6, '#2a1a10');
  B.r(-26, -56, 38, 5, jade);
  B.r(-26, -56, 38, 1, shade(jade, 0.4));
  B.r(-22, -61, 30, 5, shade(jade, -0.15));
  B.r(-8, -67, 2, 7, gold);
  B.r(-30, -53, 4, 2, jade); // upturned eaves
  B.r(10, -53, 4, 2, jade);
  const lant = Math.floor(t * 3) % 2;
  B.r(-24, -45, 3, 5, lant ? '#ff6a4a' : '#ffb02e');
  // rocket tubes rise from the roof while the fireworks are being readied
  if (rockets) {
    const up = state === 'tele' ? tele : 1;
    for (let k = -1; k <= 1; k++) {
      const h = Math.round(10 + 8 * up);
      B.r(-10 + k * 8 + 1, -61 - h, 3, h, '#9a7a3a');
      B.r(-10 + k * 8 + 1, -63 - h, 3, 2, red);
      if (Math.floor(t * 20) % 2) B.r(-10 + k * 8 + 2, -65 - h, 1, 2, '#ffe27a');
    }
  }
  // the head, up on the neck
  const jaw = breath ? Math.round(3 + 6 * (state === 'tele' ? tele : 1)) : 3;
  const hy = diving ? 6 : crashed ? 8 : 0;
  B.r(26, -46 + hy, 24, 18, red); // skull
  B.r(26, -46 + hy, 24, 3, redL);
  B.r(46, -40 + hy, 14, 8, red); // snout
  B.r(46, -40 + hy, 14, 2, redL);
  B.r(30, -29 + hy, 28, 3 + (jaw - 3), redD); // lower jaw
  B.r(48, -31 + hy, 2, 3, paper); // fangs
  B.r(54, -31 + hy, 2, 3, paper);
  B.r(56, -41 + hy, 2, 2, '#2a0a0a'); // nostril
  if (breath) {
    ctx.globalAlpha = 0.85;
    B.r(52, -30 + hy, 8, jaw - 1, Math.floor(t * 18) % 2 ? '#ffd23a' : '#ff8a1e');
    ctx.globalAlpha = 1;
  }
  // horns, mane, brow, eye
  B.r(30, -56 + hy, 3, 10, paper);
  B.r(36, -58 + hy, 3, 12, paper);
  for (let i = 0; i < 4; i++) B.r(24 - i * 4, -50 + hy + (i & 1) * 3, 5, 3, gold);
  B.r(40, -45 + hy, 8, 2, redD);
  B.r(42, -43 + hy, 4, 3, '#fff6c8');
  B.r(44, -42 + hy, 2, 2, pose.rage ? '#ff2a2a' : '#1a0a0a');
  // whiskers, trailing back and waving
  for (const s of [0, 1]) {
    B.line(58, -36 + hy + s * 3, 68 + wob(s, 2), -28 + hy + s * 6 + wob(s + 2, 3), '#fff6c8', 1);
  }
  // the pearl: bright and pulsing when the weak point is open, hidden behind a gold plate when shut
  if (open) {
    const pulse = flick(t, 9) % 2;
    ctx.globalAlpha = 0.2;
    B.disc(40, -36 + hy, 16, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
    B.disc(40, -37 + hy, 5, pulse ? '#ffffff' : '#ff9af0');
    B.r(38, -39 + hy, 2, 2, '#ffffff');
  } else {
    B.r(34, -42 + hy, 12, 10, gold);
    B.r(34, -42 + hy, 12, 2, shade(gold, 0.4));
    B.r(38, -38 + hy, 4, 3, redD);
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
}

// The Kraken: a purple head and mantle heaved over the stern of the ship, tentacles reaching across the deck.
function drawKraken(ctx, e, cx, cy, pose) {
  const t = e.bs ? e.bs.age : 0;
  const rise = e.bs && e.bs.state === 'enter' ? Math.max(0, 1 - e.bs.age / 1.4) * 70 : 0; // it rears up out of the sea
  const B = brush(ctx, cx, cy + rise, e.face);
  const body = pose.rage ? '#8a2a6a' : '#6a3a98';
  const bodyD = shade(body, -0.4);
  const bodyL = shade(body, 0.3);
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const slam = act && atk === 'slam';
  const sweep = act && atk === 'sweep';
  const ink = act && atk === 'ink';
  const duck = slam || sweep ? 14 : ink ? -4 : 0; // the head sinks behind the rail while the tentacles work
  const wob = (k, a = 2) => Math.round(Math.sin(t * 3 + k) * a);

  // a tentacle: a chain of discs from (x0,y0) to (x1,y1), bowed by `bend`, thinning to the tip
  const tent = (x0, y0, x1, y1, bend, k, r0 = 7) => {
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = x0 + (x1 - x0) * u + wob(k + u * 5, 2);
      const y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * bend;
      const r = Math.max(2, Math.round(r0 * (1 - u * 0.7)));
      B.disc(x, y, r, i % 2 ? shade(body, -0.15) : body);
      if (i % 2 === 0 && i < n - 2) B.disc(x + 1, y + Math.round(r * 0.5), 1, '#e8c8f0'); // suckers
    }
  };

  // tentacles first, so the head overlaps their roots
  const lift = slam ? Math.round(30 * (state === 'tele' ? tele : 1)) : 0;
  tent(10, -22, 96, -6 - lift * 0.3, 18 + lift, 0, 7);
  tent(0, -30, 70, -12 - lift, 26 + lift * 0.6, 1.7, 7);
  tent(20, -14, 120, sweep ? -5 : -3 - lift * 0.2, sweep ? 3 : 10, 3.1, 6);
  tent(-14, -26, 42, -4 - lift * 0.5, 22, 4.4, 6);
  if (sweep) tent(30, -8, 150 - Math.round(20 * (state === 'tele' ? 1 - tele : 0)), -6, 2, 5, 6); // a long arm stretched low across the deck
  // mantle and head
  B.disc(-4, -62 + duck, 32, bodyD);
  B.disc(-2, -64 + duck, 30, body);
  B.disc(-8, -72 + duck, 16, bodyL);
  for (const [sx, sy] of [[-14, -80], [4, -84], [-24, -64], [8, -52], [-6, -56]]) B.disc(sx, sy + duck, 2, bodyD); // mottling
  // fins on the mantle
  B.r(-34, -76 + duck, 8, 14, bodyD);
  B.r(-38, -72 + duck, 6, 8, body);
  // the eye
  if (open) {
    const pulse = flick(t, 9) % 2;
    ctx.globalAlpha = 0.2;
    B.disc(20, -60 + duck, 22, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
    B.disc(20, -60 + duck, 10, '#fff6e0');
    B.disc(21, -60 + duck, 6, pulse ? '#ff4adc' : '#c0189a');
    B.r(20, -64 + duck, 3, 8, '#1a0a1a');
  } else {
    B.disc(20, -60 + duck, 10, bodyD);
    B.r(10, -62 + duck, 20, 4, shade(body, -0.55)); // a heavy lid
    B.r(12, -63 + duck, 16, 1, '#e8c8f0');
  }
  // beak and the funnel under it
  B.r(26, -44 + duck, 12, 8, '#e0c890');
  B.r(30, -38 + duck, 6, 6, '#b89858');
  B.r(36, -44 + duck, 3, 4, '#2a1a10');
  if (ink) {
    ctx.globalAlpha = 0.8;
    B.disc(40, -34 + duck, 4 + (Math.floor(t * 10) % 3), '#2a1a4a');
    ctx.globalAlpha = 1;
  }
  // sea spray at the stern
  for (let i = 0; i < 6; i++) B.r(-30 + i * 12, -4 + ((Math.floor(t * 8) + i) % 3), 8, 4, i % 2 ? '#ffffff' : '#bfe0f4');
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
