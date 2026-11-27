/* Samouczek: kolejność kroków, postęp, pomijanie i podpowiedź „co dalej” (czysta logika, bez DOM). */
const assert = require('assert');
const S = require('../prototypes/janusz/samouczek.js');
const mem = {}, store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok', name); };

t('kroki: unikalne id, selektor, tekst do ~140 znaków', () => {
  const ids = S.STEPS.map(s => s.id); assert.strictEqual(new Set(ids).size, ids.length);
  for (const s of S.STEPS) { assert(s.sel && s.ctx && s.text, s.id); assert(s.text.length <= 140, s.id + ' za długi (' + s.text.length + ')'); }
});
t('przebieg: start, umowa, dojazd, krok, wynik, potem wycieczka po menu', () => {
  const T = S.create(store), g0 = { done: 0 };
  assert.strictEqual(T.next('menu', g0).id, 'start'); assert.strictEqual(T.next('menu', { done: 1 }).id, 'staty', 'po pierwszym zleceniu zaczyna się wycieczka po menu');
  T.done('start'); assert.strictEqual(T.next('menu', g0), null, 'przed pierwszym zleceniem nic więcej w menu');
  assert.strictEqual(T.next('umowa', g0).id, 'umowa'); assert.strictEqual(T.next('transport', g0).id, 'dojazd'); assert.strictEqual(T.next('job', g0).id, 'krok'); assert.strictEqual(T.next('timing', g0).id, 'znacznik');
  assert.strictEqual(T.next('result', g0).id, 'wynik'); T.done('wynik'); assert.strictEqual(T.next('result', g0).id, 'dalej'); T.done('dalej'); assert.strictEqual(T.next('result', g0), null);
  const order = []; for (let i = 0; i < 6; i++) { const s = T.next('menu', { done: 1 }); if (!s) break; order.push(s.id); T.done(s.id); }
  assert.deepStrictEqual(order, ['staty', 'zakladki', 'kafelki', 'sekcje']);
});
t('postęp zapisuje się w osobnym kluczu i wraca po restarcie', () => {
  const T2 = S.create(store); assert(T2.state().done.start && T2.state().done.sekcje); assert(JSON.parse(mem.zlecenia_tut).done.wynik);
});
t('pominięcie wyłącza samouczek, reset go przywraca', () => {
  const T = S.create(store); T.skip(); assert.strictEqual(T.next('umowa', { done: 0 }), null); assert.strictEqual(S.create(store).enabled(), false);
  T.reset(); assert.strictEqual(T.next('menu', { done: 0 }).id, 'start'); assert(S.create(store).enabled());
});
t('wycieczka (❓) ma cztery kroki w kolejności', () => { assert.deepStrictEqual(S.TOUR.map(s => s.id), ['staty', 'zakladki', 'kafelki', 'sekcje']); });
t('podpowiedź co dalej zależy od stanu gry', () => {
  assert(/kafelka/.test(S.tip({ done: 0 }).text)); assert.strictEqual(S.tip({ done: 3, claims: 1 }).action, null);
  assert.strictEqual(S.tip({ done: 3, fatigue: 80 }).action, 'wait'); assert.strictEqual(S.tip({ done: 3, fatigue: 10, crew: 0, money: 700 }).action, 'goCrew');
  assert.strictEqual(S.tip({ done: 3, fatigue: 10, crew: 1, money: 500, toolsWeak: true }).action, 'goAlle'); assert.strictEqual(S.tip({ done: 15, crew: 1, money: 100, contractReady: true }).action, 'contracts');
  assert.strictEqual(S.tip({ done: 5, crew: 1, money: 3500, hqTier: 0 }).action, 'goHq'); assert(S.tip({ done: 5, crew: 1, money: 10 }).text.length > 5);
  for (const g of [{ done: 0 }, { done: 3, claims: 2 }, { done: 3, fatigue: 90 }, { done: 9, money: 1e6 }]) assert(S.tip(g).text.length <= 80, 'krótka podpowiedź');
});
console.log('samouczek: ' + n + ' OK');
