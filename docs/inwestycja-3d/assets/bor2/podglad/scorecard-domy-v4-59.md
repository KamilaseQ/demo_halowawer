# Scorecard ΔE — D:/Programy/Git/domy (v4, 59)

Stan: 2026-11-04 17:43. Źródło obrazów: `C:\Temp\claude\08d156b8ed66efa4\5cf029c6-2980-41c8-a246-2262bcbe224a\scratchpad\score`. Bramka: ΔE76 (ΔE*ab) median CIELAB regionu (render dewelopera ↔ runtime); ΔE2000 pomocniczo.
Progi odbioru: ściany, dachy, podłogi, sufity ≤ 10; szyby/widok za szybą, zieleń, niebo ≤ 15. Regiony „info” (meble, tekstylia) bez progu.

**Wynik zbiorczy: 14/57 regionów w progu (25%), średnie ΔE76 (ΔE*ab) = 23.1.**

## Wg klasy

| klasa | próg | regionów | w progu | średnie ΔE76 (ΔE*ab) | najgorszy |
|---|---|---|---|---|---|
| sciana | 10 | 22 | 7 | 18.3 | interior-8/nisza 55.6 |
| dach | 10 | 8 | 2 | 14.9 | visualization-2/dach 31.2 |
| podloga | 10 | 4 | 0 | 35.4 | interior-5/podloga 46.1 |
| sufit | 10 | 5 | 0 | 29.7 | interior-6/sufit 34.3 |
| szyba | 15 | 6 | 1 | 34.2 | visualization-6/okno 78.6 |
| zielen | 15 | 6 | 3 | 18.7 | visualization-5/zielen 31.5 |
| niebo | 15 | 6 | 1 | 30.9 | visualization-6/niebo 41.6 |

## ΔE76 (ΔE*ab): typ regionu × ujęcie (✗ = poza progiem)

| typ | viz1 | viz2 | viz3 | viz4 | viz5 | viz6 | int4 | int5 | int6 | int8 | int10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sciana_jasna | 1 | 22 ✗ | 20 ✗ | 32 ✗ | 33 ✗ | 9 |  |  |  |  |  |
| sciana_taupe | 8 |  | 20 ✗ | 27 ✗ | 8 | 11 ✗ |  |  |  |  |  |
| dach | 14 ✗ | 31 ✗ | 19 ✗ | 17 ✗ | 13 ✗ | 5 |  |  |  |  |  |
| szyba | 26 ✗ | 46 ✗ |  |  |  | 79 ✗ |  |  |  |  |  |
| zielen | 13 | 11 | 15 | 24 ✗ | 32 ✗ | 17 ✗ |  |  |  |  |  |
| niebo | 34 ✗ | 37 ✗ | 34 ✗ | 25 ✗ | 14 | 42 ✗ |  |  |  |  |  |
| sciana_ciemna |  | 2 |  |  | 23 ✗ |  |  |  |  |  |  |
| brama |  |  | 25 ✗ |  |  |  |  |  |  |  |  |
| sciana_szczyt |  |  |  | 18 ✗ |  |  |  |  |  |  |  |
| sufit |  |  |  |  |  |  | 33 ✗ | 27 ✗ | 34 ✗ | 27 ✗ | 27 ✗ |
| sciana_wn |  |  |  |  |  |  | 14 ✗ | 7 | 23 ✗ | 15 ✗ | 20 ✗ |
| podloga |  |  |  |  |  |  | 24 ✗ | 46 ✗ | 29 ✗ |  | 43 ✗ |
| zabudowa_drewno |  |  |  |  |  |  |  | 9 |  | 56 ✗ |  |
| widok_za_szyba |  |  |  |  |  |  |  |  | 24 ✗ | 16 ✗ | 14 |

## Szczegóły

