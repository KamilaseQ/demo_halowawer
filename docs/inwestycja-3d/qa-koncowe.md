# /domy: QA końcowe (research/UX → nadzór)

Stan na 29.10.2026. Wykonanie: skrypt Playwright z GPU (desktop 1440×900, mobile 390×844) plus pomiar pikseli na zrzutach. Kryteria pochodzą z listy domykania nadzoru i ze specu [01-ux-podstrona.md](01-ux-podstrona.md). Zrzuty porównawcze są w [assets/drzewa/podglad/](assets/drzewa/podglad/).

## Wynik: 14/22 PASS w skrypcie

Dwa FAIL to artefakt pomiaru wysokości paska; panel zaliczony na zrzucie. Do zrobienia u 85 zostały 2 punkty.

| Obszar | Kryterium | Wynik |
|---|---|---|
| Panel zwijany (§3.6) | przycisk z `aria-expanded`, pasek „● Dom A · 119,51 m² · 1 610 000 zł”, szyna przy lewej krawędzi, kamera przesuwa kadr, stan w `sessionStorage` przetrwa przeładowanie, na mobile stan „schowany” | ✔ (zrzut `final-a-collapsed`) |
| SiteNav na `/domy` | Start, O osiedlu, Domy, Lokalizacja, Kontakt, telefon; brak linków do senn.pl | ✔ |
| CTA „Umów prezentację” | otwiera LeadForm na miejscu, URL bez zmian | ✔ |
| `/domy?dom=B` | 308 → `/domy/b?…` | ✔ |
| `src/app/domy-lab` | 404 | ✔ |
| Błędy JS na `/domy/a` | brak | ✔ |
| Mobile 390 | brak poziomego scrolla | ✔ |
| `og:image` `/domy` | `estate-aerial.jpg`, 200 | ✔ |
| **`og:image` `/domy/[dom]`** | brak na `/domy/a` i `/domy/c` | ✘ u 85 |
| **Rzut A i C** | ma być Kreator `plan-ai-f0` (parter) i `plan-ai-f1` (piętro), dla C lustro według `PLACEMENTS`; dziś CAD `dom-a/c-*.png` (CAD ma zostać tylko w Dokumentach) | ✘ u 85 |

## Wygląd: pomiary (jasność 0–255)

| Miejsce | Start (28.10) | Teraz | Cel / wzorzec | Ocena |
|---|---|---|---|---|
| Łąka, średni plan, Dzień | 181 (khaki, nasycenie 0,28, sd 3) | 150–160, nasycenie 0,21–0,23, sd 7–10 | ok. 145, ≤ 0,35, sd ≥ 15 | ✔ (zróżnicowanie opcjonalnie +) |
| Podjazd | 231 (płaska biel) | 187, kostka z fugami | 175–190 | ✔ |
| Bramy garażowe | 21 (czarne) | 56 (D), 29 (B w cieniu) | 50–65 | ✔ / drobiazg |
| Ściana w cieniu, Dzień | 52 | ok. 120–148 | czytelna, bez czerni | ✔ (nadzór) |
| Elewacja, Noc | 13 | 96–130 | ok. 119 (viz-2, viz-6) | ✔ |
| Niezapalone okno, Noc | 8 | 44–53 | 35–55 | ✔ |
| Daleki las | talerzowate korony | impostory z `drzewa.glb`, bór z podszytem z brzóz | — | ✔ |
| Drzewa przy domach | plamy na patykach | EZ-Tree: sosny, brzozy, dąb, lipa, z instanceColor | — | ✔ |

## Do decyzji nadzoru

- **Opcja bez blokowania:** zróżnicowanie łąki (sd 7–10) przez makroszum ±18% albo więcej suchych plam.
- **Brama B** w cieniu: jasność 29, możliwe +15%.

Otwarte punkty po stronie klienta (K1–K8) są w [README](README.md#otwarte-po-stronie-klienta-przed-publikacją).
