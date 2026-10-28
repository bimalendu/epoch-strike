// Music without files. A track is plain data (tempo, key, scale and a few bars of pattern per voice);
// `trackBar()` turns one bar of it into note events, and the same events drive both the live Web Audio
// scheduler (audio.js) and the offline renderer below (tests, `npm run wav`). No DOM, no Web Audio in here.
//
// Time is counted in 16th-note steps, 16 to a bar. Pattern strings use one space-separated token per step:
//   lead / arp / harmony:  a number = scale degree (0 = the key's root, 7 = an octave up, -1 = the note below the root),
//                          '.' = rest, '-' = hold the previous note
//   drums:                 'x' = hit, 'X' = accent, '.' = nothing (a string may be written without spaces)
//
//   {
//     name, bpm, root: 50, mode: 'minor',          // root is a MIDI note number
//     chords: [0, 0, 5, 4],                        // scale degree of the chord root for each bar; its length is the loop length
//     lead:    { wave: 'square', duty: 0.25, vol: 0.5, oct: 1, bars: ['0 . 2 ...', ...] },    // bars cycle if fewer than the loop
//     harmony: { ... same shape ... },
//     arp:     { wave, duty, vol, oct, pattern: '0 1 2 3 2 1 ...', tones: [0, 2, 4, 7] },      // indices into the chord tones
//     bass:    { wave: 'tri', vol: 0.7, style: 'eighths' | 'offbeat' | 'octaves' | 'gallop' | 'walk' | 'pedal' | 'pulse' },
//     drums:   { kick: [pattern, ...], snare: [...], hat: [...], ohat: [...] },               // arrays cycle per bar
//     passes:  4,                                  // optional: how many passes the song form plays before it repeats (default 4)
//   }
//
// SONG FORM. The data above is one loop. A song plays it `passes` times, and each pass is arranged differently by pure,
// deterministic rules (see `arrange`): A = the loop as written, B = the lead doubled an octave up in the second half,
// C = a breakdown (no kick, snare or lead in the first half, arps and harmony forward, then a snare-roll build back in),
// D = the finale (lead doubled all the way, harmony and open hats pushed). The last bar of every pass has a drum fill.
// So a 24-second loop becomes a ~100-second song without a single extra line of pattern data.

export const STEPS_PER_BAR = 16;

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], // harmonic minor
  dominant: [0, 1, 4, 5, 7, 8, 10], // phrygian dominant: the "desert" scale
  hirajoshi: [0, 2, 3, 7, 8, 9, 10], // five notes padded to seven: east-asian flavour
  insen: [0, 1, 5, 7, 10, 12, 13], // the dark Japanese pentatonic (shadow castles, ninjas)
  pent: [0, 3, 5, 7, 10, 12, 15], // minor pentatonic
  majpent: [0, 2, 4, 7, 9, 12, 14],
  blues: [0, 3, 5, 6, 7, 10, 12],
};

export function midiFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** MIDI note for a (possibly negative or > 6) scale degree of a track. */
export function degreeMidi(track, degree) {
  const sc = SCALES[track.mode || 'minor'];
  const n = sc.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return track.root + sc[idx] + oct * 12;
}

/** How many bars the data of the track covers (one pass of the song). */
export function trackBars(track) {
  return track.chords.length;
}

export const DEFAULT_PASSES = 4;

/** How many differently-arranged passes the song plays before it repeats. */
export function trackPasses(track) {
  return Math.max(1, Math.min(4, track.passes || DEFAULT_PASSES));
}

/** Bars in the whole song form (what the scheduler and the renderer loop over). */
export function songBars(track) {
  return trackBars(track) * trackPasses(track);
}

/** Seconds in the whole song form. */
export function songSeconds(track) {
  return songBars(track) * STEPS_PER_BAR * stepSeconds(track);
}

/** Seconds per 16th step. */
export function stepSeconds(track) {
  return 60 / track.bpm / 4;
}

export function loopSeconds(track) {
  return trackBars(track) * STEPS_PER_BAR * stepSeconds(track);
}

const tokenCache = new Map();

