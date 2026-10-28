// PlayScene: runs one level attempt and owns the flow around it —
// death, respawn in place, checkpoints, score and pickups, pause menu, running out of lives, level clear.

import { World } from '../game/world.js';
import { buildLevel, levelName } from '../game/levels.js';
import { renderWorld } from '../game/render.js';
import { drawHud } from '../game/art/hud.js';
import { drawText } from '../engine/font.js';
import { popup } from '../game/fx.js';
import { weaponDef } from '../game/weapons.js';
import { PICKUPS } from '../game/pickups.js';
import { Toasts } from './toasts.js';
import { Hints } from './hints.js';
import { Menu, wantsBack } from '../ui/menu.js';
import { OptionsScene } from './options.js';
import { VIEW_W, VIEW_H } from '../game/constants.js';

export const RESPAWN_DELAY = 1.3; // seconds between death and the player coming back
export const GAMEOVER_DELAY = 1.8; // seconds between the last death and the Continue screen
export const CLEAR_DELAY = 1.8; // seconds of victory before the results screen
const CARD_TIME = 2.2; // level name card
export const HIT_STOP = { death: 3, phase: 4, bossDown: 5 }; // frames the whole game holds still for
export const BOSS_SLOWMO = 0.8; // seconds the boss's death plays at half speed
const WEAPON_LABEL_TIME = 1.3; // seconds a newly active weapon is named under the slots
const TRAIL_HOLD = 0.4; // seconds the boss bar's damage trail waits before it drains
const TRAIL_DRAIN = 0.3; // boss health (as a fraction of the total) the trail drains per second

export class PlayScene {
  /**
   * @param {Game} game
   * @param {{run: Run, levelIndex?: number, resume?: boolean, fromSave?: boolean, god?: boolean}} params
   *   resume = true restarts from the last checkpoint of this level (used by Continue);
   *   fromSave = the run was loaded from the mid-run save (no new save is written).
   */
  constructor(game, { run, levelIndex = run.levelIndex, resume = false, fromSave = false, god = false } = {}) {
    this.game = game;
    this.run = run;
    this.levelIndex = levelIndex;
    if (!resume) run.startLevel(levelIndex);
    else run.levelIndex = levelIndex;
    const cp = resume ? run.resumePoint(levelIndex) : null;
    this.level = buildLevel(levelIndex);
    this.music = this.level.music || null;
    this.world = new World(this.level, {
      audio: game.audio,
      difficulty: run.difficulty,
      start: cp ? { x: cp.x, y: cp.y } : undefined,
      loadout: run.loadout,
      shake: game.save.options.shake,
      fx: game.save.options.fx,
      flashes: game.save.options.flashes,
      god,
    });
    run.score.hi = Math.max(run.score.hi, game.save.best);
    // mid-run save at the start of each level so the player can quit and resume
    this.startSnapshot = run.toJSON();
    if (!resume && !fromSave && !run.practice) game.save.saveResume(run);
    this.paused = false;
    this.ended = false;
    this.clearT = -1; // >= 0 while the victory pause runs
    this.freezeF = 0; // frames of hit-stop left: the world does not step at all
    this.slowT = 0; // seconds of slow motion left: the world steps every other frame
    this.slowSkip = false;
    this.toasts = new Toasts();
    this.hints = new Hints(game.save);
    this.weaponLabel = { text: '', color: '#ffffff', t: 0 }; // the active weapon's name, shown for a moment after a change
    this.lastWeapon = null;
    this.introK = 0; // 0..1: how far into a boss's entrance (letterbox bars, name plate)
    this.trail = 0; // the boss bar's damage trail, in hit points
    this.trailHold = 0;
    this.lastShown = 0;
    this.cardT = resume ? 0 : CARD_TIME;
    this.pauseMenu = this.makePauseMenu();
  }

  makePauseMenu() {
    const game = this.game;
    return new Menu(
      [
        { label: 'RESUME', onSelect: () => this.resume() },
        { label: 'RESTART LEVEL', onSelect: () => this.restart() },
        { label: 'OPTIONS', onSelect: () => game.setScene(new OptionsScene(game, { onClose: () => game.setScene(this) })) },
        { label: 'QUIT TO MENU', onSelect: () => game.go('menu') },
      ],
      { x: VIEW_W / 2, y: 104, gap: 18 },
    );
  }

  /** The window lost focus (or the pad was unplugged): open the pause menu, as if START had been pressed. */
  onAutoPause() {
    if (this.paused || this.ended || this.clearT >= 0) return;
    this.paused = true;
    this.pauseMenu.index = 0;
    if (this.game.audio) this.game.audio.duck(true);
  }

