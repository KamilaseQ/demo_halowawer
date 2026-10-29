# /domy: układ podstrony 3D i specyfikacja UX

Stan na 28.10.2026. Autor: research/UX (`demo-halowawer-bd`).

Dla kogo: moduł 3D (`demo-halowawer-8f`), strona główna (`demo-halowawer-26`) i nadzór (`demo-halowawer-15`).

Dane: [dane/houses.json](dane/houses.json). Materiały do 3D: [02-materialy-3d.md](02-materialy-3d.md). Biblioteki: [03-biblioteki.md](03-biblioteki.md).

Wzorzec to Kickiego 27 (`demo_Dominik`), czyli jedna scena, jedna kamera i szklane panele. Zmieniamy dwie rzeczy:
- **jasna, ciepła paleta Halo Wawer** zamiast ciemnej z Kickiego;
- **dom wielopoziomowy** zamiast mieszkania na jednym piętrze.

---

## 1. Zasady (do nich wracać przy każdej wątpliwości)

1. **Mniej znaczy lepiej.** Na każdym widoku jest najwyżej 1 akcja główna i 2 drugorzędne. Żadnych filtrów, suwaków ani sortowania, bo 7 domów mieści się w jednej tabeli.
2. **Najpierw dane i rzut, potem efekt WOW.** Według NAR 2025 zdjęcia, dane i rzuty to 83%, 79% i 57% „bardzo przydatnych” funkcji, a spacer 41%. Dlatego:
   - cena, metraż i rzut są **1 klik** od każdego domu i działają **bez WebGL**;
   - 3D i spacer to warstwa na wierzchu.
3. **Każdy poziom ma widok 3D i 2D.** Osiedle: makieta + plan. Dom: model + rzut. Użytkownik zawsze wie, gdzie jest.
4. **Prawda.** Stosujemy:
   - prawdziwą orientację (ogrody od południa, słońce z suncalc dla Zerzenia);
   - dokładne metraże z kart (`119,77 m²`, a nie „120”);
   - zł/m² dewelopera;
   - dopisek „wizualizacja poglądowa” tam, gdzie pokazujemy aranżację.
5. **Stan w URL.** Każdy widok da się wysłać partnerowi przez WhatsApp.
6. **Jedna nazwa CTA w całym serwisie.** Główne: „Umów prezentację” (złote). Drugie: „WhatsApp” (outline).

## 2. Ścieżka użytkownika

```
/domy  OSIEDLE ─────────────── klik w dom (lista / scena / pin) ──────────────▶  /domy/b  DOM B
  ├─ Osiedle 3D  (makieta: zdjęcie → 3D)                                        ├─ Model 3D  (Dom · Poddasze · Piętro · Parter)
  └─ Plan        (2D: działki, ogrody, parkingi)                                 ├─ Rzut      (Poddasze · Piętro · Parter · Ogród)
                                                                                 ├─ Spacer    (punkty + minimapa, piętra w minimapie)
  ◀────────────── „← Wszystkie domy” (panel) / Esc ─────────────────────────────  └─ Galeria   (Wizualizacje · Wnętrza · Budowa)
```

- **Każde wejście** (bez kontekstu, z Kreatora, z zajawki na home, z linku od doradcy) od razu pokazuje panel z listą (SSR) i zdjęcie osiedla jako tło ekranu ładowania.
  - 3D zaczyna się wczytywać natychmiast, na każdym urządzeniu.
  - Interakcja 3D rusza dopiero po **pełnym** preloadzie (§10), w widoku docelowym z linku.
  - Inaczej niż w Kickiego: tam telefon startował 3D dopiero po pierwszej interakcji. Decyzja usera: płynność przed szybkością pierwszego wyświetlenia.

## 3. Układ desktop (1440×900)

### 3.1 Osiedle

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌂ Halo Wawer      Start  O osiedlu  [Domy]  Lokalizacja  Kontakt          ☎ 733 80 90 90  [Umów prezentację] │  ← nav strony (przezroczysty nad sceną)
│ ┌─────────────────────────────┐ ┌──────┐                  · · · Zach · · · Pd · · · Wsch · · ·      │  ← pasek kierunków (P1)
│ │ HALO WAWER · ZERZEŃ, WAWER  │ │ ▣    │        ( G · sprzedany )                                   │
│ │ Wybierz dom                 │ │Osiedle│   ( F · 103,0 m² · 1,45 mln zł )  ( E · 99,8 m² · 1,49 mln zł )│
│ │ 7 domów · ogrody od południa│ ├──────┤                                                            │
│ │ · odbiór 11.2026            │ │ ▤    │          [ scena: zdjęcie osiedla → makieta 3D ]           │
│ │                             │ │ Plan │                                                            │
│ │ DOM     POW.   OGRÓD   CENA │ └──────┘   ( B · 119,8 m² · 1,60 mln zł )                          │
│ │ BLIŹNIAKI · GARAŻ + MIEJSCE │                                                                    │
│ │ Dom A  119,51  98,82  1,61 mln│                                                                   │
│ │ ● Dostępny                  │                                                                    │
│ │ Dom B  119,77  93,67  1,60 mln│                                                                   │
│ │ …                           │                                                                    │
│ │ SZEREGOWCE · 2 MIEJSCA      │                                                                    │
│ │ Dom E   99,80  78,41  1,49 mln│                                                                   │
│ │ …                           │                                                                    │
│ │ Ceny brutto · stan na 28.10.2026 │  Położenie domów poglądowe     [ Rano  Dzień  Noc | − + ]  (◉)│  ← WhatsApp FAB
│ └─────────────────────────────┘                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Panel | Lewy, szkło, szer. 380 px, od nav do dołu −16 px. Zawartość przewija się wewnątrz (`data-lenis-prevent`). |
| Szyna trybów | Pionowa, szklana, przy prawej krawędzi panelu. Na osiedlu 2 przyciski: **Osiedle** (3D) i **Plan** (2D, P1). Do czasu dostarczenia Planu szyny na osiedlu nie ma wcale. |
| Scena | Wszystko na prawo od panelu i szyny. Kadr liczony z wolnego pola sceny (`freeRegion` z Kickiego). |
| Etykiety na scenie | Szklana pigułka nad domem: `B · 119,8 m² · 1,60 mln zł`. Dom sprzedany: `C · sprzedany`, wyciszona i bez hovera ceny. |
| Dolny pasek | Na osiedlu tylko: pora dnia i zoom. Styl wystroju nie ma tu sensu, bo dotyczy wnętrz. |
| Podpis | „Położenie domów poglądowe”, 12 px, `--muted`, lewy dół sceny. |
| WhatsApp | Złote koło 56 px, prawy dolny róg, na każdym widoku. |

