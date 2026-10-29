# Biblioteki i techniki: jak osiągnąć efekt NOHO ONE / Kickiego 27 dla domów

Stan na 28.10.2026. Wersje, licencje i peer-dependencies sprawdziłem w rejestrze npm (`npm view`). Stack scaffoldu w repo to **Next 16.4.3, React 19.3.1, TypeScript 5.9.3**.

Pełny research dla mieszkań (NoHo One od środka, pułapki r3f/drei/camera-controls/postprocessing, pipeline assetów) jest w `C:\Users\212ka\source\repos\demo_Dominik\docs\3d-research.md`. **Wszystko tam opisane nadal obowiązuje.** Ten plik zawiera tylko różnice dla Halo Wawer.

## 0. TL;DR

- **Stack bez zmian względem Kickiego:**
  - `three` 0.186.1;
  - `@react-three/fiber` 9.8.2;
  - `@react-three/drei` 10.7.9 (z `camera-controls` 3.1.2 w środku);
  - `@react-three/postprocessing` 3.2.2 + `postprocessing` 6.39.5;
  - `zustand` 5.0.16.
  Wszystkie są zgodne z React 19.3.1.
- **Dwie przypięte wersje (nie podbijać):**
  - **React < 19.4**, bo peer r3f 9.8.2 to `react >=19 <19.4`;
  - **three < 0.187**, bo peer `postprocessing` to `three >=0.168 <0.187`.
- **Nowe zależności dla domów: jedna,** `react-zoom-pan-pinch` 4.2.0 (MIT) do pinch-zoomu rzutu 2D na mobile. Reszta funkcji to kod na tym, co już jest: rozdzielenie pięter, rzut SVG, pora dnia z prekomputowanych wektorów, minimapa.
- **NOHO ONE** to sekwencje klatek z renderów offline i lekka scena WebGL tylko do trafień i podświetleń (Vue + Babylon.js, dostawca Resimo).
  - My nie mamy renderów 360°, więc robimy jak Kickiego: **real-time r3f jako baza** i hybrydę zdjęcie → 3D tylko na wejściu (`site-plan.png` z poligonami senn).
- **Największy skok realizmu na później:** domy już stoją (dron, 04.2026), więc da się zrobić **splat prawdziwego osiedla z przelotu drona**:
  - WebODM 3.3 → trening → Spark 2.4 (MIT);
  - tak działa Zillow SkyTour.

## 1. Co bierzemy z NOHO ONE (i czego nie)

| NOHO ONE | U nas |
|---|---|
| Widok budynku z 119 pre-renderowanych klatek orbity (AVIF/WebP, dzień i noc), 4 punkty dociągania | Orbita real-time (camera-controls) z **4 punktami dociągania azymutu** N/E/S/W. Bez sekwencji klatek, bo nie ma renderów 360°. |
| Bryły lokali w `scene8.glb` jako szkło w kolorach statusu, kamera WebGL zsynchronizowana z klatką | Pojedyncze domy jako bryły makiety. Hover to złote podświetlenie. Na wejściu poligony SVG na zdjęciu (dokładne, z senn). |
| Statusy: miętowy, szary, brązowy | **Paleta marki**: złota kropka, taupe, wyszarzenie (decyzja klienta). |
| Widok kondygnacji z jednego pre-renderu z góry | **Rzut 2D** (SVG / PNG dewelopera) i **rozdzielenie pięter w 3D**. |
| Obrót mieszkania 3D z 72 klatek turntable | Model domu real-time (dollhouse per kondygnacja). |
| Spacer z panoram 360° | Spacer real-time (klik-i-idź), panoramy dopiero w P2. |
| Pasek kierunków „Wsch · Pd” | Bierzemy (P1). Wzmacnia przekaz „ogród od południa”. |
| Filtry (metraż, pokoje, piętro, cena) i status-taby | **Nie bierzemy.** 7 domów, decyzja klienta. |

## 2. Stack i zgodność (sprawdzone 28.10.2026)

