// Symulacja kontraktów: czy opłacają się bardziej niż te same roboty brane pojedynczo? Uruchomienie: node tools/kontrakty_sim.js
const F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), St = require('../prototypes/janusz/stawka.js'), K = require('../prototypes/janusz/kontrakty.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js'), Sur = require('./niespodzianki.js');
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const STYLES = { solidnie: 'solid', mieszanie: 'mieszanie', fuszerka: 'fusz' }, ACC = { solid: 0.8, mieszanie: 0.65, fusz: 0.5 };
const TRAVEL_MIN = 15, TRANSPORT_COST = 12; // dojazd i paliwo na każdy osobny wyjazd (w kontrakcie tylko raz)

function stage(job, mult, client, style, r, night, price) {
  const j = JOBS[job], m = C.mods(night), pick = i => style === 'solid' ? 'dobrze' : style === 'mieszanie' ? (i % 2 ? 'skrot' : 'dobrze') : 'fusz';
  const picks = j.steps.map((s, i) => ({ stepId: s.id, optionId: pick(i), accuracy: Math.max(0, Math.min(1, ACC[style] + (r() - 0.5) * 0.3 - (night ? m.accPenalty : 0))) }));
  const sur = Sur.roll(job, style, r);
  const res = F.evaluate(Object.assign({}, j, { base: Math.round(j.base * mult) }), picks, client, { payMult: m.payMult * price, attentionMult: m.attention, hazardMult: m.hazard, time: sur.time, defects: sur.defects });
  const minutes = C.minutes(Math.max(1, res.time), night), claim = F.rollClaim(res, r);
  return { res, minutes, cost: res.cost + sur.cost, claim: claim ? claim.amount : 0, pay: res.payout };
}
function contract(c, style, r, N) {
  const cl = CLIENTS[c.client], q = K.quote(c, JOBS); let net = 0, hours = 0, single = 0, singleH = 0;
  for (let n = 0; n < N; n++) {
    let st = K.accept(K.fresh(), c.id, 0, JOBS).state, cNet = q.deposit, cMin = TRAVEL_MIN, sNet = 0, sMin = 0, clock = 0;
    c.stages.forEach((s, i) => {
      const night = false;
      const a = stage(s.job, s.mult, cl, style, r, night, K.TRANCHE), b = stage(s.job, s.mult, cl, style, r, night, 1);
      cNet += a.pay * 0.9 - a.cost - a.claim; cMin += a.minutes + (i ? 3 : 0); st = K.recordStage(st, a.res, a.pay).state;
      sNet += b.pay * 0.9 - b.cost - b.claim - TRANSPORT_COST; sMin += b.minutes + TRAVEL_MIN;
      clock = (s.day + 1) * 1440;
    });
    const fin = K.final(st, clock, cl, r); cNet += fin.net; net += cNet; hours += cMin / 60; single += sNet; singleH += sMin / 60;
  }
  return { cph: net / hours, sph: single / singleH };
}
const f = x => (x >= 0 ? '+' : '') + Math.round(x);
console.log('Kontrakt kontra te same roboty pojedynczo (zł/h po kosztach, bez kar za spóźnienie), 300 przebiegów\n');
console.log('kontrakt'.padEnd(14), Object.keys(STYLES).map(s => s.padEnd(26)).join(''));
for (const c of Object.values(K.CONTRACTS)) {
  const row = Object.entries(STYLES).map(([k, sty]) => { const x = contract(c, sty, lcg(5 + c.stages.length), 300); return (f(x.cph) + ' vs ' + f(x.sph) + ' (' + Math.round((x.cph / x.sph - 1) * 100) + '%)').padEnd(26); }).join('');
  console.log(c.id.padEnd(14), row);
}
