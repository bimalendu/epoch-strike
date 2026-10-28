// Procedural enemy sprites. Painters are keyed by def.tpl; each returns frames for a def.
// Add a new template here and reference it from enemy_defs.js.

import { Painter, blit, lineTo, lightenedCopy } from '../../engine/gfx.js';
import { bakeFrames } from './bake.js';
import { shade, drawLegs } from './common.js';
import { capsulePainter } from './pickups.js';
import { registerCreatures } from './creatures.js';
import { registerAncient } from './ancient.js';
import { registerGreatWall } from './greatwall.js';
import { registerNorse } from './norse.js';
import { registerMedieval } from './medieval.js';
import { registerBosses } from './bosses.js';
import { registerBossesW10 } from './bosses_w10.js';
import { registerBossesW11 } from './bosses_w11.js';
import { registerBossesW12 } from './bosses_w12.js';
import { registerBossesW13 } from './bosses_w13.js';
import { registerBossesW14 } from './bosses_w14.js';
import { registerWar } from './war.js';
import { registerCoast } from './coast.js';
import { registerModern } from './modern.js';
import { drawEnemyBulletArt } from './ebullets.js';
import { flashCtx } from './hit.js';
import { flick } from './flash.js';

const cache = new Map();

/** Humanoids that hold something out: the arm is drawn live along the aim by drawEnemy instead of hanging in the sprite. */
function armed(def) {
  return !!(def.gun || def.sword || def.axe || def.bow || def.crossbow || def.thrower);
}

