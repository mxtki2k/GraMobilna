/* Interfejs zleceń: lista poziomów, scenka naprawy krok po kroku, mini-gra na wyczucie, odbiór u klienta, reklamacje. */
(() => {
  const { JOBS, CLIENTS, LEVELS } = Jobs;
  const $ = id => document.getElementById(id);
  const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
  const rnd = Math.random;

  // ---------- stan ----------
  const fresh = () => ({ money: 0, ratings: [], best: {}, unlocked: 1, claims: [], done: 0, crew: [], nextPay: Ekipa.PAYDAY_EVERY, demandAt: {}, world: Swiat.newWorld(), lastPayDone: -1, hq: Siedziba.fresh(), hist: [] });
  let ST = fresh();
  try { const r = localStorage.getItem('zlecenia_v1'); if (r) ST = Object.assign(fresh(), JSON.parse(r)); } catch (e) {}
  (() => { const f = Siedziba.fresh(); ST.hq = Object.assign(f, ST.hq || {}, { up: Object.assign(f.up, (ST.hq || {}).up), assets: Object.assign(f.assets, (ST.hq || {}).assets) }); if (!ST.hist) ST.hist = []; })();
  const save = () => { try { localStorage.setItem('zlecenia_v1', JSON.stringify(ST)); } catch (e) {} };
  const reputation = () => { const r = ST.ratings.slice(-10); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };

  // ---------- scenka: tokeny stanu ----------
  function applyScene(root, tokens) {
    root.querySelectorAll('[data-show],[data-hide]').forEach(el => {
      const show = el.dataset.show ? el.dataset.show.split('|') : null;
      const hide = el.dataset.hide ? el.dataset.hide.split('|') : null;
      const vis = (!show || show.some(t => tokens.has(t))) && (!hide || !hide.some(t => tokens.has(t)));
      el.style.display = vis ? '' : 'none';
    });
  }
  const sceneHTML = job => '<div class="scene"><svg viewBox="0 0 320 200" role="img" aria-label="' + job.title + '">' + job.scene + '</svg></div>';

  // ---------- poziomy ----------
  let cur = null; // bieżące zlecenie
  const co = () => Siedziba.rating(ST.hq, ST.hist, ST.ratings, ST.claims.length);
  function renderTop() {
    $('money').textContent = zl(ST.money);
    $('rep').textContent = co().stars.toFixed(1).replace('.', ',') + ' ★';
    $('claims').textContent = ST.claims.length;
  }
  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
  function renderMenu() {
    renderTop(); ['job', 'result', 'crew', 'payday', 'hq'].forEach(x => $(x).hidden = true); $('menu').hidden = false;
    const toPay = Math.max(0, ST.nextPay - ST.done);
    $('menu').innerHTML = '<div class="row2"><button class="tabbtn' + (ST.crew.some(w => Ekipa.demand(w)) ? ' alert' : '') + '" id="goCrew">👷 Ekipa (' + ST.crew.length + ')</button><button class="tabbtn" id="goHq">🏢 Siedziba</button></div>' +
      '<div class="hint" style="text-align:center">Dzień wypłaty za ' + toPay + ' zlec. · utrzymanie: ' + zl(Siedziba.effects(ST.hq).upkeep) + ' · ' + Siedziba.TIERS[ST.hq.tier].name + '</div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Zlecenia</h3>' + LEVELS.map((l, i) => {
      const job = JOBS[l.job], cl = CLIENTS[l.client], locked = i + 1 > ST.unlocked, b = ST.best[i];
      return '<button class="lvl" data-i="' + i + '" ' + (locked ? 'disabled' : '') + '><span class="av">' + (locked ? '🔒' : cl.em) + '</span><span><b>' + (i + 1) + '. ' + job.title + '</b><small>' + job.place + ' · ' + cl.name + ' · ok. ' + zl(job.base * l.mult) + '</small></span><span class="res">' +
        (b ? '<span class="stars">' + stars(b.stars) + '</span><br>fuszerka ' + b.index + '%' : (locked ? '' : 'nowe')) + '</span></button>';
    }).join('');
    $('goCrew').onclick = renderCrew; $('goHq').onclick = renderHq;
    nextEvent();
  }
  $('menu').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b && !b.disabled) startJob(+b.dataset.i); });

  // ---------- zlecenie ----------
  function startJob(i) {
    const l = LEVELS[i];
    cur = { i, job: JOBS[l.job], client: CLIENTS[l.client], mult: l.mult, step: 0, picks: [], tokens: new Set(['broken']), time: 0, cost: 0,
      helper: null, helperOn: false, timeAdj: 0, extraDefects: [], notes: [], states: {} };
    ST.crew.forEach(w => { cur.states[w.id] = Swiat.rollState(w, { paydayEve: ST.lastPayDone === ST.done }, rnd); });
    $('menu').hidden = true; $('result').hidden = true; $('job').hidden = false;
    if (ST.crew.length) pickHelper(); else renderJob();
  }
  function pickHelper() {
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">' + cur.job.intro + '</small></div></div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kogo bierzesz do pomocy?</h2><div class="hint">Dobry pomocnik poprawia celność i skraca robotę. Wkurzony może nie przyjść albo zostawić cię w połowie zlecenia.</div>' +
      '<div class="opts">' + ST.crew.map(w => { const r = Ekipa.risk(w), stt = cur.states[w.id], out = w.outJobs > 0;
        return '<button class="opt" data-w="' + w.id + '" ' + (out ? 'disabled' : '') + '><b>' + w.em + ' ' + w.name + ' · ' + Ekipa.moodEmoji(w.mood) + ' ' + Ekipa.moodLabel(w.mood) + (out ? ' · na zwolnieniu (' + w.outJobs + ' zlec.)' : '') + '</b><span>dziś: ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + ' · pracowitość ' + Math.round((w.diligence == null ? 0.5 : w.diligence) * 100) + '%</span><span>' + w.role + ' · umiejętności ' + Math.round(w.skill * 100) + '%</span><span class="chips"><span class="chip">nie przyjdzie: ' + Math.round(r.absent * 100) + '%</span><span class="chip">zostawi w połowie: ' + Math.round(r.walkout * 100) + '%</span></span></button>'; }).join('') +
      '<button class="opt" data-w=""><b>Sam, bez pomocnika</b><span>Spokojniej. Wolniej.</span></button></div>' +
      '<button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy</button>';
    $('back').onclick = renderMenu;
    $('job').querySelector('.opts').onclick = e => { const b = e.target.closest('.opt'); if (!b) return;
      const w = ST.crew.find(x => x.id === b.dataset.w) || null; cur.helper = w;
      if (w) { if (Ekipa.attendance(w, rnd) === 'absent') { cur.helperOn = false; cur.timeAdj += 4; cur.notes.push(w.em + ' ' + w.name + ' nie przyszedł do roboty. Poczekałeś na niego 4 minuty i robisz sam.'); }
        else { cur.helperOn = true; const stt = cur.states[w.id]; cur.notes.push(w.em + ' ' + w.name + ' jest na miejscu' + (stt !== 'trzezwy' ? ', ale jest ' + Swiat.LABEL[stt] + '.' : '.')); } }
      transport(); };
  }

  // ---------- dylemat: kto zawozi materiały ----------
  function transport() {
    const drivers = ST.crew.filter(w => !(w.outJobs > 0) && !(cur.helper && w.id === cur.helper.id && !cur.helperOn));
    const riskTxt = (w, mode) => { const stt = cur.states[w.id] || 'trzezwy', r = Swiat.driveRisk(w, stt, ST.world, mode); return '<span class="chip">wypadek: ' + Swiat.band(r.accident) + '</span><span class="chip">policja: ' + Swiat.band(r.police) + '</span>'; };
    $('job').innerHTML = '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.job.title + '</b> · ' + cur.client.name + '<br><small style="color:var(--muted)">Materiały i narzędzia trzeba dowieźć na miejsce.</small></div></div>' +
      '<h2 style="font-size:1.4rem;text-transform:uppercase">Kto zawozi?</h2><div class="hint">Ryzyko jest przybliżone. Policja częściej zatrzymuje, kiedy w okolicy były już kontrole.</div>' +
      '<div class="opts">' +
      '<button class="opt" data-d="owner"><b>🚗 Ty, sam</b><span>Masz prawo jazdy i trzeźwą głowę. Tracisz trochę czasu.</span><span class="chips"><span class="chip">⏱ +3 min</span><span class="chip">wypadek: niskie</span></span></button>' +
      '<button class="opt" data-d="courier"><b>🚚 Kurier</b><span>Płacisz, nie myślisz.</span><span class="chips"><span class="chip">💰 70 zł</span><span class="chip">⏱ +2 min</span><span class="chip">bez ryzyka</span></span></button>' +
      drivers.map(w => { const stt = cur.states[w.id] || 'trzezwy';
        return '<button class="opt" data-d="' + w.id + '"><b>' + w.em + ' ' + w.name + ' · ' + Swiat.LABEL[stt] + (stt !== 'trzezwy' ? ' ⚠' : '') + '</b><span>prawo jazdy: ' + (w.license ? 'ma' : 'nie ma') + ' · jazda ' + Math.round((w.driving == null ? 0.5 : w.driving) * 100) + '%' + (ST.world.heat > 0.4 ? ' · uwaga: dużo patroli' : '') + '</span><span class="chips"><span class="chip">💰 za darmo</span>' + riskTxt(w, 'worker') + '</span></button>'; }).join('') + '</div>';
    $('job').querySelector('.opts').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; doDrive(b.dataset.d); };
  }
  function doDrive(id) {
    const mode = id === 'owner' || id === 'courier' ? id : 'worker', w = mode === 'worker' ? ST.crew.find(x => x.id === id) : null;
    ST.world.accMult = Siedziba.effects(ST.hq).accMult;
    const res = Swiat.resolveDrive(w, w ? (cur.states[w.id] || 'trzezwy') : 'trzezwy', ST.world, mode, rnd);
    ST.money = Math.max(0, ST.money - res.cost); cur.timeAdj += res.timeAdj; cur.notes.push(...res.notes);
    if (res.cost) cur.costExtra = (cur.costExtra || 0) + res.cost;
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
      ST.money += out.money; cur.notes.push(out.note);
      if (out.fired) { ST.crew = ST.crew.filter(x => x.id !== w.id); if (out.rep) ST.ratings.push(out.rep); if (cur.helper && cur.helper.id === w.id) cur.helperOn = false; }
      else ST.crew = ST.crew.map(x => x.id === w.id ? out.worker : x);
      save(); renderTop(); $('modal').hidden = true; modalOpen = false; renderJob(); };
  }
  function renderJob() {
    const { job, client, step } = cur, s = job.steps[step];
    $('job').innerHTML =
      '<div class="bubble"><span class="av">' + client.em + '</span><div><b>' + client.name + '</b>: „' + job.intro + '”<br><small style="color:var(--muted)">' + client.note + '</small></div></div>' +
      sceneHTML(job) +
      (cur.notes.length ? '<div class="banner">' + cur.notes.slice(-2).join('<br>') + '</div>' : '') +
      '<div class="steps">' + job.steps.map((_, k) => '<i class="' + (k < step ? 'done' : k === step ? 'cur' : '') + '"></i>').join('') + '</div>' +
      '<div class="step"><h2>' + (step + 1) + '/' + job.steps.length + ' · ' + s.name + '</h2><div class="hint">' + s.hint + '</div></div>' +
      '<div class="opts" id="opts">' + s.options.map(o =>
        '<button class="opt" data-o="' + o.id + '"><b>' + o.label + '</b><span>' + o.desc + '</span><span class="chips"><span class="chip">⏱ ' + o.time + ' min</span><span class="chip">💰 ' + zl(o.cost) + '</span>' + (o.skill ? '<span class="chip skill">🎯 na wyczucie</span>' : '') + '</span></button>').join('') + '</div>' +
      '<div class="tally"><span>Czas: ' + cur.time + ' / ' + job.deadline + ' min</span><span>Materiały: ' + zl(cur.cost) + '</span></div>' +
      '<button id="back" style="background:transparent;min-height:40px;color:var(--muted)">Wróć do listy (bez zapisu)</button>';
    applyScene($('job'), cur.tokens);
    $('back').onclick = renderMenu;
    $('opts').onclick = e => { const b = e.target.closest('.opt'); if (b) choose(s.options.find(o => o.id === b.dataset.o)); };
  }
  function choose(opt) { if (opt.skill) timing(opt); else apply(opt, 0.6); }
  function apply(opt, accuracy) {
    if (cur.helperOn && cur.helper) {
      const he = Ekipa.helperEffect(cur.helper, cur.states[cur.helper.id]);
      const sl = Ekipa.sloppy(cur.helper, cur.states[cur.helper.id], rnd);
      if (sl) { cur.extraDefects.push(sl); cur.notes.push('🙄 ' + sl.label + '.'); }
      const fr = Ekipa.moralFriction(cur.helper, opt.id);
      if (fr) { cur.helper = Object.assign({}, cur.helper, { mood: Math.max(0, cur.helper.mood - fr), grudge: Math.min(100, (cur.helper.grudge || 0) + 3) }); ST.crew = ST.crew.map(x => x.id === cur.helper.id ? cur.helper : x); cur.notes.push('😒 ' + cur.helper.name + ' krzywi się na fuszerkę: „Ja tak nie robię.”'); }
      if (opt.skill) accuracy = Math.max(0, Math.min(1, accuracy + he.accBonus));
      cur.timeAdj -= Math.round(opt.time * (1 - he.timeFactor) * 10) / 10;
    }
    const eff = Siedziba.effects(ST.hq);
    if (rnd() < Siedziba.breakChance(ST.hq)) { cur.extraDefects.push({ label: 'zużyte narzędzie złamało się w trakcie', sev: 2, vis: 0.5 }); cur.notes.push('🔧 Zużyte narzędzie złamało się w trakcie roboty. Czas na serwis.'); }
    if (opt.skill) accuracy = Math.max(0, Math.min(1, accuracy + eff.accBonus));
    cur.timeAdj -= Math.round(opt.time * eff.timeBonus * 10) / 10;
    cur.picks.push({ stepId: cur.job.steps[cur.step].id, optionId: opt.id, accuracy });
    cur.time += opt.time; cur.cost += opt.cost;
    // wystawienie na robotę: po połowie kroków wkurzony pomocnik znika
    if (cur.helperOn && cur.helper && cur.step + 1 === Math.floor(cur.job.steps.length / 2) && Ekipa.walksOut(cur.helper, rnd)) {
      cur.helperOn = false; cur.timeAdj += 6;
      cur.extraDefects.push({ label: 'bałagan po ekipie, która zniknęła w trakcie', sev: 1.5, vis: 0.6 });
      cur.notes.push('🚪 ' + cur.helper.name + ' rzucił robotę w połowie: „Za takie pieniądze to ja nie będę.” Kończysz sam i tracisz 6 minut.');
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
      setTimeout(() => apply(opt, a), 650);
    };
    $('stop').onclick = stop;
    window.__z.stopNow = stop;
  }

  // ---------- odbiór ----------
  function finish() {
    const job = Object.assign({}, cur.job, { base: Math.round(cur.job.base * cur.mult) });
    const rt = co();
    const r = Fuszerka.evaluate(job, cur.picks, cur.client, { time: Math.round(cur.timeAdj), defects: cur.extraDefects, satBonus: rt.satBonus, payMult: rt.payMult });
    const comment = Fuszerka.clientComment(cur.client, r, rnd);
    const claim = Fuszerka.rollClaim(r, rnd);
    ST.money += r.profit; ST.ratings.push(r.stars); ST.done++;
    ST.hist.push({ index: r.index }); ST.hist = ST.hist.slice(-12);
    const th = Siedziba.resolveTheft(ST.hq, rnd);
    if (th) {
      ST.hq = th.hq; ST.money = Math.max(0, ST.money - th.net);
      cur.notes.push('🕵️ W nocy ktoś włamał się do siedziby: strata ' + zl(th.loss) + (th.recovered ? ', ale kamery pomogły odzyskać ' + zl(th.recovered) : '') + (th.toolLost ? '. Zniknął też sprzęt (narzędzia −1 poziom).' : '.') + (th.cameras ? '' : ' Kamery i mocniejsze drzwi by pomogły.'));
    }
    ST.hq = Siedziba.wear(ST.hq, 5 + (r.index >= 40 ? 3 : 0));
    ST.crew = Swiat.tickWorkers(ST.crew); Swiat.tickWorld(ST.world, 0);
    const prev = ST.best[cur.i];
    if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.index < prev.index)) ST.best[cur.i] = { stars: r.stars, index: r.index };
    ST.unlocked = Math.max(ST.unlocked, cur.i + 2);
    if (claim) ST.claims.push(Object.assign({ client: cur.client.name, due: ST.done + 1 }, claim));
    save(); renderTop();
    const bar = (v, max) => '<span class="b"><i style="width:' + Math.min(100, v / max * 100) + '%"></i></span>';
    const defs = r.defects.length ? r.defects.slice().sort((a, b) => b.sev - a.sev).map(d => {
      const tags = (d.hazard > 0 ? '<span class="tag haz">zagrożenie</span> ' : '') + (d.vis >= 0.5 ? '<span class="tag vis">widoczna</span>' : '<span class="tag hid">ukryta</span>');
      return '<div class="def"><span>' + d.label + '</span><span>' + tags + '</span></div>'; }).join('') : '<div class="def"><span>Brak wad. Naprawdę dobra robota.</span></div>';
    $('job').hidden = true; $('result').hidden = false;
    $('result').innerHTML =
      '<div class="scene">' + '<svg viewBox="0 0 320 200">' + cur.job.scene + '</svg></div>' +
      '<div class="bubble"><span class="av">' + cur.client.em + '</span><div><b>' + cur.client.name + '</b> <span class="stars">' + stars(r.stars) + '</span><br>„' + comment + '”</div></div>' +
      '<div><div class="glabels"><span>Fuszerometr</span><span>' + r.index + ' / 100</span></div><div class="gauge" role="meter" aria-valuenow="' + r.index + '" aria-valuemin="0" aria-valuemax="100"><i style="left:' + r.index + '%"></i></div>' +
      '<div class="glabels" style="margin-top:6px"><span>solidnie</span><span>na oko</span><span>fuszerka</span><span>katastrofa</span></div></div>' +
      '<div><div class="lvname" style="color:' + ({ solid: 'var(--ok)', oko: '#c8d44a', fuszerka: 'var(--warn)', katastrofa: 'var(--bad)' })[r.level.key] + '">' + r.level.name + '</div></div>' +
      '<div class="break"><div class="brow"><span>Wady widoczne</span>' + bar(r.V, 12) + '<b>' + r.V.toFixed(1) + '</b></div><div class="brow"><span>Wady ukryte</span>' + bar(r.H, 12) + '<b>' + r.H.toFixed(1) + '</b></div><div class="brow"><span>Zagrożenie</span>' + bar(r.Z, 12) + '<b>' + r.Z.toFixed(1) + '</b></div></div>' +
      '<div class="defs">' + defs + '</div>' +
      (cur.notes.length ? '<div class="banner">' + cur.notes.join('<br>') + '</div>' : '') +
      '<div class="hint">Zadowolenie klienta: ' + r.satisfaction + '%' + (r.late ? ' (spóźnienie: ' + r.time + ' z ' + job.deadline + ' min)' : '') + '. Szansa reklamacji: ' + Math.round(r.claim.chance * 100) + '%. Ocena firmy ' + rt.stars.toFixed(1).replace('.', ',') + ' ★ (wypłata ×' + rt.payMult.toFixed(2).replace('.', ',') + ', +' + rt.satBonus + ' pkt zadowolenia).</div>' +
      '<div class="money"><span>Wypłata</span><span>' + zl(r.payout) + '</span><span>Materiały</span><span>−' + zl(r.cost) + '</span><span class="tot">Zysk</span><span class="tot">' + zl(r.profit) + '</span></div>' +
      '<button class="primary" id="next">Dalej</button><button id="again" style="background:transparent">Spróbuj to zlecenie jeszcze raz</button>';
    $('next').onclick = () => renderMenu(); $('again').onclick = () => startJob(cur.i);
    window.__z.last = r;
  }

  let modalOpen = false;
  // ---------- siedziba ----------
  function hqSVG(hq) {
    const t = hq.tier, u = hq.up, a = hq.assets;
    const wall = ['#8a8f94', '#a9b4bb', '#b9a98e', '#d3cbb9', '#b7c1c8', '#a7bfd1'][t];
    const roof = ['#7a3b24', '#2b2b2b', '#b5472f', '#34495e'][u.dach];
    const frame = ['#5b3a29', '#9c7a53', '#f4f4f4', '#f4f4f4'][u.okna], glass = u.okna >= 3 ? '#8ecae6' : '#cfd8dc';
    const doorC = ['#8a4b2a', '#7b5a3b', '#6b7a86', '#4a5a66'][u.drzwi];
    let b = '';
    const win = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + glass + '" stroke="' + frame + '" stroke-width="3"/>' + (u.okna === 0 ? '<path d="M' + x + ' ' + y + 'l' + w + ' ' + h + '" stroke="#555" stroke-width="1"/>' : '');
    let dx = 150, dy = 120, dw = 22, dh = 50, x0 = 90, x1 = 230, top = 100;
    if (t === 0) { x0 = 90; x1 = 230; top = 105; b += '<rect x="90" y="105" width="140" height="65" fill="' + wall + '"/><rect x="90" y="98" width="140" height="8" fill="' + roof + '"/>' + '<rect x="108" y="120" width="70" height="50" fill="#6f7479"/><path d="M108 132h70M108 144h70M108 156h70" stroke="#5a5f64"/>'; dx = 190; dy = 130; dw = 24; dh = 40; }
    else if (t === 1) { x0 = 55; x1 = 265; top = 95; b += '<rect x="55" y="95" width="210" height="75" fill="' + wall + '"/>' + Array.from({ length: 20 }, (_, i) => '<path d="M' + (60 + i * 10) + ' 95v75" stroke="#8b979f"/>').join('') + '<rect x="50" y="86" width="220" height="10" fill="' + roof + '"/>'; dx = 215; dy = 122; }
    else if (t === 2) { x0 = 85; x1 = 235; top = 95; b += '<g transform="rotate(-1 160 140)"><rect x="85" y="100" width="150" height="70" fill="' + wall + '"/><polygon points="75,102 160,48 245,102" fill="' + roof + '"/><rect x="205" y="52" width="14" height="30" fill="#8d5a46"/>' + (u.ogrz >= 1 ? '<circle cx="212" cy="44" r="6" fill="#cfcfcf" opacity=".8"/><circle cx="218" cy="34" r="8" fill="#cfcfcf" opacity=".6"/>' : '') + '</g>'; dx = 150; }
    else if (t === 3) { x0 = 80; x1 = 240; top = 62; b += '<rect x="80" y="62" width="160" height="108" fill="' + wall + '"/><rect x="76" y="54" width="168" height="10" fill="' + roof + '"/><path d="M20 170v-26h40v26M260 170v-26h40v26" stroke="#7a7a7a" stroke-width="3"/>'; dx = 150; }
    else if (t === 4) { x0 = 40; x1 = 280; top = 80; b += '<rect x="40" y="80" width="170" height="90" fill="' + wall + '"/><rect x="210" y="62" width="70" height="108" fill="#c9d3da"/><rect x="36" y="72" width="178" height="10" fill="' + roof + '"/><rect x="206" y="54" width="78" height="10" fill="' + roof + '"/>'; dx = 140; }
    else { x0 = 80; x1 = 240; top = 30; b += '<rect x="80" y="30" width="160" height="140" fill="' + wall + '"/>' + Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => '<rect x="' + (90 + c * 30) + '" y="' + (40 + r * 22) + '" width="24" height="16" fill="#8ecae6" opacity=".9"/>').join('')).join('') + '<rect x="76" y="24" width="168" height="8" fill="' + roof + '"/>'; dx = 150; dy = 126; dh = 44; }
    // okna (poza hurtem szklanych lokali)
    if (t <= 2) b += win(x0 + 14, top + 22, 30, 22) + (t === 1 ? win(x0 + 60, top + 22, 30, 22) : '') + (t === 2 ? win(x1 - 54, top + 22, 30, 22) : '');
    if (t === 3) b += win(95, 80, 30, 22) + win(195, 80, 30, 22) + win(95, 122, 30, 22) + win(195, 122, 30, 22);
    if (t === 4) b += win(60, 96, 30, 22) + win(110, 96, 30, 22) + win(228, 80, 34, 24) + win(228, 122, 34, 24);
    // drzwi
    b += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" fill="' + doorC + '" stroke="#222" stroke-width="2"/>' + (u.drzwi >= 3 ? '<circle cx="' + (dx + dw + 5) + '" cy="' + (dy + 20) + '" r="3" fill="#ffd54f"/>' : '') + (u.alarm >= 1 ? '<rect x="' + (dx + 3) + '" y="' + (dy + 24) + '" width="6" height="6" fill="#aaa" stroke="#444"/>' : '');
    // szyld
    if (u.szyld === 1) b += '<rect x="' + (dx - 36) + '" y="' + (top - 4) + '" width="76" height="16" fill="#f4f4f4" stroke="#999"/><path d="M' + (dx - 30) + ' ' + (top + 4) + 'h64" stroke="#c33" stroke-width="3"/>';
    if (u.szyld >= 2) b += '<rect x="' + (dx - 40) + '" y="' + (top - 8) + '" width="84" height="20" rx="4" fill="#ffc300" stroke="#8a6a00" stroke-width="2"/><path d="M' + (dx - 32) + ' ' + (top + 2) + 'h68" stroke="#1b1e22" stroke-width="4"/>' + (u.szyld === 3 ? '<circle cx="' + (dx + 54) + '" cy="' + (top + 2) + '" r="5" fill="#8ecae6"/>' : '');
    // alarm / kamera
    if (u.alarm >= 2) b += '<circle cx="' + (x1 - 6) + '" cy="' + (top + 8) + '" r="4" fill="#e53935"/>';
    // narzędzia
    if (a.narzedzia > 0) b += '<rect x="' + (dx - 30) + '" y="160" width="20" height="10" fill="#c62828" stroke="#6a1b1b"/>';
    // auto / bus
    const van = a.bus === 0 ? '<rect x="238" y="152" width="48" height="20" rx="6" fill="#8d99a3"/><circle cx="252" cy="173" r="5" fill="#222"/><circle cx="274" cy="173" r="5" fill="#222"/>'
      : '<rect x="228" y="140" width="68" height="32" rx="6" fill="' + (a.bus === 3 ? '#ffc300' : '#f4f4f4') + '" stroke="#555" stroke-width="2"/><rect x="274" y="146" width="18" height="12" fill="#8ecae6"/>' + (a.bus >= 2 ? '<path d="M232 164h40" stroke="#1565c0" stroke-width="4"/>' : '') + (a.bus === 3 ? '<circle cx="250" cy="154" r="6" fill="#1b1e22"/>' : '') + '<circle cx="244" cy="173" r="6" fill="#222"/><circle cx="282" cy="173" r="6" fill="#222"/>';
    return '<div class="scene" style="background:#9ec5e0"><svg viewBox="0 0 320 200" role="img" aria-label="Siedziba firmy"><rect width="320" height="200" fill="#9ec5e0"/><rect y="170" width="320" height="30" fill="#6b6f73"/><rect y="168" width="320" height="4" fill="#4d5156"/>' + b + van + '</svg></div>';
  }
  function chipsFor(l) {
    const c = [];
    if (l.trust) c.push('zaufanie +' + l.trust); if (l.comfort) c.push('komfort +' + l.comfort); if (l.sec) c.push('ochrona +' + l.sec);
    if (l.demand) c.push('popyt +' + l.demand + '%'); if (l.time) c.push('czas −' + Math.round(l.time * 100) + '%'); if (l.acc) c.push('celność +' + Math.round(l.acc * 100));
    if (l.accMult) c.push('wypadki ×' + String(l.accMult).replace('.', ',')); if (l.upkeep) c.push('utrzymanie +' + l.upkeep + ' zł');
    return c.map(x => '<span class="chip">' + x + '</span>').join('');
  }
  function renderHq() {
    ['menu', 'job', 'result', 'crew', 'payday'].forEach(x => $(x).hidden = true); $('hq').hidden = false;
    const rt = co(), e = rt.effects, hq = ST.hq, nt = Siedziba.nextTier(hq), t = e.tier, pct = x => Math.round(x * 100);
    const parts = [['Siedziba', rt.parts.siedziba], ['Sprzęt', rt.parts.sprzet], ['Opinie klientów', rt.parts.opinie], ['Rzetelność', rt.parts.rzetelnosc]];
    const card = (title, sub, chips, key, cost, label) => '<div class="prow"><div class="hd"><span class="nm">' + title + '</span><span>' + sub + '</span></div>' + (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (key ? '<button data-buy="' + key + '" class="' + (ST.money >= cost ? 'primary' : '') + '" style="min-height:46px;font-size:1rem" ' + (ST.money >= cost ? '' : 'disabled') + '>' + label + ' · ' + zl(cost) + '</button>' : '<div class="hint">Maksymalny poziom.</div>') + '</div>';
    const upCards = Object.keys(Siedziba.UPGRADES).map(k => { const def = Siedziba.UPGRADES[k], cur = hq.up[k], nl = Siedziba.nextLevel('up', k, hq);
      return card(def.name, cur ? 'obecnie: ' + def.levels[cur - 1].name : 'obecnie: stan zastany', nl ? chipsFor(nl) : '', nl ? 'up:' + k : '', nl ? nl.cost : 0, nl ? nl.name : ''); }).join('');
    const asCards = Object.keys(Siedziba.ASSETS).map(k => { const def = Siedziba.ASSETS[k], cur = hq.assets[k], nl = Siedziba.nextLevel('assets', k, hq);
      return card(def.name, cur ? 'obecnie: ' + def.levels[cur - 1].name : 'obecnie: ' + (def.base || 'brak'), nl ? chipsFor(nl) : '', nl ? 'assets:' + k : '', nl ? nl.cost : 0, nl ? nl.name : ''); }).join('');
    const eff = ['Klienci płacą ×' + rt.payMult.toFixed(2).replace('.', ','), '+' + rt.satBonus + ' pkt zadowolenia klientów', 'komfort ekipy: +' + Math.round(e.comfort * 0.5) + ' do bazowego nastroju',
      'ochrona ' + e.security + '%: mniej kradzieży', 'narzędzia: −' + pct(e.timeBonus) + '% czasu, +' + pct(e.accBonus) + ' pkt celności', 'flota: wypadki ×' + String(e.accMult).replace('.', ','), 'utrzymanie: ' + zl(e.upkeep) + ' co dzień wypłaty'];
    $('hq').innerHTML = '<h2 style="font-size:1.5rem;text-transform:uppercase">Siedziba firmy</h2>' + hqSVG(hq) +
      '<div class="hd" style="display:flex;justify-content:space-between;align-items:baseline"><span class="nm" style="font-family:var(--display);font-size:1.4rem">' + t.name + '</span><span class="bignum" style="font-size:2rem;color:var(--hi)">' + rt.stars.toFixed(1).replace('.', ',') + ' ★</span></div>' +
      '<div class="hint">' + t.desc + '</div>' +
      '<div class="break">' + parts.map(p => '<div class="brow"><span>' + p[0] + '</span><span class="b"><i style="width:' + pct(p[1]) + '%"></i></span><b>' + pct(p[1]) + '%</b></div>').join('') + '</div>' +
      '<div class="defs">' + eff.map(x => '<div class="def"><span>' + x + '</span></div>').join('') + '</div>' +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Lokal</h3>' +
      (nt ? card('Następny: ' + nt.name, '', '<span class="chip">' + nt.desc + '</span><span class="chip">utrzymanie ' + zl(nt.upkeep) + '</span><span class="chip">remonty budynku zaczynasz od zera</span>', 'tier', nt.cost, 'Kup i przeprowadź się') : '<div class="hint">Masz najlepszą siedzibę.</div>') +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Remont budynku</h3>' + upCards +
      '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Sprzęt i flota (zostaje po przeprowadzce)</h3>' + asCards +
      (hq.assets.narzedzia ? '<div class="prow"><div class="hd"><span class="nm">Stan narzędzi</span><span>' + Math.round(hq.cond) + '%</span></div><div class="mbar ' + moodCls(hq.cond) + '"><i style="width:' + hq.cond + '%"></i></div><div class="hint">Zużyte narzędzia tracą premię do szybkości i celności, a poniżej 30% potrafią się złamać w trakcie roboty. Im lepszy sprzęt, tym bardziej opłaca się go ukraść.</div><button data-buy="repair:x" style="min-height:44px" ' + (hq.cond < 100 && ST.money >= Siedziba.repairCost(hq) ? '' : 'disabled') + '>Serwis · ' + zl(Siedziba.repairCost(hq)) + '</button></div>' : '') +
      '<div class="hint">Ocena firmy zależy od siedziby, sprzętu, opinii klientów i rzetelności (średnia fuszerka z ostatnich zleceń, minus otwarte reklamacje).</div>' +
      '<button class="primary" id="hqBack">Wróć</button>';
    $('hqBack').onclick = renderMenu;
    $('hq').onclick = ev => {
      const bt = ev.target.closest('[data-buy]'); if (!bt) return;
      const [g, k] = bt.dataset.buy.split(':'); const r = g === 'tier' ? Siedziba.buyTier(ST.hq, ST.money) : g === 'repair' ? Siedziba.repair(ST.hq, ST.money) : Siedziba.buy(ST.hq, g, k, ST.money);
      if (r.ok) { ST.hq = r.hq; ST.money -= r.cost; save(); renderTop(); renderHq(); }
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
    ['menu', 'job', 'result', 'payday', 'hq'].forEach(x => $(x).hidden = true); $('crew').hidden = false;
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
      if (h) { const c = Ekipa.CANDIDATES.find(x => x.id === h.dataset.hire); if (ST.money >= c.wage) { ST.money -= c.wage; ST.crew.push(Ekipa.newWorker(c)); save(); renderTop(); renderCrew(); } }
    };
  }

  // ---------- dzień wypłaty ----------
  let PAY = {}, sidePay = null, billText = '';
  function notice(title, text, after) {
    modalOpen = true; $('mtitle').textContent = title; $('mtext').textContent = text; $('mchoices').innerHTML = '<button data-a="ok">OK</button>'; $('modal').hidden = false;
    $('mchoices').onclick = () => { $('modal').hidden = true; modalOpen = false; if (after) after(); };
  }
  function startPayday(forced) {
    const up = Siedziba.effects(ST.hq).upkeep, tn = Siedziba.TIERS[ST.hq.tier].name;
    if (!ST.crew.length) {
      ST.nextPay = ST.done + Ekipa.PAYDAY_EVERY; const paid = Math.min(Math.floor(ST.money), up); ST.money -= paid; save(); renderTop();
      if (paid > 0) notice('Rachunki za siedzibę', tn + ': ' + zl(paid) + ' za prąd, czynsz i ubezpieczenie busa.', renderMenu); else renderMenu();
      return;
    }
    billText = up ? 'Utrzymanie siedziby (' + tn + '): −' + zl(Math.min(Math.floor(ST.money), up)) + '. ' : ''; ST.money = Math.max(0, ST.money - up);
    ['menu', 'job', 'result', 'crew', 'hq'].forEach(x => $(x).hidden = true); $('payday').hidden = false;
    sidePay = Ekipa.sideGigs(ST.crew, rnd); ST.money += sidePay.total; save(); renderTop();
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
    const res = Ekipa.applyPay(ST.crew, PAY, { patienceBonus: Siedziba.effects(ST.hq).comfort * 0.5 }); ST.money -= res.spent; ST.crew = res.workers;
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
      const yes = b.dataset.a === 'y'; if (yes) ST.money -= pay;
      ST.crew = ST.crew.map(x => x.id === w.id ? Ekipa.answerDemand(x, yes, pay) : x);
      ST.demandAt[w.id] = ST.done; save(); $('modal').hidden = true; modalOpen = false; renderMenu(); };
  }
  function checkDemands() {
    if (modalOpen) return false;
    for (const w of ST.crew) { const d = Ekipa.demand(w);
      if (d && ST.done - (ST.demandAt[w.id] == null ? -9 : ST.demandAt[w.id]) >= 2) { askDemand(w, d); return true; } }
    return false;
  }
  function nextEvent() {
    if (modalOpen) return;
    if (ST.done >= ST.nextPay) { startPayday(true); return; }
    if (checkClaims()) return;
    checkDemands();
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
      if (b.dataset.a === 'pay') ST.money -= pay;
      else { ST.ratings.push(1); if (acc) { ST.ratings.push(1); ST.money -= ST.money * 0.3; } }
      save(); $('modal').hidden = true; modalOpen = false; renderMenu(); };
    return true;
  }

  $('reset').onclick = () => { if ($('reset').dataset.s) { ST = fresh(); save(); delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; renderMenu(); } else { $('reset').dataset.s = 1; $('reset').textContent = 'Na pewno? Kliknij jeszcze raz'; setTimeout(() => { delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; }, 3000); } };

  window.__z = { get ST() { return ST; }, get cur() { return cur; }, renderHq, co, startJob, renderMenu, renderCrew, startPayday };
  renderMenu();
})();
