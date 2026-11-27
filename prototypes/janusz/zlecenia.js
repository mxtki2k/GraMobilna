/* Interfejs zleceń: lista poziomów, scenka naprawy krok po kroku, mini-gra na wyczucie, odbiór u klienta, reklamacje. */
(() => {
  const { JOBS, CLIENTS, LEVELS } = Jobs;
  const $ = id => document.getElementById(id);
  const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
  const rnd = Math.random;
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  // silnik bez UI (silnik.js): stan, zegar, księga, ekipa, kontrakty, przetargi, rok. Ten plik to widok.
  const E = Silnik.create({ rnd, storage: { getItem: lsGet, setItem: lsSet } });
  E.load();
  const { ST, META, fresh, withMeta, saveMeta, bookKey, cash, syncLedger, monthSummary, advanceClock, save, reputation, co, KT, cLimit, specM, specLevels, extraPay, callP, clothesPrice, estimateFor, perHourTxt, refBonus, applyToolSale, settleJob, crewBusy, crewFree, ensureBoard, tenderCtx, yearStats } = E;
  const { weekly, checkDemands, checkClaims, checkMonthReport, formalCtx, newJob, applyOption, sleepNow, dayOffNow, vacationNow, askTender, askContract, askCancel, switchContract, checkContractFinal, collectCrew, checkYear, pickWorkerFor, dispatchCrew } = E;
  const waitHour = () => E.waitHour(startJob);
  /* Zegar widoczny dla gracza: w trakcie zlecenia startowy + postęp pracy. */
  const viewClock = () => cur && !$('job').hidden ? cur.startClock + Czas.minutes(Math.max(0, cur.time + cur.timeAdj), cur.night) : ST.clock;
  let anim = null;

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
  const ALL = ['menu', 'job', 'result', 'crew', 'payday', 'hq', 'fin', 'os', 'story', 'alle', 'prestige', 'wardrobe', 'plan'];
  function renderTop() {
    $('money').textContent = zl(ST.money);
    $('rep').textContent = co().stars.toFixed(1).replace('.', ',') + ' ★';
    const ms = monthSummary(), pl = $('plus'); pl.textContent = signed(ms.plus); pl.className = ms.plus >= 0 ? 'pos' : 'neg';
    $('plusl').textContent = 'Plus: ' + Czas.monthName(bookKey());
    const vc = viewClock(), n = Czas.isNight(vc);
    $('clock').innerHTML = (n ? '🌙' : '☀️') + ' ' + Czas.label(vc) + ' · ' + (n ? 'noc' : 'dzień') + '<br><small>zmęczenie: ' + Zmeczenie.label(ST.fatigue) + ' (' + Math.round(ST.fatigue) + '%) · wypalenie: ' + Wypalenie.label(ST.burnout) + ' (' + Math.round(ST.burnout) + '%)</small>';
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
      contractsHTML() + tendersHTML() + boardHTML() + '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Zlecenia</h3>' + LEVELS.map((l, i) => {
      const job = JOBS[l.job], cl = CLIENTS[l.client], locked = i + 1 > ST.unlocked, b = ST.best[i], est = estimateFor(l), st = Czas.jobStart(ST.clock, l.time, 1);
      return '<button class="lvl' + (l.slot === 'noc' ? ' nightlvl' : '') + '" data-i="' + i + '" ' + (locked ? 'disabled' : '') + '><span class="av">' + (locked ? '🔒' : cl.em) + '</span><span><b>' + (i + 1) + '. ' + job.title + '</b><small>' + (l.slot === 'noc' ? '🌙 ' : '☀️ ') + Czas.label(st) + '</small><small>' + (l.due ? '⏰ ' + Terminy.KINDS[l.due].name + ' · ' : '') + (Klienci.get(ST.rel, l.client).jobs ? '🤝 ' + Klienci.level(Klienci.get(ST.rel, l.client).trust) + ' · ' : '') + job.place + ' · ' + cl.name + ' · ok. ' + zl(job.base * l.mult * (l.slot === 'noc' ? Czas.NIGHT.payMult : 1)) + ' · ' + perHourTxt(est) + '</small></span><span class="res">' +
        (b ? '<span class="stars">' + stars(b.stars) + '</span><br>fuszerka ' + b.index + '%' : (locked ? '' : 'nowe')) + '</span></button>';
    }).join('');
    bindContracts(); bindBoard(); bindTenders();
    { const ev = Sezon.active(ST.clock); if (ev.length) $('menu').insertAdjacentHTML('afterbegin', ev.map(e => '<div class="banner">' + e.em + ' <b>' + e.name + '</b>: ' + e.text + (e.demand ? ' Popyt: ' + Object.entries(e.demand).map(([j, m]) => (JOBS[j] ? JOBS[j].title.toLowerCase() : j) + ' ×' + String(m).replace('.', ',')).join(', ') + '.' : '') + (e.pay ? ' Wypłaty ×' + String(e.pay).replace('.', ',') + '.' : '') + (e.toolPrice ? ' Narzędzia ×' + String(e.toolPrice).replace('.', ',') + '.' : '') + '</div>').join('')); }
    $('menu').insertAdjacentHTML('beforeend', waitHTML());
    $('menu').insertAdjacentHTML('beforeend', '<button id="goPlan" style="min-height:48px">📅 Plan dnia (kontrakty i ekipa)</button>'); $('goPlan').onclick = () => renderPlan(0);
    $('menu').insertAdjacentHTML('beforeend', '<button id="goWardrobe" style="min-height:48px">👔 Szafa i sklep z ubraniami</button>'); $('goWardrobe').onclick = renderWardrobe;
    $('menu').insertAdjacentHTML('beforeend', '<button id="goPrestige" style="min-height:48px">🏆 Prestiż: ' + META.points + ' pkt · gra nr ' + META.games + '</button>'); $('goPrestige').onclick = renderPrestige;
    $('wait').onclick = waitHour; $('sleep').onclick = sleepNow; $('dayoff').onclick = dayOffNow; $('vac').onclick = vacationNow;
    $('goCrew').onclick = renderCrew; $('goHq').onclick = renderHq; $('goFin').onclick = renderFin; $('goOs').onclick = renderOs; $('goStory').onclick = renderStory; $('goAlle').onclick = renderAlle;
    nextEvent();
  }
  // ---------- ekipa na własnych zleceniach (faza B) ----------
  function boardHTML() {
    if (!ST.crew.length) return '';
    ensureBoard();
    const h = '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Ekipa na zleceniach</h3>';
    const act = ST.crewJobs.slice().sort((a, b) => a.endAt - b.endAt).map(j => { const w = ST.crew.find(x => x.id === j.workerId); return '<div class="erow"><span>' + (w ? w.em + ' ' + w.name : '?') + ': ' + JOBS[j.offer.job].title + ' · ' + CLIENTS[j.offer.client].name + ' (' + ZlecEkipy.DISTRICTS[j.offer.district] + ')</span><b>' + (j.endAt > ST.clock ? 'do ' + Czas.hm(j.endAt) : 'gotowe!') + '</b></div>'; }).join('');
    const offers = ST.board.offers.map(o => { const job = JOBS[o.job], free = ST.crew.filter(w => !crewBusy(w) && !(w.outJobs > 0) && ZlecEkipy.canDo(w, o.job, ST.certs));
      return '<button class="lvl" data-offer="' + o.id + '" ' + (free.length ? '' : 'disabled') + '><span class="av">' + CLIENTS[o.client].em + '</span><span><b>' + job.title + '</b><small>' + CLIENTS[o.client].name + ' · ' + ZlecEkipy.DISTRICTS[o.district] + ' · ok. ' + zl(job.base * o.mult) + '</small><small>trudność ' + Math.round(ZlecEkipy.difficulty(o.job) * 100) + '% · ' + (free.length ? 'wolnych: ' + free.length : 'brak wolnych pracowników z uprawnieniami') + '</small></span><span class="res">zleć</span></button>'; }).join('');
    return h + '<div class="hint">Pracownicy robią proste zlecenia sami, w dzień (8–17), z dojazdem. Jakość zależy od umiejętności, trzeźwości i nastroju. Ty w tym czasie bierzesz trudniejsze roboty. Jesteś teraz: ' + ZlecEkipy.DISTRICTS[ST.where] + '.</div>' + (act ? '<div class="econ">' + act + '</div>' : '') + offers;
  }
  function bindBoard() { document.querySelectorAll('[data-offer]').forEach(b => { b.onclick = () => pickWorkerFor(+b.dataset.offer); }); }
  /* Odbiór wyników ekipy, której czas minął: wypłaty, materiały, reklamacje, oceny. */
  // ---------- plan dnia (oś czasu) ----------
  function renderPlan(offset) {
    offset = offset || 0; ALL.forEach(x => $(x).hidden = true); $('plan').hidden = false; renderTop();
    const day0 = Math.floor(ST.clock / 1440) * 1440 + offset * 1440, items = [];
    [KT().active].concat(KT().others).filter(a => a && a.stage < Kontrakty.CONTRACTS[a.id].stages.length).forEach(a => { const c = Kontrakty.CONTRACTS[a.id], lv = Kontrakty.stageLevel({ active: a }, ST.clock), dur = Math.round(JOBS[lv.job].deadline * 5 * (lv.slot === 'noc' ? 1.1 : 1));
      items.push({ row: 'Ty', start: lv.startAt, end: lv.startAt + dur, label: c.title + ' · ' + JOBS[lv.job].title, kind: 'kontrakt' }); });
    ST.crewJobs.forEach(j => { const w = ST.crew.find(x => x.id === j.workerId), nm = w ? w.name : '?'; if (j.trav) items.push({ row: nm, start: j.startAt, end: j.startAt + j.trav, label: 'dojazd', kind: 'dojazd' });
      items.push({ row: nm, start: j.startAt + (j.trav || 0), end: j.endAt, label: JOBS[j.offer.job].title + ' (' + ZlecEkipy.DISTRICTS[j.offer.district] + ')', kind: j.failed ? 'wypadek' : 'ekipa' }); });
    const blocks = ZlecEkipy.buildPlan(day0, items), rows = ['Ty'].concat(ST.crew.map(w => w.name)), now = (ST.clock - day0) / 1440 * 100;
    const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map(h => '<span style="position:absolute;left:' + h / 24 * 100 + '%;top:0;font-size:.7rem;color:var(--muted)">' + String(h).padStart(2, '0') + '</span>').join('');
    const band = 'linear-gradient(90deg,#0e1630 0%,#0e1630 25%,transparent 25%,transparent 91.6%,#0e1630 91.6%)';
    const COL = { kontrakt: '#ffc300', ekipa: '#6ccf7f', dojazd: '#8a97a3', wypadek: '#ef5350' };
    const lines = rows.map(r => '<div style="display:grid;grid-template-columns:70px 1fr;gap:6px;align-items:center;margin:3px 0"><span style="font-size:.85rem">' + r + '</span><div style="position:relative;height:26px;background:' + band + ',#1b1e22;box-shadow:0 0 0 2px #000">' +
      blocks.filter(b => b.row === r).map(b => '<div title="' + b.label + '" style="position:absolute;left:' + b.left + '%;width:' + b.width + '%;top:2px;bottom:2px;background:' + COL[b.kind] + ';overflow:hidden;font-size:.62rem;line-height:22px;color:#14171a;white-space:nowrap">' + (b.kind === 'dojazd' ? '' : b.label) + '</div>').join('') +
      (now >= 0 && now <= 100 ? '<div style="position:absolute;left:' + now + '%;top:0;bottom:0;width:2px;background:#fff"></div>' : '') + '</div></div>').join('');
    const list = blocks.filter(b => b.kind !== 'dojazd').sort((a, b) => a.from - b.from).map(b => '<div class="erow"><span>' + b.row + ': ' + b.label + '</span><b>' + Czas.hm(day0 + b.from) + '–' + Czas.hm(day0 + b.to) + '</b></div>').join('');
    $('plan').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Plan dnia</h2><div class="hint">' + Czas.dayLabel(day0) + '. Pasek: biała kreska to teraz, ciemne tło to noc, żółte etapy twoich kontraktów, zielone zlecenia ekipy, szare dojazdy, czerwone wypadki.</div>' +
      '<div class="row2"><button id="pToday" ' + (offset === 0 ? 'disabled' : '') + '>Dziś</button><button id="pTom" ' + (offset === 1 ? 'disabled' : '') + '>Jutro</button></div><div style="position:relative;height:16px;margin-left:76px">' + ticks + '</div>' + lines +
      (list ? '<div class="econ">' + list + '</div>' : '<div class="hint">Nic nie zaplanowano na ten dzień. Zleć coś ekipie z tablicy albo przyjmij kontrakt.</div>') + '<div class="hint">Jesteś: ' + ZlecEkipy.DISTRICTS[ST.where] + '. Dojazd z bazy: osiedle 8 min, centrum 18, wieś 35.</div><button class="primary" id="pBack">Wróć</button>';
    $('pToday').onclick = () => renderPlan(0); $('pTom').onclick = () => renderPlan(1); $('pBack').onclick = renderMenu;
  }
  // ---------- szafa i sklep z ubraniami (faza E) ----------
  function renderWardrobe() {
    ALL.forEach(x => $(x).hidden = true); $('wardrobe').hidden = false; renderTop();
    const W = ST.wardrobe, cur0 = Ubrania.current(W), day = Czas.dateOf(ST.clock).dayIndex, pm = clothesPrice(), icon = o => Pix.icon(o.icon, 'inline');
    const taste = Object.keys(CLIENTS).map(cid => { const e = Ubrania.effect(cur0, cid, {}), f = Ubrania.effect(cur0, cid, { formal: true }); return '<div class="erow"><span>' + CLIENTS[cid].name + '</span><b class="' + (e.imp >= 0 ? 'pos' : 'neg') + '">' + (e.imp >= 0 ? '+' : '') + e.imp.toFixed(1).replace('.', ',') + ' · przetarg ' + (f.imp >= 0 ? '+' : '') + f.imp.toFixed(1).replace('.', ',') + '</b></div>'; }).join('');
    const owned = W.owned.map(it => { const o = Ubrania.OUTFITS[it.id]; return '<div class="prow"><div class="hd"><span class="nm">' + icon(o) + ' ' + o.name + (it.uid === W.worn ? ' · NA SOBIE' : '') + '</span><span>' + Math.round(it.cond) + '%' + (it.dirty ? ' · brudne' : '') + (it.smell ? ' · śmierdzi' : '') + '</span></div><div class="row2">' +
      (it.uid !== W.worn ? '<button data-wear="' + it.uid + '" style="min-height:40px">Załóż</button>' : '<button disabled style="min-height:40px">Założone</button>') + (it.dirty ? '<button data-wash="' + it.uid + '" ' + (ST.money >= Ubrania.WASH ? '' : 'disabled') + ' style="min-height:40px">Pierz · ' + zl(Ubrania.WASH) + '</button>' : (it.id !== 'wlasne' ? '<button data-sell="' + it.uid + '" style="min-height:40px">Sprzedaj · ' + zl(Math.round(o.price * 0.3 * it.cond / 100)) + '</button>' : '<span></span>')) + '</div></div>'; }).join('');
    const shop = Object.values(Ubrania.OUTFITS).filter(o => o.id !== 'wlasne').map(o => { const c = Math.round(o.price * pm); return '<div class="prow"><div class="hd"><span class="nm">' + icon(o) + ' ' + o.name + '</span><span>' + zl(c) + (pm < 1 ? ' (wyprzedaż)' : '') + '</span></div><div class="hint">wiarygodność ' + Math.round(o.cred * 100) + '% · elegancja ' + Math.round(o.style * 100) + '% · robocze ' + Math.round(o.work * 100) + '% · wytrzymuje ok. ' + o.dur + ' zleceń · brudzi się ' + Math.round(o.dirt * 100) + '%</div><button data-buy="' + o.id + '" ' + (ST.money >= c ? '' : 'disabled') + ' style="min-height:44px">Kup · ' + zl(c) + '</button></div>'; }).join('');
    const lump = Ubrania.lumpeks(day).filter(l => !(ST.wardrobe.bought || []).includes(l.id)).map(l => { const o = Ubrania.OUTFITS[l.outfit]; return '<div class="prow"><div class="hd"><span class="nm">' + icon(o) + ' ' + o.name + ' (używane)</span><span>' + zl(l.price) + '</span></div><div class="hint">stan ' + l.cond + '%, sprzedawca zapewnia, że „nie śmierdzi”.</div><button data-lump="' + l.id + '" ' + (ST.money >= l.price ? '' : 'disabled') + ' style="min-height:44px">Kup z lumpeksu · ' + zl(l.price) + '</button></div>'; }).join('');
    const crew = ST.crew.map(w => { const u = Ubrania.uniformOf(W, w.id); return '<div class="prow"><div class="hd"><span class="nm">' + w.em + ' ' + w.name + '</span><span>' + (u ? Pix.icon(u.icon, 'inline') + ' ' + u.name + ' · ' + Math.round(u.cond) + '%' + (u.bhp ? ' · BHP' : '') : 'bez stroju') + '</span></div><div class="chips">' + Object.values(Ubrania.UNIFORMS).map(x => '<button data-uni="' + w.id + ':' + x.id + '" ' + (ST.money >= x.price ? '' : 'disabled') + ' style="min-height:36px;font-size:.8rem">' + x.name + ' · ' + zl(x.price) + '</button>').join('') + '</div></div>'; }).join('');
    $('wardrobe').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Szafa i sklep</h2><div class="hint">Wiarygodność rośnie z ceną i stanem, ale gust klientów jest różny: Karyna i Sebix lubią styl, Heniek i Grażyna ceniących robocze ubranie, a garnitur na malowaniu to zły pomysł. W przetargu liczy się elegancja.</div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase">Wrażenie obecnego ubioru</h3><div class="econ">' + taste + '</div><h3 style="color:var(--muted);text-transform:uppercase">Twoja szafa</h3>' + owned +
      '<h3 style="color:var(--muted);text-transform:uppercase">Sklep z odzieżą roboczą</h3>' + shop + '<h3 style="color:var(--muted);text-transform:uppercase">Lumpeks (dziś)</h3>' + (lump || '<div class="hint">Na dziś wszystko wykupione.</div>') +
      '<h3 style="color:var(--muted);text-transform:uppercase">Ciuchy firmowe dla ekipy</h3><div class="hint">Zestawy z logo (lepsze logo = lepsza wiarygodność ze szyldu). BHP wymagane w przetargach. Nastrój ekipy rośnie, zestawy się zużywają.</div>' + (crew || '<div class="hint">Nie masz jeszcze ekipy.</div>') + '<button class="primary" id="wBack">Wróć</button>';
    $('wBack').onclick = renderMenu;
    $('wardrobe').onclick = e => {
      const OPS = { wear: 'wear', wash: 'wash', sell: 'sell', buy: 'buy', lump: 'lump', uni: 'uni' };
      for (const [attr, op] of Object.entries(OPS)) { const b = e.target.closest('[data-' + attr + ']'); if (b) { const arg = b.dataset[attr]; if (E.wardrobeCmd(op, arg) && op !== 'wear') renderTop(); if (op !== 'lump' && op !== 'uni' || true) renderWardrobe(); return; } }
    };
  }
  // ---------- rok firmy, prestiż i Nowa Gra+ (faza D) ----------
  function renderPrestige() {
    ALL.forEach(x => $(x).hidden = true); $('prestige').hidden = false; renderTop();
    const perks = Object.entries(Rok.PERKS).map(([id, p]) => { const lv = META.perks[id] || 0, c = Rok.perkCost(META, id);
      return '<div class="prow"><div class="hd"><span class="nm">⭐ ' + p.name + '</span><span>poziom ' + lv + '/' + p.max + '</span></div><div class="hint">' + p.desc + '</div><button data-perk="' + id + '" ' + (c === null || META.points < c ? 'disabled' : '') + ' style="min-height:44px">' + (c === null ? 'Maksimum' : 'Kup poziom ' + (lv + 1) + ' · ' + c + ' pkt') + '</button></div>'; }).join('');
    const yrs = META.years.slice(-8).reverse().map(y => '<div class="erow"><span>Rok ' + y.year + ' · miejsce ' + y.rank + '.</span><b class="' + (y.plus >= 0 ? 'pos' : 'neg') + '">' + (y.plus >= 0 ? '+' : '−') + zl(Math.abs(y.plus)) + ' · +' + y.pts + ' pkt</b></div>').join('');
    $('prestige').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Prestiż</h2><div class="stats"><div class="stat"><small>Punkty</small><b>' + META.points + '</b></div><div class="stat"><small>Gra nr</small><b>' + META.games + '</b></div><div class="stat"><small>Wydane</small><b>' + META.spent + '</b></div></div>' +
      '<div class="hint">Punkty dostajesz za zysk, ocenę, nagrody, miejsce w rankingu osiedla, kontrakty i przetargi na koniec każdego roku kalendarzowego. Perki zostają na zawsze. Nowa Gra+ zaczyna firmę od zera z bonusami.</div>' + perks + (yrs ? '<h3 style="color:var(--muted);text-transform:uppercase">Historia lat</h3><div class="econ">' + yrs + '</div>' : '') +
      '<button id="ngp" class="primary">Nowa Gra+ (zaczynasz od zera)</button><button class="primary" id="prBack">Wróć</button>';
    $('prBack').onclick = renderMenu;
    $('prestige').onclick = e => { const b = e.target.closest('[data-perk]'); if (b) { if (E.buyPerk(b.dataset.perk)) renderPrestige(); return; }
      if (e.target.closest('#ngp')) E.askNewGamePlus(); };
  }
  // ---------- przetargi publiczne (faza C) ----------
  function tendersHTML() {
    const h = '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Przetargi publiczne</h3>', day = Czas.dateOf(ST.clock).dayIndex;
    const rows = Object.values(Przetargi.TENDERS).map(t => { const miss = Przetargi.missing(t, tenderCtx(t.client)), cd = Przetargi.cooldownOk(ST.tenderCool, t.id, day), q = Kontrakty.quote(Kontrakty.CONTRACTS[Przetargi.cid(t.id)], JOBS), cl = CLIENTS[t.client], bhp = Ubrania.bhpOk(ST.wardrobe, ST.crew), ok = !miss.length && cd && Kontrakty.canAccept(KT(), cLimit()) && bhp;
      return '<button class="lvl" data-tender="' + t.id + '" ' + (ok ? '' : 'disabled') + '><span class="av">' + (miss.length ? '🔒' : cl.em) + '</span><span><b>' + t.title.replace('Przetarg: ', '') + '</b><small>' + t.stages.length + ' etapów · ' + t.deadline + ' dni · wartość ok. ' + zl(q.expected) + ' · wadium ' + zl(Math.round(q.nominal * Przetargi.WADIUM)) + '</small><small>' + (miss.length ? 'brakuje: ' + miss.join(', ') : !bhp ? 'ekipa bez odzieży BHP (kombinezony lub kurtki z Szafy)' : !cd ? 'rozstrzygnięty, następny za tydzień' : Kontrakty.canAccept(KT(), cLimit()) ? t.desc : 'brak wolnego miejsca na kontrakt') + '</small></span><span class="res">' + (ok ? 'oferta' : '') + '</span></button>'; }).join('');
    return h + '<div class="hint">Duże zlecenia publiczne: wysokie stawki, wadium i surowy audyt. Wady zagrażające bezpieczeństwu wykryte przy odbiorze oblewają audyt (kara ' + Math.round(Kontrakty.AUDIT_FAIL * 100) + '% wartości, wadium przepada). Wymagają oceny firmy, siedziby i specjalizacji.</div>' + rows;
  }
  function bindTenders() { document.querySelectorAll('[data-tender]').forEach(b => { b.onclick = () => askTender(b.dataset.tender); }); }
  // ---------- kontrakty ----------
  function contractsHTML() {
    let extra = ''; const a = KT().active, h = '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Kontrakty</h3>';
    if (a) {
      const c = Kontrakty.CONTRACTS[a.id], cl = CLIENTS[c.client], pro = c.stages.map((st, i) => '<div class="stage ' + (i < a.stage ? 'done' : i === a.stage ? 'cur' : '') + '"><span class="num">' + (i < a.stage ? '✓' : i + 1) + '</span><span class="stn">' + JOBS[st.job].title + '<small>' + (i < a.stage ? stars(a.results[i].stars) + ' · ' + zl(a.results[i].payout) : 'dzień ' + (st.day + 1) + ', ' + st.time) + '</small></span></div>').join('');
      const left = Math.ceil((a.deadlineAt - ST.clock) / 1440), lv = a.stage < c.stages.length ? Kontrakty.stageLevel(KT(), ST.clock) : null;
      const activeHtml = h + '<div class="card"><div class="bubble"><span class="av">' + cl.em + '</span><div><b>' + c.title + '</b> · ' + cl.name + '<br><small style="color:var(--muted)">Termin: ' + Czas.dayLabel(a.deadlineAt) + ' (' + (left >= 0 ? 'zostało ' + left + ' dni' : 'SPÓŹNIONY o ' + (-left) + ' dni') + ')</small></div></div><div class="stages">' + pro + '</div>' +
        (lv ? '<button class="primary" id="cstage">Etap ' + (a.stage + 1) + '/' + c.stages.length + ': ' + JOBS[lv.job].title + ' (' + Czas.label(lv.startAt) + ')</button>' : '<div class="hint">Wszystkie etapy zrobione, czas na odbiór.</div>') +
        '<button id="ccancel" style="background:transparent;min-height:40px;color:var(--muted)">Zrezygnuj (zwrot zaliczki + kara)</button></div>' + othersHTML();
      if (!Kontrakty.canAccept(KT(), cLimit())) return activeHtml;
      extra = activeHtml;
    }
    const av = Kontrakty.available(ST.done).filter(c => !(KT().active && KT().active.id === c.id) && !KT().others.some(o => o.id === c.id));
    if (!av.length) return extra;
    return extra + (extra ? '<div class="hint">Masz wolne miejsce na kolejny kontrakt (limit ' + cLimit() + ', rośnie z siedzibą).</div>' : h) + '<div class="hint">Kilka robót u jednego klienta w kolejnych dniach: zaliczka z góry, jeden dojazd, premia za czysty odbiór, ale kara za spóźnienie i ukryte wady wychodzą przy odbiorze. Liczba kontraktów naraz zależy od siedziby (1, od poziomu 2 dwa, od 4 trzy).</div>' + av.map(c => {
      const q = Kontrakty.quote(c, JOBS), cl = CLIENTS[c.client], d = KT().done[c.id];
      return '<button class="lvl" data-cacc="' + c.id + '"><span class="av">' + cl.em + '</span><span><b>' + c.title + '</b><small>' + c.stages.length + ' etapów · ' + c.deadline + ' dni · zaliczka ' + zl(q.deposit) + ' · razem ok. ' + zl(q.expected) + '</small><small>' + c.desc + '</small></span><span class="res">' + (d ? '<span class="stars">' + stars(d.best) + '</span><br>×' + d.count : 'nowy') + '</span></button>';
    }).join('');
  }
  function othersHTML() {
    return KT().others.map(o => { const c = Kontrakty.CONTRACTS[o.id], cl = CLIENTS[c.client], lv = o.stage < c.stages.length ? Kontrakty.stageLevel({ active: o }, ST.clock) : null;
      return '<button class="lvl" data-cswitch="' + o.id + '"><span class="av">' + cl.em + '</span><span><b>' + c.title + ' (w kolejce)</b><small>etap ' + Math.min(o.stage + 1, c.stages.length) + '/' + c.stages.length + ' · termin ' + Czas.dayLabel(o.deadlineAt) + '</small><small>' + (lv ? 'następny: ' + JOBS[lv.job].title + ', ' + Czas.label(lv.startAt) : 'czas na odbiór') + '</small></span><span class="res">przełącz</span></button>'; }).join('');
  }
  function bindContracts() {
    document.querySelectorAll('[data-cswitch]').forEach(b => { b.onclick = () => switchContract(b.dataset.cswitch); });
    document.querySelectorAll('[data-cacc]').forEach(b => { b.onclick = () => askContract(b.dataset.cacc); });
    const st = $('cstage'); if (st) st.onclick = () => startJob(-1, Kontrakty.stageLevel(KT(), ST.clock));
    const ca = $('ccancel'); if (ca) ca.onclick = askCancel;
  }
  /* Odbiór końcowy po ostatnim etapie: wyłapywanie ukrytych wad, kara za opóźnienie albo premia. */
  const allDone = () => LEVELS.every((_, i) => ST.best[i]);
  const waitHTML = () => '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Czekanie na telefon</h3>' +
    '<div class="hint">' + (allDone() ? 'Zrobiłeś wszystkie zlecenia z listy. Teraz zostaje czekać, aż ktoś zadzwoni.' : 'Nie chcesz brać żadnego z listy? Możesz poczekać, może ktoś zadzwoni.') + ' Szansa na telefon w tej godzinie (' + Czas.hm(ST.clock) + '→' + Czas.hm(ST.clock + 60) + '): ' +
    Math.round(callP(Czas.isNight(ST.clock + 60)) * 100) + '%. Lepsza ocena firmy i kolejne godziny bez telefonu zwiększają szansę.</div>' +
    '<div class="row2"><button id="wait" class="primary">⏳ Poczekaj godzinę</button><button id="sleep" style="min-height:56px">😴 Prześpij się (8 h)</button></div><div class="row2"><button id="dayoff" style="min-height:48px">🛋️ Dzień wolny (24 h)</button><button id="vac" style="min-height:48px" ' + (ST.money >= Wypalenie.VACATION.cost ? '' : 'disabled') + '>🏖️ Urlop (' + Wypalenie.VACATION.days + ' dni, ' + zl(Wypalenie.VACATION.cost) + ')</button></div><div class="hint">Wypalenie narasta z pracy, nie znika we śnie. Dzień wolny: −' + Wypalenie.DAY_OFF.relief + ' pkt. Urlop zeruje wypalenie i podnosi nastrój ekipy, ale klienci cię zapominają, a ' + (ST.os.rival.name) + ' zyskuje przewagę.</div><div class="hint">Czekanie odpoczywa tylko trochę. Sen: ' + (Czas.isNight(ST.clock + 240) ? 'w nocy regeneruje dużo' : 'w dzień regeneruje mało') + '. Telefony od stałych klientów zwiększają szansę (+' + Math.round(refBonus() * 100) + ' pkt).</div>';
  $('menu').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b && !b.disabled && b.dataset.i !== undefined) startJob(+b.dataset.i); });

  // ---------- zlecenie ----------
  const signed = n => (n >= 0 ? '+' : '−') + zl(Math.abs(n));
  /* Szacunek stawki godzinowej po kosztach dla poziomu: opts { terms, helper, states }. */
  /* Mnożnik z uprawnień, zaufania klienta i obniżki dla rywala (poza ocenami, umową, sezonem i nocą). */
  function startJob(i, call) {
    Dzwieki.play(call ? 'call' : 'start');
    cur = newJob(i, call); const l = cur.level;
    ALL.forEach(x => $(x).hidden = true); $('job').hidden = false;
    if (l.contract && l.contract.stage > 0 && KT().active.terms) { cur.terms = Object.assign({}, KT().active.terms); cur.umowa = Umowa.evaluate(cur.terms, cur.client, rnd); cur.notes.push(...cur.umowa.notes); cur.deadline = Math.round(cur.job.deadline * cur.umowa.deadlineFactor); afterUmowa(); return; }
    umowa();
  }
  function afterUmowa() { if (ST.crew.length) pickHelper(); else transport(); }
  const dueNote = () => { const d = cur.dueSpec; if (!d) return ''; const T = Terminy; return '<div class="banner">⏰ Zlecenie terminowe: ' + d.name + '. Skończ do <b>' + Czas.hm(d.dueAt) + '</b> (masz ' + Czas.fmtMin(d.allowed) + ' od startu). Spóźnienie: kara ' + Math.round(d.pct * 100) + '% wypłaty za każde zaczęte ' + T.BLOCK + ' min (max ' + Math.round(T.CAP * 100) + '%). Szybciej niż w 80% czasu: premia ' + Math.round(T.BONUS * 100) + '%. Wypłata ×' + String(d.pay).replace('.', ',') + '.' + (d.kind === 'ostry' ? ' Solidna robota się nie zmieści. Ktoś będzie musiał iść na skróty.' : '') + '</div>'; };
  const outfitFx = () => E.outfitFx(cur);
  const outfitNote = () => { const it = Ubrania.current(ST.wardrobe), o = Ubrania.OUTFITS[it.id], e = cur.outfit; return '<div class="hint">' + Pix.icon(o.icon, 'inline') + ' Ubiór: <b>' + o.name + '</b> (stan ' + Math.round(it.cond) + '%' + (it.dirty ? ', brudny' : '') + '). Wrażenie u klienta: ' + (e.imp > 0.3 ? 'świetne' : e.imp > 0.05 ? 'dobre' : e.imp > -0.1 ? 'obojętne' : 'złe') + ' (' + (e.satBonus >= 0 ? '+' : '') + e.satBonus + ' pkt zadowolenia, wypłata ×' + String(e.pay).replace('.', ',') + '). <button id="chgOutfit" style="min-height:32px;padding:0 8px">Przebierz się</button></div>'; };
  function changeOutfit() {
    E.ui.modalOpen = true; $('mtitle').textContent = '👔 W co się ubierasz?'; $('mtext').textContent = cur.client.name + (formalCtx(cur.level) ? ' (oficjalnie, przetarg)' : '') + ', ' + cur.job.title + (Ubrania.messy(cur.job.id) >= 0.5 ? ' (brudna robota)' : '') + '.';
    $('mchoices').innerHTML = ST.wardrobe.owned.map(it => { const o = Ubrania.OUTFITS[it.id], e = Ubrania.effect(it, cur.client.id, { formal: formalCtx(cur.level), job: cur.job.id }); return '<button data-u="' + it.uid + '">' + Pix.icon(o.icon, 'inline') + ' ' + o.name + (it.uid === ST.wardrobe.worn ? ' (masz na sobie)' : '') + '<small>stan ' + Math.round(it.cond) + '%' + (it.dirty ? ' · brudny' : '') + ' · wrażenie ' + (e.imp >= 0 ? '+' : '') + e.imp.toFixed(1).replace('.', ',') + ' · wypłata ×' + String(e.pay).replace('.', ',') + '</small></button>'; }).join('') + '<button data-u="">Zostaw jak jest<small>bez zmiany</small></button>'; $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('modal').hidden = true; E.ui.modalOpen = false; if (b.dataset.u) { ST.wardrobe = Ubrania.wear(ST.wardrobe, +b.dataset.u); const it = Ubrania.current(ST.wardrobe); if (it.smell) { ST.flash.push('👔 Ubranie z lumpeksu śmierdzi stęchlizną. Wiarygodność −0,15.'); } cur.outfit = outfitFx(); save(); } umowa(); };
  }
  const nightNote = () => cur.night ? '<div class="banner">🌙 Zlecenie nocne: dopłata ×' + String(Czas.NIGHT.payMult).replace('.', ',') + ', ale ciemno (celność −' + Math.round(Czas.NIGHT.accPenalty * 100) + ' pkt), robota trwa o 10% dłużej, więcej wypadków i kontroli policji, ekipa częściej nie przychodzi. Klient jest zaspany, więc mniej zauważa.</div>' : '';

  // ---------- umowa: faktura, kosztorys, termin ----------
  function umowa() {
    const t = cur.terms, c = cur.client, ni = Umowa.needsInvoice(c);
    const seg = (key, opts) => '<div class="seg" data-key="' + key + '">' + opts.map(o => '<button data-v="' + o[0] + '" class="' + (String(t[key]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div>';
    const sea = cur.season, dm = Kalendarz.demandMult(sea, cur.job.id), est = estimateFor(cur.level, { terms: t });
    const uPre = Umowa.evaluate(t, c, () => 1);
    $('job').innerHTML = '<div class="bubble"><span class="av">' + c.em + '</span><div><b>' + c.name + '</b>: „' + cur.intro + '”<br><small style="color:var(--muted)">' + c.note + '</small></div></div>' +
      sceneHTML(cur.job) +
      '<div class="hint">' + (cur.night ? '🌙' : '☀️') + ' Start: <b>' + Czas.label(cur.startClock) + '</b> (' + (cur.night ? 'noc' : 'dzień') + '). Sezon: ' + sea + (dm !== 1 ? ' (popyt na takie roboty ×' + String(dm).replace('.', ',') + ')' : '') + '.</div>' + nightNote() + dueNote() + outfitNote() +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Umowa</h2>' +
      '<div class="hint">' + (ni ? c.name + ' wymaga faktury.' : c.name + ' pyta, czy „może być bez papierów”.') + '</div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Faktura</h3>' + seg('invoice', [[true, 'Z fakturą (podatek 10%)'], [false, 'Bez faktury (−4% ceny)']]) + '</div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Kosztorys</h3>' + seg('quote', [['fair', 'Uczciwy'], ['inflated', 'Zawyżony (+20%)'], ['low', 'Zaniżony (−15%)']]) + '<div class="hint">Zawyżenie zauważy: ' + Math.round(Math.min(0.9, Umowa.detectChance(c) * cur.outfit.detect) * 100) + '% (uważny klient lub fachowiec zauważy częściej).</div></div>' +
      '<div class="step"><h3 style="color:var(--muted);text-transform:uppercase">Termin</h3>' + seg('rush', [[false, 'Realny (' + Czas.fmtUnits(cur.job.deadline, cur.night) + ')'], [true, 'Na wczoraj (' + Czas.fmtUnits(cur.job.deadline * 0.75, cur.night) + ', +10%)']]) + '</div>' +
      '<div class="econ"><div class="erow"><span>Szacowana wypłata</span><b>~' + zl(est.lines[0].value) + '</b></div><div class="erow"><span>Szacowany czas</span><b>~' + Czas.fmtMin(est.hours * 60) + '</b></div><div class="erow big"><span>Zostaje po kosztach (bez pomocnika)</span><b>' + perHourTxt(est) + '</b></div></div>' +
      '<button class="primary" id="umOk">Ustalone, jedziemy</button><button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy</button>';
    void uPre;
    $('back').onclick = renderMenu; if ($('chgOutfit')) $('chgOutfit').onclick = changeOutfit;
    $('job').onclick = e => { const b = e.target.closest('.seg button'); if (!b) return; const k = b.parentNode.dataset.key; t[k] = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; umowa(); };
    $('umOk').onclick = () => {
      cur.umowa = Umowa.evaluate(t, c, rnd, { detectMult: cur.outfit.detect }); cur.notes.push(...cur.umowa.notes);
      if (cur.level.contract && cur.level.contract.stage === 0) KT().active.terms = Object.assign({}, t);
      cur.deadline = Math.round(cur.job.deadline * cur.umowa.deadlineFactor);
      afterUmowa();
    };
  }
  function pickHelper() {
    const solo = estimateFor(cur.level, { terms: cur.terms });
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">' + cur.intro + '</small></div></div>' +
      '<div class="hint">' + (cur.night ? '🌙 Noc' : '☀️ Dzień') + ', start ' + Czas.hm(cur.startClock) + '. Pomocnik kosztuje udział w pensji za to zlecenie' + (cur.night ? ' (w nocy z dopłatą 50%)' : '') + '.</div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kogo bierzesz do pomocy?</h2><div class="hint">Dobry pomocnik poprawia celność i skraca robotę. Wkurzony może nie przyjść albo zostawić cię w połowie zlecenia.</div>' +
      '<div class="opts">' + ST.crew.map(w => { const r = Ekipa.risk(w, { night: cur.night }), stt = cur.states[w.id], busy = crewBusy(w), out = w.outJobs > 0 || !!busy, cost = Stawka.helperShare(w, cur.night), est = estimateFor(cur.level, { terms: cur.terms, helper: w, states: cur.states });
        return '<button class="opt" data-w="' + w.id + '" ' + (out ? 'disabled' : '') + '><b>' + w.em + ' ' + w.name + ' · ' + Ekipa.moodEmoji(w.mood) + ' ' + Ekipa.moodLabel(w.mood) + (busy ? ' · na zleceniu do ' + Czas.hm(busy.endAt) : w.outJobs > 0 ? ' · na zwolnieniu (' + w.outJobs + ' zlec.)' : '') + '</b><span>dziś: ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + ' · pracowitość ' + Math.round((w.diligence == null ? 0.5 : w.diligence) * 100) + '%</span><span>' + w.role + ' · umiejętności ' + Math.round(w.skill * 100) + '%</span><span class="chips"><span class="chip cost">💰 koszt wzięcia: ' + zl(cost) + '</span><span class="chip">stawka z nim ' + perHourTxt(est) + '</span></span><span class="chips"><span class="chip">nie przyjdzie: ' + Math.round(r.absent * 100) + '%</span><span class="chip">zostawi w połowie: ' + Math.round(r.walkout * 100) + '%</span></span></button>'; }).join('') +
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
    if (cur.level.contract && cur.level.contract.stage > 0) { cur.timeAdj += 1; cur.notes.push('🧱 Materiały i narzędzia już są na miejscu z pierwszego dnia kontraktu. Bez dojazdu.'); save(); renderJob(); return; }
    const drivers = cur.helper && cur.helperOn && !(cur.helper.outJobs > 0) ? [cur.helper] : [];
    const riskTxt = (w, mode) => { const stt = cur.states[w.id] || 'trzezwy', r = Swiat.driveRisk(w, stt, ST.world, mode); return '<span class="chip">wypadek: ' + Swiat.band(r.accident) + '</span><span class="chip">policja: ' + Swiat.band(r.police) + '</span>'; };
    const oR = Swiat.driveRisk(null, 'trzezwy', ST.world, 'owner'), lvl = ST.hq.assets.bus || 0, bus = ST.bus, bp = Math.round(Bus.chance(bus, lvl, cur.night, Sezon.bus(ST.clock)) * 100);
    const busChip = '<span class="chip ' + (bus.broken || bp >= 15 ? 'warn' : '') + '">🚐 bus: ' + Bus.label(bus) + ' (' + Math.round(bus.cond) + '%), awaria ' + bp + '%</span>', dis = bus.broken ? ' disabled' : '';
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">Materiały i narzędzia trzeba dowieźć na miejsce.</small></div></div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kto zawozi?</h2><div class="hint">Do wyboru są tylko ci, którzy jadą na zlecenie. ' + (cur.night ? '🌙 W nocy częstsze są wypadki i kontrole policji. ' : '') + 'Ryzyko jest przybliżone.</div>' +
      '<div class="opts">' +
      '<button class="opt" data-d="owner"' + dis + '><b>🚗 Ty, sam</b><span>Masz prawo jazdy i trzeźwą głowę. Tracisz trochę czasu.</span><span class="chips"><span class="chip">⏱ +' + Czas.fmtMin(3 * Czas.TIME_SCALE) + '</span><span class="chip cost">💰 0 zł</span><span class="chip">wypadek: ' + Swiat.band(oR.accident) + '</span>' + busChip + '</span></button>' +
      '<button class="opt" data-d="courier"><b>🚚 Kurier</b><span>Płacisz, nie myślisz.</span><span class="chips"><span class="chip cost">💰 70 zł</span><span class="chip">⏱ +' + Czas.fmtMin(2 * Czas.TIME_SCALE) + '</span><span class="chip">bez ryzyka</span></span></button>' +
      drivers.map(w => { const stt = cur.states[w.id] || 'trzezwy';
        return '<button class="opt" data-d="' + w.id + '"' + dis + '><b>' + w.em + ' ' + w.name + ' · ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + '</b><span>jedzie na zlecenie · prawo jazdy: ' + (w.license ? 'ma' : 'nie ma') + ' · jazda ' + Math.round((w.driving == null ? 0.5 : w.driving) * 100) + '%' + (ST.world.heat > 0.4 ? ' · uwaga: dużo patroli' : '') + '</span><span class="chips"><span class="chip cost">💰 0 zł</span>' + riskTxt(w, 'worker') + busChip + '</span></button>'; }).join('') + '</div>' + (bus.broken ? '<div class="banner">🚐 Bus jest zepsuty i stoi. Remont zrobisz w Siedzibie. Do tego czasu zostaje kurier.</div>' : '');
    $('job').querySelector('.opts').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; doDrive(b.dataset.d); };
  }
  /* Awaria busa w drodze: laweta, naprawa samemu albo kurier. */
  function breakdown(id) {
    Dzwieki.play('crash');
    const night = cur.night; E.ui.modalOpen = true;
    $('mtitle').textContent = '🚐 Bus stanął!'; $('mtext').textContent = 'Silnik zakaszlał i bus stanął na poboczu. Stan techniczny: ' + Math.round(ST.bus.cond) + '%. Co robisz?';
    $('mchoices').innerHTML = '<button data-k="laweta">Laweta i warsztat<small>' + zl(night ? 260 : 180) + ', ok. 50 min, bus naprawiony</small></button>' +
      '<button data-k="sam">Naprawiasz sam<small>55% szans: 40 zł i 40 min; inaczej i tak laweta, drożej i dłużej</small></button>' +
      '<button data-k="kurier">Kurier z materiałami, bus zostaje<small>70 zł, bus stoi zepsuty do remontu</small></button>';
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      const res = Bus.resolve(b.dataset.k, ST.bus, night, rnd);
      cash('serwis', -res.cost); cur.transportCost += res.cost; cur.timeAdj += res.timeAdj; cur.notes.push(...res.notes); ST.bus = res.bus; save(); renderTop();
      $('modal').hidden = true; E.ui.modalOpen = false;
      if (res.courier) { renderJob(); } else doDrive(id, true); };
  }
  function doDrive(id, skipRoll) {
    const mode = id === 'owner' || id === 'courier' ? id : 'worker', w = mode === 'worker' ? ST.crew.find(x => x.id === id) : null;
    if (mode !== 'courier' && !skipRoll && Bus.rollBreakdown(ST.bus, ST.hq.assets.bus || 0, cur.night, rnd, Sezon.bus(cur.startClock))) { breakdown(id); return; }
    if (mode !== 'courier') ST.bus = Bus.drive(ST.bus, ST.hq.assets.bus || 0, cur.night);
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
    E.ui.modalOpen = true;
    $('mtitle').textContent = 'Co z ' + w.name + '?'; $('mtext').textContent = res.notes[res.notes.length - 1] + ' Rachunek: ' + zl(res.cost) + '. Decyzja szefa kształtuje, jak ekipa cię traktuje.';
    $('mchoices').innerHTML = opts.map(o => '<button data-a="' + o.id + '">' + o.label + '<small>' + o.sub + '</small></button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      const out = Swiat.applyAftermath(ST.crew.find(x => x.id === w.id), b.dataset.a, res);
      cash('wypadki', out.money); cur.notes.push(out.note);
      if (out.fired) { ST.crew = ST.crew.filter(x => x.id !== w.id); if (out.rep) ST.ratings.push(out.rep); if (cur.helper && cur.helper.id === w.id) cur.helperOn = false; }
      else ST.crew = ST.crew.map(x => x.id === w.id ? out.worker : x);
      save(); renderTop(); $('modal').hidden = true; E.ui.modalOpen = false; renderJob(); };
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
      '<div class="tally"><span>🕒 ' + Czas.hm(viewClock()) + ' · praca: ' + Czas.fmtUnits(Math.max(0, cur.time + cur.timeAdj), night) + ' / ' + Czas.fmtUnits(cur.deadline, night) + '</span><span>Materiały: ' + zl(cur.cost) + '</span></div>' + dueLeft() +
      '<button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy (bez zapisu)</button>';
    applyScene($('job'), cur.tokens); renderTop();
    $('back').onclick = renderMenu;
    $('opts').onclick = e => { const b = e.target.closest('.opt'); if (b) choose(s.options.find(o => o.id === b.dataset.o)); };
  }
  function dueLeft() {
    const d = cur.dueSpec; if (!d) return '';
    const used = Czas.minutes(Math.max(0, cur.time + cur.timeAdj), cur.night), left = d.allowed - used;
    return '<div class="tally"><span class="chip ' + (left < 0 ? 'warn' : 'due') + '">⏰ do ' + Czas.hm(d.dueAt) + '</span><span class="' + (left < 0 ? 'neg' : '') + '">' + (left >= 0 ? 'zapas ' + Czas.fmtMin(left) : 'spóźnienie ' + Czas.fmtMin(-left)) + '</span></div>';
  }
  function choose(opt) { if (opt.skill) timing(opt); else perform(opt, 0.6); }
  /* Animacja czynności na scenie (narzędzie w akcji), potem zmiana stanu naprawy. Fuszerka jest szybka, solidna robota trwa dłużej. */
  const ACTION_TXT = { wrench: 'Kręcisz kluczem…', hammer: 'Młotek w ruch…', drill: 'Wiercisz…', roller: 'Malujesz wałkiem…', trowel: 'Szpachlujesz…', sander: 'Szlifujesz…', tester: 'Mierzysz i sprawdzasz…', pliers: 'Pracujesz cęgami…', screwdriver: 'Wkręcasz…', pencil: 'Zaznaczasz…' };
  function perform(opt, accuracy) {
    const a = Scenes.actionFor(cur.job.id, cur.step), dur = opt.id === 'dobrze' ? 1500 : opt.id === 'skrot' ? 950 : 520;
    anim = { kind: a.kind, at: a.at, t0: performance.now(), dur };
    Dzwieki.tool(a.kind, dur);
    const box = $('opts'); if (box) box.innerHTML = '<div class="hint" style="text-align:center">' + (ACTION_TXT[a.kind] || 'Pracujesz…') + ' <b>' + opt.label + '</b></div><div class="actbar"><i id="actbar" style="width:0"></i></div>';
    const tick = () => { if (!anim) return; const t = Math.min(1, (performance.now() - anim.t0) / anim.dur), bar = $('actbar'); if (bar) bar.style.width = t * 100 + '%'; document.querySelectorAll('canvas.pxscene[data-job]').forEach(paintScene); if (t < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => { anim = null; apply(opt, accuracy); }, dur);
  }
  function apply(opt, accuracy) {
    const st = E.applyOption(cur, opt, accuracy);
    if (st.done) finish(); else if (st.surprise) surprise(st.surprise); else renderJob();
  }
  /* Niespodzianka w trakcie roboty: problem wychodzi dopiero po otwarciu, trzeba wybrać rozwiązanie. */
  function surprise(sp) {
    E.ui.modalOpen = true; $('mtitle').textContent = '⚠️ ' + sp.title; $('mtext').textContent = sp.text;
    $('mchoices').innerHTML = sp.options.map(o => '<button data-a="' + o.id + '">' + o.label + '<small>' + o.desc + ' · ⏱ ' + Czas.fmtUnits(o.time, cur.night) + (o.cost ? ' · 💰 ' + zl(o.cost) : '') + '</small></button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      const o = sp.options.find(x => x.id === b.dataset.a);
      cur.time += o.time; cur.cost += o.cost; o.defects.forEach(d => cur.extraDefects.push({ label: d.label, sev: d.sev, vis: d.vis, hazard: d.hazard || 0 }));
      cur.notes.push('⚠️ ' + sp.title + ': ' + o.label + '.');
      if (o.then) cur.chain = { id: o.then, at: cur.step }; // skutek wyjdzie po następnym kroku
      $('modal').hidden = true; E.ui.modalOpen = false; renderJob(); };
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
    const { night, mods, minutes, endClock, rt, um, sea, gos, cut, payMult, r, te, comment, eco } = E.settleJob(cur);
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
    Dzwieki.result(r.stars); if (r.payout > 0) setTimeout(() => Dzwieki.play('coin'), 700);
    $('next').onclick = () => renderMenu(); if ($('again')) $('again').onclick = () => startJob(cur.i);
    window.__z.last = r; window.__z.eco = eco;
  }

  // ---------- Alledrogo ----------
  let alleTab = 'oferty', alleMsg = '', alleAsk = {};
  function itemName(it) { return Alledrogo.TYPES[it.type].name + ' „' + it.brand + '”'; }
  function renderAlle() {
    ALL.forEach(x => $(x).hidden = true); $('alle').hidden = false;
    ST.market = Alledrogo.refresh(ST.market, ST.day); applyToolSale();
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
    if (E.ui.modalOpen) return false;
    const ctx = storyCtx(), b = Fabula.due(ST.story, ctx); if (!b) return false;
    E.ui.modalOpen = true; $('mtitle').textContent = b.title; $('mtext').textContent = b.text;
    $('mchoices').innerHTML = b.choices.map((c, i) => '<button data-i="' + i + '" ' + (Fabula.choiceAvailable(c, ctx) ? '' : 'disabled') + '>' + c.label + '<small>' + c.sub + '</small></button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const bt = e.target.closest('button'); if (!bt || bt.disabled) return;
      const r = Fabula.resolve(ST.story, b.id, +bt.dataset.i); ST.story = r.story; applyEffects(r.effects, ctx);
      $('modal').hidden = true; E.ui.modalOpen = false; save(); renderTop();
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
    E.ui.modalOpen = true; $('mtitle').textContent = 'Zakończenie: ' + en.title; $('mtext').textContent = en.text + ' (Możesz grać dalej, historia się nie kończy.)';
    $('mchoices').innerHTML = '<button data-a="ok">Graj dalej</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; E.ui.modalOpen = false; renderMenu(); };
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
  function ocPanel() {
    const oc = ST.oc, pr = Ubezp.premium(oc);
    return '<h3 style="color:var(--muted);text-transform:uppercase">Ubezpieczenie OC</h3><div class="prow"><div class="hd"><span class="nm">🛡️ OC firmy</span><span>' + (oc.active ? 'aktywne' : 'brak polisy') + '</span></div>' +
      '<div class="hint">Składka ' + zl(pr) + ' co rozliczenie tygodnia (rośnie z historią szkód). Pokrywa ' + Math.round(Ubezp.COVER.reklamacja * 100) + '% reklamacji i ' + Math.round(Ubezp.COVER.wypadek * 100) + '% odszkodowań za wypadek powyżej udziału własnego ' + zl(Ubezp.DEDUCT) + '. Szkody: ' + oc.history.toFixed(1).replace('.', ',') + '.</div>' +
      '<button data-oc="' + (oc.active ? 'off' : 'on') + '" style="min-height:44px">' + (oc.active ? 'Wypowiedz polisę' : 'Wykup polisę') + '</button></div>';
  }
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
      ocPanel() +
      '<h3 style="color:var(--muted);text-transform:uppercase">Twoje długi</h3>' + loans + '<h3 style="color:var(--muted);text-transform:uppercase">Pożyczki</h3>' + lenders +
      '<h3 style="color:var(--muted);text-transform:uppercase">Skarbówka</h3><div class="prow"><div class="hd"><span class="nm">Ryzyko kontroli</span><span>' + Math.round(tax.risk) + '%</span></div><div class="mbar ' + moodCls(100 - tax.risk) + '"><i style="width:' + Math.min(100, tax.risk) + '%"></i></div>' +
      '<div class="hint">Ukryte przychody (bez faktur): ' + zl(tax.unreported) + ' · podatek do zapłaty: ' + zl(tax.due) + (tax.accountant ? ' · księgowa pracuje' : '') + (ST.fav.audit ? ' · szwagier trzyma rękę na pulsie' : '') + '</div>' +
      '<button data-acc="1" ' + (tax.accountant || ST.money < Finanse.ACCOUNTANT_COST ? 'disabled' : '') + ' style="min-height:44px">' + (tax.accountant ? 'Księgowa zatrudniona' : 'Zatrudnij księgową · ' + zl(Finanse.ACCOUNTANT_COST)) + '</button></div>' +
      '<button class="primary" id="finBack">Wróć</button>';
    $('finBack').onclick = renderMenu;
    $('fin').onclick = e => {
      const oc = e.target.closest('[data-oc]'); if (oc) { ST.oc = Ubezp.toggle(ST.oc, oc.dataset.oc === 'on'); save(); renderFin(); return; }
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
  const ASSET_NAMES = ['Stary kombi'].concat(Siedziba.ASSETS.bus.levels.map(l => l.name));
  function specPanel() {
    return '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Specjalizacje</h3><div class="hint">Doświadczenie rośnie z gwiazdek za zlecenia (kontrakty i przetargi +50%). Bez kursu z obszaru poziom kończy się na 1. Każdy poziom: +2 pkt celności, −1,5% czasu, −5% zagrożenia, +2% wypłaty.</div>' +
      Object.entries(Spec.AREAS).map(([k, a]) => { const nx = Spec.next(ST.xp, ST.certs, k), xp = ST.xp[k] || 0, cert = ST.certs[a.cert];
        return '<div class="prow"><div class="hd"><span class="nm">🎓 ' + a.name + '</span><span>poziom ' + nx.level + '/3</span></div><div class="mbar"><i style="width:' + Math.min(100, xp / Spec.XP[3] * 100) + '%"></i></div><div class="hint">Doświadczenie ' + Math.round(xp) + ' / ' + Spec.XP[3] + (nx.need === null ? ' · maksimum' : ' · do następnego poziomu ' + Math.round(nx.need)) + (cert ? '' : ' · brak kursu: ' + Szkolenia.CERTS[a.cert].name + ' (limit poziomu 1)') + '</div></div>'; }).join('');
  }
  function certPanel() {
    return '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Szkolenia i uprawnienia</h3><div class="hint">Szkolenie kosztuje i zabiera czas (męczy). W zamian roboty danego rodzaju są bezpieczniejsze, celniejsze i lepiej płatne.</div>' +
      Object.entries(Szkolenia.CERTS).map(([id, c]) => { const has = ST.certs[id], r = Szkolenia.buy(ST.certs, id, ST.money);
        return '<div class="prow"><div class="hd"><span class="nm">🎓 ' + c.name + '</span><span>' + (has ? '✓ masz' : zl(c.cost)) + '</span></div><div class="hint">' + c.desc + ' Zagrożenie ×' + String(c.hazard).replace('.', ',') + ', celność +' + Math.round(c.acc * 100) + ' pkt, wypłata ×' + String(c.pay).replace('.', ',') + '. Kurs trwa ' + c.hours + ' h.</div>' +
          (has ? '' : '<button data-cert="' + id + '" ' + (r.ok ? '' : 'disabled') + ' style="min-height:44px">Zapisz się · ' + zl(c.cost) + '</button>') + '</div>'; }).join('');
  }
  function busPanel() {
    const b = ST.bus, lvl = ST.hq.assets.bus || 0, p = Math.round(Bus.chance(b, lvl, false) * 100), cls = b.cond < 30 ? 'low' : b.cond < 60 ? 'mid' : '';
    const btn = (k, label) => { const c = Bus.serviceCost(b, k), r = Bus.service(b, k, ST.money); return '<button data-bus="' + k + '" ' + (r.ok ? '' : 'disabled') + ' style="min-height:44px">' + label + ' · ' + zl(c) + '</button>'; };
    return '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Bus: stan techniczny</h3><div class="prow"><div class="hd"><span class="nm">🚐 ' + (ASSET_NAMES[lvl] || 'Stary kombi') + '</span><span>' + Bus.label(b) + ' · ' + Math.round(b.cond) + '%</span></div>' +
      '<div class="busbar"><i class="' + cls + '" style="width:' + b.cond + '%"></i></div><div class="hint">Szansa awarii na przejeździe: ' + p + '% (w nocy więcej). Każdy dojazd zużywa bus, lepszy bus wolniej. Awarii było: ' + b.breakdowns + '.' + (b.broken ? ' <b>Bus stoi zepsuty.</b>' : '') + '</div>' +
      '<div class="row2">' + btn('przeglad', 'Przegląd +30%') + btn('remont', b.broken ? 'Remont (naprawa)' : 'Remont do 100%') + '</div></div>';
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
      specPanel() + busPanel() + certPanel() +
      '<div class="hint">Narzędzia (kupno, serwis, stan) są w aplikacji Alledrogo. Ocena firmy uwzględnia ich jakość i pokrycie zleceń.</div>' +
      '<div class="hint">Ocena firmy zależy od siedziby, sprzętu, opinii klientów i rzetelności (średnia fuszerka z ostatnich zleceń, minus otwarte reklamacje).</div>' +
      '<button class="primary" id="hqBack">Wróć</button>';
    $('hqBack').onclick = renderMenu;
    $('hq').onclick = ev => {
      const ce = ev.target.closest('[data-cert]');
      if (ce) { const r = Szkolenia.buy(ST.certs, ce.dataset.cert, ST.money); if (r.ok) { ST.certs = r.certs; cash('zakupy', -r.cost); advanceClock(ST.clock + r.hours * 60); ST.fatigue = Zmeczenie.gain(ST.fatigue, r.hours * 30, false); ST.flash.push('🎓 Zdobyłeś: ' + Szkolenia.CERTS[ce.dataset.cert].name + '. Kurs zajął ' + r.hours + ' h.'); save(); renderTop(); renderHq(); } return; }
      const sv = ev.target.closest('[data-bus]');
      if (sv) { const r = Bus.service(ST.bus, sv.dataset.bus, ST.money); if (r.ok) { ST.bus = r.bus; cash('serwis', -r.cost); save(); renderTop(); renderHq(); } return; }
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
    E.ui.modalOpen = true; $('mtitle').textContent = title; $('mtext').textContent = text; $('mchoices').innerHTML = '<button data-a="ok">OK</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; E.ui.modalOpen = false; if (after) after(); };
  }
  function startPayday(forced) {
    Dzwieki.play('cash');
    const p = E.startPayday();
    if (p.kind === 'simple') { notice(p.title, p.text, renderMenu); return; }
    if (p.kind === 'none') { renderMenu(); return; }
    billText = p.billText; sidePay = p.sidePay; PAY = p.pay;
    ALL.forEach(x => $(x).hidden = true); $('payday').hidden = false; renderPayday();
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
  function confirmPay() {
    const res = E.confirmPay(PAY);
    const lines = res.lines.map(d => '<div class="def"><span><b>' + d.em + ' ' + d.name + '</b> ' + Ekipa.moodEmoji(d.mood) + ' ' + (d.delta >= 0 ? '+' : '') + d.delta + '<br><span style="color:var(--muted)">' + d.say + '</span></span><span class="tag ' + (d.delta >= 0 ? 'hid' : 'vis') + '">' + zl(d.paid) + '</span></div>')
      .concat(res.quits.map(nm => '<div class="banner">🚪 ' + nm + ' odchodzi i opowiada po osiedlu, że jesteś kombinatorem. Reputacja spada.</div>'));
    $('payday').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Po wypłacie</h2><div class="defs">' + lines.join('') + '</div><button class="primary" id="payOk">Dalej</button>';
    $('payOk').onclick = renderMenu;
  }

  // ---------- upominanie się ----------
  /* Raport za zakończony miesiąc: plus, koszty po kategoriach, stawka godzinowa. */
  function monthReportHTML(key) {
    const m = monthSummary(key), rows = Object.entries(m.cats).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([c, v]) => '<div class="erow"><span>' + Ksiega.CATS[c].label + '</span><b class="' + (v >= 0 ? 'pos' : 'neg') + '">' + signed(v) + '</b></div>').join('');
    return '<div class="econ"><div class="erow big"><span>Plus w miesiącu</span><b class="' + (m.plus >= 0 ? 'pos' : 'neg') + '">' + signed(m.plus) + '</b></div>' +
      '<div class="erow"><span>Przychody</span><b class="pos">' + signed(m.income) + '</b></div><div class="erow"><span>Koszty</span><b class="neg">' + signed(m.costs) + '</b></div>' + rows +
      '<div class="erow"><span>Zlecenia: ' + m.jobs + ' · przepracowane ' + Czas.fmtMin(m.hours * 60) + '</span><b class="' + (m.perHour >= 0 ? 'pos' : 'neg') + '">' + signed(m.perHour) + '/h</b></div>' +
      (m.invest || m.debt ? '<div class="hint">Poza plusem: inwestycje ' + signed(m.invest) + ', dług ' + signed(m.debt) + '.</div>' : '') + '</div>';
  }
  function nextEvent() {
    if (E.ui.modalOpen) return;
    if (collectCrew()) return;
    if (!ST.pendingMonths.length && checkYear()) return;
    if (checkContractFinal()) return;
    if (checkMonthReport()) return;
    if (ST.done >= ST.nextPay) { startPayday(true); return; }
    if (checkClaims()) return;
    if (checkDemands()) return;
    checkStory();
  }

  // ---------- reklamacje po tygodniu ----------

  $('reset').onclick = () => { if ($('reset').dataset.s) { E.replace(withMeta(fresh())); save(); delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; renderMenu(); } else { $('reset').dataset.s = 1; $('reset').textContent = 'Na pewno? Kliknij jeszcze raz'; setTimeout(() => { delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; }, 3000); } };

  // pikselizacja: emoji i znaczniki @postać zamieniane na sprite'y, sceny SVG na obrazy w małej rozdzielczości
  (function () {
    let busy = false;
    const run = () => { if (busy) return; busy = true; try { Pix.pixelize(document.body); document.querySelectorAll('canvas.pxscene:not([data-drawn])').forEach(cv => { cv.dataset.drawn = '1'; paintScene(cv); }); } finally { busy = false; } };
    new MutationObserver(() => requestAnimationFrame(run)).observe(document.body, { childList: true, subtree: true });
    run();
  })();
  window.__z = { E, renderPlan, Ubrania, renderWardrobe, get META() { return META; }, renderPrestige, checkYear, Spec, Przetargi, ZlecEkipy, dispatchCrew, collectCrew, ensureBoard, Kontrakty, get ST() { return ST; }, get cur() { return cur; }, renderAlle, renderHq, renderFin, renderOs, renderStory, checkStory, weekly, co, startJob, renderMenu, renderCrew, startPayday };
  // dźwięki: dotyk przycisków, otwarcie okna, przełącznik w pasku zegara
  Dzwieki.bind(document);
  new MutationObserver(() => { if (!$('modal').hidden) Dzwieki.play('modal'); }).observe($('modal'), { attributes: true, attributeFilter: ['hidden'] });
  const snd = $('snd'); const paintSnd = () => { snd.textContent = Dzwieki.muted() ? '🔇' : '🔊'; snd.setAttribute('aria-label', Dzwieki.muted() ? 'Włącz dźwięk' : 'Wyłącz dźwięk'); };
  snd.onclick = () => { Dzwieki.toggle(); paintSnd(); }; paintSnd();
  // okna wyboru z silnika jako dane: tytuł, tekst, wiersze, przyciski
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function showPrompt(p) {
    $('mtitle').textContent = p.title;
    $('mtext').innerHTML = esc(p.text) + (p.rows ? '<div class="econ">' + p.rows.map(r => '<div class="erow"><span>' + (r.you ? '<b>' + esc(r.label) + '</b>' : esc(r.label)) + '</span><b class="' + (r.pos ? 'pos' : 'neg') + '">' + esc(r.value) + '</b></div>').join('') + '</div>' : '') + (p.tail ? ' ' + esc(p.tail) : '') + (p.kind === 'miesiac' ? monthReportHTML(p.key) : '');
    $('mchoices').innerHTML = p.choices.map(c => '<button data-id="' + esc(c.id) + '" data-a="' + esc(c.id) + '">' + esc(c.label) + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</button>').join('');
    $('modal').hidden = false;
    $('mchoices').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('modal').hidden = true; E.answer(b.dataset.id); };
  }
  E.V = { menu: () => renderMenu(), top: () => renderTop(), prompt: showPrompt, screen: n => { if (n === 'prestige') renderPrestige(); } };
  renderMenu();
})();
