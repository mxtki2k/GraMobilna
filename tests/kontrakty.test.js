// Testy kontraktów. Uruchomienie: node tests/kontrakty.test.js
const assert = require('assert');
const K = require('../prototypes/janusz/kontrakty.js'), J = require('../prototypes/janusz/jobs.js'), T = require('../prototypes/janusz/terminy.js');
const { JOBS, CLIENTS } = J, C = K.CONTRACTS;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const r = (stars, defects) => ({ stars, index: 20, defects: defects || [] });

t('dane: każdy kontrakt ma klienta, roboty, rosnące dni, godziny i termin zamykający ostatni etap', () => {
  assert(Object.keys(C).length >= 6);
  for (const c of Object.values(C)) {
    assert(CLIENTS[c.client] && c.stages.length >= 3 && c.deadline >= c.stages[c.stages.length - 1].day + 1 && c.title && c.desc, c.id);
    let prev = -1; for (const s of c.stages) { assert(JOBS[s.job] && s.mult > 0 && /^\d\d:\d\d$/.test(s.time) && s.day >= prev && (!s.due || T.KINDS[s.due]), c.id + ':' + s.job); prev = s.day; }
  }
  const mins = Object.values(C).map(c => c.minDone); assert.deepStrictEqual(mins.slice().sort((a, b) => a - b), mins, 'kolejność odblokowywania');
});
t('wycena: zaliczka 25% oczekiwanej wypłaty, transza łącznie z zaliczką daje premię kontraktową', () => {
  const q = K.quote(C.lazienka, JOBS); assert(q.nominal > 0 && q.deposit > 0 && q.deposit < q.expected);
  assert(Math.abs(q.deposit / q.expected - K.DEPOSIT) < 0.01 && Math.abs(K.TRANCHE - K.PREMIUM * (1 - K.DEPOSIT)) < 1e-3 && K.PREMIUM >= 1);
  assert(K.quote(C.tesciowa, JOBS).nominal > K.quote(C.lazienka, JOBS).nominal);
});
t('dostępność zależy od liczby wykonanych zleceń', () => {
  assert.deepStrictEqual(K.available(0).map(c => c.id), ['lazienka']); assert(K.available(100).length === Object.keys(C).length); assert(K.available(8).length === 3);
});
t('przyjęcie: jeden aktywny kontrakt, zapisuje termin i zaliczkę', () => {
  const a = K.accept(K.fresh(), 'lazienka', 3 * 1440 + 600, JOBS); assert(a.ok && a.state.active.stage === 0 && a.state.active.deposit === a.deposit);
  assert.strictEqual(a.state.active.deadlineAt, 3 * 1440 + 6 * 1440 + 1439);
  assert(!K.accept(a.state, 'kuchnia', 0, JOBS).ok && !K.accept(K.fresh(), 'nie-ma', 0, JOBS).ok);
});
t('poziom etapu: godzina z kalendarza kontraktu, spóźniony etap startuje za 20 minut, mnożnik transzy i dane kontraktu', () => {
  const st = K.accept(K.fresh(), 'lazienka', 1440 * 2 + 480, JOBS).state;
  const l0 = K.stageLevel(st, 1440 * 2 + 480); assert.strictEqual(l0.startAt, 1440 * 2 + 600); assert(l0.priceMult === K.TRANCHE && l0.contract.of === 4 && l0.job === 'kran' && l0.slot === 'dzien');
  const late = K.stageLevel(st, 1440 * 2 + 900); assert.strictEqual(late.startAt, 1440 * 2 + 920);
  const night = K.accept(K.fresh(), 'tesciowa', 0, JOBS).state; night.active.stage = 5; night.active.acceptedAt = 0;
  assert(K.stageLevel(night, 0).due === 'normalny');
});
t('zapis etapu: zbiera ukryte wady (vis < 0,5, sev ≥ 2), wykrywa ostatni etap', () => {
  let s = K.accept(K.fresh(), 'kuchnia', 0, JOBS).state;
  const a = K.recordStage(s, r(4, [{ label: 'ukryta', sev: 3, vis: 0.1 }, { label: 'widoczna', sev: 3, vis: 0.9 }, { label: 'drobna', sev: 1, vis: 0.1 }]), 400);
  assert.strictEqual(a.result.hidden.length, 1); assert(!a.last && a.state.active.stage === 1);
  s = a.state; s = K.recordStage(s, r(5), 500).state; const z = K.recordStage(s, r(5), 500); assert(z.last && z.state.active.results.length === 3);
});
function run(stars, hiddenDefs, clockEnd, client, rng) {
  let s = K.accept(K.fresh(), 'kuchnia', 0, JOBS).state; const c = C.kuchnia;
  c.stages.forEach((_, i) => { s = K.recordStage(s, r(stars[i], i === 0 ? hiddenDefs : []), 400).state; });
  return K.final(s, clockEnd, client, rng);
}
t('odbiór: czysty i w terminie daje premię, ukryte wady wychodzą u wymagającego klienta i kosztują, ocena spada', () => {
  const ok = run([5, 5, 4], [], 1440 * 3, CLIENTS.mirek, () => 0.5); assert(ok.bonus > 0 && ok.net === ok.bonus && ok.stars >= 4 && ok.state.active === null && ok.state.done.kuchnia.count === 1);
  const hid = [{ label: 'x', sev: 4, vis: 0.1 }, { label: 'y', sev: 3, vis: 0.2 }];
  const found = run([5, 5, 5], hid, 1440 * 3, CLIENTS.heniek, () => 0); assert(found.found.length === 2 && found.rework === 175 && found.bonus === 0 && found.net === -175 && found.stars === 4);
  const missed = run([5, 5, 5], hid, 1440 * 3, CLIENTS.mirek, () => 0.99); assert(missed.found.length === 0 && missed.hiddenTotal === 2 && missed.rework === 0);
});
t('opóźnienie: 3% nominału za dzień, limit 40%, i premia przepada', () => {
  const nom = K.quote(C.kuchnia, JOBS).nominal, dl = 5 * 1440 + 1439;
  const l2 = run([5, 5, 5], [], dl + 2 * 1440, CLIENTS.mirek, () => 0.5); assert(l2.lateDays === 2 && l2.latePenalty === Math.round(nom * 0.06) && l2.bonus === 0);
  assert.strictEqual(run([5, 5, 5], [], dl + 99 * 1440, CLIENTS.mirek, () => 0.5).latePenalty, Math.round(nom * 0.4));
  assert.strictEqual(run([5, 5, 5], [], dl, CLIENTS.mirek, () => 0.5).lateDays, 0);
});
t('rezygnacja: oddajesz zaliczkę i płacisz 10% nominału, kontrakt znika', () => {
  const s = K.accept(K.fresh(), 'lazienka', 0, JOBS); const c = K.cancel(s.state);
  assert(c.penalty === s.deposit + Math.round(s.quote.nominal * 0.1) && c.state.active === null);
});
t('losowy odbiór: im mniej uważny klient, tym rzadziej wyłapuje ukryte wady', () => {
  const hid = Array.from({ length: 6 }, (_, i) => ({ label: 'w' + i, sev: 3, vis: 0.1 })), rg = lcg(4);
  const cnt = cl => { let f = 0; for (let i = 0; i < 400; i++) f += run([5, 5, 5], hid, 0, cl, rg).found.length; return f / 400; };
  const m = cnt(CLIENTS.mirek), s = cnt(CLIENTS.sebix), k = cnt(CLIENTS.karyna), g = cnt(CLIENTS.grazyna); assert(m < s && s < k && k < g, [m, s, k, g].join());
});
t('wiele kontraktów: limit z poziomu siedziby, drugi kontrakt trafia do kolejki, przełączanie i awans po zakończeniu', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(K.slots), [1, 1, 2, 2, 3, 3]);
  let s = K.accept(K.fresh(), 'lazienka', 0, JOBS, {}, 2).state; assert(!K.accept(s, 'lazienka', 0, JOBS, {}, 2).ok && /już trwa/.test(K.accept(s, 'lazienka', 0, JOBS, {}, 2).reason) && !K.accept(s, 'kuchnia', 0, JOBS, {}, 1).ok);
  const b = K.accept(s, 'kuchnia', 5, JOBS, {}, 2); assert(b.ok && b.state.active.id === 'kuchnia' && b.state.others.length === 1 && b.state.others[0].id === 'lazienka' && K.countActive(b.state) === 2 && !K.canAccept(b.state, 2) && K.canAccept(b.state, 3));
  const sw = K.switchTo(b.state, 'lazienka'); assert(sw.active.id === 'lazienka' && sw.others[0].id === 'kuchnia' && K.switchTo(b.state, 'nie-ma') === b.state);
  const c = K.cancel(b.state); assert(c.state.active.id === 'lazienka' && c.state.others.length === 0);
  let t2 = sw; const cc = K.CONTRACTS.lazienka; cc.stages.forEach(() => { t2 = K.recordStage(t2, { stars: 5, index: 20, defects: [] }, 400).state; }); const f = K.final(t2, 0, CLIENTS.mirek, () => 0.5);
  assert(f.state.active.id === 'kuchnia' && f.state.others.length === 0 && f.state.done.lazienka.count === 1);
  assert(K.stageLevel(b.state, 0).contract.id === 'kuchnia' && K.stageLevel(sw, 0).contract.id === 'lazienka');
});
console.log('\n' + n + ' testów przeszło');
