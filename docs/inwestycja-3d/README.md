# Halo Wawer: podstrona 3D inwestycji (`/domy`). Research, UX i materiały

Stan na 29.10.2026. Autor: research/UX (sesje `demo-halowawer-bd`, potem `-66`). Ten folder (`docs/inwestycja-3d/**`) to jedyne miejsce, do którego piszę.

| Plik | Dla kogo | Zawartość |
|---|---|---|
| [01-ux-podstrona.md](01-ux-podstrona.md) | 8f, 26, nadzór | Ścieżka, układ desktop i mobile, lista domów, karta domu, rzut, spacer, URL i OG, WhatsApp, wystroje, mikrocopy, tokeny, a11y, **ładowanie (pełny preload)**, priorytety. |
| [02-materialy-3d.md](02-materialy-3d.md) | 8f | Źródła, rodziny geometrii, skala i orientacja rzutów, okna, dach, rozmieszczenie domów (metry), słońce, materiały stylów, punkty spaceru, kolory dachów. |
| [03-biblioteki.md](03-biblioteki.md) | 8f | Stack i zgodność z Next 16.4 / React 19.3, co z NOHO ONE, funkcja → technika, splat z drona (P2). |
| [04-wyglad-desktop.md](04-wyglad-desktop.md) | 85 (teren), 5d (światło) | Diagnoza wyglądu makiety na desktopie i propozycje według efektu WOW, z wartościami i miejscami w kodzie. |
| [qa-koncowe.md](qa-koncowe.md) | nadzór | Końcowe QA `/domy`: wynik skryptu, pomiary wyglądu start → teraz, punkty otwarte. |
| [assets/](assets/README.md) | 85 | Gotowe materiały: `drzewa.glb` (7 drzew: sosny, brzozy, dąb, lipa; EZ-Tree MIT, 4,2 MB) i 4 tekstury gruntu CC0. |
| [dane/houses.json](dane/houses.json) | 8f → `src/lib/estate` | 7 domów, 4 układy z pomieszczeniami, ceny, zł/m², historia cen, poligony site-planu, pozycje z PZT, style, pory dnia. Generator i kontrola sum w [dane/make_houses.py](dane/make_houses.py). |
| `zrodla/` | 8f | Pobrane z senn.pl: rzuty (A–F × 5), PZT, site-plan, hero, 6 wizualizacji, 8 zdjęć z drona, 10 wnętrz, karty PDF. |

## Decyzje w skrócie

1. **Ścieżka:** Osiedle (3D | Plan) → Dom (Model 3D | Rzut | Spacer | Galeria). W szynie najwyżej 4 tryby. Bez filtrów, suwaków i sortowania.
2. **Lista 7 domów w panelu to główne narzędzie porównania** (na home zostają tylko A, B i E):
   - 4 kolumny: dom + status | pow. | ogród | cena;
   - 2 grupy: bliźniaki i szeregowce;
   - na 390 px bez poziomego scrolla;
   - sprzedane wyciszone, ale klikalne.
3. **Karta domu to jedyne miejsce z zł/m² i „Historią cen”** (ustawa o jawności cen; user zdjął je z home). zł/m² bierzemy **z danych dewelopera**, bo liczy je bez klatki schodowej. Przykład: A ma 1 610 000 / (119,51 − 4,58) = 14 008,53.
4. **Rozdzielenie na piętra** w Modelu 3D (pigułka Dom · Poddasze · Piętro · Parter: rozsunięcie, potem dollhouse) to główny moment WOW. **Rzut 2D** działa bez WebGL.
5. **Wystrój = umeblowanie na 3 sposoby.** Jeden przełącznik zmienia materiały i komplet mebli. Nazwy z Kreatora: **s1 Jasna skandynawska · s4 Japandi · s3 Grafitowa**.
6. **Pora dnia z prawdziwym słońcem** (Zerzeń 52,189 N, ogrody na południe, 21 września):
   - Rano 8:30;
   - **Dzień 15:30**: złote słońce z SW wpada przez okno HS do salonu, zgodnie z renderami home;
   - Noc 19:15: niebieska godzina, ciepłe okna i kule ogrodowe.
