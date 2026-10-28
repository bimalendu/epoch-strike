// The "reduced flashes" option as the art sees it. `renderWorld` sets the mode from the world at the start of every frame;
// painters ask it how fast a blink may run. Art only: the simulation never reads it.

const MAX_STEPS = 6; // blink steps a second when reduced: three on-off cycles, the usual photosensitivity limit
let reduced = false;

export function setReducedFlashes(on) {
  reduced = !!on;
}

export function reducedFlashes() {
  return reduced;
}

/** `Math.floor(t * rate)`, the step counter of a blink; when flashes are reduced the rate is capped at 6 steps a second. */
export function flick(t, rate) {
  return Math.floor(t * (reduced ? Math.min(rate, MAX_STEPS) : rate));
}
