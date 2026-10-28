// Boss art for Week 10: the Siege Tower Titan (level 10), the Oni Warlord (level 11) and the Ghost Galleon (level 12).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade, mix } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';
import { weakPoint, damageMarks, breathe, blink, collapse } from './bossfx.js';

const IRON = '#aab2c0';
const CHAR = '#14100e';

/** Where the i-th loose part has flown to while the boss dies: spread sideways, thrown up, then falling back. */
function flung(dead, i, dir = 0) {
  const side = dir || (i % 2 ? 1 : -1);
  return { x: Math.round(side * dead.fly * (0.35 + (i % 3) * 0.15)), y: -Math.round(dead.fly * (0.7 + i * 0.1) - dead.k * dead.k * 40) };
}

// ---------------------------------------------------------------------------------------------------------------
// Siege Tower Titan
// ---------------------------------------------------------------------------------------------------------------
const TOWER_MARKS = [
  { x: -18, y: -58, kind: 'crack', phase: 1 },
  { x: 18, y: -98, kind: 'plate', phase: 1 },
  { x: -30, y: -46, kind: 'scorch', phase: 2 },
  { x: -22, y: -100, kind: 'smoke', phase: 2 },
  { x: -6, y: -70, kind: 'spark', phase: 2 },
];

function drawSiegeTower(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  // the roof, archers and cauldron rise a pixel with each breath
  const rb = Math.max(0, breathe(pose, 1));
  const R = brush(ctx, cx, cy + dead.sink - rb, e.face);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const t = pose.bs.age;
  const wood = burn(pose.rage ? '#6a3a24' : '#7a5230');
  const woodD = shade(wood, -0.4);
  const woodL = shade(wood, 0.28);
  const cloth = burn('#a8282e');
  const iron = burn(IRON);
  const strap = burn('#3a3a46');
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const rm = e.rm;
  const open = e.def.weakBox(e) !== null;
  const pulse = flick(t, 9) % 2;
  const rolling = Math.abs(e.vx) > 2;

  // wheels (three great spoked wheels)
  const spin = (e.x * 0.07) % Math.PI;
  for (const wx of [-26, 0, 26]) {
    B.disc(wx, -10, 11, '#0e0a06');
    B.disc(wx, -10, 10, burn('#1c120a'));
    B.disc(wx, -10, 8, burn('#8a6a3a'));
    B.disc(wx, -10, 6, burn('#2a1a10'));
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4;
      B.line(wx - Math.cos(a) * 8, -10 - Math.sin(a) * 8, wx + Math.cos(a) * 8, -10 + Math.sin(a) * 8, burn('#8a6a3a'), 1);
    }
    B.r(wx - 1, -11, 3, 3, iron);
  }
  // chassis beam and the planked body
  B.part(-38, -24, 76, 8, woodD);
  B.part(-36, -102, 72, 78, wood);
  for (let y = -100; y < -24; y += 6) B.r(-36, y, 72, 1, woodD);
  B.r(-36, -102, 72, 2, woodL);
  B.r(-36, -102, 3, 78, woodD); // the shadowed back edge
  // cross bracing
  B.line(-34, -26, 34, -98, woodD, 2);
  B.line(34, -26, -34, -98, woodD, 2);
  // iron straps
  for (const y of [-92, -60, -32]) {
    B.slab(-36, y, 72, 3, strap);
    B.r(-36, y, 72, 1, iron);
  }
  // cloth hides and a banner: the banner tears loose when it dies
  const bn = flung(dead, 0, -1);
  B.part(-30 + bn.x, -88 + bn.y, 22, 26, cloth);
  B.r(-24 + bn.x, -80 + bn.y, 10, 10, burn('#ffd23a'));
  B.r(-22 + bn.x, -78 + bn.y, 6, 6, cloth);
  // arrow slits, with a pair of eyes in the first one that blinks while it idles
  for (const [x, y] of [[8, -86], [20, -74], [8, -62]]) B.r(x, y, 10, 3, '#14100c');
  if (!dead.k && !(state === 'idle' && blink(t))) {
    B.r(10, -85, 2, 1, '#ff3a3a');
    B.r(15, -85, 2, 1, '#ff3a3a');
  }

  // roof deck and battlements: the merlons are what flies off first
  R.part(-40, -112, 80, 10, woodD);
  R.r(-40, -112, 80, 2, woodL);
  let m = 0;
  for (let x = -38; x < 38; x += 14, m++) {
    const f = flung(dead, m + 1);
    R.part(x + f.x, -122 + f.y, 9, 10, wood);
  }
  // archers peeking over the merlons (they stand and draw during the volley)
  const volley = act && atk === 'arrows';
  for (const [x, k] of [[-34, 0], [-6, 1], [22, 2]]) {
    const up = volley ? (state === 'attack' ? 2 : Math.round(2 * tele)) : 0;
    R.part(x + 1, -128 - up, 7, 6, burn('#8a92a0')); // helm
    R.r(x + 5, -125 - up, 3, 2, '#14141c');
    if (volley && state === 'attack') R.line(x + 8, -120, x + 15, -126 - k, '#8a5a2a', 1);
  }
  // the oil cauldron on the roof: tips and drips fire while it pours
  const pour = act && atk === 'oil';
  const tip = pour ? (state === 'tele' ? tele : 1) : 0;
  const cf = flung(dead, 2, 1);
  const cxp = 14 + Math.round(tip * 10) + cf.x;
  const cyp = -116 - Math.round(tip * 3) + cf.y;
  R.disc(cxp, cyp, 9, '#0e0e14');
  R.disc(cxp, cyp, 8, burn('#2a2a32'));
  R.disc(cxp, cyp, 6, '#14141c');
  R.r(cxp - 6, cyp - 5, 12, 2, pour ? (pulse ? '#ffd23a' : '#ff8a1e') : burn('#3a2a20'));
  if (pour && state === 'attack') {
    for (let i = 0; i < 5; i++) R.r(cxp + 6 + i * 5, -112 + i * 10 + ((t * 40) % 6 | 0), 3, 5, i % 2 ? '#ff8a1e' : '#ffd23a');
  }
  // idle: oil fumes curl off the cauldron
  if (state === 'idle') {
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.6 + i * 0.5) % 1;
      R.disc(cxp - 2 + i * 4 + Math.round(Math.sin(t * 2 + i) * 1.5), cyp - 8 - Math.round(k * 14), 1 + (k > 0.5 ? 1 : 0), k < 0.6 ? '#5a5560' : '#7a7680');
    }
  }

  // front: the drawbridge hinged on the upper face, the ram port below (it drops when the tower dies)
  const bridge = act && atk === 'drawbridge';
  const swing = bridge ? (state === 'tele' ? tele * 0.3 : 1) : dead.k > 0.15 ? 1 : 0;
  if (swing > 0.5) {
    // lowered: a ramp to the floor
    B.stroke(38, -78, 74, -22, woodD, 4);
    B.stroke(38, -78, 74, -22, wood, 2);
    B.part(70, -24, 10, 4, iron);
  } else {
    const lean = Math.round(swing * 3 * 10);
    B.part(36 + lean, -100, 4, 44, wood);
    B.r(34 + lean, -80, 8, 3, strap);
  }
  // the ram port: an iron frame around the weak point (the Rift core behind its hatch)
  B.part(9, -46, 31, 42, strap);
  weakPoint(B, 12, -42, 24, 36, { open, col: '#ff4adc', age: t, hit: e.flash || 0 });
  if (open) {
    B.disc(24, -24, 8, '#ff9af0');
    B.disc(24, -24, 5, '#ffffff');
    ctx.globalAlpha = 0.22;
    B.disc(24, -24, 24, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  } else {
    // shut: a bar across the port
    B.r(10, -30, 28, 3, strap);
    B.r(10, -30, 28, 1, iron);
    B.r(30, -34, 4, 11, iron);
  }
  // the ram itself: pulled back while winding up, thrust out while rolling and resting
  if (act && atk === 'ram') {
    let out = 0;
    if (state === 'tele') out = -4 * tele;
    else if (rm) out = rm.mode === 'roll' ? 34 : rm.mode === 'rest' ? 30 : Math.max(0, 30 - rm.t * 40);
    if (out > 0) {
      B.part(24, -30, 14 + out, 9, burn('#8a5a30'));
      B.part(38 + out, -33, 7, 15, iron);
      B.r(38 + out, -33, 7, 2, '#ffffff');
      B.r(43 + out, -29, 3, 7, '#6a7280');
    } else if (state === 'tele') {
      B.part(16 - Math.round(4 * tele), -30, 14, 9, burn('#8a5a30'));
    }
  }
  // dust behind rolling wheels
  if (rolling && e.grounded) {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) B.r(-44 - i * 6 - ((t * 30) % 5 | 0), -4 - i * 3, 5, 3, '#c8b898');
    ctx.globalAlpha = 1;
  }
  damageMarks(B, pose, TOWER_MARKS);
}


