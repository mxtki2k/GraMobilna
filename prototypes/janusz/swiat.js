/* Moduł świata i ryzyka: dylemat „kto zawozi materiały” z kierowcami w różnym stanie.
 * Czysta logika (bez DOM). Losowość przez rng(): () => [0,1).
 *
 * Zamiast wpisywać reakcje „na sztywno”, wynik wynika z cech i stanu świata:
 *   stan kierowcy (trzeźwy / kac / po piwie / pijany) = f(skłonność do picia, nastrój, wypłata dzień wcześniej)
 *   P(wypadek)  = 0,03 + alk·0,40·(1 − 0,5·umiejętność jazdy) + (1 − jazda)·0,05
 *   P(policja)  = patrole · (0,35 + alk·0,35)         (patrole rosną po wpadkach, maleją z czasem)
 *   brak prawa jazdy, promile i wypadek to osobne zdarzenia o różnych skutkach.
 * Skutki zostawiają ślady w ludziach (wdzięczność, uraz, prawo jazdy, urlop zdrowotny),
 * które potem zmieniają szanse w kolejnych zdarzeniach.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Swiat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ALC = { trzezwy: 0, kac: 0.35, 'po-piwie': 0.6, pijany: 1 };
  const LABEL = { trzezwy: 'trzeźwy', kac: 'na kacu', 'po-piwie': 'po piwie', pijany: 'pijany' };
  const newWorld = () => ({ heat: 0.25 });

  /* Stan na dziś. ctx: { paydayEve } – dzień po wypłacie ludzie piją więcej. */
  function rollState(w, ctx, rng) {
    ctx = ctx || {};
    const al = w.alcohol == null ? 0.2 : w.alcohol;
    const p = clamp(al * 0.5 + (w.mood < 40 ? (40 - w.mood) / 100 * 0.8 : 0) + (ctx.paydayEve ? 0.25 * al + 0.1 : 0), 0, 0.95);
    if (rng() > p) return 'trzezwy';
    const sr = rng() + al * 0.25;
    return sr < 0.55 ? 'kac' : sr < 0.9 ? 'po-piwie' : 'pijany';
  }

  /* Ryzyko jazdy dla trybu: 'worker' (pracownik), 'owner' (ty), 'courier' (wynajęty). */
  function driveRisk(w, state, world, mode) {
    if (mode === 'courier') return { accident: 0, police: 0 };
    if (mode === 'owner') return { accident: 0.03, police: 0 };
    const alc = ALC[state] || 0, skill = w.driving == null ? 0.5 : w.driving;
    const accident = clamp(0.03 + alc * 0.40 * (1 - 0.5 * skill) + (1 - skill) * 0.05, 0, 0.8);
    const police = clamp(world.heat * (0.35 + alc * 0.35), 0, 0.8);
    return { accident, police };
  }
  const band = p => p < 0.08 ? 'niskie' : p < 0.2 ? 'średnie' : 'wysokie';

  /* Rozstrzyga jazdę. Zwraca koszty, zmianę czasu, zdarzenia i zmiany w pracowniku. */
  function resolveDrive(w, state, world, mode, rng) {
    const res = { mode, driverId: w ? w.id : null, state, cost: 0, timeAdj: 0, accident: null, police: null,
      heatDelta: 0, claim: null, driverPatch: {}, notes: [], incident: false };
    if (mode === 'courier') { res.cost = 70; res.timeAdj = 2; res.notes.push('🚚 Kurier przywiózł wszystko. Kosztowało 70 zł i 2 minuty.'); return res; }
    if (mode === 'owner') {
      res.timeAdj = 3; res.notes.push('🚗 Sam zawiozłeś materiały. Trzy minuty w plecy.');
      if (rng() < 0.03) { res.accident = { severity: 'blacha', repair: 120 }; res.cost += 120; res.timeAdj += 6; res.notes.push('💥 Obtarłeś zderzak na parkingu. 120 zł.'); }
      return res;
    }
    const alc = ALC[state] || 0, r = driveRisk(w, state, world, mode);
    res.timeAdj = alc >= 0.6 ? -2 : 0; // pijany jedzie szybciej. Przynajmniej tak mu się wydaje.
    if (rng() < r.police) {
      res.incident = true; res.heatDelta += 0.1;
      if (alc >= 0.6 || (alc > 0 && rng() < 0.5)) {
        if (alc >= 0.6) {
          res.police = { kind: 'zatrzymanie', fine: 500, impound: true };
          res.driverPatch.license = false; res.cost += 500; res.timeAdj += 10;
          res.notes.push('🚔 Patrol zatrzymał ' + w.name + '. Dmuchanie wyszło dużo ponad normę, prawo jazdy zabrane, auto na parkingu. 500 zł.');
        } else {
          res.police = { kind: 'dmuchanie', fine: 200, impound: false }; res.cost += 200; res.timeAdj += 4;
          res.notes.push('🚔 Dmuchanie: ' + w.name + ' ma jeszcze coś po wczorajszym. Mandat 200 zł i pouczenie.');
        }
      } else if (!w.license) {
        res.police = { kind: 'mandat', fine: 300, impound: (w.licenseStrikes || 0) >= 1 }; res.cost += 300; res.timeAdj += 5;
        res.driverPatch.licenseStrikes = (w.licenseStrikes || 0) + 1;
        res.notes.push('🚔 Kontrola drogowa: ' + w.name + ' nie ma prawa jazdy. Mandat 300 zł' + (res.police.impound ? ', a auto zostaje na parkingu.' : '.'));
        if (res.police.impound) res.timeAdj += 8;
      } else { res.incident = false; res.heatDelta = 0; res.notes.push('🚔 Policja zatrzymała do kontroli. Papiery w porządku, jedziecie dalej.'); }
    }
    if (!res.police || res.police.kind !== 'zatrzymanie') {
      if (rng() < r.accident) {
        res.incident = true;
        const heavy = rng() < 0.1 + alc * 0.5;
        if (heavy) {
          const repair = Math.round(500 + rng() * 500);
          res.accident = { severity: 'ciezki', repair }; res.cost += repair; res.timeAdj += 12;
          res.driverPatch.outJobs = 2; res.claim = { kind: 'wypadek', amount: Math.round(repair * 1.2), riskDelta: 25, defect: 'wypadek służbowego auta' };
          res.notes.push('🚑 ' + w.name + ' wylądował w szpitalu, a auto nadaje się na złom. Naprawa ' + repair + ' zł, ' + w.name + ' wypada na dwa zlecenia.');
        } else {
          const repair = Math.round(150 + rng() * 150);
          res.accident = { severity: 'blacha', repair }; res.cost += repair; res.timeAdj += 6;
          res.notes.push('💥 ' + w.name + ' „tylko lekko” zahaczył słupek. Blacha do poprawki: ' + repair + ' zł.');
        }
      }
    }
    if (!res.incident && !res.police) res.notes.push('🚗 ' + w.name + ' dowiózł wszystko w jednym kawałku (tym razem).');
    return res;
  }

  /* Po incydencie szef decyduje, co z kierowcą. To kształtuje relację. */
  function aftermathOptions(w, res) {
    if (!w || !res.incident) return [];
    const bill = res.cost;
    return [
      { id: 'kryj', label: 'Kryj go', sub: 'bez potrącenia, wdzięczność +25, ale może to nie jest dobra lekcja' },
      { id: 'potracaj', label: 'Potrąć z pensji', sub: 'odzyskujesz ' + Math.round(bill * 0.5) + ' zł, nastrój −12, uraz +20' },
      { id: 'ostrzez', label: 'Ostrzeż i daruj', sub: 'nastrój −4, mały uraz, trochę mniej pije' },
      { id: 'zwolnij', label: 'Zwolnij', sub: 'odchodzi i opowiada po osiedlu' },
    ];
  }
  function applyAftermath(w, choice, res) {
    const out = { worker: Object.assign({}, w), money: 0, rep: 0, fired: false, note: '' };
    const wk = out.worker;
    if (choice === 'kryj') {
      wk.gratitude = clamp((wk.gratitude || 0) + 25, 0, 100);
      if ((ALC[res.state] || 0) >= 0.35) wk.alcohol = clamp((wk.alcohol || 0) + 0.05, 0, 1);
      out.note = wk.name + ' patrzy na ciebie z wdzięcznością. I trochę z ulgą.';
    } else if (choice === 'potracaj') {
      out.money = Math.round(res.cost * 0.5); wk.mood = clamp(wk.mood - 12, 0, 100); wk.grudge = clamp((wk.grudge || 0) + 20, 0, 100);
      out.note = 'Odzyskałeś ' + out.money + ' zł. ' + wk.name + ' notuje sobie to w pamięci.';
    } else if (choice === 'ostrzez') {
      wk.mood = clamp(wk.mood - 4, 0, 100); wk.grudge = clamp((wk.grudge || 0) + 5, 0, 100); wk.alcohol = clamp((wk.alcohol || 0) - 0.03, 0, 1);
      out.note = wk.name + ' kiwa głową. Do następnego razu.';
    } else if (choice === 'zwolnij') {
      out.fired = true; out.rep = 2; out.note = wk.name + ' odchodzi i opowiada po osiedlu, jaki z ciebie szef.';
    }
    return out;
  }

  /* Patrole wygasają z czasem w stronę poziomu bazowego. */
  function tickWorld(world, heatDelta) { world.heat = clamp(world.heat + (heatDelta || 0) + (0.25 - world.heat) * 0.2, 0.05, 0.9); return world; }

  /* Wygasanie urlopu zdrowotnego po zleceniu. */
  function tickWorkers(workers) { return workers.map(w => (w.outJobs > 0 ? Object.assign({}, w, { outJobs: w.outJobs - 1 }) : w)); }

  return { ALC, LABEL, newWorld, rollState, driveRisk, band, resolveDrive, aftermathOptions, applyAftermath, tickWorld, tickWorkers };
});
