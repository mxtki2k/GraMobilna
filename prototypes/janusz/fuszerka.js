/* Moduł oceny fuszerki. Czysta logika (bez DOM), działa w przeglądarce i w node.
 *
 * Wejście: zlecenie (job), wybory gracza (picks), klient (client).
 * Każda opcja kroku ma listę wad: { label, sev 0-10, vis 0-1, hazard 0-1 }.
 *   sev    = jak poważna jest wada,
 *   vis    = jak bardzo widoczna dla klienta od razu (0 = ukryta, wyjdzie później),
 *   hazard = zagrożenie dla zdrowia/mienia (prąd, gaz, konstrukcja).
 * Opcje typu „maskowanie” (mask) zmniejszają widoczność wad z wcześniejszych kroków:
 * wada zasłonięta nie znika, tylko staje się ukryta i wraca jako reklamacja.
 *
 * Wzory:
 *   raw     = Σ sev · (1 + hazard)
 *   indeks  = 100 · (1 − e^(−raw / 14))                       ← stopień fuszerki 0..100
 *   V       = Σ sev · vis                                    ← wady widoczne
 *   H       = Σ sev · (1 − vis)                              ← wady ukryte
 *   Z       = Σ sev · hazard                                 ← zagrożenie
 *   odczucie klienta  P = V · uwaga · surowość (+ ½·H·uwaga·surowość dla fachowca)
 *   zadowolenie       = 100 · e^(−P / 9) − kara za spóźnienie
 *   szansa reklamacji = 1 − e^(−(H + 1,5·Z) / 12)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fuszerka = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LEVELS = [
    { min: 0, key: 'solid', name: 'Solidna robota' },
    { min: 15, key: 'oko', name: 'Na oko' },
    { min: 40, key: 'fuszerka', name: 'Fuszerka' },
    { min: 70, key: 'katastrofa', name: 'Katastrofa budowlana' },
  ];
  const K_INDEX = 14, K_SAT = 9, K_CLAIM = 12;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function levelFor(index) {
    let lv = LEVELS[0];
    for (const l of LEVELS) if (index >= l.min) lv = l;
    return lv;
  }

  /* Zbiera wady z wyborów. Maskowanie działa tylko wstecz (na wady z wcześniejszych kroków). */
  function collectDefects(job, picks) {
    const defects = [];
    picks.forEach((pk, i) => {
      const step = job.steps[i];
      const opt = step.options.find(o => o.id === pk.optionId);
      if (!opt) throw new Error('Nieznana opcja ' + pk.optionId + ' w kroku ' + step.id);
      if (opt.mask) defects.forEach(d => { d.vis *= (1 - opt.mask); d.masked = true; });
      (opt.defects || []).forEach(d => defects.push({
        label: d.label, sev: d.sev, vis: d.vis, hazard: d.hazard || 0, step: step.id, option: opt.id,
      }));
      if (opt.skill) {
        const a = clamp(pk.accuracy == null ? 0.6 : pk.accuracy, 0, 1);
        const sev = (1 - a) * 3.5;
        if (sev >= 0.4) defects.push({
          label: 'niedbałe wykonanie (' + step.name.toLowerCase() + ')', sev, vis: 0.7, hazard: 0, step: step.id, option: opt.id,
        });
      }
    });
    return defects;
  }

  /* adj (opcjonalne): { time: korekta czasu w minutach, defects: dodatkowe wady } np. od pomocnika lub bałaganu. */
  function evaluate(job, picks, client, adj) {
    if (picks.length !== job.steps.length) throw new Error('Brak wyborów dla wszystkich kroków');
    adj = adj || {};
    const defects = collectDefects(job, picks);
    (adj.defects || []).forEach(d => defects.push({ label: d.label, sev: d.sev, vis: d.vis, hazard: d.hazard || 0, step: 'ekipa', option: 'ekipa' }));
    let time = adj.time || 0, cost = 0;
    picks.forEach((pk, i) => {
      const opt = job.steps[i].options.find(o => o.id === pk.optionId);
      time += opt.time || 0; cost += opt.cost || 0;
    });
    let raw = 0, V = 0, H = 0, Z = 0;
    for (const d of defects) {
      raw += d.sev * (1 + d.hazard);
      V += d.sev * d.vis;
      H += d.sev * (1 - d.vis);
      Z += d.sev * d.hazard;
    }
    const index = Math.round(100 * (1 - Math.exp(-raw / K_INDEX)));
    const level = levelFor(index);

    const att = client.attention * client.strict;
    const perceived = V * att + (client.expert ? 0.5 * H * att : 0);
    const late = time > job.deadline;
    const latePenalty = late ? Math.min(20, time - job.deadline) : 0;
    const satisfaction = clamp(Math.round(100 * Math.exp(-perceived / K_SAT) - latePenalty), 0, 100);
    const stars = clamp(Math.ceil(satisfaction / 20), 1, 5);

    const fast = time <= job.deadline * 0.6;
    const payout = Math.round(job.base * (0.4 + 0.6 * satisfaction / 100) * (fast ? 1.1 : 1));
    const profit = payout - cost;

    const hiddenLoad = H + 1.5 * Z;
    const chance = 1 - Math.exp(-hiddenLoad / K_CLAIM);
    const kind = Z >= 9 ? 'wypadek' : 'reklamacja';
    const amount = Math.round(Math.min(payout * 3, payout * (0.6 + H / 20 + Z / 10)) * (kind === 'wypadek' ? 1.5 : 1));
    const riskDelta = kind === 'wypadek' ? 30 : Math.round(5 + H * 1.5);
    // wada, która najpewniej wróci: najwyższa ukryta powaga z doliczonym zagrożeniem
    let top = null, topScore = -1;
    for (const d of defects) {
      const s = d.sev * (1 - d.vis) * (1 + d.hazard);
      if (s > topScore) { topScore = s; top = d; }
    }
    // widoczna wada, która najbardziej zirytowała klienta
    let topVisible = null, tv = 0;
    for (const d of defects) if (d.sev * d.vis > tv) { tv = d.sev * d.vis; topVisible = d; }

    return {
      defects, index, level, V, H, Z, perceived, late, time, cost,
      satisfaction, stars, payout, profit,
      claim: { chance, kind, amount, riskDelta, top: topScore > 0 ? top : null },
      topVisible,
    };
  }

  /* Losuje, czy reklamacja faktycznie wróci. rng: () => [0,1). */
  function rollClaim(result, rng) {
    const c = result.claim;
    if (!c.top) return null;
    return rng() < c.chance ? { kind: c.kind, amount: c.amount, riskDelta: c.riskDelta, defect: c.top.label } : null;
  }

  /* Komentarz klienta. client.lines: { 5:[..],4:[..],3:[..],2:[..],1:[..] } */
  function clientComment(client, result, rng) {
    const pool = client.lines[result.stars] || client.lines[3];
    let line = pool[Math.floor(rng() * pool.length)];
    if (result.stars <= 3 && result.topVisible && result.topVisible.sev * result.topVisible.vis >= 1.5)
      line += ' Zwłaszcza: ' + result.topVisible.label + '.';
    return line;
  }

  return { evaluate, rollClaim, clientComment, collectDefects, levelFor, LEVELS, K_INDEX, K_SAT, K_CLAIM };
});
