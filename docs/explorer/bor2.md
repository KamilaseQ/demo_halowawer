# /domy na modelu BOR2: architektura, kontrakt plików, budżety

Stan na 04.11.2026. Autor: sesja `3d-kamil-55` (runtime makiety: ładowanie, kamera, spacer, wydajność). Ten plik jest kontraktem między runtime a dostawcami modeli (59: zewnętrze, wykonawca wnętrz, wykonawca okolicy, wykonawca roślin) i audytem (e3, b6).

Od 04.11 makieta to prawdziwy model dewelopera BOR2 (SketchUp → Blender → GLB) zamiast proceduralnych brył. Stara makieta jest pod `?bor2=0` (tylko do porównań).

## 1. Co gdzie leży

| Plik w `public/explorer/3d/` | Źródło | Ładowanie |
|---|---|---|
| `bor2/zewnetrze-v9.glb` (2,9 MB) | 59 | paczka osiedla, na start |
| `okolica/okolica-v1.glb` (1,2 MB, ODbL) | wykonawca okolicy | paczka osiedla, na start; osobny plik, atrybucja na scenie |
| `models/drzewa.glb` (4,2 MB) | EZ-Tree | paczka osiedla (drzewa ze znaczników) |
| `bor2/wnetrze-g-v1.glb` (6,4 MB) + `bor2/wnetrza-lm/G_kond{0,1}.webp` | wykonawca wnętrz | paczka domu G/E/F, przy wejściu do domu |
| `bor2/wnetrze-b-v1.glb` (6,9 MB) + `bor2/wnetrza-lm/B_kond{0,1}.webp` | wykonawca wnętrz | paczka domu A/B/C/D, przy wejściu do domu |

**Zmiana pliku = nowa nazwa** (`-v8`, `-v2`). `/explorer/**` ma nagłówek `immutable` na rok, więc powracający goście nie zobaczyliby nowej wersji pod starą nazwą. Po podmianie: zmień stałą w kodzie (`BOR2_EXTERIOR_URL` w `three/bor2/exterior.ts`, `OKOLICA_URL` w `three/bor2/Okolica.tsx`, `SOURCES` w `docs/explorer/tools/bor2-nav.mjs`) i uruchom `node docs/explorer/tools/bor2-nav.mjs`.

## 2. Układ współrzędnych

- GLB = układ SketchUpa: X = wschód (azymut 89,97°), Z = południe, Y = góra, metry. Nie centrujemy.
- Runtime (przestrzeń osiedla) = GLB + `BOR2_OFFSET` = (−33,85; 0; +59,70), stały dla zewnętrza, okolicy i wnętrz (`src/lib/estate/geometry/bor2.ts`).
- Słońce: `ESTATE_AZIMUTH_X = 90`, Dzień 15:30 → kierunek do słońca (−0,711; 0,440; 0,548). Lightmapy wnętrz są wypiekane z tym wektorem.
- Wnętrze to jeden GLB na typ domu. Inne domy dostają kopię z transformacją (`bor2Transform`): G → E lustro, F kopia; B → D kopia, A i C lustro (oś X wokół środków brył). three.js sam odwraca kolejność wierzchołków przy lustrze.

## 3. Kontrakt GLB

**Zewnętrze** (węzły najwyższego poziomu, nazwy dokładnie):

| Węzeł | Co | Runtime |
|---|---|---|
| `DOM_A` … `DOM_G` | sama bryła domu | podświetlenie (emisja na kopiach materiałów), pick = pudło z obrysu, etykiety, kolizje spaceru; bryła bieżącego domu znika w spacerze i w przekroju |
| `KONTEKST_1…n` | sąsiedzi, 1 siatka na budynek | szary „duch”; wygaszany, gdy stoi między kamerą a domami |
| `ZIEMIA` | teren, drogi, kostka | materiały gruntu z runtime (niżej), raycast gruntu w spacerze |
| `TARASY`, `OGRODZENIA` | tarasy, płoty, słupki, latarnie | materiały 59; płoty = kolizje spaceru |
| `ZIELEN_ZNACZNIKI` | puste węzły `TRAWA_/BYLINA_/KRZEW_/ZYWOPLOT_/DRZEWO_*` | instancje roślin (`Bor2Planting.tsx`); stożki `ZIELEN` z SKP są wtedy chowane |
| kamery `PKT_*`, `WIDOK_*`, `KADR_*` | punkty spaceru, ujęcia | punkty spaceru po osiedlu (`bor2-nav.mjs`, lista `ESTATE_POINTS`) |

Materiały, które runtime podmienia po nazwie (`three/bor2/surfaces.ts`), więc dostawca ich nie stylizuje: `SZYB*` → ciemne szkło z odbiciem nieba; `OTOCZENIE*` → trawnik (Grass004, pasy koszenia); `DROGA*`, `[Asphalt…`, `ASFALT`, `KOSTKA*`, `SKP Default` → kostka; `GEOKRATA*` → geokrata. Wszystkie w mapowaniu triplanarnym w metrach. Nieznany materiał pod `ZIEMIA` daje `console.error`.

