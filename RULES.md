# RULES.md — źródło prawdy

1. **Logika oddzielona od grafiki.** Nic w `scripts/core/` nie dotyka węzłów, scen ani zasobów.
2. **Każdy poziom jest rozwiązywalny.** Generator konstruuje poziom od końca; solver niezależnie to weryfikuje. Test przechodzi dla 1..300 poziomów i setek seedów.
3. **Determinizm.** Ten sam numer poziomu i seed = ten sam poziom. Wolno używać wyłącznie własnego `RandomNumberGenerator` (nie `shuffle()`, `randi()` ani `randf()` globalnych).
4. **Reguła wypłynięcia.** Strzałka wypływa, gdy żadna komórka przed jej dziobem (do krawędzi) nie jest zajęta przez strzałkę, która nadal jest na planszy.
5. **Ciało za dziobem.** `cells[0]` to dziób, `cells[1]` leży tuż za nim (`head - dir`), kolejne komórki sąsiadują ze sobą.
6. **Uczciwość.** Brak wymuszonych reklam w trakcie myślenia; reklamy tylko rewarded, na życzenie gracza.
7. **Zapis po każdym ruchu.** Postęp nie może zginąć po zabiciu apki.
8. **Pochodzenie assetów.** Każdy plik grafiki/dźwięku ma wpis o źródle i licencji.
9. **Nie kopiujemy.** Bierzemy mechanikę gatunku, nie kod, grafiki, nazw ani poziomów konkretnych gier.
