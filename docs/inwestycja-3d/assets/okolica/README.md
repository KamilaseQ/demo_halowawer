# Okolica osiedla z OpenStreetMap: szare „duchy”

Stan na 04.11.2026. Autor: wykonawca okolicy. Dane OSM pobrano 04.11.2026, znacznik bazy `2026-11-04T16:13:49Z`.

`okolica.glb` to prawdziwe sąsiedztwo osiedla Halo Wawer (ul. Borków 24B, Zerzeń) w promieniu ok. 420 m. Zawiera budynki z dachami, drogi, parkingi i boisko. Wszystko ma jednolity jasnoszary mat bez tekstur. Plik leży w układzie BOR2 i nie wchodzi na teren osiedla ani na sąsiadów, których BOR2 już modeluje.

> **Licencja i atrybucja.** Dane: © OpenStreetMap contributors, licencja [ODbL 1.0](https://www.openstreetmap.org/copyright).
> - `okolica.glb`, `dane/okolica-dane.json` i `dane/osm-overpass.json` to bazy pochodne OSM i obowiązuje je ODbL.
> - Na stronie `/domy` trzeba pokazać widoczny podpis „© OpenStreetMap contributors”, np. w stopce makiety lub w `CREDITS.md`. Ten sam tekst jest w `asset.copyright` pliku GLB.
> - Nie scalajcie `okolica.glb` z GLB dewelopera w jeden plik. Osobny plik nie podlega share-alike razem z modelem BOR2.

## Plik `okolica.glb`

| | |
|---|---|
| Rozmiar | **1,17 MB** (1 170 912 B), float32 bez kompresji (powód: [Dlaczego bez meshopt](#dlaczego-bez-meshopt)) |
| Trójkąty | **20 070**: budynki 15 245, drogi i parkingi 4 155, boisko z liniami i bramkami 670 |
| Budynki | **452**: 346 z dachem dwuspadowym, 73 z czterospadowym, 33 z płaskim |
| Materiały | `DUCH` #c9c9c6 (budynki, linie boiska) i `DUCH_TEREN` #b9bab5 (drogi, parkingi, płyta boiska). Oba: roughness 1, metalness 0, jednostronne, bez tekstur |
| Rysowanie | 169 siatek: 162 osobne budynki, 4 scalone ćwiartki, 3 siatki terenu |

### Układ współrzędnych

Plik jest w tym samym układzie co `../bor2/bor2-zewnetrze.glb`, bez centrowania. Wystarczy go wczytać obok BOR2 z tym samym `BOR2_OFFSET`.

- glTF jest Y-up: `x` to wschód, `y` to góra, `z` to −północ (czyli południe), w metrach.
- W Blenderze i SketchUpie: X to wschód, Y to północ, Z to góra.
- **Oś X modelu BOR2 to geograficzny wschód (azymut 89,97°), nie 100,5°.** 100,5° to kierunek rzędu domów G→A, który w modelu jest skośny o ok. −10,5° względem osi X. Zgadza się to z `05-odbior-bor2.md` („X = wschód, Y = północ”).

### Węzły

| Węzeł | Zawartość | `extras` |
|---|---|---|
| `OKOLICA` | korzeń (macierz jednostkowa) | źródło, znacznik OSM, `georef`, `liczby`, `srodek_osiedla_xz` |
| `DUCH_001` … `DUCH_162` | budynki, których środek leży ≤ 240 m od środka osiedla. Każdy jest osobną siatką, numeracja rośnie z odległością (`001` = najbliższy) | `osm` (np. `way/962326224`), `typ`, `kondygnacje`, `dach`, `okap`, `wysokosc`, `odl`, opcjonalnie `w_budowie` |
| `DUCH_DALEKIE_NE/NW/SE/SW` | 290 dalszych budynków scalonych w ćwiartki (94/53/50/93). Kamera orbity ma `maxDistance` 230 m, więc nie mogą zasłonić osiedla | `budynkow`, lista `osm` |
| `TEREN_DROGI` | drogi, dojazdy, chodniki, ścieżki rowerowe i 2 parkingi: płaskie pasy 2 cm nad terenem, parkingi 1,5 cm | — |
| `TEREN_BOISKO` | płyta boiska PKS Victoria Zerzeń (OSM way 273248444, 90,6 × 53,4 m), 2 cm | — |
| `BOISKO_LINIE` | linie 12 cm (3 cm nad terenem) i bramki 7,32 × 2,44 m, materiał `DUCH`, więc są ledwo widoczne na `DUCH_TEREN` | — |
| `DRZEWA` | pusty węzeł z punktami drzew | patrz niżej |

Punkty drzew (`DRZEWA.extras`):
- `las_xz`, `szpaler_xz` i `pojedyncze_xz` to płaskie listy par `[x0, z0, x1, z1, …]` w układzie GLB, z `y = 0`.
- `las_xz`: 496 punktów w 14 zadrzewieniach OSM (`natural=wood` i `landuse=forest`), ok. 1 drzewo na 40 m². To siatka heksagonalna co 6,8 m z jitterem ±1,2 m.
- `szpaler_xz`: 14 punktów co 7 m w szpalerach (`natural=tree_row`).
- `pojedyncze_xz`: 0 punktów, bo OSM nie ma tu pojedynczych `natural=tree`.
- `obrysy`: obrysy zadrzewień z polem i liczbą drzew.
- Punkty omijają budynki (1,5 m), drogi (pół szerokości + 1 m), osiedle i sąsiadów (3 m) oraz cały prostokąt terenu BOR2.

## Georeferencja

- **Dopasowanie.** Dopasowałem sztywno (obrót i przesunięcie, bez skali) środki obrysów 8 sąsiadów zamodelowanych w BOR2 do ich obrysów w OSM.
- **Rzutowanie.** Lon/lat przeliczam na lokalny układ ENU na elipsoidzie WGS84, z promieniami M i N w punkcie 52,18928 N, 21,14675 E.
- **Kontrola skali.** Wariant ze skalą dał k = 1,0005, czyli skala jest zgodna.

| Wynik | Wartość |
|---|---|
| Obrót osi X BOR2 względem wschodu | 0,027° (azymut osi X 89,973°) |
| Początek układu BOR2 (0, 0) | 52,1888629 N, 21,1452290 E |
| **RMS środków (8 budynków)** | **0,27 m**, maks. 0,50 m |
| Bliźniaki `Component#7` ×4 (OSM 899631020–23) | 0,02–0,06 m |
| `Group#3` (czerwony dach, OSM 962326212) | 0,50 m |
| `Group#5` (OSM 962326225) | 0,42 m |
| `Group#4` (budynek klubowy, OSM 962326175) | 0,29 m |
| `Group#19` (garaż, OSM 1415910219) | 0,24 m |
| Średnia odległość wierzchołków obrysu OSM od podstawy bryły BOR2 | 0,14–0,24 m |

Pary BOR2 ↔ OSM zgadzają się też na nakładce z dronem (`podglad/okolica-estate8.jpg`). Czerwony dom, budynek klubowy, boisko, bliźniaki od południa i żwirowa droga wzdłuż południowego płotu są tam, gdzie na zdjęciu.

Dokładność bezwzględna to dokładność OSM, czyli obrysy z ortofotomapy geoportalu, ok. 0,5–1 m. Względem modelu BOR2 błąd wynosi ok. 0,3 m.

## Reguły budowy

- **Wybór budynków.** Biorę budynki ze środkiem ≤ 420 m od środka rzędu domów, w układzie BOR2 punkt (70,7; 48,6).
  - Pomijam 8 budynków OSM, które BOR2 już modeluje (lista w `dane/okolica-dane.json` → `pominiete`).
  - Pomijam wszystko, co nachodzi na strefy wykluczone z buforem 1 m: osiedle (otoczka `podłoże` i `domki`), `Group#65` (zieleń i płoty NW) oraz obrysy brył sąsiadów. Nie było takich kolizji.
  - Na teren osiedla nie wchodzi nic.
- **Wysokości.**
  - W OSM `building:levels` ma 682 z 741 budynków. Nie ma `height` ani `roof:shape`.
  - Domy: okap = 3 m × kondygnacje − 1 m, przy braku danych przyjmuję 2 kondygnacje, więc okap ma 5 m. Na to dach 35°, wznios najwyżej 4,5 m.
  - Reguła jest skalibrowana na sąsiadach z BOR2. W OSM mają po 2 kondygnacje, a w modelu okap 3,3–6,2 m i kalenicę 7,9–9,4 m nad terenem. Ze ścisłej reguły „2 × 3 m + dach” wychodziłyby zbyt wysokie bryły.
  - Budynki gospodarcze i garaże: okap 2,5 m i dach 25°. Gdy mają mniej niż 15 m², dach jest płaski.
  - Budynki duże (dłuższe niż 25 m, większe niż 300 m², od 4 kondygnacji) i niemieszkalne (handel, usługi, magazyny, szkoła): płaski dach, wysokość 3 m × kondygnacje + 0,6 m.
- **Kształt dachu.** Dach to pole wysokości nad prostokątem o najmniejszym polu.
  - Dwuspadowy: kalenica wzdłuż dłuższego boku.
  - Czterospadowy: obrys prawie kwadratowy (L/W < 1,15) albo nieprostokątny (wypełnienie prostokąta < 0,8).
  - Stykające się domy, czyli połówki bliźniaków i segmenty, dostają wspólny dach nad wspólnym prostokątem. Takich budynków jest 65.
  - Ściany zaczynają się 0,3 m pod terenem, a spód brył jest pominięty.
- **Szerokości dróg [m].**

  | Klasa | Szerokość |
  |---|---|
  | tertiary | 7 |
  | residential, unclassified | 5,5 |
  | living_street | 5 |
  | service | 3,5 |
  | service=parking_aisle | 5 |
  | service=driveway | 3 |
  | track | 3 |
  | pedestrian | 4 |
  | cycleway | 2 |
  | footway | 1,6 |
  | path | 1,2 |

  - Gdy OSM podaje `width`, używam jej.
  - W węzłach, w których kończą się odcinki, są krążki, więc na załamaniach nie ma szczelin.
  - Drogi są przycięte do 450 m i do pół szerokości + 0,3 m od stref wykluczonych.
- **Teren BOR2.** Prostokąt `Group#2` o wymiarach 130 × 110 m nie jest płaski: ma z = 0–1 m, schodkami 0,12, 0,31, 0,58, 0,78 i 1,0 m, wyżej na zachodzie.
  - Poza nim okolica leży na z = 0.
  - Drogi, linie i płyta boiska, które wchodzą na ten teren, są zagęszczone co 1,5–2 m i położone na nim: maksimum terenu w promieniu pół szerokości plus 2 cm. Po niższej stronie schodka mogą wisieć do ok. 0,2 m.
  - 2 duchy na południowej krawędzi terenu BOR2 (way/962326224 i way/962326116) mają okap i dach podniesione o 0,4 i 0,5 m.

## Uwagi dla runtime (55)

1. **Z-fighting dróg.** Przy `near` = 0,05 m (`Stage.tsx`) 2 cm nad terenem wystarcza tylko do ok. 100 m. Dalej różnica głębokości przy 24-bitowym buforze to kilka cm. Zalecam dla `DUCH_TEREN` ustawić `polygonOffset: true`, `polygonOffsetFactor: -2`, `polygonOffsetUnits: -2`, albo `depthWrite: false` z `renderOrder` przed BOR2.
2. **Wygaszanie.** Przy wygaszaniu zasłaniających brył `DUCH_###` sklonujcie materiał per bryła albo użyjcie atrybutu lub uniformu. Wspólny `DUCH` wygasiłby wszystkie bryły naraz. `DUCH_DALEKIE_*` nie wymagają wygaszania.
3. **Teren BOR2 kończy się uskokiem** do 1,0 m na zachodniej krawędzi (x = 0) i ok. 0,3 m na południowej (y = 0). Okolica poza prostokątem leży na 0. Jeśli runtime ma własny grunt na y = 0, uskok trzeba wygładzić rampą po stronie gruntu. To nie jest zakres okolicy.
4. **Grunt i drzewa.** GLB nie ma gruntu ani drzew. Drzewa stawia runtime w punktach z `DRZEWA.extras`, np. instancjami `drzewa.glb` albo impostorami lasu. Fikcyjny las i jaskrawe boisko ze starej makiety można wyłączyć.

## Dlaczego bez meshopt

Kompresja meshopt w eksporterze glTF Blendera 5.2 (`export_meshopt_compression_enable`) jest **stratna i niesterowalna**.
- Filtr wykładniczy ma wspólny wykładnik dla x, y i z oraz ok. 11 bitów mantysy.
- Krok zależy od największej współrzędnej wierzchołka: 1/32 m dla |x| = 32–64 m, 1/16 m dla 64–128 m i ok. 1/4 m dla 256–512 m.
- Drogi na z = 0,02 lądowały na z = 0. Sprawdziłem, że `export_draco_position_quantization` nic tu nie zmienia.

Float32 bez kompresji waży 1,17 MB i mieści się w limicie 1,5 MB. Gdy pipeline dostanie `gltf-transform`, `gltf-transform meshopt` z kwantyzacją per siatka zmniejszy plik kilkukrotnie.
- Pozycje trzeba kwantyzować na **≥ 16 bitach**.
- Przy domyślnych 14 bitach siatka `TEREN_DROGI` o rozpiętości ok. 900 m dostałaby krok ok. 5,5 cm i drogi znów zlałyby się z terenem.

**Uwaga poza zakresem okolicy:** ten sam efekt dotyczy `../bor2/bor2-zewnetrze.glb` i `public/explorer/3d/bor2/zewnetrze-v5.glb`.
- Wszystkie sprawdzone współrzędne x z przedziału 64–128 m są wielokrotnościami 1/16 m. Krok wynosi więc 6,25 cm, a błąd do ±3,1 cm.
- Przykłady: teren 0,122 → 0,125 m, 0,579 → 0,594 m.
- To blisko progów P0 (±5 cm wymiary, ±3 cm okna).
- `wnetrze-g.glb` nie ma tego problemu.

## Czego brakuje w OSM względem zdjęć z drona

- **Drzewa w ogrodach.** To największa różnica. Na `estate-1/3/5/8` widać dziesiątki sosen, świerków i brzóz w ogrodach i przy działkach, a w tle ciągłą ścianę drzew. OSM ma tu tylko 14 zadrzewień (łącznie ok. 30 tys. m², największe częściowo poza promieniem, w promieniu 496 drzew) i ani jednego pojedynczego drzewa. Bez heurystyki ogrodowej po stronie runtime okolica wyjdzie łysa w porównaniu ze zdjęciami.
- **Kształty dachów.** OSM nie ma `roof:shape` ani `height`, więc dachy są zgadywane. Część czterospadowych domów (w tym wielorodzinny dom z ciemnym dachem na zachód od osiedla, `estate-8` po lewej) dostała dach dwuspadowy. Wysokość jest z kondygnacji ±1–2 m.
- **Otoczenie boiska.** W OSM nie ma trybun i krzesełek wzdłuż boiska, piłkochwytów ani parkingu z rzędem aut na północ od boiska (`estate-8` u góry; w OSM jest tylko jezdnia). Nie ma też placu treningowego (piaszczysto-trawiastego) między osiedlem a boiskiem, ale to i tak puste pole.
- **Dojazd od północy.** OSM (way 1179589786) kończy się ok. 20 m przed wjazdem do osiedla, na wysokości y ≈ 71 m w układzie BOR2. Asfalt BOR2 obejmuje y = 28–50 m przy x = 118–123 m. Odcinka y = 50–71 m nie ma ani w OSM, ani w BOR2 i nie dorabiałem go.
- **Pominięte elementy.**
  - Płotów (`barrier=fence`, 33 w promieniu 300 m) celowo nie ma w GLB.
  - Plac zabaw, małe szopy, auta i słupy nie występują w OSM albo zostały pominięte.
  - 16 budynków ma w OSM `building=construction` (extras `w_budowie`). Stoją jako domy i mogą jeszcze nie istnieć w tej formie.

## Pliki i regeneracja

```
okolica.glb                  wynik (ODbL)
okolica.blend                ta sama scena w Blenderze (podgląd, poprawki ręczne)
okolica_pobierz.py           1. Overpass -> dane/osm-overpass.json            (python -I)
okolica_bor2_obrysy.py       2. BOR2 .blend -> dane/bor2-obrysy.json           (blender headless)
okolica_przygotuj.py         3. georeferencja, bryły, drogi, boisko, drzewa
                                -> dane/okolica-dane.json + podglad/okolica-plan.jpg   (python -I, numpy, Pillow)
okolica_blender.py           4. -> okolica.glb + okolica.blend                  (blender headless)
okolica_podglad.py           5. rendery EEVEE -> podglad/okolica-*.jpg          (blender headless)
```

```powershell
cd docs/inwestycja-3d/assets/okolica
python -I okolica_pobierz.py dane/osm-overpass.json
& "D:\Programy\Blender\blender.exe" --background ../bor2/bor2-zewnetrze.blend --python okolica_bor2_obrysy.py -- dane/bor2-obrysy.json
python -I okolica_przygotuj.py dane/osm-overpass.json dane/bor2-obrysy.json dane/okolica-dane.json podglad/okolica-plan.jpg
& "D:\Programy\Blender\blender.exe" --background --factory-startup --python okolica_blender.py -- dane/okolica-dane.json okolica.glb okolica.blend
& "D:\Programy\Blender\blender.exe" --background --factory-startup --python okolica_podglad.py -- ../bor2/bor2-zewnetrze.glb okolica.glb dane/okolica-dane.json podglad ../../../../public/explorer/gallery
```

Parametry (promienie, wysokości, szerokości, gęstość drzew) są na początku `okolica_przygotuj.py`. Ponowne pobranie z OSM może zmienić liczby budynków. Pary sąsiadów `PARY` są przypięte do identyfikatorów OSM.

## Podglądy (`podglad/`)

Teren (zielonoszara płyta) i drzewa (stożki w punktach `DRZEWA`) występują tylko w podglądach.

- `okolica-gora.jpg`: z góry, cała okolica (koło 450 m) z BOR2, północ u góry.
- `okolica-gora-osiedle.jpg`: z góry, ±160 m wokół osiedla.
- `okolica-estate3.jpg`: zdjęcie `estate-3` obok renderu z oszacowanej kamery drona. Parametry kamery: (64,3; 28,8; 9,9), azymut 32,5°, pochylenie −17,7°, FOV poziome 73,7°.
- `okolica-estate8.jpg`: zdjęcie `estate-8` obok renderu. Parametry kamery: 66 m nad terenem, 19 m na wschód od domu A, azymut 280,5°, pochylenie −53°.
- `okolica-plan.jpg`: mapa kontrolna 2D (2 px/m).
  - Bryły są szare: dach dwuspadowy jasny, czterospadowy niebieskawy, płaski ciemny.
  - Drogi i boisko są w swoich kolorach, punkty drzew to zielone kropki.
  - Czerwona linia to strefa osiedla, pomarańczowe to sąsiedzi BOR2.
