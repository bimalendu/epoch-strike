// The Game shell: owns the canvas context, input, audio and the active scene.
// Scenes are objects with update(dt) and draw(ctx); they get the Game in their constructor.

import { DT } from './constants.js';
import { ctx2d } from '../engine/gfx.js';
import { SaveData, MemoryStorage } from './save.js';

export class Game {
  constructor({ canvas, input, audio = null, save = null }) {
    this.canvas = canvas;
    this.ctx = ctx2d(canvas);
    this.input = input;
    this.audio = audio;
    this.save = save || new SaveData(new MemoryStorage());
    if (audio) audio.setVolumes(this.save.options.sfx, this.save.options.music);
    if (input.setTouchMode) input.setTouchMode(this.save.options.touch); // the saved on-screen-controls choice
    this.scene = null;
    this._next = null;
    this.frame = 0;
    this.routes = {}; // name -> (params) => scene; registered by main.js (or tests)
    this.muted = false;
  }

  /** M: silence everything without touching the saved volumes; press again to bring the sound back. */
  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  applyVolumes() {
    if (!this.audio) return;
    const o = this.save.options;
    this.audio.setVolumes(this.muted ? 0 : o.sfx, this.muted ? 0 : o.music);
  }

  /** Switch scenes by route name, e.g. game.go('title'). */
  go(name, params = {}) {
    const make = this.routes[name];
    if (!make) throw new Error(`No route "${name}"`);
    this.setScene(make(params));
  }

  setScene(scene) {
    this._next = scene;
  }

  /** One fixed 1/60 s step: poll input, switch scene if requested, update. */
  step() {
    this.input.poll();
    // focus lost, tab hidden or pad unplugged: scenes that care (play) open their pause menu
    if (this.input.takeAutoPause() && this.scene && this.scene.onAutoPause) this.scene.onAutoPause();
    if (this._next) {
      if (this.scene && this.scene.exit) this.scene.exit();
      this.scene = this._next;
      this._next = null;
      // a scene that has a `music` property picks the track (null = silence); one without keeps what is playing
      if (this.audio && this.scene.music !== undefined) this.audio.music(this.scene.music);
      if (this.scene.enter) this.scene.enter();
    }
    if (this.scene) this.scene.update(DT);
    this.frame++;
  }

  render() {
    if (this.scene) this.scene.draw(this.ctx);
  }
}
