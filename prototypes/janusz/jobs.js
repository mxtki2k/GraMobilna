/* Dane zleceń: klienci, naprawy (kroki z opcjami), scenki SVG i kolejność poziomów.
 * Każda opcja: { id, label, desc, time, cost, skill?, mask?, defects[], fx }.
 *   skill = true  -> krok wykonywany w mini-grze na wyczucie (celność wpływa na jakość),
 *   fx            -> token stanu scenki (patrz data-show / data-hide w SVG). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Jobs = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const CLIENTS = {
    mirek: { id: 'mirek', name: 'Pan Mirek', em: '🧔', attention: 0.35, strict: 0.7, expert: false, note: 'Patrzy, czy działa. Reszta go nie obchodzi.',
      lines: {
        5: ['No pięknie, jak u Niemca.', 'Działa! Zapraszam na kawę.'],
        4: ['Dobrze, dobrze. Może być.', 'Ujdzie w tłoku, tfu, w porządku.'],
        3: ['No… działa. Mniej więcej.', 'Zapłacę, ale bez entuzjazmu.'],
        2: ['Coś mi tu nie pasuje, ale nie wiem co.', 'Hm. Szwagier by zrobił lepiej.'],
        1: ['To ma tak wyglądać?!', 'Oddaj mi pieniądze albo zadzwonię do szwagra.'] } },
    karyna: { id: 'karyna', name: 'Karyna', em: '💅', attention: 0.8, strict: 1.0, expert: false, note: 'Zrobi zdjęcie i wrzuci do internetu.',
      lines: {
        5: ['Idealnie! Zostawię pięć gwiazdek.', 'Ooo, jak z katalogu!'],
        4: ['Jest ładnie, tylko trochę widać ślady.', 'Okej, polecę znajomym. Może.'],
        3: ['No jest… takie sobie.', 'Zrobię zdjęcie i zapytam internet.'],
        2: ['Przecież to widać!', 'Wrzucam to na grupę osiedlową.'],
        1: ['Tragedia! Wszyscy się dowiedzą.', 'To jest skandal. Zdjęcia już poszły.'] } },
    sebix: { id: 'sebix', name: 'Sebix', em: '🧢', attention: 0.6, strict: 0.9, expert: false, note: 'Chce tanio i „żeby wyglądało”.',
      lines: {
        5: ['Git, brachu. Dobra robota.', 'Elegancko, wypłata leci.'],
        4: ['Spoko, może być.', 'Dobra, zostaw wizytówkę.'],
        3: ['No nie wiem, ale niech będzie.', 'Mogło być lepiej, ale kasę dam.'],
        2: ['Ej, tu coś nie gra.', 'Za to bym nie płacił, ale płacę.'],
        1: ['Ty chyba sobie żartujesz.', 'Zwrot kasy, bo zadzwonię do kumpli.'] } },
    grazyna: { id: 'grazyna', name: 'Pani Grażyna', em: '👵', attention: 0.95, strict: 1.2, expert: false, note: 'Widzi wszystko. Naprawdę wszystko.',
      lines: {
        5: ['Dziękuję, panie majster, bardzo ładnie.', 'Wreszcie ktoś, kto robi jak trzeba.'],
        4: ['Dobrze, ale ja bym jeszcze poprawiła.', 'Prawie dobrze. Prawie.'],
        3: ['No nie jest to najlepsze.', 'Przecież widzę, że krzywo.'],
        2: ['Co to ma być?! Przecież ja widzę!', 'Pan to nazywa naprawą?'],
        1: ['Skandal! Dzwonię do administracji!', 'Takiego fuszera jeszcze nie widziałam!'] } },
    tesciowa: { id: 'tesciowa', name: 'Teściowa', em: '👩‍🦳', attention: 1.0, strict: 1.4, expert: false, note: 'Nic nie jest wystarczająco dobre.',
      lines: {
        5: ['No. W końcu. Ale i tak bym zrobiła inaczej.', 'Może być. Nie powiem córce.'],
        4: ['Ujdzie. Za moich czasów robiło się lepiej.', 'No dobrze. Ale pan się nie zadufa.'],
        3: ['Nie tak. Jeszcze raz.', 'Zięć by to zrobił lepiej.'],
        2: ['Wstyd, no wstyd.', 'Powiem wszystkim sąsiadkom.'],
        1: ['Wyjdź! I nie wracaj!', 'Moja córka o tym usłyszy.'] } },
    heniek: { id: 'heniek', name: 'Pan Heniek', em: '👷', attention: 1.0, strict: 1.3, expert: true, note: 'Fachowiec na emeryturze. Widzi też to, co ukryte.',
      lines: {
        5: ['Młody, ty masz rękę. Szanuję.', 'No, zrobione jak się patrzy.'],
        4: ['Dobra robota, tylko tu dałbym inaczej.', 'Solidnie. Prawie jak ja.'],
        3: ['Wiem, co tu jest pod spodem. Nie chwal się.', 'Takie „na oko” za moich czasów lądowało w śmietniku.'],
        2: ['Ja to wszystko widzę, synu.', 'Zakryłeś, ale ja i tak wiem, co tam jest.'],
        1: ['Hańba. Idę po poziomicę i pogadamy.', 'To nie naprawa, to zbrodnia.'] } },
  };

  // ---------- scenki SVG (320x200). data-show / data-hide: tokeny stanu rozdzielone znakiem | ----------
  const SCENE_KRAN = `
<rect width="320" height="200" fill="#cfd8dc"/>
<g stroke="#b6c3ca" stroke-width="1"><path d="M0 40h320M0 80h320M0 120h320"/><path d="M80 0v150M160 0v150M240 0v150"/></g>
<rect y="150" width="320" height="50" fill="#8d99a3"/>
<path d="M60 150h200v12q0 26-26 26h-148q-26 0-26-26z" fill="#eceff1" stroke="#90a4ae" stroke-width="3"/>
<rect x="146" y="64" width="24" height="70" rx="4" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
<rect x="146" y="58" width="68" height="18" rx="6" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
<rect x="202" y="58" width="12" height="30" rx="4" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
<g data-show="broken" data-hide="seal-new|seal-old|tape|glue|woda-off">
  <circle class="drip" cx="208" cy="100" r="4" fill="#4fc3f7"/><circle class="drip d2" cx="208" cy="118" r="3" fill="#4fc3f7"/>
</g>
<ellipse data-show="flood" cx="160" cy="182" rx="116" ry="12" fill="#4fc3f7" opacity=".75"/>
<g data-show="woda-off"><circle cx="40" cy="50" r="16" fill="#66bb6a" stroke="#2e7d32" stroke-width="3"/><path d="M32 50l6 6 12-14" stroke="#fff" stroke-width="4" fill="none"/></g>
<rect data-show="seal-new" x="144" y="112" width="28" height="7" rx="3" fill="#ef8f2d"/>
<rect data-show="seal-old" x="144" y="112" width="28" height="7" rx="3" fill="#4e4e4e"/>
<g data-show="tape"><rect x="143" y="96" width="34" height="18" rx="3" fill="#fafafa" stroke="#bdbdbd"/><path d="M146 100l28 0M146 106l28 0M146 111l28 0" stroke="#d0d0d0"/></g>
<g data-show="glue"><rect x="132" y="130" width="60" height="22" fill="#b5523b" stroke="#7a2f20" stroke-width="2"/><ellipse cx="160" cy="124" rx="26" ry="10" fill="#f6d55c" stroke="#c9a400" stroke-width="2"/></g>`;

  const SCENE_SCIANA = `
<rect width="320" height="200" fill="#d7ccc8"/>
<rect y="168" width="320" height="32" fill="#a1887f"/><rect y="164" width="320" height="6" fill="#efebe9"/>
<rect data-show="paint-full" width="320" height="164" fill="#bcd2c8"/>
<g data-show="broken" data-hide="plaster-good|plaster-thick|foam|wardrobe">
  <polygon points="118,64 168,52 204,78 196,128 150,142 114,112" fill="#4e342e" stroke="#3e2723" stroke-width="3"/>
  <polygon points="134,76 166,70 184,88 178,112 150,120 132,104" fill="#3e2723"/>
</g>
<g data-show="plaster-good"><polygon points="118,64 168,52 204,78 196,128 150,142 114,112" fill="#efebe9" stroke="#e0d8d4" stroke-width="2"/></g>
<g data-show="plaster-thick"><polygon points="118,64 168,52 204,78 196,128 150,142 114,112" fill="#efebe9" stroke="#bcaaa4" stroke-width="3"/><path d="M130 80l24 18-10 20M170 70l8 26" stroke="#a1887f" stroke-width="2" fill="none"/></g>
<g data-show="foam"><ellipse cx="158" cy="98" rx="48" ry="40" fill="#f5d76e" stroke="#c9a400" stroke-width="2"/><path d="M130 90l18 6M170 112l20-6" stroke="#c9a400" stroke-width="2"/></g>
<g data-show="sand-none"><circle cx="140" cy="84" r="5" fill="#d7ccc8"/><circle cx="180" cy="104" r="6" fill="#d7ccc8"/><circle cx="156" cy="122" r="4" fill="#d7ccc8"/></g>
<polygon data-show="paint-patch" points="118,64 168,52 204,78 196,128 150,142 114,112" fill="#c9b8a3" stroke="#b8a68f" stroke-width="2" opacity=".95"/>
<g data-show="wardrobe"><rect x="92" y="34" width="132" height="132" rx="4" fill="#8d6e63" stroke="#5d4037" stroke-width="4"/><path d="M158 34v132" stroke="#5d4037" stroke-width="3"/><circle cx="148" cy="100" r="4" fill="#d7ccc8"/><circle cx="168" cy="100" r="4" fill="#d7ccc8"/></g>`;

  const SCENE_GNIAZDKO = `
<rect width="320" height="200" fill="#cfd8dc"/>
<rect y="150" width="320" height="50" fill="#8d99a3"/>
<rect x="120" y="50" width="80" height="80" rx="10" fill="#fafafa" stroke="#b0bec5" stroke-width="3" data-hide="outlet-glue|outlet-new"/>
<g data-show="outlet-new"><rect x="120" y="50" width="80" height="80" rx="10" fill="#ffffff" stroke="#90a4ae" stroke-width="3"/><circle cx="145" cy="90" r="7" fill="#37474f"/><circle cx="175" cy="90" r="7" fill="#37474f"/></g>
<g data-show="outlet-glue"><g transform="rotate(-9 160 90)"><rect x="120" y="50" width="80" height="80" rx="10" fill="#f0f0f0" stroke="#b0bec5" stroke-width="3"/><circle cx="145" cy="90" r="7" fill="#37474f"/><circle cx="175" cy="90" r="7" fill="#37474f"/></g><ellipse cx="204" cy="132" rx="14" ry="6" fill="#f6d55c"/></g>
<g data-hide="outlet-glue|outlet-new"><circle cx="145" cy="90" r="7" fill="#37474f"/><circle cx="175" cy="90" r="7" fill="#37474f"/></g>
<g data-show="broken|outlet-old"><circle cx="198" cy="58" r="22" fill="#3e2723" opacity=".55"/><circle cx="125" cy="118" r="12" fill="#3e2723" opacity=".5"/></g>
<g data-show="broken|spark" data-hide="outlet-new|outlet-old|outlet-glue"><path class="spark" d="M160 60l-12 24 14-4-10 26 28-34-16 4z" fill="#ffd54f" stroke="#ff8f00" stroke-width="2"/></g>
<g data-show="spark" data-hide="outlet-new|outlet-old|outlet-glue"><path class="spark s2" d="M104 70l-10 14 10-2z" fill="#ffd54f"/><path class="spark s2" d="M214 100l12 8-12 2z" fill="#ffd54f"/></g>
<g data-show="cable-twist"><path d="M160 130v24" stroke="#37474f" stroke-width="6"/><rect x="146" y="150" width="28" height="12" rx="4" fill="#212121"/></g>
<g data-show="prad-off"><circle cx="40" cy="40" r="16" fill="#66bb6a" stroke="#2e7d32" stroke-width="3"/><path d="M32 40l6 6 12-14" stroke="#fff" stroke-width="4" fill="none"/></g>`;

  const SCENE_POLKA = `
<rect width="320" height="200" fill="#d7ccc8"/>
<rect y="176" width="320" height="24" fill="#a1887f"/>
<g data-show="broken" data-hide="shelf-on"><g transform="rotate(-14 160 90)"><rect x="70" y="86" width="180" height="12" rx="2" fill="#a47551" stroke="#6d4c33" stroke-width="2"/></g><circle cx="76" cy="92" r="4" fill="#8d99a3"/></g>
<g data-show="shelf-on">
  <g data-show="level-good"><rect x="70" y="86" width="180" height="12" rx="2" fill="#a47551" stroke="#6d4c33" stroke-width="2"/></g>
  <g data-show="level-eye"><g transform="rotate(-3 160 92)"><rect x="70" y="86" width="180" height="12" rx="2" fill="#a47551" stroke="#6d4c33" stroke-width="2"/></g></g>
  <g data-show="level-bad"><g transform="rotate(-8 160 92)"><rect x="70" y="86" width="180" height="12" rx="2" fill="#a47551" stroke="#6d4c33" stroke-width="2"/></g></g>
</g>
<g data-show="book"><rect x="90" y="104" width="46" height="14" fill="#c62828" stroke="#7f0000" stroke-width="2"/></g>
<g data-show="load-ok"><rect x="100" y="56" width="20" height="30" fill="#3949ab"/><rect x="122" y="62" width="16" height="24" fill="#ef6c00"/><ellipse cx="206" cy="72" rx="14" ry="14" fill="#80cbc4"/></g>
<g data-show="load-heavy">
  <rect x="86" y="44" width="26" height="42" fill="#3949ab"/><rect x="112" y="52" width="22" height="34" fill="#ef6c00"/><rect x="134" y="40" width="26" height="46" fill="#6a1b9a"/>
  <rect x="162" y="56" width="22" height="30" fill="#2e7d32"/><rect x="186" y="46" width="30" height="40" fill="#c62828"/><circle cx="232" cy="68" r="16" fill="#80cbc4"/>
</g>`;

  const JOBS = {
    kran: {
      id: 'kran', title: 'Cieknący kran', place: 'Łazienka', base: 220, deadline: 26, scene: SCENE_KRAN,
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
      id: 'sciana', title: 'Dziura w ścianie', place: 'Pokój', base: 300, deadline: 40, scene: SCENE_SCIANA,
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
      id: 'gniazdko', title: 'Iskrzące gniazdko', place: 'Kuchnia', base: 350, deadline: 30, scene: SCENE_GNIAZDKO,
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
      id: 'polka', title: 'Krzywa półka', place: 'Salon', base: 160, deadline: 22, scene: SCENE_POLKA,
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
