# Materiały do 3D: analiza źródeł i kontrakt geometrii

Stan na 28.10.2026. Dla modułu 3D (`demo-halowawer-8f`). Dane liczbowe są w [dane/houses.json](dane/houses.json), a generator z kontrolą sum w [dane/make_houses.py](dane/make_houses.py). UX opisuje [01-ux-podstrona.md](01-ux-podstrona.md).

Wszystkie sumy metraży z rzutów zgadzają się z kartami senn co do 0,01 m²: A 119,51 · B 119,77 · E 99,80 · F 102,97.

## 1. Inwentarz źródeł

| Plik | Co pokazuje | Do czego |
|---|---|---|
| `zrodla/rzuty/dom-{a…f}-{parter,pietro,poddasze}.png` | Rzuty 1600×1200 z wymiarami w cm, numerami i metrażami pomieszczeń, meblami, oknami (szer./wys., parapet `hp`). | Odrys geometrii (ściany, otwory, strefy). P0 rzutu 2D pod nakładką. |
| `zrodla/rzuty/dom-{a…f}-ogrodek.png` | Działka domu: ogródek z wymiarami, miejsca postojowe (dom i goście „mg”), wejście, strzałka N. | Rzut „Ogród” i ogród w 3D. |
| `zrodla/rzuty/dom-{a…f}-pzt.png` | PZT całego osiedla 2304×1506 z podziałką 0–20 m, N, granicami działek i ogródków, miejscami postojowymi i wjazdem. | Rozmieszczenie domów na makiecie (§5). |
| `zrodla/plan/site-plan.png` | Render z lotu ptaka od frontu (kamera od N), 1920×1248. Senn nakłada na niego poligony A–G. | Wejście na `/domy` (zdjęcie → 3D), poligony w `houses.json → sitePlan`. |
| `zrodla/plan/hero.jpg` | Render bliźniaka A/B od ogrodu (dzień). | Referencja elewacji ogrodowej, plakat. |
| `zrodla/wizualizacje/visualization-1…6.jpg` | Rendery osiedla: 1, 3, 4, 5 dzień; **2 i 6 zmierzch** (kule ogrodowe, ciepłe okna). | Referencja materiałów i pory „Noc”. Galeria. |
| `zrodla/osiedle/estate-1…8.jpg` | **Zdjęcia z drona 04.2026: domy stoją.** Białe tynki, dachy na rąbek w 3 kolorach. Nr 8 to rzut z góry. | Kolory dachów (§9), kontekst sąsiedztwa. Galeria „Budowa”. P2: splat. |
| `zrodla/wnetrza/interior-1…10.jpg` | Rendery wnętrz dewelopera: jasny dąb w jodełkę, bouclé, szałwia. 1–6 strefa dzienna, 7 i 10 sypialnia, 8 i 9 pokój dziecka. | Referencja dla s1, galeria „Wnętrza”. Nie są dopasowane do konkretnego rzutu. |
| `zrodla/pdf/dom-{a…f}.pdf`, `standard-10-atutow.pdf`, `prospekt-informacyjny.pdf` | Karty domów, standard, prospekt. | Linki w panelu (hostowane u nas). |
| `public/kreator/wnetrza/out/s{1…6}-{salon,kuchnia,sypialnia}.jpg` (+ `-mask.png`) | Rendery Kreatora z home, 2048×1360, złota godzina. **Geometria domu A.** | „Wizualizacja” w spacerze dla s1, s4 i s3 (§8). Pliki należą do home (26): tylko czytamy. |
| `public/kreator/wnetrza/out/plan-ai-f0/f1.jpg` | Rzut z lotu ptaka parteru i piętra (render AI), układ A. | Referencja stylu rzutu z meblami. |

## 2. Domy, układy, rodziny geometrii