/** Split a pattern into exactly 16 tokens (throws on a wrong length: the tests catch typos early). */
export function parsePattern(str) {
  let t = tokenCache.get(str);
  if (t) return t;
  const raw = str.replace(/\|/g, ' ');
  t = raw.includes(' ') ? raw.trim().split(/\s+/) : raw.trim().split('');
  if (t.length !== STEPS_PER_BAR) throw new Error(`pattern needs ${STEPS_PER_BAR} steps, has ${t.length}: "${str}"`);
  tokenCache.set(str, t);
  return t;
}

/** Notes of a melodic line for one bar: [{ step, len, degree }]. Holds ('-') extend the previous note. */
export function lineNotes(pattern) {
  const toks = parsePattern(pattern);
  const out = [];
  for (let s = 0; s < toks.length; s++) {
    const tk = toks[s];
    if (tk === '.') continue;
    if (tk === '-') {
      if (out.length && out[out.length - 1].step + out[out.length - 1].len === s) out[out.length - 1].len++;
      continue;
    }
    const degree = Number(tk);
    if (!Number.isInteger(degree)) throw new Error(`bad token "${tk}" in "${pattern}"`);
    out.push({ step: s, len: 1, degree });
  }
  return out;
}

function pick(list, bar) {
  return list[bar % list.length];
}

// the bass patterns: [step, length, octaveOffset] for one bar
const BASS = {
  eighths: [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 2, 0]),
  offbeat: [[0, 3, 0], [3, 3, 0], [6, 2, 0], [8, 3, 0], [11, 3, 0], [14, 2, 0]],
  octaves: [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i % 2]),
  gallop: [[0, 2, 0], [2, 1, 0], [3, 1, 0], [4, 2, 0], [6, 1, 0], [7, 1, 0], [8, 2, 0], [10, 1, 0], [11, 1, 0], [12, 2, 0], [14, 1, 0], [15, 1, 0]],
  walk: [[0, 4, 0], [4, 4, 0], [8, 4, 0], [12, 4, 0]], // chord tones are added below
  pedal: [[0, 16, 0]],
  pulse: [[0, 2, 0], [4, 2, 0], [8, 2, 0], [12, 2, 0]],
  half: [[0, 8, 0], [8, 8, 0]],
};
const WALK_TONES = [0, 2, 4, 2]; // scale-degree offsets from the chord root for the 'walk' style

const WAVE_DEFAULTS = {
  lead: { wave: 'square', duty: 0.5, vol: 0.5, oct: 1 },
  harmony: { wave: 'square', duty: 0.25, vol: 0.3, oct: 1 },
  arp: { wave: 'square', duty: 0.125, vol: 0.22, oct: 1, tones: [0, 2, 4, 7] },
  bass: { wave: 'tri', vol: 0.7, style: 'eighths' },
};

