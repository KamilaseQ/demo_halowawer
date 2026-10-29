# Halo Wawer — brief klienta, research sprzedażowy i checklista akceptacji

Autor: agent nadzorujący (sesja `demo-halowawer-15`), reprezentuje klienta.
Folder `docs/nadzor/**` należy do nadzoru, pozostałe foldery do was.
Data: 2026-10-28.

Podział ról (uzgodniony między wami, akceptuję):
- `demo-halowawer-26`: strona główna (Next.js z `halo-wawer2.html`), root layout, nawigacja, globals.
- `demo-halowawer-bd`: research i UX podstrony 3D, pisze tylko do `docs/inwestycja-3d/**`.
- `demo-halowawer-8f`: moduł 3D, czyli `src/app/domy/**`, `src/components/explorer/**`, `src/lib/estate/**` i `public/explorer/**`.

---

## 1. Poprzeczka wizualna (na podstawie zdjęć od klienta)

Wzorce to **Kickiego 27** (`C:\Users\212ka\source\repos\demo_Dominik`, ulubiony projekt klienta) i **NOHO ONE**.

Na zdjęciach klient pokazał, czego oczekuje:
- **UI ograniczone do minimum.** Jeden szklany panel z listą lokali ma 4 kolumny: typ, powierzchnia, taras lub ogród, cena ze statusem pod spodem. Nic więcej.
- **Przełącznik trybów** to pionowa szklana szyna z 2–3 przyciskami (ikona + podpis): `Budynek / Piętro` albo `Model 3D / Spacer / Galeria`.
- **Wybór pięter** to pionowa pigułka po prawej (3, 2, 1, P i strzałki).
- **Dolny pasek sterowania** ma trzy elementy: style wystroju (3 swatche i nazwa) | `Rano / Dzień / Wieczór` | zoom − +.
- **Etykieta na obiekcie** to szklana pigułka: `64 m² · 2 pok. · 1,49 mln zł`.
- **Panel lokalu**: status, nazwa, krótki opis, duża cena, zł/m² z datą, rozwijana „Historia cen”, siatka 2×2 z parametrami i styl wykończenia. Na dole zawsze widoczne: **UMÓW PREZENTACJĘ** (złoty, pełny) + **WHATSAPP** (outline).
- **Pływający przycisk WhatsApp**: złote koło w prawym dolnym rogu, na każdym widoku.
- **Nawigacja**: wordmark, wersaliki z trackingiem, telefon i obrysowany przycisk CTA.
- **Spacer**: minimapa z punktami w lewym dolnym rogu, przycisk „← Model 3D” w lewym górnym.
- Ciepła paleta (taupe, złoto, ivory), dużo powietrza, duże obrazy, tempered glass i Apple-like spokój.

Szkic dewelopera (żółte dymki, czerwone sprzedane domy) to **anty-wzorzec formy**. Informacja jest dobra, forma nie.

## 2. Obecna strona senn.pl — co musimy przebić

Audyt strony https://senn.pl/inwestycje/osiedle-halo-wawer:
- brak rzutów i spaceru 3D na stronie inwestycji;
- zakładka „Film” jest, ale bez treści;
- **brak WhatsApp i chatu**;
- **brak historii cen**, choć to wymóg ustawowy (§3, pkt 8);
- sprzedane domy C i G są w tabeli bez kontekstu;
- tabela cen na mobile wymaga przewijania w poziomie;
- 2 ciężkie formularze ze zgodami;
- treści lifestyle są generyczne („komfort”, „spokój”);
- dane są niespójne: 120 m² w opisie i 119,5 m² w tabeli, ogród „do 180 m²” w opisie i 184,87 m² w tabeli.

Każdy z tych punktów musi u nas wypaść wyraźnie lepiej.

## 3. Research: co sprzedaje nieruchomości premium i co poprawia UX

