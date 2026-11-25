// Testy zleceń terminowych i awarii busa. Uruchomienie: node tests/terminy_bus.test.js
const assert = require('assert');
const T = require('../prototypes/janusz/terminy.js'), B = require('../prototypes/janusz/bus.js'), S = require('../prototypes/janusz/stawka.js');
const { JOBS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

t('termin: godzina oddania zależy od rodzaju i pory, ostry krótszy od luźnego', () => {
  const a = T.make(26, 1000, 'normalny', false), o = T.make(26, 1000, 'ostry', false), l = T.make(26, 1000, 'luzny', false), nn = T.make(26, 1000, 'normalny', true);
  assert.strictEqual(a.allowed, 130); assert.strictEqual(a.dueAt, 1130);
  assert(o.allowed < a.allowed && a.allowed < l.allowed && nn.allowed > a.allowed);
  assert.throws(() => T.make(10, 0, 'x'));
});
t('rozliczenie: spóźnienie co 15 minut, limit kary, premia za szybkość, brak terminu = bez skutków', () => {
  const d = T.make(26, 0, 'normalny', false); // 130 min
  assert.deepStrictEqual(T.evaluate(d, 130, 300), { onTime: true, lateMin: 0, penalty: 0, bonus: 0 });
  const e = T.evaluate(d, 131, 300); assert(!e.onTime && e.penalty === 15 && e.bonus === 0);
  assert.strictEqual(T.evaluate(d, 160, 300).penalty, 30);
  assert.strictEqual(T.evaluate(d, 5000, 300).penalty, 180); // 60% limit
  assert.strictEqual(T.evaluate(d, 100, 300).bonus, 30); assert.strictEqual(T.evaluate(d, 110, 300).bonus, 0);
  assert.deepStrictEqual(T.evaluate(null, 999, 300), { onTime: true, lateMin: 0, penalty: 0, bonus: 0 });
  assert(T.evaluate(T.make(26, 0, 'ostry', false), 100, 300).penalty > T.evaluate(T.make(26, 0, 'normalny', false), 100 + 30, 300).penalty - 1);
});
t('termin: solidna robota nie mieści się w ostrym terminie, w luźnym tak, skrót mieści', () => {
  for (const j of Object.values(JOBS)) {
    const sum = k => j.steps.reduce((s, st) => s + st.options.find(o => o.id === k).time, 0);
    assert(sum('dobrze') * 5 > T.make(j.deadline, 0, 'ostry', false).allowed, j.id + ' solid vs ostry');
    assert(sum('dobrze') * 5 <= T.make(j.deadline, 0, 'luzny', false).allowed, j.id + ' solid vs luźny');
    assert(sum('skrot') * 5 <= T.make(j.deadline, 0, 'ostry', false).allowed, j.id + ' skrót vs ostry');
  }
});
t('termin: ostry płaci więcej, luźny mniej', () => { assert(T.KINDS.ostry.pay > T.KINDS.normalny.pay && T.KINDS.normalny.pay > T.KINDS.luzny.pay && T.make(10, 0, 'ostry').pay === T.KINDS.ostry.pay); });
t('losowanie terminu: rodzaje poprawne, w nocy ostry częściej', () => {
  const r = lcg(2), c = { day: { ostry: 0, none: 0 }, night: { ostry: 0, none: 0 } };
  for (let i = 0; i < 4000; i++) for (const [k, ng] of [['day', false], ['night', true]]) { const x = T.roll(r, ng); assert(x === null || T.KINDS[x]); if (x === 'ostry') c[k].ostry++; if (!x) c[k].none++; }
  assert(c.night.ostry > c.day.ostry && c.night.none < c.day.none);
});
t('stawka: kara za spóźnienie jest osobną linią i obniża zostaje', () => {
  const a = S.jobEconomics({ payout: 300, materials: 10, minutes: 120 }), b = S.jobEconomics({ payout: 300, materials: 10, penalty: 60, minutes: 120 });
  assert(b.net === a.net - 60 && b.lines.some(l => l.key === 'penalty' && l.value === -60));
});
t('bus: szansa awarii rośnie wraz ze zużyciem, w nocy, a lepszy bus psuje się rzadziej', () => {
  const g = c => ({ cond: c, broken: false, km: 0, breakdowns: 0 });
  assert(B.chance(g(90), 0, false) < B.chance(g(55), 0, false) && B.chance(g(55), 0, false) < B.chance(g(20), 0, false));
  assert(B.chance(g(60), 0, true) > B.chance(g(60), 0, false) && B.chance(g(60), 3, false) < B.chance(g(60), 0, false));
  for (const c of [0, 10, 50, 100]) for (const lv of [0, 1, 2, 3]) { const p = B.chance(g(c), lv, true); assert(p >= 0 && p <= 0.6); }
});
t('bus: zużycie przy przejeździe zależy od poziomu busa i nocy, nie spada poniżej zera', () => {
  const b = B.fresh(), a0 = B.drive(b, 0, false), a3 = B.drive(b, 3, false), an = B.drive(b, 0, true);
  assert(a0.cond < b.cond && a3.cond > a0.cond && an.cond < a0.cond && a0.km === 1);
  let x = { cond: 1, broken: false, km: 0, breakdowns: 0 }; x = B.drive(x, 0, true); assert(x.cond >= 0);
  assert.deepStrictEqual(['dobry', 'średni', 'zły', 'ledwo jedzie'].map((l, i) => B.label({ cond: [90, 60, 30, 5][i], broken: false })), ['dobry', 'średni', 'zły', 'ledwo jedzie']);
  assert.strictEqual(B.label({ cond: 90, broken: true }), 'zepsuty');
});
t('awaria: laweta drożej w nocy, naprawa samemu bywa nieudana, kurier zostawia zepsuty bus', () => {
  const b = { cond: 30, broken: false, km: 5, breakdowns: 0 };
  const day = B.resolve('laweta', b, false, () => 0), night = B.resolve('laweta', b, true, () => 0);
  assert(night.cost > day.cost && day.bus.cond > b.cond && !day.bus.broken && day.bus.breakdowns === 1);
  const ok = B.resolve('sam', b, false, () => 0.1), bad = B.resolve('sam', b, false, () => 0.9);
  assert(ok.cost < day.cost && bad.cost > day.cost && bad.timeAdj > ok.timeAdj);
  const k = B.resolve('kurier', b, false, () => 0); assert(k.courier && k.bus.broken && k.cost === 70);
  assert.throws(() => B.resolve('x', b, false, () => 0));
});
t('serwis: przegląd i remont, zepsuty bus tylko remont, brak gotówki i bus w świetnym stanie odrzucone', () => {
  const b = { cond: 40, broken: false, km: 0, breakdowns: 0 };
  assert.strictEqual(B.service(b, 'przeglad', 1000).bus.cond, 70); assert.strictEqual(B.service(b, 'remont', 1000).bus.cond, 100);
  assert(B.serviceCost(b, 'remont') > B.serviceCost(b, 'przeglad'));
  assert(!B.service(Object.assign({}, b, { broken: true }), 'przeglad', 1000).ok && B.service(Object.assign({}, b, { broken: true }), 'remont', 1000).bus.broken === false);
  assert(!B.service(b, 'remont', 10).ok && !B.service({ cond: 99, broken: false, km: 0, breakdowns: 0 }, 'przeglad', 1000).ok);
});
t('symulacja: nieserwisowany bus psuje się średnio co kilkanaście przejazdów, serwisowany rzadziej', () => {
  const run = svc => { const r = lcg(9); let b = B.fresh(), br = 0, N = 4000; for (let i = 0; i < N; i++) { if (B.rollBreakdown(b, 0, false, r)) { br++; b = B.resolve('laweta', b, false, r).bus; } b = B.drive(b, 0, false); if (svc && b.cond < 65) b = B.service(b, 'przeglad', 1e9).bus; } return N / br; };
  const never = run(false), often = run(true); assert(never > 5 && never < 40 && often > never, never + ' vs ' + often);
});
console.log('\n' + n + ' testów przeszło');
