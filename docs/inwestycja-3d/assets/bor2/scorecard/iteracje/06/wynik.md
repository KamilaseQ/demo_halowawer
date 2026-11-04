# Scorecard ΔE — iteracja 06: 55: v9 (tynk PBR), rośliny v3, wnętrza v2 G/B, duchy ukrywane przy kamerze; region taupe A zawężony

Stan: 2026-11-04 18:47. Źródło obrazów: `iteracje/06/runtime`. Bramka: ΔE76 (ΔE*ab) median CIELAB regionu (render dewelopera ↔ runtime); ΔE2000 pomocniczo.
Progi odbioru: ściany, dachy, podłogi, sufity ≤ 10; szyby/widok za szybą, zieleń, niebo ≤ 15. Regiony „info” (meble, tekstylia) bez progu.

**Wynik zbiorczy: 20/74 regionów w progu (27%), średnie ΔE76 (ΔE*ab) = 19.8.**

## Wg klasy

| klasa | próg | regionów | w progu | średnie ΔE76 (ΔE*ab) | najgorszy |
|---|---|---|---|---|---|
| sciana | 10 | 29 | 5 | 20.1 | visualization-5/jasna 51.3 |
| dach | 10 | 8 | 3 | 14.2 | visualization-2/dach 31.8 |
| podloga | 10 | 8 | 3 | 16.4 | interior-7/podloga 35.1 |
| sufit | 10 | 9 | 6 | 11.1 | interior-8/sufit 28.8 |
| szyba | 15 | 8 | 1 | 31.0 | visualization-6/okno 77.7 |
| zielen | 15 | 6 | 2 | 16.8 | visualization-5/zielen 25.5 |
| niebo | 15 | 6 | 0 | 31.6 | visualization-6/niebo 41.6 |

## ΔE76 (ΔE*ab): typ regionu × ujęcie (✗ = poza progiem)

| typ | viz1 | viz2 | viz3 | viz4 | viz5 | viz6 | int1 | int2 | int3 | int4 | int5 | int6 | int7 | int8 | int10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sciana_jasna | 33 ✗ | 37 ✗ | 22 ✗ | 35 ✗ | 51 ✗ | 13 ✗ |  |  |  |  |  |  |  |  |  |
| sciana_taupe | 31 ✗ |  | 22 ✗ | 29 ✗ | 21 ✗ | 12 ✗ |  |  |  |  |  |  |  |  |  |
| dach | 15 ✗ | 32 ✗ | 17 ✗ | 15 ✗ | 9 | 7 |  |  |  |  |  |  |  |  |  |
| szyba | 21 ✗ | 44 ✗ |  |  |  | 78 ✗ |  |  |  |  |  |  |  |  |  |
| zielen | 9 | 9 | 15 ✗ | 24 ✗ | 26 ✗ | 17 ✗ |  |  |  |  |  |  |  |  |  |
| niebo | 34 ✗ | 37 ✗ | 34 ✗ | 25 ✗ | 19 ✗ | 42 ✗ |  |  |  |  |  |  |  |  |  |
| sciana_ciemna |  | 15 ✗ |  |  | 46 ✗ |  |  |  |  |  |  |  |  |  |  |
| brama |  |  | 20 ✗ |  |  |  |  |  |  |  |  |  |  |  |  |
| sciana_szczyt |  |  |  | 12 ✗ |  |  |  |  |  |  |  |  |  |  |  |
| sufit |  |  |  |  |  |  | 7 | 10 | 8 | 8 | 6 | 14 ✗ | 14 ✗ | 29 ✗ | 5 |
| podloga |  |  |  |  |  |  | 6 | 17 ✗ | 12 ✗ | 4 | 21 ✗ | 3 | 35 ✗ |  | 33 ✗ |
| widok_za_szyba |  |  |  |  |  |  | 20 ✗ | 32 ✗ |  |  |  | 18 ✗ |  | 21 ✗ | 14 |
| sciana_wn |  |  |  |  |  |  |  | 13 ✗ | 10 | 10 | 5 | 5 | 18 ✗ | 19 ✗ | 13 ✗ |
| zabudowa_drewno |  |  |  |  |  |  |  | 14 ✗ | 20 ✗ |  | 12 ✗ |  | 15 ✗ | 9 |  |

## Szczegóły