// ---------------------------------------------------------------------------------------------------------------
// Oni Warlord
// ---------------------------------------------------------------------------------------------------------------
const ONI_MARKS = [
  { x: -16, y: -76, kind: 'crack', phase: 1 },
  { x: -22, y: -62, kind: 'plate', phase: 1 },
  { x: -18, y: -40, kind: 'scorch', phase: 2 },
  { x: -22, y: -82, kind: 'smoke', phase: 2 },
  { x: -10, y: -68, kind: 'spark', phase: 2 },
  { x: -6, y: -90, kind: 'crack', phase: 2 },
];

function drawOni(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const t = pose.bs.age;
  const skin = burn(pose.rage ? '#a82240' : '#c8382a');
  const skinD = shade(skin, -0.38);
  const horn = burn('#f0e8d0');
  const gold = burn('#e0b83a');
  const dark = burn('#14141c');
  const iron = burn(IRON);
  const { atk, tele, state } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const pulse = flick(t, 9) % 2;
  const sm = e.sm;
  const lp = e.lp;
  const walking = Math.abs(e.vx) > 2 && e.grounded;
  const step = walking ? Math.floor(t * 6) % 2 : 0;
  let crouch = 0;
  let airborne = false;
  if (act && atk === 'leap') {
    if (state === 'tele') crouch = Math.round(10 * tele);
    else if (lp && lp.mode === 'air') airborne = true;
    else if (lp && lp.mode === 'rest') crouch = 6;
  }
  const up = Math.max(0, breathe(pose, 1));
  const dy = crouch - up; // the body sinks (or breathes up), the feet stay planted
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const U = brush(ctx, cx, cy + dead.sink + dy, e.face); // the upper body, for the damage marks
  const arms = act && atk === 'thunder';
  const roar = act && (atk === 'summon' || (atk === 'smash' && state === 'tele' && tele > 0.6));

  // legs
  B.part(-16, -36 + dy, 13, 36 - dy, skinD);
  B.part(3, -36 + dy, 13, 36 - dy, skin);
  B.part(-17, -6 + (step ? -2 : 0), 15, 6, burn('#2a1a1a')); // feet with claws
  B.part(2, -6 + (step ? 0 : -2), 15, 6, burn('#2a1a1a'));
  for (const x of [-17, 2]) B.r(x + 11, -3, 5, 2, horn);
  // tiger-skin loincloth
  B.part(-20, -48 + dy, 40, 16, gold);
  for (let i = 0; i < 6; i++) B.r(-18 + i * 7, -48 + dy, 3, 14 - (i & 1) * 3, dark);
  B.r(-20, -48 + dy, 40, 2, dark);
  // torso
  B.part(-24, -82 + dy, 48, 36, skin);
  B.r(-24, -82 + dy, 5, 36, skinD);
  B.r(-4, -62 + dy, 3, 12, skinD); // abs
  B.r(-14, -66 + dy, 10, 2, skinD);
  // the Rift breastplate: a gold frame, and the gem set in it (shutter slats when covered, glowing when it can be hit)
  B.part(2, -70, 26, 36, gold);
  weakPoint(B, 4, -68, 22, 32, { open, col: '#ff4adc', age: t, hit: e.flash || 0 });
  if (open) {
    B.disc(15, -52, 5, '#ffffff');
    ctx.globalAlpha = 0.22;
    B.disc(15, -52, 20, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  }
  // head: horned, tusked, wild-haired
  const hy = -104 + dy;
  B.part(-14, hy + 8, 26, 6, dark); // hair
  B.part(-14, hy + 10, 6, 14, dark);
  B.part(-9, hy + 12, 20, 18, skin);
  B.r(-9, hy + 12, 3, 18, skinD);
  if (state === 'idle' && blink(t, 1.1)) B.r(-2, hy + 17, 8, 1, '#14141c'); // a slow blink
  else {
    B.r(-2, hy + 16, 8, 3, dead.k ? '#3a1a1a' : roar ? '#ffe27a' : '#ffd23a'); // eyes
    B.r(2, hy + 16, 3, 3, '#14141c');
  }
  B.r(-6, hy + 14, 14, 2, dark); // brow
  const jaw = roar ? 5 : 0;
  B.r(-5, hy + 24, 15, 5 + jaw, '#2a0a0a'); // mouth
  B.r(-4, hy + 24, 3, 4, horn);
  B.r(6, hy + 24, 3, 4, horn);
  B.slab(-5, hy + 28 + jaw, 15, 3, skinD);
  // horns: they snap off and fly when it dies
  const hl = flung(dead, 0, -1);
  const hr = flung(dead, 1, 1);
  B.part(-8 + hl.x, hy + 2 + hl.y, 4, 12, horn);
  B.part(-9 + hl.x, hy - 4 + hl.y, 3, 7, horn);
  B.part(5 + hr.x, hy + 2 + hr.y, 4, 12, horn);
  B.part(7 + hr.x, hy - 4 + hr.y, 3, 7, horn);
  if (!dead.k) {
    B.r(-8, hy + 11, 4, 2, gold);
    B.r(5, hy + 11, 4, 2, gold);
  }

  // arms and the kanabo (spiked iron club); `fx`/`fy` fling it clear when the Oni dies
  const club = (x0, y0, x1, y1, thick = 9, fx = 0, fy = 0) => {
    x0 += fx;
    x1 += fx;
    y0 += fy;
    y1 += fy;
    B.stroke(x0, y0, x1, y1, burn('#4a4a58'), thick - 3);
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      B.r(Math.round(x0 + (x1 - x0) * k) - 2, Math.round(y0 + (y1 - y0) * k) - 2, 4, 4, iron);
    }
  };
  if (arms) {
    // both arms raised, lightning crackling between the fists
    B.part(-30, -84 + dy, 8, 30, skinD);
    B.part(-34, -112 + dy, 8, 30, skinD);
    B.part(22, -84 + dy, 8, 30, skin);
    B.part(26, -112 + dy, 8, 30, skin);
    const f = state === 'tele' ? tele : 1;
    if (pulse || f > 0.5) {
      B.line(-30, -114 + dy, 30, -114 + dy, '#bfe0ff', 1);
      B.line(-30, -112 + dy, -8, -122 + dy, '#ffffff', 1);
      B.line(-8, -122 + dy, 10, -112 + dy, '#9ad0ff', 1);
      B.line(10, -112 + dy, 30, -118 + dy, '#ffffff', 1);
    }
    B.r(-6, -126 + dy, 14, 3, '#9ad0ff');
  } else if (airborne) {
    B.part(26, -92, 9, 26, skin);
    B.part(-34, -92, 9, 26, skinD);
    club(32, -78, 62, -100);
  } else if (act && atk === 'smash' && state === 'tele') {
    // the kanabo rises overhead, behind the head
    const upk = tele;
    B.part(22, -82 + dy, 8, 26 - Math.round(10 * upk), skin);
    B.part(-30, -78 + dy, 8, 30, skinD);
    club(26, -62 - Math.round(24 * upk), -4 - Math.round(8 * upk), -126 + dy, 10);
  } else if (act && atk === 'smash' && sm && sm.stuck) {
    // slammed into the floor in front of it
    B.part(22, -78 + dy, 9, 30, skin);
    B.part(-30, -78 + dy, 8, 30, skinD);
    club(38, -20, 92, -12, 11);
    B.part(88, -22, 8, 22, iron);
  } else {
    // at rest: the club upright in the front hand (flung away when it dies)
    const kf = flung(dead, 2, 1);
    B.part(22, -78 + dy, 9, 30, skin);
    B.part(-30, -78 + dy, 8, 30, skinD);
    club(40, -44 + dy, 44, -112 + dy, 10, kf.x, kf.y);
  }
  // a gold armband on each arm
  B.r(23, -72 + dy, 8, 3, gold);
  B.r(-30, -72 + dy, 8, 3, gold);
  // idle: embers drift up off the shoulders
  if (state === 'idle') {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.55 + i * 0.34) % 1;
      B.r(-24 + i * 20 + Math.round(Math.sin(t * 3 + i * 2) * 2), -86 + dy - Math.round(k * 18), k < 0.7 ? 2 : 1, k < 0.7 ? 2 : 1, k < 0.5 ? '#ffb43a' : '#ff6a1e');
    }
  }
  damageMarks(U, pose, ONI_MARKS);
}


