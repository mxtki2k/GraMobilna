// Testy kalendarza i zegara, księgi miesiąca, stawki godzinowej oraz reguł nocy. Uruchomienie: node tests/zegar.test.js
const assert = require('assert');
const C = require('../prototypes/janusz/czas.js');
const K = require('../prototypes/janusz/ksiega.js');
const S = require('../prototypes/janusz/stawka.js');
const F = require('../prototypes/janusz/fuszerka.js');
const W = require('../prototypes/janusz/swiat.js');
const E = require('../prototypes/janusz/ekipa.js');
const { JOBS, CLIENTS, LEVELS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const seq = r => { let i = 0; return () => r[i++ % r.length]; };
function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const rate = (fn, N = 3000) => { const r = lcg(11); let k = 0; for (let i = 0; i < N; i++) if (fn(r)) k++; return k / N; };

t('kalendarz: gra startuje 1 marca 2027 (poniedziałek) o 8:00, etykiety po polsku', () => {
  const d = C.dateOf(C.startClock());
  assert(d.y === 2027 && d.m === 2 && d.day === 1 && d.wd === 1 && d.hour === 8 && d.min === 0 && d.monthKey === '2027-03' && d.dayIndex === 1);
  assert.strictEqual(C.label(C.startClock()), 'pon., 1 marca 2027, 08:00');
  assert.strictEqual(C.dayLabel(C.startClock() + 1440), 'wtorek, 2 marca 2027');
  assert.strictEqual(C.monthName('2027-03'), 'marzec 2027'); assert.strictEqual(C.hm(C.startClock() + 95), '09:35');
});

t('kalendarz: przejście miesięcy i lat, pory roku wg miesiąca', () => {
  assert.strictEqual(C.dateOf(31 * 1440).monthKey, '2027-04'); assert.strictEqual(C.dateOf(306 * 1440).monthKey, '2028-01');
  const at = (y, m) => Math.round((Date.UTC(y, m, 15) - C.START) / 60000);
  assert.deepStrictEqual([2, 5, 8, 11, 0].map(m => C.season(at(m === 0 ? 2028 : 2027, m))), ['wiosna', 'lato', 'jesień', 'zima', 'zima']);
});

t('noc zaczyna się o 22:00 i kończy o 6:00', () => {
  assert(C.isNightHour(22) && C.isNightHour(0) && C.isNightHour(5) && !C.isNightHour(6) && !C.isNightHour(21) && !C.isNightHour(12));
  assert(C.isNight(C.startClock() + 15 * 60) && !C.isNight(C.startClock()));
});

t('start zlecenia: najbliższa pora, noc po północy wypada następnego dnia, opcjonalne oczekiwanie', () => {
  const c = C.startClock();
  assert.strictEqual(C.nextAt(c, '09:00'), 540); assert.strictEqual(C.nextAt(c, '08:00'), 480);
  assert.strictEqual(C.nextAt(c, '01:30'), 1440 + 90); assert.strictEqual(C.nextAt(c, '23:00'), 23 * 60);
  assert.strictEqual(C.nextAt(23 * 60 + 30, '08:30'), 1440 + 510);
  assert.strictEqual(C.jobStart(c, '09:00', 2), 540 + 2880);
});

t('czas trwania: jednostka = 5 minut, noc o 10% dłużej, ładne formatowanie', () => {
  assert.strictEqual(C.minutes(10, false), 50); assert.strictEqual(C.minutes(10, true), 55);
  assert.strictEqual(C.fmtMin(45), '45 min'); assert.strictEqual(C.fmtMin(60), '1 h'); assert.strictEqual(C.fmtMin(125), '2 h 05 min');
  assert.strictEqual(C.fmtUnits(26, false), '2 h 10 min');
  assert.strictEqual(C.daysBetween(100, 1500), 1);
});

t('poziomy: każdy ma porę i godzinę zgodną z porą, są zlecenia dzienne i nocne z opisem nocnym', () => {
  const day = LEVELS.filter(l => l.slot === 'dzien'), night = LEVELS.filter(l => l.slot === 'noc');
  assert(day.length >= 3 && night.length >= 3);
  for (const l of LEVELS) {
    assert(/^\d\d:\d\d$/.test(l.time), l.time);
    const h = +l.time.slice(0, 2); assert.strictEqual(C.isNightHour(h), l.slot === 'noc', l.job + ' ' + l.time);
  }
  night.forEach(l => assert(l.intro && /\d|noc|nocy|zmroku/.test(l.intro)));
});

t('reguły nocy: dopłata, gorsza widoczność, zaspany klient, więcej wypadków i picia', () => {
  assert(C.mods(true).payMult > 1 && C.mods(true).attention < 1 && C.mods(true).accident > 1 && C.mods(false).payMult === 1 && C.mods(false).accident === 1);
  const job = JOBS.sciana, p = job.steps.map(s => ({ stepId: s.id, optionId: 'skrot', accuracy: 0.6 }));
  const day = F.evaluate(job, p, CLIENTS.grazyna), night = F.evaluate(job, p, CLIENTS.grazyna, { attentionMult: C.NIGHT.attention });
  assert(night.satisfaction > day.satisfaction && night.perceived < day.perceived);
});

t('noc w ryzyku: wypadki i policja częściej, kierowcy częściej po alkoholu, ekipa częściej nie przychodzi', () => {
  const w = E.newWorker(E.CANDIDATES[2]);
  const d = W.driveRisk(w, 'po-piwie', { heat: 0.25 }, 'worker'), nn = W.driveRisk(w, 'po-piwie', { heat: 0.25, night: true }, 'worker');
  assert(nn.accident > d.accident * 1.4 && nn.police > d.police);
  assert(rate(r => W.rollState(w, { night: true }, r) !== 'trzezwy') > rate(r => W.rollState(w, {}, r) !== 'trzezwy') + 0.05);
  assert(E.risk(w, { night: true }).absent > E.risk(w).absent);
  assert(W.driveRisk(null, 'trzezwy', { heat: 0.25, night: true }, 'owner').accident > W.driveRisk(null, 'trzezwy', { heat: 0.25 }, 'owner').accident);
});

t('księga: kwoty trafiają do właściwego miesiąca i kategorii, wejście nie jest mutowane', () => {
  const l0 = K.fresh(), l1 = K.book(l0, '2027-03', 'zlecenia', 500), l2 = K.book(l1, '2027-03', 'materialy', -80), l3 = K.book(l2, '2027-04', 'zlecenia', 300);
  assert(Object.keys(l0.months).length === 0 && l1.months['2027-03'].cats.zlecenia === 500);
  assert.strictEqual(K.summary(l3, '2027-03').plus, 420); assert.strictEqual(K.summary(l3, '2027-04').plus, 300);
  assert.deepStrictEqual(K.keys(l3), ['2027-03', '2027-04']);
  assert.throws(() => K.book(l0, '2027-03', 'nie_ma', 1)); assert.strictEqual(K.book(l0, '2027-03', 'zlecenia', 0), l0);
});

t('księga: plus liczy tylko przychody i koszty, inwestycje i długi są osobno, niezaksięgowane trafia do „inne”', () => {
  let l = K.fresh(); const m = '2027-03';
  l = K.book(l, m, 'zlecenia', 1000); l = K.book(l, m, 'pensje', -200); l = K.book(l, m, 'podatki', -100); l = K.book(l, m, 'zakupy', -600); l = K.book(l, m, 'dlug', 500); l = K.book(l, m, 'fuchy', 150);
  let s = K.summary(l, m); assert.strictEqual(s.income, 1150); assert.strictEqual(s.costs, -300); assert.strictEqual(s.plus, 850); assert.strictEqual(s.invest, -600); assert.strictEqual(s.debt, 500);
  assert.strictEqual(K.bookedTotal(l, m), 1150 - 300 - 600 + 500);
  s = K.summary(l, m, -50); assert.strictEqual(s.plus, 800); assert.strictEqual(K.summary(l, m, 70).plus, 920);
});

t('księga: średnia stawka miesiąca z zysków netto i godzin pracy', () => {
  let l = K.noteJob(K.fresh(), '2027-03', 150, 2); l = K.noteJob(l, '2027-03', 90, 1);
  const s = K.summary(l, '2027-03'); assert(s.jobs === 2 && s.hours === 3 && s.perHour === 80);
  assert.strictEqual(K.summary(K.fresh(), '2027-05').perHour, 0);
});

t('stawka: zostaje po odjęciu wszystkich kosztów i dzieli przez godziny', () => {
  const e = S.jobEconomics({ payout: 400, materials: 40, transport: 70, helper: 30, tools: 10, tax: 40, overhead: 10, minutes: 120 });
  assert.strictEqual(e.net, 200); assert.strictEqual(e.hours, 2); assert.strictEqual(e.perHour, 100); assert.strictEqual(e.grossPerHour, 200); assert.strictEqual(e.costs, 200);
  assert.strictEqual(e.lines.length, 7); assert.strictEqual(e.lines[0].value, 400); assert(e.lines.slice(1).every(l => l.value <= 0));
  assert(S.jobEconomics({ payout: 100, materials: 300, minutes: 60 }).perHour < 0);
});

t('koszt pomocnika: udział w pensji za jedno zlecenie, w nocy o 50% więcej', () => {
  const w = E.newWorker(E.CANDIDATES[3]); // wage 200
  assert.strictEqual(S.helperShare(w, false), Math.round(200 / 3)); assert.strictEqual(S.helperShare(w, true), 100); assert.strictEqual(S.helperShare(null, true), 0);
  const cheap = E.newWorker(E.CANDIDATES[0]); assert(S.helperShare(cheap) < S.helperShare(w));
  assert.strictEqual(S.overheadShare(90), 30);
});

t('zużycie narzędzi: różnica wartości przed i po zleceniu', () => {
  const val = i => i.v; const before = [{ id: 1, v: 100 }, { id: 2, v: 50 }], after = [{ id: 1, v: 94 }, { id: 2, v: 50 }];
  assert.strictEqual(S.toolWear(before, after, val), 6); assert.strictEqual(S.toolWear(before, [{ id: 1, v: 100 }], val), 50);
});

t('szacunek: wyższa wypłata i krótsza robota podnoszą stawkę, pomocnik i podatek ją obniżają, noc płaci więcej na godzinę', () => {
  const base = { base: 300, deadlineUnits: 24, invoice: true };
  const e = S.estimate(base);
  assert(S.estimate(Object.assign({}, base, { base: 450 })).perHour > e.perHour && S.estimate(Object.assign({}, base, { deadlineUnits: 12 })).perHour > e.perHour);
  assert(S.estimate(Object.assign({}, base, { helper: 60 })).perHour < e.perHour && S.estimate(Object.assign({}, base, { invoice: false })).perHour > e.perHour);
  const night = S.estimate(Object.assign({}, base, { payMult: C.NIGHT.payMult, night: true }));
  assert(night.perHour > e.perHour, 'noc ' + night.perHour + ' vs dzień ' + e.perHour);
});

t('spięcie: godziny i wypłata tej samej roboty w nocy dają wyższy zarobek brutto na godzinę', () => {
  const job = JOBS.kran, p = job.steps.map(s => ({ stepId: s.id, optionId: 'dobrze', accuracy: 1 }));
  const d = F.evaluate(job, p, CLIENTS.mirek, { payMult: 1 }), nn = F.evaluate(job, p, CLIENTS.mirek, { payMult: C.NIGHT.payMult, attentionMult: C.NIGHT.attention });
  const eD = S.jobEconomics({ payout: d.payout, minutes: C.minutes(d.time, false) }), eN = S.jobEconomics({ payout: nn.payout, minutes: C.minutes(nn.time, true) });
  assert(nn.payout > d.payout && eN.grossPerHour > eD.grossPerHour);
});


const Jb = require('../prototypes/janusz/jobs.js');
t('telefony: szansa zależy od pory, oceny i czasu czekania; zlecenie z telefonu jest poprawne', () => {
  assert(Jb.callChance(false, 2.5, 0) > Jb.callChance(true, 2.5, 0), 'w dzień dzwonią częściej niż w nocy');
  assert(Jb.callChance(false, 4.5, 0) > Jb.callChance(false, 1.5, 0), 'lepsza ocena, więcej telefonów');
  assert(Jb.callChance(false, 2.5, 5) > Jb.callChance(false, 2.5, 0), 'kolejne godziny bez telefonu zwiększają szansę');
  for (const st of [0, 1.5, 2.5, 5, 9]) for (const n of [false, true]) for (const w of [0, 3, 50]) { const p = Jb.callChance(n, st, w); assert(p >= 0.03 && p <= 0.6); }
  const r = lcg(5);
  for (let i = 0; i < 200; i++) { const c = Jb.rollCall(r, 2 + (i % 4), i % 2 === 0); assert(Jb.JOBS[c.job] && Jb.CLIENTS[c.client] && c.mult >= 0.7 && c.mult <= 2.4 && (c.slot === 'noc') === (i % 2 === 0)); }
  const hits = rate(rr => rr() < Jb.callChance(false, 2.5, 0)); assert(Math.abs(hits - 0.22) < 0.03);
  // czekanie w dzień: z „litością” (kolejne godziny zwiększają szansę) telefon przychodzi najpóźniej po kilkunastu godzinach
  const rr = lcg(3); let worst = 0, sum = 0;
  for (let k = 0; k < 500; k++) { let w = 0, h = 0; while (rr() >= Jb.callChance(false, 2.5, w)) { w++; h++; } sum += h + 1; worst = Math.max(worst, h + 1); }
  assert(sum / 500 < 5 && worst < 25, 'średnio ' + sum / 500 + ', najdłużej ' + worst);
});
t('lista zleceń ma 16 poziomów, a nocnych jest co najmniej 5', () => {
  assert(Jb.LEVELS.length >= 16 && Jb.LEVELS.filter(l => l.slot === 'noc').length >= 5);
});
console.log('\n' + n + ' testów przeszło');
