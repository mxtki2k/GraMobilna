// Testy budowy wersji online (PWA). Uruchomienie: node tests/web.test.js
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const W = require('../tools/zbuduj_web.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'janusz-web-')), ver = 'test-1', res = W.build(out, ver);
const read = f => fs.readFileSync(path.join(out, f), 'utf8'), dims = f => { const b = fs.readFileSync(path.join(out, f)); assert.strictEqual(b.slice(1, 4).toString(), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

t('struktura: index, manifest, service worker, strona offline, wersja i wszystkie skrypty z gry', () => {
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'offline.html', 'wersja.json']) assert(fs.existsSync(path.join(out, f)), f);
  assert(res.scripts.length >= 30); for (const s of res.scripts) assert(fs.existsSync(path.join(out, s)), s); assert.strictEqual(JSON.parse(read('wersja.json')).wersja, ver);
});
t('nie kopiuje testów, narzędzi, symulacji ani projektu Godot', () => {
  const all = fs.readdirSync(out); assert(!all.some(f => /\.test\.js$|^tools$|^tests$|project\.godot|\.rob$|balans|tempo/.test(f)), all.join());
});
t('manifest: nazwa, start, tryb aplikacji, pion, kolory i ikony (192, 512, maskable) z poprawnymi PNG', () => {
  const m = JSON.parse(read('manifest.webmanifest')); assert(m.name === 'Janusz Biznesu' && m.short_name && m.lang === 'pl' && m.display === 'standalone' && m.orientation === 'portrait' && m.start_url && m.scope && m.theme_color && m.background_color);
  const sizes = m.icons.map(i => i.sizes + ':' + i.purpose).sort(); assert.deepStrictEqual(sizes, ['192x192:any', '512x512:any', '512x512:maskable']);
  for (const i of m.icons) { const [w, h] = dims(i.src); assert.strictEqual(w + 'x' + h, i.sizes); assert.strictEqual(i.type, 'image/png'); }
  assert.deepStrictEqual(dims('ikony/ikona-180.png'), [180, 180]); assert.deepStrictEqual(dims('ikony/ikona-48.png'), [48, 48]);
});
t('ikony: maskable ma pełne tło (rogi żółte), zwykła ma ciemną ramkę', () => {
  const zlib = require('zlib'), dec = f => { const b = fs.readFileSync(path.join(out, f)); const w = b.readUInt32BE(16); let off = 8, idat = []; while (off < b.length) { const len = b.readUInt32BE(off), type = b.slice(off + 4, off + 8).toString(); if (type === 'IDAT') idat.push(b.slice(off + 8, off + 8 + len)); off += 12 + len; } const raw = zlib.inflateSync(Buffer.concat(idat)); return (x, y) => { const i = y * (w * 4 + 1) + 1 + x * 4; return [raw[i], raw[i + 1], raw[i + 2]]; }; };
  assert.deepStrictEqual(dec('ikony/ikona-maskable-512.png')(0, 0), [255, 195, 0]); assert.deepStrictEqual(dec('ikony/ikona-512.png')(0, 0), [20, 23, 26]); assert.deepStrictEqual(dec('ikony/ikona-512.png')(30, 30), [255, 195, 0]);
});
t('index.html: viewport, kolor motywu, manifest, ikony Apple, wersjonowane skrypty, rejestracja service workera, brak zmian w grze', () => {
  const h = read('index.html'); assert(/<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover/.test(h) && /name="theme-color"/.test(h) && /rel="manifest" href="manifest\.webmanifest\?v=test-1"/.test(h) && /rel="apple-touch-icon"/.test(h) && /apple-mobile-web-app-capable/.test(h));
  for (const s of res.scripts) assert(h.includes('<script src="' + s + '?v=test-1"></script>'), s); assert(/serviceWorker/.test(h) && /sw\.js\?v=test-1/.test(h));
  assert.strictEqual((h.match(/<meta name="viewport"/g) || []).length, 1); assert(h.includes('id="menu"') && h.includes('<main>'));
});
t('service worker: tylko sieć, offline.html dla nawigacji, brak pamięci podręcznej gry, sprząta stare wersje', () => {
  const sw = read('sw.js'); assert(/addEventListener\("fetch"/.test(sw) && /mode === "navigate"/.test(sw) && /caches\.match\(OFFLINE\)/.test(sw) && /caches\.delete/.test(sw) && /test-1/.test(sw));
  assert(!/addAll|cache\.put|\.put\(/.test(sw), 'SW nie powinien cache’ować gry'); const o = read('offline.html'); assert(/Brak internetu/.test(o) && /tylko online/.test(o));
});
t('wersja domyślna: data + skrót commita lub znacznik czasu, zmienna WERSJA ją nadpisuje', () => {
  const v = W.wersja(); assert(/^\d{8}-[0-9a-f]+$|^dev-/.test(v) || process.env.WERSJA); const old = process.env.WERSJA; process.env.WERSJA = 'x9'; assert.strictEqual(W.wersja(), 'x9'); if (old === undefined) delete process.env.WERSJA; else process.env.WERSJA = old;
});
t('pliki wdrożeniowe: workflow Pages, config Capacitora z https i oznaczonym adresem, instrukcje', () => {
  const root = path.join(__dirname, '..'), wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'web.yml'), 'utf8');
  assert(/upload-pages-artifact/.test(wf) && /deploy-pages/.test(wf) && /zbuduj_web\.js web/.test(wf) && /workflow_dispatch/.test(wf));
  const cap = JSON.parse(fs.readFileSync(path.join(root, 'aplikacja_android', 'capacitor.config.json'), 'utf8')); assert(cap.appId === 'pl.januszbiznesu.gra' && /^https:\/\//.test(cap.server.url) && cap.server.cleartext === false && cap.webDir === '../web');
  assert(fs.existsSync(path.join(root, 'APLIKACJA.md')) && fs.existsSync(path.join(root, 'aplikacja_android', 'README.md')));
  assert(/^web\/$/m.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')));
});
fs.rmSync(out, { recursive: true, force: true });
console.log('\n' + n + ' testów przeszło');
