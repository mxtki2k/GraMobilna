# Plan przeniesienia „Janusza Biznesu” na Godota (Android)

Stan: prototyp w HTML/JS (`prototypes/janusz/`, ok. 465 KB: 30 modułów czystej logiki ≈ 210 KB, `zlecenia.js` UI/przepływ 146 KB, `scenes.js` 75 KB, `jobs.js` dane 62 KB, `pixel.js` 23 KB), ponad 20 plików testów i symulacji w Node.
Godot: w repozytorium jest już projekt „Storm Catcher” (Arrow Escape, `project.godot`, `scripts/core`). Janusz ma być osobnym projektem, żeby nie mieszać eksportów.

## 1. Decyzje do podjęcia przez człowieka (przed startem)
| # | Decyzja | Rekomendacja |
|---|---|---|
| 1 | Droga: (A) port logiki i UI na GDScript, (B) opakowanie HTML w aplikację (WebView/TWA) | A jako cel, B opcjonalnie jako szybki test na telefonie przez 1 sesję (PWA/TWA) |
| 2 | Wersja JS po cięciu | Zostaje jako laboratorium balansu (symulacje) i wersja webowa do demo |
| 3 | UI 1:1 czy przeprojektowane pod dotyk | Zachować przepływ i teksty, przeprojektować układ pod ekran 720×1280 |
| 4 | Platformy | Android najpierw (AAB, Google Play wewnętrzny test), iOS później |
| 5 | Monetyzacja (cel „na zarobek”) | Do ustalenia: nagradzane reklamy (np. ×2 premia), płatne „Kapitał startowy”, bez pay-to-win. Wymaga osobnej decyzji i polityki prywatności |
| 6 | Ocena wiekowa | Satyra z alkoholem i jazdą po pijanemu: sprawdzić wymogi Google Play (kwestionariusz IARC) przed publikacją |
| 7 | Katalog projektu | `janusz_godot/` z własnym `project.godot`, Arrow Escape bez zmian |

## 2. Zasada przewodnia: parytet zamiast „przepisania na oko”
Logika gry jest deterministyczna, gdy dostanie ten sam generator losowy. Dlatego każdy moduł portujemy **z automatycznym dowodem zgodności**:
1. **Wspólny PRNG.** `Rng.lcg(seed)` w GDScript z tymi samymi stałymi co JS (`s = (s·1664525 + 1013904223) mod 2^32`). Liczby mieszczą się w 64-bitowych int, więc wynik jest identyczny.
2. **Złote dane** (`tests/golden/<moduł>.json`) generuje skrypt Node (`tools/golden.js`): wejścia (w tym stany gry i ziarna), wyjścia i wersja modułu. Godot ładuje plik i porównuje (tolerancja 1e-9, kolejność kluczy nieistotna).
3. **Testy parytetu obrazu**: ta sama scena pixel art, te same tokeny stanu → PNG z JS i z Godota, porównanie piksel po pikselu.
4. **Testy scenariuszy**: skryptowana rozgrywka (komendy + ziarno) kończy się skrótem stanu, który musi być identyczny w JS i Godot.
Bramki: moduł jest „portem” dopiero, gdy jego plik parytetu przechodzi w Godocie headless.

### Pułapki JS → GDScript (lista kontrolna)
- `Math.round(-2.5)` to −2, a `round(-2.5)` w Godocie to −3: własny `Mathx.round_js`. To samo dla `%` z liczbami ujemnymi i `toFixed`/`toLocaleString` (format kwot `zl()` z twardą spacją).
- `undefined` i `null`, „prawdziwość” wartości (`||`, `&&` jako domyślne), dziury w tablicach, `sort` (stabilny), porządek kluczy obiektu.
- Daty: `Date.UTC` w `czas.js`: własny algorytm kalendarza (bez `Time`), żeby uniknąć stref czasowych.
- Dzielenie całkowite i zmiennoprzecinkowe: wszędzie `float` jawnie. Liczby JS to double, `float` w Godocie też (64-bit), więc błędy zaokrągleń są takie same.
- Niemutowalność: moduły zwracają kopie, w GDScript `duplicate(true)`. Stan gry to zwykłe `Dictionary` zgodne z JSON, żeby port był 1:1 i zapisy były proste.

