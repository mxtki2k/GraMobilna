# GDD — Symulator Janusza Biznesu (idle/kliker, satyra)

Drugi tor projektu obok Arrow Escape: gra dla polskiego odbiorcy, oparta na ponadczasowych archetypach
(majster, klient, szwagier, "jakoś to będzie"). Prototyp webowy: `prototypes/janusz/index.html`
(test w polskich grupach przed budową w Godocie).

## Pętla
1. Branża daje zlecenie (klient z tekstem, robota do wykonania, zapłata). Klikasz, żeby robota postępowała.
2. Zatrudniasz ekipę (praca idle, także offline do 2 h przy 50% stawki) i kupujesz sprzęt/„rozwiązania" (x2 do roboty).
3. Przycisk „Po taniości": pół roboty, +50% zapłaty, ale +10 ryzyka kontroli.
4. Ryzyko (0–100%) spada powoli samo. Przy 100% jest **Kontrola**: płacisz kasą, tracisz pracownika albo mandat.
5. Co kilkadziesiąt sekund wypada zdarzenie z wyborem (humor + kompromis kasa/ryzyko).
6. Zarobki odblokowują kolejne branże.

## Serie (branże jako pakiety danych)
Każda branża to wpis w tabeli `BR`: nazwa, mnożnik wartości `V`, koszt odblokowania, teksty klientów i zakończeń,
4 typy pracowników, 3 sprzęty, 2 zdarzenia. Dodanie branży nie wymaga zmiany kodu pętli.

| Branża | V | Odblokowanie | Charakter |
|---|---|---|---|
| Remonty | 1 | start | złota rączka, pianka montażowa, szwagier |
| Koparka | 12 | 800 zł | wykopy, kable, „bez pozwoleń" |
| Handel autami | 150 | 12 tys. zł | komis, „Niemiec płakał", lakier w sprayu |
| Budowlanka | 2000 | 300 tys. zł | deweloper, dziennik budowy, podwykonawca podwykonawcy |

Kolejne pomysły na serie: hurtownia „ze stodoły", ogrodnictwo/działka, transport, gastronomia, pośrednictwo nieruchomości.

## Ekonomia (v0)
- Zapłata za zlecenie = robota × V × (0,8–1,25).
- Koszt pracownika = V × baza × 1,18^liczba. Stawki robót/s: 0,5 / 2,5 / 10 / 40 (x2 za każdy sprzęt).
- Symulacja bota (4 kliknięcia/s, kupuje co może): odblokowanie Koparki po ok. 6 min, Handlu autami po ok. 14 min,
  Budowlanki po ok. 30 min. Do strojenia po prawdziwych graczach.

## Monetyzacja
Rewarded: x2 zarobków na 60 s (w prototypie symulowane), szybszy powrót ekipy, zlecenie premium.
Bez wymuszonych reklam. IAP: usunięcie reklam, paczki startowe, skórki biura.

## Ryzyka
- Humor to loteria: testować teksty na ludziach, pisać w wielu tonach i wybierać najlepsze.
- Prawo/Play: bez prawdziwych marek, osób publicznych i polityki. Archetypy ogólne, satyra, konsekwencje za „kręcenie".
- Mały rynek i niższe stawki reklamowe: sukces zależy od organicznego zasięgu w polskich społecznościach.
- Retencja idle: prestiż (reset z bonusem), cele dnia i zdarzenia sezonowe jeszcze do zrobienia.

## Tryb zleceń naprawczych (prototyp `prototypes/janusz/zlecenia.html`)

Zamiast samego klikania gracz naprawia coś naprawdę zepsutego, krok po kroku, a potem ocenia go klient.

**Przebieg zlecenia:** klient opisuje problem → 4 kroki naprawy (np. odetnij wodę, wymień uszczelkę, dokręć, sprawdź szczelność) →
w każdym kroku wybór z 3 opcji: *solidnie* / *na skróty* / *fuszerka* → kroki oznaczone „na wyczucie” to mini-gra
(zatrzymaj znacznik w zielonej strefie, celność wpływa na jakość) → odbiór u klienta z oceną i fuszerometrem.

**Zlecenia (v0):** cieknący kran, dziura w ścianie, iskrzące gniazdko (zagrożenie), krzywa półka. 8 poziomów, klienci o różnej uwadze:
Pan Mirek (pobłażliwy), Karyna, Sebix, Pani Grażyna (widzi wszystko), Teściowa (nic nie jest dość dobre), Pan Heniek (fachowiec widzi też to, co ukryte).

