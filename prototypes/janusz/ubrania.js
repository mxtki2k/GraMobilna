/* Ubrania (faza E): ubiór szefa i ciuchy firmowe ekipy. Wiarygodność rośnie z ceną, ale zależy od klienta, kontekstu (przetarg, brudna robota)
 * i stanu ubrania (zużycie, brud). Zestawy ekipy dają wiarygodność firmy, lepszy nastrój i spełniają wymogi BHP. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ubrania = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = x => Math.round(x * 100) / 100;
  /* cred: wiarygodność, style: elegancja, work: „robocze”, dirt: jak łatwo się brudzi i niszczy, dur: ile zleceń wytrzymuje. */
  const OUTFITS = {
    wlasne: { id: 'wlasne', name: 'Stare dżinsy i koszulka', price: 0, cred: 0.15, style: 0.15, work: 0.3, dirt: 0.3, dur: 9999, icon: 'dres' },
    dres: { id: 'dres', name: 'Dres z targowiska', price: 40, cred: 0.10, style: 0.10, work: 0.2, dirt: 0.2, dur: 25, icon: 'dres' },
    robocze: { id: 'robocze', name: 'Ubranie robocze', price: 120, cred: 0.35, style: 0.20, work: 1.0, dirt: 0.1, dur: 60, icon: 'robocze' },
    koszula: { id: 'koszula', name: 'Koszula z kamizelką', price: 260, cred: 0.55, style: 0.60, work: 0.5, dirt: 0.5, dur: 40, icon: 'koszula' },
    garnitur: { id: 'garnitur', name: 'Garnitur', price: 700, cred: 0.80, style: 0.90, work: 0.1, dirt: 0.9, dur: 50, icon: 'garnitur' },
    lux: { id: 'lux', name: '„Janusz Lux” (z zegarkiem)', price: 1800, cred: 0.95, style: 1.0, work: 0.05, dirt: 0.95, dur: 80, icon: 'lux' },
  };
  const UNIFORMS = {
    tshirt: { id: 'tshirt', name: 'Koszulki z logo', price: 30, cred: 0.15, mood: 2, bhp: false, dur: 30, icon: 'tshirt' },
    kombinezon: { id: 'kombinezon', name: 'Kombinezony robocze', price: 90, cred: 0.30, mood: 4, bhp: true, dur: 60, icon: 'kombinezon' },
    kurtka: { id: 'kurtka', name: 'Kurtki firmowe', price: 150, cred: 0.40, mood: 5, bhp: true, dur: 80, icon: 'kurtka' },
    garniturf: { id: 'garniturf', name: 'Garnitury firmowe', price: 260, cred: 0.55, mood: 3, bhp: false, dur: 50, icon: 'garnitur' },
  };
  /* Gust klientów: style (jak ceni elegancję), work (jak ceni robocze ubranie), notice (jak widzi plamy). */
  const TASTE = { mirek: { style: 0.05, work: 0.3, notice: 0.3, critic: false }, karyna: { style: 1.0, work: 0.0, notice: 0.7, critic: false }, sebix: { style: 0.8, work: 0.1, notice: 0.4, critic: false },
    grazyna: { style: 0.5, work: 0.4, notice: 1.0, critic: false }, tesciowa: { style: 0.6, work: 0.3, notice: 0.8, critic: true }, heniek: { style: 0.0, work: 1.0, notice: 0.5, critic: false } };
  const MESSY = { malowanie: 1, plytki: 1, sciana: 0.8, syfon: 0.7, grzejnik: 0.5, prysznic: 0.5, kran: 0.4, drzwi: 0.3, polka: 0.3, okno: 0.3, gniazdko: 0.2 };
  const messy = jobId => MESSY[jobId] != null ? MESSY[jobId] : 0.3;
  const fresh = () => ({ owned: [{ uid: 1, id: 'wlasne', cond: 100, dirty: false, smell: false }], worn: 1, nextUid: 2, crew: {} });
  const current = w => w.owned.find(x => x.uid === w.worn) || w.owned[0];

  /* Wrażenie na kkliencie −1…1. ctx: { formal, job }. item: element szafy. */
  function impression(item, clientId, ctx) {
    ctx = ctx || {}; const o = OUTFITS[item.id], t = TASTE[clientId] || TASTE.mirek, q = (0.5 + 0.5 * item.cond / 100) * (item.dirty ? 0.7 : 1);
    let imp = t.style * (o.style * q - 0.3) + t.work * (o.work - 0.3) * (item.dirty ? 0.6 : 1);
    if (ctx.formal) imp += (o.style * q - 0.4) * 0.8 - o.work * 0.2;
    if (item.dirty) imp -= 0.15 * t.notice;
    if (ctx.job && messy(ctx.job) >= 0.5 && o.dirt > 0.6) imp -= 0.15 * t.notice;
    if (t.critic) imp -= 0.1;
    return r1(clamp(imp, -1, 1));
  }
  /* Efekty ubioru: wiarygodność (z kondycją i brudem), premia satysfakcji, mnożnik wykrywania zawyżonej wyceny i uwagi klienta, bonus przetargowy. */
  function effect(item, clientId, ctx) {
    ctx = ctx || {}; const o = OUTFITS[item.id], imp = impression(item, clientId, ctx);
    const cred = clamp(o.cred * (0.5 + 0.5 * item.cond / 100) * (item.dirty ? 0.6 : 1) - (item.smell ? 0.15 : 0), 0, 1);
    return { imp, cred: r1(cred), satBonus: Math.round(imp * 12), pay: r1(1 + 0.08 * imp), detect: r1(1.1 - 0.5 * cred), attention: r1(1 - 0.2 * cred), tender: ctx.formal ? r1(clamp((o.style - 0.3) * 0.25 * (0.5 + 0.5 * item.cond / 100) * (item.dirty ? 0.6 : 1), -0.1, 0.15)) : 0 };
  }
  /* Po zleceniu: zużycie, możliwe ubrudzenie, zniszczenie. Zwraca nową szafę i notatki. */
  function afterJob(w, jobId, rng) {
    const it = current(w), o = OUTFITS[it.id], notes = []; if (!it || it.id === 'wlasne') return { w, notes };
    const m = messy(jobId), wear = 100 / o.dur * (1 + m * o.dirt * 1.5), dirty = it.dirty || rng() < m * o.dirt * 0.8;
    let cond = Math.max(0, it.cond - wear), owned = w.owned.map(x => x.uid === it.uid ? Object.assign({}, x, { cond: Math.round(cond * 10) / 10, dirty }) : x), worn = w.worn;
    if (dirty && !it.dirty) notes.push('👔 ' + o.name + ' się ubrudził(o). Pranie kosztuje ' + WASH + ' zł.');
    if (cond <= 0) { owned = owned.filter(x => x.uid !== it.uid); worn = 1; notes.push('👔 ' + o.name + ' nadaje(ą) się do wyrzucenia. Wracasz do starych dżinsów.'); }
    return { w: Object.assign({}, w, { owned, worn }), notes };
  }
  const WASH = 15;
  function wash(w, uid, money) { const it = w.owned.find(x => x.uid === uid); if (!it || !it.dirty) return { ok: false, reason: 'Nie trzeba prać.' }; if (money < WASH) return { ok: false, reason: 'Brakuje ' + WASH + ' zł.' };
    return { ok: true, cost: WASH, w: Object.assign({}, w, { owned: w.owned.map(x => x.uid === uid ? Object.assign({}, x, { dirty: false, cond: Math.max(0, x.cond - 1) }) : x) }) }; }
  function wear(w, uid) { return w.owned.some(x => x.uid === uid) ? Object.assign({}, w, { worn: uid }) : w; }
  /* Zakup nowego (priceMult: wyprzedaże) albo używanego z lumpeksu (cond, smell). */
  function buy(w, id, money, priceMult, extra) {
    const o = OUTFITS[id]; if (!o || id === 'wlasne') return { ok: false, reason: 'Nie ma takiego ubrania.' };
    const cost = extra && extra.price != null ? extra.price : Math.round(o.price * (priceMult || 1)); if (money < cost) return { ok: false, reason: 'Brakuje ' + (cost - money) + ' zł.' };
    const item = { uid: w.nextUid, id, cond: extra && extra.cond != null ? extra.cond : 100, dirty: false, smell: !!(extra && extra.smell) };
    return { ok: true, cost, item, w: Object.assign({}, w, { owned: w.owned.concat([item]), nextUid: w.nextUid + 1 }) };
  }
  function sell(w, uid) { const it = w.owned.find(x => x.uid === uid); if (!it || it.id === 'wlasne') return { ok: false, reason: 'Tego nie sprzedasz.' }; const price = Math.round(OUTFITS[it.id].price * 0.3 * it.cond / 100);
    return { ok: true, price, w: Object.assign({}, w, { owned: w.owned.filter(x => x.uid !== uid), worn: w.worn === uid ? 1 : w.worn }) }; }
  /* Lumpeks: trzy używane rzeczy dziennie (deterministycznie), tanie, czasem śmierdzą (ukryte do założenia). */
  function lumpeks(day) {
    let s = (day * 2654435761) >>> 0; const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296, ids = ['dres', 'robocze', 'koszula', 'garnitur', 'lux'];
    return [0, 1, 2].map(i => { const id = ids[Math.floor(rng() * ids.length)], cond = Math.round(30 + rng() * 45), smell = rng() < 0.35; return { id: day * 10 + i, outfit: id, cond, smell, price: Math.round(OUTFITS[id].price * (0.25 + 0.4 * cond / 100)) }; });
  }
  // ---- ciuchy firmowe ----
  const logoMult = sign => 0.8 + 0.1 * clamp(sign || 0, 0, 3);
  function buyUniform(w, workerId, id, money) {
    const u = UNIFORMS[id]; if (!u) return { ok: false, reason: 'Nie ma takiego zestawu.' }; if (money < u.price) return { ok: false, reason: 'Brakuje ' + (u.price - money) + ' zł.' };
    return { ok: true, cost: u.price, w: Object.assign({}, w, { crew: Object.assign({}, w.crew, { [workerId]: { id, cond: 100 } }) }) };
  }
  const uniformOf = (w, workerId) => w.crew[workerId] ? Object.assign({}, UNIFORMS[w.crew[workerId].id], { cond: w.crew[workerId].cond }) : null;
  const uniformCred = (w, workerId, sign) => { const u = uniformOf(w, workerId); return u ? r1(u.cred * logoMult(sign) * (0.5 + 0.5 * u.cond / 100)) : 0; };
  /* Premia satysfakcji, gdy pomocnik w mundurze jedzie ze zleceniem (0…5 pkt). */
  const crewSat = (w, workerId, sign) => Math.round(uniformCred(w, workerId, sign) * 6);
  /* Średnia wiarygodność firmy z ubrania ekipy (0…1). */
  function crewCred(w, crew, sign) { return crew.length ? r1(crew.reduce((s, x) => s + uniformCred(w, x.id, sign), 0) / crew.length) : 0; }
  /* Wymóg BHP (przetargi): każdy pracownik w zestawie z BHP w przyzwoitym stanie. */
  const bhpOk = (w, crew) => crew.every(x => { const u = uniformOf(w, x.id); return u && u.bhp && u.cond > 20; });
  const crewMood = (w, crew) => crew.length ? r1(crew.reduce((s, x) => { const u = uniformOf(w, x.id); return s + (u && u.cond > 30 ? u.mood : 0); }, 0) / crew.length) : 0;
  /* Zużycie zestawu po zleceniu pracownika. */
  function uniformAfterJob(w, workerId, jobId) { const u = w.crew[workerId]; if (!u) return w; const d = 100 / UNIFORMS[u.id].dur * (1 + messy(jobId) * 0.8);
    return Object.assign({}, w, { crew: Object.assign({}, w.crew, { [workerId]: Object.assign({}, u, { cond: Math.max(0, Math.round((u.cond - d) * 10) / 10) }) }) }); }
  return { OUTFITS, UNIFORMS, TASTE, MESSY, WASH, messy, fresh, current, impression, effect, afterJob, wash, wear, buy, sell, lumpeks, buyUniform, uniformOf, uniformCred, crewSat, crewCred, bhpOk, crewMood, uniformAfterJob, logoMult };
});
