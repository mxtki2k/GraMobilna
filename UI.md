# UI: jak jest zbudowany i jak go zbudować w Godocie

## Zasada
Logika gry i widok są rozdzielone. Całe zasady (ocena fuszerki, ekipa, finanse, siedziba, Alledrogo, fabuła) siedzą w czystych modułach
`prototypes/janusz/*.js` z testami, bez dotykania ekranu. UI to cienka warstwa: bierze stan `ST`, rysuje ekran i przekazuje kliknięcia do modułów.

## Prototyp (przeglądarka, `prototypes/janusz/zlecenia.html`)
- **Ekrany:** menu zleceń, umowa, wybór pomocnika, transport, kroki naprawy, odbiór, ekipa, dzień wypłaty, siedziba, finanse, osiedle, fabuła, Alledrogo.
  Każdy ekran to funkcja `renderXxx()`, która składa HTML z aktualnego stanu. Zdarzenia przez delegację (`data-*` na przyciskach).
- **Kolejka zdarzeń** (`nextEvent`): wypłata, reklamacje, upominanie się, sceny fabularne. Okno modalne jest jedno, więc zdarzenia nie nakładają się.
- **Styl pixel art:** paleta ok. 20 kolorów, ramki 3 px, przyciski z fazą (jasna krawędź u góry, ciemna u dołu), paski postępu z segmentami,
  czcionki Jersey 10 (nagłówki) i VT323 (tekst), obie z pełnym zestawem polskich liter. Press Start 2P odpadła, bo nie ma „ą”.
- **Grafika:** `pixel.js` rysuje sprite'y 16x16 z prostokątów i dodaje kontur automatycznie. Są ikony, narzędzia, nastroje i 12 portretów.
  Emoji w tekstach i znaczniki `@postać` są zamieniane na sprite'y w locie.
- **Sceny (prawdziwy pixel art):** `scenes.js` rysuje ręcznie komponowane sceny 128x80 z warstw (prostokąty, linie, dithering, małe sprite'y): łazienka (kran),
  pokój (dziura w ścianie), kuchnia (gniazdko), salon (półka) i siedziba firmy. Stan sceny to zbiór tokenów z `jobs.js` (np. `seal-new`, `plaster-good`),
  więc każdy wybór gracza zmienia obraz. Animowane: kapanie, iskry, para z czajnika, chmury, kamera, pies. Siedziba pokazuje lokal, ulepszenia, busa i porę roku.
  Canvas 128x80 jest skalowany bez wygładzania (`image-rendering: pixelated`). Dodając nowy token w opcji naprawy, test `scenes.test.js` wymusi jego grafikę.
- **Eksport:** `node tools/export_pixel.js` zapisuje sprite'y do `assets/pixel/*.png` (1x i 4x), arkusz `_sheet.png` oraz wybrane stany scen do `assets/pixel/scenes/`.

## Docelowo w Godocie (Android)
1. **Bazowa rozdzielczość** 360x640 (pionowo), `stretch mode = canvas_items`, `aspect = keep_width`. Tekstury pixel art: `texture_filter = NEAREST`,
   a dla ostrości skalowanie całkowite (lub warstwa 2x/3x). Safe area i przyciski min. 48x48 dp.
2. **Motyw (Theme):** jeden zasób `janusz_theme.tres` ze stylami `Button`, `PanelContainer`, `ProgressBar`, `Label`.
   Ramki jako `StyleBoxTexture` z 9-patch (ramka 3 px z `assets/pixel`), fonty Jersey 10 i VT323 jako pliki TTF w projekcie (licencja SIL OFL, sprawdź przy dołączaniu).
3. **Komponenty wielokrotnego użytku** (osobne sceny): `Panel`, `PixelButton`, `SegmentBar` (paski), `Chip`, `Banner`, `PortraitBubble` (portret + tekst), `ListRow`, `ModalChoice`.
4. **Ekrany jako sceny:** `Menu`, `Umowa`, `Zlecenie` (kroki + mini-gra), `Odbior`, `Ekipa`, `Wyplaty`, `Siedziba`, `Finanse`, `Osiedle`, `Fabula`, `Alledrogo`.
   Każdy ma skrypt, który tylko czyta stan i wywołuje logikę. Nawigacja przez jeden autoload `Ekrany` (stos ekranów) i kolejkę zdarzeń.
5. **Stan i logika:** autoload `Gra` ze stanem (`ST`) i zapisem do `user://`. Moduły z `prototypes/janusz/*.js` przepisujemy do GDScriptu 1:1
   (ten sam podział na pliki), a testy JS służą jako specyfikacja i zestaw przypadków do przeportowania.
6. **Scena naprawy:** warstwy `TextureRect` (tło, uszkodzenie, naprawa) przełączane tokenami stanu tak jak w `scenes.js`. Na start można użyć wyeksportowanych stanów z `assets/pixel/scenes/`, a docelowo rozbić je na warstwy. Mini-gra celności jako prosty `Control`.
7. **Kolejność prac:** (a) motyw i komponenty, (b) menu + umowa + zlecenie + odbiór na stanie testowym, (c) port logiki i zapis, (d) ekipa i wypłaty,
   (e) siedziba, Alledrogo, finanse, osiedle, fabuła, (f) dźwięk i animacje, (g) test na telefonie.

## Czego jeszcze brakuje w grafice
Część emoji w tekstach (np. 😅 🙄) nadal jest zwykłymi emoji, portrety mają tylko 16x16 pikseli, brakuje animacji postaci i wejścia na ekran,
sceny mają jedną rozdzielczość (128x80) i jeden kąt widzenia, brak dźwięków. To etap na później, najlepiej po decyzji o ostatecznym stylu.
