# AGENTS.md — Storm Catcher: Arrow Escape

Gra mobilna (Android), Godot 4.4, 2D. Puzzle: tapujesz łodzie-strzałki, żeby wypłynęły z planszy.
Szczegóły mechaniki: `GDD.md`. Zasady nienaruszalne: `RULES.md`. Plan i status: `PLAN.md`.

## Podział ról
- AI: kod, testy, teksty, research, skrypty do assetów.
- Człowiek: scope, decyzje, test na prawdziwym telefonie, konto Google Play, ostateczna akceptacja.

## Struktura
- `scripts/core/` — czysta logika (bez węzłów, bez grafiki): `arrow_data`, `level_data`, `solver`, `level_generator`, `difficulty`.
- `tests/run_tests.gd` — testy logiki, uruchamiane headless.
- Grafika i UI (kiedyś): `scenes/`, `assets/`, zawsze oddzielone od `scripts/core/`.

## Uruchamianie testów
```bash
GODOT=/ścieżka/do/godot ./tests/run.sh
```
Godot 4.4.1 headless wystarcza (bez edytora). Testy muszą przechodzić przed każdym commitem.
Dodatkowo test dymny prototypu: `godot --headless --path . --script tests/smoke_game.gd`.
Moduły prototypu Janusza: `node tests/fuszerka.test.js` (ocena fuszerki) i `node tests/ekipa.test.js` (ekipa i płace) `node tests/swiat.test.js` (ryzyko, kierowcy, pamięć), `node tests/siedziba.test.js` (siedziba, kradzieże, zużycie) `node tests/moduly.test.js` (kalendarz, umowa, finanse, osiedle, fabuła) `node tests/alledrogo.test.js` (giełda narzędzi) i `node tests/pixel.test.js` (sprite'y) i `node tests/scenes.test.js` (sceny pixel art) i `node tests/zegar.test.js` (zegar, noc, księga miesiąca, stawka godzinowa) i `node tests/terminy_bus.test.js` (terminy, awarie busa) i `node tests/mechaniki.test.js` (zmęczenie, stali klienci i rywal, szkolenia, OC) i `node tests/roboty.test.js` (schemat robót, niespodzianki, poziomy) i `node tests/generator.test.js` (generator robót) i `node tests/ollama.test.js` (pętla lokalnego agenta z walidatorem) i `node tests/kontrakty.test.js` (kontrakty). Symulacja kontraktów: `node tools/kontrakty_sim.js`. Ekipa na własnych zleceniach (faza B): `node tests/faza_b.test.js` i `node tools/faza_b_sim.js`. Specjalizacje i przetargi (faza C): `node tests/faza_c.test.js` i `node tools/faza_c_sim.js`. Symulacje balansu: `node tools/balans.js` (noc kontra dzień) i `node tools/balans2.js` (nowe mechaniki) i `node tools/tempo.js` (tempo progresji: kiedy bot kupuje siedzibę, kursy, bus). Eksport grafik: `node tools/export_pixel.js`. Opis UI: `UI.md`. Plan dalszej rozgrywki i oszczędność tokenów: `PLAN_ROZGRYWKI.md`. Decyzje i backlog: `CLAUDE.md`. Plan przeniesienia na Godota: `PLAN_GODOT.md`. Wersja jako aplikacja online (PWA, Capacitor): `APLIKACJA.md`, budowa `node tools/zbuduj_web.js`, test `node tests/web.test.js`. Sklep z ubraniami (faza E): `node tests/ubrania.test.js` i `node tools/ubrania_sim.js`. Faza D (rok, prestiż, wydarzenia sezonowe): `node tests/faza_d.test.js` i `node tools/faza_d_sim.js`.

## Nowa robota (tanio)
Napisz `roboty/<id>.rob` (szablon: `node tools/nowa_robota.js --szablon`), uruchom `node tools/nowa_robota.js` (waliduje i generuje `prototypes/janusz/roboty_gen.js`), potem testy. Robota dostaje scenę ogólną, kursy, narzędzia, popyt i poziomy bez ruszania innych plików. Dedykowaną scenę pixel art można dodać później w `scenes.js` (ma pierwszeństwo przed ogólną).

## Lokalny agent (Ollama)
`node tools/ollama_robota.js --id <id> --opis "..."` generuje szkic `roboty/<id>.rob` i poprawia go na podstawie błędów walidatora. Podział zadań: `PLAN_ROZGRYWKI.md`.

## Workflow
1. Mała zmiana → test → zielone → commit.
2. Zmiana trudności lub generatora → uruchom statystyki z testów i porównaj przed/po.
3. Nic poza zakresem MVP z `PLAN.md` bez zgody człowieka.

## Dźwięki i testy headless
- `prototypes/janusz/dzwieki.js`: dźwięki syntezowane w WebAudio (bez plików), przycisk 🔊/🔇 w pasku zegara, ustawienie w `zlecenia_dzwiek`. Test: `tests/dzwieki.test.js`.
- `tools/headless.js` + `tests/scenariusze.test.js`: prawdziwy `zlecenia.html` w jsdom z deterministycznym RNG (R0, część 1: siatka bezpieczeństwa przed wydzieleniem `silnik.js`). Wymaga `npm install` (jsdom); bez niego test się pomija.

## Silnik i widok (R0)
- `prototypes/janusz/silnik.js`: silnik bez DOM (`Silnik.create({rnd, storage, view})`). Stan, zegar, księga, zapis/wczytanie z migracjami, czekanie/sen/urlop/telefony, ekipa na zleceniach, kontrakty, przetargi, rok/prestiż/Nowa Gra+, szafa, wypłata, reklamacje, upomnienia, raporty miesięczne oraz całe zlecenie: `newJob` → `applyOption` → `settleJob`.
- Okna wyboru to dane: `ask({kind,title,text,rows,choices:[{id,label,sub}]}, handler)`; odpowiedź to `E.answer(id)`. Widok (`zlecenia.js`) podaje `E.V = {menu, top, screen, prompt}`.
- `tests/silnik.test.js`: 16 scenariuszy w czystym Node. `tests/scenariusze.test.js`: te same ścieżki przez prawdziwy interfejs w jsdom.
- Nowa logika rozgrywki idzie do `silnik.js`, a `zlecenia.js` tylko rysuje. W widoku zostają: Alledrogo, Siedziba, Finanse, Osiedle, fabuła, Ekipa (ekrany) i plan dnia.

## Godot Janusz (G0)
- `janusz_godot/`: projekt portu. `tools/golden.js` → `tests/golden/*.json` → `janusz_godot/tests/parity.gd`. `./tests/run.sh` uruchamia wszystko (GODOT=/ścieżka/do/godot). Godot 4.4.1 headless pobrany ręcznie z GitHub releases; w repozytorium go nie ma.

- Muzyka: `dzwieki.js` gra pętlę disco polo (Am–F–C–G, 132 BPM, oom-pah) przez filtr „starego radia” (pasmo, przester, falowanie, szum, trzaski). Przycisk 🎵 włącza/wyłącza muzykę, 🔊 całość. Start dopiero po pierwszym dotyku (wymóg przeglądarek, iOS: click/touchend).
- Wynik zlecenia pokazuje „Zaoszczędzone na skrótach” (czas i materiały względem solidnej roboty): `settleJob().saved`.

- Ludki na scenach: `Scenes.people()` rysuje Janusza (ubiór z szafy, ręka sięga do narzędzia), klienta (reaguje na wybór: kciuk, zmartwienie, złość) i pomocnika na każdym poziomie. Test: `tests/ludki.test.js`.
