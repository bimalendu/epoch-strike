// Unit tests for src/engine/font.js: textWidth arithmetic, left/centre/right alignment measured against the pixels
// actually drawn on the software canvas, case folding and the '?' fallback for unknown characters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { textWidth, drawText, ADVANCE, GLYPH_W, GLYPH_H } from '../../src/engine/font.js';

const W = 200;
const H = 40;
const blank = () => new SoftCanvas(W, H);

/** Bounding box { x0, x1, y0, y1 } (inclusive) of every opaque pixel, or null when nothing was drawn. */
function extent(canvas) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

const draw = (text, x, y, scale, align, shadow) => {
  const c = blank();
  drawText(c.getContext('2d'), text, x, y, '#ffffff', scale, align, shadow);
  return c;
};

test('textWidth of an empty string is 0', () => {
  assert.equal(textWidth(''), 0);
  assert.equal(textWidth('', 3), 0);
});

test('textWidth is advance per character minus the trailing gap', () => {
  assert.equal(textWidth('A'), GLYPH_W);
  assert.equal(textWidth('AB'), ADVANCE * 2 - 1);
  assert.equal(textWidth('HELLO'), ADVANCE * 5 - 1);
});

test('textWidth scales linearly with scale', () => {
  assert.equal(textWidth('HELLO', 2), textWidth('HELLO') * 2);
  assert.equal(textWidth('HELLO', 3), textWidth('HELLO') * 3);
});

test('textWidth accepts numbers by counting their digits', () => {
  assert.equal(textWidth(1234), textWidth('1234'));
  assert.equal(textWidth(0), textWidth('0'));
});

test('textWidth is measured after upper-casing, as drawText does', () => {
  // 'ß' upper-cases to 'SS', so it occupies two cells
  assert.equal(textWidth('ß'), textWidth('SS'));
});

test('left-aligned text starts at x and spans exactly textWidth pixels', () => {
  const e = extent(draw('HH', 20, 5, 1, 'left'));
  assert.equal(e.x0, 20);
  assert.equal(e.x1 - e.x0 + 1, textWidth('HH'));
});

test('left-aligned text spans textWidth at larger scales too', () => {
  const e = extent(draw('HH', 20, 5, 3, 'left'));
  assert.equal(e.x0, 20);
  assert.equal(e.x1 - e.x0 + 1, textWidth('HH', 3));
  assert.equal(e.y1 - e.y0 + 1, GLYPH_H * 3);
});

test('right-aligned text ends at x', () => {
  const e = extent(draw('HH', 100, 5, 1, 'right'));
  assert.equal(e.x1, 100 - 1);
  assert.equal(e.x1 - e.x0 + 1, textWidth('HH'));
});

test('centre-aligned text is centred on x within one pixel', () => {
  for (const text of ['H', 'HH', 'HHH', 'HHHH']) {
    const e = extent(draw(text, 100, 5, 1, 'center'));
    const mid = (e.x0 + e.x1 + 1) / 2;
    assert.ok(Math.abs(mid - 100) <= 1, `${text}: centre ${mid}`);
    assert.equal(e.x1 - e.x0 + 1, textWidth(text));
  }
});

test('drawn text is vertically 7 pixels tall at the given y', () => {
  const e = extent(draw('H', 10, 8, 1, 'left'));
  assert.equal(e.y0, 8);
  assert.equal(e.y1, 8 + GLYPH_H - 1);
});

test('lower-case draws identically to upper-case', () => {
  assert.deepEqual(draw('hello', 4, 4, 1).data, draw('HELLO', 4, 4, 1).data);
});

test('an unknown character draws as the question mark glyph', () => {
  assert.deepEqual(draw('~', 4, 4, 1).data, draw('?', 4, 4, 1).data);
  assert.deepEqual(draw('中', 4, 4, 1).data, draw('?', 4, 4, 1).data);
});

test('a space draws nothing', () => {
  assert.equal(extent(draw('   ', 4, 4, 1)), null);
});

test('a shadow adds pixels one scale step down and right of the text', () => {
  const plain = extent(draw('HH', 20, 5, 2, 'left'));
  const shaded = extent(draw('HH', 20, 5, 2, 'left', '#000000'));
  assert.equal(shaded.x0, plain.x0);
  assert.equal(shaded.x1, plain.x1 + 2);
  assert.equal(shaded.y1, plain.y1 + 2);
});

test('numbers draw like their string form', () => {
  assert.deepEqual(draw(305, 4, 4, 1).data, draw('305', 4, 4, 1).data);
});
