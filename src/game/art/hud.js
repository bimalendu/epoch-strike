// HUD icons and drawing: life slots (6), bombs, score, weapons and boss bar.

import { Painter } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { VIEW_W, VIEW_H, LIVES, PICKUP_RULES, TANK, BIKE } from '../constants.js';
import { pickupIcon } from './pickups.js';
import { weaponDef } from '../weapons.js';
import { levelProgress } from '../progress.js';

let icons = null;
let plates = null;
const slotIcons = new Map();

/** A 15x15 weapon slot badge: the pickup letter, a rifle glyph, or an empty box. */
function slotIcon(id, active) {
  const key = `${id}|${active}`;
  let c = slotIcons.get(key);
  if (c) return c;
  const p = new Painter(17, 17);
  p.rect(0, 0, 17, 17, active ? '#ffffff' : '#3a3a48');
  p.rect(1, 1, 15, 15, '#0d0d14');
  if (id === 'rifle') {
    p.rect(3, 8, 11, 3, '#8a8a98');
    p.rect(3, 8, 11, 1, '#c8c8d8');
    p.rect(2, 10, 4, 4, '#6b4a2b');
    p.rect(11, 6, 2, 2, '#8a8a98');
  } else if (id) {
    const w = weaponDef(id);
    p.canvas.getContext('2d').drawImage(pickupIcon(w.item || w.letter), 1, 1);
  }
  slotIcons.set(key, p.canvas);
  return p.canvas;
}

function build() {
  const head = (fill) => {
    const p = new Painter(10, 10);
    if (fill) {
      p.ellipse(5, 5, 4, 4, '#e9a97a');
      p.rect(1, 2, 8, 2, '#d92b2b');
      p.rect(0, 3, 2, 1, '#9c1c1c');
      p.px(7, 5, '#1a1a1a');
    } else {
      p.ellipse(5, 5, 4, 4, '#2c2c34');
      p.rect(1, 2, 8, 2, '#3a2428');
    }
    return p.canvas;
  };
  const bomb = (fill) => {
    const p = new Painter(9, 9);
    p.ellipse(4, 5, 3, 3, fill ? '#9aa4b8' : '#2c2c34');
    p.rect(3, 1, 3, 2, fill ? '#d8dde8' : '#3a3a44');
    if (fill) p.px(7, 0, '#ffb02e');
    return p.canvas;
  };
  icons = { headOn: head(true), headOff: head(false), bombOn: bomb(true), bombOff: bomb(false) };
  // dark translucent plates behind the corner clusters, so white text reads against a bright sky
  const plate = (w, h) => {
    const p = new Painter(w, h);
    p.ctx.globalAlpha = 0.42;
    p.rect(1, 0, w - 2, h, '#000000');
    p.rect(0, 1, w, h - 2, '#000000');
    p.ctx.globalAlpha = 1;
    return p.canvas;
  };
  plates = { left: plate(80, 27), leftTall: plate(80, 38), score: plate(72, 24), scoreTall: plate(72, 34), scoreOne: plate(72, 14), slots: plate(44, 22) };
}

/** Paint the HUD icons now instead of at the first frame of a level. */
export function warmHud() {
  if (!icons) build();
  for (const id of ['rifle', null]) for (const active of [true, false]) slotIcon(id, active);
}

const ease = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

/** A 7x7 skull (the boss marker on the progress bar). */
function skull(ctx, x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y, 5, 1);
  ctx.fillRect(x, y + 1, 7, 3);
  ctx.fillRect(x + 1, y + 4, 5, 2);
  ctx.fillRect(x + 2, y + 6, 3, 1);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 1, y + 2, 2, 2);
  ctx.fillRect(x + 4, y + 2, 2, 2);
}

/** The thin bar along the bottom: how far through the level, checkpoints, and a skull at every boss. */
function drawProgress(ctx, world) {
  const pr = levelProgress(world);
  if (!pr) return;
  const w = 240;
  const x0 = Math.round((VIEW_W - w) / 2);
  const y = VIEW_H - 6;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0 - 2, y - 1, w + 4, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(x0, y, w, 2);
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x0, y, Math.round(w * pr.frac), 2);
  for (const c of pr.checkpoints) {
    ctx.fillStyle = c.hit ? '#8be9ff' : '#6a6a86';
    ctx.fillRect(x0 + Math.round((w - 1) * c.f), y - 3, 1, 3);
  }
  for (const a of pr.arenas) skull(ctx, x0 + Math.round((w - 7) * a.f), y - 8, a.done ? '#6a6a86' : '#ff6a6a');
  skull(ctx, x0 + w - 4, y - 8, '#ff4a4a'); // the end of the bar: the exit or the last boss
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0 + Math.round((w - 3) * pr.frac), y - 1, 3, 4); // you are here
}

