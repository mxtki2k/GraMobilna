/* Czas: prawdziwy kalendarz i zegar gry, pory dnia, zlecenia dzienne i nocne.
 * Zegar liczy minuty od startu gry (1 marca 2027). Jedna jednostka czasu naprawy w danych (jobs.js) to 5 minut.
 * Noc (22:00–06:00) zmienia reguły: dopłata nocna, gorsza widoczność, zaspany klient, więcej wypadków i kontroli policji,
 * więcej picia, częstsze nieobecności i zmęczenie ekipy, dłuższa robota. Czysta logika, działa w przeglądarce i w node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Czas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const START = Date.UTC(2027, 2, 1, 0, 0); // 1 marca 2027, poniedziałek
  const START_HOUR = 8;
  const TIME_SCALE = 5; // minut gry na jednostkę czasu naprawy
  const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_NOM = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const WD_SHORT = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
  const pad = n => (n < 10 ? '0' : '') + n;

  const startClock = () => START_HOUR * 60;
  function dateOf(clock) {
    const d = new Date(START + Math.floor(clock) * 60000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), wd: d.getUTCDay(), hour: d.getUTCHours(), min: d.getUTCMinutes(),
      monthKey: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1), dayIndex: Math.floor(clock / 1440) + 1 };
  }
  const hm = clock => { const d = dateOf(clock); return pad(d.hour) + ':' + pad(d.min); };
  const label = clock => { const d = dateOf(clock); return WD_SHORT[d.wd] + ', ' + d.day + ' ' + MONTHS_GEN[d.m] + ' ' + d.y + ', ' + pad(d.hour) + ':' + pad(d.min); };
  const dayLabel = clock => { const d = dateOf(clock); return WEEKDAYS[d.wd] + ', ' + d.day + ' ' + MONTHS_GEN[d.m] + ' ' + d.y; };
  const monthName = key => { const [y, m] = key.split('-').map(Number); return MONTHS_NOM[m - 1] + ' ' + y; };
  function season(clock) {
    const m = dateOf(clock).m;
    return m === 11 || m <= 1 ? 'zima' : m <= 4 ? 'wiosna' : m <= 7 ? 'lato' : 'jesień';
  }
  const isNightHour = h => h >= 22 || h < 6;
  const isNight = clock => isNightHour(dateOf(clock).hour);

  /* Najbliższa chwila o danej godzinie ('HH:MM') nie wcześniejsza niż clock. */
  function nextAt(clock, timeStr) {
    const [h, mi] = timeStr.split(':').map(Number), target = h * 60 + mi;
    let c = Math.floor(clock / 1440) * 1440 + target;
    if (c < clock) c += 1440;
    return c;
  }
  /* Początek zlecenia: najbliższa chwila o godzinie z poziomu, plus opcjonalne dni oczekiwania. */
  function jobStart(clock, timeStr, waitDays) { return nextAt(clock, timeStr) + (waitDays || 0) * 1440; }
  /* Czas trwania w minutach dla jednostek naprawy (noc trwa dłużej: słabe oświetlenie). */
  const minutes = (units, night) => Math.round(Math.max(1, units) * TIME_SCALE * (night ? 1.1 : 1));
  function fmtMin(min) {
    min = Math.round(min); if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), r = min % 60; return r ? h + ' h ' + pad(r) + ' min' : h + ' h';
  }
  const fmtUnits = (units, night) => fmtMin(minutes(units, night));

  /* Reguły nocy. Dzień jest neutralny. */
  const NIGHT = { payMult: 1.25, accPenalty: 0.08, attention: 0.75, accident: 1.8, police: 1.25, drink: 0.15, absent: 0.1, moodHit: 3, hazard: 1.3 };
  const DAY = { payMult: 1, accPenalty: 0, attention: 1, accident: 1, police: 1, drink: 0, absent: 0, moodHit: 0, hazard: 1 };
  const mods = night => (night ? NIGHT : DAY);
  const daysBetween = (a, b) => Math.floor(b / 1440) - Math.floor(a / 1440);

  return { START, START_HOUR, TIME_SCALE, MONTHS_GEN, MONTHS_NOM, WEEKDAYS, startClock, dateOf, hm, label, dayLabel, monthName, season, isNightHour, isNight, nextAt, jobStart, minutes, fmtMin, fmtUnits, NIGHT, DAY, mods, daysBetween };
});
