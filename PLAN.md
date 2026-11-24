# PLAN: Storm Catcher — Arrow Escape

> Drugi tor projektu: **Symulator Janusza Biznesu** (polski idle z satyrą), patrz `JANUSZ_GDD.md` i `prototypes/janusz/`.
> Ten plan dotyczy Arrow Escape.

## Cel
Gra puzzle na Androida, status „opublikowano" w Google Play. Rdzeń: tap-to-escape (łodzie-strzałki).
Wybór na podstawie researchu rynku (puzzle ≈ 44% wydatków w casualu, gatunek „arrows" w top pobrań Google Play w 2026)
i wykonalności solo w ~20 dni: generator poziomów robi kod, nie ręczne projektowanie.

## Stack (0 zł poza kontem Play Console, 25 USD jednorazowo)
Godot 4.4 · VS Code + agent AI · godot-mcp (opcjonalnie) · grafika z Gemini/ChatGPT w jednym stylu · jsfxr/freesound ·
itch.io (test webowy) · Google Play Console · polityka prywatności na darmowym hostingu (np. GitHub Pages).

## Harmonogram (20 dni)
| Dni | Cel | Status |
|---|---|---|
| 1–3 | Logika: model, solver, generator, krzywa trudności, testy | **zrobione (v1)** |
| 4–5 | Strojenie trudności: głębokość łańcuchów, odsetek wolnych na starcie | **zrobione (v2), do sprawdzenia na graczach** |
| 6–8 | Prototyp w Godocie: plansza, tap, wypływanie, życia, wygrana/porażka | **zrobione (v1, z przykładową grafiką)** |
| 9–10 | Podpowiedź, cofnięcie, zapis po każdym ruchu, ekran wyników | |
| 11–14 | Grafika i UI: łodzie, morze, 9-slice, safe area, fonty z polskimi znakami | |
| 15–16 | Dźwięk, efekty wody, przełącznik „mniej efektów" | |
| 17 | Rewarded ads, codzienny poziom, seria dni | |
| 18 | Playtest webowy (itch.io), poprawki | |
| 19 | Build Android, test na prawdziwym telefonie, polityka prywatności | |
| 20 | Google Play Console: listing, screeny, wysyłka | |

Uwaga: nowe konta deweloperskie zwykle wymagają zamkniętego testu z testerami przed produkcją. Sprawdź aktualne
wymagania w konsoli i zostaw bufor poza 20 dniami.

## Stan generatora (v2, wyniki testów headless)
| Poziomy | Plansza | Strzałek | Wypełnienie | Głębokość | Wolnych na starcie |
|---|---|---|---|---|---|
| 1–10 | 3x3 | 3,4 | 0,49 | 2,1 | 68% |
| 50–69 | 6x6 | 7,0 | 0,60 | 4,0 | 41% |
| 100–119 | 8x8 | 12,9 | 0,68 | 6,2 | 33% |
| 181–200 | 12x12 | 26,4 | 0,79 | 10,4 | 37% |

Co zmieniło trudność względem v1 (głębokość na 12x12: 6,2 → 10,4, wolnych na starcie: 55% → 37%):
1. Nowe strzałki celują w jeszcze niezasłonięte strzałki o najdłuższym łańcuchu.
2. Strzałki z krótkim pasem wypłynięcia (dziób przy krawędzi) są rzadziej dopuszczane, bo prawie nie da się ich zasłonić.
3. Dla każdego poziomu generujemy kilka kandydatów (do 5) i bierzemy najtrudniejszego wg `Difficulty.score`.

Ryzyko: na największych planszach generowanie trwa ok. 120 ms na komputerze (w GDScript na telefonie kilka razy dłużej).
Rozwiązanie na później: wygenerować poziomy z góry do pliku i ładować gotowe.

## Grafika
Przykładowe grafiki robocze SVG (tło morza, dziób łodzi barwiony w grze, koło ratunkowe jako życie, ikona, oraz
przeszkody na później: rekin, skała, skrzynia) są w `assets/art/`, generowane skryptem `tools/make_art.py`.
Pochodzenie: `assets/ASSETS.md`. To placeholdery, docelowa grafika ma zachować role i proporcje plików.

## Ryzyka
1. Rynek jest na fali, więc konkurencja już jest. Wyróżniki: motyw burzy/morza, „sok" (efekty, dźwięk), czytelny UI.
2. Płytka głębia mechaniki. Dodawać stopniowo: kolorowe łodzie, skały/rekiny jako przeszkody, pola lodu (dwa tapy), bonusy.
3. Trudność: za łatwo = nuda, za trudno = rezygnacja. Boty + telemetria po premierze.
4. Grafika AI w spójnym stylu: jeden blok stylu, złoty wzorzec, test na jednej łodzi.
5. Dane rynkowe pochodzą z blogów i raportów firm trzecich; weryfikować w Google Play.
