# Wnętrza BOR2: dom1 (G) i dom2 (B)

Stan na 04.11.2026. Oddana wersja to **v3**.

## Oddane pliki (v3)

GLB i lightmapy wymienia się zawsze razem. Atlas UV1 jest inny po każdej budowie.

| Plik | Zawartość |
|---|---|
| `bor2-wnetrze-dom1.glb` | WNETRZE_G: 4,63 MB, 261 908 tri, 65 prymitywów, 23 materiały, 10 punktów PKT_* |
| `bor2-wnetrze-dom2.glb` | WNETRZE_B: 5,18 MB, 305 671 tri, 56 prymitywów, 20 materiałów, 10 punktów PKT_* |
| `wnetrza-lm/{G,B}_kond{0,1}.webp` | lightmapy podłóg, sufitów, ścian, dużych mebli i schodów (2048², sRGB) |
| `wnetrza-lm/{G,B}_kond{0,1}d.webp` | lightmapy drobnych mebli i detali (węzły `KOND_n__DETALE`) |
| `bor2-wnetrze-dom1.orig.glb` | poprzedni placeholder dom1 (kopia bezpieczeństwa) |
| `podglad/wnetrze-porownanie-interior-*.jpg` | three.js (lewa) i render dewelopera (prawa), ujęcia z `ujecia-porownawcze.json` |
| `podglad/wnetrze-lightmapa-interior-{4,2}.jpg` | bez lightmapy / z lightmapą / render |
| `podglad/wnetrze-sweep-dom{1,2}.jpg` | po 3 ujęcia z każdego PKT, oczy 1,65 m |
| `wnetrza-kontrola/kontrola-dom{1,2}.json` | L1: dziury z PKT, ramy okien vs szyby bryły, wysokości w świetle |
| `wnetrza-kontrola/okna-zewn-{G,B}.json` | prostokąty szyb bryły z `bor2-zewnetrze.blend` (wzorzec dla okien wnętrza) |

Co jest w środku:
- **Materiały wg renderów dewelopera.** Model SKP daje geometrię, render daje wygląd. Biblioteka ma 18–23 materiały PBR (`wnetrze_wspolne.BIB`).
  - dom1: jasne deski dębowe z fugami.
  - dom2: jodełka.
  - TKANINA (len) i DETAL to jeden materiał każdy, a kolor dają wierzchołki (COLOR_0).
  - Lamele w dom1 to płaskie panele z mapą normalnych.
- **Normalne.** Wierzchołki są zgrzane, cieniowanie gładkie z ostrymi krawędziami powyżej 42°.
- **Decymacja z budżetem trójkątów.** Najmocniej obcięte są drobne, gęste detale. Klosze dostają wagę ×4, cienkie kable nie są upraszczane.
- **Oczka sufitowe** (18 × 28k tri) w dom1 zastąpione walcami 16-bocznymi osadzonymi w suficie.
- **Brakujące pokoje** są proste: ściany z otworami, stropy, okna zgodne z bryłą, drzwi otwarte pod kątem 90°, 2–4 meble.
  - dom1 piętro (północ): pokój 1, pokój 2, łazienka z oknem we wschodniej ścianie, korytarz.
  - dom1 parter: WC.
  - dom2 piętro (północ): łazienka z oknem w zachodnim szczycie, pokój hobby, pokój 2, drzwi wycięte w zamkniętym korytarzu SKP.
  - dom2 parter: strop nad garażem i holem, okno garażu w szczycie.
