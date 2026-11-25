// Symulacja kampanii dla nowych mechanik (zmęczenie, bus, certyfikaty, OC, stali klienci, rywal, terminy).
// Gracz-bot pracuje 60 dni gry według polityki; porównujemy zarobek na dzień i na godzinę. Uruchomienie: node tools/balans2.js
const F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), St = require('../prototypes/janusz/stawka.js');
const T = require('../prototypes/janusz/terminy.js'), B = require('../prototypes/janusz/bus.js'), Z = require('../prototypes/janusz/zmeczenie.js');
const W = require('../prototypes/janusz/wypalenie.js'), K = require('../prototypes/janusz/klienci.js'), Sz = require('../prototypes/janusz/szkolenia.js'), U = require('../prototypes/janusz/ubezpieczenie.js'), O = require('../prototypes/janusz/osiedle.js');
const J = require('../prototypes/janusz/jobs.js'), { JOBS, CLIENTS } = J, Sur = require('./niespodzianki.js');
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const DAYS = 60;

function run(pol, seed) {
  const DAYS = pol.days || 60, SIT = require('../prototypes/janusz/siedziba.js'); let tier = 0, busLvl = 0; const ev = {};
  const dayNow = () => Math.round((clock - start) / 1440 * 10) / 10;
  const r = lcg(seed), start = C.startClock();
  let clock = start, money = pol.start != null ? pol.start : 500, fat = 10, burn = 0, bus = B.fresh(), rel = {}, certs = {}, oc = U.toggle(U.fresh(), !!pol.oc), stars = [], rival = 25, jobsDone = 0, hoursWorked = 0, waited = 0;
  const m = { jobs: 0, income: 0, costs: 0, claims: 0, breakdowns: 0, naps: 0, late: 0, lost: 0, sleeps: 0, cutsGiven: 0, certCost: 0, ocPaid: 0, ocRecv: 0, starsSum: 0, fatSum: 0 };
  const rating = () => stars.length ? stars.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, stars.length) : 2.5;
  let pendingClaim = null;
  const spend = (cat, v) => { money -= v; m.costs += v; };
  while (clock - start < DAYS * 1440) {
    // sen
    if (pol.sleepAt && fat >= pol.sleepAt) { clock += 480; fat = Z.rest(fat, 480, true, C.isNight(clock - 240)); m.sleeps++; }
    // dzień wolny / urlop
    if (pol.vacationAt && burn >= pol.vacationAt && money > W.VACATION.cost) { clock += W.VACATION.days * 1440; spend('urlop', W.VACATION.cost); burn = W.vacation(burn); fat = 0; rel = K.decay(rel, W.VACATION.days, W.VACATION.trustDecay); rival += W.VACATION.rivalGain; m.vac = (m.vac || 0) + 1; }
    else if (pol.dayOffAt && burn >= pol.dayOffAt) { clock += W.DAY_OFF.hours * 60; burn = W.dayOff(burn); fat = Z.rest(fat, 24 * 60, true, true); m.off = (m.off || 0) + 1; }
    // serwis busa
    if (pol.serviceAt && bus.cond < pol.serviceAt && money > 150) { const s = B.service(bus, 'przeglad', money); if (s.ok) { bus = s.bus; spend('serwis', s.cost); clock += 60; } }
    if (bus.broken) { const s = B.service(bus, 'remont', money); if (s.ok) { bus = s.bus; spend('serwis', s.cost); clock += 120; } }
    // szkolenia
    if (pol.certs) for (const id of Object.keys(Sz.CERTS)) { const c = Sz.CERTS[id]; if (!certs[id] && money >= c.cost + 300) { const b = Sz.buy(certs, id, money); certs = b.certs; spend('szkolenie', b.cost); m.certCost += b.cost; clock += b.hours * 60; fat = Z.gain(fat, b.hours * 30, false); break; } }
    if (pol.progress) {
      for (const id of Object.keys(Sz.CERTS)) if (certs[id] && !ev['kurs ' + id]) ev['kurs ' + id] = dayNow();
      const nt = SIT.TIERS[tier + 1];
      if (nt && money >= nt.cost * 1.15) { money -= nt.cost; tier++; ev['siedziba ' + tier + ' (' + nt.name + ')'] = dayNow(); }
      const nb = SIT.ASSETS.bus.levels[busLvl];
      if (nb && money >= nb.cost * 1.3) { money -= nb.cost; busLvl++; ev['bus ' + busLvl] = dayNow(); }
      if (!ev['1000 zł'] && money >= 1000) ev['1000 zł'] = dayNow();
      if (!ev['5000 zł'] && money >= 5000) ev['5000 zł'] = dayNow();
    }
    // czekanie na telefon
    for (;;) { const night = C.isNight(clock + 60); const p = Math.min(0.6, J.callChance(night, rating(), waited) + (pol.noTrust ? 0 : Math.min(0.06, Object.values(rel).filter(x => x.trust >= 50).length * 0.02))); clock += 60; fat = Z.rest(fat, 60, false); if (r() < p && r() >= W.missCall(burn)) { waited = 0; break; } waited++; if (clock - start >= DAYS * 1440) break; }
    if (clock - start >= DAYS * 1440) break;
    const jobStart = clock + 20, night = C.isNight(jobStart), call = J.rollCall(r, rating(), night); call.client = pol.noTrust ? K.pick(r, Object.keys(CLIENTS), {}) : K.pick(r, Object.keys(CLIENTS), rel);
    const trust = K.get(rel, call.client).trust, due = T.roll(r, night);
    // rywal
    let price = 1;
    if (r() < K.contestChance(rival, O.strength({ rating: rating(), tier: 0 }), trust)) { const res = K.contest(pol.contest, trust, r); if (!res.won) { m.lost++; rival += 1.5; continue; } price = res.priceMult; if (price < 1) m.cutsGiven++; }
    const job = JOBS[call.job], cl = CLIENTS[call.client], md = C.mods(night), cm = Sz.modsFor(certs, job.id), dueSpec = due ? T.make(job.deadline, jobStart, due, night) : null;
    // dojazd
    let timeAdj = 3, transport = 0; const tm = Z.timeMult(fat) * W.timeMult(burn);
    if (!bus.broken && B.rollBreakdown(bus, busLvl, night, r)) { m.breakdowns++; const res = B.resolve('laweta', bus, night, r); transport += res.cost; timeAdj += res.timeAdj; bus = res.bus; }
    if (!bus.broken) bus = B.drive(bus, busLvl, night); else { transport += 70; timeAdj += 2; }
    // robota
    const style = dueSpec && dueSpec.kind === 'ostry' && pol.rushSkips ? 'mieszanie' : pol.style;
    const pick = i => style === 'solid' ? 'dobrze' : style === 'mieszanie' ? (i % 2 ? 'skrot' : 'dobrze') : 'fusz';
    let defects = [];
    if (r() < Z.nodChance(fat)) { defects.push({ label: 'zasnął', sev: 2, vis: 0.5 }); m.naps++; }
    const picks = job.steps.map((s, i) => ({ stepId: s.id, optionId: pick(i), accuracy: Math.max(0, Math.min(1, 0.7 + W.accMod(burn) + (r() - 0.5) * 0.3 - (night ? md.accPenalty : 0) + Z.accMod(fat) + cm.acc)) }));
    const payMult = (pol.progress ? 1 + 0.04 * tier : 1) * md.payMult * (dueSpec ? dueSpec.pay : 1) * (pol.noTrust ? 1 : K.payMult(trust)) * cm.pay * price;
    const sur = pol.noSur ? { time: 0, cost: 0, defects: [] } : Sur.roll(job.id, style === 'mieszanie' ? 'mieszanie' : style === 'solid' ? 'solid' : 'fusz', r, tm);
    defects = defects.concat(sur.defects);
    const res = F.evaluate(Object.assign({}, job, { base: Math.round(job.base * call.mult) }), picks, cl, { payMult, attentionMult: md.attention, hazardMult: md.hazard * cm.hazard, time: sur.time + timeAdj + Math.round(job.steps.reduce((a, st, i) => a + st.options.find(o => o.id === pick(i)).time, 0) * (tm - 1) * 10) / 10, defects });
    const minutes = C.minutes(Math.max(1, res.time), night), te = T.evaluate(dueSpec, minutes, res.payout);
    if (te.penalty) m.late++;
    const tax = res.payout * 0.1, income = res.payout + te.bonus;
    money += income - res.cost - sur.cost - transport - te.penalty - tax; m.income += income; m.costs += res.cost + sur.cost + transport + te.penalty + tax;
    // reklamacja / OC
    const claim = F.rollClaim(res, r); if (claim) pendingClaim = claim;
    if (pendingClaim && r() < 0.5) { const cv = U.cover(oc, pendingClaim); oc = cv.oc; money -= cv.you; m.costs += cv.you; m.claims += cv.you; m.ocRecv += cv.insurer; pendingClaim = null; }
    // koniec zlecenia
    clock = jobStart + minutes; fat = Z.gain(fat, minutes, night); burn = W.afterJob(burn, fat, night); m.burnSum = (m.burnSum || 0) + burn; hoursWorked += minutes / 60;
    rel = K.afterJob(rel, call.client, res.stars, O.GOSSIP[call.client]); stars.push(res.stars); m.jobs++; m.starsSum += res.stars; m.fatSum += fat; jobsDone++;
    if (jobsDone % 3 === 0) { if (pol.progress) { const up = SIT.TIERS[tier].upkeep + busLvl * 0 + (busLvl ? SIT.ASSETS.bus.levels[busLvl - 1].upkeep : 0); money -= up; m.costs += up; } if (oc.active) { const pr = U.premium(oc); money -= pr; m.costs += pr; m.ocPaid += pr; } oc = U.decay(oc); rival += 1.2; }
    if (money < 0) money = 0;
  }
  return { ev, perDay: (money - (pol.start != null ? pol.start : 500)) / DAYS, perHour: m.income - m.costs > -1e9 ? (money - (pol.start != null ? pol.start : 500)) / Math.max(1, hoursWorked) : 0, m, money };
}
const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
function scenario(name, pol, N = 150) {
  const res = []; for (let i = 0; i < N; i++) res.push(run(pol, 100 + i));
  const g = f => avg(res, f);
  console.log(name.padEnd(34), String(Math.round(g(x => x.perDay))).padStart(6), 'zł/d', String(Math.round(g(x => x.perHour))).padStart(5), 'zł/h·prac', ' prac.zlec', g(x => x.m.jobs).toFixed(0).padStart(3), ' ★', g(x => x.m.starsSum / Math.max(1, x.m.jobs)).toFixed(2), ' zmęcz', g(x => x.m.fatSum / Math.max(1, x.m.jobs)).toFixed(0).padStart(3), '% awar', g(x => x.m.breakdowns).toFixed(1).padStart(4), ' zaśn', g(x => x.m.naps).toFixed(1).padStart(4), ' spóźn', g(x => x.m.late).toFixed(1).padStart(4), ' reklam', Math.round(g(x => x.m.claims)).toString().padStart(4), ' wypal', g(x => (x.m.burnSum || 0) / Math.max(1, x.m.jobs)).toFixed(0).padStart(3), '% wolne', g(x => x.m.off || 0).toFixed(1), '/urlopy', g(x => x.m.vac || 0).toFixed(1), ' OC +', Math.round(g(x => x.m.ocRecv)) + '/-' + Math.round(g(x => x.m.ocPaid)));
  return g(x => x.perDay);
}
if (require.main === module) {
const base = { style: 'mieszanie', contest: 'normal', rushSkips: true };
console.log('Symulacja ' + DAYS + ' dni gry, 150 przebiegów na scenariusz (zarobek netto po wszystkich kosztach)\n');
console.log('— zmęczenie (próg snu)');
for (const s of [0, 40, 60, 80]) scenario('sen przy zmęczeniu ' + (s || 'nigdy'), Object.assign({}, base, { sleepAt: s }));
console.log('\n— serwis busa');
for (const s of [0, 40, 60, 80]) scenario('przegląd poniżej ' + (s || 'nigdy') + '%', Object.assign({}, base, { sleepAt: 60, serviceAt: s }));
console.log('\n— szkolenia, OC, rywal, styl');
const b2 = Object.assign({}, base, { sleepAt: 60, serviceAt: 60 });
scenario('bez dodatków', b2);
scenario('+ szkolenia', Object.assign({}, b2, { certs: true }));
scenario('+ OC', Object.assign({}, b2, { oc: true }));
scenario('bez efektów zaufania klientów', Object.assign({}, b2, { noTrust: true }));
scenario('rywal: zawsze zbij cenę', Object.assign({}, b2, { contest: 'cut' }));
scenario('styl solidny (nie skraca)', Object.assign({}, b2, { style: 'solid', rushSkips: false }));
scenario('styl fuszerka', Object.assign({}, b2, { style: 'fusz', rushSkips: false }));
scenario('wszystko razem (solid+skraca ostre)', Object.assign({}, b2, { certs: true, oc: true, style: 'solid', rushSkips: true }));

console.log('\n— wypalenie (dzień wolny / urlop)');
for (const o of [0, 40, 60, 80]) scenario('dzień wolny przy wypaleniu ' + (o || 'nigdy'), Object.assign({}, b2, { dayOffAt: o }));
for (const v of [60, 80]) scenario('urlop 4 dni przy wypaleniu ' + v, Object.assign({}, b2, { vacationAt: v }));
scenario('wolne 60 + urlop 85', Object.assign({}, b2, { dayOffAt: 60, vacationAt: 85 }));

}
module.exports = { run, avg };
