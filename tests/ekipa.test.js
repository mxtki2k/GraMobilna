// Testy modułu ekipy. Uruchomienie: node tests/ekipa.test.js
const assert = require('assert');
const E = require('../prototypes/janusz/ekipa.js');
const F = require('../prototypes/janusz/fuszerka.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const crew = () => E.CANDIDATES.map(E.newWorker);
const seq = (r) => { let i = 0; return () => r[i++ % r.length]; };
const wid = (c, id) => c.find(w => w.id === id);

t('dane: kandydaci mają poprawne atrybuty', () => {
  for (const c of E.CANDIDATES) {
    assert(c.skill >= 0 && c.skill <= 1 && c.reliab >= 0 && c.reliab <= 1 && c.greed >= 0.6 && c.greed <= 1.4 && c.wage > 0);
  }
});

t('pełna wypłata zgodnie z umową: nastrój rośnie lub trzyma, brak zaległości', () => {
  const c = crew(), pay = {}; c.forEach(w => pay[w.id] = w.wage);
  const r = E.applyPay(c, pay);
  r.workers.forEach(w => { assert.strictEqual(w.owed, 0); });
  r.details.forEach(d => assert(d.delta >= -3, d.name + ' ' + d.delta));
});

t('brak wypłaty: nastrój spada, zaległości rosną o pensję', () => {
  const c = crew(), r = E.applyPay(c, {});
  r.workers.forEach((w, i) => { assert.strictEqual(w.owed, c[i].wage); assert(w.mood < c[i].mood - 15, w.name); });
});

t('pazerniejszy bardziej cierpi z powodu braku pensji', () => {
  const k = wid(crew(), 'kacper'), s = wid(crew(), 'staszek');
  k.mood = s.mood = 70; k.patience = s.patience = 50;
  const r = E.applyPay([k, s], {});
  const dk = r.details.find(d => d.id === 'kacper').parts.short, ds = r.details.find(d => d.id === 'staszek').parts.short;
  assert(ds < dk, ds + ' vs ' + dk);
});

t('premia poprawia nastrój, a nadpłata spłaca zaległości', () => {
  const w = Object.assign(E.newWorker(E.CANDIDATES[1]), { owed: 90, mood: 50 });
  const r = E.applyPay([w], { [w.id]: w.wage + 90 + 45 });
  assert.strictEqual(r.workers[0].owed, 0);
  assert(r.details[0].bonus === 45 && r.workers[0].mood > 50);
});

t('zazdrość: wykwalifikowany obrażony, gdy słabszy dostał więcej', () => {
  const a = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 70 }); // Staszek
  const b = Object.assign(E.newWorker(E.CANDIDATES[0]), { mood: 70 }); // Kacper
  const fair = E.applyPay([a, b], { [a.id]: a.wage, [b.id]: b.wage });
  const unfair = E.applyPay([a, b], { [a.id]: a.wage, [b.id]: a.wage + 50 });
  const da = fair.details[0].mood, db = unfair.details[0].mood;
  assert(db < da, db + ' vs ' + da);
  assert(unfair.details[0].parts.envy < 0 && fair.details[0].parts.envy === 0);
});

t('ryzyko absencji i wystawienia rośnie z niskim nastrojem i niską solidnością', () => {
  const good = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 90 });
  const bad = Object.assign(E.newWorker(E.CANDIDATES[1]), { mood: 15, owed: 300 });
  assert(E.risk(bad).absent > E.risk(good).absent);
  assert(E.risk(good).walkout === 0 && E.risk(bad).walkout > 0.3);
  assert.strictEqual(E.attendance(bad, seq([0])), 'absent');
  assert.strictEqual(E.attendance(good, seq([0.99])), 'present');
  assert.strictEqual(E.walksOut(bad, seq([0])), true);
  assert.strictEqual(E.walksOut(good, seq([0])), false);
});

t('pomocnik: dobry poprawia celność i czas, zły (słaby, wkurzony) pogarsza', () => {
  const pro = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 90 });
  const rookie = Object.assign(E.newWorker(E.CANDIDATES[0]), { mood: 70 });
  const upset = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 20 });
  const a = E.helperEffect(pro), b = E.helperEffect(rookie), c = E.helperEffect(upset);
  assert(a.accBonus > 0.2 && a.timeFactor < 0.9);
  assert(b.accBonus < 0);
  assert(c.accBonus < a.accBonus);
});

