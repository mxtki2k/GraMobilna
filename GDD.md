# GDD — Storm Catcher: Arrow Escape

## Pomysł
Burza nadchodzi. Plansza jest zapchana łodziami (strzałkami). Tapnij łódź, a wypłynie w kierunku dziobu,
o ile droga przed nią jest wolna. Wyprowadź całą flotę, zanim uderzy fala.

## Reguły
- Plansza `W x H`, strzałki zajmują 1..N komórek (ciało wije się za dziobem).
- Tap na wolną strzałkę: wypływa. Tap na zablokowaną: błąd (utrata życia).
- Wygrana: pusta plansza. Porażka: brak żyć.
- Poziom = łańcuch zależności "kto kogo blokuje"; sztuka to odnaleźć dobrą kolejność.

## Poziomy
Generowane kodem (metoda odwrotna, zawsze rozwiązywalne). Krzywa: 3x3 → 12x12 na poziomach 1–200,
dalej stałe parametry maksymalne. Parametry: rozmiar, wypełnienie, długość i krętość strzałek, `chain_bias` (głębokość blokad).

## Pętla i retencja
Poziom 20–60 s → nagroda → następny. Codzienny poziom, seria dni, kolekcja skórek łodzi i teł.

## Monetyzacja
- Rewarded: podpowiedź, cofnięcie, dodatkowe życie po porażce.
- IAP: usunięcie reklam (jeśli kiedykolwiek dodamy interstitiale), paczki podpowiedzi, skórki.

## Grupa docelowa (hipoteza)
Casualowi gracze mobilni, sesje 2–10 min, rynek globalny, rozumienie bez tekstu. Nie gra dla dzieci (deklaracja w Play Console).
Do weryfikacji w recenzjach konkurencji, na itch.io i w Play Console po premierze.
