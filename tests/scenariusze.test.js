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
  { // 3. kontrakt przez interfejs: przycisk, okno, przyjęcie, rezygnacja
    const g = await boot(21); const S = g.state(); S.money = 9000; S.ledgerMoney = 9000; S.done = 12; g.z().renderMenu(); await g.settle(3);
    const ids = g.$$('[data-cacc]').map(e => e.dataset.cacc); assert(ids.length >= 1, 'kontrakty na liście');
    await g.click('[data-cacc="' + ids[0] + '"]'); assert(g.visible('#modal')); assert(/📋/.test(g.text('#mtitle')));
    await g.click('#mchoices button[data-id="yes"]'); assert.strictEqual(S.contracts.active.id, ids[0]); await dismiss(g);
    assert(g.visible('#cstage'), 'jest przycisk etapu'); await g.click('#ccancel'); assert(/Zrezygnować/.test(g.text('#mtitle'))); await g.click('#mchoices button[data-id="yes"]'); assert(!S.contracts.active);
    assert.deepStrictEqual(g.errors(), []); g.close(); t('kontrakt przez UI');
  }
  { // 4. przetarg przez interfejs
    const g = await boot(22); const S = g.state(); S.money = 40000; S.ledgerMoney = 40000; S.hq.tier = 4; S.done = 40; S.ratings = Array(20).fill(5); for (const k of Object.keys(g.w.Spec.AREAS)) S.xp[k] = 100000; for (const c of Object.keys(g.w.Szkolenia.CERTS || {})) S.certs[c] = true; S.wardrobe.owned.forEach(o => { o.cond = 100; }); g.z().renderMenu(); await g.settle(3);
    const el = g.$$('[data-tender]:not([disabled])')[0]; assert(el, 'aktywny przetarg na liście');
    await g.click('[data-tender="' + el.dataset.tender + '"]'); assert(/🏛️/.test(g.text('#mtitle'))); await g.click('#mchoices button[data-id]:not([data-id=""])');
    assert(S.contracts.active || S.flash.length, 'wynik przetargu');
    assert.deepStrictEqual(g.errors(), []); g.close(); t('przetarg przez UI');
  }
  { // 5. ekipa: tablica i wybór pracownika przez interfejs
    const g = await boot(23); const S = g.state(), Z = g.z(); S.money = 3000; S.ledgerMoney = 3000; S.crew = [g.w.Ekipa.newWorker(g.w.Ekipa.CANDIDATES[0]), g.w.Ekipa.newWorker(g.w.Ekipa.CANDIDATES[1])];
    Z.renderMenu(); await g.settle(3); const o = g.$$('[data-offer]:not([disabled])')[0]; assert(o, 'zlecenie na tablicy');
    await g.click('[data-offer="' + o.dataset.offer + '"]'); assert(/Kto jedzie/.test(g.text('#mtitle'))); await g.click('#mchoices button[data-id]:not([data-id=""])'); assert(S.crewJobs.length === 1 || S.flash.length);
    assert.deepStrictEqual(g.errors(), []); g.close(); t('ekipa przez UI');
  }
  { // 6. rok i prestiż przez interfejs, Nowa Gra+
    const g = await boot(24); const S = g.state(), Z = g.z(); S.money = 8000; S.ledgerMoney = 8000; S.ratings = [5, 5, 4, 5, 4, 5, 5, 4]; S.hist = [{ index: 15 }];
    for (const k of ['2027-05', '2027-09', '2027-12']) { S.ledger = g.w.Ksiega.book(S.ledger, k, 'zlecenia', 9000); S.ledger = g.w.Ksiega.book(S.ledger, k, 'materialy', -2500); for (let i = 0; i < 60; i++) S.ledger = g.w.Ksiega.noteJob(S.ledger, k, 120, 1); }
    S.pendingYears = ['2027']; assert.strictEqual(Z.checkYear(), true); assert(/Podsumowanie roku/.test(g.text('#mtitle'))); assert(g.$$('#mtext .erow').length >= 2, 'ranking jako wiersze');
    await g.click('#mchoices button[data-id="pr"]'); assert(g.visible('#prestige')); const g0 = Z.META.games; await g.click('#ngp'); await g.click('#mchoices button[data-id="yes"]');
    assert.strictEqual(Z.META.games, g0 + 1); assert.strictEqual(g.state().done, 0); assert.deepStrictEqual(g.errors(), []); g.close(); t('rok, prestiż i Nowa Gra+ przez UI');
  }
  { // 7. szafa przez interfejs + czekanie na telefon
    const g = await boot(25); const S = g.state(), Z = g.z(); S.money = 4000; S.ledgerMoney = 4000; Z.renderWardrobe(); await g.settle(2);
    const buy = g.$$('[data-buy]:not([disabled])')[0]; assert(buy, 'jest co kupić'); const n0 = S.wardrobe.owned.length; await g.click('[data-buy="' + buy.dataset.buy + '"]'); assert.strictEqual(S.wardrobe.owned.length, n0 + 1);
    Z.renderMenu(); await g.settle(2); let h = 0; while (!g.visible('#modal') && h++ < 60) { await g.click('#wait'); } assert(g.visible('#modal') && /Telefon/.test(g.text('#mtitle')), 'telefon po ' + h + ' h'); await g.click('#mchoices button[data-id="no"]');
    assert.deepStrictEqual(g.errors(), []); g.close(); t('szafa i czekanie przez UI');
  }
  { // 8. wypłata, reklamacja i raport miesięczny przez interfejs
    const g = await boot(26); const S = g.state(), Z = g.z(); S.money = 5000; S.ledgerMoney = 5000; S.done = 5; S.crew = [g.w.Ekipa.newWorker(g.w.Ekipa.CANDIDATES[0])];
    Z.startPayday(); assert(g.visible('#payday')); assert(g.$$('#payday .prow').length === 1); await g.click('#payday [data-set]'); await g.click('#doPay'); assert(/Po wypłacie/.test(g.text('#payday'))); await g.click('#payOk'); await dismiss(g);
    S.claims = [{ client: 'Karyna', due: 0, kind: 'reklamacja', defect: 'cieknie', amount: 300 }]; assert.strictEqual(Z.E.checkClaims(), true); assert(g.visible('#modal')); const m0 = S.money; await g.click('#mchoices button[data-id="pay"]'); assert(S.money < m0 || S.money === 0);
    S.pendingMonths = ['2027-03']; await dismiss(g); S.pendingMonths = ['2027-03']; assert.strictEqual(Z.E.checkMonthReport(), true); assert(/Podsumowanie/.test(g.text('#mtitle'))); assert(g.$$('#mtext .erow').length >= 2, 'tabela miesiąca'); await g.click('#mchoices button');
    assert.deepStrictEqual(g.errors(), []); g.close(); t('wypłata, reklamacja i raport przez UI');
  }
  console.log('scenariusze: ' + n + ' OK');
})().catch(e => { console.error(e); process.exit(1); });