Siłę dowodu oznaczam tak: **[mocny]** to duże badanie lub ankieta, **[kierunkowy]** to badanie sponsorowane lub pojedyncze A/B, **[praktyka]** to opinia branży.

1. **Zdjęcia, szczegółowe dane i rzuty to top-3 funkcji stron nieruchomości** [mocny]. Według NAR 2025 jako „bardzo przydatne” oceniło je odpowiednio 83%, 79% i 57% kupujących, a wirtualne spacery 41%, wideo 29%.
   → Rzut i komplet danych mają być 1 klik od każdego domu. Spacer to warstwa WOW, nie zastępuje rzutu.
2. **Spacery 3D przyspieszają sprzedaż** [kierunkowy]. Badanie Matterporta na danych MLS z 4 rynków: sprzedaż do 31% szybsza i cena do 9% wyższa. Porównanie 350 na 350 domów: 20% szybciej, +4,8% ceny.
3. **Szybkość strony to pieniądze** [mocny; badanie Deloitte zlecone przez Google]. Na mobile 0,1 s szybciej daje +21,6% przejść od pierwszego kroku formularza do wysłania i +20,6% wejść na „Kontakt” (segment lead-gen).
   → Ciężkie 3D i wideo ładujemy leniwie, a natychmiast pokazujemy plakat.
4. **Speed-to-lead** [mocny; MIT i InsideSales 2007, 15 tys. leadów]. Kontakt w ciągu 5 minut zamiast 30 daje 100× większą szansę dodzwonienia się i 21× większą szansę kwalifikacji.
   → WhatsApp i krótki formularz z obietnicą czasu odpowiedzi.
5. **WhatsApp** [kierunkowy]. Nie ma niezależnych badań. W nazwanym case study Lamudi/Meta przycisk dał +8%, większe liczby to anegdoty. Uzasadnienie jest takie: to najniższy próg kontaktu, zwłaszcza na mobile i wieczorem, kiedy biuro jest zamknięte.
   → Wiadomość ma być **wypełniona kontekstem**: dom, styl, widok.
6. **Sticky CTA** [kierunkowy, kilka A/B]. Daje od +8% do +20% konwersji, prawie wyłącznie na mobile. Gdy CTA jest już widoczne w miejscu decyzji, sticky tylko zaśmieca ekran.
   → Ukrywać sticky bar, gdy sekcja kontaktu jest w kadrze.
7. **Formularze** [kierunkowy]. Każde pole ponad 3 obniża konwersję, a pole telefonu średnio o około 5% (Unbounce, źródła wtórne).
   → Imię, telefon, dom (wstępnie wybrany) i 1 zgoda. E-mail opcjonalny.
8. **Prawo: ustawa o jawności cen** [mocny, obowiązuje od 11.07.2025, a dla starszych inwestycji od 11.09.2025]. Na stronie dewelopera muszą być: cena, cena za m², historia zmian cen od początku sprzedaży oraz ceny elementów dodatkowych (garaż, miejsce postojowe). UOKiK może nałożyć karę do 10% obrotu.
   → Kickiego 27 robi to dobrze („Historia cen” zwinięta w panelu). Na senn.pl tego brakuje, więc to dla nas przewaga, a nie tylko obowiązek.
9. **Emocje sprzedają, logika uzasadnia** [praktyka]. W segmencie premium sprzedaje się życie, nie metry. Konkretny detal działa lepiej niż ogólnik: „ręcznik na leżaku” zamiast „basen”.
   → Każda korzyść w formie „konkret + obraz życia”, np. „Ogród 94 m² od południa: słońce na tarasie do wieczora”.
10. **Scroll-jacking i nadmiar ruchu** [praktyka, dostępność]. Odbiera kontrolę i szkodzi osobom z zaburzeniami błędnika.
    → `prefers-reduced-motion`, bez blokowania scrolla, a pierwsze CTA widoczne bez przewijania przez długą animację.
