/* Księga miesiąca: wszystkie wpływy i wydatki w podziale na kategorie i miesiące. Z niej bierze się „plus w tym miesiącu”.
 *   przychód   – wypłaty za zlecenia, fuchy, premie
 *   koszt      – materiały, transport, pensje, utrzymanie, podatki, kary, reklamacje, kradzieże, odsetki, serwis
 *   inwestycja – zakupy (siedziba, narzędzia, zatrudnienie), nie wchodzi do plusu operacyjnego
 *   dług       – pożyczki i spłaty kapitału, nie wchodzi do plusu operacyjnego
 * Plus miesiąca = przychody + koszty (koszty z minusem) + pozostałe niezaksięgowane ruchy ('inne'). Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ksiega = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATS = {
    zlecenia: { type: 'przychod', label: 'Zlecenia' }, fuchy: { type: 'przychod', label: 'Fuchy ekipy' }, zdarzenia: { type: 'przychod', label: 'Zdarzenia i premie' },
    materialy: { type: 'koszt', label: 'Materiały' }, transport: { type: 'koszt', label: 'Transport (kurier)' }, wypadki: { type: 'koszt', label: 'Mandaty i wypadki' },
    pensje: { type: 'koszt', label: 'Pensje' }, utrzymanie: { type: 'koszt', label: 'Utrzymanie siedziby' }, podatki: { type: 'koszt', label: 'Podatki' },
    kary: { type: 'koszt', label: 'Kary i windykacja' }, reklamacje: { type: 'koszt', label: 'Reklamacje' }, kradziez: { type: 'koszt', label: 'Kradzieże' },
    odsetki: { type: 'koszt', label: 'Odsetki' }, serwis: { type: 'koszt', label: 'Serwis narzędzi' },
    zakupy: { type: 'inwestycja', label: 'Inwestycje i zakupy' }, dlug: { type: 'dlug', label: 'Pożyczki i spłaty długu' },
    inne: { type: 'koszt', label: 'Inne' },
  };
  const fresh = () => ({ months: {} });
  const clone = l => JSON.parse(JSON.stringify(l));
  const monthOf = (l, key) => l.months[key] || { cats: {}, jobs: 0, hours: 0, net: 0 };

  /* Księguje kwotę ze znakiem (plus = wpływ). Zwraca nową księgę. */
  function book(l, key, cat, amount) {
    if (!CATS[cat]) throw new Error('Nieznana kategoria ' + cat);
    if (!amount) return l;
    const n = clone(l), m = n.months[key] || (n.months[key] = { cats: {}, jobs: 0, hours: 0, net: 0 });
    m.cats[cat] = Math.round(((m.cats[cat] || 0) + amount) * 100) / 100; return n;
  }
  /* Zlecenie do statystyk miesiąca: zysk netto i godziny pracy. */
  function noteJob(l, key, net, hours) {
    const n = clone(l), m = n.months[key] || (n.months[key] = { cats: {}, jobs: 0, hours: 0, net: 0 });
    m.jobs++; m.hours += hours; m.net += net; return n;
  }
  /* Podsumowanie miesiąca. unbooked: różnica między faktycznym ruchem na koncie a zaksięgowanym (trafia do „inne”). */
  function summary(l, key, unbooked) {
    const m = monthOf(l, key), cats = Object.assign({}, m.cats);
    if (unbooked) cats.inne = Math.round(((cats.inne || 0) + unbooked) * 100) / 100;
    let income = 0, costs = 0, invest = 0, debt = 0;
    for (const [c, v] of Object.entries(cats)) {
      const t = CATS[c].type;
      if (t === 'przychod') income += v; else if (t === 'koszt') { if (c === 'inne' && v > 0) income += v; else costs += v; } else if (t === 'inwestycja') invest += v; else debt += v;
    }
    income = Math.round(income * 100) / 100; costs = Math.round(costs * 100) / 100;
    const plus = Math.round((income + costs) * 100) / 100;
    return { key, cats, income, costs, plus, invest, debt, jobs: m.jobs, hours: m.hours, net: m.net, perHour: m.hours > 0 ? Math.round(m.net / m.hours * 100) / 100 : 0 };
  }
  /* Suma wszystkich zaksięgowanych kwot w miesiącu (do wyliczenia „inne”). */
  function bookedTotal(l, key) { return Object.values(monthOf(l, key).cats).reduce((a, b) => a + b, 0); }
  const keys = l => Object.keys(l.months).sort();

  return { CATS, fresh, book, noteJob, summary, bookedTotal, keys };
});