### Moduł oceny fuszerki (`prototypes/janusz/fuszerka.js`, testy: `node tests/fuszerka.test.js`)
Każda wada ma: `sev` (poważność 0–10), `vis` (widoczność dla klienta 0–1) i `hazard` (zagrożenie 0–1).
- **Indeks fuszerki** `100·(1−e^(−Σ sev·(1+hazard) / 14))` → progi: 0–14 Solidna robota, 15–39 Na oko, 40–69 Fuszerka, 70+ Katastrofa budowlana.
- **Wady widoczne** V = Σ sev·vis, **ukryte** H = Σ sev·(1−vis), **zagrożenie** Z = Σ sev·hazard.
- **Zadowolenie klienta** `100·e^(−V·uwaga·surowość / 9)` minus kara za spóźnienie (fachowiec dolicza też połowę H). Gwiazdki = zadowolenie / 20.
- **Maskowanie** (np. „postaw szafę”): zmniejsza widoczność wcześniejszych wad. Wada nie znika, tylko staje się ukryta i wraca jako reklamacja.
- **Reklamacja po tygodniu**: szansa `1−e^(−(H+1,5·Z)/12)`; przy Z ≥ 9 to **wypadek** (większy koszt, większa utrata reputacji).
- **Wypłata** `baza·(0,4+0,6·zadowolenie)·(1,1 za szybką robotę)`, zysk = wypłata − materiały.

Dylemat gracza: fuszerka jest tańsza i szybsza, a u pobłażliwego klienta nawet wysoko oceniana, ale ukryte wady wracają.

### Do zrobienia
Więcej zleceń i scenek (hydraulika, płytki, koparka, auta), animacje narzędzi, dźwięk, połączenie z trybem idle (ekipa robi proste zlecenia),
reputacja wpływająca na napływ klientów, balans kar, więcej klientów i tekstów.

## Ekipa, pensje i nastroje (`prototypes/janusz/ekipa.js`, testy: `node tests/ekipa.test.js`)

Zatrudniasz pracowników (wpisowe = jedna pensja), a co 3 zlecenia jest **dzień wypłaty**, w którym sam rozpisujesz, kto ile dostaje.

**Pracownik:** umiejętności, solidność, pazerność, oczekiwana pensja, cierpliwość (bazowy nastrój), nastrój 0–100, zaległości.
Kandydaci: Kacper (praktykant), Szwagier Zbyszek, Zdzisiek (złota rączka), Mistrz Staszek (fachowiec).

**Wypłata:** kwota pokrywa najpierw bieżącą pensję, potem zaległości, reszta to premia. Wpływ na nastrój:
brak części pensji (mocniej u pazernych), narastające zaległości, premia, **zazdrość** (wykwalifikowany obraża się, gdy słabszy dostał więcej w złotówkach)
i powolny powrót do cierpliwości. Niedopłata zostaje jako zaległość.

**Skutki złego nastroju:**
- **Upomina się** (nastrój < 45 lub spore zaległości): zaliczka albo odmowa, odmowa dalej obniża nastrój.
- **Nie przychodzi do roboty**: szansa = (1 − solidność)·0,45 + niski nastrój. Tracisz czas, robisz sam.
- **Wystawia na robotę**: wkurzony pomocnik znika w połowie zlecenia (−6 min, bałagan jako wada widoczna, dalsza obniżka nastroju).
- **Odchodzi** po dwóch wypłatach z rzędu ze skrajnym nastrojem i zaległościami, a po osiedlu rozpowiada o tobie (reputacja −).

**Skutki dobrego nastroju:** pomocnik poprawia celność w krokach „na wyczucie” i skraca czas, a ekipa przywozi **fuchy na boku** (dochód zależny od umiejętności, nastroju i obecności).

Dylemat gracza: oszczędzanie na płacach poprawia kasę dziś, ale kosztuje jakość, terminy i ludzi jutro. Wyróżnianie jednych budzi zazdrość u pozostałych.

Do strojenia: wysokość pensji względem zleceń, częstotliwość wypłat, siła zazdrości i fuch.

## Zasada projektowa: gra systemowa, nie skryptowana

Zamiast wpisywać „zdarzenie → reakcja”, opisujemy **cechy** (ludzie, klienci, świat), **reguły** (jak cechy zamieniają się w szanse) i **pamięć**
(ślady zostające po zdarzeniach). Skutki wynikają z kombinacji, więc każda partia układa się inaczej.

