/* Stawka godzinowa po wszystkich kosztach: ile zostaje graczowi za godzinę pracy.
 *   zostaje = wypłata − materiały − transport − udział pomocnika w pensji − zużycie narzędzi − podatek od faktury − udział w utrzymaniu firmy
 *   stawka  = zostaje / godziny (cała robota: dojazd, oczekiwanie na pomocnika, awarie, pogoda)
 * Udział w pensji = pensja za dzień wypłaty / liczba zleceń między wypłatami (w nocy +50%). Udział w utrzymaniu liczony tak samo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Stawka = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PAYDAY_EVERY = 3;
  const round = x => Math.round(x * 100) / 100;

  /* o: { payout, materials, transport, helper, tools, tax, overhead, minutes } */
  function jobEconomics(o) {
    const g = k => Math.max(0, o[k] || 0);
    const lines = [
      { key: 'payout', label: 'Wypłata od klienta', value: round(g('payout')) },
      { key: 'materials', label: 'Materiały', value: -round(g('materials')) },
      { key: 'transport', label: 'Transport, awarie, mandaty', value: -round(g('transport')) },
      { key: 'helper', label: 'Pomocnik (udział w pensji)', value: -round(g('helper')) },
      { key: 'tools', label: 'Zużycie narzędzi', value: -round(g('tools')) },
      { key: 'tax', label: 'Podatek od faktury', value: -round(g('tax')) },
      { key: 'penalty', label: 'Kara za spóźnienie', value: -round(g('penalty')) },
      { key: 'overhead', label: 'Utrzymanie firmy (udział)', value: -round(g('overhead')) },
    ];
    const net = round(lines.reduce((s, l) => s + l.value, 0)), hours = Math.max(1 / 60, (o.minutes || 0) / 60);
    return { lines, net, hours: round(hours), perHour: round(net / hours), grossPerHour: round(g('payout') / hours), costs: round(g('payout') - net) };
  }
  /* Koszt wzięcia pomocnika na jedno zlecenie: udział w pensji, w nocy z dopłatą 50%. */
  const helperShare = (worker, night) => (worker ? Math.round(worker.wage / PAYDAY_EVERY * (night ? 1.5 : 1)) : 0);
  const overheadShare = upkeep => Math.round((upkeep || 0) / PAYDAY_EVERY);
  /* Zużycie narzędzi: różnica wartości przedmiotów użytych w zleceniu (value() z Alledrogo). */
  function toolWear(before, after, valueFn) {
    let s = 0; const aft = {}; after.forEach(i => { aft[i.id] = i; });
    before.forEach(i => { const a = aft[i.id]; s += Math.max(0, valueFn(i) - (a ? valueFn(a) : 0)); });
    return Math.round(s);
  }
  /* Szacunek przed robotą: oczekiwana wypłata i czas przy typowym przebiegu (85% zadowolenia, 80% terminu). */
  function estimate(o) {
    const payout = o.base * (0.4 + 0.6 * 0.85) * (o.payMult || 1);
    const minutes = (o.deadlineUnits || 20) * (o.timeScale || 5) * 0.8 * (o.night ? 1.1 : 1) + (o.extraMinutes || 0);
    return jobEconomics({ payout, materials: o.materials == null ? 15 : o.materials, transport: o.transport || 0, helper: o.helper || 0, tools: o.tools || 0, tax: o.invoice === false ? 0 : payout * (o.taxRate == null ? 0.10 : o.taxRate), overhead: o.overhead || 0, minutes });
  }
  return { PAYDAY_EVERY, jobEconomics, helperShare, overheadShare, toolWear, estimate };
});
