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
  Emoji w tekstach i znaczniki `@postać` są zamieniane na sprite'y w locie. Rysunki scen (SVG) są pikselizowane: rysowane w małej rozdzielczości
  i ograniczone do palety, a potem powiększane bez wygładzania.
- **Eksport:** `node tools/export_pixel.js` zapisuje wszystkie sprite'y do `assets/pixel/*.png` (1x i 4x) oraz arkusz `_sheet.png`.

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
6. **Scena naprawy:** warstwy `TextureRect` (tło, uszkodzenie, naprawa) przełączane tokenami stanu, tak jak teraz w SVG. Mini-gra celności jako prosty `Control`.
7. **Kolejność prac:** (a) motyw i komponenty, (b) menu + umowa + zlecenie + odbiór na stanie testowym, (c) port logiki i zapis, (d) ekipa i wypłaty,
   (e) siedziba, Alledrogo, finanse, osiedle, fabuła, (f) dźwięk i animacje, (g) test na telefonie.

## Czego jeszcze brakuje w grafice
Wiele ikon z tekstów nadal jest zwykłymi emoji (np. 😅 🙄), sceny są pikselizowanymi rysunkami, a nie ręcznie rysowanym pixel artem,
brak animacji (kapanie, iskry, wejście postaci), brak dźwięków. To etap na później, najlepiej po decyzji o ostatecznym stylu.
