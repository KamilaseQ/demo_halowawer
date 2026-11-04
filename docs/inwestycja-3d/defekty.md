# Rejestr defektów /domy (BOR2)

Prowadzi audytor (e3). Źródło: [defekty.json](defekty.json), ten plik generuje `audyt/rejestr.py`. Status „zamknięty” nadaje tylko audytor po ponownym sweepie.

**Otwarte: 19 z 21.** Wg poziomu: L0 1, L1 3, L2 6, L2/L3 1, L3 2, L4 5, L5 1. Wg właściciela: 55 3, 55 (decyzja b6) 1, 55 + rośliny 1, 59 8, 59 + 55 3, 59 + rośliny 2, rośliny + 55 1.

## Iteracje

| sweep | data | stan sceny | wzorzec | pozy | arkusze | scorecard ΔE (L2) |
|---|---|---|---|---|---|---|
| sweep-01 | 2026-11-04 | runtime :3142 dev, zewnętrze v5 (public/explorer/3d/bor2/zewnetrze-v5.glb), nasadzenia bor2-planting | Blender Workbench z bor2-zewnetrze-v5.glb (tryb materiałów; zbliżenia także tryb tekstur) | `audyt/sweep-01/pozy.json (97: 80 wokół 7 domów + 17 punktów spaceru)` | `audyt/sweep-01/arkusze/` | assets/bor2/scorecard/wynik-domy-v5.md: 13/57 regionów w progu (23%), średnie ΔE76 22,9 (iteracja 0 na v4: 14/57, 23,1). |
| petla-02 | 2026-11-04 | runtime :3142, zewnętrze v6 + okolica-v1, grunt/las/drzewa (55) | rendery dewelopera (scorecard) | `assets/bor2/ujecia-porownawcze.json` | `assets/bor2/scorecard/iteracje/02/arkusz.jpg` | 10/57 (18%), średnie ΔE76 24,0; 4 regresje > 3 (zieleń vis-1 6→32, vis-2 12→37; widok za oknem int-10 14→19, int-6 27→30) |
| petla-03 | 2026-11-04 | runtime :3142 — wnętrze B v1 + okolica-v1 | rendery dewelopera (scorecard) + elewacje z bliska + grunt | `assets/bor2/ujecia-porownawcze.json, audyt/elewacje-pozy.json, audyt/grunt-petla.json` | `assets/bor2/scorecard/iteracje/03/` | 17/73 (23%), 20,2 |
| petla-04 | 2026-11-04 | runtime :3142 — fix 55: ścieżka OSM, jaśniejsze duchy; v7, wnętrza G v1 i B v1 | rendery dewelopera (scorecard) + elewacje z bliska + grunt | `assets/bor2/ujecia-porownawcze.json, audyt/elewacje-pozy.json, audyt/grunt-petla.json` | `assets/bor2/scorecard/iteracje/04/` | 19/73 (26%), 19,5 |
| petla-05 | 2026-11-04 | runtime :3142 — v8 (pręty, kolory per dom, płyty tarasów), A2C tylko z MSAA, duchy #bdbcb7 | rendery dewelopera (scorecard) + elewacje z bliska + grunt | `assets/bor2/ujecia-porownawcze.json, audyt/elewacje-pozy.json, audyt/grunt-petla.json` | `assets/bor2/scorecard/iteracje/05/` | 19/73 (26%), 19,6 |
| petla-06 | 2026-11-04 | runtime :3142 — v9 (tynk PBR — wadliwy, D-021), rośliny v3, wnętrza v2 G/B | rendery dewelopera (scorecard) + elewacje z bliska + grunt | `assets/bor2/ujecia-porownawcze.json, audyt/elewacje-pozy.json, audyt/grunt-petla.json` | `assets/bor2/scorecard/iteracje/06/` | 20/74 (27%), 19,8; 19 regresji (tynk v9), 25 popraw |

## Lista

