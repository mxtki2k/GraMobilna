/* Ubezpieczenie OC: składka za każde rozliczenie tygodnia, w zamian ubezpieczyciel pokrywa część odszkodowań i reklamacji.
 * Każda wypłata podnosi składkę (rośnie z historią szkód i słabnie z czasem). Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ubezp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const BASE = 40, PER_CLAIM = 10, COVER = { reklamacja: 0.6, wypadek: 0.8 }, DEDUCT = 100, MAX = 120;
  const fresh = () => ({ active: false, history: 0 });
  const premium = oc => Math.min(MAX, BASE + Math.round(oc.history * PER_CLAIM));
  const toggle = (oc, on) => Object.assign({}, oc, { active: !!on });
  /* Wypłata za szkodę: ubezpieczyciel pokrywa część powyżej udziału własnego. Zwraca, ile płaci gracz. */
  function cover(oc, claim) {
    if (!oc.active) return { insurer: 0, you: claim.amount, oc };
    const share = COVER[claim.kind === 'wypadek' ? 'wypadek' : 'reklamacja'], insurer = Math.round(Math.max(0, claim.amount - DEDUCT) * share);
    return { insurer, you: claim.amount - insurer, oc: Object.assign({}, oc, { history: oc.history + 1 }) };
  }
  /* Co tydzień historia szkód się starzeje. */
  const decay = oc => Object.assign({}, oc, { history: Math.max(0, Math.round((oc.history - 0.25) * 100) / 100) });
  return { BASE, PER_CLAIM, COVER, DEDUCT, MAX, fresh, premium, toggle, cover, decay };
});