| Dom | Układ | Rodzina | Położenie | Status |
|---|---|---|---|---|
| A | A | bliźniak 120 | wschodnia połowa pary B·A, wspólna ściana od W | dostępny |
| B | B | bliźniak 120 | zachodnia połowa pary B·A, wspólna ściana od E | dostępny |
| C | **A** (te same pliki rzutów) | bliźniak 120 | wschodnia połowa pary D·C | sprzedany |
| D | **B** | bliźniak 120 | zachodnia połowa pary D·C | dostępny |
| E | E | szeregowiec 100 | wschodni koniec szeregu G·F·E (okna w szczycie) | dostępny |
| F | F | szeregowiec 103 | środek szeregu | dostępny |
| G | brak rzutów (404) | szeregowiec 101 | zachodni koniec szeregu | sprzedany |

**Geometria do napisania to 2 rodziny:**
1. **Bliźniak.** B to w przybliżeniu lustro A (oś W–E) z inną kuchnią: A ma blat przy ścianie W, B przy ścianie E. Różnią się też drobne metraże (WC 2,41 / 2,34, strefa 26,92 / 27,26). Wspólny generator z flagą `mirror` i własnymi strefami.
2. **Szeregowiec.** E i F mają tę samą topologię i inne wymiary (strefa 29,61 / 30,63, aneks 7,86 / 8,43). Jeden plik parametryczny. Dla G na makiecie: lustro E (sprzedany, wnętrze niepotrzebne).

## 3. Rzuty: skala, orientacja, transformacja

**Orientacja wszystkich rzutów jest taka sama** (sprawdzona na liniach sąsiada i na PZT):
- prawo = **front, północ** (wjazd do garażu, wejście ▶);
- lewo = **ogród, południe** (taras, okna HS);
- góra = **zachód**, dół = **wschód**.

**Skala:** ok. **1,02 px/cm (102 px/m)**. Sprawdzone na liniach 364, 525, 601 i 749 cm rzutu B, rozrzut ±1%. Kalibrować per plik na najdłuższej linii wymiarowej (B: 749 cm; E/F: 678/701 cm), tak jak `l64.ts` w Kickiego.

**Transformacja rzut → świat** (x = wschód, z = południe, y = góra; origin domu = jego narożnik NW):
```
x_east  = (y_px − Y_W) / s        // Y_W   = y lica zewn. ściany zachodniej (góra rysunku)
z_south = (X_N − x_px) / s        // X_N   = x lica zewn. ściany frontowej (prawa strona rysunku)
s ≈ 102 px/m
świat = pzt.{x0, z0} domu + (x_east, z_south)       // pzt z houses.json
```

**Wymiary zewnętrzne (z rzutów):**
- bliźniak ok. **8,18 m (W–E) × 9,95 m (N–S)**;
- szeregowiec ok. **7,47 m × 9,56 m**.

Z PZT wychodzi 8,23 × 10,0 oraz 7,6 × 9,7 (rysunek schematyczny, obrys ±0,2 m). **Do geometrii brać rzuty.**

**Okna i drzwi.** Oznaczenie z rzutów to szer./wys. w cm, `hp` to wysokość parapetu.

| Element | Bliźniak (A–D) | Szeregowiec (E, F) |
|---|---|---|
| HS na ogród (parter, S) | 356/224, hp 0 | 328/224, hp 0 |
| Okno strefy dziennej | 158/224 hp 0 (S) + 96/224 hp 0 (front, tylko B/D) | 112/224, hp 0 (S) |
| Pokoje na piętrze (S i N) | 4× 257/204, hp 21 | 4× 220/204, hp 21 |
| Łazienka | 107/107, hp 118 (w szczycie domu) | 107/107, hp 118 (E: szczyt wsch.; F: tylna ściana) |
| Garaż | brama 250/220 + okno 107/107 hp 117 | — |
| Aneks kuchenny | — | 107/107, hp 118 (front) |
| Drzwi wejściowe | 103/208 pod zadaszeniem | 103/208 pod zadaszeniem |

