# Scorecard ΔE — iteracja 04: 55: wycięte nawierzchnie OSM na łące, jaśniejsze duchy; v7, wnętrza G v1 i B v1

Stan: 2026-11-04 18:23. Źródło obrazów: `iteracje/04/runtime`. Bramka: ΔE76 (ΔE*ab) median CIELAB regionu (render dewelopera ↔ runtime); ΔE2000 pomocniczo.
Progi odbioru: ściany, dachy, podłogi, sufity ≤ 10; szyby/widok za szybą, zieleń, niebo ≤ 15. Regiony „info” (meble, tekstylia) bez progu.

**Wynik zbiorczy: 19/73 regionów w progu (26%), średnie ΔE76 (ΔE*ab) = 19.5.**

## Wg klasy

| klasa | próg | regionów | w progu | średnie ΔE76 (ΔE*ab) | najgorszy |
|---|---|---|---|---|---|
| sciana | 10 | 28 | 8 | 16.4 | visualization-5/jasna 38.7 |
| dach | 10 | 8 | 4 | 13.1 | visualization-2/dach 31.7 |
| podloga | 10 | 8 | 2 | 19.8 | interior-7/podloga 36.8 |
| sufit | 10 | 9 | 1 | 14.3 | interior-8/sufit 28.3 |
| szyba | 15 | 8 | 1 | 35.0 | visualization-6/okno 77.7 |
| zielen | 15 | 6 | 2 | 17.7 | visualization-5/zielen 31.5 |
| niebo | 15 | 6 | 1 | 30.9 | visualization-6/niebo 41.6 |

## ΔE76 (ΔE*ab): typ regionu × ujęcie (✗ = poza progiem)

| typ | viz1 | viz2 | viz3 | viz4 | viz5 | viz6 | int1 | int2 | int3 | int4 | int5 | int6 | int7 | int8 | int10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sciana_jasna | 1 | 22 ✗ | 20 ✗ | 32 ✗ | 39 ✗ | 9 |  |  |  |  |  |  |  |  |  |
| sciana_taupe | 12 ✗ |  | 20 ✗ | 27 ✗ | 9 | 7 |  |  |  |  |  |  |  |  |  |
| dach | 11 ✗ | 32 ✗ | 13 ✗ | 17 ✗ | 8 | 8 |  |  |  |  |  |  |  |  |  |
| szyba | 21 ✗ | 45 ✗ |  |  |  | 78 ✗ |  |  |  |  |  |  |  |  |  |
| zielen | 6 | 12 | 16 ✗ | 24 ✗ | 31 ✗ | 17 ✗ |  |  |  |  |  |  |  |  |  |
| niebo | 34 ✗ | 37 ✗ | 34 ✗ | 25 ✗ | 14 | 42 ✗ |  |  |  |  |  |  |  |  |  |
| sciana_ciemna |  | 3 |  |  | 20 ✗ |  |  |  |  |  |  |  |  |  |  |
| brama |  |  | 20 ✗ |  |  |  |  |  |  |  |  |  |  |  |  |
| sciana_szczyt |  |  |  | 17 ✗ |  |  |  |  |  |  |  |  |  |  |  |
| sufit |  |  |  |  |  |  | 12 ✗ | 17 ✗ | 14 ✗ | 11 ✗ | 11 ✗ | 10 | 14 ✗ | 28 ✗ | 12 ✗ |
| podloga |  |  |  |  |  |  | 4 | 15 ✗ | 8 | 13 ✗ | 33 ✗ | 12 ✗ | 37 ✗ |  | 36 ✗ |
| widok_za_szyba |  |  |  |  |  |  | 13 | 53 ✗ |  |  |  | 31 ✗ |  | 17 ✗ | 23 ✗ |
| sciana_wn |  |  |  |  |  |  |  | 7 | 19 ✗ | 11 ✗ | 2 | 11 ✗ | 21 ✗ | 23 ✗ | 8 |
| zabudowa_drewno |  |  |  |  |  |  |  | 20 ✗ | 25 ✗ |  | 18 ✗ |  | 21 ✗ | 15 ✗ |  |

## Szczegóły

