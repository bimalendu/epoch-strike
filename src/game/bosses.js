// Boss registry. Each boss lives in bosses/<id>.js as a def (see boss.js for the shape); importing this file
// registers them all as enemy defs so spawnEnemy() can create them by id.

import { ENEMY_DEFS } from './enemy_defs.js';
import './boss.js'; // installs ARCH.boss
import { trex } from './bosses/trex.js';
import { golem } from './bosses/golem.js';
import { mammoth } from './bosses/mammoth.js';
import { bear } from './bosses/bear.js';
import { sphinx } from './bosses/sphinx.js';
import { colossus } from './bosses/colossus.js';
import { champion } from './bosses/champion.js';
import { dragonkite } from './bosses/dragonkite.js';
import { kraken } from './bosses/kraken.js';
import { siegetower } from './bosses/siegetower.js';
import { oni } from './bosses/oni.js';
import { ghostgalleon } from './bosses/ghostgalleon.js';
import { locomotive } from './bosses/locomotive.js';
import { furnace } from './bosses/furnace.js';
import { zeppelin } from './bosses/zeppelin.js';
import { supertank } from './bosses/supertank.js';
import { silomech } from './bosses/silomech.js';
import { gunship } from './bosses/gunship.js';
import { hydra } from './bosses/hydra.js';
import { ECHOES } from './bosses/echoes.js';
import { warlord } from './bosses/warlord.js';
// <<BOSS_IMPORTS>>

export const BOSSES = {
  trex,
  golem,
  mammoth,
  bear,
  sphinx,
  colossus,
  champion,
  dragonkite,
  kraken,
  siegetower,
  oni,
  ghostgalleon,
  locomotive,
  furnace,
  zeppelin,
  supertank,
  silomech,
  gunship,
  hydra,
  warlord,
  // <<BOSSES>> (registry: bosses are added above this line)
};

Object.assign(ENEMY_DEFS, BOSSES, ECHOES);
export { ECHOES };
