/* Silnik bez UI (R0): scenariusze w czystym Node, bez DOM i bez przeglądarki. Widok to atrapa V, odpowiedzi gracza to E.answer(id). */
const assert = require('assert');
const Silnik = require('../prototypes/janusz/silnik.js');
const Czas = require('../prototypes/janusz/czas.js'), Ekipa = require('../prototypes/janusz/ekipa.js'), Kontrakty = require('../prototypes/janusz/kontrakty.js'), Przetargi = require('../prototypes/janusz/przetargi.js'), Ksiega = require('../prototypes/janusz/ksiega.js'), Jobs = require('../prototypes/janusz/jobs.js');

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function game(seed, extra) {
  const log = { menus: 0, tops: 0, prompts: [], screens: [] }, mem = {};
  const E = Silnik.create({ rnd: lcg(seed), storage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
    view: { menu() { log.menus++; }, top() { log.tops++; }, screen(n) { log.screens.push(n); }, prompt(p) { log.prompts.push(p); } } });
  E.load(); E.log = log; E.mem = mem; if (extra) extra(E); return E;
}
const digest = E => { const S = E.ST; return JSON.stringify({ money: Math.round(S.money), done: S.done, clock: S.clock, rat: S.ratings.length, crew: S.crew.length, fat: Math.round(S.fatigue), claims: S.claims.length, contracts: Object.keys(S.contracts.done || {}).length }); };
let n = 0; const t = name => { n++; console.log('  ok', name); };

