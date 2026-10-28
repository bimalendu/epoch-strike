// First-time hints: a one-line tip shown the first time something comes up ("C SWAPS BETWEEN YOUR TWO WEAPONS"), once
// per save. They use the same bottom banner as a level's tutorial prompts and wait until no prompt is showing.
// `{switch}`-style tokens are filled in with the current device's button names by the scene.

export const HINT_TIME = 4; // seconds a hint stays up

/**
 * id: what the save remembers. check(world, event): true when it is time (event is null on a plain frame, so a hint may
 * also watch the world's state).
 */
export const HINTS = [
  { id: 'swap', text: '{switch} SWAPS BETWEEN YOUR TWO WEAPONS', check: (w, e) => e && e.type === 'pickup' && !!w.player.slots[1] },
  { id: 'bomb', text: '{bomb} FIRES A SMART BOMB: IT CLEARS THE SCREEN', check: (w, e) => e && e.type === 'pickup' && e.item === 'bomb' },
  { id: 'medal', text: '10 MEDALS EARN AN EXTRA LIFE', check: (w, e) => e && e.type === 'medal' },
  { id: 'respawn', text: 'YOU RESPAWN ON THE LAST SAFE GROUND', check: (w, e) => e && e.type === 'playerDied' },
  { id: 'tank', text: 'A TANK TAKES FOUR HITS. JUMP IS A HOP', check: (w) => w.player.alive && w.player.mode === 'tank' },
  { id: 'bike', text: 'THE HOVERBIKE FLIES ANYWHERE ON SCREEN', check: (w) => w.player.alive && w.player.mode === 'fly' },
  // <<HINTS>> (registry: new hints are added above this line)
];

export class Hints {
  /** @param {SaveData} save  remembers which hints have been shown */
  constructor(save, list = HINTS) {
    this.save = save;
    this.list = list;
    this.cur = null; // { id, text, t }
    this.queue = [];
  }

  /** Look at one event (or `null` for a plain frame) and queue any hint that has come due. */
  observe(world, event = null) {
    for (const h of this.list) {
      if (this.save.hintSeen(h.id) || this.queue.includes(h) || (this.cur && this.cur.id === h.id)) continue;
      if (h.check(world, event)) this.queue.push(h);
    }
    if (this.queue.length > 2) this.queue.length = 2;
  }

  /** Advance the clock. `blocked` is true while a tutorial prompt, the level card or a pause is in the way. */
  update(dt, blocked) {
    if (this.cur) {
      this.cur.t -= dt;
      if (this.cur.t <= 0) this.cur = null;
    }
    if (!this.cur && !blocked && this.queue.length) {
      const h = this.queue.shift();
      this.cur = { id: h.id, text: h.text, t: HINT_TIME };
      this.save.markHint(h.id); // shown once, even if the level is restarted before it finishes
    }
  }

  /** The text on screen now, or null. */
  get text() {
    return this.cur ? this.cur.text : null;
  }
}