function humanoidFrame(def, frame) {
  const pal = def.pal;
  const p = new Painter(24, 32);
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const skin = pal.skin, skinD = shade(skin, -0.3);
  // head
  p.ellipse(13, 6 + bob, 4, 4, skin);
  p.rect(9, 5 + bob, 1, 3, skinD); // shaded back of the head
  p.px(15, 8 + bob, shade(skin, 0.25));
  p.px(14, 6 + bob, '#f4f0f0');
  p.px(15, 6 + bob, pal.eye || '#111111');
  const hat = pal.hat;
  switch (def.hatStyle) {
    case 'fur': // shaggy hide cap with a bone through it
      p.ellipse(13, 4 + bob, 5, 3, hat);
      p.rect(8, 5 + bob, 11, 2, hat);
      p.rect(8, 7 + bob, 2, 2, hat);
      p.rect(17, 7 + bob, 2, 2, hat);
      p.rect(12, 0 + bob, 1, 3, '#f2ecd8');
      p.rect(11, 0 + bob, 3, 1, '#f2ecd8');
      break;
    case 'cap':
      p.rect(9, 2 + bob, 9, 3, hat);
      p.rect(15, 4 + bob, 5, 1, hat);
      break;
    case 'band':
      p.rect(9, 3 + bob, 9, 2, hat);
      p.rect(5, 4 + bob, 5, 1, hat);
      break;
    case 'horns':
      p.ellipse(13, 4 + bob, 5, 3, hat);
      p.rect(8, 5 + bob, 11, 1, hat);
      p.rect(8, 1 + bob, 1, 3, '#f2ecd8');
      p.rect(7, 0 + bob, 1, 2, '#f2ecd8');
      p.rect(18, 1 + bob, 1, 3, '#f2ecd8');
      p.rect(19, 0 + bob, 1, 2, '#f2ecd8');
      break;
    case 'hood':
      p.ellipse(13, 6 + bob, 5, 5, hat);
      p.rect(14, 5 + bob, 4, 4, skin);
      p.px(16, 6 + bob, '#111111');
      break;
    case 'crest':
      p.ellipse(13, 4 + bob, 5, 3, hat);
      p.rect(8, 5 + bob, 11, 1, hat);
      p.rect(9, 0 + bob, 8, 2, '#c0262e');
      break;
    case 'none':
      p.rect(9, 2 + bob, 9, 2, shade(skin, -0.55));
      break;
    case 'greathelm': // a knight's full helm: visor slit, a red plume, a gorget under the chin
      p.rect(9, 1 + bob, 10, 9, hat);
      p.rect(9, 1 + bob, 10, 1, shade(hat, 0.45));
      p.rect(9, 1 + bob, 1, 9, shade(hat, -0.3));
      p.rect(12, 5 + bob, 7, 1, '#15151c');
      p.rect(15, 3 + bob, 1, 6, shade(hat, -0.35));
      p.rect(10, -1 + bob, 7, 2, '#c0262e');
      p.rect(8, 0 + bob, 3, 3, '#c0262e');
      break;
    case 'tricorn': // a pirate's tricorn: raised brim, a skull on the front
      p.rect(7, 3 + bob, 13, 2, hat);
      p.rect(9, 1 + bob, 9, 3, hat);
      p.rect(7, 2 + bob, 2, 2, shade(hat, 0.25));
      p.rect(18, 2 + bob, 2, 2, shade(hat, 0.25));
      p.rect(12, 2 + bob, 3, 2, '#f2ecd8');
      p.px(13, 2 + bob, '#1c1c26');
      p.rect(9, 5 + bob, 2, 3, '#b8302a'); // a bandana tail
      break;
    case 'stetson': // a cowboy hat: wide brim, dented crown, a band
      p.rect(6, 4 + bob, 15, 2, hat);
      p.rect(9, 0 + bob, 9, 5, hat);
      p.rect(11, 0 + bob, 5, 1, shade(hat, -0.35));
      p.rect(9, 3 + bob, 9, 1, shade(hat, -0.5));
      p.rect(6, 4 + bob, 15, 1, shade(hat, 0.3));
      break;
    case 'bowler': // a round derby with a ribbon
      p.rect(9, 1 + bob, 9, 4, hat);
      p.rect(10, 0 + bob, 7, 1, hat);
      p.rect(7, 5 + bob, 13, 1, hat);
      p.rect(9, 4 + bob, 9, 1, '#c0262e');
      break;
    case 'bandana': // a bandit's mask pulled up over the nose, a kerchief knot behind
      p.rect(10, 3 + bob, 8, 2, hat);
      p.rect(10, 7 + bob, 8, 3, hat);
      p.rect(7, 3 + bob, 3, 3, hat);
      p.rect(8, 6 + bob, 2, 2, shade(hat, -0.3));
      break;
    case 'hardhat': // a safety helmet: a dome with a ridge and a short peak
      p.rect(9, 1 + bob, 10, 4, hat);
      p.rect(10, 0 + bob, 8, 1, hat);
      p.rect(8, 5 + bob, 12, 1, hat);
      p.rect(13, 0 + bob, 2, 5, shade(hat, 0.4));
      p.rect(9, 1 + bob, 10, 1, shade(hat, 0.3));
      break;
    case 'brodie': // a shallow steel dish helmet with a chin strap
      p.rect(7, 3 + bob, 14, 2, hat);
      p.rect(9, 1 + bob, 10, 3, hat);
      p.rect(9, 1 + bob, 10, 1, shade(hat, 0.35));
      p.rect(9, 8 + bob, 1, 2, shade(hat, -0.4));
      break;
    case 'pickel': // a spiked leather-and-steel helmet
      p.rect(9, 1 + bob, 10, 4, hat);
      p.rect(8, 4 + bob, 12, 1, shade(hat, -0.3));
      p.rect(13, -2 + bob, 2, 3, '#c8a040');
      p.rect(12, 0 + bob, 4, 1, '#c8a040');
      p.rect(9, 1 + bob, 10, 1, shade(hat, 0.35));
      break;
    case 'stahl': // a coal-scuttle steel helmet: a deep dome with a flared neck guard
      p.rect(9, 1 + bob, 10, 5, hat);
      p.rect(10, 0 + bob, 8, 1, hat);
      p.rect(8, 5 + bob, 12, 2, hat);
      p.rect(8, 7 + bob, 3, 2, shade(hat, -0.25));
      p.rect(9, 1 + bob, 10, 1, shade(hat, 0.35));
      p.rect(9, 6 + bob, 10, 1, shade(hat, -0.35));
      break;
    case 'ninja': // a full mask: only a band of eyes shows, a knotted scarf trailing behind
      p.ellipse(13, 6 + bob, 4, 5, hat);
      p.rect(9, 3 + bob, 9, 3, hat);
      p.rect(13, 5 + bob, 5, 2, skin);
      p.px(16, 5 + bob, pal.eye || '#ffffff');
      p.rect(7, 5 + bob, 3, 2, shade(hat, 0.25));
      p.rect(5, 6 + bob, 3, 2, shade(hat, 0.25));
      break;
    case 'kabuto': // a samurai helm: gold crescent crest, flared neck guard
      p.ellipse(13, 4 + bob, 5, 3, hat);
      p.rect(8, 5 + bob, 11, 3, hat);
      p.rect(8, 8 + bob, 3, 3, shade(hat, 0.2));
      p.rect(17, 8 + bob, 3, 3, shade(hat, 0.2));
      p.rect(10, -1 + bob, 2, 3, pal.belt || '#e0b83a');
      p.rect(15, -1 + bob, 2, 3, pal.belt || '#e0b83a');
      p.rect(11, 1 + bob, 5, 1, pal.belt || '#e0b83a');
      break;
    case 'coif': // a mail hood with the face open
      p.ellipse(13, 5 + bob, 5, 5, hat);
      p.rect(14, 4 + bob, 4, 5, skin);
      p.px(16, 6 + bob, '#111111');
      p.rect(9, 9 + bob, 9, 1, shade(hat, -0.3));
      break;
    case 'topknot': // a terracotta warrior: hair swept up into a bun, a chin-strap, clay-coloured skin
      p.rect(9, 3 + bob, 9, 3, hat);
      p.rect(11, 0 + bob, 5, 3, hat);
      p.rect(12, -1 + bob, 3, 1, shade(hat, 0.3));
      p.rect(9, 8 + bob, 9, 1, shade(hat, -0.2));
      break;
    case 'wrap': // a mummy: the whole head bound in linen, one glowing eye
      p.ellipse(13, 6 + bob, 4, 5, hat);
      p.rect(9, 4 + bob, 9, 1, shade(hat, -0.3));
      p.rect(9, 7 + bob, 9, 1, shade(hat, -0.3));
      p.rect(15, 5 + bob, 3, 2, '#1a2a1a');
      p.px(16, 6 + bob, pal.eye || '#7aff9a');
      break;
    case 'ushanka': // a fur hat with the ear flaps tied up, a red star on the front
      p.rect(8, 2 + bob, 11, 4, hat);
      p.rect(9, 1 + bob, 9, 1, hat);
      p.rect(7, 5 + bob, 2, 4, shade(hat, -0.15));
      p.rect(18, 5 + bob, 2, 4, shade(hat, -0.15));
      p.rect(8, 2 + bob, 11, 1, shade(hat, 0.3));
      p.rect(15, 3 + bob, 2, 2, '#d92b2b');
      break;
    case 'visor': // a cyborg's head: a smooth plated dome and one glowing visor slit
      p.ellipse(13, 5 + bob, 5, 5, hat);
      p.rect(8, 4 + bob, 11, 5, hat);
      p.rect(9, 4 + bob, 10, 1, shade(hat, 0.4));
      p.rect(12, 5 + bob, 8, 3, '#0e0e18');
      p.rect(13, 6 + bob, 6, 1, pal.eye || '#4af0ff');
      p.rect(8, 9 + bob, 3, 3, shade(hat, -0.3));
      break;
    default: // helmet
      p.ellipse(13, 4 + bob, 5, 3, hat);
      p.rect(8, 5 + bob, 11, 2, hat);
  }
  // torso, with the arm that is behind it
  p.rect(12, 10 + bob, 3, 1, skinD);
  p.rect(8, 12 + bob, 2, 6, shade(pal.body, -0.4));
  p.px(8, 18 + bob, skinD);
  p.rect(10, 11 + bob, 7, 9, pal.body);
  p.rect(10, 11 + bob, 1, 9, shade(pal.body, -0.3));
  p.rect(15, 12 + bob, 1, 7, shade(pal.body, 0.18));
  p.rect(11, 11 + bob, 5, 1, shade(pal.body, 0.18));
  p.rect(10, 19 + bob, 7, 2, pal.belt || '#33261a');
  p.rect(10, 19 + bob, 7, 1, shade(pal.belt || '#33261a', 0.3));
  if (!armed(def) && !def.club) {
    // nothing in its hands: the front arm hangs at its side
    p.rect(16, 12 + bob, 2, 6, shade(pal.body, -0.1));
    p.rect(16, 12 + bob, 2, 1, shade(pal.body, 0.2));
    p.rect(16, 18 + bob, 2, 2, skin);
  }
  if (def.armor) {
    p.rect(9, 11 + bob, 9, 3, def.armor);
    p.rect(9, 11 + bob, 9, 1, shade(def.armor, 0.4));
  }
  if (def.cape) p.rect(6, 11 + bob, 4, 13, def.cape);
  if (def.club) {
    // a knotted club held forward, swinging with the stride
    const sw = frame < 0 ? 0 : [0, -1, 0, 1][frame];
    p.rect(17, 12 + bob + sw, 2, 9, '#6b4a2b');
    p.rect(16, 9 + bob + sw, 4, 5, '#8a6a3a');
    p.rect(16, 9 + bob + sw, 4, 1, '#b8946a');
  }
  if (def.wraps) {
    // linen strips round the chest, a loose end trailing from the elbow
    for (let y = 12; y < 20; y += 2) p.rect(10, y + bob, 7, 1, shade(pal.body, -0.28));
    p.rect(8, 15 + bob, 2, 1, pal.body);
    p.rect(7, 16 + bob, 2, 4, pal.body);
    p.rect(7, 19 + bob, 1, 3, shade(pal.body, -0.25));
  }
  if (def.fur) {
    // hide tunic fringe
    for (let x = 10; x < 17; x += 2) p.rect(x, 20 + bob, 1, 3, def.fur);
  }
  drawLegs(p, frame, pal.pants, pal.boots);
  if (def.shield) {
    p.rect(15, 12, 5, 10, def.shield);
    p.rect(15, 12, 5, 1, shade(def.shield, 0.5));
    p.rect(17, 14, 1, 6, shade(def.shield, 0.35));
  }
  return p.canvas;
}