11. **Mobile** [kierunkowy]. Około 70% kupujących szuka na telefonie lub tablecie (NAR 2025, źródło wtórne).
    → Każdą funkcję projektujemy najpierw pod kciuk.
12. **Konfigurator wystroju** [praktyka]. Zamienia oglądanie w udział, a kupujący „widzi siebie” w domu. Nie ma twardych danych, ale jest spójne z celem WOW klienta.

## 4. Decyzje klienta (obowiązują wszystkich)

1. **Mniej mylących funkcji.** Mamy 7 domów, więc **żadnych filtrów ani suwaków**. NOHO ONE ma 88 lokali i tam filtry mają sens, u nas byłyby szumem. Wystarczy lista 7 domów, a sprzedane są wyciszone.
2. **Jeden system nazewnictwa stylów.** Kreator wnętrz na stronie głównej ma 6 stylów: Jasna skandynawska, Ciepła naturalna, Grafitowa, Japandi, Klasyczna elegancka, Hamptons. **3 wystroje w 3D muszą być podzbiorem tych nazw**, z tymi samymi opisami i swatchami. Rekomenduję: **Jasna skandynawska / Japandi / Grafitowa**, bo dają kontrast jasny, naturalny i ciemny. Dwa różne systemy stylów to dokładnie ta „myląca funkcja”, której klient nie chce.
3. **Jedno źródło danych.** Ceny, metraże, statusy i historia cen są w `src/lib/estate` (właściciel: 8f). Strona główna importuje je stamtąd i **nie ma cen wpisanych na sztywno w komponentach**. Dzięki temu nie powtórzymy niespójności z senn.pl.
4. **Lead nie wychodzi ze strony.** Dziś 3 linki prowadzą do `senn.pl/en/...`, w dodatku do **angielskiej** wersji. W demo mają prowadzić wewnątrz: `/domy`, galeria, formularz na stronie.
5. **CTA**: jedna główna akcja **„Umów prezentację”** (złota) i **WhatsApp** jako druga, wszędzie tymi samymi słowami. Strona główna ma dziś „Umów wizytę”: wybierzcie jedną nazwę i trzymajcie się jej w home i w 3D. Rekomenduję „Umów prezentację”, bo obejmuje wizytę na osiedlu i online.
6. **Statusy w palecie marki, nie neonowe.** Dostępny to ivory ze złotym punktem, Rezerwacja to taupe, Sprzedany to wyszarzone i mała etykieta. Zielony #17b26a i czerwony #e31e44 z senn.pl odpadają, bo rozbijają premium.
7. **Numer i treść WhatsApp w jednym miejscu konfiguracji**, np. `src/lib/contact.ts`. Na razie +48 733 80 90 90 z HTML.
8. **Typografia polska**: twarda spacja przed jednostkami (`119,8 m²`, `1 600 000 zł`), półpauza w zakresach (`100–120 m²`).

### 4a. Decyzje użytkownika z 2026-10-28 (rozstrzygają §5.1)

Zatwierdzone:
- pływający WhatsApp i często powtarzające się CTA (cytat z briefu użytkownika: „koniecznie widget whatsapp, często powtarzające się CTA”);
- formularz na stronie;
- sticky pasek na mobile;
- główne CTA w całym serwisie: **„Umów prezentację”**.

Odrzucone na stronie głównej:
- 5 kart domów, zostają 3 (A, B, E);
- zł/m² i historia cen na kartach.

**Te dane są więc obowiązkowe w panelu domu na `/domy`**, bo to jedyne miejsce z pełną listą 7 domów i danymi cenowymi.

**Ładowanie: płynność ponad szybkość pierwszego wyświetlenia.** Ta decyzja ma pierwszeństwo przed §3 pkt 3 i przed wcześniejszymi zaleceniami o leniwym lub progresywnym ładowaniu. Cytat użytkownika: „Na tej animacji 3D w hero bardzo mi zależy więc niech strona ładuje się za wczasu, tak samo jak projekty 3D muszą się po prostu załadować za wczasu tak aby potem działały bez przycinania się.”

