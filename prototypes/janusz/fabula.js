/* Fabuła „Spadek po dziadku” i tajemniczy klient. Silnik opowieści: sceny (beaty) odpalają się, gdy stan gry
 * spełni warunek (liczba zleceń, ocena firmy, pieniądze, plotki, ryzyko skarbowe, flagi z wcześniejszych wyborów).
 * Wybory ustawiają flagi i dają skutki, które potem zmieniają kolejne sceny i zakończenie, więc opowieść nie jest liniowa.
 *
 * ctx (stan do warunków): { done, day, money, rating, tier, gossip, taxRisk, debt, crew:[ids], rivalPower, accountant, owedContact, flags:{} }
 * Skutki wyboru (effects): { money, gossip, rivalGrudge, rivalPower, taxRisk, forceAudit, debt:{lender,amount}, crewMood:{id,delta},
 *   crewPatch:{id,patch}, ratingPush, contact, accountant, flags:[...], note }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fabula = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const fresh = () => ({ fired: [], flags: {}, log: [], ending: null });
  const has = (ctx, f) => !!(ctx.flags && ctx.flags[f]);

  const BEATS = [
    { id: 'spadek', chapter: 1, title: 'Spadek po dziadku', when: c => c.done === 0,
      text: 'Dziadek Zdzisław zostawił ci ruderę po drugiej stronie osiedla, walizkę narzędzi i listę „spraw do załatwienia”, której nikt nie chce czytać. Ciotka proponuje układ.',
      choices: [
        { label: 'Przejmij warsztat dziadka', sub: '+600 zł, walizka z narzędziami jest twoja', effects: { money: 600, flags: ['warsztat'], note: 'Walizka dziadka pachnie smarem i wspomnieniami.' } },
        { label: 'Weź gotówkę od ciotki', sub: '+1200 zł, ale rodzina będzie gadać', effects: { money: 1200, gossip: -5, flags: ['ciotka'], note: 'Ciotka zadzwoniła do pół rodziny.' } } ] },
    { id: 'gienek', chapter: 1, title: 'Pan Gienek puka do drzwi', when: c => c.done >= 2,
      text: 'W progu stoi Pan Gienek w skórzanej kurtce. „Dziadek pożyczył ode mnie dwa tysiące. Termin minął, procent leci.” Dzwoni na komórkę, ale nie jest to rozmowa o pogodzie.',
      choices: [
        { label: 'Spłać 800 zł teraz, resztę w ratach', sub: '−800 zł, zostaje 1200 zł długu u Gienka (25% na dzień wypłaty)', effects: { money: -800, debt: { lender: 'gienek', amount: 1200 }, flags: ['gienek_rata'] } },
        { label: '„Dziadek miał umowę ustną”', sub: 'ryzykowne: Gienek się wścieka, rywal chętnie to wykorzysta', effects: { rivalGrudge: 10, gossip: -4, flags: ['gienek_wrog'], note: 'Pan Gienek powiedział tylko: „Zobaczymy.”' } },
        { label: 'Zaproponuj remont garażu na poczet długu', sub: '−200 zł na materiały, Gienek odpuszcza połowę', effects: { money: -200, debt: { lender: 'gienek', amount: 1000 }, gossip: 3, flags: ['gienek_remont'] } } ] },
    { id: 'kacper_prawo', chapter: 2, title: 'Kacper chce prawo jazdy', when: c => c.done >= 4 && c.crew.indexOf('kacper') >= 0 && !has(c, 'kacper_prawko'),
      text: 'Kacper przyszedł z kartką: „Szefie, zapisałem się na kurs prawa jazdy. Dacie dzień wolny na egzamin i dorzucicie do kursu?” Ciągle jeździ bez prawka i boi się mandatu.',
      choices: [
        { label: 'Dorzuć do kursu', sub: '−250 zł, nastrój Kacpra +15, dostaje prawo jazdy', effects: { money: -250, crewMood: { id: 'kacper', delta: 15 }, crewPatch: { id: 'kacper', patch: { license: true } }, flags: ['kacper_prawko'], note: 'Kacper zdał za drugim razem i dziękuje szefowi.' } },
        { label: 'Odmów, ma się uczyć sam', sub: 'nastrój Kacpra −10, dalej jeździ bez prawka', effects: { crewMood: { id: 'kacper', delta: -10 }, flags: ['kacper_prawko'] } } ] },
    { id: 'bogdan', chapter: 2, title: 'Bogdan-Bud przyjeżdża na osiedle', when: c => c.done >= 5,
      text: 'Na osiedle wjeżdża błyszcząca ciężarówka z napisem „Bogdan-Bud. Solidnie i z faktur(k)ą”. Właściciel wysiada, podaje rękę i uśmiecha się za szeroko. „Panowie, możemy współpracować.”',
      choices: [
        { label: 'Współpraca: podwykonawstwo', sub: '+500 zł, ale rywal rośnie w siłę', effects: { money: 500, rivalPower: 8, flags: ['bogdan_wspolpraca'] } },
        { label: 'Wojna cenowa', sub: 'żal rywala +25, plotki +5, kasa −150 na ulotki', effects: { money: -150, rivalGrudge: 25, gossip: 5, flags: ['bogdan_wojna'] } },
        { label: 'Zignoruj go', sub: 'bez zmian. Na razie.', effects: { flags: ['bogdan_ignor'] } } ] },
    { id: 'basia', chapter: 3, title: 'Pani Basia z biura rachunkowego', when: c => c.done >= 7 && !c.accountant,
      text: 'Pani Basia, księgowa z parteru, zatrzymuje cię na klatce: „Panie majster, pan to tak na oko liczy? Skarbówka nie lubi oka.” Oferuje prowadzenie ksiąg.',
      choices: [
        { label: 'Zatrudnij księgową', sub: '−600 zł jednorazowo i 40 zł na dzień wypłaty, mniej ryzyka kontroli', effects: { money: -600, accountant: true, flags: ['basia'] } },
        { label: 'Podziękuj, dasz radę sam', sub: 'ryzyko skarbowe +5', effects: { taxRisk: 5, flags: ['basia_nie'] } } ] },
    { id: 'donos', chapter: 3, title: 'Anonimowy donos', when: c => c.done >= 8 && c.taxRisk >= 35,
      text: 'Ktoś napisał na ciebie do skarbówki. Nie wiadomo kto, ale sąsiad z naprzeciwka dziwnie często patrzy w twoje okno. Za tydzień może przyjść kontrola.',
      choices: [
        { label: 'Przygotuj się: kup segregator i wyjaśnienia', sub: '−150 zł, kontrola wymuszona w najbliższym tygodniu', effects: { money: -150, forceAudit: true, flags: ['donos'] } },
        { label: 'Zadzwoń do szwagra w urzędzie', sub: 'zwiększa twój dług wdzięczności, mniejsza kara', effects: { contact: 'urzad', forceAudit: true, flags: ['donos', 'donos_szwagier'] } } ] },
    { id: 'przyslugi', chapter: 3, title: 'Znajomy upomina się o zwrot', when: c => !!c.owedContact,
      text: 'Ktoś z osiedla zatrzymuje cię na schodach: „Pamiętasz, jak ci pomogłem? Teraz ty mnie pomóż.” Przysługi mają swoją cenę.',
      choices: [
        { label: 'Odwdzięcz się', sub: '−100 zł, dług wdzięczności spada, zaufanie rośnie', effects: { repayContact: true, money: -100 } },
        { label: 'Udawaj, że nie pamiętasz', sub: 'plotki −6, dług zostaje', effects: { gossip: -6 } } ] },
    { id: 'inwestor', chapter: 4, title: 'Pan z Warszawy', when: c => c.done >= 12 && c.rating >= 2.8 && c.tier >= 1,
      text: 'Elegancki pan w garniturze rozgląda się po twojej siedzibie. „Kupię od pana ten kawałek ziemi pod nowe osiedle. Proszę się nie obrażać, ale to naprawdę dobra oferta.” Za nim stoi Bogdan-Bud.',
      choices: [
        { label: 'Sprzedaj ziemię', sub: '+25 000 zł, firma stanie się częścią holdingu', effects: { money: 25000, flags: ['sprzedane'], note: 'Papiery podpisane. Szyld zmienia się w niecały tydzień.' } },
        { label: 'Negocjuj twardo (potrzebne plotki ≥ 60)', sub: '+40 000 zł, jeśli osiedle za tobą stoi', requires: c => c.gossip >= 60, effects: { money: 40000, flags: ['sprzedane', 'wynegocjowane'] } },
        { label: 'Odmów. To ziemia dziadka', sub: 'żal rywala +20, plotki +8, firma zostaje twoja', effects: { rivalGrudge: 20, gossip: 8, flags: ['honor'] } } ] },
    { id: 'finał', chapter: 5, title: 'Koniec roku', when: c => c.done >= 18,
      text: 'Mija rok od spadku. Czas zrobić rachunek sumienia i księgowy.', choices: [ { label: 'Zobacz, jak to się skończyło', sub: 'podsumowanie', effects: { finale: true } } ] },
  ];

  function due(story, ctx) {
    for (const b of BEATS) { if (story.fired.indexOf(b.id) >= 0) continue; if (b.when(ctx)) return b; }
    return null;
  }
  function choiceAvailable(ch, ctx) { return !ch.requires || ch.requires(ctx); }
  /* Zatwierdza wybór: oznacza scenę, ustawia flagi, zapisuje wpis do dziennika i zwraca skutki do zastosowania. */
  function resolve(story, beatId, idx) {
    const b = BEATS.find(x => x.id === beatId); if (!b) throw new Error('Nieznana scena ' + beatId);
    const ch = b.choices[idx]; if (!ch) throw new Error('Nieznany wybór');
    const s = JSON.parse(JSON.stringify(story));
    s.fired.push(beatId); (ch.effects.flags || []).forEach(f => { s.flags[f] = true; });
    s.log.push({ beat: beatId, title: b.title, choice: ch.label });
    return { story: s, effects: ch.effects };
  }

  /* Zakończenie na podstawie stanu. */
  function ending(ctx) {
    if (has(ctx, 'sprzedane')) return { id: 'holding', title: 'Holding Bogdana', text: 'Sprzedałeś ziemię. Bogdan-Bud zbudował osiedle, a ty dostałeś posadę „kierownika ds. relacji z mieszkańcami”. Pensja jest, spokój też.' };
    if (ctx.rating >= 4 && ctx.fusz <= 25) return { id: 'uczciwy', title: 'Uczciwy majster', text: 'Dobra robota przyciąga klientów. Twoja rudera stała się marką na osiedlu, a pan Gienek poleca cię znajomym.' };
    if (ctx.tier >= 3 && ctx.rating < 3.2) return { id: 'krol', title: 'Król fuszerki', text: 'Siedziba lśni, a pod tynkiem… cóż. Wszystko działa do pierwszej kontroli. Pan z teczką już idzie.' };
    return { id: 'klasyk', title: 'Janusz Biznesu klasyczny', text: 'Jakoś to jest. Nie bogacz i nie bankrut, ale na osiedlu wszyscy cię znają. „Jakoś to będzie” zostaje twoim hasłem.' };
  }

  /* Tajemniczy klient: co jakiś czas inspektor jakości udaje zwykłego klienta. */
  function rollMystery(ctx, rng) { return ctx.done >= 4 && rng() < 0.12; }
  function resolveMystery(result) {
    if (result.index >= 40) return { kind: 'kara', money: -300, gossip: -10, text: '🕵️ Tajemniczy klient okazał się kontrolerem jakości. Fuszerka wyszła na jaw: kara 300 zł i zła opinia.' };
    if (result.index <= 15) return { kind: 'premia', money: 300, gossip: 10, text: '🕵️ Tajemniczy klient okazał się kontrolerem jakości i jest pod wrażeniem: premia 300 zł i dobra opinia.' };
    return { kind: 'neutral', money: 0, gossip: 0, text: '🕵️ Tajemniczy klient okazał się kontrolerem jakości. Wynik: „bez uwag, ale bez zachwytów”.' };
  }

  return { BEATS, fresh, due, choiceAvailable, resolve, ending, rollMystery, resolveMystery };
});