/** The loop exactly as written in the data: all events of bar `b` (0 <= b < trackBars). */
function baseBar(track, b) {
  const chord = pick(track.chords, b);
  const out = [];

  for (const voice of ['lead', 'harmony']) {
    const v = track[voice];
    if (!v) continue;
    const d = { ...WAVE_DEFAULTS[voice], ...v };
    const pat = pick(v.bars, b);
    if (!pat) continue;
    for (const n of lineNotes(pat)) {
      out.push({ step: n.step, len: n.len, midi: degreeMidi(track, n.degree) + d.oct * 12, voice, wave: d.wave, duty: d.duty, vol: d.vol });
    }
  }

  if (track.arp) {
    const d = { ...WAVE_DEFAULTS.arp, ...track.arp };
    const pat = pick(Array.isArray(d.pattern) ? d.pattern : [d.pattern], b);
    const toks = parsePattern(pat);
    for (let s = 0; s < toks.length; s++) {
      if (toks[s] === '.') continue;
      const idx = Number(toks[s]);
      const deg = chord + d.tones[idx % d.tones.length];
      out.push({ step: s, len: 1, midi: degreeMidi(track, deg) + d.oct * 12, voice: 'arp', wave: d.wave, duty: d.duty, vol: d.vol });
    }
  }

  if (track.bass) {
    const d = { ...WAVE_DEFAULTS.bass, ...track.bass };
    const style = BASS[d.style];
    if (!style) throw new Error(`unknown bass style ${d.style}`);
    style.forEach(([s, len, up], i) => {
      let deg = chord;
      if (d.style === 'walk') deg = chord + WALK_TONES[i % WALK_TONES.length];
      out.push({ step: s, len, midi: degreeMidi(track, deg) - 12 + up * 12, voice: 'bass', wave: d.wave, duty: 0.5, vol: d.vol });
    });
  }

  if (track.drums) {
    for (const drum of ['kick', 'snare', 'hat', 'ohat']) {
      const lines = track.drums[drum];
      if (!lines) continue;
      const toks = parsePattern(pick(Array.isArray(lines) ? lines : [lines], b));
      toks.forEach((tk, s) => {
        if (tk === '.') return;
        out.push({ step: s, drum, vol: tk === 'X' ? 1 : tk === 'x' ? 0.7 : 0.4 });
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- song form

const clamp01 = (v) => Math.max(0.05, Math.min(1, v));

/** Does this track have a drum kit at all? */
function hasDrums(track) {
  return !!track.drums;
}

/** Replace the snare of steps `from..15` by a roll that swells (or a plain fill when `swell` is false). */
function snareRoll(out, from, swell = true) {
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].drum === 'snare' && out[i].step >= from) out.splice(i, 1);
  }
  for (let s = from; s < STEPS_PER_BAR; s++) {
    const k = (s - from) / Math.max(1, STEPS_PER_BAR - 1 - from);
    out.push({ step: s, drum: 'snare', vol: swell ? clamp01(0.3 + 0.7 * k) : 0.7 });
  }
}

/** The lead line doubled an octave up (quieter), where it still sits in the playable range. */
function doubleLead(out, gain) {
  const add = [];
  for (const ev of out) {
    if (ev.voice !== 'lead' || ev.double) continue;
    if (ev.midi + 12 > 96) continue;
    add.push({ ...ev, midi: ev.midi + 12, vol: clamp01(ev.vol * gain), double: true });
  }
  out.push(...add);
}

/**
 * Arrange one bar of the loop for a pass of the song. `inBar` counts within the loop, `n` is the loop length.
 * Pure: the same inputs always give the same events, and pass 0 is the data exactly as written.
 */
function arrange(track, events, pass, inBar, n) {
  const out = events.map((e) => ({ ...e }));
  const second = inBar >= Math.floor(n / 2);
  const last = inBar === n - 1;
  const drums = hasDrums(track);
  const thin = !track.harmony && !track.arp; // nothing else to carry the breakdown

  if (pass === 1) {
    if (second) doubleLead(out, 0.5);
  } else if (pass === 2) {
    if (!second) {
      // breakdown: the beat drops out, the arps and harmony come forward
      for (let i = out.length - 1; i >= 0; i--) {
        const e = out[i];
        if (e.drum === 'kick' || e.drum === 'snare' || e.drum === 'ohat') out.splice(i, 1);
        else if (e.voice === 'lead') {
          if (thin) e.vol = clamp01(e.vol * 0.55);
          else out.splice(i, 1);
        } else if (e.voice === 'harmony') e.vol = clamp01(e.vol * 1.25);
        else if (e.voice === 'arp') e.vol = clamp01(e.vol * 1.4);
      }
    } else if (last && drums) {
      snareRoll(out, 4, true); // the build back into the finale
    }
  } else if (pass === 3) {
    doubleLead(out, 0.45);
    for (const e of out) if (e.voice === 'harmony') e.vol = clamp01(e.vol * 1.2);
    if (drums && !out.some((e) => e.drum === 'ohat' && e.step === 6)) out.push({ step: 6, drum: 'ohat', vol: 0.4 });
  }

  // every pass ends with a drum fill (the build in pass 2 and the roll in pass 3 are bigger)
  if (last && drums) {
    if (pass === 3) snareRoll(out, 8, true);
    else if (pass !== 2) snareRoll(out, 12, false);
  }
  return out;
}

/**
 * All events of one bar of the song (`bar` counts from the start of the song and wraps at songBars). Melodic events:
 * { step, len, midi, voice, wave, duty, vol }. Drum events: { step, drum: 'kick' | 'snare' | 'hat' | 'ohat', vol }.
 * `step` is relative to the start of the bar.
 */
export function trackBar(track, bar) {
  const total = songBars(track);
  const b = ((bar % total) + total) % total;
  const n = trackBars(track);
  const pass = Math.floor(b / n);
  const inBar = b % n;
  const events = baseBar(track, inBar);
  return arrange(track, events, pass, inBar, n);
}

// ---------------------------------------------------------------- offline rendering

const DRUM_SOUNDS = {
  kick: { wave: 'sine', f0: 170, f1: 42, dur: 0.17, vol: 0.9, curve: 0.45 },
  snare: { wave: 'noise', f0: 5200, f1: 1800, dur: 0.14, vol: 0.5, decay: 'exp' },
  hat: { wave: 'noise', f0: 9000, f1: 9000, dur: 0.035, vol: 0.28 },
  ohat: { wave: 'noise', f0: 8000, f1: 7000, dur: 0.16, vol: 0.26, decay: 'exp' },
};
export { DRUM_SOUNDS };

function pulseSample(phase, duty) {
  return phase < duty ? 1 : -1;
}

function waveSample(wave, phase, duty) {
  switch (wave) {
    case 'square': return pulseSample(phase, duty);
    case 'saw': return phase * 2 - 1;
    case 'tri': return Math.abs(phase * 4 - 2) - 1;
    default: return Math.sin(phase * Math.PI * 2);
  }
}

/** Note envelope shared by the live and offline synths: quick attack, short decay to a sustain, release at the end. */
export function noteGain(t, dur) {
  const a = Math.min(1, t / 0.005);
  const sustain = 0.7 + 0.3 * Math.exp(-t * 14);
  const rel = Math.max(0, Math.min(1, (dur - t) / 0.03));
  return a * sustain * rel;
}

/**
 * Render a track to mono PCM. `loops` repeats the whole song form (or just the one-pass loop with `song: false`).
 * Pure and deterministic (noise uses a fixed LCG).
 */
export function renderTrack(track, { loops = 1, sampleRate = 22050, master = 0.5, song = true } = {}) {
  const bars = (song ? songBars(track) : trackBars(track)) * loops;
  const stepSec = stepSeconds(track);
  const total = Math.ceil(bars * STEPS_PER_BAR * stepSec * sampleRate) + sampleRate; // + tail
  const out = new Float32Array(total);
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 * 2 - 1;
  };
  for (let bar = 0; bar < bars; bar++) {
    for (const ev of trackBar(track, bar)) {
      const start = Math.round((bar * STEPS_PER_BAR + ev.step) * stepSec * sampleRate);
      if (ev.drum) {
        const d = DRUM_SOUNDS[ev.drum];
        const n = Math.floor(d.dur * sampleRate);
        let phase = 0;
        let nv = 0;
        let np = 0;
        for (let i = 0; i < n && start + i < total; i++) {
          const k = i / n;
          const f = d.f0 + (d.f1 - d.f0) * Math.pow(k, d.curve || 1);
          let s;
          if (d.wave === 'noise') {
            np += f / sampleRate;
            if (np >= 1) { np -= Math.floor(np); nv = rnd(); }
            s = nv;
          } else {
            phase += f / sampleRate;
            s = Math.sin(phase * Math.PI * 2);
          }
          const env = d.decay === 'exp' ? Math.pow(1 - k, 2.2) : 1 - k;
          out[start + i] += s * env * d.vol * ev.vol * master;
        }
        continue;
      }
      const dur = ev.len * stepSec * 0.96;
      const n = Math.floor(dur * sampleRate);
      const f = midiFreq(ev.midi);
      let phase = 0;
      for (let i = 0; i < n && start + i < total; i++) {
        phase += f / sampleRate;
        phase -= Math.floor(phase);
        out[start + i] += waveSample(ev.wave, phase, ev.duty) * noteGain(i / sampleRate, dur) * ev.vol * 0.35 * master;
      }
    }
  }
  return out;
}
