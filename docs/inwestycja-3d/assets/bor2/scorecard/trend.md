# Trend scorecardu ΔE (runtime /domy ↔ rendery)

Bramka ΔE76 (ΔE*ab); progi: ściany/dachy/podłogi/sufity ≤ 10, szyby/zieleń/niebo ≤ 15. Szczegóły: `iteracje/NN/` (zrzuty, wynik, regresje, arkusz render | teraz | poprzednio).

| iteracja | czas | stan | w progu | średnie ΔE | regresje > 3 | poprawy > 3 |
|---|---|---|---|---|---|---|
| 00 | 2026-11-04 17:43 | zewnętrze v4, wnętrze G placeholder (pomiar 59, `assets/bor2/podglad/scorecard-domy-v4-59.md`) | 14/57 (25%) | 23.1 | — | — |
| 01 | 2026-11-04 18:13 | zewnętrze v5, wnętrze G placeholder | 13/57 (23%) | 22.9 | 0 | 0 |
| 02 | 2026-11-04 18:13 | zewnętrze v6 + okolica-v1, grunt/las/drzewa (55) | 10/57 (18%) | 24.0 | 4 | 0 |
| 03 | 2026-11-04 18:18 | wnętrze B v1 (A–D) + okolica-v1; zewnętrze jak w runtime | 17/73 (23%) | 20.2 | 6 | 18 |
| 04 | 2026-11-04 18:21 | 55: wycięte nawierzchnie OSM na łące, jaśniejsze duchy; v7, wnętrza G v1 i B v1 | 19/73 (26%) | 19.5 | 0 | 2 |
| 05 | 2026-11-04 18:33 | 55: v8 (pręty, kolory per dom, płyty tarasów), A2C tylko z MSAA, duchy #bdbcb7 | 19/73 (26%) | 19.6 | 1 | 5 |
| 06 | 2026-11-04 18:44 | 55: v9 (tynk PBR), rośliny v3, wnętrza v2 G/B, duchy ukrywane przy kamerze; region taupe A zawężony | 20/74 (27%) | 19.8 | 19 | 25 |

**Stan końcowy (04.11.2026, ~19:00, koniec pracy zespołu):** ostatnia iteracja 06 — wynik obciążony wadliwym tynkiem v9 (D-021); poprawione v10 nie zostało zmierzone. Najlepszy wynik: iteracja 04/05 (19/73, ΔE 19,5–19,6).
