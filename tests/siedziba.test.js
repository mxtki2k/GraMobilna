// Testy modułu siedziby i jego spięcia z resztą. Uruchomienie: node tests/siedziba.test.js
const assert = require('assert');
const H = require('../prototypes/janusz/siedziba.js');
const F = require('../prototypes/janusz/fuszerka.js');
const E = require('../prototypes/janusz/ekipa.js');
const S = require('../prototypes/janusz/swiat.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const maxed = tier => { const h = H.fresh(); h.tier = tier; Object.keys(h.up).forEach(k => h.up[k] = 3); Object.keys(h.assets).forEach(k => h.assets[k] = 3); return h; };

t('dane: lokale rosną w koszcie, utrzymaniu i bazie zaufania, remonty mają 3 poziomy', () => {
  for (let i = 1; i < H.TIERS.length; i++) assert(H.TIERS[i].cost > H.TIERS[i - 1].cost && H.TIERS[i].upkeep >= H.TIERS[i - 1].upkeep);
  for (const g of [H.UPGRADES, H.ASSETS]) for (const k of Object.keys(g)) {
    assert.strictEqual(g[k].levels.length, 3, k);
    for (let i = 1; i < 3; i++) assert(g[k].levels[i].cost > g[k].levels[i - 1].cost, k);
  }
});

t('start: garaż, brak ulepszeń, ocena firmy lekko poniżej średniej i mnożnik < 1', () => {
  const r = H.rating(H.fresh(), [], [], 0);
  assert(r.stars >= 1.5 && r.stars <= 2.5, 'ocena ' + r.stars);
  assert(r.payMult < 1 && r.payMult >= 0.85);
});

t('zakupy: kolejność poziomów, brak środków, nie zmienia wejścia', () => {
  const h = H.fresh();
  assert.strictEqual(H.buy(h, 'up', 'okna', 100).ok, false);
  const r = H.buy(h, 'up', 'okna', 300);
  assert(r.ok && r.hq.up.okna === 1 && h.up.okna === 0 && r.cost === 250);
  const r3 = H.buy(maxed(0), 'up', 'okna', 1e9);
  assert.strictEqual(r3.ok, false);
});

t('przeprowadzka: nowy lokal zeruje remonty budynku, ale narzędzia i bus zostają', () => {
  const h = maxed(0);
  const r = H.buyTier(h, 5000);
  assert(r.ok && r.hq.tier === 1);
  assert(Object.values(r.hq.up).every(v => v === 0));
  assert(r.hq.assets.bus === 3 && r.hq.assets.narzedzia === undefined);
  assert.strictEqual(H.buyTier(h, 100).ok, false);
  assert.strictEqual(H.buyTier(maxed(5), 1e9).ok, false);
});

t('lepsza siedziba i remonty podnoszą ocenę firmy (monotonicznie)', () => {
  let prev = 0;
  for (let tier = 0; tier <= 5; tier++) {
    const s = H.rating(maxed(tier), [], [], 0).stars;
    assert(s > prev, 'tier ' + tier + ' ' + s + ' <= ' + prev);
    prev = s;
  }
  const base = H.fresh(), up = H.buy(base, 'up', 'szyld', 1e9).hq;
  assert(H.rating(up, [], [], 0).stars > H.rating(base, [], [], 0).stars);
});

t('rzetelność: fuszerka obniża ocenę, a otwarte reklamacje jeszcze bardziej', () => {
  const h = maxed(3);
  const good = H.rating(h, [{ index: 5 }, { index: 8 }], [5, 5], 0).stars;
  const bad = H.rating(h, [{ index: 80 }, { index: 90 }], [5, 5], 0).stars;
  const claims = H.rating(h, [{ index: 80 }, { index: 90 }], [5, 5], 3).stars;
  assert(good > bad && bad > claims, [good, bad, claims].join(' '));
});

t('opinie klientów też liczą się do oceny', () => {
  const h = maxed(2);
  assert(H.rating(h, [], [5, 5, 5], 0).stars > H.rating(h, [], [1, 2, 1], 0).stars);
});

t('skutki: mnożnik wypłaty i bonus zadowolenia rosną z oceną, mają widełki', () => {
  const lo = H.rating(H.fresh(), [{ index: 90 }], [1], 5), hi = H.rating(maxed(5), [{ index: 0 }], [5], 0);
  assert(lo.payMult >= 0.85 && hi.payMult <= 1.25 * 1.12 && hi.payMult > lo.payMult);
  assert(hi.satBonus > lo.satBonus && hi.satBonus <= 8 && lo.satBonus >= 0);
});

t('wypłata za zlecenie rośnie, gdy ocena firmy rośnie (spięcie z modułem fuszerki)', () => {
  const job = JOBS.kran, p = job.steps.map(s => ({ stepId: s.id, optionId: 'dobrze', accuracy: 1 }));
  const lo = H.rating(H.fresh(), [], [], 0), hi = H.rating(maxed(4), [], [], 0);
  const a = F.evaluate(job, p, CLIENTS.grazyna, { payMult: lo.payMult, satBonus: lo.satBonus });
  const b = F.evaluate(job, p, CLIENTS.grazyna, { payMult: hi.payMult, satBonus: hi.satBonus });
  assert(b.payout > a.payout);
  // bonus zadowolenia pomaga klientowi z wadami
  const q = job.steps.map(s => ({ stepId: s.id, optionId: 'skrot', accuracy: 0.6 }));
  assert(F.evaluate(job, q, CLIENTS.grazyna, { satBonus: 8 }).satisfaction > F.evaluate(job, q, CLIENTS.grazyna, { satBonus: 0 }).satisfaction);
});

t('narzędzia nie są już w siedzibie: efekty bez bonusu czasu i celności, komfort podnosi nastrój ekipy', () => {
  assert.strictEqual(H.ASSETS.narzedzia, undefined);
  const e0 = H.effects(H.fresh()), e3 = H.effects(maxed(3));
  assert(e0.timeBonus === undefined && e0.accBonus === undefined && e3.comfort > e0.comfort);
  const w = Object.assign(E.newWorker(E.CANDIDATES[1]), { mood: 70 }), pay = { [w.id]: w.wage };
  const plain = E.applyPay([w], pay).workers[0].mood, cosy = E.applyPay([w], pay, { patienceBonus: e3.comfort * 0.5 }).workers[0].mood;
  assert(cosy > plain);
});

t('ocena firmy: sprzęt to bus plus jakość narzędzi z ekwipunku', () => {
  const h = H.fresh();
  const none = H.rating(h, [], [], 0, 0), tools = H.rating(h, [], [], 0, 1);
  assert(tools.parts.sprzet > none.parts.sprzet && tools.stars > none.stars);
  const van = H.buy(h, 'assets', 'bus', 1e9).hq;
  assert(H.rating(van, [], [], 0, 0).parts.sprzet > none.parts.sprzet);
  assert(H.rating(van, [], [], 0, 1).parts.sprzet <= 1);
});

t('ochrona: alarm, kamery i ochrona fizyczna zmniejszają szansę kradzieży (łup z busa i ekwipunku)', () => {
  const rich = (() => { const h = H.fresh(); h.assets.bus = 3; return h; })(), loot = 2000;
  const none = H.theftChance(rich, loot);
  const alarm = H.buy(H.buy(rich, 'up', 'alarm', 1e9).hq, 'up', 'alarm', 1e9).hq;
  const cams = H.buy(rich, 'up', 'kamery', 1e9).hq, guard = H.buy(rich, 'up', 'ochrona', 1e9).hq;
  assert(H.theftChance(alarm, loot) < none && H.theftChance(cams, loot) < none && H.theftChance(guard, loot) < none);
  assert(H.theftChance(maxed(5), loot) < H.theftChance(alarm, loot) && H.effects(maxed(5)).security <= 95);
});

t('im większy łup (bus i ekwipunek), tym większa atrakcyjność i szansa kradzieży przy tych samych zabezpieczeniach', () => {
  const poor = H.fresh(), rich = H.fresh(); rich.assets.bus = 3;
  assert(H.attractiveness(rich) > H.attractiveness(poor) && H.theftChance(rich) > H.theftChance(poor));
  assert(H.theftChance(poor, 3000) > H.theftChance(poor, 0) && H.theftChance(poor, 300) < H.theftChance(poor, 3000));
  assert(H.lootValue(rich) > H.lootValue(poor));
});

t('przebieg kradzieży: strata rośnie z wartością łupu, kamery odzyskują część, może zniknąć przedmiot z ekwipunku', () => {
  const rich = H.fresh(); rich.assets.bus = 3;
  const seq = r => { let i = 0; return () => r[i++ % r.length]; };
  const a = H.resolveTheft(rich, seq([0, 0.5, 0.5, 0.5]), 1500);
  assert(a && a.loss > 200 && a.recovered === 0 && a.toolLost === undefined);
  const cams = H.buy(H.buy(rich, 'up', 'kamery', 1e9).hq, 'up', 'kamery', 1e9).hq;
  const b = H.resolveTheft(cams, seq([0, 0.5, 0.5, 0.5]), 1500);
  assert(b && b.recovered > 0 && b.net < b.loss);
  assert(H.resolveTheft(rich, seq([0, 0.5, 0.9, 0.0]), 1500).itemStolen === true);
  assert.strictEqual(H.resolveTheft(rich, seq([0, 0.5, 0.9, 0.0]), 0).itemStolen, false);
  assert.strictEqual(H.resolveTheft(rich, seq([0.999]), 1500), null);
});

t('bus: mniej wypadków i tańsze naprawy; utrzymanie rośnie', () => {
  const w = E.newWorker(E.CANDIDATES[2]);
  const base = S.driveRisk(w, 'pijany', { heat: 0.25 }, 'worker').accident;
  const van = S.driveRisk(w, 'pijany', { heat: 0.25, accMult: H.effects(maxed(0)).accMult }, 'worker').accident;
  assert(van < base);
  assert(H.effects(maxed(5)).upkeep > H.effects(H.fresh()).upkeep);
});

t('opłacalność: najtańszy remont daje wyraźny zysk w ocenie na złotówkę (szyld vs ogrzewanie)', () => {
  const base = H.fresh();
  const sz = H.rating(H.buy(base, 'up', 'szyld', 1e9).hq, [], [], 0).stars - H.rating(base, [], [], 0).stars;
  const og = H.rating(H.buy(base, 'up', 'ogrz', 1e9).hq, [], [], 0).stars - H.rating(base, [], [], 0).stars;
  assert(sz > og, 'szyld ' + sz + ' ogrzewanie ' + og);
});

console.log('\n' + n + ' testów przeszło');
