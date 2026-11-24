/* Interfejs zleceń: lista poziomów, scenka naprawy krok po kroku, mini-gra na wyczucie, odbiór u klienta, reklamacje. */
(() => {
  const { JOBS, CLIENTS, LEVELS } = Jobs;
  const $ = id => document.getElementById(id);
  const zl = n => Math.round(n).toLocaleString('pl-PL') + ' zł';
  const rnd = Math.random;

  // ---------- stan ----------
  const fresh = () => ({ money: 0, ratings: [], best: {}, unlocked: 1, claims: [], done: 0 });
  let ST = fresh();
  try { const r = localStorage.getItem('zlecenia_v1'); if (r) ST = Object.assign(fresh(), JSON.parse(r)); } catch (e) {}
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
  function renderTop() {
    $('money').textContent = zl(ST.money);
    const r = reputation(); $('rep').textContent = r == null ? '–' : r.toFixed(1).replace('.', ',') + ' ★';
    $('claims').textContent = ST.claims.length;
  }
  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
  function renderMenu() {
    renderTop(); $('job').hidden = true; $('result').hidden = true; $('menu').hidden = false;
    $('menu').innerHTML = '<h3 style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Zlecenia</h3>' + LEVELS.map((l, i) => {
      const job = JOBS[l.job], cl = CLIENTS[l.client], locked = i + 1 > ST.unlocked, b = ST.best[i];
      return '<button class="lvl" data-i="' + i + '" ' + (locked ? 'disabled' : '') + '><span class="av">' + (locked ? '🔒' : cl.em) + '</span><span><b>' + (i + 1) + '. ' + job.title + '</b><small>' + job.place + ' · ' + cl.name + ' · ok. ' + zl(job.base * l.mult) + '</small></span><span class="res">' +
        (b ? '<span class="stars">' + stars(b.stars) + '</span><br>fuszerka ' + b.index + '%' : (locked ? '' : 'nowe')) + '</span></button>';
    }).join('');
    checkClaims();
  }
  $('menu').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b && !b.disabled) startJob(+b.dataset.i); });

  // ---------- zlecenie ----------
  function startJob(i) {
    const l = LEVELS[i];
    cur = { i, job: JOBS[l.job], client: CLIENTS[l.client], mult: l.mult, step: 0, picks: [], tokens: new Set(['broken']), time: 0, cost: 0 };
    $('menu').hidden = true; $('result').hidden = true; $('job').hidden = false;
    renderJob();
  }
  function renderJob() {
    const { job, client, step } = cur, s = job.steps[step];
    $('job').innerHTML =
      '<div class="bubble"><span class="av">' + client.em + '</span><div><b>' + client.name + '</b>: „' + job.intro + '”<br><small style="color:var(--muted)">' + client.note + '</small></div></div>' +
      sceneHTML(job) +
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
    cur.picks.push({ stepId: cur.job.steps[cur.step].id, optionId: opt.id, accuracy });
    cur.time += opt.time; cur.cost += opt.cost;
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
    const r = Fuszerka.evaluate(job, cur.picks, cur.client);
    const comment = Fuszerka.clientComment(cur.client, r, rnd);
    const claim = Fuszerka.rollClaim(r, rnd);
    ST.money += r.profit; ST.ratings.push(r.stars); ST.done++;
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
      '<div class="hint">Zadowolenie klienta: ' + r.satisfaction + '%' + (r.late ? ' (spóźnienie: ' + r.time + ' z ' + job.deadline + ' min)' : '') + '. Szansa reklamacji: ' + Math.round(r.claim.chance * 100) + '%.</div>' +
      '<div class="money"><span>Wypłata</span><span>' + zl(r.payout) + '</span><span>Materiały</span><span>−' + zl(r.cost) + '</span><span class="tot">Zysk</span><span class="tot">' + zl(r.profit) + '</span></div>' +
      '<button class="primary" id="next">Dalej</button><button id="again" style="background:transparent">Spróbuj to zlecenie jeszcze raz</button>';
    $('next').onclick = () => renderMenu(); $('again').onclick = () => startJob(cur.i);
    window.__z.last = r;
  }

  // ---------- reklamacje po tygodniu ----------
  let modalOpen = false;
  function checkClaims() {
    if (modalOpen) return;
    const k = ST.claims.findIndex(c => c.due <= ST.done);
    if (k < 0) return;
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
  }

  $('reset').onclick = () => { if ($('reset').dataset.s) { ST = fresh(); save(); delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; renderMenu(); } else { $('reset').dataset.s = 1; $('reset').textContent = 'Na pewno? Kliknij jeszcze raz'; setTimeout(() => { delete $('reset').dataset.s; $('reset').textContent = 'Zacznij od zera'; }, 3000); } };

  window.__z = { get ST() { return ST; }, startJob, renderMenu };
  renderMenu();
})();
