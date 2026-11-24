/* Moduł ekipy: płace, nastroje, zaległości, upominanie się, absencja i „wystawianie na robotę”.
 * Czysta logika (bez DOM), działa w przeglądarce i w node. Losowość wchodzi przez rng(): () => [0,1).
 *
 * Pracownik: { skill 0-1, reliab 0-1 (solidność), greed 0.6-1.4 (pazerność), wage (oczekiwana pensja za „tydzień”),
 *              patience (bazowy nastrój), mood 0-100, owed (zaległości) }.
 *
 * Wypłata (applyPay): wpłata najpierw pokrywa bieżącą pensję, potem zaległości, reszta to premia.
 *   brak części pensji     → nastrój −38 · braku · (0,6 + 0,8·pazerność)
 *   zaległości             → nastrój −min(20, 12 · zaległości / pensja)
 *   premia                 → nastrój +min(16, 24 · premia / pensja)
 *   równo wg umowy         → nastrój +4
 *   zazdrość               → −8 za każdego słabszego kolegi, który dostał więcej (max −16)
 *   dryf                   → 10% w stronę cierpliwości
 *   odejście               → po 2 wypłatach z rzędu z nastrojem < 15 i zaległościami ≥ pensja
 * Frekwencja (attendance): P(nie przyjdzie)  = (1 − solidność)·0,45 + max(0, 50 − nastrój)/100·0,7
 *                          P(wystawi na robotę w trakcie) = (35 − nastrój)/35 · 0,6 (+0,1 przy dużych zaległościach)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ekipa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PAYDAY_EVERY = 3; // co tyle zleceń jest dzień wypłaty

  const CANDIDATES = [
    { id: 'kacper', name: 'Kacper', role: 'praktykant', em: '🧑‍🎓', skill: 0.25, reliab: 0.6, greed: 0.6, wage: 60, patience: 55,
      quirk: 'Szybko się uczy, mało umie. Wystarczy mu „doświadczenie”.' },
    { id: 'zbyszek', name: 'Szwagier Zbyszek', role: 'rodzina', em: '🧔', skill: 0.45, reliab: 0.45, greed: 0.8, wage: 90, patience: 65,
      quirk: 'Rodzina, więc nie wypada nie zapłacić. Lubi zaliczki, nie lubi poniedziałków.' },
    { id: 'zdzisiek', name: 'Zdzisiek', role: 'złota rączka', em: '🛠️', skill: 0.6, reliab: 0.5, greed: 1.0, wage: 110, patience: 50,
      quirk: 'Zdolny, ale co środę „coś mu wypadło”.' },
    { id: 'staszek', name: 'Mistrz Staszek', role: 'fachowiec', em: '👷', skill: 0.9, reliab: 0.9, greed: 1.3, wage: 200, patience: 40,
      quirk: 'Najlepszy w branży. Nie znosi, kiedy ktoś gorszy dostaje więcej.' },
  ];

  function newWorker(c) {
    return { id: c.id, name: c.name, role: c.role, em: c.em, skill: c.skill, reliab: c.reliab, greed: c.greed,
      wage: c.wage, patience: c.patience, quirk: c.quirk, mood: 70, owed: 0, strikes: 0 };
  }

  function moodLabel(m) {
    return m >= 80 ? 'zadowolony' : m >= 60 ? 'w porządku' : m >= 40 ? 'markotny' : m >= 20 ? 'wkurzony' : 'na skraju';
  }
  function moodEmoji(m) { return m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 20 ? '😠' : '🤬'; }

  /* pay: { id: kwota }. Zwraca nową ekipę (kopie) i szczegóły rozliczenia. */
  function applyPay(workers, pay) {
    const rows = workers.map(w => {
      const paid = Math.max(0, pay[w.id] || 0);
      const toWage = Math.min(paid, w.wage);
      const toOwed = Math.min(paid - toWage, w.owed);
      const bonus = Math.max(0, paid - w.wage - w.owed);
      const shortfall = w.wage - toWage;
      const owed = w.owed + shortfall - toOwed;
      return { w, paid, toWage, toOwed, bonus, shortfall, owed };
    });
    const out = rows.map(r => {
      const w = r.w;
      const parts = { short: 0, owed: 0, bonus: 0, exact: 0, envy: 0, drift: 0 };
      parts.short = -38 * (r.shortfall / w.wage) * (0.6 + 0.8 * w.greed);
      parts.owed = -Math.min(20, 12 * r.owed / w.wage);
      parts.bonus = Math.min(16, 24 * r.bonus / w.wage);
      if (r.shortfall === 0 && r.owed === 0 && r.bonus === 0) parts.exact = 4;
      // zazdrość: słabszy kolega dostał więcej w złotówkach
      let envyHits = 0;
      for (const o of rows) if (o.w.id !== w.id && o.w.skill < w.skill && o.paid > r.paid) envyHits++;
      parts.envy = -Math.min(16, 8 * envyHits);
      const after = w.mood + parts.short + parts.owed + parts.bonus + parts.exact + parts.envy;
      parts.drift = (w.patience - after) * 0.1;
      const mood = clamp(Math.round(after + parts.drift), 0, 100);
      const owedNow = Math.round(r.owed);
      const strikes = (mood < 15 && owedNow >= w.wage) ? (w.strikes || 0) + 1 : 0;
      return { worker: Object.assign({}, w, { mood, owed: owedNow, strikes }), row: r, parts, delta: mood - w.mood };
    });
    return {
      workers: out.map(o => o.worker),
      spent: rows.reduce((s, r) => s + r.paid, 0),
      details: out.map(o => ({ id: o.worker.id, name: o.worker.name, paid: o.row.paid, bonus: o.row.bonus,
        shortfall: o.row.shortfall, owed: o.worker.owed, delta: o.delta, mood: o.worker.mood, parts: o.parts })),
    };
  }

  /* Prawdopodobieństwa: nie przyjdzie / wystawi na robotę w trakcie. */
  function risk(w) {
    const absent = clamp((1 - w.reliab) * 0.45 + Math.max(0, 50 - w.mood) / 100 * 0.7, 0, 0.85);
    let walkout = w.mood < 35 ? (35 - w.mood) / 35 * 0.6 : 0;
    if (w.owed > w.wage * 2) walkout += 0.1;
    return { absent, walkout: clamp(walkout, 0, 0.9) };
  }
  /* 'absent' | 'present'; wystawienie w trakcie losuje osobno walkoutRoll. */
  function attendance(w, rng) { return rng() < risk(w).absent ? 'absent' : 'present'; }
  function walksOut(w, rng) { return rng() < risk(w).walkout; }

  /* Wpływ pomocnika na robotę: bonus celności w krokach „na wyczucie” i mnożnik czasu. */
  function helperEffect(w) {
    const moodK = w.mood >= 60 ? 1 : 0.5 + w.mood / 120;
    return { accBonus: (w.skill - 0.4) * 0.5 * moodK, timeFactor: 1 - 0.12 * w.skill * (w.mood >= 80 ? 1.25 : 1) };
  }

  /* Upominanie się o pieniądze. Zwraca null albo { kind, amount, text }. */
  function demand(w) {
    if (w.mood >= 45 && !(w.owed > w.wage && w.mood < 60)) return null;
    if (w.owed > 0) return { kind: 'zaleglosc', amount: Math.round(Math.min(w.owed, w.wage)),
      text: w.name + ': „Szefie, kiedy wypłata? Zaległości się nazbierały.”' };
    return { kind: 'podwyzka', amount: Math.round(w.wage * 0.3),
      text: w.name + ': „Szefie, ceny rosną, a pensja stoi. Dorzućcie coś.”' };
  }
  /* Reakcja na odpowiedź szefa. */
  function answerDemand(w, accepted, amount) {
    const k = clamp(w.greed, 0.6, 1.4);
    if (accepted) return Object.assign({}, w, { mood: clamp(w.mood + 12, 0, 100), owed: Math.max(0, w.owed - amount) });
    return Object.assign({}, w, { mood: clamp(w.mood - Math.round(12 * k), 0, 100) });
  }

  /* Odejście: po dwóch wypłatach z rzędu ze skrajnym nastrojem i zaległościami (strikes). */
  function quits(w) { return (w.strikes || 0) >= 2; }

  /* Fuchy na boku: dochód ekipy między zleceniami zależny od umiejętności, nastroju i obecności. */
  function sideGigs(workers, rng) {
    let sum = 0; const parts = [];
    for (const w of workers) {
      const present = attendance(w, rng) === 'present';
      const gain = present ? Math.round((80 + w.skill * 160) * (w.mood / 100)) : 0;
      sum += gain; parts.push({ id: w.id, name: w.name, gain, present });
    }
    return { total: sum, parts };
  }

  /* Podpowiedź domyślnej wypłaty: pensja + zaległości, ograniczona budżetem (od najlepszych pracowników). */
  function defaultPay(workers, budget) {
    const pay = {}; let left = budget;
    for (const w of workers.slice().sort((a, b) => b.skill - a.skill)) {
      const p = Math.min(left, w.wage + w.owed); pay[w.id] = p; left -= p;
    }
    return pay;
  }

  return { PAYDAY_EVERY, CANDIDATES, newWorker, moodLabel, moodEmoji, applyPay, risk, attendance, walksOut,
    helperEffect, demand, answerDemand, quits, sideGigs, defaultPay };
});
