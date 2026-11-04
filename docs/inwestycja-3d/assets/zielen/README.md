# Zestaw roślin ogrodowych (karty alpha-test) – `rosliny.glb` v3

Lekki zestaw roślin do makiety BOR2 (/domy, spacer z oczu 1,65 m), stawiany instancjami na znacznikach
`ZIELEN_ZNACZNIKI` z `bor2/bor2-zewnetrze-v*.glb` (v4–v8: 874 znaczniki, v9: 1168 – TRAWA 535, BYLINA 573; te same nazwy). Wzorzec: rendery dewelopera
`public/explorer/gallery/visualization-1.jpg` (pas traw przed płotem), `-5` (rabata od ulicy).

## Pliki

| plik | co to |
|---|---|
| `rosliny.glb` | **0,79 MB** – 27 wariantów (9 typów × 3) (węzły `TYP_n` w (0,0,0), podstawa y = 0, metry), 1 materiał, meshopt + WebP |
| `mapowanie.json` | prefiks znacznika → typy/warianty, wagi, zakres skali, obrót (kontrakt dla runtime) |
| `rozmiesc.mjs` | implementacja referencyjna mapowania (czysty JS, do przeniesienia do `Bor2Planting.tsx`) |
| `atlas.webp` / `atlas.png` / `atlas.json` | atlas 2048 × 2048 z alfą (WebP 667 kB, 17 kafli) i prostokąty kafli |
| `podglad/` | weryfikacja w three.js: `porownanie-vis1.jpg`, `porownanie-vis5.jpg`, `spacer*.jpg`, `arkusz-wariantow.jpg` |
| `elementy.mjs` → `kafle.py` → `atlas.mjs` → `rosliny.py` → `bor2/blend_to_glb.py` | potok budowy (`buduj.ps1`) |
| `podglad.html` + `podglad.mjs` | test w three.js projektu (Chrome bez okna) |
| `_pobrane/` | źródłowe tekstury CC0 z Poly Haven (nie trafiają do runtime) |

## Warianty (trójkąty, wymiary modelu przy skali 1)

| węzeł | trójkąty | wys. | opis |
|---|---:|---:|---|
| TRAWA_NISKA_1 / _2 / _3 | 186 / 124 / 186 | 0,34 / 0,34 / 0,44 m | kostrzewa sina (srebrzysto-zielona): grupa 3 / 2 / 3 kęp-fontann (~1,0 m średnicy); _3 z kłosami |
| TRAWA_WYSOKA_1 / _2 / _3 | 64 / 72 / 72 | 0,96 / 0,85 / 0,86 m | trzcinnik 'Karl Foerster', rozplenica, mieszana; słomkowe kłosy |
| PODSZYT_1 / _2 / _3 | 32 / 48 / 48 | 0,35 / 0,31 / 0,29 m | niska trawa łąkowa zielono-słomkowa; 2–3 instancje przy każdym znaczniku TRAWA/BYLINA |
| BYLINA_BIALA_1 / _2 / _3 | 90 / 120 / 96 | 0,46 / 0,43 / 0,43 m | gaura/floks – grupy 2–3 roślin (_3 z kocimiętką) |
| BYLINA_ZOLTA_1 / _2 / _3 | 108 / 90 / 108 | 0,42 / 0,53 / 0,50 m | krwawnik 'Moonshine', rudbekia, mieszana |
| BYLINA_FIOLET_1 / _2 / _3 | 120 / 66 / 102 | 0,43 / 0,35 / 0,36 m | szałwia 'Caradonna', kocimiętka/lawenda, mieszana |
| BYLINA_ROZ_1 / _2 / _3 | 90 / 114 / 102 | 0,67 / 0,61 / 0,59 m | jeżówka purpurowa (_3 z kocimiętką) |
| KRZEW_1 / _2 / _3 | 156 / 444 / 156 | 0,94 / 0,91 / 0,97 m | luźne krzewy liściaste: łukowate gałęzie z ziemi (tawuła/irga), grab o nieregularnym obrysie, tawuła kwitnąca na biało |
| ZYWOPLOT_1 / _2 / _3 | 140 / 140 / 140 | 1,23–1,25 m | moduł 1,0 × 0,6 × 1,2 m (karty zachodzą ~10 cm na sąsiada): grab ×2, ligustr (ciemniejszy) |