  resume() {
    this.paused = false;
    if (this.game.audio) this.game.audio.duck(false);
  }

  enter() {
    if (this.paused && this.game.audio) this.game.audio.duck(true); // back from the options screen
  }

  exit() {
    if (this.game.audio) this.game.audio.duck(false);
  }

  /** Start the level over with the score, lives and weapons it began with. */
  restart() {
    this.run.restore(this.startSnapshot);
    this.game.go('play', { run: this.run, levelIndex: this.levelIndex, fromSave: true });
  }

  update(dt) {
    const { input, audio } = this.game;
    if (this.paused) {
      this.pauseMenu.update(input, audio, dt);
      if (wantsBack(input)) this.resume();
      return;
    }
    if (input.pressed.pause && !this.ended) {
      this.paused = true;
      this.pauseMenu.index = 0;
      if (audio) {
        audio.sfx('menuSelect');
        audio.duck(true);
      }
      return;
    }

    const w = this.world;
    // hit-stop and slow motion live here, not in the world: the world still only ever steps by whole DTs
    if (this.freezeF > 0) {
      this.freezeF--;
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.slowSkip = !this.slowSkip;
      if (this.slowSkip) return;
    }
    this.run.timeThisLevel += dt;
    if (this.cardT > 0) this.cardT -= dt;
    w.update(input, dt);
    for (const e of w.events) {
      this.onEvent(e);
      this.hints.observe(w, e);
    }
    w.events.length = 0;
    this.hints.observe(w);
    this.updateHudState(w, dt);

    if (this.clearT >= 0) {
      this.clearT += dt;
      if (this.clearT >= CLEAR_DELAY && !this.ended) this.toResults();
      return;
    }

    if (!w.player.alive && !this.ended) {
      if (this.run.lives.empty) {
        if (w.deathT >= GAMEOVER_DELAY) this.gameOver();
      } else if (w.deathT >= RESPAWN_DELAY) {
        const at = w.respawnPoint();
        w.respawnPlayer(at.x, at.y);
      }
    }
  }

  /** The bits of the HUD that animate on their own clock: toasts, hints, the weapon label, the boss entrance and trail. */
  updateHudState(w, dt) {
    const raw = w.promptAt();
    this.toasts.update(dt);
    this.hints.update(dt, !!raw || this.cardT > 0 || !w.player.alive);
    // name the weapon whenever the active one changes (a pickup, a swap, the rifle coming back after a death)
    const id = w.player.weapon;
    if (this.lastWeapon !== null && id !== this.lastWeapon && id) {
      const wd = weaponDef(id);
      this.weaponLabel = { text: wd.name, color: wd.badge || wd.color, t: WEAPON_LABEL_TIME };
    } else if (this.weaponLabel.t > 0) this.weaponLabel.t -= dt;
    this.lastWeapon = id;
    // boss entrance and damage trail
    const b = w.boss;
    const entering = !!(b && b.bs && b.bs.state === 'enter');
    this.introK += ((entering ? 1 : 0) - this.introK) * Math.min(1, 6 * dt);
    if (this.introK < 0.01) this.introK = 0;
    if (b && b.bs) {
      const shown = b.bs.shownHp;
      if (shown < this.lastShown - 1e-6) this.trailHold = TRAIL_HOLD; // fresh damage: the trail waits a moment again
      this.lastShown = shown;
      if (shown >= this.trail || entering) this.trail = shown;
      else if (this.trailHold > 0) this.trailHold -= dt;
      else this.trail = Math.max(shown, this.trail - b.maxHp * TRAIL_DRAIN * dt);
    } else {
      this.trail = 0;
      this.trailHold = 0;
      this.lastShown = 0;
    }
  }

