// Testy mechanik: zmęczenie, stali klienci i konkurencja, szkolenia, ubezpieczenie OC. Uruchomienie: node tests/mechaniki.test.js
const assert = require('assert');
const Z = require('../prototypes/janusz/zmeczenie.js'), K = require('../prototypes/janusz/klienci.js'), Sz = require('../prototypes/janusz/szkolenia.js'), U = require('../prototypes/janusz/ubezpieczenie.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

t('zmęczenie: praca męczy, w nocy mocniej, odpoczynek i sen regenerują (noc skuteczniej), granice 0–100', () => {
  assert(Z.gain(10, 120, false) === 22 && Z.gain(10, 120, true) > 22 && Z.gain(95, 600, true) === 100);
  assert(Z.rest(50, 60, false) === 46 && Z.rest(100, 480, true, true) < Z.rest(100, 480, true, false) && Z.rest(5, 480, true, true) === 0);
});
t('zmęczenie: wypoczęty pracuje celniej, zmęczony gorzej, ledwo żywy zasypia', () => {
  assert(Z.accMod(10) > 0 && Z.accMod(30) === 0 && Z.accMod(70) < 0 && Z.accMod(100) === -0.3 && Z.accMod(60) > Z.accMod(90));
  assert(Z.nodChance(69) === 0 && Z.nodChance(85) > 0 && Z.nodChance(100) === 0.35);
  assert(Z.timeMult(40) === 1 && Z.timeMult(100) === 1.3 && Z.timeMult(75) > 1);
  assert.deepStrictEqual([5, 30, 50, 70, 95].map(Z.label), ['wypoczęty', 'w porządku', 'zmęczony', 'wykończony', 'ledwo żyjesz']);
});
t('klienci: zaufanie rośnie po dobrej robocie i spada po złej (pamiętliwi mocniej)', () => {
  let r = K.afterJob({}, 'mirek', 5); assert(r.mirek.trust === 10 && r.mirek.jobs === 1);
  r = K.afterJob(r, 'mirek', 1); assert(r.mirek.trust === -10 && r.mirek.jobs === 2);
  assert(K.afterJob({}, 'grazyna', 1, 1.5).grazyna.trust === -30 && K.afterJob({}, 'x', 3).x.trust === 0);
  let big = {}; for (let i = 0; i < 30; i++) big = K.afterJob(big, 'a', 5); assert(big.a.trust === 100);
  assert.deepStrictEqual([60, 30, 0, -30, -80].map(K.level), ['stały klient', 'zaufany', 'znajomy', 'nieufny', 'wróg']);
});
t('klienci: mnożnik wypłaty w granicach 0,95–1,15, waga telefonów rośnie z zaufaniem', () => {
  assert(K.payMult(100) === 1.1 && K.payMult(-100) === 0.95 && K.payMult(0) === 1 && K.payMult(50) > K.payMult(10));
  assert(K.weight(60) > K.weight(0) && K.weight(-60) < 0.1 && K.weight(-10) < 1);
  const r = lcg(4), ids = Object.keys(CLIENTS), rel = { mirek: { trust: 75, jobs: 5 }, karyna: { trust: -80, jobs: 2 } }, c = {};
  for (let i = 0; i < 3000; i++) { const x = K.pick(r, ids, rel); assert(CLIENTS[x]); c[x] = (c[x] || 0) + 1; }
  assert(c.mirek > c.sebix && (c.karyna || 0) < c.sebix / 5, JSON.stringify(c));
});
t('konkurencja: szansa zależy od przewagi rywala, zaufanie chroni; obniżka wygrywa zawsze', () => {
  assert(K.contestChance(60, 30, 0) > K.contestChance(25, 30, 0) && K.contestChance(25, 80, 0) === 0.05);
  assert(K.contestChance(50, 30, 35) === K.contestChance(50, 30, 0) / 2 && K.contestChance(50, 30, 70) < K.contestChance(50, 30, 35));
  for (let i = 0; i < 50; i++) assert(K.contest('cut', -50, Math.random).won);
  const r = lcg(8); let w = 0; for (let i = 0; i < 2000; i++) if (K.contest('normal', 60, r).won) w++; assert(w / 2000 > 0.7 && w / 2000 < 0.9);
  assert(K.contest('cut', 0, Math.random).priceMult < 1 && K.contest('normal', 0, () => 0).priceMult === 1); assert.throws(() => K.contest('x', 0, Math.random));
});
t('szkolenia: każdy rodzaj roboty ma kurs, uprawnienia zmieniają ryzyko i wypłatę tylko dla swojego typu', () => {
  assert.deepStrictEqual(Array.from(new Set(Object.values(Sz.CERTS).flatMap(c => c.jobs))).sort(), Object.keys(JOBS).sort());
  const c = { sep: true };
  assert(Sz.modsFor(c, 'gniazdko').hazard < 0.5 && Sz.modsFor(c, 'gniazdko').pay > 1 && Sz.modsFor(c, 'kran').hazard === 1 && Sz.modsFor({}, 'gniazdko').acc === 0);
});
t('szkolenia: zakup sprawdza gotówkę i duplikaty', () => {
  assert(!Sz.buy({}, 'sep', 10).ok && !Sz.buy({ sep: true }, 'sep', 9999).ok && !Sz.buy({}, 'x', 9999).ok);
  const r = Sz.buy({}, 'sep', 9999); assert(r.ok && r.certs.sep && r.cost === 900 && r.hours === 16);
});
t('OC: bez polisy płacisz całość, z polisą część pokrywa ubezpieczyciel, składka rośnie ze szkodami', () => {
  const none = U.cover(U.fresh(), { kind: 'reklamacja', amount: 500 }); assert(none.you === 500 && none.insurer === 0);
  const oc = U.toggle(U.fresh(), true), a = U.cover(oc, { kind: 'reklamacja', amount: 500 }), w = U.cover(oc, { kind: 'wypadek', amount: 500 });
  assert(a.insurer === 240 && a.you === 260 && w.insurer === 320 && a.oc.history === 1 && U.premium(a.oc) > U.premium(oc));
  assert(U.cover(oc, { kind: 'reklamacja', amount: 80 }).insurer === 0, 'udział własny');
  assert(U.premium({ active: true, history: 99 }) === U.MAX && U.decay({ active: true, history: 0 }).history === 0 && U.decay({ active: true, history: 2 }).history < 2);
});
const W = require('../prototypes/janusz/wypalenie.js');
t('wypalenie: rośnie przy pracy zmęczonej i w nocy, maleje przy wypoczęciu, dzień wolny leczy, urlop zeruje', () => {
  assert(W.afterJob(10, 80, false) === 14.5 && W.afterJob(10, 55, false) === 13 && W.afterJob(10, 40, false) === 11.5 && W.afterJob(10, 10, false) === 10.5 && W.afterJob(10, 80, true) === 15.5);
  assert(W.afterJob(99, 90, true) === 100 && W.afterJob(0, 5, false) === 0.5);
  assert(W.dayOff(60) === 35 && W.dayOff(10) === 0 && W.vacation(90) === 0);
});
t('wypalenie: skutki zaczynają się od 40 (celność, tempo) i 80 (nieodebrany telefon)', () => {
  assert(W.accMod(40) === 0 && W.accMod(100) === -0.1 && W.timeMult(40) === 1 && W.timeMult(100) === 1.2 && W.missCall(79) === 0 && W.missCall(100) === 0.15);
  assert.deepStrictEqual([10, 30, 50, 70, 90].map(W.label), ['chce się pracować', 'w porządku', 'ma dość', 'wypalony', 'wszystko wkurza']);
});
t('klienci zapominają: zaufanie zbliża się do zera w obie strony i nie przeskakuje go', () => {
  const d = K.decay({ a: { trust: 20, jobs: 3 }, b: { trust: -20, jobs: 1 }, c: { trust: 2, jobs: 1 } }, 8);
  assert(d.a.trust === 16 && d.b.trust === -16 && d.c.trust === 0 && d.a.jobs === 3);
});
console.log('\n' + n + ' testów przeszło');
