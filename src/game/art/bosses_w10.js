// Boss art for Week 10: the Siege Tower Titan (level 10), the Oni Warlord (level 11) and the Ghost Galleon (level 12).
// Same conventions as bosses.js: a Brush in boss-local coordinates (origin = centre of the feet, +x = facing, -y = up).

import { shade } from './common.js';
import { brush, bossFrames } from './bosses.js';
import { flick } from './flash.js';

const IRON = '#aab2c0';

// ---------------------------------------------------------------------------------------------------------------
// Siege Tower Titan
// ---------------------------------------------------------------------------------------------------------------
function drawSiegeTower(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const wood = pose.rage ? '#6a3a24' : '#7a5230';
  const woodD = shade(wood, -0.4);
  const woodL = shade(wood, 0.28);
  const cloth = '#a8282e';
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const rm = e.rm;
  const open = e.def.weakBox(e) !== null;
  const pulse = flick(t, 9) % 2;
  const rolling = Math.abs(e.vx) > 2;

  // wheels (three great spoked wheels)
  const spin = (e.x * 0.07) % Math.PI;
  for (const wx of [-26, 0, 26]) {
    B.disc(wx, -10, 10, '#1c120a');
    B.disc(wx, -10, 8, '#8a6a3a');
    B.disc(wx, -10, 6, '#2a1a10');
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4;
      B.line(wx - Math.cos(a) * 8, -10 - Math.sin(a) * 8, wx + Math.cos(a) * 8, -10 + Math.sin(a) * 8, '#8a6a3a', 1);
    }
    B.r(wx - 1, -11, 3, 3, IRON);
  }
  // chassis beam and the planked body
  B.r(-38, -24, 76, 8, woodD);
  B.r(-38, -24, 76, 1, woodL);
  B.r(-36, -102, 72, 78, wood);
  for (let y = -100; y < -24; y += 6) B.r(-36, y, 72, 1, woodD);
  B.r(-36, -102, 72, 2, woodL);
  B.r(-36, -102, 3, 78, woodD); // the shadowed back edge
  // cross bracing
  B.line(-34, -26, 34, -98, woodD, 2);
  B.line(34, -26, -34, -98, woodD, 2);
  // iron straps
  for (const y of [-92, -60, -32]) {
    B.r(-36, y, 72, 3, '#3a3a46');
    B.r(-36, y, 72, 1, IRON);
  }
  // cloth hides and a banner
  B.r(-30, -88, 22, 26, cloth);
  B.r(-30, -88, 22, 2, shade(cloth, 0.3));
  B.r(-24, -80, 10, 10, '#ffd23a');
  B.r(-22, -78, 6, 6, cloth);
  // arrow slits
  for (const [x, y] of [[8, -86], [20, -74], [8, -62]]) B.r(x, y, 10, 3, '#14100c');

  // roof deck and battlements
  B.r(-40, -112, 80, 10, woodD);
  B.r(-40, -112, 80, 2, woodL);
  for (let x = -38; x < 38; x += 14) {
    B.r(x, -122, 9, 10, wood);
    B.r(x, -122, 9, 2, woodL);
  }
  // archers peeking over the merlons (they stand and draw during the volley)
  const volley = act && atk === 'arrows';
  for (const [x, k] of [[-34, 0], [-6, 1], [22, 2]]) {
    const up = volley ? (state === 'attack' ? 2 : Math.round(2 * tele)) : 0;
    B.r(x + 1, -128 - up, 7, 6, '#8a92a0'); // helm
    B.r(x + 5, -125 - up, 3, 2, '#14141c');
    if (volley && state === 'attack') B.line(x + 8, -120, x + 15, -126 - k, '#8a5a2a', 1);
  }
  // the oil cauldron on the roof: tips and drips fire while it pours
  const pour = act && atk === 'oil';
  const tip = pour ? (state === 'tele' ? tele : 1) : 0;
  const cxp = 14 + Math.round(tip * 10);
  B.disc(cxp, -116 - Math.round(tip * 3), 8, '#2a2a32');
  B.disc(cxp, -116 - Math.round(tip * 3), 6, '#14141c');
  B.r(cxp - 6, -121 - Math.round(tip * 3), 12, 2, pour ? (pulse ? '#ffd23a' : '#ff8a1e') : '#3a2a20');
  if (pour && state === 'attack') {
    for (let i = 0; i < 5; i++) B.r(cxp + 6 + i * 5, -112 + i * 10 + ((t * 40) % 6 | 0), 3, 5, i % 2 ? '#ff8a1e' : '#ffd23a');
  }

  // front: the drawbridge hinged on the upper face, the ram port below
  const bridge = act && atk === 'drawbridge';
  const swing = bridge ? (state === 'tele' ? tele * 0.3 : 1) : 0;
  if (swing > 0.5) {
    // lowered: a ramp to the floor
    B.line(38, -78, 74, -22, woodD, 4);
    B.line(38, -78, 74, -22, wood, 2);
    B.r(70, -24, 10, 4, IRON);
  } else {
    const lean = Math.round(swing * 3 * 10);
    B.r(36 + lean, -100, 4, 44, wood);
    B.r(36 + lean, -100, 1, 44, woodL);
    B.r(34 + lean, -80, 8, 3, '#3a3a46');
  }
  // the ram port
  B.r(12, -44, 26, 40, '#14100c');
  B.r(10, -46, 30, 3, '#3a3a46');
  B.r(10, -8, 30, 3, '#3a3a46');
  B.r(10, -46, 3, 41, '#3a3a46');
  if (open) {
    // the Rift core, pulsing inside the open port
    B.disc(26, -26, 10, pulse ? '#ff9af0' : '#d83ac0');
    B.disc(26, -26, 6, '#ffffff');
    B.disc(26, -26, 3, '#ff4adc');
    ctx.globalAlpha = 0.22;
    B.disc(26, -26, 24, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  } else {
    // shut: planks across the port
    B.r(12, -44, 26, 40, woodD);
    for (let y = -42; y < -6; y += 7) B.r(12, y, 26, 1, '#14100c');
    B.r(14, -30, 22, 3, '#3a3a46');
    B.r(30, -34, 4, 11, IRON);
  }
  // the ram itself: pulled back while winding up, thrust out while rolling and resting
  if (act && atk === 'ram') {
    let out = 0;
    if (state === 'tele') out = -4 * tele;
    else if (rm) out = rm.mode === 'roll' ? 34 : rm.mode === 'rest' ? 30 : Math.max(0, 30 - rm.t * 40);
    if (out > 0) {
      B.r(24, -30, 14 + out, 9, '#8a5a30');
      B.r(24, -30, 14 + out, 2, woodL);
      B.r(38 + out, -33, 7, 15, IRON);
      B.r(38 + out, -33, 7, 2, '#ffffff');
      B.r(43 + out, -29, 3, 7, '#6a7280');
    } else if (state === 'tele') {
      B.r(16 - Math.round(4 * tele), -30, 14, 9, '#8a5a30');
    }
  }
  // dust behind rolling wheels
  if (rolling && e.grounded) {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) B.r(-44 - i * 6 - ((t * 30) % 5 | 0), -4 - i * 3, 5, 3, '#c8b898');
    ctx.globalAlpha = 1;
  }
}


