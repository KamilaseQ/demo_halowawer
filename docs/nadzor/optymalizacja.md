# Optymalizacja ładowania i płynności (głównie 3D)

Autor: sesja `demo-halowawer-d0`. Zadanie od użytkownika i recenzenta `cb` z 29.10.2026: wyraźna poprawa płynności i szybkości, bez walki o 0,5%.

**Zasady:**
- zero zmian wyglądu (zrzut przed i po z tej samej kamery, różnica pikseli);
- nadal „wszystko z góry, potem zero przycięć”;
- jedna zmiana na iterację, potem tsc, eslint, build i pomiar;
- zostaje tylko wyraźna poprawa (≥ ok. 10% albo zniknięcie zadania blokującego > 100 ms).

**Metoda:**
- build prod aktualnego drzewa (`NEXT_DIST_DIR=.next-opt`), `next start -p 3150`;
- systemowy Chrome headless z GPU: **Intel Arc (iGPU), ANGLE D3D11**;
- zimny cache, 2–3 przebiegi, mediana;
- desktop 1440×900 DPR 1;
- mobile 390×844 DPR 3 (tier „lite”), 4× CPU, Fast 4G;
- obciążenie CPU maszyny 30–45% (równolegle działają sesje innego projektu), więc pojedyncze przebiegi są zaszumione.

Narzędzia w `docs/explorer/tools/`:
- `_load.mjs`: ładowanie, czyli czas do `ready`, MB, długie zadania i najdłuższa blokada rAF;
- `_smooth.mjs`: interakcje bez limitu fps;
- `_shadercost.mjs`: koszt kompilacji każdego programu;
- `_newprogs.mjs`: programy kompilowane po załadowaniu;
- `_vshot.mjs` i `_vdiff.mjs`: zrzuty i różnica pikseli;
- `bake-pmrem.mjs`: wypiekanie IBL.

## Diagnoza (stan wyjściowy)

1. **Ładowanie 3D blokuje kompilacja shaderów, nie sieć.** „Bezczynne 11 s” to czas, w którym proces GPU kompiluje, a rAF czeka 4–6,7 s. Koszt kompilacji na tym GPU:
   - `PMREMGGXConvolution`: **2,4 s**. To filtr HDRI liczony w przeglądarce przy każdej wizycie, z pętlą 256 próbek rozwijaną przez kompilator D3D;
   - 12 materiałów: 0,25–1,1 s każdy;
   - postprocessing: ok. 1,2 s, synchronicznie w pierwszych klatkach.
2. **Przycięcia po załadowaniu:**
   - `QualityGovernor` przełącza post na „low” w trakcie orbity. Kompiluje się wtedy 6 shaderów (zamrożenie ok. 1 s) i widać zmianę AO/MSAA;
   - `Prefetch` wnętrz wgrywa tekstury w czasie orbity nad osiedlem (zadania do 0,85–2,3 s);
   - zmiana stylu dokompilowuje 1 shader cienia.
3. **Koszt klatki:**
   - osiedle ok. 12 ms, z czego drzewa 2,7 ms (2,3 mln trójkątów, bez cullingu);
   - dom ok. 20 ms, z czego połowa to wypełnianie pikseli.
4. **Start:** testowy kontekst WebGL w `Explorer` blokuje na 0,8 s i nie jest zwalniany.

## Wyniki bazowe

| Trasa | Profil | Gotowość (mediana) | Najdłuższe zadanie | Najdłuższa blokada rAF | Pobrane do gotowości |
|---|---|---|---|---|---|
| /domy | desktop | 11,1 s (10,5–16,3) | 0,66–1,06 s | 6,2–6,7 s | 6,9 MB |
| /domy/a | desktop | 13,0 s (12,2–18,5) | 0,8–1,7 s | 4,9–5,7 s | 16,0 MB |
| /domy | mobile | 35–45 s | **23–29 s** | 22–28 s | 6,7 MB |
| /domy/a | mobile | 40–57 s | 3,5–27,6 s | 17–27 s | 8,2 MB |

## Iteracje

| # | Zmiana | Metryka przed → po | Wygląd | Decyzja |
|---|---|---|---|---|
| 1 | **Wypieczony PMREM (IBL).** Odczyt z żywego renderera (`bake-pmrem.mjs`) do `zawiszy_czarnego_512.pmrem.bin`. Format: half float, płaszczyzny bajtów, gzip, 558 KB zamiast HDR 524 KB. Ładowanie przez `DecompressionStream` jako gotowa tekstura CubeUV (`Lighting.tsx`), z fallbackiem na HDR. | /domy desktop: 11,1 → **4,8 s**; blokada rAF 6,5 → 2,7 s. /domy/a desktop: 13,0 → 11,1 s (duży rozrzut). /domy mobile: 35–45 → 19–29 s. | dom: identyczny (różnica 0); osiedle: identyczne, a różnice tylko na krawędziach przez kadr intro | zostawiona |
| 2 | **Wypieczone canvasy gruntu.** Trawniki, rabaty i cień kontaktowy w `estate/ground.ts`. Ich software'owy blur 2048×1024 kosztował ok. 2,1 s wątku głównego na desktopie i 8,5 + 1,1 s na mobile (`FinalizeFrame`). Teraz bezstratny WebP: `estate-near.webp` 281 KB i `estate-ao.webp` 56 KB, dekodowany poza wątkiem głównym. Narzędzie: `bake-ground.mjs`; `?paintground` maluje na żywo do ponownego wypieku. | /domy desktop: 4,8 → **1,6 s** (blokada rAF 0,1–0,45 s). /domy/a desktop: 11,1 → **3,8 s**. /domy mobile: 19–29 → **≈10 s**, najdłuższe zadanie 23 s → 0,8 s. | osiedle dzień vs baza: **różnica 0**; dom: 0 | zostawiona |

