#!/usr/bin/env node
// Buduje wersję online „jako aplikację” (PWA): web/ z index.html, skryptami, manifestem, ikonami i prostym service workerem (bez trybu offline).
// Użycie: node tools/zbuduj_web.js [katalog_wyjściowy]   (domyślnie web/)   Zmienne: WERSJA (domyślnie data+hash z git albo znacznik czasu)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'prototypes', 'janusz'), OUT = path.resolve(process.argv[2] || path.join(ROOT, 'web'));
const { png } = require('./png.js'), Pix = require(path.join(SRC, 'pixel.js'));
const NAME = 'Janusz Biznesu', SHORT = 'Janusz', THEME = '#14171a', BG = '#14171a';

function wersja() {
  if (process.env.WERSJA) return process.env.WERSJA;
  try { const h = cp.execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); return new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + h; } catch (e) { return 'dev-' + Date.now().toString(36); }
}
/* Ikona: skrzynka z narzędziami (sprite 16x16) na żółtym tle z ciemną ramką, skalowana „najbliższym sąsiadem”. maskable = pełne tło, sprite w bezpiecznej strefie. */
function ikona(size, maskable) {
  const px = new Uint8ClampedArray(size * size * 4), set = (x, y, c) => { const i = (y * size + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  const Y = [255, 195, 0], D = [20, 23, 26], b = Math.max(2, Math.round(size / 24));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, maskable ? Y : (x < b || y < b || x >= size - b || y >= size - b ? D : Y));
  const sp = Pix.rgba(Pix.get('i_zestaw'), 1), sc = Math.max(1, Math.floor(size * (maskable ? 0.5 : 0.62) / 16)), off = Math.floor((size - 16 * sc) / 2);
  for (let sy = 0; sy < 16; sy++) for (let sx = 0; sx < 16; sx++) { const si = (sy * 16 + sx) * 4; if (!sp.data[si + 3]) continue; for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) set(off + sx * sc + dx, off + sy * sc + dy, [sp.data[si], sp.data[si + 1], sp.data[si + 2]]); }
  return png(size, size, px);
}
function build(out, ver) {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'ikony'), { recursive: true });
  let html = fs.readFileSync(path.join(SRC, 'zlecenia.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  for (const s of scripts) { if (!fs.existsSync(path.join(SRC, s))) throw new Error('Brak skryptu ' + s); fs.copyFileSync(path.join(SRC, s), path.join(out, s)); }
  // cache-busting: wersja w adresach skryptów (aktualizacje trafiają do gracza od razu)
  html = html.replace(/<script src="([^"?]+)"><\/script>/g, '<script src="$1?v=' + ver + '"></script>');
  const head = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n<meta name="theme-color" content="' + THEME + '">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="' + SHORT + '">\n<meta name="description" content="Symulator polskiego fachowca: naprawy, ekipa, kontrakty i fuszerka.">\n<link rel="manifest" href="manifest.webmanifest?v=' + ver + '">\n<link rel="icon" href="ikony/ikona-48.png" sizes="48x48">\n<link rel="apple-touch-icon" href="ikony/ikona-180.png">\n<style>html,body{overscroll-behavior:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;background:' + BG + '}</style>\n';
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + head);
  const reg = '<script>/* Aplikacja online: service worker tylko dla okna instalacji i komunikatu o braku sieci, bez pamięci podręcznej. */\nif ("serviceWorker" in navigator) addEventListener("load", function () { navigator.serviceWorker.register("sw.js?v=' + ver + '").catch(function () {}); });\n</script>\n';
  html = html.includes('</body>') ? html.replace('</body>', reg + '</body>') : html.replace(/\s*$/, '\n') + reg;
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'offline.html'), '<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Brak internetu</title><body style="margin:0;background:' + BG + ';color:#f4f1e8;font:20px/1.4 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px"><div><h1 style="color:#ffc300">Brak internetu</h1><p>Janusz Biznesu działa tylko online. Połącz się z siecią i spróbuj ponownie.</p><button onclick="location.reload()" style="font:inherit;padding:12px 20px">Spróbuj ponownie</button></div></body></html>\n');
  fs.writeFileSync(path.join(out, 'sw.js'), '/* Service worker aplikacji online: wszystko z sieci, przy braku połączenia pokazuje offline.html. Nie przechowuje gry. */\nconst OFFLINE = "offline.html", KEY = "janusz-offline-' + ver + '";\nself.addEventListener("install", e => { e.waitUntil(caches.open(KEY).then(c => c.add(OFFLINE)).then(() => self.skipWaiting())); });\nself.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== KEY).map(k => caches.delete(k)))).then(() => self.clients.claim())); });\nself.addEventListener("fetch", e => { if (e.request.mode === "navigate") e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE))); });\n');
  const manifest = { name: NAME, short_name: SHORT, description: 'Symulator polskiego fachowca: naprawy, ekipa, kontrakty i fuszerka.', lang: 'pl', start_url: './index.html?zrodlo=aplikacja', scope: './', id: './', display: 'standalone', orientation: 'portrait', background_color: BG, theme_color: THEME, categories: ['games', 'simulation'],
    icons: [{ src: 'ikony/ikona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'ikony/ikona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'ikony/ikona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  for (const [n, s, m] of [['ikona-48', 48, false], ['ikona-180', 180, false], ['ikona-192', 192, false], ['ikona-512', 512, false], ['ikona-maskable-512', 512, true]]) fs.writeFileSync(path.join(out, 'ikony', n + '.png'), ikona(s, m));
  fs.writeFileSync(path.join(out, 'wersja.json'), JSON.stringify({ wersja: ver, zbudowano: new Date().toISOString() }) + '\n');
  return { scripts, ver };
}
module.exports = { build, ikona, wersja };
if (require.main === module) { const r = build(OUT, wersja()); console.log('OK: ' + path.relative(process.cwd(), OUT) + ' (' + r.scripts.length + ' skryptów, wersja ' + r.ver + ')'); }
