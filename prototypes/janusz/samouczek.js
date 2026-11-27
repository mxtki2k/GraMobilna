/* Samouczek: lekki przewodnik po grze. Czysta logika bez DOM (dane kroków, postęp, podpowiedź „co dalej”).
   Widok pokazuje dymek z tekstem i podświetla element wskazany selektorem `sel`.
   Postęp trzyma w osobnym kluczu (zlecenia_tut), żeby nie mieszać go ze stanem gry. */
(function (root, factory) { const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.Samouczek = m; })(typeof self !== 'undefined' ? self : this, function () {
  /* Kroki w kolejności. ctx to miejsce w grze, `when` warunek na stanie gry (done = liczba zakończonych zleceń). */
  const STEPS = [
    { id: 'start', ctx: 'menu', sel: '.tile:not([disabled])', text: 'Witaj w firmie! Zacznij od zlecenia nr 1: dotknij kafelka.', when: g => g.done === 0, act: true },
    { id: 'umowa', ctx: 'umowa', sel: '#umOk', text: 'Umowa: warunki wpływają na zarobek i ryzyko. Na początek zostaw domyślne i zatwierdź.', act: true },
    { id: 'pomocnik', ctx: 'helper', sel: '.opt[data-w]', text: 'Pomocnik skraca robotę, ale kosztuje. Wybierz kogoś albo jedź sam.' },
    { id: 'dojazd', ctx: 'transport', sel: '.opt[data-d]', text: 'Dojazd: tańszy jest wolniejszy, a bus może się zepsuć. Wybierz sposób.' },
    { id: 'krok', ctx: 'job', sel: '.opts', text: 'Każdy krok robisz po swojemu: solidnie (długo, bez wad), na skróty albo fuszerką (szybko, ryzyko reklamacji).' },
    { id: 'znacznik', ctx: 'timing', sel: '#stop', text: 'Zatrzymaj znacznik w środku zielonego pola. Im bliżej, tym lepsza precyzja.', act: true },
    { id: 'wynik', ctx: 'result', sel: '.gauge', text: 'Fuszerometr: im niżej, tym solidniej. Niżej widać, ile naprawdę zostało po kosztach.' },
    { id: 'dalej', ctx: 'result', sel: '#next', text: 'Dalej wracasz do listy zleceń.', act: true },
    { id: 'staty', ctx: 'menu', sel: '.stats', text: 'Kasa, ocena firmy i wynik miesiąca. Dobre roboty podnoszą ocenę, a z oceną rosną wypłaty.', when: g => g.done >= 1 },
    { id: 'zakladki', ctx: 'menu', sel: '.tabs6', text: 'Tu zarządzasz firmą: ekipa, siedziba, finanse, osiedle, fabuła i sklep Alledrogo.', when: g => g.done >= 1 },
    { id: 'kafelki', ctx: 'menu', sel: '.tiles', text: 'Kolejne zlecenia odblokowują się po kolei. Strzałki ◀ ▶ przełączają strony.', when: g => g.done >= 1 },
    { id: 'sekcje', ctx: 'menu', sel: '.accs', text: 'Kontrakty, przetargi i czekanie na telefon są schowane tutaj. Rozwiń, gdy będziesz gotów.', when: g => g.done >= 1 },
  ];
  /* Pełna wycieczka po menu (przycisk ❓). */
  const TOUR = ['staty', 'zakladki', 'kafelki', 'sekcje'].map(id => STEPS.find(s => s.id === id));

  function create(storage, opts) {
    opts = opts || {}; let st = { done: {}, off: false };
    try { const r = storage && storage.getItem('zlecenia_tut'); if (r) st = Object.assign(st, JSON.parse(r)); } catch (e) {}
    if (opts.off) st.off = true;
    const save = () => { try { storage && storage.setItem('zlecenia_tut', JSON.stringify(st)); } catch (e) {} };
    const T = {
      state: () => st,
      enabled: () => !st.off,
      /* Następny krok dla miejsca w grze albo null. */
      next(ctx, game) { if (st.off) return null; return STEPS.find(s => s.ctx === ctx && !st.done[s.id] && (!s.when || s.when(game || {}))) || null; },
      done(id) { st.done[id] = 1; save(); },
      skip() { st.off = true; save(); },
      resume() { st.off = false; save(); },
      reset() { st = { done: {}, off: false }; save(); },
      tour() { return TOUR.slice(); },
    };
    return T;
  }

  /* Jedna podpowiedź „co dalej” dla menu: tekst i akcja (nazwa ekranu albo sekcji do rozwinięcia). Zależy od stanu gry. */
  function tip(g) {
    g = g || {};
    if (g.done === 0) return { text: 'Dotknij kafelka, żeby zacząć pierwsze zlecenie.', action: null };
    if (g.claims > 0) return { text: 'Czeka reklamacja: wróci po kolejnym zleceniu. Warto robić solidniej.', action: null };
    if (g.fatigue >= 70) return { text: 'Jesteś zmęczony: prześpij się w „Czekanie”, bo zacznie się fuszerka.', action: 'wait' };
    if (!g.crew && g.money >= 600) return { text: 'Stać cię na pomocnika: zajrzyj do „Ekipa”.', action: 'goCrew' };
    if (g.toolsWeak && g.money >= 400) return { text: 'Lepsze narzędzia to lepsza jakość: zajrzyj do „Alle”.', action: 'goAlle' };
    if (g.contractReady && !g.activeContract) return { text: 'Kontrakt płaci więcej: rozwiń „Kontrakty”.', action: 'contracts' };
    if (g.money >= 3000 && g.hqTier === 0) return { text: 'Masz oszczędności: ulepsz siedzibę, żeby brać więcej.', action: 'goHq' };
    return { text: 'Wybierz zlecenie albo rozwiń sekcje poniżej.', action: null };
  }
  return { STEPS, TOUR, create, tip };
});