// ---------------------------------------------------------------------------------------------------------------
// Oni Warlord
// ---------------------------------------------------------------------------------------------------------------
function drawOni(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const skin = pose.rage ? '#a82240' : '#c8382a';
  const skinD = shade(skin, -0.38);
  const skinL = shade(skin, 0.25);
  const horn = '#f0e8d0';
  const gold = '#e0b83a';
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
  const dy = crouch; // the body sinks, the feet stay planted
  const arms = act && atk === 'thunder';
  const roar = act && (atk === 'summon' || (atk === 'smash' && state === 'tele' && tele > 0.6));

  // legs
  B.r(-16, -36 + dy, 13, 36 - dy, skinD);
  B.r(3, -36 + dy, 13, 36 - dy, skin);
  B.r(-17, -6 + (step ? -2 : 0), 15, 6, '#2a1a1a'); // feet with claws
  B.r(2, -6 + (step ? 0 : -2), 15, 6, '#2a1a1a');
  for (const x of [-17, 2]) B.r(x + 11, -3, 5, 2, horn);
  // tiger-skin loincloth
  B.r(-20, -48 + dy, 40, 16, gold);
  for (let i = 0; i < 6; i++) B.r(-18 + i * 7, -48 + dy, 3, 14 - (i & 1) * 3, '#14141c');
  B.r(-20, -48 + dy, 40, 2, '#14141c');
  // torso
  B.r(-24, -82 + dy, 48, 36, skin);
  B.r(-24, -82 + dy, 48, 3, skinL);
  B.r(-24, -82 + dy, 5, 36, skinD);
  B.r(-4, -62 + dy, 3, 12, skinD); // abs
  B.r(-14, -66 + dy, 10, 2, skinD);
  B.r(5, -66 + dy, 10, 2, skinD);
  // the Rift gem set in the chest (glows when it can be hit, a dull stone when covered)
  const gy = -52 + dy;
  B.disc(15, gy, 8, '#3a1a3a');
  if (open) {
    B.disc(15, gy, 7, pulse ? '#ff9af0' : '#d83ac0');
    B.disc(15, gy, 4, '#ffffff');
    ctx.globalAlpha = 0.22;
    B.disc(15, gy, 20, pulse ? '#ff9af0' : '#ff4adc');
    ctx.globalAlpha = 1;
  } else {
    B.disc(15, gy, 6, '#6a2a62');
    B.r(12, gy - 2, 6, 2, '#8a3a82');
  }
  // head: horned, tusked, wild-haired
  const hy = -104 + dy;
  B.r(-10, hy + 8, 22, 6, '#14141c'); // hair
  B.r(-14, hy + 10, 6, 14, '#14141c');
  B.r(-9, hy + 12, 20, 18, skin);
  B.r(-9, hy + 12, 20, 2, skinL);
  B.r(-9, hy + 12, 3, 18, skinD);
  B.r(-2, hy + 16, 8, 3, roar ? '#ffe27a' : '#ffd23a'); // eyes
  B.r(2, hy + 16, 3, 3, '#14141c');
  B.r(-6, hy + 14, 14, 2, '#14141c'); // brow
  const jaw = roar ? 5 : 0;
  B.r(-5, hy + 24, 15, 5 + jaw, '#2a0a0a'); // mouth
  B.r(-4, hy + 24, 3, 4, horn);
  B.r(6, hy + 24, 3, 4, horn);
  B.r(-5, hy + 28 + jaw, 15, 3, skinD);
  // horns
  B.r(-8, hy + 2, 4, 12, horn);
  B.r(-9, hy - 4, 3, 7, horn);
  B.r(5, hy + 2, 4, 12, horn);
  B.r(7, hy - 4, 3, 7, horn);
  B.r(-8, hy + 11, 4, 2, gold);
  B.r(5, hy + 11, 4, 2, gold);

  // arms and the kanabo (spiked iron club)
  const club = (x0, y0, x1, y1, thick = 9) => {
    B.line(x0, y0, x1, y1, '#2a2a34', thick);
    B.line(x0, y0, x1, y1, '#4a4a58', thick - 4);
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      B.r(Math.round(x0 + (x1 - x0) * k) - 2, Math.round(y0 + (y1 - y0) * k) - 2, 4, 4, IRON);
    }
  };
  if (arms) {
    // both arms raised, lightning crackling between the fists
    B.r(-30, -84 + dy, 8, 30, skinD);
    B.r(-34, -112 + dy, 8, 30, skinD);
    B.r(22, -84 + dy, 8, 30, skin);
    B.r(26, -112 + dy, 8, 30, skin);
    const f = state === 'tele' ? tele : 1;
    if (pulse || f > 0.5) {
      B.line(-30, -114 + dy, 30, -114 + dy, '#bfe0ff', 1);
      B.line(-30, -112 + dy, -8, -122 + dy, '#ffffff', 1);
      B.line(-8, -122 + dy, 10, -112 + dy, '#9ad0ff', 1);
      B.line(10, -112 + dy, 30, -118 + dy, '#ffffff', 1);
    }
    B.r(-6, -126 + dy, 14, 3, '#9ad0ff');
  } else if (airborne) {
    B.r(26, -92, 9, 26, skin);
    B.r(-34, -92, 9, 26, skinD);
    club(32, -78, 62, -100);
  } else if (act && atk === 'smash' && state === 'tele') {
    // the kanabo rises overhead, behind the head
    const up = tele;
    B.r(22, -82 + dy, 8, 26 - Math.round(10 * up), skin);
    B.r(-30, -78 + dy, 8, 30, skinD);
    club(26, -62 - Math.round(24 * up), -4 - Math.round(8 * up), -126 + dy, 10);
  } else if (act && atk === 'smash' && sm && sm.stuck) {
    // slammed into the floor in front of it
    B.r(22, -78 + dy, 9, 30, skin);
    B.r(-30, -78 + dy, 8, 30, skinD);
    club(38, -20, 92, -12, 11);
    B.r(88, -22, 8, 22, IRON);
  } else {
    // at rest: the club upright in the front hand
    B.r(22, -78 + dy, 9, 30, skin);
    B.r(-30, -78 + dy, 8, 30, skinD);
    club(40, -44 + dy, 44, -112 + dy, 10);
  }
  // a gold armband on each arm
  B.r(23, -72 + dy, 8, 3, gold);
  B.r(-30, -72 + dy, 8, 3, gold);
}


