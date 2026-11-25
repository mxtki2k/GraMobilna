// Testy Alledrogo i jego spięć z resztą. Uruchomienie: node tests/alledrogo.test.js
const assert = require('assert');
const A = require('../prototypes/janusz/alledrogo.js');
const F = require('../prototypes/janusz/fuszerka.js');
const H = require('../prototypes/janusz/siedziba.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const seq = r => { let i = 0; return () => r[i++ % r.length]; };
function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const item = o => Object.assign({ id: 1, type: 'wiertarka', tier: 2, brand: 'Ryś Pro', claimed: 'uzywane', cond: 80, life: 10, hidden: false, fake: false, paid: 100, source: 'prywatny', sellerName: 'Janusz_Okazje_2009', sellerHonesty: 0.5, uses: 0, status: 'sprawny', unboxed: true, protectUses: 1 }, o);

t('dane: typy narzędzi pasują do istniejących zleceń, klasy mają malejące ceny', () => {
  const { JOBS: J } = require('../prototypes/janusz/jobs.js');
  for (const ty of Object.values(A.TYPES)) { assert(ty.jobs.every(j => J[j]), ty.id); assert(ty.base > 0 && ty.acc > 0 && ty.brands.length >= 3); }
  for (let i = 1; i < A.CLASSES.length; i++) assert(A.CLASSES[i].price < A.CLASSES[i - 1].price);
  assert(A.newPrice('wiertarka', 3) > A.newPrice('wiertarka', 1));
});

t('oferty: deterministyczne, kilka klas i sprzedawców, ceny zależne od deklarowanej klasy', () => {
  const a = A.genListings(42, 12), b = A.genListings(42, 12), c = A.genListings(43, 12);
  assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a, c);
  assert(new Set(a.map(l => l.claimed)).size >= 2 && new Set(a.map(l => l.seller.id)).size >= 3);
  for (const l of a) {
    const ref = A.newPrice(l.type, l.tier), ci = A.CLASSES.findIndex(x => x.id === l.claimed);
    assert(l.price <= ref * 1.2 && l.price >= ref * A.CLASSES[ci].price * 0.7 - 1, l.price + ' vs ' + ref);
    assert(l.price > 0 && l.seller.stars >= 1 && l.seller.stars <= 5);
  }
});

t('sklep sprzedaje tylko nowe, bez ukrytych wad; prywatni nieuczciwi zawyżają klasę częściej', () => {
  const all = []; for (let s = 1; s <= 120; s++) all.push(...A.genListings(s, 8));
  for (const l of all.filter(x => x.seller.kind === 'sklep')) assert(l.claimed === 'nowe' && l.truth.real === 'nowe' && !l.truth.hidden && !l.truth.fake);
  const lies = h => { const ls = all.filter(x => x.seller.kind !== 'sklep' && (h(x.truth.honesty))); return ls.filter(x => x.claimed !== x.truth.real).length / ls.length; };
  assert(lies(h => h <= 0.35) > lies(h => h >= 0.8) + 0.2, lies(h => h <= 0.35) + ' vs ' + lies(h => h >= 0.8));
});

t('oferty kłamią: deklarowana klasa bywa lepsza niż prawdziwa, a ocena sprzedawcy prawie tego nie zdradza', () => {
  const all = []; for (let s = 1; s <= 80; s++) all.push(...A.genListings(s, 8));
  const liars = all.filter(l => l.seller.kind !== 'sklep' && l.truth.honesty <= 0.35), honest = all.filter(l => l.seller.kind !== 'sklep' && l.truth.honesty >= 0.8);
  const avg = a => a.reduce((s, l) => s + l.seller.stars, 0) / a.length;
  assert(avg(honest) - avg(liars) < 1.0, 'różnica ocen ' + (avg(honest) - avg(liars)));
  assert(liars.some(l => A.CLASSES.findIndex(c => c.id === l.claimed) < A.CLASSES.findIndex(c => c.id === l.truth.real)));
});

t('sygnał ceny: oferty kłamców są średnio tańsze względem deklarowanej klasy niż uczciwe', () => {
  const all = []; for (let s = 1; s <= 100; s++) all.push(...A.genListings(s, 8));
  const ratio = l => l.price / (A.newPrice(l.type, l.tier) * A.CLASSES.find(c => c.id === l.claimed).price);
  const liars = all.filter(l => l.claimed !== l.truth.real), honest = all.filter(l => l.seller.kind !== 'sklep' && l.claimed === l.truth.real);
  const avg = a => a.reduce((s, l) => s + ratio(l), 0) / a.length;
  assert(liars.length > 20 && avg(liars) < avg(honest) - 0.1, avg(liars) + ' vs ' + avg(honest));
});