Zasady:
- **Hero**:
  - elegancki preloader z prawdziwym postępem;
  - animacja startuje dopiero po pełnym pobraniu i zdekodowaniu;
  - bez degradacji zależnej od łącza, a fallback tylko przy błędzie;
  - scrubbing: sekwencja klatek na canvasie albo wideo all-intra;
  - wymóg: 60 fps bez zgubionych klatek.
- **3D**:
  - pełny preload (modele, tekstury, HDRI, wszystkie 3 style i 3 pory dnia);
  - shadery skompilowane z góry (`compileAsync` / `<Preload all />`), tekstury wysłane na GPU przed startem;
  - zero doładowań w trakcie interakcji.
- **Między stronami**: home po załadowaniu hero prefetchuje `/domy` i assety 3D w `requestIdleCallback`, przez funkcję wystawioną przez 8f.
- `prefers-reduced-motion` zostaje, bo to ustawienie dostępności, a nie oszczędzanie transferu.

Decyzje po przeglądzie specu 3D (spec `docs/inwestycja-3d/` zaakceptowany):
- **Kreator na home przechodzi na „Dom A”**, bo jego geometria i metraże są z A. **Dom A to układ-bohater 3D.**
- **Kot z Kickiego zostaje** jako detal „ktoś tu mieszka”.
- **Parking:** ceny nieznane, więc piszemy tylko „garaż + 1 miejsce” / „2 miejsca”, bez sformułowania „w cenie”. Do uzupełnienia przed publikacją.
- **Pory dnia:** Rano / Dzień / Noc (słowa użytkownika). Słońce z 21 września.
- **Makieta osiedla:** glina w ciepłej palecie marki, z prawdziwymi kolorami dachów.
- **Intro 3D w P0.** Bez bramek Save-Data/2G na `/domy`.

## 5. Wytyczne dla każdego agenta

### 5.1 Strona główna (`demo-halowawer-26`)

Klient zakazał zmiany wyglądu. Wszystko poniżej to **warstwa sprzedażowa w istniejącym języku wizualnym**: Plus Jakarta Sans, `--gold`, `--ivory` i istniejące klasy przycisków.

P0:
1. **Pływający przycisk WhatsApp**: złote koło w prawym dolnym rogu, jak w Kickiego. Link `wa.me` z wiadomością zależną od kontekstu, `aria-label`. Nie może zasłaniać CTA ani banera cookies. Pojawia się po hero.
2. **Sticky bar na mobile** po hero: `[Zadzwoń] [WhatsApp]`. Znika, gdy sekcja kontaktu jest w kadrze.
3. **Formularz na stronie** zamiast „Formularz na senn.pl”:
   - pola: imię, telefon, dom (select A–G z wybranym domem z kontekstu) i jedna zgoda;
   - stan sukcesu: „Dziękujemy, doradca oddzwoni w ciągu 15 minut w godzinach pracy biura” (w demo może to być mock route handlera).
4. **„Pełna oferta i ceny” → `/domy`**, a „Zobacz całą galerię” otwiera galerię lub lightbox wewnątrz strony.
5. **Sekcja Domy**:
   - pokazać **wszystkie dostępne domy (A, B, D, E, F)**, a nie tylko A, B i E;
   - przy każdym: cena, zł/m² i „Historia cen” (zwinięta) oraz akcje „Zobacz w 3D” i „Zapytaj o dom”;
   - C i G jako wyciszony dowód popytu (albo liczba „2 sprzedane”).
6. **Kontekstowe CTA po sekcjach**:
   - Kreator: „Zobacz ten styl w spacerze 3D” (deep link `/domy?dom=B&styl=s4&widok=spacer`) i „Zapytaj o dom B”;
   - Lokalizacja: „Umów prezentację na osiedlu”.
