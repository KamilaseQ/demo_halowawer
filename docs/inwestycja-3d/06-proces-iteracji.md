# Proces: od ogółu do szczegółu, z bramkami

Stan na 04.11.2026. Decyzja klienta po przeglądzie frontu domu, gdzie wyszły pozostałości starej makiety i błędy mapowania. Plik prowadzi b6. Kryteria odbioru są w [05-odbior-bor2.md](05-odbior-bor2.md).

## Co poszło źle do tej pory

- **Odbiór na kilku kadrach-bohaterach.** Błędy zostały w miejscach, w które nikt nie spojrzał: front, wnęki, geokrata, boki tarasów.
- **Szybkie wpięcie bez polityki pozostałości.** Elementy proceduralne starej makiety współistnieją z BOR2.
- **Wykonawca sam ocenia swoją pracę.** Brakowało niezależnej, powtarzalnej kontroli.

## Źródła prawdy

| Co | Źródło |
|---|---|
| Geometria | `bor2-zewnetrze-v*.blend`, `bor2-wnetrze-dom*.blend` (model architekta). Render Workbench z tej samej kamery to wzorzec geometrii. |
| Wymiary | Rzuty dewelopera (`zrodla/rzuty`), zweryfikowane w 05. |
| Wygląd | Rendery dewelopera (`public/explorer/gallery`). Kamery i obiektywy są w `assets/bor2/ujecia-porownawcze.json`. |
| Okolica | OpenStreetMap i zdjęcia z drona (`estate-*.jpg`). |

## Tryb obecny: szybka pętla wyglądu

Decyzja klienta z 04.11: najwyższy priorytet ma wygląd wszystkich domów z zewnątrz i wewnątrz, tak by przypominały wizualizacje. Optymalizacje są zamrożone. Wyjątek: spadek poniżej około 30 fps albo zawieszanie się strony.

L0 i L1 są w praktyce zamknięte (sweep-01). Poziomy L2, L3 i L4 prowadzimy równolegle, małymi dostawami:

1. **Dostawa.** Wykonawca oddaje małą zmianę (≤ 30–45 min pracy) z krótką notką, co się zmieniło.
2. **Wpięcie.** 55 wpina ją od razu i robi zrzuty `?kadr=` (vis-1, vis-2 w porze Noc, vis-3, vis-4 i wnętrza).
3. **Pętla audytora (≤ 10 min).** e3 przygotowuje:
   - scorecard ΔE;
   - arkusz „render | teraz | poprzednio”;
   - 3 największe różnice widoczne gołym okiem;
   - wpis w `scorecard/trend.md`.
4. **Priorytety.** b6 ustala 1–3 następne priorytety dla każdego wykonawcy według największej widocznej różnicy.
5. **Regres.** Pogorszenie regionu o ΔE > 3 audytor zgłasza od razu właścicielowi.

Pełny sweep (97 ujęć) robimy co około 3 dostawy albo przed odbiorem.

## Poziomy i bramki

Poziom N+1 dla danego obszaru zaczynamy dopiero wtedy, gdy poziom N jest tam zamknięty. Assety (wnętrza, rośliny, okolica) przygotowujemy równolegle, ale do sceny wchodzą tylko przez bramkę.

| Poziom | Sprawdzamy | Bramka (warunek zamknięcia) |
|---|---|---|
| L0 Inwentarz | Każdy obiekt ma `userData.source` (bor2, proc, okolica, zielen, wnetrze, ui). W granicy osiedla nie ma geometrii `proc` poza terenem. | 0 duplikatów, 0 pozostałości, zrzut sceny bez niespodzianek |
| L1 Geometria | Sweep runtime obok Workbench: sylwetki, otwory, drzwi, bramy, płoty | 0 dziur, 0 z-fightingu, 0 braków i przesunięć |
| L2 Materiały i UV | Przypisanie materiałów, gęstość tekseli, rozciągnięcia, kolory | 0 rozciągnięć. ΔE ≤ 10 dla ścian, dachów i podłóg, ≤ 15 dla szyb i zieleni |
| L3 Światło | Niebo, słońce, cień i AO, lightmapy wnętrz, Noc | Histogram luminancji i kontrast cienia zbliżone do renderów, brak czarnych kątów |
| L4 Zieleń i detal | Rośliny, firany, oprawy, drobne elementy | Gęstość i charakter jak na vis-1 i vis-5, brak „growego” wyglądu z bliska |
| L5 Wydajność | Ładowanie, czas klatki, przycięcia (monitorowane od L0) | Budżety z 05 i od 55 |

## Iteracja

1. **Sweep.** Audytor (e3) robi:
   - na każdy dom 16 ujęć: 8 azymutów × (oczy 1,65 m z 8 m oraz z góry 30° z 20 m);
   - ujęcia z punktów spaceru po osiedlu;
   - po 3 ujęcia na pokój we wnętrzach;
   - render Workbench z tych samych kamer.