t('pytanie do sprzedawcy: uczciwy ujawnia wadę, nieuczciwy się wymiga', () => {
  const bad = { truth: { real: 'po_przejsciach', hidden: true, fake: false, honesty: 0.9 }, asked: false };
  const h = A.ask(bad, seq([0.0])); assert(h.truthful && /zawiesza/.test(h.text) && h.listing.asked);
  const liar = A.ask(Object.assign({}, bad, { truth: Object.assign({}, bad.truth, { honesty: 0.1 }) }), seq([0.99, 0.0]));
  assert(!liar.truthful && /działa|idealnym/.test(liar.text));
});

t('kup teraz: koszt z wysyłką, brak środków, nie dla licytacji', () => {
  const l = A.genListings(7, 20).find(x => x.mode === 'buynow'), au = A.genListings(7, 20).find(x => x.mode === 'auction');
  assert.strictEqual(A.buyNow(l, 1).ok, false);
  const r = A.buyNow(l, 1e6); assert(r.ok && r.cost === l.price + l.shipping && r.order.cond === l.truth.cond);
  if (au) assert.strictEqual(A.buyNow(au, 1e6).ok, false);
});

t('licytacja: wygrywasz powyżej limitu konkurenta, płacisz mniej niż maksimum, przegrywasz poniżej', () => {
  const au = A.genListings(7, 40).find(x => x.mode === 'auction'); assert(au);
  const lost = A.bid(au, 1, 1e6, seq([0.5])); assert(lost.ok && !lost.won);
  const won = A.bid(au, au.price * 2, 1e6, seq([0.5])); assert(won.won && won.price <= au.price * 2 && won.cost === won.price + au.shipping);
  assert.strictEqual(A.bid(au, au.price * 2, 1, seq([0.5])).ok, false);
});

t('dostawa: zamówienie wędruje kilka zleceń, paczka może zginąć lub się uszkodzić', () => {
  const l = A.genListings(9, 20).find(x => x.mode === 'buynow' && x.eta === 2) || Object.assign(A.genListings(9, 20).find(x => x.mode === 'buynow'), { eta: 2 });
  let o = [A.buyNow(l, 1e6).order];
  let r = A.tickOrders(o, seq([0.5])); assert(r.orders.length === 1 && r.arrived.length === 0);
  r = A.tickOrders(r.orders, seq([0.5])); assert(r.arrived.length === 1 && !r.arrived[0].lost && r.arrived[0].item.status === 'sprawny' && r.arrived[0].item.unboxed === false);
  const lost = A.tickOrders([Object.assign({}, o[0], { eta: 1 })], seq([0.0])); assert(lost.arrived[0].lost && lost.events[0].type === 'lost');
  const dmg = A.tickOrders([Object.assign({}, o[0], { eta: 1, cond: 80 })], seq([0.9, 0.0])); assert(dmg.arrived[0].item.cond === 60);
});

t('rozpakowanie ujawnia widoczny stan, ale nie ukrytą wadę ani podróbkę', () => {
  const it = item({ cond: 30, claimed: 'jak_nowe', hidden: true, fake: true, unboxed: false });
  const u = A.unbox(it); assert(u.item.unboxed && /gorzej|dużo gorzej/.test(u.text) && /30%/.test(u.text)); assert(!/wad|podróbk/i.test(u.text));
  assert(/tak, jak w opisie/i.test(A.unbox(item({ cond: 95, claimed: 'uzywane' })).text));
});

t('premia narzędzia: rośnie z poziomem, maleje ze stanem, podróbka obniża poziom, zepsute nie daje nic', () => {
  const good = A.bonus(item({ tier: 3, cond: 100 })), mid = A.bonus(item({ tier: 3, cond: 40 })), fake = A.bonus(item({ tier: 3, cond: 100, fake: true })), low = A.bonus(item({ tier: 1, cond: 100 }));
  assert(good.acc > mid.acc && good.acc > fake.acc && good.acc > low.acc);
  const dead = A.bonus(item({ status: 'zepsute' })); assert(dead.acc === 0 && dead.time === 0);
  assert(A.bonus(item({ type: 'probnik' })).hazardMult < 1 && A.bonus(item({ type: 'wiertarka' })).hazardMult === 1);
});

t('zużycie: stan i żywotność maleją, narzędzie w końcu pada', () => {
  let it = item({ tier: 1, cond: 20, life: 2 });
  it = A.wear(it); assert(it.uses === 1 && it.cond === 12 && it.life === 1 && it.status === 'sprawny');
  it = A.wear(it); assert(it.status === 'zepsute');
  const tough = A.wear(item({ tier: 3, cond: 100, life: 40 })); assert(tough.cond === 96 && tough.status === 'sprawny');
});

