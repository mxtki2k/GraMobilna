// Symulacja balansu: stawka po kosztach (zł/h) dla każdego zlecenia, dzień kontra noc, trzy style pracy.
// Uruchomienie: node tools/balans.js
const F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), St = require('../prototypes/janusz/stawka.js');
const { JOBS, CLIENTS, LEVELS } = require('../prototypes/janusz/jobs.js'), Sur = require('./niespodzianki.js');
function lcg(s) { return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const STYLES = { solidnie: () => 'dobrze', mieszanie: i => (i % 2 ? 'skrot' : 'dobrze'), fuszerka: () => 'fusz' };
const ACC = { solidnie: 0.8, mieszanie: 0.6, fuszerka: 0.5 };
const DRIVE_ACCIDENT = 0.02, ACC_COST = 400; // szacunek: wypadek przy jeździe własnej (noc ×1,5)
function run(level, night, style, N, helper, withSur) {
  const job = JOBS[level.job], cl = CLIENTS[level.client], m = C.mods(night), r = lcg(7 + (night ? 1 : 0));
  let net = 0, hours = 0, stars = 0, claimCost = 0;
  for (let n = 0; n < N; n++) {
    const picks = job.steps.map((s, i) => ({ stepId: s.id, optionId: STYLES[style](i), accuracy: Math.max(0, Math.min(1, ACC[style] + (r() - 0.5) * 0.3 - (night ? m.accPenalty : 0))) }));
    const j = Object.assign({}, job, { base: Math.round(job.base * level.mult) });
    const sur = withSur ? Sur.roll(level.job, style, r) : { time: 0, cost: 0, defects: [] };
    const res = F.evaluate(j, picks, cl, { payMult: m.payMult, attentionMult: m.attention, hazardMult: m.hazard, satBonus: 0, time: sur.time, defects: sur.defects });
    const units = res.time, mins = C.minutes(units, night) + 15 + (night ? 5 : 0);
    const claim = F.rollClaim(res, r); const cc = claim ? claim.amount : 0;
    const acc = DRIVE_ACCIDENT * (night ? m.accident : 1) * ACC_COST;
    const eco = St.jobEconomics({ payout: res.payout, materials: res.cost + sur.cost, transport: cc + acc, helper: helper ? St.helperShare({ wage: 90 }, night) : 0, tax: res.payout * 0.1, overhead: 0, minutes: mins });
    net += eco.net; hours += eco.hours; stars += res.stars;
  }
  return { perHour: net / hours, net: net / N, stars: stars / N };
}
const withSur = !process.argv.includes('--bez-niespodzianek');
const f = x => (x >= 0 ? '+' : '') + Math.round(x);
console.log('zlecenie'.padEnd(26), ['solidnie', 'mieszanie', 'fuszerka'].map(s => s.padEnd(22)).join(''));
console.log(''.padEnd(26), 'dzień zł/h | noc zł/h  ★'.padEnd(22).repeat(3));
for (const [i, l] of LEVELS.entries()) {
  const row = ['solidnie', 'mieszanie', 'fuszerka'].map(s => { const d = run(l, false, s, 400, false, withSur), n = run(l, true, s, 400, false, withSur); return (f(d.perHour) + ' | ' + f(n.perHour) + '  ' + d.stars.toFixed(1) + '/' + n.stars.toFixed(1)).padEnd(22); }).join('');
  console.log(((i + 1) + '. ' + l.job + '/' + l.client + (l.slot === 'noc' ? ' 🌙' : '')).padEnd(26), row);
}
// ten sam poziom jako dzień i noc: czy noc się opłaca?
console.log('\nPorównanie tych samych zleceń (mult 1,4) dzień vs noc, styl mieszany:');
for (const id of Object.keys(JOBS)) { const l = { job: id, client: 'mirek', mult: 1.4 }; const d = run(l, false, 'mieszanie', 600, false, withSur), n = run(l, true, 'mieszanie', 600, false, withSur); console.log(id.padEnd(10), 'dzień', f(d.perHour), 'zł/h  noc', f(n.perHour), 'zł/h  różnica', f(n.perHour - d.perHour)); }
if (process.argv.includes('--style-table')) {
  console.log('\nStawka po kosztach wg stylu, mult 1,4, dzień (z niespodziankami):');
  for (const id of Object.keys(JOBS)) { const l = { job: id, client: process.env.KLIENT || 'mirek', mult: 1.4 }; const c = s => f(run(l, false, s, 500, false, true).perHour).padStart(5); console.log(id.padEnd(10), 'solidnie', c('solidnie'), ' mieszanie', c('mieszanie'), ' fuszerka', c('fuszerka')); }
}