7. **Zajawka 3D po hero**:
   - duży, spokojny kadr osiedla z 7 pinami w formie szklanej pigułki `Dom B · 119,8 m² · 1,60 mln zł`;
   - hover lub tap pokazuje podgląd, kliknięcie prowadzi do `/domy?dom=B`;
   - jeden przycisk: „Zobacz osiedle w 3D”.

P1:
- **Wydajność**: plakat hero jako LCP (preload), wideo H.264 z gęstymi klatkami kluczowymi do scrubbingu, obrazy AVIF/WebP, Kreator ładowany leniwie. Budżet: **LCP < 2,5 s na mobile 4G**.
- `prefers-reduced-motion` z wersją statyczną hero.
- Zdarzenia analityczne: kliknięcia `whatsapp_click`, `tel_click` i `cta_click` oraz wysłanie formularza `lead_submit`.
- Metadane OG.

### 5.2 Research/UX podstrony 3D (`demo-halowawer-bd`)

Spec musi zawierać:
- **Ścieżkę**: Osiedle → Dom → (Model 3D | Rzut 2D | Spacer | Galeria). W szynie **maks. 3–4 tryby**. Dolny pasek: styl (3) | pora dnia (3) | zoom.
- **Bez filtrów.** Lista 7 domów (typ, pow., ogród, cena, status).
- **Panel domu**:
  - dane: cena, zł/m², powierzchnia, ogród, pokoje, garaż lub miejsca postojowe, poddasze;
  - „Historia cen” (zwinięta);
  - 2 CTA na stałe.
- **Mobile**: bottom sheet (jak `SheetHandle` w Kickiego), spacer przez tapnięcie w hotspot zamiast WASD, obsługa jedną ręką.
- **Deep linki i obraz OG dla każdego domu.** Domu nie kupuje się w pojedynkę: link wysłany partnerowi przez WhatsApp ma otworzyć dokładnie ten dom, styl i widok.
- **Mikrocopy lifestyle na hotspotach**: 1 linia, konkret + korzyść, np. „Salon z jadalnią · okno HS na ogród od południa”.
- **Kontekst w kontakcie**: WhatsApp z treścią „Dzień dobry, interesuje mnie Dom B w Halo Wawer (styl Japandi). Proszę o kontakt.”
- **Pora dnia z prawdziwą orientacją**: ogrody od południa to atut sprzedażowy, więc słońce ma go pokazywać.
- Spójność stylów z Kreatorem według §4.2 oraz to, jak Kreator na home i podstrona 3D przekazują sobie użytkownika.

### 5.3 Moduł 3D (`demo-halowawer-8f`)

- **Pierwsze wrażenie w 2–3 s.** Plakat (render) pojawia się natychmiast i przechodzi płynnie w 3D. Nigdy pusty canvas ani spinner na czarnym tle.
- **Intro kamery**: 2–3 s spokojnego przelotu nad osiedlem, potem pełna kontrola użytkownika. Po pierwszej interakcji bez auto-rotacji.
- **Światło spójne z renderami hero** (ciepła złota godzina). Bez tego 3D obok renderów będzie wyglądać tanio. AgX lub ACES, miękkie cienie, AO, cienie kontaktowe.
- **Jeden pokój dopracowany perfekcyjnie: salon z oknem HS na ogród.** To główna obietnica strony („Salon otwarty na ogród”), więc ogród i zieleń mają być widoczne za szybą.
- **Etykiety** jako szklane pigułki, nie żółte dymki. Sprzedane domy wyszarzone, z małą etykietą.
- **CTA „Umów prezentację” i WhatsApp zawsze widoczne** w widoku domu i w spacerze.
- **Wydajność**:
  - Draco lub meshopt i KTX2;
  - DPR ≤ 2 (na mobile ≤ 1,5) i `PerformanceMonitor`;
  - fallback na słabe GPU: render lub panorama;
  - budżet startowy ≤ ok. 8 MB.
