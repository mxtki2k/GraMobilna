// Symulacja fazy B: ile ekipa zarabia sama (po materiałach, paliwie, reklamacjach, podatku i pensji). Uruchomienie: node tools/faza_b_sim.js
const Z = require('../prototypes/janusz/zlecenia_ekipy.js'), F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), E = require('../prototypes/janusz/ekipa.js'), Sw = require('../prototypes/janusz/swiat.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const deps = { evaluate: F.evaluate, rollClaim: F.rollClaim, minutes: u => C.minutes(u, false), jobs: JOBS, clients: CLIENTS };
const DAYS = 30, WORK_MIN = 480, PAYDAY_DAYS = 1.5, PAYMULT = 1.0, TAX = 0.1;
function run(names, policy, seed, boardN) {
  const r = lcg(seed), crew = names.map(id => E.newWorker(E.CANDIDATES.find(c => c.id === id))), ids = Object.keys(JOBS), cl = Object.keys(CLIENTS);
  const m = { net: 0, wages: 0, jobs: 0, stars: 0, claims: 0, absent: 0, fuel: 0, idle: 0 };
  for (let d = 0; d < DAYS; d++) {
    const board = Z.makeBoard(d, r, 2.6, ids, cl, boardN || 5), free = crew.map(() => 0), loc = crew.map(() => 'baza'); let off = board.slice();
    // przydział: każdy pracownik bierze kolejno najlepiej dopasowaną ofertę, dopóki mieści się w dniówce
    for (let round = 0; round < 6 && off.length; round++) for (let i = 0; i < crew.length && off.length; i++) {
      const w = crew[i]; if (free[i] >= WORK_MIN) continue;
      const state = Sw.rollState(w, {}, r); if (E.attendance(w, r, {}) === 'absent') { m.absent++; free[i] = WORK_MIN; continue; }
      const ok = off.filter(o => Z.canDo(w, o.job)); if (!ok.length) { free[i] = WORK_MIN; continue; }
      const pick = policy === 'dopasowane' ? ok.slice().sort((a, b) => Z.quality(w, state, b) - Z.quality(w, state, a))[0] : ok[0];
      off = off.filter(o => o !== pick);
      const s = Z.simulate(w, state, pick, r, deps, { payMult: PAYMULT, from: loc[i], clock: 0 });
      if (free[i] + s.minutes > WORK_MIN + 60) { off.push(pick); free[i] = WORK_MIN; continue; }
      free[i] += s.minutes; loc[i] = pick.district; m.jobs++; m.stars += s.r.stars; m.fuel += s.fuel;
      const claim = s.claimInfo ? s.claim : 0; m.claims += claim; m.net += s.payout * (1 - TAX) - s.cost - s.fuel - claim;
    }
    m.idle += free.reduce((a, x) => a + Math.max(0, WORK_MIN - x), 0);
    for (const w of crew) m.wages += w.wage / PAYDAY_DAYS;
  }
  return m;
}
const avg = (names, pol, N = 120, bn) => { const a = { net: 0, wages: 0, jobs: 0, stars: 0, claims: 0, absent: 0, idle: 0 }; for (let i = 0; i < N; i++) { const m = run(names, pol, 40 + i, bn); for (const k in a) a[k] += m[k]; } for (const k in a) a[k] /= N; return a; };
const f = x => Math.round(x);
console.log('Ekipa pracuje sama przez ' + DAYS + ' dni (tablica 5 ofert dziennie). Zysk netto = wypłata − podatek − materiały − paliwo − reklamacje.\n');
console.log('skład'.padEnd(34), 'zlec/d  ★    zysk brutto/d  pensje/d  zysk netto/d  (po pensji)  reklamacje/d  nieobecności');
for (const names of [['kacper'], ['zbyszek'], ['zdzisiek'], ['staszek'], ['kacper', 'zbyszek'], ['zdzisiek', 'staszek'], ['kacper', 'zbyszek', 'zdzisiek'], ['kacper', 'zbyszek', 'zdzisiek', 'staszek']]) for (const pol of ['dopasowane']) {
  const a = avg(names, pol); console.log(names.join('+').padEnd(34), (a.jobs / DAYS).toFixed(1).padStart(5), (a.stars / Math.max(1, a.jobs)).toFixed(1).padStart(5), String(f(a.net / DAYS)).padStart(10), String(f(a.wages / DAYS)).padStart(9), String(f(a.net / DAYS)).padStart(12), String(f((a.net - a.wages) / DAYS)).padStart(10), String(f(a.claims / DAYS)).padStart(12), (a.absent / DAYS).toFixed(2).padStart(10));
}
console.log('\nPorównanie przydziału (zdzisiek+staszek): dopasowane vs po kolei'); for (const p of ['dopasowane', 'kolejno']) { const a = avg(['zdzisiek', 'staszek'], p); console.log(p.padEnd(12), 'netto po pensji/d', f((a.net - a.wages) / DAYS), '★', (a.stars / Math.max(1, a.jobs)).toFixed(2)); }
