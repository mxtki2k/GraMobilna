/* Ludki na scenach: każdy poziom (także z generatora) dostaje Janusza, klienta i pomocnika, w każdym nastroju i stroju. */
const assert = require('assert');
const S = require('../prototypes/janusz/scenes.js'), Jobs = require('../prototypes/janusz/jobs.js'), Ubrania = require('../prototypes/janusz/ubrania.js');
const ids = Object.keys(Jobs.JOBS); assert(ids.length >= 10, 'są zlecenia');
let n = 0;
for (const id of ids) {
  assert(S.JOB_SCENES[id], 'scena dla ' + id);
  const steps = Jobs.JOBS[id].steps.length;
  for (let step = 0; step < steps; step++) {
    const ac = S.actionFor(id, step), base = S.job(id, new Set(['broken']), 0, {});
    for (const mood of ['meh', 'happy', 'worry', 'angry']) for (const working of [false, true]) {
      const g = S.people(working ? S.action(base, ac.kind, 0.4, ac.at) : base, { at: ac.at, frame: step + n, working, outfit: 'robocze', client: Object.keys(Jobs.CLIENTS)[step % 4], mood, helper: step % 2 === 0 });
      assert.strictEqual(g.length, 80); assert.strictEqual(g[0].length, 128);
      assert(g.flat().join('') !== base.flat().join(''), 'ludki widoczni: ' + id); n++;
    }
  }
}
for (const o of Object.keys(Ubrania.OUTFITS)) assert(S.LOOK[o], 'wygląd dla stroju ' + o);   // każdy strój z szafy ma wygląd na scenie
const a = S.people(S.job('kran', new Set(), 0, {}), { at: [11, 44], frame: 2, outfit: 'garnitur', client: 'karyna', mood: 'happy' }), b = S.people(S.job('kran', new Set(), 0, {}), { at: [11, 44], frame: 2, outfit: 'garnitur', client: 'karyna', mood: 'happy' });
assert.deepStrictEqual(a, b, 'deterministycznie'); // bez losowości: ten sam stan, ten sam obraz
const f0 = S.people(S.job('kran', new Set(), 0, {}), { at: [65, 29], frame: 0 }), f2 = S.people(S.job('kran', new Set(), 0, {}), { at: [65, 29], frame: 2 });
assert(f0.flat().join('') !== f2.flat().join(''), 'postać oddycha między klatkami');
console.log('ludki OK (' + n + ' kombinacji, ' + ids.length + ' zleceń)');