// ---------------------------------------------------------------------------------------------------------------
// Ghost Galleon: a drowned warship, bow to the left (toward the soldier), local +x = the bow
// ---------------------------------------------------------------------------------------------------------------
const GALLEON_MARKS = [
  { x: -30, y: -30, kind: 'crack', phase: 1 },
  { x: -12, y: -28, kind: 'plate', phase: 1 },
  { x: 12, y: -20, kind: 'scorch', phase: 2 },
  { x: -46, y: -64, kind: 'smoke', phase: 2 },
  { x: 20, y: -36, kind: 'spark', phase: 2 },
  { x: -52, y: -60, kind: 'crack', phase: 2 },
];

function drawGhostGalleon(ctx, e, cx, cy, pose) {
  const dead = collapse(pose);
  const burn = (c) => (dead.char ? mix(c, CHAR, dead.char) : c);
  const B = brush(ctx, cx, cy + dead.sink, e.face);
  const t = pose.bs.age;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const hull = burn(pose.rage ? '#3a4a4a' : '#3a4a52');
  const hullD = shade(hull, -0.45);
  const hullL = shade(hull, 0.4);
  const spar = burn('#222c30');
  const glow = burn('#4af0b8');
  const glowH = burn('#d8fff0');
  const bob = Math.round(Math.sin(t * 1.7) * 1);
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;
  const M = brush(ctx, cx, cy + dead.sink + bob, e.face); // follows the hull's bob, for the damage marks

  // mist hugging the waterline
  ctx.globalAlpha = baseAlpha * 0.5;
  for (let i = -6; i <= 6; i++) {
    const w = 14 + ((i * 7) & 7);
    B.r(i * 9 - 8 + Math.round(Math.sin(t * 1.3 + i) * 3), -5 + (i & 1), w, 4, '#8ae8d0');
  }
  ctx.globalAlpha = baseAlpha;

  // ---- hull: planks that widen up to the gunwale, with a dark edge down both sides
  for (let i = 0; i <= 40; i++) {
    const y = -4 - i + bob;
    const f = i / 40;
    const xl = -40 - Math.round(f * 16);
    const xr = 44 + Math.round(f * 12);
    B.r(xl - 1, y, xr - xl + 2, 1, hullD);
    B.r(xl, y, xr - xl, 1, i % 6 === 5 ? hullD : hull);
    if (i === 40) B.r(xl, y, xr - xl, 1, hullL);
  }
  B.r(-41, -3 + bob, 86, 1, hullD);
  B.r(-40, -4 + bob, 84, 1, hullD);
  // ribs of green light seeping through the planks
  for (const x of [-34, -18, -2, 14, 30]) B.r(x, -38 + bob, 1, 30, shade(glow, -0.55));
  // a ghostly green waterline stripe
  ctx.globalAlpha = baseAlpha * 0.7;
  B.r(-40, -9 + bob, 84, 2, glow);
  ctx.globalAlpha = baseAlpha;

  // stern castle with glowing windows and the forecastle at the bow
  B.part(-56, -64 + bob, 32, 20, hull);
  B.r(-56, -64 + bob, 3, 20, hullD);
  for (const x of [-48, -40, -32]) B.r(x, -58 + bob, 5, 6, dead.k ? '#10181c' : pose.mid && Math.floor(t * 7 + x) % 5 === 0 ? '#ffffff' : glow);
  B.slab(-24, -50 + bob, 54, 6, hullD); // the open waist, in shadow
  B.part(30, -52 + bob, 26, 8, hull);
  // rail and balusters along the waist
  B.r(-24, -50 + bob, 54, 2, hullL);
  for (let x = -22; x < 30; x += 6) B.r(x, -48 + bob, 1, 4, hullD);

  // ---- gun ports at the bow: dark hatches, glowing orange when the broadside is coming
  const fire = atk === 'broadside' && act;
  for (const py of [-7, -22]) {
    const xr = 44 + Math.round(((-4 - py) / 40) * 12);
    B.part(xr - 7, py - 3 + bob, 7, 6, '#0c1214');
    B.r(xr - 6, py - 2 + bob, 5, 4, fire ? (flash ? '#ffe27a' : '#ff8a1e') : '#1a2a2e');
    // the muzzle, run out
    B.part(xr, py - 2 + bob, fire ? 8 : 4, 4, '#22262e');
  }

  // ---- figurehead and the spirit lantern
  B.part(44, -46 + bob, 14, 3, hullD); // bowsprit
  B.part(56, -48 + bob, 6, 3, hullD);
  B.stroke(56, -47 + bob, 62, -58, burn(IRON), 1); // a curl of iron
  // the lantern: the weak point fills the cage, which hangs from a chain off the bowsprit
  B.r(46, -49 + bob, 2, 5, '#1a2428');
  B.r(55, -49 + bob, 2, 5, '#1a2428');
  B.part(37, -46, 20, 38, '#1a2428'); // cage
  weakPoint(B, 38, -44, 18, 36, { open, col: glow, age: t, hit: e.flash || 0 });
  if (open) {
    B.r(44, -38, 6, 24, flash ? '#ffffff' : glowH);
    // a halo around it
    ctx.globalAlpha = baseAlpha * 0.3;
    B.disc(47, -26, 20, glow);
    ctx.globalAlpha = baseAlpha;
  } else {
    // hooded: a dark cloth over the glass, only a seam of light
    B.r(47, -42, 1, 32, shade(glow, -0.4));
  }
  B.r(36, -48, 22, 3, '#1a2428');
  B.r(46, -10, 3, 3, '#1a2428');
  // spirit motes drift up off the lantern
  if (state === 'idle') {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.5 + i * 0.33) % 1;
      B.r(40 + i * 6 + Math.round(Math.sin(t * 2.4 + i * 2) * 2), -48 - Math.round(k * 22), 2, 2, k < 0.6 ? glow : glowH);
    }
  }

  // ---- masts, yards and the crow's nest
  const mast = (x, top) => {
    B.part(x - 1, top + bob, 3, -top - 44, spar);
  };
  mast(-2, -120);
  mast(28, -98);
  mast(-36, -102);
  // sails: pale, ragged and see-through (the fore sail tears off when it sinks)
  ctx.globalAlpha = baseAlpha * 0.78;
  const sail = (x0, w, top, h, ph, f = { x: 0, y: 0 }) => {
    B.r(x0 - 2 + f.x, top - 2 + f.y, w + 4, 2, spar); // yard
    for (let i = 0; i < w; i += 3) {
      const rag = Math.round(Math.sin(i * 1.1 + ph) * 4 + Math.sin(i * 0.37) * 3) + 4;
      const sway = Math.round(Math.sin(t * 1.9 + i * 0.5 + ph) * 2);
      const colH = h - rag + (act ? Math.round(Math.sin(t * 9 + i) * 2) : 0);
      B.r(x0 + i + sway + f.x, top + f.y, 3, colH, burn(i % 6 ? '#a8e0d0' : '#78b8a8'));
    }
  };
  sail(-22, 42, -112, 52, 0);
  sail(12, 30, -90, 38, 1.3, flung(dead, 3, 1));
  sail(-52, 28, -94, 30, 2.1);
  ctx.globalAlpha = baseAlpha;
  // crow's nest with a lookout whose eyes burn: it is thrown clear when the ship goes
  const cn = flung(dead, 0, -1);
  const chain = atk === 'chain' && act;
  const nx = cn.x;
  const ny = bob + cn.y;
  B.part(-9 + nx, -126 + ny, 14, 3, spar);
  for (const x of [-9, -2, 4]) B.r(x + nx, -132 + ny, 1, 6, spar);
  B.part(-5 + nx, -138 + ny, 6, 8, burn('#2a4a46'));
  const lookout = state === 'idle' && blink(t, 0.7) ? '#2a4a46' : chain ? '#ffe27a' : '#ffffff';
  B.r(-4 + nx, -136 + ny, 2, 2, lookout);
  B.r(0 + nx, -136 + ny, 2, 2, lookout);
  if (chain) B.line(0, -134 + bob, 12, -142 + bob, '#8a8a96', 1); // the chain being swung
  // the black flag
  const fl = Math.round(Math.sin(t * 6) * 2);
  const fg = flung(dead, 1, 1);
  B.part(-2 + fg.x, -140 + bob + fg.y, 14 + fl, 8, '#10181c');
  B.r(2 + fg.x, -138 + bob + fg.y, 3, 3, '#f2ecd8');
  // rigging
  B.line(-1, -118 + bob, 52, -44, '#0e1618', 1);
  B.line(-1, -118 + bob, -54, -62, '#0e1618', 1);
  B.line(28, -96 + bob, 56, -48, '#0e1618', 1);

  // ---- green fire licking the gunwale, hungrier when the ship is angry (and blazing as it sinks)
  const flames = dead.k ? 12 : pose.rage ? 9 : pose.mid ? 6 : 4;
  for (let i = 0; i < flames; i++) {
    const x = -50 + ((i * 53) % 100);
    const h = 4 + ((Math.floor(t * 9) + i * 3) % 5) + (dead.k ? 4 : 0);
    B.r(x, -52 - h + bob, 3, h, i & 1 ? glow : glowH);
  }
  // ghostfire attack: the hull blazes
  if (atk === 'ghostfire' && act) {
    ctx.globalAlpha = baseAlpha * 0.4;
    B.r(-40, -44 + bob, 90, 36, flash ? glowH : glow);
    ctx.globalAlpha = baseAlpha;
  }
  damageMarks(M, pose, GALLEON_MARKS);
}

export function registerBossesW10(painters) {
  painters.siegetower = () => bossFrames(130, 150, drawSiegeTower);
  painters.oni = () => bossFrames(130, 150, drawOni);
  painters.ghostgalleon = () => bossFrames(170, 160, drawGhostGalleon);
}