/** The level title card: a band that wipes in from the left, holds, then wipes out. */
function drawCard(ctx, c) {
  const inK = ease(((c.total || 2.2) - c.t) / 0.35);
  const outK = ease(1 - c.t / 0.35);
  const x0 = Math.round(outK * VIEW_W);
  const x1 = Math.round(inK * VIEW_W);
  if (x1 <= x0) return;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0, 80, x1 - x0, 50);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x0, 80, x1 - x0, 1);
  ctx.fillRect(x0, 129, x1 - x0, 1);
  const a = Math.min(inK, 1 - outK);
  const dx = Math.round((1 - inK) * -40 + outK * 40);
  ctx.globalAlpha = a;
  if (c.number >= 1) drawText(ctx, `LEVEL ${String(c.number).padStart(2, '0')}`, VIEW_W / 2 + dx, 87, '#ffd23a', 1, 'center', '#000000');
  drawText(ctx, c.title, VIEW_W / 2 + dx, 98, '#ffffff', 2, 'center', '#000000');
  if (c.subtitle) drawText(ctx, c.subtitle, VIEW_W / 2 + dx, 117, '#8be9ff', 1, 'center', '#000000');
  ctx.globalAlpha = 1;
}

/** The three corner clusters: lives, bombs, medals and ride armour on the left, the score in the middle, weapons on the right. */
function drawCorners(ctx, world, run, extra, k) {
  const p = world.player;
  const lives = run ? run.lives.lives : 3;
  const vw = VIEW_W / k; // the width these clusters are laid out in
  ctx.save();
  if (k > 1) ctx.scale(k, k);
  // plates
  const hasRide = p.mode === 'tank' || p.mode === 'fly';
  ctx.drawImage(hasRide ? plates.leftTall : plates.left, 2, 2);
  if (run) {
    const combo = run.score.combo >= 2 && world.time - run.score.lastKill < 1.0;
    ctx.drawImage(k > 1 ? plates.scoreOne : combo ? plates.scoreTall : plates.score, Math.round(vw / 2 - 36), 2);
  }
  ctx.drawImage(plates.slots, vw - 5 - 38 - 2, 2);
  if (extra.god) drawText(ctx, 'GOD', 5, hasRide ? 42 : 31, '#ff5a4a', 1, 'left', '#000000');
  // lives: six slots, filled vs empty, so the cap is always visible; the last life bobs
  for (let i = 0; i < LIVES.MAX; i++) {
    const last = lives === 1 && i === 0 && Math.floor(world.time * 4) % 2 === 0;
    ctx.drawImage(i < lives ? icons.headOn : icons.headOff, 5 + i * 11, last ? 3 : 4);
  }
  // bombs
  for (let i = 0; i < PICKUP_RULES.MAX_BOMBS; i++) {
    ctx.drawImage(i < p.bombs ? icons.bombOn : icons.bombOff, 5 + i * 10, 17);
  }
  // tank armour: a pip per hit it can still take
  if (p.mode === 'tank') {
    drawText(ctx, 'TANK', 5, 29, '#ffd23a', 1, 'left', '#000000');
    for (let i = 0; i < TANK.HP; i++) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(33 + i * 8, 28, 7, 7);
      ctx.fillStyle = i < p.tankHp ? (p.tankHp <= 1 ? '#ff5a3a' : '#9ad04a') : '#3a3a30';
      ctx.fillRect(34 + i * 8, 29, 5, 5);
    }
  }
  // hoverbike armour
  if (p.mode === 'fly') {
    drawText(ctx, 'BIKE', 5, 29, '#4af0ff', 1, 'left', '#000000');
    for (let i = 0; i < BIKE.HP; i++) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(31 + i * 8, 28, 7, 7);
      ctx.fillStyle = i < p.bikeHp ? (p.bikeHp <= 1 ? '#ff5a3a' : '#4af0ff') : '#1a2a3a';
      ctx.fillRect(32 + i * 8, 29, 5, 5);
    }
  }
  // medals toward the next life
  if (run && world.diff.medals) {
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(38, 19, 5, 5);
    ctx.fillStyle = '#a8741a';
    ctx.fillRect(38, 23, 5, 1);
    drawText(ctx, `${run.lives.medalProgress}/10`, 46, 18, '#ffe9a0', 1, 'left', '#000000');
  }
  // score and high score (large: just the score, with the combo multiplier beside it)
  if (run) {
    const combo = run.score.combo >= 2 && world.time - run.score.lastKill < 1.0;
    const score = String(run.score.points).padStart(7, '0');
    if (k > 1) {
      drawText(ctx, combo ? `${score} X${run.score.multiplier.toFixed(1)}` : score, vw / 2, 5, '#ffffff', 1, 'center', '#000000');
    } else {
      drawText(ctx, score, vw / 2, 5, '#ffffff', 1, 'center', '#000000');
      drawText(ctx, `HI ${String(run.score.hi).padStart(7, '0')}`, vw / 2, 15, '#9aa4b8', 1, 'center', '#000000');
      if (combo) drawText(ctx, `COMBO X${run.score.multiplier.toFixed(1)}`, vw / 2, 25, '#ffd23a', 1, 'center', '#000000');
    }
  }
  // carried weapons (active one is outlined)
  for (let i = 0; i < 2; i++) {
    ctx.drawImage(slotIcon(p.slots[i], i === p.slot), vw - 5 - 17 * (2 - i) - (2 - i - 1) * 2, 4);
  }
  // the weapon you just picked up or switched to, named for a moment; then the rapid / barrier status below it
  const wl = extra.weaponLabel;
  if (wl && wl.t > 0) {
    ctx.globalAlpha = Math.min(1, wl.t / 0.3);
    drawText(ctx, wl.text, vw - 5, 25, wl.color, 1, 'right', '#000000');
    ctx.globalAlpha = 1;
  }
  if (p.rapid) drawText(ctx, 'RAPID', vw - 5, 35, '#ff9a1e', 1, 'right', '#000000');
  if (p.barrier > 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(vw - 5 - 36, 45, 37, 5);
    ctx.fillStyle = '#4aa8ff';
    ctx.fillRect(vw - 5 - 35, 46, Math.round((35 * p.barrier) / PICKUP_RULES.BARRIER_SECONDS), 3);
  }
  ctx.restore();
}

