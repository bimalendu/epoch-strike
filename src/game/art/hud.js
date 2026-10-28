// HUD icons and drawing: life slots (6), bombs, score, weapons and boss bar.

import { Painter } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { VIEW_W, VIEW_H, LIVES, PICKUP_RULES, TANK, BIKE } from '../constants.js';
import { pickupIcon } from './pickups.js';
import { weaponDef } from '../weapons.js';

let icons = null;
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
}

/** Paint the HUD icons now instead of at the first frame of a level. */
export function warmHud() {
  if (!icons) build();
  for (const id of ['rifle', null]) for (const active of [true, false]) slotIcon(id, active);
}

export function drawHud(ctx, world, run, extra = {}) {
  if (!icons) build();
  const p = world.player;
  const lives = run ? run.lives.lives : 3;
  // lives: six slots, filled vs empty, so the cap is always visible
  for (let i = 0; i < LIVES.MAX; i++) {
    ctx.drawImage(i < lives ? icons.headOn : icons.headOff, 5 + i * 11, 4);
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
  // score and high score
  if (run) {
    drawText(ctx, String(run.score.points).padStart(7, '0'), VIEW_W / 2, 5, '#ffffff', 1, 'center', '#000000');
    drawText(ctx, `HI ${String(run.score.hi).padStart(7, '0')}`, VIEW_W / 2, 15, '#9aa4b8', 1, 'center', '#000000');
    if (run.score.combo >= 2 && world.time - run.score.lastKill < 1.0) {
      drawText(ctx, `COMBO X${run.score.multiplier.toFixed(1)}`, VIEW_W / 2, 25, '#ffd23a', 1, 'center', '#000000');
    }
  }
  // carried weapons (active one is outlined), plus the rapid / barrier status
  for (let i = 0; i < 2; i++) {
    ctx.drawImage(slotIcon(p.slots[i], i === p.slot), VIEW_W - 5 - 17 * (2 - i) - (2 - i - 1) * 2, 4);
  }
  if (p.rapid) drawText(ctx, 'RAPID', VIEW_W - 5, 24, '#ff9a1e', 1, 'right', '#000000');
  if (p.barrier > 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(VIEW_W - 5 - 36, 34, 37, 5);
    ctx.fillStyle = '#4aa8ff';
    ctx.fillRect(VIEW_W - 5 - 35, 35, Math.round((35 * p.barrier) / PICKUP_RULES.BARRIER_SECONDS), 3);
  }
  // boss: health bar with phase ticks, and the WARNING banner while it walks in
  const boss = world.boss;
  if (boss && boss.bs) {
    const bs = boss.bs;
    const bw = 220;
    const bx = Math.round((VIEW_W - bw) / 2);
    const by = 36;
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
    ctx.fillStyle = '#4a1218';
    ctx.fillRect(bx, by, bw, 5);
    const frac = Math.max(0, Math.min(1, bs.shownHp / boss.maxHp));
    ctx.fillStyle = boss.echo ? '#c06bff' : bs.phase >= 2 ? '#ff4a4a' : bs.phase === 1 ? '#ff9a3a' : '#ffd23a';
    ctx.fillRect(bx, by, Math.round(bw * frac), 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, Math.round(bw * frac), 1);
    ctx.fillStyle = '#000000';
    for (const ph of boss.def.phases.slice(1)) ctx.fillRect(bx + Math.round(bw * ph.hp), by, 1, 5);
    drawText(ctx, boss.def.name, VIEW_W / 2, by + 9, '#ffffff', 1, 'center', '#000000');
    if (bs.state === 'enter' && Math.floor(bs.age * 4) % 2 === 0) {
      drawText(ctx, 'WARNING', VIEW_W / 2, 80, '#ff4a4a', 3, 'center', '#000000');
    }
  }
  // wave arena: which wave is on
  if (world.arena && world.arena.state === 'fighting' && !boss && world.arena.wave >= 0) {
    const z = world.arena;
    drawText(ctx, `WAVE ${Math.min(z.wave + 1, z.waves.length)}/${z.waves.length}`, VIEW_W / 2, 36, '#ffd23a', 1, 'center', '#000000');
  }
  // tutorial prompt (bottom of the screen)
  if (extra.prompt) {
    const w = extra.prompt.length * 6 + 12;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round((VIEW_W - w) / 2), VIEW_H - 30, w, 13);
    ctx.globalAlpha = 1;
    drawText(ctx, extra.prompt, VIEW_W / 2, VIEW_H - 27, '#ffffff', 1, 'center', '#000000');
  }
  // level name card
  if (extra.card && extra.card.t > 0) {
    ctx.globalAlpha = Math.min(1, extra.card.t / 0.4);
    drawText(ctx, extra.card.title, VIEW_W / 2, 92, '#ffffff', 2, 'center', '#000000');
    if (extra.card.subtitle) drawText(ctx, extra.card.subtitle, VIEW_W / 2, 114, '#ffd23a', 1, 'center', '#000000');
    ctx.globalAlpha = 1;
  }
}