7. **Wszystko ładuje się z góry** (decyzja usera):
   - ekran ładowania z prawdziwym postępem w bajtach („Przygotowujemy osiedle w 3D”);
   - interakcja dopiero po 100%;
   - zero doładowań i kompilacji w trakcie;
   - **bez bramek zależnych od łącza** (Save-Data, 2G); jedyny wyjątek to fallback przy braku WebGL2 lub błędzie;
   - prefetch z home po hero.
   - Potem **intro (P0)**: przelot 2–3 s nad osiedlem na stronę ogrodów.
8. **Bohater 3D to układ A** (decyzja usera): Kreator na home zmienia podpis na „Dom A”, a jego rendery s1/s4/s3 posłużą jako „Wizualizacja” w spacerze. **Kot z Kickiego zostaje** na sofie w salonie.
9. **Stan w URL:** `/domy/[dom]?widok=&poziom=&styl=&pora=&punkt=`, OG per dom, WhatsApp z treścią i linkiem do bieżącego widoku.
10. **Stack bez zmian względem Kickiego** (three 0.186.1, r3f 9.8.2, drei 10.7.9, r3f-pp 3.2.2, zustand 5). Jedyna nowa zależność to `react-zoom-pan-pinch`. Ograniczenia: **React < 19.4, three < 0.187**.

## Dane w pigułce (senn.pl, 28.10.2026)

| Dom | Typ | Pow. | Ogród | Cena | zł/m² | Status | Rzut |
|---|---|---|---|---|---|---|---|
| A | bliźniak, garaż + 1 m.p. | 119,51 m² | 98,82 m² | 1 610 000 zł | 14 008,53 | dostępny | A |
| B | bliźniak, garaż + 1 m.p. | 119,77 m² | 93,67 m² | 1 600 000 zł | 13 890,09 | dostępny | B |
| C | bliźniak | 119,51 m² | 85,33 m² | — | — | sprzedany | = A |
| D | bliźniak, garaż + 1 m.p. | 119,77 m² | 86,27 m² | 1 590 000 zł | 13 803,28 | dostępny | = B |
| E | szeregowiec skrajny, 2 m.p. | 99,80 m² | 78,41 m² | 1 490 000 zł | 15 647,97 | dostępny | E |
| F | szeregowiec środkowy, 2 m.p. | 102,97 m² | 38,26 m² | 1 450 000 zł | 14 737,27 | dostępny | F |
| G | szeregowiec skrajny | 100,86 m² | 184,87 m² | — | — | sprzedany | brak (404) |

Pozostałe dane:
- 5 pokoi w każdym domu;
- wysokość kondygnacji 2,64 m;
- poddasze nieużytkowe (karty PDF): A–D 49,27 m², E 42,88 m², F 44,30 m², maks. wysokość 2,25 m;
- odbiór 11.2026;
- historia cen: jeden wpis 24.04.2026.

## Kod Kickiego: co przerobić

8f skopiował explorer do `src/components/explorer/**`. Mapa zmian:

