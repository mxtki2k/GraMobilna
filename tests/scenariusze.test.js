/* Scenariusze headless (etap R0): prawdziwy zlecenia.html w jsdom, deterministyczny RNG, bez przeglądarki.
   Bez zainstalowanego jsdom test się pomija (npm install w katalogu głównym). */
const assert = require('assert');
const H = require('../tools/headless.js');
if (!H.available) { console.log('scenariusze: pominięto (brak jsdom, uruchom npm install)'); process.exit(0); }

async function boot(seed) {
  const g = await H.start({ seed });
  if (g.visible('#mchoices button[data-i="0"]')) await g.click('#mchoices button[data-i="0"]'); // spadek po dziadku
  return g;
}
/* jedno zlecenie od menu do wyniku */
async function runJob(g, i, o) {
  o = o || {};
  await g.click('.lvl[data-i="' + i + '"]');
  if (g.visible('#umOk')) await g.click('#umOk');
  if (g.visible('.opt[data-w]')) { if (!(await g.tryClick('.opt[data-w]:not([disabled])'))) await g.tryClick('.opt[data-w="none"]'); }
  if (g.visible('.opt[data-d]')) await g.click('.opt[data-d]:not([disabled])');
  for (let k = 0; k < 12 && !g.visible('#next'); k++) {
    if (g.visible('#stop')) { await g.click('#stop'); await g.settle(10); continue; }
    if (g.visible('#mchoices button')) { await g.click('#mchoices button'); continue; }
    const sel = o.pick ? '.opt[data-o="' + o.pick + '"]' : '.opt[data-o]:not([disabled])';
    if (!(await g.tryClick(sel))) await g.tryClick('.opt[data-o]:not([disabled])');
    await g.settle(10);
  }
  assert(g.visible('#next'), 'zlecenie dobiegło do ekranu wyniku');
}
async function dismiss(g) { for (let k = 0; k < 6 && g.visible('#modal'); k++) await g.click('#mchoices button'); }

(async () => {
  let n = 0; const t = name => { n++; console.log('  ok', name); };

  { // 1. start gry + zwykłe zlecenie
    const g = await boot(11);
    assert(g.$$('.lvl').length >= 30, 'menu ma poziomy');
    const m0 = g.state().money;
    await runJob(g, 0);
    assert.strictEqual(g.state().done, 1); assert.strictEqual(g.state().ratings.length, 1);
    assert(g.z().eco && typeof g.z().eco.net === 'number', 'ekonomia zlecenia policzona');
    assert(g.state().money !== m0, 'kasa zmieniona');
    await g.click('#next'); await dismiss(g);
    assert.deepStrictEqual(g.errors(), []);
    g.close(); t('start i zwykłe zlecenie');
  }
  { // 2. determinizm: ten sam seed = ten sam skrót stanu
    const a = await boot(5); await runJob(a, 0); const da = a.digest(); a.close();
    const b = await boot(5); await runJob(b, 0); const db = b.digest(); b.close();
    assert.strictEqual(da, db); t('determinizm (ten sam seed, ten sam skrót)');
  }
  console.log('scenariusze: ' + n + ' OK');
})().catch(e => { console.error(e); process.exit(1); });
