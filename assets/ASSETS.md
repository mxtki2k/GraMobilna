# Pochodzenie assetów

| Plik | Źródło | Licencja |
|---|---|---|
| `art/sea_bg.svg`, `bow.svg`, `life_ring.svg`, `shark_fin.svg`, `rock.svg`, `crate.svg`, `icon.svg` | Wygenerowane skryptem `tools/make_art.py` (własna praca w tym repo) | Własność projektu |

Uwagi:
- Są to **przykładowe grafiki robocze (placeholdery)**. `shark_fin`, `rock` i `crate` czekają na przeszkody w późniejszych etapach.
- Docelowa grafika (AI + obróbka) ma zachować te same proporcje i rolę plików. Każdy nowy plik dopisujemy tu z źródłem i licencją (RULES.md pkt 8).

## Pixel art (prototyp Janusza)

| Pliki | Źródło | Licencja |
|---|---|---|
| `pixel/*.png`, `pixel/_sheet.png` (ikony, narzędzia, nastroje, portrety 16x16) | Rysowane kodem w `prototypes/janusz/pixel.js`, eksport `tools/export_pixel.js` | Własność projektu |
| `pixel/scenes/*.png` (sceny 128x80: kran, ściana, gniazdko, półka, siedziba) | Rysowane kodem w `prototypes/janusz/scenes.js`, eksport `tools/export_pixel.js` | Własność projektu |
| Czcionki Jersey 10 i VT323 (ładowane z Google Fonts w prototypie) | Google Fonts | SIL Open Font License. Przy dołączaniu plików TTF do apki sprawdź i zachowaj notę licencyjną. |

Pliki w `pixel/` są generowane, nie edytuj ich ręcznie: zmiany rób w `pixel.js` i uruchom eksport ponownie.