2. **Rejestr.** Audytor wpisuje defekty do [defekty.md](defekty.md): ID, poziom, miejsce, przyczyna, właściciel, dowód.
3. **Poprawki.** Wykonawcy poprawiają tylko defekty przypisane do siebie, w kolejności poziomów.
4. **Ponowny sweep.** Zamyka audytor, nigdy wykonawca. Dochodzi arkusz „poprzednia iteracja / obecna”.
5. **Bramka.** b6 decyduje, czy poziom jest zamknięty i co wchodzi w następnej iteracji.
6. **Test regresji.** Każdy defekt, który dało się wykryć automatycznie, staje się stałym testem, odpalanym przy każdej dostawie:
   - duplikaty;
   - geometria `proc` w granicy osiedla;
   - rozciągnięcie UV;
   - przekroczenie budżetu.

## Stan iteracji

| Iteracja | Data | Scorecard ΔE (regiony w progu, średnie ΔE76) | L0 | L1 | Uwagi |
|---|---|---|---|---|---|
| 0 (bazowa) | 04.11, 17:43 | 14/57 (25%), 23,1 | otwarte | otwarte | Runtime: zewnętrze v4, wnętrze G jako placeholder SKP. W słońcu ściany trafiają (vis-1: jasna 0,6, taupe 9,7). Odstają: cień i fill za ciemne (L z renderu → L z runtime: 79 → 59, 91 → 59), niebo, szyby, okna nocą, wnętrza (placeholder). Plik: `assets/bor2/podglad/scorecard-domy-v4-59.md`. |

| sweep-01 | 04.11 | — (scorecard v5 w toku) | czysto | sylwetki, otwory, drzwi i bramy zgodne z Workbench w 80 ujęciach (poprawki A, F, G z v5 potwierdzone) | 97 ujęć. 11 defektów otwartych ([defekty.md](defekty.md)). Najważniejsze: płot (D-001/002), podjazdy jako trawa (D-004), wnęki (D-003: jeden ton = kolor stolarki, wg vis-3), geokrata (D-005), kwantyzacja pozycji (D-006, naprawione w v6, czeka na weryfikację), drzewa przy elewacjach (D-008), zieleń 2,25 mln trójkątów (D-010). |

| pętla 04 | 04.11 | 19/73 (26%), 19,5 (najlepszy dotąd) | — | — | Zewnętrze v7, wnętrza G v1 i B v1 z lightmapami we wszystkich 7 domach, okolica z OSM. Regres zieleni z pętli 02 odwrócony. Klient zgłosił artefakty przy gruncie (płot, kreski, obwódki liści, rośliny w rzędach, białe duchy). Do sweepu i pętli dochodzą ujęcia przy gruncie: 0,6 m i 1,65 m wzdłuż płotów, ścieżek, podjazdów i rabat. |

| pętla 06 | 04.11 | 20/74 (27%), 19,8 | — | — | Zewnętrze v9 (tynk PBR z czarną normal mapą, czyli regres jasności elewacji; poprawka czeka w v10), rośliny v3, wnętrza v2. Dochodzi zestaw „elewacje z bliska” (A, C, E, G; 3 i 8 m). |

### Stan na zakończenie pracy (04.11, wieczór, decyzja klienta)

| Element | Wersja |
|---|---|
| Obowiązujące zewnętrze | **v8** (`assets/bor2/bor2-zewnetrze-v8.glb`, `test_glb.py` OK) |
| Wadliwe, nie używać | v9 i v10 z 18:50: czarna normal mapa tynku, test czerwony |
| Runtime (`public/explorer/3d/bor2/`) | zewnętrze v9 (wadliwe; 55 przełącza na v8), wnętrza v2 |
| Gotowe, niewpięte | wnętrza v3 (`assets/bor2/bor2-wnetrze-dom*.glb` + `wnetrza-lm/`, pliki sprawdzone, całe) |
| W eksporcie u 59 | zewnętrze v10 (poprawiony tynk, AO, fugi bram, kinkiety, płot GEO i PANEL). Obowiązuje dopiero po zielonym `test_glb.py`. |
| Rejestr | [defekty.md](defekty.md): 21 pozycji, 19 otwartych, każda z właścicielem |
| Scorecard | ostatnio 20/74 (27%), ΔE 19,8, obciążone wadliwym v9. Najlepiej 19/73, ΔE 19,5. |

Następne kroki według priorytetu klienta (realizm budynków w spacerze):
1. Wpiąć v10 i wnętrza v3.
2. Szyby: odbicie nieba, firany, Noc.
3. Ościeża, parapety i cokół.
4. Ekspozycja strony cienia i niebo z chmurami.
5. Wnętrza v4: dąb mebli w B, tkaniny, ryflowane szkło, usunięcie tarasu z GLB wnętrz.
6. Automatyczny test dostawy GLB.

## Narzędzia

- **Chrome headless (playwright-core).** Zawsze z `--no-proxy-server`, inaczej pierwsze żądanie kosztuje około 20 s.
- **`window.__explorerDebug`** (55):
  - `dumpScene()`;
  - `setFlags({ ukryj })`;
  - `setCamera({ pos, target, fov, shift })`.
- **`/domy?kadr=<render>`:** kamera z `ujecia-porownawcze.json`.
- **Blender 5.2 headless** dla Workbench i pomiarów. Na żywym Blenderze przez MCP pracuje tylko 59.