## 3. Architektura docelowa
```
janusz_godot/
  project.godot, export_presets.cfg
  core/        czysta logika (class_name, static): Fuszerka, Czas, Ksiega, Stawka, Terminy, Umowa, Kalendarz, Sezon, Ekipa, Swiat, Siedziba, Bus, ...
  data/        JSON generowane z JS (jobs, klienci, roboty, kursy, narzędzia) - jedno źródło prawdy: roboty/*.rob + jobs.js
  engine/      Silnik: maszyna stanów rozgrywki + API komend (bez UI)
  art/         PNG: ikony, portrety (już wyeksportowane w assets/pixel), atlasy
  render/      PixelCanvas (rc, px, dith, line, disc, spr), Sceny (port scenes.js), shader nocy
  ui/          sceny .tscn i skrypty ekranów + komponenty (Karta, Przycisk, Pasek, Modal, Lista)
  autoload/    Gra (stan), Rng, Zapis, Ustawienia
  tests/       parity/*.gd, golden/*.json, scenariusze, run.sh
```
- Dane: `tools/export_dane.js` zrzuca JOBS, niespodzianki, klientów, kursy, narzędzia, kontrakty, przetargi, ubrania do `data/*.json`. Generator `.rob` zostaje w Node (build-time), Godot nie wymaga Node'a w czasie działania.
- Silnik bez UI: dziś `zlecenia.js` miesza przepływ z DOM. Przed portem robimy **R0 w JS**: rozdzielenie na `silnik.js` (przejścia stanów, komendy typu `wybierz_opcje`, `zatrzymaj_znacznik`, `przyjmij_kontrakt`, zdarzenia i modale jako dane) i cienki widok. Dzięki temu scenariusze działają headless w JS i w Godocie.
- Sceny pixel art: zamiast setek wyeksportowanych kombinacji portujemy sam kod rysujący (imperatywny, liniowy) do GDScript rysującego w `Image` → `ImageTexture` (4 klatki/s). Noc: shader (pasma światła) albo ten sam algorytm CPU, porównany z JS testem obrazu.
- Czcionki: Jersey 10 i VT323 (licencja OFL, wbudować). Ekran 720×1280 portret, cele dotykowe ≥ 48 dp, tryb `canvas_items`.
- Zapis: JSON w `user://`, wersja schematu i migracje (`Zapis.migruj`). Meta-postęp (prestiż) osobny plik.

## 4. Kamienie milowe (kolejność, nakład w sesjach, bramka akceptacji)
| Etap | Zakres | Sesje | Bramka |
|---|---|---|---|
| **G0** | Szkielet projektu, `Rng`, `Mathx`, data, runner parytetu, CI (`tests/run.sh` łączy Node i Godot), `tools/golden.js` | 1 | Jeden moduł (`czas`) przechodzi parytet |
| **R0** (JS) | Rozdzielenie `zlecenia.js` na `silnik.js` + widok, scenariusze headless w Node | 2 | Wszystkie dotychczasowe ścieżki E2E z `scratchpad` działają bez DOM |
| **G1** | Rdzeń ekonomii: fuszerka, czas, kalendarz, sezon, księga, stawka, terminy, umowa, klienci, zmęczenie, wypalenie, specjalizacje, szkolenia, ubezpieczenie, bus, rok | 2 | Parytet wszystkich + `tests/parity` zielone |
| **G2** | Świat: ekipa, swiat (kierowcy), siedziba, finanse, osiedle, fabuła, ubrania | 2 | Parytet |
| **G3** | Zaawansowane: alledrogo, kontrakty, przetargi, zlecenia_ekipy, roboty (dane i niespodzianki), generator danych | 2 | Parytet + scenariusz „kontrakt do końca” |
| **G4** | Silnik rozgrywki w GDScript (port `silnik.js`) | 2 | Scenariusze: te same skróty stanu co JS dla 10 przebiegów |
| **G5** | Grafika: PixelCanvas, port `scenes.js` (10 robót + siedziba + generyczna), ikony/portrety jako atlas, animacje narzędzi, noc | 3 | Parytet obrazu dla zestawu stanów (≥ 200 PNG) |
| **G6** | UI: ok. 25 ekranów (menu, zlecenie, wynik, ekipa, siedziba, finanse, osiedle, fabuła, Alledrogo, szafa, plan dnia, kontrakty, przetargi, prestiż...), komponenty, motyw, modale | 4 | Pełna ścieżka „pierwsze 3 dni gry” bez błędów, test dotykowy na telefonie |
| **G7** | Zapis/odczyt, migracje, ustawienia, meta-postęp, onboarding/samouczek | 1 | Zapis w trakcie zlecenia i po restarcie |
| **G8** | Android: szablon eksportu, podpis, AAB, wydajność, bateria, ikony, ekran startowy | 1–2 | Instalacja na telefonie, 30 minut gry bez zacięć |
| **G9** | Dźwięk (SFX lista), wibracje, polish, monetyzacja po decyzji, wersja testowa w Google Play | 2 | Wewnętrzny test |
Razem ok. 22–24 sesji. Bez R0 ryzyko porównania silnika wzrasta, więc to obowiązkowy krok.

