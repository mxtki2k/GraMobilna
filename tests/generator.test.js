// Testy generatora robót (tools/nowa_robota.js). Uruchomienie: node tests/generator.test.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const G = require('../tools/nowa_robota.js');
const J = require('../prototypes/janusz/jobs.js'), Sz = require('../prototypes/janusz/szkolenia.js'), Al = require('../prototypes/janusz/alledrogo.js'), S = require('../prototypes/janusz/scenes.js'), K = require('../prototypes/janusz/kalendarz.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const known = { clients: Object.keys(J.CLIENTS), certs: Object.keys(Sz.CERTS), tools: Object.keys(Al.TYPES) };
const SRC = fs.readFileSync(path.join(__dirname, '..', 'roboty', 'prysznic.rob'), 'utf8');
const errs = txt => G.validate(G.parse(txt, 'x.rob'), known);

t('szablon z generatora jest poprawnie parsowalny (poza brakującymi krokami)', () => {
  const p = G.parse(G.TEMPLATE, 'szablon.rob'); assert.strictEqual(p.errors.length, 0); assert.strictEqual(p.job.id, 'prysznic'); assert.strictEqual(p.levels.length, 2); assert(p.levels[1].intro.includes('22:30'));
  assert(errs(G.TEMPLATE).some(e => /co najmniej 4 kroki/.test(e)));
});
t('przykładowa robota przechodzi walidację i ma oczekiwaną strukturę', () => {
  assert.deepStrictEqual(errs(SRC), []); const p = G.parse(SRC, 'prysznic.rob');
  assert.strictEqual(p.job.steps.length, 5); assert(p.job.steps[1].options[0].skill && !p.job.steps[0].options[0].skill);
  assert.deepStrictEqual(p.job.steps[0].options[1].defects, [{ label: 'zawór się nie domyka', sev: 1, vis: 0.3 }]);
  assert.strictEqual(p.job.steps[1].options[2].defects[0].hazard, 0.2); assert.strictEqual(p.surprises[0].options[2].then, 'rdza-wyciek'); assert.strictEqual(p.follow[0].follow, true);
});
t('walidacja łapie typowe błędy', () => {
  const mut = (a, b) => errs(SRC.replace(a, b));
  assert(mut('| 6 | 0 | pr-woda-off |', '| 0 | 0 | pr-woda-off |').some(e => /czasy d ≥ s ≥ f/.test(e)));
  assert(mut('| pr-woda-sink |', '| pr-woda-off |').some(e => /powtórzone fx/.test(e)));
  assert(mut('woda w całej łazience:3:1', '').some(e => /wady f/.test(e)));
  assert(mut('kurs hydr', 'kurs nie-ma').some(e => /nieznany kurs/.test(e)));
  assert(mut('klient=mirek', 'klient=ktos').some(e => /poziom/.test(e)));
  assert(mut('baza 260 | termin 30', 'baza 260 | termin 60').some(e => /suma czasów „dobrze”/.test(e)));
  assert(mut('then=rdza-wyciek', 'then=nie-ma').some(e => /nie ma następstwa/.test(e)));
  assert(mut('wrench,pliers', 'wrench,pliers').length === 0);
  assert(mut('| intro=Pani Grażyna o 22:30: „Woda w prysznicu parzy, proszę przyjechać!”', '').some(e => /nocny wymaga intro/.test(e)));
  assert(errs('krok x | Y | Z').some(e => /najpierw/.test(e)));
  assert(errs(SRC.replace('| 0 | pr-test-brak | brak próby baterii:3:0.15', '| 0 | pr-test-brak | brak próby baterii:zle:0.15')).some(e => /zła wada/.test(e)));
});
t('roboty_gen.js jest aktualny względem roboty/*.rob (po edycji uruchom node tools/nowa_robota.js)', () => {
  const r = G.build(path.join(__dirname, '..', 'roboty'), known); assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'prototypes', 'janusz', 'roboty_gen.js'), 'utf8'), G.emit(r.data));
});
t('wygenerowana robota jest zarejestrowana we wszystkich modułach gry', () => {
  const j = J.JOBS.prysznic; assert(j && j.base === Math.round(260 * J.PAY_SCALE) && j.steps.length === 5);
  assert(J.LEVELS.filter(l => l.job === 'prysznic').length === 2 && J.getSurprise('prysznic', 'rdza-wyciek').follow);
  assert(J.SURPRISES.prysznic[0].options[1].then === 'rdza-wyciek' && J.rollSurprise('prysznic', 0, () => 0).id === 'rdza');
  assert(Sz.CERTS.hydr.jobs.includes('prysznic') && Sz.modsFor({ hydr: true }, 'prysznic').hazard < 1);
  assert(Al.ALL_JOBS.includes('prysznic') && Al.TYPES.klucze.jobs.includes('prysznic') && Al.TYPES.pistolet.jobs.includes('prysznic'));
  assert(K.demandMult('zima', 'prysznic') === 1.15 && K.demandMult('lato', 'prysznic') === 0.9);
  assert(S.JOB_SCENES.prysznic && S.ACTIONS.prysznic.length === 5 && S.ACTIONS.prysznic[0] === 'wrench' && S.TARGETS.prysznic.length === 5);
});
t('scena ogólna: etapy zmieniają kolory (dobrze/skrót/fusz), zepsuty stan znika po pierwszym kroku, noc działa', () => {
  const sig = g => g.map(r => r.join('')).join('');
  const base = sig(S.job('prysznic', ['broken'], 0)), ok = sig(S.job('prysznic', ['pr-woda-off'], 0)), q = sig(S.job('prysznic', ['pr-woda-sink'], 0)), bad = sig(S.job('prysznic', ['pr-flood'], 0));
  assert(new Set([base, ok, q, bad]).size === 4);
  const all = J.JOBS.prysznic.steps.map(s => s.options[0].fx); assert(sig(S.job('prysznic', all, 0)) !== sig(S.job('prysznic', all, 1)), 'iskry przy komplecie dobrych etapów');
  const g = S.job('prysznic', ['broken'], 0, { night: true }); assert(g.length === 80 && g.every(r => r.length === 128));
});
console.log('\n' + n + ' testów przeszło');
