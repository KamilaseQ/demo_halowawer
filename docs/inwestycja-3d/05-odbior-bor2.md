# Makieta BOR2: kryteria odbioru (klient)

Stan na 04.11.2026. Autor: b6 (koordynacja, odbiór po stronie klienta). Plik jest wspólną listą kontrolną dla 55 (runtime), 59 (wygląd zewnętrza), e3 (QA wizualne) i wykonawcy wnętrz.

## Decyzja

Proceduralna makieta (`src/components/explorer/three/estate/houses.ts`, `roof.ts`, meble `furniture/b/**`) jest **zastępowana** modelem dewelopera BOR2 (SketchUp → .blend → GLB). Nie optymalizujemy ani nie poprawiamy starej makiety.

## Podział pracy

| Kto | Zakres | Pliki |
|---|---|---|
| 59 | Materiały, tekstury i światło zewnętrza w Blenderze (MCP na wyłączność), eksport GLB, nazwy węzłów | `assets/bor2/bor2-zewnetrze*`, `wyglad_*.py` |
| wykonawca wnętrz | dom1 (G) i dom2 (B): materiały, lightmapy, brakujące pokoje, eksport GLB (tylko Blender headless) | `assets/bor2/bor2-wnetrze-dom*`, `wnetrze_*.py`, `wnetrza-lm/` |
| wykonawca okolicy | Prawdziwe sąsiedztwo z OpenStreetMap jako szare „duchy” (budynki z dachami, ulice, boisko), w układzie BOR2 | `assets/okolica/**` |
| wykonawca roślin | Zestaw roślin z kart z alfą (trawy ozdobne, byliny, krzewy, żywopłot) wg renderów, mapowanie na znaczniki `ZIELEN_ZNACZNIKI` od 59 | `assets/zielen/**` |
| 55 | Wpięcie GLB w `/domy`, kamera, spacer po osiedlu i we wnętrzu, ładowanie, culling, wydajność | `src/components/explorer/**`, `src/app/domy/**`, `docs/explorer/**` |
| e3 | Zestaw ujęć porównawczych render ↔ kamera, QA wizualne (read-only) | `assets/bor2/ujecia-porownawcze.json`, `podglad/porownanie-*` |
| b6 | Kryteria, weryfikacja wymiarów, odbiór | ten plik |

## Wymiary: zweryfikowane (b6, pomiar headless obrysów w `bor2-zewnetrze.blend`)

Układ SketchUpa: X = wschód, Y = północ, Z = góra, metry. Wnętrza dom1/dom2 są w tym samym układzie.

| Element | Model BOR2 | Rzuty / PZT (02 §3, §5) | Wynik |
|---|---|---|---|
| Bliźniak, bryła | 8,20 × 10,10 m | 8,18 × 9,95 (PZT 8,23 × 10,0) | ✔ |
| Szeregowiec, bryła | 7,60 × 9,63 m | 7,47 × 9,56 (PZT 7,6 × 9,7) | ✔ |
| Przerwy między segmentami | 9,6 m | ok. 9,3 m | ✔ |
| Schodkowanie na wschód | ok. 1,5 m na dom | 1,3–1,6 m | ✔ |
| Dach (bliźniak) | okap ok. 6,05 m, kalenica ok. 9,0 m nad terenem | nachylenie 27–35° | ✔ (do potwierdzenia na `estate-2`) |

Domy (z zachodu): G = `Component#40`, F = `#39`, E = `#35`, D = `#94`, C = `#119`, B = `#57`, A = segment w `#88`.
Wnętrza: dom1 = G (E = lustro, F ≈ kopia), dom2 = B (D = kopia, A i C = lustro).

## Kryteria odbioru

Odbiór na zestawie ujęć porównawczych e3: zrzut z `/domy` (build produkcyjny) obok renderu dewelopera z tej samej kamery.

### P0: musi być, inaczej nie odbieram

