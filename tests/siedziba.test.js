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
  assert(r.hq.assets.narzedzia === 3 && r.hq.assets.bus === 3);
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

t('narzędzia: szybciej i celniej; komfort podnosi nastrój ekipy po wypłacie', () => {
  const e0 = H.effects(H.fresh()), e3 = H.effects(maxed(3));
  assert(e3.timeBonus > e0.timeBonus && e3.accBonus > e0.accBonus && e3.comfort > e0.comfort);
  const w = Object.assign(E.newWorker(E.CANDIDATES[1]), { mood: 70 });
  const pay = { [w.id]: w.wage };
  const plain = E.applyPay([w], pay).workers[0].mood, cosy = E.applyPay([w], pay, { patienceBonus: e3.comfort * 0.5 }).workers[0].mood;
  assert(cosy > plain);
});

t('bus: mniej wypadków i tańsze naprawy; utrzymanie rośnie', () => {
  const w = E.newWorker(E.CANDIDATES[2]);
  const base = S.driveRisk(w, 'pijany', { heat: 0.25 }, 'worker').accident;
  const van = S.driveRisk(w, 'pijany', { heat: 0.25, accMult: H.effects(maxed(0)).accMult }, 'worker').accident;
  assert(van < base);
  assert(H.effects(maxed(5)).upkeep > H.effects(H.fresh()).upkeep);
});

t('ochrona: alarm, kamery i ochrona fizyczna zmniejszają szansę kradzieży', () => {
  const rich = (() => { const h = H.fresh(); h.assets.narzedzia = 3; h.assets.bus = 3; return h; })();
  const none = H.theftChance(rich);
  const alarm = H.buy(H.buy(rich, 'up', 'alarm', 1e9).hq, 'up', 'alarm', 1e9).hq;
  const cams = H.buy(rich, 'up', 'kamery', 1e9).hq, guard = H.buy(rich, 'up', 'ochrona', 1e9).hq;
  assert(H.theftChance(alarm) < none && H.theftChance(cams) < none && H.theftChance(guard) < none);
  assert(H.theftChance(maxed(5)) < H.theftChance(alarm) && H.effects(maxed(5)).security <= 95);
});

t('im lepszy sprzęt, tym większa atrakcyjność i szansa kradzieży przy tych samych zabezpieczeniach', () => {
  const poor = H.fresh(), rich = H.fresh(); rich.assets.narzedzia = 3; rich.assets.bus = 3;
  assert(H.attractiveness(rich) > H.attractiveness(poor) && H.theftChance(rich) > H.theftChance(poor));
  assert(H.lootValue(rich) > H.lootValue(poor));
  const mid = H.fresh(); mid.assets.narzedzia = 1;
  assert(H.theftChance(poor) < H.theftChance(mid) && H.theftChance(mid) < H.theftChance(rich));
});

t('przebieg kradzieży: strata rośnie z wartością łupu, kamery odzyskują część, możliwa utrata narzędzi', () => {
  const rich = H.fresh(); rich.assets.narzedzia = 3; rich.assets.bus = 3;
  const seq = r => { let i = 0; return () => r[i++ % r.length]; };
  const a = H.resolveTheft(rich, seq([0, 0.5, 0.5, 0.5]));
  assert(a && a.loss > 200 && a.recovered === 0);
  const cams = H.buy(H.buy(rich, 'up', 'kamery', 1e9).hq, 'up', 'kamery', 1e9).hq;
  const b = H.resolveTheft(cams, seq([0, 0.5, 0.5, 0.5]));
  assert(b && b.recovered > 0 && b.net < b.loss);
  const c = H.resolveTheft(rich, seq([0, 0.5, 0.0, 0.0]));
  assert(c.toolLost && c.hq.assets.narzedzia === 2 && rich.assets.narzedzia === 3);
  assert.strictEqual(H.resolveTheft(rich, seq([0.999])), null);
});

t('zużycie narzędzi: bonus maleje wraz ze stanem, serwis przywraca, połamane narzędzia psują robotę', () => {
  const h = H.fresh(); h.assets.narzedzia = 3;
  const fresh = H.effects(h).timeBonus;
  const worn = H.effects(H.wear(h, 80)).timeBonus;
  assert(worn < fresh && worn >= fresh * 0.5 - 1e-9);
  const w2 = H.wear(h, 80);
  assert(H.repairCost(w2) > H.repairCost(h) && H.repair(w2, 10).ok === false);
  assert.strictEqual(H.repair(w2, 1e6).hq.cond, 100);
  assert(H.breakChance(w2) > 0 && H.breakChance(h) === 0);
  assert(H.clone(w2).cond === 20 && H.buyTier(w2, 1e9).hq.cond === 20);
  assert(H.rating(w2, [], [], 0).stars < H.rating(h, [], [], 0).stars);
});

t('opłacalność: najtańszy remont daje wyraźny zysk w ocenie na złotówkę (szyld vs ogrzewanie)', () => {
  const base = H.fresh();
  const sz = H.rating(H.buy(base, 'up', 'szyld', 1e9).hq, [], [], 0).stars - H.rating(base, [], [], 0).stars;
  const og = H.rating(H.buy(base, 'up', 'ogrz', 1e9).hq, [], [], 0).stars - H.rating(base, [], [], 0).stars;
  assert(sz > og, 'szyld ' + sz + ' ogrzewanie ' + og);
});

console.log('\n' + n + ' testów przeszło');