| Pakiet | Wersja | Licencja | Peer | Status | Uwagi |
|---|---|---|---|---|---|
| `three` | 0.186.1 | MIT | — | **TERAZ** | Przypiąć dokładnie (`"three": "0.186.1"`). |
| `@react-three/fiber` | 9.8.2 | MIT | react/react-dom `>=19 <19.4` | **TERAZ** | React 19.3.1 OK. **Nie podbijać React do 19.4.** |
| `@react-three/drei` | 10.7.9 | MIT | react ^19, fiber ^9 | **TERAZ** | `CameraControls`, `Environment`/`Lightformer`, `Edges`, `Instances`, `Bvh`, `AccumulativeShadows`. |
| `camera-controls` | 3.1.2 | MIT | three >=0.126 | przez drei | Nie instalować osobno. Klasa jest reeksportowana jako `CameraControlsImpl`. |
| `@react-three/postprocessing` | 3.2.2 | MIT | fiber >=9.7, postprocessing ^6.36 | **TERAZ** | Ostatni efekt musi być `<ToneMapping>`, bo composer wymusza `NoToneMapping`. |
| `postprocessing` | 6.39.5 | Zlib | three `>=0.168 <0.187` | **TERAZ** | Blokuje three 0.187. v7 jest w becie (WebGPU). |
| `n8ao` | 2.0.1 | ISC* | postprocessing >=6.30 | przez r3f-pp | AO; na mobile `halfRes`. |
| `zustand` | 5.0.16 | MIT | react >=18 | **TERAZ** | Selektor zwracający obiekt lub tablicę wymaga `useShallow`. |
| `maath` | 0.10.8 | MIT | three | **TERAZ** (dopisać, jeśli importowany) | `easing.damp3` do rozsuwania pięter: sprężyna przerywalna, niezależna od FPS. |
| `react-zoom-pan-pinch` | 4.2.0 | MIT | react * | **NOWE, TERAZ** | Pinch, pan i zoom rzutu SVG/PNG na mobile, double-tap zoom. Wydanie 09.2026. |
| `@gltf-transform/cli` | 4.5.1 | MIT | — | **TERAZ (npx, build)** | `optimize --compress meshopt --texture-compress ktx2 --texture-size 1024 --join-named false --simplify false`. |
| `radix-ui` | 1.8.1 | MIT | react ^19 | opcja | Tylko jeśli potrzebny Tooltip/Dialog z a11y. Kickiego ma już własne kontrolki. |
| `yet-another-react-lightbox` | 3.32.2 | MIT | react ^19 | opcja | Gdy galeria Kickiego okaże się za mała (zoom, miniatury). |
| `@sparkjsdev/spark` | 2.4.0 | MIT | three >=0.180 | **PÓŹNIEJ (P2)** | Splaty: osiedle z drona, ewentualnie wnętrze pokazowe. |
| `three-gpu-pathtracer` | 0.0.27 | MIT | three >=0.185, three-mesh-bvh >=0.9.15 | **PÓŹNIEJ (P2)** | „Tryb foto” na `onRest`. `WebGLPathTracer` jest deprecated, rozwój idzie w stronę WebGPU. |
| `suncalc` | 2.1.1 | **brak pola `license` w npm** | — | **NIE DODAWAĆ** | Pozycje słońca są już policzone w `houses.json`. Runtime nie jest potrzebny, bo nie ma suwaka godziny. |
| `vaul` | 1.1.2 | MIT | react ^19 | **ODRADZAM** | Brak wydań od 12.2024. Kickiego ma własny `SheetHandle` (1:1 + rzut z prędkości). |
| `@use-gesture/react` | 10.3.1 | MIT | react >=16.8 | ODRADZAM | Brak wydań od 03.2024. Gesty na scenie obsługuje camera-controls, a sheet ma własne. |
| `r3f-perf` | 7.2.3 | — | drei ^9, zustand ~4.5 | ODRADZAM | Konflikt z r3f 9. Zamiast niego `<StatsGl>` z drei. |
| `@react-three/gpu-pathtracer`, `realism-effects`, `@mkkellogg/gaussian-splats-3d`, `marzipano`, `pannellum` | — | — | — | ODRADZAM | Uzasadnienie w researchu Kickiego (porzucone albo wypierane przez nowsze). |

\* licencja n8ao według repo; npm nie sprawdzałem.

### Next 16: na co uważać

