# Wygląd makiety na desktopie: diagnoza i propozycje według efektu WOW

Stan na 29.10.2026. Autor `demo-halowawer-66` (ocena i propozycje, kodu nie zmienia).

Kto wdraża:
- `three/estate/**` (teren, roślinność, sąsiedzi, materiały domów): agent 3D (sesja 85);
- `three/lighting/**` i `Effects.tsx`: nadzór (5d); przy sprzecznych propozycjach rozstrzyga nadzór.

Materiały gotowe do użycia: [assets/README.md](assets/README.md), czyli `drzewa.glb` (7 drzew) i 4 tekstury gruntu CC0.

Zrzut wyjściowy: `assets/drzewa/podglad/przed-osiedle.jpg` (1440×900, Dzień, po „Zobacz makietę 3D”).

## Diagnoza

| # | Co psuje odbiór | Dlaczego tak wygląda (kod) |
|---|---|---|
| 1 | **Ok. 60% kadru to płaski grunt w kolorze khaki** bez tekstury, a horyzont kończy się beżową pustką. | `ground.ts`: łąka z shadera w kolorach `#a1ad87` / `#91a07a` / `#bab99c` (zszarzałe), bez tekstury detalu. Za osiedlem nie ma lasu ani zabudowy, które zamknęłyby kadr. |
| 2 | **Drzewa są ciemne i ziarniste, stoją pojedynczo pośrodku łąki** („plamy na patykach”). | `vegetation.ts`: karty liści z atlasu rysowanego na canvasie, cienkie pnie, 21 drzew rozrzuconych pojedynczo (`plan.ts → TREES`). |
| 3 | **Okna wyglądają jak czarne dziury.** | `materials.ts`: szkło `#2b2f33` odbija tylko HDRI 512 px, a za szybą nic nie ma. |
| 4 | **Sąsiedzi to gołe bryły, boisko to same linie na trawie.** | `siteMeshes.ts → buildNeighbours`: glina bez okien i bez otoczenia. |
| 5 | **Strona cienia domów jest bardzo ciemna** po obrocie kamery. | Mało odbitego światła w cieniu (hemisfera lub IBL). |

## A. Teren i roślinność (agent 3D, `three/estate/**`), od największego efektu

**A1. Las sosnowy zamykający horyzont (największy efekt).**
- Wawer i Zerzeń to bór sosnowy: zdjęcia z drona pokazują ścianę sosen za osiedlem, a rendery dewelopera też.
- Dodaj do `plan.ts` dane `FOREST` jako 3–4 pasy jako polilinie. Każdy pas ma 2–3 rzędy, odstęp 4–6 m, losowe przesunięcie ±1,5 m, skalę 0,85–1,15 i losowy obrót Y. Pasy (współrzędne estate):

  | Pas | Położenie | Uwagi |
  |---|---|---|
  | Północny zachód | za boiskiem, z ≈ −120…−135, x ≈ −90…60 | |
  | Zachód | x ≈ −75…−90, z ≈ −100…60 | |
  | Wschód | x ≈ 135…150, z ≈ −60…80 | za domem z czerwonym dachem |
  | Południe | z ≈ 105…120, x ≈ −40…120 | niższy i rzadszy, żeby nie zasłonić widoku SSW |

- Gatunki: 80% `sosna-1/2/3`, 20% `brzoza-1/2` na skraju lasu.
- Razem ok. 120–160 instancji, czyli ok. 1,5 mln trójkątów. Desktop to udźwignie przy instancingu: 2 draw calle na gatunek.
- W lesie za 150 m `castShadow = false`; drzewa tylko odbierają cień.
- Mgła zrobi resztę: las w oddali przechodzi w niebo.

**A2. Drzewa z `drzewa.glb` zamiast proceduralnych.**
- Zostaw dane `TREES`, bo pozycje szanują osie widoku na ogrody.
- Mapowanie:
  - `pine` → `sosna-{1,2,3}` według `seed % 3`;
  - `birch` → `brzoza-{1,2}`;
  - skala = `h / wysokość gatunku`.
- Dodaj 2–3 solitery liściaste na łące południowej: `dab-1` w okolicy (8, 34) i `lipa-1` w okolicy (46, 40), poza korytarzami `viewCorridors()`. Spokojny dąb na pierwszym planie widoku SSW daje kadr „jak z renderu”.
- Kolor liści per instancja przez `instanceColor`, z jasnością ±8% i odcieniem ±3°. Bez tego 20 identycznych koron wygląda jak klony.
- Grupuj drzewa po 2–4 sztuki. Pojedyncze drzewo na środku trawnika wygląda jak błąd.

**A3. Grunt: kolor i detal.**
- Kolory łąki w `makeGroundMaterial()` (`ground.ts`) zamiast khaki: świeża zieleń z końca lata (21.09).

  | Uniform | Wartość |
  |---|---|
  | `uMeadowA` | `#8fa45e` |
  | `uMeadowB` | `#7b9150` |
  | `uMeadowDry` | `#b3ad7a` (na ≤ 15% powierzchni, w plamach 20–60 m) |
  | `uPitchColor` | `#7fa04f`, z pasami koszenia ±5% jasności co 6 m |

- Trawniki w ogrodach: `#7c9d4c`, pasy koszenia ±6%. Dziś ogrody mają nasycony, sztuczny zielony, który odcina się od łąki.
- Tekstura detalu (`assets/grunt`):
  - `Grass004` jako detal na trawnikach, kafel 2,5 m;
  - `Ground037` w plamach na łące, kafel 4 m;
  - albedo mnożone przez kolor z canvasu (detal ×0,6 + 0,4, żeby nie dominował), normal map ze skalą 0,6;
  - **detal wygasa z odległością** (`smoothstep(30.0, 90.0, dist)`), więc z daleka zostaje spokojna plama koloru, a z bliska jest prawdziwa trawa.
