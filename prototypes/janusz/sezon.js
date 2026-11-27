/* Wydarzenia sezonowe: okna kalendarzowe z mnożnikami popytu na roboty, wypłaty, awarii busa i cen narzędzi. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./czas.js'));
  else root.Sezon = factory(root.Czas);
})(typeof self !== 'undefined' ? self : this, function (Czas) {
  /* from/to: [miesiąc 0–11, dzień]. Okno może przechodzić przez Nowy Rok (from > to). */
  const EVENTS = [
    { id: 'zima', name: 'Zima stulecia', em: '❄️', from: [11, 15], to: [1, 15], text: 'Grzejniki i krany pękają, okna ciągną. Bus gorzej odpala.', demand: { grzejnik: 1.6, kran: 1.3, okno: 1.2, syfon: 1.15 }, bus: 1.25 },
    { id: 'roztopy', name: 'Wiosenne roztopy', em: '💧', from: [2, 10], to: [3, 25], text: 'Piwnice zalane, rury rozmarznięte. Hydraulicy w cenie.', demand: { syfon: 1.5, kran: 1.25, plytki: 1.1 } },
    { id: 'remonty', name: 'Sezon remontowy', em: '🎨', from: [3, 26], to: [5, 30], text: 'Wszyscy odświeżają mieszkania przed latem.', demand: { malowanie: 1.3, sciana: 1.25, plytki: 1.25, drzwi: 1.15 } },
    { id: 'wakacje', name: 'Wakacje', em: '🏖️', from: [5, 1], to: [6, 31], text: 'Klienci na urlopach, mniej zleceń i niższe stawki.', pay: 0.95 },
    { id: 'bf', name: 'Black Friday w Alledrogo', em: '🛒', from: [10, 22], to: [10, 30], text: 'Narzędzia tańsze o 25%. Podróbki też.', toolPrice: 0.75 },
    { id: 'swieta', name: 'Świąteczne porządki', em: '🎄', from: [10, 10], to: [11, 24], text: 'Przed świętami wszyscy chcą coś naprawić i dają napiwki.', demand: { malowanie: 1.3, sciana: 1.2, polka: 1.2, gniazdko: 1.1 }, pay: 1.08 },
  ];
  const ord = (m, d) => m * 100 + d;
  function inRange(m, d, from, to) { const x = ord(m, d), a = ord(from[0], from[1]), b = ord(to[0], to[1]); return a <= b ? x >= a && x <= b : x >= a || x <= b; }
  function active(clock) { const d = Czas.dateOf(clock); return EVENTS.filter(e => inRange(d.m, d.day, e.from, e.to)); }
  const demand = (clock, jobId) => active(clock).reduce((p, e) => p * ((e.demand && e.demand[jobId]) || 1), 1);
  const pay = clock => Math.round(active(clock).reduce((p, e) => p * (e.pay || 1), 1) * 1000) / 1000;
  const bus = clock => active(clock).reduce((p, e) => p * (e.bus || 1), 1);
  const toolPrice = clock => active(clock).reduce((p, e) => p * (e.toolPrice || 1), 1);
  return { EVENTS, inRange, active, demand, pay, bus, toolPrice };
});
