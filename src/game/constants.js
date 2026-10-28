// Shared numbers. Everything is in logical pixels at the 480x270 base resolution, 60 updates per second.

export const VIEW_W = 480;
export const VIEW_H = 270;
export const TILE = 16;
export const FPS = 60;
export const DT = 1 / FPS;

export const PLAYER = {
  W: 10, // hitbox width
  H: 26, // standing hitbox height
  PRONE_H: 12,
  RUN: 160, // px/s
  JUMP_V: 360, // initial jump speed -> peak ~59px, airtime ~0.65s, reach ~105px
  GRAV: 1100,
  MAX_FALL: 440,
  COYOTE: 0.09,
  BUFFER: 0.1,
  JUMP_CUT: 0.5,
  DROP_TIME: 0.22,
  ICE_K: 3.2, // how quickly velocity chases input on ice (1/s)
  CONVEYOR: 55,
  WATER_SPEED: 0.65,
  WATER_GRAV: 0.55,
  WATER_JUMP: 0.8,
  RESPAWN_INVULN: 2.0,
  QUICK_SPEED: 0.45, // run speed multiplier in quicksand
  QUICK_DROWN: 2.6, // seconds in quicksand before it swallows you
  // wall jumps (only in levels that set `wallJump`: the Shadow Castle): press jump while touching a wall in mid-air
  WALL_JUMP_V: 330, // kick-off speed (about 50 px of rise)
  WALL_KICK: 150, // horizontal speed away from the wall
  WALL_LOCK: 0.17, // seconds the kick keeps its heading before the player steers again
  WALL_SLIDE: 75, // fall speed cap while pressing against a wall
  WALL_COYOTE: 0.08, // a kick still works this long after leaving the wall
};

/** The rideable tank (Level 16): slower and wider than the soldier, with a hit-point buffer and a splash cannon. */
export const TANK = {
  W: 28, // hitbox width
  H: 20,
  HP: 4, // hits it absorbs before the soldier is thrown clear
  RUN: 92, // px/s
  JUMP_V: 255, // a hop, about 30 px
  COOLDOWN: 0.55,
  SHELL_SPEED: 310,
  SHELL_DMG: 4,
  SPLASH_R: 26, // other enemies this close to a hit are caught in the blast
  SPLASH_DMG: 2,
  HIT_INVULN: 1.0, // grace after the tank is hit
  EJECT_INVULN: 1.8, // grace for the soldier thrown out of a wrecked tank
};

/** The hoverbike (Level 19): free flight inside the screen during a 'hover' zone, with two hits of armour. */
export const BIKE = {
  W: 20,
  H: 12,
  SPEED: 118, // px/s in any direction
  ACCEL: 9, // 1/s: how quickly the velocity chases the stick
  HP: 2, // hits it absorbs before the soldier is thrown clear
  HIT_INVULN: 1.0,
  EJECT_INVULN: 1.6,
};

/** Searchlights and the alarm (Level 17). */
export const STEALTH = {
  SPOT_TIME: 0.45, // seconds in the beam before the alarm goes
  RADIUS: 26, // half-width of the lit circle on the ground
  BAND: 46, // the beam lights this many pixels above the ground: a soldier higher up is in the dark
  ALARM_TIME: 6, // seconds the base stays on alert
  COOLDOWN: 10, // seconds before the same alarm can ring again
  WAKE_R: 56, // a sleeping guard wakes when the soldier comes this close
  FIRE_BOOST: 0.6, // extra fraction of reload time that elapses each second while the alarm rings
};

// Longest gap (in tiles) the generator may ask the player to jump, derived from the numbers above.
export const MAX_GAP_TILES = 5; // 80px against ~105px reach
export const MAX_STEP_UP_TILES = 3; // 48px against ~59px peak
export const MAX_QUICKSAND_TILES = 8; // crossing at 45% speed takes under 70% of the time it takes to drown

export const LIVES = {
  START: { easy: 5, normal: 3, hard: 3 },
  MAX: 6,
  CAP_BONUS: 5000,
  FIRST_EXTRA: 20000,
  EXTRA_EVERY: 50000,
  MEDALS_PER_LIFE: 10,
  CONTINUES: 3,
};

/** Most enemies alive at once (the plan's difficulty curve): 6 / 8 / 10 / 12 / 14 for level groups 1-4 ... 17-20. */
export function enemyCapFor(levelIndex) {
  if (levelIndex < 0) return 10; // test level
  return 6 + 2 * Math.min(4, Math.floor(levelIndex / 4));
}

export const DEATH_Y_MARGIN = 48; // fall this far below the map to die

// Difficulty tweaks. bulletMul scales enemy bullet speed; the lives rule (3 start, cap 6) is the same
// everywhere except Easy, which starts with 5 (see LIVES.START).
export const DIFFICULTY = {
  easy: { bulletMul: 0.8, medals: true },
  normal: { bulletMul: 1.0, medals: true },
  hard: { bulletMul: 1.25, medals: false },
};

// Points (from the design plan).
export const SCORE = {
  MEDAL: 500,
  LEVEL_CLEAR_PER_LIFE: 2000,
  NO_DEATH_CLEAR: 5000,
  COMBO_WINDOW: 1.0, // kills within this many seconds chain
  COMBO_STEP: 0.1, // +10% per chained kill ...
  COMBO_MAX: 2.0, // ... up to x2
  DUPLICATE_WEAPON: 500,
};

export const PICKUP_RULES = {
  BARRIER_SECONDS: 10,
  MAX_BOMBS: 3,
  START_BOMBS: 1,
  BOMB_DAMAGE: 12,
};