// ---------------------------------------------------------------------------------------------------------------
// Ghost Galleon: a drowned warship, bow to the left (toward the soldier), local +x = the bow
// ---------------------------------------------------------------------------------------------------------------
function drawGhostGalleon(ctx, e, cx, cy, pose) {
  const B = brush(ctx, cx, cy, e.face);
  const t = e.bs ? e.bs.age : 0;
  const baseAlpha = ctx.globalAlpha;
  const { atk, state, tele } = pose;
  const act = state === 'tele' || state === 'attack';
  const open = e.def.weakBox(e) !== null;
  const hull = pose.rage ? '#3a4a4a' : '#3a4a52';
  const hullD = shade(hull, -0.45);
  const hullL = shade(hull, 0.4);
  const glow = '#4af0b8';
  const glowH = '#d8fff0';
  const bob = Math.round(Math.sin(t * 1.7) * 1);
  const flash = tele > 0.5 && flick(t, 10) % 2 === 0;

  // mist hugging the waterline
  ctx.globalAlpha = baseAlpha * 0.5;
  for (let i = -6; i <= 6; i++) {
    const w = 14 + ((i * 7) & 7);
    B.r(i * 9 - 8 + Math.round(Math.sin(t * 1.3 + i) * 3), -5 + (i & 1), w, 4, '#8ae8d0');
  }
  ctx.globalAlpha = baseAlpha;

  // ---- hull: planks that widen up to the gunwale
  for (let i = 0; i <= 40; i++) {
    const y = -4 - i + bob;
    const f = i / 40;
    const xl = -40 - Math.round(f * 16);
    const xr = 44 + Math.round(f * 12);
    B.r(xl, y, xr - xl, 1, i % 6 === 5 ? hullD : hull);
    if (i === 40) B.r(xl, y, xr - xl, 1, hullL);
  }
  B.r(-40, -4 + bob, 84, 1, hullD);
  // ribs of green light seeping through the planks
  for (const x of [-34, -18, -2, 14, 30]) B.r(x, -38 + bob, 1, 30, shade(glow, -0.55));
  // a ghostly green waterline stripe
  ctx.globalAlpha = baseAlpha * 0.7;
  B.r(-40, -9 + bob, 84, 2, glow);
  ctx.globalAlpha = baseAlpha;

  // stern castle with glowing windows and the forecastle at the bow
  B.r(-56, -64 + bob, 32, 20, hull);
  B.r(-56, -64 + bob, 32, 2, hullL);
  B.r(-56, -64 + bob, 3, 20, hullD);
  for (const x of [-48, -40, -32]) B.r(x, -58 + bob, 5, 6, pose.mid && Math.floor(t * 7 + x) % 5 === 0 ? '#ffffff' : glow);
  B.r(-24, -50 + bob, 54, 6, hullD); // the open waist, in shadow
  B.r(30, -52 + bob, 26, 8, hull);
  B.r(30, -52 + bob, 26, 2, hullL);
  // rail and balusters along the waist
  B.r(-24, -50 + bob, 54, 2, hullL);
  for (let x = -22; x < 30; x += 6) B.r(x, -48 + bob, 1, 4, hullD);

  // ---- gun ports at the bow: dark hatches, glowing orange when the broadside is coming
  const fire = atk === 'broadside' && act;
  for (const py of [-7, -22]) {
    const xr = 44 + Math.round(((-4 - py) / 40) * 12);
    B.r(xr - 7, py - 3 + bob, 7, 6, '#0c1214');
    B.r(xr - 6, py - 2 + bob, 5, 4, fire ? (flash ? '#ffe27a' : '#ff8a1e') : '#1a2a2e');
    // the muzzle, run out
    B.r(xr, py - 2 + bob, fire ? 8 : 4, 4, '#22262e');
    B.r(xr, py - 2 + bob, fire ? 8 : 4, 1, '#6a6a7a');
  }

  // ---- figurehead and the spirit lantern
  B.r(44, -46 + bob, 14, 3, hullD); // bowsprit
  B.r(56, -48 + bob, 6, 3, hullD);
  B.line(56, -47 + bob, 62, -58, '#aab2c0', 1); // a curl of iron
  B.r(50, -44 + bob, 2, 12, '#1a2428'); // the lantern's hanging chain
  const lx = 49;
  const ly = -34 + bob;
  B.r(lx - 2, ly, 11, 14, '#1a2428'); // cage
  if (open) {
    B.r(lx - 1, ly + 1, 9, 12, glow);
    B.r(lx + 1, ly + 3, 5, 8, flash ? '#ffffff' : glowH);
    // a halo around it
    ctx.globalAlpha = baseAlpha * 0.35;
    B.disc(lx + 4, ly + 7, 12, glow);
    ctx.globalAlpha = baseAlpha;
  } else {
    // hooded: a dark cloth over the glass, only a seam of light
    B.r(lx - 1, ly + 1, 9, 12, '#10181c');
    B.r(lx + 3, ly + 2, 1, 10, shade(glow, -0.4));
  }
  B.r(lx - 3, ly - 2, 13, 3, '#1a2428');
  B.r(lx + 2, ly + 14, 3, 2, '#1a2428');

  // ---- masts, yards and the crow's nest
  const mast = (x, top) => {
    B.r(x - 1, top + bob, 3, -top - 44, '#222c30');
    B.r(x - 1, top + bob, 1, -top - 44, hullL);
  };
  mast(-2, -120);
  mast(28, -98);
  mast(-36, -102);
  // sails: pale, ragged and see-through
  ctx.globalAlpha = baseAlpha * 0.78;
  const sail = (x0, w, top, h, ph) => {
    B.r(x0 - 2, top - 2, w + 4, 2, '#222c30'); // yard
    for (let i = 0; i < w; i += 3) {
      const rag = Math.round(Math.sin(i * 1.1 + ph) * 4 + Math.sin(i * 0.37) * 3) + 4;
      const sway = Math.round(Math.sin(t * 1.9 + i * 0.5 + ph) * 2);
      const colH = h - rag + (act ? Math.round(Math.sin(t * 9 + i) * 2) : 0);
      B.r(x0 + i + sway, top, 3, colH, i % 6 ? '#a8e0d0' : '#78b8a8');
    }
  };
  sail(-22, 42, -112, 52, 0);
  sail(12, 30, -90, 38, 1.3);
  sail(-52, 28, -94, 30, 2.1);
  ctx.globalAlpha = baseAlpha;
  // crow's nest with a lookout whose eyes burn
  B.r(-9, -126 + bob, 14, 3, '#222c30');
  for (const x of [-9, -2, 4]) B.r(x, -132 + bob, 1, 6, '#222c30');
  B.r(-5, -138 + bob, 6, 8, '#2a4a46');
  B.r(-4, -136 + bob, 2, 2, atk === 'chain' && act ? '#ffe27a' : '#ffffff');
  B.r(0, -136 + bob, 2, 2, atk === 'chain' && act ? '#ffe27a' : '#ffffff');
  if (atk === 'chain' && act) B.line(0, -134 + bob, 12, -142 + bob, '#8a8a96', 1); // the chain being swung
  // the black flag
  const fl = Math.round(Math.sin(t * 6) * 2);
  B.r(-2, -140 + bob, 14 + fl, 8, '#10181c');
  B.r(2, -138 + bob, 3, 3, '#f2ecd8');
  // rigging
  B.line(-1, -118 + bob, 52, -44, '#0e1618', 1);
  B.line(-1, -118 + bob, -54, -62, '#0e1618', 1);
  B.line(28, -96 + bob, 56, -48, '#0e1618', 1);

  // ---- green fire licking the gunwale, hungrier when the ship is angry
  const flames = pose.rage ? 9 : pose.mid ? 6 : 4;
  for (let i = 0; i < flames; i++) {
    const x = -50 + ((i * 53) % 100);
    const h = 4 + ((Math.floor(t * 9) + i * 3) % 5);
    B.r(x, -52 - h + bob, 3, h, i & 1 ? glow : glowH);
  }
  // ghostfire attack: the hull blazes
  if (atk === 'ghostfire' && act) {
    ctx.globalAlpha = baseAlpha * 0.4;
    B.r(-40, -44 + bob, 90, 36, flash ? glowH : glow);
    ctx.globalAlpha = baseAlpha;
  }
}

export function registerBossesW10(painters) {
  painters.siegetower = () => bossFrames(130, 150, drawSiegeTower);
  painters.oni = () => bossFrames(130, 150, drawOni);
  painters.ghostgalleon = () => bossFrames(170, 160, drawGhostGalleon);
}