| 3 | **`QualityGovernor` nie przełącza jakości w trakcie gestu.** Decyzja zapada jak dotąd (mediana klatki > 25 ms), ale samo przełączenie czeka, aż kamera stoi (0,4 s bez klatek, nic nie jest wciśnięte), i idzie pod dissolve. Jakość jest w store (`postQuality`) i w kluczu bramki sceny, więc wszystkie 6 shaderów postprocessingu kompiluje się w klatkach pod zasłoną. | Wcześniej: zamrożenie ok. 1 s w połowie orbity domu i widoczny skok AO/MSAA. Teraz: przełączenie między gestami, pod zamrożoną klatką z płynnym przejściem (`_gov.mjs`: wszystkie linkowania pod zasłoną, w spoczynku zadania > 300 ms tylko pod zasłoną). | bez zmian (przełącza się tylko na słabym GPU) | zostawiona |
| 4 | **Prefetch wnętrz w tle osiedla** wysyła każdą teksturę na GPU dopiero, gdy scena stoi (0,5 s bez klatek, nic nie jest wciśnięte). Usunięte też 8 nieużywanych GLB z listy prefetchu strony głównej (−4,4 MB pobierania na home). | Orbita osiedla zaraz po załadowaniu: zadania > 100 ms 26/34 → 23/12, najdłuższe 0,56/1,43 → 0,40/0,52 s, suma 9,0/11,7 → 7,4/6,2 s (`_estorbit.mjs`) | bez zmian | zostawiona |
| – | **N8AO `transparencyAware` off** (sprawdzone, NIE wprowadzone). N8AO wykrywa przezroczyste materiały i co klatkę renderuje scenę 2× więcej. | Klatka domu 27–29 → 16–19 ms (−35%), osiedla ok. −25% | **zmienia wygląd**: 2,4% pikseli w domu (okna, ogrodzenia) | odrzucona (zasada „zero zmian wyglądu”); możliwa decyzja klienta |

**Bilans (desktop: Intel Arc iGPU, Windows; mobile: emulacja 4× CPU + Fast 4G):**

| Trasa | Przed | Po | Uwagi |
|---|---|---|---|
| /domy desktop | 11,1 s | **1,6–1,8 s** (−85%) | stabilne |
| /domy/a desktop | 13,0 s | **3,8 s** przy obciążeniu CPU ok. 30%; 7–12 s przy 50–80% | Kompilacja shaderów domu zależy od wolnego CPU, a równolegle działały sesje innego projektu. |
| /domy mobile | 35–45 s | **≈ 10 s** (−75%) | najdłuższe zadanie 23 s → 0,8 s |
| Strona główna | – | −4,4 MB prefetchu | nieużywane modele |

Wygląd: zrzuty końcowe vs baza (osiedle dzień, dom, dom parter) dają średnią różnicę 0. Pojedyncze piksele różnią się tylko przez animowane detale.

## Uwagi do wdrożenia na Vercel

- `next.config.ts` daje `/explorer/**` nagłówek `immutable` na rok. **Zmieniony plik musi dostać nową nazwę**, inaczej powracający goście zobaczą starą wersję. Dotyczy to także ponownego wypieku: `bake-pmrem.mjs` i `bake-ground.mjs` nadpisują te same nazwy, więc po rebake trzeba zmienić nazwę i ścieżkę w kodzie.
- Plik PMREM (`.bin`) jest skompresowany w środku (gzip + `DecompressionStream`), więc nie zależy od tego, czy CDN kompresuje `application/octet-stream`.
- Zdjęcie wejściowe /domy idzie przez `/_next/image` (AVIF/WebP). Pierwsze żądanie po wdrożeniu koduje obraz na żądanie, a kolejne biorą go z cache CDN.

## Zakończenie (29.10, ok. 08:40)

Na polecenie użytkownika („kończcie, tak jak jest jest okej”) praca jest zakończona bez kolejnych ulepszeń. Stan końcowy:
- tsc 0 błędów;
- `npx eslint src` 0 błędów;
- build prod przechodzi.

Niezrobione, dla ewentualnej kolejnej rundy:
- testowy kontekst WebGL w `Explorer.webglAvailable()` (0,8 s na starcie);
- ujednolicenie materiałów mebli, czyli mniej programów do kompilacji w domu;
- drzewa w sektorach (frustum culling);
- decyzja klienta w sprawie N8AO `transparencyAware`.

**Do sprawdzenia przez agenta 3D:** po zmianie stylu bezpośrednio przez store (bez dissolve) i po orbicie raz pojawił się błąd `Cannot read properties of undefined (reading 'wallCut')`. Nie potwierdziłem go przez UI.
