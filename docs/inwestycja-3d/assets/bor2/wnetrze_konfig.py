"""Konfiguracja wnętrz dom1 (G) i dom2 (B) dla wnetrze_buduj.py i kolejnych skryptów.

Mapowanie materiałów SKP -> biblioteka (wnetrze_wspolne.BIB). Wartość:
  "NAZWA"                      - materiał biblioteki
  ("NAZWA", (r, g, b))         - materiał z kolorem wierzchołków (DETAL/TKANINA), sRGB 0-255
  {"domyslnie": X, "nazwy": {prefiks_nazwy_obiektu: X, ...}} - zależnie od obiektu (dowolny poziom ścieżki)
Specjalny cel "OKNO": rama okna - lica zwrócone na zewnątrz -> OKNA_ZEWN, reszta -> BIALY.
Materiały spoza mapy: DETAL z kolorem materiału SKP (lub średnią tekstury); przezroczyste -> SZKLO.
Kolory (tinty) dobrane z renderów public/explorer/gallery/interior-*.jpg (model SKP to geometria,
render to wygląd - decyzja koordynatora 04.11).
"""

OAK_D1 = ["Muuto Wood Oak", "Muuto Wood Oak Horizontal", "Muuto Wood Oak1", "Muuto Wood Oak2",
          "Muuto Wood Oak vertical1", "Muuto Wood Oak Vertical"]
GLASS = ["Szyby", "SZYBY1", "PRZEZROCZYSTE", "Glass Clear1", "WAZON", "Woda"]
METAL = ["Chrom", "Stal nierdzewna", "tow.vn_Nichel", "[Aluminum] Kopie", "Aluminum_Brushed_5cm", "ALUMINIUM1",
         "ALUMINIUM", "Metallic_Paint_Silver", "Метал"]
# LUSTRO GRAFIKA: lustra/panele w niszach - metal odbijał env jako ciemnozielony pas (interior-7) -> szarość
LAMP = ["SZKŁO KINKIET", "Muuto Diffuser", "&tradition Diffuser", "MUUTO DEDICATE LAMP",
        "tow.vn_Glass"]   # tow.vn_Glass = klosze-chmury w pokoju dziecka (białe, matowe)

KREM_SOFA = (214, 203, 186)   # int-4: sofa #e1d7ca w scenie
BIEL_POSCIEL = (244, 238, 228)   # ciepła biel: biała tkanina nigdy R < B
TARAS = (96, 93, 88)
CZARNY = (14, 14, 16)