- **Szyby.** We wszystkich oknach bryły jest ciemne szkło, ok. 15 % krycia. SKP nie miał szyb, przez co widok za oknem był przepalony.
- **Zewnętrzne lica ścian** mają materiał `TYNK_ZEWN`, ramy okien od zewnątrz `OKNA_ZEWN` (#4a3a30), a od środka `BIALY`.

## Kontrakt (z runtime 55)

- Hierarchia: `WNETRZE_<G|B>` → `KOND_0`, `KOND_1` → `KOND_n__PODLOGA`, `__SUFIT`, `__WNETRZE`, `__DETALE`, `__TRANSPARENT`. Do tego `SCHODY` i kamery `PKT_<POKOJ>` na wysokości 1,65 m nad podłogą (extras `kondygnacja`).
- Układ: glTF Y-up, metry, pozycje światowe jak w bryle, bez centrowania.
- Kompresja: EXT_meshopt_compression + KHR_mesh_quantization.
  - Pozycje: 14 bit względem bboxu każdej siatki, krok < 1 mm.
  - Blender eksportuje bez meshopt, bo jego meshopt koduje pozycje stratnie.
  - Prymitywy bez tekstur nie mają TEXCOORD_0.
- Lightmapy:
  - siedzą w extras **węzła**: `{"lightMap": "wnetrza-lm/G_kond0.webp", "lightMapIntensity": x}`;
  - węzły mają wiele prymitywów, więc w three.js userData jest na Group, a nie na Mesh;
  - UV to TEXCOORD_1 (three.js `uv1`, `texture.channel = 1`), sRGB, `flipY = false`.
- Treść lightmapy:
  - niebo bezpośrednio + całe światło pośrednie, bez bezpośredniego słońca (L = A − B: DIFFUSE direct+indirect przy niebie i słońcu minus DIFFUSE direct przy samym słońcu);
  - słońce „Dzień” wg georeferencji OSM: wektor DO słońca (−0,711, −0,548, 0,440), kolor #ffe2c2, natężenie 4,4;
  - zapis w extras `WNETRZE_*`: `slonce_dzien`, `lightmapa_wzmocnienie`.
- Wartość: `lightMapIntensity = π · k · 6,5`.
  - k to skala kodowania (percentyl 99,7).
  - 6,5 to ekspozycja wnętrza: rendery są naświetlone pod wnętrze.
  - Po wypieczeniu `wnetrze_lm_post.py` mnoży RGB przez 1,00 / 0,965 / 0,91 (ciepły cień), a dom1 dostaje KOND_0 ×1,15 i KOND_1 ×1,05.
  - Runtime skaluje intensywność wg pory dnia. Przy lightmapie: hemisphere w środku ok. 0,3, envMapIntensity ≤ 0,25.
- Materiały świecące na dzień: ZASLONA, FIRANA, LAMPA. W porze „Noc” przygasić zasłony.

## Jak odbudować

Potrzebne narzędzia:
- Blender 5.2 headless;
- Cycles na CUDA (OPTIX nie kompiluje jąder na tym sterowniku);
- gltf-transform poza repo: `npm install --prefix <katalog> @gltf-transform/cli@4`.

```bash
cd docs/inwestycja-3d/assets/bor2
python -I wnetrze_tekstury.py                     # wnetrza-tex/*.jpg|png (przebarwienia pod rendery, fugi, liście, lamele)
GT=<katalog>/node_modules/@gltf-transform/cli/bin/cli.js \
  bash wnetrze_wszystko.sh dom1 <katalog_roboczy> buduj rozm=2048 probki=256 tmp=<tmp>
# etapy: buduj -> pokoje -> lightmapy -> szyby -> glb -> kompresja (wynik w <katalog_roboczy>)
python -I wnetrze_lm_post.py <katalog_roboczy>/bor2-wnetrze-dom1.glb <katalog_roboczy>/lm wb=1.0,0.965,0.91 kond0=1.15 kond1=1.05
DOSTAWA=1 bash wnetrze_wszystko.sh dom1 <katalog_roboczy> dostawa   # kopiuje GLB + lm/*.webp do assets
```

| Skrypt | Rola |
|---|---|
| `wnetrze_konfig.py` | wszystko, co zależy od domu: mapa materiałów SKP → biblioteka, poziomy, obrys, schody, lamele, obiekty do usunięcia, PKT, brakujące pokoje (`D1_POKOJE`, `D2_POKOJE`) |
| `wnetrze_wspolne.py` | biblioteka materiałów (BIB), budowa materiałów zgodnych z glTF, synchronizacja kolorów bez wypiekania |
| `wnetrze_buduj.py` | SKP .blend → roboczy .blend: części, reguły materiałów, podłogi i sufity geometrycznie, UV w metrach, decymacja, węzły, PKT |
| `wnetrze_pokoje.py` | brakujące pokoje (ściany, płyty, okna, drzwi, meble, wycinanie otworów w istniejących ścianach) |
| `wnetrze_lightmapy.py` | orientacja lic, UV1 (smart project + pack), Cycles A/B, odszumianie OIDN, desaturacja, WebP, extras |
| `wnetrze_szyby.py` | szyby z `okna-zewn-*.json`, po wypiekaniu |
| `wnetrze_glb.py` | eksport glTF (bez meshopt), synchronizacja kolorów z BIB, tekstury 1024/512 |
| `wnetrze_odchudz.mjs` | UV0 tylko tam, gdzie są tekstury, kwantyzacja, meshopt |
| `wnetrze_lm_post.py` | balans bieli lightmap i intensywność per kondygnacja (bez ponownego wypiekania) |
| `wnetrze_kontrola.py` | L1: dziury z PKT, okna, wysokości |
| `wnetrze_verify.mjs` + `.html` | three.js jak w runtime: pary z renderami, `sweep=1`, `lm=0/1` |
| `wnetrze_inwentarz.py`, `wnetrze_kamery.py` | inwentaryzacja i ujęcia Workbench (rzuty, przekroje, kamery SKP) |

Uwaga: `wnetrza-tex/` i `wnetrze_konfig.py` są już w stanie **v4**. Zmienione są dąb B, jodełka, sofy, ryfle, usuwanie tarasu i zabawek oraz sufit holu. Odbudowa daje więc v4, a nie v3. Wyniki przerwanego v4 leżą tylko w katalogu roboczym sesji i nie są oddane.

## Znane defekty v3

- **dom1:**
  - sofa za biała, w renderze krem;
  - pluszak i kredki w pokoju dziecka (na renderze ich nie ma);
  - ciemna plama na ścianie nad oknem pokoju dziecka (zasłona zacienia ją w wypiekaniu);
  - **brak sufitu w holu parteru** (x 35,3–37,6, y 56,3–58,1): z PKT_WEJSCIE widać spód stropu piętra;
  - PKT_KUCHNIA stoi pod górnymi szafkami (1,92 m nad podłogą).
- **dom2:**
  - krzesła i fronty kuchni w ciemnym, pomarańczowym dębie, w renderze jasny;
  - sofa szarosina z fasetami;
  - pościel chłodna, sinawa;
  - górne szafki kuchni (ryflowane szkło) wyglądają jak szare pasy;
  - **taras z desek (y 36,7–39,2) jest w GLB wnętrza** i nakłada się na taras bryły. To samo w dom1 (y < 50,3).
- **Oba domy:**
  - meble tapicerowane kanciaste w zbliżeniu (decymacja);
  - nowe pokoje proste i trochę szarsze od pokoi z SKP.
- **Rozbieżności modeli SKP:**
  - szyby we wschodniej ścianie parteru G (x 40,70) są w bryle, a we wnętrzu stoją tam ściana TV i kuchnia (sprawa w rejestrze);
  - okno łazienki G leży w bryle na x = 40,69, a lico wnętrza na 40,76;
  - okna południowe piętra G: ramy SKP 4,4 cm od szyb bryły;
  - okno kuchni G: 12,6 cm;
  - panel we wnęce wejściowej G wygląda jak brama garażu, a za nim we wnętrzu jest hol i WC (do rozstrzygnięcia).

## Niedokończone v4

Wszystko jest wpisane w konfigurację i skrypty, brakuje tylko przebudowy, kontroli i dostawy.
- sofa dom1 w kremie #d6cbba, waga tkanin ×3 w decymacji (mniej faset);
- usunięte pluszak (`æèðàô`) i kredki (`Lápis de madeira`);
- zasłony w wypiekaniu z kryciem 0,35 (ZASLONA) i 0,15 (FIRANA);
- sufit holu dom1;
- dom2: jasny dąb (`DAB_JASNY`) dla krzeseł i frontów kuchni, ściana dębowa zostaje ciemniejsza, jodełka jaśniejsza (#c4a078);
- tkaniny dom2: sofa beżowy len, pościel ciepła biel (R ≥ B);
- ryflowane szkło szafek dom2: panele `RYFLE` z mapą normalnych zamiast 289 listew;
- usuwanie wszystkiego poza obrysem ścian zewnętrznych (tarasy, płotki).
