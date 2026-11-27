/* Alledrogo: parodia serwisu ogłoszeniowego w grze. Kupujesz narzędzia nowe i używane; używane są tańsze,
 * ale opis może kłamać, a narzędzie psuje się po czasie. Czysta logika (bez DOM), losowość przez rng().
 *
 * Każda oferta ma PRAWDĘ ukrytą przed graczem: prawdziwy stan, żywotność (ile zleceń wytrzyma), ukrytą wadę, podróbkę.
 * Gracz widzi tylko: opis, deklarowaną klasę, cenę, ocenę sprzedawcy (oceny można „kupić”) i średnią cenę nowego.
 *   uczciwość sprzedawcy h: P(zawyża klasę) = 1 − h; ocena widoczna = 3,6 + 1,2·h + szum (nieuczciwi mają niewiele gorsze)
 *   cena = cena bazowa narzędzia · mnożnik klasy DEKLAROWANEJ · (0,9–1,15); kłamcy schodzą do 0,72–0,92, więc tanie „jak nowe” bywa kłamstwem
 *   awaria narzędzia: 0,5 przy ukrytej wadzie w pierwszym użyciu, +0,35 gdy żywotność ≤ 2, +0,12 gdy ≤ 4, +0,1 gdy stan < 30%
 *   premia narzędzia = bazowa · mnożnik poziomu (0,7 / 1 / 1,25) · (0,5 + 0,5 · stan/100); podróbka obniża poziom o 1
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Alledrogo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lcg = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; };
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];
  const between = (lo, hi, rng) => Math.round(lo + (hi - lo) * rng());

  /* Co wolno kupić. jobs = na jakie zlecenia pomaga. hazardMult = redukcja zagrożenia wad (np. miernik prądu). */
  const ALL_JOBS = ['kran', 'sciana', 'gniazdko', 'polka', 'syfon', 'drzwi', 'plytki', 'grzejnik', 'okno', 'malowanie'];
  const TYPES = {
    zestaw: { id: 'zestaw', name: 'Zestaw narzędzi ręcznych', jobs: ALL_JOBS, base: 150, acc: 0.075, time: 0.06, brands: ['Walizka majstra', 'Zestaw 100 elementów', 'Skrzynka „Złota rączka”'] },
    wiertarka: { id: 'wiertarka', name: 'Wiertarka udarowa', jobs: ['polka', 'sciana', 'drzwi', 'okno'], base: 180, acc: 0.105, time: 0.075, brands: ['Turbo-Wiert 3000', 'Hammer-Max', 'Ryś Pro'] },
    poziomica: { id: 'poziomica', name: 'Poziomica laserowa', jobs: ['polka', 'plytki', 'drzwi'], base: 120, acc: 0.15, time: 0.06, brands: ['Laser-Prosto', 'Libelka X', 'Równo.pl'] },
    klucze: { id: 'klucze', name: 'Klucze do rur', jobs: ['kran', 'syfon', 'grzejnik'], base: 90, acc: 0.12, time: 0.09, brands: ['Hydro-Klucz', 'Rurman', 'Zestaw „Złota rączka”'] },
    szlifierka: { id: 'szlifierka', name: 'Szlifierka do gipsu', jobs: ['sciana', 'drzwi', 'malowanie'], base: 220, acc: 0.12, time: 0.09, brands: ['Gładź-Max', 'Szlif-Turbo', 'Pyłomat'] },
    probnik: { id: 'probnik', name: 'Miernik napięcia', jobs: ['gniazdko'], base: 110, acc: 0.12, time: 0.06, hazardMult: 0.6, brands: ['Volt-Test', 'Prąd-Stop', 'Mierzymy.pl'] },
    przecinarka: { id: 'przecinarka', name: 'Przecinarka do płytek', jobs: ['plytki'], base: 260, acc: 0.135, time: 0.09, brands: ['Tnij-Prosto', 'Glazur-Max', 'Płytkomat'] },
    pistolet: { id: 'pistolet', name: 'Pistolet do silikonu', jobs: ['okno', 'syfon', 'plytki'], base: 60, acc: 0.09, time: 0.06, brands: ['Silikon-Strzał', 'Fuga-Pro', 'Uszczelniacz 3000'] },
    walki: { id: 'walki', name: 'Wałki i pędzle', jobs: ['malowanie'], base: 70, acc: 0.12, time: 0.075, brands: ['Malarz Pro', 'Zestaw „Pędzel i wałek”', 'Kolor-Max'] },
    szpachle: { id: 'szpachle', name: 'Zestaw szpachli', jobs: ['sciana', 'malowanie', 'plytki'], base: 40, acc: 0.075, time: 0.045, brands: ['Szpachlarz', 'Gładko', 'Zestaw 12w1'] },
  };
  const GEN = (typeof RobotyGen !== 'undefined' ? RobotyGen : (() => { try { return require('./roboty_gen.js'); } catch (e) { return null; } })()) || { JOBS: {}, SURPRISES: {}, CHAINS: {}, LEVELS: [], META: {} };
  for (const [id, m] of Object.entries(GEN.META)) { if (ALL_JOBS.indexOf(id) < 0) ALL_JOBS.push(id); for (const t of (m.narzedzia || [])) if (TYPES[t] && TYPES[t].jobs.indexOf(id) < 0) TYPES[t].jobs.push(id); }
  const CLASSES = [
    { id: 'nowe', name: 'nowe', price: 1.0, cond: [100, 100], life: [80, 120] },
    { id: 'jak_nowe', name: 'jak nowe', price: 0.8, cond: [88, 100], life: [40, 80] },
    { id: 'uzywane', name: 'używane', price: 0.55, cond: [55, 90], life: [8, 20] },
    { id: 'po_przejsciach', name: 'po przejściach', price: 0.3, cond: [25, 60], life: [2, 9] },
    { id: 'na_czesci', name: 'na części', price: 0.12, cond: [0, 20], life: [0, 1] },
  ];
  const TIER_PRICE = [0.6, 1, 1.8], TIER_MULT = [0.7, 1, 1.25], TIER_NAME = ['budżetowa', 'solidna', 'pro'], TIER_WEAR = [8, 6, 4];
  const SELLERS = [
    { id: 'sklep', name: 'Tanie-Narzędzia-PL', kind: 'sklep', honesty: 0.95 },
    { id: 'janusz', name: 'Janusz_Okazje_2009', kind: 'prywatny', honesty: 0.5 },
    { id: 'halinka', name: 'Pani_Halinka_88', kind: 'prywatny', honesty: 0.9 },
    { id: 'bogdan', name: 'Bogdan_Auto_Części', kind: 'prywatny', honesty: 0.35 },
    { id: 'seba', name: 'Sebastian_dealer', kind: 'prywatny', honesty: 0.2 },
    { id: 'kasia', name: 'Kasia_sprzątam_piwnicę', kind: 'prywatny', honesty: 0.8 },
    { id: 'niemiec', name: 'Okazje_z_Niemiec', kind: 'prywatny', honesty: 0.45 },
  ];
  const DESC = {
    nowe: ['Nowe, zapakowane, z paragonem.', 'Fabrycznie nowe, gwarancja producenta.'],
    jak_nowe: ['Jak nowe, użyte dwa razy na działce.', 'Stan idealny, zdjęcie z internetu (taka sama).', 'Kupione na prezent, nie pasuje żonie.'],
    uzywane: ['Używane, działa. Chyba.', 'Sprzedaję, bo kupiłem lepsze. Bez zwrotów.', 'Normalne ślady użytkowania, nie wiem do czego.'],
    po_przejsciach: ['Po przejściach, ale jeszcze trzyma. Cena do negocjacji.', 'Wymaga drobnej naprawy (drobnej!).', 'Za grosze, tanie bo działa głośno.'],
    na_czesci: ['Na części, nie sprawdzałem, nie wiem.', 'Uszkodzone, ale podobno da się naprawić.', 'Do remontu. Sprzedam, bo zawadza w piwnicy.'],
  };

  /* Średnia cena nowego narzędzia na tym poziomie (punkt odniesienia dla gracza). */
  const newPrice = (type, tier) => Math.round(TYPES[type].base * TIER_PRICE[tier - 1]);
  const classIndex = id => CLASSES.findIndex(c => c.id === id);
  /* Klasa wynikająca ze stanu technicznego (do wyceny przy sprzedaży). */
  function classForCond(cond, broken) { if (broken || cond < 25) return 'na_czesci'; if (cond >= 90) return 'jak_nowe'; if (cond >= 55) return 'uzywane'; return 'po_przejsciach'; }

  /* Generuje oferty. Deterministyczne dla danego seed. */
  function genListings(seed, count, startId) {
    const rng = lcg(seed), out = [];
    for (let i = 0; i < count; i++) {
      const type = pick(Object.keys(TYPES), rng), tier = rng() < 0.3 ? 1 : rng() < 0.6 ? 2 : 3;
      const seller = pick(SELLERS, rng), h = seller.honesty;
      let real = 0;
      if (seller.kind !== 'sklep') { const r = rng(); real = r < 0.05 ? 0 : r < 0.25 ? 1 : r < 0.65 ? 2 : r < 0.9 ? 3 : 4; }
      let claimed = real;
      if (seller.kind !== 'sklep' && rng() < (1 - h)) claimed = Math.max(0, real - (rng() < 0.5 ? 1 : 2));
      const C = CLASSES[real];
      const cond = between(C.cond[0], C.cond[1], rng), life = between(C.life[0], C.life[1], rng);
      const hidden = seller.kind !== 'sklep' && real >= 2 && rng() < clamp((1 - h) * 0.6 + 0.12, 0, 0.8);
      const fake = seller.kind !== 'sklep' && rng() < (1 - h) * 0.25;
      const lying = claimed !== real; // kłamcy chcą szybko sprzedać, więc lekko schodzą z ceny (słaby sygnał dla czujnego kupca)
      const price = Math.max(10, Math.round(TYPES[type].base * TIER_PRICE[tier - 1] * CLASSES[claimed].price * (lying ? 0.72 + rng() * 0.2 : 0.9 + rng() * 0.25)));
      const stars = Math.round(clamp(3.6 + 1.2 * h + (rng() - 0.5) * 0.5, 1, 5) * 10) / 10;
      out.push({
        id: (startId || 0) + i + 1, type, tier, brand: pick(TYPES[type].brands, rng), seller: { id: seller.id, name: seller.name, kind: seller.kind, stars, reviews: between(8, 900, rng) },
        claimed: CLASSES[claimed].id, price, shipping: seller.kind === 'sklep' ? 15 : between(12, 25, rng), eta: between(1, 3, rng),
        mode: seller.kind !== 'sklep' && rng() < 0.3 ? 'auction' : 'buynow', desc: pick(DESC[CLASSES[claimed].id], rng), asked: false,
        truth: { real: CLASSES[real].id, cond, life, hidden, fake, honesty: h },
      });
    }
    return out;
  }
  function refresh(market, day, force) {
    if (!force && market && market.listings && market.listings.length >= 3 && day - market.day < 3) return market;
    const next = (market && market.nextId) || 0;
    return { day, listings: genListings(day * 7919 + 13, 8, next), nextId: next + 8 };
  }
  function removeListing(market, id) { return Object.assign({}, market, { listings: market.listings.filter(l => l.id !== id) }); }

  /* Pytanie do sprzedawcy. Uczciwy mówi prawdę, nieuczciwy wymija się lub kłamie. */
  function ask(listing, rng) {
    const t = listing.truth, honest = rng() < t.honesty;
    let text;
    if (honest) {
      if (t.hidden) text = 'Szczerze? Czasem się zawiesza i nie wiem czemu.';
      else if (classIndex(t.real) >= 3) text = 'Ma swoje lata i ślady. Działa, ale nie obiecuję cudów.';
      else if (t.fake) text = 'To raczej tańszy zamiennik, nie oryginał.';
      else text = 'Działa dobrze, używałem go bez problemów.';
    } else text = rng() < 0.5 ? 'Wszystko działa, proszę kupować, nie pytać.' : 'Pewnie, że w idealnym stanie. Kto by sprzedawał coś zepsutego?';
    return { text, truthful: honest, listing: Object.assign({}, listing, { asked: true }) };
  }

  function makeOrder(listing, paid) {
    const t = listing.truth;
    return { id: listing.id, listingId: listing.id, type: listing.type, tier: listing.tier, brand: listing.brand, claimed: listing.claimed, sellerName: listing.seller.name, sellerKind: listing.seller.kind,
      sellerHonesty: t.honesty, real: t.real, cond: t.cond, life: t.life, hidden: t.hidden, fake: t.fake, paid, eta: listing.eta, status: 'wysłane' };
  }
  /* Kup teraz: zwraca { ok, order, cost } albo { ok:false, reason }. */
  function buyNow(listing, money) {
    const cost = listing.price + listing.shipping;
    if (listing.mode !== 'buynow') return { ok: false, reason: 'To licytacja.' };
    if (money < cost) return { ok: false, reason: 'Brakuje ' + (cost - money) + ' zł.' };
    return { ok: true, order: makeOrder(listing, cost), cost };
  }
  /* Licytacja: konkurent ma ukryty maksymalny limit. */
  function bid(listing, maxBid, money, rng) {
    if (listing.mode !== 'auction') return { ok: false, reason: 'To nie licytacja.' };
    const comp = listing.price * (0.7 + rng() * 0.5);
    if (maxBid < comp) return { ok: true, won: false, text: 'Ktoś przebił cię w ostatniej sekundzie.' };
    const pay = Math.min(maxBid, Math.round(comp * 1.03) + 1), cost = pay + listing.shipping;
    if (money < cost) return { ok: false, reason: 'Wygrywasz, ale brakuje ' + (cost - money) + ' zł.' };
    return { ok: true, won: true, order: makeOrder(listing, cost), cost, price: pay };
  }

  /* Upływ czasu zamówień (1 zlecenie = 1 tick). Zwraca zamówienia w drodze, dostarczone przedmioty i zdarzenia. */
  function tickOrders(orders, rng) {
    const pending = [], arrived = [], events = [];
    for (const o of orders) {
      const n = Object.assign({}, o, { eta: o.eta - 1 });
      if (n.eta > 0) { pending.push(n); continue; }
      if (rng() < 0.03) { events.push({ type: 'lost', order: n, text: '📦 Paczka z „' + n.brand + '” zaginęła u kuriera. Można odzyskać pieniądze.' }); arrived.push({ lost: true, order: n }); continue; }
      let cond = n.cond; if (rng() < 0.08) { cond = Math.max(0, cond - 20); events.push({ type: 'damaged', order: n, text: '📦 Paczka z „' + n.brand + '” przyszła pognieciona. Kurier „tylko rzucił”.' }); }
      arrived.push({ lost: false, item: toItem(n, cond) });
    }
    return { orders: pending, arrived, events };
  }
  function toItem(o, cond) {
    return { id: o.id, type: o.type, tier: o.tier, brand: o.brand, claimed: o.claimed, cond, life: o.life, hidden: o.hidden, fake: o.fake, paid: o.paid, source: o.sellerKind, sellerName: o.sellerName,
      sellerHonesty: o.sellerHonesty, uses: 0, status: 'sprawny', unboxed: false, protectUses: o.sellerKind === 'sklep' ? 3 : 1 };
  }
  /* Rozpakowanie ujawnia stan widoczny na oko, ale nie ukrytą wadę ani podróbkę. */
  function unbox(item) {
    const cls = classForCond(item.cond, false), claimedIdx = classIndex(item.claimed);
    const diff = classIndex(cls) - claimedIdx;
    const text = diff <= 0 ? 'Wygląda tak, jak w opisie.' : diff === 1 ? 'Trochę gorzej niż w opisie.' : 'Wygląda dużo gorzej, niż obiecywano w ogłoszeniu.';
    return { item: Object.assign({}, item, { unboxed: true }), text: text + ' Stan: ' + Math.round(item.cond) + '%.' };
  }

  const effTier = item => (item.fake ? Math.max(1, item.tier - 1) : item.tier);
  /* Premia narzędzia do zlecenia. */
  function bonus(item) {
    if (item.status !== 'sprawny') return { acc: 0.0, time: 0.0, hazardMult: 1 };
    const T = TYPES[item.type], f = TIER_MULT[effTier(item) - 1] * (0.5 + 0.5 * clamp(item.cond, 0, 100) / 100);
    return { acc: T.acc * f, time: T.time * f, hazardMult: T.hazardMult || 1 };
  }
  /* Najlepsze sprawne narzędzia pasujące do zlecenia (jedno na typ). */
  function forJob(inv, jobId) {
    const best = {};
    for (const it of inv) {
      if (it.status !== 'sprawny' || TYPES[it.type].jobs.indexOf(jobId) < 0) continue;
      const v = bonus(it).acc;
      if (!best[it.type] || v > bonus(best[it.type]).acc) best[it.type] = it;
    }
    return Object.values(best);
  }
  function totalBonus(items) {
    let acc = 0, time = 0, hazardMult = 1;
    for (const it of items) { const b = bonus(it); acc += b.acc; time += b.time; hazardMult *= b.hazardMult; }
    return { acc: Math.min(0.2, acc), time: Math.min(0.15, time), hazardMult };
  }
  /* Szansa awarii podczas zlecenia. */
  function failChance(item) {
    let p = item.hidden && item.uses === 0 ? 0.5 : 0;
    p += item.life <= 2 ? 0.35 : item.life <= 4 ? 0.12 : 0.01;
    if (item.cond < 30) p += 0.1;
    return clamp(p, 0, 0.95);
  }
  function breakItem(item) { return Object.assign({}, item, { status: 'zepsute' }); }
  /* Zużycie po zleceniu. Zwraca nowy przedmiot (może być zepsuty). */
  function wear(item) {
    const n = Object.assign({}, item, { cond: clamp(item.cond - TIER_WEAR[effTier(item) - 1], 0, 100), life: item.life - 1, uses: item.uses + 1 });
    if (n.status === 'sprawny' && (n.cond <= 0 || n.life <= 0)) n.status = 'zepsute';
    return n;
  }

  /* Spór z kupującym: sklep zwykle zwraca, prywatny rzadko. Tylko dla zepsutego przedmiotu w okresie ochrony. */
  function dispute(item, rng) {
    if (item.status !== 'zepsute') return { ok: false, reason: 'Przedmiot działa, więc spór byłby bezpodstawny.' };
    if (item.uses > item.protectUses) return { ok: false, reason: 'Ochrona kupującego już minęła.' };
    const shop = item.source === 'sklep', chance = shop ? 0.85 : clamp(0.15 + 0.5 * item.sellerHonesty, 0, 0.7);
    if (rng() < chance) { const refund = Math.round(item.paid * (shop ? 0.85 : 0.6)); return { ok: true, success: true, refund, text: item.sellerName + ' przyznaje rację i oddaje ' + refund + ' zł.' }; }
    return { ok: true, success: false, refund: 0, text: item.sellerName + ' odrzuca reklamację: „Kupujesz na własne ryzyko.”' };
  }
  function refundLost(order) { return { ok: true, refund: Math.round(order.paid * 0.9) }; }

  /* Wycena przedmiotu (wartość rynkowa, także dla łupu przy kradzieży). */
  function value(item) {
    const cls = classForCond(item.cond, item.status !== 'sprawny');
    return Math.round(TYPES[item.type].base * TIER_PRICE[item.tier - 1] * CLASSES[classIndex(cls)].price);
  }
  const inventoryValue = inv => inv.reduce((s, i) => s + value(i), 0);

  /* Sprzedaż: uczciwy opis albo kłamstwo. Skargi kupca po kłamstwie kosztują zwrot i plotki. */
  function sell(item, mode, rng) {
    const base = value(item), defective = item.status !== 'sprawny' || item.hidden || item.cond < 55;
    if (mode === 'honest') return { price: Math.round(base * 0.85), complaint: false, gossip: 0, text: 'Sprzedane zgodnie z opisem. Kupiec zadowolony.' };
    const price = Math.round(base * 1.25);
    if (defective && rng() < 0.6) return { price: Math.round(price * 0.3), complaint: true, gossip: -8, text: 'Kupiec wrócił z awanturą i odzyskał większość pieniędzy. Na osiedlu już wiedzą.' };
    return { price, complaint: false, gossip: 0, text: 'Kupiec nie zauważył. Tym razem.' };
  }

  /* Jedyny system narzędzi w grze: ekwipunek składa się wyłącznie z takich przedmiotów. */
  let _seq = 100000;
  function makeItem(o) {
    const base = { id: ++_seq, type: 'zestaw', tier: 2, brand: 'Walizka majstra', claimed: 'uzywane', cond: 80, life: 25, hidden: false, fake: false, paid: 0, source: 'start',
      sellerName: 'własne', sellerHonesty: 1, uses: 0, status: 'sprawny', unboxed: true, protectUses: 0 };
    return Object.assign(base, o);
  }
  /* Tani zestaw startowy dla każdego: słaby i zużyty, ale pasuje do wszystkich zleceń. Szybko się zużywa, więc zachęca do zakupów. */
  function starterKit() {
    return makeItem({ type: 'zestaw', tier: 1, brand: 'Zestaw z supermarketu', claimed: 'uzywane', cond: 55, life: 12, source: 'start', sellerName: 'supermarket' });
  }
  /* Pokrycie zleceń: łączna premia narzędzi dla każdego rodzaju zlecenia. */
  function coverage(inv) {
    const out = {}; ALL_JOBS.forEach(j => { out[j] = totalBonus(forJob(inv, j)); }); return out;
  }
  /* Jakość ekwipunku 0–1 (średnia z czterech zleceń, 0,2 = maksymalna premia). Wchodzi do oceny firmy. */
  function toolScore(inv) {
    const c = coverage(inv); return clamp(ALL_JOBS.reduce((s, j) => s + c[j].acc / 0.2, 0) / ALL_JOBS.length, 0, 1);
  }

  /* Serwis: sprawne narzędzie wraca do 100% stanu, zepsute da się naprawić z 60% szansą (usuwa też ukrytą wadę). */
  function repairCost(item) {
    const T = TYPES[item.type];
    if (item.status !== 'sprawny') return Math.max(30, Math.round(T.base * TIER_PRICE[item.tier - 1] * 0.5));
    return Math.round((100 - item.cond) * (0.4 + 0.3 * item.tier));
  }
  function repair(item, money, rng) {
    const broken = item.status !== 'sprawny';
    if (!broken && item.cond >= 100) return { ok: false, reason: 'Narzędzie jest w pełni sprawne.' };
    const cost = repairCost(item);
    if (money < cost) return { ok: false, reason: 'Brakuje ' + (cost - money) + ' zł.' };
    if (!broken) return { ok: true, success: true, cost, item: Object.assign({}, item, { cond: 100 }), text: 'Serwis: ' + item.brand + ' wrócił do pełnego stanu.' };
    if (rng() < 0.6) return { ok: true, success: true, cost, item: Object.assign({}, item, { status: 'sprawny', cond: Math.max(item.cond, 70), life: item.life + 3, hidden: false }), text: 'Udało się naprawić „' + item.brand + '”. Ukryta wada też zniknęła.' };
    return { ok: true, success: false, cost, item, text: 'Serwisant rozłożył ręce: „' + item.brand + '” nie nadaje się do naprawy. Pieniądze przepadły.' };
  }

  return { ALL_JOBS, makeItem, starterKit, coverage, toolScore, repairCost, repair, TYPES, CLASSES, TIER_NAME, TIER_PRICE, SELLERS, newPrice, classForCond, genListings, refresh, removeListing, ask, buyNow, bid, tickOrders, unbox, bonus, forJob, totalBonus, failChance, breakItem, wear, dispute, refundLost, value, inventoryValue, sell };
});
