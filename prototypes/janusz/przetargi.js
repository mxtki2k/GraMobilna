/* Przetargi publiczne (faza C): duże kontrakty z audytem jakości. Wymagania: ocena firmy, poziom siedziby, poziomy specjalizacji.
 * Gracz składa ofertę (cena −15%, standard, +15%), konkuruje z rywalem. Wygrana = kontrakt z wadium, wyższymi stawkami i surowym audytem
 * (ukryte wady zagrażające bezpieczeństwu oblewają audyt: kara 35% wartości i utrata wadium). Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./kontrakty.js') : root.Kontrakty);
  else root.Przetargi = factory(root.Kontrakty);
})(typeof self !== 'undefined' ? self : this, function (Kontrakty) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const WADIUM = 0.10, COOLDOWN_DAYS = 7, PREMIUM = 1.0;
  const BIDS = { low: { name: 'Oferta niska (−15%)', mult: 0.85 }, std: { name: 'Oferta rynkowa', mult: 1.0 }, high: { name: 'Oferta wysoka (+15%)', mult: 1.15 } };
  /* req: stars (ocena firmy), tier (poziom siedziby), spec: { obszar: poziom }. */
  const TENDERS = {
    blok: { id: 'blok', title: 'Przetarg: klatka bloku', client: 'sebix', deadline: 7, desc: 'Spółdzielnia szuka wykonawcy: ściany, drzwi i gniazdka na klatce.', req: { stars: 2.5, tier: 1, spec: { wykonczenia: 1 } }, stages: [
      { job: 'sciana', mult: 2.0, day: 0, time: '08:00', due: 'normalny' }, { job: 'drzwi', mult: 2.0, day: 1, time: '08:00' }, { job: 'gniazdko', mult: 2.1, day: 3, time: '08:00' }, { job: 'malowanie', mult: 2.1, day: 5, time: '08:00', due: 'normalny' } ] },
    przychodnia: { id: 'przychodnia', title: 'Przetarg: remont przychodni', client: 'karyna', deadline: 8, desc: 'Gabinety, poczekalnia i łazienka. Wymagana dokumentacja i próby szczelności.', req: { stars: 2.8, tier: 1, spec: { hydraulika: 1 } }, stages: [
      { job: 'kran', mult: 2.2, day: 0, time: '08:00' }, { job: 'syfon', mult: 2.2, day: 1, time: '08:00' }, { job: 'plytki', mult: 2.4, day: 2, time: '08:00', due: 'luzny' }, { job: 'grzejnik', mult: 2.3, day: 5, time: '08:00' }, { job: 'malowanie', mult: 2.4, day: 6, time: '08:00' } ] },
    szkola: { id: 'szkola', title: 'Przetarg: remont szkoły', client: 'tesciowa', deadline: 9, desc: 'Sale lekcyjne w wakacje. Kontrola kuratorium i ostre terminy.', req: { stars: 3.1, tier: 2, spec: { wykonczenia: 2 } }, stages: [
      { job: 'sciana', mult: 2.6, day: 0, time: '08:00', due: 'normalny' }, { job: 'okno', mult: 2.6, day: 1, time: '08:00' }, { job: 'drzwi', mult: 2.6, day: 3, time: '08:00' }, { job: 'gniazdko', mult: 2.7, day: 4, time: '08:00', due: 'normalny' }, { job: 'malowanie', mult: 2.6, day: 6, time: '08:00', due: 'ostry' } ] },
    urzad: { id: 'urzad', title: 'Przetarg: urząd gminy', client: 'grazyna', deadline: 9, desc: 'Biura, okna, instalacje. Wymagane uprawnienia elektryczne.', req: { stars: 3.3, tier: 2, spec: { stolarka: 2, elektryka: 1 } }, stages: [
      { job: 'okno', mult: 2.7, day: 0, time: '08:00' }, { job: 'drzwi', mult: 2.7, day: 1, time: '08:00' }, { job: 'gniazdko', mult: 2.9, day: 3, time: '08:00' }, { job: 'polka', mult: 2.6, day: 4, time: '08:00' }, { job: 'grzejnik', mult: 2.7, day: 5, time: '08:00', due: 'normalny' }, { job: 'malowanie', mult: 2.8, day: 7, time: '08:00' } ] },
    hotel: { id: 'hotel', title: 'Przetarg: pensjonat', client: 'heniek', deadline: 11, desc: 'Sezonowy pensjonat otwiera się za dwa tygodnie. Inspektor widzi wszystko.', req: { stars: 3.6, tier: 3, spec: { hydraulika: 2, wykonczenia: 2, stolarka: 2 } }, stages: [
      { job: 'plytki', mult: 3.1, day: 0, time: '08:00' }, { job: 'kran', mult: 2.9, day: 2, time: '08:00' }, { job: 'syfon', mult: 2.9, day: 3, time: '08:00' }, { job: 'okno', mult: 3.0, day: 4, time: '08:00' }, { job: 'drzwi', mult: 3.0, day: 6, time: '08:00' }, { job: 'sciana', mult: 3.1, day: 7, time: '08:00' }, { job: 'malowanie', mult: 3.1, day: 9, time: '08:00', due: 'normalny' } ] },
    szpital: { id: 'szpital', title: 'Przetarg: oddział szpitalny', client: 'heniek', deadline: 12, desc: 'Najwyższe wymagania: elektryka, hydraulika i wykończenia na poziomie eksperta.', req: { stars: 4.0, tier: 4, spec: { elektryka: 3, hydraulika: 3, wykonczenia: 2 } }, stages: [
      { job: 'gniazdko', mult: 3.4, day: 0, time: '08:00', due: 'normalny' }, { job: 'kran', mult: 3.2, day: 1, time: '08:00' }, { job: 'syfon', mult: 3.2, day: 3, time: '08:00' }, { job: 'plytki', mult: 3.4, day: 4, time: '08:00' }, { job: 'grzejnik', mult: 3.2, day: 6, time: '08:00' }, { job: 'sciana', mult: 3.3, day: 7, time: '08:00' }, { job: 'malowanie', mult: 3.4, day: 9, time: '08:00', due: 'normalny' } ] },
  };
  // rejestracja w kontraktach, żeby korzystać z tej samej obsługi etapów (nie pokazują się na liście zwykłych kontraktów)
  for (const t of Object.values(TENDERS)) Kontrakty.CONTRACTS['p_' + t.id] = Object.assign({ tender: true, audit: true, premium: PREMIUM, minDone: 0 }, t, { id: 'p_' + t.id });
  const cid = id => 'p_' + id;

  /* Czy gracz spełnia wymagania? ctx: { stars, tier, spec: { obszar: poziom } }. Zwraca listę braków. */
  function missing(t, ctx) {
    const out = [], r = t.req;
    if (ctx.stars < r.stars) out.push('ocena firmy ' + r.stars.toFixed(1).replace('.', ',') + ' ★ (masz ' + ctx.stars.toFixed(1).replace('.', ',') + ')');
    if (ctx.tier < r.tier) out.push('siedziba poziomu ' + r.tier);
    for (const [a, lv] of Object.entries(r.spec || {})) if ((ctx.spec[a] || 0) < lv) out.push(a + ' poziom ' + lv);
    return out;
  }
  /* Szansa wygrania przetargu dla oferty b: ocena, zaufanie klienta, siła rywala i cena. */
  function winChance(bid, ctx) {
    const b = BIDS[bid]; if (!b) throw new Error('Nieznana oferta ' + bid);
    return Math.round(clamp(0.5 + (ctx.stars - 3) * 0.08 + (ctx.trust || 0) * 0.002 + (1 - b.mult) * 1.6 - ((ctx.rivalPower || 25) - 30) / 200, 0.05, 0.9) * 1000) / 1000;
  }
  /* Rozstrzygnięcie. Zwraca { won, chance }. */
  function bid(bidKey, ctx, rng) { const chance = winChance(bidKey, ctx); return { won: rng() < chance, chance }; }
  /* Wadium i mnożnik ceny po wygranej. */
  const terms = (t, bidKey, jobs) => { const q = Kontrakty.quote(Kontrakty.CONTRACTS[cid(t.id)], jobs); return { wadium: Math.round(q.nominal * WADIUM * BIDS[bidKey].mult), priceMult: BIDS[bidKey].mult, quote: q }; };
  const cooldownOk = (cool, id, day) => !cool[id] || day - cool[id] >= COOLDOWN_DAYS;
  return { WADIUM, COOLDOWN_DAYS, PREMIUM, BIDS, TENDERS, cid, missing, winChance, bid, terms, cooldownOk };
});