**Wnętrze:** `WNETRZE_<dom>` → `KOND_n` → `KOND_n__PODLOGA` (raycast „kliknij podłogę”, wysokość kondygnacji), `KOND_n__SUFIT` (chowany w przekroju), `KOND_n__WNETRZE`, `KOND_n__DETALE`, `KOND_n__TRANSPARENT`; `SCHODY`; kamery `PKT_<POKOJ>` na 1,65 m nad podłogą. Lightmapa: `extras` węzła `{ lightMap: "wnetrza-lm/<plik>.webp", lightMapIntensity }` na TEXCOORD_1, wypieczone niebo i całe światło pośrednie bez bezpośredniego słońca dla pory „Dzień”. Runtime klonuje materiały, ustawia `channel = 1`, sRGB, `flipY = false`, `envMapIntensity ≤ 0,25` i skaluje lightmapę według pory dnia (Rano 0,85, Dzień 1, Noc 0,14). Emisja materiałów `ZASLON*/FIRAN*/LAMP*` w Noc ×0,1.

**Okolica:** `DUCH_*` (budynki), `DUCH_DALEKIE_*`, `TEREN_*`, `BOISKO_LINIE`, `DRZEWA.extras.las_xz/szpaler_xz` (punkty drzew).

## 4. Ładowanie: paczki i bramka sceny

- **Paczka osiedla** (zewnętrze + okolica + drzewa + grunt + IBL) ładuje się na `/domy` pod plakatem z prawdziwym postępem.
- **Paczka wnętrza** ładuje się przy wejściu do domu (`/domy/<dom>`) pod przenikaniem z ekranem „Wczytuję…”. Po pierwszym wejściu zostaje w pamięci: E/F korzystają z GLB domu G, a A/C/D z GLB domu B.
- **Dane nawigacji** (kondygnacje, punkty spaceru, obrysy) są generowane z GLB do `src/lib/estate/geometry/bor2-nav.json` przez `docs/explorer/tools/bor2-nav.mjs`. Dzięki temu UI (pigułka pięter, pasek pokoi, URL `punkt=`) działa synchronicznie i bez SSR-owego czekania na GLB.
- **Bramka sceny** (`SceneGate`) pokazuje scenę dopiero, gdy wszystko jest pobrane, wysłane na GPU i skompilowane. Z zewnątrz wnętrze jest ukryte, ale jego warianty (kondygnacje, sufity, wygaszone duchy) kompilują się pod ekranem ładowania przez osie `useWarmupAxis`. Potem przełączenie widoku, piętra i pory dnia niczego nie pobiera ani nie kompiluje.

## 5. Widoki i interakcja

| Widok | URL | Co renderujemy |
|---|---|---|
| Makieta osiedla | `/domy` | zewnętrze + okolica + zieleń; wnętrz brak |
| Spacer po osiedlu | `/domy?widok=spacer&punkt=wjazd` | oczy 1,65 m nad `ZIEMIA`, kolizje 2D (przekrój ścian, płotów, duchów i drzew na 0,9 i 1,35 m, ok. 2,7 tys. odcinków, budowa 9 ms), klik w ziemię / WASD / strzałki, przy domu (≤ 7 m) „Wejdź do domu X” i „Karta domu X” |
| Dom, model 3D | `/domy/<dom>` | bryła BOR2; wnętrze ukryte |
| Domek dla lalek | `/domy/<dom>?poziom=parter` | kondygnacje ≤ wybranej, sufit wybranej schowany, bryła domu schowana |
| Spacer we wnętrzu | `/domy/<dom>?widok=spacer&punkt=salon` | całe wnętrze, bryła domu schowana, sąsiedzi przez okna; klik w podłogę innej kondygnacji (przez schody) = przejście do najbliższego punktu tej kondygnacji |
| Kadr QA | `/domy?kadr=visualization-1&czysty=1`, `/domy/g?kadr=interior-6` | kamera renderu dewelopera z `docs/inwestycja-3d/assets/bor2/ujecia-porownawcze.json` (yfov, near, shift obiektywu, `ukryj`); gotowość: `shotReady` w store |

Przełącznik stylów wnętrza (s1/s4/s3) jest ukryty dla wnętrz BOR2, bo to projekt dewelopera (decyzja klienta).

## 6. Budżety (przeciętny laptop: Intel UHD 620 / Iris Xe, 1080p, Chrome)

