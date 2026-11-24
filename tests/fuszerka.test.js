// Testy modułu oceny fuszerki i danych zleceń. Uruchomienie: node tests/fuszerka.test.js
const assert = require('assert');
const F = require('../prototypes/janusz/fuszerka.js');
const { JOBS, CLIENTS, LEVELS } = require('../prototypes/janusz/jobs.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const picks = (job, optionId, acc = 1) => job.steps.map(s => ({ stepId: s.id, optionId, accuracy: acc }));
const seq = (rolls) => { let i = 0; return () => rolls[i++ % rolls.length]; };

t('dane: każde zlecenie ma kroki z opcjami i poprawne wady', () => {
  for (const job of Object.values(JOBS)) {
    assert(job.steps.length >= 3, job.id);
    for (const s of job.steps) {
      assert(s.options.length === 3, job.id + '/' + s.id);
      const ids = s.options.map(o => o.id);
      assert.deepStrictEqual(ids, ['dobrze', 'skrot', 'fusz'], job.id + '/' + s.id);
      for (const o of s.options) {
        assert(typeof o.fx === 'string' && o.label, job.id + '/' + s.id + '/' + o.id);
        for (const d of o.defects || []) {
          assert(d.sev >= 0 && d.sev <= 10 && d.vis >= 0 && d.vis <= 1 && (d.hazard || 0) >= 0 && (d.hazard || 0) <= 1, d.label);
        }
      }
    }
  }
  for (const l of LEVELS) assert(JOBS[l.job] && CLIENTS[l.client], JSON.stringify(l));
});

t('same dobre decyzje i celność 100% dają indeks 0 i 5 gwiazdek', () => {
  for (const job of Object.values(JOBS)) {
    const r = F.evaluate(job, picks(job, 'dobrze', 1), CLIENTS.grazyna);
    assert.strictEqual(r.index, 0, job.id);
    assert.strictEqual(r.level.key, 'solid');
    assert.strictEqual(r.stars, 5, job.id);
  }
});

t('same fuszerki: wysoki indeks, niska ocena', () => {
  for (const job of Object.values(JOBS)) {
    const r = F.evaluate(job, picks(job, 'fusz'), CLIENTS.grazyna);
    assert(r.index >= 40, job.id + ' indeks ' + r.index);
    // albo klient to widzi od razu, albo wada wraca jako reklamacja (maskowanie szafą)
    assert(r.stars <= 3 || r.claim.chance >= 0.6, job.id + ' gwiazdki ' + r.stars + ' reklamacja ' + r.claim.chance);
  }
});

t('gniazdko z fuszerką to katastrofa z zagrożeniem', () => {
  const job = JOBS.gniazdko;
  const r = F.evaluate(job, picks(job, 'fusz'), CLIENTS.mirek);
  assert.strictEqual(r.level.key, 'katastrofa');
  assert(r.Z >= 9, 'zagrożenie ' + r.Z);
  assert.strictEqual(r.claim.kind, 'wypadek');
});

t('uwaga klienta: Mirek wybacza więcej niż Grażyna, indeks fuszerki jest ten sam', () => {
  const job = JOBS.sciana, p = picks(job, 'skrot');
  const a = F.evaluate(job, p, CLIENTS.mirek), b = F.evaluate(job, p, CLIENTS.grazyna);
  assert(a.satisfaction > b.satisfaction, a.satisfaction + ' vs ' + b.satisfaction);
  assert.strictEqual(a.index, b.index);
});

t('fachowiec widzi także wady ukryte', () => {
  const job = JOBS.polka, p = picks(job, 'skrot'); // wkręty w tynk: ukryta wada
  const c = { ...CLIENTS.mirek, expert: false, attention: 1, strict: 1 };
  const e = { ...c, expert: true };
  assert(F.evaluate(job, p, e).satisfaction < F.evaluate(job, p, c).satisfaction);
});

t('maskowanie: szafa ukrywa dziurę, ale zostaje jako wada ukryta', () => {
  const job = JOBS.sciana;
  const honest = job.steps.map((s, i) => ({ stepId: s.id, optionId: i < 3 ? 'fusz' : 'skrot', accuracy: 0.6 }));
  const masked = job.steps.map((s, i) => ({ stepId: s.id, optionId: 'fusz', accuracy: 0.6 }));
  const a = F.evaluate(job, honest, CLIENTS.grazyna), b = F.evaluate(job, masked, CLIENTS.grazyna);
  assert(b.V < a.V, 'widoczne mniej po masce');
  assert(b.H > a.H, 'ukryte więcej po masce');
  assert(b.satisfaction > a.satisfaction, 'klient zadowolony');
  assert(b.claim.chance > a.claim.chance, 'reklamacja bardziej prawdopodobna');
});

t('celność w mini-grze: gorsza celność daje niższy wynik', () => {
  const job = JOBS.kran;
  const good = F.evaluate(job, picks(job, 'dobrze', 1), CLIENTS.karyna);
  const bad = F.evaluate(job, picks(job, 'dobrze', 0.1), CLIENTS.karyna);
  assert(bad.index > good.index && bad.stars < good.stars);
});

t('dodanie wady nigdy nie obniża indeksu (monotoniczność)', () => {
  const job = JOBS.kran;
  let prev = -1;
  for (let k = 0; k <= job.steps.length; k++) {
    const p = job.steps.map((s, i) => ({ stepId: s.id, optionId: i < k ? 'fusz' : 'dobrze', accuracy: 1 }));
    const idx = F.evaluate(job, p, CLIENTS.mirek).index;
    assert(idx >= prev, 'k=' + k + ' ' + idx + ' < ' + prev);
    prev = idx;
  }
});

t('spóźnienie obniża zadowolenie, szybka robota daje premię', () => {
  const job = { ...JOBS.kran, deadline: 5 };
  const slow = F.evaluate(job, picks(job, 'dobrze', 1), CLIENTS.mirek);
  assert(slow.late && slow.satisfaction < 100);
  const fastJob = { ...JOBS.kran, deadline: 1000 };
  const fast = F.evaluate(fastJob, picks(fastJob, 'fusz'), CLIENTS.mirek);
  assert(fast.payout > fastJob.base * (0.4 + 0.6 * fast.satisfaction / 100) - 1);
});

t('opłacalność: fuszerka opłaca się u pobłażliwego klienta, ale nie u wymagającego', () => {
  const job = JOBS.kran, p = picks(job, 'skrot', 0.6);
  const mirek = F.evaluate(job, p, CLIENTS.mirek), tesc = F.evaluate(job, p, CLIENTS.tesciowa);
  assert(mirek.payout > tesc.payout);
});

t('reklamacja: losowanie zgodne z szansą, deterministyczne', () => {
  const job = JOBS.kran, r = F.evaluate(job, picks(job, 'fusz'), CLIENTS.mirek);
  assert(r.claim.chance > 0 && r.claim.chance < 1);
  assert(F.rollClaim(r, seq([0.0])));
  assert.strictEqual(F.rollClaim(r, seq([0.999999])), null);
  const clean = F.evaluate(job, picks(job, 'dobrze', 1), CLIENTS.mirek);
  assert.strictEqual(clean.claim.top, null);
  assert.strictEqual(F.rollClaim(clean, seq([0])), null);
});

t('poziomy fuszerki mają progi 15 / 40 / 70', () => {
  assert.strictEqual(F.levelFor(0).key, 'solid');
  assert.strictEqual(F.levelFor(14).key, 'solid');
  assert.strictEqual(F.levelFor(15).key, 'oko');
  assert.strictEqual(F.levelFor(40).key, 'fuszerka');
  assert.strictEqual(F.levelFor(70).key, 'katastrofa');
  assert.strictEqual(F.levelFor(100).key, 'katastrofa');
});

t('komentarz klienta: zależy od gwiazdek i dopisuje najgorszą widoczną wadę', () => {
  const job = JOBS.polka, r = F.evaluate(job, picks(job, 'fusz'), CLIENTS.karyna);
  const c = F.clientComment(CLIENTS.karyna, r, seq([0]));
  assert(typeof c === 'string' && c.length > 5);
  assert(/Zwłaszcza/.test(c), c);
});

t('zakres wyników: indeks 0..100, zadowolenie 0..100, gwiazdki 1..5', () => {
  for (const job of Object.values(JOBS)) for (const cl of Object.values(CLIENTS)) for (const opt of ['dobrze', 'skrot', 'fusz']) for (const a of [0, 0.5, 1]) {
    const r = F.evaluate(job, picks(job, opt, a), cl);
    assert(r.index >= 0 && r.index <= 100 && r.satisfaction >= 0 && r.satisfaction <= 100 && r.stars >= 1 && r.stars <= 5);
    assert(r.claim.chance >= 0 && r.claim.chance <= 1);
  }
});

console.log('\n' + n + ' testów przeszło');
