// Faza E: który ubiór opłaca się u którego klienta i w jakim kontekście? Zysk na zlecenie (zł) względem starych dżinsów po kosztach zużycia i prania.
// Uruchomienie: node tools/ubrania_sim.js
const F = require('../prototypes/janusz/fuszerka.js'), U = require('../prototypes/janusz/ubrania.js'), Sur = require('./niespodzianki.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const OUT = ['wlasne', 'dres', 'robocze', 'koszula', 'garnitur', 'lux'];
function perJob(clientId, outfit, jobId, formal, r, N) {
  const j = JOBS[jobId], cl = CLIENTS[clientId], item = { uid: 1, id: outfit, cond: 80, dirty: false, smell: false }, e = U.effect(item, clientId, { formal, job: jobId }), o = U.OUTFITS[outfit];
  let pay = 0, stars = 0;
  for (let n = 0; n < N; n++) {
    const picks = j.steps.map((s, i) => ({ stepId: s.id, optionId: i % 2 ? 'skrot' : 'dobrze', accuracy: 0.65 + (r() - 0.5) * 0.3 })), sur = Sur.roll(jobId, 'mieszanie', r);
    const res = F.evaluate(Object.assign({}, j, { base: Math.round(j.base * 1.5) }), picks, cl, { satBonus: e.satBonus, attentionMult: e.attention, time: sur.time, defects: sur.defects, payMult: e.pay });
    pay += res.payout; stars += res.stars;
  }
  const m = U.messy(jobId), wear = o.price / o.dur * (1 + m * o.dirt * 1.5) + (outfit === 'wlasne' ? 0 : U.WASH * m * o.dirt * 0.8);
  return { net: pay / N - wear, stars: stars / N, e };
}
console.log('Zysk netto na zlecenie względem starych dżinsów (zł), średnio po wszystkich robotach; mnożnik stawek 1,5, mieszany styl\n');
console.log('klient'.padEnd(10), 'kontekst'.padEnd(12), OUT.map(o => o.padStart(9)).join(''), '  najlepszy');
for (const cid of Object.keys(CLIENTS)) for (const [ctx, formal, jobs] of [['zwykły', false, Object.keys(JOBS)], ['przetarg', true, Object.keys(JOBS)], ['brudne', false, ['malowanie', 'plytki', 'sciana']], ['czyste', false, ['gniazdko', 'drzwi', 'okno', 'polka']]]) {
  const base = jobs.reduce((s, id) => s + perJob(cid, 'wlasne', id, formal, lcg(5), 250).net, 0) / jobs.length;
  const row = OUT.map(o => jobs.reduce((s, id) => s + perJob(cid, o, id, formal, lcg(5), 250).net, 0) / jobs.length - base);
  const best = OUT[row.indexOf(Math.max(...row))];
  console.log(cid.padEnd(10), ctx.padEnd(12), row.map(x => ((x >= 0 ? '+' : '') + Math.round(x)).padStart(9)).join(''), '  ' + best);
}
