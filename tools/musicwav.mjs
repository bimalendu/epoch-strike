// Export a track as a WAV file so it can be listened to: `node tools/musicwav.mjs <track|all> [outDir] [loops]  (one loop = the whole 4-pass song form)`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRACKS } from '../src/game/tracks.js';
import { renderTrack, songSeconds } from '../src/engine/music.js';
import { encodeWav } from './wav.js';

const [, , which = 'all', outDir = 'docs/audio', loops = '1'] = process.argv;
const ids = which === 'all' ? Object.keys(TRACKS) : [which];
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const t = TRACKS[id];
  if (!t) throw new Error(`No track "${id}". Tracks: ${Object.keys(TRACKS).join(', ')}`);
  const pcm = renderTrack(t, { loops: Number(loops) });
  const file = resolve(outDir, `${id}.wav`);
  writeFileSync(file, encodeWav(pcm));
  console.log(`${id}: ${songSeconds(t).toFixed(1)} s per song -> ${file}`);
}
