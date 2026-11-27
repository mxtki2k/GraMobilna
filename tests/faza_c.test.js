// Testy fazy C: specjalizacje i przetargi. Uruchomienie: node tests/faza_c.test.js
const assert = require('assert');
const Sp = require('../prototypes/janusz/specjalizacje.js'), P = require('../prototypes/janusz/przetargi.js'), K = require('../prototypes/janusz/kontrakty.js'), Sz = require('../prototypes/janusz/szkolenia.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

t('specjalizacje: każda robota należy do dokładnie jednego obszaru, obszary mają kurs z szkolenia.js', () => {
  for (const id of Object.keys(JOBS)) { assert(Sp.areaOf(id), id); assert.strictEqual(Object.values(Sp.AREAS).filter(a => a.jobs.includes(id)).length, 1, id); }
  for (const a of Object.values(Sp.AREAS)) assert(Sz.CERTS[a.cert], a.cert);
});
t('poziom: rośnie z doświadczeniem, bez kursu kończy się na 1, z kursem sięga 3', () => {
  assert.deepStrictEqual([0, 14, 15, 45, 100, 500].map(x => Sp.level(x, 'hydraulika', { hydr: true })), [0, 0, 1, 2, 3, 3]);
  assert.deepStrictEqual([0, 14, 15, 45, 100].map(x => Sp.level(x, 'hydraulika', {})), [0, 0, 1, 1, 1]);
});
t('doświadczenie: gwiazdki, kontrakty +50%, wpis tylko do właściwego obszaru', () => {
  let s = Sp.fresh(); s = Sp.addXp(s, 'kran', 4); assert.strictEqual(s.hydraulika, 4); s = Sp.addXp(s, 'plytki', 5, true); assert.strictEqual(s.wykonczenia, 7.5); assert.strictEqual(s.stolarka, 0);
  assert.strictEqual(Sp.addXp(s, 'nie-ma', 5), s);
});
t('premie: poziom 0 = brak, poziom 3 = +6 pkt celności, −4,5% czasu, zagrożenie ×0,85, wypłata ×1,06', () => {
  const m0 = Sp.mods(Sp.fresh(), {}, 'kran'), m3 = Sp.mods({ hydraulika: 200 }, { hydr: true }, 'kran');
  assert.deepStrictEqual([m0.level, m0.acc, m0.time, m0.hazard, m0.pay], [0, 0, 0, 1, 1]);
  assert(m3.level === 3 && Math.abs(m3.acc - 0.06) < 1e-9 && Math.abs(m3.time - 0.045) < 1e-9 && m3.hazard === 0.85 && Math.abs(m3.pay - 1.06) < 1e-9);
  assert.strictEqual(Sp.mods(Sp.fresh(), {}, 'nie-ma').level, 0);
});
t('następny poziom: ile brakuje, blokada przez brak kursu', () => {
  assert.deepStrictEqual(Sp.next({ hydraulika: 10 }, { hydr: true }, 'hydraulika'), { level: 0, need: 5, locked: false });
  assert.strictEqual(Sp.next({ hydraulika: 60 }, {}, 'hydraulika').locked, true); assert.strictEqual(Sp.next({ hydraulika: 200 }, { hydr: true }, 'hydraulika').need, null);
});
t('przetargi: sześć, zarejestrowane w kontraktach jako przetargi z audytem, poprawne dane i rosnące wymagania', () => {
  const list = Object.values(P.TENDERS); assert(list.length >= 6);
  for (const x of list) { const c = K.CONTRACTS[P.cid(x.id)]; assert(c && c.tender && c.audit && c.premium >= 1 && CLIENTS[c.client] && c.stages.length >= 4 && c.deadline > c.stages[c.stages.length - 1].day, x.id); c.stages.forEach(s => assert(JOBS[s.job])); }
  const stars = list.map(x => x.req.stars); assert.deepStrictEqual(stars.slice().sort((a, b) => a - b), stars.slice().sort((a, b) => a - b)); assert(K.available(999).every(c => !c.tender));
});
t('wymagania: listuje braki (ocena, siedziba, specjalizacje)', () => {
  const t0 = P.TENDERS.hotel; const ok = { stars: 4, tier: 3, spec: { hydraulika: 2, wykonczenia: 2, stolarka: 2 } };
  assert.deepStrictEqual(P.missing(t0, ok), []); const miss = P.missing(t0, { stars: 3, tier: 1, spec: { hydraulika: 2 } });
  assert(miss.length === 4 && miss.some(x => /ocena/.test(x)) && miss.some(x => /siedziba/.test(x)) && miss.some(x => /wykonczenia/.test(x)));
});
t('szansa wygranej: niższa cena zwiększa, silny rywal zmniejsza, ocena i zaufanie zwiększają; granice 5–90%', () => {
  const c = { stars: 3.5, trust: 0, rivalPower: 40 };
  assert(P.winChance('low', c) > P.winChance('std', c) && P.winChance('std', c) > P.winChance('high', c));
  assert(P.winChance('std', Object.assign({}, c, { rivalPower: 90 })) < P.winChance('std', c) && P.winChance('std', Object.assign({}, c, { stars: 4.5 })) > P.winChance('std', c) && P.winChance('std', Object.assign({}, c, { trust: 60 })) > P.winChance('std', c));
  for (const st of [1, 5]) for (const b of ['low', 'std', 'high']) { const w = P.winChance(b, { stars: st, trust: 100, rivalPower: 0 }); assert(w >= 0.05 && w <= 0.9); }
  assert.throws(() => P.winChance('x', c));
  const r = lcg(2); let w = 0; for (let i = 0; i < 4000; i++) if (P.bid('std', c, r).won) w++; assert(Math.abs(w / 4000 - P.winChance('std', c)) < 0.03);
});
t('wadium i cena: mnożnik oferty zmienia zaliczkę i transze, wadium 10% wartości', () => {
  const tn = P.TENDERS.blok, lo = P.terms(tn, 'low', JOBS), hi = P.terms(tn, 'high', JOBS);
  assert(lo.wadium < hi.wadium && lo.priceMult === 0.85 && Math.abs(hi.wadium - lo.quote.nominal * 0.1 * 1.15) < 1);
  const a = K.accept(K.fresh(), P.cid('blok'), 0, JOBS, { priceMult: 0.85, wadium: lo.wadium }); assert(a.ok && a.state.active.wadium === lo.wadium && a.state.active.priceMult === 0.85);
  const std = K.accept(K.fresh(), P.cid('blok'), 0, JOBS, { priceMult: 1, wadium: 0 });
  assert(a.deposit < std.deposit && K.stageLevel(a.state, 0).priceMult < K.stageLevel(std.state, 0).priceMult && K.stageLevel(std.state, 0).priceMult === K.trancheOf(K.CONTRACTS[P.cid('blok')]));
});
t('odświeżenie oferty: ta sama oferta dopiero po tygodniu', () => { assert(P.cooldownOk({}, 'blok', 3) && !P.cooldownOk({ blok: 3 }, 'blok', 9) && P.cooldownOk({ blok: 3 }, 'blok', 10)); });
const run = (hidden, avgStars) => {
  let s = K.accept(K.fresh(), P.cid('blok'), 0, JOBS, { priceMult: 1, wadium: 500 }).state; const c = K.CONTRACTS[P.cid('blok')];
  c.stages.forEach((_, i) => { s = K.recordStage(s, { stars: avgStars, index: 20, defects: i === 0 ? hidden : [] }, 400).state; }); return K.final(s, 0, CLIENTS.heniek, () => 0);
};
t('audyt: czysta robota daje premię 15% i zwrot wadium, ukryta wada zagrażająca oblewa audyt (kara 35% (AUDIT_FAIL), wadium przepada, 1★)', () => {
  const ok = run([], 5); assert(!ok.failed && ok.bonus > 0 && ok.wadiumBack === 500 && ok.wadiumLost === 0 && ok.auditPenalty === 0);
  const nominal = K.quote(K.CONTRACTS[P.cid('blok')], JOBS).nominal, bad = run([{ label: 'kabel', sev: 4, vis: 0.05, hazard: 0.6 }], 5);
  assert(bad.failed && bad.stars === 1 && bad.auditPenalty === Math.round(nominal * K.AUDIT_FAIL) && bad.wadiumLost === 500 && bad.wadiumBack === 0 && bad.bonus === 0 && /AUDYT/.test(bad.notes.join(' ')));
  const soft = run([{ label: 'zacieki', sev: 3, vis: 0.1 }], 5); assert(!soft.failed && soft.rework === 75 && soft.wadiumBack === 500);
});
t('rezygnacja z przetargu: tracisz też wadium', () => {
  const a = K.accept(K.fresh(), P.cid('blok'), 0, JOBS, { priceMult: 1, wadium: 800 }); assert.strictEqual(K.cancel(a.state).penalty, a.deposit + Math.round(a.quote.nominal * 0.1) + 800);
});
console.log('\n' + n + ' testów przeszło');
