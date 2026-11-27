// Testy sklepu z ubraniami (faza E). Uruchomienie: node tests/ubrania.test.js
const assert = require('assert');
const U = require('../prototypes/janusz/ubrania.js'), Pix = require('../prototypes/janusz/pixel.js');
const { JOBS, CLIENTS } = require('../prototypes/janusz/jobs.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  -', name); };
const lcg = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const it = (id, extra) => Object.assign({ uid: 9, id, cond: 100, dirty: false, smell: false }, extra || {});

t('dane: pięć ubrań szefa i cztery zestawy ekipy, ceny i wiarygodność rosną razem, każdy klient i robota mają gust/brudność', () => {
  const ids = ['wlasne', 'dres', 'robocze', 'koszula', 'garnitur', 'lux']; assert.deepStrictEqual(Object.keys(U.OUTFITS), ids);
  const priced = ids.slice(1).map(i => U.OUTFITS[i]); for (let i = 1; i < priced.length; i++) assert(priced[i].price > priced[i - 1].price, 'ceny');
  assert(U.OUTFITS.lux.cred > U.OUTFITS.garnitur.cred && U.OUTFITS.garnitur.cred > U.OUTFITS.koszula.cred && U.OUTFITS.koszula.cred > U.OUTFITS.robocze.cred && U.OUTFITS.robocze.cred > U.OUTFITS.dres.cred);
  for (const id of Object.keys(CLIENTS)) assert(U.TASTE[id], 'gust ' + id); for (const id of Object.keys(JOBS)) assert(U.messy(id) > 0 && U.messy(id) <= 1, id);
  assert.strictEqual(Object.keys(U.UNIFORMS).length, 4);
});
t('ikony: każde ubranie i zestaw ma sprite 16x16 w pixel.js', () => {
  for (const o of Object.values(U.OUTFITS).concat(Object.values(U.UNIFORMS))) { assert(Pix.ICONS[o.icon], 'brak ikony ' + o.icon); const g = Pix.get ? null : null; }
  assert(Pix.ICONS.szafa);
});
t('wrażenie: zależy od gustu klienta, Karyna kocha garnitur, Heniek ceni robocze, Mirek nie reaguje na styl', () => {
  assert(U.impression(it('garnitur'), 'karyna') > U.impression(it('robocze'), 'karyna') && U.impression(it('garnitur'), 'karyna') > 0.4);
  assert(U.impression(it('robocze'), 'heniek') > U.impression(it('garnitur'), 'heniek') && U.impression(it('robocze'), 'heniek') > 0.3);
  assert(Math.abs(U.impression(it('garnitur'), 'mirek')) < 0.35 && Math.abs(U.impression(it('lux'), 'mirek') - U.impression(it('dres'), 'mirek')) < 0.3);
  assert(U.impression(it('garnitur'), 'tesciowa') < U.impression(it('garnitur'), 'karyna'));
});
t('kontekst: przetarg (formalny) nagradza garnitur i karze robocze; brudna robota karze garnitur', () => {
  const f = { formal: true }; assert(U.impression(it('garnitur'), 'mirek', f) > U.impression(it('robocze'), 'mirek', f) && U.effect(it('garnitur'), 'mirek', f).tender > U.effect(it('robocze'), 'mirek', f).tender);
  assert(U.effect(it('garnitur'), 'mirek', {}).tender === 0);
  assert(U.impression(it('garnitur'), 'grazyna', { job: 'malowanie' }) < U.impression(it('garnitur'), 'grazyna', { job: 'drzwi' }));
});
t('stan: brud i zużycie obniżają wiarygodność i wrażenie, śmierdzący używany ubiór traci 0,15', () => {
  const ok = U.effect(it('garnitur'), 'karyna', {}), dirty = U.effect(it('garnitur', { dirty: true }), 'karyna', {}), worn = U.effect(it('garnitur', { cond: 20 }), 'karyna', {}), smelly = U.effect(it('garnitur', { smell: true }), 'karyna', {});
  assert(ok.cred > dirty.cred && ok.cred > worn.cred && ok.imp > dirty.imp && ok.imp > worn.imp && Math.abs(ok.cred - smelly.cred - 0.15) < 0.011);
  assert(ok.detect < U.effect(it('wlasne'), 'karyna', {}).detect && ok.attention < 1 && U.effect(it('lux'), 'karyna', {}).detect < ok.detect);
  assert(Math.abs(ok.satBonus) <= 12 && ok.pay > 1 && U.effect(it('garnitur'), 'heniek', {}).pay < 1 && U.effect(it('robocze'), 'heniek', {}).pay > 1.02);
});
t('zużycie po zleceniu: brudna robota brudzi i zużywa garnitur szybciej, własne ubranie się nie zużywa, zniszczenie wraca do dżinsów', () => {
  let w = U.fresh(); const b = U.buy(w, 'garnitur', 9999, 1); w = U.wear(b.w, b.item.uid); const r = lcg(2);
  const paint = U.afterJob(w, 'malowanie', () => 0), door = U.afterJob(w, 'drzwi', () => 0.99);
  assert(U.current(paint.w).cond < U.current(door.w).cond && U.current(paint.w).dirty && !U.current(door.w).dirty && paint.notes.length === 1);
  assert.strictEqual(U.afterJob(U.fresh(), 'malowanie', r).w.owned[0].cond, 100);
  let x = U.wear(Object.assign({}, b.w, { owned: b.w.owned.map(o => o.uid === b.item.uid ? Object.assign({}, o, { cond: 1 }) : o) }), b.item.uid); const dead = U.afterJob(x, 'plytki', () => 0.5);
  assert(dead.w.worn === 1 && dead.w.owned.length === 1 && /wyrzucenia/.test(dead.notes.join(' ')));
});
t('pranie, zakup, sprzedaż i wyprzedaże', () => {
  let w = U.fresh(); assert(!U.buy(w, 'lux', 100, 1).ok && !U.buy(w, 'wlasne', 999, 1).ok && !U.buy(w, 'x', 999, 1).ok);
  const b = U.buy(w, 'garnitur', 1000, 0.75); assert(b.ok && b.cost === 525 && b.w.owned.length === 2 && b.w.nextUid === 3 && w.owned.length === 1);
  const dw = { ...b.w, owned: b.w.owned.map(o => o.uid === b.item.uid ? { ...o, dirty: true } : o) }; assert(!U.wash(b.w, b.item.uid, 100).ok && !U.wash(dw, b.item.uid, 5).ok);
  const wsh = U.wash(dw, b.item.uid, 100); assert(wsh.ok && wsh.cost === 15 && !wsh.w.owned[1].dirty);
  const s = U.sell(b.w, b.item.uid); assert(s.ok && s.price === Math.round(700 * 0.3) && s.w.owned.length === 1 && !U.sell(w, 1).ok);
  const used = U.buy(w, 'garnitur', 999, 1, { price: 200, cond: 50, smell: true }); assert(used.item.cond === 50 && used.item.smell && used.cost === 200);
});
t('lumpeks: deterministyczny, tani, część rzeczy śmierdzi', () => {
  const a = U.lumpeks(5), b = U.lumpeks(5); assert.deepStrictEqual(a, b); assert.strictEqual(a.length, 3); a.forEach(l => assert(l.price < U.OUTFITS[l.outfit].price && l.cond >= 30 && l.cond <= 75));
  let sm = 0, tot = 0; for (let d = 0; d < 300; d++) U.lumpeks(d).forEach(l => { tot++; if (l.smell) sm++; }); assert(sm / tot > 0.25 && sm / tot < 0.45); assert.notDeepStrictEqual(U.lumpeks(5), U.lumpeks(6));
});
t('ciuchy firmowe: zakup per pracownik, wiarygodność z logo szyldu i stanu, BHP, nastrój, zużycie', () => {
  const crew = [{ id: 'a' }, { id: 'b' }]; let w = U.fresh();
  assert(!U.bhpOk(w, crew) && U.bhpOk(w, []) && !U.buyUniform(w, 'a', 'kurtka', 10).ok && !U.buyUniform(w, 'a', 'x', 999).ok);
  w = U.buyUniform(w, 'a', 'kombinezon', 999).w; assert(!U.bhpOk(w, crew)); w = U.buyUniform(w, 'b', 'tshirt', 999).w; assert(!U.bhpOk(w, crew), 'koszulka nie jest BHP');
  w = U.buyUniform(w, 'b', 'kurtka', 999).w; assert(U.bhpOk(w, crew));
  assert(U.uniformCred(w, 'a', 3) > U.uniformCred(w, 'a', 0) && U.crewCred(w, crew, 0) > 0 && U.crewCred(w, [], 0) === 0 && U.crewSat(w, 'b', 3) >= U.crewSat(w, 'a', 0));
  assert.strictEqual(U.crewMood(w, crew), 4.5); const worn = U.uniformAfterJob(U.uniformAfterJob(w, 'a', 'malowanie'), 'a', 'malowanie'); assert(worn.crew.a.cond < 100 && U.uniformOf(worn, 'a').cond < U.uniformOf(w, 'a').cond && U.uniformOf(w, 'a').cond === 100);
  let old = w; for (let i = 0; i < 90; i++) old = U.uniformAfterJob(old, 'a', 'plytki'); assert(old.crew.a.cond === 0 && !U.bhpOk(old, crew) && U.crewMood(old, [crew[0]]) === 0);
});
console.log('\n' + n + ' testów przeszło');
