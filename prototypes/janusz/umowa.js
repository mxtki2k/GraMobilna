/* Umowa ze zleceniodawcą: faktura, kosztorys i termin. Wybory przed robotą zmieniają wypłatę, ryzyko i presję czasu.
 *   faktura:   z fakturą (podatek 10%) albo bez (−4% ceny, bez podatku, rośnie ryzyko kontroli skarbowej);
 *              wymagający klienci (surowość ≥ 1,2 lub fachowiec) obrażają się na „bez faktury”.
 *   kosztorys: uczciwy / zawyżony (+20%, klient może zauważyć) / zaniżony (−15%, klient zachwycony ceną).
 *   termin:    realny / „na wczoraj” (−25% czasu, +10% wypłaty).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Umowa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TAX_RATE = 0.10;
  const DEFAULT = { invoice: true, quote: 'fair', rush: false };

  function needsInvoice(client) { return !!client.expert || client.strict >= 1.2; }
  function detectChance(client) { return clamp(0.1 + client.attention * 0.35 + (client.expert ? 0.3 : 0), 0, 0.8); }

  /* Zwraca skutki ustaleń. rng służy do wykrycia zawyżenia. */
  function evaluate(terms, client, rng) {
    const t = Object.assign({}, DEFAULT, terms);
    const out = { payMult: 1, satDelta: 0, deadlineFactor: 1, taxRate: TAX_RATE, taxRiskDelta: 0, detected: false, notes: [], terms: t };
    if (!t.invoice) {
      out.payMult *= 0.96; out.taxRate = 0; out.taxRiskDelta = 9;
      if (needsInvoice(client)) { out.satDelta -= 10; out.notes.push(client.name + ' kręci nosem: „Bez faktury? A potem co?”'); }
      else out.notes.push('Bez faktury: taniej dla klienta, bez podatku dla ciebie. Do czasu kontroli.');
    }
    if (t.quote === 'inflated') {
      out.payMult *= 1.2;
      if (rng() < detectChance(client)) { out.detected = true; out.satDelta -= 25; out.notes.push('🧐 ' + client.name + ' sprawdził ceny w internecie i zauważył zawyżenie. Awantura.'); }
      else out.notes.push('Zawyżony kosztorys przeszedł bez problemu. Tym razem.');
    } else if (t.quote === 'low') {
      out.payMult *= 0.85; out.satDelta += 10; out.notes.push('Niska cena zachwyciła klienta. Teraz trzeba z tego wyżyć.');
    }
    if (t.rush) { out.deadlineFactor = 0.75; out.payMult *= 1.1; out.notes.push('Termin „na wczoraj”: premia za pośpiech, mniej czasu na robotę.'); }
    out.payMult = Math.round(out.payMult * 1000) / 1000;
    return out;
  }
  return { TAX_RATE, DEFAULT, needsInvoice, detectChance, evaluate };
});
