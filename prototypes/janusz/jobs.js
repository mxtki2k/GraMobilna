/* Dane zleceń: klienci, naprawy (kroki z opcjami), scenki SVG i kolejność poziomów.
 * Każda opcja: { id, label, desc, time, cost, skill?, mask?, defects[], fx }.
 *   skill = true  -> krok wykonywany w mini-grze na wyczucie (celność wpływa na jakość),
 *   fx            -> token stanu scenki (patrz data-show / data-hide w SVG). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Jobs = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const CLIENTS = {
    mirek: { id: 'mirek', name: 'Pan Mirek', em: '@mirek', attention: 0.35, strict: 0.7, expert: false, note: 'Patrzy, czy działa. Reszta go nie obchodzi.',
      lines: {
        5: ['No pięknie, jak u Niemca.', 'Działa! Zapraszam na kawę.'],
        4: ['Dobrze, dobrze. Może być.', 'Ujdzie w tłoku, tfu, w porządku.'],
        3: ['No… działa. Mniej więcej.', 'Zapłacę, ale bez entuzjazmu.'],
        2: ['Coś mi tu nie pasuje, ale nie wiem co.', 'Hm. Szwagier by zrobił lepiej.'],
        1: ['To ma tak wyglądać?!', 'Oddaj mi pieniądze albo zadzwonię do szwagra.'] } },
    karyna: { id: 'karyna', name: 'Karyna', em: '@karyna', attention: 0.8, strict: 1.0, expert: false, note: 'Zrobi zdjęcie i wrzuci do internetu.',
      lines: {
        5: ['Idealnie! Zostawię pięć gwiazdek.', 'Ooo, jak z katalogu!'],
        4: ['Jest ładnie, tylko trochę widać ślady.', 'Okej, polecę znajomym. Może.'],
        3: ['No jest… takie sobie.', 'Zrobię zdjęcie i zapytam internet.'],
        2: ['Przecież to widać!', 'Wrzucam to na grupę osiedlową.'],
        1: ['Tragedia! Wszyscy się dowiedzą.', 'To jest skandal. Zdjęcia już poszły.'] } },
    sebix: { id: 'sebix', name: 'Sebix', em: '@sebix', attention: 0.6, strict: 0.9, expert: false, note: 'Chce tanio i „żeby wyglądało”.',
      lines: {
        5: ['Git, brachu. Dobra robota.', 'Elegancko, wypłata leci.'],
        4: ['Spoko, może być.', 'Dobra, zostaw wizytówkę.'],
        3: ['No nie wiem, ale niech będzie.', 'Mogło być lepiej, ale kasę dam.'],
        2: ['Ej, tu coś nie gra.', 'Za to bym nie płacił, ale płacę.'],
        1: ['Ty chyba sobie żartujesz.', 'Zwrot kasy, bo zadzwonię do kumpli.'] } },
    grazyna: { id: 'grazyna', name: 'Pani Grażyna', em: '@grazyna', attention: 0.95, strict: 1.2, expert: false, note: 'Widzi wszystko. Naprawdę wszystko.',
      lines: {
        5: ['Dziękuję, panie majster, bardzo ładnie.', 'Wreszcie ktoś, kto robi jak trzeba.'],
        4: ['Dobrze, ale ja bym jeszcze poprawiła.', 'Prawie dobrze. Prawie.'],
        3: ['No nie jest to najlepsze.', 'Przecież widzę, że krzywo.'],
        2: ['Co to ma być?! Przecież ja widzę!', 'Pan to nazywa naprawą?'],
        1: ['Skandal! Dzwonię do administracji!', 'Takiego fuszera jeszcze nie widziałam!'] } },
    tesciowa: { id: 'tesciowa', name: 'Teściowa', em: '@tesciowa', attention: 1.0, strict: 1.4, expert: false, note: 'Nic nie jest wystarczająco dobre.',
      lines: {
        5: ['No. W końcu. Ale i tak bym zrobiła inaczej.', 'Może być. Nie powiem córce.'],
        4: ['Ujdzie. Za moich czasów robiło się lepiej.', 'No dobrze. Ale pan się nie zadufa.'],
        3: ['Nie tak. Jeszcze raz.', 'Zięć by to zrobił lepiej.'],
        2: ['Wstyd, no wstyd.', 'Powiem wszystkim sąsiadkom.'],
        1: ['Wyjdź! I nie wracaj!', 'Moja córka o tym usłyszy.'] } },
    heniek: { id: 'heniek', name: 'Pan Heniek', em: '@heniek', attention: 1.0, strict: 1.3, expert: true, note: 'Fachowiec na emeryturze. Widzi też to, co ukryte.',
      lines: {
        5: ['Młody, ty masz rękę. Szanuję.', 'No, zrobione jak się patrzy.'],
        4: ['Dobra robota, tylko tu dałbym inaczej.', 'Solidnie. Prawie jak ja.'],
        3: ['Wiem, co tu jest pod spodem. Nie chwal się.', 'Takie „na oko” za moich czasów lądowało w śmietniku.'],
        2: ['Ja to wszystko widzę, synu.', 'Zakryłeś, ale ja i tak wiem, co tam jest.'],
        1: ['Hańba. Idę po poziomicę i pogadamy.', 'To nie naprawa, to zbrodnia.'] } },
  };

  // Sceny rysuje scenes.js (pixel art). Tokeny 'fx' z opcji kroków steruje stanem sceny.

  const JOBS = {
    kran: {
      id: 'kran', title: 'Cieknący kran', place: 'Łazienka', base: 220, deadline: 26,
      intro: 'Z kranu kapie od tygodnia. Rachunek za wodę rośnie, a miska już się przelewa.',
      steps: [
        { id: 'woda', name: 'Odetnij wodę', hint: 'Najpierw trzeba przerwać dopływ.', options: [
          { id: 'dobrze', label: 'Zakręć zawór główny', desc: 'Pewnie, ale trzeba zejść do piwnicy.', time: 6, cost: 0, defects: [], fx: 'woda-off' },
          { id: 'skrot', label: 'Zakręć zawór pod zlewem', desc: 'Szybciej. Jeśli się domyka.', time: 3, cost: 0, defects: [{ label: 'zawór pod zlewem się nie domyka', sev: 1, vis: 0.3 }], fx: 'woda-off' },
          { id: 'fusz', label: 'Nie zakręcaj. Szybciej.', desc: 'Przecież to tylko kapie.', time: 1, cost: 0, defects: [{ label: 'woda w całej łazience', sev: 3, vis: 1 }], fx: 'flood' } ] },
        { id: 'uszczelka', name: 'Wymień uszczelkę', hint: 'Źródło problemu siedzi w środku.', options: [
          { id: 'dobrze', label: 'Nowa uszczelka z hurtowni', desc: 'Pasuje idealnie. Kosztuje 12 zł.', time: 8, cost: 12, skill: true, defects: [], fx: 'seal-new' },
          { id: 'skrot', label: 'Odwróć starą drugą stroną', desc: 'Działa. Jakiś czas.', time: 4, cost: 0, skill: true, defects: [{ label: 'stara uszczelka znowu zacznie ciec', sev: 4, vis: 0.1 }], fx: 'seal-old' },
          { id: 'fusz', label: 'Owiń taśmą teflonową', desc: 'Aż przestanie. Albo się znudzi.', time: 2, cost: 3, defects: [{ label: 'taśma udaje uszczelkę', sev: 5, vis: 0.15 }], fx: 'tape' } ] },
        { id: 'montaz', name: 'Dokręć armaturę', hint: 'Za mocno zerwie gwint, za słabo ciecze.', options: [
          { id: 'dobrze', label: 'Klucz nastawny i wyczucie', desc: 'Dokręcasz, aż stawia opór.', time: 6, cost: 0, skill: true, defects: [], fx: 'fit-ok' },
          { id: 'skrot', label: 'Dokręć, ile się da', desc: 'Siła rozwiązuje problemy.', time: 3, cost: 0, defects: [{ label: 'zerwany gwint pod kranem', sev: 4, vis: 0.25 }], fx: 'fit-force' },
          { id: 'fusz', label: 'Podeprzyj cegłą i wsad kleju', desc: 'Kran trzyma się na słowo honoru.', time: 2, cost: 8, defects: [{ label: 'kran trzyma się na kleju', sev: 5, vis: 0.6 }], fx: 'glue' } ] },
        { id: 'test', name: 'Sprawdź szczelność', hint: 'Zobacz, czy naprawdę nie cieknie.', options: [
          { id: 'dobrze', label: 'Odkręć wodę i poczekaj pięć minut', desc: 'Nudne, ale pewne.', time: 5, cost: 0, defects: [], fx: 'tested' },
          { id: 'skrot', label: 'Odkręć na chwilę i zerknij', desc: 'Jak nie kapie od razu, to dobrze.', time: 2, cost: 0, defects: [{ label: 'brak długiej próby szczelności', sev: 1.5, vis: 0.1 }], fx: 'tested' },
          { id: 'fusz', label: 'Pewnie trzyma', desc: 'Nikt nie sprawdza.', time: 0, cost: 0, defects: [{ label: 'brak próby szczelności', sev: 3, vis: 0.15 }], fx: 'untested' } ] },
      ],
    },
    sciana: {
      id: 'sciana', title: 'Dziura w ścianie', place: 'Pokój', base: 300, deadline: 40,
      intro: 'Po przesunięciu szafy została dziura wielkości pięści. Klient chce, żeby było „jak nowe”.',
      steps: [
        { id: 'przygotuj', name: 'Przygotuj dziurę', hint: 'Dobra szpachla zaczyna się od czystej krawędzi.', options: [
          { id: 'dobrze', label: 'Oczyść krawędzie i zagruntuj', desc: 'Szpachla będzie trzymać.', time: 7, cost: 10, skill: true, defects: [], fx: 'primer' },
          { id: 'skrot', label: 'Przetrzyj ręką', desc: 'Pył to też materiał.', time: 3, cost: 0, defects: [{ label: 'pył pod szpachlą', sev: 2, vis: 0.1 }], fx: 'primer' },
          { id: 'fusz', label: 'Nic. Szpachla się przyklei.', desc: 'Szpachla wszystko wybacza.', time: 0, cost: 0, defects: [{ label: 'szpachla odchodzi od ściany', sev: 3, vis: 0.2 }], fx: 'primer' } ] },
        { id: 'wypelnij', name: 'Wypełnij ubytek', hint: 'Duży ubytek lubi cierpliwość.', options: [
          { id: 'dobrze', label: 'Gips szpachlowy warstwami', desc: 'Cienkie warstwy, dobre schnięcie.', time: 10, cost: 18, skill: true, defects: [], fx: 'plaster-good' },
          { id: 'skrot', label: 'Jedna gruba warstwa', desc: 'Szybko, ale pęknie.', time: 4, cost: 8, defects: [{ label: 'rysy po wyschnięciu', sev: 3, vis: 0.5 }], fx: 'plaster-thick' },
          { id: 'fusz', label: 'Wepchnij gazetę i zalej pianką', desc: 'Piana wszystko wypełni.', time: 2, cost: 14, defects: [{ label: 'pianka pod farbą', sev: 4, vis: 0.3 }, { label: 'gazeta w ścianie', sev: 2, vis: 0 }], fx: 'foam' } ] },
        { id: 'szlif', name: 'Wygładź', hint: 'Bez szlifu każdy ślad będzie widać.', options: [
          { id: 'dobrze', label: 'Papier ścierny 120, potem 180', desc: 'Powierzchnia jak lustro.', time: 8, cost: 4, skill: true, defects: [], fx: 'sand-good' },
          { id: 'skrot', label: 'Przejedź raz', desc: 'Co wystaje, to farba przykryje.', time: 3, cost: 0, defects: [{ label: 'nierówna powierzchnia', sev: 2, vis: 0.6 }], fx: 'sand-light' },
          { id: 'fusz', label: 'Pomiń, farba wyrówna', desc: 'Farba wyrównuje. Prawie.', time: 0, cost: 0, defects: [{ label: 'wyraźna łata w ścianie', sev: 3, vis: 0.9 }], fx: 'sand-none' } ] },
        { id: 'maluj', name: 'Pomaluj', hint: 'Efekt końcowy to to, co klient zobaczy.', options: [
          { id: 'dobrze', label: 'Cała ściana, dwie warstwy', desc: 'Kolor jednolity, bez plam.', time: 12, cost: 25, skill: true, defects: [], fx: 'paint-full' },
          { id: 'skrot', label: 'Tylko łata', desc: 'Oszczędzasz farbę i czas.', time: 4, cost: 6, defects: [{ label: 'plama innego odcienia', sev: 2.5, vis: 0.8 }], fx: 'paint-patch' },
          { id: 'fusz', label: 'Postaw szafę', desc: 'Dziura za szafą? Jaka dziura?', time: 1, cost: 0, mask: 0.8, defects: [{ label: 'dziura wciąż jest za szafą', sev: 3, vis: 0.15 }, { label: 'szafa stoi w nietypowym miejscu', sev: 2.5, vis: 0.85 }], fx: 'wardrobe' } ] },
      ],
    },
    gniazdko: {
      id: 'gniazdko', title: 'Iskrzące gniazdko', place: 'Kuchnia', base: 350, deadline: 30,
      intro: 'Gniazdko iskrzy przy każdym włączeniu czajnika. Klient twierdzi, że „zawsze tak miało”.',
      steps: [
        { id: 'prad', name: 'Odetnij prąd', hint: 'Zanim cokolwiek dotkniesz.', options: [
          { id: 'dobrze', label: 'Wyłącz bezpiecznik i sprawdź próbnikiem', desc: 'Dwa razy sprawdź.', time: 5, cost: 0, defects: [], fx: 'prad-off' },
          { id: 'skrot', label: 'Wyłącz bezpiecznik (chyba ten)', desc: 'Podpisany „kuchnia?”.', time: 2, cost: 0, defects: [{ label: 'przewód mógł być pod napięciem', sev: 3, vis: 0, hazard: 0.8 }], fx: 'prad-off' },
          { id: 'fusz', label: 'Pracuj na żywca w gumowych kapciach', desc: 'Co może pójść nie tak?', time: 0, cost: 0, defects: [{ label: 'praca pod napięciem', sev: 5, vis: 0, hazard: 1 }], fx: 'prad-live' } ] },
        { id: 'przewody', name: 'Przygotuj przewody', hint: 'Połączenia muszą być pewne.', options: [
          { id: 'dobrze', label: 'Zdejmij izolację i załóż końcówki', desc: 'Równo, czysto.', time: 9, cost: 8, skill: true, defects: [], fx: 'wires-ok' },
          { id: 'skrot', label: 'Skręć i zaizoluj taśmą', desc: 'Klasyka gatunku.', time: 4, cost: 2, defects: [{ label: 'skrętka z taśmą w puszce', sev: 4, vis: 0.1, hazard: 0.6 }], fx: 'cable-twist' },
          { id: 'fusz', label: 'Zatrzaśnij to, co jest', desc: 'Iskrzy trochę, ale się trzyma.', time: 1, cost: 0, defects: [{ label: 'gołe żyły w puszce', sev: 6, vis: 0.1, hazard: 1 }], fx: 'cable-twist' } ] },
        { id: 'gniazdko', name: 'Zamontuj gniazdko', hint: 'Estetyka i bezpieczeństwo.', options: [
          { id: 'dobrze', label: 'Nowe gniazdko, równo w puszce', desc: 'Kosztuje 20 zł, wygląda jak z katalogu.', time: 8, cost: 20, skill: true, defects: [], fx: 'outlet-new' },
          { id: 'skrot', label: 'Stare, wyczyszczone', desc: 'Oszczędność, ale nadpalone styki.', time: 4, cost: 0, defects: [{ label: 'nadpalone styki w starym gniazdku', sev: 3, vis: 0.35, hazard: 0.5 }], fx: 'outlet-old' },
          { id: 'fusz', label: 'Wciśnij na siłę i oblep klejem', desc: 'Siedzi. Mniej więcej.', time: 2, cost: 5, defects: [{ label: 'gniazdko się kiwa', sev: 3, vis: 0.8 }, { label: 'luz w puszce', sev: 3, vis: 0.1, hazard: 0.7 }], fx: 'outlet-glue' } ] },
        { id: 'test', name: 'Odbiór', hint: 'Sprawdź, czy działa.', options: [
          { id: 'dobrze', label: 'Włącz i zmierz próbnikiem', desc: 'Pomiary, protokół, spokój.', time: 5, cost: 0, defects: [], fx: 'tested' },
          { id: 'skrot', label: 'Włącz czajnik i zobacz', desc: 'Jak się zagotuje, to jest dobrze.', time: 2, cost: 0, defects: [{ label: 'brak pomiaru instalacji', sev: 1.5, vis: 0.1, hazard: 0.3 }], fx: 'tested' },
          { id: 'fusz', label: 'Podłącz wtyczkę i uciekaj', desc: 'Niech klient sam sprawdzi.', time: 0, cost: 0, defects: [{ label: 'brak odbioru instalacji', sev: 3, vis: 0.1, hazard: 0.6 }], fx: 'untested' } ] },
      ],
    },
    polka: {
      id: 'polka', title: 'Krzywa półka', place: 'Salon', base: 160, deadline: 22,
      intro: 'Półka na książki wisi pod kątem i ledwo się trzyma. Klient chce ją powiesić „raz a dobrze”.',
      steps: [
        { id: 'rozmiar', name: 'Wyznacz miejsce', hint: 'Dobry początek to równa linia.', options: [
          { id: 'dobrze', label: 'Poziomica i ołówek', desc: 'Dwa pomiary, jeden otwór.', time: 5, cost: 0, skill: true, defects: [], fx: 'level-good' },
          { id: 'skrot', label: 'Na oko od sufitu', desc: 'Sufit zwykle jest prosty.', time: 2, cost: 0, defects: [{ label: 'półka lekko krzywa', sev: 2.5, vis: 0.7 }], fx: 'level-eye' },
          { id: 'fusz', label: 'Przyłóż do ściany i puść', desc: 'Grawitacja wie lepiej.', time: 0, cost: 0, defects: [{ label: 'półka wyraźnie krzywa', sev: 4, vis: 1 }], fx: 'level-bad' } ] },
        { id: 'otwory', name: 'Wywierć otwory', hint: 'To, co siedzi w ścianie, nie będzie widać.', options: [
          { id: 'dobrze', label: 'Wiertło do muru i kołki 8', desc: 'Kołki trzymają ciężar.', time: 7, cost: 6, skill: true, defects: [], fx: 'holes-ok' },
          { id: 'skrot', label: 'Wkręty w tynk, bez kołków', desc: 'Tynk trzyma. Do czasu.', time: 3, cost: 0, defects: [{ label: 'wkręty luźne w tynku', sev: 4, vis: 0.1 }], fx: 'holes-bad' },
          { id: 'fusz', label: 'Gwoździe i klej', desc: 'Klej trzyma wszystko.', time: 1, cost: 4, defects: [{ label: 'półka trzyma na kleju', sev: 5, vis: 0.2 }], fx: 'holes-bad' } ] },
        { id: 'montaz', name: 'Przykręć półkę', hint: 'Teraz wiszą na niej wszystkie decyzje.', options: [
          { id: 'dobrze', label: 'Równo, krzyżowo', desc: 'Najpierw lekko, potem mocno.', time: 6, cost: 0, skill: true, defects: [], fx: 'shelf-on' },
          { id: 'skrot', label: 'Dwa wkręty i jakoś', desc: 'Trzyma się. Chybocze.', time: 3, cost: 0, defects: [{ label: 'półka się chybocze', sev: 3, vis: 0.5 }], fx: 'shelf-on' },
          { id: 'fusz', label: 'Wsuń książkę pod spód', desc: 'Książka jako poziomica.', time: 1, cost: 0, mask: 0.3, defects: [{ label: 'półka podparta książką', sev: 3, vis: 0.85 }], fx: 'shelf-on book' } ] },
        { id: 'obciaz', name: 'Ustaw rzeczy', hint: 'Półka musi wytrzymać prawdziwe życie.', options: [
          { id: 'dobrze', label: 'Obciążaj stopniowo', desc: 'Sprawdź, czy się nie ugina.', time: 4, cost: 0, defects: [], fx: 'load-ok' },
          { id: 'skrot', label: 'Ustaw lekkie rzeczy', desc: 'Bezpiecznie, dopóki nie wrócą książki.', time: 2, cost: 0, defects: [], fx: 'load-ok' },
          { id: 'fusz', label: 'Ustaw ciężkie, pewnie wytrzyma', desc: 'Wszystkie encyklopedie.', time: 0, cost: 0, defects: [{ label: 'przeciążona półka', sev: 4, vis: 0, hazard: 0.4 }], fx: 'load-heavy' } ] },
      ],
    },
  };

  // kolejność poziomów: zlecenie + klient + mnożnik wypłaty
  const LEVELS = [
    { job: 'kran', client: 'mirek', mult: 1 },
    { job: 'polka', client: 'karyna', mult: 1.1 },
    { job: 'sciana', client: 'sebix', mult: 1.2 },
    { job: 'kran', client: 'grazyna', mult: 1.4 },
    { job: 'gniazdko', client: 'mirek', mult: 1.5 },
    { job: 'sciana', client: 'tesciowa', mult: 1.7 },
    { job: 'gniazdko', client: 'grazyna', mult: 2 },
    { job: 'polka', client: 'heniek', mult: 2.2 },
  ];

  return { CLIENTS, JOBS, LEVELS };
});