| ujęcie | region | typ | ΔE2000 | ΔE76 | ΔL* | ΔC* | L*a*b* render → runtime | ocena |
|---|---|---|---|---|---|---|---|---|
| visualization-1 | jasna — B, pas między kondygnacjami | sciana_jasna | 0.6 | 0.9 | -1 | +0 | 83/2/6 → 83/2/6 | ✓ |
| visualization-1 | taupe — A, pas między kondygnacjami | sciana_taupe | 9.7 | 7.7 | -1 | -2 | 71/3/10 → 70/-4/7 | ✓ |
| visualization-1 | dachA — dach A | dach | 8.8 | 8.0 | +5 | -3 | 67/2/7 → 72/-3/2 | ✓ |
| visualization-1 | dachB — dach B | dach | 10.3 | 14.0 | +13 | -2 | 76/1/4 → 89/-1/-2 | ✗ za jasno |
| visualization-1 | szyba — A, piętro, prawe okno | szyba | 21.6 | 25.6 | -26 | +2 | 50/-3/-2 → 24/-4/-4 | ✗ za ciemno |
| visualization-1 | zielen — pierwszy plan | zielen | 9.8 | 13.5 | -10 | +10 | 63/-8/18 → 54/-12/26 | ✓ |
| visualization-1 | niebo  | niebo | 17.1 | 33.6 | -18 | +25 | 67/-7/-25 → 49/6/-51 | ✗ za ciemno, za nasycone |
| visualization-2 | jasna — lewy segment, pas między kondygnacjami | sciana_jasna | 21.2 | 21.7 | -19 | +1 | 65/6/0 → 45/0/-7 | ✗ za ciemno |
| visualization-2 | ciemna — prawy segment, lewa część | sciana_ciemna | 2.5 | 2.1 | +1 | -1 | 35/2/-7 → 36/1/-7 | ✓ |
| visualization-2 | dach  | dach | 31.4 | 31.2 | -30 | -5 | 65/0/-15 → 35/5/-9 | ✗ za ciemno |
| visualization-2 | okno — okno piętra, oświetlone | szyba | 39.8 | 46.1 | -45 | -0 | 58/7/0 → 14/-2/-7 | ✗ za ciemno |
| visualization-2 | zielen  | zielen | 8.6 | 11.3 | +10 | +5 | 27/-8/8 → 37/-10/13 | ✓ |
| visualization-2 | niebo  | niebo | 29.9 | 37.2 | -35 | +11 | 54/1/-18 → 19/10/-27 | ✗ za ciemno, za nasycone |
| visualization-3 | taupe — D, pas między kondygnacjami | sciana_taupe | 18.5 | 19.9 | -19 | -5 | 65/3/10 → 46/1/5 | ✗ za ciemno |
| visualization-3 | jasna — C, pas między kondygnacjami | sciana_jasna | 16.3 | 20.0 | -20 | -1 | 79/2/4 → 59/-1/3 | ✗ za ciemno |
| visualization-3 | dachD  | dach | 11.5 | 13.1 | +3 | -1 | 65/1/7 → 68/-0/-6 | ✗ odcień |
| visualization-3 | dachC  | dach | 16.3 | 19.0 | +4 | -2 | 73/3/10 → 77/-2/-8 | ✗ odcień |
| visualization-3 | brama — brama garażowa D | brama | 17.2 | 25.2 | -25 | +5 | 30/6/4 → 5/10/6 | ✗ za ciemno |
| visualization-3 | zielen  | zielen | 9.4 | 14.6 | +3 | -9 | 52/-6/33 → 55/-13/20 | ✓ |
| visualization-3 | niebo  | niebo | 14.4 | 34.0 | -13 | +28 | 66/-7/-16 → 54/6/-45 | ✗ za ciemno, za nasycone |
| visualization-4 | szczyt — szczyt A (zielony) | sciana_szczyt | 17.6 | 18.0 | +11 | -12 | 33/-10/9 → 44/1/1 | ✗ za jasno, za szare |
| visualization-4 | taupe — front A | sciana_taupe | 22.8 | 26.9 | -26 | -5 | 76/1/7 → 50/-0/2 | ✗ za ciemno, za szare |
| visualization-4 | jasna — front B | sciana_jasna | 23.6 | 32.1 | -32 | -1 | 91/-0/4 → 59/-0/2 | ✗ za ciemno |
| visualization-4 | dach  | dach | 12.7 | 16.7 | +17 | +0 | 65/1/1 → 81/-1/2 | ✗ za jasno |
| visualization-4 | zielen  | zielen | 18.7 | 24.0 | +21 | -11 | 52/-15/31 → 74/-8/22 | ✗ za jasno, za szare |
| visualization-4 | niebo  | niebo | 21.9 | 24.6 | +14 | -12 | 76/-4/-18 → 90/7/-1 | ✗ za jasno, za szare |
| visualization-5 | jasna — E, pas pod oknami piętra | sciana_jasna | 27.4 | 32.8 | -32 | -5 | 81/2/6 → 49/-1/0 | ✗ za ciemno |
| visualization-5 | taupe — F, pas pod oknami piętra | sciana_taupe | 7.7 | 8.4 | +4 | -2 | 35/-1/5 → 40/-1/-2 | ✓ |
| visualization-5 | ciemna — G, pas pod oknami piętra | sciana_ciemna | 21.7 | 22.6 | -23 | +0 | 65/1/-1 → 43/-0/-1 | ✗ za ciemno |
| visualization-5 | dach  | dach | 11.8 | 13.0 | +2 | +2 | 75/2/5 → 77/-2/-7 | ✗ odcień |
| visualization-5 | zielen  | zielen | 19.5 | 31.5 | +8 | -26 | 49/-10/31 → 57/-6/1 | ✗ za jasno, za szare |
| visualization-5 | niebo  | niebo | 10.9 | 14.3 | -10 | +7 | 84/-3/-14 → 75/5/-21 | ✓ |
| visualization-6 | taupe — G, nad oknami piętra | sciana_taupe | 9.9 | 11.3 | -10 | +5 | 45/-0/-0 → 35/1/-5 | ✗ za ciemno, za nasycone |
| visualization-6 | jasna — E, nad oknami piętra | sciana_jasna | 8.0 | 8.8 | -7 | -5 | 54/0/-13 → 47/-0/-8 | ✓ |
| visualization-6 | dach  | dach | 4.6 | 4.6 | -0 | -4 | 46/-2/-8 → 45/1/-4 | ✓ |
| visualization-6 | okno — parter G, oświetlone | szyba | 69.1 | 78.6 | -77 | -9 | 79/5/10 → 1/-0/-2 | ✗ za ciemno, za szare |
| visualization-6 | zielen  | zielen | 12.2 | 17.5 | +12 | +11 | 21/-8/3 → 32/-14/14 | ✗ za jasno, za nasycone |
| visualization-6 | niebo  | niebo | 35.2 | 41.6 | -41 | +8 | 59/3/-23 → 18/8/-30 | ✗ za ciemno, za nasycone |
| interior-4 | sufit  | sufit | 24.9 | 33.2 | -33 | +4 | 89/1/5 → 56/1/9 | ✗ za ciemno |
| interior-4 | sciana — ściana przy drzwiach | sciana_wn | 12.5 | 14.4 | -2 | +3 | 78/2/6 → 76/-0/-9 | ✗ odcień |
| interior-4 | podloga  | podloga | 16.5 | 23.8 | +17 | -17 | 78/3/16 → 95/-0/0 | ✗ za jasno, za szare |
| interior-4 | sofa  | meble | 16.4 | 20.4 | -13 | -4 | 82/2/10 → 69/0/-6 | info |
| interior-5 | sufit  | sufit | 20.8 | 26.6 | -26 | +3 | 82/1/6 → 56/1/9 | ✗ za ciemno |
| interior-5 | sciana — ściana nad kuchnią | sciana_wn | 6.8 | 7.4 | -7 | -1 | 62/2/10 → 54/1/9 | ✓ |
| interior-5 | dab — słupek kuchenny | zabudowa_drewno | 7.1 | 8.7 | -7 | +4 | 63/5/21 → 55/4/26 | ✓ |
| interior-5 | podloga  | podloga | 32.9 | 46.1 | +40 | -24 | 55/6/23 → 95/-0/0 | ✗ za jasno, za szare |
| interior-5 | sofa  | meble | 39.7 | 46.6 | -44 | -8 | 84/1/11 → 40/0/-3 | info |
| interior-6 | sufit  | sufit | 25.6 | 34.3 | -34 | +4 | 90/1/6 → 56/1/9 | ✗ za ciemno |
| interior-6 | sciana — nad TV | sciana_wn | 17.5 | 22.5 | -21 | -4 | 83/2/6 → 62/-1/-2 | ✗ za ciemno |
| interior-6 | podloga  | podloga | 21.9 | 29.0 | +20 | -12 | 72/4/17 → 92/-4/-3 | ✗ za jasno, za szare |
| interior-6 | widok — żywopłot za HS | widok_za_szyba | 19.9 | 24.1 | +20 | -13 | 47/-14/24 → 68/-7/13 | ✗ za jasno, za szare |
| interior-6 | sofa  | meble | 16.3 | 20.6 | +2 | -10 | 61/3/15 → 63/0/-5 | info |
| interior-8 | sufit  | sufit | 24.0 | 27.2 | -27 | +2 | 73/1/7 → 46/1/9 | ✗ za ciemno |
| interior-8 | szafa — fronty szaf | sciana_wn | 12.6 | 15.2 | -9 | -7 | 74/2/10 → 66/1/-3 | ✗ za ciemno, za szare |
| interior-8 | nisza — nisza-domek (dąb) | zabudowa_drewno | 41.3 | 55.6 | -52 | -18 | 52/6/18 → 1/0/-2 | ✗ za ciemno, za szare |
| interior-8 | widok  | widok_za_szyba | 13.7 | 16.4 | +11 | +1 | 75/-2/5 → 86/2/-6 | ✗ za jasno |
| interior-10 | sufit  | sufit | 22.6 | 27.1 | -27 | +3 | 78/1/7 → 51/2/9 | ✗ za ciemno |
| interior-10 | sciana — lamele za łóżkiem | sciana_wn | 16.6 | 19.8 | -16 | -1 | 75/1/7 → 59/0/-5 | ✗ za ciemno |
| interior-10 | podloga  | podloga | 32.1 | 42.8 | +32 | -10 | 57/3/19 → 89/-1/-9 | ✗ za jasno, za szare |
| interior-10 | widok  | widok_za_szyba | 10.5 | 14.2 | +11 | -9 | 67/-6/14 → 78/-3/5 | ✓ |

## Pominięte

- interior-1: brak obrazu runtime
- interior-2: brak obrazu runtime
- interior-3: brak obrazu runtime
- interior-7: brak obrazu runtime

Pary z regionami: `C:\Temp\claude\08d156b8ed66efa4\5cf029c6-2980-41c8-a246-2262bcbe224a\scratchpad\score\pary/<ujęcie>.jpg` (zielony = w progu, czerwony = poza, niebieski = info).