- **Turbopack jest domyślny w `next dev` i `next build`.** Problem Kickiego z URL do WASM Sparka dotyczył Webpacka. Na Turbopacku nie powinien wystąpić; przy `--webpack` trzeba zastosować obejście z researchu Kickiego (`parser.javascript.url = false`). [Nie sprawdzałem na Next 16.]
- **Viewer jako `next/dynamic(..., { ssr: false })`** z wrappera `'use client'`. Chodzi wyłącznie o oddzielenie three od JS strony głównej. Na `/domy` chunk ładuje się od razu (a z home jest prefetchowany po hero), nigdy dopiero przy interakcji. Panel, lista i rzut 2D są SSR (LCP i SEO).
- **React Compiler** nie jest włączony w `next.config.ts`. Gdyby był włączany, sprawdzić explorer, bo `useFrame` mutuje refy i obiekty three w każdej klatce. [Nie sprawdzałem.]
- **`next/og` (Satori) nie czyta woff2.** Do obrazków OG potrzebny jest TTF Plus Jakarta Sans (OFL) w repo, tak jak Kickiego trzyma `Manrope-500.ttf`.
- Drugi serwer dev 3D: `NEXT_DIST_DIR=.next-3d next dev -p 3142` (`next.config.ts` już to obsługuje).

## 3. Funkcja → technika (dla domów)