**Wysokości:**
- „Wysokość kondygnacji 2,64 m” (senn) traktujemy jako wysokość w świetle;
- strop przyjmujemy ok. 0,28 m, więc **poziom piętra ≈ +2,92 m, poziom poddasza ≈ +5,84 m**.
- Do kalibracji z `visualization-3/-5` (frontalne) i `estate-2` (szczyt).

## 4. Bryła, dach, poddasze

- **Dach:**
  - dwuspadowy, **kalenica W–E** (równoległa do elewacji frontowej i ogrodowej), szczyty na ścianach W i E każdego domu;
  - bez okapów: nowoczesna „stodoła”, blacha na rąbek dochodzi do lica ściany;
  - **każdy dom ma własny dach na innej wysokości**, bo domy są przesunięte schodkowo (rendery 3, 5, 6).
- **Nachylenie:** linie wysokości z rzutu poddasza (140 / 180 / 220 / 225 cm) dają ok. **27°** wewnątrz.
  - Ścianka kolankowa ok. 0,85 m, płaski strop jętkowy na ok. 2,25 m o szerokości ok. 1,03 m.
  - Zewnętrzny kąt na renderach wygląda na 30–35°. Skalibrować na `estate-2.jpg` i `visualization-2.jpg`.
- **Kominy i wywiewy:** 2 na dom (rendery), prostopadłościany ok. 0,4×0,6 m.
- **Poddasze:** nieużytkowe, wewnątrz 6,87 × 7,32 m (bliźniak) i 6,59 × 6,61 m (szereg). Wyłaz z korytarza piętra, schody samonośne „do własnego montażu”, wyłaz na dach.
  - Karty PDF: „Poddasze nieużytkowe, powierzchnia po podłodze” A–D 49,27 m², E 42,88 m², F 44,30 m²; wysokość w najwyższym punkcie 2,25 m.
  - W 3D pokazujemy pustą przestrzeń: strefa ≥ 2,2 m zaznaczona, etykieta „Poddasze nieużytkowe 49,27 m²”.
- **Zadaszenie nad wejściem:**
  - wnęka w bryle (bliźniak 3,28–3,42 m², szereg 6,96–7,09 m²);
  - wejście od frontu (N);
  - zadaszenie tworzy wcięcie w narożniku frontowym, widoczne na PZT jako schodek w obrysie.

## 5. Osiedle: rozmieszczenie i wejście zdjęciem

**PZT → metry.** Podziałka daje ok. 21,0 px/m, a obrysy domów względem rzutów ok. 21,6–21,9. Przyjąłem **21,5 px/m**, dokładność ±0,3 m. Narożniki NW domów są w `houses.json → houses[].pzt` (origin = NW domu G, x = wschód, z = południe):

| Dom | x0 | z0 | szer. W–E | gł. N–S |
|---|---|---|---|---|
| G | 0,00 | 0,00 | 7,63 | 9,67 |
| F | 7,44 | 1,44 | 7,53 | 9,67 |
| E | 14,79 | 2,93 | 7,63 | 9,67 |
| D | 31,67 | 5,95 | 8,23 | 10,09 |
| C | 39,72 | 7,49 | 8,23 | 10,00 |
| B | 57,26 | 10,74 | 8,23 | 9,86 |
| A | 65,26 | 12,00 | 8,23 | 10,05 |

- **Schodkowanie:** każdy dom na wschód jest ok. 1,3–1,6 m dalej na południe, bo działka jest skośna (ok. 10° względem osi W–E). Same domy są ustawione **prosto N–S** (na PZT prostopadle do strzałki N).
- **Między segmentami** (G·F·E | D·C | B·A) są przerwy ok. 9,3 m z miejscami postojowymi prostopadle do drogi (litery E E D, C mg B, A mg na PZT).
- **Droga:** ciąg pieszo-jezdny od północy, wzdłuż północnej granicy pas zieleni ok. 3,5 m, **wjazd/wyjazd od wschodu** przy A.
- **Ogrody** są nieregularne, bo południowa granica działki jest skośna. Obrysy odrysować z PZT (granice ogródków to cienkie linie, a ogródek wybranego domu jest zakreskowany na jego `dom-*-pzt.png`). Wymiary cząstkowe są na `dom-*-ogrodek.png`, a powierzchnie w danych. Skrajności: F 38,26 m², G 184,87 m².

