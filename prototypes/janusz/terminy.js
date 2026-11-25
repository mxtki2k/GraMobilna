/* Zlecenia terminowe: klient wyznacza godzinę, do której robota ma być skończona. Spóźnienie kosztuje (kara co 15 minut),
 * szybkie skończenie daje premię. Czysta logika, czas w minutach gry (1 jednostka naprawy = 5 min, noc o 10% dłużej). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Terminy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const KINDS = {
    luzny: { name: 'Bez pośpiechu', factor: 1.25, pct: 0.04, pay: 0.95 },
    normalny: { name: 'Na umówioną godzinę', factor: 1.0, pct: 0.05, pay: 1.0 },
    ostry: { name: 'Na wczoraj, termin nieprzekraczalny', factor: 0.75, pct: 0.08, pay: 1.2 },
  };
  const CAP = 0.6, BONUS = 0.1, BLOCK = 15, EARLY = 0.8, TIME_SCALE = 5;
  /* Umowa terminowa: ile minut ma gracz i do której godziny (zegar gry). */
  function make(deadlineUnits, startClock, kind, night) {
    const k = KINDS[kind]; if (!k) throw new Error('Nieznany termin ' + kind);
    const allowed = Math.round(deadlineUnits * TIME_SCALE * k.factor * (night ? 1.1 : 1));
    return { kind, name: k.name, allowed, dueAt: startClock + allowed, pct: k.pct, pay: k.pay };
  }
  /* Rozliczenie po robocie: użyte minuty vs dozwolone. */
  function evaluate(due, minutesUsed, payout) {
    if (!due) return { onTime: true, lateMin: 0, penalty: 0, bonus: 0 };
    const lateMin = Math.max(0, minutesUsed - due.allowed), blocks = Math.ceil(lateMin / BLOCK);
    const penalty = lateMin ? Math.round(payout * Math.min(CAP, blocks * due.pct)) : 0;
    const bonus = !lateMin && minutesUsed <= due.allowed * EARLY ? Math.round(payout * BONUS) : 0;
    return { onTime: !lateMin, lateMin, penalty, bonus };
  }
  /* Losowy rodzaj terminu dla zlecenia z telefonu: częściej „na umówioną godzinę”, w nocy częściej ostry. */
  function roll(rng, night) {
    const x = rng();
    if (x < (night ? 0.35 : 0.5)) return null; // zwykłe zlecenie bez terminu
    const y = rng(); return y < 0.25 ? 'luzny' : y < (night ? 0.55 : 0.75) ? 'normalny' : 'ostry';
  }
  return { KINDS, CAP, BONUS, BLOCK, make, evaluate, roll };
});
