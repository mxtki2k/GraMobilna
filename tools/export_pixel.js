#!/usr/bin/env node
// Eksportuje sprite'y z prototypes/janusz/pixel.js do plików PNG (do Godota i podglądu).
// Użycie: node tools/export_pixel.js [katalog_wyjściowy]   (domyślnie assets/pixel)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const Pix = require('../prototypes/janusz/pixel.js');
const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'pixel');
fs.mkdirSync(out, { recursive: true });

const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const names = Object.keys(Pix.SPRITES);
for (const n of names) {
  const g = Pix.get(n), im1 = Pix.rgba(g, 1), im4 = Pix.rgba(g, 4);
  fs.writeFileSync(path.join(out, n + '.png'), png(im1.w, im1.h, im1.data));
  fs.writeFileSync(path.join(out, n + '@4x.png'), png(im4.w, im4.h, im4.data));
}
// arkusz podglądowy: wszystkie sprite'y w siatce, 4x, na szarym tle
const cols = 8, S = 4, cell = 16 * S + 8, rows = Math.ceil(names.length / cols), W = cols * cell + 8, H = rows * cell + 8;
const sheet = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < sheet.length; i += 4) { sheet[i] = 60; sheet[i + 1] = 66; sheet[i + 2] = 74; sheet[i + 3] = 255; }
names.forEach((n, idx) => {
  const im = Pix.rgba(Pix.get(n), S), ox = 8 + (idx % cols) * cell, oy = 8 + Math.floor(idx / cols) * cell;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const si = (y * im.w + x) * 4, di = ((oy + y) * W + ox + x) * 4; if (im.data[si + 3]) { sheet[di] = im.data[si]; sheet[di + 1] = im.data[si + 1]; sheet[di + 2] = im.data[si + 2]; } }
});
fs.writeFileSync(path.join(out, '_sheet.png'), png(W, H, sheet));
console.log('zapisano ' + names.length + ' sprite\'ów (1x i 4x) oraz _sheet.png w ' + out);
console.log(names.join(', '));