**Wejście zdjęciem (`site-plan.png` + poligony):**
- Poligony domów (ścieżki SVG w układzie 1920×1248) i kotwice etykiet (`marker`) są przeniesione 1:1 z senn.pl, czyli dokładne. Poligon obejmuje dom z działką, nie samą bryłę.
- Kamera zdjęcia: perspektywa z lotu ptaka **od północy, wschód po lewej** (kolejność A…G od lewej).
- **Dopasowanie kamery makiety:**
  - offline PnP (OpenCV `solvePnP`, ≥ 8 punktów: narożniki brył przy gruncie i końce kalenic, współrzędne świata z tabeli wyżej + wysokości z §3–4);
  - alternatywa: punkty zbiegu jak w `PhotoEntry` Kickiego (tam ok. 8 px RMS).
  - Wynik (fov, pozycja, rotacja, offset optyki) zapisać w JSON, z dopiskiem w UI „Położenie domów poglądowe”.
- **Styl nakładki:**
  - spoczynek: wypełnienie 0;
  - hover dostępnego: złoto `#d9a35b` z α 0,18 i obrys 1,5 px;
  - sprzedany: szary z α 0,25, bez hovera ceny;
  - **bez zieleni i czerwieni senn.**

**Sąsiedztwo** (do abstrakcyjnej makiety, bez detali):
- na NNW boisko piłkarskie (OSM `way 273248444`, ok. 90 m);
- na wschód dom z czerwonym dachem;
- na zachód zabudowa jednorodzinna;
- na północ łąka.
- Wszystko jako niskie bryły z gliny, jak w Kickiego.

## 6. Pora dnia: prawdziwe słońce

Lokalizacja: **52,18928 N, 21,14675 E** (Zerzeń, OSM). Ogrody i okna HS patrzą na **południe (az. 180°)**. Słońce policzyłem algorytmem NOAA (zgodny z suncalc do ok. 0,1°). Wektor `threeDir` wskazuje kierunek **do słońca** w układzie x = E, y = góra, z = S.

| Pora | Data i godzina | Azymut | Wysokość | `threeDir` | Charakter |
|---|---|---|---|---|---|
| Rano | 21.09, 08:30 CEST | 114,4° | 18,7° | (0,863, 0,320, 0,391) | Niskie słońce z ESE: szczyty wschodnie i muśnięcie ogrodów; chłodniejsze niebo. |
| **Dzień** (domyślna) | 21.09, 15:30 CEST | 232,4° | 26,1° | (−0,712, 0,440, 0,548) | Ciepłe popołudnie z SW. **Słońce wpada przez HS do salonu** (52° od normalnej). Długie cienie, złoty ton zgodny z renderami Kreatora i hero. |
| Noc | 21.09, 19:15 CEST | 279,6° | −6,6° | (−0,979, −0,115, −0,166) | Niebieska godzina: niebo zmierzchu, **ciepłe okna i kule ogrodowe** (jak `visualization-2/-6`), wnętrze z lamp. Tak jak w Kickiego: IBL z neutralnego HDRI, panorama zmierzchu tylko za oknem. |

**Dlaczego 21 września, a nie czerwiec:**
- w czerwcu złota godzina przypada na NW, czyli za domem; przez okno od południa przy niskim słońcu nie wpadłoby nic;
- równonoc to dzień „średni” i nie jest wybrany pod efekt;
- odbiór jest w 11.2026.

Wartości dla czerwca, gdyby klient wolał lato:

| Pora | Godzina (15.06) | Azymut | Wysokość |
|---|---|---|---|
| Rano | 08:00 | 91° | 31° |
| Dzień | 16:00 | 253° | 42° |
| Noc | 21:45 | 321° | −6° |

