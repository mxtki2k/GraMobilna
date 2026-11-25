// Testy rodzajów robót: schemat, opcje, niespodzianki i sensowność ocen. Uruchomienie: node tests/roboty.test.js
const assert = require('assert');
const F = require('../prototypes/janusz/fuszerka.js'), Jb = require('../prototypes/janusz/jobs.js'), T = require('../prototypes/janusz/terminy.js'), Sz = require('../prototypes/janusz/szkolenia.js');
const S = require('../prototypes/janusz/scenes.js'), K = require('../prototypes/janusz/kalendarz.js');
const { JOBS, CLIENTS, LEVELS, SURPRISES } = Jb;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const picks = (job, f) => job.steps.map((s, i) => ({ stepId: s.id, optionId: typeof f === 'string' ? f : f(i), accuracy: 0.7 }));
const sum = (job, k) => job.steps.reduce((a, s) => a + s.options.find(o => o.id === k).time, 0);

t('schemat: każda robota ma id, tytuł, miejsce, stawkę, termin i kroki z trzema wariantami', () => {
  assert(Object.keys(JOBS).length >= 10);
  for (const [id, j] of Object.entries(JOBS)) {
    assert(j.id === id && j.title && j.place && j.intro && j.base > 0 && j.deadline > 0 && j.steps.length >= 4, id);
    const ids = new Set();
    for (const st of j.steps) {
      assert(st.id && st.name && st.hint && !ids.has(st.id), id + ':' + st.id); ids.add(st.id);
      assert.deepStrictEqual(st.options.map(o => o.id), ['dobrze', 'skrot', 'fusz'], id + ':' + st.id);
      for (const o of st.options) { assert(o.label && o.desc && o.time >= 0 && o.cost >= 0 && o.fx && Array.isArray(o.defects), id + ':' + o.id); for (const d of o.defects) assert(d.label && d.sev > 0 && d.vis >= 0 && d.vis <= 1, id); }
      const [d, s, f] = st.options; assert(d.time >= s.time && s.time >= f.time, id + ' czasy malejące: ' + st.id);
      assert(d.defects.length === 0 && f.defects.length >= 1 && f.defects.reduce((a, x) => a + x.sev, 0) >= s.defects.reduce((a, x) => a + x.sev, 0), id + ' wady rosną: ' + st.id);
    }
  }
});
t('fx: tokeny są unikalne w obrębie roboty i mają grafikę w scenie', () => {
  for (const j of Object.values(JOBS)) { const all = j.steps.flatMap(s => s.options.map(o => o.fx)); assert.strictEqual(new Set(all).size, all.length, j.id); assert(S.JOB_SCENES[j.id], 'scena ' + j.id); assert(S.ACTIONS[j.id].length === j.steps.length && S.TARGETS[j.id].length === j.steps.length, 'animacje ' + j.id); }
});
t('ocena: wszystko solidnie daje dobry wynik, wszystko fuszerką fatalny, dla każdej roboty', () => {
  for (const j of Object.values(JOBS)) {
    const a = F.evaluate(j, picks(j, 'dobrze'), CLIENTS.mirek), z = F.evaluate(j, picks(j, 'fusz'), CLIENTS.mirek);
    assert(a.index <= 30 && a.stars === 5, j.id + ' solid ' + a.index); assert(z.index >= 60, j.id + ' fusz ' + z.index + ' ' + j.id); assert(z.claim.chance > a.claim.chance, j.id);
    assert(F.evaluate(j, picks(j, i => (i % 2 ? 'skrot' : 'dobrze')), CLIENTS.mirek).index < z.index, j.id);
  }
});
t('czas: solidnie mieści się w terminie, skrót w 80% terminu, fuszerka bardzo szybko', () => {
  for (const j of Object.values(JOBS)) { assert(sum(j, 'dobrze') <= j.deadline && sum(j, 'dobrze') >= j.deadline * 0.8, j.id + ' ' + sum(j, 'dobrze') + '/' + j.deadline); assert(sum(j, 'skrot') < j.deadline * 0.6 && sum(j, 'fusz') < j.deadline * 0.3, j.id); }
});
t('niespodzianki: poprawny schemat, kolejny krok istnieje, wybór ma rozwiązanie bez wad', () => {
  for (const [id, list] of Object.entries(SURPRISES)) {
    assert(JOBS[id], id);
    for (const s of list) {
      assert(s.id && s.title && s.text && s.chance > 0 && s.chance <= 1, id + ':' + s.id);
      if (s.follow) assert(s.after === -1, 'następstwo nie ma kroku: ' + s.id); else assert(s.chance <= 0.5 && s.after >= 0 && s.after < JOBS[id].steps.length - 1, id + ':' + s.id);
      assert.deepStrictEqual(s.options.map(o => o.id), ['dobrze', 'skrot', 'fusz']);
      assert(s.options[0].defects.length === 0 && s.options[2].defects.some(d => d.sev >= 2) && s.options[0].time > s.options[2].time && s.options.every(o => o.label && o.desc && o.cost >= 0), id + ':' + s.id);
    }
  }
  assert(Object.keys(SURPRISES).length === Object.keys(JOBS).length, 'każda robota ma niespodziankę');
});
t('łańcuchy: każde następstwo jest wywołane przez opcję, wskazuje istniejącą niespodziankę i zdąży się wydarzyć przed końcem roboty', () => {
  const refs = new Set();
  for (const [id, list] of Object.entries(SURPRISES)) for (const s of list.filter(x => !x.follow)) for (const o of s.options) if (o.then) {
    const f = Jb.getSurprise(id, o.then); assert(f && f.follow, id + ':' + s.id + '->' + o.then); refs.add(id + ':' + o.then);
    assert(s.after + 2 <= JOBS[id].steps.length - 1, 'za mało kroków po ' + s.id); assert(o.id !== 'dobrze', 'rozwiązanie bez skutków');
  }
  for (const [id, list] of Object.entries(SURPRISES)) for (const s of list.filter(x => x.follow)) assert(refs.has(id + ':' + s.id), 'nieużyte następstwo ' + s.id);
  assert(refs.size >= 10);
  assert.strictEqual(Jb.rollSurprise('kran', -1, () => 0), null, 'następstwa nie losują się same');
});
t('niespodzianki: losowanie według szansy, tylko po właściwym kroku', () => {
  const r = lcg(3); let hits = 0; for (let i = 0; i < 4000; i++) if (Jb.rollSurprise('kran', 0, r)) hits++;
  assert(Math.abs(hits / 4000 - SURPRISES.kran[0].chance) < 0.03);
  assert.strictEqual(Jb.rollSurprise('kran', 2, () => 0), null); assert.strictEqual(Jb.rollSurprise('nie-ma', 0, () => 0), null);
  assert(Jb.rollSurprise('plytki', 0, () => 0).id === 'plesn' && Jb.rollSurprise('plytki', 3, () => 0).id === 'serie');
});
t('poziomy: istnieją nowe roboty, klienci i zlecenia terminowe są poprawne, co najmniej 32 poziomy', () => {
  assert(LEVELS.length >= 32);
  for (const l of LEVELS) { assert(JOBS[l.job] && CLIENTS[l.client] && /^\d\d:\d\d$/.test(l.time) && (!l.due || T.KINDS[l.due])); }
  for (const id of Object.keys(JOBS)) assert(LEVELS.some(l => l.job === id), id);
});
t('szkolenia i kalendarz obejmują każdą robotę', () => {
  const covered = new Set(Object.values(Sz.CERTS).flatMap(c => c.jobs)); for (const id of Object.keys(JOBS)) { assert(covered.has(id), 'kurs ' + id); assert(K.demandMult('zima', id) !== undefined); }
  assert(K.demandMult('wiosna', 'plytki') > 1 && K.demandMult('zima', 'plytki') < 1 && K.demandMult('zima', 'syfon') > 1);
  assert(Sz.modsFor({ hydr: true }, 'syfon').hazard < 1 && Sz.modsFor({ hydr: true }, 'drzwi').hazard === 1);
});
console.log('\n' + n + ' testów przeszło');