| Kickiego | Halo Wawer | Zmiana |
|---|---|---|
| `explorer/PhotoEntry` | wejście `site-plan.png` | Poligony senn (dokładne) zamiast własnych. Kamera dopasowana PnP. Zdjęcie jest też tłem ekranu ładowania. |
| `three/building/*` (`Maquette`, `massing`, `Units`, `Site`) | makieta osiedla | 7 brył z `pzt`, dach 2-spadowy W–E, dachy w 3 kolorach. `Units` to domy. Widok kondygnacji budynku znika. |
| `explorer/FloorPicker` | pigułka Dom / Poddasze / Piętro / Parter (Rzut: + Ogród) | Dochodzi rozsuwanie pięter (`maath` `damp3`). |
| `three/apartment/build.ts`, `Shell.tsx` | dom wielokondygnacyjny | N kondygnacji, stropy, schody, dach, poddasze. Cutaway per kondygnacja. |
| `lib/apartments/geometry/l64.ts` | `lib/estate/geometry/{blizniak,szeregowiec}.ts` | 2 rodziny: bliźniak z `mirror` (A↔B), szereg parametryczny (E/F, G = lustro E). |
| `three/materials/specs.ts` | style s1 / s4 / s3 | Sloty według [02 §7](02-materialy-3d.md#7-wystroje-s1--s4--s3-materiały-i-meble). |
| `three/furniture/l64/*` | meble per rodzina × styl | P0: strefa dzienna, taras i sypialnia w 3 stylach. |
| `three/lighting/*` | presety z `houses.json → timeOfDay` | **Bez panoram per pora**: niebo proceduralne, a za oknem makieta. |
| `three/walk/Walk.tsx`, `explorer/WalkHud.tsx` | spacer + minimapa z `P · 1` | Schody jako przejście między kondygnacjami. |
| `panel/UnitList`, `panel/ApartmentPanel` | lista domów (grupy), karta domu | Bez filtrów. Historia cen, pomieszczenia, PDF-y. |
| `explorer/RouteState` | `/domy/[dom]` + parametry | 308 z `/domy?dom=` na segment. |
| `three/SceneGate`, `loading.tsx`, `warmup.ts`, `prefetch.ts` | **pełny preload** | `prefetch.ts` (dziś ładuje style po `settled`) wchodzi do preloadu przed startem. Postęp liczony w bajtach z manifestu. |
| `explorer/SheetHandle`, `Gallery`, `DissolveOverlay`, `StageBoundary` | bez zmian | Galeria dostaje 3 chipsy. |
| `app/mieszkania/[slug]/opengraph-image.tsx` | `app/domy/[dom]/opengraph-image.tsx` | Font TTF Plus Jakarta Sans. |
| `three/furniture/cat` | salon układu A | **Zostaje** (decyzja usera: detal „ktoś tu mieszka”). |

## Decyzje i otwarte punkty (stan końcowy, 29.10.2026)

### Rozstrzygnięte

| # | Temat | Decyzja | Stan |
|---|---|---|---|
| 1 | Kreator na home podpisywał rzut „Dom B”, a dane były domu A. | Kreator → „Dom A”, układ A to bohater 3D, rendery Kreatora s1/s4/s3 jako „Wizualizacja”. | ✔ („Urządź dom A”) |
| 2 | Metraż „Salon” i „Kuchnia” w Kreatorze (oba 26,92). | Podpis „strefa dzienna 26,92 m²”. | ✔ |
| 3 | Pora dnia. | Rano / Dzień / Noc, słońce z 21 września. Noc to niebieska godzina: elewacje mają jasność ok. 101–130, okna ciepłe. | ✔ |
| 4 | Czas startu kontra płynność. | Pełny preload, 0 przycięć po starcie, bez bramek zależnych od łącza (Save-Data, 2G). | ✔ (zmiana stylu, pory, trybu i domu pobiera 0 plików) |
| 5 | `immutable` dla plików 3D. | `/explorer/:path*` w `next.config.ts`. | ✔ |
| 6 | Elewacje (biel z drona kontra greige z renderów). | Makieta w ciepłej palecie, prawdziwe kolory dachów, podpis „Położenie domów poglądowe”. | ✔ |
| 7 | Intro i kot. | Intro w P0 (przelot na stronę ogrodów), kot zostaje. | ✔ (intro działa po wczytaniu) |
| 8 | Wygląd makiety na desktopie (29.10, [04](04-wyglad-desktop.md)). | Drzewa EZ-Tree (sosny, brzozy, dąb, lipa), las sosnowy z impostorów zamyka horyzont, łąka z detalem i makroszumem, okna z interior mappingiem. Światło według pomiarów (cień ok. 120–148, Noc ok. 101–130). | ✔ wdrożone; poprawki końcowe w trakcie (85) |
| 9 | Panel nad sceną zasłania i przytłacza (user, 29.10). | Panel zwijany do góry z paskiem jednej linii ([01 §3.6](01-ux-podstrona.md)), na mobile stan „schowany”. | w trakcie (85), P0 nr 1 |
| 10 | Dane domów. | Jedno źródło w `src/lib/estate`, zł/m² z groszami według reguły dewelopera (PN-ISO 9836, bez klatki schodowej), poddasze „nieużytkowe” z kart PDF, sprzedane bez ceny i historii. | ✔ |

Domykanie u 85 (ostateczna lista nadzoru, 29.10):
1. panel zwijany;
2. SiteNav na `/domy`, CTA otwierające LeadForm na miejscu, `og:image` dla `/domy/[dom]`, rzuty Kreatora dla A/C, liczby z buildu produkcyjnego;
3. 5 poprawek z pomiaru (jasność łąki, pasy koszenia tylko w ogrodach, kostka podjazdu, niezapalone okna w Noc, bramy garażowe), łatka alfy, kamera osiedla ok. 20–25°;
4. bez mebli na tarasach i bez nowych funkcji;
5. higiena: usunięcie `src/app/domy-lab`, lint 0 błędów, build produkcyjny.

Końcowe QA (research/UX) robię po raporcie 85 i wysyłam do nadzoru.

### Otwarte po stronie klienta, przed publikacją

| # | Temat | Co trzeba | Dlaczego |
|---|---|---|---|
| K1 | **Ceny miejsc postojowych i elementów dodatkowych.** | Deweloper podaje ceny albo pisemnie potwierdza, że są w cenie domu. Do tego czasu w karcie tylko „garaż + 1 miejsce” / „2 miejsca”, bez ceny i bez „w cenie”. | Ustawa o jawności cen wymaga cen elementów dodatkowych. |
| K2 | **Historia cen.** | Dziś 1 wpis (24.04.2026). Każdą zmianę ceny trzeba dopisać w `src/lib/estate` z datą i zł/m². | Wymóg ustawy; UOKiK. |
| K3 | **Prawa do materiałów senn.pl** (rendery, zdjęcia z drona, rzuty, karty PDF). | Zgoda dewelopera na użycie poza jego stroną (w demo używamy roboczo). | Prawa autorskie. |
| K4 | **Kontakt.** | Potwierdzenie numeru +48 733 80 90 90 dla WhatsApp i telefonu oraz obietnicy czasu odpowiedzi z formularza („do 15 minut w godzinach pracy”). | Obietnica w copy musi być realna. |
| K5 | **Docelowy kolor elewacji.** | Biel (stan z drona 04.2026) czy greige z renderów. Makieta jest neutralna, ale galeria i opisy nie mogą obiecywać czegoś innego niż budowa. | Zgodność z rzeczywistością. |
| K6 | **Szczegóły do potwierdzenia u dewelopera.** | Przejście z garażu do domu w A/C (B/D: widoczne na rzucie); przypisanie kolorów dachów do domów (z drona, pewność średnia). | Mikrocopy i makieta. |
| K7 | **Dom G.** | Brak rzutów i karty na senn.pl (404). Dom jest sprzedany, więc niski priorytet. W makiecie G to lustro E. | Kompletność danych. |
| K8 | **Copy marketingowe.** | „120 m²”, „ogród do 180 m²” tylko z „ok.”, w UI zawsze dokładnie (119,51 / 184,87). | Spójność danych. |

### Po demie (P1/P2, bez blokowania publikacji)

- wektorowy rzut SVG z geometrii i „Plan” osiedla;
- obraz OG per widok;
- tekstury KTX2 i lżejszy zestaw na mobile;
- meble na tarasach (A6);
- pozostałe układy w pełnym 3D;
- tryb foto (path tracer);
- **splat prawdziwego osiedla z drona** (domy stoją; WebODM → Spark), gdy teren będzie zagospodarowany.
