// End-to-end smoke tests for the dev tools in the README (`npm run shots`, `themeshots`, `levelshots`, `bossshots`, `musicwav`,
// `perf`, `economy`). Nothing else runs them, so they could rot unnoticed. Each is started as a real child process with the
// smallest arguments that still exercise it, writing into a scratch directory that is removed afterwards, and must exit 0
// and produce a well-formed file. A last test re-renders the browser-parity frames and checks the committed fixture still
// matches the software canvas (`npm run parity` regenerates it).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKS } from '../../src/game/tracks.js';
import { renderSoftFrames, unpackFrames, FIXTURE_PATH } from '../../tools/parity.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scratch = mkdtempSync(join(tmpdir(), 'epoch-tools-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Run `node tools/<script> ...args`; fail with the tool's own output if it does not exit 0. */
function tool(script, ...args) {
  const r = spawnSync(process.execPath, [join(REPO, 'tools', script), ...args], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, `${script} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Every .png in `dir` has the PNG signature and a 480x270 image (times `scale`) in its header. */
function checkPngs(dir, scale = 2) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
  assert.ok(files.length > 0, `no PNGs written to ${dir}`);
  for (const f of files) {
    const b = readFileSync(join(dir, f));
    assert.ok(b.subarray(0, 8).equals(PNG_MAGIC), `${f} is a PNG`);
    assert.equal(b.readUInt32BE(16), 480 * scale, `${f} width`);
    assert.equal(b.readUInt32BE(20), 270 * scale, `${f} height`);
  }
  return files;
}

test('npm run shots writes the UI screenshots as PNGs', () => {
  const dir = join(scratch, 'shots');
  tool('shots.mjs', dir);
  const names = checkPngs(dir);
  for (const want of ['title.png', 'menu.png', 'play.png', 'results.png']) assert.ok(names.includes(want), `${want} was written`);
});

test('npm run themeshots writes one frame for the theme it is asked for and no others', () => {
  const dir = join(scratch, 'themes');
  tool('themeshots.mjs', dir, 'jungle');
  const names = checkPngs(dir);
  assert.deepEqual(names, ['jungle.png']);
});

test('npm run levelshots plays level 1 with the bot and photographs the x position it is given', () => {
  const dir = join(scratch, 'levels');
  tool('levelshots.mjs', '0', dir, '20');
  assert.equal(checkPngs(dir).length, 1);
});

test('npm run bossshots photographs the first boss fight at its key moments', () => {
  const dir = join(scratch, 'bosses');
  tool('bossshots.mjs', '0', dir, '1');
  const names = checkPngs(dir, 1);
  assert.ok(names.every((f) => f.startsWith('boss01_')));
});

test('npm run musicwav writes a valid 16-bit mono WAV for a track and rejects an unknown track', () => {
  const dir = join(scratch, 'audio');
  const id = Object.keys(TRACKS)[0];
  tool('musicwav.mjs', id, dir, '1');
  const b = readFileSync(join(dir, `${id}.wav`));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WAVE');
  assert.equal(b.readUInt16LE(22), 1, 'mono');
  assert.equal(b.readUInt16LE(34), 16, '16-bit');
  assert.ok(b.readUInt32BE(40) === 0 || b.length > 44 + 22050 * 2, 'at least a second of samples');
  const bad = spawnSync(process.execPath, [join(REPO, 'tools/musicwav.mjs'), 'no-such-track', dir], { cwd: REPO, encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /No track "no-such-track"/);
});

test('npm run perf reports sim time and canvas calls for a level and its boss fight', () => {
  const out = tool('perf.mjs', '0', '4'); // 4 s of play and a 4 s boss fight instead of 30 s and 90 s
  assert.match(out, /sim avg [\d.]+ ms/);
  assert.match(out, /canvas calls avg \d+ peak \d+/);
  assert.match(out, /boss fights/);
});

test('npm run economy prints the supply table and both player models', () => {
  const out = tool('economy.mjs');
  assert.match(out, /total medals \d+/);
  assert.match(out, /break-even: the supply pays for [\d.]+ deaths/);
  assert.match(out, /entering level 13: [\d.]+/);
});

test('the browser-parity fixture still matches the frames the software canvas renders', async () => {
  assert.ok(existsSync(FIXTURE_PATH), 'run `npm run parity` to create the fixture');
  const want = unpackFrames(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')));
  const got = await renderSoftFrames();
  assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort(), 'the same frames');
  for (const name of Object.keys(want)) {
    assert.ok(Buffer.from(got[name]).equals(Buffer.from(want[name])), `${name} drifted from the fixture; run \`npm run parity\``);
  }
});
