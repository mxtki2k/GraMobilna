// Testy modułu ryzyka i świata. Uruchomienie: node tests/swiat.test.js
const assert = require('assert');
const S = require('../prototypes/janusz/swiat.js');
const E = require('../prototypes/janusz/ekipa.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const seq = (r) => { let i = 0; return () => r[i++ % r.length]; };
const W = id => E.newWorker(E.CANDIDATES.find(c => c.id === id));
function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function rate(fn, N = 4000) { const r = lcg(7); let k = 0; for (let i = 0; i < N; i++) if (fn(r)) k++; return k / N; }

t('kandydaci mają nowe cechy (pracowitość, alkohol, prawo jazdy, jazda)', () => {
  for (const c of E.CANDIDATES) assert(c.diligence >= 0 && c.alcohol >= 0 && typeof c.license === 'boolean' && c.driving >= 0, c.id);
  assert.strictEqual(W('kacper').license, false);
});

t('stan kierowcy: pijący częściej niż abstynent; po wypłacie i przy złym nastroju częściej', () => {
  const zdz = W('zdzisiek'), kac = W('kacper');
  const drunk = (w, ctx) => rate(r => S.rollState(w, ctx, r) !== 'trzezwy');
  assert(drunk(zdz, {}) > drunk(kac, {}) + 0.2);
  assert(drunk(zdz, { paydayEve: true }) > drunk(zdz, {}));
  const sad = Object.assign({}, zdz, { mood: 15 });
  assert(drunk(sad, {}) > drunk(zdz, {}));
});

t('ryzyko wypadku: pijany > po piwie > trzeźwy; dobry kierowca bezpieczniejszy', () => {
  const w = W('zdzisiek'), world = S.newWorld();
  const a = s => S.driveRisk(w, s, world, 'worker').accident;
  assert(a('pijany') > a('po-piwie') && a('po-piwie') > a('kac') && a('kac') > a('trzezwy'));
  const bad = Object.assign({}, w, { driving: 0.1 });
  assert(S.driveRisk(bad, 'pijany', world, 'worker').accident > a('pijany'));
});

t('trzeźwy bez prawka: mniejsze ryzyko wypadku niż pijany z prawkiem, ale policja nadal groźna', () => {
  const kac = W('kacper'), zdz = W('zdzisiek'), world = S.newWorld();
  const noLic = S.driveRisk(kac, 'trzezwy', world, 'worker'), drunk = S.driveRisk(zdz, 'pijany', world, 'worker');
  assert(noLic.accident < drunk.accident);
  assert(noLic.police > 0);
  assert(S.driveRisk(kac, 'trzezwy', Object.assign({}, world, { heat: 0.6 }), 'worker').police > noLic.police);
});

t('tryby: kurier bez ryzyka, ty prawie bez ryzyka, obie opcje kosztują czas lub pieniądze', () => {
  const world = S.newWorld();
  assert.deepStrictEqual(S.driveRisk(null, 'trzezwy', world, 'courier'), { accident: 0, police: 0 });
  const c = S.resolveDrive(null, 'trzezwy', world, 'courier', seq([0.5]));
  assert(c.cost === 70 && c.timeAdj === 2 && !c.incident);
  const o = S.resolveDrive(null, 'trzezwy', world, 'owner', seq([0.9]));
  assert(o.cost === 0 && o.timeAdj === 3);
});

t('pijany kierowca zatrzymany: traci prawo jazdy, auto na parkingu, mandat 500', () => {
  const w = W('zdzisiek');
  const r = S.resolveDrive(w, 'pijany', S.newWorld(), 'worker', seq([0.0, 0.0]));
  assert.strictEqual(r.police.kind, 'zatrzymanie');
  assert.strictEqual(r.driverPatch.license, false);
  assert(r.cost === 500 && r.heatDelta > 0 && r.incident);
});

t('bez prawka: mandat, a po powtórce auto zostaje na parkingu', () => {
  const k = W('kacper');
  const r1 = S.resolveDrive(k, 'trzezwy', S.newWorld(), 'worker', seq([0.0, 0.99]));
  assert.strictEqual(r1.police.kind, 'mandat'); assert.strictEqual(r1.police.impound, false);
  assert.strictEqual(r1.driverPatch.licenseStrikes, 1);
  const r2 = S.resolveDrive(Object.assign({}, k, { licenseStrikes: 1 }), 'trzezwy', S.newWorld(), 'worker', seq([0.0, 0.99]));
  assert.strictEqual(r2.police.impound, true);
});

t('ciężki wypadek: szpital (2 zlecenia), reklamacja typu wypadek, wysoki koszt', () => {
  const w = W('zdzisiek');
  const r = S.resolveDrive(w, 'pijany', Object.assign(S.newWorld(), { heat: 0 }), 'worker', seq([0.99, 0.0, 0.0, 0.5]));
  assert.strictEqual(r.accident.severity, 'ciezki');
  assert.strictEqual(r.driverPatch.outJobs, 2);
  assert(r.claim && r.claim.kind === 'wypadek' && r.cost >= 500);
});

t('statystyka: pijany w sumie ryzykuje znacznie więcej niż trzeźwy', () => {
  const w = W('zdzisiek'), world = S.newWorld();
  const bad = s => rate(r => S.resolveDrive(w, s, world, 'worker', r).incident);
  assert(bad('pijany') > bad('trzezwy') * 2, bad('pijany') + ' vs ' + bad('trzezwy'));
});

t('po incydencie: kryj = wdzięczność i więcej picia; potrącenie = uraz; zwolnienie = odejście', () => {
  const w = W('zdzisiek');
  const res = { cost: 600, state: 'pijany', incident: true };
  assert(S.aftermathOptions(w, res).length === 4 && S.aftermathOptions(w, { incident: false }).length === 0);
  const cover = S.applyAftermath(w, 'kryj', res).worker;
  assert(cover.gratitude === 25 && cover.alcohol > w.alcohol);
  const dock = S.applyAftermath(w, 'potracaj', res);
  assert(dock.money === 300 && dock.worker.grudge === 20 && dock.worker.mood < w.mood);
  const warn = S.applyAftermath(w, 'ostrzez', res).worker;
  assert(warn.alcohol < w.alcohol);
  const fire = S.applyAftermath(w, 'zwolnij', res);
  assert(fire.fired && fire.rep === 2);
});

t('pamięć: uraz zwiększa ryzyko nieobecności i wystawienia, wdzięczność zmniejsza', () => {
  const base = W('zbyszek');
  const grudge = Object.assign({}, base, { grudge: 80 }), grat = Object.assign({}, base, { gratitude: 80, grudge: 0 });
  assert(E.risk(grudge).absent > E.risk(base).absent && E.risk(grat).absent < E.risk(base).absent);
  assert(E.risk(grudge).walkout > E.risk(grat).walkout);
});

t('zazdrość zostawia uraz po wypłacie', () => {
  const a = W('staszek'), b = W('kacper');
  const r = E.applyPay([a, b], { [a.id]: a.wage, [b.id]: a.wage + 50 }).workers[0];
  assert(r.grudge >= 4);
});

t('pracowitość: pracowity poprawia efekt, pijany pogarsza; niepracowity częściej psuje po cichu', () => {
  const st = W('staszek'), zb = W('zbyszek');
  assert(E.helperEffect(st, 'trzezwy').accBonus > E.helperEffect(st, 'pijany').accBonus + 0.3);
  const p = (w, s) => rate(r => !!E.sloppy(w, s, r));
  assert(p(zb, 'trzezwy') > p(st, 'trzezwy') + 0.1);
  assert(p(st, 'pijany') > p(st, 'trzezwy'));
  assert(E.moralFriction(st, 'fusz') > 0 && E.moralFriction(zb, 'fusz') === 0 && E.moralFriction(st, 'dobrze') === 0);
});

t('świat: patrole rosną po incydencie i wygasają z czasem', () => {
  const w = S.newWorld(); S.tickWorld(w, 0.1);
  assert(w.heat > 0.25);
  for (let i = 0; i < 20; i++) S.tickWorld(w, 0);
  assert(Math.abs(w.heat - 0.25) < 0.02);
});

t('urlop zdrowotny wygasa po zleceniach', () => {
  let ws = [Object.assign(W('kacper'), { outJobs: 2 })];
  ws = S.tickWorkers(ws); assert.strictEqual(ws[0].outJobs, 1);
  ws = S.tickWorkers(ws); ws = S.tickWorkers(ws); assert.strictEqual(ws[0].outJobs, 0);
});

console.log('\n' + n + ' testów przeszło');
