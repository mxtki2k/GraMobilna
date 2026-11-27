/* Rok firmy: podsumowanie roku z księgi, ranking osiedla, nagrody, punkty prestiżu i perki Nowej Gry+. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ksiega.js'));
  else root.Rok = factory(root.Ksiega);
})(typeof self !== 'undefined' ? self : this, function (Ksiega) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PERKS = {
    kapital: { name: 'Kapitał startowy', desc: '+1000 zł na starcie każdej nowej gry', max: 3, cost: [5, 10, 15] },
    renoma: { name: 'Renoma', desc: '+2% do wszystkich wypłat (też w tej grze)', max: 5, cost: [8, 10, 12, 14, 16] },
    znajomosci: { name: 'Znajomości', desc: '+10 zaufania u każdego klienta na starcie', max: 3, cost: [6, 9, 12] },
    kursy: { name: 'Szkoła życia', desc: 'Start z kursami: 1 hydraulik, 2 + wykończeniówka, 3 + stolarz', max: 3, cost: [10, 14, 18] },
  };
  const KURSY = ['hydr', 'wyk', 'stol'];
  const freshMeta = () => ({ points: 0, spent: 0, perks: { kapital: 0, renoma: 0, znajomosci: 0, kursy: 0 }, games: 1, years: [] });
  const perkCost = (meta, id) => { const p = PERKS[id], lv = meta.perks[id] || 0; return lv >= p.max ? null : p.cost[lv]; };
  function buy(meta, id) {
    const p = PERKS[id]; if (!p) return { ok: false, reason: 'Nie ma takiego perka.' };
    const c = perkCost(meta, id); if (c === null) return { ok: false, reason: 'Maksymalny poziom.' };
    if (meta.points < c) return { ok: false, reason: 'Brakuje punktów prestiżu (' + c + ').' };
    return { ok: true, cost: c, meta: Object.assign({}, meta, { points: meta.points - c, spent: meta.spent + c, perks: Object.assign({}, meta.perks, { [id]: (meta.perks[id] || 0) + 1 }) }) };
  }
  const bonuses = meta => ({ startCash: 1000 * (meta.perks.kapital || 0), payMult: 1 + 0.02 * (meta.perks.renoma || 0), trust: 10 * (meta.perks.znajomosci || 0), certs: KURSY.slice(0, meta.perks.kursy || 0) });

  /* Podsumowanie roku kalendarzowego z księgi miesięcy (klucze 'RRRR-MM'). */
  function summary(ledger, year) {
    const keys = Ksiega.keys(ledger).filter(k => k.startsWith(year + '-')), months = keys.map(k => Ksiega.summary(ledger, k, 0));
    const sum = f => months.reduce((s, m) => s + f(m), 0), jobs = sum(m => m.jobs), hours = sum(m => m.hours), net = sum(m => m.net);
    const best = months.slice().sort((a, b) => b.plus - a.plus)[0] || null, worst = months.slice().sort((a, b) => a.plus - b.plus)[0] || null;
    return { year, months: months.length, income: Math.round(sum(m => m.income)), costs: Math.round(sum(m => m.costs)), plus: Math.round(sum(m => m.plus)), invest: Math.round(sum(m => m.invest)), jobs, hours: Math.round(hours * 10) / 10, perHour: hours > 0 ? Math.round(net / hours) : 0, best: best && { key: best.key, plus: Math.round(best.plus) }, worst: worst && { key: worst.key, plus: Math.round(worst.plus) } };
  }
  /* Ranking osiedla: gracz kontra cztery firmy. Zyski rywali zależą od ich siły i ziarna roku (deterministyczne). */
  const FIRMS = [{ name: 'Bogdan-Bud', k: 1.0 }, { name: 'Remonty Express', k: 0.8 }, { name: 'Mistrz-Hurt', k: 0.6 }, { name: 'Złote Rączki Sp. z o.o.', k: 0.45 }];
  function ranking(sum, rivalPower, seed) {
    let s = (seed || 1) >>> 0; const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const scale = Math.max(2000, 12000 * (0.6 + rivalPower / 80)), rows = FIRMS.map(f => ({ name: f.name, plus: Math.round(scale * f.k * (0.7 + rng() * 0.6)), you: false }));
    rows.push({ name: 'Ty (Janusz Biznesu)', plus: sum.plus, you: true }); rows.sort((a, b) => b.plus - a.plus);
    return { rows, rank: rows.findIndex(r => r.you) + 1 };
  }
  /* Nagrody roku. stats: { avgStars, claimsOpen, avgIndex, tendersWon, contractsDone }. */
  function awards(sum, stats) {
    const out = [];
    if (stats.avgStars >= 4 && sum.jobs >= 20) out.push({ id: 'fachowiec', name: 'Fachowiec roku', text: 'Średnia ocena co najmniej 4 ★.' });
    if (sum.jobs >= 150) out.push({ id: 'rączka', name: 'Złota Rączka', text: 'Ponad 150 zleceń w roku.' });
    if (stats.avgIndex !== null && stats.avgIndex >= 55 && sum.jobs >= 20) out.push({ id: 'krol', name: 'Król Fuszerki', text: 'Fuszerometr średnio ponad 55%. To nie jest komplement.', joke: true });
    if (stats.claimsOpen === 0 && sum.jobs >= 30) out.push({ id: 'uczciwy', name: 'Uczciwy Rzemieślnik', text: 'Zero otwartych reklamacji.' });
    if (stats.tendersWon >= 1) out.push({ id: 'urzednik', name: 'Ulubieniec urzędów', text: 'Wygrany przetarg publiczny.' });
    if (sum.perHour >= 150) out.push({ id: 'zlotowka', name: 'Złota godzina', text: 'Ponad 150 zł/h po kosztach.' });
    return out;
  }
  /* Punkty prestiżu: zysk, ocena, nagrody (bez żartu), miejsce w rankingu, kontrakty i przetargi. */
  function prestige(sum, stats, aw, rank) {
    const pts = Math.floor(Math.max(0, sum.plus) / 1500) + Math.max(0, Math.round((stats.avgStars - 2) * 3)) + 2 * aw.filter(a => !a.joke).length + clamp(5 - rank, 0, 4) + (stats.contractsDone || 0) + 2 * (stats.tendersWon || 0);
    return Math.max(0, pts);
  }
  return { PERKS, KURSY, freshMeta, perkCost, buy, bonuses, summary, ranking, awards, prestige, FIRMS };
});