{ // stan, zapis i odczyt, księga
  const E = game(1); const m0 = E.ST.money;
  E.cash('zlecenia', 500); assert.strictEqual(E.ST.money, m0 + 500);
  E.cash('kary', -100000); assert.strictEqual(E.ST.money, 0, 'kasa nie spada poniżej zera');
  E.cash('zlecenia', 300); E.save();
  const E2 = game(2, e => { e.mem.zlecenia_v1 = E.mem.zlecenia_v1; e.load(); });
  assert.strictEqual(E2.ST.money, 300); assert(E2.ST.inv.length >= 1, 'zestaw startowy');
  assert(E.monthSummary().plus !== undefined); t('stan, kasa, zapis i odczyt');
}
{ // zegar: zmiana miesiąca i roku planuje raporty
  const E = game(1); const k0 = E.bookKey();
  E.advanceClock(E.ST.clock + 40 * 1440); assert.notStrictEqual(E.bookKey(), k0); assert(E.ST.pendingMonths.length >= 1);
  E.advanceClock(E.ST.clock + 400 * 1440); assert(E.ST.pendingYears.length >= 1); t('zegar: miesiące i lata');
}
{ // odpoczynek: sen, dzień wolny, urlop
  const E = game(3, e => { e.ST.fatigue = 80; e.ST.burnout = 50; e.ST.money = 5000; e.ST.ledgerMoney = 5000; });
  const c0 = E.ST.clock; E.sleepNow(); assert.strictEqual(E.ST.clock, c0 + 480); assert(E.ST.fatigue < 80);
  const b0 = E.ST.burnout; E.dayOffNow(); assert(E.ST.burnout < b0);
  const m0 = E.ST.money; E.vacationNow(); assert(E.ST.money < m0 && E.ST.fatigue === 0); assert(E.ST.flash.length >= 3);
  assert(E.log.menus >= 3); t('sen, dzień wolny, urlop');
}
{ // czekanie na telefon: aż zadzwoni, okno wyboru jako dane, odpowiedź uruchamia zlecenie
  const E = game(5); let started = null, rounds = 0;
  while (!E.pending && rounds++ < 80) E.waitHour((i, call) => { started = { i, call }; });
  assert(E.pending, 'w końcu ktoś zadzwonił'); assert(E.pending.prompt.choices.length >= 2); assert(/Telefon/.test(E.pending.prompt.title));
  const ids = E.pending.prompt.choices.map(c => c.id); E.answer(ids.includes('go') ? 'go' : 'normal');
  assert(!E.pending && !E.ui.modalOpen); assert(E.ST.waited >= 0); t('czekanie godzinami i telefon (' + rounds + ' h)');
}
{ // kontrakt do końca: przyjęcie, etapy, odbiór końcowy, rezygnacja
  const E = game(7, e => { e.ST.money = 9000; e.ST.ledgerMoney = 9000; e.ST.done = 12; });
  const c = Kontrakty.available(E.ST.done)[0]; assert(c, 'jest kontrakt do przyjęcia');
  const m0 = E.ST.money; E.askContract(c.id); assert.strictEqual(E.pending.prompt.kind, 'kontrakt'); E.answer('yes');
  assert.strictEqual(E.KT().active.id, c.id); assert(E.ST.money > m0, 'zaliczka wpłynęła');
  let s = E.KT(); c.stages.forEach(() => { s = Kontrakty.recordStage(s, { stars: 5, index: 10, defects: [] }, 100).state; }); E.ST.contracts = s;
  E.ST.clock += 1440; assert.strictEqual(E.checkContractFinal(), true); assert.strictEqual(E.pending.prompt.kind, 'odbior');
  assert.strictEqual(E.checkContractFinal(), false, 'nie nakłada okien'); E.answer('ok'); assert(!E.KT().active, 'kontrakt zamknięty'); assert(E.KT().done[c.id].count === 1);
  // rezygnacja
  const c2 = Kontrakty.available(E.ST.done)[0]; E.askContract(c2.id); E.answer('yes'); const m1 = E.ST.money; E.askCancel(); E.answer('yes');
  assert(E.ST.money < m1 && !E.KT().active); t('kontrakt: przyjęcie, etapy, odbiór, rezygnacja');
}
{ // przetarg: oferta, wygrana albo przegrana zależnie od RNG; audyt ze zagrażającą wadą oblewa
  let won = 0, lost = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const E = game(seed, e => { e.ST.money = 40000; e.ST.ledgerMoney = 40000; e.ST.hq.tier = 3; e.ST.done = 40; e.ST.ratings = Array(20).fill(5); });
    const tdr = Object.values(Przetargi.TENDERS)[0]; E.askTender(tdr.id); assert.strictEqual(E.pending.prompt.kind, 'przetarg');
    const bids = E.pending.prompt.choices.filter(c => c.id); E.answer(bids[seed % 2 ? 0 : bids.length - 1].id);
    if (E.KT().active) { won++; assert(E.KT().active.wadium > 0); } else { lost++; assert(E.ST.flash.some(f => /wygrał/.test(f))); }
  }
  assert(won + lost === 12 && won >= 1, 'bywa wygrana (' + won + '/' + lost + ')'); t('przetargi: wygrane ' + won + ', przegrane ' + lost);
  const E = game(2, e => { e.ST.money = 40000; e.ST.ledgerMoney = 40000; });
  const tdr = Object.values(Przetargi.TENDERS)[0], cid = Przetargi.cid(tdr.id), r = Kontrakty.accept(E.KT(), cid, E.ST.clock, Jobs.JOBS, { priceMult: 1, wadium: 800 }, 3);
  assert(r.ok); let s = r.state; Kontrakty.CONTRACTS[cid].stages.forEach((_, i) => { s = Kontrakty.recordStage(s, { stars: 5, index: 20, defects: i === 0 ? [{ label: 'ukryta iskra', hazard: 3, vis: 0.1, sev: 5 }] : [] }, 100).state; });
  E.ST.contracts = s; E.ST.forceAudit = true; E.ST.clock += 1440; E.checkContractFinal(); assert(E.pending); E.answer('ok'); t('przetarg: audyt po odbiorze');
}
{ // ekipa: tablica zleceń, wybór pracownika, wyjazd, odbiór wyników
  const E = game(9, e => { e.ST.money = 3000; e.ST.ledgerMoney = 3000; e.ST.crew = [Ekipa.newWorker(Ekipa.CANDIDATES[0]), Ekipa.newWorker(Ekipa.CANDIDATES[1])]; });
  E.ensureBoard(); assert(E.ST.board.offers.length >= 1);
  const o = E.ST.board.offers.find(of => E.crewFree(of).length); assert(o, 'jest zlecenie dla wolnego pracownika');
  E.pickWorkerFor(o.id); assert.strictEqual(E.pending.prompt.kind, 'ekipa-wybor'); const w = E.pending.prompt.choices.find(c => c.id); E.answer(w.id);
  assert(E.ST.board.offers.every(x => x.id !== o.id), 'zlecenie zeszło z tablicy'); assert(E.ST.crewJobs.length === 1 || E.ST.flash.some(f => /nie pojechał/.test(f)));
  if (E.ST.crewJobs.length) { assert.strictEqual(E.collectCrew(), false, 'jeszcze w drodze'); E.advanceClock(E.ST.crewJobs[0].endAt + 1); const m0 = E.ST.money; assert.strictEqual(E.collectCrew(), true); assert.strictEqual(E.pending.prompt.kind, 'ekipa-wrocila'); E.answer('ok'); assert(E.ST.crewJobs.length === 0); assert(E.ST.money !== m0 || E.ST.ratings.length); }
  t('ekipa: tablica, wyjazd, odbiór');
}
{ // rok, prestiż, perki i Nowa Gra+
  const E = game(4, e => { e.ST.money = 8000; e.ST.ledgerMoney = 8000; e.ST.ratings = [5, 5, 4, 5, 4, 5, 5, 4]; e.ST.hist = [{ index: 15 }];
    for (const k of ['2027-05', '2027-09', '2027-12']) { e.ST.ledger = Ksiega.book(e.ST.ledger, k, 'zlecenia', 9000); e.ST.ledger = Ksiega.book(e.ST.ledger, k, 'materialy', -2500); for (let i = 0; i < 60; i++) e.ST.ledger = Ksiega.noteJob(e.ST.ledger, k, 120, 1); }
    e.ST.pendingYears = ['2027']; });
  const pts0 = E.META.points; assert.strictEqual(E.checkYear(), true); assert.strictEqual(E.pending.prompt.kind, 'rok'); assert(E.pending.prompt.rows.length >= 2);
  assert(E.META.points > pts0, 'punkty prestiżu'); E.answer('pr'); assert(E.log.screens.includes('prestige'));
  const perk = Object.keys(require('../prototypes/janusz/rok.js').PERKS)[0]; const bought = E.buyPerk(perk); assert(typeof bought === 'boolean');
  const g0 = E.META.games; E.askNewGamePlus(); E.answer('yes'); assert.strictEqual(E.META.games, g0 + 1); assert.strictEqual(E.ST.done, 0); assert(E.ST.money >= 0);
  assert(JSON.parse(E.mem.zlecenia_meta).games === g0 + 1, 'meta zapisana osobno'); t('rok: podsumowanie, prestiż, perk, Nowa Gra+');
}
{ // szafa i sklep
  const E = game(6, e => { e.ST.money = 4000; e.ST.ledgerMoney = 4000; });
  const ub = require('../prototypes/janusz/ubrania.js'), id = Object.keys(ub.OUTFITS).find(k => ub.OUTFITS[k].price > 0 && ub.OUTFITS[k].price < 400) || Object.keys(ub.OUTFITS)[1];
  const m0 = E.ST.money, n0 = E.ST.wardrobe.owned.length; assert.strictEqual(E.wardrobeCmd('buy', id), true); assert(E.ST.money < m0 && E.ST.wardrobe.owned.length === n0 + 1);
  const it = E.ST.wardrobe.owned[E.ST.wardrobe.owned.length - 1]; assert.strictEqual(E.ST.wardrobe.worn, it.uid); assert.strictEqual(E.wardrobeCmd('sell', it.uid), true); t('szafa: kupno i sprzedaż');
}
/* całe zlecenie bez UI: newJob → opcje kroków → settleJob */
function playJob(E, i, o) {
  o = o || {}; const cur = E.newJob(i, o.call); const Umowa = require('../prototypes/janusz/umowa.js');
  cur.umowa = Umowa.evaluate(cur.terms, cur.client, E.rnd); cur.deadline = Math.round(cur.job.deadline * cur.umowa.deadlineFactor);
  if (o.helper && E.ST.crew.length) { cur.helper = E.ST.crew[0]; cur.helperOn = true; cur.helperPaid = 50; }
  let res, guard = 0;
  while (guard++ < 20) { const st = cur.job.steps[cur.step], opt = st.options.find(x => x.id === o.pick) || st.options[0]; res = E.applyOption(cur, opt, 0.6); if (res.done) break; if (res.surprise) { assert(res.surprise.options && res.surprise.options.length, 'niespodzianka ma opcje'); } }
  assert(res.done, 'zlecenie dobiegło końca'); const out = E.settleJob(cur); return { cur, out };
}
{ // pełne zlecenie dzienne
  const E = game(31); const m0 = E.ST.money, done0 = E.ST.done;
  const { cur, out } = playJob(E, 0); assert.strictEqual(E.ST.done, done0 + 1); assert(out.r.stars >= 1 && out.r.stars <= 5); assert(typeof out.eco.net === 'number');
  assert(E.ST.money !== m0); assert(E.ST.ratings.length === 1); assert(E.ST.clock > Czas.startClock(), 'zegar ruszył'); assert(E.ST.ledger, 'księga zaksięgowana');
  assert(E.ST.unlocked >= 2 && E.ST.best[0], 'postęp poziomów'); t('pełne zlecenie dzienne: newJob → opcje → rozliczenie');
}
{ // zlecenie nocne z pomocnikiem, fuszerka: gorsza ocena niż solidna na tym samym ziarnie
  const mk = pick => { const E = game(32, e => { e.ST.crew = [Ekipa.newWorker(Ekipa.CANDIDATES[0])]; }); const idx = Jobs.LEVELS.findIndex(l => l.slot === 'noc'); assert(idx >= 0, 'jest poziom nocny'); E.ST.unlocked = 99; return playJob(E, idx, { helper: true, pick }); };
  const a = mk('dobrze'), b = mk('skrot'); assert(a.out.night === true); assert(a.out.mods.payMult > 1, 'dopłata nocna');
  assert(a.out.r.index <= b.out.r.index, 'solidnie (' + a.out.r.index + ') nie gorzej niż na skróty (' + b.out.r.index + ')'); t('zlecenie nocne z pomocnikiem: solidnie vs skrót');
}
{ // zlecenie z kontraktu: etap zapisuje się w kontrakcie
  const E = game(33, e => { e.ST.money = 9000; e.ST.ledgerMoney = 9000; e.ST.done = 12; });
  const c = Kontrakty.available(E.ST.done)[0]; E.askContract(c.id); E.answer('yes'); const lv = Kontrakty.stageLevel(E.KT(), E.ST.clock);
  const { cur } = playJob(E, -1, { call: lv }); assert.strictEqual(E.KT().active.stage, 1, 'etap zaliczony'); assert(E.KT().active.results.length === 1); assert(cur.level.contract); t('etap kontraktu rozliczony w silniku');
}
{ // dzień wypłaty, odejścia i raport miesięczny
  const E = game(41, e => { e.ST.money = 5000; e.ST.ledgerMoney = 5000; e.ST.done = 5; e.ST.crew = [Ekipa.newWorker(Ekipa.CANDIDATES[0]), Ekipa.newWorker(Ekipa.CANDIDATES[1])]; });
  const p = E.startPayday(); assert.strictEqual(p.kind, 'crew'); assert(Object.keys(p.pay).length === 2);
  const wages = {}; E.ST.crew.forEach(w => { wages[w.id] = w.wage; }); const m0 = E.ST.money; const res = E.confirmPay(wages);
  assert.strictEqual(res.lines.length, 2); assert(E.ST.money < m0, 'pensje zapłacone'); assert(E.ST.nextPay > E.ST.done); assert(res.lines.every(l => typeof l.say === 'string'));
  const solo = game(42, e => { e.ST.money = 2000; e.ST.ledgerMoney = 2000; }); const ps = solo.startPayday(); assert(['simple', 'none'].includes(ps.kind));
  E.advanceClock(E.ST.clock + 40 * 1440); assert.strictEqual(E.checkMonthReport(), true); assert.strictEqual(E.pending.prompt.kind, 'miesiac'); E.answer('ok'); t('wypłata, rozliczenie tygodnia i raport miesięczny');
}
{ // reklamacja, wypadek i upomnienie ekipy
  const E = game(43, e => { e.ST.money = 3000; e.ST.ledgerMoney = 3000; e.ST.done = 4; e.ST.claims = [{ client: 'Karyna', due: 3, kind: 'reklamacja', defect: 'cieknie pod zlewem', amount: 400 }, { client: 'Mirek', due: 4, kind: 'wypadek', defect: 'upadek z drabiny', amount: 1500 }]; });
  assert.strictEqual(E.checkClaims(), true); assert(/Reklamacja/.test(E.pending.prompt.title)); const m0 = E.ST.money; E.answer('pay'); assert(E.ST.money < m0 && E.ST.claims.length === 1);
  assert.strictEqual(E.checkClaims(), true); assert(/Wypadek/.test(E.pending.prompt.title)); const r0 = E.ST.ratings.length; E.answer('ignore'); assert(E.ST.ratings.length === r0 + 2 && E.ST.claims.length === 0);
  const F = game(44, e => { e.ST.money = 500; e.ST.ledgerMoney = 500; const w = Ekipa.newWorker(Ekipa.CANDIDATES[0]); w.mood = 5; w.owed = 300; e.ST.crew = [w]; });
  const asked = F.checkDemands(); if (asked) { assert(/się upomina/.test(F.pending.prompt.title)); F.answer('n'); assert(F.ST.demandAt[F.ST.crew[0].id] !== undefined); } t('reklamacje, wypadki, upomnienia (upomnienie: ' + asked + ')');
}
{ // determinizm całego przebiegu
  const run = () => { const E = game(21, e => { e.ST.money = 6000; e.ST.ledgerMoney = 6000; e.ST.done = 12; }); for (let i = 0; i < 30 && !E.pending; i++) E.waitHour(() => {}); const c = Kontrakty.available(E.ST.done)[0]; if (E.pending) E.answer('no'); E.askContract(c.id); E.answer('yes'); E.sleepNow(); return digest(E); };
  assert.strictEqual(run(), run()); t('determinizm przebiegu (ten sam seed, ten sam skrót)');
}
console.log('silnik: ' + n + ' scenariuszy OK');