t('awarie: ukryta wada psuje w pierwszym użyciu, krótka żywotność zwiększa szansę', () => {
  const clean = item({ life: 20, cond: 90 }), flawed = item({ life: 20, cond: 90, hidden: true }), old = item({ life: 2, cond: 90 }), worn = item({ life: 20, cond: 20 });
  assert(A.failChance(flawed) > 0.4 && A.failChance(clean) < 0.05 && A.failChance(old) > 0.3 && A.failChance(worn) > A.failChance(clean));
  assert(A.failChance(item({ hidden: true, uses: 3, life: 20 })) < 0.05);
  assert.strictEqual(A.breakItem(clean).status, 'zepsute');
});

t('dobór narzędzi do zlecenia: tylko pasujące, jedno najlepsze na typ, bez zepsutych', () => {
  const inv = [item({ id: 1, type: 'wiertarka', tier: 1 }), item({ id: 2, type: 'wiertarka', tier: 3 }), item({ id: 3, type: 'probnik' }), item({ id: 4, type: 'szlifierka', status: 'zepsute' })];
  const polka = A.forJob(inv, 'polka'); assert(polka.length === 1 && polka[0].id === 2);
  assert.strictEqual(A.forJob(inv, 'gniazdko').length, 1);
  assert.strictEqual(A.forJob(inv, 'sciana').length, 1); // wiertarka pasuje do ściany, szlifierka zepsuta
  const tb = A.totalBonus(A.forJob([item({ type: 'wiertarka', tier: 3 }), item({ id: 2, type: 'szlifierka', tier: 3 }), item({ id: 3, type: 'szpachle', tier: 3 })], 'sciana'));
  assert(tb.acc <= 0.2 && tb.time <= 0.15 && tb.acc > 0.1);
});

t('spór: sklep zwraca prawie zawsze, prywatny rzadko, tylko dla zepsutego w okresie ochrony', () => {
  const shop = item({ status: 'zepsute', source: 'sklep', protectUses: 3, paid: 200, sellerHonesty: 0.95 }), priv = item({ status: 'zepsute', source: 'prywatny', paid: 200, sellerHonesty: 0.2 });
  assert(A.dispute(shop, seq([0.5])).success && A.dispute(shop, seq([0.5])).refund === 170);
  assert(!A.dispute(priv, seq([0.5])).success && A.dispute(priv, seq([0.0])).success);
  assert(A.dispute(priv, seq([0.0])).refund === 120);
  assert.strictEqual(A.dispute(item(), seq([0])).ok, false);
  assert.strictEqual(A.dispute(item({ status: 'zepsute', uses: 5, protectUses: 1 }), seq([0])).ok, false);
  assert.strictEqual(A.refundLost({ paid: 100 }).refund, 90);
});

t('sprzedaż: uczciwie mniej, kłamstwo więcej, ale wadliwy towar daje skargę i plotki', () => {
  const bad = item({ status: 'zepsute', cond: 30 }), good = item({ cond: 95 });
  const h = A.sell(bad, 'honest', seq([0.5])), l = A.sell(bad, 'lie', seq([0.0])), lok = A.sell(good, 'lie', seq([0.0]));
  assert(!h.complaint && l.complaint && l.gossip < 0 && l.price < h.price * 1.5);
  assert(!lok.complaint && lok.price > A.sell(good, 'honest', seq([0.5])).price);
  assert(!A.sell(bad, 'lie', seq([0.99])).complaint);
});

t('wartość ekwipunku zależy od stanu i poziomu; spięcie z kradzieżą: droższy sprzęt = większa szansa', () => {
  const inv = [item({ tier: 3, cond: 100 }), item({ id: 2, tier: 1, cond: 30 })];
  assert(A.value(inv[0]) > A.value(inv[1]) && A.inventoryValue(inv) === A.value(inv[0]) + A.value(inv[1]));
  const hq = H.fresh();
  assert(H.theftChance(hq, A.inventoryValue(inv)) > H.theftChance(hq, 0));
  const r = H.resolveTheft(hq, seq([0, 0.5, 0.9, 0.0]), 800); assert(r && r.itemStolen === true);
  assert.strictEqual(H.resolveTheft(hq, seq([0, 0.5, 0.9, 0.9]), 800).itemStolen, false);
  assert.strictEqual(H.resolveTheft(hq, seq([0, 0.5, 0.9]), 0).itemStolen, false);
});