function build(def) {
  const frames = { idle: null, run: [] };
  if (def.tpl === 'humanoid') {
    frames.idle = humanoidFrame(def, -1);
    for (let i = 0; i < 4; i++) frames.run.push(humanoidFrame(def, i));
    frames.hot = lightenedCopy(frames.idle, 0.4); // the bright frame it flickers to while it telegraphs
    frames.w = 24;
    frames.h = 32;
    frames.ox = 12; // anchor x inside the sprite
  } else if (painters[def.tpl]) {
    return painters[def.tpl](def);
  } else {
    // unknown template: magenta box so it is obvious in testing
    const p = new Painter(16, 16).rect(0, 0, 16, 16, '#ff00ff');
    frames.idle = p.canvas;
    frames.run = [p.canvas];
    frames.w = 16;
    frames.h = 16;
    frames.ox = 8;
  }
  return frames;
}

/** Extra painters register here: painters.raptor = (def) => frames */
export const painters = {};
painters.capsule = () => capsulePainter();
registerCreatures(painters);
registerBosses(painters);
registerBossesW10(painters);
registerBossesW11(painters);
registerBossesW12(painters);
registerBossesW13(painters);
registerBossesW14(painters);
registerWar(painters);
registerCoast(painters);
registerModern(painters);
registerAncient(painters);
registerGreatWall(painters);
registerNorse(painters);
registerMedieval(painters);
// <<PAINTERS>>