1. **Model rzeczywisty.** Na makiecie stoją bryły BOR2, nie proceduralne. Wymiary jak w tabeli wyżej, ±5 cm. Wysokości kondygnacji około 2,64 m w świetle.
2. **Klik w dom otwiera kartę i wejście do wnętrza.** Wnętrze odpowiada modelowi BOR2_WNĘTRZA: ten sam układ ścian, mebli i otworów. Brakujące pokoje są proste, ale kompletne.
3. **Okna wnętrza pokrywają się z otworami bryły** we wszystkich 7 domach (±3 cm). Z zewnątrz nic z wnętrza nie wystaje.
4. **Spacer po osiedlu.** Oczy na 1,65 m, kolizje ze ścianami i płotami, start przy wjeździe, wejście do domu z poziomu spaceru.
5. **Spacer we wnętrzu** po kondygnacjach, schody przechodnie.
6. **Ładowanie.** Ekran ładowania na start (osiedle) i przy wejściu do domu (wnętrze). Potem zero doładowań i kompilacji: żadnych przycięć powyżej 50 ms. Wnętrze nie jest renderowane, gdy patrzymy z zewnątrz; we wnętrzu nie renderujemy osiedla poza tym, co widać przez okna.

### P1: wygląd (oceniany obok renderów)

| Ujęcie | Wzorzec | Co musi się zgadzać |
|---|---|---|
| Ogrody od południa | `visualization-1` | Tynk w 2 odcieniach greige (jasny ciepły szary i taupe), dach na rąbek w kolorze zbliżonym do tynku, kominy w kolorze dachu, ciemnobrązowa stolarka z głębokim osadzeniem (cień we wnęce), ciemne szyby z odbiciem nieba, płot panelowy antracyt, tarasy z jasnych płyt, bujne trawy ozdobne i byliny przed płotem |
| Wieczór, front, szczyty | `visualization-2…6` | Zróżnicowanie kolorów domów jak na renderach (beż, taupe, ciemna zieleń, brąz), ciepłe okna wieczorem |
| Salon dom1 | `interior-4/5/6` | Jasna dębowa podłoga, ciepła biel ścian i sufitu (nie szarość), kremowa sofa, kostki z białego marmuru, dywan w szachownicę, lniane zasłony z fakturą, miękkie dzienne światło |
| Sypialnia, pokój dziecka | `interior-7/8` | Szałwia, dąb, łóżko-domek |
| Strefa dzienna dom2 | `interior-1/2/3` | Jodełka, biały owalny stół, dębowe fronty, zielone lamele |

- **Osiedle** jest bujne i zielone: trawa, trawy ozdobne, byliny, drzewa.
- **Okolica** to wyszarzone „duchy”: jednolity jasnoszary mat, bez tekstur, bez cegły i czerwonych dachów.
- Wszystko, co **nie zmienia obrazu**, upraszczamy bez pytania.

### Miara odbioru

Scorecard e3 (`assets/bor2/scorecard/`) liczy ΔE (CIELAB) median regionów: zrzut z `/domy?kadr=<render>` obok renderu, z kamerą, FOV i przesunięciem obiektywu z `ujecia-porownawcze.json`.

| Regiony | Próg ΔE |
|---|---|
| Ściany, dachy, podłogi | ≤ 10 |
| Szyby, zieleń | ≤ 15 |

### Rozstrzygnięcia

- **Render czy stan z budowy** (kolory dachów i ram na zdjęciach z drona są inne niż na renderach): obowiązują **rendery i schematy architekta**, bo klient chce wyglądu „jak na wizualizacjach”. Ryzyko rozbieżności z budową zostaje w punkcie K5 README.
- **Podłogi:** w dom1 (G) proste deski dębowe, w dom2 (B) jodełka, tak jak na renderach.
- **Kolory i materiały:** obowiązuje render, a model SKP daje tylko geometrię.
- **Przełącznik stylu wnętrza s1/s4/s3:** ukryty dla domów BOR2, bo to projekt dewelopera.

## Odrzucone formy (nie przyjmę)

- Okna jako płaskie zielone lub szare płyty.
- Mleczne, plastikowe zasłony-płachty.
- Szare ściany wnętrz.
- Kolory płaskie bez tekstur na podłogach i meblach.
- Węzły GLB bez identyfikacji domów (`Component#7`).
- Każde „wygląda dobrze” bez zrzutu obok renderu.
