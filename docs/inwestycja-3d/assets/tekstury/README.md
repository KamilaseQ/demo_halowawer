# Tekstury PBR elewacji – Halo Wawer

Stan: **GOTOWE: 1. tynk, 2. brama segmentowa.** NIEZROBIONE (prace przerwane decyzją koordynatora): 3. aluminium/PVC, 4. blacha na rąbek, 5. płyty tarasowe, 6. kostka.

Wspólne zasady dla wszystkich map:
- **color**: sRGB, neutralna szarość (R=G=B). **normal**: OpenGL (+Y = w górę obrazka), czyli konwencja three.js/glTF/Blendera, bez odwracania G. **roughness**: liniowe, skala szarości (w Blenderze Non-Color; glTF i tak pakuje ją do kanału G metallicRoughness).
- Bezszwowe z konstrukcji (pola generowane w dziedzinie Fouriera, skan zszyty przenikaniem zachowującym wariancję). Niskie częstotliwości wycięte (high-pass ok. 3–6 cm), więc przy powtarzaniu nie ma plam.
- Mapy normalnych są w **JPG 4:4:4**, bo stratny WebP zawsze zapisuje chrominancję 4:2:0, a to rozmywa X/Y normalnych o połowę. color i roughness to WebP.
- `repeat = rozmiar_powierzchni_m / kafel_m`. Ustaw `texture.anisotropy = renderer.capabilities.getMaxAnisotropy()` (min. 8), inaczej ściany oglądane pod ostrym kątem się rozmywają.

## ⚠ Poziom map kolorów: #e6e6e6, a nie #bdbdbd (świadome odejście od zamówienia)
`baseColorFactor` w glTF ma zakres ≤ 1. Przy teksturze #bdbdbd (liniowo 0,509) nie da się uzyskać kolorów jaśniejszych niż #bdbdbd, a projekt ich używa: elewacje CLAY `#e3ded5/#e1dcd2/#e5e1d8` i dach `#c3b69b` (src/lib/estate/geometry/site.ts). Dlatego wszystkie mapy color mają średnią **sRGB #e6e6e6 = liniowo 0,791 (BASE_LIN)**.

**Mnożenie:** `baseColorFactor_lin = kolor_domu_lin / 0.791` (osobno dla każdego kanału, liczone w przestrzeni liniowej). W three.js: `new THREE.Color(hex).multiplyScalar(1 / 0.791)`.
Przykłady (factor liniowy RGB): #b0a9a1 → (0,545, 0,502, 0,450); #8a857b → (0,321, 0,297, 0,251); #e3ded5 → (0,971, 0,924, 0,840); #c3b69b → (0,689, 0,597, 0,418).
Mapa color niesie tylko ±1–3% zmienności; jeśli trzeba oszczędzać, można ją pominąć i ustawić sam kolor (wtedy factor = kolor domu bez dzielenia). Inny poziom bazowy: zmień `BASE_SRGB` w `skrypty/generuj.py` i uruchom ponownie (~1 min).

## 1. TYNK drobnoziarnisty – GOTOWE
| mapa | plik | rozdz. | rozmiar |
|---|---|---|---|
| color | `tynk/tynk_color.webp` | 2048² | 39 KB |
| normal (GL) | `tynk/tynk_normal.jpg` | 2048² | 2,0 MB |
| roughness | `tynk/tynk_roughness.webp` | 2048² | 233 KB |

- **Kafel: 1,5 × 1,5 m** (0,73 mm/teksel). Ściana 8 × 6 m daje repeat (5,33; 4).
- **normalScale: 1,0** (zakres 0,6–1,3; poniżej 0,6 faktura znika już z 1 m).
- **roughness:** mapa 0,85–0,95 (średnio 0,905), `roughnessFactor = 1.0`, metalness 0.
- Budowa: ziarno „baranek” ok. 1–2 mm (szum pasmowy plus softplus: wypukłe ziarna i płaskie spoiwo), na to mikrorzeźba i pory ze skanu Poly Haven *White Stucco* (CC0) przeskalowane do 1,5 m i zszyte bez szwu, do tego bardzo słabe ślady pacy 1–4 cm. Albedo z drobną zmiennością ±3% (pory minimalnie ciemniejsze), bez plam.
- Weryfikacja: `podglad/tynk-kafle4x4-i-1do1.jpg` (po lewej 4×4 kafle = 6 × 6 m w świetle smugowym 40°: brak widocznego powtórzenia; po prawej 1:1 i cały kafel), w three.js `podglad/threejs-1m.jpg`, `-3m.jpg`, `-8m.jpg`. Z 1 m widać ziarno i pojedyncze pory, z 3 m tylko delikatną fakturę, z 8 m ściana jest gładka.

## 2. BRAMA SEGMENTOWA – GOTOWE
| mapa | plik | rozdz. | rozmiar |
|---|---|---|---|
| color | `brama/brama_color.webp` | 1024² | 3 KB |
| normal (GL) | `brama/brama_normal.jpg` | 1024² | 155 KB |
| roughness | `brama/brama_roughness.webp` | 1024² | 150 KB |