**Lista domów to główne narzędzie porównania.** Na home zostają tylko A, B i E, więc tylko tutaj widać całą siódemkę.
- 4 kolumny: **DOM** (nazwa + status pod spodem) | **POW.** | **OGRÓD** | **CENA**. Liczby w `font-variant-numeric: tabular-nums`, wyrównane do prawej.
- 2 grupy z nagłówkami: `BLIŹNIAKI · GARAŻ + MIEJSCE` (A, B, C, D) i `SZEREGOWCE · 2 MIEJSCA` (E, F, G). Grupy zastępują sortowanie i filtry.
- **Wyróżnij różnice**:
  - ogród 38,26 m² (F) i 184,87 m² (G) to skrajności;
  - najtańszy dom (F, 1,45 mln) dostaje mały tag `najniższa cena`, a największy ogród dostępny (A, 98,82 m²) tag `największy ogród`;
  - maksymalnie 2 tagi na całą listę, tylko z danych, bez ocen.
- **Sprzedane (C, G):**
  - zostają na liście jako dowód popytu: tekst i liczby `--muted` z opacity 0,55, status „Sprzedany” bez kropki, cena „—”;
  - nadal klikalne: pokazują model i rzut, ale panel proponuje podobny dostępny dom.
- **Status:**
  - „● Dostępny” ze złotą kropką `--gold`;
  - „Rezerwacja” w kolorze taupe `#a39588`;
  - „Sprzedany” jako szary tekst.
  - Zero zieleni #17b26a i czerwieni #e31e44 z senn.pl (decyzja klienta).
- **Synchronizacja:**
  - hover wiersza podświetla dom na scenie, hover domu na scenie podświetla wiersz;
  - klik w wiersz lub dom: przelot kamery do domu (od strony ogrodu), panel przechodzi w kartę domu, URL zmienia się na `/domy/b`.
- **Klawiatura:** strzałki ↑↓ w liście, Enter otwiera dom, Esc wraca poziom wyżej.
- **Stopka listy:** `Ceny brutto · stan na {dziś} · historia cen w karcie domu`.

### 3.2 Dom (Model 3D)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ nav                                                                                                │
│ ┌─────────────────────────────┐ ┌───────┐                                              ┌───┐       │
│ │ ← Wszystkie domy        ⤴   │ │  ⬡    │                                              │ ⌃ │       │
│ │ BLIŹNIAK · ● DOSTĘPNY       │ │Model 3D│        ( Salon z jadalnią · 27,26 m² )       │Dom│       │
│ │ Dom B                       │ ├───────┤                                              │Pdd│       │
│ │ Ogród 93,67 m² od południa, │ │  ▤    │          [ dom B, ściany od kamery           │1 p│       │
│ │ garaż z przejściem do domu  │ │ Rzut  │            ścięte do 1,2 m, piętro           │ P │       │
│ │                             │ ├───────┤            nad nim rozsunięte ]              │ ⌄ │       │
│ │ 1 600 000 zł                │ │  🚶   │                                              └───┘       │
│ │ 13 890,09 zł/m² · stan na 28.10.2026 │Spacer │   ( Taras 6,98 m² · od południa )                 │
│ │ Historia cen            ⌄   │ ├───────┤                                                          │
│ │ ┌────────────┬────────────┐ │ │  ▧    │                                                          │
│ │ │Powierzchnia│ Pokoje     │ │ │Galeria│                                                          │
│ │ │119,77 m²   │ 5          │ │ └───────┘                                                          │
│ │ │Ogród       │ Parking    │ │                                                                    │
│ │ │93,67 m²    │ garaż + 1  │ │                                                                    │
│ │ │Poddasze    │ Odbiór     │ │                                                                    │
│ │ │49,27 m²    │ 11.2026    │ │                                                                    │
│ │ └────────────┴────────────┘ │                                                                    │
│ │ Pomieszczenia           ⌄   │                                                                    │
│ │ Dokumenty (3)           ⌄   │                                                                    │
│ │ [ UMÓW PREZENTACJĘ ] [WHATSAPP] │  Wizualizacja poglądowa  [◐◐◐ Japandi | Rano Dzień Noc | − +] (◉)│
│ └─────────────────────────────┘                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Karta domu (panel)

To jedyne miejsce w serwisie z zł/m² i historią cen, bo user zdjął je z kart na home. Wymaga tego ustawa o jawności cen.

**Panel jest odchudzony (decyzja nadzoru 28.10).** Akcje są tylko 2: CTA na stałe. Wszystko inne to zwinięte sekcje informacji plus jedna ikona „Udostępnij”. W panelu **nie ma** wyboru stylu ani aranżacji (styl jest tylko w dolnym pasku sceny), nie ma też linków „Rzuty”, bo dubluje je tryb Rzut.

