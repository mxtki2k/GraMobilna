/* Osiedle: znajomości (przysługi i długi wdzięczności), plotki (renoma wśród sąsiadów) i rywal (Bogdan-Bud).
 *   przysługa działa od razu, ale zwiększa twój dług u znajomego; przy długu ≥ 2 znajomy upomni się o zwrot
 *   plotki = 0..100, zmieniają się po każdym zleceniu (gwiazdki · skłonność klienta do gadania), skandale je obniżają
 *   mnożnik wypłaty od plotek = 1 + (plotki − 50)/500
 *   rywal rośnie z czasem i dołuje ceny, gdy jest silniejszy od ciebie; podkupuje niezadowolonych pracowników
 *   i szkodzi, jeśli go rozdrażnisz (żal)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Osiedle = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const CONTACTS = {
    urzad: { id: 'urzad', name: 'Szwagier w urzędzie', em: '🗂️', meetCost: 150, favor: 'audit', fav: 'Kara z kontroli skarbowej o połowę mniejsza i mniejsze szanse kontroli.' },
    hurt: { id: 'hurt', name: 'Waldek z hurtowni', em: '📦', meetCost: 80, favor: 'materials', fav: 'Materiały taniej o 10% przy następnym zleceniu.' },
    policja: { id: 'policja', name: 'Dzielnicowy Marek', em: '👮', meetCost: 100, favor: 'fine', fav: '„Zapomni” o następnym mandacie.' },
    sasiad: { id: 'sasiad', name: 'Sąsiad Zdzisio z klatki', em: '🏘️', meetCost: 50, favor: 'gossip', fav: 'Powie dobre słowo na klatce: plotki +8.' },
  };
  const GOSSIP = { mirek: 0.4, karyna: 1.6, sebix: 0.8, grazyna: 1.4, tesciowa: 1.2, heniek: 1.0 };

  const fresh = () => ({ contacts: {}, gossip: 50, rival: { name: 'Bogdan-Bud', power: 25, grudge: 0 } });
  const clone = o => JSON.parse(JSON.stringify(o));

  function meet(os, id, money) {
    const c = CONTACTS[id]; if (!c) return { ok: false, reason: 'Nie ma takiego znajomego.' };
    if (os.contacts[id]) return { ok: false, reason: 'Już się znacie.' };
    if (money < c.meetCost) return { ok: false, reason: 'Brakuje ' + (c.meetCost - money) + ' zł na kawę i ciasto.' };
    const o = clone(os); o.contacts[id] = { trust: 20, owes: 0 }; return { ok: true, os: o, cost: c.meetCost };
  }
  /* Przysługa: zwraca { ok, os, effect } gdzie effect = { type } do zastosowania w grze. */
  function useFavor(os, id) {
    const c = CONTACTS[id], k = os.contacts[id];
    if (!c || !k) return { ok: false, reason: 'Nie znasz tej osoby.' };
    if (k.owes >= 3) return { ok: false, reason: c.name + ' ma dość. Najpierw spłać dług wdzięczności.' };
    const o = clone(os); o.contacts[id].owes++; o.contacts[id].trust = clamp(k.trust - 4, 0, 100);
    if (c.favor === 'gossip') o.gossip = clamp(o.gossip + 8, 0, 100);
    return { ok: true, os: o, effect: { type: c.favor } };
  }
  function repayFavor(os, id, money) {
    const k = os.contacts[id]; if (!k || k.owes <= 0) return { ok: false, reason: 'Nie jesteś nic winien.' };
    if (money < 100) return { ok: false, reason: 'Brakuje ' + (100 - money) + ' zł.' };
    const o = clone(os); o.contacts[id].owes--; o.contacts[id].trust = clamp(k.trust + 10, 0, 100); return { ok: true, os: o, cost: 100 };
  }
  const owedContact = os => Object.keys(os.contacts).find(id => os.contacts[id].owes >= 2) || null;

  function updateGossip(os, ev) {
    const o = clone(os), g = (ev.gossipy == null ? 1 : ev.gossipy);
    let d = (ev.stars - 3) * g * 3 - (ev.scandal ? 8 : 0);
    o.gossip = clamp(Math.round((o.gossip + d + (50 - o.gossip) * 0.04) * 10) / 10, 0, 100);
    return o;
  }
  const gossipMult = os => Math.round((1 + (os.gossip - 50) / 500) * 1000) / 1000;

  /* Rywal. ctx: { rating, tier, crew:[workers] }. Zwraca { os, events[] }. */
  function strength(ctx) { return ctx.rating * 10 + ctx.tier * 6; }
  function undercut(os, ctx) { return clamp((os.rival.power - strength(ctx)) / 150, 0, 0.15); }
  function tickRival(os, ctx, rng) {
    const o = clone(os), events = [];
    o.rival.power += 1.2 + o.rival.grudge / 50;
    for (const w of (ctx.crew || [])) {
      const p = clamp((o.rival.power - 40) / 100 * (0.6 - w.mood / 100), 0, 0.5);
      if (w.mood < 45 && rng() < p) { events.push({ type: 'poach', id: w.id }); o.rival.power += 2; break; }
    }
    if (o.rival.grudge >= 30 && rng() < 0.25) events.push({ type: 'sabotage', cost: 150 + Math.round(rng() * 250) });
    o.rival.grudge = Math.max(0, o.rival.grudge - 3);
    return { os: o, events };
  }

  return { CONTACTS, GOSSIP, fresh, meet, useFavor, repayFavor, owedContact, updateGossip, gossipMult, strength, undercut, tickRival };
});