## 7. Wystroje s1 / s4 / s3: materiały i meble

Jeden przełącznik zmienia **sloty materiałów** (`specs.ts` z Kickiego) **i komplet mebli** (scenariusz). Nazwy pochodzą z Kreatora. W modelu i spacerze strefa dzienna, taras i sypialnia są umeblowane w każdym stylu (P0); reszta pokoi dostaje meble neutralne wspólne dla stylów (P1: per styl).

| Slot | s1 Jasna skandynawska | s4 Japandi | s3 Grafitowa |
|---|---|---|---|
| Podłoga | dąb naturalny, **jodełka** `#d4ab74` (jak rendery senn) | jesion, deska prosta, jasny | dąb wędzony, jodełka `#5a4434` |
| Ściany | ciepła biel `#ebe4d6` | papier ryżowy `#efe7d8` | ciepła szarość + ściana akcentowa grafit `#5a5a5c` |
| Zabudowa kuchni | fronty dąb + biel, blat jasny kamień | jesion bezuchwytowy, blat czarny mat | antracyt mat, blat marmur `#e7e4df` |
| Tkanina sofy | bouclé kremowe | len piaskowy, niska sofa | antracyt / grafit |
| Stół | okrągły biały, krzesła dębowe | jesion, ławka, krzesła czarne | czarny dąb z marmurowym blatem |
| Oświetlenie | kula opal, lampa podłogowa | lampion z papieru (Akari) | czarne metalowe wiszące |
| Akcenty | len, oliwka w donicy, pled | czerń, ceramika, bonsai | marmur, skóra, czarny metal |
| Sypialnia | łóżko tapicerowane jasne | niska rama, futonowy charakter | ciemny zagłówek, garderoba |
| Scenariusz | **Rodzina 2+2**: 2 pokoje dziecięce, pokój hobby jako gabinet | **Para + gabinet**: gabinet, pokój gościnny | **Para + pokój gościnny**: garderoba w pokoju 2 |

**Referencje wizualne:**
- Kreator `s1-*.jpg`, `s4-*.jpg` i `s3-*.jpg` (ta sama kamera i układ A);
- rendery senn `interior-*.jpg` dla s1.

**Assety:**
- Kickiego ma zestaw CC0 (`public/explorer/3d/models`, `CREDITS.md`).
- Do s4 i s3 dociągnąć z Poly Haven / ambientCG (kategoria `furniture`). Pojedyncze brakujące elementy (lampion papierowy, niskie łóżko) zrobić z modeli AI w planie z prawami komercyjnymi (Meshy/Tripo płatne).
- Wszystko przez `gltf-transform` (meshopt + KTX2), szczegóły w [03](03-biblioteki.md).

## 8. Spacer: punkty per układ

