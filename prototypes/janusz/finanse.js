/* Finanse: pożyczki (bank, kuzyn, lichwiarz) i skarbówka (podatek od faktur, ukryte przychody, kontrola).
 *   odsetki naliczane co dzień wypłaty; minimalna rata = 15% zadłużenia; brak raty = zaległość
 *   zaległości lichwiarza (≥2) → windykacja, banku (≥3) → komornik, kuzyna (≥3) → obraza rodziny
 *   szansa kontroli skarbowej = min(0,6; ryzyko/200) · (0,6 z księgową) · (0,5 z przysługą urzędnika)
 *   kara = 60% ukrytych przychodów (·0,7 z księgową, ·0,5 z przysługą) + 150 zł (400 zł przy ryzyku > 50)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Finanse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const LENDERS = {
    bank: { id: 'bank', name: 'Bank „Spokojna Przystań”', rate: 0.03, max: 5000, minRating: 2.5, miss: 3 },
    kuzyn: { id: 'kuzyn', name: 'Kuzyn Heniek', rate: 0.05, max: 1500, minRating: 0, miss: 3 },
    gienek: { id: 'gienek', name: 'Pan Gienek (prywatnie)', rate: 0.18, max: 3000, minRating: 0, miss: 2 },
  };
  const MIN_PAY = 0.15, TAX_RATE = 0.10, ACCOUNTANT_COST = 600, ACCOUNTANT_UPKEEP = 40;

  const fresh = () => ({ loans: [], tax: { risk: 0, unreported: 0, due: 0, accountant: false }, nextId: 1 });
  const clone = f => JSON.parse(JSON.stringify(f));
  const debt = f => f.loans.reduce((s, l) => s + l.principal, 0);

  /* Pożyczka: zwraca { ok, fin, cash } lub { ok:false, reason }. */
  function takeLoan(fin, lenderId, amount, rating) {
    const L = LENDERS[lenderId]; if (!L) return { ok: false, reason: 'Nie ma takiego pożyczkodawcy.' };
    if (rating < L.minRating) return { ok: false, reason: L.name + ' wymaga oceny firmy co najmniej ' + L.minRating + ' ★.' };
    const existing = fin.loans.filter(l => l.lender === lenderId).reduce((s, l) => s + l.principal, 0);
    if (amount <= 0 || existing + amount > L.max) return { ok: false, reason: 'Limit u ' + L.name + ': ' + L.max + ' zł (masz już ' + Math.round(existing) + ' zł).' };
    const f = clone(fin); f.loans.push({ id: f.nextId++, lender: lenderId, principal: amount, rate: L.rate, missed: 0 });
    return { ok: true, fin: f, cash: amount };
  }
  /* Dług bez gotówki (np. spadek po dziadku). */
  function addDebt(fin, lenderId, amount) { const f = clone(fin); f.loans.push({ id: f.nextId++, lender: lenderId, principal: amount, rate: LENDERS[lenderId].rate, missed: 0 }); return f; }
  function minPay(loan) { return Math.ceil(loan.principal * MIN_PAY); }

  /* Dzień wypłaty: odsetki, potem raty od najdroższych. Zwraca { fin, paid, missed[] }. */
  function settle(fin, money) {
    const f = clone(fin); let left = money, paid = 0; const missed = [];
    for (const l of f.loans) l.principal = Math.min(Math.round(l.principal * (1 + l.rate)), LENDERS[l.lender].max * 2); // dług rośnie najwyżej do dwukrotności limitu
    const order = f.loans.slice().sort((a, b) => b.rate - a.rate);
    for (const l of order) {
      const m = Math.min(minPay(l), l.principal);
      if (left >= m) { left -= m; paid += m; l.principal -= m; l.missed = 0; }
      else { l.missed++; missed.push(l.id); }
    }
    f.loans = f.loans.filter(l => l.principal > 0);
    return { fin: f, paid, missed };
  }
  function repay(fin, loanId, amount, money) {
    const f = clone(fin), l = f.loans.find(x => x.id === loanId);
    if (!l) return { ok: false, reason: 'Nie ma takiej pożyczki.' };
    const a = Math.min(amount, money, l.principal); if (a <= 0) return { ok: false, reason: 'Brak środków.' };
    l.principal -= a; if (l.principal <= 0) f.loans = f.loans.filter(x => x.id !== loanId); else l.missed = 0;
    return { ok: true, fin: f, paid: a };
  }
  /* Skutki zaległości. Zwraca null albo { kind, moneyPct, text }. */
  function collection(loan) {
    const L = LENDERS[loan.lender]; if (loan.missed < L.miss) return null;
    if (loan.lender === 'gienek') return { kind: 'windykacja', moneyPct: 0.15, text: '🧔 „Chłopaki do rozmowy” odwiedzili cię w imieniu Pana Gienka. Stracisz 15% kasy, szyld jest pomazany.' };
    if (loan.lender === 'bank') return { kind: 'komornik', moneyPct: 0.3, text: '📄 Komornik zajął część konta: 30% kasy.' };
    return { kind: 'obraza', moneyPct: 0, text: '😤 Kuzyn Heniek się obraził. Na święta nie dostaniesz zaproszenia.' };
  }

  /* Podatki i skarbówka. */
  function addIncome(fin, payout, invoiced) {
    const f = clone(fin);
    if (invoiced) f.tax.due += payout * TAX_RATE;
    else { f.tax.unreported += payout; f.tax.risk = clamp(f.tax.risk + Math.min(12, payout / 40), 0, 100); }
    return f;
  }
  function payTax(fin, money) { const f = clone(fin), pay = Math.min(Math.round(f.tax.due), Math.floor(money)); f.tax.due = Math.max(0, f.tax.due - pay); return { fin: f, paid: pay }; }
  function auditChance(fin, mods) {
    mods = mods || {};
    return clamp(fin.tax.risk / 200, 0, 0.6) * (fin.tax.accountant ? 0.6 : 1) * (mods.cover ? 0.5 : 1);
  }
  function rollAudit(fin, mods, rng) {
    mods = mods || {};
    if (!(mods.force || rng() < auditChance(fin, mods))) return { fin, audit: null };
    const f = clone(fin);
    const raw = f.tax.unreported * 0.6 * (f.tax.accountant ? 0.7 : 1) * (mods.cover ? 0.5 : 1) + (f.tax.risk > 50 ? 400 : 150);
    const penalty = Math.round(raw);
    f.tax.unreported = 0; f.tax.risk = Math.min(f.tax.risk, 15);
    return { fin: f, audit: { penalty, text: '🧾 Kontrola skarbowa: kara ' + penalty + ' zł za nieudokumentowane przychody.' } };
  }
  function decayRisk(fin) { const f = clone(fin); f.tax.risk = Math.round(f.tax.risk * 0.9 * 10) / 10; return f; }
  function hireAccountant(fin, money) {
    if (fin.tax.accountant) return { ok: false, reason: 'Księgowa już u ciebie pracuje.' };
    if (money < ACCOUNTANT_COST) return { ok: false, reason: 'Brakuje ' + (ACCOUNTANT_COST - money) + ' zł.' };
    const f = clone(fin); f.tax.accountant = true; return { ok: true, fin: f, cost: ACCOUNTANT_COST };
  }
  const upkeep = fin => (fin.tax.accountant ? ACCOUNTANT_UPKEEP : 0);

  return { LENDERS, MIN_PAY, TAX_RATE, ACCOUNTANT_COST, fresh, debt, takeLoan, addDebt, minPay, settle, repay, collection, addIncome, payTax, auditChance, rollAudit, decayRisk, hireAccountant, upkeep };
});
