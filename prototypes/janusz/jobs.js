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
          { id: 'skrot', label: 'Zakręć zawór pod zlewem', desc: 'Szybciej. Jeśli się domyka.', time: 3, cost: 0, defects: [{ label: 'zawór pod zlewem się nie domyka', sev: 1, vis: 0.3 }], fx: 'woda-sink' },
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
          { id: 'skrot', label: 'Odkręć na chwilę i zerknij', desc: 'Jak nie kapie od razu, to dobrze.', time: 2, cost: 0, defects: [{ label: 'brak długiej próby szczelności', sev: 1.5, vis: 0.1 }], fx: 'tested-quick' },
          { id: 'fusz', label: 'Pewnie trzyma', desc: 'Nikt nie sprawdza.', time: 0, cost: 0, defects: [{ label: 'brak próby szczelności', sev: 3, vis: 0.15 }], fx: 'untested' } ] },
      ],
    },
    sciana: {
      id: 'sciana', title: 'Dziura w ścianie', place: 'Pokój', base: 300, deadline: 40,
      intro: 'Po przesunięciu szafy została dziura wielkości pięści. Klient chce, żeby było „jak nowe”.',
      steps: [
        { id: 'przygotuj', name: 'Przygotuj dziurę', hint: 'Dobra szpachla zaczyna się od czystej krawędzi.', options: [
          { id: 'dobrze', label: 'Oczyść krawędzie i zagruntuj', desc: 'Szpachla będzie trzymać.', time: 7, cost: 10, skill: true, defects: [], fx: 'prep-good' },
          { id: 'skrot', label: 'Przetrzyj ręką', desc: 'Pył to też materiał.', time: 3, cost: 0, defects: [{ label: 'pył pod szpachlą', sev: 2, vis: 0.1 }], fx: 'prep-dust' },
          { id: 'fusz', label: 'Nic. Szpachla się przyklei.', desc: 'Szpachla wszystko wybacza.', time: 0, cost: 0, defects: [{ label: 'szpachla odchodzi od ściany', sev: 3, vis: 0.2 }], fx: 'prep-none' } ] },
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
          { id: 'skrot', label: 'Wyłącz bezpiecznik (chyba ten)', desc: 'Podpisany „kuchnia?”.', time: 2, cost: 0, defects: [{ label: 'przewód mógł być pod napięciem', sev: 3, vis: 0, hazard: 0.8 }], fx: 'prad-doubt' },
          { id: 'fusz', label: 'Pracuj na żywca w gumowych kapciach', desc: 'Co może pójść nie tak?', time: 0, cost: 0, defects: [{ label: 'praca pod napięciem', sev: 5, vis: 0, hazard: 1 }], fx: 'prad-live' } ] },
        { id: 'przewody', name: 'Przygotuj przewody', hint: 'Połączenia muszą być pewne.', options: [
          { id: 'dobrze', label: 'Zdejmij izolację i załóż końcówki', desc: 'Równo, czysto.', time: 9, cost: 8, skill: true, defects: [], fx: 'wires-ok' },
          { id: 'skrot', label: 'Skręć i zaizoluj taśmą', desc: 'Klasyka gatunku.', time: 4, cost: 2, defects: [{ label: 'skrętka z taśmą w puszce', sev: 4, vis: 0.1, hazard: 0.6 }], fx: 'wires-twist' },
          { id: 'fusz', label: 'Zatrzaśnij to, co jest', desc: 'Iskrzy trochę, ale się trzyma.', time: 1, cost: 0, defects: [{ label: 'gołe żyły w puszce', sev: 6, vis: 0.1, hazard: 1 }], fx: 'wires-bare' } ] },
        { id: 'gniazdko', name: 'Zamontuj gniazdko', hint: 'Estetyka i bezpieczeństwo.', options: [
          { id: 'dobrze', label: 'Nowe gniazdko, równo w puszce', desc: 'Kosztuje 20 zł, wygląda jak z katalogu.', time: 8, cost: 20, skill: true, defects: [], fx: 'outlet-new' },
          { id: 'skrot', label: 'Stare, wyczyszczone', desc: 'Oszczędność, ale nadpalone styki.', time: 4, cost: 0, defects: [{ label: 'nadpalone styki w starym gniazdku', sev: 3, vis: 0.35, hazard: 0.5 }], fx: 'outlet-old' },
          { id: 'fusz', label: 'Wciśnij na siłę i oblep klejem', desc: 'Siedzi. Mniej więcej.', time: 2, cost: 5, defects: [{ label: 'gniazdko się kiwa', sev: 3, vis: 0.8 }, { label: 'luz w puszce', sev: 3, vis: 0.1, hazard: 0.7 }], fx: 'outlet-glue' } ] },
        { id: 'test', name: 'Odbiór', hint: 'Sprawdź, czy działa.', options: [
          { id: 'dobrze', label: 'Włącz i zmierz próbnikiem', desc: 'Pomiary, protokół, spokój.', time: 5, cost: 0, defects: [], fx: 'tested' },
          { id: 'skrot', label: 'Włącz czajnik i zobacz', desc: 'Jak się zagotuje, to jest dobrze.', time: 2, cost: 0, defects: [{ label: 'brak pomiaru instalacji', sev: 1.5, vis: 0.1, hazard: 0.3 }], fx: 'tested-kettle' },
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
          { id: 'fusz', label: 'Gwoździe i klej', desc: 'Klej trzyma wszystko.', time: 1, cost: 4, defects: [{ label: 'półka trzyma na kleju', sev: 5, vis: 0.2 }], fx: 'holes-glue' } ] },
        { id: 'montaz', name: 'Przykręć półkę', hint: 'Teraz wiszą na niej wszystkie decyzje.', options: [
          { id: 'dobrze', label: 'Równo, krzyżowo', desc: 'Najpierw lekko, potem mocno.', time: 6, cost: 0, skill: true, defects: [], fx: 'shelf-on' },
          { id: 'skrot', label: 'Dwa wkręty i jakoś', desc: 'Trzyma się. Chybocze.', time: 3, cost: 0, defects: [{ label: 'półka się chybocze', sev: 3, vis: 0.5 }], fx: 'shelf-on shelf-wobble' },
          { id: 'fusz', label: 'Wsuń książkę pod spód', desc: 'Książka jako poziomica.', time: 1, cost: 0, mask: 0.3, defects: [{ label: 'półka podparta książką', sev: 3, vis: 0.85 }], fx: 'shelf-on book' } ] },
        { id: 'obciaz', name: 'Ustaw rzeczy', hint: 'Półka musi wytrzymać prawdziwe życie.', options: [
          { id: 'dobrze', label: 'Obciążaj stopniowo', desc: 'Sprawdź, czy się nie ugina.', time: 4, cost: 0, defects: [], fx: 'load-ok' },
          { id: 'skrot', label: 'Ustaw lekkie rzeczy', desc: 'Bezpiecznie, dopóki nie wrócą książki.', time: 2, cost: 0, defects: [], fx: 'load-light' },
          { id: 'fusz', label: 'Ustaw ciężkie, pewnie wytrzyma', desc: 'Wszystkie encyklopedie.', time: 0, cost: 0, defects: [{ label: 'przeciążona półka', sev: 4, vis: 0, hazard: 0.4 }], fx: 'load-heavy' } ] },
      ],
    },
    syfon: {
      id: 'syfon', title: 'Zapchany zlew', place: 'Kuchnia', base: 210, deadline: 30,
      intro: 'Woda w zlewie stoi i brzydko pachnie. Pół butelki „Kreta” nic nie dało, a pod szafką już mokro.',
      steps: [
        { id: 'przygotuj', name: 'Zabezpiecz miejsce', hint: 'Pod syfonem zbierze się brudna woda.', options: [
          { id: 'dobrze', label: 'Wiadro, szmaty i zakręcony zawór', desc: 'Nic nie spłynie na podłogę.', time: 5, cost: 0, defects: [], fx: 'bucket' },
          { id: 'skrot', label: 'Samo wiadro', desc: 'Lekko chlapnie.', time: 2, cost: 0, defects: [{ label: 'woda na podłodze pod zlewem', sev: 1, vis: 0.6 }], fx: 'bucket-only' },
          { id: 'fusz', label: 'Podłóż ręcznik', desc: 'Chłonie. Do pewnego momentu.', time: 1, cost: 0, defects: [{ label: 'kałuża pod szafką', sev: 2.5, vis: 1 }], fx: 'towel' } ] },
        { id: 'rozkrec', name: 'Odkręć syfon', hint: 'Plastikowe nakrętki łatwo zerwać.', options: [
          { id: 'dobrze', label: 'Nakrętki ręką, po kolei', desc: 'Wolno, ale nic nie zniszczysz.', time: 6, cost: 0, skill: true, defects: [], fx: 'trap-off' },
          { id: 'skrot', label: 'Kluczem do rur', desc: 'Idzie szybko, nakrętki trochę mniej.', time: 3, cost: 0, skill: true, defects: [{ label: 'zmasakrowane nakrętki syfonu', sev: 1.5, vis: 0.3 }], fx: 'trap-wrench' },
          { id: 'fusz', label: 'Wlej drugi „Kret” i czekaj', desc: 'Chemia sama zrobi robotę.', time: 1, cost: 12, defects: [{ label: 'żrąca chemia w rurach i w zlewie', sev: 3, vis: 0.2, hazard: 0.3 }], fx: 'chem' } ] },
        { id: 'czysc', name: 'Wyczyść rurę', hint: 'Tłuszcz siedzi głębiej, niż widać.', options: [
          { id: 'dobrze', label: 'Sprężyna i szczotka', desc: 'Dokładnie, na brudno.', time: 8, cost: 0, skill: true, defects: [], fx: 'pipe-clean' },
          { id: 'skrot', label: 'Przepychacz', desc: 'Przepchane. Częściowo.', time: 4, cost: 0, defects: [{ label: 'tłuszcz zostaje w kolanku', sev: 3, vis: 0.1 }], fx: 'plunger' },
          { id: 'fusz', label: 'Zalej gorącą wodą', desc: 'Rozpuści. Przesunie dalej.', time: 1, cost: 0, defects: [{ label: 'zator wróci za tydzień', sev: 4, vis: 0.1 }], fx: 'hot-water' } ] },
        { id: 'uszczelnij', name: 'Złóż syfon i uszczelnij', hint: 'Każde połączenie to potencjalny wyciek.', options: [
          { id: 'dobrze', label: 'Nowe uszczelki', desc: 'Czternaście złotych spokoju.', time: 6, cost: 14, skill: true, defects: [], fx: 'gasket-new' },
          { id: 'skrot', label: 'Stare uszczelki', desc: 'Są jeszcze miękkie. Chyba.', time: 3, cost: 0, skill: true, defects: [{ label: 'stara uszczelka zacznie przeciekać', sev: 3, vis: 0.15 }], fx: 'gasket-old' },
          { id: 'fusz', label: 'Silikon na wszystko', desc: 'Silikon uszczelnia każdy problem.', time: 2, cost: 10, defects: [{ label: 'silikon zamiast uszczelek', sev: 4, vis: 0.5 }], fx: 'silicone' } ] },
        { id: 'test', name: 'Próba odpływu', hint: 'Sprawdź pod obciążeniem, nie na sucho.', options: [
          { id: 'dobrze', label: 'Napełnij zlew i spuść całą wodę', desc: 'Jeśli suche, jest dobrze.', time: 5, cost: 0, defects: [], fx: 'drain-ok' },
          { id: 'skrot', label: 'Puść wodę z kranu na minutę', desc: 'Płynie, więc płynie.', time: 2, cost: 0, defects: [{ label: 'brak próby pod obciążeniem', sev: 1.5, vis: 0.1 }], fx: 'drain-quick' },
          { id: 'fusz', label: 'Pewnie płynie', desc: 'Nikt nie sprawdza.', time: 0, cost: 0, defects: [{ label: 'brak próby odpływu', sev: 3, vis: 0.15 }], fx: 'drain-none' } ] },
      ],
    },
    drzwi: {
      id: 'drzwi', title: 'Drzwi, które nie domykają', place: 'Przedpokój', base: 280, deadline: 34,
      intro: 'Drzwi wejściowe trzeba dociskać barkiem, a zamek klinuje się co drugi raz. Sąsiad od miesiąca słyszy to codziennie.',
      steps: [
        { id: 'diagnoza', name: 'Znajdź przyczynę', hint: 'Zawiasy, zamek czy spuchnięta ościeżnica?', options: [
          { id: 'dobrze', label: 'Poziomica, zawiasy i zapadka', desc: 'Sprawdzasz po kolei.', time: 6, cost: 0, defects: [], fx: 'diag-good' },
          { id: 'skrot', label: 'Na oko, pewnie zawiasy', desc: 'Pewnie, że zawiasy.', time: 2, cost: 0, defects: [{ label: 'nie sprawdzono prawdziwej przyczyny', sev: 1.5, vis: 0.1 }], fx: 'diag-eye' },
          { id: 'fusz', label: 'Kopnij i zobacz', desc: 'Diagnostyka kopniakiem.', time: 0, cost: 0, defects: [{ label: 'diagnoza kopniakiem', sev: 2.5, vis: 0.3 }], fx: 'diag-kick' } ] },
        { id: 'zawiasy', name: 'Napraw zawiasy', hint: 'Skrzydło ciągnie w dół i otwory się wyrabiają.', options: [
          { id: 'dobrze', label: 'Dokręć, wyrównaj, podkładki', desc: 'Skrzydło wraca na miejsce.', time: 8, cost: 6, skill: true, defects: [], fx: 'hinge-ok' },
          { id: 'skrot', label: 'Dokręć wkręty', desc: 'Za miesiąc znowu.', time: 3, cost: 0, skill: true, defects: [{ label: 'wkręty znowu się poluzują', sev: 2.5, vis: 0.1 }], fx: 'hinge-tight' },
          { id: 'fusz', label: 'Klej do drewna w otwory', desc: 'Zawias trzyma się klejem.', time: 1, cost: 4, defects: [{ label: 'zawias na kleju', sev: 4, vis: 0.3 }], fx: 'hinge-glue' } ] },
        { id: 'zamek', name: 'Zamek i zapadka', hint: 'Zapadka musi wejść w zaczep bez walki.', options: [
          { id: 'dobrze', label: 'Nowa wkładka i smar', desc: '38 zł i święty spokój.', time: 7, cost: 38, skill: true, defects: [], fx: 'lock-new' },
          { id: 'skrot', label: 'Naoliwić olejem', desc: 'Pachnie, działa. Chwilę.', time: 2, cost: 3, defects: [{ label: 'zamek znów się zatnie', sev: 2, vis: 0.2 }], fx: 'lock-oil' },
          { id: 'fusz', label: 'Zaklej zapadkę taśmą', desc: 'Nie zatrzaśnie się. Nie zatnie się.', time: 1, cost: 0, defects: [{ label: 'drzwi nie zamykają się na klucz', sev: 4.5, vis: 0.5, hazard: 0.3 }], fx: 'lock-tape' } ] },
        { id: 'luz', name: 'Dopasuj skrzydło do ościeżnicy', hint: 'Szczelina ma być równa dookoła.', options: [
          { id: 'dobrze', label: 'Zdejmij skrzydło i zeszlifuj krawędź', desc: 'Równo, bez poprawek.', time: 8, cost: 0, skill: true, defects: [], fx: 'plane-good' },
          { id: 'skrot', label: 'Szlif raz po wierzchu', desc: 'Prawie równo.', time: 3, cost: 0, skill: true, defects: [{ label: 'nierówna szczelina przy ościeżnicy', sev: 2, vis: 0.5 }], fx: 'plane-rough' },
          { id: 'fusz', label: 'Wepchnij klin i nie ruszaj', desc: 'Klin trzyma.', time: 1, cost: 0, defects: [{ label: 'drzwi trzymają się na kliniku', sev: 3.5, vis: 0.8 }], fx: 'plane-none' } ] },
        { id: 'test', name: 'Sprawdź zamykanie', hint: 'Dziesięć razy, z kluczem i bez.', options: [
          { id: 'dobrze', label: 'Zamknij dziesięć razy', desc: 'Z kluczem i bez.', time: 5, cost: 0, defects: [], fx: 'door-ok' },
          { id: 'skrot', label: 'Zamknij raz', desc: 'Zamknęły się.', time: 2, cost: 0, defects: [{ label: 'brak próby zamykania', sev: 1.5, vis: 0.1 }], fx: 'door-quick' },
          { id: 'fusz', label: 'Wyjdź i zatrzaśnij', desc: 'Najwyżej zadzwonią.', time: 0, cost: 0, defects: [{ label: 'drzwi niesprawdzone', sev: 3, vis: 0.2 }], fx: 'door-untested' } ] },
      ],
    },
    plytki: {
      id: 'plytki', title: 'Płytki w łazience', place: 'Łazienka', base: 560, deadline: 50,
      intro: 'Stare płytki odpadły przy prysznicu. Klient chce nowych: równych, szczelnych i „żeby ładnie wyglądało na zdjęciach”.',
      steps: [
        { id: 'podloze', name: 'Przygotuj podłoże', hint: 'Płytki są tak dobre jak ściana pod nimi.', options: [
          { id: 'dobrze', label: 'Wyrównaj, odkurz, zagruntuj', desc: 'Klej będzie miał się czego trzymać.', time: 8, cost: 25, defects: [], fx: 'base-good' },
          { id: 'skrot', label: 'Odkurz', desc: 'Pył to też podłoże.', time: 3, cost: 0, defects: [{ label: 'płytki odejdą przez pył', sev: 3, vis: 0.1 }], fx: 'base-quick' },
          { id: 'fusz', label: 'Układaj na brudnym', desc: 'Klej wszystko zniesie.', time: 0, cost: 0, defects: [{ label: 'brak przygotowania podłoża', sev: 5, vis: 0.1 }], fx: 'base-none' } ] },
        { id: 'hydro', name: 'Hydroizolacja', hint: 'Prysznic to nie to samo, co salon.', options: [
          { id: 'dobrze', label: 'Dwie warstwy i taśma w narożnikach', desc: 'Nic nie przesiąknie.', time: 8, cost: 40, defects: [], fx: 'hydro-good' },
          { id: 'skrot', label: 'Jedna warstwa', desc: 'Raczej wystarczy.', time: 4, cost: 20, defects: [{ label: 'cienka hydroizolacja pod prysznicem', sev: 3, vis: 0.05, hazard: 0.1 }], fx: 'hydro-thin' },
          { id: 'fusz', label: 'Pomiń, płytki są wodoodporne', desc: 'Płytki są. Szczeliny też.', time: 0, cost: 0, defects: [{ label: 'brak hydroizolacji, woda pójdzie do sąsiada', sev: 6, vis: 0.05, hazard: 0.15 }], fx: 'hydro-none' } ] },
        { id: 'klej', name: 'Nałóż klej', hint: 'Cała płytka ma leżeć na kleju, nie na pustkach.', options: [
          { id: 'dobrze', label: 'Grzebień, równa warstwa', desc: 'Żadnych pustych miejsc.', time: 6, cost: 30, skill: true, defects: [], fx: 'glue-comb' },
          { id: 'skrot', label: 'Szpachlą, bez grzebienia', desc: 'Szybciej, ale grudki.', time: 3, cost: 30, skill: true, defects: [{ label: 'puste przestrzenie pod płytkami', sev: 3, vis: 0.1 }], fx: 'glue-blob' },
          { id: 'fusz', label: 'Plamy co trzecią płytkę', desc: 'Oszczędność kleju.', time: 1, cost: 15, defects: [{ label: 'płytki na plamach kleju', sev: 4.5, vis: 0.1 }], fx: 'glue-sparse' } ] },
        { id: 'uklad', name: 'Układanie płytek', hint: 'Tu widać wszystko. Każdy ukośny milimetr.', options: [
          { id: 'dobrze', label: 'Poziomica, krzyżyki, sznurek', desc: 'Idealnie prosto.', time: 12, cost: 0, skill: true, defects: [], fx: 'lay-level' },
          { id: 'skrot', label: 'Na oko, krzyżyki', desc: 'Prawie prosto.', time: 6, cost: 0, skill: true, defects: [{ label: 'płytki lekko nierówne', sev: 3, vis: 0.6 }], fx: 'lay-eye' },
          { id: 'fusz', label: 'Układaj szybko, jak leci', desc: 'Pasuje, nie pasuje.', time: 3, cost: 0, skill: true, defects: [{ label: 'krzywe płytki, różne fugi', sev: 5, vis: 1 }], fx: 'lay-crooked' } ] },
        { id: 'fuga', name: 'Fugowanie', hint: 'Fuga nie jest ozdobą, tylko szczelnością.', options: [
          { id: 'dobrze', label: 'Fuga po dobie, zmycie nadmiaru', desc: 'Czysto i szczelnie.', time: 6, cost: 15, defects: [], fx: 'grout-good' },
          { id: 'skrot', label: 'Fuga od razu', desc: 'Klej jeszcze pracuje.', time: 3, cost: 15, defects: [{ label: 'fuga popęka', sev: 2.5, vis: 0.2 }], fx: 'grout-fast' },
          { id: 'fusz', label: 'Bez fugi, trzymają się same', desc: 'Przecież się nie ruszą.', time: 0, cost: 0, defects: [{ label: 'brak fugi', sev: 4, vis: 0.9 }], fx: 'grout-none' } ] },
        { id: 'silikon', name: 'Silikon i próba szczelności', hint: 'Narożniki pracują, fuga tam pęknie.', options: [
          { id: 'dobrze', label: 'Silikon sanitarny i próba wodą', desc: 'Woda nie wyjdzie.', time: 4, cost: 12, defects: [], fx: 'sil-good' },
          { id: 'skrot', label: 'Silikon bez próby', desc: 'Pewnie szczelny.', time: 2, cost: 12, defects: [{ label: 'brak próby szczelności prysznica', sev: 2, vis: 0.1 }], fx: 'sil-quick' },
          { id: 'fusz', label: 'Silikon „kiedyś”', desc: 'Narożniki same się zasklepią.', time: 0, cost: 0, defects: [{ label: 'brak silikonu w narożnikach', sev: 3, vis: 0.6 }], fx: 'sil-none' } ] },
      ],
    },
  };

  /* Niespodzianki w trakcie roboty: po ukończeniu kroku `after` (od 0) z szansą `chance` wychodzi problem, który trzeba rozwiązać.
   * Opcje mają czas, koszt, wady (jak w krokach) i opcjonalny token sceny. */
  const SURPRISES = {
    kran: [{ id: 'zawor', after: 0, chance: 0.3, title: 'Zawór pod zlewem jest przerdzewiały', text: 'Przy zakręcaniu zawór chrupnął. Wygląda na to, że siedzi na ostatnim gwincie.', options: [
      { id: 'dobrze', label: 'Wymień zawór (25 zł)', desc: 'Dłużej, ale na lata.', time: 6, cost: 25, defects: [] },
      { id: 'skrot', label: 'Dokręć mocniej', desc: 'Przecież trzyma.', time: 1, cost: 0, defects: [{ label: 'zawór pęknie przy następnym zakręceniu', sev: 3.5, vis: 0.1 }] },
      { id: 'fusz', label: 'Udawaj, że nie widzisz', desc: 'Klient i tak nie zagląda pod zlew.', time: 0, cost: 0, defects: [{ label: 'przerdzewiały zawór pod zlewem', sev: 4, vis: 0.2 }] } ] }],
    sciana: [{ id: 'kabel', after: 1, chance: 0.3, title: 'W ścianie biegnie kabel', text: 'Pod gipsem widać biały przewód biegnący przez dziurę. Nie wiesz, czy jest pod napięciem.', options: [
      { id: 'dobrze', label: 'Sprawdź wykrywaczem i obejdź', desc: 'Dobrze, że był.', time: 5, cost: 0, defects: [] },
      { id: 'skrot', label: 'Zadzwoń do elektryka (80 zł)', desc: 'Przyjeżdża za godzinę.', time: 4, cost: 80, defects: [] },
      { id: 'fusz', label: 'Zaszpachluj bez sprawdzania', desc: 'Co oczy nie widzą…', time: 0, cost: 0, defects: [{ label: 'kabel zalany gipsem', sev: 4, vis: 0.05, hazard: 0.5 }] } ] }],
    gniazdko: [{ id: 'alu', after: 0, chance: 0.35, title: 'Przewody w puszce są aluminiowe', text: 'Stara instalacja. Aluminium z miedzią się nie lubi, a ty masz tylko zwykłe złączki.', options: [
      { id: 'dobrze', label: 'Złączki Al-Cu (20 zł)', desc: 'Specjalne złączki robią robotę.', time: 6, cost: 20, defects: [] },
      { id: 'skrot', label: 'Odłóż i powiedz klientowi', desc: 'Naprawisz resztę, ale zaznaczysz ryzyko.', time: 2, cost: 0, defects: [{ label: 'zostaje stara aluminiowa instalacja', sev: 2, vis: 0.4 }] },
      { id: 'fusz', label: 'Skręć jak jest', desc: 'Miedź z aluminium, ślub idealny.', time: 0, cost: 0, defects: [{ label: 'miedź skręcona z aluminium', sev: 5, vis: 0.05, hazard: 0.6 }] } ] }],
    polka: [{ id: 'gk', after: 1, chance: 0.3, title: 'Ściana to płyta g-k, a nie mur', text: 'Wiertło weszło zbyt łatwo. Zwykłe kołki nie utrzymają ciężaru.', options: [
      { id: 'dobrze', label: 'Kołki do płyt (10 zł)', desc: 'Motylkowe trzymają.', time: 4, cost: 10, defects: [] },
      { id: 'skrot', label: 'Przenieś półkę na słup', desc: 'Szukasz profilu stelaża.', time: 3, cost: 0, defects: [{ label: 'półka w innym miejscu niż ustalono', sev: 1, vis: 0.5 }] },
      { id: 'fusz', label: 'Zwykłe kołki i jakoś', desc: 'Płyta wytrzyma.', time: 0, cost: 0, defects: [{ label: 'półka wyrwie płytę g-k', sev: 5, vis: 0.1, hazard: 0.3 }] } ] }],
    syfon: [{ id: 'rdza', after: 1, chance: 0.35, title: 'Rura pod zlewem jest przerdzewiała', text: 'Po odkręceniu syfonu kolano osypało się w palcach.', options: [
      { id: 'dobrze', label: 'Wymień kolano (12 zł)', desc: 'Nowe, gładkie, szczelne.', time: 6, cost: 12, defects: [] },
      { id: 'skrot', label: 'Owiń taśmą', desc: 'Wystarczy na teraz.', time: 2, cost: 3, defects: [{ label: 'rdza przebije za miesiąc', sev: 3.5, vis: 0.1 }] },
      { id: 'fusz', label: 'Udawaj, że nie widzisz', desc: 'Nie ruszaj, nie cieknie.', time: 0, cost: 0, defects: [{ label: 'przerdzewiała rura pod zlewem', sev: 4, vis: 0.3, hazard: 0.2 }] } ] }],
    drzwi: [{ id: 'puchnie', after: 0, chance: 0.35, title: 'Ościeżnica spuchła od wilgoci', text: 'Drewno jest wilgotne i miękkie. Samo dokręcenie niczego nie zmieni.', options: [
      { id: 'dobrze', label: 'Osusz i zaimpregnuj (18 zł)', desc: 'Najpierw wysycha, potem dopasujesz.', time: 7, cost: 18, defects: [] },
      { id: 'skrot', label: 'Zeszlifuj, ile się da', desc: 'Prawie w tolerancji.', time: 3, cost: 0, defects: [{ label: 'ościeżnica dalej wilgotna', sev: 3, vis: 0.3 }] },
      { id: 'fusz', label: 'Zignoruj', desc: 'Jakoś będzie.', time: 0, cost: 0, defects: [{ label: 'spuchnięta ościeżnica', sev: 4, vis: 0.6 }] } ] }],
    plytki: [
      { id: 'plesn', after: 0, chance: 0.4, title: 'Pod starymi płytkami pleśń', text: 'Za odpadniętymi płytkami ściana jest czarna i wilgotna.', options: [
        { id: 'dobrze', label: 'Skuj, osusz, zagruntuj (30 zł)', desc: 'Pleśń znika razem z tynkiem.', time: 10, cost: 30, defects: [] },
        { id: 'skrot', label: 'Spryskaj środkiem grzybobójczym', desc: 'Pachnie chlorem. Nie tylko.', time: 3, cost: 15, defects: [{ label: 'pleśń wróci pod płytkami', sev: 3.5, vis: 0.2 }] },
        { id: 'fusz', label: 'Zalep nowymi płytkami', desc: 'Ściana swoje, płytki swoje.', time: 0, cost: 0, defects: [{ label: 'pleśń zamurowana pod płytkami', sev: 5, vis: 0.05, hazard: 0.1 }] } ] },
      { id: 'serie', after: 3, chance: 0.3, title: 'Zabrakło płytek z jednej serii', text: 'Zostało pięć sztuk, a do końca ściany trzeba osiem. Nowa partia ma inny odcień.', options: [
        { id: 'dobrze', label: 'Pojedź po dodatkowe (kurier 60 zł)', desc: 'Z tej samej serii, jeśli jest.', time: 8, cost: 60, defects: [] },
        { id: 'skrot', label: 'Docinaj mniejsze', desc: 'Dużo cienkich docinek.', time: 3, cost: 0, defects: [{ label: 'dużo cienkich docinek na ścianie', sev: 2, vis: 0.6 }] },
        { id: 'fusz', label: 'Połącz serie', desc: 'Odcień „ciepły i zimny”.', time: 1, cost: 0, defects: [{ label: 'dwa odcienie płytek na jednej ścianie', sev: 2.5, vis: 0.9 }] } ] },
    ],
  };
  /* Losuje niespodziankę po ukończeniu kroku (indeks od 0). Zwraca obiekt albo null. */
  function rollSurprise(jobId, doneStep, rng) {
    const l = SURPRISES[jobId] || [], x = l.find(s => s.after === doneStep);
    return x && rng() < x.chance ? x : null;
  }

  // kolejność poziomów: zlecenie + klient + mnożnik wypłaty + pora (dzień lub noc) i godzina rozpoczęcia.
  // Zlecenia nocne (22:00–06:00) płacą więcej (dopłata), ale są ryzykowniejsze: ciemno, zaspany klient, więcej wypadków i kontroli.
  const LEVELS = [
    { job: 'kran', client: 'mirek', mult: 1, slot: 'dzien', time: '09:00' },
    { due: 'normalny', job: 'polka', client: 'karyna', mult: 1.1, slot: 'dzien', time: '13:00' },
    { job: 'sciana', client: 'sebix', mult: 1.2, slot: 'dzien', time: '08:30' },
    { due: 'ostry', job: 'kran', client: 'grazyna', mult: 1.4, slot: 'noc', time: '23:00', intro: 'Pani Grażyna dzwoni o 23:00: kran w łazience się rozerwał i woda leje się na sąsiada z dołu. „Niech pan przyjedzie natychmiast!”' },
    { due: 'ostry', job: 'gniazdko', client: 'mirek', mult: 1.5, slot: 'noc', time: '01:30', intro: 'Pan Mirek budzi cię po pierwszej w nocy: gniazdko w kuchni iskrzy i pachnie spalenizną. „Ale tylko szybko, bo jutro do pracy.”' },
    { job: 'sciana', client: 'tesciowa', mult: 1.7, slot: 'dzien', time: '10:00' },
    { due: 'normalny', job: 'gniazdko', client: 'grazyna', mult: 2, slot: 'noc', time: '22:30', intro: 'Pani Grażyna po zmroku: „Wyłączyło prąd w całym mieszkaniu, a w kuchni coś bzyczy. Czy może pan przyjechać dziś?”' },
    { due: 'normalny', job: 'polka', client: 'heniek', mult: 2.2, slot: 'dzien', time: '14:00' },
    { job: 'kran', client: 'sebix', mult: 1.6, slot: 'dzien', time: '07:30' },
    { due: 'normalny', job: 'gniazdko', client: 'tesciowa', mult: 1.8, slot: 'dzien', time: '11:00' },
    { due: 'ostry', job: 'polka', client: 'grazyna', mult: 1.8, slot: 'noc', time: '22:15', intro: 'Pani Grażyna po zmroku: „Półka spadła i obudziła wnuka. Może pan od razu, zanim zasnę?”' },
    { job: 'sciana', client: 'heniek', mult: 2.4, slot: 'dzien', time: '09:30' },
    { due: 'ostry', job: 'kran', client: 'heniek', mult: 2.6, slot: 'noc', time: '00:30', intro: 'Pan Heniek o wpół do pierwszej: „Ja tego nie robię po nocach, ale ten kran robi mi wannę w piwnicy.”' },
    { job: 'gniazdko', client: 'karyna', mult: 2.4, slot: 'dzien', time: '15:30' },
    { due: 'normalny', job: 'sciana', client: 'karyna', mult: 2.2, slot: 'noc', time: '23:30', intro: 'Karyna pisze o 23:30: „Jutro robię relację z remontu, a w ścianie dziura. Przyjedziesz dziś?”' },
    { due: 'ostry', job: 'polka', client: 'tesciowa', mult: 2.8, slot: 'dzien', time: '12:00' },
    { job: 'syfon', client: 'mirek', mult: 1.2, slot: 'dzien', time: '10:30' },
    { job: 'drzwi', client: 'sebix', mult: 1.3, slot: 'dzien', time: '09:15', due: 'normalny' },
    { job: 'syfon', client: 'grazyna', mult: 1.8, slot: 'noc', time: '22:45', intro: 'Pani Grażyna dzwoni o 22:45: „Zlew stoi i śmierdzi, a jutro mam gości. Przyjedzie pan dziś?”' },
    { job: 'plytki', client: 'karyna', mult: 1.3, slot: 'dzien', time: '08:00', due: 'luzny' },
    { job: 'drzwi', client: 'heniek', mult: 2.2, slot: 'dzien', time: '13:30', due: 'ostry' },
    { job: 'plytki', client: 'tesciowa', mult: 1.6, slot: 'dzien', time: '09:00' },
    { job: 'drzwi', client: 'grazyna', mult: 2.4, slot: 'noc', time: '23:15', due: 'ostry', intro: 'Pani Grażyna o 23:15: „Zamek się zatrzasnął od środka i nie mogę wyjść na balkon. Proszę przyjechać!”' },
    { job: 'plytki', client: 'heniek', mult: 2.0, slot: 'dzien', time: '10:00', due: 'normalny' },
  ];

  /* Telefony „z ulicy”: gdy skończą się zlecenia z listy, gracz może przesuwać zegar o godzinę. Co godzinę jest szansa na telefon. */
  const CALL_BASE = { dzien: 0.22, noc: 0.08 };
  /* Szansa na telefon po godzinie czekania. Dobra ocena firmy pomaga, a każda kolejna godzina bez telefonu dodaje 4 pkt (max +20). */
  function callChance(night, stars, waited) {
    const p = CALL_BASE[night ? 'noc' : 'dzien'] + ((stars || 2.5) - 2.5) * 0.03 + Math.min(5, waited || 0) * 0.04;
    return Math.max(0.03, Math.min(0.6, p));
  }
  /* Losuje zlecenie z telefonu: rodzaj, klient i mnożnik (wyższa ocena firmy to lepsze zlecenia). */
  function rollCall(rng, stars, night) {
    const jobIds = Object.keys(JOBS), clIds = Object.keys(CLIENTS);
    const job = jobIds[Math.floor(rng() * jobIds.length)], client = clIds[Math.floor(rng() * clIds.length)];
    const mult = Math.round((0.9 + rng() * 0.7) * (0.8 + (stars || 2.5) * 0.1) * 10) / 10;
    return { job, client, mult, slot: night ? 'noc' : 'dzien', call: true };
  }


  return { callChance, rollCall, rollSurprise, SURPRISES, CLIENTS, JOBS, LEVELS };
});