## 5. Lokalny agent (Ollama) i oszczędność tokenów
Port modułów to praca mechaniczna z automatyczną weryfikacją, więc idealna do delegowania:
- `tools/port_modul.js` (do napisania w G0): bierze moduł JS + przewodnik stylu GDScript + plik parytetu, prosi lokalny model o `core/<moduł>.gd`, uruchamia `godot --headless --script tests/parity/<moduł>.gd`, odsyła pierwsze rozbieżności (ścieżka i wartości) i powtarza do 5 razy. Ten sam wzorzec co `tools/ollama_robota.js`.
- Lokalny model: porty modułów logiki i scen (rysowanie), tłumaczenie tekstów UI z szablonów. Chmurowy: architektura, R0, shadery, projekt UI, przegląd, strojenie, debug parytetu, który się nie zbiega.
- Zasady oszczędzania: jedno zadanie = jeden moduł + jego test parytetu; wyniki testów do pliku, w czacie tylko różnice; nie czytać całych plików (zakresy linii); dane generowane skryptami, nie ręcznie.
- Szacunek: ok. 60% tokenów (porty i sceny) idzie do modelu lokalnego, jeśli przechodzi walidator w ≤ 3 próbach. Moduły, w których model utknie (np. `alledrogo`, `kontrakty`), dokończy chmurowy.

## 6. Ryzyka i środki zaradcze
| Ryzyko | Środek |
|---|---|
| Rozjazd JS ↔ GDScript (zaokrąglenia, kolejności) | Złote dane, jeden PRNG, lista pułapek, `Mathx` |
| `zlecenia.js` jako monolit z DOM | Etap R0 przed portem |
| Koszt portu scen (75 KB) | Mechaniczny port + test obrazu; generyczne sceny robót z generatora |
| Wydajność odświeżania `Image` w mobilnym Godocie | 128×80 px, 4 fps, tylko aktywna scena; w razie potrzeby shader zamiast CPU dla nocy |
| Dwa źródła prawdy (JS i Godot) | Do cięcia JS jest źródłem balansu, Godot dostaje dane i logikę z parytetu; po cięciu dane w `data/` + `.rob` |
| Polityka Google Play (alkohol, reklamy) | Ocena IARC, polityka prywatności, brak danych osobowych w grze |
| Rozrost zakresu | Nowe funkcje dopiero po G8; Arrow Escape odłożony |

## 7. Definicja „MVP w Godocie”
Pełna pętla zleceń z niespodziankami, nocą i terminami, ekipa i siedziba, kontrakty, przetargi, Alledrogo, szafa, plan dnia, rok i prestiż, zapis, polski interfejs, działa na Androidzie w orientacji pionowej, wszystkie testy parytetu zielone, 30 minut gry bez błędów.

## 8. Pierwsze kroki (G0, jedna sesja)
1. Utworzyć `janusz_godot/` z `project.godot` (720×1280, portret), katalogami z sekcji 3 i `tests/run.sh`.
2. Napisać `Rng`, `Mathx.round_js`, `Data` (ładowanie JSON), runner parytetu z raportem pierwszej różnicy.
3. Napisać `tools/golden.js` i `tools/export_dane.js`; wygenerować złote dane dla `czas`, `ksiega`, `stawka`.
4. Przeportować `czas` jako pierwszy moduł; jeśli parytet jest zielony, G0 zamknięty.

## Status R0
ZROBIONE (silnik bez DOM). `silnik.js` ma całą pętlę rozgrywki: zlecenie od `newJob` do `settleJob`, czekanie i telefony, ekipę, kontrakty, przetargi, rok i prestiż, szafę, wypłatę, reklamacje. Bramka spełniona: `tests/silnik.test.js` przechodzi ścieżki w czystym Node (bez DOM), `tests/scenariusze.test.js` te same przez interfejs w jsdom. Poza silnikiem zostały ekrany i komendy Alledrogo, siedziby, finansów, osiedla, fabuły: do przeniesienia razem z portem G4 (wzorzec: `ask` + dane zamiast HTML).

## Status G0
ZROBIONE. `janusz_godot/` (osobny projekt Godot 4.4, 720×1280): `core/mathx.gd` (round_js, fdiv, pmod, pad2, zl z twardą spacją i „-0”), `core/rng.gd` (LCG jak w JS), `core/czas.gd` (port czas.js z własnym kalendarzem). `tools/golden.js` generuje `janusz_godot/tests/golden/*.json` z JS (czas 2663 przypadki, mathx 62, rng 8). Runner `janusz_godot/tests/parity.gd` porównuje wyniki (tolerancja 1e-9). `tests/run.sh` łączy Node, Arrow Escape i parytet; `.github/workflows/testy.yml` robi to samo w CI (workflow nie był jeszcze uruchamiany).
Bramka spełniona: moduł `czas` przechodzi parytet 2663/2663. Znaleziona pułapka: `floor(x + 0.5)` daje inny wynik niż `Math.round` dla 0,49999999999999994. Dodać do listy pułapek, nowe porty trzeba testować zawsze z takimi liczbami.
Jak dodać moduł: napisać `core/<m>.gd` (funkcje static, snake_case), dopisać generator przypadków w `MODULES` w `tools/golden.js`, uruchomić `./tests/run.sh`.
