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
Moduły prototypu Janusza: `node tests/fuszerka.test.js` (ocena fuszerki) i `node tests/ekipa.test.js` (ekipa i płace) `node tests/swiat.test.js` (ryzyko, kierowcy, pamięć), `node tests/siedziba.test.js` (siedziba, kradzieże, zużycie) `node tests/moduly.test.js` (kalendarz, umowa, finanse, osiedle, fabuła) `node tests/alledrogo.test.js` (giełda narzędzi) i `node tests/pixel.test.js` (sprite'y) i `node tests/scenes.test.js` (sceny pixel art) i `node tests/zegar.test.js` (zegar, noc, księga miesiąca, stawka godzinowa) i `node tests/terminy_bus.test.js` (terminy, awarie busa). Eksport grafik: `node tools/export_pixel.js`. Opis UI: `UI.md`.

## Workflow
1. Mała zmiana → test → zielone → commit.
2. Zmiana trudności lub generatora → uruchom statystyki z testów i porównaj przed/po.
3. Nic poza zakresem MVP z `PLAN.md` bez zgody człowieka.
