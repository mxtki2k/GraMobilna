// Testy fazy B: zlecenia dla ekipy i dojazdy. Uruchomienie: node tests/faza_b.test.js
const assert = require('assert');
const Z = require('../prototypes/janusz/zlecenia_ekipy.js'), F = require('../prototypes/janusz/fuszerka.js'), C = require('../prototypes/janusz/czas.js'), E = require('../prototypes/janusz/ekipa.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const deps = { evaluate: F.evaluate, rollClaim: F.rollClaim, minutes: u => C.minutes(u, false), jobs: JOBS, clients: CLIENTS };
const worker = id => E.newWorker(E.CANDIDATES.find(c => c.id === id));

t('dojazdy: symetryczne między dzielnicami, krótsze w obrębie dzielnicy, baza najbliżej osiedla', () => {
  for (const a of ['baza', 'osiedle', 'centrum', 'wies']) for (const b of ['osiedle', 'centrum', 'wies']) assert(Z.travel(a, b) > 0);
  assert.strictEqual(Z.travel('osiedle', 'wies'), Z.travel('wies', 'osiedle')); assert(Z.travel('osiedle', 'osiedle') < Z.travel('osiedle', 'wies') && Z.travel('baza', 'osiedle') < Z.travel('baza', 'wies'));
  assert.strictEqual(Z.districtOf('karyna'), 'centrum'); assert.strictEqual(Z.districtOf('nikt'), 'osiedle');
});
t('trudność: każda robota z gry ma trudność 0–1, gniazdko najtrudniejsze, kran najłatwiejszy', () => {
  for (const id of Object.keys(JOBS)) { const d = Z.difficulty(id); assert(d >= 0.1 && d <= 1, id); }
  assert(Z.difficulty('gniazdko') > Z.difficulty('plytki') && Z.difficulty('plytki') > Z.difficulty('kran'));
});
t('tablica: deterministyczna, poprawne roboty i klienci, wyższa ocena firmy daje wyższe mnożniki', () => {
  const ids = Object.keys(JOBS), cl = Object.keys(CLIENTS), a = Z.makeBoard(3, lcg(1), 3, ids, cl, 4), b = Z.makeBoard(3, lcg(1), 3, ids, cl, 4);
  assert.deepStrictEqual(a, b); assert.strictEqual(a.length, 4); a.forEach(o => assert(JOBS[o.job] && CLIENTS[o.client] && o.district && o.mult > 0.5 && o.id >= 30));
  const avg = st => { const r = lcg(7); let s = 0; for (let i = 0; i < 300; i++) s += Z.makeBoard(1, r, st, ids, cl, 4).reduce((x, o) => x + o.mult, 0) / 4; return s / 300; };
  assert(avg(4.5) > avg(1.5));
});
t('jakość: rośnie z umiejętnościami i pracowitością, spada z trudnością, alkoholem i złym nastrojem', () => {
  const o = { job: 'polka' }, hard = { job: 'gniazdko' }, st = worker('staszek'), k = worker('kacper');
  assert(Z.quality(st, 'trzezwy', o) > Z.quality(k, 'trzezwy', o) && Z.quality(st, 'trzezwy', o) > Z.quality(st, 'trzezwy', hard));
  assert(Z.quality(st, 'pijany', o) < Z.quality(st, 'trzezwy', o) && Z.quality(Object.assign({}, st, { mood: 10 }), 'trzezwy', o) < Z.quality(st, 'trzezwy', o));
  for (const w of E.CANDIDATES.map(c => E.newWorker(c))) for (const j of Object.keys(JOBS)) { const q = Z.quality(w, 'trzezwy', { job: j }); assert(q >= 0.03 && q <= 0.95); }
});
t('symulacja: mistrz robi lepiej, ale dłużej niż praktykant (solidność kosztuje czas), czas obejmuje dojazd, termin zakończenia liczony od startu', () => {
  const o = { job: 'malowanie', client: 'mirek', mult: 1, district: 'osiedle' }, run = id => { const r = lcg(11); let st = 0, mi = 0, ix = 0; for (let i = 0; i < 300; i++) { const s = Z.simulate(worker(id), 'trzezwy', o, r, deps, { payMult: 1, from: 'baza', clock: 1000 }); st += s.r.stars; mi += s.minutes; ix += s.r.index; } return { st: st / 300, mi: mi / 300, ix: ix / 300 }; };
  const m = run('staszek'), k = run('kacper'); assert(m.ix < k.ix && m.st > k.st && m.mi > k.mi, 'solidna robota trwa dłużej: ' + JSON.stringify([m, k]));
  const s = Z.simulate(worker('zdzisiek'), 'trzezwy', o, lcg(3), deps, { payMult: 1, from: 'baza', clock: 1000 }); assert.strictEqual(s.travelMin, 8); assert.strictEqual(s.endAt, 1000 + s.minutes); assert(s.minutes > s.travelMin && s.fuel === Math.round(8 * Z.FUEL_PER_MIN));
});
t('podgląd: etykieta jakości zgodna z szansą i dojazd z dzielnicy startowej', () => {
  const p = Z.preview(worker('staszek'), 'trzezwy', { job: 'kran', district: 'wies' }, { from: 'osiedle' }); assert.strictEqual(p.label, 'solidnie'); assert.strictEqual(p.travelMin, 30);
  assert.strictEqual(Z.preview(worker('kacper'), 'pijany', { job: 'gniazdko', district: 'osiedle' }, {}).label, 'fuszerka');
});
t('uprawnienia do robót: praktykant nie dostanie gniazdka ani płytek, mistrz wszystko', () => {
  const k = worker('kacper'), z = worker('zbyszek'), d = worker('zdzisiek'), st = worker('staszek');
  assert(Z.canDo(k, 'kran') && !Z.canDo(k, 'gniazdko') && !Z.canDo(k, 'plytki') && Z.canDo(z, 'plytki') && !Z.canDo(z, 'gniazdko') && Z.canDo(d, 'gniazdko'));
  for (const id of Object.keys(JOBS)) assert(Z.canDo(st, id), id);
});
console.log('\n' + n + ' testów przeszło');
