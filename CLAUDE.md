# CLAUDE.md

Zasady pracy, testy i struktura projektu: `AGENTS.md`. Plan rozgrywki i oszczędność tokenów: `PLAN_ROZGRYWKI.md`. Opis mechanik: `JANUSZ_GDD.md`.
Ten plik trzyma decyzje i zaplanowane funkcje, o których warto pamiętać między sesjami.

## Zaplanowane (backlog)

### Sklep z ubraniami: przebieranie się jako szef i ciuchy firmowe dla ekipy
Decyzja człowieka: robimy sklep z ubraniami. Im drożej i lepiej ubrany szef, tym bardziej wiarygodny, ale nie u każdego klienta i nie w każdej robocie.

**Ubrania szefa (przebranie przed zleceniem, kontraktem lub przetargiem)**
- Zestawy od taniego do drogiego: dres z targowiska, robocze ubranie, koszula z kamizelką, garnitur, „Janusz Lux” (z zegarkiem). Każdy ma cenę, wiarygodność (0–1), styl i trwałość.
- Wiarygodność daje: wyższe zaufanie klienta na starcie, rzadziej wykryta zawyżona wycena, lepszą szansę w przetargach (garnitur), mniejszą szansę, że klient zacznie podejrzewać fuszerkę.
- Zależność od klienta: Karyna ocenia po stylu, Mirek ma to gdzieś, Grażyna widzi każdą plamę, teściowa krytykuje i tak, Heniek ocenia po robocie, Sebix chce „żeby wyglądało”, urzędy lubią garnitur.
- Zależność od roboty: garnitur do płytek lub malowania to ryzyko brudu (zużycie, koszt czyszczenia, śmiech ekipy); robocze ubranie na przetargu obniża wiarygodność. Trzeba wybrać ubiór do kontekstu.
- Ekran „Szafa” (Siedziba lub przed zleceniem) i zmiana wyglądu portretu gracza (nowy wariant sprite'a pixel art).

**Ciuchy firmowe dla ekipy**
- Zestawy z logo (zależne od szyldu firmy): koszulki, kombinezony, kurtki. Koszt na pracownika, trzeba dokupić dla każdego nowego.
- Efekty: wiarygodność firmy w ocenie (część „siedziba i sprzęt”), nastrój ekipy (duma albo wstyd przy tanich), mniej reklamacji od uważnych klientów, wymagane w przetargach (BHP), brak = kara.
- Zużycie i zgubienie, pranie. Tańsze rzeczy szybciej się niszczą.

**Sklep**
- Lokalny sklep z odzieżą roboczą (stałe ceny) i używane ubrania na Alledrogo (taniej, ryzyko podróbek i złego stanu). Wyprzedaże w oknach sezonowych (`sezon.js`).

**Wdrożenie (tanio w tokenach)**
- Czysta logika: `prototypes/janusz/ubrania.js` + `tests/ubrania.test.js`; symulacja `tools/ubrania_sim.js` (czy drogi strój opłaca się tylko u wybranych klientów i w przetargach).
- Dane zestawów jako tabela, ikony 16x16 w `pixel.js` (test `pixel.test.js` pilnuje ikon), UI jak szafa w `zlecenia.js`.
- Kryterium: najdroższy strój nie wygrywa wszędzie (tanio ubrany Mirek-fachowiec ma sens), a firmowe ciuchy zwracają się w przetargach.
- Status: nie zaczęte. Zakres i kolejność ustalić z człowiekiem (faza E w `PLAN_ROZGRYWKI.md`).
