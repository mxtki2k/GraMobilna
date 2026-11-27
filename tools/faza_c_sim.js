// Symulacja fazy C: premie ze specjalizacji i opłacalność przetargów (z audytem). Uruchomienie: node tools/faza_c_sim.js
const F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), K = require('../prototypes/janusz/kontrakty.js'), P = require('../prototypes/janusz/przetargi.js'), Sp = require('../prototypes/janusz/specjalizacje.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js'), Sur = require('./niespodzianki.js');
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ACC = { solid: 0.8, mieszanie: 0.65, fusz: 0.5 };
function stage(job, mult, client, style, r, price, mods) {
  const j = JOBS[job], pick = i => style === 'solid' ? 'dobrze' : style === 'mieszanie' ? (i % 2 ? 'skrot' : 'dobrze') : 'fusz';
  const picks = j.steps.map((s, i) => ({ stepId: s.id, optionId: pick(i), accuracy: Math.max(0, Math.min(1, ACC[style] + (r() - 0.5) * 0.3 + mods.acc)) }));
  const sur = Sur.roll(job, style, r), t = Math.round(sur.time * (1 - mods.time) * 10) / 10;
  const res = F.evaluate(Object.assign({}, j, { base: Math.round(j.base * mult) }), picks, client, { payMult: price * mods.pay, hazardMult: mods.hazard, time: t - mods.time * j.steps.reduce((a, s, i) => a + s.options.find(o => o.id === pick(i)).time, 0), defects: sur.defects });
  const claim = F.rollClaim(res, r);
  return { res, minutes: C.minutes(Math.max(1, res.time), false), cost: res.cost + sur.cost, claim: claim ? claim.amount : 0, pay: res.payout };
}
const modsAt = lv => ({ acc: 0.02 * lv, time: 0.015 * lv, hazard: 1 - 0.05 * lv, pay: 1 + 0.02 * lv });
const f = x => (x >= 0 ? '+' : '') + Math.round(x);
console.log('1) Specjalizacje: stawka po kosztach (zł/h) tych samych zleceń, mieszany styl, mnożnik 1,4\n');
console.log('robota'.padEnd(12), 'poz.0'.padStart(7), 'poz.1'.padStart(7), 'poz.2'.padStart(7), 'poz.3'.padStart(7), '  zysk poz.3');
for (const id of Object.keys(JOBS)) {
  const row = [0, 1, 2, 3].map(lv => { const r = lcg(9); let net = 0, h = 0; for (let i = 0; i < 400; i++) { const s = stage(id, 1.4, CLIENTS.mirek, 'mieszanie', r, 1, modsAt(lv)); net += s.pay * 0.9 - s.cost - s.claim; h += s.minutes / 60; } return net / h; });
  console.log(id.padEnd(12), ...row.map(x => f(x).padStart(7)), '  ' + Math.round((row[3] / row[0] - 1) * 100) + '%');
}
console.log('\n2) Przetargi: wartość oczekiwana jednej próby (zł) i zł/h pracy, 300 prób na przetarg, oferta × styl pracy (poziomy specjalizacji 2, ocena firmy 3,5)\n');
console.log('przetarg'.padEnd(12), 'oferta'.padEnd(8), 'szansa'.padStart(7), ['solid', 'mieszanie'].map(s => (s + ': EV zł | zł/h | oblany audyt').padEnd(40)).join(''));
for (const t of Object.values(P.TENDERS)) for (const bk of ['low', 'std', 'high']) {
  const cc = K.CONTRACTS[P.cid(t.id)], cl = CLIENTS[cc.client], tm = P.terms(t, bk, JOBS), win = P.winChance(bk, { stars: 3.5, trust: 0, rivalPower: 35 });
  const cells = ['solid', 'mieszanie'].map(style => {
    const r = lcg(3 + cc.stages.length); let ev = 0, hours = 0, failed = 0, N = 300;
    for (let n = 0; n < N; n++) {
      let st = K.accept(K.fresh(), cc.id, 0, JOBS, { priceMult: tm.priceMult, wadium: tm.wadium }).state, net = st.active.deposit - tm.wadium, mins = 15;
      cc.stages.forEach((s, i) => { const a = stage(s.job, s.mult, cl, style, r, K.trancheOf(cc) * tm.priceMult, modsAt(2)); net += a.pay * 0.9 - a.cost - a.claim; mins += a.minutes + (i ? 3 : 0); st = K.recordStage(st, a.res, a.pay).state; });
      const fin = K.final(st, (cc.stages[cc.stages.length - 1].day + 1) * 1440, cl, r); net += fin.net + fin.wadiumBack; if (fin.failed) failed++; ev += net; hours = hours + mins / 60;
    }
    return (f(ev / N * win) + ' | ' + f(ev / hours) + ' | ' + Math.round(failed / N * 100) + '%').padEnd(40);
  });
  console.log(t.id.padEnd(12), bk.padEnd(8), (Math.round(win * 100) + '%').padStart(7), ...cells);
}
