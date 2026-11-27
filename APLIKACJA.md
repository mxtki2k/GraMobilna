# Janusz Biznesu jako aplikacja online (PWA)

Gra z `prototypes/janusz/` w wersji do zainstalowania na telefonie. Działa tylko online: wszystko ładuje się z serwera, a przy braku sieci pojawia się komunikat „Brak internetu”.

## Budowa
```bash
node tools/zbuduj_web.js          # tworzy web/ (index.html, skrypty z wersją, manifest, ikony, service worker)
```
Wersja (data i skrót commita) trafia do adresów skryptów (`?v=…`), więc po aktualizacji gracz od razu dostaje nowy kod. Plik `web/wersja.json` pokazuje, co jest wdrożone.

## Hosting (GitHub Pages)
1. W repozytorium: Settings → Pages → Source: **GitHub Actions**.
2. Workflow `.github/workflows/web.yml` uruchamia testy i publikuje stronę po wypchnięciu na `main` albo ręcznie (Actions → „Wersja online” → Run workflow).
3. Adres: `https://<login>.github.io/<nazwa-repozytorium>/`. Ten sam adres wpisujesz w `aplikacja_android/capacitor.config.json`, jeśli budujesz APK.
Inne hostingi działają tak samo: wystarczy wystawić katalog `web/` po HTTPS.

## Instalacja na telefonie
Chrome → menu ⋮ → „Zainstaluj aplikację”. Szczegóły i wersja APK (Capacitor): `aplikacja_android/README.md`.

## Co warto wiedzieć
- **Zapis gry jest w przeglądarce telefonu** (localStorage). Odinstalowanie aplikacji lub wyczyszczenie danych strony kasuje postęp. Zapis w chmurze nie istnieje (zaplanowany z wersją Godot).
- Zapisy z wersji w przeglądarce i z zainstalowanej aplikacji mogą być oddzielne.
- Czcionki ładują się z Google Fonts, więc przy dziwnych ustawieniach sieci mogą się spóźnić.
- Testy: `node tests/web.test.js` (struktura i manifest), ręcznie: Chrome DevTools → Application → Manifest.
