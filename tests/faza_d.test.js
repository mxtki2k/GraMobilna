// Testy fazy D: wydarzenia sezonowe, rok firmy, prestiż i perki. Uruchomienie: node tests/faza_d.test.js
const assert = require('assert');
const Sz = require('../prototypes/janusz/sezon.js'), R = require('../prototypes/janusz/rok.js'), Ks = require('../prototypes/janusz/ksiega.js'), C = require('../prototypes/janusz/czas.js');
const { JOBS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const at = (y, m, d, h) => Math.round((Date.UTC(y, m, d, h || 12) - C.START) / 60000);

t('okna kalendarzowe: zwykłe, przechodzące przez Nowy Rok i granice włącznie', () => {
  assert(Sz.inRange(3, 26, [3, 26], [5, 30]) && Sz.inRange(5, 30, [3, 26], [5, 30]) && !Sz.inRange(3, 25, [3, 26], [5, 30]) && !Sz.inRange(5, 31, [3, 26], [5, 30]));
  assert(Sz.inRange(11, 31, [11, 15], [1, 15]) && Sz.inRange(0, 3, [11, 15], [1, 15]) && Sz.inRange(1, 15, [11, 15], [1, 15]) && !Sz.inRange(1, 16, [11, 15], [1, 15]) && !Sz.inRange(6, 1, [11, 15], [1, 15]));
});
t('aktywne wydarzenia i mnożniki: zima podnosi popyt na grzejniki, świąteczne porządki nakładają się na zimę', () => {
  const jan = at(2028, 0, 10); assert(Sz.active(jan).some(e => e.id === 'zima') && Sz.demand(jan, 'grzejnik') === 1.6 && Sz.demand(jan, 'polka') === 1);
  const dec = at(2027, 11, 20); assert(Sz.active(dec).some(e => e.id === 'zima')); const nov = at(2027, 10, 20); assert(Sz.active(nov).some(e => e.id === 'swieta') && Sz.pay(nov) === 1.08);
  const mar = at(2027, 2, 15); assert(Sz.demand(mar, 'syfon') === 1.5 && Sz.demand(at(2027, 7, 15), 'kran') === 1);
  assert(Sz.toolPrice(at(2027, 10, 25)) === 0.75 && Sz.toolPrice(at(2027, 4, 5)) === 1 && Sz.bus(jan) === 1.25 && Sz.pay(at(2027, 6, 10)) === 0.95);
});
t('wydarzenia: poprawne dane i przeciętny mnożnik wypłat w roku mieści się w 0,95–1,12', () => {
  for (const e of Sz.EVENTS) { assert(e.id && e.name && e.text && e.from.length === 2 && e.to.length === 2); for (const id of Object.keys(e.demand || {})) assert(JOBS[id], id); }
  let s = 0, d = 0; for (let day = 0; day < 365; day++) { const c = at(2028, 0, 1) + day * 1440; for (const id of Object.keys(JOBS)) { s += Sz.demand(c, id) * Sz.pay(c); d++; } }
  assert(s / d > 0.97 && s / d < 1.12, 'średni mnożnik ' + s / d);
});
let L = Ks.fresh(); const bk = (key, cat, v) => { L = Ks.book(L, key, cat, v); };
for (const [k, inc, cost, jobs, net, hours] of [['2027-03', 3000, -1000, 20, 1800, 30], ['2027-04', 5000, -1500, 30, 3200, 40], ['2027-12', 2000, -2500, 10, -300, 20], ['2028-01', 4000, -1000, 25, 2500, 35]]) { bk(k, 'zlecenia', inc); bk(k, 'materialy', cost); L = Ks.noteJob(L, k, net, hours); for (let i = 1; i < jobs; i++) L = Ks.noteJob(L, k, 0, 0); }
t('podsumowanie roku: sumuje tylko miesiące tego roku, najlepszy i najgorszy miesiąc', () => {
  const s = R.summary(L, '2027'); assert.strictEqual(s.months, 3); assert.strictEqual(s.income, 10000); assert.strictEqual(s.costs, -5000); assert.strictEqual(s.plus, 5000);
  assert.strictEqual(s.jobs, 60); assert.strictEqual(s.hours, 90); assert.strictEqual(s.perHour, Math.round((1800 + 3200 - 300) / 90)); assert(s.best.key === '2027-04' && s.best.plus === 3500 && s.worst.key === '2027-12' && s.worst.plus === -500);
  assert.strictEqual(R.summary(L, '2028').plus, 3000); assert.strictEqual(R.summary(L, '2030').months, 0);
});
t('ranking: deterministyczny, posortowany, gracz na liście, wyższy zysk to lepsze miejsce', () => {
  const a = R.ranking({ plus: 5000 }, 40, 7), b = R.ranking({ plus: 5000 }, 40, 7), hi = R.ranking({ plus: 90000 }, 40, 7), lo = R.ranking({ plus: -100 }, 40, 7);
  assert.deepStrictEqual(a, b); assert.strictEqual(a.rows.length, 5); assert(a.rows.every((r, i) => !i || a.rows[i - 1].plus >= r.plus) && a.rows.filter(r => r.you).length === 1);
  assert(hi.rank === 1 && lo.rank === 5 && hi.rank <= a.rank && a.rank <= lo.rank);
});
t('nagrody: fachowiec, złota rączka, król fuszerki (żart), uczciwy, urzędnik, złota godzina', () => {
  const base = { jobs: 200, perHour: 160, plus: 9000 }, ids = a => a.map(x => x.id).sort();
  assert.deepStrictEqual(ids(R.awards(base, { avgStars: 4.5, claimsOpen: 0, avgIndex: 20, tendersWon: 1 })), ['fachowiec', 'rączka', 'uczciwy', 'urzednik', 'zlotowka'].sort());
  const bad = R.awards({ jobs: 40, perHour: 20, plus: 100 }, { avgStars: 2, claimsOpen: 3, avgIndex: 70, tendersWon: 0 }); assert.deepStrictEqual(ids(bad), ['krol']); assert(bad[0].joke);
  assert.deepStrictEqual(R.awards({ jobs: 5, perHour: 0, plus: 0 }, { avgStars: 5, claimsOpen: 0, avgIndex: 10, tendersWon: 0 }), []);
});
t('prestiż: rośnie z zyskiem, oceną, nagrodami i miejscem; żart nie daje punktów; nie schodzi poniżej zera', () => {
  const sm = { plus: 15000 }, st = { avgStars: 4, contractsDone: 2, tendersWon: 1 };
  assert.strictEqual(R.prestige(sm, st, [{ joke: false }, { joke: true }], 1), 10 + 6 + 2 + 4 + 2 + 2);
  assert(R.prestige({ plus: 30000 }, st, [], 1) > R.prestige(sm, st, [], 1) && R.prestige(sm, st, [], 1) > R.prestige(sm, st, [], 5));
  assert.strictEqual(R.prestige({ plus: -5000 }, { avgStars: 1, contractsDone: 0, tendersWon: 0 }, [], 5), 0);
});
t('perki: koszt rośnie z poziomem, zakup odejmuje punkty, brak punktów i maksimum odrzucone, premie startowe', () => {
  let m = R.freshMeta(); m.points = 40; assert.strictEqual(R.perkCost(m, 'renoma'), 8);
  const b1 = R.buy(m, 'renoma'); assert(b1.ok && b1.meta.points === 32 && b1.meta.perks.renoma === 1 && b1.meta.spent === 8 && m.points === 40 && R.perkCost(b1.meta, 'renoma') === 10);
  assert(!R.buy(R.freshMeta(), 'kapital').ok && !R.buy(m, 'nie-ma').ok);
  let x = Object.assign({}, m, { points: 999 }); for (let i = 0; i < 3; i++) x = R.buy(x, 'kapital').meta; assert(!R.buy(x, 'kapital').ok && R.perkCost(x, 'kapital') === null);
  let y = Object.assign({}, m, { points: 999 }); y = R.buy(R.buy(R.buy(y, 'kursy').meta, 'kursy').meta, 'znajomosci').meta;
  assert.deepStrictEqual(R.bonuses(y), { startCash: 0, payMult: 1, trust: 10, certs: ['hydr', 'wyk'] }); assert.deepStrictEqual(R.bonuses(x), { startCash: 3000, payMult: 1, trust: 0, certs: [] });
  let z = Object.assign({}, m, { points: 999 }); for (let i = 0; i < 5; i++) z = R.buy(z, 'renoma').meta; assert.strictEqual(R.bonuses(z).payMult, 1.1);
});
console.log('\n' + n + ' testów przeszło');