Przykładowe pętle, które działają już w prototypie:
- **Wypłata → kac → kierowca po piwie:** po dniu wypłaty ludzie piją więcej, a zły nastrój też zwiększa szansę picia.
- **Kryjesz kierowcę → wdzięczność rośnie, ale i picie:** „kryj” poprawia relację, a jednocześnie karmi problem. Potrącenie z pensji daje kasę i uraz.
- **Zazdrość → uraz → nieobecności:** niesprawiedliwa wypłata zostawia ślad, który podnosi szansę, że ktoś nie przyjdzie lub cię wystawi.
- **Wpadka → patrole:** po zatrzymaniu rośnie ryzyko kolejnych kontroli, potem powoli wygasa.
- **Pracowitość:** pracowity pomocnik pomaga, ale nie lubi fuszerki. Leniwy częściej psuje po cichu, a pijany jeszcze częściej.

### Dylemat „kto zawozi” (`prototypes/janusz/swiat.js`, testy: `node tests/swiat.test.js`)
Przed każdym zleceniem z ekipą wybierasz kierowcę: ty, kurier (70 zł, bez ryzyka) albo pracownik (za darmo, z ryzykiem zależnym od jego stanu).
Pracownik może być trzeźwy, na kacu, po piwie albo pijany, ma prawo jazdy lub nie. Szanse wypadku i policji są pokazane tylko orientacyjnie.
Skutki: mandat, utrata prawa jazdy, auto na parkingu, wypadek (z reklamacją i urlopem zdrowotnym), a potem decyzja szefa: kryj / potrąć / ostrzeż / zwolnij.
Gra przedstawia to jako satyrę z konsekwencjami, bez nagradzania jazdy po alkoholu.

### Backlog mechanik w tym duchu
Karta kontaktów i „znajomości” (szwagier w urzędzie), pożyczki i lichwiarz, VAT/skarbówka i „na fakturę”, narzędzia i ich zużycie, magazyn i materiały,
sezonowość i pogoda, reputacja w osiedlu i plotki, konkurencja, bałagan i sprzątanie, przekręt w kosztorysie, prowokacje „tajemniczego klienta”.

## Siedziba firmy (`prototypes/janusz/siedziba.js`, testy: `node tests/siedziba.test.js`)

Lokale: Garaż u teścia → Blaszak → Rudera po dziadku → Biuro z placem → Hala z biurem → Siedziba przy obwodnicy.
Przeprowadzka zeruje remonty budynku (okna, drzwi, dach, ogrzewanie, szyld, alarm, kamery, ochrona fizyczna), ale bus i narzędzia z ekwipunku zostają.

**Ocena firmy (1–5 ★)** = siedziba 30% + sprzęt 15% + opinie klientów 30% + rzetelność (średnia fuszerka z ostatnich zleceń minus otwarte reklamacje) 25%.
Skutki: mnożnik wypłat 0,85–1,25 (plus popyt z szyldu), bonus do zadowolenia klientów do +8, komfort podnosi bazowy nastrój ekipy,
bus zmniejsza liczbę wypadków, utrzymanie lokalu rozlicza się w dniu wypłaty. Narzędzia nie są częścią siedziby (patrz Alledrogo).

**Kradzieże:** szansa = 8% · atrakcyjność łupu · (1 − zabezpieczenia). Im droższy bus i ekwipunek narzędzi, tym bardziej opłaca się włamanie.
Alarm, kamery (odzyskują część strat), pies, siatka i ochroniarz zmniejszają szansę (nigdy do zera, maks. 95%). Włamanie może zabrać najcenniejsze narzędzie z ekwipunku.

## Moduły fabularne i ekonomiczne

| # | Moduł | Plik | Co robi |
|---|---|---|---|
| 1 | Kalendarz i sezony | `kalendarz.js` | 12 dni na sezon, popyt na różne roboty zależny od pory roku, opóźnienia pogodowe, zimny lokal obniża nastrój ekipy |
| 2 | Pożyczki i lichwiarz | `finanse.js` | Bank (4%), kuzyn (8%), Pan Gienek (25%), raty co dzień wypłaty, windykacja i komornik przy zaległościach |
| 3 | Skarbówka i faktury | `finanse.js`, `umowa.js` | Podatek 10% od faktur, ukryte przychody podnoszą ryzyko kontroli, księgowa i znajomości łagodzą karę |
| 4 | Znajomości | `osiedle.js` | Szwagier w urzędzie, Waldek z hurtowni, dzielnicowy, sąsiad: przysługi budują dług wdzięczności |
| 5 | Plotki | `osiedle.js` | Renoma na osiedlu zmienia wypłaty, gadatliwi klienci (Karyna, Grażyna) wzmacniają efekt |
| 6 | Konkurencja | `osiedle.js` | Bogdan-Bud rośnie, zbija ceny, podkupuje niezadowolonych, mści się za rozdrażnienie |
| 7 | Zużycie i serwis narzędzi | `alledrogo.js` | Stan każdego narzędzia, serwis, awarie w trakcie zlecenia |
| 8 | Umowa i kosztorys | `umowa.js` | Faktura, kosztorys uczciwy/zawyżony/zaniżony, termin „na wczoraj” |
| 9 | Tajemniczy klient | `fabula.js` | Inspektor jakości pod przykrywką: kara za fuszerkę albo premia za rzetelność |
| 10 | Fabuła „Spadek po dziadku” | `fabula.js` | 9 scen z warunkami i wyborami, flagi zmieniają kolejne sceny, 4 zakończenia |

