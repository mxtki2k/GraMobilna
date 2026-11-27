/* Sceny pixel art 128x80: łazienka (kran), pokój (dziura w ścianie), kuchnia (gniazdko), salon (półka) i siedziba firmy.
 * Rysowane ręcznie z warstw (prostokąty, linie, dithering, małe sprite'y), a nie pikselizowane z SVG.
 * Stan sceny to zbiór tokenów (jak w jobs.js: 'broken', 'seal-new', 'plaster-good', ...). Klatka f (0..3) animuje kapanie, iskry, parę.
 * Działa w przeglądarce (canvas) i w node (eksport PNG), bo renderuje do siatki znaków z palety Pix.PAL. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pixel.js'));
  else root.Scenes = factory(root.Pix);
})(typeof self !== 'undefined' ? self : this, function (Pix) {
  const GEN = (typeof RobotyGen !== 'undefined' ? RobotyGen : (() => { try { return require('./roboty_gen.js'); } catch (e) { return null; } })()) || { JOBS: {}, SURPRISES: {}, CHAINS: {}, LEVELS: [], META: {} };
  const W = 128, H = 80;
  const G = () => Pix.grid(W, H);
  const rc = (g, c, x, y, w, h) => Pix.rect(g, c, x, y, w, h);
  const px = (g, c, x, y) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c; };
  const has = (T, ...a) => a.some(t => T.has(t));
  /* Szachownica: co drugi piksel (cieniowanie, faktura). */
  function dith(g, c, x, y, w, h, ph) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (((i + j + (ph || 0)) & 1) === 0) px(g, c, i, j); }
  /* Linia Bresenhama z grubością w pionie. */
  function line(g, c, x0, y0, x1, y1, th) {
    th = th || 1; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { for (let k = 0; k < th; k++) px(g, c, x0, y0 + k); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function disc(g, c, cx, cy, r) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(g, c, cx + x, cy + y); }
  /* Mały sprite z tekstu: '.' i spacja to przezroczystość. */
  function spr(g, x, y, rows) { rows.forEach((r, j) => r.split('').forEach((c, i) => { if (c !== '.' && c !== ' ') px(g, c, x + i, y + j); })); }
  const CHECK = ['.....Nn', '....Nn.', 'N..Nn..', 'nNNn...', '.nn....'];
  const CHECK_Y = ['.....Ye', '....Ye.', 'Y..Ye..', 'eYYe...', '.ee....'];
  const QMARK = ['.rrr.', 'r...r', '....r', '..rr.', '..r..', '.....', '..r..'];
  const BANG = ['..k..', '.kyk.', '.kyk.', 'kkykk', 'kkkkk', 'kkykk'];
  let HQ_NIGHT = false;
  /* Nocna szyba: granat, gwiazdy (migoczą z klatką) i księżyc. */
  function nightGlass(g, x, y, w, h, f) {
    rc(g, 'B', x, y, w, h); dith(g, 'd', x, y + h - 6, w, 6);
    for (const [sx, sy] of [[1, 2], [5, 6], [9, 3], [12, 9], [3, 12], [8, 14], [11, 1]]) if (sx < w && sy < h && ((sx + sy + f) % 3) !== 0) px(g, 'w', x + sx, y + sy);
    disc(g, 'e', x + w - 4, y + 4, 2); px(g, 'B', x + w - 3, y + 3);
  }
  /* Ramka „podgląd” (zbliżenie na instalację). */
  function inset(g, x, y, w, h) { rc(g, 'k', x - 1, y - 1, w + 2, h + 2); rc(g, '&', x, y, w, h); rc(g, 'd', x + 1, y + 1, w - 2, h - 2); }

  // ---------------------------------------------------------------- wspólne elementy
  function tiledWall(g, h) {
    rc(g, '4', 0, 0, W, h);
    for (let row = 0; row * 10 < h; row++) {
      const y = row * 10;
      for (let x = (row % 2 ? -8 : 0); x < W; x += 16) { rc(g, '6', x + 15, y, 1, 10); px(g, '#', x + 1, y + 1); px(g, '#', x + 2, y + 1); px(g, '#', x + 1, y + 2); dith(g, '5', x + 8, y + 5, 6, 3, row); }
      rc(g, '6', 0, y + 9, W, 1);
    }
    dith(g, '5', 0, 0, W, 3); dith(g, '5', 0, 3, W, 1, 1);
  }
  function wallpaper(g, y1, pal) {
    pal = pal || ['1', '2', '3'];
    rc(g, pal[0], 0, 0, W, y1);
    for (let x = 3; x < W; x += 8) { rc(g, pal[1], x, 0, 1, y1); dith(g, pal[1], x + 1, 0, 1, y1, x); }
    dith(g, pal[2], 0, 0, W, 2); dith(g, pal[2], 0, y1 - 2, W, 2, 1);
  }
  function skirting(g, y, wall) { rc(g, wall || '3', 0, y, W, 4); rc(g, '+', 0, y, W, 1); rc(g, '2', 0, y + 3, W, 1); }
  function woodFloor(g, y0) {
    rc(g, '7', 0, y0, W, H - y0);
    for (let r = 0, y = y0; y < H; y += 6, r++) { rc(g, '8', 0, y, W, 1); dith(g, '9', 0, y + 1, W, 1, r); for (let x = (r % 2) * 14; x < W; x += 28) rc(g, '8', x, y, 1, 6); dith(g, '8', 3, y + 4, W - 6, 1, r + 1); }
  }
  function door(g, x, y, w, h, c) { rc(g, c, x, y, w, h); rc(g, '8', x, y, w, 1); rc(g, '8', x, y, 1, h); }

  // ---------------------------------------------------------------- ŁAZIENKA: cieknący kran
  function kran(T, f, o) {
    o = o || {}; const g = G();
    tiledWall(g, 58);
    // podłoga: szachownica
    rc(g, '6', 0, 58, W, 22);
    for (let y = 60; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x >> 3) + ((y - 60) >> 3)) % 2 === 0) rc(g, '5', x, y, 8, 8);
    rc(g, '&', 0, 58, W, 2); rc(g, '%', 0, 58, W, 1);
    // okno z firanką po lewej, lustro po prawej
    rc(g, '&', 5, 7, 20, 27); rc(g, '+', 6, 8, 18, 24); rc(g, '^', 8, 10, 14, 20); dith(g, '~', 8, 10, 14, 8); rc(g, '+', 14, 10, 2, 20); rc(g, '+', 8, 19, 14, 2); rc(g, '=', 6, 32, 18, 2);
    if (o.night) { nightGlass(g, 8, 10, 14, 20, f); rc(g, '+', 14, 10, 2, 20); rc(g, '+', 8, 19, 14, 2); }
    rc(g, '&', 99, 5, 22, 28); rc(g, '#', 100, 6, 20, 26); rc(g, '%', 102, 8, 16, 22); dith(g, '#', 103, 9, 5, 18, 1); rc(g, '&', 100, 6, 20, 1); rc(g, '&', 100, 31, 20, 1);
    // szafka z blatem
    rc(g, '-', 24, 78, 82, 2); dith(g, '&', 22, 78, 86, 2);
    rc(g, '8', 28, 53, 74, 25); rc(g, '9', 29, 54, 72, 23);
    for (const x of [31, 66]) { rc(g, '8', x, 56, 33, 20); rc(g, '9', x + 1, 57, 31, 18); dith(g, '7', x + 1, 71, 31, 4); dith(g, '7', x + 28, 57, 4, 18, 1); rc(g, 'y', x + (x < 50 ? 27 : 3), 63, 2, 3); }
    rc(g, '%', 24, 48, 82, 6); rc(g, '#', 24, 48, 82, 1); rc(g, '&', 24, 53, 82, 1); dith(g, '&', 24, 52, 82, 1);
    // umywalka nablatowa
    rc(g, '6', 45, 39, 40, 1); rc(g, '6', 43, 41, 44, 8); rc(g, '+', 46, 40, 38, 8); rc(g, '+', 44, 43, 42, 5); rc(g, '#', 44, 42, 42, 1); rc(g, '5', 46, 47, 38, 1); dith(g, '=', 46, 44, 38, 3, 1); rc(g, '&', 44, 48, 42, 1);
    // woda w misie
    const dripping = T.has('broken') && !has(T, 'seal-new', 'seal-old', 'tape', 'glue', 'woda-off');
    if (dripping || T.has('flood')) { rc(g, 'a', 50, 44, 30, 3); dith(g, '#', 52 + (f % 2) * 3, 44, 10, 1); dith(g, 'A', 66, 46, 12, 1); }
    // armatura
    rc(g, '%', 62, 22, 6, 22); rc(g, '#', 63, 22, 1, 22); rc(g, '&', 67, 22, 1, 22);
    rc(g, '%', 62, 19, 27, 6); rc(g, '#', 62, 19, 27, 1); rc(g, '&', 62, 24, 27, 1); rc(g, '#', 62, 20, 3, 4);
    rc(g, '%', 84, 25, 5, 9); rc(g, '#', 85, 25, 1, 9); rc(g, '&', 88, 25, 1, 9); rc(g, '&', 84, 33, 5, 1);
    rc(g, '&', 59, 41, 12, 3); rc(g, '%', 59, 41, 12, 1);
    rc(g, 'r', 53, 36, 6, 5); rc(g, 'R', 53, 40, 6, 1); rc(g, '#', 54, 36, 2, 1); rc(g, '%', 58, 38, 2, 2);
    rc(g, 'b', 71, 36, 6, 5); rc(g, 'B', 71, 40, 6, 1); rc(g, 'c', 72, 36, 2, 1); rc(g, '%', 70, 38, 2, 2);
    // wymiany
    if (T.has('fit-ok')) { rc(g, '#', 58, 40, 14, 2); rc(g, '%', 58, 42, 14, 1); if (f % 4 < 2) { px(g, 'w', 59, 39); px(g, 'w', 70, 40); } rc(g, 'n', 73, 41, 1, 1); }
    if (T.has('fit-force')) { rc(g, '&', 57, 41, 16, 3); rc(g, 'k', 61, 41, 1, 3); rc(g, 'k', 66, 42, 1, 2); line(g, 'k', 58, 40, 60, 38); rc(g, 'G', 96, 44, 8, 3); rc(g, 'g', 92, 43, 5, 5); rc(g, 'd', 94, 45, 2, 1); }
    if (T.has('seal-new')) { rc(g, 'o', 61, 28, 8, 3); rc(g, 'O', 61, 30, 8, 1); rc(g, 'y', 62, 28, 3, 1); }
    if (T.has('seal-old')) { rc(g, 'G', 61, 28, 8, 3); rc(g, 'd', 61, 30, 8, 1); dith(g, 'g', 62, 28, 5, 1); }
    if (T.has('tape')) { rc(g, '+', 60, 25, 10, 9); for (let i = 0; i < 10; i++) { px(g, '=', 60 + i, 25 + ((i * 2) % 9)); px(g, '=', 60 + i, 26 + ((i * 2) % 9)); } rc(g, '=', 60, 33, 10, 1); }
    if (T.has('glue')) { rc(g, 'R', 85, 38, 16, 10); rc(g, 'r', 86, 39, 14, 8); for (const [x, y, w] of [[86, 42, 14], [86, 46, 14]]) rc(g, 'R', x, y, w, 1); rc(g, 'R', 92, 39, 1, 3); rc(g, 'R', 97, 43, 1, 3); rc(g, 'e', 56, 40, 20, 4); rc(g, 'Y', 56, 43, 20, 1); dith(g, 'Y', 58, 41, 14, 2); rc(g, 'e', 78, 31, 8, 4); rc(g, 'Y', 78, 34, 8, 1); }
    // kapanie (przy zakręconym tylko zaworze pod zlewem kapie rzadziej)
    const slow = T.has('woda-sink') && !T.has('woda-off');
    if (dripping && !(slow && f % 4 >= 2)) {
      const y = [35, 38, 41, 44][f % 4];
      rc(g, 'a', 85, y, 2, 3); px(g, 'A', 85, y + 2); px(g, '#', 86, y);
      if (f % 4 === 3) { px(g, 'a', 83, 45); px(g, 'a', 88, 45); px(g, '#', 85, 44); }
      rc(g, 'a', 84, 30, 1, 3); px(g, '#', 84, 30);
    }
    // powódź
    if (T.has('flood')) {
      rc(g, 'a', 0, 62, W, 17); for (let y = 63; y < 79; y += 3) dith(g, 'A', (y * 7) % 6, y, W, 1, y); for (let x = (f * 4) % 12; x < W; x += 12) { rc(g, '#', x, 66, 4, 1); rc(g, '#', x + 6, 72, 3, 1); }
      rc(g, 'a', 28, 54, 2, 24); rc(g, 'a', 100, 54, 2, 24); px(g, '#', 28, 56 + (f % 3) * 6);
    }
    // wskaźniki
    if (T.has('woda-off')) { disc(g, 'N', 11, 44, 5); disc(g, 'n', 11, 44, 4); spr(g, 8, 42, CHECK); }
    if (T.has('woda-sink')) { disc(g, 'Y', 11, 44, 5); disc(g, 'e', 11, 44, 4); spr(g, 8, 42, CHECK_Y); rc(g, 'a', 34, 66, 3, 2); }
    if (T.has('tested')) { rc(g, '#', 104, 38, 8, 10); rc(g, 'a', 105, 41, 6, 6); disc(g, 'N', 108, 33, 4); disc(g, 'n', 108, 33, 3); spr(g, 105, 31, CHECK); }
    if (T.has('tested-quick')) { disc(g, 'Y', 108, 33, 4); disc(g, 'e', 108, 33, 3); spr(g, 105, 31, CHECK_Y); }
    if (T.has('untested')) { disc(g, 'R', 108, 33, 4); disc(g, 'r', 108, 33, 3); spr(g, 106, 30, QMARK.map(r => r.replace(/r/g, 'w'))); }
    return g;
  }


  // ---------------------------------------------------------------- POKÓJ: dziura w ścianie
  const HOLE = [[56, 74], [52, 78], [50, 80], [49, 82], [49, 83], [48, 83], [49, 82], [50, 82], [50, 81], [51, 81], [50, 80], [50, 80], [49, 79], [50, 80], [50, 80], [51, 79], [51, 78], [52, 77], [53, 75], [55, 72]];
  function holeSpans(y0) { return HOLE.map((r, i) => ({ y: y0 + i * 2, x0: r[0], x1: r[1] })); }
  function holePoly(g, c, grow) {
    grow = grow || 0;
    holeSpans(20).forEach(r => rc(g, c, r.x0 - grow, r.y - grow, r.x1 - r.x0 + 1 + 2 * grow, 2 + grow));
  }
  function sciana(T, f, o) {
    o = o || {}; const g = G();
    const sage = T.has('paint-full');
    wallpaper(g, 62, sage ? ['?', '$', '!'] : null);
    skirting(g, 62, sage ? '!' : '3');
    woodFloor(g, 66);
    // okno z zasłonami
    rc(g, '&', 5, 9, 28, 38); rc(g, '+', 6, 10, 26, 36); rc(g, '^', 8, 12, 22, 32); dith(g, '~', 8, 12, 22, 12); rc(g, '+', 18, 12, 2, 32); rc(g, '+', 8, 27, 22, 2);
    rc(g, 'c', 9, 13, 5, 1); rc(g, '#', 22, 30, 5, 1);
    if (o.night) { nightGlass(g, 8, 12, 22, 32, f); rc(g, '+', 18, 12, 2, 32); rc(g, '+', 8, 27, 22, 2); }
    rc(g, '#', 4, 46, 30, 3); rc(g, '%', 4, 48, 30, 1);
    rc(g, 'o', 3, 8, 6, 38); dith(g, 'O', 3, 8, 6, 38); rc(g, 'o', 29, 8, 6, 38); dith(g, 'O', 29, 8, 6, 38, 1); rc(g, 'O', 3, 8, 32, 2);
    // roślina
    rc(g, 'T', 104, 54, 14, 12); rc(g, 't', 105, 54, 12, 2); dith(g, 'T', 106, 57, 10, 8, 1);
    for (const [x, y, w, h] of [[106, 34, 4, 18], [111, 28, 4, 24], [101, 40, 5, 12], [114, 40, 5, 12]]) { rc(g, 'N', x, y, w, h); dith(g, 'n', x, y, w, h); rc(g, 'n', x + 1, y, 1, h - 2); }
    const patched = has(T, 'plaster-good', 'plaster-thick', 'foam');
    // gruz i kurz
    if (T.has('broken') && !patched) { for (const [x, y] of [[54, 64], [60, 66], [66, 65], [72, 67], [78, 64], [58, 69], [70, 70]]) { rc(g, '=', x, y, 3, 2); px(g, '+', x, y); } dith(g, '2', 50, 62, 34, 6, 1); }
    // dziura
    if (T.has('broken') && !patched) {
      if (T.has('prep-good')) { holePoly(g, 'b', 3); holePoly(g, 'c', 2); }
      holePoly(g, '3', 1); holePoly(g, '-', 0);
      holeSpans(20).forEach((r, i) => { if (i > 2 && i < 17) rc(g, '_', r.x0 + 3, r.y, r.x1 - r.x0 - 5, 2); });
      if (T.has('prep-good')) { rc(g, 'w', 52, 22, 3, 1); rc(g, 'w', 76, 40, 3, 1); }
      for (const [x, y] of [[54, 52], [58, 52], [64, 54], [69, 52], [73, 54]]) { rc(g, 'r', x, y, 5, 2); px(g, 'R', x + 4, y + 1); }
      for (const [x, y] of [[53, 24], [57, 22], [64, 28], [70, 24], [76, 30]]) rc(g, '+', x, y, 3, 1);
      for (const [x, y] of [[56, 26], [74, 36], [51, 44]]) rc(g, '2', x, y, 2, 2);
    }
    if (T.has('broken') && !patched && T.has('prep-dust')) { for (let i = 0; i < 14; i++) px(g, '=', 46 + (i * 7 + f * 3) % 40, 18 + (i * 5) % 40); dith(g, '2', 44, 16, 44, 44, f); }
    if (T.has('broken') && !patched && T.has('prep-none')) { for (const [x, y] of [[48, 26], [50, 40], [80, 24], [82, 44], [56, 56]]) { rc(g, '=', x, y, 4, 3); px(g, '3', x + 3, y + 2); } rc(g, '3', 46, 36, 3, 2); }
    if (T.has('broken') && !patched) { for (let i = 0; i < 5; i++) px(g, 'w', 40 + (i * 9 + f * 2) % 50, 14 + (i * 11 + f * 2) % 40); }
    const holeFill = c => holePoly(g, c, 0);
    if (T.has('plaster-good')) { holePoly(g, '=', 1); holeFill('+'); dith(g, '=', 56, 24, 22, 20, 0); rc(g, '#', 58, 24, 10, 1); }
    if (T.has('plaster-thick')) { holePoly(g, '=', 1); holeFill('+'); line(g, '3', 58, 26, 66, 38); line(g, '3', 66, 38, 62, 48); line(g, '3', 72, 24, 76, 36); px(g, '3', 61, 31); }
    if (T.has('foam')) { holePoly(g, 'Y', 2); holeFill('e'); dith(g, 'Y', 52, 24, 30, 26, 1); for (const [x, y] of [[54, 30], [66, 28], [74, 40], [60, 46], [80, 34]]) { rc(g, 'w', x, y, 2, 2); } rc(g, 'e', 48, 52, 8, 3); rc(g, 'Y', 48, 55, 8, 1); }
    if (T.has('sand-good') && patched) { dith(g, '#', 56, 24, 22, 22, 1); if (f % 4 < 2) { px(g, 'w', 60, 28); px(g, 'w', 72, 38); } }
    if (T.has('sand-light') && patched) { for (const [x, y] of [[60, 30], [70, 42]]) { rc(g, '=', x, y, 3, 2); px(g, '3', x + 2, y + 1); } }
    if (T.has('sand-none') && patched) { for (const [x, y] of [[52, 26], [70, 22], [78, 40], [58, 50], [66, 44]]) { rc(g, '=', x, y, 3, 2); px(g, '3', x + 2, y + 1); } }
    if (T.has('paint-patch') && patched) { holePoly(g, '3', 1); holeFill('2'); dith(g, '=', 54, 24, 28, 24, 0); }
    // szafa zasłaniająca dziurę
    if (T.has('wardrobe')) {
      rc(g, '-', 30, 62, 70, 2); dith(g, '3', 26, 62, 6, 4); dith(g, '3', 98, 20, 6, 44, 1);
      rc(g, '8', 34, 12, 62, 54); rc(g, '9', 36, 14, 58, 50); rc(g, '8', 33, 11, 64, 3); rc(g, '9', 33, 11, 64, 1);
      for (const x of [38, 67]) { rc(g, '8', x, 20, 25, 40); rc(g, '9', x + 1, 21, 23, 38); dith(g, '7', x + 1, 54, 23, 5); dith(g, '7', x + 19, 21, 5, 38, 1); rc(g, '#', x + 2, 22, 10, 1); }
      rc(g, 'y', 60, 38, 2, 5); rc(g, 'y', 68, 38, 2, 5); rc(g, 'Y', 61, 38, 1, 5); rc(g, 'T', 36, 64, 6, 3); rc(g, 'T', 88, 64, 6, 3);
    }
    return g;
  }

  // ---------------------------------------------------------------- KUCHNIA: iskrzące gniazdko
  function gniazdko(T, f, o) {
    o = o || {}; const g = G();
    // ściana z płytek, szafki wiszące, blat
    rc(g, '4', 0, 0, W, 52);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 16; col++) { const x = col * 8, y = row * 8 + 2; rc(g, '5', x + 7, y, 1, 8); rc(g, '5', x, y + 7, 8, 1); px(g, '#', x + 1, y + 1); px(g, '#', x + 2, y + 1); }
    for (const [x, w] of [[0, 28], [100, 28]]) { rc(g, '8', x, 0, w, 26); rc(g, '9', x + 1, 0, w - 2, 24); rc(g, '8', x + 1, 24, w - 2, 2); dith(g, '7', x + 1, 18, w - 2, 5); rc(g, '8', x + (w - 1) / 2 | 0, 2, 1, 20); rc(g, 'y', x + (x ? 4 : 22), 12, 2, 4); }
    rc(g, '&', 0, 52, W, 2); rc(g, '#', 0, 52, W, 1); rc(g, '%', 0, 53, W, 5); rc(g, '&', 0, 57, W, 1);
    rc(g, '8', 0, 58, W, 22); rc(g, '9', 0, 59, W, 21); for (const x of [0, 43, 86]) { rc(g, '8', x, 60, 41, 18); rc(g, '9', x + 1, 61, 39, 16); dith(g, '7', x + 1, 72, 39, 5); rc(g, 'y', x + 18, 63, 4, 2); }
    dith(g, '3', 0, 78, W, 2);
    // czajnik na blacie
    rc(g, '&', 86, 42, 22, 11); rc(g, '%', 87, 41, 20, 11); rc(g, '#', 88, 42, 4, 9); rc(g, '&', 105, 43, 2, 8); rc(g, 'd', 90, 38, 12, 4); rc(g, '%', 92, 36, 8, 3); rc(g, 'd', 96, 34, 2, 3);
    rc(g, 'd', 106, 40, 7, 2); rc(g, 'd', 111, 40, 2, 12); rc(g, 'd', 106, 49, 6, 2); rc(g, '&', 84, 52, 26, 1);
    // przewód z czajnika do gniazdka
    line(g, 'd', 86, 50, 78, 50); line(g, 'd', 78, 50, 71, 43);
    // gniazdko
    const broken = T.has('broken') && !has(T, 'outlet-new', 'outlet-old', 'outlet-glue');
    const plate = (ox, oy, shear, c1, c2) => { for (let j = 0; j < 14; j++) { const sx = Math.round(j * shear); rc(g, c2, ox + sx, oy + j, 14, 1); rc(g, c1, ox + sx + 1, oy + j, 12, 1); } rc(g, '&', ox, oy, 14, 1); rc(g, '&', ox + Math.round(13 * shear), oy + 13, 14, 1); };
    if (broken || T.has('outlet-old')) { for (let y = 18; y < 54; y++) for (let x = 48; x < 80; x++) { const d = Math.hypot(x - 64, (y - 36) * 1.1); if (d < 16 && ((x + y) & 1) === 0 && d > 8) px(g, 'G', x, y); else if (d < 12 && ((x + y) & 1) === 1 && d > 8) px(g, '6', x, y); } }
    if (T.has('outlet-glue')) {
      plate(57, 29, -0.18, '#', '%'); for (const dx of [0, 1]) { rc(g, '_', 60 + dx * 5 - 1, 33, 2, 5); }
      rc(g, 'e', 69, 40, 8, 5); rc(g, 'Y', 69, 44, 8, 1); dith(g, 'Y', 71, 41, 5, 2);
    } else {
      const old = T.has('outlet-old');
      plate(57, 29, 0, old ? 'e' : '+', old ? 'Y' : '%');
      rc(g, '_', 60, 33, 2, 5); rc(g, '_', 66, 33, 2, 5); px(g, '&', 58, 30); px(g, '&', 69, 41);
      if (old) { dith(g, 'O', 58, 30, 12, 3); dith(g, 'G', 62, 38, 8, 4, 1); }
      if (broken) { dith(g, '=', 58, 30, 12, 3); dith(g, 'G', 58, 39, 12, 3, 1); }
    }
    if (T.has('outlet-new')) { rc(g, '#', 58, 30, 12, 1); }
    // iskry
    if ((broken && !T.has('prad-off')) || T.has('spark') || T.has('prad-live')) {
      const fr = f % 4; dith(g, 'e', 53 + fr, 25, 6, 4, fr); dith(g, 'o', 70 - fr, 40 + (fr % 2) * 3, 6, 3);
      const bolt = [[63, 22], [62, 24], [64, 25], [62, 28], [66, 27], [65, 24]];
      const zig = (pts, c) => { for (let i = 0; i < pts.length - 1; i++) line(g, c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1); };
      if (fr % 2 === 0) { zig([[56, 24], [60, 28], [57, 31], [61, 35]], 'y'); zig([[75, 26], [71, 30], [74, 33]], 'e'); px(g, 'w', 60, 28); px(g, 'w', 71, 30); disc(g, 'e', 64, 28, 1); }
      else { zig([[64, 22], [61, 27], [65, 30], [62, 34]], 'y'); zig([[78, 34], [73, 36], [76, 40]], 'e'); px(g, 'w', 61, 27); px(g, 'w', 73, 36); disc(g, 'e', 58, 38, 1); }
      px(g, 'w', 61 + fr, 30); px(g, 'w', 70 - fr, 33);
    }
    if (T.has('wires-twist')) { line(g, 'k', 64, 43, 64, 50, 2); rc(g, 'k', 61, 46, 7, 4); dith(g, 'd', 62, 46, 5, 3); rc(g, 'G', 61, 46, 7, 1); }
    if (T.has('prad-off')) { disc(g, 'N', 12, 40, 5); disc(g, 'n', 12, 40, 4); spr(g, 9, 38, CHECK); }
    if (T.has('prad-doubt')) { disc(g, 'Y', 12, 40, 5); disc(g, 'e', 12, 40, 4); spr(g, 10, 37, QMARK.map(r => r.replace(/r/g, 'k'))); }
    if (T.has('prad-live')) { rc(g, 'k', 6, 34, 13, 12); rc(g, 'r', 7, 35, 11, 10); spr(g, 10, 36, BANG); }
    // podgląd instalacji: różne jakości połączeń przewodów
    if (has(T, 'wires-ok', 'wires-twist', 'wires-bare')) {
      const x = 88, y = 6; inset(g, x, y, 36, 26);
      if (T.has('wires-ok')) { for (const [dy, c, d] of [[8, 'r', 'R'], [13, 'b', 'B'], [18, 'n', 'N']]) { rc(g, c, x + 3, y + dy, 20, 2); rc(g, d, x + 3, y + dy + 1, 20, 1); rc(g, 'g', x + 23, y + dy, 5, 2); rc(g, 'G', x + 23, y + dy + 1, 5, 1); rc(g, 'w', x + 28, y + dy, 3, 2); } }
      if (T.has('wires-twist')) { for (const [dy, c] of [[8, 'r'], [14, 'b'], [20, 'n']]) rc(g, c, x + 3, y + dy, 14, 2); rc(g, 'k', x + 15, y + 6, 9, 17); dith(g, 'd', x + 16, y + 7, 7, 15); rc(g, 'G', x + 15, y + 6, 9, 1); for (let i = 0; i < 3; i++) rc(g, 'o', x + 24, y + 9 + i * 5, 8, 2); }
      if (T.has('wires-bare')) { for (const [dy, c] of [[8, 'o'], [13, 'o'], [18, 'o']]) { rc(g, c, x + 3, y + dy, 16, 2); rc(g, 'O', x + 3, y + dy + 1, 16, 1); } for (const dy of [7, 12, 17]) { line(g, 'e', x + 19, y + dy, x + 26, y + dy + 2 + (f % 2)); line(g, 'o', x + 19, y + dy + 1, x + 28, y + dy - 1 + (f % 2) * 2); } if (f % 2 === 0) { px(g, 'w', x + 28, y + 10); px(g, 'y', x + 30, y + 15); } else { px(g, 'w', x + 27, y + 17); px(g, 'y', x + 31, y + 8); } }
    }
    // para z czajnika po poprawnym teście
    if (T.has('tested')) { rc(g, 'k', 73, 30, 8, 6); rc(g, 'd', 74, 31, 6, 4); rc(g, 'n', 75, 32, 2, 2); rc(g, 'g', 78, 32, 1, 2); }
    if (has(T, 'tested', 'tested-kettle')) { for (let k = 0; k < 4; k++) { const y = 28 - ((f * 2 + k * 5) % 22); rc(g, '#', 96 + ((k * 3 + f) % 3), Math.max(8, y), 2, 2); } }
    if (T.has('untested')) { spr(g, 80, 30, QMARK.map(r => r.replace(/r/g, 'o'))); if (f % 2) { rc(g, '6', 66, 26, 2, 2); rc(g, '6', 68, 22, 2, 2); } }
    return g;
  }

  // ---------------------------------------------------------------- SALON: krzywa półka
  function polka(T, f, o) {
    o = o || {}; const g = G();
    wallpaper(g, 62);
    skirting(g, 62);
    woodFloor(g, 66);
    // sofa
    rc(g, 'B', 16, 46, 96, 24); rc(g, 'b', 18, 48, 92, 14); dith(g, 'B', 18, 48, 92, 3); rc(g, 'B', 14, 54, 8, 16); rc(g, 'b', 15, 55, 6, 14); rc(g, 'B', 106, 54, 8, 16); rc(g, 'b', 107, 55, 6, 14);
    rc(g, 'b', 22, 58, 40, 10); rc(g, 'b', 66, 58, 40, 10); rc(g, 'B', 22, 67, 40, 1); rc(g, 'B', 66, 67, 40, 1); rc(g, 'B', 63, 58, 3, 10); dith(g, 'c', 24, 59, 12, 2, 1);
    rc(g, 'd', 16, 70, 3, 4); rc(g, 'd', 108, 70, 3, 4); dith(g, 'T', 10, 74, 108, 3);
    // obrazek na ścianie po prawej, lampa po lewej
    rc(g, '8', 100, 8, 20, 16); rc(g, 'c', 102, 10, 16, 12); dith(g, 'b', 102, 10, 16, 6); rc(g, 'N', 102, 18, 16, 4); rc(g, 'y', 112, 12, 3, 3);
    rc(g, 'G', 6, 14, 2, 36); rc(g, 'e', 2, 8, 10, 8); dith(g, 'y', 2, 8, 10, 8, 1); rc(g, 'G', 3, 50, 8, 2);
    if (f % 4 === 1) dith(g, 'w', 3, 9, 8, 6);
    const shelf = (x0, y0, x1, y1, sag) => {
      line(g, '8', x0, y0 + 3, x1, y1 + 3, 1); line(g, '9', x0, y0, x1, y1, 3); line(g, '#', x0, y0, x1, y1, 1);
      if (sag) for (let x = x0; x <= x1; x++) { const k = Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * sag); px(g, '8', x, y0 + 3 + k + Math.round((y1 - y0) * (x - x0) / (x1 - x0))); }
      // wsporniki
      for (const x of [x0 + 8, x1 - 8]) { const y = Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0)) + 4; rc(g, '&', x, y, 2, 6); rc(g, '&', x - 3, y + 5, 6, 1); px(g, '%', x, y); }
    };
    const shelfY = (x, x0, y0, x1, y1) => Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    if (T.has('broken') && !T.has('shelf-on')) {
      shelf(24, 40, 104, 22, 0); rc(g, '&', 28, 42, 2, 2);
      for (const [x, y, c, d] of [[46, 54, 'r', 'R'], [62, 56, 'N', 'n'], [76, 55, 'B', 'b']]) { rc(g, d, x, y, 12, 4); rc(g, c, x + 1, y + 1, 10, 2); rc(g, '+', x + 1, y + 3, 10, 1); }
      rc(g, 'r', 30, 66, 4, 2); rc(g, 'o', 88, 68, 4, 2);
      const marks = T.has('level-bad') ? [[30, 38], [98, 26]] : T.has('level-eye') ? [[30, 31], [98, 29]] : T.has('level-good') ? [[30, 30], [98, 30]] : null;
      if (marks) {
        if (T.has('level-good')) for (let x = 30 + (f % 2); x <= 98; x += 2) px(g, 'r', x, 30);
        if (T.has('level-eye')) for (let x = 30; x <= 98; x += 4) px(g, 'G', x, Math.round(31 + (29 - 31) * (x - 30) / 68));
        if (T.has('level-bad')) for (let x = 30; x <= 98; x += 5) px(g, 'G', x, Math.round(38 + (26 - 38) * (x - 30) / 68));
        marks.forEach(([mx, my]) => { rc(g, 'k', mx - 2, my, 5, 1); rc(g, 'k', mx, my - 2, 1, 5);
          if (T.has('holes-ok')) { rc(g, '+', mx - 1, my + 4, 3, 3); rc(g, 'g', mx - 1, my + 6, 3, 1); rc(g, '#', mx, my + 4, 1, 1); }
          if (T.has('holes-bad')) { rc(g, '-', mx - 2, my + 3, 5, 4); line(g, 'k', mx - 2, my + 3, mx - 5, my + 9); line(g, 'k', mx + 2, my + 6, mx + 5, my + 10); for (const d of [[-3, 8], [4, 9], [0, 10]]) px(g, 'w', mx + d[0], my + d[1]); }
          if (T.has('holes-glue')) { rc(g, 'e', mx - 3, my + 3, 7, 3); rc(g, 'Y', mx - 3, my + 5, 7, 1); rc(g, 'G', mx, my + 1, 1, 4); px(g, 'g', mx, my); }
        });
      }
    } else {
      const lv = T.has('level-bad') ? [24, 34, 104, 24] : T.has('level-eye') ? [24, 32, 104, 28] : [24, 30, 104, 30];
      const heavy = T.has('load-heavy');
      const wob = T.has('shelf-wobble') && f % 2 === 1 ? 1 : 0;
      shelf(lv[0], lv[1] + wob, lv[2], lv[3] + (T.has('shelf-wobble') && f % 2 === 0 ? 1 : 0), heavy ? 3 : 0);
      if (T.has('shelf-wobble')) { dith(g, '3', lv[0] + 6, lv[1] + 6, 8, 2); }
      if (T.has('book')) { rc(g, 'R', 24, lv[1] + 4, 14, 5); rc(g, 'r', 25, lv[1] + 5, 12, 3); rc(g, '+', 25, lv[1] + 8, 12, 1); }
      const items = T.has('load-light') ? [['o', 'O', 36, 10, 4], ['b', 'B', 42, 12, 5]] : T.has('load-ok') ? [['b', 'B', 34, 14, 5], ['o', 'O', 40, 12, 4], ['N', 'n', 45, 15, 5], ['r', 'R', 51, 13, 4]] : heavy ? [['b', 'B', 30, 16, 5], ['o', 'O', 36, 14, 5], ['p', 'P', 42, 17, 5], ['N', 'n', 48, 13, 5], ['r', 'R', 54, 16, 5], ['y', 'Y', 60, 13, 5], ['b', 'B', 66, 15, 5], ['r', 'R', 72, 12, 5], ['N', 'n', 78, 17, 5], ['o', 'O', 84, 14, 5]] : [];
      for (const [c, d, x, h, w] of items) { const y = shelfY(x, ...lv) - h; rc(g, d, x, y, w, h); rc(g, c, x + 1, y + 1, w - 2, h - 2); rc(g, '+', x + 1, y + 3, w - 2, 1); }
      if (T.has('load-ok')) { const x = 78, y = shelfY(x, ...lv) - 14; rc(g, 'c', x, y + 4, 10, 10); rc(g, 'a', x + 1, y + 5, 8, 8); rc(g, 'N', x + 4, y - 4, 2, 8); rc(g, 'n', x + 1, y - 2, 4, 3); rc(g, 'n', x + 6, y - 3, 4, 3); }
    }
    return g;
  }


  // ---------------------------------------------------------------- SIEDZIBA FIRMY
  function win(g, x, y, w, h, lvl) {
    const frame = ['T', 't', '+', '+'][lvl];
    rc(g, '&', x - 1, y - 1, w + 2, h + 2); rc(g, frame, x, y, w, h); rc(g, lvl >= 3 ? 'b' : '^', x + 1, y + 1, w - 2, h - 2); dith(g, lvl >= 3 ? 'c' : '~', x + 1, y + 1, w - 2, (h - 2) >> 1);
    if (HQ_NIGHT) { rc(g, 'y', x + 1, y + 1, w - 2, h - 2); dith(g, 'e', x + 1, y + 1, w - 2, h - 2); }
    rc(g, frame, x + (w >> 1), y, 1, h); if (h > 8) rc(g, frame, x, y + (h >> 1), w, 1); rc(g, '#', x - 1, y + h, w + 2, 1);
    if (lvl === 0) { line(g, 'k', x + 1, y + 1, x + 3, y + 3); px(g, 'k', x + 4, y + 2); }
  }
  function doorAt(g, x, y, w, h, lvl) {
    const c = ['T', 't', '&', 'G'][lvl];
    rc(g, 'k', x - 1, y - 1, w + 2, h + 1); rc(g, c, x, y, w, h); rc(g, lvl >= 2 ? '%' : '8', x, y, w, 1); rc(g, lvl >= 2 ? '%' : '8', x, y, 1, h);
    if (lvl >= 3) { rc(g, 'c', x + 2, y + 2, w - 4, 4); rc(g, 'y', x + w + 2, y + 6, 2, 3); } rc(g, 'y', x + w - 3, y + (h >> 1), 2, 2); dith(g, '8', x + 1, y + h - 5, w - 2, 4);
  }
  function roofFill(g, pts, lvl, snow) {
    const c = ['R', 'd', 'r', 'B'][lvl], hl = ['r', 'G', 'R', 'b'][lvl];
    pts.forEach(([x, y, w, h]) => { rc(g, c, x, y, w, h); dith(g, hl, x, y, w, h, y); if (lvl === 0) for (let i = 0; i < w; i += 11) rc(g, 'k', x + 4 + i, y + 1, 2, 1); if (lvl === 2) for (let j = y; j < y + h; j += 2) rc(g, 'R', x, j, w, 1); if (snow) rc(g, '+', x, y, w, 1); });
  }
  function van(g, x, y, lvl) {
    const body = lvl === 3 ? 'y' : lvl === 0 ? 'g' : '+', shade = lvl === 3 ? 'Y' : lvl === 0 ? 'G' : '=';
    rc(g, 'k', x - 1, y - 1, 32, 15); rc(g, body, x, y, 30, 12); rc(g, shade, x, y + 9, 30, 3); rc(g, body, x + 20, y - 4, 8, 4); rc(g, 'k', x + 19, y - 5, 10, 1);
    rc(g, 'c', x + 21, y - 3, 6, 4); rc(g, 'c', x + 22, y + 2, 6, 4); rc(g, 'k', x + 21, y + 6, 8, 1);
    if (lvl === 0) { dith(g, 'O', x + 2, y + 6, 10, 5); rc(g, 'c', x + 4, y + 2, 12, 4); } else rc(g, 'c', x + 3, y + 2, 14, 4);
    if (lvl >= 2) rc(g, 'b', x, y + 7, 30, 2);
    if (lvl === 3) { rc(g, 'k', x + 6, y + 4, 8, 3); rc(g, 'y', x + 8, y + 3, 4, 2); }
    for (const wx of [x + 5, x + 22]) { disc(g, 'k', wx, y + 12, 3); disc(g, 'd', wx, y + 12, 2); px(g, 'g', wx, y + 12); }
    rc(g, 'r', x + 29, y + 8, 1, 2); rc(g, 'e', x + 29, y + 2, 1, 2);
  }
  function hq(o, f) {
    o = o || {}; HQ_NIGHT = !!o.night; const tier = o.tier || 0, up = o.up || {}, as = o.assets || {}, season = o.season || 'wiosna', fr = f || 0, g = G(), u = k => up[k] || 0, winter = season === 'zima';
    // niebo
    rc(g, winter ? '4' : '~', 0, 0, W, 60); rc(g, winter ? '5' : '^', 0, 0, W, 6); dith(g, winter ? '5' : '^', 0, 6, W, 8); dith(g, winter ? '5' : '^', 0, 14, W, 5, 1);
    const cloud = (x, y) => { disc(g, '#', x, y, 4); disc(g, '#', x + 6, y - 1, 5); disc(g, '#', x + 13, y, 4); rc(g, '#', x, y, 18, 4); dith(g, '%', x, y + 3, 18, 2); };
    if (HQ_NIGHT) { rc(g, 'B', 0, 0, W, 60); dith(g, 'd', 0, 30, W, 30, 0); for (let i = 0; i < 26; i++) if ((i + fr) % 4 !== 0) px(g, 'w', (i * 41) % W, (i * 13) % 34); disc(g, 'e', 104, 10, 6); disc(g, 'B', 107, 8, 5); }
    else { cloud(8 + (fr % 8), 8); cloud(82 - (fr % 8), 16); }
    if (season === 'lato' && !HQ_NIGHT) { disc(g, 'e', 112, 10, 7); disc(g, 'y', 112, 10, 5); }
    // ziemia i droga
    const gr = winter ? '+' : '$'; rc(g, gr, 0, 60, W, 8); dith(g, winter ? '#' : '!', 0, 60, W, 8, 1);
    if (season === 'wiosna') for (let i = 0; i < 18; i++) px(g, ['m', 'y', 'w'][i % 3], (i * 37) % W, 62 + (i * 5) % 6);
    if (season === 'jesień') for (let i = 0; i < 24; i++) px(g, ['o', 'r', 'y'][i % 3], (i * 29) % W, 61 + (i * 7) % 7);
    rc(g, '%', 0, 66, W, 2); rc(g, '&', 0, 68, W, 12); dith(g, 'G', 0, 68, W, 12, 1); for (let x = 4; x < W; x += 16) rc(g, 'y', x, 75, 8, 1);
    if (winter) { dith(g, '#', 0, 66, W, 2); dith(g, '+', 0, 68, W, 2); }
    let dx = 60, dy = 46, top = 40, x0 = 40, x1 = 88;
    const snowRoof = winter;
    if (tier === 0) {
      x0 = 36; x1 = 92; top = 40; rc(g, 'k', 35, 39, 58, 23); rc(g, 'R', 36, 42, 56, 20); dith(g, 'r', 36, 42, 56, 20); for (let y = 44; y < 62; y += 4) rc(g, 'R', 36, y, 56, 1); for (let y = 42, r = 0; y < 62; y += 4, r++) for (let x = 36 + (r % 2) * 4; x < 92; x += 8) rc(g, 'R', x, y, 1, 4);
      roofFill(g, [[33, 37, 62, 5]], u('dach'), snowRoof);
      rc(g, 'k', 43, 46, 30, 16); rc(g, '%', 44, 47, 28, 15); for (let y = 49; y < 62; y += 3) rc(g, '&', 44, y, 28, 1); rc(g, '#', 44, 47, 28, 1);
      dx = 78; dy = 48; win(g, 78, 47, 11, 9, u('okna'));
    } else if (tier === 1) {
      x0 = 18; x1 = 110; top = 38; rc(g, 'k', 17, 37, 94, 25); rc(g, '%', 18, 40, 92, 22); for (let x = 19; x < 110; x += 4) { rc(g, '&', x, 40, 1, 22); } dith(g, '#', 18, 40, 92, 2);
      roofFill(g, [[15, 34, 98, 3], [18, 37, 92, 3]], u('dach'), snowRoof);
      win(g, 26, 46, 14, 9, u('okna')); win(g, 46, 46, 14, 9, u('okna')); dx = 92; dy = 46; doorAt(g, 92, 46, 12, 16, u('drzwi'));
    } else if (tier === 2) {
      x0 = 32; x1 = 96; top = 40; rc(g, 'k', 31, 39, 66, 23); rc(g, '2', 32, 40, 64, 22); dith(g, '3', 32, 40, 64, 22); line(g, '3', 40, 42, 44, 54); line(g, '3', 82, 44, 78, 58); dith(g, '=', 32, 58, 64, 4, 1);
      for (let r = 0; r < 20; r++) { const wdt = 70 - r * 3; rc(g, ['R', 'd', 'r', 'B'][u('dach')], 64 - wdt / 2 | 0, 40 - r, wdt, 1); if (wdt < 4) break; }
      for (let r = 0; r < 20; r++) { const wdt = 70 - r * 3; if (wdt < 4) break; dith(g, ['r', 'G', 'R', 'b'][u('dach')], 64 - wdt / 2 | 0, 40 - r, wdt, 1, r); if (snowRoof) { rc(g, '+', 64 - wdt / 2 | 0, 40 - r, 2, 1); rc(g, '+', 64 + wdt / 2 - 2 | 0, 40 - r, 2, 1); } }
      rc(g, 'R', 82, 22, 7, 14); rc(g, 'r', 82, 22, 7, 2); dith(g, 'k', 83, 25, 5, 10); if (u('ogrz') > 0) { disc(g, '#', 86, 18 - (fr % 3), 3); disc(g, '%', 89 + (fr % 2), 13 - (fr % 3), 2); }
      win(g, 38, 46, 12, 10, u('okna')); win(g, 78, 46, 12, 10, u('okna')); dx = 57; dy = 46; doorAt(g, 57, 46, 12, 16, u('drzwi'));
    } else if (tier === 3) {
      x0 = 22; x1 = 106; top = 24; rc(g, 'k', 21, 23, 86, 39); rc(g, '1', 22, 26, 84, 36); dith(g, '2', 22, 26, 84, 36, 1); rc(g, 'G', 20, 20, 88, 6); rc(g, '%', 20, 20, 88, 1);
      roofFill(g, [[20, 21, 88, 2]], u('dach'), snowRoof);
      for (const y of [30, 44]) for (const x of [28, 46, 78, 96]) win(g, x, y, 10, 9, u('okna'));
      dx = 57; dy = 46; doorAt(g, 57, 46, 14, 16, u('drzwi'));
      for (const x of [2, 106]) { rc(g, 'G', x, 52, 20, 1); rc(g, 'G', x, 60, 20, 1); for (let k = 0; k < 20; k += 3) rc(g, 'G', x + k, 52, 1, 9); }
      rc(g, 'T', 10, 44, 3, 9); disc(g, 'N', 11, 40, 6); dith(g, 'n', 5, 34, 12, 12);
    } else if (tier === 4) {
      x0 = 10; x1 = 118; top = 30; rc(g, 'k', 9, 29, 78, 33); rc(g, 'b', 10, 32, 76, 30); for (let x = 12; x < 86; x += 4) rc(g, 'B', x, 32, 1, 30); dith(g, 'c', 10, 32, 76, 3);
      roofFill(g, [[8, 27, 80, 5]], u('dach'), snowRoof);
      rc(g, 'k', 25, 41, 40, 21); rc(g, '&', 26, 42, 38, 20); for (let y = 44; y < 62; y += 3) rc(g, '%', 26, y, 38, 1); rc(g, 'y', 26, 42, 38, 1);
      rc(g, 'k', 85, 35, 33, 27); rc(g, '2', 86, 38, 31, 24); dith(g, '3', 86, 38, 31, 24, 1); rc(g, 'G', 84, 34, 35, 5); roofFill(g, [[84, 35, 35, 2]], u('dach'), snowRoof);
      win(g, 90, 44, 10, 9, u('okna')); win(g, 104, 44, 10, 9, u('okna')); win(g, 14, 36, 8, 6, u('okna')); win(g, 70, 36, 8, 6, u('okna')); dx = 96; dy = 46; doorAt(g, 106, 52, 8, 10, u('drzwi'));
    } else {
      x0 = 34; x1 = 94; top = 6; rc(g, 'k', 33, 5, 62, 57); rc(g, 'c', 34, 6, 60, 56); for (let y = 8; y < 60; y += 7) rc(g, 'b', 34, y, 60, 1); for (let x = 40; x < 94; x += 10) rc(g, 'b', x, 6, 1, 56);
      for (const [x, y] of [[36, 8], [56, 22], [78, 12], [44, 36], [70, 40]]) { rc(g, '#', x, y, 4, 1); rc(g, '#', x + 1, y + 1, 2, 1); }
      rc(g, 'B', 32, 3, 64, 3); roofFill(g, [[32, 3, 64, 1]], u('dach'), snowRoof);
      rc(g, 'k', 95, 34, 28, 28); rc(g, 'c', 96, 36, 26, 26); for (let x = 102; x < 122; x += 6) rc(g, 'b', x, 36, 1, 26); rc(g, 'B', 94, 33, 30, 3);
      dx = 56; dy = 46; doorAt(g, 56, 46, 14, 16, u('drzwi'));
      for (const x of [38, 80]) rc(g, 'y', x, 52, 8, 1);
    }
    // ruch na ulicy i ptaki
    { const cx = (fr * 22) % 170 - 24; rc(g, 'k', cx - 1, 70, 14, 7); rc(g, ['r', 'b', 'n', 'o'][Math.floor(fr / 2) % 4], cx, 71, 12, 4); rc(g, 'c', cx + 7, 69, 4, 2); rc(g, 'k', cx + 2, 76, 3, 2); rc(g, 'k', cx + 8, 76, 3, 2); if (HQ_NIGHT) { rc(g, 'y', cx + 12, 72, 3, 2); } }
    if (!HQ_NIGHT) for (const [bx, by] of [[(fr * 9 + 10) % 150 - 10, 14], [(fr * 7 + 70) % 150 - 10, 22]]) { px(g, 'k', bx, by + (fr % 2)); px(g, 'k', bx + 1, by + 1); px(g, 'k', bx + 2, by + (fr % 2)); }
    // szyld
    const sx = Math.max(6, Math.min(W - 30, dx - 8)), sy = tier === 5 ? 38 : Math.max(8, Math.min(dy - 10, 36));
    if (u('szyld') === 1) { rc(g, 'k', sx - 1, sy - 1, 26, 9); rc(g, '+', sx, sy, 24, 7); rc(g, 'r', sx + 2, sy + 2, 20, 3); }
    if (u('szyld') >= 2) { rc(g, 'k', sx - 1, sy - 1, 28, 10); rc(g, 'y', sx, sy, 26, 8); dith(g, 'e', sx, sy, 26, 8); rc(g, 'k', sx + 2, sy + 2, 18, 1); rc(g, 'k', sx + 2, sy + 5, 12, 1); if (u('szyld') === 3) { disc(g, 'b', sx + 22, sy + 4, 2); } if (fr % 2 === 0) dith(g, 'w', sx, sy, 26, 1); }
    // alarm, kamery
    if (u('alarm') >= 1) { rc(g, 'r', dx - 6, dy + 2, 4, 5); rc(g, 'w', dx - 5, dy + 3, 2, 1); }
    if (u('alarm') >= 2) { rc(g, 'k', x0 + 1, top + 2, 5, 4); rc(g, fr % 2 ? 'r' : 'y', x0 + 2, top + 3, 3, 2); }
    if (u('kamery') >= 1) { rc(g, 'G', x1 - 6, top + 3, 7, 3); rc(g, 'd', x1 - 8, top + 4, 3, 5); rc(g, '&', x1 - 6, top + 3, 7, 1); if (u('kamery') >= 2) px(g, fr % 2 ? 'r' : 'R', x1 - 6, top + 5); }
    // ochrona: pies, ogrodzenie, ochroniarz
    if (u('ochrona') >= 1) { const px0 = Math.max(6, dx - 26), t = fr % 2; rc(g, 'h', px0, 55, 9, 5); rc(g, 'H', px0, 59, 9, 1); rc(g, 'h', px0 + 8, 52, 4, 5); rc(g, 'H', px0 + 11, 53, 2, 1); px(g, 'k', px0 + 10, 53); rc(g, 'h', px0 - 2, 54 - t, 2, 2); rc(g, 'H', px0 + 1, 60, 1, 2); rc(g, 'H', px0 + 7, 60, 1, 2); }
    if (u('ochrona') >= 2) { for (let x = 4; x < W - 4; x += 6) { if (x > dx - 8 && x < dx + 20) continue; rc(g, 'G', x, 56, 1, 8); px(g, '%', x, 56); } for (const y of [58, 62]) { rc(g, 'G', 4, y, Math.max(0, dx - 12), 1); rc(g, 'G', dx + 20, y, W - dx - 24, 1); } rc(g, 'd', dx - 9, 55, 2, 9); rc(g, 'd', dx + 19, 55, 2, 9); px(g, 'y', dx - 9, 55); px(g, 'y', dx + 20, 55); }
    if (u('ochrona') >= 3) { const gx = Math.min(W - 18, dx + 24); rc(g, 'k', gx, 49, 6, 13); rc(g, 's', gx + 1, 50, 4, 4); rc(g, 'B', gx, 49, 6, 2); rc(g, 'y', gx + 1, 54, 4, 5); rc(g, 'd', gx + 1, 59, 2, 3); rc(g, 'd', gx + 3, 59, 2, 3); }
    // narzędzia przy drzwiach
    if (o.tools > 0) { rc(g, 'k', dx - 14, 58, 9, 5); rc(g, 'r', dx - 13, 59, 7, 3); rc(g, 'y', dx - 11, 58, 3, 1); }
    // bus lub stare kombi
    van(g, 92, 63, as.bus || 0);
    return g;
  }



  // ---------------------------------------------------------------- KUCHNIA: zapchany zlew (syfon)
  function syfon(T, f, o) {
    o = o || {}; const g = G();
    tiledWall(g, 34); rc(g, '1', 0, 34, W, 28); dith(g, '2', 0, 34, W, 28, 1); skirting(g, 58, '3'); woodFloor(g, 62);
    // okno
    rc(g, '&', 6, 6, 24, 22); rc(g, '+', 7, 7, 22, 20); rc(g, '^', 9, 9, 18, 16); dith(g, '~', 9, 9, 18, 7); rc(g, '+', 17, 9, 2, 16);
    if (o.night) { nightGlass(g, 9, 9, 18, 16, f); rc(g, '+', 17, 9, 2, 16); }
    // blat, zlew, bateria
    rc(g, '8', 28, 31, 80, 4); rc(g, '9', 28, 31, 80, 1); rc(g, '-', 28, 35, 80, 1);
    rc(g, 'G', 44, 26, 44, 7); rc(g, 'g', 45, 27, 42, 5); rc(g, '#', 45, 27, 42, 1); rc(g, 'G', 46, 31, 40, 1);
    rc(g, '%', 64, 14, 4, 12); rc(g, '#', 64, 14, 1, 12); rc(g, '%', 60, 12, 12, 3); rc(g, '&', 71, 14, 1, 9); rc(g, 'a', 71, 23 + (f % 2), 1, 1);
    // szafka: otwarta, widać rury
    rc(g, '8', 28, 36, 80, 26); rc(g, '_', 31, 38, 74, 22); dith(g, 'd', 31, 38, 74, 22, 1); rc(g, '9', 28, 36, 3, 26); rc(g, '9', 105, 36, 3, 26); rc(g, '8', 28, 60, 80, 2);
    // odpływ i rura do ściany
    rc(g, 'g', 62, 33, 4, 10); rc(g, '#', 62, 33, 1, 10); rc(g, 'G', 65, 33, 1, 10);
    rc(g, 'g', 80, 40, 24, 4); rc(g, '#', 80, 40, 24, 1); rc(g, 'G', 80, 43, 24, 1);
    const trapOut = has(T, 'trap-off', 'pipe-clean');
    const clogged = T.has('broken') && !has(T, 'trap-off', 'pipe-clean', 'gasket-new', 'gasket-old', 'silicone', 'drain-ok', 'drain-quick', 'drain-none', 'plunger', 'hot-water');
    const leaking = clogged && !has(T, 'bucket', 'bucket-only', 'towel');
    if (!trapOut) {
      rc(g, 'g', 62, 42, 4, 6); rc(g, 'g', 62, 46, 18, 4); rc(g, 'g', 77, 40, 4, 10);
      rc(g, '#', 62, 46, 18, 1); rc(g, 'G', 63, 49, 17, 1); rc(g, '#', 77, 40, 1, 10); rc(g, 'G', 80, 40, 1, 10);
      rc(g, 'y', 61, 44, 6, 2); rc(g, 'Y', 61, 45, 6, 1); rc(g, 'y', 76, 38, 6, 2); rc(g, 'Y', 76, 39, 6, 1);
      if (clogged) { rc(g, 'T', 64, 47, 14, 2); dith(g, 'H', 66, 47, 10, 2); }
    } else { // brak syfonu: widać otwarte końcówki
      rc(g, 'k', 62, 43, 4, 2); rc(g, 'k', 77, 40, 4, 2); rc(g, 'y', 61, 42, 6, 1); rc(g, 'y', 76, 38, 6, 1);
      rc(g, 'g', 84, 55, 18, 4); rc(g, 'g', 84, 49, 4, 8); rc(g, 'g', 98, 49, 4, 8); rc(g, '#', 84, 55, 18, 1); rc(g, 'y', 83, 49, 6, 1); rc(g, 'y', 97, 49, 6, 1); rc(g, 'k', 88, 56, 10, 2);
      if (T.has('pipe-clean')) { for (let i = 0; i < 10; i++) { px(g, 'g', 88 + i, 52 + ((i + f) % 2)); px(g, '#', 88 + i, 51 + ((i * 3) % 3)); } for (const [x, y] of [[90, 48], [96, 46], [100, 50]]) px(g, f % 2 ? 'w' : 'e', x, y); }
      else { rc(g, 'T', 88, 54, 8, 2); dith(g, 'H', 87, 53, 10, 3); }
    }
    // kapanie z nieszczelnego syfonu
    if (leaking) { const y = [50, 53, 56, 59][f % 4]; rc(g, 'a', 70, y, 2, 3); px(g, '#', 71, y); rc(g, 'a', 62, 52, 1, 3); }
    // woda w zlewie
    if (clogged) { rc(g, 'a', 47, 28, 38, 4); dith(g, '#', 49 + (f % 2) * 3, 28, 12, 1); dith(g, 'A', 60, 30, 16, 1); for (const [x, y] of [[52, 27], [68, 26], [78, 27]]) px(g, 'w', x + (f % 2), y); }
    // przygotowanie
    if (T.has('bucket')) { rc(g, 'b', 62, 51, 20, 10); rc(g, 'B', 62, 59, 20, 2); rc(g, 'c', 63, 51, 18, 1); rc(g, 'B', 62, 51, 1, 10); rc(g, 'B', 81, 51, 1, 10); rc(g, 'N', 24, 63, 12, 4); rc(g, 'n', 24, 64, 10, 2); rc(g, '+', 24, 66, 14, 2); }
    if (T.has('bucket-only')) { rc(g, 'b', 62, 55, 16, 6); rc(g, 'B', 62, 59, 16, 2); rc(g, 'a', 83, 61, 10, 1); dith(g, 'a', 80, 62, 14, 1); }
    if (T.has('towel')) { rc(g, 'w', 56, 60, 28, 3); rc(g, 'm', 56, 60, 28, 1); rc(g, 'a', 60, 62, 20, 1); dith(g, 'a', 58, 61, 26, 1); }
    // rozkręcanie
    if (T.has('trap-off')) { for (const [x, y] of [[88, 47], [94, 52]]) { rc(g, 'N', x, y, 4, 4); rc(g, 'n', x, y, 4, 1); } rc(g, 'n', 12, 62, 14, 2); spr(g, 10, 60, CHECK); }
    if (T.has('trap-wrench')) { rc(g, 'R', 60, 44, 8, 4); for (const [x, y] of [[61, 45], [64, 46], [66, 44]]) px(g, 'r', x, y); rc(g, 'R', 75, 39, 8, 3); px(g, 'r', 78, 40); line(g, 'G', 54, 36, 62, 44, 2); rc(g, 'k', 52, 34, 4, 5); disc(g, 'Y', 12, 62, 4); spr(g, 9, 60, CHECK_Y); }
    if (T.has('chem')) { rc(g, 'n', 93, 44, 4, 10); rc(g, 'N', 93, 52, 4, 2); rc(g, 'e', 94, 41, 2, 3); for (let i = 0; i < 6; i++) disc(g, i % 2 ? 'e' : 'n', 52 + i * 6 + ((f + i) % 3), 22 - ((f + i * 2) % 4) * 2, 1); disc(g, 'R', 12, 62, 4); disc(g, 'r', 12, 62, 3); spr(g, 10, 59, BANG.map(r => r.replace(/k/g, 'w').replace(/y/g, 'r'))); }
    // czyszczenie
    if (T.has('plunger')) { rc(g, 'R', 60, 21, 10, 5); rc(g, 'r', 61, 21, 8, 3); rc(g, 'T', 64, 8, 2, 14); rc(g, 'h', 64, 8, 2, 3); }
    if (T.has('hot-water')) { for (let i = 0; i < 5; i++) { const x = 52 + i * 8 + ((f + i) % 2), y = 20 - ((f * 2 + i * 3) % 12); rc(g, '#', x, y, 3, 2); px(g, 'w', x + 1, y - 1); } rc(g, 'o', 100, 22, 8, 9); rc(g, 'O', 100, 30, 8, 1); rc(g, 'G', 108, 24, 3, 2); }
    // uszczelnianie
    if (T.has('gasket-new') && !trapOut) { for (const [x, y, w] of [[60, 43, 8], [75, 37, 8]]) { rc(g, 'o', x, y, w, 2); rc(g, 'O', x, y + 2, w, 1); } rc(g, 'o', 63, 47, 2, 2); }
    if (T.has('gasket-old') && !trapOut) { for (const [x, y, w] of [[60, 43, 8], [75, 37, 8]]) { rc(g, 'G', x, y, w, 2); rc(g, 'd', x, y + 2, w, 1); px(g, 'k', x + 2, y); px(g, 'k', x + 5, y + 1); } }
    if (T.has('silicone') && !trapOut) { for (const [x, y] of [[60, 43], [75, 37], [66, 47], [76, 48]]) { rc(g, 'w', x, y, 8, 3); px(g, '#', x + 1, y); rc(g, '=', x, y + 2, 8, 1); px(g, 'w', x + 3, y + 3); } }
    // próba odpływu
    if (T.has('drain-ok')) { rc(g, '#', 47, 28, 38, 3); disc(g, 'N', 100, 20, 5); disc(g, 'n', 100, 20, 4); spr(g, 97, 18, CHECK); }
    if (T.has('drain-quick')) { rc(g, 'a', 47, 29, 38, 2); disc(g, 'Y', 100, 20, 5); disc(g, 'e', 100, 20, 4); spr(g, 97, 18, CHECK_Y); }
    if (T.has('drain-none')) { disc(g, 'R', 100, 20, 5); disc(g, 'r', 100, 20, 4); spr(g, 98, 17, QMARK.map(r => r.replace(/r/g, 'w'))); }
    return g;
  }

  // ---------------------------------------------------------------- PRZEDPOKÓJ: drzwi, które nie domykają
  function drzwi(T, f, o) {
    o = o || {}; const g = G();
    wallpaper(g, 66, ['2', '3', '1']); skirting(g, 66, '3'); woodFloor(g, 70);
    rc(g, '9', 0, 70, 3, 10); // wycieraczka
    rc(g, 'T', 90, 71, 28, 6); rc(g, 't', 91, 72, 26, 4); dith(g, 'T', 92, 73, 24, 2);
    // ościeżnica i skrzydło
    rc(g, '8', 28, 4, 58, 66); rc(g, '7', 28, 4, 58, 1); rc(g, '_', 32, 8, 50, 62);
    const wedge = T.has('broken') && !has(T, 'hinge-ok', 'hinge-tight', 'hinge-glue', 'plane-good', 'plane-rough', 'plane-none');
    const sag = wedge ? 3 : 0;
    rc(g, 't', 33, 9, 48, 61 - sag); rc(g, 'T', 33, 9 + 61 - sag, 48, 0);
    for (const [x, y, w, h] of [[37, 13, 18, 22], [59, 13, 18, 22], [37, 40, 18, 22 - sag], [59, 40, 18, 22 - sag]]) { rc(g, 'T', x, y, w, h); rc(g, 't', x + 1, y + 1, w - 2, h - 2); dith(g, 'T', x + 2, y + 2, w - 4, 3, 1); }
    rc(g, 'T', 33, 9, 1, 61 - sag); rc(g, 'h', 33, 9, 48, 1);
    // szczelina u dołu i z boku
    if (wedge) { for (let i = 0; i < 5; i++) rc(g, 'k', 80 - i, 64 + i - sag, 1 + i, 1); rc(g, 'e', 77, 62, 4, 1); rc(g, 'k', 33, 69, 48, 1); dith(g, 'T', 40, 72, 20, 2); rc(g, 'T', 76, 70, 6, 1); }
    // klamka i zamek
    rc(g, 'G', 72, 38, 7, 10); rc(g, 'g', 73, 39, 5, 8); rc(g, 'k', 75, 41, 1, 3); rc(g, 'y', 66, 42, 9, 3); rc(g, 'Y', 66, 44, 9, 1); rc(g, 'y', 62, 41, 6, 5); rc(g, 'Y', 62, 45, 6, 1);
    // zawiasy
    for (const y of [14, 38, 60]) { rc(g, 'G', 28, y, 6, 7); rc(g, 'g', 29, y + 1, 4, 5); rc(g, 'k', 30, y + 2, 1, 3); px(g, 'd', 31, y + 3); }
    // diagnoza
    if (T.has('diag-good')) { rc(g, 'y', 38, 6, 38, 4); rc(g, 'Y', 38, 9, 38, 1); rc(g, 'c', 52, 7, 9, 2); rc(g, 'n', 56, 7, 2, 2); rc(g, 'k', 38, 6, 1, 4); rc(g, 'k', 75, 6, 1, 4); }
    if (T.has('diag-eye')) { for (const [x, y] of [[88, 8], [94, 14]]) { rc(g, 'Y', x, y, 8, 8); rc(g, 'e', x + 1, y + 1, 6, 6); spr(g, x + 1, y, QMARK.map(r => r.replace(/r/g, 'k'))); } }
    if (T.has('diag-kick')) { rc(g, 'k', 48, 52, 8, 6); rc(g, 'd', 49, 53, 6, 4); rc(g, 'k', 50, 58, 2, 1); rc(g, 'k', 54, 58, 2, 1); line(g, 'r', 40, 50, 44, 54); line(g, 'r', 44, 48, 48, 53); }
    // zawiasy po naprawie
    if (T.has('hinge-ok')) for (const y of [14, 38, 60]) { rc(g, 'n', 26, y, 2, 7); rc(g, 'o', 33, y + 1, 3, 5); px(g, 'w', 29, y + 1); }
    if (T.has('hinge-tight')) for (const y of [14, 38, 60]) { for (const dy of [1, 3, 5]) { rc(g, 'r', 29, y + dy, 2, 1); rc(g, 'R', 31, y + dy, 1, 1); } }
    if (T.has('hinge-glue')) for (const y of [14, 38, 60]) { rc(g, 'e', 26, y - 1, 12, 3); rc(g, 'Y', 26, y + 2, 12, 1); rc(g, 'e', 27, y + 8, 4, 3); px(g, 'w', 28, y); }
    // zamek po naprawie
    if (T.has('lock-new')) { rc(g, 'e', 71, 37, 9, 12); rc(g, 'y', 72, 38, 7, 10); rc(g, 'k', 74, 41, 2, 4); rc(g, '#', 72, 38, 7, 1); if (f % 4 < 2) { px(g, 'w', 78, 38); px(g, 'w', 71, 47); } }
    if (T.has('lock-oil')) { rc(g, 'o', 74, 47, 3, 3); rc(g, 'O', 75, 50, 1, 3 + (f % 3)); rc(g, 'o', 74, 46, 3, 1); }
    if (T.has('lock-tape')) { rc(g, 'g', 81, 40, 6, 7); rc(g, 'G', 81, 40, 1, 7); for (let i = 0; i < 6; i++) px(g, '=', 81 + i, 41 + (i % 3) * 2); }
    // dopasowanie skrzydła
    if (T.has('plane-good')) { rc(g, 'k', 81, 9, 1, 61); rc(g, 'k', 33, 69, 48, 1); for (let i = 0; i < 5; i++) px(g, 'e', 90 + i * 4, 76 - (i % 2)); }
    if (T.has('plane-rough')) { for (let y = 9; y < 70; y += 6) rc(g, 'k', 81 - ((y / 6) % 3), y, 1 + ((y / 6) % 3), 6); for (let i = 0; i < 12; i++) px(g, 'e', 84 + i * 3, 73 + (i % 3)); rc(g, 'e', 40, 73, 30, 1); }
    if (T.has('plane-none')) { rc(g, 'T', 78, 64, 8, 6); rc(g, 'h', 78, 64, 8, 1); rc(g, 'H', 78, 69, 8, 1); rc(g, 'k', 81, 9, 1, 55); }
    // próba
    if (T.has('door-ok')) { disc(g, 'N', 106, 24, 6); disc(g, 'n', 106, 24, 5); spr(g, 103, 22, CHECK); }
    if (T.has('door-quick')) { disc(g, 'Y', 106, 24, 6); disc(g, 'e', 106, 24, 5); spr(g, 103, 22, CHECK_Y); }
    if (T.has('door-untested')) { disc(g, 'R', 106, 24, 6); disc(g, 'r', 106, 24, 5); spr(g, 104, 21, QMARK.map(r => r.replace(/r/g, 'w'))); }
    if (o.night) { rc(g, 'y', 8, 8, 12, 10); rc(g, 'e', 9, 9, 10, 8); rc(g, 'k', 13, 6, 2, 2); }
    return g;
  }

  // ---------------------------------------------------------------- ŁAZIENKA: płytki w prysznicu
  function plytki(T, f, o) {
    o = o || {}; const g = G();
    rc(g, '4', 0, 0, W, 62); rc(g, '6', 0, 0, 14, 62); for (let y = 0; y < 62; y += 10) rc(g, '5', 0, y + 9, 14, 1); rc(g, '5', 13, 0, 1, 62); // stara płytka po lewej
    rc(g, '5', 106, 0, 22, 62); for (let y = 0; y < 62; y += 10) rc(g, '6', 106, y + 9, 22, 1); rc(g, '6', 106, 0, 1, 62);
    rc(g, '%', 0, 62, W, 3); rc(g, '+', 0, 65, W, 15); rc(g, 'G', 58, 70, 10, 3); rc(g, 'k', 61, 71, 4, 1); rc(g, '#', 0, 65, W, 1);
    const X0 = 18, Y0 = 8, WW = 82, HH = 54;
    // ściana pod płytki (stan podłoża)
    const hasGrid = has(T, 'lay-level', 'lay-eye', 'lay-crooked');
    if (!hasGrid) {
      if (has(T, 'base-good')) { rc(g, '3', X0, Y0, WW, HH); rc(g, '2', X0, Y0, WW, 1); for (let y = Y0 + 4; y < Y0 + HH; y += 9) dith(g, '1', X0 + 2, y, WW - 4, 1, y); }
      else if (has(T, 'base-quick')) { rc(g, 'G', X0, Y0, WW, HH); dith(g, 'g', X0, Y0, WW, HH); for (let i = 0; i < 14; i++) px(g, 'w', X0 + 3 + (i * 17) % (WW - 6), Y0 + 2 + (i * 11) % (HH - 4)); }
      else if (has(T, 'base-none')) { rc(g, '&', X0, Y0, WW, HH); dith(g, 'G', X0, Y0, WW, HH, 1); for (const [x, y, w, h] of [[26, 18, 10, 6], [60, 30, 12, 8], [40, 44, 9, 5], [80, 14, 10, 6]]) { rc(g, 'N', x, y, w, h); dith(g, 'k', x, y, w, h); } }
      else { rc(g, '&', X0, Y0, WW, HH); dith(g, 'G', X0, Y0, WW, HH, 1); line(g, 'k', 30, 12, 44, 30); line(g, 'k', 70, 10, 62, 28); for (let i = 0; i < 16; i++) px(g, 'g', X0 + 2 + (i * 13) % (WW - 4), Y0 + 2 + (i * 7) % (HH - 4)); rc(g, '4', 56, 8, 16, 6); rc(g, '4', 18, 8, 10, 4); }
      if (has(T, 'hydro-none')) { line(g, 'r', X0 + WW - 16, Y0 + 4, X0 + WW - 6, Y0 + 14, 2); line(g, 'r', X0 + WW - 6, Y0 + 4, X0 + WW - 16, Y0 + 14, 2); }
      if (has(T, 'hydro-good')) { rc(g, 'b', X0, Y0, WW, HH); dith(g, 'B', X0, Y0, WW, HH, 1); rc(g, 'w', X0, Y0, 3, HH); rc(g, 'w', X0 + WW - 3, Y0, 3, HH); rc(g, 'w', X0, Y0 + HH - 3, WW, 3); }
      if (has(T, 'hydro-thin')) { dith(g, 'c', X0, Y0, WW, HH); rc(g, 'c', X0, Y0 + HH - 2, WW, 2); }
      const gl = has(T, 'glue-comb') ? 1 : has(T, 'glue-blob') ? 2 : has(T, 'glue-sparse') ? 3 : 0;
      if (gl === 1) { rc(g, 'g', X0 + 6, Y0 + 6, WW - 12, HH - 12); for (let y = Y0 + 6; y < Y0 + HH - 6; y += 2) rc(g, 'G', X0 + 6, y, WW - 12, 1); rc(g, '#', X0 + 6, Y0 + 6, WW - 12, 1); }
      if (gl === 2) { rc(g, 'G', X0 + 6, Y0 + 6, WW - 12, HH - 12); for (let i = 0; i < 20; i++) { const x = X0 + 8 + (i * 19) % (WW - 22), y = Y0 + 8 + (i * 13) % (HH - 22); rc(g, 'g', x, y, 7, 4); px(g, '#', x + 1, y); } }
      if (gl === 3) { for (const [x, y] of [[30, 16], [56, 20], [76, 36], [38, 40], [60, 50]]) { rc(g, 'g', x, y, 7, 5); px(g, '#', x + 1, y); } }
    } else {
      // gotowa okładzina: 9 kolumn x 6 rzędów płytek
      const lvl = T.has('lay-level'), eye = T.has('lay-eye');
      rc(g, '6', X0, Y0, WW, HH);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {
        let x = X0 + 1 + c * 9, y = Y0 + 1 + r * 9, w = 8, h = 8;
        if (eye) y += ((c + r) % 3 === 0 ? 1 : 0) - (c === 4 ? 1 : 0);
        if (!lvl && !eye) { x += (r % 2 ? 2 : -1) + ((c * 3 + r) % 2); y += (c % 3) - 1; w = 7 + ((c + r) % 2); h = 7 + ((c * 2 + r) % 2); }
        rc(g, '+', x, y, w, h); rc(g, '#', x, y, w, 1); rc(g, '=', x, y + h - 1, w, 1); px(g, 'w', x + 1, y + 1);
      }
      const gr = has(T, 'grout-good') ? 'g' : has(T, 'grout-fast') ? 'g' : has(T, 'grout-none') ? 'k' : null;
      if (gr) { for (let c = 0; c <= 9; c++) rc(g, gr === 'k' ? 'd' : '%', X0 + c * 9, Y0, 1, HH); for (let r = 0; r <= 6; r++) rc(g, gr === 'k' ? 'd' : '%', X0, Y0 + r * 9, WW, 1); if (has(T, 'grout-good')) dith(g, '#', X0, Y0 + 27, WW, 1, 1); if (has(T, 'grout-fast')) for (const [x, y] of [[27, 17], [45, 35], [63, 26], [81, 44], [36, 8]]) { line(g, 'k', X0 + x - 18, y, X0 + x - 15, y + 3); px(g, 'k', X0 + x - 14, y + 4); } }
      else { for (let c = 0; c <= 9; c++) rc(g, '6', X0 + c * 9, Y0, 1, HH); }
    }
    // narożnik i silikon
    if (T.has('sil-good')) { rc(g, 'w', X0 - 2, Y0, 2, HH); rc(g, 'w', X0, Y0 + HH, WW, 2); rc(g, '#', X0 - 2, Y0, 1, HH); disc(g, 'N', 110, 20, 5); disc(g, 'n', 110, 20, 4); spr(g, 107, 18, CHECK); for (let i = 0; i < 4; i++) px(g, 'a', 24 + i * 16, 66 + (f % 2)); }
    if (T.has('sil-quick')) { rc(g, 'w', X0 - 2, Y0, 2, HH); rc(g, 'w', X0, Y0 + HH, WW, 2); disc(g, 'Y', 110, 20, 5); disc(g, 'e', 110, 20, 4); spr(g, 107, 18, CHECK_Y); }
    if (T.has('sil-none')) { rc(g, 'k', X0 - 2, Y0, 2, HH); rc(g, 'k', X0, Y0 + HH, WW, 2); disc(g, 'R', 110, 20, 5); disc(g, 'r', 110, 20, 4); spr(g, 108, 17, QMARK.map(r => r.replace(/r/g, 'w'))); }
    // narzędzia: wiaderko z klejem i pace
    rc(g, 'k', 104, 56, 14, 14); rc(g, 'b', 105, 57, 12, 12); rc(g, 'B', 105, 67, 12, 2); rc(g, 'g', 106, 58, 10, 3); rc(g, 'G', 108, 52, 3, 5);
    if (o.night) { rc(g, 'y', 8, 70, 8, 6); }
    return g;
  }


  // ---------------------------------------------------------------- SALON: zimny grzejnik
  function grzejnik(T, f, o) {
    o = o || {}; const g = G();
    wallpaper(g, 64, ['2', '3', '1']); skirting(g, 64, '3'); woodFloor(g, 68);
    // okno z zimą
    rc(g, '&', 8, 6, 34, 40); rc(g, '+', 9, 7, 32, 38); rc(g, '^', 11, 9, 28, 34); dith(g, '~', 11, 9, 28, 14); rc(g, '+', 24, 9, 2, 34); rc(g, '+', 11, 24, 28, 2); rc(g, '#', 7, 46, 36, 3);
    for (const [x, y] of [[14, 12], [30, 16], [18, 30], [33, 34], [13, 38]]) { px(g, 'w', x, y); px(g, 'w', x + 1, y); px(g, 'w', x, y + 1); }
    if (o.night) { nightGlass(g, 11, 9, 28, 34, f); rc(g, '+', 24, 9, 2, 34); rc(g, '+', 11, 24, 28, 2); }
    const warm = has(T, 'heat-ok', 'heat-quick');
    // grzejnik: 12 żeber
    rc(g, 'G', 22, 52, 62, 2); rc(g, 'G', 22, 70, 62, 1);
    for (let i = 0; i < 12; i++) { const x = 24 + i * 5; rc(g, 'k', x, 30, 5, 36); rc(g, warm ? 'o' : '+', x + 1, 31, 3, 34); rc(g, warm ? 'O' : '=', x + 3, 31, 1, 34); rc(g, '#', x + 1, 31, 1, 34); }
    rc(g, 'k', 22, 29, 62, 2); rc(g, '=', 22, 30, 62, 1); rc(g, 'k', 22, 65, 62, 2);
    if (warm) for (let i = 0; i < 6; i++) { const x = 28 + i * 9; for (let y = 0; y < 8; y++) px(g, y % 2 ? 'o' : 'e', x + ((y + f + i) % 3), 22 - y * 3 + 8); }
    else { for (let i = 0; i < 12; i++) { px(g, 'c', 25 + i * 5, 32); px(g, 'c', 27 + i * 5, 34); } rc(g, 'c', 24, 30, 60, 1); for (const [x, y] of [[40, 22], [60, 20], [74, 24]]) { px(g, 'c', x, y); px(g, 'c', x - 1, y + 1); px(g, 'c', x + 1, y + 1); px(g, 'c', x, y + 2); if (f % 2) px(g, 'w', x, y + 1); } }
    // zawór i rura
    rc(g, 'G', 86, 56, 10, 10); rc(g, 'g', 87, 57, 8, 8); rc(g, 'G', 90, 66, 4, 8); rc(g, 'r', 89, 44, 8, 12); rc(g, 'R', 89, 54, 8, 2); rc(g, 'w', 90, 46, 1, 6);
    // termometr
    rc(g, 'k', 104, 12, 8, 22); rc(g, '+', 105, 13, 6, 20); rc(g, warm ? 'r' : 'b', 107, warm ? 16 : 26, 2, warm ? 16 : 6); disc(g, warm ? 'r' : 'b', 108, 32, 2);
    // narzędzia: wiadro
    rc(g, 'b', 98, 70, 14, 8); rc(g, 'B', 98, 76, 14, 2); rc(g, 'c', 99, 70, 12, 1);
    // diagnoza
    if (T.has('heat-diag')) { disc(g, 'k', 100, 50, 7); disc(g, '+', 100, 50, 6); line(g, 'r', 100, 50, 104, 46); rc(g, 'n', 95, 52, 3, 1); rc(g, 'n', 103, 52, 3, 1); rc(g, 'k', 99, 57, 3, 4); }
    if (T.has('heat-touch')) { rc(g, 's', 50, 48, 7, 5); rc(g, 'S', 50, 52, 7, 1); for (let i = 0; i < 4; i++) rc(g, 's', 50 + i * 2, 45, 1, 3); px(g, 'w', 60, 44); px(g, 'c', 62, 46); }
    if (T.has('heat-max')) { rc(g, 'R', 86, 36, 20, 6); rc(g, 'r', 87, 37, 18, 4); for (let i = 0; i < 5; i++) rc(g, 'y', 89 + i * 3, 38, 2, 2); rc(g, 'k', 89, 44, 8, 1); }
    // woda
    if (T.has('valves-off')) { disc(g, 'N', 91, 61, 4); disc(g, 'n', 91, 61, 3); rc(g, 'n', 89, 61, 1, 1); disc(g, 'N', 22, 62, 4); disc(g, 'n', 22, 62, 3); spr(g, 19, 59, CHECK); }
    if (T.has('valve-one')) { disc(g, 'N', 91, 61, 4); disc(g, 'n', 91, 61, 3); disc(g, 'Y', 22, 62, 4); disc(g, 'e', 22, 62, 3); rc(g, 'a', 21, 66 + (f % 3) * 3, 2, 3); }
    if (T.has('valve-none')) { rc(g, 'a', 8, 72, 100, 6); dith(g, 'A', 10, 74, 96, 3, f); for (let x = (f * 5) % 12; x < 100; x += 12) rc(g, '#', 10 + x, 73, 4, 1); rc(g, 'a', 90, 66, 2, 6); }
    // zawór termostatyczny
    if (T.has('valve-new')) { rc(g, 'o', 86, 56, 10, 10); rc(g, 'e', 87, 57, 8, 3); rc(g, 'O', 87, 64, 8, 1); rc(g, 'n', 96, 58, 2, 2); }
    if (T.has('valve-clean')) { rc(g, 'G', 85, 55, 12, 3); rc(g, 'd', 85, 56, 12, 1); for (let i = 0; i < 12; i++) px(g, '=', 85 + i, 55 + ((i * 2) % 3)); }
    if (T.has('valve-hit')) { rc(g, 'k', 98, 52, 4, 10); rc(g, 'G', 94, 50, 10, 4); line(g, 'k', 88, 57, 92, 64); line(g, 'k', 92, 58, 94, 62); px(g, 'y', 97, 56); px(g, 'y', 99, 64 + (f % 2)); }
    // napełnianie
    if (T.has('fill-slow')) { disc(g, 'k', 76, 18, 8); disc(g, '+', 76, 18, 7); line(g, 'n', 76, 18, 80, 14); rc(g, 'n', 70, 22, 12, 1); }
    if (T.has('fill-fast')) { disc(g, 'k', 76, 18, 8); disc(g, '+', 76, 18, 7); line(g, 'y', 76, 18, 82, 18); rc(g, 'y', 70, 22, 12, 1); for (let i = 0; i < 3; i++) px(g, 'w', 92 + i * 2, 54 - ((f * 2 + i) % 5)); }
    if (T.has('fill-wild')) { disc(g, 'k', 76, 18, 8); disc(g, 'w', 76, 18, 7); line(g, 'r', 76, 18, 82, 12); rc(g, 'r', 70, 22, 12, 1); for (let i = 0; i < 5; i++) rc(g, 'a', 96 + i, 62 - i * 2, 1, 2 + (f % 2)); rc(g, 'a', 96, 70, 6, 8); }
    // próba
    if (T.has('heat-ok')) { disc(g, 'N', 108, 52, 6); disc(g, 'n', 108, 52, 5); spr(g, 105, 50, CHECK); }
    if (T.has('heat-quick')) { disc(g, 'Y', 108, 52, 6); disc(g, 'e', 108, 52, 5); spr(g, 105, 50, CHECK_Y); }
    if (T.has('heat-none')) { disc(g, 'R', 108, 52, 6); disc(g, 'r', 108, 52, 5); spr(g, 106, 49, QMARK.map(r => r.replace(/r/g, 'w'))); }
    return g;
  }

  // ---------------------------------------------------------------- SYPIALNIA: nieszczelne okno
  function okno(T, f, o) {
    o = o || {}; const g = G();
    wallpaper(g, 66, ['1', '2', '3']); skirting(g, 66, '3'); woodFloor(g, 70);
    const drafty = T.has('broken') && !has(T, 'wseal-new', 'wseal-patch', 'wseal-foam', 'adjust-good');
    // okno: dwa skrzydła
    rc(g, '&', 34, 4, 60, 54); rc(g, '+', 35, 5, 58, 52); rc(g, '^', 38, 8, 25, 46); rc(g, '^', 66, 8, 25, 46); dith(g, '~', 38, 8, 25, 18); dith(g, '~', 66, 8, 25, 18);
    for (const [x, y] of [[42, 14], [54, 30], [72, 20], [84, 38], [46, 46]]) { px(g, 'w', x, y); px(g, 'w', x + 1, y); px(g, 'w', x, y + 1); }
    if (o.night) { nightGlass(g, 38, 8, 25, 46, f); nightGlass(g, 66, 8, 25, 46, f); }
    rc(g, '+', 63, 5, 3, 52); rc(g, 'G', 61, 28, 2, 6); rc(g, 'g', 66, 28, 2, 6);
    rc(g, '#', 30, 58, 68, 4); rc(g, '=', 30, 61, 68, 1); rc(g, '%', 32, 62, 64, 1);
    // firanki i przeciąg
    const sway = drafty ? [0, 1, 2, 1][f % 4] : 0;
    for (const [x0, dir] of [[26, -1], [92, 1]]) { for (let y = 2; y < 64; y++) { const w = 7 + (y % 4 === 0 ? 1 : 0), off = Math.round(Math.sin(y / 9 + (drafty ? f * 0.9 : 0)) * (drafty ? 1.5 : 0.4)) + sway * (y > 30 ? dir * -1 : 0); rc(g, y % 3 ? 'p' : 'm', x0 + off, y, w, 1); } rc(g, 'P', x0, 2, 8, 1); }
    rc(g, 'P', 20, 0, 90, 2);
    if (drafty) for (let i = 0; i < 4; i++) { const x = 40 + i * 14 + ((f * 3) % 8), y = 50 - ((f * 5 + i * 6) % 24); rc(g, 'c', x, y, 3, 1); rc(g, 'w', x + 3, y, 1, 1); }
    // diagnoza
    if (T.has('wdiag-good')) { rc(g, 'w', 40, 54, 3, 6); rc(g, 'y', 41, 51 + (f % 2), 1, 3); px(g, 'e', 42, 51); rc(g, 'o', 42, 52, 1 + (f % 2), 1); rc(g, 'k', 38, 60, 8, 2); }
    if (T.has('wdiag-hand')) { rc(g, 's', 80, 44, 7, 5); rc(g, 'S', 80, 48, 7, 1); for (let i = 0; i < 4; i++) rc(g, 's', 80 + i * 2, 41, 1, 3); spr(g, 90, 38, QMARK.map(r => r.replace(/r/g, 'y'))); }
    if (T.has('wdiag-tape')) { for (const [x, y, w, h] of [[34, 28, 60, 2], [63, 4, 3, 54], [34, 54, 60, 2]]) { rc(g, 'g', x, y, w, h); dith(g, '=', x, y, w, h); } }
    // okucia
    if (T.has('adjust-good')) { for (const y of [14, 44]) { disc(g, 'N', 34, y, 3); disc(g, 'n', 34, y, 2); } disc(g, 'N', 64, 31, 3); disc(g, 'n', 64, 31, 2); spr(g, 100, 8, CHECK); }
    if (T.has('adjust-quick')) { for (const y of [14, 44]) { disc(g, 'Y', 34, y, 3); disc(g, 'e', 34, y, 2); } spr(g, 100, 8, CHECK_Y); }
    if (T.has('adjust-none')) { for (const y of [14, 44]) { disc(g, 'R', 34, y, 3); disc(g, 'r', 34, y, 2); } spr(g, 99, 6, QMARK.map(r => r.replace(/r/g, 'w'))); }
    // uszczelki
    if (T.has('wseal-new')) { for (const [x, y, w, h] of [[37, 7, 27, 1], [37, 54, 27, 1], [37, 7, 1, 47], [65, 7, 27, 1], [65, 54, 27, 1], [91, 7, 1, 47]]) rc(g, 'k', x, y, w, h); rc(g, 'G', 38, 55, 25, 1); }
    if (T.has('wseal-patch')) { for (const [x, y, w, h] of [[37, 7, 12, 1], [58, 54, 6, 1], [37, 30, 1, 12], [91, 12, 1, 16], [70, 7, 10, 1]]) rc(g, 'k', x, y, w, h); for (const [x, y] of [[50, 8], [60, 30], [88, 54]]) rc(g, 'G', x, y, 4, 2); rc(g, 'g', 52, 7, 5, 1); }
    if (T.has('wseal-foam')) for (const [x, y, w, h] of [[36, 6, 22, 3], [60, 52, 18, 4], [90, 10, 3, 24], [37, 30, 3, 16], [74, 6, 14, 3]]) { rc(g, 'e', x, y, w, h); dith(g, 'y', x, y, w, h); px(g, 'w', x, y); }
    // parapet
    if (T.has('sill-good')) { rc(g, 'w', 30, 57, 68, 2); rc(g, '#', 30, 56, 68, 1); rc(g, '=', 30, 62, 68, 1); rc(g, 'N', 100, 54, 6, 6); rc(g, 'n', 101, 55, 4, 4); }
    if (T.has('sill-silicone')) { rc(g, 'w', 32, 57, 64, 2); rc(g, 'a', 44, 58, 30, 3); dith(g, '#', 46 + (f % 2) * 2, 58, 12, 1); rc(g, 'A', 56, 61, 14, 1); }
    if (T.has('sill-none')) { rc(g, 'k', 31, 59, 66, 2); dith(g, 'd', 31, 58, 66, 3); for (const x of [40, 62, 84]) px(g, 'c', x + (f % 2), 61); }
    // próba
    if (T.has('wtest-ok')) { rc(g, 'w', 100, 40, 3, 6); rc(g, 'y', 101, 36, 1, 4); px(g, 'e', 101, 35); rc(g, 'o', 101, 37, 1, 1); disc(g, 'N', 110, 20, 5); disc(g, 'n', 110, 20, 4); spr(g, 107, 18, CHECK); }
    if (T.has('wtest-quick')) { disc(g, 'Y', 110, 20, 5); disc(g, 'e', 110, 20, 4); spr(g, 107, 18, CHECK_Y); }
    if (T.has('wtest-none')) { disc(g, 'R', 110, 20, 5); disc(g, 'r', 110, 20, 4); spr(g, 108, 17, QMARK.map(r => r.replace(/r/g, 'w'))); }
    return g;
  }

  // ---------------------------------------------------------------- POKÓJ: malowanie
  function malowanie(T, f, o) {
    o = o || {}; const g = G();
    const c1 = has(T, 'coat1-even', 'coat1-streak', 'coat1-thin'), c2 = has(T, 'coat2-good', 'coat2-spots', 'coat2-skip'), paint = c1 || c2;
    const base = has(T, 'primer-good') ? '+' : '2';
    rc(g, base, 0, 0, W, 64);
    if (T.has('primer-quick')) { rc(g, '2', 0, 0, W, 64); for (let i = 0; i < 18; i++) rc(g, '+', (i * 29) % 110, 4 + (i * 17) % 50, 12 + (i % 4) * 3, 6 + (i % 3) * 3); }
    if (T.has('primer-none')) { rc(g, '2', 0, 0, W, 64); for (const [x, y] of [[14, 10], [40, 30], [76, 14], [96, 44], [58, 48]]) { rc(g, '3', x, y, 9, 6); line(g, 'k', x, y + 6, x + 9, y + 6); px(g, '1', x + 2, y + 6 + (f % 2)); } }
    if (paint) {
      const col = c2 && !has(T, 'coat2-skip') ? 'b' : 'c';
      rc(g, col, 0, 0, W, 64);
      if (T.has('coat1-even') || T.has('coat2-good')) { dith(g, '~', 0, 0, W, 64); rc(g, 'c', 0, 0, W, 3); }
      if (T.has('coat1-streak')) for (let x = 6; x < W; x += 11) { rc(g, 'b', x, 0, 2, 64); rc(g, '2', x + 5, 6 + (x % 20), 1, 12); px(g, 'a', x + 5, 20 + (x % 20) + f % 2); }
      if (T.has('coat1-thin')) { dith(g, '2', 0, 0, W, 64); dith(g, '3', 0, 0, W, 64, 1); }
      if (T.has('coat2-spots')) for (const [x, y, w, h] of [[10, 8, 18, 10], [50, 26, 16, 12], [88, 10, 20, 9], [30, 44, 14, 9]]) rc(g, 'B', x, y, w, h);
      if (T.has('coat2-skip')) for (const [x, y, w, h] of [[10, 12, 18, 14], [64, 20, 22, 16], [96, 40, 18, 12]]) { rc(g, '2', x, y, w, h); dith(g, '3', x, y, w, h); }
    }
    if (!paint && !T.has('primer-good')) { for (let x = 3; x < W; x += 8) rc(g, '3', x, 0, 1, 64); line(g, 'k', 90, 6, 100, 22); line(g, 'k', 100, 22, 96, 34); line(g, 'k', 12, 40, 22, 50); }
    if (T.has('wprep-good')) { for (const [x, y] of [[90, 8], [12, 40]]) { rc(g, 'w', x, y, 14, 16); dith(g, '1', x, y, 14, 16); } }
    if (T.has('wprep-quick')) { for (const [x, y] of [[90, 8]]) rc(g, 'w', x, y, 12, 14); for (const [x1, y1, x2, y2] of [[14, 40, 24, 50], [70, 20, 76, 30]]) line(g, 'k', x1, y1, x2, y2); }
    if (T.has('wprep-none')) { rc(g, '3', 60, 6, 40, 36); dith(g, 'T', 60, 6, 40, 36); line(g, 'k', 70, 8, 80, 30); line(g, 'k', 90, 12, 84, 36); for (const [x, y] of [[66, 14], [92, 30]]) rc(g, 'T', x, y, 6, 5); }
    // okno, listwa, podłoga
    rc(g, '&', 4, 8, 30, 36); rc(g, '+', 5, 9, 28, 34); rc(g, '^', 7, 11, 24, 30); dith(g, '~', 7, 11, 24, 12); rc(g, '+', 18, 11, 2, 30);
    if (o.night) { nightGlass(g, 7, 11, 24, 30, f); rc(g, '+', 18, 11, 2, 30); }
    rc(g, '#', 3, 44, 32, 3);
    skirting(g, 64, '3'); woodFloor(g, 68);
    // zabezpieczenie
    if (T.has('mask-good')) { rc(g, 'o', 0, 63, W, 1); rc(g, 'o', 3, 8, 32, 1); rc(g, 'o', 3, 47, 32, 1); rc(g, 'o', 3, 8, 1, 39); rc(g, 'o', 35, 8, 1, 39); dith(g, 'w', 0, 68, W, 12, f % 2); rc(g, 'w', 0, 68, W, 1); }
    if (T.has('mask-quick')) { for (const [x, y, w, h] of [[2, 70, 30, 8], [40, 72, 22, 6], [74, 71, 30, 7]]) { rc(g, '=', x, y, w, h); rc(g, 'g', x, y, w, 1); for (let i = 2; i < h; i += 3) dith(g, 'G', x + 2, y + i, w - 4, 1); } }
    if (T.has('mask-none')) { for (const [x, y] of [[18, 70], [50, 74], [86, 72], [100, 66], [32, 76], [70, 70]]) { rc(g, 'c', x, y, 4 + (x % 4), 2); px(g, 'c', x + 2, y + 2); } rc(g, 'c', 3, 62, 30, 2); }
    if (T.has('clean-good')) { rc(g, 'w', 0, 63, W, 1); disc(g, 'N', 108, 22, 5); disc(g, 'n', 108, 22, 4); spr(g, 105, 20, CHECK); }
    if (T.has('clean-quick')) { for (const x of [6, 22, 40, 70, 96]) { rc(g, 'c', x, 63, 6, 1); px(g, 'c', x + 2, 62); px(g, 'b', x + 4, 61); } disc(g, 'Y', 108, 22, 5); disc(g, 'e', 108, 22, 4); spr(g, 105, 20, CHECK_Y); }
    if (T.has('clean-none')) { rc(g, 'o', 0, 63, W, 1); for (let i = 0; i < 5; i++) { rc(g, 'o', 3 + i * 22, 62 - (i % 2) * 2, 10, 2); } rc(g, 'w', 0, 68, 40, 12); dith(g, '=', 0, 68, 40, 12); disc(g, 'R', 108, 22, 5); disc(g, 'r', 108, 22, 4); spr(g, 106, 19, QMARK.map(r => r.replace(/r/g, 'w'))); }
    // wiadro z farbą i wałek
    rc(g, 'k', 90, 68, 20, 12); rc(g, 'b', 91, 69, 18, 10); rc(g, 'B', 91, 77, 18, 2); rc(g, 'c', 92, 69, 16, 2); rc(g, 'G', 104, 56, 2, 14); rc(g, 'T', 100, 52, 12, 5); rc(g, 'c', 101, 53, 10, 3);
    return g;
  }


  // ---------------------------------------------------------------- SCENA OGÓLNA dla robót z generatora (bez dedykowanej grafiki)
  /* Tło wg meta.tlo, przedmiot wg meta.obiekt, rząd etapów: szary = jeszcze nie, zielony = dobrze, żółty = skrót, czerwony = fuszerka. */
  function genericScene(id) {
    const job = GEN.JOBS[id], meta = GEN.META[id] || {}, q = {};
    job.steps.forEach((st, i) => st.options.forEach(o => { q[o.fx] = [i, o.id]; }));
    return function (T, f, o) {
      o = o || {}; const g = G(), tlo = meta.tlo || 'pokoj';
      if (tlo === 'lazienka') { tiledWall(g, 58); rc(g, '6', 0, 58, W, 22); for (let y = 60; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x >> 3) + ((y - 60) >> 3)) % 2 === 0) rc(g, '5', x, y, 8, 8); rc(g, '&', 0, 58, W, 2); }
      else if (tlo === 'kuchnia') { tiledWall(g, 34); rc(g, '1', 0, 34, W, 28); dith(g, '2', 0, 34, W, 28, 1); skirting(g, 58, '3'); woodFloor(g, 62); }
      else if (tlo === 'korytarz') { wallpaper(g, 60, ['4', '5', '4']); rc(g, '6', 0, 40, W, 2); skirting(g, 60, '6'); for (let y = 62; y < H; y += 6) for (let x = 0; x < W; x += 12) { rc(g, ((x / 12 + (y - 62) / 6) & 1) ? '3' : '2', x, y, 12, 6); } }
      else if (tlo === 'piwnica') { rc(g, 'G', 0, 0, W, 62); for (let y = 0; y < 62; y += 6) for (let x = (y / 6 & 1) * 8; x < W; x += 16) { rc(g, 'd', x, y, 15, 5); dith(g, '&', x, y + 3, 15, 2); } rc(g, '%', 0, 62, W, 18); dith(g, 'G', 0, 62, W, 18, 1); rc(g, 'k', 0, 62, W, 1); }
      else { wallpaper(g, 64, ['2', '3', '1']); skirting(g, 64, '3'); woodFloor(g, 68); }
      if (tlo === 'piwnica') { rc(g, 'k', 6, 8, 20, 8); rc(g, '^', 7, 9, 18, 6); dith(g, '~', 7, 9, 18, 3); if (o.night) rc(g, 'B', 7, 9, 18, 6); px(g, 'e', 64, 2); rc(g, 'k', 64, 0, 1, 2); }
      else if (tlo === 'korytarz') { rc(g, '&', 100, 8, 20, 24); rc(g, '+', 101, 9, 18, 22); rc(g, 'e', 103, 11, 14, 8); rc(g, 'T', 103, 21, 14, 8); px(g, 'y', 112, 15); }
      else {
      rc(g, '&', 6, 6, 22, 24); rc(g, '+', 7, 7, 20, 22); rc(g, '^', 9, 9, 16, 18); dith(g, '~', 9, 9, 16, 6); rc(g, '+', 16, 9, 2, 18);
      if (o.night) { nightGlass(g, 9, 9, 16, 18, f); rc(g, '+', 16, 9, 2, 18); }
      }
      const marks = {}; T.forEach(t => { if (q[t]) marks[q[t][0]] = q[t][1]; });
      const done = Object.keys(marks).length, good = done === job.steps.length && Object.values(marks).every(x => x === 'dobrze');
      const ob = meta.obiekt || 'panel', X = 40, Y = 18;
      if (ob === 'rura') { rc(g, 'g', X + 8, Y, 6, 22); rc(g, 'g', X + 8, Y + 18, 36, 6); rc(g, 'g', X + 38, Y + 8, 6, 16); rc(g, '#', X + 8, Y, 1, 22); rc(g, 'y', X + 6, Y + 14, 10, 3); rc(g, 'y', X + 36, Y + 4, 10, 3); }
      else if (ob === 'drzwi') { rc(g, '8', X + 6, Y - 8, 40, 52); rc(g, 't', X + 8, Y - 6, 36, 48); rc(g, 'y', X + 38, Y + 16, 5, 4); }
      else if (ob === 'okno') { rc(g, '&', X, Y - 4, 52, 40); rc(g, '+', X + 2, Y - 2, 48, 36); rc(g, '^', X + 4, Y, 20, 32); rc(g, '^', X + 28, Y, 20, 32); }
      else if (ob === 'muszla') { rc(g, 'k', X + 11, Y - 8, 30, 16); rc(g, '#', X + 12, Y - 7, 28, 14); rc(g, '=', X + 12, Y + 5, 28, 2); rc(g, 'y', X + 24, Y - 10, 4, 3); rc(g, 'k', X + 14, Y + 8, 24, 12); rc(g, '#', X + 15, Y + 9, 22, 10); rc(g, '%', X + 15, Y + 17, 22, 2); rc(g, 'k', X + 18, Y + 20, 16, 12); rc(g, '#', X + 19, Y + 21, 14, 10); }
      else if (ob === 'lodowka') { rc(g, 'k', X + 8, Y - 14, 34, 56); rc(g, '#', X + 9, Y - 13, 32, 54); rc(g, '%', X + 9, Y + 12, 32, 1); rc(g, 'G', X + 35, Y - 8, 2, 14); rc(g, 'G', X + 35, Y + 16, 2, 18); rc(g, 'a', X + 14, Y - 6, 5, 4); rc(g, 'm', X + 22, Y - 2, 4, 4); if (f % 4 < 2) rc(g, 'a', X + 12, Y + 14, 4, 3); }
      else if (ob === 'zamek') { rc(g, '8', X + 6, Y - 12, 40, 56); rc(g, 't', X + 8, Y - 10, 36, 52); rc(g, 'T', X + 10, Y - 6, 14, 18); rc(g, 'T', X + 28, Y - 6, 14, 18); rc(g, 'k', X + 30, Y + 16, 12, 18); rc(g, 'y', X + 31, Y + 17, 10, 16); rc(g, 'Y', X + 31, Y + 17, 1, 16); rc(g, 'k', X + 35, Y + 21, 2, 6); rc(g, 'e', X + 34, Y + 20, 4, 1); }
      else if (ob === 'lampa') { rc(g, 'k', X + 25, Y - 20, 2, 18); line(g, 'k', X + 14, Y + 4, X + 38, Y + 4, 1); rc(g, 'k', X + 12, Y + 1, 28, 4); rc(g, 'Y', X + 13, Y + 2, 26, 2); rc(g, 'y', X + 14, Y + 2, 24, 1); rc(g, 'k', X + 20, Y + 5, 12, 6); if (!done || f % 3 !== 0) { rc(g, 'e', X + 21, Y + 6, 10, 4); dith(g, 'e', X + 14, Y + 11, 24, 14, f); } }
      else if (ob === 'rolety') { rc(g, '&', X, Y - 6, 52, 46); rc(g, '+', X + 2, Y - 4, 48, 42); rc(g, '^', X + 4, Y - 2, 44, 38); const dn = done ? 4 : 2; for (let i = 0; i < 5 + dn; i++) { rc(g, 'T', X + 4, Y - 2 + i * 3, 44, 2); rc(g, 't', X + 4, Y - 2 + i * 3, 44, 1); } rc(g, 'k', X + 2, Y - 8, 48, 4); rc(g, 'G', X + 3, Y - 7, 46, 2); }
      else if (ob === 'skrzynka') { rc(g, 'k', X + 2, Y - 8, 48, 44); rc(g, 'G', X + 3, Y - 7, 46, 42); rc(g, 'd', X + 6, Y - 4, 40, 36); for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { rc(g, 'k', X + 8 + c * 6, Y - 1 + r * 11, 5, 8); rc(g, (r + c + f) % 5 === 0 && !done ? 'r' : 'w', X + 9 + c * 6, Y + r * 11 + ((c + r) % 2), 3, 3); } if (!done) { px(g, 'e', X + 22, Y - 6 + (f % 2)); px(g, 'y', X + 30, Y - 5); } }
      else if (ob === 'bojler') { rc(g, 'k', X + 12, Y - 14, 28, 52); rc(g, 'g', X + 13, Y - 13, 26, 50); rc(g, '#', X + 14, Y - 12, 4, 48); rc(g, 'k', X + 22, Y - 6, 10, 8); rc(g, 'n', X + 23, Y - 5, 8, 6); rc(g, 'g', X + 16, Y - 18, 6, 4); rc(g, 'g', X + 30, Y - 18, 6, 4); line(g, 'k', X + 19, Y - 18, X + 19, Y - 30, 2); line(g, 'k', X + 33, Y - 18, X + 33, Y - 30, 2); if (!done && f % 2) { px(g, 'w', X + 24, Y - 24); px(g, 'w', X + 26, Y - 28); } }
      else if (ob === 'pralka') { rc(g, 'k', X + 6, Y - 10, 40, 48); rc(g, '#', X + 7, Y - 9, 38, 46); rc(g, 'k', X + 10, Y - 6, 8, 3); rc(g, 'a', X + 20, Y - 6, 4, 3); disc(g, 'k', X + 26, Y + 14, 14); disc(g, '&', X + 26, Y + 14, 12); disc(g, '^', X + 26, Y + 14, 9); dith(g, '~', X + 17, Y + 5, 18, 8, f); if (!done) { rc(g, 'a', X + 12, Y + 38, 28, 2); rc(g, '^', X + 14, Y + 40, 24, 1); } }
      else if (ob === 'kratka') { rc(g, 'G', X, Y, 52, 34); for (let i = 0; i < 6; i++) rc(g, 'k', X + 4 + i * 8, Y + 3, 3, 28); }
      else { rc(g, 'k', X, Y, 52, 34); rc(g, '+', X + 1, Y + 1, 50, 32); for (let i = 0; i < 9; i++) rc(g, '=', X + 4 + i * 5, Y + 4, 1, 26); }
      if (!done) { for (const [x, y] of [[X + 10, Y + 22], [X + 30, Y + 12]]) { rc(g, 'r', x, y, 6, 2); px(g, 'R', x + 2, y + 2); } rc(g, 'a', X + 20, Y + 36 + (f % 3) * 2, 2, 3); }
      else if (good) for (const [x, y] of [[X - 4, Y - 4], [X + 54, Y + 4], [X + 20, Y - 6]]) if (((x + f) & 1) === 0) { px(g, 'w', x, y); px(g, 'e', x + 1, y); px(g, 'e', x, y + 1); }
      // rząd etapów
      const n = job.steps.length, w = Math.min(14, Math.floor(110 / n) - 2), x0 = Math.floor((W - n * (w + 2)) / 2);
      job.steps.forEach((st, i) => { const x = x0 + i * (w + 2), y = 62, m = marks[i];
        rc(g, 'k', x - 1, y - 1, w + 2, 14); rc(g, !m ? '=' : m === 'dobrze' ? 'n' : m === 'skrot' ? 'e' : 'r', x, y, w, 12);
        if (!m) for (let d = 0; d <= i % 3; d++) px(g, 'G', x + 3 + d * 3, y + 5); else if (m === 'dobrze') spr(g, x + 2, y + 3, CHECK); else if (m === 'skrot') spr(g, x + 2, y + 3, CHECK_Y); else { px(g, 'w', x + w / 2 | 0, y + 3); px(g, 'w', x + w / 2 | 0, y + 5); px(g, 'w', x + w / 2 | 0, y + 8); } });
      return g;
    };
  }

  // ---------------------------------------------------------------- ANIMACJE CZYNNOŚCI (narzędzie w akcji nad sceną)
  const ACTIONS = { kran: ['wrench', 'wrench', 'wrench', 'tester'], sciana: ['trowel', 'trowel', 'sander', 'roller'], gniazdko: ['tester', 'pliers', 'screwdriver', 'tester'], polka: ['pencil', 'drill', 'screwdriver', 'hammer'], syfon: ['pliers', 'wrench', 'pliers', 'wrench', 'tester'], drzwi: ['tester', 'screwdriver', 'screwdriver', 'sander', 'tester'], plytki: ['trowel', 'roller', 'trowel', 'pencil', 'trowel', 'tester'], grzejnik: ['tester', 'wrench', 'wrench', 'wrench', 'tester'], okno: ['tester', 'screwdriver', 'pliers', 'trowel', 'tester'], malowanie: ['roller', 'trowel', 'roller', 'roller', 'roller', 'pliers'] };
  const TARGETS = { kran: [[11, 44], [65, 29], [65, 40], [86, 33]], sciana: [[66, 36], [66, 36], [66, 36], [66, 36]], gniazdko: [[12, 40], [100, 18], [64, 36], [64, 36]], polka: [[64, 32], [34, 34], [64, 32], [64, 30]], syfon: [[70, 58], [64, 44], [64, 46], [72, 44], [66, 28]], drzwi: [[56, 20], [31, 40], [74, 42], [80, 40], [60, 44]], plytki: [[58, 36], [58, 36], [58, 36], [58, 36], [58, 36], [58, 36]], grzejnik: [[50, 40], [91, 61], [91, 60], [76, 20], [50, 40]], okno: [[40, 50], [34, 30], [64, 30], [60, 57], [48, 40]], malowanie: [[56, 30], [56, 30], [56, 30], [56, 30], [56, 30], [56, 62]] };
  const actionFor = (jobId, step) => ({ kind: ACTIONS[jobId][step], at: TARGETS[jobId][step] });
  const star = (g, x, y) => { for (const [dx, dy, c] of [[0, 0, 'w'], [-2, 0, 'y'], [2, 0, 'y'], [0, -2, 'y'], [0, 2, 'y'], [-1, -1, 'o'], [1, 1, 'o'], [-1, 1, 'o'], [1, -1, 'o']]) px(g, c, x + dx, y + dy); };
  const TOOLS = {
    wrench(g, x, y, ph) { const a = [-3, 0, 3, 0][ph]; line(g, 'k', x, y + 1, x + 12, y - 6 + a, 3); line(g, 'G', x, y, x + 12, y - 6 + a, 2); line(g, 'g', x, y - 1, x + 12, y - 7 + a, 1); rc(g, 'k', x - 4, y - 4, 8, 8); rc(g, 'g', x - 3, y - 3, 6, 6); rc(g, 'd', x - 1, y - 1, 3, 3); },
    hammer(g, x, y, ph) {
      if (ph % 2 === 0) { line(g, 'k', x + 4, y - 1, x + 8, y - 13, 3); line(g, 'T', x + 5, y - 2, x + 8, y - 13, 1); rc(g, 'k', x + 4, y - 18, 10, 6); rc(g, 'G', x + 5, y - 17, 8, 4); rc(g, 'g', x + 5, y - 17, 8, 1); }
      else { line(g, 'k', x + 2, y - 3, x + 15, y - 3, 3); line(g, 'T', x + 2, y - 3, x + 15, y - 3, 1); rc(g, 'k', x - 5, y - 8, 8, 10); rc(g, 'G', x - 4, y - 7, 6, 8); rc(g, 'g', x - 4, y - 7, 6, 1); star(g, x - 6, y - 2); }
    },
    drill(g, x, y, ph) { const v = ph % 2; rc(g, 'k', x + 3, y - 6 + v, 14, 9); rc(g, 'y', x + 4, y - 5 + v, 12, 7); rc(g, 'Y', x + 4, y + v, 12, 1); rc(g, 'k', x + 9, y + 3 + v, 5, 9); rc(g, 'd', x + 10, y + 4 + v, 3, 7); line(g, 'g', x + 3, y - 2 + v, x - 3, y - 2, 1); for (let i = 0; i < 4; i++) px(g, 'w', x - 4 - ((ph * 2 + i * 3) % 7), y - 4 + ((i * 5 + ph) % 7)); },
    roller(g, x, y, ph) { const dx = [-12, -4, 4, 12][ph]; rc(g, 'k', x + dx - 7, y - 6, 15, 6); rc(g, 'e', x + dx - 6, y - 5, 13, 4); rc(g, 'Y', x + dx - 6, y - 2, 13, 1); line(g, 'G', x + dx, y, x + dx + 3, y + 5, 1); rc(g, 'T', x + dx + 2, y + 5, 3, 7); },
    trowel(g, x, y, ph) { const dx = [-8, -2, 4, -2][ph]; rc(g, 'k', x + dx - 7, y - 3, 16, 5); rc(g, 'g', x + dx - 6, y - 2, 14, 3); rc(g, '#', x + dx - 6, y - 2, 14, 1); rc(g, 'T', x + dx + 8, y - 2, 6, 3); rc(g, '+', x + dx - 8 + (ph % 2), y + 2, 6, 2); },
    sander(g, x, y, ph) { const dx = [-6, 0, 6, 0][ph]; rc(g, 'k', x + dx - 6, y - 7, 13, 9); rc(g, 'o', x + dx - 5, y - 6, 11, 4); rc(g, 'T', x + dx - 5, y - 2, 11, 3); for (let i = 0; i < 5; i++) px(g, 'w', x + dx - 8 + ((i * 5 + ph * 3) % 18), y + 3 + (i % 3)); },
    tester(g, x, y, ph) { line(g, 'k', x + 2, y - 2, x + 12, y - 14, 3); line(g, 'd', x + 3, y - 3, x + 12, y - 14, 1); rc(g, 'k', x + 10, y - 20, 8, 8); rc(g, 'c', x + 11, y - 19, 6, 6); rc(g, ph % 2 ? 'n' : 'N', x + 13, y - 17, 2, 2); px(g, 'y', x, y - 1); px(g, 'w', x + ph % 2, y); },
    pliers(g, x, y, ph) { const o = ph % 2 ? 3 : 0; line(g, 'k', x, y, x + 10, y - 10 - o, 3); line(g, 'k', x, y, x + 10, y - 4 + o, 3); line(g, 'r', x + 1, y, x + 10, y - 10 - o, 1); line(g, 'r', x + 1, y, x + 10, y - 4 + o, 1); rc(g, 'g', x - 3, y - 2, 5, 4); },
    screwdriver(g, x, y, ph) { line(g, 'k', x, y, x + 8, y - 8, 3); line(g, 'g', x, y, x + 6, y - 6, 1); rc(g, 'k', x + 6, y - 16, 7, 9); rc(g, 'r', x + 7, y - 15, 5, 7); rc(g, ph % 2 ? 'R' : 'o', x + 9, y - 15, 1, 7); },
    pencil(g, x, y, ph) { line(g, 'k', x, y, x + 14, y - 9, 3); line(g, 'y', x + 1, y, x + 14, y - 9, 1); px(g, 'k', x, y); rc(g, 'm', x + 14, y - 11, 3, 3); for (let i = 0; i < 3 + ph; i++) px(g, 'k', x - 3 - i, y + 1); },
  };
  /* Rysuje czynność na kopii siatki: t 0..1 to postęp, na końcu błysk. */
  function action(grid, kind, t, at) {
    const g = grid.map(r => r.slice()), [x, y] = at, ph = Math.floor((((t * 6) % 1 + 1) % 1) * 4);
    (TOOLS[kind] || TOOLS.wrench)(g, x, y, ph);
    if (t > 0.78) { const r = Math.round((t - 0.78) * 46); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px(g, i % 2 ? 'y' : 'w', Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)); } }
    return g;
  }
  /* Noc: trzy pasma jasności wokół lampy roboczej (z ditheringiem na brzegach) i chłodny odcień. Żółte piksele świecą. */
  function nightRGBA(grid, light) {
    const im = Pix.rgba(grid, 1), L = light || [64, 36, 20, 44], d = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = grid[y][x]; if (ch === 'y' || ch === 'e') continue;
      const dist = Math.hypot(x - L[0], (y - L[1]) * 1.15); let band = dist < L[2] ? 0 : dist < L[3] ? 1 : 2;
      if (band === 0 && dist > L[2] - 3 && ((x + y) & 1)) band = 1; else if (band === 1 && dist > L[3] - 4 && ((x + y) & 1)) band = 2;
      const m = [1, 0.68, 0.42][band], i = (y * W + x) * 4;
      d[i] = Math.min(255, d[i] * m * 0.88); d[i + 1] = Math.min(255, d[i + 1] * m * 0.95); d[i + 2] = Math.min(255, d[i + 2] * m * 1.12 + (band ? 8 : 0));
    }
    return im;
  }

  // ---------------------------------------------------------------- LUDKI: Janusz, klient i pomocnik na scenie zlecenia
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  /* Wygląd Janusza zależnie od ubioru z szafy (ubrania.js). */
  const LOOK = { wlasne: { shirt: 'w', pants: 'B' }, dres: { shirt: 'P', pants: 'P', accent: 'w' }, robocze: { shirt: 'o', pants: 'B', accent: 'y' },
    koszula: { shirt: 'w', pants: 'd', accent: 'G' }, garnitur: { shirt: 'd', pants: 'd', accent: 'r' }, lux: { shirt: 'k', pants: 'k', accent: 'y' } };
  const hashId = str => { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  function clientLook(id) { const h = hashId(id); return { skin: ['s', 'S'][h % 2], hair: ['h', 'H', 'w', 'G'][(h >> 3) % 4], shirt: ['b', 'm', 'n', 'p', 'r', 'e'][(h >> 5) % 6], pants: ['d', 'B', 'T'][(h >> 8) % 3], stache: (h >> 11) % 3 === 0 }; }
  /* Jedna postać 11x21 px. o: flip, skin, hair, shirt, pants, accent, hat, stache, frame, pose (idle|work|cheer|worry|angry|cross), hand [x,y] dla pracy. */
  function figure(g, x, y, o) {
    const F = !!o.flip, X = i => (F ? x + 10 - i : x + i), f = o.frame || 0, pose = o.pose || 'idle';
    const R = (c, i, j, w, h) => { for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) px(g, c, X(i + a), y + j + b); };
    const b = pose === 'work' ? (f % 2) : (f % 4 >= 2 ? 1 : 0), shirt = o.shirt || 'w', pants = o.pants || 'B', skin = o.skin || 's';
    R(pants, 3, 15, 2, 5); R(pants, 6, 15, 2, 5); R('k', 2, 20, 3, 1); R('k', 6, 20, 3, 1);            // nogi i buty
    R('k', 2, 7 + b, 7, 8); R(shirt, 3, 8 + b, 5, 6); R(pants, 3, 14, 5, 1);                           // tułów
    if (o.accent) R(o.accent, 5, 8 + b, 1, 5);                                                          // krawat, kamizelka, pasek
    R('k', 3, b, 5, 7); R(skin, 4, 1 + b, 3, 5);                                                        // głowa
    R(o.hair || 'H', 4, 1 + b, 3, 1); R(o.hair || 'H', 3, b, 5, 1);
    if (o.hat) { R('k', 2, -1 + b, 7, 1); R('y', 3, -1 + b, 5, 2); }
    if (f % 8 !== 7) { px(g, 'k', X(4), y + 3 + b); px(g, 'k', X(6), y + 3 + b); }                      // oczy, mrugnięcie co 8 klatek
    if (o.stache) R(o.hair === 'w' || o.hair === 'G' ? 'g' : (o.hair || 'H'), 4, 4 + b, 3, 1);
    if (pose === 'cheer') px(g, 'r', X(5), y + 5 + b); else if (pose === 'angry') { px(g, 'r', X(4), y + 2 + b); px(g, 'r', X(6), y + 2 + b); } else px(g, 'R', X(5), y + 5 + b);
    // ręce
    R(shirt, 1, 8 + b, 1, 5); px(g, skin, X(1), y + 13 + b);                                            // ręka z tyłu
    if (pose === 'work' && o.hand) { const sx = X(9), sy = y + 9 + b, [hx, hy] = o.hand; line(g, 'k', sx, sy, hx, hy, 3); line(g, shirt, sx, sy, hx, hy, 1); px(g, skin, hx, hy); }
    else if (pose === 'cheer') { R(shirt, 9, 3 + b, 1, 6); px(g, skin, X(9), y + 2 + b); px(g, 'w', X(10), y + 2 + b); star(g, X(10) + (F ? -2 : 2), y - 1); }
    else if (pose === 'worry') { R(shirt, 8, 6 + b, 1, 3); px(g, skin, X(8), y + 5 + b); if (f % 4 < 2) { px(g, 'a', X(9), y + 1 + b); px(g, 'a', X(9), y + 2 + b); } else px(g, 'a', X(9), y + 3 + b); if (y >= 9) spr(g, X(3), y - 8, QMARK); }
    else if (pose === 'angry') { R(shirt, 9, 4 + b, 1, 5); px(g, 'o', X(9), y + 3 + b); if (y >= 9) spr(g, X(3), y - 8, BANG); }
    else if (pose === 'cross') { R(shirt, 2, 10 + b, 7, 2); px(g, skin, X(2), y + 10 + b); px(g, skin, X(8), y + 10 + b); }
    else { R(shirt, 9, 8 + b, 1, 5); px(g, skin, X(9), y + 13 + b); }
  }
  /* Nakłada na kopię sceny: Janusza przy miejscu pracy, klienta po drugiej stronie i opcjonalnie pomocnika.
     o: { at:[x,y], frame, working, outfit (id z ubrania.js), client (id), mood (happy|worry|angry|meh), helper } */
  function people(grid, o) {
    o = o || {}; const g = grid.map(r => r.slice()), at = o.at || [64, 36], f = o.frame || 0, right = at[0] < 34;
    const jx = right ? Math.min(W - 12, at[0] + 8) : clampN(at[0] - 20, 1, W - 30), jy = clampN(at[1] - 8, 5, H - 22);
    const cx = jx < W / 2 ? W - 13 : 2, cy = H - 22, mood = o.mood || 'meh';
    const pose = { happy: 'cheer', worry: 'worry', angry: 'angry' }[mood] || 'cross', lk = LOOK[o.outfit] || LOOK.wlasne;
    figure(g, cx, cy, Object.assign({ flip: cx > W / 2, frame: f + 3, pose }, clientLook(o.client || 'x')));
    if (o.helper) figure(g, clampN(jx < W / 2 ? jx + 14 : jx - 14, 1, W - 12), jy, { flip: right, frame: f + 1, pose: o.working ? 'work' : 'idle', hand: [at[0], at[1] + 3], skin: 's', hair: 'h', shirt: 'o', pants: 'd', accent: 'y', hat: true });
    figure(g, jx, jy, { flip: right, frame: f, pose: o.working ? 'work' : (mood === 'happy' ? 'cheer' : mood === 'worry' ? 'worry' : mood === 'angry' ? 'angry' : 'idle'), hand: at, skin: 's', hair: 'H', stache: true, shirt: lk.shirt, pants: lk.pants, accent: lk.accent });
    return g;
  }

  const JOB_SCENES = { kran, sciana, gniazdko, polka, syfon, drzwi, plytki, grzejnik, okno, malowanie };
  for (const [id, m] of Object.entries(GEN.META)) if (!JOB_SCENES[id]) {
    JOB_SCENES[id] = genericScene(id); const n = GEN.JOBS[id].steps.length, an = m.anim || ['wrench', 'screwdriver', 'pliers', 'tester', 'trowel'];
    ACTIONS[id] = Array.from({ length: n }, (_, i) => an[i % an.length]); TARGETS[id] = Array.from({ length: n }, () => [64, 36]);
  }
  /* Rysuje siatkę na canvasie 128x80 (przeglądarka). */
  function draw(canvas, grid, opts) {
    opts = opts || {}; const im = opts.night ? nightRGBA(grid, opts.light) : Pix.rgba(grid, 1), ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
  }
  /* Scena zlecenia dla zbioru tokenów stanu i klatki animacji. */
  const job = (id, tokens, frame, opts) => JOB_SCENES[id](tokens instanceof Set ? tokens : new Set(tokens || []), frame || 0, opts || {});

  return { people, figure, LOOK, clientLook, action, actionFor, ACTIONS, TARGETS, TOOLS, nightRGBA, job, draw, JOB_SCENES, hq, sciana, gniazdko, polka, syfon, drzwi, plytki, grzejnik, okno, malowanie, W, H, G, rc, px, dith, line, disc, spr, has, tiledWall, wallpaper, skirting, woodFloor, door, kran, CHECK };
});