| Kolejność | Treść | Uwagi |
|---|---|---|
| 1 | `← Wszystkie domy` + ikona **Udostępnij** (⤴) po prawej w tym samym wierszu | Link powrotu, 13 px. Udostępnij: `navigator.share({ title, url })` z bieżącym deep linkiem (dom, widok, styl, pora, punkt). Bez Web Share API: kopiowanie linku do schowka i toast „Link skopiowany”. Ikona 20 px, `aria-label="Udostępnij ten widok"`. |
| 2 | Eyebrow `BLIŹNIAK · ● DOSTĘPNY` | 12 px/600, wersaliki, tracking 0,14 em, kolor taupe. Kropka złota. |
| 3 | Tytuł `Dom B` | 32 px/500, letter-spacing −0,02 em. |
| 4 | Lead, 1–2 linie | Konkret i korzyść. **Tylko twierdzenia z danych (`houses.json` / `src/lib/estate`) albo z kart PDF**; bez ocen i określeń, których deweloper nie używa (np. „narożny”). Przykłady: A „Największy ogród wśród dostępnych domów: 98,82 m² od południa”. B „Ogród 93,67 m² od południa, garaż z przejściem do domu” (przejście widać na rzucie w karcie). F „Środkowy szeregowiec, najniższa cena na osiedlu”. |
| 5 | Cena `1 600 000 zł` | 28 px/500, `tabular-nums`. |
| 6 | `13 890,09 zł/m² · stan na 28 października 2026` | 13 px, kolor muted. **Wartość zł/m² z danych**, bo deweloper liczy ją bez klatki schodowej. Nie liczyć jej w kodzie z pow. |
| 7 | „Historia cen” | Domyślnie zwinięta. Tabela: Data / Cena brutto / Cena za m². Dziś ma 1 wiersz (`24.04.2026`). |
| 8 | Siatka 2×3 | Powierzchnia, Pokoje, Ogród, Parking, Poddasze, Odbiór. Etykieta 12 px muted, wartość 16 px. **Parking** to wyłącznie „garaż + 1 miejsce” (bliźniaki) albo „2 miejsca” (szeregowce): bez ceny i bez sformułowania „w cenie”. Ceny miejsc są nieznane, to otwarty punkt przed publikacją. |
| 9 | „Pomieszczenia” | **Domyślnie zwinięta.** Po rozwinięciu podział na kondygnacje: `Parter · 61,03 m²`, `Piętro · 58,74 m²`, `Poddasze nieużytkowe · 49,27 m²`. Wiersz `Strefa dzienna   27,26 m²  →`. Klik w pokój z punktem spaceru prowadzi do spaceru w tym punkcie, a bez punktu podświetla pokój na scenie. |
| 10 | „Dokumenty (3)” | **Domyślnie zwinięta.** W środku: Karta domu (PDF), Standard: 10 atutów (PDF), Prospekt informacyjny (PDF). Pliki hostujemy u nas (`public/explorer/docs/…`), bez linków do senn.pl (lead nie wychodzi). |
| sticky | `[UMÓW PREZENTACJĘ]` (złoty) + `[WHATSAPP]` (outline) | Przyklejone do dołu panelu, zawsze widoczne. Złoty `#d9a35b` z tekstem `#222220` daje kontrast ok. 7:1. Biały tekst na złocie nie przechodzi AA. |

**Dom sprzedany (C, G):**
- eyebrow `BLIŹNIAK · SPRZEDANY`, bez ceny i historii;
- lead: „Ten dom ma już właściciela. Ten sam układ ma Dom A (dostępny)”, z przyciskiem `Zobacz Dom A →`;
- CTA bez zmian; WhatsApp ma wtedy treść o domu A.

#### Pigułka pięter (prawa krawędź)

- Pozycje: `⌃ Dom · Poddasze · Piętro · Parter ⌄`.
- **„Rozdzielenie na piętra” to główny moment WOW modelu.**
  - Pierwszy wybór kondygnacji „otwiera” dom: przez ok. 600 ms kondygnacje rozsuwają się w pionie o 3–4 m (eksplodowana aksonometria).
  - Potem kamera skupia się na wybranej kondygnacji: wyższe odjeżdżają w górę i bledną do ok. 15%, niższe zostają pełne.
  - Na wybranej kondygnacji ściany od strony kamery są ścięte do ok. 1,2 m (dollhouse, jak w Kickiego).
- `Dom` zamyka bryłę z dachem i pokazuje elewację od ogrodu.
- `Poddasze` pokazuje pustą przestrzeń pod dachem ze strefami wysokości. Strefa ≥ 2,2 m jest delikatnie przyciemniona, z etykietą „wysokość ≥ 2,2 m”.
- Przy `prefers-reduced-motion` nie ma rozsuwania, jest crossfade.

#### Dolny pasek (Kickiego 1:1, w jasnej palecie)

`[◐◐◐ Japandi] | Rano · Dzień · Noc | − +`
- **Wystrój:** 3 okrągłe swatche z potrójnym kolorem stylu i nazwa aktywnego. Pokazujemy go tylko wtedy, gdy widać wnętrze (Model z wybraną kondygnacją, Spacer). Szczegóły w §6.
- **Pora dnia:** segmenty `Rano / Dzień / Noc`. Przejście to przenikanie ok. 0,8 s.
- **Zoom:** − + (na mobile zamiast tego pinch).

### 3.3 Dom (Rzut)

- **Scena:** płaski rzut wybranej kondygnacji na ciepłym tle `--stageInk` `#fbf7f0`.
- **Pigułka:** `Poddasze · Piętro · Parter · Ogród`. Pozycja „Ogród” to rzut działki z ogródkiem, tarasem, miejscami postojowymi, strzałką N i łukiem słońca.
- **Na rzucie:**
  - pokoje jako obszary do kliknięcia, przy najechaniu wypełnienie złotem 12% i obrys 1,5 px;
  - etykieta-pigułka `Strefa dzienna · 27,26 m²`;
  - pokoje z punktem spaceru mają strzałkę `→` (jak w Kreatorze na home): klik wchodzi do spaceru.
- **Zawsze widoczne:** strzałka N, podziałka 1 m i podpis „Rzut poglądowy · wymiary w karcie domu (PDF)”.
- **Decyzja nadzoru (29.10) dla A i C:**
  - w trybie Rzut pokazujemy **rzuty z lotu ptaka z Kreatora**: `/kreator/wnetrza/out/plan-ai-f0.jpg` (parter) i `plan-ai-f1.jpg` (piętro), 1920×1280, obrysy pokoi ze stałej `AREAS` w `public/kreator/index.html`;
  - dla C lustro tylko wtedy, gdy wynika z `PLACEMENTS`;
  - **rysunek CAD dewelopera zostaje w „Dokumentach”** i nie jest obrazem trybu Rzut.
  - Pozostałe domy: jak niżej, do czasu wygenerowania ich rzutów z lotu ptaka.
