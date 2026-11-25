#!/usr/bin/env node
// Eksportuje sprite'y z prototypes/janusz/pixel.js do plików PNG (do Godota i podglądu).
// Użycie: node tools/export_pixel.js [katalog_wyjściowy]   (domyślnie assets/pixel)
const fs = require('fs'), path = require('path');
const Pix = require('../prototypes/janusz/pixel.js');
const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'pixel');
fs.mkdirSync(out, { recursive: true });

const { png } = require('./png.js');

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
// sceny: wybrane stany każdej sceny (1x i 4x) do katalogu scenes/
const Scenes = require('../prototypes/janusz/scenes.js');
const scenesDir = path.join(out, 'scenes'); fs.mkdirSync(scenesDir, { recursive: true });
const BASE = { okna: 0, drzwi: 0, dach: 0, ogrz: 0, szyld: 0, alarm: 0, kamery: 0, ochrona: 0 };
const maxed = { okna: 3, drzwi: 3, dach: 3, ogrz: 3, szyld: 3, alarm: 3, kamery: 3, ochrona: 3 };
const sceneStates = {
  kran_uszkodzony: () => Scenes.job('kran', ['broken']), kran_naprawiony: () => Scenes.job('kran', ['woda-off', 'seal-new', 'fit-ok', 'tested']),
  kran_powodz: () => Scenes.job('kran', ['broken', 'flood']), kran_fuszerka: () => Scenes.job('kran', ['woda-off', 'tape', 'glue']),
  sciana_dziura: () => Scenes.job('sciana', ['broken']), sciana_naprawiona: () => Scenes.job('sciana', ['plaster-good', 'paint-full']),
  sciana_piana: () => Scenes.job('sciana', ['foam']), sciana_szafa: () => Scenes.job('sciana', ['plaster-good', 'wardrobe']),
  gniazdko_iskrzy: () => Scenes.job('gniazdko', ['broken']), gniazdko_naprawione: () => Scenes.job('gniazdko', ['outlet-new', 'prad-off', 'tested']),
  gniazdko_na_klej: () => Scenes.job('gniazdko', ['outlet-glue', 'cable-twist']),
  polka_krzywa: () => Scenes.job('polka', ['broken']), polka_rowna: () => Scenes.job('polka', ['shelf-on', 'level-good', 'load-ok']),
  polka_przeciazona: () => Scenes.job('polka', ['shelf-on', 'level-bad', 'load-heavy', 'book']),
};
for (let t = 0; t <= 5; t++) sceneStates['siedziba_lokal' + t] = () => Scenes.hq({ tier: t, up: BASE, assets: { bus: Math.min(3, t) }, season: ['wiosna', 'lato', 'jesień', 'zima', 'wiosna', 'lato'][t] });
sceneStates.siedziba_pelna = () => Scenes.hq({ tier: 5, up: maxed, assets: { bus: 3 }, season: 'lato', tools: 1 });
for (const [name, fn] of Object.entries(sceneStates)) {
  const g = fn(), a = Pix.rgba(g, 1), b = Pix.rgba(g, 4);
  fs.writeFileSync(path.join(scenesDir, name + '.png'), png(a.w, a.h, a.data)); fs.writeFileSync(path.join(scenesDir, name + '@4x.png'), png(b.w, b.h, b.data));
}
console.log('zapisano ' + Object.keys(sceneStates).length + ' scen (1x i 4x) w ' + scenesDir);
console.log('zapisano ' + names.length + ' sprite\'ów (1x i 4x) oraz _sheet.png w ' + out);
console.log(names.join(', '));