t('upominanie się: nie wtedy, gdy nastrój dobry; tak przy złym nastroju lub zaległościach', () => {
  const ok = Object.assign(E.newWorker(E.CANDIDATES[2]), { mood: 80 });
  assert.strictEqual(E.demand(ok), null);
  const owed = Object.assign(ok, { mood: 55, owed: ok.wage + 1 });
  assert.strictEqual(E.demand(owed).kind, 'zaleglosc');
  const low = Object.assign(E.newWorker(E.CANDIDATES[2]), { mood: 40 });
  assert.strictEqual(E.demand(low).kind, 'podwyzka');
});

t('odpowiedź na żądanie: zgoda poprawia nastrój i zmniejsza zaległość, odmowa pogarsza', () => {
  const w = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 40, owed: 200 });
  const yes = E.answerDemand(w, true, 100), no = E.answerDemand(w, false, 100);
  assert(yes.mood > w.mood && yes.owed === 100);
  assert(no.mood < w.mood && no.owed === 200);
});

t('odejście: tylko przy skrajnym nastroju i zaległościach', () => {
  const w = E.newWorker(E.CANDIDATES[1]);
  assert.strictEqual(E.quits(w), false);
  assert.strictEqual(E.quits(Object.assign({}, w, { mood: 5, owed: w.wage, strikes: 1 })), false);
  assert.strictEqual(E.quits(Object.assign({}, w, { mood: 5, owed: w.wage, strikes: 2 })), true);
});

t('fuchy na boku: zadowolony i obecny zarabia więcej niż wkurzony', () => {
  const happy = [Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 95 })];
  const sad = [Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 25 })];
  assert(E.sideGigs(happy, seq([0.99])).total > E.sideGigs(sad, seq([0.99])).total);
  assert.strictEqual(E.sideGigs(happy, seq([0])).total, 0); // nie przyszedł
});

t('domyślna wypłata respektuje budżet i najpierw płaci najlepszym', () => {
  const c = crew(), budget = 250, pay = E.defaultPay(c, budget);
  const sum = Object.values(pay).reduce((a, b) => a + b, 0);
  assert(sum <= budget);
  assert.strictEqual(pay.staszek, 200);
});

t('jedna wypłata zero nie wyrzuca pracownika od razu (najpierw ostrzeżenie)', () => {
  const s = E.newWorker(E.CANDIDATES[3]);
  const r1 = E.applyPay([s], {}).workers[0];
  assert(r1.mood < 15 && r1.strikes === 1 && !E.quits(r1));
  const r2 = E.applyPay([r1], {}).workers[0];
  assert(E.quits(r2));
  const saved = E.applyPay([r1], { [r1.id]: r1.wage + r1.owed }).workers[0];
  assert.strictEqual(saved.strikes, 0);
});

t('symulacja: ciągłe niedopłacanie prowadzi do odejścia, uczciwe płacenie do stabilności', () => {
  let c = [E.newWorker(E.CANDIDATES[1])];
  let quit = -1;
  for (let k = 1; k <= 12; k++) { c = E.applyPay(c, {}).workers; if (E.quits(c[0])) { quit = k; break; } }
  assert(quit > 0 && quit <= 8, 'odszedł po ' + quit);
  let d = [E.newWorker(E.CANDIDATES[1])];
  for (let k = 1; k <= 12; k++) d = E.applyPay(d, { [d[0].id]: d[0].wage }).workers;
  assert(d[0].mood >= 55 && d[0].owed === 0, 'nastrój ' + d[0].mood);
});

t('ocena fuszerki: korekta czasu i dodatkowe wady od ekipy', () => {
  const job = JOBS.kran, p = job.steps.map(s => ({ stepId: s.id, optionId: 'dobrze', accuracy: 1 }));
  const base = F.evaluate(job, p, CLIENTS.karyna);
  const adj = F.evaluate(job, p, CLIENTS.karyna, { time: -3, defects: [{ label: 'ekipa zostawiła bałagan', sev: 2, vis: 0.7 }] });
  assert.strictEqual(adj.time, base.time - 3);
  assert(adj.index > base.index && adj.satisfaction < base.satisfaction);
});

console.log('\n' + n + ' testów przeszło');
