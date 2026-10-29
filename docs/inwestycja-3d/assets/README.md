# Materiały do makiety: drzewa i grunt

Stan na 29.10.2026, autor `demo-halowawer-66` (research/UX). Pliki są gotowe do skopiowania do `public/explorer/3d/` przez właściciela modułu 3D. Propozycje użycia: [../04-wyglad-desktop.md](../04-wyglad-desktop.md).

## drzewa/drzewa.glb (4,2 MB)

Jeden plik z 7 drzewami. Każde stoi w swoim węźle w punkcie (0, 0, 0), w metrach. Węzeł główny to `halo-wawer-trees`.

| Węzeł | Gatunek | Wysokość | Trójkąty (kora + liście) |
|---|---|---|---|
| `sosna-1` | sosna zwyczajna, wysoki goły pień, ciemna korona | 21 m | 9,2 tys. |
| `sosna-2` | sosna, korona węższa | 17 m | 11,7 tys. |
| `sosna-3` | sosna, wyraźne poziome konary z kępami | 18 m | 11,7 tys. |
| `brzoza-1` | brzoza, biała kora, jasna korona | 15 m | 24,5 tys. |
| `brzoza-2` | brzoza, niższa | 13 m | 21,7 tys. |
| `dab-1` | dąb, szeroka korona (solitera na łące) | 16 m | 22,6 tys. |
| `lipa-1` | drzewo liściaste, zwarta korona (lipa/jesion) | 14 m | 21,5 tys. |

- Każde drzewo ma 2 siatki: korę (`MeshStandardMaterial` z mapami color/normal/roughness/AO) i liście (`alphaTest 0.5`, dwustronne).
- Tekstury są wspólne, WebP 1024 px. Geometria jest skompresowana meshopt, a drei `useGLTF` ma dekoder meshopt wbudowany.
- Kora ma `KHR_texture_transform` (skala tekstury kory), obsługiwane przez GLTFLoader.
- **Źródło:** wygenerowane biblioteką EZ-Tree 1.1.0 (`@dgreenheck/ez-tree`, licencja MIT) z presetów Pine, Aspen, Oak i Ash, przestrojonych pod sosnę zwyczajną i brzozę z Wawra. Receptury są w `receptury.json`.
  - Tekstury kory pochodzą z ambientCG (CC0).
  - Tekstury liści są dołączone do EZ-Tree na licencji MIT.
- **Regeneracja:**
  - potrzebne pakiety: `npm i @dgreenheck/ez-tree@1.1.0 three@0.186.1 playwright-core @gltf-transform/cli@4.5.1` w katalogu roboczym;
  - generowanie: `node run.mjs receptury.json out 1`;
  - optymalizacja: `gltf-transform optimize out/trees-raw.glb drzewa.glb --compress meshopt --texture-compress webp --texture-size 1024 --join false --instance false --flatten false --palette false --simplify false`.
  - `verify.html` i `verify.mjs` ładują wynik i renderują kompozycję testową.
- **Podgląd:** `podglad/gatunki.jpg`, `podglad/kompozycja-z-gory.jpg` i `podglad/kompozycja-ogrod.jpg`; stan obecny makiety to `podglad/przed-osiedle.jpg`.

Użycie: jedna instancja na gatunek, czyli 2 draw calle na gatunek (kora i liście) niezależnie od liczby drzew.

```tsx
const { nodes } = useGLTF("/explorer/3d/models/drzewa.glb");
// per gatunek: geometrie i materiały z nodes["sosna-1"].children → <instancedMesh args={[geo, mat, count]} castShadow receiveShadow />
// macierz instancji: pozycja z TREES, obrót Y losowy, skala = h / wysokość gatunku (±10%)
```

- Cienie liści: `alphaTest` przechodzi do depth materiału, więc korony rzucają ażurowy cień.
- Gdy cień ma być tańszy, sosny w pasie lasu mogą mieć `castShadow = false`; widać to tylko od strony słońca.

**Wersja z 29.10, godz. 01:10.** Sosny `sosna-1/2/3` są wymienione na wariant z nieregularną koroną i bocznymi konarami (ziarna 5, 131 i 97), bez oderwanej kępy na czubku. Nazwy węzłów i wysokości (21, 17 i 18 m) się nie zmieniły, więc kod instancji działa bez zmian.

## drzewa/las-impostory.webp + .json (280 KB): daleki las

Atlas 2048×2048, 4 × 2 komórki po 512×1024 px, z kanałem alfa:
- 3 sosny w 2 ujęciach (obrót o 1,3–2,4 rad);
- 2 brzozy.

Każda komórka to boczny widok ortograficzny drzewa z `drzewa.glb`, oświetlony miękko, bez kierunku słońca, więc pasuje do każdej pory dnia.

Zastępuje proceduralny daleki las, który dziś ma płaskie, talerzowate korony.

Plik `las-impostory.json` podaje dla każdej komórki:
- `uv` (`[u0, v0, du, dv]`, v liczone od dołu);
- `cellWidthM`, czyli szerokość komórki w metrach; wysokość to 2 × `cellWidthM`;
- `heightM`, czyli wysokość drzewa.

Podstawa pnia leży na środku dolnej krawędzi komórki.

Użycie (od ok. 150 m do horyzontu):
- quad `cellWidthM × 2·cellWidthM` z kotwicą na dole, obracany tylko wokół Y do kamery, albo 2 skrzyżowane quady;
- materiał `MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide })` z normalną skierowaną do kamery (albo ku górze, dla równego światła);
- fog włączony;
- instancing po komórce (UV przez atrybut instancji albo 8 geometrii);
- skala 0,85–1,15, losowe przesunięcie ±2 m, gęstość 1 drzewo na 25–40 m²;
- `castShadow = false`.

Podgląd: `podglad/las-impostory.jpg`. Regeneracja: `node impostor.mjs <katalog z trees.glb>`.

## grunt/ (4,1 MB, 1K JPG, ambientCG CC0)

| Folder | Do czego | Kafel w świecie |
|---|---|---|
| `Grass004/` | trawnik w ogrodach i pasach zieleni | 2,5 m |
| `Ground037/` | łąka (trawa z prześwitami ziemi), w plamach z Grass004 | 4 m |
| `PavingStones128/` | podjazd, miejsca postojowe, dojazd (szara kostka betonowa) | 2 m |
| `Planks021/` | tarasy (deska) | 1,5 m wzdłuż desek |

Każdy folder zawiera `color.jpg`, `normalgl.jpg` (normal w konwencji OpenGL, czyli three.js), `roughness.jpg` i `ambientocclusion.jpg`. Licencja CC0; atrybucja nie jest wymagana, ale warto dopisać ambientCG do `CREDITS.md`.