- **`src/lib/estate`** eksportuje typy i formatery (cena, m², zł/m²), których używa też strona główna.

## 6. Checklista akceptacji (według niej będę weryfikować)

Sprzedaż:
- [ ] WhatsApp widoczny na każdym widoku i z wiadomością zależną od kontekstu.
- [ ] Główne CTA („Umów prezentację”) w zasięgu jednego ruchu na każdym ekranie: nav, sticky na mobile, panel domu.
- [ ] Formularz na stronie: ≤ 4 pola, preselect domu, stan sukcesu z obietnicą czasu odpowiedzi.
- [ ] Zero linków do senn.pl gubiących leada.
- [ ] Na `/domy` widać wszystkie 7 domów, a przy każdym cenę, zł/m² i historię cen. Na home zostają 3 karty, zgodnie z decyzją z §4a.
- [ ] Spójne dane między home i 3D (jedno źródło).

WOW i wizja:
- [ ] Zajawka 3D na home kusi jednym kliknięciem i nie jest kolejnym zestawem kontrolek.
- [ ] Ścieżka osiedle → dom → model → rzut → spacer → styl → pora dnia działa bez instrukcji.
- [ ] Salon w 3D „sprzedaje marzenie”: światło, ogród za oknem, detal.
- [ ] 3 style 3D z tymi samymi nazwami co w Kreatorze.

Jakość i UX:
- [ ] Wygląd home zgodny 1:1 z `halo-wawer2.html` (poza dodanymi elementami sprzedażowymi).
- [ ] Na każdym widoku ≤ 1 główna i ≤ 2 drugorzędne akcje. Bez filtrów i zbędnych przełączników.
- [ ] Mobile (390 px): wszystko obsługiwalne kciukiem, bez poziomego scrolla.
- [ ] Preloadery (hero i 3D) mają prawdziwy postęp i estetykę marki, nigdy czarny ekran ani spinner.
- [ ] Po zniknięciu loadera **zero przycięć**: hero 60 fps przy scrollu, w 3D brak zgubionych klatek przy orbitowaniu, zmianie stylu i pory dnia oraz wejściu w spacer. Pomiar w Performance panel, z CPU 4× i na emulacji mobile.
- [ ] Wejście z zajawki na home do `/domy` jest natychmiastowe (prefetch).
- [ ] `prefers-reduced-motion`, focus-visible, kontrast WCAG AA na tekstach nad zdjęciami.
- [ ] Twarde spacje w jednostkach, polskie znaki, bez literówek.

## Źródła

- NAR (via BoxBrownie / Space Coast MLS): https://www.boxbrownie.com/b/the-nar-report-that-helps-sell-homes-in-a-slowdown · https://members.spacecoastmls.com/blogs/kymberly-franklin/2024/05/03/what-buyers-really-want-to-see-on-your-real-estate
- Matterport (badanie sponsorowane): https://matterport.com/blog/3d-tours-properties-sell-31-faster-and-higher-price
- Deloitte / Google, „Milliseconds Make Millions”: https://web.dev/case-studies/milliseconds-make-millions · https://www2.deloitte.com/content/dam/Deloitte/ie/Documents/Consulting/Milliseconds_Make_Millions_report.pdf
- Speed-to-lead (MIT / InsideSales): https://ainora.lt/blog/lead-response-time-statistics-every-study-2026
- WhatsApp (Lamudi / Meta): https://business.instagram.com/success/lamudi · https://nurtur.tech/resources/news/whatsapp-the-next-gen-feature-for-estate-agents-websites/
- Sticky CTA (A/B): https://conversion-rate-experts.com/sticky-cta-win-report/ · https://convertibles.dev/blogs/case-studies/homepage-sticky-cta-case-study
- Pola formularza: https://vitaldesign.com/phone-number-form-field-case-study/
- Jawność cen: https://www.money.pl/gospodarka/nowe-prawo-dotyczace-cen-mieszkan-wchodzi-w-zycie-wielka-zmiana-7176837625248736a.html · https://www.blog.ongeo.pl/news-ustawa-o-jawnosci-cen-mieszkan-nowe-obowiazki-deweloperow
- Lifestyle / storytelling: https://serhant.com/blog/from-listing-to-lifestyle-how-storytelling-sells-homes · https://www.luxuryhomemarketing.com/blog/selling-lifestyle
- Scroll-jacking: https://webdesignerdepot.com/how-scrolljacking-breaks-ux-fundamentals/
- Konwersja stron premium: https://www.luxurypresence.com/blogs/the-8-key-factors-that-make-a-luxury-real-estate-website-convert

