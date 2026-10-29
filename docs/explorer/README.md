# /domy: osiedle i domy w 3D. Architektura

Stan na 28.10.2026, iteracja 1. Architektura to port explorera z projektu Kickiego 27 (`demo_Dominik/docs/mieszkania-3d.md`), przerobiony z jednego budynku z mieszkaniami na osiedle 7 domów.
Specyfikacja UX i materiały źródłowe są w [docs/inwestycja-3d](../inwestycja-3d/README.md), a wytyczne klienta w `docs/nadzor/`.

## Ścieżka użytkownika

**Osiedle → Dom → Model 3D / Spacer / Galeria**, w jednej ciągłej scenie real-time.

- `/domy`. Wejście to lotnicza wizualizacja dewelopera z obrysami 7 domów:
  - jest jednocześnie elementem LCP i fallbackiem bez WebGL;
  - przeciągnięcie albo przycisk „Zobacz makietę 3D” rozpuszcza zdjęcie w makietę;
  - kamera startuje z pozy zdjęcia (od ulicy, NE) i leci łukiem na stronę ogrodów (SSW, ~25°);
  - etykiety to szklane pigułki „Dom B · 119,8 m² · 1,60 mln zł”, sprzedane są wyciszone.
- `/domy/[dom]`. Dom w swoim prawdziwym otoczeniu:
  - **Model 3D**: cały dom z dachem w prawdziwym kolorze albo domek dla lalek otwarty na wybranej kondygnacji (pigułka po prawej: dom / 1 / P; wyższe piętro i dach odjeżdżają w górę);
  - **Spacer**: klik w podłogę, punkty, minimapa piętra, pasek pomieszczeń obu pięter, „Wizualizacja”, czyli przenikanie do renderu Kreatora w tym samym stylu;
  - **Galeria**: wnętrza i wizualizacje dewelopera oraz rzuty.
- Dolny pasek: styl (s1 Jasna skandynawska / s4 Japandi / s3 Grafitowa, te same id co Kreator na home) | pora dnia (Rano / Dzień / Noc, słońce 21.09) | zoom.
- Stan jest w URL, więc doradca może wysłać link do konkretnej wersji:
  `/domy/a?widok=spacer&punkt=salon&styl=s4&pora=noc`, `/domy/b?poziom=pietro`. Działa też stary format home `/domy?dom=B&…` (przekierowanie).

## Warstwy

```
src/lib/estate/                 dane domenowe (bez React/three): jedno źródło prawdy dla home i /domy
  types.ts, data.ts, index.ts   7 domów z senn.pl, ceny + historia, pomieszczenia, style, formatery (NB)
  photo.ts                      zdjęcie lotnicze + obrysy domów (ścieżki SVG z senn.pl)
  geometry/
    types.ts                    kontrakt geometrii (metry; przestrzeń planu → domu → osiedla)
    layoutB.ts                  układ B (domy B, D; lustra A, C) odrysowany z rzutów, ±0,1 m²
    site.ts                     rozmieszczenie domów na osiedlu (PZT), kolory dachów, granica działki
    index.ts                    houseModel(layout), levelModel, walkNode
src/components/explorer/
  preload.ts                    preloadExplorerAssets(): lekki moduł dla home (fetch do cache + chunk sceny)
  state/store.ts                zustand: widok, dom, tryb, kondygnacja, styl, aranżacja, pora, punkt; withDissolve()
  explorer/                     UI DOM nad sceną: wejście ze zdjęciem, szyna, pigułka kondygnacji, dolny pasek,
                                HUD spaceru, galeria, loader, RouteState (URL ↔ store)
  panel/                        lista domów (osiedle) i karta domu (SSR): cena, zł/m², historia cen, CTA
  three/
    Stage.tsx                   Canvas (frameloop demand), kompozycja świata: osiedle albo dom w otoczeniu
    space.ts                    przestrzeń osiedla ↔ przestrzeń domu, lustra (A, C)
    camera/                     JEDEN CameraControls; rigi estate/house/walk, intro, lens shift pod panel
    estate/                     makieta osiedla (bryły z gliny, dachy na rąbek, ogrody, drogi, drzewa)
    house/                      dom w detalu: generator powłoki (build.ts), kondygnacje i cutaway (Shell.tsx), dach
    furniture/                  umeblowanie per układ/kondygnacja/aranżacja (b/), kit proceduralny (core/), kot
    materials/                  sloty powierzchni × style (specs.ts), tekstury CC0
    lighting/                   słońce wg pory dnia (azymut/wysokość 21.09), niebo proceduralne, mgła, IBL
    walk/                       kursor podłogi, klik-i-przejdź, punkty
    SceneGate.tsx, loading.tsx, warmup.ts   pełny preload: zasoby → GPU → kompilacja wariantów → pokaz
src/app/domy/layout.tsx         Explorer w layoucie segmentu: canvas NIE remountuje się między /domy a /domy/[dom]
```

## Przestrzenie (najważniejsza decyzja)

