#!/usr/bin/env node
// Generator robót: zamienia kompaktowe pliki roboty/*.rob na prototypes/janusz/roboty_gen.js (JOBS, niespodzianki, poziomy, metadane).
// Użycie:
//   node tools/nowa_robota.js            regeneruje roboty_gen.js ze wszystkich roboty/*.rob (waliduje)
//   node tools/nowa_robota.js --szablon  wypisuje szablon nowej roboty
//   node tools/nowa_robota.js --lista    wypisuje roboty z plików .rob
// Format pliku .rob (pola oddzielone „ | ”; komentarz zaczyna się od #):
//   robota ID | Tytuł | Miejsce | baza 210 | termin 30
//   intro Tekst wstępu klienta.
//   tlo kuchnia | obiekt rura | anim pliers,wrench,tester          (scena ogólna; opcjonalnie)
//   kurs hydr | narzedzia klucze,pistolet | popyt zima=1.2 lato=.9    (rejestracja w kursach, narzędziach, kalendarzu)
//   poziom klient=mirek mult=1.2 slot=dzien czas=10:30 due=normalny | intro=Tekst (intro po kresce, wymagane dla slot=noc)
//   krok ID | Nazwa | Podpowiedź
//     d | etykieta | opis | czas | koszt | fx | wada:sev:vis[:hazard];wada2:... | skill
//     s | ...      (skrót)
//     f | ...      (fuszerka)
//   niespodzianka ID | po=1 | szansa=0.35 | Tytuł | Tekst
//     d | etykieta | opis | czas | koszt | wady
//     s | etykieta | opis | czas | koszt | wady | then=ID_nastepstwa
//     f | ...
//   nastepstwo ID | Tytuł | Tekst        (opcje d/s/f jak w niespodziance)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), IN = path.join(ROOT, 'roboty'), OUT = path.join(ROOT, 'prototypes', 'janusz', 'roboty_gen.js');
const SLOTS = { d: 'dobrze', s: 'skrot', f: 'fusz' };

function parseDefects(txt, where, errs) {
  if (!txt || !txt.trim()) return [];
  return txt.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const p = x.split(':'); const [label, sev, vis, haz] = p; const d = { label: label.trim(), sev: +sev, vis: +vis };
    if (haz != null && +haz) d.hazard = +haz;
    if (!d.label || !(d.sev > 0) || !(d.vis >= 0 && d.vis <= 1) || (haz != null && isNaN(+haz))) errs.push(where + ': zła wada „' + x + '” (etykieta:sev:vis[:hazard])');
    return d;
  });
}
function kv(parts) { const o = {}; parts.forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }

/* Parsuje tekst jednego pliku .rob. Zwraca { job, surprises, follow, levels, meta, errors }. */
function parse(text, file) {
  const errs = [], lines = text.split(/\r?\n/);
  let job = null, step = null, cur = null; const out = { surprises: [], follow: [], levels: [], meta: {}, errors: errs };
  const at = n => (file || 'rob') + ':' + n;
  lines.forEach((raw, i) => {
    const n = i + 1; const line = raw.replace(/#.*$/, '').trim(); if (!line) return;
    const f = line.split('|').map(x => x.trim()), head = f[0].split(/\s+/), cmd = head[0];
    if (cmd === 'robota') { const id = head[1]; job = { id, title: f[1], place: f[2], base: 0, deadline: 0, intro: '', steps: [] }; (f.slice(3)).forEach(x => { const [k, v] = x.split(/\s+/); if (k === 'baza') job.base = +v; if (k === 'termin') job.deadline = +v; }); out.job = job; step = cur = null; }
    else if (!job) errs.push(at(n) + ': najpierw „robota ID | Tytuł | Miejsce | baza N | termin N”');
    else if (cmd === 'intro') job.intro = line.replace(/^intro\s+/, '');
    else if (cmd === 'tlo') f.forEach(x => { const [k, ...v] = x.split(/\s+/); const val = v.join(' '); if (k === 'tlo') out.meta.tlo = val; else if (k === 'obiekt') out.meta.obiekt = val; else if (k === 'anim') out.meta.anim = val.split(',').map(s => s.trim()); });
    else if (cmd === 'kurs') f.forEach(x => { const [k, ...v] = x.split(/\s+/); const val = v.join(' '); if (k === 'kurs') out.meta.kurs = val; else if (k === 'narzedzia') out.meta.narzedzia = val.split(',').map(s => s.trim()); else if (k === 'popyt') out.meta.popyt = Object.fromEntries(val.split(/\s+/).map(p => { const [s, m] = p.split('='); return [s, +m]; })); });
    else if (cmd === 'poziom') { const o = kv(head.slice(1)); const lv = { job: job.id, client: o.klient, mult: +o.mult, slot: o.slot || 'dzien', time: o.czas }; if (o.due) lv.due = o.due; const it = f.slice(1).find(x => /^intro=/.test(x)); if (it) lv.intro = it.slice(6); out.levels.push(lv); }
    else if (cmd === 'krok') { step = { id: head[1], name: f[1], hint: f[2], options: [] }; job.steps.push(step); cur = step; }
    else if (cmd === 'niespodzianka') { const o = kv(f.slice(1, 3)); cur = { id: head[1], after: +o.po, chance: +o.szansa, title: f[3], text: f[4], options: [] }; out.surprises.push(cur); step = null; }
    else if (cmd === 'nastepstwo') { cur = { id: head[1], after: -1, chance: 1, follow: true, title: f[1], text: f[2], options: [] }; out.follow.push(cur); step = null; }
    else if (SLOTS[cmd]) {
      if (!cur) { errs.push(at(n) + ': opcja bez kroku lub niespodzianki'); return; }
      const isStep = !!step && cur === step, where = at(n);
      let opt;
      if (isStep) { const sk = f.slice(7).some(x => x === 'skill'); opt = { id: SLOTS[cmd], label: f[1], desc: f[2], time: +f[3], cost: +f[4] }; if (sk) opt.skill = true; opt.defects = parseDefects(f[6], where, errs); opt.fx = f[5]; if (!opt.fx) errs.push(where + ': brak fx'); }
      else { opt = { id: SLOTS[cmd], label: f[1], desc: f[2], time: +f[3], cost: +f[4], defects: parseDefects(f[5], where, errs) }; const th = f.slice(6).find(x => /^then=/.test(x)); if (th) opt.then = th.slice(5); }
      if (!opt.label || !opt.desc || isNaN(opt.time) || isNaN(opt.cost)) errs.push(where + ': opcja wymaga „etykieta | opis | czas | koszt”');
      cur.options.push(opt);
    } else errs.push(at(n) + ': nieznane polecenie „' + cmd + '”');
  });
  return out;
}

/* Walidacja zgodna z tests/roboty.test.js: schemat, kolejność czasów, wady rosną, fx unikalne, niespodzianki i łańcuchy. */
function validate(p, known) {
  const errs = p.errors.slice(), j = p.job; if (!j) return errs.concat('brak definicji „robota”');
  const w = x => j.id + ': ' + x;
  if (!j.title || !j.place || !(j.base > 0) || !(j.deadline > 0) || !j.intro) errs.push(w('wymagane: tytuł, miejsce, baza, termin, intro'));
  if (j.steps.length < 4) errs.push(w('co najmniej 4 kroki'));
  const fx = new Set(), ids = new Set();
  for (const s of j.steps) {
    if (ids.has(s.id)) errs.push(w('powtórzone id kroku ' + s.id)); ids.add(s.id);
    if (s.options.map(o => o.id).join() !== 'dobrze,skrot,fusz') { errs.push(w('krok ' + s.id + ': kolejno d, s, f')); continue; }
    const [d, sk, fu] = s.options;
    if (!(d.time >= sk.time && sk.time >= fu.time)) errs.push(w('krok ' + s.id + ': czasy d ≥ s ≥ f'));
    if (d.defects.length) errs.push(w('krok ' + s.id + ': „dobrze” bez wad'));
    if (!fu.defects.length || fu.defects.reduce((a, x) => a + x.sev, 0) < sk.defects.reduce((a, x) => a + x.sev, 0)) errs.push(w('krok ' + s.id + ': wady f ≥ s, f ma co najmniej jedną'));
    for (const o of s.options) { if (fx.has(o.fx)) errs.push(w('powtórzone fx ' + o.fx)); fx.add(o.fx); }
  }
  const sum = k => j.steps.reduce((a, s) => a + ((s.options.find(o => o.id === k) || {}).time || 0), 0);
  if (sum('dobrze') > j.deadline || sum('dobrze') < j.deadline * 0.8) errs.push(w('suma czasów „dobrze” ' + sum('dobrze') + ' ma mieścić się w 80–100% terminu ' + j.deadline));
  if (sum('skrot') >= j.deadline * 0.6) errs.push(w('suma czasów „skrót” ' + sum('skrot') + ' ≥ 60% terminu'));
  if (sum('fusz') >= j.deadline * 0.3) errs.push(w('suma czasów „fusz” ' + sum('fusz') + ' ≥ 30% terminu'));
  const fid = new Set(p.follow.map(x => x.id)), used = new Set();
  for (const sp of p.surprises.concat(p.follow)) {
    const pre = w('niespodzianka ' + sp.id + ': ');
    if (!sp.title || !sp.text) errs.push(pre + 'tytuł i tekst');
    if (!sp.follow && !(sp.chance > 0 && sp.chance <= 0.5 && sp.after >= 0 && sp.after < j.steps.length - 1)) errs.push(pre + 'po=0…' + (j.steps.length - 2) + ', szansa 0…0.5');
    if (sp.options.map(o => o.id).join() !== 'dobrze,skrot,fusz') { errs.push(pre + 'opcje d, s, f'); continue; }
    if (sp.options[0].defects.length || !sp.options[2].defects.some(d => d.sev >= 2) || !(sp.options[0].time > sp.options[2].time)) errs.push(pre + '„dobrze” bez wad i dłuższe, „fusz” z wadą sev ≥ 2');
    for (const o of sp.options) if (o.then) { if (!fid.has(o.then)) errs.push(pre + 'nie ma następstwa ' + o.then); else if (o.id === 'dobrze') errs.push(pre + '„dobrze” bez następstw'); else if (!(sp.after + 2 <= j.steps.length - 1)) errs.push(pre + 'za mało kroków po niespodziance dla następstwa'); used.add(o.then); }
  }
  for (const f of p.follow) if (!used.has(f.id)) errs.push(w('następstwo ' + f.id + ' nie jest wywoływane'));
  if (!p.surprises.length) errs.push(w('co najmniej jedna niespodzianka'));
  if (!p.levels.length) errs.push(w('co najmniej jeden poziom'));
  for (const l of p.levels) { if (!/^\d\d:\d\d$/.test(l.time || '') || !(l.mult > 0) || !l.client || (known.clients && !known.clients.includes(l.client)) || !['dzien', 'noc'].includes(l.slot)) errs.push(w('poziom: klient, mult, slot (dzien|noc), czas HH:MM')); if (l.slot === 'noc' && !l.intro) errs.push(w('poziom nocny wymaga intro z godziną')); }
  if (p.meta.kurs && known.certs && !known.certs.includes(p.meta.kurs)) errs.push(w('nieznany kurs ' + p.meta.kurs));
  if (p.meta.narzedzia && known.tools) for (const t of p.meta.narzedzia) if (!known.tools.includes(t)) errs.push(w('nieznane narzędzie ' + t));
  if (!p.meta.kurs) errs.push(w('wymagane: kurs'));
  if (!p.meta.narzedzia || !p.meta.narzedzia.length) errs.push(w('wymagane: narzedzia'));
  return errs;
}

function build(dir, known) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.rob')).sort() : [], res = { JOBS: {}, SURPRISES: {}, CHAINS: {}, LEVELS: [], META: {} }, errs = [];
  for (const f of files) {
    const p = parse(fs.readFileSync(path.join(dir, f), 'utf8'), f), e = validate(p, known); errs.push(...e.map(x => f + ': ' + x));
    if (!p.job || e.length) continue; const id = p.job.id;
    if (res.JOBS[id]) { errs.push(f + ': powtórzone id roboty ' + id); continue; }
    res.JOBS[id] = p.job; res.SURPRISES[id] = p.surprises.concat(p.follow); res.LEVELS.push(...p.levels);
    res.CHAINS[id] = Object.fromEntries(p.surprises.map(s => [s.id, Object.fromEntries(s.options.filter(o => o.then).map(o => [o.id, o.then]))]).filter(x => Object.keys(x[1]).length));
    for (const s of p.surprises.concat(p.follow)) for (const o of s.options) delete o.then; // następstwa trzyma CHAINS (jak w jobs.js)
    res.META[id] = p.meta;
  }
  return { data: res, errors: errs, files };
}
function emit(data) {
  return '/* WYGENEROWANE przez tools/nowa_robota.js z roboty/*.rob. Nie edytuj ręcznie. */\n(function (root, factory) {\n  if (typeof module === \'object\' && module.exports) module.exports = factory();\n  else root.RobotyGen = factory();\n})(typeof self !== \'undefined\' ? self : this, function () {\n  return ' + JSON.stringify(data, null, 1).replace(/\n\s*/g, ' ') + ';\n});\n';
}
const TEMPLATE = `# Nowa robota. Zapisz jako roboty/<id>.rob i uruchom: node tools/nowa_robota.js
robota prysznic | Bateria prysznicowa | Łazienka | baza 260 | termin 30
intro Z baterii leje się wrzątek albo lód. Pani Grażyna twierdzi, że to spisek.
tlo lazienka | obiekt rura | anim wrench,wrench,pliers,wrench,tester
kurs hydr | narzedzia klucze,pistolet | popyt zima=1.15 lato=0.9
poziom klient=mirek mult=1.2 slot=dzien czas=10:00
poziom klient=grazyna mult=1.8 slot=noc czas=22:30 | intro=Pani Grażyna o 22:30: „Woda w prysznicu parzy, proszę przyjechać!”
krok woda | Odetnij wodę | Najpierw zawory.
  d | Zakręć główny zawór | Pewnie i sucho. | 6 | 0 | pr-woda-off |
  s | Zakręć zawór w łazience | Szybciej. | 3 | 0 | pr-woda-sink | zawór się nie domyka:1:0.3
  f | Nie zakręcaj | Przecież to tylko woda. | 1 | 0 | pr-flood | woda w łazience:3:1
# ... kolejne kroki (razem co najmniej 4) ...
niespodzianka rdza | po=0 | szansa=0.3 | Rura pod prysznicem jest zardzewiała | Gwint osypuje się w palcach.
  d | Wymień odcinek rury | Dłużej, ale trwale. | 6 | 20 |
  s | Owiń taśmą | Na jakiś czas. | 2 | 3 | rdza przebije:3.5:0.1 | then=rdza-wyciek
  f | Udawaj, że nie widzisz | Nie ruszaj. | 0 | 0 | przerdzewiała rura:4:0.3
nastepstwo rdza-wyciek | Rura puściła | Woda tryska na ścianę.
  d | Zakręć i wymień | Mokro, ale szybko. | 7 | 20 |
  s | Opaska zaciskowa | Trzyma. | 3 | 5 | opaska zamiast rury:3:0.3
  f | Podstaw wiadro | Kapie. | 1 | 0 | stały wyciek:4.5:0.4
`;
module.exports = { parse, validate, build, emit, TEMPLATE };

if (require.main === module) {
  const a = process.argv[2];
  if (a === '--szablon') { process.stdout.write(TEMPLATE); process.exit(0); }
  const need = p => { try { return require(path.join(ROOT, 'prototypes', 'janusz', p)); } catch (e) { return null; } };
  const J = need('jobs.js'), Sz = need('szkolenia.js'), Al = need('alledrogo.js');
  const known = { clients: J ? Object.keys(J.CLIENTS) : null, certs: Sz ? Object.keys(Sz.CERTS) : null, tools: Al ? Object.keys(Al.TYPES) : null };
  const r = build(IN, known);
  if (a === '--lista') { for (const [id, j] of Object.entries(r.data.JOBS)) console.log(id.padEnd(12), j.title, '·', j.steps.length, 'kroków'); process.exit(r.errors.length ? 1 : 0); }
  if (r.errors.length) { console.error('Błędy w roboty/*.rob:\n - ' + r.errors.join('\n - ')); process.exit(1); }
  fs.writeFileSync(OUT, emit(r.data));
  console.log('OK: ' + Object.keys(r.data.JOBS).length + ' robót z ' + r.files.length + ' plików → ' + path.relative(ROOT, OUT));
}
