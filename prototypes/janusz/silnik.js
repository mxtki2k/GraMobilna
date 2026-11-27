/* Silnik rozgrywki bez UI (etap R0 planu Godot).
   Stan gry, zegar, księga, ekipa na zleceniach, kontrakty, przetargi, rok i prestiż, czekanie/odpoczynek/urlop,
   szafa i rozliczenie zlecenia. Nic tu nie dotyka DOM. Widok podaje się jako obiekt V:
     V.menu()  V.top()  V.screen(nazwa)  V.prompt(p)
   gdzie okno wyboru to dane: p = { title, text, rows?: [{label, value, pos}], choices: [{ id, label, sub }] }.
   Odpowiedź gracza to E.answer(id). Test headless podaje własny V i odpowiada skryptem. */
(function (root, factory) { const m = factory(root); if (typeof module === 'object' && module.exports) module.exports = m; else root.Silnik = m; })(typeof self !== 'undefined' ? self : this, function (root) {
  const NODE = typeof module === 'object' && module.exports && typeof require === 'function';
  const NAMES = { RobotyGen: 'roboty_gen', Czas: 'czas', Sezon: 'sezon', Ksiega: 'ksiega', Rok: 'rok', Ubrania: 'ubrania', Stawka: 'stawka', Terminy: 'terminy', Bus: 'bus', Zmeczenie: 'zmeczenie', Klienci: 'klienci', Szkolenia: 'szkolenia', Ubezp: 'ubezpieczenie', Kontrakty: 'kontrakty', Spec: 'specjalizacje', Przetargi: 'przetargi', ZlecEkipy: 'zlecenia_ekipy', Wypalenie: 'wypalenie', Fuszerka: 'fuszerka', Jobs: 'jobs', Ekipa: 'ekipa', Swiat: 'swiat', Siedziba: 'siedziba', Kalendarz: 'kalendarz', Umowa: 'umowa', Finanse: 'finanse', Osiedle: 'osiedle', Fabula: 'fabula', Alledrogo: 'alledrogo' };
  function deps() {
    if (!NODE) return root;
    const o = {}; for (const k of Object.keys(NAMES)) o[k] = require('./' + NAMES[k] + '.js'); return o;
  }
  const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const signed = n => (n >= 0 ? '+' : '−') + zl(Math.abs(n));

  function create(opts) {
    opts = opts || {};
    const D = deps(), { Czas, Sezon, Ksiega, Rok, Ubrania, Stawka, Terminy, Bus, Zmeczenie, Klienci, Szkolenia, Ubezp, Kontrakty, Spec, Przetargi, ZlecEkipy, Wypalenie, Fuszerka, Jobs, Ekipa, Swiat, Siedziba, Kalendarz, Umowa, Finanse, Osiedle, Fabula, Alledrogo } = D;
    const { JOBS, CLIENTS, LEVELS } = Jobs;
    const rnd = opts.rnd || Math.random;
    const mem = {}; const store = opts.storage || { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    const E = { V: opts.view || {}, ui: { modalOpen: false }, pending: null, zl, stars, signed };
    const V = () => E.V, menu = () => { if (V().menu) V().menu(); }, top = () => { if (V().top) V().top(); };

    // ---------- stan ----------
    const fresh = () => ({ money: 0, ratings: [], best: {}, unlocked: 1, claims: [], done: 0, crew: [], nextPay: Ekipa.PAYDAY_EVERY, demandAt: {}, world: Swiat.newWorld(), lastPayDone: -1, hq: Siedziba.fresh(), hist: [], fin: Finanse.fresh(), os: Osiedle.fresh(), story: Fabula.fresh(), day: 1, clock: Czas.startClock(), wardrobe: Ubrania.fresh(), pendingYears: [], contracts: Kontrakty.fresh(), xp: Spec.fresh(), tenderCool: {}, board: { day: 0, offers: [] }, crewJobs: [], where: 'baza', waited: 0, bus: Bus.fresh(), fatigue: 10, burnout: 0, rel: Klienci.fresh(), certs: {}, oc: Ubezp.fresh(), ledger: Ksiega.fresh(), ledgerMoney: 0, monthStart: {}, monthEnd: {}, pendingMonths: [], fav: {}, flash: [], forceAudit: false, inv: [Alledrogo.starterKit()], orders: [], market: null, starterGiven: true });
    const META = Rok.freshMeta();
    try { const m = store.getItem('zlecenia_meta'); if (m) Object.assign(META, JSON.parse(m)); } catch (e) {}
    const saveMeta = () => { try { store.setItem('zlecenia_meta', JSON.stringify(META)); } catch (e) {} };
    const withMeta = st => { const b = Rok.bonuses(META); st.money += b.startCash; st.ledgerMoney = st.money; for (const id of Object.keys(CLIENTS)) st.rel[id] = { trust: b.trust, jobs: 0 }; b.certs.forEach(c => { st.certs[c] = true; }); return st; };
    const ST = fresh();
    /* wczytanie zapisu z migracjami starszych wersji (wcześniej inline w zlecenia.js) */
    function load() {
      let next = fresh();
      try {
        const r = store.getItem('zlecenia_v1');
        if (r) { const saved = JSON.parse(r); next = Object.assign(fresh(), saved); if (saved.starterGiven === undefined) next.starterGiven = false; if (saved.clock === undefined) { next.clock = Czas.startClock() + (saved.done || 0) * 2 * 1440; next.ledgerMoney = next.money; } }
      } catch (e) {}
      replace(next);
      const old = ((ST.hq || {}).assets || {}).narzedzia;
      if (old > 0) { ST.inv = (ST.inv || []).concat([Alledrogo.makeItem({ tier: Math.min(3, old), brand: 'Zestaw z siedziby', cond: (ST.hq.cond == null ? 100 : ST.hq.cond), life: 30, source: 'start', sellerName: 'własne' })]); delete ST.hq.assets.narzedzia; }
      if (ST.hq) delete ST.hq.cond;
      if (!ST.starterGiven) { ST.inv = ST.inv || []; if (!ST.inv.some(i => i.type === 'zestaw')) ST.inv.push(Alledrogo.starterKit()); ST.starterGiven = true; }
      const f = Siedziba.fresh(); ST.hq = Object.assign(f, ST.hq || {}, { up: Object.assign(f.up, (ST.hq || {}).up), assets: Object.assign(f.assets, (ST.hq || {}).assets) }); if (!ST.hist) ST.hist = [];
      if (!ST.monthStart[bookKey()]) ST.monthStart[bookKey()] = ST.money;
    }
    function replace(next) { for (const k of Object.keys(ST)) delete ST[k]; Object.assign(ST, next); }
    const bookKey = () => Czas.dateOf(ST.clock).monthKey;
    function cash(cat, amt) { const before = ST.money; ST.money = Math.max(0, ST.money + amt); const real = ST.money - before; ST.ledger = Ksiega.book(ST.ledger, bookKey(), cat, real); ST.ledgerMoney = ST.money; return real; }
    function syncLedger() { const d = ST.money - (ST.ledgerMoney || 0); if (Math.abs(d) > 0.004) ST.ledger = Ksiega.book(ST.ledger, bookKey(), 'inne', d); ST.ledgerMoney = ST.money; }
    const monthSummary = key => Ksiega.summary(ST.ledger, key || bookKey(), 0);
    function advanceClock(to) {
      const oldKey = bookKey(), oldClock = ST.clock; ST.clock = to; const newKey = bookKey();
      if (newKey !== oldKey) { ST.monthEnd[oldKey] = ST.money; ST.monthStart[newKey] = ST.money; ST.pendingMonths.push(oldKey); }
      { const y0 = Czas.dateOf(oldClock).y, y1 = Czas.dateOf(ST.clock).y; for (let y = y0; y < y1; y++) ST.pendingYears.push(String(y)); }
      ST.day = Czas.dateOf(ST.clock).dayIndex;
    }
    const save = () => { syncLedger(); try { store.setItem('zlecenia_v1', JSON.stringify(ST)); } catch (e) {} };
    const reputation = () => { const r = ST.ratings.slice(-10); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
    const co = () => { const r = Siedziba.rating(ST.hq, ST.hist, ST.ratings, ST.claims.length, Alledrogo.toolScore(ST.inv)); r.stars = Math.min(5, Math.round((r.stars + 0.15 * Ubrania.crewCred(ST.wardrobe, ST.crew, ST.hq.up.szyld || 0)) * 100) / 100); return r; };
    const KT = () => { if (!ST.contracts.others) ST.contracts.others = []; return ST.contracts; };
    const cLimit = () => Kontrakty.slots(ST.hq.tier);
    const specM = jobId => Spec.mods(ST.xp, ST.certs, jobId);
    const specLevels = () => Object.fromEntries(Object.keys(Spec.AREAS).map(k => [k, Spec.level(ST.xp[k] || 0, k, ST.certs)]));
    const extraPay = (l, jobId) => Rok.bonuses(META).payMult * Szkolenia.modsFor(ST.certs, jobId).pay * specM(jobId).pay * Klienci.payMult(Klienci.get(ST.rel, l.client).trust) * (l.priceMult || 1);
    const refBonus = () => Math.min(0.06, Object.values(ST.rel).filter(r => r.trust >= 50).length * 0.02);
    const callP = night => Math.min(0.6, Jobs.callChance(night, co().stars, ST.waited) + refBonus());
    const clothesPrice = () => Sezon.clothesPrice(ST.clock);

    // ---------- okna wyboru jako dane ----------
    /* Pokazuje pytanie; handler dostaje id wybranej opcji. Okno blokuje inne okna (E.ui.modalOpen). */
    function ask(p, handler) { E.ui.modalOpen = true; E.pending = { prompt: p, handler }; if (V().prompt) V().prompt(p); }
    /* Odpowiedź gracza (z widoku lub ze skryptu testowego). */
    function answer(id) { const pn = E.pending; if (!pn) return false; E.pending = null; E.ui.modalOpen = false; pn.handler(id); return true; }

    // ---------- szacunek stawki ----------
    function estimateFor(l, o) {
      o = o || {};
      const job = JOBS[l.job], client = CLIENTS[l.client], night = l.slot === 'noc', mods = Czas.mods(night);
      const start = l.startAt || (l.call ? ST.clock + 20 : Czas.jobStart(ST.clock, l.time, 1)), season = Czas.season(start), rt = co();
      const um = Umowa.evaluate(o.terms || Umowa.DEFAULT, client, () => 1);
      const sea = Kalendarz.demandMult(season, job.id) * Sezon.demand(start, job.id) * Sezon.pay(start), gos = Osiedle.gossipMult(ST.os), cut = 1 - Osiedle.undercut(ST.os, { rating: rt.stars, tier: ST.hq.tier });
      let units = job.deadline * um.deadlineFactor, helperCost = 0;
      if (o.helper) { const he = Ekipa.helperEffect(o.helper, (o.states || {})[o.helper.id]); units *= he.timeFactor; helperCost = Stawka.helperShare(o.helper, night); }
      return Stawka.estimate({ base: Math.round(job.base * l.mult), payMult: rt.payMult * um.payMult * sea * gos * cut * mods.payMult * (l.due ? Terminy.KINDS[l.due].pay : 1) * extraPay(l, l.job), deadlineUnits: units, night, helper: helperCost,
        invoice: (o.terms || Umowa.DEFAULT).invoice, overhead: Stawka.overheadShare(Siedziba.effects(ST.hq).upkeep + Finanse.upkeep(ST.fin)), extraMinutes: 15 });
    }
    const perHourTxt = e => 'ok. ' + signed(e.perHour) + '/h';

    // ---------- czekanie, odpoczynek, urlop, telefony ----------
    function sleepNow() {
      advanceClock(ST.clock + 480); ST.fatigue = Zmeczenie.rest(ST.fatigue, 480, true, Czas.isNight(ST.clock - 240));
      ST.waited = 0; ST.flash.push('😴 Spałeś 8 godzin. Zmęczenie: ' + Zmeczenie.label(ST.fatigue) + ' (' + Math.round(ST.fatigue) + '%).'); save(); menu();
    }
    function dayOffNow() {
      advanceClock(ST.clock + Wypalenie.DAY_OFF.hours * 60); ST.fatigue = Zmeczenie.rest(ST.fatigue, 24 * 60, true, true); ST.burnout = Wypalenie.dayOff(ST.burnout); ST.waited = 0;
      ST.flash.push('🛋️ Dzień wolny. Zmęczenie ' + Math.round(ST.fatigue) + '%, wypalenie ' + Math.round(ST.burnout) + '%. Nikt nie dzwonił, bo nikt cię nie szukał.'); save(); menu();
    }
    function vacationNow() {
      const VC = Wypalenie.VACATION; if (ST.money < VC.cost) return;
      cash('urlop', -VC.cost); advanceClock(ST.clock + VC.days * 1440); ST.fatigue = 0; ST.burnout = Wypalenie.vacation(ST.burnout); ST.waited = 0;
      ST.rel = Klienci.decay(ST.rel, VC.days, VC.trustDecay); ST.os.rival.power += VC.rivalGain; ST.crew = ST.crew.map(w => Object.assign({}, w, { mood: Math.min(100, w.mood + VC.crewMood) }));
      ST.flash.push('🏖️ Urlop: ' + VC.days + ' dni nad jeziorem. Wypoczęty, ale klienci trochę zapomnieli o tobie, a ' + ST.os.rival.name + ' zbierał zlecenia.'); save(); menu();
    }
    /* Godzina czekania: czasem dzwoni klient (okno wyboru), czasem rywal podkrada zlecenie. startJob podaje widok. */
    function waitHour(startJob) {
      advanceClock(ST.clock + 60); ST.fatigue = Zmeczenie.rest(ST.fatigue, 60, false);
      const night = Czas.isNight(ST.clock), hit = rnd() < callP(night);
      if (hit && rnd() < Wypalenie.missCall(ST.burnout)) { ST.flash.push('📵 Telefon dzwonił, ale nie miałeś siły odbierać (wypalenie ' + Math.round(ST.burnout) + '%).'); ST.waited++; save(); menu(); return; }
      if (!hit) { ST.waited++; save(); menu(); return; }
      ST.waited = 0;
      const call = Jobs.rollCall(rnd, co().stars, Czas.isNight(ST.clock + 20)); call.client = Klienci.pick(rnd, Object.keys(CLIENTS), ST.rel); const cl = CLIENTS[call.client], jb = JOBS[call.job];
      call.intro = cl.name + ' dzwoni o ' + Czas.hm(ST.clock) + ': ' + jb.intro; call.time = Czas.hm(ST.clock + 20); call.due = Terminy.roll(rnd, call.slot === 'noc');
      const trust = Klienci.get(ST.rel, call.client).trust, rv = ST.os.rival;
      const contested = rnd() < Klienci.contestChance(rv.power, Osiedle.strength({ rating: co().stars, tier: ST.hq.tier }), trust);
      const est = estimateFor(call);
      const text = (contested ? '⚔️ ' + rv.name + ' też dostał ten telefon! ' : '') + (trust >= 20 ? '(' + Klienci.level(trust) + '.) ' : '') + call.intro + ' (' + (call.slot === 'noc' ? 'noc' : 'dzień') + ', ok. ' + zl(jb.base * call.mult * (call.slot === 'noc' ? Czas.NIGHT.payMult : 1)) + ', stawka po kosztach ' + perHourTxt(est) + ')';
      const choices = contested
        ? [{ id: 'cut', label: 'Zbij cenę o 15% i jedź', sub: 'wygrywasz na pewno, ale zarabiasz mniej' }, { id: 'normal', label: 'Jadę normalnie', sub: 'klient wybiera między wami (' + Math.round(Math.max(20, Math.min(80, 50 + trust / 2))) + '% że ciebie)' }, { id: 'no', label: 'Odpuszczam', sub: 'niech Bogdan ma' }]
        : [{ id: 'go', label: 'Jadę', sub: 'start za 20 minut' }, { id: 'no', label: 'Odmawiam', sub: 'czekasz dalej' }];
      save(); top();
      ask({ kind: 'telefon', title: '📞 Telefon! ' + jb.title, text, choices }, a => {
        if (a === 'go') { startJob(-1, call); return; }
        if (a === 'no') { menu(); return; }
        const res = Klienci.contest(a, trust, rnd);
        if (res.won) { call.priceMult = res.priceMult; startJob(-1, call); }
        else { ST.os.rival.power += 1.5; ST.flash.push('⚔️ Klient wybrał ' + rv.name + '. Szkoda.'); save(); menu(); }
      });
    }

    // ---------- ekipa na własnych zleceniach ----------
    const crewBusy = w => ST.crewJobs.find(j => j.workerId === w.id && j.endAt > ST.clock) || ST.crewJobs.find(j => j.workerId === w.id);
    const crewDeps = () => ({ evaluate: Fuszerka.evaluate, rollClaim: Fuszerka.rollClaim, minutes: u => Czas.minutes(u, false), jobs: JOBS, clients: CLIENTS });
    const crewFree = o => ST.crew.filter(w => !crewBusy(w) && !(w.outJobs > 0) && ZlecEkipy.canDo(w, o.job, ST.certs));
    function ensureBoard() {
      const day = Czas.dateOf(ST.clock).dayIndex; if (ST.board.day === day) return;
      ST.board = { day, offers: ZlecEkipy.makeBoard(day, rnd, co().stars, Object.keys(JOBS), Object.keys(CLIENTS), ZlecEkipy.boardSize(ST.hq.tier)) };
    }
    function pickWorkerFor(id) {
      const o = ST.board.offers.find(x => x.id === id); if (!o) return;
      const free = crewFree(o); if (!free.length) return;
      const choices = free.map(w => { const p = ZlecEkipy.preview(w, 'trzezwy', o, { from: 'baza', certs: ST.certs });
        return { id: w.id, label: w.em + ' ' + w.name + ' · ' + p.label, sub: 'nastrój ' + Math.round(w.mood) + '% · dojazd ' + p.travelMin + ' min · umiejętności ' + Math.round(w.skill * 100) + '% · poziom w obszarze ' + ZlecEkipy.lvl(w, o.job, ST.certs) }; })
        .concat([{ id: '', label: 'Anuluj', sub: 'zostaje na tablicy' }]);
      ask({ kind: 'ekipa-wybor', title: '👷 Kto jedzie: ' + JOBS[o.job].title, text: CLIENTS[o.client].name + ', ' + ZlecEkipy.DISTRICTS[o.district] + '. Pracownik pojedzie sam, wróci z wynikiem. Jakość to szacunek, trzeźwość sprawdzi się w drodze.', choices },
        wid => { if (wid) dispatchCrew(o, ST.crew.find(w => w.id === wid)); else menu(); });
    }
    function dispatchCrew(o, w) {
      const hour = Czas.dateOf(ST.clock).hour; let start = ST.clock; if (hour < 7 || hour >= 17) start = Czas.nextAt(ST.clock, '08:00');
      const state = Swiat.rollState(w, { night: false }, rnd);
      ST.board.offers = ST.board.offers.filter(x => x.id !== o.id);
      if (Ekipa.attendance(w, rnd, {}) === 'absent') { ST.flash.push('👷 ' + w.name + ' nie odebrał telefonu i nie pojechał do ' + CLIENTS[o.client].name + '. Zlecenie przepadło.'); const c0 = Klienci.get(ST.rel, o.client); ST.rel = Object.assign({}, ST.rel, { [o.client]: { trust: Math.max(-100, c0.trust - 4), jobs: c0.jobs } }); save(); menu(); return; }
      const rt = co(), sim = ZlecEkipy.simulate(w, state, o, rnd, crewDeps(), { payMult: rt.payMult, satBonus: rt.satBonus + Ubrania.crewSat(ST.wardrobe, w.id, ST.hq.up.szyld || 0), from: 'baza', clock: start, certs: ST.certs });
      let drive = 0, note = '';
      const dr = Swiat.resolveDrive(w, state, ST.world, 'worker', rnd); drive = dr.cost; if (dr.notes.length && dr.incident) note = dr.notes[dr.notes.length - 1]; if (dr.claim) ST.claims.push(Object.assign({ client: CLIENTS[o.client].name, due: ST.done + 1 }, dr.claim)); Swiat.tickWorld(ST.world, dr.heatDelta);
      if (Object.keys(dr.driverPatch).length) ST.crew = ST.crew.map(x => x.id === w.id ? Object.assign({}, x, dr.driverPatch) : x);
      ST.wardrobe = Ubrania.uniformAfterJob(ST.wardrobe, w.id, o.job);
      const endAt = sim.endAt + Math.max(0, dr.timeAdj), failed = !!(dr.accident && dr.accident.severity === 'ciezki');
      ST.crewJobs.push({ id: o.id, workerId: w.id, offer: o, startAt: start, endAt, stars: failed ? 1 : sim.r.stars, index: sim.r.index, payout: failed ? 0 : sim.payout, cost: failed ? 0 : sim.cost, fuel: sim.fuel + drive, trav: sim.travelMin, failed, claim: sim.claimInfo ? sim.claimInfo : null, defects: sim.r.defects.length, drunk: state !== 'trzezwy' ? state : null, note, finished: false });
      ST.flash.push('👷 ' + w.name + ' jedzie do ' + CLIENTS[o.client].name + ' (' + JOBS[o.job].title + '), wróci ok. ' + Czas.hm(endAt) + '.' + (state !== 'trzezwy' ? ' Uwaga: ' + Swiat.LABEL[state] + '.' : ''));
      save(); top(); menu();
    }
    /* Odbiór wyników ekipy, której czas minął: wypłaty, materiały, reklamacje, oceny. */
    function collectCrew() {
      if (E.ui.modalOpen) return false;
      const due = ST.crewJobs.filter(j => j.endAt <= ST.clock); if (!due.length) return false;
      const lines = []; ST.crewJobs = ST.crewJobs.filter(j => j.endAt > ST.clock);
      for (const j of due) {
        const w = ST.crew.find(x => x.id === j.workerId), cl = CLIENTS[j.offer.client];
        if (j.failed) { cash('transport', -j.fuel); ST.ratings.push(1); const c0 = Klienci.get(ST.rel, cl.id); ST.rel = Object.assign({}, ST.rel, { [cl.id]: { trust: Math.max(-100, c0.trust - 8), jobs: c0.jobs } });
          lines.push((w ? w.name : '?') + ': ' + JOBS[j.offer.job].title + ' u ' + cl.name + ': wypadek w drodze, zlecenie nie doszło do skutku (klient wściekły, zaufanie −8).'); continue; }
        cash('zlecenia', j.payout); cash('materialy', -j.cost); cash('transport', -j.fuel); ST.ratings.push(j.stars); ST.done++; ST.hist.push({ index: j.index }); ST.hist = ST.hist.slice(-12);
        ST.fin = Finanse.addIncome(ST.fin, j.payout, true); ST.rel = Klienci.afterJob(ST.rel, cl.id, j.stars, Osiedle.GOSSIP[cl.id]);
        if (j.claim) ST.claims.push(Object.assign({ client: cl.name, due: ST.done + 1 }, j.claim));
        if (w) ST.crew = ST.crew.map(x => x.id === w.id ? Object.assign({}, ZlecEkipy.addXp(x, j.offer.job, j.stars), { mood: Math.max(0, x.mood - 2) }) : x);
        lines.push((w ? w.name : '?') + ': ' + JOBS[j.offer.job].title + ' u ' + cl.name + ' ' + stars(j.stars) + ', wpływ ' + zl(j.payout - j.cost - j.fuel) + (j.claim ? ' (grozi reklamacja)' : '') + (j.note ? ' ' + j.note : ''));
      }
      save(); top();
      ask({ kind: 'ekipa-wrocila', title: '👷 Ekipa wróciła', text: lines.join('\n'), choices: [{ id: 'ok', label: 'Dalej' }] }, () => menu());
      return true;
    }

    // ---------- rok firmy, prestiż, Nowa Gra+ ----------
    function yearStats() {
      const rr = ST.ratings.slice(-80), hh = (ST.hist || []).slice(-30), done = KT().done;
      return { avgStars: rr.length ? rr.reduce((a, b) => a + b, 0) / rr.length : 0, claimsOpen: ST.claims.length, avgIndex: hh.length ? hh.reduce((a, b) => a + b.index, 0) / hh.length : null,
        tendersWon: Object.entries(done).filter(([k]) => k.startsWith('p_')).reduce((s, [, v]) => s + v.count, 0), contractsDone: Object.entries(done).filter(([k]) => !k.startsWith('p_')).reduce((s, [, v]) => s + v.count, 0) };
    }
    function checkYear() {
      if (E.ui.modalOpen || !ST.pendingYears.length) return false;
      syncLedger(); const yr = ST.pendingYears.shift(), sm = Rok.summary(ST.ledger, yr); if (!sm.months) return checkYear();
      const st = yearStats(), rk = Rok.ranking(sm, ST.os.rival.power, +yr), aw = Rok.awards(sm, st), pts = Rok.prestige(sm, st, aw, rk.rank);
      META.points += pts; META.years.push({ year: yr, plus: sm.plus, rank: rk.rank, pts }); saveMeta(); save();
      const fm = k => Czas.monthName(k);
      const text = 'Zysk roku: ' + (sm.plus >= 0 ? '+' : '−') + zl(Math.abs(sm.plus)) + ' (przychody ' + zl(sm.income) + ', koszty ' + zl(-sm.costs) + '). Zleceń: ' + sm.jobs + ', stawka po kosztach ' + sm.perHour + ' zł/h.' + (sm.best ? ' Najlepszy miesiąc: ' + fm(sm.best.key) + ' (' + zl(sm.best.plus) + ').' : '');
      const rows = rk.rows.map((r, i) => ({ label: (i + 1) + '. ' + r.name, you: !!r.you, value: zl(r.plus), pos: r.plus >= 0 }));
      const tail = (aw.length ? 'Nagrody: ' + aw.map(a => '🏅 ' + a.name).join(', ') + '. ' : 'Bez nagród w tym roku. ') + 'Punkty prestiżu: +' + pts + ' (razem ' + META.points + ').';
      ask({ kind: 'rok', title: '🏆 Podsumowanie roku ' + yr, text, rows, tail, year: yr, points: pts, choices: [{ id: 'ok', label: 'Dalej', sub: 'gramy dalej ten sam rok firmy' }, { id: 'pr', label: '🏆 Prestiż i Nowa Gra+', sub: 'perki za punkty, nowy start z bonusami' }] },
        a => { if (a === 'pr') (V().screen || (() => {}))('prestige'); else menu(); });
      return true;
    }
    function buyPerk(id) { const r = Rok.buy(META, id); if (r.ok) { Object.assign(META, r.meta); saveMeta(); } return !!r.ok; }
    function askNewGamePlus() {
      const b = Rok.bonuses(META);
      ask({ kind: 'ngp', title: 'Nowa Gra+?', text: 'Obecna firma zostanie zamknięta. Zaczynasz od zera z bonusami z perków (' + (b.startCash ? '+' + b.startCash + ' zł, ' : '') + 'wypłaty ×' + b.payMult.toFixed(2).replace('.', ',') + ').', choices: [{ id: 'yes', label: 'Zaczynam nową grę', sub: 'prestiż i perki zostają' }, { id: 'no', label: 'Jeszcze nie', sub: 'wracasz' }] },
        a => { if (a === 'yes') { META.games++; saveMeta(); replace(withMeta(fresh())); save(); } menu(); });
    }

    // ---------- przetargi i kontrakty ----------
    const tenderCtx = cid => ({ stars: co().stars, tier: ST.hq.tier, spec: specLevels(), trust: Klienci.get(ST.rel, cid).trust, rivalPower: ST.os.rival.power, outfit: Ubrania.effect(Ubrania.current(ST.wardrobe), cid, { formal: true }).tender });
    function askTender(id) {
      const t = Przetargi.TENDERS[id], ctx = tenderCtx(t.client);
      const choices = Object.entries(Przetargi.BIDS).map(([k, b]) => { const tm = Przetargi.terms(t, k, JOBS); return { id: k, label: b.name, sub: 'szansa ' + Math.round(Przetargi.winChance(k, ctx) * 100) + '% · wartość ok. ' + zl(Math.round(tm.quote.expected * b.mult)) + ' · wadium ' + zl(tm.wadium) }; }).concat([{ id: '', label: 'Rezygnuję', sub: 'bez kosztów' }]);
      ask({ kind: 'przetarg', title: '🏛️ ' + t.title, text: t.desc + ' Wybierz ofertę: niższa cena zwiększa szansę, ale obniża wypłatę. Wadium płacisz przy wygranej, zwrot po zaliczonym audycie. Rywal: ' + ST.os.rival.name + '.', choices }, bid => {
        if (!bid) { menu(); return; }
        const day = Czas.dateOf(ST.clock).dayIndex, res = Przetargi.bid(bid, ctx, rnd); ST.tenderCool[id] = day;
        if (!res.won) { ST.os.rival.power += 1.5; ST.flash.push('🏛️ Przetarg „' + t.title.replace('Przetarg: ', '') + '” wygrał ' + ST.os.rival.name + ' (twoja szansa: ' + Math.round(res.chance * 100) + '%).'); save(); menu(); return; }
        const tm = Przetargi.terms(t, bid, JOBS), r = Kontrakty.accept(KT(), Przetargi.cid(id), ST.clock, JOBS, { priceMult: tm.priceMult, wadium: tm.wadium }, cLimit());
        if (!r.ok) { ST.flash.push(r.reason); menu(); return; }
        ST.contracts = r.state; cash('wadium', -tm.wadium); cash('zlecenia', r.deposit); ST.flash.push('🏛️ Wygrany przetarg „' + t.title.replace('Przetarg: ', '') + '”! Wadium ' + zl(tm.wadium) + ', zaliczka ' + zl(r.deposit) + '.'); save(); top(); menu();
      });
    }
    function askContract(id) {
      const c = Kontrakty.CONTRACTS[id], q = Kontrakty.quote(c, JOBS); if (!Kontrakty.canAccept(KT(), cLimit())) { ST.flash.push('Masz już aktywny kontrakt (limit ' + cLimit() + ').'); menu(); return; }
      ask({ kind: 'kontrakt', title: '📋 ' + c.title, text: CLIENTS[c.client].name + ': ' + c.desc + ' Zaliczka ' + zl(q.deposit) + ' wpływa od razu. Za każdy etap dostajesz transzę (' + Math.round(Kontrakty.TRANCHE * 100) + '% zwykłej wypłaty). Termin całości: ' + c.deadline + ' dni. Spóźnienie: kara ' + Math.round(Kontrakty.LATE_PCT * 100) + '% wartości za dzień. Czysty odbiór w terminie: premia ' + Math.round(Kontrakty.BONUS * 100) + '%. Ukryte wady z każdego etapu mogą wyjść dopiero przy odbiorze.',
        choices: [{ id: 'yes', label: 'Przyjmij kontrakt', sub: 'zaliczka ' + zl(q.deposit) }, { id: 'no', label: 'Nie teraz', sub: 'wracasz do listy' }] }, a => {
        if (a === 'yes') { const r = Kontrakty.accept(KT(), id, ST.clock, JOBS, {}, cLimit()); if (r.ok) { ST.contracts = r.state; cash('zlecenia', r.deposit); ST.flash.push('📋 Przyjęty kontrakt „' + c.title + '”. Zaliczka ' + zl(r.deposit) + '.'); save(); top(); } }
        menu();
      });
    }
    function askCancel() {
      const a = KT().active, pen = Math.round(a.deposit + a.nominal * 0.1 + (a.wadium || 0));
      ask({ kind: 'kontrakt-rezygnacja', title: 'Zrezygnować z kontraktu?', text: 'Oddasz zaliczkę ' + zl(a.deposit) + ' i zapłacisz karę umowną: razem ' + zl(pen) + '. Klient nie zapomni.', choices: [{ id: 'yes', label: 'Zrezygnuj', sub: '−' + zl(pen) + ', zaufanie klienta −15' }, { id: 'no', label: 'Zostaję', sub: 'kontrakt trwa' }] }, ans => {
        if (ans === 'yes') { const cid = CLIENTS[Kontrakty.CONTRACTS[a.id].client].id, r = Kontrakty.cancel(KT()); cash('kary', -r.penalty); ST.contracts = r.state; const c0 = Klienci.get(ST.rel, cid); ST.rel = Object.assign({}, ST.rel, { [cid]: { trust: Math.max(-100, c0.trust - 15), jobs: c0.jobs } }); ST.ratings.push(2); ST.flash.push('📋 Zrezygnowałeś z kontraktu. Kara ' + zl(r.penalty) + '.'); save(); top(); }
        menu();
      });
    }
    function switchContract(id) { ST.contracts = Kontrakty.switchTo(KT(), id); save(); menu(); }
    /* Odbiór końcowy po ostatnim etapie: wyłapywanie ukrytych wad, kara za opóźnienie albo premia. */
    function checkContractFinal() {
      const a = KT().active; if (!a || E.ui.modalOpen || a.stage < Kontrakty.CONTRACTS[a.id].stages.length) return false;
      const c = Kontrakty.CONTRACTS[a.id], cl = CLIENTS[c.client], f = Kontrakty.final(KT(), ST.clock, cl, rnd);
      ST.contracts = f.state; if (f.bonus) cash('zdarzenia', f.bonus); if (f.rework) cash('reklamacje', -f.rework); if (f.latePenalty) cash('kary', -f.latePenalty); if (f.auditPenalty) cash('kary', -f.auditPenalty); if (f.wadiumBack) cash('wadium', f.wadiumBack); if (f.failed) ST.ratings.push(1);
      ST.ratings.push(f.stars); ST.rel = Klienci.afterJob(ST.rel, cl.id, f.stars, Osiedle.GOSSIP[cl.id]); save(); top();
      ask({ kind: 'odbior', title: '📋 Odbiór końcowy: ' + c.title, text: cl.name + ' ocenia całość na ' + stars(f.stars) + ' (średnia etapów ' + f.avg.toFixed(1).replace('.', ',') + '). ' + (f.notes.join(' ') || 'Bez uwag.') + (f.wadiumBack ? ' Wadium ' + zl(f.wadiumBack) + ' wraca.' : '') + ' Wynik odbioru: ' + (f.net >= 0 ? '+' : '−') + zl(Math.abs(f.net)) + '.', result: f, choices: [{ id: 'ok', label: 'Dalej' }] }, () => menu());
      return true;
    }

    // ---------- szafa i sklep z ubraniami ----------
    /* op: wear | wash | sell | buy | lump | uni; arg: uid, id oferty albo „worker:uid”. Zwraca true, gdy coś się zmieniło. */
    function wardrobeCmd(op, arg) {
      const W = ST.wardrobe; let r;
      if (op === 'wear') { ST.wardrobe = Ubrania.wear(W, +arg); save(); return true; }
      if (op === 'wash') { r = Ubrania.wash(W, +arg, ST.money); if (r.ok) { cash('ubrania', -r.cost); ST.wardrobe = r.w; save(); top(); } return !!r.ok; }
      if (op === 'sell') { r = Ubrania.sell(W, +arg); if (r.ok) { cash('zakupy', r.price); ST.wardrobe = r.w; save(); top(); } return !!r.ok; }
      if (op === 'buy') { r = Ubrania.buy(W, arg, ST.money, clothesPrice()); if (r.ok) { cash('zakupy', -r.cost); ST.wardrobe = Ubrania.wear(r.w, r.item.uid); save(); top(); } return !!r.ok; }
      if (op === 'lump') { const l = Ubrania.lumpeks(Czas.dateOf(ST.clock).dayIndex).find(x => x.id === +arg); if (!l) return false; r = Ubrania.buy(W, l.outfit, ST.money, 1, { price: l.price, cond: l.cond, smell: l.smell }); if (r.ok) { cash('zakupy', -r.cost); ST.wardrobe = Object.assign({}, r.w, { bought: (r.w.bought || []).concat([l.id]) }); save(); top(); } return !!r.ok; }
      if (op === 'uni') { const [wid, uid] = String(arg).split(':'); r = Ubrania.buyUniform(W, wid, uid, ST.money); if (r.ok) { cash('zakupy', -r.cost); ST.wardrobe = r.w; save(); top(); } return !!r.ok; }
      return false;
    }

    function applyToolSale() { const f = Sezon.toolPrice(ST.clock); if (f < 1 && ST.market) ST.market.listings.forEach(l => { if (!l.sale) { l.price = Math.round(l.price * f); l.sale = f; } }); }
    function settleJob(cur) {
    const night = cur.night, mods = Czas.mods(night);
    const units = Math.max(1, cur.time + cur.timeAdj), minutes = Czas.minutes(units, night), endClock = cur.startClock + minutes;
    // zegar: koniec zlecenia i ewentualna zmiana miesiąca
    advanceClock(endClock);
    const job = Object.assign({}, cur.job, { base: Math.round(cur.job.base * cur.mult), deadline: cur.deadline });
    const rt = co(), um = cur.umowa || { payMult: 1, satDelta: 0, taxRiskDelta: 0 };
    const sea = Kalendarz.demandMult(cur.season, cur.job.id) * Sezon.demand(cur.startClock, cur.job.id) * Sezon.pay(cur.startClock), gos = Osiedle.gossipMult(ST.os), cut = 1 - Osiedle.undercut(ST.os, { rating: rt.stars, tier: ST.hq.tier });
    const payMult = Math.round(rt.payMult * um.payMult * sea * gos * cut * mods.payMult * (cur.dueSpec ? cur.dueSpec.pay : 1) * extraPay(cur.level, cur.job.id) * cur.outfit.pay * 1000) / 1000;
    const hz = Alledrogo.totalBonus(cur.tools.filter(tl => !cur.brokenTools[tl.id])).hazardMult * mods.hazard * Szkolenia.modsFor(ST.certs, cur.job.id).hazard * specM(cur.job.id).hazard;
    const helperSat = cur.helperOn && cur.helper ? Ubrania.crewSat(ST.wardrobe, cur.helper.id, ST.hq.up.szyld || 0) : 0;
    const r = Fuszerka.evaluate(job, cur.picks, cur.client, { time: Math.round(cur.timeAdj), defects: cur.extraDefects, satBonus: rt.satBonus + um.satDelta + cur.outfit.satBonus + helperSat, payMult, hazardMult: hz, attentionMult: mods.attention * cur.outfit.attention });
    const te = Terminy.evaluate(cur.dueSpec, minutes, r.payout);
    const comment = Fuszerka.clientComment(cur.client, r, rnd);
    const claim = Fuszerka.rollClaim(r, rnd);
    cash('zlecenia', r.payout); cash('materialy', -r.cost);
    if (te.penalty) { cash('kary', -te.penalty); cur.notes.push('⏰ Spóźniłeś się o ' + Czas.fmtMin(te.lateMin) + ' (termin był do ' + Czas.hm(cur.dueSpec.dueAt) + '). Kara umowna: −' + zl(te.penalty) + '.'); }
    if (te.bonus) { cash('zdarzenia', te.bonus); cur.notes.push('⏰ Skończone przed czasem. Premia za terminowość: +' + zl(te.bonus) + '.'); }
    if (cur.dueSpec && te.onTime && !te.bonus) cur.notes.push('⏰ Zdążyłeś na czas (do ' + Czas.hm(cur.dueSpec.dueAt) + ').'); ST.ratings.push(r.stars); ST.done++;
    if (ST.fav.materials) { const back = Math.round(r.cost * 0.1); cash('materialy', back); if (back) cur.notes.push('📦 Waldek dał zniżkę na materiały: +' + zl(back) + '.'); ST.fav.materials = false; }
    ST.fin = Finanse.addIncome(ST.fin, r.payout, cur.terms.invoice); ST.fin.tax.risk = Math.min(100, ST.fin.tax.risk + (cur.umowa ? cur.umowa.taxRiskDelta : 0));
    ST.os = Osiedle.updateGossip(ST.os, { stars: r.stars, gossipy: Osiedle.GOSSIP[cur.client.id], scandal: !!cur.scandal });
    if (cur.mystery) { const my = Fabula.resolveMystery(r); cash('zdarzenia', my.money); ST.os.gossip = Math.max(0, Math.min(100, ST.os.gossip + my.gossip)); cur.notes.push(my.text); }
    ST.hist.push({ index: r.index }); ST.hist = ST.hist.slice(-12);
    let toolWearCost = 0;
    if (cur.tools.length) {
      const ids = cur.tools.map(tl => tl.id), beforeT = ST.inv.filter(it => ids.indexOf(it.id) >= 0);
      ST.inv = ST.inv.map(it => ids.indexOf(it.id) >= 0 ? Alledrogo.wear(it) : it);
      toolWearCost = Stawka.toolWear(beforeT, ST.inv.filter(it => ids.indexOf(it.id) >= 0), Alledrogo.value);
      ST.inv.filter(it => ids.indexOf(it.id) >= 0 && it.status === 'zepsute' && !cur.brokenTools[it.id]).forEach(it => cur.notes.push('🔧 „' + it.brand + '” po tej robocie przestało działać. Tak to bywa z używanym sprzętem.'));
    }
    if (night && cur.helper && cur.helperPaid) { ST.crew = ST.crew.map(w => w.id === cur.helper.id ? Object.assign({}, w, { mood: Math.max(0, w.mood - mods.moodHit) }) : w); cur.notes.push('😴 Praca w nocy zmęczyła ekipę (nastrój −' + mods.moodHit + ').'); }
    const dl = Alledrogo.tickOrders(ST.orders, rnd); ST.orders = dl.orders;
    dl.arrived.forEach(a => {
      if (a.lost) { const rf = Alledrogo.refundLost(a.order); cash('zakupy', rf.refund); ST.flash.push('📦 Paczka z „' + a.order.brand + '” zaginęła. Sprzedawca oddał ' + zl(rf.refund) + '.'); }
      else { ST.inv.push(a.item); ST.flash.push('📦 Dotarła paczka: „' + a.item.brand + '”. Rozpakuj w Alledrogo.'); }
    });
    dl.events.filter(e => e.type === 'damaged').forEach(e => ST.flash.push(e.text));
    ST.market = Alledrogo.refresh(ST.market, ST.day); applyToolSale();
    const th = Siedziba.resolveTheft(ST.hq, rnd, Alledrogo.inventoryValue(ST.inv));
    if (th) {
      ST.hq = th.hq; cash('kradziez', -th.net);
      if (th.itemStolen && ST.inv.length) { const top = ST.inv.slice().sort((a, b) => Alledrogo.value(b) - Alledrogo.value(a))[0]; ST.inv = ST.inv.filter(x => x.id !== top.id); cur.notes.push('🕵️ Złodziej zabrał też „' + top.brand + '”.'); }
      cur.notes.push('🕵️ W nocy ktoś włamał się do siedziby: strata ' + zl(th.loss) + (th.recovered ? ', ale kamery pomogły odzyskać ' + zl(th.recovered) : '') + '.' + (th.cameras ? '' : ' Kamery i mocniejsze drzwi by pomogły.'));
    }
    ST.crew = Swiat.tickWorkers(ST.crew); Swiat.tickWorld(ST.world, 0); ST.where = cur.district || ST.where;
    if (cur.i >= 0) { const prev = ST.best[cur.i];
      if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.index < prev.index)) ST.best[cur.i] = { stars: r.stars, index: r.index };
      ST.unlocked = Math.max(ST.unlocked, cur.i + 2); }
    ST.waited = 0;
    { const a0 = specM(cur.job.id).level; ST.xp = Spec.addXp(ST.xp, cur.job.id, r.stars, !!cur.level.contract); const a1 = specM(cur.job.id).level;
      if (a1 > a0) cur.notes.push('🎓 Specjalizacja „' + Spec.AREAS[Spec.areaOf(cur.job.id)].name + '”: poziom ' + a1 + '!'); }
    if (cur.helperOn && cur.helper) ST.crew = ST.crew.map(x => x.id === cur.helper.id ? ZlecEkipy.addXp(x, cur.job.id, r.stars, true) : x);
    { const aj = Ubrania.afterJob(ST.wardrobe, cur.job.id, rnd); ST.wardrobe = aj.w; cur.notes.push(...aj.notes); if (cur.helperOn && cur.helper) ST.wardrobe = Ubrania.uniformAfterJob(ST.wardrobe, cur.helper.id, cur.job.id); }
    if (cur.level.contract) { const rs = Kontrakty.recordStage(KT(), r, r.payout); ST.contracts = rs.state; cur.notes.push('📋 Kontrakt „' + cur.level.contract.title + '”: etap ' + (cur.level.contract.stage + 1) + '/' + cur.level.contract.of + ' zakończony (' + stars(r.stars) + ', transza ' + zl(r.payout) + ').' + (rs.last ? ' To był ostatni etap, czas na odbiór.' : '')); }
    { const before = Klienci.level(Klienci.get(ST.rel, cur.client.id).trust); ST.rel = Klienci.afterJob(ST.rel, cur.client.id, r.stars, Osiedle.GOSSIP[cur.client.id]); const after = Klienci.level(Klienci.get(ST.rel, cur.client.id).trust);
      if (before !== after) cur.notes.push('🤝 ' + cur.client.name + ': teraz „' + after + '” (zaufanie ' + Klienci.get(ST.rel, cur.client.id).trust + ').'); }
    ST.fatigue = Zmeczenie.gain(ST.fatigue, minutes, night); ST.burnout = Wypalenie.afterJob(ST.burnout, ST.fatigue, night);
    if (claim) ST.claims.push(Object.assign({ client: cur.client.name, due: ST.done + 1 }, claim));
    // ile zostaje po wszystkich kosztach i stawka godzinowa
    const eco = Stawka.jobEconomics({ payout: r.payout + te.bonus, penalty: te.penalty, materials: r.cost, transport: cur.transportCost, helper: cur.helperPaid, tools: toolWearCost, tax: cur.terms.invoice ? r.payout * Umowa.TAX_RATE : 0,
      overhead: Stawka.overheadShare(Siedziba.effects(ST.hq).upkeep + Finanse.upkeep(ST.fin)), minutes });
    ST.ledger = Ksiega.noteJob(ST.ledger, bookKey(), eco.net, eco.hours);
      // ile czasu i materiałów zaoszczędzono względem solidnej roboty („dobrze” w każdym kroku)
      let su = 0, sc = 0; cur.picks.forEach((pk, i) => { const st = cur.job.steps[i]; if (!st) return; const good = st.options.find(o => o.id === 'dobrze'), got = st.options.find(o => o.id === pk.optionId); if (good && got) { su += good.time - got.time; sc += good.cost - got.cost; } });
      const saved = { units: Math.max(0, su), minutes: su > 0 ? Czas.minutes(su, night) : 0, cost: Math.max(0, Math.round(sc)), value: su > 0 ? Math.round(Czas.minutes(su, night) / 60 * Math.max(0, eco.grossPerHour)) : 0 };
      return { night, mods, units, minutes, endClock, rt, um, sea, gos, cut, payMult, r, te, comment, eco, saved };
    }

    const formalCtx = l => !!(l && l.contract && Kontrakty.CONTRACTS[l.contract.id] && Kontrakty.CONTRACTS[l.contract.id].tender);
    const outfitFx = cur => Ubrania.effect(Ubrania.current(ST.wardrobe), cur.client.id, { formal: formalCtx(cur.level), job: cur.job.id });
    function applyOption(cur, opt, accuracy) {
    const mods = Czas.mods(cur.night);
    if (cur.helperOn && cur.helper) {
      const he = Ekipa.helperEffect(cur.helper, cur.states[cur.helper.id]);
      const sl = Ekipa.sloppy(cur.helper, cur.states[cur.helper.id], rnd);
      if (sl) { cur.extraDefects.push(sl); cur.notes.push('🙄 ' + sl.label + '.'); }
      const fr = Ekipa.moralFriction(cur.helper, opt.id);
      if (fr) { cur.helper = Object.assign({}, cur.helper, { mood: Math.max(0, cur.helper.mood - fr), grudge: Math.min(100, (cur.helper.grudge || 0) + 3) }); ST.crew = ST.crew.map(x => x.id === cur.helper.id ? cur.helper : x); cur.notes.push('😒 ' + cur.helper.name + ' krzywi się na fuszerkę: „Ja tak nie robię.”'); }
      if (opt.skill) accuracy = Math.max(0, Math.min(1, accuracy + he.accBonus));
      cur.timeAdj -= Math.round(opt.time * (1 - he.timeFactor) * 10) / 10;
    }
    cur.tools.forEach(tl => {
      if (cur.failAt[tl.id] === cur.step && !cur.brokenTools[tl.id]) {
        cur.brokenTools[tl.id] = true; ST.inv = ST.inv.map(x => x.id === tl.id ? Alledrogo.breakItem(x) : x); cur.timeAdj += 4;
        cur.extraDefects.push({ label: 'narzędzie „' + tl.brand + '” padło w trakcie roboty', sev: 1.5, vis: 0.5 });
        cur.notes.push('🔧💥 „' + tl.brand + '” padło w trakcie roboty (kupione ' + (tl.source === 'sklep' ? 'w sklepie' : 'od: ' + tl.sellerName) + '). Dwadzieścia minut w plecy.');
      }
    });
    const tb = Alledrogo.totalBonus(cur.tools.filter(tl => !cur.brokenTools[tl.id]));
    if (opt.skill) accuracy = Math.max(0, Math.min(1, accuracy + tb.acc - mods.accPenalty + Zmeczenie.accMod(ST.fatigue) + Wypalenie.accMod(ST.burnout) + Szkolenia.modsFor(ST.certs, cur.job.id).acc + specM(cur.job.id).acc));
    if (rnd() < Zmeczenie.nodChance(ST.fatigue)) { cur.extraDefects.push({ label: 'przysnąłeś przy robocie i coś ci umknęło', sev: 2, vis: 0.5 }); cur.notes.push('😴 Zasnąłeś na stojąco. Zmęczenie ' + Math.round(ST.fatigue) + '%. Czas na sen.'); }
    cur.timeAdj -= Math.round(opt.time * (tb.time + specM(cur.job.id).time) * 10) / 10;
    cur.picks.push({ stepId: cur.job.steps[cur.step].id, optionId: opt.id, accuracy });
    cur.time += opt.time; cur.cost += opt.cost;
    cur.timeAdj += Math.round(opt.time * (Zmeczenie.timeMult(ST.fatigue) * Wypalenie.timeMult(ST.burnout) - 1) * 10) / 10; // zmęczony i wypalony pracuje wolniej
    // wystawienie na robotę: po połowie kroków wkurzony pomocnik znika
    if (cur.helperOn && cur.helper && cur.step + 1 === Math.floor(cur.job.steps.length / 2) && Ekipa.walksOut(cur.helper, rnd)) {
      cur.helperOn = false; cur.timeAdj += 6;
      cur.extraDefects.push({ label: 'bałagan po ekipie, która zniknęła w trakcie', sev: 1.5, vis: 0.6 });
      cur.notes.push('🚪 ' + cur.helper.name + ' rzucił robotę w połowie: „Za takie pieniądze to ja nie będę.” Kończysz sam i tracisz pół godziny.');
      cur.helper = Object.assign({}, cur.helper, { mood: Math.max(0, cur.helper.mood - 10) });
      ST.crew = ST.crew.map(w => w.id === cur.helper.id ? cur.helper : w);
    }
    opt.fx.split(' ').forEach(t => cur.tokens.add(t));
    if (opt.fx.includes('seal-') || opt.fx === 'tape' || opt.fx === 'glue') cur.tokens.delete('broken'); // przestało kapać
    cur.step++;
      if (cur.step >= cur.job.steps.length) return { done: true };
    let sp = Jobs.rollSurprise(cur.job.id, cur.step - 1, rnd);
    if (!sp && cur.chain && cur.chain.at === cur.step - 1 && rnd() < 0.75) sp = Jobs.getSurprise(cur.job.id, cur.chain.id); // następstwo wcześniejszej decyzji
    if (cur.chain && cur.chain.at <= cur.step - 1) cur.chain = null;
    
      return sp ? { surprise: sp } : {};
    }
    function newJob(i, call) {
    const l = call || LEVELS[i], night = l.slot === 'noc';
    const cur = { i: call ? -1 : i, level: l, job: JOBS[l.job], client: CLIENTS[l.client], mult: l.mult, step: 0, picks: [], tokens: new Set(['broken']), time: 0, cost: 0,
      helper: null, helperOn: false, helperPaid: 0, timeAdj: 0, extraDefects: [], notes: [], states: {}, night, intro: l.intro || JOBS[l.job].intro, transportCost: 0, scandal: false };
    cur.startClock = call ? (call.startAt || ST.clock + 20) : Czas.jobStart(ST.clock, l.time, 1);
    if (l.contract) { cur.notes.push('📋 Kontrakt „' + l.contract.title + '”, etap ' + (l.contract.stage + 1) + '/' + l.contract.of + '.'); cur.intro = CLIENTS[l.client].name + ' (kontrakt „' + l.contract.title + '”, etap ' + (l.contract.stage + 1) + '): ' + JOBS[l.job].intro; }
    cur.outfit = outfitFx(cur); ST.world.night = night; cur.dueSpec = l.due ? Terminy.make(cur.job.deadline, cur.startClock, l.due, night) : null;
    ST.crew.forEach(w => { cur.states[w.id] = Swiat.rollState(w, { paydayEve: ST.lastPayDone === ST.done, night }, rnd); });
    cur.season = Czas.season(cur.startClock); cur.deadline = cur.job.deadline; cur.umowa = null; cur.terms = Object.assign({}, Umowa.DEFAULT);
    cur.mystery = Fabula.rollMystery({ done: ST.done }, rnd);
    cur.tools = Alledrogo.forJob(ST.inv, cur.job.id); cur.failAt = {}; cur.brokenTools = {};
    cur.tools.forEach(tl => { cur.failAt[tl.id] = rnd() < Alledrogo.failChance(tl) ? Math.floor(rnd() * cur.job.steps.length) : -1; });
    { const dist = ZlecEkipy.districtOf(l.client), trav = l.contract && l.contract.stage > 0 ? 0 : ZlecEkipy.travel(ST.where, dist); cur.district = dist; cur.travelMin = trav;
      if (trav) { cur.timeAdj += trav / Czas.TIME_SCALE; cur.fuel = Math.round(trav * ZlecEkipy.FUEL_PER_MIN); cash('transport', -cur.fuel); cur.transportCost += cur.fuel; cur.notes.push('🚗 Dojazd z ' + ZlecEkipy.DISTRICTS[ST.where] + ' (' + trav + ' min, paliwo ' + zl(cur.fuel) + ').'); } }
    if (cur.tools.length) cur.notes.push('🧰 Bierzesz ze sobą: ' + cur.tools.map(tl => tl.brand).join(', ') + '.');
    const wx = Kalendarz.weather(cur.season, rnd); if (wx.delay) { cur.timeAdj += wx.delay; cur.notes.push(wx.text); }
      return cur;
    }

    function weekly() {
      const notes = [];
      if (ST.oc.active) { const pr = Ubezp.premium(ST.oc); cash('ubezpieczenie', -pr); notes.push('🛡️ Składka OC: −' + zl(pr) + '.'); }
      ST.oc = Ubezp.decay(ST.oc);
      const s = Finanse.settle(ST.fin, Math.floor(ST.money)); ST.fin = s.fin; cash('odsetki', -s.paid); if (s.paid) notes.push('💳 Raty pożyczek: −' + zl(s.paid) + '.');
      ST.fin.loans.forEach(l => { const c = Finanse.collection(l); if (c) { const loss = Math.round(ST.money * c.moneyPct); cash('kary', -loss); notes.push(c.text + (loss ? ' −' + zl(loss) + '.' : '')); l.missed = 1; if (l.lender === 'gienek') ST.os.gossip = Math.max(0, ST.os.gossip - 4); } });
      const tp = Finanse.payTax(ST.fin, ST.money); ST.fin = tp.fin; cash('podatki', -tp.paid); if (tp.paid) notes.push('🧾 Podatek od faktur: −' + zl(tp.paid) + '.');
      const au = Finanse.rollAudit(ST.fin, { cover: !!ST.fav.audit, force: ST.forceAudit }, rnd); ST.fin = au.fin; ST.forceAudit = false;
      if (au.audit) { cash('kary', -au.audit.penalty); notes.push(au.audit.text); ST.os.gossip = Math.max(0, ST.os.gossip - 5); ST.fav.audit = false; }
      ST.fin = Finanse.decayRisk(ST.fin);
      const ac = Finanse.upkeep(ST.fin); if (ac) { cash('utrzymanie', -ac); notes.push('Księgowa: −' + zl(ac) + '.'); }
      const rv = Osiedle.tickRival(ST.os, { rating: co().stars, tier: ST.hq.tier, crew: ST.crew }, rnd); ST.os = rv.os;
      rv.events.forEach(ev => {
        if (ev.type === 'poach') { const w = ST.crew.find(x => x.id === ev.id); if (w) { ST.crew = ST.crew.filter(x => x.id !== ev.id); notes.push('🦈 ' + ST.os.rival.name + ' podkupił ' + w.name + '. Niezadowoleni odchodzą tam, gdzie płacą lepiej.'); } }
        if (ev.type === 'sabotage') { cash('kary', -ev.cost); notes.push('💥 Ktoś pociął opony w busie i pomazał szyld. Rachunek: ' + zl(ev.cost) + '. Wszyscy wiedzą, kto.'); }
      });
      return notes;
    }

    function askDemand(w, d) {
      const pay = Math.min(Math.floor(ST.money), d.amount);
      ask({ kind: 'upomnienie', title: w.name + ' się upomina', text: d.text, choices: [{ id: 'y', label: 'Daj ' + zl(pay) + (d.kind === 'zaleglosc' ? ' na poczet zaległości' : ' zaliczki'), sub: 'nastrój +12' + (pay < d.amount ? ' (to wszystko, co masz)' : '') }, { id: 'n', label: 'Odmów', sub: 'nastrój −' + Math.round(12 * w.greed) + ', ryzyko, że nie przyjdzie' }] }, a => {
        const yes = a === 'y'; if (yes) cash('pensje', -pay);
        ST.crew = ST.crew.map(x => x.id === w.id ? Ekipa.answerDemand(x, yes, pay) : x);
        ST.demandAt[w.id] = ST.done; save(); menu();
      });
    }
    function checkDemands() {
      if (E.ui.modalOpen) return false;
      for (const w of ST.crew) { const d = Ekipa.demand(w);
        if (d && ST.done - (ST.demandAt[w.id] == null ? -9 : ST.demandAt[w.id]) >= 2) { askDemand(w, d); return true; } }
      return false;
    }
    function checkClaims() {
      if (E.ui.modalOpen) return false;
      const k = ST.claims.findIndex(c => c.due <= ST.done);
      if (k < 0) return false;
      const c = ST.claims[k], acc = c.kind === 'wypadek';
      const pay0 = Math.min(ST.money, c.amount), cvr = Ubezp.cover(ST.oc, { kind: c.kind, amount: pay0 }), pay = cvr.you;
      ask({ kind: 'reklamacja', title: acc ? 'Wypadek!' : 'Reklamacja po tygodniu',
        text: acc ? c.client + ' dzwoni z oddziału ratunkowego: „' + c.defect + '”. Ktoś musi za to odpowiedzieć.' : c.client + ' dzwoni: „Panie majster, wróciło. ' + c.defect[0].toUpperCase() + c.defect.slice(1) + '.”',
        choices: [{ id: 'pay', label: acc ? 'Zapłać odszkodowanie' : 'Napraw na własny koszt', sub: '−' + zl(pay) + (cvr.insurer ? ' (OC pokrywa ' + zl(cvr.insurer) + ')' : '') + (pay0 < c.amount ? ' (wszystko, co masz)' : '') },
          { id: 'ignore', label: acc ? 'Zniknij na tydzień' : 'Zignoruj, nie odbieraj telefonu', sub: 'reputacja −' + (acc ? 2 : 1) + ' ★, kasa −' + (acc ? 30 : 0) + '%' }] }, a => {
        ST.claims.splice(k, 1);
        if (a === 'pay') { cash('reklamacje', -pay); ST.oc = cvr.oc; }
        else { ST.ratings.push(1); if (acc) { ST.ratings.push(1); cash('reklamacje', -ST.money * 0.3); } }
        save(); menu();
      });
      return true;
    }
    /* Raport za zakończony miesiąc jako okno wyboru (widok dorysowuje tabelę z księgi po p.key). */
    function monthReport(key) {
      const m = monthSummary(key);
      ask({ kind: 'miesiac', key, title: 'Podsumowanie: ' + Czas.monthName(key), text: (m.plus >= 0 ? 'Miesiąc na plusie. ' : 'Miesiąc na minusie. ') + 'Stawka po wszystkich kosztach: ' + signed(m.perHour) + '/h (' + m.jobs + ' zlec.).', choices: [{ id: 'ok', label: 'Dalej' }] }, () => { save(); menu(); });
    }
    function checkMonthReport() { if (E.ui.modalOpen || !ST.pendingMonths.length) return false; monthReport(ST.pendingMonths.shift()); return true; }
    // dzień wypłaty: plan do narysowania, rozdział pensji i rozliczenie
    const rl = a => a[Math.floor(rnd() * a.length)];
    function startPayday() {
      const weeklyNotes = weekly(), up = Siedziba.effects(ST.hq).upkeep, tn = Siedziba.TIERS[ST.hq.tier].name;
      if (!ST.crew.length) {
        ST.nextPay = ST.done + Ekipa.PAYDAY_EVERY; const paid = Math.min(Math.floor(ST.money), up); cash('utrzymanie', -paid); save(); top();
        if (paid > 0 || weeklyNotes.length) return { kind: 'simple', title: 'Rozliczenie tygodnia', text: (paid > 0 ? tn + ': ' + zl(paid) + ' za utrzymanie siedziby. ' : '') + weeklyNotes.join(' ') };
        return { kind: 'none' };
      }
      const billText = (up ? 'Utrzymanie siedziby (' + tn + '): −' + zl(Math.min(Math.floor(ST.money), up)) + '. ' : '') + weeklyNotes.join(' ') + ' '; cash('utrzymanie', -up);
      const sidePay = Ekipa.sideGigs(ST.crew, rnd); cash('fuchy', sidePay.total); save(); top();
      return { kind: 'crew', billText, sidePay, pay: Ekipa.defaultPay(ST.crew, Math.floor(ST.money)) };
    }
    /* Wypłata: zwraca wiersze do pokazania (kto, nastrój, powiedzonko) i odejścia. */
    function confirmPay(PAY) {
      const res = Ekipa.applyPay(ST.crew, PAY, { patienceBonus: Ubrania.crewMood(ST.wardrobe, ST.crew) + Siedziba.effects(ST.hq).comfort * 0.5 - Kalendarz.moodPenalty(Czas.season(ST.clock), Siedziba.effects(ST.hq).comfort) }); cash('pensje', -res.spent); ST.crew = res.workers;
      const lines = res.details.map(d => {
        const w = ST.crew.find(x => x.id === d.id);
        const weaker = ST.crew.filter(o => o.id !== d.id && o.skill < w.skill && (PAY[o.id] || 0) > (PAY[d.id] || 0))[0];
        let say = d.bonus > 0 ? rl(['„Szef ma głowę do ludzi!”', '„No, to się nazywa wypłata.”']) : d.shortfall > 0 ? rl(['„To ma być wypłata?!”', '„Gdzie reszta? Mam rodzinę.”', '„Policzę, ile mi wisisz, i zapamiętam.”']) : '„Zgadza się, dziękuję.”';
        if (d.parts.envy < 0 && weaker) say += ' „A czemu ' + weaker.name + ' dostał więcej?”';
        return { id: d.id, name: w.name, em: w.em, mood: d.mood, delta: d.delta, paid: d.paid, say };
      });
      const quits = ST.crew.filter(Ekipa.quits).map(w => w.name);
      quits.forEach(() => { ST.ratings.push(2); }); ST.crew = ST.crew.filter(w => !Ekipa.quits(w));
      ST.nextPay = ST.done + Ekipa.PAYDAY_EVERY; ST.lastPayDone = ST.done; save(); top();
      return { lines, quits };
    }


    Object.assign(E, { formalCtx, weekly, askDemand, checkDemands, checkClaims, monthReport, checkMonthReport, startPayday, confirmPay, outfitFx, newJob, applyOption, ST, META, applyToolSale, settleJob, fresh, load, replace, withMeta, saveMeta, bookKey, cash, syncLedger, monthSummary, advanceClock, save, reputation, co, KT, cLimit, specM, specLevels, extraPay, callP, refBonus, clothesPrice, ask, answer, estimateFor, perHourTxt,
      sleepNow, dayOffNow, vacationNow, waitHour, crewBusy, crewFree, ensureBoard, pickWorkerFor, dispatchCrew, collectCrew, yearStats, checkYear, buyPerk, askNewGamePlus, tenderCtx, askTender, askContract, askCancel, switchContract, checkContractFinal, wardrobeCmd, rnd });
    return E;
  }
  return { create, zl, stars, signed };
});