| Funkcja | Technika | Biblioteka |
|---|---|---|
| Wejście: zdjęcie osiedla z klikalnymi domami | `<svg viewBox="0 0 1920 1248">` nad `<picture>` z poligonami senn. Kamera makiety dopasowana PnP (OpenCV `solvePnP`, offline, ≥ 8 punktów) albo z punktów zbiegu (Kickiego `PhotoEntry`). Przenikanie zdjęcie → 3D. | — (OpenCV w Pythonie tylko offline) |
| Makieta osiedla 3D | Bryły z danych (`pzt` + wymiary z rzutów, dach 2-spadowy). Drzewa przez `<Instances>`. `<Edges>` na krawędziach, `ContactShadows`. Glina + 3 kolory dachów. | drei |
| Rozdzielenie na piętra | Kondygnacja = `group`. Offset Y przez `easing.damp3` w `useFrame` (przerywalne), opacity wyższych pięter, `clippingPlanes` na +1,2 m dla dollhouse. Kamera: `fitToBox` przez camera-controls. Pamiętać o `invalidate()` przy `frameloop="demand"`. | maath, camera-controls |
| Rzut 2D | P0: PNG dewelopera + nakładka SVG z obszarami pokoi liczonymi z geometrii 3D (transformacja w [02 §3](02-materialy-3d.md#3-rzuty-skala-orientacja-transformacja)). P1: własny generator SVG ze ścian, otworów i stref (ten sam co minimapa). Zoom: `react-zoom-pan-pinch`. | react-zoom-pan-pinch |
| Spacer | Kickiego `Walk.tsx`: camera-controls w trybie FPS, klik-i-idź, `<Bvh firstHitOnly>`, hotspoty, punkty w danych. **Nowe:** przejście między kondygnacjami hotspotem „Schody” = `setLookAt` z przenikaniem (bez animacji wchodzenia po schodach), minimapa z przełącznikiem `P · 1`. | drei, camera-controls |
| Pora dnia | Wektory słońca z `houses.json → timeOfDay`, `<Sky>` lub HDRI per pora. Światła praktyczne (lampy, kule ogrodowe) zawsze w scenie, w dzień z natężeniem 0, żeby nie rekompilować shaderów (lekcja z Kickiego). | drei |
| Wystroje (3) | `MaterialsProvider` + `specs.ts` (sloty) i komplet mebli per styl. **Wszystkie 3 style są wczytane, wgrane na GPU i skompilowane w preloadzie**, więc przełączenie to tylko przenikanie przez `withDissolve`, bez sieci i kompilacji. | — |
| Preload z prawdziwym postępem | Manifest assetów z rozmiarami w bajtach (generowany skryptem przy buildzie) → postęp ważony bajtami. Potem wgrywanie tekstur porcjami (`SceneGate`/`loading.tsx` z Kickiego) i kompilacja wszystkich wariantów (`warmup.ts`, `gl.compileAsync` / `KHR_parallel_shader_compile`). Interakcja rusza po 100%. | — |
| Galeria | Kickiego `Gallery.tsx` (leniwy chunk) + chipsy. | (opcja: yet-another-react-lightbox) |
| Bottom sheet | Kickiego `SheetHandle.tsx`. | — |
| Deep link + OG | `app/domy/[dom]/opengraph-image.tsx`, `generateStaticParams` (a–g), `generateMetadata` z `searchParams` → still per widok (P1). | next/og |
| Splat osiedla (P2) | Dron (orbita i siatka nad osiedlem) → zdjęcia/wideo → COLMAP → trening 3DGS (Postshot, Brush, OpenSplat) → **WebODM 3.3 kafluje do formatu RAD Sparka (LoD)** → `SplatMesh` w r3f przez `extend()`. Kolizje i trafienia na bryłach z makiety. | @sparkjsdev/spark |
| Tryb foto (P2) | `WebGLPathTracer` na `onRest`, 300–500 próbek, tylko desktop, materiały wyłącznie Standard/Physical. | three-gpu-pathtracer |

## 4. Splat prawdziwego osiedla: dlaczego warto (P2)

- **Wiarygodność.** To jedyna technika, która pokazuje **prawdziwe** osiedle i jego otoczenie, bez renderów-obietnic. Makieta może zostać jako „tryb plan”.
- **Precedens rynkowy:**
  - Zillow SkyTour (pierwsza duża platforma ze splatami z drona);
  - Apartments.com (przeloty dronem nad kompleksami).
- **Pipeline open source:** WebODM 3.3 dodał eksport zestawów COLMAP do OpenSplat/Brush i kafelkowanie splatów do RAD (strumieniowany LoD Sparka).
- **Ryzyka:**
  - dziś osiedle to plac budowy (piasek, ogrodzenie z blachy), więc lot ma sens po zagospodarowaniu terenu;
  - lot w terenie zabudowanym wymaga operatora z uprawnieniami (kategoria otwarta lub szczególna EASA) [szczegóły prawne niezweryfikowane];
  - waga: Spark domyślnie strumieniuje LoD w trakcie oglądania, a to łamie zasadę „wszystko z góry”. Trzeba więc przed startem wczytać cały poziom LoD potrzebny dla kadrów makiety i zmieścić go w budżecie preloadu albo zrezygnować.

## 5. Pipeline assetów (skrót, szczegóły w researchu Kickiego)

1. **Meble i dekoracje:**
   - CC0 z Poly Haven (`api.polyhaven.com/assets?t=models&c=furniture`) i ambientCG;
   - braki z Meshy/Tripo **w planie płatnym** (prawa komercyjne).
2. **Optymalizacja:** `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress ktx2 --texture-size 1024 --join-named false --simplify false` (wymaga `ktx` ≥ 4.4.0 w PATH).
3. **KTX2 w drei:** `useGLTF(url, false, true, l => l.setKTX2Loader(ktx2))` z własnym `setTranscoderPath('/basis/')`. Domyślny transcoder idzie z gałęzi master na jsDelivr, więc nie używać.
4. **HDRI:** hostować samemu (Poly Haven 1k). Nie używać `preset` w `<Environment>`, bo ściąga pliki z githack.
5. **Budżet** (decyzja usera: pełny preload przed interakcją, [01 §10](01-ux-podstrona.md#10-ładowanie-wszystko-z-góry-potem-zero-przycięć)):
   - pobranie ≤ ok. 25 MB na desktopie i ≤ ok. 15 MB na mobile;
   - GPU ≤ ok. 150 MB na mobile;
   - tekstury 1K (na mobile 512–1K);
   - ≤ ok. 150 draw calli na mobile;
   - DPR ≤ 1,5 na mobile.

   Gdy budżet nie wystarcza, wycinamy assety. Nie ładujemy ich w trakcie.

## Źródła

- npm registry (`npm view <pakiet> version license peerDependencies time`), 28.10.2026.
- Research Kickiego 27: `demo_Dominik/docs/3d-research.md` (NoHo One: `noho-one.com/en/apartments/` → iframe `allinone.prod.resimo.io`, Babylon.js 7.11.2, sekwencje klatek, `scene8.glb`).
- Next.js 16, Turbopack jako domyślny bundler: [heise.de](https://heise.de/-10794114), [nextjs.org/blog/next-16-3-turbopack](https://nextjs.org/blog/next-16-3-turbopack)
- Splaty w nieruchomościach: [Zillow SkyTour (LiDAR News)](https://lidarnews.com/zillow-3d-tours-with-gaussian-splatting/), [Apartments.com (Radiance Fields)](https://radiancefields.com/apartments-com-unveils-matterport-3d-exterior), [WebODM 3.3 + Spark RAD](https://radiancefields.com/webodm-3-3-0-brings-gaussian-splatting-to-open-source-drone-mapping), [Spark](https://radiancefields.com/platforms/spark), [Spark 2.0 (World Labs)](https://www.worldlabs.ai/blog/spark-2.0?hl=en-US)
- Lokalizacja: OSM Nominatim (ul. Borków 24B → 52,18928 N, 21,14675 E), Overpass (boisko `way 273248444`).