| ujęcie | region | typ | ΔE2000 | ΔE76 | ΔL* | ΔC* | L*a*b* render → runtime | ocena |
|---|---|---|---|---|---|---|---|---|
| visualization-1 | jasna — B, pas między kondygnacjami | sciana_jasna | 0.8 | 1.2 | -1 | +0 | 83/2/6 → 82/2/6 | ✓ |
| visualization-1 | taupe — A, pas między kondygnacjami | sciana_taupe | 14.8 | 12.1 | -2 | +2 | 71/3/10 → 70/-9/9 | ✗ odcień |
| visualization-1 | dachA — dach A | dach | 6.5 | 8.4 | +8 | -2 | 67/2/7 → 76/2/5 | ✓ |
| visualization-1 | dachB — dach B | dach | 8.0 | 11.3 | +11 | -1 | 76/1/4 → 87/2/2 | ✗ za jasno |
| visualization-1 | szyba — A, piętro, prawe okno | szyba | 18.0 | 20.7 | -20 | +3 | 50/-3/-2 → 29/-5/-5 | ✗ za ciemno |
| visualization-1 | zielen — pierwszy plan | zielen | 4.8 | 6.0 | -5 | +3 | 63/-8/18 → 58/-10/20 | ✓ |
| visualization-1 | niebo  | niebo | 17.1 | 33.6 | -18 | +25 | 67/-7/-25 → 49/6/-51 | ✗ za ciemno, za nasycone |
| visualization-2 | jasna — lewy segment, pas między kondygnacjami | sciana_jasna | 21.5 | 22.1 | -20 | +1 | 65/6/0 → 45/0/-7 | ✗ za ciemno |
| visualization-2 | ciemna — prawy segment, lewa część | sciana_ciemna | 2.6 | 2.5 | +2 | -0 | 35/2/-7 → 37/1/-7 | ✓ |
| visualization-2 | dach  | dach | 32.0 | 31.7 | -30 | -5 | 65/0/-15 → 35/6/-7 | ✗ za ciemno, za szare |
| visualization-2 | okno — okno piętra, oświetlone | szyba | 39.4 | 44.8 | -43 | +1 | 58/7/0 → 16/-2/-8 | ✗ za ciemno |
| visualization-2 | zielen  | zielen | 9.2 | 11.7 | +11 | +3 | 27/-8/8 → 38/-9/11 | ✓ |
| visualization-2 | niebo  | niebo | 29.9 | 37.2 | -35 | +11 | 54/1/-18 → 19/10/-27 | ✗ za ciemno, za nasycone |
| visualization-3 | taupe — D, pas między kondygnacjami | sciana_taupe | 18.5 | 19.9 | -19 | -5 | 65/3/10 → 46/1/5 | ✗ za ciemno |
| visualization-3 | jasna — C, pas między kondygnacjami | sciana_jasna | 16.2 | 20.3 | -20 | -2 | 79/2/4 → 59/-0/2 | ✗ za ciemno |
| visualization-3 | dachD  | dach | 6.1 | 7.0 | +2 | -7 | 65/1/7 → 67/0/-0 | ✓ |
| visualization-3 | dachC  | dach | 11.4 | 13.3 | +3 | -7 | 73/3/10 → 76/-0/-3 | ✗ za szare |
| visualization-3 | brama — brama garażowa D | brama | 13.5 | 19.5 | -19 | +2 | 30/6/4 → 10/7/6 | ✗ za ciemno |
| visualization-3 | zielen  | zielen | 9.8 | 15.6 | +3 | -11 | 52/-6/33 → 55/-12/19 | ✗ za szare |
| visualization-3 | niebo  | niebo | 14.4 | 34.0 | -13 | +28 | 66/-7/-16 → 54/6/-45 | ✗ za ciemno, za nasycone |
| visualization-4 | szczyt — szczyt A (zielony) | sciana_szczyt | 15.4 | 16.9 | +11 | -12 | 33/-10/9 → 44/-0/1 | ✗ za jasno, za szare |
| visualization-4 | taupe — front A | sciana_taupe | 22.9 | 27.0 | -27 | -5 | 76/1/7 → 49/-0/2 | ✗ za ciemno, za szare |
| visualization-4 | jasna — front B | sciana_jasna | 23.9 | 32.5 | -32 | -1 | 91/-0/4 → 58/-0/2 | ✗ za ciemno |
| visualization-4 | dach  | dach | 12.6 | 16.8 | +17 | +3 | 65/1/1 → 81/1/4 | ✗ za jasno |
| visualization-4 | zielen  | zielen | 18.7 | 24.0 | +21 | -11 | 52/-15/31 → 74/-8/22 | ✗ za jasno, za szare |
| visualization-4 | niebo  | niebo | 21.9 | 24.6 | +14 | -12 | 76/-4/-18 → 90/7/-1 | ✗ za jasno, za szare |
| visualization-5 | jasna — E, pas pod oknami piętra | sciana_jasna | 33.4 | 38.7 | -38 | -3 | 81/2/6 → 43/-2/-2 | ✗ za ciemno |
| visualization-5 | taupe — F, pas pod oknami piętra | sciana_taupe | 8.0 | 8.9 | +5 | -2 | 35/-1/5 → 41/-1/-3 | ✓ |
| visualization-5 | ciemna — G, pas pod oknami piętra | sciana_ciemna | 19.4 | 20.5 | -20 | -0 | 65/1/-1 → 45/-0/-1 | ✗ za ciemno |
| visualization-5 | dach  | dach | 7.6 | 8.2 | +1 | -2 | 75/2/5 → 77/-0/-3 | ✓ |
| visualization-5 | zielen  | zielen | 18.9 | 31.5 | +5 | -27 | 49/-10/31 → 54/-5/0 | ✗ za jasno, za szare |
| visualization-5 | niebo  | niebo | 10.9 | 14.3 | -10 | +7 | 84/-3/-14 → 75/5/-21 | ✓ |
| visualization-6 | taupe — G, nad oknami piętra | sciana_taupe | 6.6 | 7.3 | -7 | +1 | 45/-0/-0 → 38/0/-1 | ✓ |
| visualization-6 | jasna — E, nad oknami piętra | sciana_jasna | 7.5 | 9.1 | -5 | -7 | 54/0/-13 → 49/1/-5 | ✓ |
| visualization-6 | dach  | dach | 7.5 | 7.7 | -0 | -7 | 46/-2/-8 → 46/1/-1 | ✓ |
| visualization-6 | okno — parter G, oświetlone | szyba | 69.0 | 77.7 | -76 | -6 | 79/5/10 → 3/-1/-5 | ✗ za ciemno, za szare |
| visualization-6 | zielen  | zielen | 12.2 | 17.5 | +12 | +11 | 21/-8/3 → 32/-14/14 | ✗ za jasno, za nasycone |
| visualization-6 | niebo  | niebo | 35.2 | 41.6 | -41 | +8 | 59/3/-23 → 18/8/-30 | ✗ za ciemno, za nasycone |
| interior-1 | sufit  | sufit | 8.1 | 11.8 | +7 | +9 | 84/2/6 → 90/1/15 | ✗ za jasno, za nasycone |
| interior-1 | podloga  | podloga | 2.8 | 4.0 | -3 | +3 | 81/3/10 → 78/3/12 | ✓ |
| interior-1 | widok — ogród za HS | widok_za_szyba | 11.0 | 12.5 | +8 | -5 | 57/-4/7 → 65/-2/-2 | ✓ |
| interior-1 | zaslona  | tekstylia | 8.1 | 12.0 | +12 | +1 | 77/-1/8 → 89/-1/8 | info |
| interior-1 | sofa  | meble | 32.0 | 40.4 | +38 | -15 | 48/4/17 → 86/0/3 | info |
| interior-2 | sufit  | sufit | 12.1 | 17.1 | +14 | +10 | 80/1/5 → 93/-3/15 | ✗ za jasno, za nasycone |
| interior-2 | sciana — ściana TV | sciana_wn | 5.7 | 6.9 | +3 | -6 | 65/1/9 → 68/-0/3 | ✓ |
| interior-2 | dab — okładzina dębowa | zabudowa_drewno | 14.1 | 19.8 | +17 | +10 | 60/9/26 → 77/12/35 | ✗ za jasno, za nasycone |
| interior-2 | podloga  | podloga | 9.7 | 15.0 | +7 | -13 | 60/7/22 → 67/3/10 | ✗ za jasno, za szare |
| interior-2 | widok — żywopłot za oknem | widok_za_szyba | 40.5 | 53.2 | +49 | -21 | 46/-11/21 → 95/-0/3 | ✗ za jasno, za szare |
| interior-3 | sufit  | sufit | 10.5 | 14.0 | +12 | +5 | 82/1/6 → 95/-3/12 | ✗ za jasno, za nasycone |
| interior-3 | dab — ściana dębowa z grafiką | zabudowa_drewno | 18.3 | 25.0 | +22 | +12 | 57/8/23 → 79/12/34 | ✗ za jasno, za nasycone |
| interior-3 | sciana — ściana TV (lewa) | sciana_wn | 18.8 | 19.1 | -14 | -7 | 60/2/13 → 46/-6/3 | ✗ za ciemno, za szare |
| interior-3 | podloga  | podloga | 5.5 | 8.2 | -8 | +3 | 87/3/16 → 79/4/19 | ✓ |
| interior-4 | sufit  | sufit | 9.3 | 11.4 | +5 | +9 | 89/1/5 → 94/-4/14 | ✗ za jasno, za nasycone |
| interior-4 | sciana — ściana przy drzwiach | sciana_wn | 8.2 | 11.1 | +10 | -5 | 78/2/6 → 88/-0/1 | ✗ za jasno |
| interior-4 | podloga  | podloga | 9.2 | 13.1 | +11 | -6 | 78/3/16 → 89/-0/10 | ✗ za jasno, za szare |
| interior-4 | sofa  | meble | 11.6 | 16.4 | +13 | -10 | 82/2/10 → 95/-0/0 | info |
| interior-5 | sufit  | sufit | 7.1 | 10.7 | +6 | +9 | 82/1/6 → 89/3/15 | ✗ za jasno, za nasycone |
| interior-5 | sciana — ściana nad kuchnią | sciana_wn | 1.5 | 2.0 | -0 | +2 | 62/2/10 → 62/2/12 | ✓ |
| interior-5 | dab — słupek kuchenny | zabudowa_drewno | 12.2 | 17.8 | +15 | +10 | 63/5/21 → 78/7/31 | ✗ za jasno, za nasycone |
| interior-5 | podloga  | podloga | 25.2 | 33.4 | +30 | -13 | 55/6/23 → 86/-0/10 | ✗ za jasno, za szare |
| interior-5 | sofa  | meble | 3.3 | 5.1 | +5 | -1 | 84/1/11 → 89/1/10 | info |
| interior-6 | sufit  | sufit | 6.8 | 9.7 | -2 | +9 | 90/1/6 → 88/3/15 | ✓ |
| interior-6 | sciana — nad TV | sciana_wn | 7.7 | 10.5 | -10 | -2 | 83/2/6 → 73/-0/4 | ✗ za ciemno |
| interior-6 | podloga  | podloga | 8.3 | 11.6 | +7 | -9 | 72/4/17 → 79/0/8 | ✗ za jasno, za szare |
| interior-6 | widok — żywopłot za HS | widok_za_szyba | 24.4 | 31.1 | +25 | -19 | 47/-14/24 → 72/-5/7 | ✗ za jasno, za szare |
| interior-6 | sofa  | meble | 25.6 | 35.9 | +33 | -13 | 61/3/15 → 94/-0/2 | info |
| interior-7 | sufit  | sufit | 9.3 | 13.7 | +13 | -5 | 82/1/5 → 95/-0/0 | ✗ za jasno |
| interior-7 | szafa — fronty szaf (szałwia) | sciana_wn | 17.9 | 21.4 | +20 | +2 | 62/1/8 → 82/-7/7 | ✗ za jasno |
| interior-7 | dab — ściana za łóżkiem | zabudowa_drewno | 17.2 | 21.3 | +19 | +9 | 52/7/20 → 71/9/28 | ✗ za jasno, za nasycone |
| interior-7 | podloga  | podloga | 28.5 | 36.8 | +31 | -17 | 54/5/18 → 85/-1/-1 | ✗ za jasno, za szare |
| interior-7 | posciel  | tekstylia | 4.5 | 5.9 | +5 | -4 | 91/1/4 → 95/-0/0 | info |
| interior-8 | sufit  | sufit | 25.1 | 28.3 | -28 | +3 | 73/1/7 → 45/0/10 | ✗ za ciemno |
| interior-8 | szafa — fronty szaf | sciana_wn | 16.0 | 23.1 | +21 | -10 | 74/2/10 → 95/-0/0 | ✗ za jasno, za szare |
| interior-8 | nisza — nisza-domek (dąb) | zabudowa_drewno | 10.0 | 14.7 | -8 | +12 | 52/6/18 → 44/8/31 | ✗ za ciemno, za nasycone |
| interior-8 | widok  | widok_za_szyba | 13.8 | 17.1 | +13 | +0 | 75/-2/5 → 88/1/-6 | ✗ za jasno |
| interior-10 | sufit  | sufit | 8.2 | 12.1 | +10 | +7 | 78/1/7 → 88/1/13 | ✗ za jasno, za nasycone |
| interior-10 | sciana — lamele za łóżkiem | sciana_wn | 6.0 | 7.7 | +6 | -4 | 75/1/7 → 81/-0/2 | ✓ |
| interior-10 | podloga  | podloga | 27.9 | 36.3 | +27 | -15 | 57/3/19 → 84/-1/-4 | ✗ za jasno, za szare |
| interior-10 | widok  | widok_za_szyba | 16.7 | 22.6 | +20 | -10 | 67/-6/14 → 88/-0/5 | ✗ za jasno, za szare |

Pary z regionami: `iteracje/04/pary/<ujęcie>.jpg` (zielony = w progu, czerwony = poza, niebieski = info).
