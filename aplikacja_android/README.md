# Janusz Biznesu jako aplikacja (tylko online)

Dwie drogi, od najszybszej:

## 1. Instalacja ze strony (PWA), bez sklepu i bez Androida SDK
1. Opublikuj wersję online (sekcja „Hosting” w `APLIKACJA.md`), np. na GitHub Pages.
2. Na telefonie otwórz adres w Chrome → menu ⋮ → „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.
3. Aplikacja działa w trybie pełnoekranowym, w pionie, z ikoną skrzynki z narzędziami. Bez internetu pokazuje komunikat „Brak internetu”.

## 2. Aplikacja Android (Capacitor, ładuje grę z internetu)
Wymaga Node 18+, Android Studio i JDK 17 na twoim komputerze (w tym środowisku się tego nie zbuduje).
1. Podmień adres w `capacitor.config.json` (`server.url`) na adres opublikowanej gry (`https://…/index.html`).
2. W tym katalogu: `npm install`, potem `npm run gra` (buduje `../web`), `npm run dodaj` (tworzy projekt `android/`), `npm run synchronizuj`, `npm run otworz` (Android Studio).
3. W Android Studio: Build → Generate Signed Bundle / APK (podpis własnym kluczem). Klucz i hasła trzymaj poza repozytorium.
4. Test: zainstaluj APK na telefonie. Do Google Play: AAB, konto deweloperskie, polityka prywatności, kwestionariusz IARC (gra pokazuje alkohol i jazdę po pijanemu).

Uwaga: Google Play bywa niechętny aplikacjom będącym tylko „stroną w ramce” (zasada minimalnej funkcjonalności). Dla dłuższej drogi jest plan przeniesienia na Godota (`PLAN_GODOT.md`).
