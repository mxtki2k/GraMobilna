/* Wypalenie 0–100: wolno narasta, gdy pracujesz zmęczony (zwłaszcza nocami), i nie znika we śnie. Leczy je dzień wolny i urlop.
 * Wypalony robi gorzej, wolniej i czasem nie odbiera telefonu. Urlop kosztuje: pieniądze, zaufanie klientów i pozycję wobec rywala. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wypalenie = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const VACATION = { days: 4, cost: 200, rivalGain: 3, trustDecay: 0.5, crewMood: 10 }, DAY_OFF = { hours: 24, relief: 25 };
  /* Po zleceniu: każda robota +1,5, zmęczenie ≥70% dodatkowo +3, ≥50% +1,5, praca nocą +1, wypoczęty (<30%) −1. */
  function afterJob(b, fatigue, night) {
    const d = 1.5 + (fatigue >= 70 ? 3 : fatigue >= 50 ? 1.5 : fatigue < 30 ? -1 : 0) + (night ? 1 : 0);
    return clamp(Math.round((b + d) * 10) / 10, 0, 100);
  }
  const dayOff = b => clamp(b - DAY_OFF.relief, 0, 100);
  const vacation = () => 0;
  /* Od 40: celność w dół do −10 pkt przy 100, czas do +20%. */
  const accMod = b => b <= 40 ? 0 : -Math.round((b - 40) / 60 * 0.1 * 1000) / 1000;
  const timeMult = b => 1 + (b <= 40 ? 0 : Math.round((b - 40) / 60 * 0.2 * 1000) / 1000);
  /* Od 80: do 15% szans, że w tej godzinie nie odbierzesz telefonu. */
  const missCall = b => b < 80 ? 0 : Math.round((b - 80) / 20 * 0.15 * 1000) / 1000;
  const label = b => b < 20 ? 'chce się pracować' : b < 40 ? 'w porządku' : b < 60 ? 'ma dość' : b < 80 ? 'wypalony' : 'wszystko wkurza';
  return { VACATION, DAY_OFF, afterJob, dayOff, vacation, accMod, timeMult, missCall, label };
});
