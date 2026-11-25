/* Stali klienci i konkurencja. Zaufanie klienta (−100…100) rośnie po dobrej robocie i spada po fuszerce.
 * Zaufanie podnosi wypłatę, zwiększa szansę telefonów od tego klienta i chroni przed rywalem. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Klienci = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fresh = () => ({});
  const get = (rel, id) => rel[id] || { trust: 0, jobs: 0 };
  /* Po zleceniu: gwiazdki zmieniają zaufanie (5★ +10, 4★ +5, 3★ 0, 2★ −10, 1★ −20), mnożnik wg „pamiętliwości”. */
  function afterJob(rel, id, stars, grudge) {
    const d = [-20, -10, 0, 5, 10][clamp(stars, 1, 5) - 1], g = grudge || 1, n = Object.assign({}, rel), c = get(rel, id);
    n[id] = { trust: clamp(Math.round(c.trust + (d < 0 ? d * g : d)), -100, 100), jobs: c.jobs + 1 }; return n;
  }
  const level = t => t >= 50 ? 'stały klient' : t >= 20 ? 'zaufany' : t > -20 ? 'znajomy' : t > -50 ? 'nieufny' : 'wróg';
  /* Stały klient płaci więcej, nieufny targuje: od ×0,95 do ×1,15. */
  const payMult = t => Math.round(clamp(1 + (t >= 0 ? t * 0.001 : t * 0.0005), 0.95, 1.1) * 1000) / 1000;
  /* Waga klienta przy losowaniu telefonu: znani dzwonią częściej, wrogowie prawie nigdy. */
  const weight = t => t <= -50 ? 0.05 : t < 0 ? 0.5 : 1 + t / 50;
  function pick(rng, ids, rel) {
    const w = ids.map(id => weight(get(rel, id).trust)), sum = w.reduce((a, b) => a + b, 0);
    let x = rng() * sum; for (let i = 0; i < ids.length; i++) { x -= w[i]; if (x <= 0) return ids[i]; } return ids[ids.length - 1];
  }
  /* Rywal chce tego samego zlecenia. power − strength to przewaga rywala; zaufanie klienta ≥30 daje spokój. */
  function contestChance(rivalPower, strength, trust) {
    const base = clamp(0.1 + (rivalPower - strength) / 200, 0.05, 0.45);
    return Math.round(base * (trust >= 50 ? 0.25 : trust >= 30 ? 0.5 : 1) * 1000) / 1000;
  }
  /* Odpowiedź na konkurencję: obniżka (−15%) wygrywa zawsze, zwykła wygrywa tylko przy lepszej reputacji (50% + trust/200). */
  function contest(choice, trust, rng) {
    if (choice === 'cut') return { won: true, priceMult: 0.85 };
    if (choice === 'normal') return { won: rng() < clamp(0.5 + trust / 200, 0.2, 0.8), priceMult: 1 };
    throw new Error('Nieznana decyzja ' + choice);
  }
  /* Klienci zapominają: zaufanie wraca do zera o rate pkt dziennie (dodatnie i ujemne). */
  function decay(rel, days, rate) {
    const n = {}; for (const [id, c] of Object.entries(rel)) { const d = days * (rate == null ? 0.5 : rate), t = c.trust > 0 ? Math.max(0, c.trust - d) : Math.min(0, c.trust + d); n[id] = { trust: Math.round(t), jobs: c.jobs }; }
    return n;
  }
  return { fresh, get, decay, afterJob, level, payMult, weight, pick, contestChance, contest };
});