Testy: `node tests/moduly.test.js` (kalendarz, umowa, finanse, osiedle, fabuła, spięcia między modułami).
Fabuła odpala sceny z warunków: liczba zleceń, ocena firmy, plotki, długi, ryzyko skarbowe oraz wcześniejsze wybory
(np. Kacper zdobywa prawo jazdy, donos do skarbówki, Pani Basia, oferta „pana z Warszawy”).

Zakończenia: Holding Bogdana (sprzedałeś ziemię), Uczciwy majster (ocena ≥ 4 i mała fuszerka), Król fuszerki (duża siedziba i niska ocena), Janusz Biznesu klasyczny.

## Alledrogo: giełda narzędzi (`prototypes/janusz/alledrogo.js`, testy: `node tests/alledrogo.test.js`)

Aplikacja w grze (parodia serwisu ogłoszeniowego, nazwa fikcyjna). Kupujesz narzędzia nowe i używane, a każde pomaga przy konkretnych zleceniach:
wiertarka (półka, ściana), poziomica (półka), klucze do rur (kran), szlifierka i szpachle (ściana), miernik napięcia (gniazdko, zmniejsza zagrożenie wad).

**Oferty:** klasy nowe / jak nowe / używane / po przejściach / na części, trzy poziomy jakości, siedmiu sprzedawców o różnej uczciwości.
Gracz widzi opis, deklarowaną klasę, cenę, ocenę sprzedawcy (kłamcy mają niewiele gorszą, bo opinie „się kupuje”) i cenę nowego. Prawda jest ukryta:
prawdziwy stan, żywotność w zleceniach, ukryta wada, podróbka. Kłamcy zaniżają cenę o kilkanaście procent, co jest słabym sygnałem. Można zadać pytanie sprzedawcy
(uczciwy ujawni wadę, nieuczciwy się wymiga) albo licytować (konkurent ma ukryty limit).

**Dostawa:** paczka idzie 1–3 zleceń, może zaginąć (zwrot 90%) albo przyjść pognieciona. Rozpakowanie pokazuje stan widoczny na oko, ale nie ukrytą wadę ani podróbkę.

**Zużycie i awarie:** każde użycie zmniejsza stan i żywotność. Szansa awarii w trakcie roboty rośnie przy ukrytej wadzie (w pierwszym użyciu),
krótkiej żywotności i niskim stanie. Awaria kosztuje 4 minuty i dokłada wadę do oceny zlecenia. Premia narzędzia maleje ze stanem, podróbka obniża poziom.

**Spór i sprzedaż:** sklep zwykle oddaje pieniądze w okresie ochrony, prywatny rzadko. Sprzedając, możesz opisać uczciwie albo naciągnąć kupca (więcej kasy,
ale wadliwy towar daje skargę, zwrot i spadek plotek).

**Spięcia z resztą:** ekwipunek podnosi atrakcyjność i szansę kradzieży siedziby, a złodziej może zabrać najcenniejszy przedmiot. Kamery i alarm chronią też narzędzia z Alledrogo.

### Jeden system narzędzi (po unifikacji)
Narzędzia istnieją wyłącznie jako **przedmioty w ekwipunku** (`alledrogo.js`). Siedziba trzyma już tylko budynek i bus.
- Zestaw ręczny pasuje do wszystkich zleceń, narzędzia specjalistyczne do wybranych. Premia zależy od poziomu i stanu, zepsute nie liczą się wcale.
- **Pokrycie zleceń** (premia do celności i skrócenie czasu dla każdego rodzaju zlecenia) oraz **jakość ekwipunku** (0–100%) są widoczne w Alledrogo, a jakość wchodzi do oceny firmy (połowa składnika „sprzęt”, druga połowa to bus).
- **Serwis** w Alledrogo: sprawne narzędzie wraca do 100% stanu, zepsute naprawia się z 60% szansą (usuwa też ukrytą wadę), a nieudana naprawa kosztuje.
- **Walizka dziadka** ze sceny „Spadek” trafia do ekwipunku jako zestaw ręczny.
- Stare zapisy z poziomem narzędzi w siedzibie zamieniają się w przedmiot „Zestaw z siedziby”.
