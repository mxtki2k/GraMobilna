/* Bus firmowy: stan techniczny 0–100, zużycie przy każdym dojeździe, awarie w drodze i serwis.
 * Lepszy bus z siedziby (poziom 0–3) zużywa się wolniej i rzadziej się psuje. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Bus = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const WEAR = [1, 0.8, 0.6, 0.45], RISK = [1, 0.85, 0.7, 0.55];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fresh = () => ({ cond: 80, broken: false, km: 0, breakdowns: 0 });
  const label = b => b.broken ? 'zepsuty' : b.cond >= 75 ? 'dobry' : b.cond >= 50 ? 'średni' : b.cond >= 25 ? 'zły' : 'ledwo jedzie';
  /* Szansa awarii na jeden przejazd. */
  function chance(bus, level, night) {
    const c = bus.cond;
    const base = c >= 70 ? 0.02 : c >= 40 ? 0.02 + (70 - c) * 0.004 : 0.14 + (40 - c) * 0.008;
    return clamp(base * (night ? 1.3 : 1) * (RISK[level || 0] || 1), 0, 0.6);
  }
  const rollBreakdown = (bus, level, night, rng) => !bus.broken && rng() < chance(bus, level, night);
  /* Zużycie po przejeździe (noc: gorsze drogi i zmęczenie). */
  function drive(bus, level, night) {
    return Object.assign({}, bus, { cond: clamp(Math.round((bus.cond - 4 * (night ? 1.25 : 1) * (WEAR[level || 0] || 1)) * 10) / 10, 0, 100), km: bus.km + 1 });
  }
  /* Co robisz po awarii w drodze. Zwraca koszt, czas (jednostki naprawy), nowy stan busa i flagę „materiały dowiózł kurier”. */
  function resolve(kind, bus, night, rng) {
    const nb = Object.assign({}, bus, { breakdowns: bus.breakdowns + 1 });
    if (kind === 'laweta') return { cost: night ? 260 : 180, timeAdj: 10, bus: Object.assign(nb, { cond: clamp(bus.cond + 25, 0, 100), broken: false }), courier: false, notes: ['🚛 Laweta zabrała busa do warsztatu. Czekasz, płacisz i jedziesz dalej.'] };
    if (kind === 'sam') {
      if (rng() < 0.55) return { cost: 40, timeAdj: 8, bus: Object.assign(nb, { cond: clamp(bus.cond + 10, 0, 100), broken: false }), courier: false, notes: ['🔧 Udało ci się ruszyć busa drutem i dobrym słowem. 40 zł za części.'] };
      return { cost: night ? 300 : 220, timeAdj: 14, bus: Object.assign(nb, { cond: clamp(bus.cond + 20, 0, 100), broken: false }), courier: false, notes: ['🔧💥 Naprawa nie wyszła, więc i tak laweta. Rachunek większy, czas stracony.'] };
    }
    if (kind === 'kurier') return { cost: 70, timeAdj: 4, bus: Object.assign(nb, { broken: true }), courier: true, notes: ['🚚 Zostawiasz busa przy drodze, a materiały przywozi kurier. Bus stoi zepsuty do serwisu.'] };
    throw new Error('Nieznana decyzja ' + kind);
  }
  /* Serwis w warsztacie: przegląd (+30 stanu) albo remont (do 100). Zepsuty bus naprawia tylko remont. */
  function serviceCost(bus, kind) { return kind === 'przeglad' ? 90 : Math.round(60 + (100 - bus.cond) * 4); }
  function service(bus, kind, money) {
    if (kind === 'przeglad' && bus.broken) return { ok: false, reason: 'Zepsuty bus wymaga remontu.' };
    const cost = serviceCost(bus, kind);
    if (money < cost) return { ok: false, reason: 'Za mało gotówki.' };
    if (kind === 'przeglad' && bus.cond >= 95) return { ok: false, reason: 'Bus jest w świetnym stanie.' };
    return { ok: true, cost, bus: Object.assign({}, bus, { cond: kind === 'przeglad' ? clamp(bus.cond + 30, 0, 100) : 100, broken: false }) };
  }
  return { WEAR, RISK, fresh, label, chance, rollBreakdown, drive, resolve, serviceCost, service };
});