Limity z zadania: trawy ≤ 600, reszta ≤ 1500 trójkątów – wszystkie mieszczą się z zapasem.
Na makiecie v9 (1157 roślin na znacznikach + ~2760 instancji podszytu = 3916 instancji) widok W5 ma ~174 draw calle
i ~0,85 mln trójkątów całej sceny z budynkami i drzewami (27 wariantów = 27 InstancedMesh przy jednym materiale + cienie).
Jeśli to za dużo na słabszych urządzeniach: podszyt można ograniczyć do `min: 1` (mapowanie) albo pomijać dalej niż ~40 m.

## Materiał i wskazówki dla runtime (sesja 55)

- Jeden materiał `rosliny`: `baseColorTexture` = atlas (WebP z alfą), `alphaMode MASK` (cutoff 0,5), `doubleSided`,
  roughness 0,85, metallic 0. `COLOR_0` (GLTFLoader włącza `vertexColors`) = cień wnętrza kępy × odcień wariantu;
  mnoży się z `instanceColor`, więc ±6 % jasności na egzemplarz (jak korony w `trees.tsx`) jest dozwolone.
- Normalne są własne: kopuła (trawy, byliny), kula (krzewy), prostopadłościan (żywopłot), w górę i na zewnątrz.
  Przy `DoubleSide` trzeba **wyłączyć odwracanie normalnej** na tylnej ścianie – `patchNoFlip` z `estate/materials.ts`
  (tak jak liście drzew), inaczej połowa kart będzie ciemna. Zalecane też `alphaToCoverage` + `patchCoverage`.
  Tak ustawiony materiał testuje `podglad.html` (`plantMaterial()`).
- Atlas: kolor pod przezroczystymi pikselami jest rozlany z krawędzi (pull-push w `atlas.mjs`) – bez jasnych/ciemnych
  obwódek przy mipmapach; alfa przemapowana pod alpha-test (cienkie źdźbła nie znikają przy progu 0,5).
- Żywopłot: obrót znaczników `ZYWOPLOT_*` jest losowy – **nie używać go**; kierunek modułu = kierunek rzędu
  (najbliższy sąsiad), skala tylko w Y (szczegóły w `mapowanie.json`, kod w `rozmiesc.mjs`).
- Wybór wariantu jest deterministyczny (FNV-1a z nazwy znacznika) i plamami 2,2–2,6 m (rośliny tego samego typu
  rosną płatami jak na rabatach z renderów, nie jako konfetti).
- Drzewa (`DRZEWO_*`) zostają z `public/explorer/3d/models/drzewa.glb` – mapowanie je pomija.

## Jak powstało

1. `elementy.mjs` – w teksturach Poly Haven wyszukuje pojedyncze liście/płatki (spójne obszary maski) → `elementy.json`.
2. `kafle.py` (Blender w tle, Cycles, rzut prostokątny, tło przezroczyste) – buduje gałązki i kępy z elementów
   zdjęciowych (liście barwinka/krzewów, płatki Leipoldtii i środek gazanii przebarwione na jeżówkę/szałwię,
   kwiat barwinka przebarwiony na biały) oraz proceduralnych źdźbeł, łodyg i kłosów; renderuje 15 kafli
   z wbudowanym miękkim cieniem (niebo 0,9 + słońce z góry).
3. `atlas.mjs` (Node + sharp) – składa kafle w atlas 2048², przycina obrysy, dylatuje kolor, koduje WebP.
4. `rosliny.py` (Blender w tle) – rośliny z kart: kępy (karty pionowe + pochylone + pozioma wypukła karta z góry
   dla kostrzewy), korony krzewów (karty na kuli + wnętrze), moduł żywopłotu; normalne własne, `COLOR_0`; zapis `rosliny.blend`.
5. `bor2/blend_to_glb.py` (`tekstury=2048 kamery=0 scal=0 instancje=0`) – eksport GLB (meshopt, WebP bez przekodowania).

