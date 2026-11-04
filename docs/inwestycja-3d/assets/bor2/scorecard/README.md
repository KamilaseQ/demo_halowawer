# Scorecard ΔE: BOR2 ↔ rendery dewelopera

Test odbioru kolorystyki. Odpalany po każdej dostawie GLB i po zmianach światła w `/domy`.

## Pliki

| Plik | Co robi |
|---|---|
| `regiony.json` | Regiony pomiarowe dla 15 renderów (visualization-1…6, interior-1…8, 10): ściany jasne/taupe, dachy, szyby, zieleń, niebo, podłogi, ściany i sufity wnętrz, okładziny dębowe. Prostokąty w ułamkach kadru; `rt` = osobny prostokąt dla obrazu runtime tam, gdzie kadr BOR2 jest przesunięty. Progi i miara. |
| `zrzuty.mjs` | Zrzuty z kamer `../ujecia-porownawcze.json` w proporcjach renderu. Tryb `glb` (podgląd three.js z dostarczonych GLB, `podglad.html`) albo `domy` (scena `/domy?kadr=<render>&pora=…`). |
| `scorecard.py` | Mediana CIELAB w każdym regionie, bramka ΔE*ab (ΔE76) + ΔE2000 pomocniczo, ΔL*/ΔC* z diagnozą („za jasno”, „za szare”…), wynik `.md` i pary JPG z regionami. |
| `petla.py`, `trend.md`, `iteracje/NN/` | Szybka pętla po dostawie i jej historia. |
| `wynik-*.md`, `pary-*/` | Pojedyncze pomiary sprzed pętli. |

## Szybka pętla po dostawie (domyślny tryb pracy)

```
python docs/inwestycja-3d/assets/bor2/scorecard/petla.py --etykieta "v7 + wnętrze G v1"
```

Robi zrzuty `/domy?kadr=` (dev :3142), liczy scorecard, porównuje z poprzednią iteracją i zapisuje wyniki w `iteracje/NN/`: `wynik.md`, `wynik.json`, `regresje.md` (pogorszenie regionu > 3 ΔE = alarm do właściciela) i `arkusz.jpg` (render | teraz | poprzednio dla vis-1, vis-2 Noc, vis-3, vis-4, interior-4, -8, -2, -7). Dopisuje też wiersz do `trend.md`. Trwa ok. 2 min. `--z-katalogu <dir>` importuje gotowe zrzuty.

## Uruchomienie (z katalogu głównego projektu)

```
# 1) dostawa GLB (59): podgląd three.js, bez pory Noc (vis-2 i vis-6 pomijane)
node docs/inwestycja-3d/assets/bor2/scorecard/zrzuty.mjs glb <katalog> zew=docs/inwestycja-3d/assets/bor2/bor2-zewnetrze-v4.glb
python docs/inwestycja-3d/assets/bor2/scorecard/scorecard.py <katalog> --etykieta "GLB v4" --wynik .../wynik-glb-v4.md --pary .../pary-glb-v4

# 2) runtime /domy (po wdrożeniu ?kadr= przez moduł 3D): z porą Noc dla vis-2 i vis-6
node docs/inwestycja-3d/assets/bor2/scorecard/zrzuty.mjs domy <katalog> url="http://localhost:3141/domy/a?kadr={id}&pora={pora}&czysty=1"
python docs/inwestycja-3d/assets/bor2/scorecard/scorecard.py <katalog> --noc --etykieta "/domy" --wynik .../wynik-domy.md --pary .../pary-domy
```

Opcje `zrzuty.mjs glb`: `zew=`, `dom1=`, `dom2=` (ścieżki GLB względem katalogu projektu; domyślnie z `ujecia-porownawcze.json`), `wszystkie=1` (także ujęcia bez regionów). Przeglądarka: zmienna `BROWSER` albo Chrome z `C:/Program Files/Google/Chrome`.

## Cel odbioru

- ściany, dachy, podłogi, sufity: ΔE*ab ≤ 10;
- szyby i widok za szybą, zieleń, niebo: ΔE*ab ≤ 15;
- meble i tekstylia: tylko informacyjnie.

Bramka to ΔE*ab (CIELAB 1976), bo ΔE2000 łagodzi różnice nasycenia. Przykład z pomiaru bazowego: okładzina dębowa w interior-2 ma C* 28 → 45 (wyraźnie pomarańczowa) i ΔE2000 = 6,8 („w progu”), a ΔE*ab = 17,4 (poza progiem).

## Ograniczenia

- Mediana regionu mierzy kolor i jasność, nie fakturę. Gładka biel i biel z jodełką mogą mieć podobną medianę, dlatego zawsze patrz też na pary.
- Tryb `glb` ma neutralne światło podglądu (jak `verify.html`), więc mierzy przede wszystkim materiały. O odbiorze decyduje tryb `domy`.
- Kadry vis-4, vis-5 i interior-7 są dopasowane przybliżenie; ich regiony mają osobne prostokąty `rt`.
- interior-9 nie ma kamery w modelu i nie jest mierzone.