| Budżet | Cel | Stan 04.11 (RTX 3060 Ti, 1920×1080, DPR 1) |
|---|---|---|
| Paczka osiedla | ≤ 8 MB, gotowe ≤ 5 s (desktop) | 8,7 MB, 3,1 s (zimny cache, prod, przed okolicą) |
| Paczka wnętrza | ≤ 8 MB, wejście ≤ 3 s przy ciepłym cache | 6,4 / 6,9 MB + lightmapy 0,4 MB |
| GPU/klatkę | ≤ 2,5 ms na RTX (≈ 50 fps na Iris Xe) | przegląd 4,0 ms, spacer po osiedlu 3,7 ms, salon G 5,5 ms (dev, mediana w ruchu) |
| Trójkąty/klatkę | ≤ 1 mln z cieniami | przegląd 0,40 mln, salon 1,15 mln |
| Draw calle/klatkę | ≤ 250 | przegląd 117, spacer po osiedlu 78, salon 231 |
| Przycięcia w spacerze | p99 klatki ≤ 50 ms | p99 11–19 ms |
| Zewnętrze (plik) | ≤ 150k tris, ≤ 120 prymitywów, ≤ 40 materiałów, tekstury ≤ 1024 px | 27k tris, ~70 prymitywów, 28 mat. |
| Wnętrze (plik) | ≤ 400k tris po instancjach, ≤ 200 prymitywów, ≤ 32 mat., ≤ 4 BLEND | G 304k / 62 / 22; B 345k / 57 / 20 |

Co dało największy zysk 04.11 (pomiar przed/po, ta sama scena):
1. **N8AO bez `transparencyAware`**: N8AO sam wykrywał przezroczyste materiały (firany, kursor) i renderował całą scenę dwa razy więcej. Przy okazji psuło to cache cieni: mapa cieni przeliczała się co klatkę. Salon G: GPU 11,8 → 5,7–6,9 ms, draw calle 453 → 234. Różnica obrazu: 2,5% pikseli o więcej niż 8/255 (zrzuty w `podglad/n8ao-*`), zaakceptowane przez b6. Stary tryb: `?perf=aotransp`.
2. **Okolica OSM zamiast pierścienia lasu z pełnych modeli EZ-Tree**: trójkąty w salonie 4,05 → 1,15 mln (pierścień był rysowany bez cullingu nawet z wnętrza). Lasy OSM to impostory (4 trójkąty na drzewo), 162 budynki-duchy złączone w 8 sektorów plus 20 osobnych (wygaszanie).

## 7. Narzędzia pomiaru (`docs/explorer/tools/`)

**Ważne: każdy skrypt Playwright na tej maszynie musi mieć flagę Chrome `--no-proxy-server`.** Bez niej pierwsze żądanie strony czeka około 20 s na autowykrywanie proxy. To artefakt środowiska, nie strony.

- `_load.mjs <url> [desktop|mobile] [n]`: czas do „gotowe”, MB, długie zadania.
- `_gpuframe.mjs <url> [w] [h] [cpuRate]`: czas GPU na klatkę (EXT_disjoint_timer_query_webgl2) i odstęp klatek w ruchu, draw calle i trójkąty na klatkę.
- `?perf=nopost,noao,nomsaa,nobloom,nosmaa,notrees,nobelt,noshadow,aotransp`: każdy przełącznik usuwa jeden koszt, żeby zmierzyć jego udział (`src/components/explorer/perf.ts`).
- `_dump.mjs <url> [out.json]`: inwentarz sceny (`__explorerDebug.dumpScene()`), podsumowanie według źródła i obiekty proceduralne w granicy osiedla.
- `_shadowcause.mjs <url>`: które obiekty rzucające cień zmieniają się między klatkami.
- `_walktest.mjs <url> <out.png>`: kolizje spaceru po osiedlu.
- `_stuck.mjs <url>`, `_netlog.mjs <url>`: na co czeka bramka sceny i co blokuje dokument.
- `window.__explorerDebug` (dev zawsze, prod z `?debug=1`): `dumpScene()`, `setFlags({ ukryj, pokaz })`, `setCamera({ pos, target, fov, shift, near })` w układzie GLB.

## 8. Otwarte (stan 04.11, wieczór)

- Zestaw roślin `assets/zielen/rosliny.glb` + `mapowanie.json`: do wpięcia zamiast tymczasowych kęp na znacznikach (InstancedMesh na wariant, alphaTest + alphaToCoverage, cienie tylko krzewów i żywopłotów).
- Wygląd po stronie runtime (kolejka b6): niebo z chmurami, jaśniejsza strona cienia, mniej pomarańczowe słońce; szyby z interior mappingiem i firanami, Noc ze świecącymi oknami.
- Wydajność (zamrożona decyzją klienta do odwołania, chyba że coś spadnie poniżej ~30 fps): culling drzew w sektorach i LOD, lżejszy N8AO na słabym GPU (`halfRes`), pomiar 4× CPU + 20 Mb/s.
- Minimapa we wnętrzach BOR2: rzuty dewelopera trzeba skalibrować do układu GLB (dziś ukryta).