  onEvent(e) {
    const run = this.run;
    const w = this.world;
    switch (e.type) {
      case 'playerDied':
        run.lives.loseLife();
        run.deathsThisLevel++;
        run.totalDeaths++;
        this.freezeF = HIT_STOP.death;
        if (run.lives.lives === 1) this.toasts.push('LAST LIFE', { color: '#ff6a6a' });
        break;
      case 'checkpoint':
        run.checkpoint = { levelIndex: this.levelIndex, x: e.x, y: e.y };
        this.toasts.push('CHECKPOINT', { color: '#8be9ff' });
        break;
      case 'pickup': {
        // ordinary weapons already name themselves in a popup; the era weapon of the level is worth a banner
        const d = PICKUPS[e.item];
        const wd = d && d.kind === 'weapon' ? weaponDef(d.weapon) : null;
        if (wd && wd.era !== undefined) this.toasts.push(`ERA WEAPON: ${wd.name}`, { color: '#ffd23a', big: true, hold: 1.6 });
        break;
      }
      case 'kill': {
        if (!e.score) break;
        const r = run.score.addKill(e.score, w.time);
        if (e.score >= 300 || r.mult > 1) popup(w, e.x, e.y - 10, r.points, r.mult > 1 ? '#ffd23a' : '#ffffff');
        this.lifeEvents(r.events);
        break;
      }
      case 'bonus':
        popup(w, e.x, e.y, e.points, '#ffffff');
        this.lifeEvents(run.score.add(e.points).events);
        break;
      case 'medal':
        popup(w, e.x, e.y - 6, '500', '#ffd23a');
        this.lifeEvents(run.collectMedal());
        if (run.lives.medalProgress === 9) this.toasts.push('1 MEDAL TO A 1UP', { color: '#ffd23a' });
        break;
      case 'oneup':
        this.lifeEvents(run.collectOneUp());
        break;
      case 'bossDefeated':
        if (e.echo) {
          // an echo of a boss rush: points, and the level's own music comes back for the walk to the next arena
          popup(w, w.player.x, w.player.y - 56, e.noDeath ? 'ECHO BROKEN +5000' : 'ECHO BROKEN', '#c06bff');
          this.lifeEvents(run.score.add(e.noDeath ? 5000 : 2000).events);
          if (this.game.audio) this.game.audio.music(this.level.music || null);
          break;
        }
        // beating a boss without losing a life is worth an extra one
        if (e.noDeath) {
          popup(w, w.player.x, w.player.y - 56, 'FLAWLESS', '#ffd23a');
          this.lifeEvents(run.earnLife('boss'));
        }
        break;
      case 'arenaClear':
        popup(w, e.x, e.y, 'ARENA CLEAR', '#ffd23a');
        this.lifeEvents(run.score.add(1000).events);
        break;
      case 'bossStart':
        // echoes of a boss rush use the ordinary boss theme; the level's own boss may have a track of its own
        if (this.game.audio) this.game.audio.music(e.echo ? 'boss' : this.level.bossMusic || 'boss');
        break;
      case 'bossPhase':
        this.freezeF = HIT_STOP.phase;
        break;
      case 'bossDying':
        if (this.game.audio) this.game.audio.stopMusic(0.5);
        this.freezeF = HIT_STOP.bossDown;
        this.slowT = BOSS_SLOWMO;
        break;
      case 'levelClear':
        this.startClear();
        break;
      default:
    }
  }

  /** React to lives earned: jingle and a floating message. */
  lifeEvents(events) {
    const w = this.world;
    const p = w.player;
    for (const ev of events) {
      if (ev.type === 'life') {
        w.sfx('oneup');
        popup(w, p.x, p.y - 44, '1UP', '#ff9ab0');
      } else if (ev.type === 'cap') {
        w.sfx('pickup');
        popup(w, p.x, p.y - 44, `MAX LIVES +${ev.bonus}`, '#ffd23a');
      }
    }
  }

  startClear() {
    const w = this.world;
    this.clearT = 0;
    w.ebullets.length = 0;
    w.player.invuln = 99;
    if (this.game.audio) this.game.audio.stopMusic(0.3);
    w.sfx('clear');
  }

  toResults() {
    this.ended = true;
    this.game.go('results', { run: this.run, levelIndex: this.levelIndex, world: this.world });
  }

  gameOver() {
    this.ended = true;
    this.game.go('gameover', { run: this.run, levelIndex: this.levelIndex, world: this.world });
  }

  draw(ctx) {
    const name = levelName(this.levelIndex);
    renderWorld(ctx, this.world);
    const raw = this.world.promptAt();
    const w = this.world;
    const prompt = raw && w.player.alive && this.cardT <= 0 ? raw : this.hints.text;
    drawHud(ctx, w, this.run, {
      prompt: prompt ? this.game.input.fill(prompt) : null,
      card: this.cardT > 0 ? { t: this.cardT, total: CARD_TIME, title: this.level.name || name, subtitle: this.level.era || '', number: this.levelIndex + 1 } : null,
      weaponLabel: this.weaponLabel,
      intro: this.introK,
      trail: this.trail,
      large: this.game.save.options.hud === 'large',
    });
    this.toasts.draw(ctx, this.game.save.options.hud === 'large' ? 64 : w.boss ? 62 : 36);
    if (this.clearT >= 0) {
      drawText(ctx, 'STAGE CLEAR', VIEW_W / 2, 110, '#ffd23a', 3, 'center', '#000000');
    }
    if (this.paused) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
      drawText(ctx, 'PAUSED', VIEW_W / 2, 70, '#ffffff', 3, 'center', '#000000');
      this.pauseMenu.draw(ctx);
    }
  }
}
