// The boss rush of Level 20: the Rift has dragged shadows of three old guardians into the Warlord's citadel. An ECHO is the
// same boss (same attacks, same weak point, same art) with a fraction of the health: the arena descriptor (levelgen
// echoArena) sets how much. Echoes live in their own registry, apart from BOSSES, because the boss rules (a minimum of 40 hit
// points, a kill-time check on a full level) are for real bosses.

import { trex } from './trex.js';
import { colossus } from './colossus.js';
import { supertank } from './supertank.js';

function echoOf(def, name) {
  return { ...def, id: `echo_${def.id}`, name: `ECHO: ${name}`, score: Math.round(def.score * 0.5), isEcho: true };
}

export const ECHOES = {
  echo_trex: echoOf(trex, 'REX-7'),
  echo_colossus: echoOf(colossus, 'BRONZE COLOSSUS'),
  echo_supertank: echoOf(supertank, 'SUPER-HEAVY TANK'),
};