# --- Brakujące pomieszczenia (etap 4). Rzut E (dom-e-pietro.png) bez lustra - tak jak model SKP G:
# piętro, północ: Pokój 1 (NW), Pokój 2 (NE), łazienka przy ścianie wsch. (okno 107/107 jak w bryle),
# korytarz; parter: WC (NW) bez podłogi i sufitu w SKP. Lica zewnętrzne z bor2-zewnetrze.blend:
# zach. 33,416 (wnętrze SKP 33,456), płn. 59,706, wsch. 40,956; okna piętra płn. x 34,48-36,66 i 37,68-39,86.
Z1, Z1S = 3.79, 6.39
D1_POKOJE = [
    ("sciana", 1, (33.456, 56.33, 33.90, 59.266), (Z1, Z1S), [], "-x"),
    ("sciana", 1, (33.456, 59.266, 40.956, 59.706), (3.45, Z1S),
     [(34.48, 36.66, 4.00, 6.04), (37.68, 39.86, 4.00, 6.04)], "+y"),
    ("sciana", 1, (40.76, 53.96, 40.956, 59.266), (Z1, Z1S), [(54.33, 55.21, 5.08, 5.96)], "+x"),
    ("sciana", 1, (36.34, 56.11, 40.76, 56.33), (Z1, Z1S), [(36.42, 37.12, Z1, 5.84), (37.42, 38.22, Z1, 5.84)], None),
    ("sciana", 1, (37.20, 56.33, 37.30, 59.266), (Z1, Z1S), [], None),
    ("sciana", 1, (38.60, 53.96, 38.70, 56.11), (Z1, Z1S), [(54.75, 55.55, Z1, 5.84)], None),
    ("plyta", 1, (33.456, 53.82, 40.956, 59.706), (Z1S, 6.62), "TYNK", "SUFIT"),
    ("okno", 1, "y", (59.266, 59.706), (34.48, 36.66), (4.00, 6.04), 1),
    ("okno", 1, "y", (59.266, 59.706), (37.68, 39.86), (4.00, 6.04), 1),
    ("okno", 1, "x", (40.76, 40.956), (54.33, 55.21), (5.08, 5.96), 0, 40.70),   # szyba bryły na x = 40,68-40,70
    ("drzwi", 1, "y", (56.11, 56.33), (36.42, 37.12), Z1, 1),
    ("drzwi", 1, "y", (56.11, 56.33), (37.42, 38.22), Z1, 1),
    ("drzwi", 1, "x", (38.60, 38.70), (54.75, 55.55), Z1, 1),
    # łazienka
    ("plyta", 1, (38.70, 53.96, 40.76, 56.11), (Z1, 3.80), "PLYTKA_PODL", "PODLOGA"),
    ("plytki_sciana", 1, (40.745, 53.96, 40.76, 56.11), 3.80, 1.15),
    ("plytki_sciana", 1, (38.70, 56.095, 40.745, 56.11), 3.80, 2.10),
    ("plytki_sciana", 1, (38.70, 53.96, 40.745, 53.975), 3.80, 2.10),
    ("umywalka", 1, (39.05, 55.62, 39.65, 56.09), 3.80),
    ("lustro", 1, (39.10, 56.08, 39.60, 56.094), 4.75, 0.7),
    ("wc", 1, (40.18, 55.42, 40.74, 55.80), 3.80),
    ("prysznic", 1, (39.82, 53.98, 40.74, 54.90), 3.80, "-x"),
    # Pokój 1 (NW)
    ("lozko", 1, (33.95, 57.15, 34.87, 59.22), Z1, "+y"),
    ("szafa", 1, (36.58, 57.45, 37.19, 58.65), Z1, 2.3),
    ("biurko", 1, (35.0, 58.62, 36.4, 59.22), Z1),
    ("dywan", 1, (35.0, 57.0, 36.4, 58.3), Z1, (196, 192, 182)),
    # Pokój 2 (NE)
    ("lozko", 1, (38.72, 57.25, 40.74, 58.85), Z1, "+x"),
    ("szafa", 1, (38.45, 56.34, 40.74, 56.94), Z1, 2.3),
    ("biurko", 1, (37.35, 58.65, 38.55, 59.22), Z1),
    ("dywan", 1, (37.9, 57.1, 38.65, 59.0), Z1, (186, 190, 176)),
    # WC parteru (NW): posadzka, sufit, misa, umywalka
    ("plyta", 0, (33.90, 56.33, 35.33, 58.13), (0.815, 0.835), "PLYTKA_PODL", "PODLOGA"),
    ("plyta", 0, (33.90, 56.33, 35.33, 58.13), (3.45, 3.47), "TYNK", "SUFIT"),
    # hol parteru bez sufitu w SKP (L1: z PKT_WEJSCIE widać spód stropu piętra)
    ("plyta", 0, (35.33, 56.95, 37.62, 58.13), (3.45, 3.47), "TYNK", "SUFIT"),
    ("plyta", 0, (35.33, 56.33, 37.20, 56.95), (3.45, 3.47), "TYNK", "SUFIT"),
    ("wc", 0, (33.92, 57.55, 34.47, 57.93), 0.835),
    ("umywalka", 0, (34.62, 57.70, 35.12, 58.12), 0.835),
]

