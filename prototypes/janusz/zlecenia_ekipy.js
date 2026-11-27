/* Zlecenia dla ekipy (faza B): tablica prostych zleceń, praca pracownika bez gracza, dojazdy między dzielnicami.
 * Jakość zależy od umiejętności, pracowitości, nastroju, trzeźwości i trudności roboty. Czysta logika (zależności wstrzykiwane). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./specjalizacje.js'));
  else root.ZlecEkipy = factory(root.Spec);
})(typeof self !== 'undefined' ? self : this, function (Spec) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DISTRICTS = { baza: 'siedziba', osiedle: 'osiedle', centrum: 'centrum', wies: 'wieś' };
  const TRAVEL = { baza: { baza: 0, osiedle: 8, centrum: 18, wies: 35 }, osiedle: { osiedle: 5, centrum: 12, wies: 30, baza: 8 }, centrum: { centrum: 5, osiedle: 12, wies: 25, baza: 18 }, wies: { wies: 5, osiedle: 30, centrum: 25, baza: 35 } };
  const CLIENT_DISTRICT = { mirek: 'osiedle', grazyna: 'osiedle', karyna: 'centrum', sebix: 'centrum', tesciowa: 'wies', heniek: 'wies' };
  const DIFFICULTY = { kran: 0.2, polka: 0.2, syfon: 0.25, drzwi: 0.35, grzejnik: 0.4, okno: 0.4, malowanie: 0.45, sciana: 0.5, plytki: 0.7, gniazdko: 0.9 };
  const ALC = { trzezwy: 0, kac: 0.35, 'po-piwie': 0.6, pijany: 1 };
  const SPEED = w => 1.3 - 0.35 * w.skill; // ekipa pracuje wolniej niż właściciel
  const FUEL_PER_MIN = 0.6;
  /* Pracownik nie dostanie roboty trudniejszej niż jego umiejętności + 0,3 (gniazdko dopiero od 0,6, płytki od 0,4). */
  /* Poziom specjalizacji pracownika w obszarze roboty (doświadczenie w w.xp, kursy firmy w certs). */
  const lvl = (w, jobId, certs) => { const a = Spec.areaOf(jobId); return a ? Spec.level(((w.xp || {})[a]) || 0, a, certs || {}) : 0; };
  const canDo = (w, jobId, certs) => difficulty(jobId) <= Math.round((w.skill + 0.3 + 0.05 * lvl(w, jobId, certs)) * 100) / 100;
  /* Rozmiar tablicy rośnie z poziomem siedziby: 4 oferty dziennie + 1 na poziom (max 9). */
  const boardSize = tier => Math.min(9, 4 + Math.max(0, tier || 0));
  /* Doświadczenie pracownika po zleceniu (gwiazdki, pomocnik dostaje połowę). */
  function addXp(w, jobId, stars, half) { const a = Spec.areaOf(jobId); if (!a) return w; const xp = Object.assign({}, w.xp || {}); xp[a] = Math.round(((xp[a] || 0) + Spec.gain(stars, false) * (half ? 0.5 : 1)) * 10) / 10; return Object.assign({}, w, { xp }); }
  const travel = (a, b) => (TRAVEL[a] || TRAVEL.baza)[b] != null ? (TRAVEL[a] || TRAVEL.baza)[b] : 15;
  const districtOf = id => CLIENT_DISTRICT[id] || 'osiedle';
  const difficulty = id => DIFFICULTY[id] != null ? DIFFICULTY[id] : 0.45;

  /* Tablica na dany dzień: n ofert dziennych (start 8–15), mnożnik zależy od oceny firmy. */
  function makeBoard(day, rng, stars, jobIds, clientIds, n) {
    const out = [];
    for (let i = 0; i < (n || 4); i++) {
      const job = jobIds[Math.floor(rng() * jobIds.length)], client = clientIds[Math.floor(rng() * clientIds.length)];
      out.push({ id: day * 10 + i, job, client, district: districtOf(client), mult: Math.round((0.8 + rng() * 0.4) * (0.85 + (stars || 2.5) * 0.06) * 10) / 10, day });
    }
    return out;
  }
  /* Prawdopodobieństwo wyboru „dobrze”. */
  function quality(w, state, offer, certs) {
    const dil = w.diligence == null ? 0.5 : w.diligence, alc = ALC[state || 'trzezwy'] || 0;
    return clamp(0.15 + 0.65 * w.skill + 0.25 * (dil - 0.5) + 0.1 * (w.mood - 60) / 40 - 0.55 * difficulty(offer.job) - 0.45 * alc + 0.03 * lvl(w, offer.job, certs), 0.03, 0.95);
  }
  const accuracy = (w, state, offer, certs) => clamp(0.35 + 0.5 * w.skill + 0.1 * w.mood / 100 - 0.3 * difficulty(offer.job) - 0.3 * (ALC[state || 'trzezwy'] || 0) + 0.02 * lvl(w, offer.job, certs), 0.1, 0.95);
  /* Wykonanie zlecenia przez pracownika. deps: { evaluate, rollClaim, minutes(units), jobs, clients }; ctx: { payMult, from (dzielnica), clock }. */
  function simulate(w, state, offer, rng, deps, ctx) {
    const job = deps.jobs[offer.job], client = deps.clients[offer.client], q = quality(w, state, offer, ctx.certs), acc = accuracy(w, state, offer, ctx.certs);
    const picks = job.steps.map(s => { const x = rng(); return { stepId: s.id, optionId: x < q ? 'dobrze' : x < q + (1 - q) * 0.6 ? 'skrot' : 'fusz', accuracy: clamp(acc + (rng() - 0.5) * 0.2, 0, 1) }; });
    const j = Object.assign({}, job, { base: Math.round(job.base * offer.mult) });
    const res = deps.evaluate(j, picks, client, { payMult: ctx.payMult || 1, time: 0, satBonus: ctx.satBonus || 0 });
    const work = Math.round(deps.minutes(Math.max(1, res.time)) * SPEED(w)), trav = travel(ctx.from || 'baza', offer.district) + 0;
    const claim = deps.rollClaim(res, rng);
    return { r: res, q, minutes: work + trav, travelMin: trav, fuel: Math.round(trav * FUEL_PER_MIN), payout: res.payout, cost: res.cost, claim: claim ? claim.amount : 0, claimInfo: claim, endAt: ctx.clock + work + trav };
  }
  /* Podgląd dla gracza przed zleceniem: szacunek jakości i czasu. */
  function preview(w, state, offer, ctx) {
    const q = quality(w, state, offer, ctx.certs);
    return { q, label: q >= 0.7 ? 'solidnie' : q >= 0.45 ? 'różnie' : q >= 0.25 ? 'słabo' : 'fuszerka', travelMin: travel(ctx.from || 'baza', offer.district) };
  }
  /* Plan dnia: bloki (row, start, end w minutach zegara gry, label, kind) przycięte do doby zaczynającej się o dayStart, z procentami osi. */
  function buildPlan(dayStart, items) {
    const day = 1440, out = [];
    for (const it of items) { const a = Math.max(it.start, dayStart), b = Math.min(it.end, dayStart + day); if (b <= a) continue; out.push(Object.assign({}, it, { from: a - dayStart, to: b - dayStart, left: Math.round((a - dayStart) / day * 1000) / 10, width: Math.max(0.8, Math.round((b - a) / day * 1000) / 10) })); }
    return out;
  }
  return { buildPlan, lvl, boardSize, addXp, canDo, DISTRICTS, DIFFICULTY, travel, districtOf, difficulty, makeBoard, quality, accuracy, simulate, preview, SPEED, FUEL_PER_MIN };
});
