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
