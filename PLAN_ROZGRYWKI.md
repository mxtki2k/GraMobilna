# Plan: dłuższa i bardziej rozbudowana rozgrywka (Janusz Biznesu)

Stan na teraz: 10 rodzajów robót (4–6 kroków, 3–5 minut każda), niespodzianki z łańcuchami, siedziba, ekipa, bus, narzędzia, pożyczki, noc i terminy.
Brakuje: długich celów w obrębie jednej sesji, wyborów strategicznych między zleceniami i powodu, by wracać po miesiącach gry.
Symulacje (`tools/balans*.js`, `tools/tempo.js`) dają solidną podstawę do strojenia każdej fazy.

## Faza A: Kontrakty (dłuższe poziomy) — największy zysk
Kontrakt = kilka robót u jednego klienta w kolejnych dniach (np. „Remont łazienki”: hydraulik → płytki → drzwi → malowanie → odbiór).
- **Dane:** `kontrakty.js`: lista etapów (id roboty, dzień względny, zależności), zaliczka, transze, kara za opóźnienie całości, premia za odbiór bez poprawek. Czysta logika + testy.
- **Przebieg:** klient daje zaliczkę (część kasy z góry, to ratuje płynność), każdy etap to normalna robota (istniejące kroki i niespodzianki), pasek postępu kontraktu, wynik końcowy to średnia ocen etapów i zgłoszone usterki z wcześniejszych etapów (ukryte wady z płytek wychodzą przy malowaniu).
- **Nowe decyzje:** kolejność etapów, ekipa przydzielona do etapu, czy brać drugi kontrakt równolegle, rezygnacja (kara).
- **Długość:** kontrakt 3–5 etapów ≈ 15–25 minut gry. Poziomy z listy zostają jako szybkie zlecenia.
- **Test akceptacji:** `tests/kontrakty.test.js`, symulacja: kontrakt opłaca się o 10–20% lepiej na godzinę niż pojedyncze zlecenia, ale z wyższą wariancją (kary).

## Faza B: Równoległa ekipa i plan dnia
- Ekipa wykonuje proste zlecenia bez gracza (jakość z umiejętności, nastroju i trzeźwości, wynik z `fuszerka.js`), gracz bierze trudne.
- Kalendarz dnia z oknami czasowymi, dojazd zajmuje czas zależnie od lokalizacji (osiedle, miasto, wieś).
- Test akceptacji: symulacja `tempo.js` z ekipą pokazuje przyspieszenie progresji o 20–40% bez zabicia roli gracza.

## Faza C: Specjalizacje i przetargi
- Drzewko umiejętności (hydraulika, elektryka, wykończenia, stolarka): kursy z `szkolenia.js` odblokowują kontrakty tego typu i przetargi.
- Przetargi publiczne (szkoła, urząd): wymagają uprawnień i oceny firmy, płacą dużo, mają audyt jakości i kary. Daje cel dla siedziby 4–5.

## Faza D: Rok i prestiż
- Podsumowanie roku (grudzień): bilans, ranking osiedla, nagrody. „Nowa Gra+”: powrót z bonusem reputacji, nowa mapa/dzielnica.
- Wydarzenia sezonowe (zima: awarie ogrzewania, lato: remonty) jako okna premii.

## Kolejność i szacunek pracy
A (2–3 sesje) → B (2) → C (2) → D (1). Po każdej: testy, symulacja, aktualizacja `JANUSZ_GDD.md`.

# Jak to zrobić taniej (tokeny)

1. **Najpierw specyfikacja, potem jedna sesja na fazę.** Ten plik jest kontekstem: nowa sesja czyta `AGENTS.md` + ten plik zamiast całej historii.
2. **Dane zamiast kodu.** Nowa robota to głównie tekst opcji: trzymać w kompaktowej tabeli (`id | etykieta | czas | koszt | wady | fx`) i generować `jobs.js` skryptem. Daje to 3–5× mniej tokenów na robotę. Do zrobienia: `tools/nowa_robota.js` (tabela → JOBS + szkielet sceny + testy).
3. **Sceny tylko wtedy, gdy trzeba.** Scena pixel art to najdroższy element. Dla kolejnych robót użyć wspólnych „klocków” (pokój + obiekt + znacznik stanu) albo tylko 2–3 stanów zamiast 12.
4. **Jeden duży patch z asercjami zamiast wielu małych edycji** i czytanie plików fragmentami (`sed -n`, `grep -n`), nie w całości.
5. **Wyniki symulacji do plików, w czacie tylko różnica** („przed/po” dla jednej liczby).
6. **Zrzuty ekranu rzadziej i mniejsze:** bez `fullPage`, szerokość 400, tylko po zmianach UI/scen. Testy w Node (bez przeglądarki) wystarczają dla logiki.
7. **Tańszy model do rutyny** (teksty, dane, dopisanie niespodzianek), droższy do architektury i balansu.
8. **Krótkie odpowiedzi.** Podsumowania po 5–8 punktów, bez powtarzania całej historii.
9. **Podział na zadania:** osobna sesja na UI, osobna na dane, osobna na symulacje (każda z krótkim kontekstem).
10. **Testy jako kontrakt:** gdy testy pilnują schematu (np. `roboty.test.js`), błędy wychodzą od razu, bez długich ręcznych sprawdzeń.
