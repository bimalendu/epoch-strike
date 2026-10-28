// Tiny PNG encoder (RGBA, 8-bit) using Node's built-in zlib. Used for screenshots in docs/.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** canvas: { width, height, data: Uint8ClampedArray(RGBA) }. scale: integer nearest-neighbour upscale. */
export function encodePNG(canvas, scale = 1) {
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    const sy = Math.floor(y / scale);
    for (let x = 0; x < w; x++) {
      const si = (sy * canvas.width + Math.floor(x / scale)) * 4;
      const a = canvas.data[si + 3] / 255;
      // composite over black so transparent areas are visible but neutral
      raw[o++] = Math.round(canvas.data[si] * a);
      raw[o++] = Math.round(canvas.data[si + 1] * a);
      raw[o++] = Math.round(canvas.data[si + 2] * a);
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