| ujęcie | region | typ | ΔE2000 | ΔE76 | ΔL* | ΔC* | L*a*b* render → runtime | ocena |
|---|---|---|---|---|---|---|---|---|
| visualization-1 | jasna — B, pas między kondygnacjami | sciana_jasna | 26.2 | 32.5 | -32 | -2 | 83/2/6 → 51/-0/4 | ✗ za ciemno |
| visualization-1 | taupe — A, pas między kondygnacjami pod prawym oknem (bez ram i drzewa — decyzja b6) | sciana_taupe | 28.3 | 31.5 | -31 | -6 | 74/3/10 → 43/-0/4 | ✗ za ciemno, za szare |
| visualization-1 | taupe-gora — A, pas pod okapem nad oknami piętra | sciana_taupe | 18.8 | 22.4 | -16 | -12 | 78/-3/-14 → 62/3/1 | ✗ za ciemno, za szare |
| visualization-1 | dachA — dach A | dach | 5.9 | 6.9 | -5 | -4 | 67/2/7 → 62/3/2 | ✓ |
| visualization-1 | dachB — dach B | dach | 9.8 | 14.7 | +15 | -2 | 76/1/4 → 91/1/2 | ✗ za jasno |
| visualization-1 | szyba — A, piętro, prawe okno | szyba | 18.1 | 20.8 | -20 | +3 | 50/-3/-2 → 29/-5/-5 | ✗ za ciemno |
| visualization-1 | zielen — pierwszy plan | zielen | 7.7 | 9.4 | -8 | +5 | 63/-8/18 → 55/-10/22 | ✓ |
| visualization-1 | niebo  | niebo | 17.1 | 33.6 | -18 | +25 | 67/-7/-25 → 49/6/-51 | ✗ za ciemno, za nasycone |
| visualization-2 | jasna — lewy segment, pas między kondygnacjami | sciana_jasna | 35.8 | 36.7 | -36 | -3 | 65/6/0 → 28/1/-3 | ✗ za ciemno |
| visualization-2 | ciemna — prawy segment, lewa część | sciana_ciemna | 11.5 | 15.0 | -14 | -5 | 35/2/-7 → 21/1/-3 | ✗ za ciemno |
| visualization-2 | dach  | dach | 32.0 | 31.8 | -30 | -6 | 65/0/-15 → 35/6/-7 | ✗ za ciemno, za szare |
| visualization-2 | okno — okno piętra, oświetlone | szyba | 38.7 | 44.2 | -42 | +2 | 58/7/0 → 16/-1/-9 | ✗ za ciemno |
| visualization-2 | zielen  | zielen | 7.3 | 9.5 | +9 | +3 | 27/-8/8 → 36/-9/11 | ✓ |
| visualization-2 | niebo  | niebo | 29.9 | 37.2 | -35 | +11 | 54/1/-18 → 19/10/-27 | ✗ za ciemno, za nasycone |
| visualization-3 | taupe — D, pas między kondygnacjami | sciana_taupe | 20.2 | 21.9 | -20 | -9 | 65/3/10 → 46/-0/1 | ✗ za ciemno, za szare |
| visualization-3 | jasna — C, pas między kondygnacjami | sciana_jasna | 18.1 | 22.4 | -22 | -2 | 79/2/4 → 57/0/-2 | ✗ za ciemno |
| visualization-3 | dachD  | dach | 10.6 | 12.1 | +6 | -3 | 65/1/7 → 71/0/-4 | ✗ za jasno |
| visualization-3 | dachC  | dach | 14.4 | 17.1 | +3 | -3 | 73/3/10 → 77/0/-7 | ✗ odcień |
| visualization-3 | brama — brama garażowa D | brama | 13.6 | 19.7 | -20 | +2 | 30/6/4 → 10/7/6 | ✗ za ciemno |
| visualization-3 | zielen  | zielen | 9.2 | 15.1 | -2 | -11 | 52/-6/33 → 50/-11/19 | ✗ za szare |
| visualization-3 | niebo  | niebo | 14.4 | 34.0 | -13 | +28 | 66/-7/-16 → 54/6/-45 | ✗ za ciemno, za nasycone |
| visualization-4 | szczyt — szczyt A (zielony) | sciana_szczyt | 9.4 | 12.1 | -4 | -7 | 33/-10/9 → 29/-7/-2 | ✗ za szare |
| visualization-4 | taupe — front A | sciana_taupe | 24.7 | 28.9 | -28 | -6 | 76/1/7 → 48/0/-1 | ✗ za ciemno, za szare |
| visualization-4 | jasna — front B | sciana_jasna | 26.3 | 35.1 | -35 | -3 | 91/-0/4 → 56/0/-1 | ✗ za ciemno |
| visualization-4 | dach  | dach | 11.2 | 14.8 | +15 | +0 | 65/1/1 → 80/2/-0 | ✗ za jasno |
| visualization-4 | zielen  | zielen | 18.7 | 24.0 | +21 | -11 | 52/-15/31 → 74/-8/22 | ✗ za jasno, za szare |
| visualization-4 | niebo  | niebo | 21.8 | 24.5 | +14 | -12 | 76/-4/-18 → 90/7/-1 | ✗ za jasno, za szare |
| visualization-5 | jasna — E, pas pod oknami piętra | sciana_jasna | 48.3 | 51.3 | -50 | -3 | 81/2/6 → 30/-3/-2 | ✗ za ciemno |
| visualization-5 | taupe — F, pas pod oknami piętra | sciana_taupe | 15.7 | 20.8 | -20 | -2 | 35/-1/5 → 15/-3/-1 | ✗ za ciemno |
| visualization-5 | ciemna — G, pas pod oknami piętra | sciana_ciemna | 41.9 | 46.0 | -46 | +1 | 65/1/-1 → 19/1/2 | ✗ za ciemno |
| visualization-5 | dach  | dach | 8.4 | 9.0 | +1 | -2 | 75/2/5 → 76/-1/-4 | ✓ |
| visualization-5 | zielen  | zielen | 14.6 | 25.5 | -5 | -23 | 49/-10/31 → 44/-7/6 | ✗ za szare |
| visualization-5 | niebo  | niebo | 13.0 | 18.7 | -12 | +10 | 84/-3/-14 → 72/6/-24 | ✗ za ciemno, za nasycone |
| visualization-6 | taupe — G, nad oknami piętra | sciana_taupe | 10.1 | 11.5 | -12 | +1 | 45/-0/-0 → 33/0/-1 | ✗ za ciemno |
| visualization-6 | jasna — E, nad oknami piętra | sciana_jasna | 11.4 | 12.8 | -10 | -9 | 54/0/-13 → 45/0/-4 | ✗ za ciemno, za szare |
| visualization-6 | dach  | dach | 6.5 | 7.3 | -0 | -7 | 46/-2/-8 → 45/0/-1 | ✓ |
| visualization-6 | okno — parter G, oświetlone | szyba | 69.0 | 77.7 | -76 | -6 | 79/5/10 → 3/-1/-5 | ✗ za ciemno, za szare |
| visualization-6 | zielen  | zielen | 12.2 | 17.5 | +12 | +11 | 21/-8/3 → 32/-14/14 | ✗ za jasno, za nasycone |
| visualization-6 | niebo  | niebo | 35.2 | 41.6 | -41 | +8 | 59/3/-23 → 18/8/-30 | ✗ za ciemno, za nasycone |
| interior-1 | sufit  | sufit | 4.8 | 6.7 | +0 | +7 | 84/2/6 → 84/2/12 | ✓ |
| interior-1 | podloga  | podloga | 3.9 | 5.5 | -4 | +4 | 81/3/10 → 77/3/14 | ✓ |
| interior-1 | widok — ogród za HS | widok_za_szyba | 19.8 | 20.4 | -19 | -7 | 57/-4/7 → 38/-1/0 | ✗ za ciemno, za szare |
| interior-1 | zaslona  | tekstylia | 1.7 | 2.0 | +1 | -2 | 77/-1/8 → 78/-1/6 | info |
| interior-1 | sofa  | meble | 27.0 | 32.8 | +29 | -15 | 48/4/17 → 77/-0/3 | info |
| interior-2 | sufit  | sufit | 7.1 | 10.0 | +7 | +7 | 80/1/5 → 86/3/12 | ✓ |
| interior-2 | sciana — ściana TV | sciana_wn | 10.2 | 13.3 | +13 | -3 | 65/1/9 → 78/-0/6 | ✗ za jasno |
| interior-2 | dab — okładzina dębowa | zabudowa_drewno | 11.3 | 14.1 | +14 | -1 | 60/9/26 → 74/7/25 | ✗ za jasno |
| interior-2 | podloga  | podloga | 10.7 | 17.2 | +2 | -17 | 60/7/22 → 62/1/6 | ✗ za szare |
| interior-2 | widok — żywopłot za oknem | widok_za_szyba | 27.2 | 32.4 | +27 | -17 | 46/-11/21 → 73/0/6 | ✗ za jasno, za szare |
| interior-3 | sufit  | sufit | 5.6 | 8.1 | +6 | +6 | 82/1/6 → 88/3/12 | ✓ |
| interior-3 | dab — ściana dębowa z grafiką | zabudowa_drewno | 15.8 | 19.6 | +19 | +2 | 57/8/23 → 76/7/25 | ✗ za jasno |
| interior-3 | sciana — ściana TV (lewa) | sciana_wn | 9.3 | 9.8 | +2 | -7 | 60/2/13 → 62/-3/5 | ✓ |
| interior-3 | podloga  | podloga | 8.0 | 12.4 | -11 | +7 | 87/3/16 → 76/4/22 | ✗ za ciemno, za nasycone |
| interior-4 | sufit  | sufit | 5.8 | 8.2 | -3 | +7 | 89/1/5 → 86/2/12 | ✓ |
| interior-4 | sciana — ściana przy drzwiach | sciana_wn | 8.5 | 9.7 | +4 | -3 | 78/2/6 → 83/-0/-3 | ✓ |
| interior-4 | podloga  | podloga | 2.9 | 4.1 | +3 | +3 | 78/3/16 → 81/2/19 | ✓ |
| interior-4 | sofa  | meble | 11.6 | 16.4 | +13 | -10 | 82/2/10 → 95/-0/0 | info |
| interior-5 | sufit  | sufit | 4.2 | 5.9 | -3 | +5 | 82/1/6 → 80/2/12 | ✓ |
| interior-5 | sciana — ściana nad kuchnią | sciana_wn | 4.3 | 4.7 | -4 | +1 | 62/2/10 → 57/1/11 | ✓ |
| interior-5 | dab — słupek kuchenny | zabudowa_drewno | 9.5 | 12.1 | +12 | -1 | 63/5/21 → 75/4/20 | ✗ za jasno |
| interior-5 | podloga  | podloga | 17.3 | 21.3 | +20 | -5 | 55/6/23 → 76/2/19 | ✗ za jasno |
| interior-5 | sofa  | meble | 4.3 | 6.1 | -3 | -5 | 84/1/11 → 81/1/6 | info |
| interior-6 | sufit  | sufit | 9.3 | 13.6 | -12 | +6 | 90/1/6 → 78/2/11 | ✗ za ciemno, za nasycone |
| interior-6 | sciana — nad TV | sciana_wn | 3.9 | 5.1 | -5 | +1 | 83/2/6 → 79/0/7 | ✓ |
| interior-6 | podloga  | podloga | 2.5 | 3.0 | +0 | -3 | 72/4/17 → 73/2/14 | ✓ |
| interior-6 | widok — żywopłot za HS | widok_za_szyba | 13.3 | 18.0 | +10 | -14 | 47/-14/24 → 57/-4/13 | ✗ za jasno, za szare |
| interior-6 | sofa  | meble | 25.2 | 35.2 | +33 | -13 | 61/3/15 → 94/-0/2 | info |
| interior-7 | sufit  | sufit | 9.3 | 13.7 | +13 | -5 | 82/1/5 → 95/-0/0 | ✗ za jasno |
| interior-7 | szafa — fronty szaf (szałwia) | sciana_wn | 15.0 | 18.1 | +17 | -3 | 62/1/8 → 79/-4/3 | ✗ za jasno |
| interior-7 | dab — ściana za łóżkiem | zabudowa_drewno | 12.8 | 14.8 | +14 | +4 | 52/7/20 → 66/6/24 | ✗ za jasno |
| interior-7 | podloga  | podloga | 27.6 | 35.1 | +29 | -16 | 54/5/18 → 82/-1/-2 | ✗ za jasno, za szare |
| interior-7 | posciel  | tekstylia | 4.5 | 5.9 | +5 | -4 | 91/1/4 → 95/-0/0 | info |
| interior-8 | sufit  | sufit | 25.6 | 28.8 | -29 | +4 | 73/1/7 → 45/1/11 | ✗ za ciemno |
| interior-8 | szafa — fronty szaf | sciana_wn | 13.2 | 19.1 | +18 | -6 | 74/2/10 → 92/-0/4 | ✗ za jasno, za szare |
| interior-8 | nisza — nisza-domek (dąb) | zabudowa_drewno | 8.8 | 9.4 | -9 | +4 | 52/6/18 → 44/6/22 | ✓ |
| interior-8 | widok  | widok_za_szyba | 17.6 | 21.2 | -21 | +3 | 75/-2/5 → 54/-4/7 | ✗ za ciemno |
| interior-10 | sufit  | sufit | 3.4 | 4.7 | -2 | +4 | 78/1/7 → 76/1/11 | ✓ |
| interior-10 | sciana — lamele za łóżkiem | sciana_wn | 9.6 | 13.2 | +12 | -6 | 75/1/7 → 87/-0/1 | ✗ za jasno, za szare |
| interior-10 | podloga  | podloga | 25.7 | 32.8 | +21 | -14 | 57/3/19 → 78/-2/-6 | ✗ za jasno, za szare |
| interior-10 | widok  | widok_za_szyba | 11.1 | 13.7 | -6 | -12 | 67/-6/14 → 61/-0/3 | ✓ |

Pary z regionami: `iteracje/06/pary/<ujęcie>.jpg` (zielony = w progu, czerwony = poza, niebieski = info).
