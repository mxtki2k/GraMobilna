// Testy sprite'ów pixel art. Uruchomienie: node tests/pixel.test.js
const assert = require('assert');
const Pix = require('../prototypes/janusz/pixel.js');
const E = require('../prototypes/janusz/ekipa.js');
const A = require('../prototypes/janusz/alledrogo.js');
const { CLIENTS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const names = Object.keys(Pix.SPRITES);

t('każdy sprite ma 16x16 pikseli i używa tylko kolorów z palety', () => {
  for (const nm of names) {
    const g = Pix.get(nm);
    assert(g.length === 16 && g.every(r => r.length === 16), nm);
    for (const row of g) for (const c of row) assert(c === '.' || Pix.PAL[c], nm + ' nieznany kolor ' + c);
  }
});

t('sprite\'y są niepuste, mają kontur i nie dotykają krawędzi w dziwny sposób', () => {
  for (const nm of names) {
    const flat = Pix.get(nm).flat(); const filled = flat.filter(c => c !== '.').length;
    assert(filled >= 30 && filled <= 240, nm + ' pikseli: ' + filled);
    assert(flat.indexOf('k') >= 0, nm + ' bez konturu');
  }
});

t('kontur dodaje się wokół kształtu, a pusta siatka zostaje pusta', () => {
  const g = Pix.grid(5, 5); Pix.rect(g, 'y', 2, 2, 1, 1); Pix.outline(g);
  assert.strictEqual(g[1][2], 'k'); assert.strictEqual(g[3][2], 'k'); assert.strictEqual(g[2][1], 'k'); assert.strictEqual(g[2][3], 'k'); assert.strictEqual(g[2][2], 'y'); assert.strictEqual(g[0][0], '.');
  const empty = Pix.grid(4, 4); Pix.outline(empty); assert(empty.flat().every(c => c === '.'));
});

t('renderowanie: skala powiększa piksele bez rozmywania, przezroczystość zachowana', () => {
  const g = Pix.get('i_coin'), a = Pix.rgba(g, 1), b = Pix.rgba(g, 4);
  assert(a.w === 16 && a.h === 16 && b.w === 64 && b.h === 64);
  for (const [x, y] of [[5, 5], [8, 8], [0, 0], [15, 15], [3, 12]]) for (let k = 0; k < 4; k++)
    assert.strictEqual(b.data[((y * 4 + 2) * 64 + x * 4 + 1) * 4 + k], a.data[(y * 16 + x) * 4 + k]);
  assert.strictEqual(a.data[3], 0);
});

t('portrety: jest postać dla każdego klienta i pracownika, a ich awatary w danych wskazują istniejące portrety', () => {
  for (const c of Object.values(CLIENTS)) { assert(c.em[0] === '@' && Pix.PORTRAITS[c.em.slice(1)], 'klient ' + c.id + ' ' + c.em); }
  for (const c of E.CANDIDATES) { assert(c.em[0] === '@' && Pix.PORTRAITS[c.em.slice(1)], 'pracownik ' + c.id + ' ' + c.em); }
  assert(Pix.PORTRAITS.bogdan && Pix.PORTRAITS.gienek);
});

t('portrety różnią się od siebie (każda postać rozpoznawalna)', () => {
  const sigs = Object.keys(Pix.PORTRAITS).map(k => Pix.get('p_' + k).map(r => r.join('')).join('/'));
  assert.strictEqual(new Set(sigs).size, sigs.length);
});

t('wszystkie narzędzia z Alledrogo mają ikonę', () => {
  for (const id of Object.keys(A.TYPES)) assert(Pix.SPRITES['i_' + id], 'brak ikony ' + id);
});

t('mapa emoji wskazuje istniejące sprite\'y, a emoji nastrojów z ekipy są pokryte', () => {
  for (const [emo, nm] of Object.entries(Pix.EMOJI)) assert(Pix.SPRITES['i_' + nm] || Pix.SPRITES['p_' + nm], emo + ' -> ' + nm);
  for (const mood of [95, 70, 50, 30, 5]) assert(Pix.EMOJI[E.moodEmoji(mood)], 'nastrój ' + mood + ' ' + E.moodEmoji(mood));
});

t('paleta scen zawiera kolory do pikselizacji rysunków (bez duplikatów)', () => {
  assert(Pix.SCENE_EXTRA.length >= 20 && new Set(Pix.SCENE_EXTRA).size === Pix.SCENE_EXTRA.length);
  assert(Pix.SCENE_EXTRA.every(c => /^#[0-9a-f]{6}$/i.test(c)));
});

console.log('\n' + n + ' testów przeszło');