# dom2 / B: rzut B (dom-b-pietro.png): piętro północ - łazienka przy ścianie zach. (okno 107/107 jak w bryle),
# pokój hobby (NW), pokój 2 (NE), korytarz SKP (zamknięte pudło -> wycięte drzwi); parter: garaż i hol bez stropu.
# Lica z bor2-zewnetrze.blend: zach. 91,636, płn. 49,006, wsch. 99,80 (ściana wspólna z A); wewn. zach. 92,10,
# płn. 48,556, wsch. 99,55; okna piętra płn. x 92,70-95,21 i 96,21-98,73, z 3,46-5,41.
Z2, Z2S = 3.23, 5.83
D2_POKOJE = [
    ("wytnij", "KOND_1__WNETRZE", (94.24, 44.00, 94.48, 44.80), (Z2, 5.28)),
    ("wytnij", "KOND_1__DETALE", (94.24, 44.00, 94.48, 44.80), (Z2, 5.28)),
    ("wytnij", "KOND_1__WNETRZE", (94.70, 45.41, 95.50, 45.73), (Z2, 5.28)),
    ("wytnij", "KOND_1__DETALE", (94.70, 45.41, 95.50, 45.73), (Z2, 5.28)),
    ("wytnij", "KOND_1__WNETRZE", (96.05, 45.41, 96.85, 45.73), (Z2, 5.28)),
    ("wytnij", "KOND_1__DETALE", (96.05, 45.41, 96.85, 45.73), (Z2, 5.28)),
    ("sciana", 1, (91.636, 43.31, 92.10, 48.556), (Z2, Z2S), [(43.56, 44.46, 4.46, 5.37)], "-x"),
    ("sciana", 1, (91.636, 48.556, 99.80, 49.006), (Z2, Z2S),
     [(92.70, 95.21, 3.46, 5.41), (96.21, 98.73, 3.46, 5.41)], "+y"),
    ("sciana", 1, (99.55, 45.46, 99.80, 48.556), (Z2, Z2S), [], "+x"),
    ("sciana", 1, (92.10, 45.46, 94.29, 45.68), (Z2, Z2S), [], None),
    ("sciana", 1, (95.65, 45.68, 95.77, 48.556), (Z2, Z2S), [], None),
    ("plyta", 1, (91.636, 43.31, 99.80, 49.006), (Z2S, 6.05), "TYNK", "SUFIT"),
    ("plyta", 0, (92.08, 43.31, 95.75, 48.556), (2.91, 3.21), "TYNK", "SUFIT"),
    ("plyta", 0, (95.75, 45.68, 99.55, 48.556), (2.91, 3.21), "TYNK", "SUFIT"),
    ("okno", 1, "x", (92.10, 91.636), (43.56, 44.46), (4.46, 5.37), 0),
    # okno garażu w szczycie zach. (bryła: y 43,64-44,38, z 1,59-2,34), w SKP ściana pełna
    ("wytnij", "KOND_0__WNETRZE", (91.60, 43.56, 92.12, 44.46), (1.51, 2.42)),
    ("okno", 0, "x", (92.08, 91.636), (43.56, 44.46), (1.51, 2.42), 0, 91.88),
    ("okno", 1, "y", (48.556, 49.006), (92.70, 95.21), (3.46, 5.41), 1),
    ("okno", 1, "y", (48.556, 49.006), (96.21, 98.73), (3.46, 5.41), 1),
    ("drzwi", 1, "x", (94.29, 94.43), (44.00, 44.80), Z2, -1),
    ("drzwi", 1, "y", (45.46, 45.68), (94.70, 95.50), Z2, 1),
    ("drzwi", 1, "y", (45.46, 45.68), (96.05, 96.85), Z2, 1),
    # łazienka
    ("plyta", 1, (92.10, 43.31, 94.29, 45.46), (Z2, 3.24), "PLYTKA_PODL", "PODLOGA"),
    ("plytki_sciana", 1, (92.10, 43.31, 92.115, 45.46), 3.24, 1.15),
    ("plytki_sciana", 1, (92.115, 45.445, 94.29, 45.46), 3.24, 2.10),
    ("plytki_sciana", 1, (92.115, 43.31, 94.29, 43.325), 3.24, 2.10),
    ("wanna", 1, (92.12, 43.33, 92.85, 45.0), 3.24),
    ("umywalka", 1, (93.80, 43.33, 94.28, 43.85), 3.24),
    ("lustro", 1, (93.82, 43.326, 94.26, 43.34), 4.20, 0.7),
    ("wc", 1, (93.30, 45.06, 93.68, 45.445), 3.24),
    # pokój hobby (NW)
    ("biurko", 1, (92.12, 46.4, 92.75, 47.9), Z2),
    ("szafa", 1, (94.98, 45.69, 95.64, 46.95), Z2, 2.3),
    ("dywan", 1, (93.0, 46.3, 94.6, 47.9), Z2, (200, 194, 182)),
    # pokój 2 (NE)
    ("lozko", 1, (97.50, 46.45, 99.54, 48.05), Z2, "+x"),
    ("szafa", 1, (95.78, 46.95, 96.38, 48.55), Z2, 2.3),
    ("dywan", 1, (96.6, 46.2, 97.5, 48.3), Z2, (190, 192, 180)),
]


