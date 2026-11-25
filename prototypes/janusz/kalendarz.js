/* Kalendarz i sezony. 1 zlecenie = 1 dzień, sezon trwa 12 dni. Sezon zmienia popyt na rodzaje robót,
 * dokłada opóźnienia pogodowe i obniża nastrój ekipy w zimnym lokalu (komfort siedziby to łagodzi). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kalendarz = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SEASONS = ['wiosna', 'lato', 'jesień', 'zima'];
  const DAYS_PER_SEASON = 12;
  const DEMAND = {
    kran: { wiosna: 0.95, lato: 1.0, 'jesień': 1.0, zima: 1.25 },
    sciana: { wiosna: 1.2, lato: 1.05, 'jesień': 1.0, zima: 0.9 },
    gniazdko: { wiosna: 1.0, lato: 0.95, 'jesień': 1.2, zima: 1.15 },
    polka: { wiosna: 1.05, lato: 0.95, 'jesień': 1.1, zima: 1.0 },
    syfon: { wiosna: 1.0, lato: 0.95, 'jesień': 1.05, zima: 1.2 },
    drzwi: { wiosna: 1.0, lato: 0.95, 'jesień': 1.2, zima: 1.1 },
    grzejnik: { wiosna: 0.9, lato: 0.75, 'jesień': 1.2, zima: 1.4 },
    okno: { wiosna: 1.0, lato: 0.9, 'jesień': 1.2, zima: 1.2 },
    malowanie: { wiosna: 1.2, lato: 1.15, 'jesień': 1.0, zima: 0.85 },
    plytki: { wiosna: 1.15, lato: 1.1, 'jesień': 0.95, zima: 0.85 },
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function seasonOf(day) {
    const d = Math.max(1, day) - 1;
    const idx = Math.floor(d / DAYS_PER_SEASON) % 4;
    return { name: SEASONS[idx], idx, dayInSeason: (d % DAYS_PER_SEASON) + 1, year: Math.floor(d / (DAYS_PER_SEASON * 4)) + 1 };
  }
  function demandMult(season, jobId) { return (DEMAND[jobId] && DEMAND[jobId][season]) || 1; }
  /* Opóźnienie pogodowe w minutach. */
  function weather(season, rng) {
    if (season === 'zima' && rng() < 0.4) return { delay: 2 + Math.floor(rng() * 3), text: '❄️ Mróz: farba nie schnie, ręce grabieją. Tracisz kilka minut.' };
    if (season === 'jesień' && rng() < 0.35) return { delay: 1 + Math.floor(rng() * 2), text: '🌧️ Deszcz: wszystko się ślizga i trzeba czekać. Tracisz kilka minut.' };
    if (season === 'lato' && rng() < 0.2) return { delay: 1, text: '☀️ Upał: przerwa na wodę. Minuta w plecy.' };
    return { delay: 0, text: '' };
  }
  /* Zimą zimny lokal obniża nastrój. Komfort siedziby (liczba z siedziba.js) łagodzi. */
  function moodPenalty(season, comfort) { return season === 'zima' ? clamp(8 - comfort * 0.4, 0, 8) : 0; }

  return { SEASONS, DAYS_PER_SEASON, seasonOf, demandMult, weather, moodPenalty };
});
