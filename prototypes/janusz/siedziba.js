/* Moduł siedziby firmy: lokal (garaż → blaszak → rudera → biuro → hala → siedziba), remonty budynku,
 * sprzęt i flota, oraz ocena firmy, która spina to z resztą gry. Czysta logika, działa w przeglądarce i w node.
 *
 * Ocena firmy (1–5 ★) = 1 + 4 · (0,30 · siedziba + 0,15 · sprzęt + 0,30 · opinie + 0,25 · rzetelność)
 *   siedziba   = 1 − e^(−(baza lokalu + mnożnik lokalu · Σ zaufanie z remontów) / 70)  (miękkie nasycenie)
 *   sprzęt     = (poziom narzędzi + poziom busa) / 6
 *   opinie     = średnia gwiazdek z ostatnich 10 zleceń / 5 (brak danych = 0,5)
 *   rzetelność = 1 − średni indeks fuszerki z ostatnich 8 zleceń / 100 − 0,05 · liczba otwartych reklamacji (brak danych = 0,5)
 * Skutki: mnożnik wypłat (0,85–1,25, plus popyt z szyldu), bonus do zadowolenia klientów (do +8),
 * komfort (podnosi bazowy nastrój ekipy), ochrona (mniej kradzieży), narzędzia (szybciej, celniej),
 * flota (mniej wypadków), a wszystko ma koszty utrzymania doliczane przy dniu wypłaty.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Siedziba = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const TIERS = [
    { id: 'garaz', name: 'Garaż u teścia', cost: 0, base: 0, mult: 0.6, upkeep: 0, desc: 'Tanio i blisko, trochę wstyd. Klienci pytają, gdzie jest firma.' },
    { id: 'blaszak', name: 'Blaszak za miastem', cost: 1200, base: 5, mult: 0.8, upkeep: 25, desc: 'Własny dach, regał i miejsce na narzędzia. Latem piekarnik, zimą lodówka.' },
    { id: 'rudera', name: 'Rudera po dziadku', cost: 3500, base: 3, mult: 1.2, upkeep: 40, desc: 'Ma potencjał, ale wszystko trzeba wyremontować. Idealna do przeróbek.' },
    { id: 'biuro', name: 'Biuro z placem', cost: 12000, base: 12, mult: 1.2, upkeep: 90, desc: 'Plac na materiały, biuro z wizytówką. Pierwsza siedziba, którą można pokazać klientowi.' },
    { id: 'hala', name: 'Hala z biurem', cost: 35000, base: 20, mult: 1.4, upkeep: 180, desc: 'Magazyn, warsztat i biuro w jednym. Firma wygląda poważnie.' },
    { id: 'siedziba', name: 'Siedziba przy obwodnicy', cost: 90000, base: 30, mult: 1.6, upkeep: 350, desc: 'Szyld widać z samochodu. Konkurencja zaczyna się denerwować.' },
  ];

  /* Remonty budynku: resetują się po przeprowadzce do nowego lokalu. */
  const UPGRADES = {
    okna: { name: 'Okna', levels: [
      { name: 'Drewniane po uszczelnieniu', cost: 250, trust: 0, comfort: 4 },
      { name: 'Plastikowe', cost: 900, trust: 4, comfort: 8 },
      { name: 'Trójszybowe z roletami', cost: 2500, trust: 8, comfort: 12 } ] },
    drzwi: { name: 'Drzwi', levels: [
      { name: 'Nowy zamek w starych drzwiach', cost: 200, sec: 10 },
      { name: 'Drzwi antywłamaniowe', cost: 800, sec: 25, trust: 3 },
      { name: 'Drzwi z domofonem', cost: 2000, sec: 35, trust: 6 } ] },
    dach: { name: 'Dach', levels: [
      { name: 'Załatany papą', cost: 300, comfort: 3 },
      { name: 'Blachodachówka', cost: 1500, comfort: 7, trust: 4 },
      { name: 'Ocieplony dach', cost: 4000, comfort: 10, trust: 6 } ] },
    ogrz: { name: 'Ogrzewanie', levels: [
      { name: 'Farelka', cost: 150, comfort: 3 },
      { name: 'Piec kaflowy', cost: 900, comfort: 8 },
      { name: 'Centralne ogrzewanie', cost: 3000, comfort: 12, trust: 4 } ] },
    szyld: { name: 'Szyld i reklama', levels: [
      { name: 'Baner z drukarni', cost: 150, trust: 4, demand: 2 },
      { name: 'Szyld podświetlany', cost: 700, trust: 8, demand: 4 },
      { name: 'Szyld, strona internetowa, wizytówki', cost: 2000, trust: 12, demand: 6 } ] },
    alarm: { name: 'Alarm', levels: [
      { name: 'Kłódka na łańcuchu', cost: 100, sec: 10 },
      { name: 'Alarm z czujnikami', cost: 900, sec: 30 },
      { name: 'Alarm z powiadomieniem na telefon', cost: 3000, sec: 40, trust: 3 } ] },
    kamery: { name: 'Kamery', levels: [
      { name: 'Kamera atrapa i naklejka „Obiekt monitorowany”', cost: 120, sec: 5 },
      { name: 'Kamery z nagrywaniem', cost: 800, sec: 20, trust: 2, recover: 0.4 },
      { name: 'Monitoring z podglądem w telefonie', cost: 2500, sec: 30, trust: 4, recover: 0.7 } ] },
    ochrona: { name: 'Ochrona fizyczna', levels: [
      { name: 'Pies na podwórku', cost: 200, sec: 12, upkeep: 10 },
      { name: 'Siatka i zamykana brama', cost: 1000, sec: 25 },
      { name: 'Ochroniarz na noc', cost: 4000, sec: 40, upkeep: 60, trust: 3 } ] },
  };
  /* Majątek firmy: przechodzi z tobą do nowego lokalu. */
  const ASSETS = {
    narzedzia: { name: 'Narzędzia', levels: [
      { name: 'Porządne klucze i wkrętaki', cost: 400, time: 0.04, acc: 0.03 },
      { name: 'Wiertarka udarowa i poziomica laserowa', cost: 1500, time: 0.08, acc: 0.06, trust: 2 },
      { name: 'Pełny warsztat', cost: 5000, time: 0.12, acc: 0.09, trust: 5 } ] },
    bus: { name: 'Bus', base: 'Stary kombi', levels: [
      { name: 'Używany bus', cost: 2500, accMult: 0.8, upkeep: 15 },
      { name: 'Bus po serwisie', cost: 7000, accMult: 0.65, upkeep: 30 },
      { name: 'Sprinter z logo firmy', cost: 18000, accMult: 0.55, upkeep: 50, trust: 6 } ] },
  };

  const fresh = () => ({ tier: 0, up: { okna: 0, drzwi: 0, dach: 0, ogrz: 0, szyld: 0, alarm: 0, kamery: 0, ochrona: 0 }, assets: { narzedzia: 0, bus: 0 }, cond: 100 });
  const clone = hq => ({ tier: hq.tier, up: Object.assign({}, hq.up), assets: Object.assign({}, hq.assets), cond: hq.cond == null ? 100 : hq.cond });

  function nextTier(hq) { return TIERS[hq.tier + 1] || null; }
  function nextLevel(group, key, hq) {
    const cur = group === 'up' ? hq.up[key] : hq.assets[key];
    const def = (group === 'up' ? UPGRADES : ASSETS)[key];
    return def.levels[cur] ? Object.assign({ level: cur + 1, key, group }, def.levels[cur]) : null;
  }

  /* Zakupy: zwracają { ok, hq, cost, reason }. Nie zmieniają wejścia. */
  function buyTier(hq, money) {
    const nt = nextTier(hq);
    if (!nt) return { ok: false, reason: 'To już najlepsza siedziba.' };
    if (money < nt.cost) return { ok: false, reason: 'Brakuje ' + (nt.cost - money) + ' zł.' };
    const h = clone(hq); h.tier++; Object.keys(h.up).forEach(k => h.up[k] = 0); // nowy lokal = remont od zera
    return { ok: true, hq: h, cost: nt.cost };
  }
  function buy(hq, group, key, money) {
    const nl = nextLevel(group, key, hq);
    if (!nl) return { ok: false, reason: 'Maksymalny poziom.' };
    if (money < nl.cost) return { ok: false, reason: 'Brakuje ' + (nl.cost - money) + ' zł.' };
    const h = clone(hq); (group === 'up' ? h.up : h.assets)[key]++;
    return { ok: true, hq: h, cost: nl.cost };
  }

  /* Zsumowane skutki wszystkich ulepszeń. */
  function effects(hq) {
    const t = TIERS[hq.tier];
    let trustB = 0, comfort = 0, sec = 0, demand = 0, upk = 0, recover = 0;
    for (const k of Object.keys(UPGRADES)) for (let i = 0; i < (hq.up[k] || 0); i++) {
      const l = UPGRADES[k].levels[i]; trustB += l.trust || 0; comfort += l.comfort || 0; sec += l.sec || 0; demand += l.demand || 0; upk += l.upkeep || 0; recover = Math.max(recover, l.recover || 0);
    }
    let time = 0, acc = 0, trustA = 0, accMult = 1, vUp = 0;
    for (let i = 0; i < hq.assets.narzedzia; i++) { const l = ASSETS.narzedzia.levels[i]; time = l.time; acc = l.acc; trustA += l.trust || 0; }
    for (let i = 0; i < hq.assets.bus; i++) { const l = ASSETS.bus.levels[i]; accMult = l.accMult; vUp = l.upkeep; trustA += l.trust || 0; }
    return {
      tier: t, trustBuilding: t.base + t.mult * trustB, trustAssets: trustA,
      comfort: Math.round(t.mult * comfort), security: clamp(sec, 0, 95), demand, recover,
      timeBonus: time * condFactor(hq), accBonus: acc * condFactor(hq), accMult, upkeep: t.upkeep + vUp + upk,
    };
  }

  /* Stan narzędzi: im niższy, tym gorszy bonus (do połowy). */
  function condFactor(hq) { return 0.5 + 0.5 * clamp((hq.cond == null ? 100 : hq.cond) / 100, 0, 1); }
  function wear(hq, amount) { const h = clone(hq); h.cond = clamp(h.cond - amount, 0, 100); return h; }
  function repairCost(hq) { const lvl = hq.assets.narzedzia; return lvl ? Math.round((100 - hq.cond) * 2 + lvl * 20) : 0; }
  function repair(hq, money) {
    if (!hq.assets.narzedzia) return { ok: false, reason: 'Nie masz narzędzi do serwisu.' };
    const c = repairCost(hq); if (hq.cond >= 100) return { ok: false, reason: 'Narzędzia są sprawne.' };
    if (money < c) return { ok: false, reason: 'Brakuje ' + (c - money) + ' zł.' };
    const h = clone(hq); h.cond = 100; return { ok: true, hq: h, cost: c };
  }
  /* Szansa, że zepsute narzędzie psuje robotę (poniżej 30% stanu). */
  function breakChance(hq) { return hq.assets.narzedzia && hq.cond < 30 ? (30 - hq.cond) / 100 : 0; }

  /* Ocena firmy. hist: [{index}] (ostatnie zlecenia), ratings: [gwiazdki], openClaims: liczba. */
  function rating(hq, hist, ratings, openClaims) {
    const e = effects(hq);
    const siedziba = 1 - Math.exp(-e.trustBuilding / 70);
    const sprzet = clamp((hq.assets.narzedzia + hq.assets.bus) / 6, 0, 1) * (0.7 + 0.3 * clamp((hq.cond == null ? 100 : hq.cond) / 100, 0, 1));
    const rr = (ratings || []).slice(-10);
    const opinie = rr.length ? rr.reduce((a, b) => a + b, 0) / rr.length / 5 : 0.5;
    const hh = (hist || []).slice(-8);
    const base = hh.length ? 1 - hh.reduce((a, b) => a + b.index, 0) / hh.length / 100 : 0.5;
    const rzetelnosc = clamp(base - 0.05 * (openClaims || 0), 0, 1);
    const score = 0.30 * siedziba + 0.15 * sprzet + 0.30 * opinie + 0.25 * rzetelnosc;
    const stars = Math.round((1 + 4 * score) * 100) / 100;
    return { stars, parts: { siedziba, sprzet, opinie, rzetelnosc }, payMult: payoutMult(stars, e.demand), satBonus: Math.round((stars - 1) / 4 * 8), effects: e };
  }
  function payoutMult(stars, demand) { return Math.round(clamp(1 + (stars - 2.5) * 0.08, 0.85, 1.25) * (1 + (demand || 0) / 100) * 1000) / 1000; }

  /* Wartość łupu: im lepszy sprzęt i bus, tym bardziej opłaca się włamanie. */
  function lootValue(hq) {
    let v = 0;
    for (let i = 0; i < hq.assets.narzedzia; i++) v += ASSETS.narzedzia.levels[i].cost;
    for (let i = 0; i < hq.assets.bus; i++) v += ASSETS.bus.levels[i].cost;
    return v;
  }
  function attractiveness(hq) { return clamp(0.5 + lootValue(hq) / 8000, 0.5, 2.5); }
  /* Szansa kradzieży = 8% · atrakcyjność · (1 − zabezpieczenia). Zabezpieczenia nie dają 100%. */
  function theftChance(hq) { return 0.08 * attractiveness(hq) * (1 - effects(hq).security / 100); }
  /* Przebieg kradzieży: strata zależy od wartości sprzętu, kamery odzyskują część. */
  function resolveTheft(hq, rng) {
    if (rng() >= theftChance(hq)) return null;
    const e = effects(hq), loot = lootValue(hq);
    const loss = Math.round(Math.max(40, Math.min(1500, 60 + loot * (0.04 + rng() * 0.08))));
    const recovered = Math.round(loss * e.recover * (rng() < 0.7 ? 1 : 0));
    let toolLost = false, next = clone(hq);
    if (hq.assets.narzedzia > 0 && rng() < (1 - e.security / 100) * 0.25) { next.assets.narzedzia--; toolLost = true; }
    return { loss, recovered, net: loss - recovered, toolLost, hq: next, cameras: e.recover > 0 };
  }

  return { TIERS, UPGRADES, ASSETS, fresh, clone, nextTier, nextLevel, buyTier, buy, effects, rating, payoutMult, theftChance, lootValue, attractiveness, resolveTheft, wear, repair, repairCost, breakChance, condFactor };
});