export function enemyFrames(def) {
  let f = cache.get(def.id);
  if (!f) {
    f = bakeFrames(build(def));
    cache.set(def.id, f);
  }
  return f;
}

const INK = '#17121c';

/** A thick line with a dark under-stroke one pixel out on every side: how weapons are outlined. */
function olLine(ctx, x0, y0, x1, y1, col, t) {
  lineTo(ctx, x0 - 1, y0 - 1, x1 - 1, y1 - 1, INK, t + 2);
  lineTo(ctx, x0, y0, x1, y1, col, t);
}

const sleeves = new Map();

/** The arm that holds a weapon: a sleeve in the enemy's body colour from the shoulder to the grip, and a hand. */
function holdArm(ctx, def, sx, sy, tx, ty) {
  let c = sleeves.get(def.id);
  if (!c) {
    c = shade(def.pal.body, -0.15);
    sleeves.set(def.id, c);
  }
  lineTo(ctx, sx, sy, tx, ty, c, 3);
  ctx.fillStyle = def.pal.skin;
  ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
}

// A shot is a recoil for a few frames after the telegraph ends. The enemy's own state goes straight back to idle, so the art
// notes the frame it left 'tele'; this memory is art only and the world never reads it.
const recoils = new WeakMap();
const RECOIL_FRAMES = 4;

