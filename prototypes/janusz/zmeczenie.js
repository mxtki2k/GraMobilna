/* Zmęczenie właściciela 0–100: rośnie z czasem pracy (noc mocniej), maleje na odpoczynku i we śnie.
 * Wypoczęty pracuje celniej, zmęczony popełnia błędy, a ledwo żywy zasypia przy robocie. Czysta logika. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Zmeczenie = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PER_HOUR_WORK = 6, NIGHT_MULT = 1.6, REST_PER_HOUR = 4, SLEEP_NIGHT = 12, SLEEP_DAY = 7;
  const gain = (f, minutes, night) => clamp(Math.round((f + minutes / 60 * PER_HOUR_WORK * (night ? NIGHT_MULT : 1)) * 10) / 10, 0, 100);
  /* Odpoczynek: czekanie na telefon (lekki) albo sen (w nocy skuteczniejszy niż w dzień). */
  const rest = (f, minutes, sleep, night) => clamp(Math.round((f - minutes / 60 * (sleep ? (night ? SLEEP_NIGHT : SLEEP_DAY) : REST_PER_HOUR)) * 10) / 10, 0, 100);
  /* Poprawka celności: wypoczęty +0,03, od 40 w dół aż do −0,3 przy 100. */
  const accMod = f => f < 20 ? 0.03 : f <= 40 ? 0 : -Math.round((f - 40) / 60 * 0.3 * 1000) / 1000;
  /* Zmęczony pracuje wolniej: od 50% do +30% czasu przy 100%. */
  const timeMult = f => 1 + Math.round(Math.max(0, f - 50) / 50 * 0.3 * 1000) / 1000;
  /* Szansa na zaśnięcie przy robocie (na krok): od 70, do 35% przy 100. */
  const nodChance = f => f < 70 ? 0 : Math.round((f - 70) / 30 * 0.35 * 1000) / 1000;
  const label = f => f < 20 ? 'wypoczęty' : f < 40 ? 'w porządku' : f < 60 ? 'zmęczony' : f < 80 ? 'wykończony' : 'ledwo żyjesz';
  return { gain, rest, accMod, timeMult, nodChance, label };
});