Pełna przebudowa: `powershell -ExecutionPolicy Bypass -File docs/inwestycja-3d/assets/zielen/buduj.ps1 -Kafle`,
weryfikacja: `node docs/inwestycja-3d/assets/zielen/podglad.mjs` (z katalogu głównego projektu).

## Licencje

Wszystkie tekstury źródłowe: **Poly Haven, CC0 1.0** (https://polyhaven.com/license), pobrane z api.polyhaven.com
(2k, diffuse + maska alfa) do `_pobrane/<model>/`:

- użyte w atlasie: `periwinkle_plant` (liście, kwiaty), `shrub_04`, `shrub_02`, `shrub_01` (liście), `flower_gazania`
  (środek kwiatu, liście; płatki przebarwione na rudbekię), `leipoldtia_schultzei` (płatki);
- pobrane, nieużyte: `grass_medium_01`, `grass_medium_02`, `flower_heliophila`, `tree_small_02`, `jacaranda_tree`.

Źdźbła, łodygi, kłosy, wiechy i kwiatki szałwii/krwawnika są proceduralne (`kafle.py`) – własne, bez ograniczeń.
Atlas i GLB są pochodną materiałów CC0 i mogą być używane bez przypisania autorstwa.

## Historia

- v1: 7 typów × 3 warianty.
- v2: + PODSZYT (trawa łąkowa pod i między kępami – pas zwiera się w łąkę), + BYLINA_ZOLTA (krwawnik 'Moonshine',
  rudbekia); kostrzewa z niebieskiej na srebrzysto-zieloną, udział w pasie ~35–40 % (TRAWA → NISKA 0,42 / WYSOKA 0,43 /
  ZOLTA 0,15); biały krwawnik zastąpiony gaurą (miejsce w atlasie). Nazwy węzłów v1 bez zmian.
- v3: kostrzewa jako fontanna (źdźbła wychodzą stromo, końcówki miękko opadają, wąska podstawa – bez „nóg” z boku),
  6 kart pionowych pod losowymi kątami + 3 pochylone + wypukła karta z góry, ciemniejsza podstawa w COLOR_0;
  podszyt z 6–8 kart pod losowymi kątami i pochyleniami (bez krzyża „X”), miękki brzeg, ciemna podstawa;
  krzewy z łukowatych gałęzi zaczepionych w ziemi (nieregularny obrys zamiast kul); żywopłot z dwóch warstw kart
  obracanych co 90° i odbijanych lustrzanie (bez wzoru „kropek”), grab _1/_2 losowany na moduł (nie na przemian).

## Znane różnice względem renderów (v3)

- Z bliska (1,5–3 m) kostrzewa jest dużo bliżej natury niż w v1/v2, ale nadal widać warstwy kart („otwarta książka”)
  i ciemniejszy środek z karty widzianej z góry; na renderze kępy są drobniejsze i bardziej puszyste.
- Na visualization-1 łąka jest wyższa (0,4–0,7 m) i bardziej jednolita; podszyt v2 ma 0,3–0,5 m i z bliska widać
  krzyż kart w pojedynczych kępkach.
- Kolory: kostrzewa szaroniebieska, trawy wysokie oliwkowo-słomkowe zgodnie z renderami; białe kwiaty przy słońcu 4,4
  wypadają jaśniej niż na renderze, szałwia ciemniej-fioletowa (stonowana na życzenie klienta).
- Krzewy są luźne, ale z bliska widać nagie dolne odcinki gałęzi i płaskie karty w koronie; KRZEW_2 (grab) jest
  najbardziej „sklejony”. Żywopłot ma liście grabu ~6–9 cm (nieco za duże dla grabu, ligustr to ten sam kafel ciemniej).
- Brak drzewka ozdobnego (wiśnia/klon) – znaczniki `DRZEWO_OZDOBNE` nadal idą do `lipa-1` z `drzewa.glb`.
- Podgląd stawia własny grunt-łąkę poza działką (model BOR2 kończy się na płocie) – w runtime grunt daje teren osiedla.