function recoilOf(e) {
  let r = recoils.get(e);
  if (!r) {
    r = { tele: false, k: 0 };
    recoils.set(e, r);
  }
  if (r.tele && e.state !== 'tele') r.k = RECOIL_FRAMES;
  else if (r.k > 0) r.k--;
  r.tele = e.state === 'tele';
  return r.k > 0 ? 1 : 0;
}

/** Draw one enemy. */
export function drawEnemy(ctx, e, ox, oy) {
  const def = e.def;
  const f = enemyFrames(def);
  const custom = def.draw || f.draw;
  if (custom) {
    custom(ctx, e, ox, oy, f);
    return;
  }
  ctx = flashCtx(ctx, e);
  const moving = def.flyer || (Math.abs(e.vx) > 1 && e.grounded);
  let img = moving ? f.run[Math.floor(e.anim) % f.run.length] : f.idle;
  // telegraph: flicker to the bright frame before an attack
  if (e.state === 'tele' && f.hot && flick(e.t, 14) % 2 === 0) img = f.hot;
  const flipX = e.face < 0;
  const flipY = e.gdir < 0;
  blit(ctx, img, e.x - ox - f.ox, e.y - oy - f.h, flipX, flipY);
  const kick = def.gun ? recoilOf(e) : 0;
  if (def.tpl === 'humanoid' && def.thrower) {
    // a bone-tipped spear raised to throw, following the aim
    const ax = e.aimX === undefined ? e.face : e.aimX;
    const ay = e.aimY === undefined ? 0 : e.aimY;
    const sx = e.x - ox + e.face * 2, sy = e.y - oy - 22;
    const raise = e.state === 'tele' ? -3 : 0;
    holdArm(ctx, def, sx - e.face, sy + 3, sx + ax * 3, sy + ay * 3 + raise);
    if (def.thrower === 'dynamite') {
      // a red stick with a fizzing fuse, raised overhead while it winds up
      const bx = sx + ax * 7, by = sy + ay * 7 + raise - 3;
      ctx.fillStyle = '#c0262e';
      ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 1, 5, 3);
      ctx.fillStyle = '#f4f0dc';
      ctx.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3);
      ctx.fillStyle = Math.floor((e.t || 0) * 20) % 2 ? '#ffe27a' : '#ff8a1e';
      ctx.fillRect(Math.round(bx) - 1 + (ax < 0 ? 4 : 0), Math.round(by) - 3, 2, 2);
    } else if (def.thrower === 'grenade') {
      // a stick grenade raised overhead: wooden handle, grey canister
      const bx = sx + ax * 7, by = sy + ay * 7 + raise - 3;
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 7);
      ctx.fillStyle = '#6a6e62';
      ctx.fillRect(Math.round(bx) - 3, Math.round(by) - 4, 6, 4);
      ctx.fillStyle = '#9a9e92';
      ctx.fillRect(Math.round(bx) - 3, Math.round(by) - 4, 6, 1);
    } else if (def.thrower === 'axe') {
      // a bearded axe raised overhead, the blade glinting
      olLine(ctx, sx - ax * 3, sy - ay * 3 + raise, sx + ax * 8, sy + ay * 8 + raise, '#8a5a2a', 2);
      const bx = sx + ax * 8, by = sy + ay * 8 + raise;
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(Math.round(bx - ay * 4) - 1, Math.round(by + ax * 4) - 1, 4, 4);
      ctx.fillRect(Math.round(bx + ay * 1) - 1, Math.round(by - ax * 1) - 1, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(bx - ay * 4), Math.round(by + ax * 4), 1, 1);
    } else {
      olLine(ctx, sx - ax * 5, sy - ay * 5 + raise, sx + ax * 13, sy + ay * 13 + raise, '#6b4a2b', 2);
      ctx.fillStyle = '#f4f0dc';
      ctx.fillRect(Math.round(sx + ax * 13) - 1, Math.round(sy + ay * 13 + raise) - 1, 3, 3);
    }
  }
  if (def.tpl === 'humanoid' && def.axe) {
    // a great axe: it swings up during the run and the blade flashes
    const sx = e.x - ox + e.face * 4, sy = e.y - oy - 19;
    const up = e.state === 'tele' ? -7 : moving ? -4 + (Math.floor(e.anim * 2) % 2) * 4 : 0;
    holdArm(ctx, def, sx - e.face * 2, sy + 1, sx, sy + 3);
    olLine(ctx, sx - e.face * 1, sy + 4, sx + e.face * 9, sy + up - 3, '#8a5a2a', 2);
    ctx.fillStyle = '#dfe6ee';
    ctx.fillRect(Math.round(sx + e.face * 9) - 2, Math.round(sy + up - 6), 5, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(sx + e.face * 9) + (e.face > 0 ? 1 : -2), Math.round(sy + up - 6), 1, 5);
  }
  if (def.tpl === 'humanoid' && def.sword) {
    // a short blade held out front; it lifts back during the wind-up
    const sx = e.x - ox + e.face * 4, sy = e.y - oy - 19;
    const up = e.state === 'tele' ? -5 : moving ? -1 : 1;
    holdArm(ctx, def, sx - e.face * 2, sy - 1, sx, sy);
    olLine(ctx, sx, sy, sx + e.face * 12, sy + up, '#dfe6ee', 2);
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
  }
  if (def.tpl === 'humanoid' && def.bow) {
    // a bow drawn back toward the player, an arrow nocked while it telegraphs
    const ax = e.aimX === undefined ? e.face : e.aimX;
    const ay = e.aimY === undefined ? 0 : e.aimY;
    const sx = e.x - ox + e.face * 3, sy = e.y - oy - 20;
    const nx = -ay, ny = ax; // across the bow
    holdArm(ctx, def, sx - ax, sy - ay, sx + ax * 8, sy + ay * 8);
    olLine(ctx, sx + ax * 7 + nx * 7, sy + ay * 7 + ny * 7, sx + ax * 10, sy + ay * 10, '#8a5a2a', 2);
    olLine(ctx, sx + ax * 10, sy + ay * 10, sx + ax * 7 - nx * 7, sy + ay * 7 - ny * 7, '#8a5a2a', 2);
    const pull = e.state === 'tele' ? 5 : 1;
    lineTo(ctx, sx + ax * 7 + nx * 7, sy + ay * 7 + ny * 7, sx + ax * (7 - pull) , sy + ay * (7 - pull), '#e8e0c8', 1);
    lineTo(ctx, sx + ax * (7 - pull), sy + ay * (7 - pull), sx + ax * 7 - nx * 7, sy + ay * 7 - ny * 7, '#e8e0c8', 1);
    if (e.state === 'tele') lineTo(ctx, sx + ax * (7 - pull), sy + ay * (7 - pull), sx + ax * 16, sy + ay * 16, '#f2ecd8', 1);
  }
  if (def.tpl === 'humanoid' && def.crossbow) {
    // a crossbow: stock along the aim, steel prod across the front, a bolt nocked while it telegraphs
    const ax = e.aimX === undefined ? e.face : e.aimX;
    const ay = e.aimY === undefined ? 0 : e.aimY;
    const sx = e.x - ox + e.face * 3, sy = e.y - oy - 20;
    const nx = -ay, ny = ax;
    holdArm(ctx, def, sx - ax, sy - ay, sx + ax * 6, sy + ay * 6);
    olLine(ctx, sx - ax * 2, sy - ay * 2, sx + ax * 12, sy + ay * 12, '#6b4a2b', 3);
    olLine(ctx, sx + ax * 10 + nx * 7, sy + ay * 10 + ny * 7, sx + ax * 12, sy + ay * 12, '#4a4a56', 2);
    olLine(ctx, sx + ax * 12, sy + ay * 12, sx + ax * 10 - nx * 7, sy + ay * 10 - ny * 7, '#4a4a56', 2);
    const draw = e.state === 'tele' ? 4 : 0;
    lineTo(ctx, sx + ax * (10 - draw) + nx * 7, sy + ay * (10 - draw) + ny * 7, sx + ax * (10 - draw) - nx * 7, sy + ay * (10 - draw) - ny * 7, '#e8e0c8', 1);
    if (e.state === 'tele') {
      lineTo(ctx, sx + ax * 6, sy + ay * 6, sx + ax * 17, sy + ay * 17, '#e8e8f0', 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(sx + ax * 17) - 1, Math.round(sy + ay * 17) - 1, 2, 2);
    }
  }
  if (def.tpl === 'humanoid' && def.gun) {
    // aimed gun
    const ax = e.aimX === undefined ? e.face : e.aimX;
    const ay = e.aimY === undefined ? 0 : e.aimY;
    const sx = e.x - ox + e.face * 2 - ax * kick, sy = e.y - oy - 21 - ay * kick;
    holdArm(ctx, def, sx, sy, sx + ax * 4, sy + ay * 4);
    if (def.bazooka) {
      // a rocket tube held on the shoulder: long, olive, flared at the back
      olLine(ctx, sx - ax * 5, sy - ay * 5, sx + ax * 14, sy + ay * 14, '#4a5a3a', 4);
      lineTo(ctx, sx - ax * 5, sy - ay * 5, sx + ax * 14, sy + ay * 14, '#6a7a52', 2);
      lineTo(ctx, sx + ax * 12, sy + ay * 12, sx + ax * 15, sy + ay * 15, '#2a2a2e', 4);
    } else olLine(ctx, sx + ax * 3, sy + ay * 3, sx + ax * 13, sy + ay * 13, '#2a2a2e', 2);
    if (e.state === 'tele') {
      const tw = e.tele > 0 ? 1 - e.t / e.tele : 1;
      ctx.fillStyle = tw > 0.5 ? '#ffffff' : '#ffb84a';
      const fx = sx + ax * 15, fy = sy + ay * 15;
      ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

/** Enemy bullets: art is chosen by the bullet's kind (see ebullets.js). */
export function drawEnemyBullet(ctx, b, ox, oy) {
  drawEnemyBulletArt(ctx, b, ox, oy);
}
