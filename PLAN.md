# PLAN: Storm Catcher — Arrow Escape

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
| 4–5 | Strojenie trudności: głębokość łańcuchów, odsetek wolnych na starcie, boty | do zrobienia |
| 6–8 | Szary prototyp w Godocie: plansza, tap, wypływanie, życia, wygrana/porażka | |
| 9–10 | Podpowiedź, cofnięcie, zapis po każdym ruchu, ekran wyników | |
| 11–14 | Grafika i UI: łodzie, morze, 9-slice, safe area, fonty z polskimi znakami | |
| 15–16 | Dźwięk, efekty wody, przełącznik „mniej efektów" | |
| 17 | Rewarded ads, codzienny poziom, seria dni | |
| 18 | Playtest webowy (itch.io), poprawki | |
| 19 | Build Android, test na prawdziwym telefonie, polityka prywatności | |
| 20 | Google Play Console: listing, screeny, wysyłka | |

Uwaga: nowe konta deweloperskie zwykle wymagają zamkniętego testu z testerami przed produkcją. Sprawdź aktualne
wymagania w konsoli i zostaw bufor poza 20 dniami.

## Stan generatora (v1, wyniki testów headless)
| Poziomy | Plansza | Strzałek | Wypełnienie | Głębokość | Wolnych na starcie |
|---|---|---|---|---|---|
| 1–10 | 3x3 | 3,4 | 0,48 | 1,9 | 2,5 |
| 50–60 | 6x6 | 6,3 | 0,60 | 3,1 | 3,7 |
| 100–110 | 8x8 | 12,9 | 0,68 | 4,6 | 6,9 |
| 190–200 | 12x12 | 27,3 | 0,80 | 6,2 | 15,0 |

Wniosek: wszystkie poziomy są poprawne i rozwiązywalne, ale późne poziomy są wciąż zbyt łatwe
(ponad połowa strzałek wolna od startu). To jest następny krok: dodać miarę trudności (np. cel dla
odsetka wolnych na starcie i głębokości) i dostroić generator, najlepiej z playtestem na ludziach.

## Ryzyka
1. Rynek jest na fali, więc konkurencja już jest. Wyróżniki: motyw burzy/morza, „sok" (efekty, dźwięk), czytelny UI.
2. Płytka głębia mechaniki. Dodawać stopniowo: kolorowe łodzie, skały/rekiny jako przeszkody, pola lodu (dwa tapy), bonusy.
3. Trudność: za łatwo = nuda, za trudno = rezygnacja. Boty + telemetria po premierze.
4. Grafika AI w spójnym stylu: jeden blok stylu, złoty wzorzec, test na jednej łodzi.
5. Dane rynkowe pochodzą z blogów i raportów firm trzecich; weryfikować w Google Play.
