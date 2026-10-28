// Browser entry point: wires the canvas, input, fixed-timestep loop and scaling.

import { Game } from './game/game.js';
import { Input } from './engine/input.js';
import { DT, VIEW_W, VIEW_H } from './game/constants.js';
import { registerRoutes } from './scenes/routes.js';
import { SaveData } from './game/save.js';
import { createAudio } from './engine/audio.js';
import { TRACKS } from './game/tracks.js';
import { createWarmer } from './game/art/warm.js';

const canvas = document.getElementById('game');
const input = new Input();
const audio = createAudio(TRACKS);
// browsers only allow sound after a tap, click or key press
input.onFirstGesture = () => audio.unlock();
input.attach(window, document);

const game = new Game({ canvas, input, audio, save: new SaveData() });
registerRoutes(game);
// the CRT filter is a CSS overlay on the page (the canvas itself is never touched)
game.onDisplay = (o) => {
  if (document.body && document.body.classList) document.body.classList.toggle('crt', o.crt === 'scanlines');
};
game.applyDisplay();
game.go('title');

// F: fullscreen (not on iOS Safari, which has none), M: mute
input.onHotkey = (name) => {
  if (name === 'mute') {
    game.toggleMute();
  } else if (name === 'fullscreen') {
    const root = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (root.requestFullscreen) root.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      // fullscreen refused (iframe, permissions): the game just stays windowed
    }
  }
};

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const raw = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  // snap to whole device pixels when we can so the pixel art stays crisp
  const scale = raw >= 1 / dpr + 1 ? Math.floor(raw * dpr) / dpr : raw;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  // the CRT filter's scanlines follow the game's pixel grid
  const root = document.documentElement;
  if (root && root.style && root.style.setProperty) {
    root.style.setProperty('--crt-px', `${scale}px`);
    root.style.setProperty('--crt-top', `${(window.innerHeight - VIEW_H * scale) / 2}px`);
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
fit();

// paint every sprite and backdrop layer a few milliseconds per frame while the title screen is up, so no level has to
// stop and draw a boss sheet or a parallax layer in the middle of play (anything not ready in time is still drawn lazily)
const warmer = createWarmer();

let last = performance.now();
let acc = 0;
function loop(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= DT) {
    game.step();
    acc -= DT;
  }
  game.render();
  if (!warmer.done) warmer.step(4);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// expose for debugging in the console
window.__game = game;
window.__warmer = warmer;