Wysokość oczu 1,6 m. Hotspoty stoją w środkach stref z odstępem ≥ 0,3 m od ścian. Mikrocopy jest w [01 §7](01-ux-podstrona.md#7-mikrocopy-hotspoty-i-etykiety-1-linia-konkret--korzyść).

| Kondygnacja | Punkty (bliźniak A/B) | Punkty (szereg E/F) | Patrzy na |
|---|---|---|---|
| Parter | `wejscie` (wiatrołap) | `wejscie` | w głąb domu |
| | **`salon`** (strefa dzienna, przy sofie) | **`salon`** | **HS i ogród (S)**, kadr-bohater |
| | `jadalnia` (przy stole) | `kuchnia` (aneks) | kuchnia / salon |
| | `taras` (na zewnątrz) | `taras` | ogród |
| | **`ogrod`** (koniec ogrodu) | **`ogrod`** | **elewacja S domu w słońcu** |
| | `garaz` (P2) | — | — |
| Piętro | `korytarz` (podest; schody z parteru) | `korytarz` | — |
| | `sypialnia` · `pokoj-1` · `pokoj-2` · `pokoj-3`/`hobby` · `lazienka` | jw. | okna S lub N |
| Poddasze | `poddasze` (P2) | `poddasze` (P2) | przestrzeń pod dachem |

**„Wizualizacja” (przenikanie do renderu):**
- Kreator ma rendery salonu, kuchni i sypialni **domu A** w s1–s6, czyli w naszych s1, s4 i s3.
- **Układ-bohater to A** (decyzja usera 28.10, Kreator na home zmienia podpis na „Dom A”). Warunek, który zostaje do spełnienia: kamery punktów `salon`, `jadalnia` i `sypialnia` muszą być złożone pod kadry Kreatora. W `halo-wawer2.html` każdy pokój ma pole `ROOMS[].cam`, np. salon `[390,180,90,790]`, prawdopodobnie położenie i kierunek kamery w cm planu. Format trzeba potwierdzić u właściciela home (26).
- Wtedy każdy z 3 stylów ma fotorealistyczne przenikanie, a nie tylko s1 jak w Kickiego.

## 9. Elewacje i otoczenie (makieta vs rzeczywistość)

- **Rzeczywistość (dron, 04.2026):**
  - **białe tynki**;
  - dachy na rąbek w 3 kolorach: **szampański/beżowy, szałwiowy, jasnoszary**;
  - ciemna stolarka.
- **Rendery** pokazują tynki w greige, taupe i szałwii oraz bramy garażowe w kolorach. To obietnica marketingowa, a dziś jest inaczej.
- **Decyzja (nadzór, 28.10):** makieta z gliny w ciepłej palecie marki (ivory/greige, np. ściany `#e9e2d6`, cokół i detale `#d8cfc1`), **dachy w 3 prawdziwych kolorach** i podpis „Położenie domów poglądowe”.
  - Prawdziwy kolor dachu to jedyny akcent, po którym kupujący rozpozna dom na miejscu.
  - Przypisanie z `estate-8.jpg` (dół zdjęcia = wschód, boisko na NW według OSM; pewność średnia): **A szałwia · B jasny · C szampan · D jasny · E jasny · F szałwia · G szampan**.
  - Pole `roofColor` w danych. Proponowane wartości: szampan `#cfc2a6`, szałwia `#9fac93`, jasny `#d9dbd6`, do korekty na zdjęciach.
- **Ogrody:**
  - trawnik i rabaty z bylinami (rendery 1, 5);
  - niskie ogrodzenia panelowe między ogródkami;
  - taras z płyt lub deski (do aranżacji indywidualnej, więc neutralnie);
  - **kule ogrodowe** świecące w porze Noc.
- **Droga i parkingi:** kostka szara, miejsca postojowe prostopadle, auta abstrakcyjne albo żadnych (Kickiego: bez aut).

## 10. Braki i rzeczy do potwierdzenia

| Temat | Stan | Kto |
|---|---|---|
| Rzuty domu G | 404 na senn.pl; na makiecie lustro E | nie blokuje (sprzedany) |
| Ceny elementów dodatkowych (miejsca postojowe) | **otwarte przed publikacją**. W UI tylko „garaż + 1 miejsce” / „2 miejsca”, bez ceny i bez „w cenie” | klient / deweloper |
| Kolory elewacji docelowe (biel z drona czy greige z renderów) | rozstrzygnięte dla demo: makieta ivory/greige + prawdziwe dachy | — |
| Przejście garaż → dom w A/C | na B/D jest; na A wygląda na tak, do potwierdzenia na PDF | 8f przy odrysie |
| Nachylenie dachu i wysokość kalenicy | szacunek 27–35° | 8f, kalibracja na zdjęciach |
| Przypisanie kolorów dachów | pewność średnia | 8f, weryfikacja na `estate-1/-6` |
| Kreator „Dom B” ma dane domu A | rozstrzygnięte: Kreator → „Dom A”, A to bohater 3D | 26 (podpis), 8f (układ A) |
