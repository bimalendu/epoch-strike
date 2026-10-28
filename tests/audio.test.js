import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX, renderSfx, AudioManager } from '../src/engine/audio.js';

test('every sound effect preset renders finite, non-silent samples within range', () => {
  for (const [name, preset] of Object.entries(SFX)) {
    const data = renderSfx(preset);
    assert.ok(data.length > 100, `${name} has samples`);
    let peak = 0;
    for (const s of data) {
      assert.ok(Number.isFinite(s), `${name} finite`);
      peak = Math.max(peak, Math.abs(s));
    }
    assert.ok(peak > 0.02, `${name} audible (peak ${peak})`);
    assert.ok(peak <= 1.0, `${name} does not clip (peak ${peak})`);
  }
});

test('AudioManager is a safe no-op without Web Audio', () => {
  const a = new AudioManager();
  a.unlock();
  a.sfx('shoot');
  a.setVolumes(0.5, 0.5);
  assert.equal(a.ctx, null);
});
