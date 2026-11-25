/* Interfejs zleceń: lista poziomów, scenka naprawy krok po kroku, mini-gra na wyczucie, odbiór u klienta, reklamacje. */
(() => {
  const { JOBS, CLIENTS, LEVELS } = Jobs;
  const $ = id => document.getElementById(id);
  const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
  const rnd = Math.random;

  // ---------- stan ----------
  const fresh = () => ({ money: 0, ratings: [], best: {}, unlocked: 1, claims: [], done: 0, crew: [], nextPay: Ekipa.PAYDAY_EVERY, demandAt: {}, world: Swiat.newWorld(), lastPayDone: -1, hq: Siedziba.fresh(), hist: [], fin: Finanse.fresh(), os: Osiedle.fresh(), story: Fabula.fresh(), day: 1, clock: Czas.startClock(), waited: 0, ledger: Ksiega.fresh(), ledgerMoney: 0, monthStart: {}, monthEnd: {}, pendingMonths: [], fav: {}, flash: [], forceAudit: false, inv: [Alledrogo.starterKit()], orders: [], market: null, starterGiven: true });
  let ST = fresh();
  try { const r = localStorage.getItem('zlecenia_v1'); if (r) { const saved = JSON.parse(r); ST = Object.assign(fresh(), saved); if (saved.starterGiven === undefined) ST.starterGiven = false; if (saved.clock === undefined) { ST.clock = Czas.startClock() + (saved.done || 0) * 2 * 1440; ST.ledgerMoney = ST.money; } } } catch (e) {}
  (() => {
    const old = ((ST.hq || {}).assets || {}).narzedzia; // stary system: poziom narzędzi w siedzibie
    if (old > 0) { ST.inv = (ST.inv || []).concat([Alledrogo.makeItem({ tier: Math.min(3, old), brand: 'Zestaw z siedziby', cond: (ST.hq.cond == null ? 100 : ST.hq.cond), life: 30, source: 'start', sellerName: 'własne' })]); delete ST.hq.assets.narzedzia; }
    if (ST.hq) delete ST.hq.cond;
    if (!ST.starterGiven) { // starsze zapisy: raz dostajesz tani zestaw, jeśli nie masz żadnego zestawu ręcznego
      ST.inv = ST.inv || []; if (!ST.inv.some(i => i.type === 'zestaw')) ST.inv.push(Alledrogo.starterKit()); ST.starterGiven = true;
    }
    const f = Siedziba.fresh(); ST.hq = Object.assign(f, ST.hq || {}, { up: Object.assign(f.up, (ST.hq || {}).up), assets: Object.assign(f.assets, (ST.hq || {}).assets) }); if (!ST.hist) ST.hist = []; })();
  const bookKey = () => Czas.dateOf(ST.clock).monthKey;
  if (!ST.monthStart[bookKey()]) ST.monthStart[bookKey()] = ST.money;
  /* Księguje ruch na kasie w kategorii (z uwzględnieniem tego, że kasa nie spada poniżej zera). */
  function cash(cat, amt) {
    const before = ST.money; ST.money = Math.max(0, ST.money + amt); const real = ST.money - before;
    ST.ledger = Ksiega.book(ST.ledger, bookKey(), cat, real); ST.ledgerMoney = ST.money; return real;
  }
  /* Ruchy kasy, które nie przeszły przez cash(), trafiają do „inne”. */
  function syncLedger() { const d = ST.money - (ST.ledgerMoney || 0); if (Math.abs(d) > 0.004) ST.ledger = Ksiega.book(ST.ledger, bookKey(), 'inne', d); ST.ledgerMoney = ST.money; }
  const monthSummary = key => Ksiega.summary(ST.ledger, key || bookKey(), 0);
  /* Przesuwa zegar; przy zmianie miesiąca zamyka stary i planuje raport. */
  function advanceClock(to) {
    const oldKey = bookKey(); ST.clock = to; const newKey = bookKey();
    if (newKey !== oldKey) { ST.monthEnd[oldKey] = ST.money; ST.monthStart[newKey] = ST.money; ST.pendingMonths.push(oldKey); }
    ST.day = Czas.dateOf(ST.clock).dayIndex;
  }
  /* Zegar widoczny dla gracza: w trakcie zlecenia startowy + postęp pracy. */
  const viewClock = () => cur && !$('job').hidden ? cur.startClock + Czas.minutes(Math.max(0, cur.time + cur.timeAdj), cur.night) : ST.clock;
  let anim = null;
  const save = () => { syncLedger(); try { localStorage.setItem('zlecenia_v1', JSON.stringify(ST)); } catch (e) {} };
  const reputation = () => { const r = ST.ratings.slice(-10); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };

  // ---------- scenka: tokeny stanu ----------
  /* Rysuje sceny pixel art w kontenerze. Tokeny stanu przekazuje się do sceny zlecenia, siedziba bierze stan z gry. */
  let sceneFrame = 0, sceneTokens = new Set(['broken']);
  function hqOpts() { return { tier: ST.hq.tier, up: ST.hq.up, assets: ST.hq.assets, season: Czas.season(ST.clock), tools: ST.inv.length, night: Czas.isNight(ST.clock) }; }
  function paintScene(cv) {
    const night = cv.dataset.scene === 'hq' ? Czas.isNight(ST.clock) : !!(cur && cur.night);
    let grid = cv.dataset.scene === 'hq' ? Scenes.hq(hqOpts(), sceneFrame) : Scenes.job(cv.dataset.job, sceneTokens, sceneFrame, { night });
    if (anim && cv.dataset.scene !== 'hq') grid = Scenes.action(grid, anim.kind, Math.min(1, (performance.now() - anim.t0) / anim.dur), anim.at);
    Scenes.draw(cv, grid, { night });
  }
  function applyScene(root, tokens) { sceneTokens = tokens; root.querySelectorAll('canvas.pxscene').forEach(paintScene); }
  setInterval(() => { sceneFrame = (sceneFrame + 1) % 8; document.querySelectorAll('canvas.pxscene').forEach(cv => { if (cv.offsetParent !== null) paintScene(cv); }); }, 250);
  const sceneHTML = job => '<div class="scene"><canvas class="pxscene" width="128" height="80" data-scene="job" data-job="' + job.id + '" role="img" aria-label="' + job.title + '"></canvas></div>';

  // ---------- poziomy ----------
  let cur = null; // bieżące zlecenie
  const ALL = ['menu', 'job', 'result', 'crew', 'payday', 'hq', 'fin', 'os', 'story', 'alle'];
  const co = () => Siedziba.rating(ST.hq, ST.hist, ST.ratings, ST.claims.length, Alledrogo.toolScore(ST.inv));
  function renderTop() {
    $('money').textContent = zl(ST.money);
    $('rep').textContent = co().stars.toFixed(1).replace('.', ',') + ' ★';
    const ms = monthSummary(), pl = $('plus'); pl.textContent = signed(ms.plus); pl.className = ms.plus >= 0 ? 'pos' : 'neg';
    $('plusl').textContent = 'Plus: ' + Czas.monthName(bookKey());
    const vc = viewClock(), n = Czas.isNight(vc);
    $('clock').innerHTML = (n ? '🌙' : '☀️') + ' ' + Czas.label(vc) + ' · ' + (n ? 'noc' : 'dzień');
    $('clockbar').className = 'clockbar' + (n ? ' night' : '');
  }
  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
  function renderMenu() {
    renderTop(); ALL.forEach(x => $(x).hidden = true); $('menu').hidden = false;
    const toPay = Math.max(0, ST.nextPay - ST.done);
    const sea = { name: Czas.season(ST.clock) };
    const flash = ST.flash.length ? '<div class="banner">' + ST.flash.join('<br>') + '</div>' : ''; ST.flash = [];
    $('menu').innerHTML = flash + '<div class="grid3"><button class="tabbtn' + (ST.crew.some(w => Ekipa.demand(w)) ? ' alert' : '') + '" id="goCrew">👷 Ekipa (' + ST.crew.length + ')</button><button class="tabbtn" id="goHq">🏢 Siedziba</button><button class="tabbtn' + (Finanse.debt(ST.fin) > 0 ? ' alert' : '') + '" id="goFin">💼 Finanse</button><button class="tabbtn" id="goOs">🏘️ Osiedle</button><button class="tabbtn" id="goStory">📖 Fabuła</button><button class="tabbtn' + (ST.orders.length ? ' alert' : '') + '" id="goAlle">🛒 Alledrogo</button></div>' +
      '<div class="hint" style="text-align:center">Reklamacje: ' + ST.claims.length + ' · ' + sea.name + ' · dzień wypłaty za ' + toPay + ' zlec. · utrzymanie ' + zl(Siedziba.effects(ST.hq).upkeep + Finanse.upkeep(ST.fin)) + ' · ' + Siedziba.TIERS[ST.hq.tier].name + '</div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Zlecenia</h3>' + LEVELS.map((l, i) => {
      const job = JOBS[l.job], cl = CLIENTS[l.client], locked = i + 1 > ST.unlocked, b = ST.best[i], est = estimateFor(l), st = Czas.jobStart(ST.clock, l.time, 1);
      return '<button class="lvl' + (l.slot === 'noc' ? ' nightlvl' : '') + '" data-i="' + i + '" ' + (locked ? 'disabled' : '') + '><span class="av">' + (locked ? '🔒' : cl.em) + '</span><span><b>' + (i + 1) + '. ' + job.title + '</b><small>' + (l.slot === 'noc' ? '🌙 ' : '☀️ ') + Czas.label(st) + '</small><small>' + job.place + ' · ' + cl.name + ' · ok. ' + zl(job.base * l.mult * (l.slot === 'noc' ? Czas.NIGHT.payMult : 1)) + ' · ' + perHourTxt(est) + '</small></span><span class="res">' +
        (b ? '<span class="stars">' + stars(b.stars) + '</span><br>fuszerka ' + b.index + '%' : (locked ? '' : 'nowe')) + '</span></button>';
    }).join('');
    $('menu').insertAdjacentHTML('beforeend', waitHTML());
    $('wait').onclick = waitHour;
    $('goCrew').onclick = renderCrew; $('goHq').onclick = renderHq; $('goFin').onclick = renderFin; $('goOs').onclick = renderOs; $('goStory').onclick = renderStory; $('goAlle').onclick = renderAlle;
    nextEvent();
  }
  const allDone = () => LEVELS.every((_, i) => ST.best[i]);
  const waitHTML = () => '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Czekanie na telefon</h3>' +
    '<div class="hint">' + (allDone() ? 'Zrobiłeś wszystkie zlecenia z listy. Teraz zostaje czekać, aż ktoś zadzwoni.' : 'Nie chcesz brać żadnego z listy? Możesz poczekać, może ktoś zadzwoni.') + ' Szansa na telefon w tej godzinie (' + Czas.hm(ST.clock) + '→' + Czas.hm(ST.clock + 60) + '): ' +
    Math.round(Jobs.callChance(Czas.isNight(ST.clock + 60), co().stars, ST.waited) * 100) + '%. Lepsza ocena firmy i kolejne godziny bez telefonu zwiększają szansę.</div>' +
    '<button id="wait" class="primary">⏳ Poczekaj godzinę (+1 h)</button>';
  function waitHour() {
    advanceClock(ST.clock + 60);
    const night = Czas.isNight(ST.clock), hit = rnd() < Jobs.callChance(night, co().stars, ST.waited);
    if (!hit) { ST.waited++; save(); renderMenu(); return; }
    ST.waited = 0;
    const call = Jobs.rollCall(rnd, co().stars, Czas.isNight(ST.clock + 20)), cl = CLIENTS[call.client], jb = JOBS[call.job];
    call.intro = cl.name + ' dzwoni o ' + Czas.hm(ST.clock) + ': ' + jb.intro; call.time = Czas.hm(ST.clock + 20);
    const est = estimateFor(call);
    modalOpen = true; $('mtitle').textContent = '📞 Telefon! ' + jb.title;
    $('mtext').textContent = call.intro + ' (' + (call.slot === 'noc' ? 'noc' : 'dzień') + ', ok. ' + zl(jb.base * call.mult * (call.slot === 'noc' ? Czas.NIGHT.payMult : 1)) + ', stawka po kosztach ' + perHourTxt(est) + ')';
    $('mchoices').innerHTML = '<button data-a="go">Jadę<small>start za 20 minut</small></button><button data-a="no">Odmawiam<small>czekasz dalej</small></button>';
    $('modal').hidden = false; save(); renderTop();
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('modal').hidden = true; modalOpen = false; if (b.dataset.a === 'go') startJob(-1, call); else renderMenu(); };
  }
  $('menu').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b && !b.disabled) startJob(+b.dataset.i); });

  // ---------- zlecenie ----------
  const signed = n => (n >= 0 ? '+' : '−') + zl(Math.abs(n));
  /* Szacunek stawki godzinowej po kosztach dla poziomu: opts { terms, helper, states }. */
  function estimateFor(l, opts) {
    opts = opts || {};
    const job = JOBS[l.job], client = CLIENTS[l.client], night = l.slot === 'noc', mods = Czas.mods(night);
    const start = l.call ? ST.clock + 20 : Czas.jobStart(ST.clock, l.time, 1), season = Czas.season(start), rt = co();
    const um = Umowa.evaluate(opts.terms || Umowa.DEFAULT, client, () => 1);
    const sea = Kalendarz.demandMult(season, job.id), gos = Osiedle.gossipMult(ST.os), cut = 1 - Osiedle.undercut(ST.os, { rating: rt.stars, tier: ST.hq.tier });
    let units = job.deadline * um.deadlineFactor, helperCost = 0;
    if (opts.helper) { const he = Ekipa.helperEffect(opts.helper, (opts.states || {})[opts.helper.id]); units *= he.timeFactor; helperCost = Stawka.helperShare(opts.helper, night); }
    return Stawka.estimate({ base: Math.round(job.base * l.mult), payMult: rt.payMult * um.payMult * sea * gos * cut * mods.payMult, deadlineUnits: units, night, helper: helperCost,
      invoice: (opts.terms || Umowa.DEFAULT).invoice, overhead: Stawka.overheadShare(Siedziba.effects(ST.hq).upkeep + Finanse.upkeep(ST.fin)), extraMinutes: 15 });
  }
  const perHourTxt = e => 'ok. ' + signed(e.perHour) + '/h';
  function startJob(i, call) {
    const l = call || LEVELS[i], night = l.slot === 'noc';
    cur = { i: call ? -1 : i, level: l, job: JOBS[l.job], client: CLIENTS[l.client], mult: l.mult, step: 0, picks: [], tokens: new Set(['broken']), time: 0, cost: 0,
      helper: null, helperOn: false, helperPaid: 0, timeAdj: 0, extraDefects: [], notes: [], states: {}, night, intro: l.intro || JOBS[l.job].intro, transportCost: 0, scandal: false };
    cur.startClock = call ? ST.clock + 20 : Czas.jobStart(ST.clock, l.time, 1);
    ST.world.night = night;
    ST.crew.forEach(w => { cur.states[w.id] = Swiat.rollState(w, { paydayEve: ST.lastPayDone === ST.done, night }, rnd); });
    cur.season = Czas.season(cur.startClock); cur.deadline = cur.job.deadline; cur.umowa = null; cur.terms = Object.assign({}, Umowa.DEFAULT);
    cur.mystery = Fabula.rollMystery({ done: ST.done }, rnd);
    cur.tools = Alledrogo.forJob(ST.inv, cur.job.id); cur.failAt = {}; cur.brokenTools = {};
    cur.tools.forEach(tl => { cur.failAt[tl.id] = rnd() < Alledrogo.failChance(tl) ? Math.floor(rnd() * cur.job.steps.length) : -1; });
    if (cur.tools.length) cur.notes.push('🧰 Bierzesz ze sobą: ' + cur.tools.map(tl => tl.brand).join(', ') + '.');
    const wx = Kalendarz.weather(cur.season, rnd); if (wx.delay) { cur.timeAdj += wx.delay; cur.notes.push(wx.text); }
    ALL.forEach(x => $(x).hidden = true); $('job').hidden = false;
    umowa();
  }
  function afterUmowa() { if (ST.crew.length) pickHelper(); else transport(); }
  const nightNote = () => cur.night ? '<div class="banner">🌙 Zlecenie nocne: dopłata ×' + String(Czas.NIGHT.payMult).replace('.', ',') + ', ale ciemno (celność −' + Math.round(Czas.NIGHT.accPenalty * 100) + ' pkt), robota trwa o 10% dłużej, więcej wypadków i kontroli policji, ekipa częściej nie przychodzi. Klient jest zaspany, więc mniej zauważa.</div>' : '';

  // ---------- umowa: faktura, kosztorys, termin ----------
  function umowa() {
    const t = cur.terms, c = cur.client, ni = Umowa.needsInvoice(c);
    const seg = (key, opts) => '<div class="seg" data-key="' + key + '">' + opts.map(o => '<button data-v="' + o[0] + '" class="' + (String(t[key]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div>';
    const sea = cur.season, dm = Kalendarz.demandMult(sea, cur.job.id), est = estimateFor(cur.level, { terms: t });
    const uPre = Umowa.evaluate(t, c, () => 1);
    $('job').innerHTML = '<div class="bubble"><span class="av">' + c.em + '</span><div><b>' + c.name + '</b>: „' + cur.intro + '”<br><small style="color:var(--muted)">' + c.note + '</small></div></div>' +
      sceneHTML(cur.job) +
      '<div class="hint">' + (cur.night ? '🌙' : '☀️') + ' Start: <b>' + Czas.label(cur.startClock) + '</b> (' + (cur.night ? 'noc' : 'dzień') + '). Sezon: ' + sea + (dm !== 1 ? ' (popyt na takie roboty ×' + String(dm).replace('.', ',') + ')' : '') + '.</div>' + nightNote() +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Umowa</h2>' +
      '<div class="hint">' + (ni ? c.name + ' wymaga faktury.' : c.name + ' pyta, czy „może być bez papierów”.') + '</div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Faktura</h3>' + seg('invoice', [[true, 'Z fakturą (podatek 10%)'], [false, 'Bez faktury (−4% ceny)']]) + '</div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Kosztorys</h3>' + seg('quote', [['fair', 'Uczciwy'], ['inflated', 'Zawyżony (+20%)'], ['low', 'Zaniżony (−15%)']]) + '<div class="hint">Zawyżenie zauważy: ' + Math.round(Umowa.detectChance(c) * 100) + '% (uważny klient lub fachowiec zauważy częściej).</div></div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Termin</h3>' + seg('rush', [[false, 'Realny (' + Czas.fmtUnits(cur.job.deadline, cur.night) + ')'], [true, 'Na wczoraj (' + Czas.fmtUnits(cur.job.deadline * 0.75, cur.night) + ', +10%)']]) + '</div>' +
      '<div class="econ"><div class="erow"><span>Szacowana wypłata</span><b>~' + zl(est.lines[0].value) + '</b></div><div class="erow"><span>Szacowany czas</span><b>~' + Czas.fmtMin(est.hours * 60) + '</b></div><div class="erow big"><span>Zostaje po kosztach (bez pomocnika)</span><b>' + perHourTxt(est) + '</b></div></div>' +
      '<button class="primary" id="umOk">Ustalone, jedziemy</button><button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy</button>';
    void uPre;
    $('back').onclick = renderMenu;
    $('job').onclick = e => { const b = e.target.closest('.seg button'); if (!b) return; const k = b.parentNode.dataset.key; t[k] = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; umowa(); };
    $('umOk').onclick = () => {
      cur.umowa = Umowa.evaluate(t, c, rnd); cur.notes.push(...cur.umowa.notes);
      cur.deadline = Math.round(cur.job.deadline * cur.umowa.deadlineFactor);
      afterUmowa();
    };
  }
  function pickHelper() {
    const solo = estimateFor(cur.level, { terms: cur.terms });
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">' + cur.intro + '</small></div></div>' +
      '<div class="hint">' + (cur.night ? '🌙 Noc' : '☀️ Dzień') + ', start ' + Czas.hm(cur.startClock) + '. Pomocnik kosztuje udział w pensji za to zlecenie' + (cur.night ? ' (w nocy z dopłatą 50%)' : '') + '.</div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kogo bierzesz do pomocy?</h2><div class="hint">Dobry pomocnik poprawia celność i skraca robotę. Wkurzony może nie przyjść albo zostawić cię w połowie zlecenia.</div>' +
      '<div class="opts">' + ST.crew.map(w => { const r = Ekipa.risk(w, { night: cur.night }), stt = cur.states[w.id], out = w.outJobs > 0, cost = Stawka.helperShare(w, cur.night), est = estimateFor(cur.level, { terms: cur.terms, helper: w, states: cur.states });
        return '<button class="opt" data-w="' + w.id + '" ' + (out ? 'disabled' : '') + '><b>' + w.em + ' ' + w.name + ' · ' + Ekipa.moodEmoji(w.mood) + ' ' + Ekipa.moodLabel(w.mood) + (out ? ' · na zwolnieniu (' + w.outJobs + ' zlec.)' : '') + '</b><span>dziś: ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + ' · pracowitość ' + Math.round((w.diligence == null ? 0.5 : w.diligence) * 100) + '%</span><span>' + w.role + ' · umiejętności ' + Math.round(w.skill * 100) + '%</span><span class="chips"><span class="chip cost">💰 koszt wzięcia: ' + zl(cost) + '</span><span class="chip">stawka z nim ' + perHourTxt(est) + '</span></span><span class="chips"><span class="chip">nie przyjdzie: ' + Math.round(r.absent * 100) + '%</span><span class="chip">zostawi w połowie: ' + Math.round(r.walkout * 100) + '%</span></span></button>'; }).join('') +
      '<button class="opt" data-w=""><b>Sam, bez pomocnika</b><span>Spokojniej. Wolniej.</span><span class="chips"><span class="chip cost">💰 koszt wzięcia: 0 zł</span><span class="chip">stawka sam ' + perHourTxt(solo) + '</span></span></button></div>' +
      '<button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy</button>';
    $('back').onclick = renderMenu;
    $('job').querySelector('.opts').onclick = e => { const b = e.target.closest('.opt'); if (!b) return;
      const w = ST.crew.find(x => x.id === b.dataset.w) || null; cur.helper = w;
      if (w) { if (Ekipa.attendance(w, rnd, { night: cur.night }) === 'absent') { cur.helperOn = false; cur.timeAdj += 4; cur.notes.push(w.em + ' ' + w.name + ' nie przyszedł do roboty. Poczekałeś na niego 20 minut i robisz sam.'); }
        else { cur.helperOn = true; cur.helperPaid = Stawka.helperShare(w, cur.night); const stt = cur.states[w.id]; cur.notes.push(w.em + ' ' + w.name + ' jest na miejscu' + (stt !== 'trzezwy' ? ', ale jest ' + Swiat.LABEL[stt] + '.' : '.')); } }
      transport(); };
  }

  // ---------- dylemat: kto zawozi materiały (tylko ci, którzy jadą na zlecenie) ----------
  function transport() {
    const drivers = cur.helper && cur.helperOn && !(cur.helper.outJobs > 0) ? [cur.helper] : [];
    const riskTxt = (w, mode) => { const stt = cur.states[w.id] || 'trzezwy', r = Swiat.driveRisk(w, stt, ST.world, mode); return '<span class="chip">wypadek: ' + Swiat.band(r.accident) + '</span><span class="chip">policja: ' + Swiat.band(r.police) + '</span>'; };
    const oR = Swiat.driveRisk(null, 'trzezwy', ST.world, 'owner');
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">Materiały i narzędzia trzeba dowieźć na miejsce.</small></div></div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kto zawozi?</h2><div class="hint">Do wyboru są tylko ci, którzy jadą na zlecenie. ' + (cur.night ? '🌙 W nocy częstsze są wypadki i kontrole policji. ' : '') + 'Ryzyko jest przybliżone.</div>' +
      '<div class="opts">' +
      '<button class="opt" data-d="owner"><b>🚗 Ty, sam</b><span>Masz prawo jazdy i trzeźwą głowę. Tracisz trochę czasu.</span><span class="chips"><span class="chip">⏱ +' + Czas.fmtMin(3 * Czas.TIME_SCALE) + '</span><span class="chip cost">💰 0 zł</span><span class="chip">wypadek: ' + Swiat.band(oR.accident) + '</span></span></button>' +
      '<button class="opt" data-d="courier"><b>🚚 Kurier</b><span>Płacisz, nie myślisz.</span><span class="chips"><span class="chip cost">💰 70 zł</span><span class="chip">⏱ +' + Czas.fmtMin(2 * Czas.TIME_SCALE) + '</span><span class="chip">bez ryzyka</span></span></button>' +
      drivers.map(w => { const stt = cur.states[w.id] || 'trzezwy';
        return '<button class="opt" data-d="' + w.id + '"><b>' + w.em + ' ' + w.name + ' · ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + '</b><span>jedzie na zlecenie · prawo jazdy: ' + (w.license ? 'ma' : 'nie ma') + ' · jazda ' + Math.round((w.driving == null ? 0.5 : w.driving) * 100) + '%' + (ST.world.heat > 0.4 ? ' · uwaga: dużo patroli' : '') + '</span><span class="chips"><span class="chip cost">💰 0 zł</span>' + riskTxt(w, 'worker') + '</span></button>'; }).join('') + '</div>';
    $('job').querySelector('.opts').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; doDrive(b.dataset.d); };
  }
  function doDrive(id) {
    const mode = id === 'owner' || id === 'courier' ? id : 'worker', w = mode === 'worker' ? ST.crew.find(x => x.id === id) : null;
    ST.world.accMult = Siedziba.effects(ST.hq).accMult; ST.world.night = cur.night;
    const res = Swiat.resolveDrive(w, w ? (cur.states[w.id] || 'trzezwy') : 'trzezwy', ST.world, mode, rnd);
    if (res.police && res.police.fine && ST.fav.fine) { res.cost -= res.police.fine; ST.fav.fine = false; res.notes.push('👮 Dzielnicowy Marek „zapomniał” o mandacie.'); }
    if (res.incident) cur.scandal = true;
    cash(mode === 'courier' ? 'transport' : 'wypadki', -res.cost); cur.timeAdj += res.timeAdj; cur.notes.push(...res.notes);
    cur.transportCost += Math.max(0, res.cost);
    if (res.claim) ST.claims.push(Object.assign({ client: cur.client.name, due: ST.done + 1 }, res.claim));
    Swiat.tickWorld(ST.world, res.heatDelta);
    if (w && Object.keys(res.driverPatch).length) ST.crew = ST.crew.map(x => x.id === w.id ? Object.assign({}, x, res.driverPatch) : x);
    if (w && cur.helper && w.id === cur.helper.id && res.driverPatch.outJobs) { cur.helperOn = false; cur.notes.push(w.name + ' nie pomoże w robocie.'); }
    save(); renderTop();
    const opts = w ? Swiat.aftermathOptions(w, res) : [];
    if (!opts.length) { renderJob(); return; }
    modalOpen = true;
    $('mtitle').textContent = 'Co z ' + w.name + '?'; $('mtext').textContent = res.notes[res.notes.length - 1] + ' Rachunek: ' + zl(res.cost) + '. Decyzja szefa kształtuje, jak ekipa cię traktuje.';
    $('mchoices').innerHTML = opts.map(o => '<button data-a="' + o.id + '">' + o.label + '<small>' + o.sub + '</small></button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      const out = Swiat.applyAftermath(ST.crew.find(x => x.id === w.id), b.dataset.a, res);
      cash('wypadki', out.money); cur.notes.push(out.note);
      if (out.fired) { ST.crew = ST.crew.filter(x => x.id !== w.id); if (out.rep) ST.ratings.push(out.rep); if (cur.helper && cur.helper.id === w.id) cur.helperOn = false; }
      else ST.crew = ST.crew.map(x => x.id === w.id ? out.worker : x);
      save(); renderTop(); $('modal').hidden = true; modalOpen = false; renderJob(); };
  }
  function renderJob() {
    const { job, client, step } = cur, s = job.steps[step], night = cur.night;
    const stages = '<div class="stages">' + job.steps.map((st, k) => {
      const pk = cur.picks[k], o = pk ? st.options.find(x => x.id === pk.optionId) : null, cls = k < step ? 'done' : k === step ? 'cur' : '';
      return '<div class="stage ' + cls + '"><span class="num">' + (k < step ? '✓' : (k + 1)) + '</span><span class="stn">' + st.name + (o ? '<small>' + o.label + '</small>' : (k === step ? '<small>teraz</small>' : '')) + '</span></div>'; }).join('') + '</div>';
    $('job').innerHTML =
      '<div class="bubble"><span class="av">' + client.em + '</span><div><b>' + client.name + '</b>: „' + cur.intro + '”<br><small style="color:var(--muted)">' + client.note + '</small></div></div>' +
      sceneHTML(job) +
      (cur.notes.length ? '<div class="banner">' + cur.notes.slice(-2).join('<br>') + '</div>' : '') + stages +
      '<div class="step"><h2>' + (step + 1) + '/' + job.steps.length + ' · ' + s.name + '</h2><div class="hint">' + s.hint + '</div></div>' +
      '<div class="opts" id="opts">' + s.options.map(o =>
        '<button class="opt" data-o="' + o.id + '"><b>' + o.label + '</b><span>' + o.desc + '</span><span class="chips"><span class="chip">⏱ ' + Czas.fmtUnits(o.time, night) + '</span><span class="chip">💰 ' + zl(o.cost) + '</span>' + (o.skill ? '<span class="chip skill">🎯 na wyczucie</span>' : '') + '</span></button>').join('') + '</div>' +
      '<div class="tally"><span>🕒 ' + Czas.hm(viewClock()) + ' · praca: ' + Czas.fmtUnits(Math.max(0, cur.time + cur.timeAdj), night) + ' / ' + Czas.fmtUnits(cur.deadline, night) + '</span><span>Materiały: ' + zl(cur.cost) + '</span></div>' +
      '<button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy (bez zapisu)</button>';
    applyScene($('job'), cur.tokens); renderTop();
    $('back').onclick = renderMenu;
    $('opts').onclick = e => { const b = e.target.closest('.opt'); if (b) choose(s.options.find(o => o.id === b.dataset.o)); };
  }
  function choose(opt) { if (opt.skill) timing(opt); else perform(opt, 0.6); }
  /* Animacja czynności na scenie (narzędzie w akcji), potem zmiana stanu naprawy. Fuszerka jest szybka, solidna robota trwa dłużej. */
  const ACTION_TXT = { wrench: 'Kręcisz kluczem…', hammer: 'Młotek w ruch…', drill: 'Wiercisz…', roller: 'Malujesz wałkiem…', trowel: 'Szpachlujesz…', sander: 'Szlifujesz…', tester: 'Mierzysz i sprawdzasz…', pliers: 'Pracujesz cęgami…', screwdriver: 'Wkręcasz…', pencil: 'Zaznaczasz…' };
  function perform(opt, accuracy) {
    const a = Scenes.actionFor(cur.job.id, cur.step), dur = opt.id === 'dobrze' ? 1500 : opt.id === 'skrot' ? 950 : 520;
    anim = { kind: a.kind, at: a.at, t0: performance.now(), dur };
    const box = $('opts'); if (box) box.innerHTML = '<div class="hint" style="text-align:center">' + (ACTION_TXT[a.kind] || 'Pracujesz…') + ' <b>' + opt.label + '</b></div><div class="actbar"><i id="actbar" style="width:0"></i></div>';
    const tick = () => { if (!anim) return; const t = Math.min(1, (performance.now() - anim.t0) / anim.dur), bar = $('actbar'); if (bar) bar.style.width = t * 100 + '%'; document.querySelectorAll('canvas.pxscene[data-job]').forEach(paintScene); if (t < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => { anim = null; apply(opt, accuracy); }, dur);
  }
  function apply(opt, accuracy) {
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
    if (opt.skill) accuracy = Math.max(0, Math.min(1, accuracy + tb.acc - mods.accPenalty));
    cur.timeAdj -= Math.round(opt.time * tb.time * 10) / 10;
    cur.picks.push({ stepId: cur.job.steps[cur.step].id, optionId: opt.id, accuracy });
    cur.time += opt.time; cur.cost += opt.cost;
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
    if (cur.step >= cur.job.steps.length) { finish(); return; }
    renderJob();
  }

  // ---------- mini-gra na wyczucie: zatrzymaj znacznik w zielonej strefie ----------
  function timing(opt) {
    const box = $('opts');
    box.innerHTML = '<div class="timing"><div class="hint">Dociśnij we właściwym momencie: <b>' + opt.label + '</b></div>' +
      '<div class="track"><div class="zone" style="left:30%;width:40%"></div><div class="zone mid" style="left:44%;width:12%"></div><div class="mark" id="mark"></div></div>' +
      '<div class="verdict" id="verdict"></div><button class="primary" id="stop">Teraz!</button></div>';
    const mark = $('mark'); let t0 = performance.now(), raf, stopped = false;
    const pos = now => 0.5 + 0.5 * Math.sin(((now - t0) / 1000) * Math.PI * 2 / 1.5);
    const loop = now => { if (!stopped) { mark.style.left = pos(now) * 100 + '%'; raf = requestAnimationFrame(loop); } };
    raf = requestAnimationFrame(loop);
    const stop = () => {
      if (stopped) return; stopped = true; cancelAnimationFrame(raf);
      const x = pos(performance.now()), a = Math.max(0, Math.min(1, 1 - Math.abs(x - 0.5) * 2.2));
      mark.style.left = x * 100 + '%';
      $('verdict').textContent = a >= 0.9 ? 'Idealnie!' : a >= 0.7 ? 'Dobrze' : a >= 0.4 ? 'Krzywo' : 'Fatalnie';
      $('stop').disabled = true;
      setTimeout(() => perform(opt, a), 450);
    };
    $('stop').onclick = stop;
    window.__z.stopNow = stop;
  }

  // ---------- odbiór ----------
  function finish() {
    const night = cur.night, mods = Czas.mods(night);
    const units = Math.max(1, cur.time + cur.timeAdj), minutes = Czas.minutes(units, night), endClock = cur.startClock + minutes;
    // zegar: koniec zlecenia i ewentualna zmiana miesiąca
    advanceClock(endClock);
    const job = Object.assign({}, cur.job, { base: Math.round(cur.job.base * cur.mult), deadline: cur.deadline });
    const rt = co(), um = cur.umowa || { payMult: 1, satDelta: 0, taxRiskDelta: 0 };
    const sea = Kalendarz.demandMult(cur.season, cur.job.id), gos = Osiedle.gossipMult(ST.os), cut = 1 - Osiedle.undercut(ST.os, { rating: rt.stars, tier: ST.hq.tier });
    const payMult = Math.round(rt.payMult * um.payMult * sea * gos * cut * mods.payMult * 1000) / 1000;
    const hz = Alledrogo.totalBonus(cur.tools.filter(tl => !cur.brokenTools[tl.id])).hazardMult * mods.hazard;
    const r = Fuszerka.evaluate(job, cur.picks, cur.client, { time: Math.round(cur.timeAdj), defects: cur.extraDefects, satBonus: rt.satBonus + um.satDelta, payMult, hazardMult: hz, attentionMult: mods.attention });
    const comment = Fuszerka.clientComment(cur.client, r, rnd);
    const claim = Fuszerka.rollClaim(r, rnd);
    cash('zlecenia', r.payout); cash('materialy', -r.cost); ST.ratings.push(r.stars); ST.done++;
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
    ST.market = Alledrogo.refresh(ST.market, ST.day);
    const th = Siedziba.resolveTheft(ST.hq, rnd, Alledrogo.inventoryValue(ST.inv));
    if (th) {
      ST.hq = th.hq; cash('kradziez', -th.net);
      if (th.itemStolen && ST.inv.length) { const top = ST.inv.slice().sort((a, b) => Alledrogo.value(b) - Alledrogo.value(a))[0]; ST.inv = ST.inv.filter(x => x.id !== top.id); cur.notes.push('🕵️ Złodziej zabrał też „' + top.brand + '”.'); }
      cur.notes.push('🕵️ W nocy ktoś włamał się do siedziby: strata ' + zl(th.loss) + (th.recovered ? ', ale kamery pomogły odzyskać ' + zl(th.recovered) : '') + '.' + (th.cameras ? '' : ' Kamery i mocniejsze drzwi by pomogły.'));
    }
    ST.crew = Swiat.tickWorkers(ST.crew); Swiat.tickWorld(ST.world, 0);
    if (cur.i >= 0) { const prev = ST.best[cur.i];
      if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.index < prev.index)) ST.best[cur.i] = { stars: r.stars, index: r.index };
      ST.unlocked = Math.max(ST.unlocked, cur.i + 2); }
    ST.waited = 0;
    if (claim) ST.claims.push(Object.assign({ client: cur.client.name, due: ST.done + 1 }, claim));
    // ile zostaje po wszystkich kosztach i stawka godzinowa
    const eco = Stawka.jobEconomics({ payout: r.payout, materials: r.cost, transport: cur.transportCost, helper: cur.helperPaid, tools: toolWearCost, tax: cur.terms.invoice ? r.payout * Umowa.TAX_RATE : 0,
      overhead: Stawka.overheadShare(Siedziba.effects(ST.hq).upkeep + Finanse.upkeep(ST.fin)), minutes });
    ST.ledger = Ksiega.noteJob(ST.ledger, bookKey(), eco.net, eco.hours);
    save(); renderTop();
    const bar = (v, max) => '<span class="b"><i style="width:' + Math.min(100, v / max * 100) + '%"></i></span>';
    const defs = r.defects.length ? r.defects.slice().sort((a, b) => b.sev - a.sev).map(d => {
      const tags = (d.hazard > 0 ? '<span class="tag haz">zagrożenie</span> ' : '') + (d.vis >= 0.5 ? '<span class="tag vis">widoczna</span>' : '<span class="tag hid">ukryta</span>');
      return '<div class="def"><span>' + d.label + '</span><span>' + tags + '</span></div>'; }).join('') : '<div class="def"><span>Brak wad. Naprawdę dobra robota.</span></div>';
    const econHtml = '<div class="econ"><div class="erow"><span>🕒 ' + Czas.hm(cur.startClock) + ' → ' + Czas.hm(endClock) + ' (' + (night ? 'noc' : 'dzień') + ')</span><b>' + Czas.fmtMin(minutes) + '</b></div>' +
      eco.lines.map(l => '<div class="erow"><span>' + l.label + '</span><b class="' + (l.value >= 0 ? 'pos' : 'neg') + '">' + (l.value === 0 ? '0 zł' : signed(l.value)) + '</b></div>').join('') +
      '<div class="erow tot"><span>Zostaje po wszystkich kosztach</span><b class="' + (eco.net >= 0 ? 'pos' : 'neg') + '">' + signed(eco.net) + '</b></div>' +
      '<div class="erow big"><span>Stawka po kosztach</span><b class="' + (eco.perHour >= 0 ? 'pos' : 'neg') + '">' + signed(eco.perHour) + '/h</b></div>' +
      '<div class="hint">Brutto ' + signed(eco.grossPerHour) + '/h. Pomocnik, podatek i utrzymanie to udziały: realnie płacisz je w dniu wypłaty.</div></div>';
    $('job').hidden = true; $('result').hidden = false;
    $('result').innerHTML =
      sceneHTML(cur.job) +
      '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.client.name + '</b> <span class="stars">' + stars(r.stars) + '</span><br>„' + comment + '”</div></div>' +
      '<div><div class="glabels"><span>Fuszerometr</span><span>' + r.index + ' / 100</span></div><div class="gauge" role="meter" aria-valuenow="' + r.index + '" aria-valuemin="0" aria-valuemax="100"><i style="left:' + r.index + '%"></i></div>' +
      '<div class="glabels" style="margin-top:6px"><span>solidnie</span><span>na oko</span><span>fuszerka</span><span>katastrofa</span></div></div>' +
      '<div><div class="lvname" style="color:' + ({ solid: 'var(--ok)', oko: '#c8d44a', fuszerka: 'var(--warn)', katastrofa: 'var(--bad)' })[r.level.key] + '">' + r.level.name + '</div></div>' +
      '<div class="break"><div class="brow"><span>Wady widoczne</span>' + bar(r.V, 12) + '<b>' + r.V.toFixed(1) + '</b></div><div class="brow"><span>Wady ukryte</span>' + bar(r.H, 12) + '<b>' + r.H.toFixed(1) + '</b></div><div class="brow"><span>Zagrożenie</span>' + bar(r.Z, 12) + '<b>' + r.Z.toFixed(1) + '</b></div></div>' +
      '<div class="defs">' + defs + '</div>' +
      (cur.notes.length ? '<div class="banner">' + cur.notes.join('<br>') + '</div>' : '') +
      '<div class="hint">Zadowolenie klienta: ' + r.satisfaction + '%' + (r.late ? ' (spóźnienie)' : '') + '. Szansa reklamacji: ' + Math.round(r.claim.chance * 100) + '%. Ocena firmy ' + rt.stars.toFixed(1).replace('.', ',') + ' ★ · mnożnik wypłaty ×' + payMult.toFixed(2).replace('.', ',') + ' (firma ×' + rt.payMult.toFixed(2).replace('.', ',') + ', umowa ×' + um.payMult.toFixed(2).replace('.', ',') + ', sezon ×' + sea.toFixed(2).replace('.', ',') + ', plotki ×' + gos.toFixed(2).replace('.', ',') + (cut < 1 ? ', rywal ×' + cut.toFixed(2).replace('.', ',') : '') + (night ? ', noc ×' + String(mods.payMult).replace('.', ',') : '') + ').</div>' +
      econHtml +
      '<button class="primary" id="next">Dalej</button>' + (cur.i >= 0 ? '<button id="again" style="background:transparent">Spróbuj to zlecenie jeszcze raz</button>' : '');
    $('next').onclick = () => renderMenu(); if ($('again')) $('again').onclick = () => startJob(cur.i);
    window.__z.last = r; window.__z.eco = eco;
  }

  let modalOpen = false;
  // ---------- Alledrogo ----------
  let alleTab = 'oferty', alleMsg = '', alleAsk = {};
  function itemName(it) { return Alledrogo.TYPES[it.type].name + ' „' + it.brand + '”'; }
  function renderAlle() {
    ALL.forEach(x => $(x).hidden = true); $('alle').hidden = false;
    ST.market = Alledrogo.refresh(ST.market, ST.day);
    const tabs = [['oferty', 'Oferty'], ['zam', 'Zamówienia (' + ST.orders.length + ')'], ['moje', 'Moje narzędzia (' + ST.inv.length + ')']];
    let body = '';
    if (alleTab === 'oferty') {
      body = '<div class="hint">Oferty odświeżają się co kilka dni (dziś: ' + Czas.dayLabel(ST.clock) + '). Ocena sprzedawcy to nie wszystko, a „jak nowe” za pół ceny rzadko bywa prawdą.</div>' + ST.market.listings.map(l => {
        const ref = Alledrogo.newPrice(l.type, l.tier), cls = Alledrogo.CLASSES.find(c => c.id === l.claimed), T = Alledrogo.TYPES[l.type];
        const cmp = Math.round((l.price / ref - 1) * 100), sus = l.price < ref * cls.price * 0.88;
        const buy = l.mode === 'buynow' ? '<button data-buy="' + l.id + '" class="primary" style="min-height:46px;font-size:1rem" ' + (ST.money >= l.price + l.shipping ? '' : 'disabled') + '>Kup teraz · ' + zl(l.price + l.shipping) + '</button>'
          : '<div class="hint">Licytacja: wybierz limit (konkurent ma swój, nie wiesz jaki).</div><div class="quick">' + [0.9, 1.05, 1.25].map(m => '<button data-bid="' + l.id + ':' + Math.round(l.price * m) + '" ' + (ST.money >= Math.round(l.price * m) + l.shipping ? '' : 'disabled') + '>Do ' + zl(l.price * m) + '</button>').join('') + '</div>';
        return '<div class="prow alle"><div class="hd"><span class="nm">' + Pix.icon(l.type) + ' ' + T.name + ' „' + l.brand + '”</span><span class="chip skill">' + cls.name + '</span></div>' +
          '<div class="hint">poziom: ' + Alledrogo.TIER_NAME[l.tier - 1] + ' · pomaga przy: ' + T.jobs.map(x => ({ kran: 'kran', sciana: 'ściana', gniazdko: 'gniazdko', polka: 'półka' })[x]).join(', ') + '</div>' +
          '<div>„' + l.desc + '”</div>' +
          '<div class="hint">Sprzedawca: <b>' + l.seller.name + '</b> (' + (l.seller.kind === 'sklep' ? 'sklep' : 'osoba prywatna') + ') · ' + l.seller.stars.toFixed(1).replace('.', ',') + ' ★ · ' + l.seller.reviews + ' opinii</div>' +
          '<div class="money"><span>Cena</span><span>' + zl(l.price) + ' + ' + zl(l.shipping) + ' wysyłka</span><span>Nowe: ' + zl(ref) + '</span><span style="color:' + (sus ? 'var(--warn)' : 'var(--muted)') + '">' + (cmp > 0 ? '+' : '') + cmp + '% do nowego' + (sus ? ' ⚠ tanio jak na tę klasę' : '') + '</span></div>' +
          '<div class="hint">Dostawa: ok. ' + l.eta + ' zlec.</div>' + (alleAsk[l.id] ? '<div class="banner">Odpowiedź: „' + alleAsk[l.id] + '”</div>' : '<button data-ask="' + l.id + '" style="min-height:40px">Zadaj pytanie sprzedawcy</button>') + buy + '</div>'; }).join('');
    } else if (alleTab === 'zam') {
      body = ST.orders.length ? ST.orders.map(o => '<div class="prow"><div class="hd"><span class="nm">' + Pix.icon(o.type) + ' ' + Alledrogo.TYPES[o.type].name + ' „' + o.brand + '”</span><span>' + zl(o.paid) + '</span></div><div class="hint">od: ' + o.sellerName + ' · status: ' + o.status + ' · dotrze za ok. ' + o.eta + ' zlec. (paczkomat ma 80 km do ciebie)</div></div>').join('') : '<div class="hint">Nic nie jest w drodze.</div>';
    } else {
      const cov = Alledrogo.coverage(ST.inv), nm = { kran: 'kran', sciana: 'ściana', gniazdko: 'gniazdko', polka: 'półka' };
      const covHtml = '<div class="prow"><div class="hd"><span class="nm">Pokrycie zleceń</span><span>jakość ekwipunku ' + Math.round(Alledrogo.toolScore(ST.inv) * 100) + '%</span></div><div class="hint">' + Object.keys(nm).map(k => nm[k] + ': +' + Math.round(cov[k].acc * 100) + ' pkt celności, −' + Math.round(cov[k].time * 100) + '% czasu').join(' · ') + '</div><div class="hint">To jedyny system narzędzi w grze. Premia zależy od poziomu i stanu, zepsute narzędzia nie liczą się wcale.</div></div>';
      body = covHtml + (ST.inv.length ? ST.inv.map(it => {
        const T = Alledrogo.TYPES[it.type], ok = it.status === 'sprawny', jobs = T.jobs.map(x => ({ kran: 'kran', sciana: 'ściana', gniazdko: 'gniazdko', polka: 'półka' })[x]).join(', ');
        const stan = !it.unboxed ? 'nierozpakowane' : (ok ? 'sprawne, stan ' + Math.round(it.cond) + '%' : '<span class="warn">zepsute</span>');
        const acts = (!it.unboxed ? '<button data-unbox="' + it.id + '" class="primary" style="min-height:44px">Rozpakuj</button>' : '') +
          (it.unboxed ? '<div class="row2"><button data-sell="' + it.id + ':honest" style="min-height:44px">Sprzedaj uczciwie · ' + zl(Alledrogo.sell(it, 'honest', () => 1).price) + '</button><button data-sell="' + it.id + ':lie" style="min-height:44px">Naciągnij · ' + zl(Alledrogo.sell(it, 'lie', () => 1).price) + '</button></div>' : '') +
          (it.unboxed && (!ok || it.cond < 100) ? '<button data-repair="' + it.id + '" style="min-height:44px" ' + (ST.money >= Alledrogo.repairCost(it) ? '' : 'disabled') + '>Serwis · ' + zl(Alledrogo.repairCost(it)) + (ok ? '' : ' (60% szans)') + '</button>' : '') +
          (!ok && it.unboxed && it.source !== 'start' && it.source !== 'spadek' ? '<button data-dispute="' + it.id + '" style="min-height:44px">Otwórz spór (' + (it.source === 'sklep' ? 'sklep zwykle zwraca' : 'prywatny rzadko zwraca') + ')</button>' : '');
        return '<div class="prow"><div class="hd"><span class="nm">' + Pix.icon(it.type) + ' ' + T.name + ' „' + it.brand + '”</span><span>' + stan + '</span></div>' + (it.unboxed ? '<div class="mbar ' + (ok ? moodCls(it.cond) : 'low') + '"><i style="width:' + (ok ? Math.round(it.cond) : 0) + '%"></i></div>' : '') + '<div class="hint">poziom: ' + Alledrogo.TIER_NAME[it.tier - 1] + ' · pomaga przy: ' + jobs + ' · użyć: ' + it.uses + ' · od: ' + it.sellerName + ' · wartość ok. ' + zl(Alledrogo.value(it)) + '</div>' + acts + '</div>'; }).join('') : '<div class="hint">Nie masz jeszcze żadnych narzędzi. Kup zestaw ręczny (pasuje do wszystkich zleceń) albo narzędzia specjalistyczne.</div>');
    }
    $('alle').innerHTML = '<div class="alle-h"><b>Alledrogo</b><span>Okazje, których nie powstydzi się Janusz</span></div>' +
      '<div class="seg">' + tabs.map(t => '<button data-tab="' + t[0] + '" class="' + (alleTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
      (alleMsg ? '<div class="banner">' + alleMsg + '</div>' : '') + body +
      '<div class="note">Alledrogo to fikcyjny serwis na potrzeby gry, każda zbieżność z prawdziwymi serwisami jest przypadkowa. Kupujesz na własne ryzyko.</div><button class="primary" id="alleBack">Wróć</button>';
    $('alleBack').onclick = () => { alleMsg = ''; renderMenu(); };
    $('alle').onclick = e => {
      const q = sel => e.target.closest(sel), tab = q('[data-tab]'), ask = q('[data-ask]'), buy = q('[data-buy]'), bid = q('[data-bid]'), ub = q('[data-unbox]'), sell = q('[data-sell]'), dp = q('[data-dispute]'), rp = q('[data-repair]');
      if (tab) { alleTab = tab.dataset.tab; alleMsg = ''; renderAlle(); return; }
      const find = id => ST.market.listings.find(l => l.id === +id);
      if (ask) { const l = find(ask.dataset.ask), r = Alledrogo.ask(l, rnd); alleAsk[l.id] = r.text; ST.market.listings = ST.market.listings.map(x => x.id === l.id ? r.listing : x); renderAlle(); return; }
      if (buy) { const l = find(buy.dataset.buy), r = Alledrogo.buyNow(l, ST.money); if (r.ok) { cash('zakupy', -r.cost); ST.orders.push(r.order); ST.market = Alledrogo.removeListing(ST.market, l.id); alleMsg = 'Zamówiono „' + l.brand + '” za ' + zl(r.cost) + '. Dotrze za ok. ' + l.eta + ' zlec.'; save(); renderTop(); renderAlle(); } return; }
      if (bid) { const [id, mx] = bid.dataset.bid.split(':'), l = find(id), r = Alledrogo.bid(l, +mx, ST.money, rnd);
        if (r.ok && r.won) { cash('zakupy', -r.cost); ST.orders.push(r.order); ST.market = Alledrogo.removeListing(ST.market, l.id); alleMsg = 'Wygrałeś licytację „' + l.brand + '” za ' + zl(r.price) + ' (+ wysyłka). Dotrze za ok. ' + l.eta + ' zlec.'; }
        else if (r.ok) { ST.market = Alledrogo.removeListing(ST.market, l.id); alleMsg = r.text + ' Aukcja „' + l.brand + '” przepadła.'; } else alleMsg = r.reason;
        save(); renderTop(); renderAlle(); return; }
      if (ub) { const it = ST.inv.find(x => x.id === +ub.dataset.unbox), r = Alledrogo.unbox(it); ST.inv = ST.inv.map(x => x.id === it.id ? r.item : x); alleMsg = '📦 ' + itemName(it) + ': ' + r.text; save(); renderAlle(); return; }
      if (sell) { const [id, mode] = sell.dataset.sell.split(':'), it = ST.inv.find(x => x.id === +id), r = Alledrogo.sell(it, mode, rnd); ST.inv = ST.inv.filter(x => x.id !== it.id); cash('zakupy', r.price); ST.os.gossip = Math.max(0, Math.min(100, ST.os.gossip + r.gossip)); alleMsg = r.text + ' (' + zl(r.price) + (r.gossip ? ', plotki ' + r.gossip : '') + ')'; save(); renderTop(); renderAlle(); return; }
      if (rp) { const it = ST.inv.find(x => x.id === +rp.dataset.repair), r = Alledrogo.repair(it, ST.money, rnd); if (!r.ok) alleMsg = r.reason; else { cash('serwis', -r.cost); ST.inv = ST.inv.map(x => x.id === it.id ? r.item : x); alleMsg = r.text + ' (−' + zl(r.cost) + ')'; } save(); renderTop(); renderAlle(); return; }
      if (dp) { const it = ST.inv.find(x => x.id === +dp.dataset.dispute), r = Alledrogo.dispute(it, rnd); if (!r.ok) alleMsg = r.reason; else { alleMsg = r.text; if (r.success) { cash('zakupy', r.refund); ST.inv = ST.inv.filter(x => x.id !== it.id); } else ST.inv = ST.inv.map(x => x.id === it.id ? Object.assign({}, x, { uses: x.protectUses + 1 }) : x); } save(); renderTop(); renderAlle(); }
    };
  }

  // ---------- fabuła ----------
  function storyCtx() {
    const avg = ST.hist.length ? ST.hist.reduce((a, b) => a + b.index, 0) / ST.hist.length : 30;
    return { done: ST.done, day: ST.day, money: ST.money, rating: co().stars, tier: ST.hq.tier, gossip: ST.os.gossip, taxRisk: ST.fin.tax.risk, debt: Finanse.debt(ST.fin),
      crew: ST.crew.map(w => w.id), rivalPower: ST.os.rival.power, accountant: ST.fin.tax.accountant, owedContact: Osiedle.owedContact(ST.os), flags: ST.story.flags, fusz: avg };
  }
  function checkStory() {
    if (modalOpen) return false;
    const ctx = storyCtx(), b = Fabula.due(ST.story, ctx); if (!b) return false;
    modalOpen = true; $('mtitle').textContent = b.title; $('mtext').textContent = b.text;
    $('mchoices').innerHTML = b.choices.map((c, i) => '<button data-i="' + i + '" ' + (Fabula.choiceAvailable(c, ctx) ? '' : 'disabled') + '>' + c.label + '<small>' + c.sub + '</small></button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const bt = e.target.closest('button'); if (!bt || bt.disabled) return;
      const r = Fabula.resolve(ST.story, b.id, +bt.dataset.i); ST.story = r.story; applyEffects(r.effects, ctx);
      $('modal').hidden = true; modalOpen = false; save(); renderTop();
      if (r.effects.finale) showEnding(); else renderMenu(); };
    return true;
  }
  function applyEffects(e, ctx) {
    if (e.money) cash('zdarzenia', e.money);
    if (e.gossip) ST.os.gossip = Math.max(0, Math.min(100, ST.os.gossip + e.gossip));
    if (e.rivalGrudge) ST.os.rival.grudge += e.rivalGrudge;
    if (e.rivalPower) ST.os.rival.power += e.rivalPower;
    if (e.taxRisk) ST.fin.tax.risk = Math.min(100, ST.fin.tax.risk + e.taxRisk);
    if (e.forceAudit) ST.forceAudit = true;
    if (e.debt) ST.fin = Finanse.addDebt(ST.fin, e.debt.lender, e.debt.amount);
    if (e.accountant) ST.fin.tax.accountant = true;
    if (e.crewMood) ST.crew = ST.crew.map(w => w.id === e.crewMood.id ? Object.assign({}, w, { mood: Math.max(0, Math.min(100, w.mood + e.crewMood.delta)) }) : w);
    if (e.crewPatch) ST.crew = ST.crew.map(w => w.id === e.crewPatch.id ? Object.assign({}, w, e.crewPatch.patch) : w);
    if (e.contact) { const k = ST.os.contacts[e.contact] || (ST.os.contacts[e.contact] = { trust: 20, owes: 0 }); k.owes++; }
    if (e.repayContact) { const id = Osiedle.owedContact(ST.os) || ctx.owedContact; if (id && ST.os.contacts[id]) { ST.os.contacts[id].owes = Math.max(0, ST.os.contacts[id].owes - 1); ST.os.contacts[id].trust = Math.min(100, ST.os.contacts[id].trust + 10); } }
    if (e.giveItem) ST.inv.push(Alledrogo.makeItem(e.giveItem));
    if (e.note) ST.flash.push(e.note);
  }
  function showEnding() {
    const en = Fabula.ending(storyCtx()); ST.story.ending = en.id; save();
    modalOpen = true; $('mtitle').textContent = 'Zakończenie: ' + en.title; $('mtext').textContent = en.text + ' (Możesz grać dalej, historia się nie kończy.)';
    $('mchoices').innerHTML = '<button data-a="ok">Graj dalej</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; modalOpen = false; renderMenu(); };
  }
  function renderStory() {
    ALL.forEach(x => $(x).hidden = true); $('story').hidden = false;
    const ctx = storyCtx(), fired = ST.story.fired, next = Fabula.due(ST.story, ctx);
    const chapters = [1, 2, 3, 4, 5].map(ch => ({ ch, beats: Fabula.BEATS.filter(b => b.chapter === ch) }));
    $('story').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Spadek po dziadku</h2><div class="hint">Rok po spadku: ruderę, długi i osiedle trzeba jakoś ogarnąć. Twoje wybory zmieniają kolejne sceny i zakończenie.</div>' +
      chapters.map(c => '<div class="prow"><div class="hd"><span class="nm">Rozdział ' + c.ch + '</span></div>' + c.beats.map(b => {
        const done = fired.indexOf(b.id) >= 0, entry = ST.story.log.find(l => l.beat === b.id);
        return '<div class="def"><span>' + (done ? '✓ ' : '· ') + b.title + (entry ? '<br><span style="color:var(--muted)">Wybrano: ' + entry.choice + '</span>' : '') + '</span><span class="tag ' + (done ? 'hid' : '') + '">' + (done ? 'za tobą' : 'przed tobą') + '</span></div>'; }).join('') + '</div>').join('') +
      (ST.story.ending ? '<div class="banner">Zakończenie, które osiągnąłeś: ' + Fabula.ending(ctx).title + '. Możesz grać dalej.</div>' : '') +
      '<div class="hint">Sceny odpalają się, gdy spełnisz warunki: liczba zleceń, ocena firmy, plotki, długi, ryzyko skarbowe, a także wcześniejsze wybory. Tajemniczy klient (inspektor jakości) trafia się losowo i nic nie zdradza.</div><button class="primary" id="stBack">Wróć</button>';
    $('stBack').onclick = renderMenu;
  }

  // ---------- finanse ----------
  function renderFin() {
    ALL.forEach(x => $(x).hidden = true); $('fin').hidden = false;
    const f = ST.fin, rating = co().stars, tax = f.tax, ac = Finanse.auditChance(f, { cover: !!ST.fav.audit });
    const lenders = Object.values(Finanse.LENDERS).map(L => {
      const existing = f.loans.filter(l => l.lender === L.id).reduce((s, l) => s + l.principal, 0), room = L.max - existing;
      const need = rating < L.minRating, amt = Math.min(500, room);
      return '<div class="prow"><div class="hd"><span class="nm">' + L.name + '</span><span>' + Math.round(L.rate * 100) + '% / wypłatę</span></div><div class="hint">limit ' + zl(L.max) + (L.minRating ? ' · wymaga oceny firmy ' + L.minRating + ' ★' : ' · bez pytań') + '</div>' +
        '<button data-loan="' + L.id + '" ' + (need || amt <= 0 ? 'disabled' : '') + ' style="min-height:44px">' + (need ? 'Ocena za niska' : amt <= 0 ? 'Limit wyczerpany' : 'Pożycz ' + zl(amt)) + '</button></div>'; }).join('');
    const loans = f.loans.length ? f.loans.map(l => '<div class="prow"><div class="hd"><span class="nm">' + Finanse.LENDERS[l.lender].name + '</span><span>' + zl(l.principal) + '</span></div><div class="hint">odsetki ' + Math.round(l.rate * 100) + '% · minimalna rata ' + zl(Finanse.minPay(l)) + (l.missed ? ' · <span class="warn">zaległości: ' + l.missed + '</span>' : '') + '</div>' +
      '<div class="row2"><button data-repay="' + l.id + ':100" ' + (ST.money >= 100 ? '' : 'disabled') + '>Spłać 100</button><button data-repay="' + l.id + ':all" ' + (ST.money > 0 ? '' : 'disabled') + '>Spłać ile możesz</button></div></div>').join('') : '<div class="hint">Nie masz długów. Gratulacje.</div>';
    $('fin').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Finanse</h2><div class="stats"><div class="stat"><small>Kasa</small><b>' + zl(ST.money) + '</b></div><div class="stat"><small>Długi</small><b>' + zl(Finanse.debt(f)) + '</b></div><div class="stat"><small>Kontrola</small><b>' + Math.round(ac * 100) + '%</b></div></div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase">Księga: ' + Czas.monthName(bookKey()) + '</h3>' + monthReportHTML(bookKey()) +
      (Ksiega.keys(ST.ledger).filter(k => k !== bookKey()).slice(-6).reverse().map(k => { const m = monthSummary(k); return '<div class="erow"><span>' + Czas.monthName(k) + ' · ' + m.jobs + ' zlec.</span><b class="' + (m.plus >= 0 ? 'pos' : 'neg') + '">' + signed(m.plus) + ' · ' + signed(m.perHour) + '/h</b></div>'; }).join('')) +
      '<h3 style="color:var(--muted);text-transform:uppercase">Twoje długi</h3>' + loans + '<h3 style="color:var(--muted);text-transform:uppercase">Pożyczki</h3>' + lenders +
      '<h3 style="color:var(--muted);text-transform:uppercase">Skarbówka</h3><div class="prow"><div class="hd"><span class="nm">Ryzyko kontroli</span><span>' + Math.round(tax.risk) + '%</span></div><div class="mbar ' + moodCls(100 - tax.risk) + '"><i style="width:' + Math.min(100, tax.risk) + '%"></i></div>' +
      '<div class="hint">Ukryte przychody (bez faktur): ' + zl(tax.unreported) + ' · podatek do zapłaty: ' + zl(tax.due) + (tax.accountant ? ' · księgowa pracuje' : '') + (ST.fav.audit ? ' · szwagier trzyma rękę na pulsie' : '') + '</div>' +
      '<button data-acc="1" ' + (tax.accountant || ST.money < Finanse.ACCOUNTANT_COST ? 'disabled' : '') + ' style="min-height:44px">' + (tax.accountant ? 'Księgowa zatrudniona' : 'Zatrudnij księgową · ' + zl(Finanse.ACCOUNTANT_COST)) + '</button></div>' +
      '<button class="primary" id="finBack">Wróć</button>';
    $('finBack').onclick = renderMenu;
    $('fin').onclick = e => {
      const ln = e.target.closest('[data-loan]'), rp = e.target.closest('[data-repay]'), ac2 = e.target.closest('[data-acc]');
      if (ln) { const L = Finanse.LENDERS[ln.dataset.loan], ex = f.loans.filter(l => l.lender === L.id).reduce((s, l) => s + l.principal, 0), r = Finanse.takeLoan(ST.fin, L.id, Math.min(500, L.max - ex), co().stars); if (r.ok) { ST.fin = r.fin; cash('dlug', r.cash); save(); renderTop(); renderFin(); } }
      if (rp) { const [id, amt] = rp.dataset.repay.split(':'), r = Finanse.repay(ST.fin, +id, amt === 'all' ? 1e9 : +amt, Math.floor(ST.money)); if (r.ok) { ST.fin = r.fin; cash('dlug', -r.paid); save(); renderTop(); renderFin(); } }
      if (ac2) { const r = Finanse.hireAccountant(ST.fin, ST.money); if (r.ok) { ST.fin = r.fin; cash('utrzymanie', -r.cost); save(); renderTop(); renderFin(); } }
    };
  }

  // ---------- osiedle ----------
  function renderOs() {
    ALL.forEach(x => $(x).hidden = true); $('os').hidden = false;
    const os = ST.os, rating = co().stars, str = Osiedle.strength({ rating, tier: ST.hq.tier }), rv = os.rival, cut = Osiedle.undercut(os, { rating, tier: ST.hq.tier }), sea = { name: Czas.season(ST.clock), dayInSeason: Czas.dateOf(ST.clock).day };
    const contacts = Object.values(Osiedle.CONTACTS).map(c => { const k = os.contacts[c.id];
      return '<div class="prow"><div class="hd"><span class="nm">' + c.em + ' ' + c.name + '</span><span>' + (k ? 'zaufanie ' + k.trust + '%' : 'nieznajomy') + '</span></div><div class="hint">' + c.fav + (k && k.owes ? ' <span class="warn">Twój dług wdzięczności: ' + k.owes + '</span>' : '') + '</div>' +
        (k ? '<div class="row2"><button data-fav="' + c.id + '">Poproś o przysługę</button><button data-pay="' + c.id + '" ' + (k.owes > 0 && ST.money >= 100 ? '' : 'disabled') + '>Odwdzięcz się · 100 zł</button></div>' : '<button data-meet="' + c.id + '" ' + (ST.money >= c.meetCost ? '' : 'disabled') + ' style="min-height:44px">Poznaj za ' + zl(c.meetCost) + ' (kawa i ciasto)</button>') + '</div>'; }).join('');
    $('os').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Osiedle</h2>' +
      '<div class="prow"><div class="hd"><span class="nm">Kalendarz</span><span>' + Czas.dayLabel(ST.clock) + '</span></div><div class="hint">Sezon: <b>' + sea.name + '</b> (' + Czas.dayLabel(ST.clock) + '). Zima podnosi popyt na kran i gniazdko, wiosna na ściany, jesień na instalacje. Zimą zimny lokal obniża nastrój ekipy.</div></div>' +
      '<div class="prow"><div class="hd"><span class="nm">Plotki na osiedlu</span><span>' + Math.round(os.gossip) + '%</span></div><div class="mbar ' + moodCls(os.gossip) + '"><i style="width:' + os.gossip + '%"></i></div><div class="hint">Mnożnik wypłat od renomy: ×' + Osiedle.gossipMult(os).toFixed(2).replace('.', ',') + '. Karyna i Pani Grażyna gadają najwięcej, Pan Mirek prawie wcale. Wypadki i skandale z ekipą szkodzą.</div></div>' +
      '<div class="prow"><div class="hd"><span class="nm">🦈 ' + rv.name + '</span><span>siła ' + Math.round(rv.power) + ' (ty: ' + Math.round(str) + ')</span></div><div class="mbar ' + moodCls(100 - Math.min(100, rv.power)) + '"><i style="width:' + Math.min(100, rv.power) + '%"></i></div><div class="hint">' + (cut > 0 ? 'Rywal zbija ci ceny: ×' + (1 - cut).toFixed(2).replace('.', ',') + '. ' : 'Rywal jeszcze ci nie szkodzi. ') + 'Rośnie z czasem, podkupuje niezadowolonych pracowników i mści się, gdy go rozdrażnisz (żal: ' + Math.round(rv.grudge) + ').</div></div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase">Znajomości</h3>' + contacts + '<button class="primary" id="osBack">Wróć</button>';
    $('osBack').onclick = renderMenu;
    $('os').onclick = e => {
      const m = e.target.closest('[data-meet]'), fv = e.target.closest('[data-fav]'), py = e.target.closest('[data-pay]');
      if (m) { const r = Osiedle.meet(ST.os, m.dataset.meet, ST.money); if (r.ok) { ST.os = r.os; cash('inne', -r.cost); save(); renderTop(); renderOs(); } }
      if (fv) { const r = Osiedle.useFavor(ST.os, fv.dataset.fav); if (r.ok) { ST.os = r.os; if (r.effect.type !== 'gossip') ST.fav[r.effect.type] = true; ST.flash.push('Przysługa załatwiona: ' + Osiedle.CONTACTS[fv.dataset.fav].fav); save(); renderOs(); } else { ST.flash.push(r.reason); } }
      if (py) { const r = Osiedle.repayFavor(ST.os, py.dataset.pay, ST.money); if (r.ok) { ST.os = r.os; cash('inne', -r.cost); save(); renderTop(); renderOs(); } }
    };
  }

  // ---------- siedziba ----------
  function hqSVG() { return '<div class="scene"><canvas class="pxscene" width="128" height="80" data-scene="hq" role="img" aria-label="Siedziba firmy"></canvas></div>'; }
  function chipsFor(l) {
    const c = [];
    if (l.trust) c.push('zaufanie +' + l.trust); if (l.comfort) c.push('komfort +' + l.comfort); if (l.sec) c.push('ochrona +' + l.sec);
    if (l.demand) c.push('popyt +' + l.demand + '%'); if (l.time) c.push('czas −' + Math.round(l.time * 100) + '%'); if (l.acc) c.push('celność +' + Math.round(l.acc * 100));
    if (l.accMult) c.push('wypadki ×' + String(l.accMult).replace('.', ',')); if (l.upkeep) c.push('utrzymanie +' + l.upkeep + ' zł');
    return c.map(x => '<span class="chip">' + x + '</span>').join('');
  }
  function toolSummary() {
    const c = Alledrogo.coverage(ST.inv), names = { kran: 'kran', sciana: 'ściana', gniazdko: 'gniazdko', polka: 'półka' };
    return Object.keys(names).map(k => names[k] + ' +' + Math.round(c[k].acc * 100) + ' pkt, −' + Math.round(c[k].time * 100) + '% czasu').join('; ');
  }
  function renderHq() {
    ALL.forEach(x => $(x).hidden = true); $('hq').hidden = false;
    const rt = co(), e = rt.effects, hq = ST.hq, nt = Siedziba.nextTier(hq), t = e.tier, pct = x => Math.round(x * 100);
    const parts = [['Siedziba', rt.parts.siedziba], ['Sprzęt', rt.parts.sprzet], ['Opinie klientów', rt.parts.opinie], ['Rzetelność', rt.parts.rzetelnosc]];
    const card = (title, sub, chips, key, cost, label) => '<div class="prow"><div class="hd"><span class="nm">' + title + '</span><span>' + sub + '</span></div>' + (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (key ? '<button data-buy="' + key + '" class="' + (ST.money >= cost ? 'primary' : '') + '" style="min-height:46px;font-size:1rem" ' + (ST.money >= cost ? '' : 'disabled') + '>' + label + ' · ' + zl(cost) + '</button>' : '<div class="hint">Maksymalny poziom.</div>') + '</div>';
    const upCards = Object.keys(Siedziba.UPGRADES).map(k => { const def = Siedziba.UPGRADES[k], cur = hq.up[k], nl = Siedziba.nextLevel('up', k, hq);
      return card(def.name, cur ? 'obecnie: ' + def.levels[cur - 1].name : 'obecnie: stan zastany', nl ? chipsFor(nl) : '', nl ? 'up:' + k : '', nl ? nl.cost : 0, nl ? nl.name : ''); }).join('');
    const asCards = Object.keys(Siedziba.ASSETS).map(k => { const def = Siedziba.ASSETS[k], cur = hq.assets[k], nl = Siedziba.nextLevel('assets', k, hq);
      return card(def.name, cur ? 'obecnie: ' + def.levels[cur - 1].name : 'obecnie: ' + (def.base || 'brak'), nl ? chipsFor(nl) : '', nl ? 'assets:' + k : '', nl ? nl.cost : 0, nl ? nl.name : ''); }).join('');
    const eff = ['Klienci płacą ×' + rt.payMult.toFixed(2).replace('.', ','), '+' + rt.satBonus + ' pkt zadowolenia klientów', 'komfort ekipy: +' + Math.round(e.comfort * 0.5) + ' do bazowego nastroju',
      'ochrona ' + e.security + '%: mniej kradzieży', 'narzędzia: ' + toolSummary() + '', 'flota: wypadki ×' + String(e.accMult).replace('.', ','), 'utrzymanie: ' + zl(e.upkeep) + ' co dzień wypłaty'];
    $('hq').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Siedziba firmy</h2>' + hqSVG() +
      '<div class="hd" style="display:flex;justify-content:space-between;align-items:baseline"><span class="nm" style="font-family:var(--display);font-size:1.4rem">' + t.name + '</span><span class="bignum" style="font-size:2rem;color:var(--hi)">' + rt.stars.toFixed(1).replace('.', ',') + ' ★</span></div>' +
      '<div class="hint">' + t.desc + '</div>' +
      '<div class="break">' + parts.map(p => '<div class="brow"><span>' + p[0] + '</span><span class="b"><i style="width:' + pct(p[1]) + '%"></i></span><b>' + pct(p[1]) + '%</b></div>').join('') + '</div>' +
      '<div class="defs">' + eff.map(x => '<div class="def"><span>' + x + '</span></div>').join('') + '</div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Lokal</h3>' +
      (nt ? card('Następny: ' + nt.name, '', '<span class="chip">' + nt.desc + '</span><span class="chip">utrzymanie ' + zl(nt.upkeep) + '</span><span class="chip">remonty budynku zaczynasz od zera</span>', 'tier', nt.cost, 'Kup i przeprowadź się') : '<div class="hint">Masz najlepszą siedzibę.</div>') +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Remont budynku</h3>' + upCards +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Sprzęt i flota (zostaje po przeprowadzce)</h3>' + asCards +
      '<div class="hint">Narzędzia (kupno, serwis, stan) są w aplikacji Alledrogo. Ocena firmy uwzględnia ich jakość i pokrycie zleceń.</div>' +
      '<div class="hint">Ocena firmy zależy od siedziby, sprzętu, opinii klientów i rzetelności (średnia fuszerka z ostatnich zleceń, minus otwarte reklamacje).</div>' +
      '<button class="primary" id="hqBack">Wróć</button>';
    $('hqBack').onclick = renderMenu;
    $('hq').onclick = ev => {
      const bt = ev.target.closest('[data-buy]'); if (!bt) return;
      const [g, k] = bt.dataset.buy.split(':'); const r = g === 'tier' ? Siedziba.buyTier(ST.hq, ST.money) : Siedziba.buy(ST.hq, g, k, ST.money);
      if (r.ok) { ST.hq = r.hq; cash('zakupy', -r.cost); save(); renderTop(); renderHq(); }
    };
  }

  // ---------- ekipa ----------
  const moodCls = m => m < 30 ? 'low' : m < 60 ? 'mid' : '';
  function crewCard(w, extra) {
    return '<div class="prow"><div class="hd"><span class="nm">' + w.em + ' ' + w.name + '</span><span>' + Ekipa.moodEmoji(w.mood) + ' ' + Ekipa.moodLabel(w.mood) + '</span></div>' +
      '<div class="mbar ' + moodCls(w.mood) + '"><i style="width:' + w.mood + '%"></i></div>' +
      '<div class="hint">' + w.role + ' · umiejętności ' + Math.round(w.skill * 100) + '% · solidność ' + Math.round(w.reliab * 100) + '% · pracowitość ' + Math.round((w.diligence == null ? 0.5 : w.diligence) * 100) + '% · prawo jazdy: ' + (w.license ? 'tak' : 'nie') + ' · pensja ' + zl(w.wage) + (w.outJobs > 0 ? ' · <span class="warn">na zwolnieniu (' + w.outJobs + ')</span>' : '') + ((w.grudge || 0) >= 30 ? ' · <span class="warn">pamięta krzywdy</span>' : '') + ((w.gratitude || 0) >= 30 ? ' · czuje wdzięczność' : '') + (w.owed ? ' · <span class="warn">zaległości ' + zl(w.owed) + '</span>' : '') + '</div>' + (extra || '') + '</div>';
  }
  function renderCrew() {
    ALL.forEach(x => $(x).hidden = true); $('crew').hidden = false;
    const hired = new Set(ST.crew.map(w => w.id)), cands = Ekipa.CANDIDATES.filter(c => !hired.has(c.id));
    $('crew').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Ekipa</h2><div class="hint">Płacisz co ' + Ekipa.PAYDAY_EVERY + ' zlecenia. Zadowolona ekipa robi fuchy na boku i dobrze pomaga. Niedopłacona upomina się, nie przychodzi albo zostawia cię w połowie roboty.</div>' +
      (ST.crew.length ? ST.crew.map(w => crewCard(w, '<button data-fire="' + w.id + '" style="min-height:40px;background:transparent;color:var(--muted)">Zwolnij</button>')).join('') : '<div class="hint">Nikogo nie zatrudniasz. Robisz wszystko sam.</div>') +
      (cands.length ? '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Do zatrudnienia (wpisowe = jedna pensja)</h3>' + cands.map(c => { const w = Ekipa.newWorker(c);
        return crewCard(w, '<div class="hint">' + c.quirk + '</div><button data-hire="' + c.id + '" class="primary" style="min-height:44px;font-size:1rem" ' + (ST.money >= c.wage ? '' : 'disabled') + '>Zatrudnij za ' + zl(c.wage) + '</button>'); }).join('') : '') +
      '<button id="crewBack" class="primary">Wróć</button>';
    $('crewBack').onclick = renderMenu;
    $('crew').onclick = e => {
      const f = e.target.closest('[data-fire]'), h = e.target.closest('[data-hire]');
      if (f) { ST.crew = ST.crew.filter(w => w.id !== f.dataset.fire); save(); renderTop(); renderCrew(); }
      if (h) { const c = Ekipa.CANDIDATES.find(x => x.id === h.dataset.hire); if (ST.money >= c.wage) { cash('zakupy', -c.wage); ST.crew.push(Ekipa.newWorker(c)); save(); renderTop(); renderCrew(); } }
    };
  }

  // ---------- dzień wypłaty ----------
  let PAY = {}, sidePay = null, billText = '';
  function notice(title, text, after) {
    modalOpen = true; $('mtitle').textContent = title; $('mtext').textContent = text; $('mchoices').innerHTML = '<button data-a="ok">OK</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; modalOpen = false; if (after) after(); };
  }
  function weekly() {
    const notes = [];
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
  let weeklyNotes = [];
  function startPayday(forced) {
    weeklyNotes = weekly();
    const up = Siedziba.effects(ST.hq).upkeep, tn = Siedziba.TIERS[ST.hq.tier].name;
    if (!ST.crew.length) {
      ST.nextPay = ST.done + Ekipa.PAYDAY_EVERY; const paid = Math.min(Math.floor(ST.money), up); cash('utrzymanie', -paid); save(); renderTop();
      if (paid > 0 || weeklyNotes.length) notice('Rozliczenie tygodnia', (paid > 0 ? tn + ': ' + zl(paid) + ' za utrzymanie siedziby. ' : '') + weeklyNotes.join(' '), renderMenu); else renderMenu();
      return;
    }
    billText = (up ? 'Utrzymanie siedziby (' + tn + '): −' + zl(Math.min(Math.floor(ST.money), up)) + '. ' : '') + weeklyNotes.join(' ') + ' '; cash('utrzymanie', -up);
    ALL.forEach(x => $(x).hidden = true); $('payday').hidden = false;
    sidePay = Ekipa.sideGigs(ST.crew, rnd); cash('fuchy', sidePay.total); save(); renderTop();
    PAY = Ekipa.defaultPay(ST.crew, Math.floor(ST.money));
    renderPayday();
  }
  function renderPayday() {
    const spent = Object.values(PAY).reduce((a, b) => a + b, 0), left = Math.floor(ST.money) - spent;
    const sg = sidePay && sidePay.total ? 'Ekipa zrobiła fuchy na boku: +' + zl(sidePay.total) + ' (' + sidePay.parts.filter(p => p.gain).map(p => p.name + ' ' + zl(p.gain)).join(', ') + ').' : 'Ekipa nic nie przywiozła z fuch.';
    $('payday').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Dzień wypłaty</h2><div class="hint">' + sg + ' ' + billText + 'Masz ' + zl(ST.money) + '. Rozpisz, kto ile dostaje.</div>' +
      ST.crew.map(w => {
        const p = PAY[w.id] || 0, due = w.wage + w.owed;
        const envy = ST.crew.filter(o => o.id !== w.id && o.skill < w.skill && (PAY[o.id] || 0) > p).map(o => o.name);
        return '<div class="prow" data-id="' + w.id + '"><div class="hd"><span class="nm">' + w.em + ' ' + w.name + '</span><span>' + Ekipa.moodEmoji(w.mood) + ' ' + Ekipa.moodLabel(w.mood) + '</span></div>' +
          '<div class="mbar ' + moodCls(w.mood) + '"><i style="width:' + w.mood + '%"></i></div>' +
          '<div class="hint">Pensja ' + zl(w.wage) + (w.owed ? ' + <span class="warn">zaległości ' + zl(w.owed) + '</span>' : '') + ' · należność ' + zl(due) + '</div>' +
          '<div class="stepper"><button data-d="-10">−</button><b>' + zl(p) + '</b><button data-d="10" ' + (left < 10 ? 'disabled' : '') + '>+</button></div>' +
          '<div class="quick"><button data-set="0">Nic</button><button data-set="' + Math.round(w.wage / 2) + '">Pół</button><button data-set="' + w.wage + '">Pensja</button><button data-set="' + due + '">Z zaległościami</button><button data-set="' + Math.round(due * 1.25) + '">+25%</button></div>' +
          (envy.length ? '<div class="warn">Uwaga: ' + envy.join(', ') + ' dostanie więcej, a umie mniej. ' + w.name + ' to zauważy.</div>' : '') + '</div>'; }).join('') +
      '<div class="money"><span>Rozpisane</span><span>' + zl(spent) + '</span><span class="tot">Zostaje</span><span class="tot">' + zl(left) + '</span></div>' +
      '<button class="primary" id="doPay" ' + (left < 0 ? 'disabled' : '') + '>Wypłać</button>';
    $('payday').onclick = e => {
      const row = e.target.closest('.prow'); if (!row) { return; }
      const id = row.dataset.id, b = e.target.closest('button'); if (!b) return;
      const spentNow = Object.values(PAY).reduce((a, c) => a + c, 0), avail = Math.floor(ST.money) - spentNow + (PAY[id] || 0);
      if (b.dataset.d) PAY[id] = Math.max(0, Math.min(avail, (PAY[id] || 0) + +b.dataset.d));
      if (b.dataset.set != null) PAY[id] = Math.max(0, Math.min(avail, +b.dataset.set));
      renderPayday();
    };
    $('doPay').onclick = confirmPay;
  }
  const rl = a => a[Math.floor(rnd() * a.length)];
  function confirmPay() {
    const res = Ekipa.applyPay(ST.crew, PAY, { patienceBonus: Siedziba.effects(ST.hq).comfort * 0.5 - Kalendarz.moodPenalty(Czas.season(ST.clock), Siedziba.effects(ST.hq).comfort) }); cash('pensje', -res.spent); ST.crew = res.workers;
    const lines = res.details.map(d => {
      const w = ST.crew.find(x => x.id === d.id);
      const weaker = ST.crew.filter(o => o.id !== d.id && o.skill < w.skill && (PAY[o.id] || 0) > (PAY[d.id] || 0))[0];
      let say = d.bonus > 0 ? rl(['„Szef ma głowę do ludzi!”', '„No, to się nazywa wypłata.”']) : d.shortfall > 0 ? rl(['„To ma być wypłata?!”', '„Gdzie reszta? Mam rodzinę.”', '„Policzę, ile mi wisisz, i zapamiętam.”']) : '„Zgadza się, dziękuję.”';
      if (d.parts.envy < 0 && weaker) say += ' „A czemu ' + weaker.name + ' dostał więcej?”';
      return '<div class="def"><span><b>' + w.em + ' ' + w.name + '</b> ' + Ekipa.moodEmoji(d.mood) + ' ' + (d.delta >= 0 ? '+' : '') + d.delta + '<br><span style="color:var(--muted)">' + say + '</span></span><span class="tag ' + (d.delta >= 0 ? 'hid' : 'vis') + '">' + zl(d.paid) + '</span></div>'; });
    // odejścia
    const left = ST.crew.filter(Ekipa.quits);
    left.forEach(w => { lines.push('<div class="banner">🚪 ' + w.name + ' odchodzi i opowiada po osiedlu, że jesteś kombinatorem. Reputacja spada.</div>'); ST.ratings.push(2); });
    ST.crew = ST.crew.filter(w => !Ekipa.quits(w));
    ST.nextPay = ST.done + Ekipa.PAYDAY_EVERY; ST.lastPayDone = ST.done; save(); renderTop();
    $('payday').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Po wypłacie</h2><div class="defs">' + lines.join('') + '</div><button class="primary" id="payOk">Dalej</button>';
    $('payOk').onclick = renderMenu;
  }

  // ---------- upominanie się ----------
  function askDemand(w, d) {
    modalOpen = true;
    $('mtitle').textContent = w.name + ' się upomina'; $('mtext').textContent = d.text;
    const pay = Math.min(Math.floor(ST.money), d.amount);
    $('mchoices').innerHTML = '<button data-a="y">Daj ' + zl(pay) + (d.kind === 'zaleglosc' ? ' na poczet zaległości' : ' zaliczki') + '<small>nastrój +12' + (pay < d.amount ? ' (to wszystko, co masz)' : '') + '</small></button><button data-a="n">Odmów<small>nastrój −' + Math.round(12 * w.greed) + ', ryzyko, że nie przyjdzie</small></button>';
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      const yes = b.dataset.a === 'y'; if (yes) cash('pensje', -pay);
      ST.crew = ST.crew.map(x => x.id === w.id ? Ekipa.answerDemand(x, yes, pay) : x);
      ST.demandAt[w.id] = ST.done; save(); $('modal').hidden = true; modalOpen = false; renderMenu(); };
  }
  function checkDemands() {
    if (modalOpen) return false;
    for (const w of ST.crew) { const d = Ekipa.demand(w);
      if (d && ST.done - (ST.demandAt[w.id] == null ? -9 : ST.demandAt[w.id]) >= 2) { askDemand(w, d); return true; } }
    return false;
  }
  /* Raport za zakończony miesiąc: plus, koszty po kategoriach, stawka godzinowa. */
  function monthReportHTML(key) {
    const m = monthSummary(key), rows = Object.entries(m.cats).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([c, v]) => '<div class="erow"><span>' + Ksiega.CATS[c].label + '</span><b class="' + (v >= 0 ? 'pos' : 'neg') + '">' + signed(v) + '</b></div>').join('');
    return '<div class="econ"><div class="erow big"><span>Plus w miesiącu</span><b class="' + (m.plus >= 0 ? 'pos' : 'neg') + '">' + signed(m.plus) + '</b></div>' +
      '<div class="erow"><span>Przychody</span><b class="pos">' + signed(m.income) + '</b></div><div class="erow"><span>Koszty</span><b class="neg">' + signed(m.costs) + '</b></div>' + rows +
      '<div class="erow"><span>Zlecenia: ' + m.jobs + ' · przepracowane ' + Czas.fmtMin(m.hours * 60) + '</span><b class="' + (m.perHour >= 0 ? 'pos' : 'neg') + '">' + signed(m.perHour) + '/h</b></div>' +
      (m.invest || m.debt ? '<div class="hint">Poza plusem: inwestycje ' + signed(m.invest) + ', dług ' + signed(m.debt) + '.</div>' : '') + '</div>';
  }
  function showMonthReport(key) {
    modalOpen = true; const m = monthSummary(key);
    $('mtitle').textContent = 'Podsumowanie: ' + Czas.monthName(key);
    $('mtext').innerHTML = (m.plus >= 0 ? 'Miesiąc na plusie. ' : 'Miesiąc na minusie. ') + 'Stawka po wszystkich kosztach: <b>' + signed(m.perHour) + '/h</b> (' + m.jobs + ' zlec.).' + monthReportHTML(key);
    $('mchoices').innerHTML = '<button data-a="ok">Dalej</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; modalOpen = false; save(); renderMenu(); };
  }
  function nextEvent() {
    if (modalOpen) return;
    if (ST.pendingMonths.length) { showMonthReport(ST.pendingMonths.shift()); return; }
    if (ST.done >= ST.nextPay) { startPayday(true); return; }
    if (checkClaims()) return;
    if (checkDemands()) return;
    checkStory();
  }

  // ---------- reklamacje po tygodniu ----------
  function checkClaims() {
    if (modalOpen) return false;
    const k = ST.claims.findIndex(c => c.due <= ST.done);
    if (k < 0) return false;
    const c = ST.claims[k]; modalOpen = true;
    const acc = c.kind === 'wypadek';
    $('mtitle').textContent = acc ? 'Wypadek!' : 'Reklamacja po tygodniu';
    $('mtext').textContent = acc
      ? c.client + ' dzwoni z oddziału ratunkowego: „' + c.defect + '”. Ktoś musi za to odpowiedzieć.'
      : c.client + ' dzwoni: „Panie majster, wróciło. ' + c.defect[0].toUpperCase() + c.defect.slice(1) + '.”';
    const pay = Math.min(ST.money, c.amount);
    $('mchoices').innerHTML =
      '<button data-a="pay">' + (acc ? 'Zapłać odszkodowanie' : 'Napraw na własny koszt') + '<small>−' + zl(pay) + (pay < c.amount ? ' (wszystko, co masz)' : '') + '</small></button>' +
      '<button data-a="ignore">' + (acc ? 'Zniknij na tydzień' : 'Zignoruj, nie odbieraj telefonu') + '<small>reputacja −' + (acc ? 2 : 1) + ' ★, kasa −' + (acc ? 30 : 0) + '%</small></button>';
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      ST.claims.splice(k, 1);
      if (b.dataset.a === 'pay') cash('reklamacje', -pay);
      else { ST.ratings.push(1); if (acc) { ST.ratings.push(1); cash('reklamacje', -ST.money * 0.3); } }
      save(); $('modal').hidden = true; modalOpen = false; renderMenu(); };
    return true;
  }

  $('reset').onclick = () => { if ($('reset').dataset.s) { ST = fresh(); save(); delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; renderMenu(); } else { $('reset').dataset.s = 1; $('reset').textContent = 'Na pewno? Kliknij jeszcze raz'; setTimeout(() => { delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; }, 3000); } };

  // pikselizacja: emoji i znaczniki @postać zamieniane na sprite'y, sceny SVG na obrazy w małej rozdzielczości
  (function () {
    let busy = false;
    const run = () => { if (busy) return; busy = true; try { Pix.pixelize(document.body); document.querySelectorAll('canvas.pxscene:not([data-drawn])').forEach(cv => { cv.dataset.drawn = '1'; paintScene(cv); }); } finally { busy = false; } };
    new MutationObserver(() => requestAnimationFrame(run)).observe(document.body, { childList: true, subtree: true });
    run();
  })();
  window.__z = { get ST() { return ST; }, get cur() { return cur; }, renderAlle, renderHq, renderFin, renderOs, renderStory, checkStory, weekly, co, startJob, renderMenu, renderCrew, startPayday };
  renderMenu();
})();