| ID | poziom | miejsce | opis | właściciel | status |
|---|---|---|---|---|---|
| [D-001](#d-001) | L2 | Wszystkie płoty panelowe (ulica i ogrody). Przykłady: A-N-oko, A-SE-oko, B-N-oko,… | Przęsła płotu renderowane jako tekstura prętów: pręty widać podwójnie (z obu ścian cienkiego przęsła), migoczą przy ruchu i mają… | 59 + 55 | zastąpiony przez D-015 |
| [D-002](#d-002) | L2 | Płot boczny na zachód od domu G (G-W-oko); możliwe inne przęsła obrócone o 90°. | Pręty płotu poziome zamiast pionowych. | 59 | do weryfikacji |
| [D-003](#d-003) | L2/L3 | Wnęki wejściowe i garażowe wszystkich domów; najwyraźniej A (szałwiowa wnęka +… | Na vis-3 cała wnęka (wejściowa i garażowa) jest monochromatycznym „blokiem wejścia” w kolorze stolarki danego domu: taupe →… | 59 + 55 | do weryfikacji |
| [D-004](#d-004) | L2 | Podjazdy przed garażami A, B, C, D oraz utwardzenie przed garażem G (A-front-blisko,… | Przed bramami garażowymi runtime pokazuje trawę z mchem — auto stałoby na trawniku. W modelu (Workbench, tekstury) i na vis-3… | 59 + 55 | do weryfikacji |
| [D-005](#d-005) | L2 | Wszystkie miejsca postojowe z geokratą (ZIEMIA_5), np. A-NE-oko, C-E-oko. | Oczka geokraty mają ok. 40 cm, płaskie żebra bez reliefu i bez trawy w oczkach. W teksturze modelu (bor2-geokrata) oczka mają ok.… | 55 | nowy |
| [D-006](#d-006) | L1 | Całe zewnętrze (GLB v5): krawędzie geokraty, krawężniki, styki płaszczyzn. | Białe linie na krawędziach geokraty i krawężników, z-fighting na stykach. | 59 | do weryfikacji |
| [D-007](#d-007) | L2 | Boki podestów z kostki przed wnękami wejściowymi (szereg E/F/G na zrzucie klienta),… | Na zrzucie klienta (v4) pionowe lica podestów z kostki mają teksturę rozciągniętą w pionowe smugi. W v5 (kadr odtworzony) smugi… | 59 | do weryfikacji |
| [D-008](#d-008) | L4 | Drzewo 1–2 m od szczytu wschodniego A (A-E-oko, A-E-gora); podobnie przy E od wschodu… | Drzewa z warstwy nasadzeń stoją tuż przy elewacjach: pień zasłania okna szczytu A, korona wchodzi na dach. W modelu architekta… | 59 | do weryfikacji |
| [D-009](#d-009) | L0 | OGRODZENIA_6 (materiał „OKNA B”, 298 tr.) i OGRODZENIA_9 (materiał „A03_Pink_Ember”, 490… | W grupie ogrodzeń są elementy z materiałem okien i z różowym materiałem domyślnym SketchUpa — nie wiadomo, co to za geometria. | 59 | do weryfikacji |
| [D-010](#d-010) | L5 | zielen: bor2-planting (28 siatek). | Zieleń ma 2,25 mln trójkątów (drzewa estate-trees po 100–300 tys. trójkątów na grupę instancji; kępy traw 159 tys. × 2043… | rośliny + 55 | nowy |
| [D-011](#d-011) | L2 | Wnęka wejściowa F (szereg, od ulicy) — zrzut klienta. | Cienka czarna pozioma belka na tylnej ścianie szerokiej wnęki F (v4). | 59 | zamknięty |
| [D-012](#d-012) | L4 | Korony drzew z nasadzeń (estate-trees), też płot (D-001) — np. drzewo przed szeregiem w… | Liście i gałązki mają jasną, prawie białą obwódkę na brzegach — drzewa wyglądają jak wycięte z papieru. | 55 + rośliny | do weryfikacji |
| [D-013](#d-013) | L1 | DOM_G, ściana wschodnia parteru = ściana wspólna z F (x = 40,70–40,97 m; SKP y… | W ścianie międzysegmentowej G/F są dwa okna parteru ~1,0 × 2,2 m (ramy, szyby, ościeża), parapety wystają ~25 cm w stronę F. Z… | 59 | nowy |
| [D-014](#d-014) | L1 | DOM_G, wnęka wejściowa od ulicy (SKP y ≈ 58,6, x 34,5–38,7). | W bryle G wnęka ma płaski panel 4,2 × 2,2 m wyglądający jak brama garażowa (plus osobne drzwi). Werdykt: to NIE jest garaż — na… | 59 | nowy |
| [D-015](#d-015) | L2 | Wszystkie przęsła płotu (OGRODZENIA_10, materiał OGRODZENIE_PRETY, 51 496 trójkątów, v8);… | Płot jako geometria prętów daje mory: koncentryczne łuki czarnych kresek „leżące” na trawie i geokracie, migoczące przy ruchu.… | 59 + 55 | nowy |
| [D-016](#d-016) | L3 | src/components/explorer/three/Effects.tsx:47 (EffectComposer multisampling = low ? 0 :… | W jakości „low” (urządzenia lite albo po obniżeniu przez governor — na przeciętnym GPU z 2,25 mln trójkątów zieleni bardzo… | 55 | do weryfikacji |
| [D-017](#d-017) | L4 | Pas rabat wzdłuż płotów ogrodów i ulicy (bor2-tufts, 2043 instancje; bor2-shrubs). | Kępy traw stoją w równych rzędach w stałych odstępach, wszystkie podobnej wielkości i orientacji — wygląda jak szkółka. Na… | 59 + rośliny | do weryfikacji |
| [D-018](#d-018) | L4 | Budynki okolicy (okolica-v1, „duchy”) za szeregiem G/F/E i za bliźniakami. | Duchy są białe, jaśniejsze od elewacji osiedla — przyciągają wzrok i spłaszczają głębię (na renderach okolica jest stonowana,… | 55 (decyzja b6) | w toku |
| [D-019](#d-019) | L3 | Pora „Rano”: niebo i ogólna tonacja. | Kadr klienta odpowiada porze Rano: niebo beżowo-szare, elewacje chłodnoszare, płaskie. Na renderach dziennych niebo jest czystym… | 55 | nowy |
| [D-020](#d-020) | L4 | Drzewo w ogrodzie przed elewacją ogrodową A (kadr visualization-1). | W v8/roślinach drzewo przed A ma gęstą, ciemną koronę i zasłania pół elewacji ogrodowej A z punktu widzenia vis-1 (region pomiaru… | 59 + rośliny | nowy |
| [D-021](#d-021) | L2 | Materiały tynku wszystkich domów (TYNK A/B/C, A_SZCZYT), tekstura TYNK_DETAL_NORMAL w… | Elewacje ciemne i szare jak beton (vis-1 ściana B w słońcu L* 82 → 51, fronty szeregu 43 → 20); zależnie od orientacji UV jedne… | 59 | w toku |

## Szczegóły

### D-001

- **Poziom:** L2 · **Status:** zastąpiony przez D-015 · **Właściciel:** 59 + 55 · **Źródło:** klient (zrzut frontu) + sweep-01
- **Miejsce:** Wszystkie płoty panelowe (ulica i ogrody). Przykłady: A-N-oko, A-SE-oko, B-N-oko, C-NE-oko.
- **Opis:** Przęsła płotu renderowane jako tekstura prętów: pręty widać podwójnie (z obu ścian cienkiego przęsła), migoczą przy ruchu i mają jasną obwódkę.
- **Przyczyna:** OGRODZENIA_1 w GLB ma materiał zastępczy SketchUpa „[Translucent Glass Gray]” (przęsło = cienka bryła z dwoma licami). Runtime nakłada na niego teksturę prętów z alfą na obu licach; jasna obwódka = brzegi alfy bez premultiplikacji/dylatacji, migotanie = alpha test bez alpha-to-coverage.
- **Propozycja:** 59: zastąpić materiał zastępczy własnym „OGRODZENIE_PANEL” z jednym licem (albo geometrią prętów 3D, płot 3D jak na vis-3) i UV w pionie. 55: alpha-to-coverage przy MSAA albo pręty jako geometria, tekstura z dylatacją kolorów pod alfą, antracyt (L* ≈ 25) jak na renderach.
- **Dowód przed:** [D-001-plot-ukrycie-OGRODZENIA_1.jpg](audyt/sweep-01/dowody/D-001-plot-ukrycie-OGRODZENIA_1.jpg)
- **Dowód po:** —

### D-002

- **Poziom:** L2 · **Status:** do weryfikacji · **Właściciel:** 59 · **Źródło:** sweep-01
- **Miejsce:** Płot boczny na zachód od domu G (G-W-oko); możliwe inne przęsła obrócone o 90°.
- **Opis:** Pręty płotu poziome zamiast pionowych.
- **Przyczyna:** UV przęsła obrócone o 90° względem pozostałych (ten sam materiał co D-001).
- **Propozycja:** Ujednolicić UV przęseł (U wzdłuż przęsła, V w pionie) przy naprawie D-001; test: wszystkie przęsła z pionowymi prętami w sweepie.
- **Dowód przed:** [D-002-plot-G-poziome-prety.jpg](audyt/sweep-01/dowody/D-002-plot-G-poziome-prety.jpg)
- **Dowód po:** —

### D-003

- **Poziom:** L2/L3 · **Status:** do weryfikacji · **Właściciel:** 59 + 55 · **Źródło:** klient („żółte ościeża”) + sweep-01; rozstrzygnięcie b6 wg vis-3
- **Miejsce:** Wnęki wejściowe i garażowe wszystkich domów; najwyraźniej A (szałwiowa wnęka + ciemnozielone drzwi) i C (brąz renderowany jako czerwień).
- **Opis:** Na vis-3 cała wnęka (wejściowa i garażowa) jest monochromatycznym „blokiem wejścia” w kolorze stolarki danego domu: taupe → brązowa wnęka i brązowe drzwi, jasny → szałwiowa wnęka i szałwiowe drzwi. W runtime: (a) A ma wnękę szałwiową i drzwi ciemnozielone (kontrastu nie ma na renderach), (b) szałwia wychodzi jako ochra/oliwka, a brąz C jako czerwień (#3a1a14 wobec ok. #5a4641 na renderze); sufit wnęki ma ciemnoochrowy pas.
- **Przyczyna:** (a) różne materiały drzwi/bramy/wnęki w GLB (TYNK A2, OKNA A…), (b) światło: wnęka w cieniu bez odbitego światła przesuwa odcień (L3).
- **Propozycja:** 59: jeden ton per dom dla drzwi, bramy, ościeży i sufitu wnęki wg vis-3. 55 (L3): fill/odbite światło we wnękach, tak żeby szałwia nie przechodziła w ochrę, a brąz w czerwień; kontrola ΔE w scorecardzie (brama vis-3).
- **Dowód przed:** [D-003-D-004-D-005-fronty.jpg](audyt/sweep-01/dowody/D-003-D-004-D-005-fronty.jpg)
- **Dowód po:** —

### D-004

- **Poziom:** L2 · **Status:** do weryfikacji · **Właściciel:** 59 + 55 · **Źródło:** sweep-01
- **Miejsce:** Podjazdy przed garażami A, B, C, D oraz utwardzenie przed garażem G (A-front-blisko, B-front-blisko, C-front-blisko, G-N-gora).
- **Opis:** Przed bramami garażowymi runtime pokazuje trawę z mchem — auto stałoby na trawniku. W modelu (Workbench, tekstury) i na vis-3 jest tam jasne utwardzenie.
- **Przyczyna:** Powierzchnie mają nieprzypisany materiał SketchUpa „SKP Default” (ZIEMIA_2); shader gruntu w runtime traktuje nieznany materiał jak trawnik.
- **Propozycja:** 59: przypisać podjazdom kostkę/beton (osobny materiał „podjazd”, jasny jak na vis-3). 55: nieznany materiał gruntu nie może spadać na trawę — błąd w konsoli i kolor kontrolny (test regresji L0).
- **Dowód przed:** [D-003-D-004-D-005-fronty.jpg](audyt/sweep-01/dowody/D-003-D-004-D-005-fronty.jpg)
- **Dowód po:** —

### D-005

- **Poziom:** L2 · **Status:** nowy · **Właściciel:** 55 · **Źródło:** klient („za duża i płaska geokrata”) + sweep-01
- **Miejsce:** Wszystkie miejsca postojowe z geokratą (ZIEMIA_5), np. A-NE-oko, C-E-oko.
- **Opis:** Oczka geokraty mają ok. 40 cm, płaskie żebra bez reliefu i bez trawy w oczkach. W teksturze modelu (bor2-geokrata) oczka mają ok. 10 cm, wzór ażurowy.
- **Przyczyna:** Skala UV/kafla w shaderze gruntu runtime ok. 4× za duża; brak normal mapy i trawy w oczkach.
- **Propozycja:** 55: skala jak tekstura SKP (płyta ażurowa 60 × 40 cm, 8–10 oczek), normal/parallax żeber, trawa w oczkach (maska) — jak geokrata na zdjęciach referencyjnych płyt ażurowych.
- **Dowód przed:** [D-003-D-004-D-005-fronty.jpg](audyt/sweep-01/dowody/D-003-D-004-D-005-fronty.jpg)
- **Dowód po:** —

### D-006

- **Poziom:** L1 · **Status:** do weryfikacji · **Właściciel:** 59 · **Źródło:** b6
- **Miejsce:** Całe zewnętrze (GLB v5): krawędzie geokraty, krawężniki, styki płaszczyzn.
- **Opis:** Białe linie na krawędziach geokraty i krawężników, z-fighting na stykach.
- **Przyczyna:** Kwantyzacja pozycji w GLB zewnętrza (krok 1/16 m, ±3,1 cm) — sąsiednie płaszczyzny rozjeżdżają się lub nachodzą.
- **Propozycja:** 59: v6 bez kwantyzacji pozycji (albo z krokiem ≤ 1 mm). Audytor: sweep po v6 — zbliżenia krawężników i krawędzi geokraty.
- **Dowód przed:** —
- **Dowód po:** —

### D-007

- **Poziom:** L2 · **Status:** do weryfikacji · **Właściciel:** 59 · **Źródło:** klient (zrzut frontu: boki podestów wejściowych)
- **Miejsce:** Boki podestów z kostki przed wnękami wejściowymi (szereg E/F/G na zrzucie klienta), prawdopodobnie też przy A–D; sprawdzić także boki płyt tarasów od ogrodu.
- **Opis:** Na zrzucie klienta (v4) pionowe lica podestów z kostki mają teksturę rozciągniętą w pionowe smugi. W v5 (kadr odtworzony) smugi są słabsze, ale na krawędzi podestu widać białą przerywaną linię (zob. D-006).
- **Przyczyna:** UV boków podestu zrzutowane z góry (planar Y) — na licach pionowych tekstura rozciąga się w pionie.
- **Propozycja:** 59: box mapping UV boków podestów i płyt tarasów (gęstość tekseli jak na blacie). Audytor: zbliżenie 1 m od krawędzi w sweep-02.
- **Dowód przed:** [klient-front-v4.jpg](audyt/sweep-01/dowody/klient-front-v4.jpg), [D-011-klient-v4-vs-v5.jpg](audyt/sweep-01/dowody/D-011-klient-v4-vs-v5.jpg), [D-007-taras-A.jpg](audyt/sweep-01/dowody/D-007-taras-A.jpg)
- **Dowód po:** —

### D-008

- **Poziom:** L4 · **Status:** do weryfikacji · **Właściciel:** 59 · **Źródło:** sweep-01
- **Miejsce:** Drzewo 1–2 m od szczytu wschodniego A (A-E-oko, A-E-gora); podobnie przy E od wschodu (E-E-oko), przy C od SE (C-SE-oko), przy G od SW (G-SW-gora).
- **Opis:** Drzewa z warstwy nasadzeń stoją tuż przy elewacjach: pień zasłania okna szczytu A, korona wchodzi na dach. W modelu architekta drzew w tych miejscach nie ma.
- **Przyczyna:** Znaczniki DRZEWO_ w ZIELEN_ZNACZNIKI rozstawia generator wyglad_zielen.py (59) bez strefy wykluczenia przy elewacjach.
- **Propozycja:** 59 (wyglad_zielen.py): minimalna odległość od elewacji ≥ 4 m dla drzew i ≥ 1 m dla krzewów, bez drzew w przejściach między grupami; test regresji: odległość znaczników od bbox DOM_*.
- **Dowód przed:** [D-008-drzewo-przy-A.jpg](audyt/sweep-01/dowody/D-008-drzewo-przy-A.jpg)
- **Dowód po:** —

### D-009

- **Poziom:** L0 · **Status:** do weryfikacji · **Właściciel:** 59 · **Źródło:** sweep-01 (inwentarz)
- **Miejsce:** OGRODZENIA_6 (materiał „OKNA B”, 298 tr.) i OGRODZENIA_9 (materiał „A03_Pink_Ember”, 490 tr.), pas frontów od ulicy (runtime x 0–67, z −1…12).
- **Opis:** W grupie ogrodzeń są elementy z materiałem okien i z różowym materiałem domyślnym SketchUpa — nie wiadomo, co to za geometria.
- **Przyczyna:** Wg 59: OGRODZENIA_9 = 7 słupków oświetleniowych (komponent SKP „lampa”), materiał przemianowany na LATARNIA (#3a3a3a); OGRODZENIA_6 = głowice latarni i 4 skrzynki elektryczne przy furtkach — materiał zgodny z modelem, nic do usunięcia.
- **Propozycja:** 59: zidentyfikować obiekty, nadać właściwe materiały albo usunąć pozostałości; wynik wpisać tutaj.
- **Dowód przed:** [inwentarz-runtime.json](audyt/sweep-01/inwentarz-runtime.json)
- **Dowód po:** —

### D-010

- **Poziom:** L5 · **Status:** nowy · **Właściciel:** rośliny + 55 · **Źródło:** sweep-01 (inwentarz)
- **Miejsce:** zielen: bor2-planting (28 siatek).
- **Opis:** Zieleń ma 2,25 mln trójkątów (drzewa estate-trees po 100–300 tys. trójkątów na grupę instancji; kępy traw 159 tys. × 2043 instancje). Budynki BOR2 mają łącznie ok. 25 tys.
- **Przyczyna:** Pełne modele drzew także w dalszym planie, bez LOD/impostorów.
- **Propozycja:** Rośliny + 55: zestaw roślin z kart i okolica.glb zamiast pierścienia EZ-Tree (L0 u 55); audytor sprawdza liczby trójkątów w inwentarzu sweep-02.
- **Dowód przed:** [inwentarz-runtime.json](audyt/sweep-01/inwentarz-runtime.json)
- **Dowód po:** —

### D-011

- **Poziom:** L2 · **Status:** zamknięty · **Właściciel:** 59 · **Źródło:** klient (zrzut frontu, v4)
- **Miejsce:** Wnęka wejściowa F (szereg, od ulicy) — zrzut klienta.
- **Opis:** Cienka czarna pozioma belka na tylnej ścianie szerokiej wnęki F (v4).
- **Przyczyna:** Nadproże drzwi F wystające przez tylną ścianę wnęki, gdy same drzwi były zakryte (v4) — wg 59.
- **Propozycja:** Naprawione w v5 (drzwi i okienko F). Weryfikacja audytora: kadr klienta odtworzony na v5 przez setCamera (pozycja GLB [37,5; 2,7; −68,0], cel [47,5; 0,9; −57,9], yfov 36°) — belki nie ma, wnęka F ma drzwi i okienko.
- **Dowód przed:** [klient-front-v4.jpg](audyt/sweep-01/dowody/klient-front-v4.jpg)
- **Dowód po:** [D-011-klient-v4-vs-v5.jpg](audyt/sweep-01/dowody/D-011-klient-v4-vs-v5.jpg)

### D-012

- **Poziom:** L4 · **Status:** do weryfikacji · **Właściciel:** 55 + rośliny · **Źródło:** sweep-01 (kadr klienta na v5)
- **Miejsce:** Korony drzew z nasadzeń (estate-trees), też płot (D-001) — np. drzewo przed szeregiem w kadrze klienta.
- **Opis:** Liście i gałązki mają jasną, prawie białą obwódkę na brzegach — drzewa wyglądają jak wycięte z papieru.
- **Przyczyna:** Brzegi tekstur z alfą bez premultiplikacji/dylatacji koloru (mipmapy mieszają kolor tła z alfą), alpha test bez alpha-to-coverage.
- **Propozycja:** 55 + rośliny: premultiplied alpha albo dylatacja koloru pod przezroczystymi pikselami w teksturach liści, alpha-to-coverage przy MSAA; ten sam mechanizm co w D-001.
- **Dowód przed:** [D-011-klient-v4-vs-v5.jpg](audyt/sweep-01/dowody/D-011-klient-v4-vs-v5.jpg)
- **Dowód po:** —

### D-013

- **Poziom:** L1 · **Status:** nowy · **Właściciel:** 59 · **Źródło:** b6 + weryfikacja audytora (v7)
- **Miejsce:** DOM_G, ściana wschodnia parteru = ściana wspólna z F (x = 40,70–40,97 m; SKP y 52,20–53,18 i 54,08–55,21; wys. 0,76–2,96 m nad posadzką).
- **Opis:** W ścianie międzysegmentowej G/F są dwa okna parteru ~1,0 × 2,2 m (ramy, szyby, ościeża), parapety wystają ~25 cm w stronę F. Z zewnątrz zasłania je F, ale we wnętrzu G wypadają na ścianę TV i kuchnię (wnętrze SKP), a parapety przenikają ścianę F.
- **Przyczyna:** Błąd modelu SKP: okno w ścianie wspólnej jest niewykonalne; rzut E (G = lustro E) nie ma okien w ścianach bocznych parteru. 108 lic materiału OKNA C w tym miejscu.
- **Propozycja:** 59: usunąć oba okna (ramy, szyby, parapety, ościeża) z DOM_G i domknąć ścianę tynkiem; sprawdzić analogicznie ściany wspólne E/F, D/C, B/A (test regresji: brak lic OKNA*/szyba w odległości < 0,5 m od płaszczyzny ściany wspólnej).
- **Dowód przed:** [D-013-G-okna-w-scianie-wspolnej-v7.jpg](audyt/dowody/D-013-G-okna-w-scianie-wspolnej-v7.jpg)
- **Dowód po:** —

### D-014

- **Poziom:** L1 · **Status:** nowy · **Właściciel:** 59 · **Źródło:** b6 + weryfikacja audytora
- **Miejsce:** DOM_G, wnęka wejściowa od ulicy (SKP y ≈ 58,6, x 34,5–38,7).
- **Opis:** W bryle G wnęka ma płaski panel 4,2 × 2,2 m wyglądający jak brama garażowa (plus osobne drzwi). Werdykt: to NIE jest garaż — na vis-5 G ma bordowy podcień z drzwiami (monochromatyczny blok wejścia), na zdjęciu estate-4 wnęka ma płaską bordową okładzinę bez podziałów segmentowych, a wnętrze SKP G ma tam wiatrołap, WC i kuchnię jak w rzucie E.
- **Przyczyna:** Błąd/uproszczenie modelu SKP bryły G (niezgodne z wnętrzem SKP i z renderem).
- **Propozycja:** 59: zastąpić „bramę” tylną ścianą wnęki w kolorze stolarki G (D-003: brąz #5e504b) z drzwiami wejściowymi i okienkiem aneksu jak w rzucie E (lustro). Sprostowanie audytora: moja wcześniejsza uwaga „G ma garaż (estate-4)” była błędna.
- **Dowód przed:** [D-014-G-wneka-nie-garaz.jpg](audyt/dowody/D-014-G-wneka-nie-garaz.jpg)
- **Dowód po:** —

### D-015

- **Poziom:** L2 · **Status:** nowy · **Właściciel:** 59 + 55 · **Źródło:** klient (3.png) + odtworzenie na v8
- **Miejsce:** Wszystkie przęsła płotu (OGRODZENIA_10, materiał OGRODZENIE_PRETY, 51 496 trójkątów, v8); najsilniej płot ogrodów i od ulicy oglądany pod kątem z 5–25 m.
- **Opis:** Płot jako geometria prętów daje mory: koncentryczne łuki czarnych kresek „leżące” na trawie i geokracie, migoczące przy ruchu. Występuje w jakości high (MSAA 4) i low; po ukryciu OGRODZENIA_10 znika całkowicie.
- **Przyczyna:** Pręty ~5 mm co ~5 cm są dużo cieńsze od piksela już z kilku metrów — geometria nie ma mipmap, więc próbkowanie daje aliasing (MSAA 4 nie wystarcza).
- **Propozycja:** 59 + 55: płot jako panel z teksturą prętów z mipmapami (premultiplied alpha, dylatacja koloru — bez białych obwódek) dla dystansu > ok. 8 m, geometria prętów tylko z bliska (LOD); kolor antracyt L* ≈ 25. Z daleka panel ma wyglądać jak półprzezroczysta ciemna siatka, jak na vis-3.
- **Dowód przed:** [D-015-mora-pretow-v8-z-i-bez.jpg](audyt/dowody/D-015-mora-pretow-v8-z-i-bez.jpg), [klient-3.jpg](audyt/dowody/klient-3.jpg)
- **Dowód po:** —

### D-016

- **Poziom:** L3 · **Status:** do weryfikacji · **Właściciel:** 55 · **Źródło:** przegląd kodu (zlecenie b6)
- **Miejsce:** src/components/explorer/three/Effects.tsx:47 (EffectComposer multisampling = low ? 0 : 4), Stage.tsx QualityGovernor (mediana klatki > 25 ms dwa razy → postQuality low), Canvas antialias: false; alphaToCoverage = true w bor2/exterior.ts:161, estate/trees.tsx:134, estate/forest.ts:209.
- **Opis:** W jakości „low” (urządzenia lite albo po obniżeniu przez governor — na przeciętnym GPU z 2,25 mln trójkątów zieleni bardzo prawdopodobne) composer nie ma MSAA, a materiały z wycięciem alfą zostają z alphaToCoverage. Bez bufora wielopróbkowego A2C degeneruje się do twardego progu/ditheringu — dokładnie przerywane kreski płotu i ząbkowane brzegi liści ze zrzutów klienta.
- **Przyczyna:** alphaToCoverage włączane bezwarunkowo, MSAA zależne od jakości.
- **Propozycja:** 55: przełączać alphaToCoverage razem z multisampling (low → alphaToCoverage = false + alphaTest 0,5, albo MSAA 2 także w low); logować przejście w low (konsola + pole w dumpScene), żeby było widać, co ogląda klient.
- **Dowód przed:** [D-012-liscie-high-vs-low.jpg](audyt/dowody/D-012-liscie-high-vs-low.jpg)
- **Dowód po:** —

### D-017

- **Poziom:** L4 · **Status:** do weryfikacji · **Właściciel:** 59 + rośliny · **Źródło:** klient (2.png, 3.png)
- **Miejsce:** Pas rabat wzdłuż płotów ogrodów i ulicy (bor2-tufts, 2043 instancje; bor2-shrubs).
- **Opis:** Kępy traw stoją w równych rzędach w stałych odstępach, wszystkie podobnej wielkości i orientacji — wygląda jak szkółka. Na vis-1/vis-5 rabaty są gęste, nieregularne, wielogatunkowe.
- **Przyczyna:** Generator znaczników rozstawia rośliny po linii płotu ze stałym krokiem, bez jittera położenia/skali/obrotu i bez mieszania gatunków.
- **Propozycja:** 59 (wyglad_zielen.py) / rośliny v1: Poisson-disk w pasie 0,6–1,5 m od płotu, jitter skali ±30 %, losowy obrót, 3–5 gatunków w grupach po 3–7, przerwy; gęstość jak na vis-1.
- **Dowód przed:** [D-017-D-018-D-019-kadr2.jpg](audyt/dowody/D-017-D-018-D-019-kadr2.jpg), [klient-3.jpg](audyt/dowody/klient-3.jpg)
- **Dowód po:** —

### D-018

- **Poziom:** L4 · **Status:** w toku · **Właściciel:** 55 (decyzja b6) · **Źródło:** klient (2.png)
- **Miejsce:** Budynki okolicy (okolica-v1, „duchy”) za szeregiem G/F/E i za bliźniakami.
- **Opis:** Duchy są białe, jaśniejsze od elewacji osiedla — przyciągają wzrok i spłaszczają głębię (na renderach okolica jest stonowana, ciemniejsza i mniej kontrastowa niż domy osiedla).
- **Przyczyna:** Kolor duchów podniesiony do #dcdcd8 (L* ≈ 87), wyżej niż jasne elewacje osiedla (L* ≈ 75–80).
- **Propozycja:** 55: duchy L* 60–68, lekko ciepłe (np. #a9a59e), bez połysku, z perspektywą powietrzną (mgła) — zawsze ciemniejsze i mniej kontrastowe niż domy osiedla. Uwaga b6: odwraca to wcześniejszą prośbę o jaśniejsze duchy.
- **Dowód przed:** [D-017-D-018-D-019-kadr2.jpg](audyt/dowody/D-017-D-018-D-019-kadr2.jpg), [klient-2.jpg](audyt/dowody/klient-2.jpg)
- **Dowód po:** —

### D-019

- **Poziom:** L3 · **Status:** nowy · **Właściciel:** 55 · **Źródło:** klient (2.png, 3.png)
- **Miejsce:** Pora „Rano”: niebo i ogólna tonacja.
- **Opis:** Kadr klienta odpowiada porze Rano: niebo beżowo-szare, elewacje chłodnoszare, płaskie. Na renderach dziennych niebo jest czystym błękitem z chmurami, a światło ciepłe.
- **Przyczyna:** Preset Rano: niski kontrast nieba i desaturacja; brak warstwy chmur.
- **Propozycja:** 55 (L3): Rano z błękitem u góry nieba i ciepłym pasem przy horyzoncie, bez szarości; warstwa chmur jak na vis-1/vis-4; sprawdzić, czy domyślna pora otwierana klientowi to Dzień.
- **Dowód przed:** [D-017-D-018-D-019-kadr2.jpg](audyt/dowody/D-017-D-018-D-019-kadr2.jpg)
- **Dowód po:** —

### D-020

- **Poziom:** L4 · **Status:** nowy · **Właściciel:** 59 + rośliny · **Źródło:** pętla 05 (regres vis-1/taupe 12,1 → 40,6)
- **Miejsce:** Drzewo w ogrodzie przed elewacją ogrodową A (kadr visualization-1).
- **Opis:** W v8/roślinach drzewo przed A ma gęstą, ciemną koronę i zasłania pół elewacji ogrodowej A z punktu widzenia vis-1 (region pomiaru „taupe” trafia w liście). Na renderze dewelopera ogród przed A jest otwarty: trawy, taras, ludzie.
- **Przyczyna:** Rozstawienie drzew nie uwzględnia głównych osi widoku (kadrów-bohaterów) — drzewo stoi na osi elewacji ogrodowej.
- **Propozycja:** 59/rośliny: przesunąć drzewo poza oś widoku elewacji ogrodowych (w narożnik działki, ≥ 6 m w bok od osi okien) albo zastąpić niskimi krzewami/trawami jak na vis-1; test: kadry visualization-1/3/6 bez drzew na elewacjach.
- **Dowód przed:** [D-020-drzewo-przed-A-vis1.jpg](audyt/dowody/D-020-drzewo-przed-A-vis1.jpg)
- **Dowód po:** —

### D-021

- **Poziom:** L2 · **Status:** w toku · **Właściciel:** 59 · **Źródło:** pętla 06 (alarm) + test_glb.py
- **Miejsce:** Materiały tynku wszystkich domów (TYNK A/B/C, A_SZCZYT), tekstura TYNK_DETAL_NORMAL w bor2-zewnetrze-v9.glb i v10 z 18:50.
- **Opis:** Elewacje ciemne i szare jak beton (vis-1 ściana B w słońcu L* 82 → 51, fronty szeregu 43 → 20); zależnie od orientacji UV jedne ściany ciemne, inne bez zmian.
- **Przyczyna:** Normal mapa tynku wyeksportowana całkowicie czarna (RGB 0,0,0) — generator 59 zmieniał przestrzeń barw po wpisaniu pikseli; dodatkowo albedo tynku i tarasów ~4 % za ciemne (podwójna konwersja sRGB).
- **Propozycja:** 59: poprawiony generator (normal średnio 0,5/0,5/0,95, albedo jak v8) — v10 do ponownego eksportu; każda dostawa przechodzi audyt/test_glb.py (czerwony = nie idzie do pętli).
- **Dowód przed:** [arkusz.jpg](assets/bor2/scorecard/iteracje/06/arkusz.jpg)
- **Dowód po:** —

## Sprawdzone bez uwag

- L0: elementy proceduralne w runtime to tylko teren, las i niebo; brak pozostałości starej makiety w granicy osiedla (inwentarz).
- L1: sylwetki 7 domów, otwory okienne, drzwi, bramy, kominy i okna dachowe zgodne z Workbench we wszystkich 80 ujęciach wokół domów; poprawki v5 (drzwi A i F, okienko F, brama G) potwierdzone.
- L1: rozmieszczenie geokraty, tarasów i murków zgodne z modelem (ujęcia z góry).
- Szary „mur” wzdłuż ogrodów w Workbench to przęsła OGRODZENIA_1 (szkło zastępcze) — nie jest to rozbieżność geometrii.