- **P0:** rzut dewelopera (PNG 1600×1200, skala ok. 102 px/m) pod nakładką SVG z obszarami pokoi. Obszary liczymy **z tej samej geometrii co 3D**, transformacja jest w [02 §3](02-materialy-3d.md#3-rzuty-skala-orientacja-transformacja). PNG kładziemy z `mix-blend-mode: multiply` na ciepłym tle, wtedy biel rysunku znika w tle.
- **P1:** własny rzut wektorowy SVG z geometrii. Ten sam generator rysuje minimapę spaceru, więc daje spójny styl i ostrość na każdym DPR.
- **Działa bez WebGL i bez czekania na 3D.** Jest SSR-owalny i ma pinch-zoom na mobile.
- Dolny pasek: tylko zoom.

### 3.4 Dom (Spacer)

- **Przycisk `← Model 3D`** w lewym górnym rogu sceny (Kickiego).
- **Minimapa** (lewy dół, 240 px):
  - SVG bieżącej kondygnacji z kropkami punktów, aktualny punkt w złotym pierścieniu, stożek kierunku patrzenia;
  - **pod minimapą przełącznik `P · 1`** zamiast pigułki pięter: prawa krawędź zostaje pusta, a scena jest czysta.
- **Hotspoty:** szklane kółka na podłodze i etykieta w 1 linii (mikrocopy, §7). Schody mają hotspot `Schody · na piętro ↑`.
- **Sterowanie:** przeciągnięcie to rozglądanie, klik lub tap w hotspot albo podłogę to przejście (klik-i-idź z kursorem na podłodze, Kickiego `Walk.tsx`). Bez WASD na mobile (WASD może zostać jako ukryty bonus na desktopie).
- **Dolny pasek:** wystrój | pora dnia | − + (FOV).
- **„Wizualizacja” (P1):** w punktach Salon i Sypialnia przenikanie do fotorealistycznego renderu dewelopera, tylko dla stylu Jasna skandynawska, bo do niego pasują rendery wnętrz senn (§6).

### 3.5 Dom (Galeria)

- Siatka miniatur i lightbox.
- 3 chipsy: `Wizualizacje (6) · Wnętrza (10) · Budowa (8)`. „Budowa” to zdjęcia z drona z 04.2026, dowód, że domy stoją (zaufanie).
- Przy „Wnętrzach” podpis „Aranżacje przykładowe”.

### 3.6 Zwijanie panelu do góry (P0, wysoki priorytet; decyzja usera 29.10)

Uzasadnienie usera: na widoku osiedla panel zasłania budynki, a przy domu w 3D przytłacza. Panel musi dać się schować jednym kliknięciem, na każdym poziomie (lista domów i karta domu), i równie łatwo przywrócić.

```
ROZWINIĘTY (jak dziś)                     ZWINIĘTY (do góry)
┌─────────────────────────────┐ ┌──┐      ┌──────────────────────────────────────┐ ┌──┐
│ ← Osiedle / Dom A    ⤴   ⌃  │ │▣ │      │ Dom A · 119,51 m² · 1 610 000 zł   ⌄ │ │▣ │   ← pasek 56 px, szer. jak panel
│ BLIŹNIAK · ● DOSTĘPNY       │ │  │      └──────────────────────────────────────┘ │  │
│ Dom A                       │ │  │                                                │  │   szyna trybów zostaje przy pasku
│ …                           │ └──┘           [ scena na całej szerokości ]       └──┘
│ [UMÓW PREZENTACJĘ][WHATSAPP]│
└─────────────────────────────┘
```

- **Przycisk:** chevron `⌃` w prawym górnym rogu panelu, w wierszu breadcrumbu obok ikony Udostępnij (na liście domów w wierszu eyebrow). 32×32 px, `aria-expanded`, `aria-controls` = id treści panelu, etykieta „Zwiń panel” / „Rozwiń panel”, tooltip z tą samą treścią.
- **Zwinięty pasek** (cały jest klikalny i rozwija panel), jedna linia, 15 px/500, `tabular-nums`:
  - karta domu: `Dom A · 119,51 m² · 1 610 000 zł` (sprzedany: `Dom C · sprzedany`), z kropką statusu przed nazwą;
  - lista domów: `Wybierz dom · 5 z 7 dostępnych`.
- **Ruch:**
  - treść zwija się do góry (`clip-path` / `grid-template-rows: 0fr` + `translateY`), 320 ms `--ease-out`; rozwijanie tak samo;
  - **bez animowania `height` przez layout w każdej klatce** (płynność to wymóg usera);
  - przy `prefers-reduced-motion` natychmiast.
- **Scena:**
  - po zwinięciu wolne pole sceny (`freeRegion`, Kickiego `PhotoEntry` / `CameraRig` `setViewOffset`) rośnie o szerokość panelu i kamera **płynnie** przesuwa kadr na środek nowego pola (sprężyna camera-controls, ok. 0,6 s), bez skoku;
  - etykiety domów spod panelu stają się widoczne.
- **Szyna trybów** (Model 3D / Spacer / Rzut / Galeria) przesuwa się do lewej krawędzi sceny pod paskiem (top = dół paska + 12 px). Pigułka pięter i dolny pasek bez zmian.
- **CTA:** po zwinięciu „Umów prezentację” zostaje w nawigacji strony (złoty przycisk), a WhatsApp jako FAB, więc nic nie ginie.
- **Pamiętanie stanu:** `sessionStorage` (`domy.panel = "collapsed" | "open"`). Stan obowiązuje między osiedlem a domami w tej samej sesji. Wybór domu na scenie przy zwiniętym panelu **nie rozwija go**: aktualizuje się tylko treść paska, bo szanujemy decyzję użytkownika. Nie trafia do URL, bo link wysłany komuś ma otwierać panel rozwinięty.
- **Spacer:** panel jest tam schowany jak dotąd; po powrocie „← Model 3D” wraca do stanu sprzed spaceru.
- **Klawiatura:** przycisk w kolejności tab zaraz po breadcrumbie; Enter i Spacja przełączają. Esc nie zwija, bo Esc zostaje „poziom wyżej” (§3.1).
- **Mobile:** odpowiednikiem jest arkusz. Dochodzi stan **„schowany”**: sam uchwyt i jedna linia (`Dom A · 1 610 000 zł`, 48 px). Prowadzą do niego zsunięcie w dół albo chevron w panelu.
  - Tap w uchwyt przełącza zwinięty ↔ pełny, żeby do pełnego dało się dojść bez przeciągania (wersja wdrożona przez 85 i przyjęta 29.10).
  - Tap w linię stanu schowanego przywraca stan zwinięty (ok. 140 px).
  - Stan pamiętamy w `sessionStorage`.

## 4. Mobile (390×844, ok. 70% ruchu)

```
┌──────────────────────────────┐
│ ⌂ Halo Wawer        ☎   ☰    │
│ [Model][Rzut][Spacer][Galeria]│  ← segmenty trybów (górą sceny), tylko na poziomie domu
│                          ┌─┐ │
│                          │D│ │  ← pigułka pięter (prawa krawędź, w zasięgu kciuka)
│      [ scena ~60% ]      │1│ │
│                          │P│ │
│                          └─┘ │
│  ◐◐◐   ☀︎ ☼ ☾                │  ← mini-pasek: wystrój (3 kropki) + pora (ikony)
│ ┌──────────────────────────┐ │
│ │ ───                      │ │  ← uchwyt arkusza (SheetHandle)
│ │ Dom B · ● Dostępny       │ │
│ │ 119,77 m² · 1 600 000 zł │ │
│ │ [ UMÓW PREZENTACJĘ ] (◉) │ │  ← WhatsApp wchodzi do arkusza jako okrągły przycisk
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- **Bottom sheet** jak `SheetHandle.tsx` z Kickiego: śledzenie palca 1:1, rzut z prędkością, 3 progi.
  - **Zwinięty (ok. 140 px):** nazwa, status, metraż, cena i CTA.
  - **Połowa:** zł/m², historia cen, siatka 2×3.
  - **Pełny:** zwinięte sekcje „Pomieszczenia” i „Dokumenty (3)”. Ikona Udostępnij stoi w nagłówku arkusza.
- **Lista domów na mobile mieści się bez poziomego scrolla.** Szerokość 358 px (390 − 2×16) rozkłada się na kolumny 107 / 79 / 79 / 93 px:
  - `Dom A` + status pod spodem | `119,51 m²` | `98,82 m²` | `1,61 mln zł`;
  - liczby 14 px tabular; nagłówki kolumn 11 px wersaliki;
  - wiersz ma 56 px (cel dotyku ≥ 44 px).
- **Osiedle, arkusz zwinięty:** `Wybierz dom · 5 z 7 dostępnych` i poziomy rząd 7 chipsów `A · 1,61 mln`. To jedyny dozwolony poziomy scroll: w obrębie rzędu chipsów, nie całej strony. Tap w chip wybiera dom. Arkusz rozwinięty pokazuje pełną tabelę.
- **Spacer na mobile:**
  - arkusz zwija się do paska `Dom B · Salon` z ikoną CTA;
  - minimapa schowana pod okrągłym przyciskiem w lewym dolnym rogu;
  - zmiana punktu tapnięciem w hotspot;
  - wszystko jest obsługiwalne kciukiem w dolnych 2/3 ekranu.
- **Pora dnia na mobile:** ikony słońca wschodzącego, słońca i księżyca z `aria-label` „Rano”, „Dzień”, „Noc”.

## 5. URL, deep linki, OG, WhatsApp

**Trasy (rekomendacja):** `/domy` (osiedle) i `/domy/[dom]` (`a`–`g`).
- Segment dla domu zamiast `?dom=` daje trzy rzeczy:
  - `generateStaticParams`;
  - `opengraph-image.tsx` per dom;
  - panel domu renderowany po stronie serwera (SEO i LCP).
- Explorer siedzi w `app/domy/layout.tsx`, więc canvas się nie remountuje między `/domy` a `/domy/b` (wzorzec Kickiego).
- `/domy?dom=B&…` (format linków z Kreatora i nadzoru) robi 308 do `/domy/b?…` z zachowaniem reszty parametrów.

| Parametr | Wartości | Domyślnie |
|---|---|---|
| `widok` | `model`, `rzut`, `spacer`, `galeria` (na osiedlu: `plan`) | `model` |
| `poziom` | `dom`, `poddasze`, `pietro`, `parter`, `ogrod` (ten ostatni tylko w rzucie) | `dom` w modelu, `parter` w rzucie |
| `styl` | `s1`, `s4`, `s3` (id z Kreatora) | `s1` |
| `pora` | `rano`, `dzien`, `noc` | `dzien` |
| `punkt` | id punktu spaceru (`wejscie`, `salon`, `jadalnia`, `taras`, `ogrod`, `sypialnia`, …) | pierwszy punkt kondygnacji |

Przykłady:
- `/domy/b?widok=spacer&punkt=salon&styl=s4&pora=noc`
- `/domy/a?widok=rzut&poziom=pietro`

Zasady:
- Stan aktualizujemy przez `router.replace`, bez przewijania (`RouteState` z Kickiego).
- Link z jawną intencją (`widok`, `punkt`, `styl`, `pora`) startuje 3D od razu.

**Kreator → 3D:**
- CTA w Kreatorze „Zobacz ten styl w spacerze 3D” prowadzi do `/domy/{dom}?widok=spacer&punkt={pokój}&styl={id}`.
- Jeśli użytkownik wybrał w Kreatorze styl spoza 3 dostępnych w 3D (s2, s5, s6), link prowadzi do spaceru w s1, a etykieta CTA brzmi „Zobacz dom w spacerze 3D” (bez „ten styl”).

**OG:**
- `app/domy/[dom]/opengraph-image.tsx` (1200×630):
  - still domu od ogrodu (Dzień);
  - `Dom B · Halo Wawer`;
  - `119,77 m² · ogród 93,67 m²`;
  - `1 600 000 zł · 13 890 zł/m²`.
- P1: `generateMetadata` czyta `searchParams` i dla `widok=spacer` podstawia gotowy still `public/explorer/og/{layout}-{punkt}-{styl}.jpg`. Układy A=C i B=D dzielą stille.
- Font: Satori w `next/og` nie czyta woff2, potrzebny TTF Plus Jakarta Sans (OFL).

**WhatsApp:**
- Numer i szablon są w jednym module (`src/lib/contact.ts` według nadzoru).
- Treść zależy od kontekstu i **zawiera link do bieżącego widoku**, żeby doradca widział to samo:

```
Dzień dobry, interesuje mnie Dom B w Halo Wawer (styl Japandi). Proszę o kontakt.
https://…/domy/b?widok=spacer&punkt=salon&styl=s4
```

- Na osiedlu: „Dzień dobry, interesuje mnie osiedle Halo Wawer. Proszę o kontakt.”
- Zdarzenia analityczne: `whatsapp_click` i `cta_click` z `{dom, widok, styl}`.

## 6. Wystrój = „umeblowanie na 3 sposoby”

To jeden przełącznik, który zmienia jednocześnie **materiały i komplet mebli** (scenariusz życia). Nazwy i opisy są 1:1 z Kreatora na home (decyzja klienta: jeden system stylów).

| id | Nazwa (Kreator) | Opis (Kreator) | Swatche (propozycja) | Scenariusz umeblowania |
|---|---|---|---|---|
| s1 | Jasna skandynawska | len, jasny dąb, bouclé | `#e2d9c8` `#d4ab74` `#f1ece3` | **Rodzina 2+2**: stół na 6, 2 pokoje dziecięce, pokój hobby jako gabinet. |
| s4 | Japandi | jesion, papier ryżowy, czerń | `#cdb48e` `#efe7d8` `#23211f` | **Para + gabinet**: niskie meble, lampy z papieru, gabinet i pokój gościnny. |
| s3 | Grafitowa | antracyt, czarny dąb, marmur | `#3b3b3d` `#5a4434` `#e7e4df` | **Para + pokój gościnny**: ciemne akcenty, marmurowy stół, garderoba. |

- Swatche to propozycja wyprowadzona z palet `PAINTS`/`FLOORS` Kreatora. Kreator ich dziś nie ma. **Źródło prawdy: wspólny moduł stylów w `src/lib/estate`** (właściciel 8f), z którego czyta też Kreator.
- Rendery wnętrz dewelopera (jasny dąb w jodełkę, bouclé, szałwia) pasują do s1, dlatego s1 jest domyślny.
- Pełne specyfikacje materiałów i mebli: [02 §7](02-materialy-3d.md#7-wystroje-s1--s4--s3-materiały-i-meble).

## 7. Mikrocopy: hotspoty i etykiety (1 linia, konkret + korzyść)

Wartości bierzemy z danych (`houses.json`) i formatujemy z twardą spacją.

| Punkt | Wzorzec | Przykład (Dom B) |
|---|---|---|
| Wejście | `Wiatrołap z szafą · wejście pod zadaszeniem` | jw. |
| Salon | `Salon z jadalnią {strefa} m² · okno HS na ogród od południa` | Salon z jadalnią 27,26 m² · okno HS na ogród od południa |
| Kuchnia (A–D) | `Kuchnia otwarta na jadalnię i ogród` | jw. |
| Aneks (E, F) | `Aneks kuchenny {a} m² z oknem` | Aneks kuchenny 7,86 m² z oknem |
| Taras | `Taras {a} m² od południa · słońce do popołudnia` | Taras 6,98 m² od południa · słońce do popołudnia |
| Ogród | `Ogród {g} m² od południa · do własnej aranżacji` | Ogród 93,67 m² od południa · do własnej aranżacji |
| Sypialnia | `Sypialnia {a} m² · okno na ogród` | Sypialnia 13,81 m² · okno na ogród |
| Pokój | `Pokój {a} m² · na pokój dziecka lub gabinet` | Pokój 1 · 12,92 m² · na pokój dziecka lub gabinet |
| Łazienka | `Łazienka z oknem i wanną` | jw. |
| Garaż | `Garaż 18,47 m² · przejście prosto do domu` | jw. (B/D potwierdzone na rzucie, A/C do sprawdzenia) |
| Poddasze | `Poddasze nieużytkowe {a} m² · schowek nad całym domem` | Poddasze nieużytkowe 49,27 m² · schowek nad całym domem (E: 42,88, F: 44,30). Nazwa jak w karcie PDF: „nieużytkowe”, nie „do adaptacji”. |

**Uwaga o „słońcu do popołudnia”:** słońce świeci na elewację południową w czerwcu do ok. 17:00 (az. 266°), a w równonoc do ok. 18:00. Latem „złota godzina na tarasie” nie byłaby prawdą, bo zachód jest na NW. Dlatego presety pory dnia ustawiamy na 21 września (§6 w [02](02-materialy-3d.md#6-pora-dnia-prawdziwe-słońce)): niskie złote słońce z SW naprawdę wpada wtedy przez okno HS do salonu.

**Etykieta domu na scenie:** `B · 119,8 m² · 1,60 mln zł`. Na scenie zaokrąglamy do 1 miejsca po przecinku, w panelu podajemy dokładnie.

## 8. Tokeny (z `halo-wawer2.html`, bez nowych kolorów)

```css
--font-ui: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;   /* cały UI podstrony */
--gold: #d9a35b;        /* CTA główne, kropka „Dostępny”, aktywne obramowania */
--ivory: #f3eee8;  --page-white: #fefefe;  --stageInk: #fbf7f0;   /* tło rzutu */
--ink: #222220;  --muted: #6c655c;  --taupe: #a39588;  --line: #e7e0d5;  --chip: #f4f0e9;
--sel: #222220;  --selInk: #ffffff;   /* aktywny segment (jak Parter/Piętro w Kreatorze) */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
/* szkło (jasne, w każdej porze dnia) */
--glass-bg: rgb(251 247 240 / 0.72);  --glass-border: rgb(255 255 255 / 0.6);
--glass-blur: blur(20px) saturate(140%);  --glass-shadow: 0 10px 30px rgb(34 34 32 / 0.12);
```

**Typografia:**
- eyebrow 12/600, wersaliki, tracking 0,14 em, `--taupe`;
- tytuł 32/500, −0,02 em;
- cena 28/500;
- treść 14–15/400;
- liczby `tabular-nums`.
- Nagłówki sekcji mogą mieć złote podkreślenie słowa (`--hl-color`) jak na home, ale tylko na stronie, nie w panelu.

**Formatowanie:**
- `Intl.NumberFormat('pl-PL')`;
- twarda spacja przed `m²` i `zł`;
- półpauza w zakresach (`99,8–119,8 m²`);
- skrót `1,60 mln zł` tylko na scenie i na liście mobile.

**W porze Noc** panele zostają jasne (czytelność), ciemnieje tylko scena.

## 9. Dostępność i ruch

- Canvas ma `aria-hidden`. Każda akcja ze sceny ma odpowiednik w DOM (lista, szyna, pigułka, przyciski punktów spaceru w minimapie).
- `focus-visible`: obrys 2 px `--ink` z offsetem 2 px.
- Etykiety nad sceną: tło szkła daje kontrast ≥ 4,5:1 także w porze Noc.
- `prefers-reduced-motion`:
  - bez intra i auto-obrotu;
  - przeloty kamery zastąpione crossfade;
  - piętra bez rozsuwania;
  - kot siedzi bez ruchu.
- **Intro (P0):** to najtańszy, a zarazem najmocniejszy efekt pierwszego wrażenia.
  - Po pełnym wczytaniu 3D i przenikaniu ze zdjęcia jeden spokojny przelot (2–3 s): z pozy zdjęcia (od frontu, N) łukiem nad osiedlem na stronę ogrodów (SW, ok. 25° nad horyzontem), w porze Dzień, kiedy złote słońce leży na elewacjach południowych.
  - Na końcu kamera dociąga do pozy, od której zaczyna się orbita użytkownika.
  - Przerywa go dowolny gest (camera-controls przechodzi płynnie w sterowanie).
  - Po pierwszej interakcji nigdy więcej auto-ruchu.
  - Z linku z kontekstem (`/domy/a?widok=…`) intro leci od razu do celu, czyli do domu i widoku z linku, a nie nad całym osiedlem.

## 10. Ładowanie: wszystko z góry, potem zero przycięć

Decyzja usera: „projekty 3D muszą się po prostu załadować za wczasu tak, aby potem działały bez przycinania się”. Płynność ma pierwszeństwo przed szybkością pierwszego wyświetlenia. **W trakcie spaceru, przełączania stylów, pór dnia, pięter ani domów nic się nie doładowuje i nie kompiluje.**

**Ekran ładowania (w estetyce marki):**

```
┌──────────────────────────────────────────────────────────────────┐
│ [panel z listą 7 domów: działa]  │   zdjęcie osiedla, lekko      │
│                                  │   rozmyte i rozjaśnione       │
│                                  │                               │
│                                  │  Przygotowujemy osiedle w 3D  │
│                                  │   ───────────────────── 64 %  │  ← złota linia 2 px, procent tabular
│                                  │   Tekstury i meble            │  ← nazwa etapu
│                                  │   Wczytujemy wszystko z góry, │
│                                  │   żeby spacer działał płynnie.│
└──────────────────────────────────────────────────────────────────┘
```

- **Postęp jest prawdziwy i monotoniczny** (nigdy się nie cofa):
  - liczony z **manifestu assetów z rozmiarami w bajtach** (generowany przy buildzie);
  - nie z liczby plików: licznik `LoadingManager` z Kickiego liczy pliki, a jeden HDRI waży tyle co 30 mebli.
- **Etapy i ich waga w pasku:**

  | Etap | Udział w pasku | Co się dzieje |
  |---|---|---|
  | „Pobieranie modeli i tekstur” | 0–70% | bajty |
  | „Przygotowanie tekstur” | 70–90% | dekodowanie poza wątkiem i wgrywanie na GPU porcjami, `SceneGate` + `loading.tsx` z Kickiego |
  | „Ostatnie szlify” | 90–100% | kompilacja **wszystkich wariantów shaderów**, `warmup.ts` + `KHR_parallel_shader_compile` |

- **Wygląd ekranu:**
  - tło: `site-plan.png` z `filter: blur(6px)` i bielą `--ivory` α 0,55;
  - tekst `--ink`, linia postępu `--gold`;
  - bez spinnera na czarnym tle.
- **Przy `prefers-reduced-motion`:** bez animowanego połysku, tylko liczba i linia.
- **Koniec ładowania:**
  - 3 klatki renderowane pod przykryciem;
  - przenikanie zdjęcie → 3D (0,6 s);
  - intro (§9, P0).
- **Copy ekranu:** marka mówi w liczbie mnogiej: „Przygotowujemy osiedle w 3D”, „Wczytujemy wszystko z góry, żeby spacer działał płynnie.”
- **Co działa w trakcie ładowania** (DOM, nie 3D, więc nie wpływa na płynność):
  - panel z listą i kartą domu;
  - Rzut 2D i Galeria.
- **Co jest wyłączone do końca ładowania:**
  - przyciski Model 3D i Spacer w szynie (stan `aria-disabled`, podpis „Wczytywanie…”);
  - dolny pasek.
- **Klik w dom w trakcie ładowania** zapisuje intencję: panel od razu pokazuje kartę, a scena po starcie otwiera się na tym domu.

**Co wchodzi w preload (komplet, bez wyjątków):**
- makieta osiedla i bryły 7 domów;
- wnętrza wszystkich układów dostępnych w 3D, ze wszystkimi kondygnacjami;
- **komplet mebli i materiałów 3 wystrojów**;
- **oświetlenie 3 pór dnia**;
- tekstury, HDRI, minimapy i stille „Wizualizacji” spaceru;
- skompilowane shadery dla każdej kombinacji styl × pora × przezroczystość kondygnacji (osie `useWarmupAxis` z Kickiego).

**Jak zmieścić to w pamięci telefonu:**
- **pory dnia bez osobnych panoram:**
  - IBL z jednego neutralnego HDRI 1k (lekcja z Kickiego);
  - słońce i niebo proceduralne (`<Sky>`) z wektorów w `houses.json`;
  - za oknami widać **prawdziwą makietę osiedla**, a nie zdjęcie.
  - Zmiana pory to zmiana uniformów, bez nowych plików i bez rekompilacji.
  - W Kickiego każda panorama pory dnia kosztowała ok. 100 MB GPU, tutaj jej nie ma.
- **geometria proceduralna z danych** (Kickiego `build.ts`) prawie nic nie waży;
- **meble wspólne** dla układów, jeden zestaw na styl;
- KTX2 z meshopt, tekstury 1K.
- **Budżet [heurystyka]:**
  - pobranie ≤ ok. 25 MB na desktopie i ≤ ok. 15 MB na mobile (mobile: tekstury 512–1K, mniej roślin);
  - GPU ≤ ok. 150 MB na mobile.
  - Jeśli budżet nie wystarczy, **tniemy liczbę assetów, a nie ładujemy ich w trakcie**.

**Bez bramek zależnych od łącza** (decyzja usera): nie sprawdzamy Save-Data ani `effectiveType`, nie ma przycisku „Wczytaj 3D” ani trybu lite. Każdy odwiedzający dostaje pełny preload. Strona główna też nie ma trybu lite, więc obie strony działają tak samo.

**Prefetch z home** (zadanie dla 26, uzgodnić z 8f):
- po załadowaniu hero (zdarzenie `load` + `requestIdleCallback`) wykonać:
  1. `router.prefetch('/domy')`;
  2. `import()` chunku explorera, bez inicjalizacji;
  3. `fetch()` assetów z manifestu z niskim priorytetem (`priority: 'low'`), co wypełnia cache HTTP.
- Zawsze, bez warunków zależnych od łącza.
- **Warunek:** `public/explorer/**` musi dostać nagłówek `Cache-Control: public, max-age=31536000, immutable` i nazwy z hashem. Dziś `next.config.ts` ma ten nagłówek tylko dla `media|kreator`, więc trzeba dopisać `explorer` do wzorca (plik należy do 26).
- Wtedy wejście na `/domy` z home ładuje 3D z cache i pasek postępu przebiega w kilka sekund.

**Tryb awaryjny, jedyny wyjątek od pełnego 3D** (bez WebGL2, utrata kontekstu, błąd sceny): zdjęcie osiedla z poligonami, rzuty i galeria (Kickiego `StageBoundary`). Wszystko poza 3D działa.

## 11. Priorytety (dla 8f)

**P0: gotowe na demo**
- **Najpierw (decyzja usera 29.10): zwijanie panelu do góry (§3.6)**, na desktopie i mobile.
0. **Preload całości z ekranem postępu (§10)**, manifest z bajtami i zero doładowań w trakcie. Prefetch z home (26).
1. Osiedle:
   - wejście zdjęciem `site-plan.png` z poligonami senn;
   - lista 7 domów (§3.1) z synchronizacją hovera;
   - makieta 3D z przenikaniem ze zdjęcia;
   - pora dnia.
2. Karta domu (§3.2, wersja odchudzona):
   - cena, zł/m², siatka 2×3;
   - zwinięte sekcje: Historia cen, Pomieszczenia, Dokumenty (3);
   - Udostępnij;
   - 2 CTA i WhatsApp z kontekstem.
3. Rzut (P0: PNG + nakładka) dla wszystkich domów i kondygnacji. Dla G tylko dane (brak rzutów).
4. Model 3D **układu A** (bohater; decyzja usera 28.10, bo Kreator na home przechodzi na „Dom A”) z rozdzieleniem na piętra, 3 wystrojami (strefa dzienna, taras i sypialnia w pełni umeblowane) i 3 porami.
   - Układ A służy też domowi C (sprzedanemu).
   - **Kot z Kickiego zostaje** (decyzja usera: detal „ktoś tu mieszka”), na sofie w salonie A.
5. Spacer w układzie A: Wejście, Salon, Jadalnia, Taras, Ogród, schody, Sypialnia, Pokój i Łazienka, z minimapą.
6. Galeria, deep linki, OG per dom i bottom sheet na mobile.
7. **Intro**: przelot 2–3 s nad osiedlem na stronę ogrodów (§9). Przeniesione z P1, bo to największy efekt WOW pierwszego wrażenia przy małym koszcie.

**P1:**
- pozostałe układy w 3D: A↔B to lustro z różnicami, E i F jako jedna rodzina parametryczna;
- umeblowanie wszystkich pokoi;
- wektorowy rzut SVG;
- „Plan” osiedla;
- pasek kierunków;
- OG per widok;
- „Wizualizacja” w spacerze: rendery Kreatora `s1/s4/s3-{salon,kuchnia,sypialnia}.jpg` (układ A) w punktach Salon, Jadalnia i Sypialnia, dla wszystkich 3 stylów.

**P2:**
- tryb foto (path tracer);
- **splat prawdziwego osiedla z drona** (domy już stoją);
- panoramy 360°;
- spacer po poddaszu;
- wykres historii cen, gdy będzie więcej niż 1 wpis.
