// Testy modułów: kalendarz, umowa, finanse, osiedle, fabuła. Uruchomienie: node tests/moduly.test.js
const assert = require('assert');
const K = require('../prototypes/janusz/kalendarz.js');
const U = require('../prototypes/janusz/umowa.js');
const Fi = require('../prototypes/janusz/finanse.js');
const O = require('../prototypes/janusz/osiedle.js');
const Fa = require('../prototypes/janusz/fabula.js');
const E = require('../prototypes/janusz/ekipa.js');
const H = require('../prototypes/janusz/siedziba.js');
const { CLIENTS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const seq = r => { let i = 0; return () => r[i++ % r.length]; };
const ctx0 = o => Object.assign({ done: 0, day: 1, money: 1000, rating: 3, tier: 0, gossip: 50, taxRisk: 0, debt: 0, crew: [], rivalPower: 25, accountant: false, owedContact: null, flags: {} }, o);

// ---------- kalendarz ----------
t('kalendarz: sezony zmieniają się co 12 dni i zapętlają co rok', () => {
  assert.strictEqual(K.seasonOf(1).name, 'wiosna'); assert.strictEqual(K.seasonOf(12).name, 'wiosna');
  assert.strictEqual(K.seasonOf(13).name, 'lato'); assert.strictEqual(K.seasonOf(37).name, 'zima');
  assert.strictEqual(K.seasonOf(49).name, 'wiosna'); assert.strictEqual(K.seasonOf(49).year, 2);
});
t('kalendarz: zimą kran i gniazdko drożej, ściana taniej; pogoda opóźnia, komfort łagodzi nastrój', () => {
  assert(K.demandMult('zima', 'kran') > 1 && K.demandMult('zima', 'sciana') < 1 && K.demandMult('wiosna', 'sciana') > 1);
  assert(K.weather('zima', seq([0])).delay >= 2 && K.weather('wiosna', seq([0])).delay === 0 && K.weather('zima', seq([0.99])).delay === 0);
  assert(K.moodPenalty('zima', 0) > K.moodPenalty('zima', 12) && K.moodPenalty('lato', 0) === 0);
});

// ---------- umowa ----------
t('umowa: bez faktury taniej, bez podatku, rośnie ryzyko; wymagający klient się obraża', () => {
  const u = U.evaluate({ invoice: false }, CLIENTS.mirek, seq([0.5]));
  assert(u.payMult < 1 && u.taxRate === 0 && u.taxRiskDelta > 0 && u.satDelta === 0);
  const g = U.evaluate({ invoice: false }, CLIENTS.grazyna, seq([0.5]));
  assert(g.satDelta < 0 && U.needsInvoice(CLIENTS.heniek) && !U.needsInvoice(CLIENTS.mirek));
});
t('umowa: zawyżony kosztorys opłaca się u nieuważnego, kosztuje u uważnego i fachowca', () => {
  assert(U.detectChance(CLIENTS.mirek) < U.detectChance(CLIENTS.grazyna) && U.detectChance(CLIENTS.heniek) > U.detectChance(CLIENTS.grazyna));
  const ok = U.evaluate({ quote: 'inflated' }, CLIENTS.mirek, seq([0.99]));
  const caught = U.evaluate({ quote: 'inflated' }, CLIENTS.mirek, seq([0.0]));
  assert(ok.payMult > 1.15 && !ok.detected && caught.detected && caught.satDelta <= -25);
});
t('umowa: niski kosztorys zachwyca klienta, termin na wczoraj skraca czas i podnosi wypłatę', () => {
  const l = U.evaluate({ quote: 'low' }, CLIENTS.karyna, seq([0.5])); assert(l.payMult < 0.9 && l.satDelta > 0);
  const r = U.evaluate({ rush: true }, CLIENTS.karyna, seq([0.5])); assert(r.deadlineFactor < 1 && r.payMult > 1);
});

// ---------- finanse ----------
t('pożyczki: limity, wymóg oceny dla banku, brak zmiany wejścia', () => {
  const f = Fi.fresh();
  assert.strictEqual(Fi.takeLoan(f, 'bank', 1000, 2.0).ok, false);
  const b = Fi.takeLoan(f, 'bank', 1000, 3.4); assert(b.ok && b.fin.loans.length === 1 && f.loans.length === 0);
  assert.strictEqual(Fi.takeLoan(b.fin, 'bank', 4500, 4).ok, false);
  assert.strictEqual(Fi.takeLoan(f, 'gienek', 9999, 1).ok, false);
});
t('odsetki: lichwiarz puchnie szybciej niż bank', () => {
  const g = Fi.takeLoan(Fi.fresh(), 'gienek', 1000, 1).fin, bk = Fi.takeLoan(Fi.fresh(), 'bank', 1000, 4).fin;
  const g2 = Fi.settle(g, 0).fin, b2 = Fi.settle(bk, 0).fin;
  assert(g2.loans[0].principal > b2.loans[0].principal && g2.loans[0].principal === 1250);
});
t('raty: płacisz najdroższe najpierw, brak środków = zaległość, spłata kasuje dług', () => {
  let f = Fi.takeLoan(Fi.takeLoan(Fi.fresh(), 'gienek', 1000, 1).fin, 'bank', 1000, 4).fin;
  const a = Fi.settle(f, 200); assert(a.paid > 0 && a.missed.length === 1);
  const gienekMissed = a.fin.loans.find(l => l.lender === 'bank'); assert(gienekMissed.missed === 1); // bank dostał zaległość, lichwiarz zapłacony
  const r = Fi.repay(f, 1, 1e9, 1e9); assert(r.ok && r.fin.loans.every(l => l.id !== 1));
});
t('windykacja: lichwiarz po 2 zaległościach, bank po 3, kuzyn obraza', () => {
  const l = (lender, missed) => ({ lender, missed, principal: 100 });
  assert.strictEqual(Fi.collection(l('gienek', 1)), null);
  assert.strictEqual(Fi.collection(l('gienek', 2)).kind, 'windykacja');
  assert.strictEqual(Fi.collection(l('bank', 2)), null);
  assert.strictEqual(Fi.collection(l('bank', 3)).kind, 'komornik');
  assert.strictEqual(Fi.collection(l('kuzyn', 3)).kind, 'obraza');
});
t('skarbówka: bez faktury rośnie ryzyko i ukryty przychód, z fakturą podatek do zapłaty', () => {
  let f = Fi.addIncome(Fi.fresh(), 400, true); assert(f.tax.due === 40 && f.tax.risk === 0);
  f = Fi.addIncome(f, 400, false); assert(f.tax.unreported === 400 && f.tax.risk > 0);
  const p = Fi.payTax(f, 1000); assert(p.paid === 40 && p.fin.tax.due === 0);
});
t('kontrola: księgowa i przysługa zmniejszają szansę i karę; kontrola resetuje ukryte przychody', () => {
  let f = Fi.addIncome(Fi.fresh(), 2000, false); f = Fi.addIncome(f, 2000, false);
  const base = Fi.auditChance(f, {}), acc = Fi.auditChance(Object.assign({}, f, { tax: Object.assign({}, f.tax, { accountant: true }) }), {}), fav = Fi.auditChance(f, { cover: true });
  assert(acc < base && fav < base);
  const a = Fi.rollAudit(f, { force: true }, seq([0.5])); assert(a.audit && a.fin.tax.unreported === 0 && a.fin.tax.risk <= 15);
  const cheaper = Fi.rollAudit(f, { force: true, cover: true }, seq([0.5])); assert(cheaper.audit.penalty < a.audit.penalty);
  assert.strictEqual(Fi.rollAudit(Fi.fresh(), {}, seq([0.99])).audit, null);
});
t('księgowa: koszt jednorazowy, tylko raz', () => {
  const h = Fi.hireAccountant(Fi.fresh(), 1000); assert(h.ok && h.cost === 600 && Fi.upkeep(h.fin) === 40);
  assert.strictEqual(Fi.hireAccountant(h.fin, 1000).ok, false); assert.strictEqual(Fi.hireAccountant(Fi.fresh(), 10).ok, false);
});

// ---------- osiedle ----------
t('znajomości: poznajesz za pieniądze, przysługa działa i zwiększa dług, limit 3', () => {
  let os = O.fresh(); assert.strictEqual(O.meet(os, 'urzad', 10).ok, false);
  os = O.meet(os, 'urzad', 500).os; assert.strictEqual(O.meet(os, 'urzad', 500).ok, false);
  let r = O.useFavor(os, 'urzad'); assert(r.ok && r.effect.type === 'audit' && r.os.contacts.urzad.owes === 1);
  for (let i = 0; i < 2; i++) r = O.useFavor(r.os, 'urzad');
  assert.strictEqual(O.useFavor(r.os, 'urzad').ok, false);
  assert.strictEqual(O.owedContact(r.os), 'urzad');
  const back = O.repayFavor(r.os, 'urzad', 500); assert(back.ok && back.os.contacts.urzad.owes === 2 && back.os.contacts.urzad.trust > r.os.contacts.urzad.trust);
  assert.strictEqual(O.useFavor(O.fresh(), 'hurt').ok, false);
});
t('plotki: dobre oceny u gadatliwego klienta podnoszą, skandal obniża, wartości wracają do 50', () => {
  let os = O.fresh();
  const up = O.updateGossip(os, { stars: 5, gossipy: O.GOSSIP.karyna }), dn = O.updateGossip(os, { stars: 1, gossipy: O.GOSSIP.karyna }), sc = O.updateGossip(os, { stars: 3, gossipy: 1, scandal: true });
  assert(up.gossip > 50 && dn.gossip < 50 && sc.gossip < 50);
  assert(O.updateGossip(os, { stars: 5, gossipy: O.GOSSIP.karyna }).gossip - 50 > O.updateGossip(os, { stars: 5, gossipy: O.GOSSIP.mirek }).gossip - 50);
  assert(O.gossipMult(up) > 1 && O.gossipMult(dn) < 1);
  let g = O.fresh(); g.gossip = 90; for (let i = 0; i < 40; i++) g = O.updateGossip(g, { stars: 3, gossipy: 1 }); assert(g.gossip < 60);
});
t('rywal: rośnie, dołuje ceny gdy silniejszy, podkupuje niezadowolonych, szkodzi gdy żal', () => {
  let os = O.fresh(); const ctx = { rating: 2, tier: 0, crew: [] };
  const p0 = os.rival.power; os = O.tickRival(os, ctx, seq([0.99])).os; assert(os.rival.power > p0);
  const strong = Object.assign({}, os, { rival: { power: 80, grudge: 0 } });
  assert(O.undercut(strong, ctx) > 0 && O.undercut(strong, { rating: 5, tier: 5, crew: [] }) === 0);
  const sad = Object.assign(E.newWorker(E.CANDIDATES[1]), { mood: 20 }), happy = Object.assign(E.newWorker(E.CANDIDATES[3]), { mood: 90 });
  const r1 = O.tickRival(strong, { rating: 2, tier: 0, crew: [sad] }, seq([0.0])), r2 = O.tickRival(strong, { rating: 2, tier: 0, crew: [happy] }, seq([0.0]));
  assert(r1.events.some(e => e.type === 'poach') && !r2.events.some(e => e.type === 'poach'));
  const angry = Object.assign({}, os, { rival: { power: 30, grudge: 40 } });
  assert(O.tickRival(angry, ctx, seq([0.0, 0.0])).events.some(e => e.type === 'sabotage'));
});

// ---------- fabuła ----------
t('fabuła: sceny odpalają się po warunkach i nie powtarzają', () => {
  let st = Fa.fresh();
  assert.strictEqual(Fa.due(st, ctx0({ done: 0 })).id, 'spadek');
  st = Fa.resolve(st, 'spadek', 0).story; assert.strictEqual(Fa.due(st, ctx0({ done: 0 })), null);
  assert.strictEqual(Fa.due(st, ctx0({ done: 2 })).id, 'gienek');
  st = Fa.resolve(st, 'gienek', 0).story; assert.strictEqual(Fa.due(st, ctx0({ done: 3 })), null);
  assert.strictEqual(Fa.due(st, ctx0({ done: 5 })).id, 'bogdan');
});
t('fabuła: sceny zależą od stanu (Kacper, donos, księgowa, przysługi, inwestor)', () => {
  let st = Fa.fresh(); st.fired = ['spadek', 'gienek', 'bogdan'];
  assert.strictEqual(Fa.due(st, ctx0({ done: 4, crew: ['kacper'] })).id, 'kacper_prawo');
  st.fired.push('kacper_prawo');
  assert.strictEqual(Fa.due(st, ctx0({ done: 8, taxRisk: 40, accountant: true })).id, 'donos');
  assert.strictEqual(Fa.due(st, ctx0({ done: 8, taxRisk: 0, accountant: true })), null);
  assert.strictEqual(Fa.due(st, ctx0({ done: 8, accountant: false })).id, 'basia');
  st.fired.push('basia');
  assert.strictEqual(Fa.due(st, ctx0({ done: 8, owedContact: 'urzad', accountant: true })).id, 'przyslugi');
  st.fired.push('przyslugi', 'donos');
  assert.strictEqual(Fa.due(st, ctx0({ done: 12, rating: 3.2, tier: 1, accountant: true })).id, 'inwestor');
  assert.strictEqual(Fa.due(st, ctx0({ done: 12, rating: 2.0, tier: 1, accountant: true })), null);
});
t('fabuła: wybory ustawiają flagi, zapisują dziennik i zwracają skutki', () => {
  const r = Fa.resolve(Fa.fresh(), 'spadek', 1);
  assert(r.story.flags.ciotka && r.story.log.length === 1 && r.effects.money === 1200 && r.story.fired[0] === 'spadek');
  assert.throws(() => Fa.resolve(Fa.fresh(), 'nie_ma', 0));
  const inv = Fa.BEATS.find(b => b.id === 'inwestor');
  assert(!Fa.choiceAvailable(inv.choices[1], ctx0({ gossip: 40 })) && Fa.choiceAvailable(inv.choices[1], ctx0({ gossip: 70 })));
});
t('fabuła: zakończenia zależą od flag i statystyk', () => {
  assert.strictEqual(Fa.ending({ flags: { sprzedane: true }, rating: 4.5, fusz: 5, tier: 4 }).id, 'holding');
  assert.strictEqual(Fa.ending({ flags: {}, rating: 4.3, fusz: 10, tier: 2 }).id, 'uczciwy');
  assert.strictEqual(Fa.ending({ flags: {}, rating: 2.6, fusz: 60, tier: 3 }).id, 'krol');
  assert.strictEqual(Fa.ending({ flags: {}, rating: 3.4, fusz: 30, tier: 1 }).id, 'klasyk');
});
t('tajemniczy klient: kara za fuszerkę, premia za rzetelność', () => {
  assert(Fa.rollMystery({ done: 5 }, seq([0.0])) && !Fa.rollMystery({ done: 2 }, seq([0.0])) && !Fa.rollMystery({ done: 8 }, seq([0.99])));
  assert.strictEqual(Fa.resolveMystery({ index: 70 }).kind, 'kara'); assert.strictEqual(Fa.resolveMystery({ index: 5 }).kind, 'premia'); assert.strictEqual(Fa.resolveMystery({ index: 25 }).kind, 'neutral');
});
t('spięcie: lichwiarz + brak rat → windykacja; ukryty przychód + donos → kontrola; kamery odzyskują część', () => {
  let f = Fi.addDebt(Fi.fresh(), 'gienek', 1000);
  for (let i = 0; i < 2; i++) f = Fi.settle(f, 0).fin;
  assert.strictEqual(Fi.collection(f.loans[0]).kind, 'windykacja');
  let g = Fi.addIncome(Fi.fresh(), 3000, false);
  assert(Fi.rollAudit(g, { force: true }, seq([0])).audit.penalty > 0);
  const rich = H.fresh(); rich.assets.narzedzia = 3; rich.assets.bus = 3;
  const cams = H.buy(H.buy(rich, 'up', 'kamery', 1e9).hq, 'up', 'kamery', 1e9).hq;
  assert(H.resolveTheft(cams, seq([0, 0.5, 0.5, 0.9])).recovered > 0);
});

console.log('\n' + n + ' testów przeszło');
