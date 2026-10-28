// Unified input: keyboard, gamepad and touch all feed the same set of logical actions.
// Game code reads `input.held[action]` / `input.pressed[action]`; tests and bots drive it with `input.script`.

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'switch', 'bomb', 'pause', 'confirm', 'back'];

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump',
  KeyX: 'fire', KeyJ: 'fire',
  KeyC: 'switch', KeyK: 'switch',
  KeyV: 'bomb', KeyL: 'bomb',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
  Backspace: 'back',
};

// On-screen names for each action per device (tutorial prompts, the controls screen).
const LABELS = {
  key: { move: 'ARROWS', left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', jump: 'Z', fire: 'X', switch: 'C', bomb: 'V', pause: 'ESC' },
  pad: { move: 'STICK', left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', jump: 'A', fire: 'X', switch: 'Y', bomb: 'B', pause: 'START' },
  touch: { move: 'STICK', left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', jump: 'JUMP', fire: 'FIRE', switch: 'SWAP', bomb: 'BOMB', pause: 'PAUSE' },
};

/** Radial dead zone of the analogue stick, and the half-angle (sin 22.5 deg) of each of the eight direction sectors. */
export const PAD_DEAD_ZONE = 0.3;
const SECTOR = 0.38;

/**
 * Turn one gamepad (standard mapping) into logical actions. Pure, so tests can feed it plain objects.
 * The left stick is read as a vector: nothing happens inside the dead zone, outside it the direction is split into
 * eight sectors, so a diagonal push gives two directions and a push along one axis never leaks into the other.
 */
export function padActions(pad) {
  const out = {};
  if (!pad || pad.connected === false) return out;
  const btn = (i) => {
    const b = pad.buttons && pad.buttons[i];
    return !!b && (b.pressed || (typeof b.value === 'number' && b.value > 0.5));
  };
  const ax = (pad.axes && pad.axes[0]) || 0;
  const ay = (pad.axes && pad.axes[1]) || 0;
  const m = Math.hypot(ax, ay);
  if (m > PAD_DEAD_ZONE) {
    const nx = ax / m;
    const ny = ay / m;
    if (nx < -SECTOR) out.left = true;
    if (nx > SECTOR) out.right = true;
    if (ny < -SECTOR) out.up = true;
    if (ny > SECTOR) out.down = true;
  }
  if (btn(14)) out.left = true;
  if (btn(15)) out.right = true;
  if (btn(12)) out.up = true;
  if (btn(13)) out.down = true;
  if (btn(0)) out.jump = true;
  if (btn(2) || btn(7) || btn(5)) out.fire = true;
  if (btn(3) || btn(4)) out.switch = true;
  if (btn(1) || btn(6)) out.bomb = true;
  if (btn(9)) out.pause = true;
  if (btn(8)) out.back = true;
  return out;
}

// keys that are not game actions: handled by main.js through `onHotkey`
const HOTKEYS = { KeyF: 'fullscreen', F11: 'fullscreen', KeyM: 'mute' };

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Backspace']);

function blank() {
  const o = {};
  for (const a of ACTIONS) o[a] = false;
  return o;
}

export class Input {
  constructor() {
    this.held = blank();
    this.pressed = blank();
    this.released = blank();
    this._prev = blank();
    this._keys = new Set();
    this._touch = blank();
    this.script = null; // when set, replaces all physical input (tests, bots, demo)
    this.usedTouch = false;
    this.lastDevice = 'key'; // 'key' | 'pad' | 'touch': decides which button names prompts show
    this.onFirstGesture = null;
    this._gestured = false;
    this.onHotkey = null; // (name) => void, for 'fullscreen' and 'mute'; set by main.js
    this._autoPause = false;
    this._touchRoot = null;
    this.touchMode = 'auto'; // 'auto' (only on touch devices) | 'on' | 'off'
  }

  /** The window lost focus, the tab was hidden or the pad was unplugged: ask the current scene to pause. */
  requestAutoPause() {
    this._autoPause = true;
  }

  /** True once per request (the Game hands it to the scene). */
  takeAutoPause() {
    const v = this._autoPause;
    this._autoPause = false;
    return v;
  }

  /** Let go of everything that is held (focus lost: the key-up would never arrive). */
  releaseAll() {
    this._keys.clear();
    this._touch = blank();
    if (this._touchRoot && this._touchRoot.querySelectorAll) {
      this._touchRoot.querySelectorAll('.tbtn').forEach((b) => b.classList && b.classList.remove('down'));
    }
  }

  /** Show or hide the on-screen controls: 'auto' follows the device, 'on' always shows them, 'off' never. */
  setTouchMode(mode) {
    this.touchMode = ['auto', 'on', 'off'].includes(mode) ? mode : 'auto';
    const root = this._touchRoot;
    if (!root) return;
    if (this.touchMode === 'off') {
      root.hidden = true;
      this._touch = blank();
    } else {
      root.hidden = this.touchMode === 'auto' ? !this.usedTouch : false;
    }
  }

  // ---- DOM wiring (browser only) ----
  attach(win = globalThis.window, doc = globalThis.document) {
    if (!win) return;
    win.addEventListener('keydown', (e) => {
      this._gesture();
      this.lastDevice = 'key';
      if (PREVENT.has(e.code)) e.preventDefault();
      if (HOTKEYS[e.code] && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.onHotkey) this.onHotkey(HOTKEYS[e.code]);
        return;
      }
      this._keys.add(e.code);
    });
    win.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
    win.addEventListener('blur', () => {
      this.releaseAll();
      this.requestAutoPause();
    });
    if (doc && doc.addEventListener) {
      doc.addEventListener('visibilitychange', () => {
        if (doc.hidden) {
          this.releaseAll();
          this.requestAutoPause();
        }
      });
    }
    win.addEventListener('gamepaddisconnected', () => this.requestAutoPause());
    win.addEventListener('gamepadconnected', () => {
      this._gesture();
      this.lastDevice = 'pad';
    });
    win.addEventListener('pointerdown', () => this._gesture());
    if (doc) this._attachTouch(doc, win);
  }

  _gesture() {
    if (this._gestured) return;
    this._gestured = true;
    if (this.onFirstGesture) this.onFirstGesture();
  }

  _attachTouch(doc, win) {
    const root = doc.getElementById && doc.getElementById('touch');
    if (!root) return;
    this._touchRoot = root;
    const show = () => {
      this.usedTouch = true;
      this.lastDevice = 'touch';
      this.setTouchMode(this.touchMode); // 'auto' now shows them; 'off' keeps them hidden
    };
    const mm = win.matchMedia || globalThis.matchMedia;
    const coarse = mm && mm.call(win, '(pointer: coarse)').matches;
    if (coarse) show();
    win.addEventListener('touchstart', show, { once: true, passive: true });
    root.addEventListener && root.addEventListener('contextmenu', (e) => e.preventDefault());

    // buttons
    root.querySelectorAll('.tbtn').forEach((btn) => {
      const act = btn.dataset.act;
      const down = (e) => {
        e.preventDefault();
        this._touch[act] = true;
        btn.classList.add('down');
      };
      const up = (e) => {
        e.preventDefault();
        this._touch[act] = false;
        btn.classList.remove('down');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    // virtual stick
    const stick = doc.getElementById('stick');
    const knob = doc.getElementById('knob');
    if (!stick) return;
    let activeId = null;
    const apply = (e) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2);
      let dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this._touch.left = dx < -0.35;
      this._touch.right = dx > 0.35;
      this._touch.up = dy < -0.45;
      this._touch.down = dy > 0.45;
      if (knob) knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
    };
    const end = () => {
      activeId = null;
      this._touch.left = this._touch.right = this._touch.up = this._touch.down = false;
      if (knob) knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activeId = e.pointerId;
      stick.setPointerCapture && stick.setPointerCapture(e.pointerId);
      apply(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === activeId) apply(e);
    });
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  // ---- per-frame update ----
  poll() {
    let cur = blank();
    if (this.script) {
      for (const a of ACTIONS) cur[a] = !!this.script[a];
    } else {
      for (const code of this._keys) {
        const a = KEYMAP[code];
        if (a) cur[a] = true;
      }
      for (const a of ACTIONS) if (this._touch[a]) cur[a] = true;
      this._pollGamepad(cur);
    }
    // Menu helpers: jump/fire also confirm, switch also goes back
    const confirmKey = cur.confirm;
    for (const a of ACTIONS) {
      this.pressed[a] = cur[a] && !this._prev[a];
      this.released[a] = !cur[a] && this._prev[a];
    }
    this.held = cur;
    this._prev = { ...cur };
    this.pressed.confirm = this.pressed.confirm || this.pressed.jump || this.pressed.fire;
    this.pressed.back = this.pressed.back || this.pressed.switch;
    this.held.confirm = confirmKey;
    return this;
  }

  _pollGamepad(cur) {
    const pads = globalThis.navigator && globalThis.navigator.getGamepads ? globalThis.navigator.getGamepads() : null;
    if (!pads) return;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const a = padActions(p);
      let used = false;
      for (const k of Object.keys(a)) {
        cur[k] = true;
        if (k !== 'pause' && k !== 'back') used = true;
      }
      if (a.jump || a.fire || a.pause) this._gesture();
      if (used) this.lastDevice = 'pad';
    }
  }

  /** Button name for an action on the device the player is using, e.g. label('jump') -> 'Z'. */
  label(action) {
    return (LABELS[this.lastDevice] || LABELS.key)[action] || action.toUpperCase();
  }

  /** Replace {jump}-style tokens in a prompt with the current device's button names. */
  fill(text) {
    return text.replace(/\{(\w+)\}/g, (_, a) => this.label(a));
  }

  /** Test helper: set scripted held state for the next poll(). */
  setScript(obj) {
    this.script = obj;
  }
}