def _m(names, target):
    return {n: target for n in names}


KONFIG = {
    "dom1": {
        "dom": "G",
        "kolekcja": "DOM_1",
        "podlogi": [0.83, 3.79],
        "sufity": [3.45, 6.39],
        "granica": 3.6,
        "z_max": 6.45,
        "obrys": [33.39, 40.96, 50.18, 59.78],      # bryła (lico zewnętrzne), bez tarasu
        "taras_y": 50.15,                             # części na południe od tej linii i nisko = taras
        "schody": [33.6, 36.15, 54.2, 56.6],
        "oczka": {"usun": ["Body_01", "Ring", "Body_02", "Glass", "Source", "White"], "znacznik": "Ring",
                  "r": 0.045},
        # zabawki na podłodze pokoju dziecka (na renderze interior-8 ich nie ma)
        "usun": ["train#1", "Group#443", "æèðàô", "Lápis de madeira"],   # + pluszak, kredki (int-8)
        # listwy lamel (siatki SKP) -> płaskie panele z mapą normalnych LAMELE
        "lamele": ["Component#122", "Component#121", "wałek"],
        "tex": {"PODLOGA": "podloga_d1.jpg", "DAB": "dab_d1.jpg"},
        "skp_tex": {"KAMIEN": "BLAT MARMUROWY 2", "MARMUR": "_2", "OBRAZ_1": "PLAKAT 2", "OBRAZ_2": "PLAKAT 3",
                    "DYWAN": "HAY RUG"},
        "kafel_z": {"PODLOGA": "DREWNO PODŁOGA 3", "DAB": "Muuto Wood Oak"},
        "arch": ["TYNK JASNOBEŻOWY", "TYNK C", "TYNK C1", "TYNK C2", "TYNK JASNOBEŻOWY1", "_PaleGoldenrod_",
                 "SKP Default", "[Color M00]", "DREWNO PODŁOGA 3"],
        "mapa": {
            **_m(["TYNK JASNOBEŻOWY", "TYNK C1", "TYNK JASNOBEŻOWY1", "_PaleGoldenrod_", "SKP Default"], "TYNK"),
            **_m(["TYNK C", "TYNK C2"], "TYNK_ZEWN"),
            "[Color M00]": {"domyslnie": "TYNK", "nazwy": {"Groupe#2": ("TKANINA", BIEL_POSCIEL)}},
            "DREWNO PODŁOGA 3": "PODLOGA",
            **_m(OAK_D1, "DAB"),
            "DREWNO": "DAB",
            "OKNA C": {"domyslnie": "OKNO", "nazwy": {
                "Group#285": "DAB_CIEMNY", "Group#268": "DAB_CIEMNY", "Group#281": "DAB_CIEMNY",
                "Group#425": ("DETAL", (60, 48, 40)), "Group#150": ("DETAL", (60, 48, 40)),
                "Component#193": ("DETAL", (60, 48, 40)),
                "Группа": "BIALY", "Розетка": "BIALY", "Выключатель": "BIALY"}},
            "ZASŁONY 3": "ZASLONA", "FIRANY": "FIRANA",
            "Muuto Kvadrat Clay 12": ("TKANINA", KREM_SOFA),
            "Custom1": ("TKANINA", (234, 226, 214)),
            **_m(["Lençol", "cgaxis_models_49_15_1", "Cama1"], ("TKANINA", BIEL_POSCIEL)),
            **_m(["Dywan 222", "Dywan 1"], ("TKANINA", (158, 158, 154))),
            "GUNNARED beige": ("TKANINA", (200, 190, 175)),
            **_m(["_42", "_7", "Wool1", "Sindi_Frankof_daybed_pillow 2", "Paddington"], "TKANINA"),
            "HAY RUG": "DYWAN",
            "BLAT MARMUROWY 2": "KAMIEN", "_2": "MARMUR",
            **_m(GLASS, "SZKLO"), **_m(METAL, "METAL"),
            **_m(LAMP + ["Mesh6SG1", "fluid_Global_1SG1", "Mesh1SG1", "blinn1SG1"], "LAMPA"),
            "PLAKAT 2": "OBRAZ_1", "PLAKAT 3": "OBRAZ_2",
            "TV EKRAN": ("DETAL", CZARNY),
            "MEBLE BIAŁY": "BIALY", "RAMA PLAKATU": ("DETAL", (206, 196, 184)),
            "LUSTRO GRAFIKA": ("DETAL", (196, 196, 192)),
            "Material__2": "LISCIE",   # karta liścia (eukaliptus); Material__1 = łodyga, _1#6 = donica -> DETAL
            "00_GRAFIT MEBLE": ("DETAL", (188, 182, 172)),   # regał w sypialni: w renderze jasny greige
        },
        "pkt": [  # nazwa, x, y, kondygnacja, kierunek patrzenia (x, y)
            ("PKT_SALON", 39.3, 55.6, 0, (-0.3, -1.0)),
            ("PKT_KUCHNIA", 39.4, 57.75, 0, (-1.0, 0.15)),
            ("PKT_JADALNIA", 36.9, 51.4, 0, (-1.0, 0.35)),
            ("PKT_WEJSCIE", 36.2, 57.8, 0, (0.0, -1.0)),
            ("PKT_SYPIALNIA", 38.0, 51.3, 1, (1.0, 0.35)),
            ("PKT_POKOJ_DZIECKA", 36.6, 52.9, 1, (-1.0, -0.6)),
            ("PKT_KORYTARZ", 37.4, 54.9, 1, (0.0, 1.0)),
            ("PKT_POKOJ_1", 36.4, 57.0, 1, (-0.7, 1.0)),
            ("PKT_POKOJ_2", 38.1, 57.2, 1, (0.6, 1.0)),
            ("PKT_LAZIENKA", 39.0, 55.6, 1, (1.0, -0.4)),
        ],
        "pokoje": D1_POKOJE,
    },
    "dom2": {
        "dom": "B",
        "kolekcja": "DOM_2",
        "podlogi": [0.27, 3.23],
        "sufity": [2.91, 5.83],
        "granica": 3.05,
        "z_max": 5.9,
        "obrys": [91.64, 99.79, 39.01, 49.01],
        "taras_y": 39.0,
        "schody": [97.1, 99.6, 43.25, 45.5],
        "oczka": None,
        # ryflowane szkło górnych szafek kuchni (Component#50: 289 listew) -> panele RYFLE z mapą normalnych
        "lamele": [("Component#50", "RYFLE")],
        "tex": {"PODLOGA": "podloga_d2.jpg", "DAB": "dab_d2.jpg"},
        "skp_tex": {"KAMIEN": "GRANIT STREAM WHITE", "OBRAZ_1": "PLAKAT", "OBRAZ_2": "_auto_12"},
        "kafel_z": {"PODLOGA": "_", "DAB": "DREWNO MEBLE"},
        "arch": ["TYNK JASNOBEŻOWY1", "TYNK JASNOBEŻOWY", "TYNK JASNOBEŻOWY#1", "TYNK B", "TYNK B2", "SKP Default",
                 "[Color M00]", "_"],
        "mapa": {
            "TYNK JASNOBEŻOWY1": {"domyslnie": "TYNK", "nazwy": {"Component#30": "PLYTKI"}},
            **_m(["TYNK JASNOBEŻOWY", "TYNK JASNOBEŻOWY#1", "SKP Default", "[Color M00]"], "TYNK"),
            **_m(["TYNK B", "TYNK B2"], "TYNK_ZEWN"),
            "_": "PODLOGA",
            "OKNA B": {"domyslnie": "OKNO", "nazwy": {
                **{"Group#%d" % i: "SZALWIA" for i in range(184, 195)},
                "Group#312": "SZALWIA", "Group#409": "SZALWIA", "Grupuj#3": "SZALWIA", "chwyt": "SZALWIA",
                "skp3A49": "SZALWIA", "Component#152": "SZALWIA", "Component#2": "SZALWIA"}},
            "DREWNO MEBLE": {"domyslnie": "DAB", "nazwy": {   # fronty kuchni i mebli -> jasny dąb (int-1)
                "Component#31": "DAB_JASNY", "Component#32": "DAB_JASNY", "Component#54": "DAB_JASNY",
                "Group#315": "DAB_JASNY", "Group#406": "DAB_JASNY", "Group#404": "DAB_JASNY"}},
            **_m(["_1", "DREWNO"], "DAB_JASNY"),        # krzesła NURT_KOS i stołki
            "SCHODY": "BIALY",
            "ZASŁONY 2": "ZASLONA", "FIRANY": "FIRANA",
            **_m(["Textile1", "Textile"], ("TKANINA", (222, 210, 192))),   # sofa: beżowy len (int-1 ~#d8cdbd)
            **_m(["dywan 2", "_5"], ("TKANINA", (224, 218, 206))),
            **_m(["Leather_1", "cgaxis_models_49_15_1", "Lençol", "Texture 2.jpeg", "绒布__noTTo3Ds"],
                 ("TKANINA", BIEL_POSCIEL)),
            **_m(["Wool1", "_13"], "TKANINA"),
            "remix": ("TKANINA", (216, 192, 162)),
            "GRANIT STREAM WHITE": "KAMIEN",
            "R150,G150,B150": ("DETAL", (240, 238, 234)),
            "MEBLE JASNOBEŻOWY": "BIALY",
            "SZKŁO MATOWE": ("DETAL", (226, 228, 226)),
            **_m(GLASS, "SZKLO"), **_m(METAL, "METAL"), **_m(LAMP, "LAMPA"),
            "PLAKAT": "OBRAZ_1", "_auto_12": "OBRAZ_2",
            "TV EKRAN": ("DETAL", CZARNY),
            "RAMA PLAKATU": ("DETAL", (206, 196, 184)),
            "LUSTRO GRAFIKA": ("DETAL", (190, 190, 186)),
        },
        "pkt": [
            ("PKT_SALON", 94.6, 43.0, 0, (0.4, -1.0)),
            ("PKT_KUCHNIA", 97.1, 42.0, 0, (1.0, -0.3)),
            ("PKT_WEJSCIE", 96.6, 46.4, 0, (0.0, -1.0)),
            ("PKT_SYPIALNIA", 96.0, 39.8, 1, (0.8, 0.6)),
            ("PKT_POKOJ_DZIECKA", 93.2, 41.6, 1, (-0.5, -1.0)),
            ("PKT_KORYTARZ", 96.0, 44.3, 1, (0.0, 1.0)),
            ("PKT_POKOJ_HOBBY", 94.3, 46.6, 1, (-0.6, 1.0)),
            ("PKT_POKOJ_2", 96.9, 46.5, 1, (0.6, 1.0)),
            ("PKT_LAZIENKA", 93.9, 44.6, 1, (-1.0, -0.2)),
            ("PKT_GARAZ", 94.6, 44.4, 0, (-0.4, 1.0)),
        ],
        "pokoje": D2_POKOJE,
    },
}