- **Kafel: 2,5 m (U, szerokość) × 2,2 m (V, wysokość)**, czyli tekstura nie jest kwadratowa w metrach.
- 4 segmenty po 0,55 m. Styki leżą na v = 0; 0,25; 0,5; 0,75 (górna i dolna krawędź kafla to połówki styku). Profil styku ok. 18 mm wysokości i 5 mm głębokości: stromy, zaokrąglony okap górnego segmentu (cień) i łagodne wejście dolnego (blask). W mapie color jest wypieczona okluzja szczeliny (ok. 0,5×), więc linie widać także z daleka.
- **UV:** rozciągnij V 0..1 na całą wysokość bramy (repeat.y = 1, wtedy segmenty zawsze zaczynają się od krawędzi), a repeat.x = szerokość / 2,5. Przy innej wysokości niż 2,2 m segmenty skalują się proporcjonalnie, co jest poprawne.
- **normalScale: 1,0** (0,7–1,2). **roughness:** płyciny 0,62–0,66, szczeliny do 0,72. roughnessFactor 1,0, metalness 0.
- Płyciny mają bardzo lekką fakturę „sandgrain/stucco” (ok. 6–20 mm, 0,07 mm) i ledwo widoczne poziome smugi walcowania. Orientację normalnych sprawdziłem w three.js: przy słońcu z góry cień jest pod okapem, a blask poniżej.

## 3–6. NIEZROBIONE
3. aluminium/PVC proszkowe (512², 0,5 m), 4. blacha na rąbek (1024², 1 m wzdłuż spadku), 5. płyty tarasowe 60×60, 6. kostka. Do czasu ich dostarczenia proponuję płaskie materiały:
- aluminium: roughness 0,45, metalness 0;
- blacha: roughness 0,4, metalness 0 (blacha jest lakierowana).

W `podglad/threejs-*.jpg` rama okna, dach i taras są jeszcze płaskie. Stanowisko testowe automatycznie podejmie brakujące zestawy, gdy pojawią się pliki `aluminium/aluminium_*.{webp,jpg}`, `blacha/blacha_*`, `plyty/plyty_*`.

## Podgląd i weryfikacja
- `podglad/porownanie.jpg`: wycinki renderów (vis-4: brama A i ściana; vis-1: tynk) obok three.js z 8 m, 3 m, 1 m oraz z 3 m bez tekstur.
- Stanowisko: `skrypty/verify.html` + `skrypty/verify.mjs`. Uruchamiać z katalogu projektu: `node docs/inwestycja-3d/assets/tekstury/skrypty/verify.mjs <katalog> d1 d3 d8 okno dach wzdluz kafle taras d3:bare`. Scena: ściana 8 × 6 m w kolorze #b0a9a1, brama #8a857b we wnęce 0,22 m, okna z ramą 6 cm, dach 35°. Światło jak „Dzień” w eksploratorze: HDRI zawiszy_czarnego (PMREM), słońce #ffe2c2 4,4 pod 40° do ściany, env 0,95, hemisfera, Neutral tone mapping. Parametry testowe w URL: `--q=nsTynk=0.8&nsBrama=1.2&tynkColor=%23c0b8ae`.
- Regeneracja map: `python -I skrypty/generuj.py tynk brama` (z katalogu `tekstury/`). Szybki podgląd w Pythonie: `skrypty/podglad_py.py`.

### Co wciąż odbiega od renderów (samokrytycznie)
- Na renderach dewelopera tynk jest prawie idealnie gładki nawet z bliska. U nas z 1 m w świetle smugowym widać ziarno i pojedyncze pory. To realistyczne dla tynku drobnoziarnistego, ale mocniejsze niż na wizualizacji. Jeśli klient chce wyglądu jak z renderu, ustawcie normalScale tynku na 0,5–0,7.
- Na renderach są miękkie, niskoczęstotliwościowe przejścia światła na ścianie (GI, AO w narożnikach i pod oknami). Tekstura tego nie da, a wycięliśmy celowo niskie częstotliwości. Ten efekt musi dać oświetlenie (AO/lightmapy).
- Styki bramy w three.js są ostre i równe, a na renderach linia jest nieco grubsza i bardziej rozmyta. Nie zweryfikowałem, jak wyglądają z ok. 15–20 m (minifikacja może je zgubić). Wypieczona okluzja w color powinna pomóc.
- Ujęć `wzdluz` (smuga wzdłuż ściany) i `kafle` w three.js nie wykonałem, bo praca została przerwana. Powtarzalność tynku sprawdziłem tylko w podglądzie Pythona 4×4 (bez śladów) i w ujęciu z 8 m.
- Postęp 3–6: brak.

## Licencje i źródła
- Tynk (warstwa mikrorzeźby, por i drobnej zmienności albedo): **Poly Haven „White Stucco”** (autor Amal Kumar), **CC0**, https://polyhaven.com/a/white_stucco. Pobrane mapy 4k (diff, nor_gl, rough, disp, ok. 32 MB) leżą w `_pobrane/polyhaven_white_stucco/`. **Nie wchodzą w zestaw**, można je usunąć po ewentualnej regeneracji.
- Ziarno tynku i cała brama: generowane proceduralnie (`skrypty/generuj.py`), własne, do dowolnego użytku (CC0).
- HDRI w podglądzie: projektowe `public/explorer/3d/hdri/zawiszy_czarnego_512.hdr` (Poly Haven, CC0), tylko do odczytu.

## Rozmiar zestawu
tynk 2,3 MB + brama 0,3 MB = **2,6 MB** (limit 6 MB). Podglądy (`podglad/`, 1,2 MB), skrypty i `_pobrane/` nie są częścią zestawu do wdrożenia.
