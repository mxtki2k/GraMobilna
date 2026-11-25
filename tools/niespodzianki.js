// Pomocnik symulacji: wynik niespodzianek (z łańcuchami) dla danego stylu pracy. Używany przez balans.js i balans2.js.
const J = require('../prototypes/janusz/jobs.js');
const CH = { solid: 'dobrze', mieszanie: 'skrot', fusz: 'fusz' };
function roll(jobId, style, rng, fatigueTimeMult) {
  const job = J.JOBS[jobId], opt = CH[style === 'solidnie' ? 'solid' : style] || 'skrot', out = { time: 0, cost: 0, defects: [], n: 0 };
  let chain = null;
  for (let step = 0; step < job.steps.length - 1; step++) {
    let sp = J.rollSurprise(jobId, step, rng);
    if (!sp && chain && chain.at === step && rng() < 0.75) sp = J.getSurprise(jobId, chain.id);
    if (chain && chain.at <= step) chain = null;
    if (!sp) continue;
    const o = sp.options.find(x => x.id === opt);
    out.time += o.time * (fatigueTimeMult || 1); out.cost += o.cost; out.n++; o.defects.forEach(d => out.defects.push({ label: d.label, sev: d.sev, vis: d.vis, hazard: d.hazard || 0 }));
    if (o.then) chain = { id: o.then, at: step + 1 };
  }
  return out;
}
module.exports = { roll };