t('spięcie z oceną fuszerki: miernik napięcia zmniejsza zagrożenie wad (gniazdko)', () => {
  const job = JOBS.gniazdko, p = job.steps.map(s => ({ stepId: s.id, optionId: 'fusz', accuracy: 0.6 }));
  const a = F.evaluate(job, p, CLIENTS.mirek), b = F.evaluate(job, p, CLIENTS.mirek, { hazardMult: 0.6 });
  assert(b.Z < a.Z && b.index < a.index && b.claim.chance < a.claim.chance);
});

t('rynek: odświeża się co 3 dni, zachowuje numerację, zakup usuwa ofertę', () => {
  let m = A.refresh(null, 1); assert(m.listings.length === 8 && m.day === 1);
  const same = A.refresh(m, 3); assert(same === m);
  const fresh = A.refresh(m, 4); assert(fresh.day === 4 && fresh.listings[0].id > m.listings[7].id);
  const gone = A.removeListing(m, m.listings[0].id); assert(gone.listings.length === 7 && m.listings.length === 8);
  assert.strictEqual(A.refresh(A.removeListing(A.removeListing(A.removeListing(A.removeListing(A.removeListing(A.removeListing(m, m.listings[0].id), m.listings[1].id), m.listings[2].id), m.listings[3].id), m.listings[4].id), m.listings[5].id), 2).day, 2);
});

t('opłacalność: używane po przejściach bywają okazją albo pułapką, statystycznie krócej żyją niż nowe', () => {
  const r = lcg(5); let usedLife = 0, newLife = 0, nu = 0, nn = 0;
  for (let s = 1; s <= 100; s++) for (const l of A.genListings(s, 8)) { if (l.truth.real === 'nowe') { newLife += l.truth.life; nn++; } else if (l.truth.real === 'po_przejsciach') { usedLife += l.truth.life; nu++; } }
  assert(newLife / nn > 3 * (usedLife / nu));
});

t('jeden system narzędzi: zestaw ręczny pasuje do wszystkich zleceń, makeItem tworzy sprawny przedmiot', () => {
  assert.deepStrictEqual(A.TYPES.zestaw.jobs, ['kran', 'sciana', 'gniazdko', 'polka']);
  const it = A.makeItem({ brand: 'Walizka dziadka', tier: 2, cond: 65 });
  assert(it.status === 'sprawny' && it.unboxed && it.uses === 0 && it.cond === 65 && it.id > 100000);
  assert(A.makeItem({}).id !== A.makeItem({}).id);
  for (const j of ['kran', 'sciana', 'gniazdko', 'polka']) assert.strictEqual(A.forJob([it], j).length, 1, j);
});

t('pokrycie i jakość ekwipunku: więcej i lepsze narzędzia dają wyższy wynik, zepsute nie liczą się', () => {
  assert.strictEqual(A.toolScore([]), 0);
  const one = [A.makeItem({ tier: 1, cond: 60 })], pro = [A.makeItem({ tier: 3, cond: 100 })], more = pro.concat([A.makeItem({ type: 'wiertarka', tier: 3, cond: 100 }), A.makeItem({ type: 'poziomica', tier: 3, cond: 100 })]);
  assert(A.toolScore(pro) > A.toolScore(one) && A.toolScore(more) > A.toolScore(pro) && A.toolScore(more) <= 1);
  assert.strictEqual(A.toolScore([A.makeItem({ status: 'zepsute' })]), 0);
  const c = A.coverage(more); assert(c.polka.acc > c.kran.acc && c.sciana.acc > c.kran.acc && c.kran.acc > 0);
});

t('serwis: sprawne wraca do 100%, zepsute naprawia się z 60% szansą i traci ukrytą wadę, brak pieniędzy blokuje', () => {
  const worn = A.makeItem({ cond: 40, tier: 2 });
  const r = A.repair(worn, 1000, seq([0.5])); assert(r.ok && r.success && r.item.cond === 100 && r.cost === Math.round(60 * 1.0));
  assert.strictEqual(A.repair(worn, 5, seq([0.5])).ok, false); assert.strictEqual(A.repair(A.makeItem({ cond: 100 }), 1000, seq([0.5])).ok, false);
  const dead = A.makeItem({ status: 'zepsute', hidden: true, cond: 20, life: 0 });
  const fix = A.repair(dead, 1000, seq([0.1])); assert(fix.success && fix.item.status === 'sprawny' && !fix.item.hidden && fix.item.cond >= 70 && fix.item.life >= 3);
  const fail = A.repair(dead, 1000, seq([0.9])); assert(fail.ok && !fail.success && fail.item.status === 'zepsute' && fail.cost > 0);
  assert(A.repairCost(dead) > A.repairCost(A.makeItem({ cond: 90 })));
});

console.log('\n' + n + ' testów przeszło');
