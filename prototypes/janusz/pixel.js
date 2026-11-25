/* Pixel art: paleta, sprite'y (ikony, narzędzia, portrety) rysowane kodem, wszystko własne.
 * Sprite = siatka znaków (jeden znak = jeden piksel) z palety PAL. Kształty składamy z prostokątów,
 * a kontur (k) dodaje się automatycznie, żeby wszystkie sprite'y miały spójny wygląd.
 * Ten plik działa w przeglądarce (canvas) i w node (eksport PNG, patrz tools/export_pixel.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pix = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PAL = {
    k: '#14171a', d: '#31363d', G: '#5a6068', g: '#a8afb8', w: '#f4f1e8',
    y: '#ffc300', Y: '#b98f00', o: '#f4a259', O: '#a8561b', r: '#e63946', R: '#8a1f2b', m: '#ff8fa3',
    b: '#4f9de0', B: '#1d4f8a', c: '#8ecae6', n: '#6ccf7f', N: '#2e7d32',
    s: '#f1c27d', S: '#c68642', h: '#8a5a2b', H: '#4a2f17', e: '#f6d55c', p: '#b39ddb', P: '#5e35b1', t: '#c98a4b', T: '#6e4520',
    // kolory scen (ściany, kafle, drewno, woda, chrom, tynk)
    '1': '#efe6da', '2': '#d9cbb9', '3': '#bfae9a', '4': '#e8f0f3', '5': '#c4d3da', '6': '#93a7b3',
    '7': '#a9774a', '8': '#7a5232', '9': '#d1a06a', a: '#4fc3f7', A: '#1e88c8', '#': '#eef3f6', '%': '#b4c2cb', '&': '#6f8391',
    '+': '#faf7f2', '=': '#ddd5c9', '-': '#3b2a22', _: '#241812', '~': '#bfe3f5', '^': '#8cc4e6', '$': '#7fb069', '?': '#a9c9a0', '!': '#6e9a5c',
  };
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  // ---------- narzędzia do rysowania ----------
  const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
  function rect(g, c, x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[0].length) g[j][i] = c; }
  /* Kontur 'k' wokół wszystkich nieprzezroczystych pikseli (4 sąsiadów). */
  function outline(g) {
    const H = g.length, W = g[0].length, add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.') {
      if ((y > 0 && g[y - 1][x] !== '.' && g[y - 1][x] !== 'k') || (y < H - 1 && g[y + 1][x] !== '.' && g[y + 1][x] !== 'k') ||
          (x > 0 && g[y][x - 1] !== '.' && g[y][x - 1] !== 'k') || (x < W - 1 && g[y][x + 1] !== '.' && g[y][x + 1] !== 'k')) add.push([x, y]);
    }
    add.forEach(p => { g[p[1]][p[0]] = 'k'; });
    return g;
  }
  /* ops: [kolor, x, y, w, h] albo ['row', x, y, 'tekst'] (piksele z palety). */
  function mk(w, h, ops, noOutline) {
    const g = grid(w, h);
    for (const o of ops) {
      if (o[0] === 'row') { o[3].split('').forEach((c, i) => { if (c !== ' ' && c !== '.') g[o[2]][o[1] + i] = c; }); }
      else rect(g, o[0], o[1], o[2], o[3], o[4]);
    }
    return noOutline ? g : outline(g);
  }
  const R = (c, x, y, w, h) => [c, x, y, w, h];

  // ---------- ikony 16x16 ----------
  const ICONS = {
    coin: () => mk(16, 16, [R('Y', 4, 2, 8, 12), R('Y', 3, 3, 10, 10), R('Y', 2, 5, 12, 6), R('y', 4, 3, 8, 10), R('y', 3, 5, 10, 6), R('e', 5, 4, 2, 2), R('Y', 7, 4, 2, 8), R('Y', 6, 5, 4, 1), R('Y', 6, 7, 4, 1), R('Y', 6, 10, 4, 1)]),
    sun: () => mk(16, 16, [R('y', 5, 5, 6, 6), R('y', 4, 6, 8, 4), R('e', 6, 6, 2, 2), R('Y', 5, 10, 6, 1), R('y', 7, 1, 2, 3), R('y', 7, 12, 2, 3), R('y', 1, 7, 3, 2), R('y', 12, 7, 3, 2), R('y', 3, 3, 2, 2), R('y', 11, 3, 2, 2), R('y', 3, 11, 2, 2), R('y', 11, 11, 2, 2)]),
    moon: () => mk(16, 16, [R('c', 6, 2, 6, 12), R('c', 4, 4, 8, 8), R('c', 3, 6, 4, 4), R('w', 5, 4, 3, 2), R('w', 4, 6, 2, 3), R('B', 9, 5, 4, 8), R('B', 8, 7, 5, 4), R('B', 11, 3, 2, 3)]),
    star: () => mk(16, 16, [R('y', 7, 1, 2, 4), R('y', 6, 4, 4, 3), R('y', 1, 5, 14, 3), R('y', 3, 7, 10, 3), R('y', 4, 9, 8, 3), R('y', 3, 11, 4, 3), R('y', 9, 11, 4, 3), R('Y', 2, 6, 12, 1), R('e', 7, 2, 1, 3), R('e', 5, 6, 2, 1)]),
    crew: () => mk(16, 16, [R('y', 4, 2, 8, 2), R('y', 3, 4, 10, 4), R('y', 2, 7, 12, 1), R('Y', 2, 8, 12, 2), R('w', 5, 3, 2, 1), R('Y', 7, 2, 2, 6), R('s', 4, 10, 8, 4), R('k', 6, 11, 1, 1), R('k', 9, 11, 1, 1), R('S', 7, 13, 2, 1)]),
    hq: () => mk(16, 16, [R('R', 7, 1, 2, 2), R('r', 5, 3, 6, 2), R('r', 3, 5, 10, 2), R('R', 1, 7, 14, 2), R('w', 3, 9, 10, 5), R('c', 4, 10, 3, 3), R('c', 9, 10, 3, 3), R('O', 7, 11, 2, 3), R('y', 8, 12, 1, 1)]),
    fin: () => mk(16, 16, [R('T', 6, 1, 4, 1), R('t', 7, 2, 2, 1), R('t', 5, 3, 6, 1), R('t', 3, 4, 10, 2), R('t', 2, 6, 12, 6), R('t', 3, 12, 10, 2), R('T', 2, 6, 1, 6), R('T', 13, 6, 1, 6), R('T', 3, 12, 10, 1), R('y', 7, 5, 2, 8), R('y', 6, 6, 4, 1), R('y', 6, 9, 4, 1), R('y', 6, 12, 4, 1)]),
    os: () => mk(16, 16, [R('c', 8, 1, 6, 5), R('w', 9, 2, 4, 3), R('c', 8, 6, 2, 1), R('b', 1, 6, 6, 8), R('B', 1, 6, 6, 1), R('y', 2, 8, 1, 2), R('y', 4, 8, 1, 2), R('y', 2, 11, 1, 2), R('y', 4, 11, 1, 2), R('g', 8, 8, 6, 6), R('G', 8, 8, 6, 1), R('w', 9, 10, 1, 2), R('w', 12, 10, 1, 2)]),
    story: () => mk(16, 16, [R('R', 2, 2, 12, 12), R('r', 3, 2, 10, 11), R('w', 4, 3, 8, 9), R('G', 5, 5, 6, 1), R('G', 5, 7, 6, 1), R('G', 5, 9, 4, 1), R('y', 11, 2, 2, 5), R('Y', 11, 6, 2, 1)]),
    shop: () => mk(16, 16, [R('O', 1, 2, 3, 1), R('O', 3, 3, 1, 6), R('o', 4, 4, 10, 5), R('O', 4, 8, 10, 1), R('g', 5, 9, 8, 2), R('G', 3, 9, 3, 1), R('d', 5, 12, 3, 3), R('d', 11, 12, 3, 3), R('g', 6, 13, 1, 1), R('g', 12, 13, 1, 1), R('w', 6, 5, 2, 1), R('y', 9, 5, 4, 3)]),
    claim: () => mk(16, 16, [R('w', 3, 1, 10, 14), R('g', 3, 1, 1, 14), R('G', 5, 3, 6, 1), R('G', 5, 5, 6, 1), R('r', 7, 7, 2, 4), R('r', 7, 12, 2, 2)]),
    boom: () => mk(16, 16, [R('r', 7, 0, 2, 16), R('r', 0, 7, 16, 2), R('r', 2, 2, 12, 12), R('o', 3, 3, 10, 10), R('y', 5, 5, 6, 6), R('w', 7, 7, 2, 2), R('o', 1, 1, 2, 2), R('o', 13, 1, 2, 2), R('o', 1, 13, 2, 2), R('o', 13, 13, 2, 2)]),
    car: () => mk(16, 16, [R('r', 1, 8, 14, 4), R('R', 1, 11, 14, 1), R('r', 4, 5, 8, 3), R('c', 5, 6, 3, 2), R('c', 9, 6, 2, 2), R('d', 3, 11, 3, 3), R('d', 10, 11, 3, 3), R('g', 4, 12, 1, 1), R('g', 11, 12, 1, 1), R('y', 14, 9, 1, 1)]),
    van: () => mk(16, 16, [R('w', 1, 4, 10, 8), R('g', 1, 11, 10, 1), R('w', 11, 6, 4, 6), R('c', 12, 7, 3, 2), R('b', 2, 6, 8, 2), R('d', 3, 11, 3, 3), R('d', 10, 11, 3, 3), R('g', 4, 12, 1, 1), R('g', 11, 12, 1, 1)]),
    police: () => mk(16, 16, [R('B', 3, 7, 10, 7), R('b', 4, 8, 8, 5), R('r', 3, 3, 4, 4), R('c', 9, 3, 4, 4), R('w', 7, 4, 2, 2), R('g', 6, 14, 4, 1)]),
    pkg: () => mk(16, 16, [R('t', 2, 4, 12, 10), R('T', 2, 4, 12, 1), R('T', 7, 4, 2, 10), R('w', 2, 7, 5, 3), R('G', 3, 8, 3, 1), R('T', 2, 13, 12, 1)]),
    spy: () => mk(16, 16, [R('d', 3, 3, 10, 2), R('d', 5, 1, 6, 2), R('G', 2, 5, 12, 1), R('s', 5, 6, 6, 6), R('k', 5, 7, 6, 2), R('w', 6, 8, 1, 1), R('w', 9, 8, 1, 1), R('S', 7, 10, 2, 1), R('d', 4, 12, 8, 3)]),
    bolt: () => mk(16, 16, [R('y', 8, 1, 4, 3), R('y', 6, 4, 5, 3), R('y', 4, 7, 7, 2), R('y', 7, 8, 3, 3), R('y', 5, 10, 4, 3), R('y', 4, 12, 2, 2), R('Y', 8, 3, 1, 3), R('Y', 6, 6, 1, 3)]),
    warn: () => mk(16, 16, [R('y', 7, 2, 2, 2), R('y', 6, 4, 4, 2), R('y', 5, 6, 6, 2), R('y', 4, 8, 8, 2), R('y', 3, 10, 10, 2), R('y', 2, 12, 12, 2), R('k', 7, 5, 2, 4), R('k', 7, 10, 2, 2)]),
    check: () => mk(16, 16, [R('N', 2, 8, 3, 3), R('N', 4, 10, 3, 3), R('N', 6, 8, 3, 3), R('N', 8, 6, 3, 3), R('N', 10, 4, 3, 3), R('n', 3, 8, 2, 2), R('n', 5, 10, 2, 2), R('n', 7, 8, 2, 2), R('n', 9, 6, 2, 2), R('n', 11, 4, 2, 2)]),
    hurt: () => mk(16, 16, [R('r', 2, 3, 5, 4), R('r', 9, 3, 5, 4), R('r', 1, 5, 14, 3), R('r', 2, 8, 12, 2), R('r', 4, 10, 8, 2), R('r', 6, 12, 4, 1), R('m', 3, 4, 2, 1), R('R', 8, 4, 1, 8)]),
    target: () => mk(16, 16, [R('r', 4, 2, 8, 12), R('r', 2, 4, 12, 8), R('w', 5, 4, 6, 8), R('w', 4, 5, 8, 6), R('r', 6, 5, 4, 6), R('r', 5, 6, 6, 4), R('w', 7, 7, 2, 2)]),
    clock: () => mk(16, 16, [R('w', 4, 2, 8, 12), R('w', 2, 4, 12, 8), R('g', 4, 12, 8, 2), R('k', 7, 4, 2, 5), R('k', 7, 8, 4, 1), R('r', 7, 1, 2, 1)]),
    mood4: () => mk(16, 16, [R('y', 4, 2, 8, 12), R('y', 3, 3, 10, 10), R('y', 2, 5, 12, 6), R('Y', 4, 13, 8, 1), R('k', 5, 6, 2, 2), R('k', 9, 6, 2, 2), R('k', 5, 10, 6, 1), R('r', 6, 11, 4, 2)]),
    mood3: () => mk(16, 16, [R('y', 4, 2, 8, 12), R('y', 3, 3, 10, 10), R('y', 2, 5, 12, 6), R('Y', 4, 13, 8, 1), R('k', 5, 6, 2, 2), R('k', 9, 6, 2, 2), R('k', 5, 10, 1, 1), R('k', 6, 11, 4, 1), R('k', 10, 10, 1, 1)]),
    mood2: () => mk(16, 16, [R('y', 4, 2, 8, 12), R('y', 3, 3, 10, 10), R('y', 2, 5, 12, 6), R('Y', 4, 13, 8, 1), R('k', 5, 6, 2, 2), R('k', 9, 6, 2, 2), R('k', 5, 11, 6, 1)]),
    mood1: () => mk(16, 16, [R('o', 4, 2, 8, 12), R('o', 3, 3, 10, 10), R('o', 2, 5, 12, 6), R('O', 4, 13, 8, 1), R('k', 4, 4, 3, 1), R('k', 9, 4, 3, 1), R('k', 5, 6, 2, 2), R('k', 9, 6, 2, 2), R('k', 6, 11, 4, 1), R('k', 5, 12, 1, 1), R('k', 10, 12, 1, 1)]),
    mood0: () => mk(16, 16, [R('r', 4, 2, 8, 12), R('r', 3, 3, 10, 10), R('r', 2, 5, 12, 6), R('R', 4, 13, 8, 1), R('k', 4, 4, 3, 1), R('k', 9, 4, 3, 1), R('w', 5, 6, 2, 2), R('w', 9, 6, 2, 2), R('k', 6, 7, 1, 1), R('k', 9, 7, 1, 1), R('k', 5, 10, 6, 1), R('w', 6, 10, 1, 1), R('w', 8, 10, 1, 1), R('k', 5, 11, 6, 1)]),
    lock: () => mk(16, 16, [R('G', 5, 2, 6, 2), R('G', 4, 4, 2, 4), R('G', 10, 4, 2, 4), R('y', 3, 7, 10, 7), R('Y', 3, 13, 10, 1), R('k', 7, 9, 2, 3)]),
    // narzędzia
    zestaw: () => mk(16, 16, [R('G', 6, 2, 4, 1), R('G', 5, 3, 1, 2), R('G', 10, 3, 1, 2), R('r', 2, 5, 12, 8), R('R', 2, 11, 12, 2), R('d', 2, 8, 12, 1), R('y', 7, 7, 2, 3), R('g', 3, 6, 2, 1)]),
    wiertarka: () => mk(16, 16, [R('y', 2, 3, 9, 4), R('Y', 2, 6, 9, 1), R('d', 11, 4, 2, 2), R('g', 13, 5, 2, 1), R('y', 4, 7, 3, 7), R('Y', 4, 12, 3, 2), R('G', 8, 7, 2, 2), R('w', 3, 4, 3, 1)]),
    poziomica: () => mk(16, 16, [R('y', 1, 5, 14, 6), R('Y', 1, 10, 14, 1), R('c', 5, 6, 6, 3), R('w', 6, 6, 1, 1), R('n', 7, 7, 2, 1), R('k', 5, 6, 1, 3), R('k', 10, 6, 1, 3), R('G', 2, 7, 1, 2), R('G', 13, 7, 1, 2)]),
    klucze: () => mk(16, 16, [R('r', 9, 1, 5, 2), R('r', 11, 2, 3, 5), R('G', 10, 7, 2, 1), R('g', 9, 7, 2, 2), R('g', 7, 9, 2, 2), R('g', 5, 11, 2, 2), R('g', 3, 12, 3, 2), R('d', 2, 12, 2, 3), R('R', 12, 3, 1, 3)]),
    szlifierka: () => mk(16, 16, [R('o', 2, 7, 12, 5), R('O', 2, 11, 12, 1), R('d', 3, 12, 10, 2), R('g', 4, 13, 8, 1), R('G', 6, 4, 4, 3), R('G', 7, 2, 2, 2), R('w', 4, 8, 2, 1)]),
    probnik: () => mk(16, 16, [R('c', 5, 1, 6, 11), R('b', 5, 10, 6, 2), R('d', 6, 2, 4, 4), R('y', 7, 3, 2, 2), R('G', 7, 12, 2, 3), R('r', 6, 6, 4, 1), R('w', 6, 8, 2, 2)]),
    szpachle: () => mk(16, 16, [R('g', 6, 1, 7, 8), R('w', 7, 2, 5, 5), R('G', 6, 8, 7, 1), R('T', 7, 9, 2, 5), R('t', 6, 9, 1, 4), R('t', 9, 9, 1, 4), R('G', 3, 4, 3, 4), R('g', 2, 3, 3, 3)]),
  };

  // ---------- portrety 16x16 ----------
  function portrait(spec) {
    const g = grid(16, 16);
    const skin = spec.skin || 's', dark = skin === 's' ? 'S' : 'H';
    rect(g, spec.shirt || 'b', 3, 12, 10, 4); rect(g, skin, 7, 11, 2, 2);
    if (spec.tie) rect(g, spec.tie, 7, 12, 2, 4);
    if (spec.collar) { rect(g, spec.collar, 5, 12, 2, 1); rect(g, spec.collar, 9, 12, 2, 1); }
    rect(g, skin, 5, 3, 6, 9); rect(g, skin, 4, 4, 8, 7); rect(g, skin, 3, 7, 1, 2); rect(g, skin, 12, 7, 1, 2); // głowa i uszy
    const hair = spec.hair, hc = spec.hairColor || 'h';
    if (hair === 'short') { rect(g, hc, 4, 2, 8, 3); rect(g, hc, 3, 4, 1, 3); rect(g, hc, 12, 4, 1, 3); }
    if (hair === 'slick') { rect(g, hc, 4, 2, 8, 2); rect(g, hc, 3, 3, 1, 4); rect(g, hc, 12, 3, 1, 4); rect(g, hc, 9, 4, 3, 1); }
    if (hair === 'long') { rect(g, hc, 4, 2, 8, 3); rect(g, hc, 3, 3, 2, 10); rect(g, hc, 11, 3, 2, 10); }
    if (hair === 'curly') { rect(g, hc, 3, 2, 10, 3); rect(g, hc, 2, 4, 2, 5); rect(g, hc, 12, 4, 2, 5); rect(g, hc, 4, 1, 3, 1); rect(g, hc, 9, 1, 3, 1); }
    if (hair === 'bun') { rect(g, hc, 4, 3, 8, 2); rect(g, hc, 3, 4, 1, 4); rect(g, hc, 12, 4, 1, 4); rect(g, hc, 6, 0, 4, 3); }
    if (hair === 'bald') { rect(g, hc, 3, 5, 1, 2); rect(g, hc, 12, 5, 1, 2); }
    // oczy, usta
    rect(g, 'w', 5, 7, 2, 2); rect(g, 'w', 9, 7, 2, 2); rect(g, 'k', 6, 7, 1, 2); rect(g, 'k', 9, 7, 1, 2);
    rect(g, spec.lips || dark, 7, 10, 2, 1);
    if (spec.brows) { rect(g, spec.brows, 5, 6, 2, 1); rect(g, spec.brows, 9, 6, 2, 1); }
    if (spec.beard) { rect(g, spec.beard, 5, 9, 6, 3); rect(g, spec.lips || dark, 7, 10, 2, 1); }
    if (spec.stache) rect(g, spec.stache, 6, 9, 4, 1);
    if (spec.glasses) { rect(g, spec.glasses, 4, 6, 4, 1); rect(g, spec.glasses, 8, 6, 4, 1); rect(g, spec.glasses, 4, 9, 4, 1); rect(g, spec.glasses, 8, 9, 4, 1); rect(g, spec.glasses, 4, 7, 1, 2); rect(g, spec.glasses, 7, 7, 2, 1); rect(g, spec.glasses, 11, 7, 1, 2); }
    if (spec.shades) { rect(g, 'k', 4, 7, 8, 2); rect(g, 'k', 4, 6, 3, 1); rect(g, 'k', 9, 6, 3, 1); }
    if (spec.hat === 'hard') { rect(g, spec.hatColor || 'y', 3, 2, 10, 3); rect(g, spec.hatColor || 'y', 4, 1, 8, 1); rect(g, spec.hatDark || 'Y', 2, 5, 12, 1); rect(g, 'w', 5, 2, 2, 1); }
    if (spec.hat === 'cap') { rect(g, spec.hatColor || 'r', 3, 2, 10, 3); rect(g, spec.hatColor || 'r', 4, 1, 8, 1); rect(g, spec.hatDark || 'R', 3, 5, 12, 1); }
    if (spec.hat === 'beanie') { rect(g, spec.hatColor || 'N', 3, 1, 10, 4); rect(g, spec.hatDark || 'n', 3, 4, 10, 1); }
    if (spec.chain) { rect(g, 'y', 6, 12, 4, 1); rect(g, 'y', 7, 13, 2, 1); }
    if (spec.blush) { rect(g, spec.blush, 4, 9, 1, 1); rect(g, spec.blush, 11, 9, 1, 1); }
    return outline(g);
  }
  const PORTRAITS = {
    mirek: { shirt: 'G', hair: 'bald', hairColor: 'g', stache: 'g', hat: 'cap', hatColor: 'G', hatDark: 'd', brows: 'g', collar: 'g' },
    karyna: { shirt: 'm', hair: 'long', hairColor: 'e', lips: 'r', brows: 'h', blush: 'm' },
    sebix: { shirt: 'd', hat: 'cap', hatColor: 'r', hatDark: 'R', chain: true, shades: true },
    grazyna: { shirt: 'p', hair: 'curly', hairColor: 'g', glasses: 'k', lips: 'R', blush: 'm' },
    tesciowa: { shirt: 'P', hair: 'bun', hairColor: 'w', glasses: 'G', lips: 'R', brows: 'g' },
    heniek: { shirt: 'o', hat: 'hard', stache: 'g', brows: 'g', collar: 'w' },
    kacper: { shirt: 'n', hair: 'short', hairColor: 'H' },
    zbyszek: { shirt: 'B', hat: 'beanie', beard: 'H', skin: 's' },
    zdzisiek: { shirt: 'O', hat: 'hard', hatColor: 'o', hatDark: 'O', stache: 'H' },
    staszek: { shirt: 'N', hat: 'hard', hatColor: 'w', hatDark: 'g', brows: 'G', collar: 'y' },
    bogdan: { shirt: 'd', hair: 'slick', hairColor: 'k', shades: true, tie: 'r', collar: 'w' },
    gienek: { shirt: 'd', hair: 'short', hairColor: 'k', stache: 'k', brows: 'k', collar: 'G', chain: true },
  };

  // ---------- renderowanie ----------
  const SPRITES = {}; Object.keys(ICONS).forEach(k => { SPRITES['i_' + k] = ICONS[k]; }); Object.keys(PORTRAITS).forEach(k => { SPRITES['p_' + k] = () => portrait(PORTRAITS[k]); });
  function get(name) { return SPRITES[name] ? SPRITES[name]() : null; }
  function rgba(g, scale) {
    scale = scale || 1; const h = g.length, w = g[0].length, W = w * scale, Hh = h * scale, data = new Uint8ClampedArray(W * Hh * 4);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const c = g[Math.floor(y / scale)][Math.floor(x / scale)], i = (y * W + x) * 4;
      if (c !== '.' && PAL[c]) { const v = hex(PAL[c]); data[i] = v[0]; data[i + 1] = v[1]; data[i + 2] = v[2]; data[i + 3] = 255; }
    }
    return { w: W, h: Hh, data };
  }
  const cache = {};
  /* Przeglądarka: data URL sprite'a w danej skali. */
  function url(name, scale) {
    const key = name + '@' + (scale || 1); if (cache[key]) return cache[key];
    const g = get(name); if (!g) return '';
    const im = rgba(g, scale || 1), c = document.createElement('canvas'); c.width = im.w; c.height = im.h;
    c.getContext('2d').putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
    return (cache[key] = c.toDataURL('image/png'));
  }
  const img = (name, cls, scale) => '<img class="pxs ' + (cls || '') + '" src="' + url(name, scale || 1) + '" alt="" width="' + (get(name)[0].length * (scale || 1)) + '" height="' + (get(name).length * (scale || 1)) + '">';
  const icon = (n, cls) => img('i_' + n, 'pxi ' + (cls || ''));
  const face = (n, cls) => img('p_' + n, 'pxp ' + (cls || ''));

  /* Emoji → ikony pikselowe. Nieznane emoji zostają bez zmian. */
  const EMOJI = { '🪙': 'coin', '💰': 'coin', '⭐': 'star', '★': 'star', '👷': 'crew', '🏢': 'hq', '💼': 'fin', '🏘️': 'os', '📖': 'story', '🛒': 'shop', '📄': 'claim', '🧾': 'claim', '💥': 'boom',
    '🚗': 'car', '🚚': 'van', '🚔': 'police', '📦': 'pkg', '🕵️': 'spy', '⚠': 'bolt', '⚠️': 'warn', '✓': 'check', '🔧': 'klucze', '🧰': 'zestaw', '🚑': 'police', '🔒': 'lock', '🎯': 'target', '⏱': 'clock', '⏱️': 'clock', '😄': 'mood4', '🙂': 'mood3', '😐': 'mood2', '😠': 'mood1', '🤬': 'mood0', '🗂️': 'claim', '👮': 'police', '🦈': 'bogdan', '☀️': 'sun', '☀': 'sun', '🌙': 'moon' };
  /* Podmienia emoji w węzłach tekstowych elementu na obrazki. Szuka tylko w tekstach, nie rusza atrybutów. */
  function pixelize(rootEl) {
    if (!rootEl || typeof document === 'undefined') return;
    const keys = Object.keys(EMOJI).sort((a, b) => b.length - a.length).concat(Object.keys(PORTRAITS).map(k => '@' + k)), re = new RegExp('(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null), nodes = [];
    while (walker.nextNode()) { const n = walker.currentNode; if (re.test(n.nodeValue) && !(n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName))) nodes.push(n); re.lastIndex = 0; }
    nodes.forEach(n => {
      const span = document.createElement('span'); span.innerHTML = n.nodeValue.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(re, m => {
        if (m[0] === '@') return face(m.slice(1), 'inline'); const k = EMOJI[m]; return k === 'bogdan' ? face('bogdan', 'inline') : icon(k, 'inline'); });
      n.parentNode.replaceChild(span, n);
    });
  }

  /* Pikselizacja scen SVG: rysuje SVG w małej rozdzielczości, ogranicza kolory do palety i pokazuje w powiększeniu. */
  // paleta scen: kolory sprite'ów plus dodatkowe tony z rysunków scen (ściany, woda, drewno), żeby scena nie traciła szczegółów
  const SCENE_EXTRA = ['#d7ccc8', '#a1887f', '#cfd8dc', '#8d99a3', '#b0bec5', '#eceff1', '#90a4ae', '#4fc3f7', '#3e2723', '#4e342e', '#9ec5e0', '#6b6f73', '#bcd2c8', '#efebe9', '#c9b8a3', '#8d6e63', '#5d4037', '#ef8f2d', '#fafafa', '#66bb6a', '#ffd54f', '#7b8794', '#6f8794', '#3b4f5a', '#4d5156', '#e0d8d4'];
  const QUANT = Object.keys(PAL).filter(k => k !== 'k').map(k => hex(PAL[k])).concat(SCENE_EXTRA.map(hex), [hex(PAL.k)]);
  function quantize(data) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) { data[i + 3] = 255; data[i] = 20; data[i + 1] = 23; data[i + 2] = 26; continue; }
      let best = 0, bd = 1e9; for (let q = 0; q < QUANT.length; q++) { const d = (data[i] - QUANT[q][0]) ** 2 + (data[i + 1] - QUANT[q][1]) ** 2 + (data[i + 2] - QUANT[q][2]) ** 2; if (d < bd) { bd = d; best = q; } }
      data[i] = QUANT[best][0]; data[i + 1] = QUANT[best][1]; data[i + 2] = QUANT[best][2]; data[i + 3] = 255;
    }
  }
  function scenify(rootEl, w, h) {
    if (typeof document === 'undefined') return;
    rootEl.querySelectorAll('.scene > svg').forEach(svg => {
      if (svg.dataset.px) return; svg.dataset.px = '1';
      const vb = svg.viewBox.baseVal, W = parseInt(svg.parentNode.dataset.pxw, 10) || w || 128, H = h || Math.round(W * vb.height / vb.width);
      const xml = new XMLSerializer().serializeToString(svg).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" ');
      const im = new Image(), holder = svg.parentNode;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'pxscene'; cv.style.width = '100%'; cv.style.imageRendering = 'pixelated'; cv.style.display = 'block';
      holder.insertBefore(cv, svg); svg.style.display = 'none';
      im.onload = () => { const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0, 0, W, H); const d = ctx.getImageData(0, 0, W, H); quantize(d.data); ctx.putImageData(d, 0, 0); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  return { SCENE_EXTRA, PAL, ICONS, PORTRAITS, SPRITES, get, rgba, url, img, icon, face, pixelize, scenify, EMOJI, grid, rect, outline, mk, portrait };
});