/**
 * `extra` is what the scene knows and the world does not: { prompt, card: {t, total, title, subtitle, number},
 * weaponLabel: {text, color, t}, intro (0..1: how far into a boss's entrance), trail (the boss bar's damage trail, in hp) }.
 */
export function drawHud(ctx, world, run, extra = {}) {
  if (!icons) build();
  const boss = world.boss;
  // boss entrance: letterbox bars close in from the top and bottom (drawn first, so the HUD sits on them)
  const intro = boss && boss.bs ? extra.intro || 0 : 0;
  if (intro > 0.01) {
    const bar = Math.round(12 * ease(intro));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW_W, bar);
    ctx.fillRect(0, VIEW_H - bar, VIEW_W, bar);
  }
  drawCorners(ctx, world, run, extra, extra.large ? 2 : 1);
  // boss: health bar with phase ticks (and a trail where the last hits took it from), the entrance plate and WARNING
  if (boss && boss.bs) {
    const bs = boss.bs;
    const bw = extra.large ? 150 : 220; // the larger corners leave less room between them
    const bx = Math.round((VIEW_W - bw) / 2);
    const by = 36;
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
    ctx.fillStyle = '#4a1218';
    ctx.fillRect(bx, by, bw, 5);
    const frac = Math.max(0, Math.min(1, bs.shownHp / boss.maxHp));
    const trail = Math.max(frac, Math.min(1, (extra.trail || 0) / boss.maxHp));
    if (trail > frac) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + Math.round(bw * frac), by, Math.round(bw * trail) - Math.round(bw * frac), 5);
    }
    ctx.fillStyle = boss.echo ? '#c06bff' : bs.phase >= 2 ? '#ff4a4a' : bs.phase === 1 ? '#ff9a3a' : '#ffd23a';
    ctx.fillRect(bx, by, Math.round(bw * frac), 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, Math.round(bw * frac), 1);
    ctx.fillStyle = '#000000';
    for (const ph of boss.def.phases.slice(1)) ctx.fillRect(bx + Math.round(bw * ph.hp), by, 1, 5);
    if (intro < 0.3) drawText(ctx, boss.def.name, VIEW_W / 2, by + 9, '#ffffff', 1, 'center', '#000000'); // the plate names it during the entrance
    if (intro > 0.01) {
      // the name of the thing that is walking in, and the era it comes from
      ctx.globalAlpha = 0.65 * ease(intro);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 106, VIEW_W, 34);
      ctx.globalAlpha = ease(intro);
      drawText(ctx, boss.def.name, VIEW_W / 2, 111, '#ffffff', 2, 'center', '#000000');
      if (world.level.era) drawText(ctx, world.level.era, VIEW_W / 2, 129, '#ffd23a', 1, 'center', '#000000');
      ctx.globalAlpha = 1;
    }
    if (bs.state === 'enter' && Math.floor(bs.age * 4) % 2 === 0) {
      drawText(ctx, 'WARNING', VIEW_W / 2, 80, '#ff4a4a', 3, 'center', '#000000');
    }
  }
  // wave arena: which wave is on
  if (world.arena && world.arena.state === 'fighting' && !boss && world.arena.wave >= 0) {
    const z = world.arena;
    drawText(ctx, `WAVE ${Math.min(z.wave + 1, z.waves.length)}/${z.waves.length}`, VIEW_W / 2, 36, '#ffd23a', 1, 'center', '#000000');
  }
  // progress through the level (not in a boss fight, and not under a banner)
  if (!boss && !extra.prompt && !extra.card) drawProgress(ctx, world);
  // tutorial prompt or hint (bottom of the screen)
  if (extra.prompt) {
    const w = extra.prompt.length * 6 + 12;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round((VIEW_W - w) / 2), VIEW_H - 30, w, 13);
    ctx.globalAlpha = 1;
    drawText(ctx, extra.prompt, VIEW_W / 2, VIEW_H - 27, '#ffffff', 1, 'center', '#000000');
  }
  // level title card
  if (extra.card && extra.card.t > 0) drawCard(ctx, extra.card);
}
