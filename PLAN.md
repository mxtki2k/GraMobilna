# PLAN: Tiny Island (tytuł roboczy)

Survival na malutkiej wyspie po rozbiciu łodzi. Sterowanie wyłącznie tapnięciami, bez chodzenia. 2D / 2.5D, Godot 4.x, Android.

## 1. Ocena wykonalności (solo + AI, ~20 dni)

| Wersja pomysłu | Ocena 1-5 | Komentarz |
|---|---|---|
| 3D survival w stylu The Forest | 1 | Nierealne solo w 20 dni: modele 3D, animacje, fizyka wody, wydajność na telefonach. |
| 2D/2.5D, jedna scena, sterowanie tapem, pętla dni | 3.5-4 | Realne, jeśli utniesz scope do MVP z pkt 4. |
| To samo z otwartym światem, wieloma wyspami i craftingiem drzewkowym | 2 | Za dużo contentu i balansu na 20 dni. |

Wniosek: robimy wersję "management/defense na jednym ekranie", nie "The Forest na telefonie". Klimat (rozbitek, fale, rekiny, baza) zostaje, ruch i eksploracja wypadają.

## 2. Pętla rdzenia (jedna "doba" = ~2-3 min)

1. **Dzień:** gracz tapuje, żeby zbierać: skrzynki dryfujące po wodzie, ryby (tap-timing przy wędce), drewno i złom z wraku.
2. **Budowa:** tap w wolny slot na wyspie, wybór budynku (ściana przeciwfalowa, wędka automatyczna, zbieracz deszczówki, ognisko, magazyn, harpun-wieżyczka).
3. **Zmierzch:** nadchodzi fala sztormowa. Ściany i poziom bazy decydują, ile strat poniesiesz.
4. **Noc:** rekiny krążą wokół wyspy i atakują budynki. Tap w rekina = rzut harpunem (cooldown), wieżyczki robią resztę.
5. **Rano:** podsumowanie, naprawy, ulepszenia. Przetrwana doba = nagroda i trudniejsza kolejna.

Przegrana: wyspa zniszczona lub zerowe zasoby życia. Tu wchodzi "prawie przegrałem" i ratunek za reklamę.

## 3. Systemy i monetyzacja

- **Zasoby:** drewno, ryby, złom, woda. Maksymalnie 4, bez rozbudowanego craftingu.
- **Ulepszenia:** każdy budynek ma 3 poziomy. Meta-progresja między runami: "Dziennik rozbitka" (karty/perki), podobnie jak system kart z notatki.
- **Rewarded ads (zamiast wymuszonych):**
  - ratunek po przegranej (odbudowa wyspy z 50% HP),
  - x2 loot ze skrzynki,
  - przyspieszenie naprawy,
  - codzienna skrzynka z wody.
- **IAP:** usunięcie reklam wymuszonych (jeśli będą jakieś interstitiale), paczki startowe, skórki wyspy/łódki.
- **Retencja:** codzienna skrzynka, cele dnia, rekord przetrwanych dób, lekki idle (wędka łowi offline do limitu).

## 4. Zakres MVP (to wchodzi na 20 dni)

- 1 wyspa, 1 ekran, stała kamera, 8 slotów budowy.
- 6 typów budynków, 3 poziomy każdy.
- 3 typy zagrożeń: fala sztormowa, rekin, rekin-brutal (wzmocniony).
- 4 zasoby, 2 typy zbieractwa (skrzynki + wędka).
- Tryb endless: przetrwaj jak najwięcej dób.
- Zapis po każdej akcji, rekordy, rewarded ads (ratunek + x2 loot).
- Dźwięk (jsfxr/freesound) i grafika 2D z AI w jednym stylu (blok stylu z notatki).

Poza MVP (po publikacji): kolejne wyspy, handel, bossowie, sezony, rankingi.

## 5. Harmonogram

| Dni | Cel |
|---|---|
| 1-2 | Setup Godot + agent, pliki AGENTS.md / RULES.md / GDD, decyzje stylu. |
| 3-5 | Logika bez grafiki: doby, zasoby, sloty, fale, rekiny + testy i bot-symulacje. |
| 6-8 | Pętla tap: zbieranie skrzynek, wędka (timing), tap w rekina. Szary prototyp. |
| 9-11 | Budynki, ulepszenia, balans (60 symulacji botem przed i po zmianach). |
| 12-14 | Grafika i UI: wyspa, budynki, rekin, woda, 9-slice, safe area. |
| 15-16 | Dźwięk, efekty, przełącznik "mniej efektów", zapis stanu. |
| 17 | Rewarded ads, ekran ratunku, codzienna skrzynka. |
| 18 | Playtest (itch.io web) z ludźmi, poprawki z feedbacku. |
| 19 | Build Android, test na prawdziwym telefonie, polityka prywatności. |
| 20 | Google Play Console: listing, screeny, zamknięty test, wysyłka. |

Uwaga: Google Play dla nowych kont deweloperskich zwykle wymaga zamkniętego testu z testerami przed produkcją. Sprawdź aktualne wymagania w konsoli i zaplanuj bufor czasowy poza 20 dniami.

## 6. Główne ryzyka

1. **Scope creep:** pokusa dodania "jeszcze jednej wyspy". Odpowiedź: wszystko spoza pkt 4 trafia do backlogu.
2. **Balans:** fale + rekiny + ekonomia łatwo się rozjeżdżają. Odpowiedź: boty symulujące doby, pliki z liczbami w jednym miejscu.
3. **Grafika AI w spójnym stylu:** wyspa, budynki i rekin muszą wyglądać jak z jednej gry. Odpowiedź: jeden blok stylu, złoty wzorzec, test na 1 budynku.
4. **Woda i fale:** unikać fizyki. Fale to animacja i shader/sprite, nie symulacja.
5. **Rynek:** gatunek survival/idle jest zatłoczony. Sprawdź w Google Play konkurencję (tytuły z "raft", "island survival", "idle"), recenzje 1★ i 5★ i czy reklamy są tam wymuszone. Nie opieram się tu na danych, tylko na ogólnej wiedzy, więc zweryfikuj ręcznie.

## 7. Następny krok

1. Zatwierdź nazwę i zakres MVP z pkt 4.
2. Wygenerować `AGENTS.md`, `RULES.md`, `GDD.md` i szkielet projektu Godot.
3. Zacząć od logiki doby, zasobów i fal z testami, bez grafiki.