- **Ścieżka przez łąkę:** udeptana ziemia w kolorze `#a7997d`, szer. 1,2 m, wzdłuż zachodniego ogrodzenia do boiska (jest na `estate-1.jpg` i `estate-8.jpg`). Przerywa monotonię i jest prawdziwa.

**A4. Okna, które wyglądają jak okna.**
- Szkło w `materials.ts`: `color #3c4853`, `roughness 0.02`, `envMapIntensity 2.2`, `ior 1.5`. Przy 1.9 odbicie jest zbyt lustrzane i ciemne.
- **Wnętrze za szybą** (w `houses.ts`, w funkcji `opening`): płaszczyzna 0,35 m za szybą o kolorze `#d9d1c5`, z pionowym gradientem firanki (górne 70% jaśniejsze, `#efe9df`) albo z teksturą firanki.
  - W porze Noc ta płaszczyzna świeci ciepło (`emissive #ffcf8a`, intensywność 0,6–1,2), jak na `visualization-2` i `-6`.
  - Koszt to 1 quad na okno.

**A5. Sąsiedzi i boisko.**
- **Sąsiednie domy** (`buildNeighbours`):
  - dachy w kolorach z OSM i zdjęć: dom na wschodzie `#9b4b3a` (czerwona dachówka), pozostałe antracyt `#4b4e52` albo brąz `#6b4f42`;
  - ściany `#e8e2d8`;
  - pasy okien jako ciemne prostokąty `#3c4148` na elewacjach (wystarczy tekstura);
  - przy każdym domu 1–2 drzewa z `drzewa.glb` i żywopłot.
- **Boisko:** bramki (białe ramy 7,32 × 2,44 m), siatka ogrodzenia 1,2 m `#5b6157` z α 0,6 po obwodzie, murawa z pasami (A3).

**A6. Ogrody, które wyglądają na zamieszkane** (detal na zbliżeniu domu):
- na 2–3 tarasach `outdoor_table_chair_set_01.glb` (CC0, jest już w `public/explorer/3d/models`);
- deska tarasu `Planks021`;
- kule ogrodowe (świecą w Noc);
- żywopłoty jako przycięte bryły z teksturą liści z `drzewa.glb` (atlas liści lipy), wysokość 1,2–1,6 m.

## B. Światło i obraz (nadzór, `lighting/**`, `Effects.tsx`)

**Rozstrzygnięte i wdrożone przez nadzór (29.10)**, odstępstwa od propozycji poparte pomiarem:
- **B1:** Hemisphere `#c9d8ee` / `#8a7656` o intensywności 2,0, IBL 0,8, słońce 4,4. Ściana w cieniu ma 124/255 (przy 0,48 miała 52), fasada w słońcu 229. Grunt hemisfery bez zieleni, bo tynk w cieniu robiłby się zielonkawy.
- **B2:** słońce `#ffe2c2`, PCF `radius` 4. Mapa cieni zostaje 2048: przy zasięgu 124 m daje ok. 6 cm/teksel, a 4096 to ok. 64 MB VRAM i ryzyko przycięcia przy przełączaniu widoków.
- **B3:** mgła osiedla `near` 140, `far` 650, horyzont `#dfe6ec`.
- **B4:** N8AO osiedla `aoRadius` 2,5, `intensity` 1,7.
- **B5:** nasycenie +0,07, winieta 0,36.

Pierwotne propozycje (dla historii):

| # | Propozycja | Wartości |
|---|---|---|
| B1 | Rozjaśnić cień: dziś strona cienia domów jest prawie czarna. | `HemisphereLight` niebo `#cfdeea`, grunt `#8a9b62`, intensywność ok. 0,7 w porze Dzień. IBL `environmentIntensity` 0,6–0,8. |
| B2 | Słońce w porze Dzień (21.09, 15:30, az 232°, el 26°): ciepłe, ale nie pomarańczowe. | Kolor `#ffe4c4`, cienie miękkie (PCF, `radius` 3–4), mapa cieni 4096 na obszar osiedla (ok. 130 × 70 m) daje ok. 3 cm/px. |
| B3 | Perspektywa powietrzna z lasem z A1. | Mgła `near` 140, `far` 650, kolor horyzontu w porze Dzień `#dfe5e3` (lekko chłodny). Las w 150–250 m dostaje 20–40% mgły, a horyzont się zamyka. |
| B4 | AO w koronach drzew. | N8AO dla osiedla `aoRadius` 3,5 → 2,5 i `intensity` 2,2 → 1,8. Z drzewami z GLB mocne AO daje ciemne aureole wokół koron. |
| B5 | Grading. | Zostaje NEUTRAL. Nasycenie +0,05 (zamiast +0,03), bo zieleń z A3 nie może szarzeć. Winieta `darkness` 0,55 → 0,4, bo przy jasnym gruncie 0,55 brudzi rogi kadru. |

## Kolejność wdrażania (największy efekt najmniejszym kosztem)

1. A2 drzewa z GLB i A1 las: jeden przyrost i największa zmiana kadru.
2. A3 kolory i detal gruntu.
3. B1 i B3: cień i mgła.
4. A4 okna.
5. A5 sąsiedzi i boisko.
6. A6 ogrody.
7. B4 i B5: kosmetyka.

Po każdym przyroście robię zrzuty desktop 1440×900 (osiedle z wejścia, obrót od ogrodów, dom A z bliska) i porównuję je z `podglad/przed-osiedle.jpg`, renderami hero i zdjęciem od usera.
