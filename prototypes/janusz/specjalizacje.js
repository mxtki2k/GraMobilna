/* Specjalizacje: cztery obszary (hydraulika, elektryka, wykończenia, stolarka). Poziom rośnie z doświadczenia (gwiazdki za zlecenia),
 * ale bez kursu z danego obszaru poziom kończy się na 1. Poziomy dają celność, tempo, mniejsze zagrożenie i lepszą wypłatę. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Spec = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GEN = (typeof RobotyGen !== 'undefined' ? RobotyGen : (() => { try { return require('./roboty_gen.js'); } catch (e) { return null; } })()) || { META: {} };
  const AREAS = {
    hydraulika: { name: 'Hydraulika', jobs: ['kran', 'syfon', 'grzejnik'], cert: 'hydr' },
    elektryka: { name: 'Elektryka', jobs: ['gniazdko'], cert: 'sep' },
    wykonczenia: { name: 'Wykończenia', jobs: ['sciana', 'malowanie', 'plytki'], cert: 'wyk' },
    stolarka: { name: 'Stolarka i montaż', jobs: ['drzwi', 'okno', 'polka'], cert: 'stol' },
  };
  for (const [id, m] of Object.entries(GEN.META)) { const a = Object.values(AREAS).find(x => x.cert === m.kurs) || AREAS.hydraulika; if (a.jobs.indexOf(id) < 0) a.jobs.push(id); }
  const XP = [0, 15, 45, 100]; // próg doświadczenia dla poziomów 0–3
  const CAP_NO_CERT = 1;
  const areaOf = jobId => Object.keys(AREAS).find(k => AREAS[k].jobs.indexOf(jobId) >= 0) || null;
  const fresh = () => ({ hydraulika: 0, elektryka: 0, wykonczenia: 0, stolarka: 0 });
  /* Poziom z doświadczenia i uprawnień: certs = obiekt z szkolenia.js (np. { hydr: true }). */
  function level(xp, area, certs) {
    let lv = 0; for (let i = 0; i < XP.length; i++) if (xp >= XP[i]) lv = i;
    const cap = certs && certs[AREAS[area].cert] ? 3 : CAP_NO_CERT; return Math.min(lv, cap);
  }
  /* Doświadczenie za zlecenie: gwiazdki (1–5), kontrakty i przetargi dają +50%. */
  const gain = (stars, big) => Math.round((stars || 1) * (big ? 1.5 : 1) * 10) / 10;
  function addXp(state, jobId, stars, big) { const a = areaOf(jobId); if (!a) return state; return Object.assign({}, state, { [a]: Math.round(((state[a] || 0) + gain(stars, big)) * 10) / 10 }); }
  /* Premie dla roboty: poziom 0–3. */
  function mods(state, certs, jobId) {
    const a = areaOf(jobId), lv = a ? level(state[a] || 0, a, certs) : 0;
    return { area: a, level: lv, acc: 0.02 * lv, time: 0.015 * lv, hazard: Math.round((1 - 0.05 * lv) * 100) / 100, pay: 1 + 0.02 * lv };
  }
  /* Ile brakuje do następnego poziomu (null, gdy max albo zablokowane brakiem kursu). */
  function next(state, certs, area) {
    const xp = state[area] || 0, lv = level(xp, area, certs), lock = lv >= CAP_NO_CERT && !(certs && certs[AREAS[area].cert]) && xp >= XP[Math.min(lv + 1, 3)];
    if (lv >= 3) return { level: lv, need: null, locked: false };
    return { level: lv, need: Math.max(0, XP[lv + 1] - xp), locked: lock || (lv >= CAP_NO_CERT && !(certs && certs[AREAS[area].cert])) };
  }
  return { AREAS, XP, areaOf, fresh, level, gain, addXp, mods, next };
});
