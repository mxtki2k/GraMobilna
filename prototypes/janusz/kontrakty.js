/* Kontrakty: kilka robót u jednego klienta w kolejnych dniach. Zaliczka z góry, transze za etapy (premia kontraktowa), odbiór końcowy
 * z wyłapywaniem ukrytych wad z całego kontraktu, kara za opóźnienie całości i za rezygnację. Czysta logika, bez UI. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kontrakty = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PREMIUM = 1.0, DEPOSIT = 0.25, TRANCHE = Math.round(PREMIUM * (1 - DEPOSIT) * 10000) / 10000, EXPECT = 0.85;
  const LATE_PCT = 0.03, LATE_CAP = 0.4, BONUS = 0.10, CANCEL_PCT = 0.10, REWORK_PER_SEV = 25, HIDDEN_VIS = 0.5, HIDDEN_SEV = 2;
  /* day: dzień względem przyjęcia kontraktu (0 = dziś, jeśli zdążysz, w przeciwnym razie jutro), time: godzina startu etapu. */
  const CONTRACTS = {
    lazienka: { id: 'lazienka', title: 'Remont łazienki', client: 'karyna', minDone: 0, deadline: 6, desc: 'Kran, płytki, drzwi i farba. Karyna będzie relacjonować każdy dzień.', stages: [
      { job: 'kran', mult: 1.2, day: 0, time: '10:00' }, { job: 'plytki', mult: 1.3, day: 1, time: '08:30', due: 'luzny' }, { job: 'drzwi', mult: 1.2, day: 3, time: '09:00' }, { job: 'malowanie', mult: 1.3, day: 4, time: '09:00' } ] },
    kuchnia: { id: 'kuchnia', title: 'Odświeżenie kuchni', client: 'mirek', minDone: 4, deadline: 5, desc: 'Zlew, gniazdko i malowanie. Pan Mirek chce, żeby działało. Reszta go nie obchodzi.', stages: [
      { job: 'syfon', mult: 1.3, day: 0, time: '09:00' }, { job: 'gniazdko', mult: 1.4, day: 1, time: '09:00' }, { job: 'malowanie', mult: 1.4, day: 3, time: '09:00' } ] },
    zima: { id: 'zima', title: 'Przygotowanie do zimy', client: 'grazyna', minDone: 8, deadline: 6, desc: 'Grzejnik, okno, drzwi, uszczelki. Pani Grażyna widzi wszystko.', stages: [
      { job: 'grzejnik', mult: 1.5, day: 0, time: '09:30', due: 'normalny' }, { job: 'okno', mult: 1.5, day: 1, time: '09:30', due: 'normalny' }, { job: 'drzwi', mult: 1.5, day: 3, time: '10:00' }, { job: 'syfon', mult: 1.4, day: 4, time: '10:00' } ] },
    biuro: { id: 'biuro', title: 'Biuro Sebixa', client: 'sebix', minDone: 14, deadline: 5, desc: 'Półki, gniazdka i malowanie. Sebix chce tanio, szybko i „żeby wyglądało”.', stages: [
      { job: 'polka', mult: 1.7, day: 0, time: '08:30', due: 'normalny' }, { job: 'gniazdko', mult: 1.8, day: 1, time: '08:30' }, { job: 'sciana', mult: 1.8, day: 2, time: '09:00', due: 'normalny' }, { job: 'malowanie', mult: 1.8, day: 3, time: '09:00' } ] },
    mieszkanie: { id: 'mieszkanie', title: 'Remont po dziadku', client: 'heniek', minDone: 22, deadline: 8, desc: 'Pan Heniek widzi też to, co ukryte. Pięć etapów, żadnego skrótu.', stages: [
      { job: 'sciana', mult: 2.0, day: 0, time: '09:00' }, { job: 'gniazdko', mult: 2.1, day: 1, time: '09:00', due: 'normalny' }, { job: 'plytki', mult: 2.2, day: 2, time: '08:00', due: 'luzny' }, { job: 'drzwi', mult: 2.0, day: 5, time: '09:00' }, { job: 'malowanie', mult: 2.2, day: 6, time: '09:00' } ] },
    tesciowa: { id: 'tesciowa', title: 'Generalny u teściowej', client: 'tesciowa', minDone: 32, deadline: 10, desc: 'Sześć etapów, termin „na wczoraj” i nic nie jest wystarczająco dobre.', stages: [
      { job: 'kran', mult: 2.2, day: 0, time: '09:00' }, { job: 'sciana', mult: 2.4, day: 1, time: '09:00' }, { job: 'okno', mult: 2.3, day: 3, time: '09:00', due: 'ostry' }, { job: 'plytki', mult: 2.4, day: 4, time: '08:00' }, { job: 'drzwi', mult: 2.3, day: 6, time: '09:00' }, { job: 'malowanie', mult: 2.4, day: 8, time: '09:00', due: 'normalny' } ] },
  };
  const premiumOf = c => c.premium || PREMIUM, trancheOf = c => Math.round(premiumOf(c) * (1 - DEPOSIT) * 10000) / 10000, AUDIT_BONUS = 0.15, AUDIT_FAIL = 0.35;
  const fresh = () => ({ active: null, done: {} });
  const hm = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  /* Wycena: nominalna suma, zaliczka (część oczekiwanej wypłaty), mnożnik transzy za etap. jobs: JOBS z jobs.js (stawki już przeskalowane). */
  function quote(c, jobs) {
    const nominal = c.stages.reduce((s, st) => s + jobs[st.job].base * st.mult, 0);
    const pm = premiumOf(c);
    return { nominal: Math.round(nominal), deposit: Math.round(nominal * EXPECT * pm * DEPOSIT), tranche: trancheOf(c), expected: Math.round(nominal * EXPECT * pm), deadlineDays: c.deadline, stages: c.stages.length };
  }
  const available = (done, stars) => Object.values(CONTRACTS).filter(c => !c.tender && (done || 0) >= c.minDone);

  /* Przyjęcie: zapisuje stan aktywnego kontraktu. startClock = chwila przyjęcia. */
  function accept(state, id, clock, jobs, opts) {
    opts = opts || {};
    const c = CONTRACTS[id]; if (!c) return { ok: false, reason: 'Nie ma takiego kontraktu.' };
    if (state.active) return { ok: false, reason: 'Masz już aktywny kontrakt.' };
    if (state.done[id] && state.done[id].open) return { ok: false, reason: 'Ten kontrakt już trwa.' };
    const q = quote(c, jobs), pmul = opts.priceMult || 1, day0 = Math.floor(clock / 1440) * 1440; q.deposit = Math.round(q.deposit * pmul);
    return { ok: true, deposit: q.deposit, quote: q, state: Object.assign({}, state, { active: { id, stage: 0, acceptedAt: clock, deadlineAt: day0 + c.deadline * 1440 + 1439, deposit: q.deposit, nominal: q.nominal, results: [], terms: null, priceMult: pmul, wadium: opts.wadium || 0 } }) };
  }
  /* Poziom (jak w jobs.js LEVELS) dla bieżącego etapu: godzina startu wynika z kalendarza kontraktu. */
  function stageLevel(state, clock) {
    const a = state.active, c = CONTRACTS[a.id], st = c.stages[a.stage];
    const day0 = Math.floor(a.acceptedAt / 1440) * 1440; let startAt = day0 + st.day * 1440 + hm(st.time); if (startAt < clock + 20) startAt = clock + 20;
    const hour = Math.floor((startAt % 1440) / 60), night = hour >= 22 || hour < 6;
    const lv = { job: st.job, client: c.client, mult: st.mult, slot: night ? 'noc' : 'dzien', time: st.time, startAt, priceMult: Math.round(trancheOf(c) * (a.priceMult || 1) * 10000) / 10000, contract: { id: a.id, stage: a.stage, of: c.stages.length, title: c.title } };
    if (st.due) lv.due = st.due; return lv;
  }
  /* Zapis wyniku etapu (r = wynik Fuszerka.evaluate). Zwraca nowy stan i informację, czy to był ostatni etap. */
  function recordStage(state, r, payout) {
    const a = state.active, c = CONTRACTS[a.id];
    const hidden = (r.defects || []).filter(d => d.vis < HIDDEN_VIS && d.sev >= HIDDEN_SEV).map(d => ({ label: d.label, sev: d.sev, hazard: d.hazard || 0, stage: a.stage }));
    const res = { stage: a.stage, stars: r.stars, index: r.index, payout: Math.round(payout || 0), hidden };
    const next = Object.assign({}, a, { stage: a.stage + 1, results: a.results.concat([res]) });
    return { state: Object.assign({}, state, { active: next }), last: next.stage >= c.stages.length, result: res };
  }
  /* Odbiór końcowy: klient szuka ukrytych wad (szansa zależy od uwagi), liczy opóźnienie, wypłaca premię za czysty odbiór. */
  function final(state, clock, client, rng) {
    const a = state.active, c = CONTRACTS[a.id], all = a.results.flatMap(r => r.hidden);
    const p = clamp(client.attention * client.strict * 0.9 + (client.expert ? 0.3 : 0), 0.1, 0.95);
    const audit = !!c.audit, pf = audit ? 0.95 : p, found = all.filter(() => rng() < pf), notes = [];
    const failed = audit && found.some(d => d.hazard > 0);
    const rework = Math.round(found.reduce((s, d) => s + d.sev * REWORK_PER_SEV, 0));
    const lateDays = Math.max(0, Math.ceil((clock - a.deadlineAt) / 1440)), latePenalty = Math.round(a.nominal * Math.min(LATE_CAP, lateDays * LATE_PCT));
    const avg = a.results.reduce((s, r) => s + r.stars, 0) / Math.max(1, a.results.length);
    const stars = failed ? 1 : clamp(Math.round(avg - 0.5 * found.length), 1, 5);
    const clean = !found.length && !lateDays && avg >= 4, bonus = failed ? 0 : clean ? Math.round(a.nominal * EXPECT * premiumOf(c) * (audit ? AUDIT_BONUS : BONUS)) : 0;
    const auditPenalty = failed ? Math.round(a.nominal * AUDIT_FAIL) : 0, wadiumLost = failed ? (a.wadium || 0) : 0, wadiumBack = failed ? 0 : (a.wadium || 0);
    if (failed) notes.push('AUDYT NIEZALICZONY: wykryto wady zagrażające bezpieczeństwu (' + found.filter(d => d.hazard > 0).map(d => d.label).join(', ') + '). Kara ' + auditPenalty + ' zł, wadium przepada.');
    if (found.length) notes.push('Przy odbiorze wyszły ukryte wady: ' + found.map(d => d.label).join(', ') + '. Poprawki: ' + rework + ' zł.');
    else if (all.length) notes.push('Ukryte wady (' + all.length + ') nie wyszły przy odbiorze. Tym razem.');
    if (lateDays) notes.push('Kontrakt spóźniony o ' + lateDays + ' dni: kara ' + latePenalty + ' zł.');
    if (bonus) notes.push('Odbiór bez poprawek i w terminie: premia ' + bonus + ' zł.');
    const net = bonus - rework - latePenalty - auditPenalty, done = Object.assign({}, state.done, { [a.id]: { stars, count: ((state.done[a.id] || {}).count || 0) + 1, best: Math.max((state.done[a.id] || {}).best || 0, stars) } });
    return { stars, avg: Math.round(avg * 100) / 100, found, hiddenTotal: all.length, rework, lateDays, latePenalty, bonus, auditPenalty, failed, wadiumLost, wadiumBack, net, notes, state: Object.assign({}, state, { active: null, done }) };
  }
  /* Rezygnacja w trakcie: oddajesz zaliczkę (gotówką, jeśli ją masz) i płacisz karę umowną. */
  function cancel(state) {
    const a = state.active, penalty = Math.round(a.deposit + a.nominal * CANCEL_PCT + (a.wadium || 0));
    return { penalty, deposit: a.deposit, state: Object.assign({}, state, { active: null }) };
  }
  return { premiumOf, trancheOf, AUDIT_BONUS, AUDIT_FAIL, PREMIUM, DEPOSIT, TRANCHE, LATE_PCT, LATE_CAP, BONUS, CONTRACTS, fresh, quote, available, accept, stageLevel, recordStage, final, cancel };
});