- **Plan**: metry rzutu dewelopera, x → ulica (N), y wzdłuż szeregu. Nowy układ to po prostu odrys.
- **Dom**: X = plan x, Z = plan y, Y = 0 na gotowej posadzce parteru. Cały kod wnętrza (spacer, etykiety, kamery, meble) działa w tej przestrzeni. Domy lustrzane (A, C, G) rysujemy ze `scale-z −1`, a kamery i punkty przechodzą przez `space.ts` (`planVec`, `mirrorNode`).
- **Osiedle**: kompas, X = wschód, Z = południe. Domy stoją prosto N–S, schodkowo (~1,475 m na dom).
- Widok domu renderuje osiedle w przestrzeni domu (odwrotne rozmieszczenie). Dzięki temu przejście osiedle → dom to tylko przeliczenie pozy kamery (`handoff` w CameraRig), bez skoku obrazu, a za oknami jest prawdziwy ogród i sąsiedzi.

## Zasady, które trzymają całość

1. **Jedna scena, jedna kamera.** Wszystkie zmiany widoku to przejścia sprężynowe camera-controls, liczone od bieżącej pozy. Każde można przerwać gestem.
2. **Dane opisują, renderer generuje.** Nowy układ to plik `geometry/layoutX.ts` (strefy, ściany z otworami, schody, węzły spaceru, ujęcia), a nie kod 3D.
3. **Materiały to sloty.** Meble i powłoka biorą `useMaterial("fabric" | …)`. Nowy styl to jeden wpis w `specs.ts` plus (opcjonalnie) rendery `public/explorer/renders/<pokój>/<styl>.jpg`.
4. **Najpierw kompletna scena, potem płynność (decyzja klienta).**
   - Bramka sceny pokazuje ją dopiero, gdy wszystko jest pobrane, wszystkie 3 style są na GPU i wszystkie warianty shaderów są skompilowane (osie `useWarmupAxis`).
   - Pora dnia zmienia tylko uniformy i natężenia: światła praktyczne są stale w scenie, a mgła jest stale włączona.
   - Po zniknięciu loadera nic się nie doładowuje ani nie kompiluje.
5. **frameloop="demand".** Każda animacja w `useFrame` woła `invalidate()`, dopóki trwa. Delta zegara jest ograniczona do 50 ms.
6. **Stan w URL** (`RouteState`), więc działa udostępnianie, wstecz/dalej i SEO (panel jest SSR).

## Jak dodać kolejny układ (np. E/F, szeregówki)

1. `src/lib/estate/geometry/layoutE.ts`: odrysuj z `public/explorer/plans/dom-e-*.png` jak `layoutB.ts`. Skala ~102,4 px/m, kalibruj na wymiarach. Strefy, ściany (otwory podajesz we współrzędnych bezwzględnych osi ściany, helper `wall()`), schody, węzły, ujęcia.
2. Zarejestruj go w `geometry/index.ts` (MODELS) i w `LAYOUTS_WITH_3D` (`src/lib/estate/index.ts`).
3. Umeblowanie: `three/furniture/e/`, gałąź w `furniture/index.tsx`.
4. Sprawdź `PLACEMENTS` w `site.ts` (rozmiar, lustro), bo od tego zależy zgodność z makietą.

## Weryfikacja

- Dev: `$env:NEXT_DIST_DIR='.next-3d'; npx next dev -p 3142`. Strona główna działa na 3141.
- Zrzuty z prawdziwym GPU: `node docs/explorer/tools/shot.mjs <url> <out.png> [w] [h] [waitMs] ["js" …]`.
- Sondy stanu: `node docs/explorer/tools/probe.mjs <url> <waitMs> "<wyrażenie>" …`.
- Konsola na /domy i /domy/a (desktop i mobile, z panelem, rzutem, spacerem i arkuszem kontaktu): `node docs/explorer/tools/console.mjs [base]`.
- Budżet ładowania na buildzie prod (MB, czas do gotowości, VRAM): `node docs/explorer/tools/measure.mjs <url>?debug=1 [desktop|mobile] [fast4g|none]`.
- Podglądy linków (og:image 1200×630, < 300 KB): `node docs/explorer/tools/og.mjs [base] [domy]` zapisuje `public/explorer/og/`. Uruchom ponownie po zmianie wyglądu domów.
- W dev scena wystawia `window.__explorer` (store), `window.__controls` (camera-controls) i `window.__stage`.

## Roadmapa (kolejne iteracje)

| # | Iteracja | Efekt |
|---|---|---|
| 1 | Wygląd wnętrza: dopracowanie salonu pod rendery Kreatora (materiały, światło, wypalone AO/lightmapy z Blendera) | Fotorealizm pokoju-bohatera |
| 2 | Makieta osiedla: dopasowanie kamery wejścia do zdjęcia lotniczego (punkty zbiegu, jak w Kickiego), żeby zdjęcie przechodziło w 3D 1:1 | Płynniejsze „wow” wejścia |
| 3 | Układy E/F (szeregówki) w 3D | Wnętrza wszystkich dostępnych domów |
| 4 | Poddasze (pusta przestrzeń ≥ 2,2 m, etykieta „Poddasze ok. 50 m²”) | Komplet kondygnacji |
| 5 | Kompresja: meshopt/Draco dla GLB, KTX2 dla tekstur | Krótsze ładowanie |
| 6 | Obrazki OG per dom, plakaty LCP per dom | Podgląd linków doradców |
| 7 | Tryb „Zdjęcie” (path tracer, gdy kamera stoi) | Fotorealizm na żądanie |
