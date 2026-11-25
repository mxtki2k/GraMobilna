// Testy scen pixel art. Uruchomienie: node tests/scenes.test.js
const assert = require('assert');
const Pix = require('../prototypes/janusz/pixel.js');
const S = require('../prototypes/janusz/scenes.js');
const { JOBS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const sig = g => g.map(r => r.join('')).join('/');
const diff = (a, b) => { let d = 0; for (let y = 0; y < 80; y++) for (let x = 0; x < 128; x++) if (a[y][x] !== b[y][x]) d++; return d; };
const BASE = { okna: 0, drzwi: 0, dach: 0, ogrz: 0, szyld: 0, alarm: 0, kamery: 0, ochrona: 0 };
const hq = (tier, up, bus, season, tools) => S.hq({ tier, up: Object.assign({}, BASE, up || {}), assets: { bus: bus || 0 }, season: season || 'wiosna', tools: tools || 0 }, 0);
// tokeny bez własnej grafiki (stan ukryty: np. jakość wykonania widać dopiero u klienta)
const NO_VISUAL = new Set(['primer', 'fit-ok', 'fit-force', 'holes-ok', 'holes-bad', 'prad-live', 'untested', 'sand-good', 'sand-light', 'wires-ok', 'level-good']); // level-good to domyślny wygląd półki

t('każda scena ma 128x80 pikseli i używa tylko kolorów z palety', () => {
  const grids = [S.job('kran', ['broken']), S.job('sciana', ['broken']), S.job('gniazdko', ['broken']), S.job('polka', ['broken']), hq(0), hq(5, { okna: 3 }, 3)];
  for (const g of grids) {
    assert(g.length === 80 && g.every(r => r.length === 128));
    for (const row of g) for (const c of row) assert(c !== '.' && Pix.PAL[c], 'zły piksel ' + c);
  }
});

t('sceny są deterministyczne i niezależne od wejściowego zbioru tokenów', () => {
  assert.strictEqual(sig(S.job('kran', ['broken', 'seal-new'], 1)), sig(S.job('kran', new Set(['seal-new', 'broken']), 1)));
  const T = new Set(['broken']); const a = sig(S.job('sciana', T)); T.add('wardrobe'); assert.notStrictEqual(a, sig(S.job('sciana', T)));
});

t('każdy token z opcji napraw ma grafikę (albo jest jawnie na liście „bez grafiki”)', () => {
  const missing = [];
  for (const job of Object.values(JOBS)) {
    const tokens = new Set(); job.steps.forEach(s => s.options.forEach(o => o.fx.split(' ').forEach(x => tokens.add(x))));
    for (const tk of tokens) {
      if (NO_VISUAL.has(tk)) continue;
      const ctxs = [[tk], ['broken', tk], ['shelf-on', tk], ['plaster-good', tk], ['outlet-new', tk], ['broken', 'level-good', tk]];
      if (!ctxs.some(c => sig(S.job(job.id, c)) !== sig(S.job(job.id, c.filter(x => x !== tk))))) missing.push(job.id + ':' + tk);
    }
  }
  assert.deepStrictEqual(missing, [], 'tokeny bez grafiki: ' + missing.join(', '));
});

t('kran: naprawa zmienia scenę, kapanie jest animowane, powódź i wskaźnik wody', () => {
  const broken = S.job('kran', ['broken'], 0), fixed = S.job('kran', ['woda-off', 'seal-new', 'fit-ok', 'tested'], 0);
  assert(diff(broken, fixed) > 60);
  assert(diff(S.job('kran', ['broken'], 0), S.job('kran', ['broken'], 2)) > 4);
  assert.strictEqual(diff(S.job('kran', ['seal-new'], 0), S.job('kran', ['seal-new'], 2)), 0, 'naprawiony kran nie kapie');
  assert(diff(S.job('kran', ['broken', 'flood'], 0), broken) > 600);
});

t('ściana: dziura znika po łacie, różne łaty wyglądają inaczej, szafa zasłania', () => {
  const holes = S.job('sciana', ['broken']), good = S.job('sciana', ['plaster-good']), thick = S.job('sciana', ['plaster-thick']), foam = S.job('sciana', ['foam']);
  assert(diff(holes, good) > 200 && diff(good, thick) > 10 && diff(good, foam) > 100);
  assert(diff(S.job('sciana', ['plaster-good']), S.job('sciana', ['plaster-good', 'paint-full'])) > 1500, 'malowanie zmienia całą ścianę');
  assert(diff(S.job('sciana', ['plaster-good']), S.job('sciana', ['plaster-good', 'wardrobe'])) > 1200);
});

t('gniazdko: iskry animowane tylko przy uszkodzeniu, nowe gniazdko bez iskier', () => {
  assert(diff(S.job('gniazdko', ['broken'], 0), S.job('gniazdko', ['broken'], 1)) > 20);
  assert.strictEqual(diff(S.job('gniazdko', ['outlet-new'], 0), S.job('gniazdko', ['outlet-new'], 1)), 0);
  assert(diff(S.job('gniazdko', ['outlet-new']), S.job('gniazdko', ['outlet-old'])) > 30 && diff(S.job('gniazdko', ['outlet-new']), S.job('gniazdko', ['outlet-glue'])) > 30);
  assert(diff(S.job('gniazdko', ['outlet-new', 'tested'], 0), S.job('gniazdko', ['outlet-new', 'tested'], 1)) > 4, 'para z czajnika');
});

t('półka: krzywa półka kontra trzy poziomy montażu i obciążenie', () => {
  const lv = id => S.job('polka', ['shelf-on', id]);
  assert(diff(S.job('polka', ['broken']), lv('level-good')) > 100);
  assert(diff(lv('level-good'), lv('level-eye')) > 20 && diff(lv('level-eye'), lv('level-bad')) > 20);
  assert(diff(S.job('polka', ['shelf-on', 'level-good', 'load-ok']), S.job('polka', ['shelf-on', 'level-good', 'load-heavy'])) > 100);
  assert(diff(lv('level-eye'), S.job('polka', ['shelf-on', 'level-eye', 'book'])) > 20);
});

t('siedziba: każdy lokal wygląda inaczej', () => {
  const sigs = [0, 1, 2, 3, 4, 5].map(x => sig(hq(x)));
  assert.strictEqual(new Set(sigs).size, 6);
});

t('siedziba: ulepszenia, bus i narzędzia są widoczne na scenie', () => {
  const base = hq(3);
  for (const k of ['okna', 'drzwi', 'dach', 'szyld', 'alarm', 'kamery', 'ochrona']) for (const lvl of [1, 3]) assert(diff(base, hq(3, { [k]: lvl })) > 0, k + ' ' + lvl);
  assert(diff(hq(2), hq(2, { ogrz: 1 })) > 0, 'dym z komina');
  assert(diff(base, hq(3, {}, 2)) > 0 && diff(hq(3, {}, 1), hq(3, {}, 3)) > 40, 'bus');
  assert(diff(base, hq(3, {}, 0, 'wiosna', 1)) > 0, 'narzędzia przy drzwiach');
  assert(diff(hq(3, { okna: 1 }), hq(3, { okna: 3 })) > 40 && diff(hq(3, { dach: 0 }), hq(3, { dach: 3 })) > 100);
});

t('siedziba: pory roku zmieniają wygląd, a chmury i kamery są animowane', () => {
  const seasons = ['wiosna', 'lato', 'jesień', 'zima'].map(s => sig(hq(2, {}, 0, s)));
  assert.strictEqual(new Set(seasons).size, 4);
  assert(diff(S.hq({ tier: 3, up: BASE, assets: { bus: 0 }, season: 'lato' }, 0), S.hq({ tier: 3, up: BASE, assets: { bus: 0 }, season: 'lato' }, 1)) > 0);
  assert(diff(S.hq({ tier: 3, up: Object.assign({}, BASE, { kamery: 2 }), assets: { bus: 0 } }, 0), S.hq({ tier: 3, up: Object.assign({}, BASE, { kamery: 2 }), assets: { bus: 0 } }, 1)) > 0);
});

t('rysowanie siatki do RGBA działa dla scen (rozmiar 128x80, brak przezroczystości)', () => {
  const im = Pix.rgba(S.job('kran', ['broken']), 1);
  assert(im.w === 128 && im.h === 80); for (let i = 3; i < im.data.length; i += 4) assert.strictEqual(im.data[i], 255);
});

console.log('\n' + n + ' testów przeszło');
