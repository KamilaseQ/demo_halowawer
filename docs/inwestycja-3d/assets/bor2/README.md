# BOR2: zewnętrze osiedla (Blender → GLB dla `/domy`)

Stan na 04.11.2026, koniec pracy zespołu. Autor wyglądu i eksportu zewnętrza: sesja 59 (Blender).

## Aktualna wersja

| Plik | Status |
|---|---|
| `bor2-zewnetrze-v10.glb` | **Aktualna**, jeśli `audyt/test_glb.py` daje OK (patrz niżej). Zawiera wszystko z v8 oraz: tynk PBR (drobne ziarno w albedo i normal mapie, kafel 1,5 m), wypieczone AO dla każdego domu (`occlusionTexture`, `texCoord 1`), fugi bram segmentowych A–D, kinkiety przy 7 wejściach, płot w dwóch wariantach (`OGRODZENIA_GEO` = pręty, `OGRODZENIA_PANEL` = płyty z teksturą), siatkę kolizji `OGRODZENIE_KOLIZJA`, ciemnozielone ramy A, osobny dach B. |
| `bor2-zewnetrze-v8.glb` | Ostatnia wersja zweryfikowana w runtime (`public/explorer/3d/bor2/zewnetrze-v8.glb`). Zapasowa. |
| `bor2-zewnetrze-v9.glb`, starsze v10 | **Wadliwe** (czarna normal mapa tynku). Nie używać. |
| `bor2-zewnetrze.glb`, `-v2`…`-v7` | Historyczne. |

Po wdrożeniu nazwa pliku w `public/` musi się zmieniać (`/explorer/**` ma cache immutable), a wpięcie robi moduł 3D (`src/components/explorer/three/bor2/exterior.ts`, `BOR2_EXTERIOR_URL`).

## Co jest w GLB (kontrakt z modułem 3D)

- Węzły: `DOM_A`…`DOM_G` (sama bryła domu, scalona po materiale), `TARASY`, `ZIEMIA`, `ZIELEN`, `OGRODZENIA` (słupki, latarnie, skrzynki, śmietniki), `OGRODZENIA_GEO`, `OGRODZENIA_PANEL`, `OGRODZENIE_KOLIZJA`, `KONTEKST_1…8` (szare bryły sąsiadów), `ZIELEN_ZNACZNIKI` (puste węzły roślin, prefiksy wg `../zielen/mapowanie.json`).
- Kamery: `PKT_*` (oczy, punkty spaceru), `WIDOK_*` (z góry), `KADR_WIZ1/3/4/5` (kadry wizualizacji dewelopera, do porównań).
- Układ SketchUpa: X = wschód, glTF Y = góra, Z = południe, metry. Pozycje float32 (bez meshopt, bo meshopt w Blenderze 5.2 zapisuje je stratnie).
- Materiały per dom (`<dom>_<ROLA>`, np. `A_RAMA`, `C_WNEKA`) według renderu, który ten dom pokazuje. Tabela `ROLE_COLORS` jest w `wyglad_materialy.py`. Runtime podmienia tylko `SZYB*`, `OTOCZENIE*`, `DROGA*`/`ASFALT`/`KOSTKA*`/`[Asphalt…`, `GEOKRATA*`.

## Jak wyeksportować ponownie

Źródło prawdy to `bor2-zewnetrze-wyglad.blend` (kopia `bor2-zewnetrze.blend` z poprawkami i materiałami). Skrypty w tym folderze:

| Skrypt | Do czego |
|---|---|
| `wyglad_materialy.py` | Paleta, role per dom, tekstury proceduralne (tynk, płyty, panel płotu). Uruchamiać w Blenderze, potem zapisać .blend. |
| `wyglad_naprawy.py` | Naprawy geometrii SKP (ściany zasłaniające otwory, parzystość pokrycia, okna w ścianach wspólnych, płot z prętów, podjazdy). Idempotentne; `NAPRAW = False` daje sam raport. |
| `wyglad_zielen.py` | Znaczniki zieleni (drifty, drzewa ≥ 4 m od elewacji). |
| `wyglad_eksport.py` | Eksport GLB: klasyfikacja do węzłów, role materiałów, tarasy jako płyty, fugi bram, UV box mapping, AO. |
| `wyglad_scena.py`, `wyglad_porownanie.py` | Światło i kamery do renderów kontrolnych; zestawienia z wizualizacjami. |
| `wyglad_plot_kolizja.py` | Prostokąty przęseł z oryginalnego .blend → `plot_przesla.json`. |

```
# 1) (opcjonalnie) po zmianach palety: w Blenderze z otwartym bor2-zewnetrze-wyglad.blend
exec(open(r"...\wyglad_materialy.py", encoding="utf-8").read())   # potem Ctrl+S

# 2) eksport headless (z katalogu demo_halowawer), ok. 4 min z wypiekaniem AO
"D:\Programy\Blender\blender.exe" --background docs/inwestycja-3d/assets/bor2/bor2-zewnetrze-wyglad.blend ^
  --python docs/inwestycja-3d/assets/bor2/wyglad_eksport.py -- docs/inwestycja-3d/assets/bor2/bor2-zewnetrze-v11.glb
#    opcje: ao=0 (bez AO, szybko), ao_px=2048, meshopt=1 (stratne!), kadry=1, tekstury=1024

# 3) test przed przekazaniem (kod wyjścia 1 = dostawa wadliwa)
set PYTHONIOENCODING=utf-8
python docs/inwestycja-3d/audyt/test_glb.py docs/inwestycja-3d/assets/bor2/bor2-zewnetrze-v11.glb

# 4) podgląd w three.js projektu
"C:\Program Files\nodejs\node.exe" docs/inwestycja-3d/assets/bor2/verify.mjs <plik.glb> <katalog> KADR_WIZ3 KADR_WIZ4
```

## Otwarte (nie zaczęte)

- Ościeża i parapety: głębokość i grubość według uwag audytora (w modelu ościeża mają ok. 20 cm, ocena dopiero z AO).
- Cokół ~30 cm przy gruncie (zdjęcia z budowy).
- Kalibracja jasności tynków i dachów po zmianach światła w runtime (scorecard e3: `scorecard/`).
- Wpięcie zestawu tekstur PBR od wykonawcy (`../tekstury/`) w miejsce proceduralnych.