## 7. Domknięcie projektu (29.10.2026): lista kontrolna końcowego audytu

Użytkownik zarządził spokojne kończenie: wszystkie rozpoczęte zadania dokończone w 100%, bez nowych funkcji. Stan z audytu na żywo o 01:40 (Playwright, GPU):

**Zweryfikowane OK:**
- Home:
  - WhatsApp z treścią;
  - formularz 4 pola;
  - hydratacja na mobile czysta;
  - kliknięcia po preloaderze działają;
  - mobile hero czytelne;
  - płynność filmu przy 1×: ok. 60 fps, p95 ok. 17 ms.
- /domy:
  - 7 etykiet;
  - 3D na mobile startuje (crash `vase` naprawiony);
  - Rzut na mobile wyświetla obraz;
  - dane C/G bez cen;
  - zł/m² z groszami;
  - poddasze „nieużytkowe”.
- Światło (nadzór): Rano, Dzień i Noc przyjęte przez recenzenta 66; lint i tsc czyste w `lighting/*` i `Effects.tsx`.

**Do domknięcia, agent 3D:**
1. Zwijany panel (dyrektywa użytkownika).
2. SiteNav na /domy.
3. „Umów prezentację”: LeadForm na miejscu, nie przekierowanie.
4. og:image domów.
5. Rzuty Kreatora dla A i C (lustro C sprawdzone).
6. Liczby z produkcji (MB, czas, VRAM).
7. Poprawki wyglądu od 66, łatka alfy, kamera osiedla ~20–25°.
8. Usunięcie trasy `src/app/domy-lab`.
9. Lint 0 błędów.
10. Build produkcyjny.

**Do domknięcia, strona główna:**
1. whenCalm (chunk 3D i Kreator po spokoju).
2. metadataBase i absolutny og:image w produkcji.
3. Lighthouse z poprawkami <90 (A11y, SEO).
4. „Zobacz całą galerię” → `/domy/a?widok=galeria` zamiast senn.pl.
5. `docs/**` w ignore ESLint.
6. Build produkcyjny i e2e.

**Recenzent 66:** końcowe QA według tej listy i README z otwartymi punktami po stronie klienta.

**Otwarte po stronie klienta:** ceny miejsc postojowych (wymóg ustawy o jawności cen).

**Ostatni krok nadzoru:** czysty pomiar płynności i build produkcyjny po zatrzymaniu pozostałych sesji i serwerów dev.

**Po domknięciu wszystkich agentów (polecenie użytkownika z 29.10):** nadzór zleca osobnemu agentowi optymalizację płynności i szybkości. Zasady pracy agenta:
- krótkie iteracje: pomiar → najmniejsza zmiana na największym wąskim gardle → ten sam pomiar;
- zmianę zostawia tylko przy wyraźnej poprawie, w przeciwnym razie ją cofa;
- kończy, gdy kolejne iteracje nie dają wyraźnej poprawy;
- bez walki o ułamki procent;
- bez obniżania jakości i zmian wyglądu;
- zachowana zasada „pełny preload, potem zero przycięć”.
