# GDD — Symulator Janusza Biznesu (idle/kliker, satyra)

Drugi tor projektu obok Arrow Escape: gra dla polskiego odbiorcy, oparta na ponadczasowych archetypach
(majster, klient, szwagier, "jakoś to będzie"). Prototyp webowy: `prototypes/janusz/index.html`
(test w polskich grupach przed budową w Godocie).

## Pętla
1. Branża daje zlecenie (klient z tekstem, robota do wykonania, zapłata). Klikasz, żeby robota postępowała.
2. Zatrudniasz ekipę (praca idle, także offline do 2 h przy 50% stawki) i kupujesz sprzęt/„rozwiązania" (x2 do roboty).
3. Przycisk „Po taniości": pół roboty, +50% zapłaty, ale +10 ryzyka kontroli.
4. Ryzyko (0–100%) spada powoli samo. Przy 100% jest **Kontrola**: płacisz kasą, tracisz pracownika albo mandat.
5. Co kilkadziesiąt sekund wypada zdarzenie z wyborem (humor + kompromis kasa/ryzyko).
6. Zarobki odblokowują kolejne branże.

## Serie (branże jako pakiety danych)
Każda branża to wpis w tabeli `BR`: nazwa, mnożnik wartości `V`, koszt odblokowania, teksty klientów i zakończeń,
4 typy pracowników, 3 sprzęty, 2 zdarzenia. Dodanie branży nie wymaga zmiany kodu pętli.

| Branża | V | Odblokowanie | Charakter |
|---|---|---|---|
| Remonty | 1 | start | złota rączka, pianka montażowa, szwagier |
| Koparka | 12 | 800 zł | wykopy, kable, „bez pozwoleń" |
| Handel autami | 150 | 12 tys. zł | komis, „Niemiec płakał", lakier w sprayu |
| Budowlanka | 2000 | 300 tys. zł | deweloper, dziennik budowy, podwykonawca podwykonawcy |

Kolejne pomysły na serie: hurtownia „ze stodoły", ogrodnictwo/działka, transport, gastronomia, pośrednictwo nieruchomości.

## Ekonomia (v0)
- Zapłata za zlecenie = robota × V × (0,8–1,25).
- Koszt pracownika = V × baza × 1,18^liczba. Stawki robót/s: 0,5 / 2,5 / 10 / 40 (x2 za każdy sprzęt).
- Symulacja bota (4 kliknięcia/s, kupuje co może): odblokowanie Koparki po ok. 6 min, Handlu autami po ok. 14 min,
  Budowlanki po ok. 30 min. Do strojenia po prawdziwych graczach.

## Monetyzacja
Rewarded: x2 zarobków na 60 s (w prototypie symulowane), szybszy powrót ekipy, zlecenie premium.
Bez wymuszonych reklam. IAP: usunięcie reklam, paczki startowe, skórki biura.

## Ryzyka
- Humor to loteria: testować teksty na ludziach, pisać w wielu tonach i wybierać najlepsze.
- Prawo/Play: bez prawdziwych marek, osób publicznych i polityki. Archetypy ogólne, satyra, konsekwencje za „kręcenie".
- Mały rynek i niższe stawki reklamowe: sukces zależy od organicznego zasięgu w polskich społecznościach.
- Retencja idle: prestiż (reset z bonusem), cele dnia i zdarzenia sezonowe jeszcze do zrobienia.
