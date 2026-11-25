/* Sceny pixel art 128x80: łazienka (kran), pokój (dziura w ścianie), kuchnia (gniazdko), salon (półka) i siedziba firmy.
 * Rysowane ręcznie z warstw (prostokąty, linie, dithering, małe sprite'y), a nie pikselizowane z SVG.
 * Stan sceny to zbiór tokenów (jak w jobs.js: 'broken', 'seal-new', 'plaster-good', ...). Klatka f (0..3) animuje kapanie, iskry, parę.
 * Działa w przeglądarce (canvas) i w node (eksport PNG), bo renderuje do siatki znaków z palety Pix.PAL. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pixel.js'));
  else root.Scenes = factory(root.Pix);
})(typeof self !== 'undefined' ? self : this, function (Pix) {
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
  function kran(T, f) {
    const g = G();
    tiledWall(g, 58);
    // podłoga: szachownica
    rc(g, '6', 0, 58, W, 22);
    for (let y = 60; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x >> 3) + ((y - 60) >> 3)) % 2 === 0) rc(g, '5', x, y, 8, 8);
    rc(g, '&', 0, 58, W, 2); rc(g, '%', 0, 58, W, 1);
    // okno z firanką po lewej, lustro po prawej
    rc(g, '&', 5, 7, 20, 27); rc(g, '+', 6, 8, 18, 24); rc(g, '^', 8, 10, 14, 20); dith(g, '~', 8, 10, 14, 8); rc(g, '+', 14, 10, 2, 20); rc(g, '+', 8, 19, 14, 2); rc(g, '=', 6, 32, 18, 2);
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
    if (T.has('seal-new')) { rc(g, 'o', 61, 28, 8, 3); rc(g, 'O', 61, 30, 8, 1); rc(g, 'y', 62, 28, 3, 1); }
    if (T.has('seal-old')) { rc(g, 'G', 61, 28, 8, 3); rc(g, 'd', 61, 30, 8, 1); dith(g, 'g', 62, 28, 5, 1); }
    if (T.has('tape')) { rc(g, '+', 60, 25, 10, 9); for (let i = 0; i < 10; i++) { px(g, '=', 60 + i, 25 + ((i * 2) % 9)); px(g, '=', 60 + i, 26 + ((i * 2) % 9)); } rc(g, '=', 60, 33, 10, 1); }
    if (T.has('glue')) { rc(g, 'R', 85, 38, 16, 10); rc(g, 'r', 86, 39, 14, 8); for (const [x, y, w] of [[86, 42, 14], [86, 46, 14]]) rc(g, 'R', x, y, w, 1); rc(g, 'R', 92, 39, 1, 3); rc(g, 'R', 97, 43, 1, 3); rc(g, 'e', 56, 40, 20, 4); rc(g, 'Y', 56, 43, 20, 1); dith(g, 'Y', 58, 41, 14, 2); rc(g, 'e', 78, 31, 8, 4); rc(g, 'Y', 78, 34, 8, 1); }
    // kapanie
    if (dripping) {
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
    if (T.has('tested')) { rc(g, '+', 93, 6, 1, 1); spr(g, 108, 36, CHECK); }
    return g;
  }


  // ---------------------------------------------------------------- POKÓJ: dziura w ścianie
  const HOLE = [[56, 74], [52, 78], [50, 80], [49, 82], [49, 83], [48, 83], [49, 82], [50, 82], [50, 81], [51, 81], [50, 80], [50, 80], [49, 79], [50, 80], [50, 80], [51, 79], [51, 78], [52, 77], [53, 75], [55, 72]];
  function holeSpans(y0) { return HOLE.map((r, i) => ({ y: y0 + i * 2, x0: r[0], x1: r[1] })); }
  function holePoly(g, c, grow) {
    grow = grow || 0;
    holeSpans(20).forEach(r => rc(g, c, r.x0 - grow, r.y - grow, r.x1 - r.x0 + 1 + 2 * grow, 2 + grow));
  }
  function sciana(T, f) {
    const g = G();
    const sage = T.has('paint-full');
    wallpaper(g, 62, sage ? ['?', '$', '!'] : null);
    skirting(g, 62, sage ? '!' : '3');
    woodFloor(g, 66);
    // okno z zasłonami
    rc(g, '&', 5, 9, 28, 38); rc(g, '+', 6, 10, 26, 36); rc(g, '^', 8, 12, 22, 32); dith(g, '~', 8, 12, 22, 12); rc(g, '+', 18, 12, 2, 32); rc(g, '+', 8, 27, 22, 2);
    rc(g, 'c', 9, 13, 5, 1); rc(g, '#', 22, 30, 5, 1);
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
      holePoly(g, '3', 1); holePoly(g, '-', 0);
      holeSpans(20).forEach((r, i) => { if (i > 2 && i < 17) rc(g, '_', r.x0 + 3, r.y, r.x1 - r.x0 - 5, 2); });
      for (const [x, y] of [[54, 52], [58, 52], [64, 54], [69, 52], [73, 54]]) { rc(g, 'r', x, y, 5, 2); px(g, 'R', x + 4, y + 1); }
      for (const [x, y] of [[53, 24], [57, 22], [64, 28], [70, 24], [76, 30]]) rc(g, '+', x, y, 3, 1);
      for (const [x, y] of [[56, 26], [74, 36], [51, 44]]) rc(g, '2', x, y, 2, 2);
    }
    const holeFill = c => holePoly(g, c, 0);
    if (T.has('plaster-good')) { holePoly(g, '=', 1); holeFill('+'); dith(g, '=', 56, 24, 22, 20, 0); rc(g, '#', 58, 24, 10, 1); }
    if (T.has('plaster-thick')) { holePoly(g, '=', 1); holeFill('+'); line(g, '3', 58, 26, 66, 38); line(g, '3', 66, 38, 62, 48); line(g, '3', 72, 24, 76, 36); px(g, '3', 61, 31); }
    if (T.has('foam')) { holePoly(g, 'Y', 2); holeFill('e'); dith(g, 'Y', 52, 24, 30, 26, 1); for (const [x, y] of [[54, 30], [66, 28], [74, 40], [60, 46], [80, 34]]) { rc(g, 'w', x, y, 2, 2); } rc(g, 'e', 48, 52, 8, 3); rc(g, 'Y', 48, 55, 8, 1); }
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
  function gniazdko(T, f) {
    const g = G();
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
    if (broken || T.has('spark')) {
      const fr = f % 4; dith(g, 'e', 53 + fr, 25, 6, 4, fr); dith(g, 'o', 70 - fr, 40 + (fr % 2) * 3, 6, 3);
      const bolt = [[63, 22], [62, 24], [64, 25], [62, 28], [66, 27], [65, 24]];
      const zig = (pts, c) => { for (let i = 0; i < pts.length - 1; i++) line(g, c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1); };
      if (fr % 2 === 0) { zig([[56, 24], [60, 28], [57, 31], [61, 35]], 'y'); zig([[75, 26], [71, 30], [74, 33]], 'e'); px(g, 'w', 60, 28); px(g, 'w', 71, 30); disc(g, 'e', 64, 28, 1); }
      else { zig([[64, 22], [61, 27], [65, 30], [62, 34]], 'y'); zig([[78, 34], [73, 36], [76, 40]], 'e'); px(g, 'w', 61, 27); px(g, 'w', 73, 36); disc(g, 'e', 58, 38, 1); }
      px(g, 'w', 61 + fr, 30); px(g, 'w', 70 - fr, 33);
    }
    if (T.has('cable-twist')) { line(g, 'k', 64, 43, 64, 50, 2); rc(g, 'k', 61, 46, 7, 4); dith(g, 'd', 62, 46, 5, 3); rc(g, 'G', 61, 46, 7, 1); }
    if (T.has('prad-off')) { disc(g, 'N', 12, 40, 5); disc(g, 'n', 12, 40, 4); spr(g, 9, 38, CHECK); }
    // para z czajnika po poprawnym teście
    if (T.has('tested')) { for (let k = 0; k < 4; k++) { const y = 28 - ((f * 2 + k * 5) % 22); rc(g, '#', 96 + ((k * 3 + f) % 3), Math.max(8, y), 2, 2); } }
    return g;
  }

  // ---------------------------------------------------------------- SALON: krzywa półka
  function polka(T, f) {
    const g = G();
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
    } else {
      const lv = T.has('level-bad') ? [24, 34, 104, 24] : T.has('level-eye') ? [24, 32, 104, 28] : [24, 30, 104, 30];
      const heavy = T.has('load-heavy');
      shelf(lv[0], lv[1], lv[2], lv[3], heavy ? 3 : 0);
      if (T.has('book')) { rc(g, 'R', 24, lv[1] + 4, 14, 5); rc(g, 'r', 25, lv[1] + 5, 12, 3); rc(g, '+', 25, lv[1] + 8, 12, 1); }
      const items = T.has('load-ok') ? [['b', 'B', 34, 14, 5], ['o', 'O', 40, 12, 4], ['N', 'n', 45, 15, 5], ['r', 'R', 51, 13, 4]] : heavy ? [['b', 'B', 30, 16, 5], ['o', 'O', 36, 14, 5], ['p', 'P', 42, 17, 5], ['N', 'n', 48, 13, 5], ['r', 'R', 54, 16, 5], ['y', 'Y', 60, 13, 5], ['b', 'B', 66, 15, 5], ['r', 'R', 72, 12, 5], ['N', 'n', 78, 17, 5], ['o', 'O', 84, 14, 5]] : [];
      for (const [c, d, x, h, w] of items) { const y = shelfY(x, ...lv) - h; rc(g, d, x, y, w, h); rc(g, c, x + 1, y + 1, w - 2, h - 2); rc(g, '+', x + 1, y + 3, w - 2, 1); }
      if (T.has('load-ok')) { const x = 78, y = shelfY(x, ...lv) - 14; rc(g, 'c', x, y + 4, 10, 10); rc(g, 'a', x + 1, y + 5, 8, 8); rc(g, 'N', x + 4, y - 4, 2, 8); rc(g, 'n', x + 1, y - 2, 4, 3); rc(g, 'n', x + 6, y - 3, 4, 3); }
    }
    return g;
  }


  // ---------------------------------------------------------------- SIEDZIBA FIRMY
  function win(g, x, y, w, h, lvl) {
    const frame = ['T', 't', '+', '+'][lvl];
    rc(g, '&', x - 1, y - 1, w + 2, h + 2); rc(g, frame, x, y, w, h); rc(g, lvl >= 3 ? 'b' : '^', x + 1, y + 1, w - 2, h - 2); dith(g, lvl >= 3 ? 'c' : '~', x + 1, y + 1, w - 2, (h - 2) >> 1);
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
    o = o || {}; const tier = o.tier || 0, up = o.up || {}, as = o.assets || {}, season = o.season || 'wiosna', fr = f || 0, g = G(), u = k => up[k] || 0, winter = season === 'zima';
    // niebo
    rc(g, winter ? '4' : '~', 0, 0, W, 60); rc(g, winter ? '5' : '^', 0, 0, W, 6); dith(g, winter ? '5' : '^', 0, 6, W, 8); dith(g, winter ? '5' : '^', 0, 14, W, 5, 1);
    const cloud = (x, y) => { disc(g, '#', x, y, 4); disc(g, '#', x + 6, y - 1, 5); disc(g, '#', x + 13, y, 4); rc(g, '#', x, y, 18, 4); dith(g, '%', x, y + 3, 18, 2); };
    cloud(8 + (fr % 4), 8); cloud(82 - (fr % 4), 16);
    if (season === 'lato') { disc(g, 'e', 112, 10, 7); disc(g, 'y', 112, 10, 5); }
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

  const JOB_SCENES = { kran, sciana, gniazdko, polka };
  /* Rysuje siatkę na canvasie 128x80 (przeglądarka). */
  function draw(canvas, grid) {
    const im = Pix.rgba(grid, 1), ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
  }
  /* Scena zlecenia dla zbioru tokenów stanu i klatki animacji. */
  const job = (id, tokens, frame) => JOB_SCENES[id](tokens instanceof Set ? tokens : new Set(tokens || []), frame || 0);

  return { job, draw, JOB_SCENES, hq, sciana, gniazdko, polka, W, H, G, rc, px, dith, line, disc, spr, has, tiledWall, wallpaper, skirting, woodFloor, door, kran, CHECK };
});
