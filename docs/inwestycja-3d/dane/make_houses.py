import json, sys
sys.stdout.reconfigure(encoding="utf-8")
out = sys.argv[1]


def R(no, name, a, **k):
    return dict(no=no, name=name, area=a, **k)


layouts = {
    "A": {
        "family": "blizniak",
        "note": "Dom A i C: ten sam rzut (identyczne pliki). Wschodnia połowa bliźniaka, ściana wspólna od zachodu.",
        "plans": {"parter": "dom-a-parter.png", "pietro": "dom-a-pietro.png", "poddasze": "dom-a-poddasze.png"},
        "floors": [
            {"id": "parter", "label": "Parter", "rooms": [
                R("0.01", "Wiatrołap", 3.70), R("0.02", "WC", 2.41), R("0.03", "Korytarz", 3.92),
                R("0.04", "Pomieszczenie techniczne", 0.76), R("0.05", "Schody", 4.58),
                R("0.06", "Strefa dzienna", 26.92, note="salon + jadalnia + kuchnia, wyjście HS na taras"),
                R("0.07", "Garaż", 18.47)],
             "outdoor": [R("-", "Taras (do aranżacji indywidualnej)", 6.98), R("-", "Zadaszenie nad wejściem", 3.42)]},
            {"id": "pietro", "label": "Piętro", "rooms": [
                R("1.01", "Korytarz", 6.47), R("1.02", "Pokój 1", 10.93, note="okno na front (N)"),
                R("1.03", "Pokój 2", 10.22, note="okno na front (N)"), R("1.04", "Łazienka", 4.74, note="okno, wanna"),
                R("1.05", "Sypialnia", 12.92, note="okno na ogród (S)"), R("1.06", "Pokój 3", 13.47, note="okno na ogród (S)")]},
            {"id": "poddasze", "label": "Poddasze", "usable": False, "rooms": [
                R("2.01", "Poddasze nieużytkowe", None, note="obrys wewn. ok. 6,87 × 7,32 m; wyłaz z korytarza piętra; schody samonośne do własnego montażu")]},
        ],
    },
    "B": {
        "family": "blizniak",
        "note": "Dom B i D: ten sam rzut. Zachodnia połowa bliźniaka (lustro A z innym położeniem kuchni i garażu), ściana wspólna od wschodu.",
        "plans": {"parter": "dom-b-parter.png", "pietro": "dom-b-pietro.png", "poddasze": "dom-b-poddasze.png"},
        "floors": [
            {"id": "parter", "label": "Parter", "rooms": [
                R("0.01", "Wiatrołap", 3.70), R("0.02", "WC", 2.34), R("0.03", "Korytarz", 3.92),
                R("0.04", "Pomieszczenie techniczne", 0.76), R("0.05", "Schody", 4.58),
                R("0.06", "Strefa dzienna", 27.26, note="salon + jadalnia + kuchnia, wyjście HS na taras"),
                R("0.07", "Garaż", 18.47, note="przejście do korytarza")],
             "outdoor": [R("-", "Taras (do aranżacji indywidualnej)", 6.98), R("-", "Zadaszenie nad wejściem", 3.28)]},
            {"id": "pietro", "label": "Piętro", "rooms": [
                R("1.01", "Korytarz", 6.47), R("1.02", "Sypialnia", 13.81, note="okno na ogród (S)"),
                R("1.03", "Pokój 1", 12.92, note="okno na ogród (S)"), R("1.04", "Łazienka", 4.74, note="okno, wanna"),
                R("1.05", "Pokój hobby", 10.22, note="okno na front (N)"), R("1.06", "Pokój 2", 10.58, note="okno na front (N)")]},
            {"id": "poddasze", "label": "Poddasze", "usable": False, "rooms": [
                R("2.01", "Poddasze nieużytkowe", None, note="obrys wewn. 6,87 × 7,32 m; linie wysokości 140/180/220/225 cm; płaski strop ok. 2,25 m na szer. 1,03 m")]},
        ],
    },
    "E": {
        "family": "szeregowiec",
        "note": "Szeregowiec skrajny (wschodni koniec szeregu G-F-E). Okna także w ścianie szczytowej.",
        "plans": {"parter": "dom-e-parter.png", "pietro": "dom-e-pietro.png", "poddasze": "dom-e-poddasze.png"},
        "floors": [
            {"id": "parter", "label": "Parter", "rooms": [
                R("0.01", "Wiatrołap", 3.89), R("0.02", "WC", 2.57), R("0.03", "Pomieszczenie techniczne", 0.76),
                R("0.04", "Schody", 4.58), R("0.05", "Strefa dzienna", 29.61, note="salon + jadalnia, wyjście HS na taras"),
                R("0.06", "Aneks kuchenny", 7.86, note="okno na front")],
             "outdoor": [R("-", "Taras (do aranżacji indywidualnej)", 7.12), R("-", "Zadaszenie nad wejściem", 6.96)]},
            {"id": "pietro", "label": "Piętro", "rooms": [
                R("1.01", "Korytarz", 5.28), R("1.02", "Pokój 1", 10.15), R("1.03", "Pokój 2", 9.75),
                R("1.04", "Łazienka", 4.41, note="okno w szczycie, wanna"), R("1.05", "Sypialnia", 10.86),
                R("1.06", "Pokój 3", 10.08)]},
            {"id": "poddasze", "label": "Poddasze", "usable": False, "rooms": [
                R("2.01", "Poddasze nieużytkowe", None, note="obrys wewn. ok. 6,59 × 6,61 m")]},
        ],
    },
    "F": {
        "family": "szeregowiec",
        "note": "Szeregowiec środkowy (ściany wspólne z E i G).",
        "plans": {"parter": "dom-f-parter.png", "pietro": "dom-f-pietro.png", "poddasze": "dom-f-poddasze.png"},
        "floors": [
            {"id": "parter", "label": "Parter", "rooms": [
                R("0.01", "Wiatrołap", 3.89), R("0.02", "WC", 2.57), R("0.03", "Pomieszczenie techniczne", 0.76),
                R("0.04", "Schody", 4.58), R("0.05", "Strefa dzienna", 30.63, note="salon + jadalnia, wyjście HS na taras"),
                R("0.06", "Aneks kuchenny", 8.43, note="okno na front")],
             "outdoor": [R("-", "Taras (do aranżacji indywidualnej)", 7.12), R("-", "Zadaszenie nad wejściem", 7.09)]},
            {"id": "pietro", "label": "Piętro", "rooms": [
                R("1.01", "Korytarz", 5.77), R("1.02", "Pokój 1", 10.84), R("1.03", "Pokój 2", 9.50),
                R("1.04", "Łazienka", 4.41), R("1.05", "Sypialnia", 10.86), R("1.06", "Pokój 3", 10.73)]},
            {"id": "poddasze", "label": "Poddasze", "usable": False, "rooms": [R("2.01", "Poddasze nieużytkowe", None)]},
        ],
    },
}

for k, L in layouts.items():
    tot = 0
    for f in L["floors"]:
        usable = f.get("usable", True)
        s = round(sum(r["area"] or 0 for r in f["rooms"]), 2)
        f["total"] = s if usable else None
        tot += s if usable else 0
    L["usableTotal"] = round(tot, 2)
    print(k, [f["total"] for f in L["floors"]], L["usableTotal"])

sp_poly = {
    "A": "M336 541L334 534L318 532L306 534L301 522.5L281 526L285 537L168 556L162 545.5L143 548.5L141 552L145 561.5L120 566L122 633.5L71 718.5L115.5 709L77 796L370.5 738.5L327.5 647.5L316 546L336 541Z",
    "B": "M334 528.5V533L336 541.5L316 546.5L328 647L376.5 750.5L571 703L575.5 720.5L646.5 703L604.5 559L525 576L508.5 519.5L497.5 514L481.5 515.5L478.5 505L461.5 508L464.5 519.5L356.5 538L353.5 526L334 528.5Z",
    "C": "M605 559L646.5 703L739.5 679L745.5 694.5L889.5 657L884.5 559.5L850.5 472.5L833 475V468L830.5 464L816.5 466V478L726.5 494L727 486L725 483L710 486V498.5L697.5 501.5L689.5 508L697 552.5L605 559Z",
    "D": "M858.5 483.5L856 485L884.5 559.5L889.5 657L899.5 672L1056.5 632.5L1068 644.5L1125 629L1027 519.5L997.5 457.5L981.5 460.5V453L978.5 450L965 453V463.5L884 478V470.5L880.5 467.5L867 470.5V482L858.5 483.5Z",
    "E": "M1308 596.5L1332 504.5L1287 427L1177.5 448L1128 460L1124.5 507L1024.5 514.5L1026.5 518.5L1125 629L1191.5 611.5L1205 622.5L1308 596.5Z",
    "F": "M1425 578.5L1325.5 609L1308.5 596L1332 505L1293.5 438L1303 436.5L1403.5 416L1451.5 490.5L1425 578.5ZM1425 578.5L1439.5 592L1609.5 539.5L1574 517.5L1602 508.5L1667.5 543.5L1638 557.5L1608 539L1439.5 591.5L1425 578.5Z",
    "G": "M1422 425L1412.5 427.5L1451.5 490.5L1424.5 578L1439.5 592L1573.5 551L1603.5 571.5L1638 557.5L1573.5 518L1547.5 525L1566 477.5L1515 406L1422 425Z",
}
sp_marker = {"A": [220, 520], "B": [410, 500], "C": [780, 465], "D": [940, 445], "E": [1230, 410], "F": [1350, 390], "G": [1470, 375]}
pzt = {"A": [65.26, 12.00, 8.23, 10.05], "B": [57.26, 10.74, 8.23, 9.86], "C": [39.72, 7.49, 8.23, 10.00],
       "D": [31.67, 5.95, 8.23, 10.09], "E": [14.79, 2.93, 7.63, 9.67], "F": [7.44, 1.44, 7.53, 9.67], "G": [0.00, 0.00, 7.63, 9.67]}
roof = {"A": "szalwia", "B": "jasny", "C": "szampan", "D": "jasny", "E": "jasny", "F": "szalwia", "G": "szampan"}
H = [
    ("A", "A", "blizniak", "available", 119.51, 98.82, 1610000, 14008.53, "Garaż + 1 miejsce"),
    ("B", "B", "blizniak", "available", 119.77, 93.67, 1600000, 13890.09, "Garaż + 1 miejsce"),
    ("C", "A", "blizniak", "sold", 119.51, 85.33, None, None, "Garaż + 1 miejsce"),
    ("D", "B", "blizniak", "available", 119.77, 86.27, 1590000, 13803.28, "Garaż + 1 miejsce"),
    ("E", "E", "szeregowiec", "available", 99.80, 78.41, 1490000, 15647.97, "2 miejsca postojowe"),
    ("F", "F", "szeregowiec", "available", 102.97, 38.26, 1450000, 14737.27, "2 miejsca postojowe"),
    ("G", None, "szeregowiec", "sold", 100.86, 184.87, None, None, "2 miejsca postojowe"),
]
# Karty domów (PDF): "Poddasze nieużytkowe – powierzchnia po podłodze", wysokość w najwyższym punkcie 2,25 m. G: brak karty.
ATTIC = {k: {"area": v, "maxHeight": 2.25 if v else None, "label": "Poddasze nieużytkowe"}
         for k, v in {"A": 49.27, "B": 49.27, "C": 49.27, "D": 49.27, "E": 42.88, "F": 44.30, "G": None}.items()}
houses = []
for id_, lay, typ, st, area, garden, price, ppm, park in H:
    s = id_.lower()
    h = dict(
        id=id_, slug=s, layout=lay, type=typ, status=st, area=area, garden=garden, rooms=5, parking=park,
        attic=ATTIC[id_],
        price=price, pricePerM2=ppm,
        priceHistory=([dict(date="2026-04-24", price=price, pricePerM2=ppm)] if price else []),
        files=dict(card=f"zrodla/pdf/dom-{s}.pdf" if id_ != "G" else None,
                   plans={f: f"zrodla/rzuty/dom-{s}-{f}.png" for f in ["parter", "pietro", "poddasze", "ogrodek", "pzt"]} if id_ != "G" else None),
        sitePlan=dict(path=sp_poly[id_], marker=sp_marker[id_]),
        pzt=dict(x0=pzt[id_][0], z0=pzt[id_][1], w=pzt[id_][2], d=pzt[id_][3]),
        roofColor=roof[id_],
    )
    if lay is None:
        h["layoutNote"] = "Brak rzutów na senn.pl (404). Do makiety: lustro E (skrajny, zachodni koniec szeregu)."
    houses.append(h)

for h in houses:
    if h["price"]:
        calc = round(h["price"] / (h["area"] - 4.58), 2)
        print(h["id"], h["pricePerM2"], calc, "OK" if abs(calc - h["pricePerM2"]) < 0.02 else "DIFF")

data = {
    "meta": {
        "source": "https://senn.pl/inwestycje/osiedle-halo-wawer (+ /dom-a…f, rzuty, karty PDF)",
        "fetched": "2026-10-28",
        "author": "demo-halowawer-bd (research/UX)",
        "units": "m², zł brutto; pzt w metrach: x = wschód, z = południe, origin = NW narożnik domu G (±0,3 m, z PZT 21,5 px/m); sitePlan w pikselach obrazu 1920×1248",
        "pricePerM2Rule": "Deweloper liczy zł/m² od powierzchni użytkowej wg PN-ISO 9836:2022-07, czyli BEZ klatki schodowej (4,58 m²) i bez poddasza nieużytkowego: cena / (pow. − 4,58). Wyświetlać wartość z danych z groszami (np. 14 008,53), nie liczyć ani nie zaokrąglać do złotych.",
        "notes": [
            "Miejsca postojowe: bliźniak = garaż + 1 m.p., szeregowiec = 2 m.p. Ceny nieznane (senn.pl ich nie publikuje), punkt otwarty przed publikacją. W UI tylko pole `parking`, bez ceny i bez sformułowania 'w cenie' (decyzja usera 28.10).",
            "Historia cen: jedyny wpis 24.04.2026 (start sprzedaży) dla A, B, D, E, F.",
            "C i G sprzedane: senn.pl nie pokazuje ich cen; G nie ma rzutów (404); C ma rzut A.",
            "Powierzchnie dokładne z tabeli i kart; marketingowe '120 m²' / '100 m²' / 'ogród do 180 m²' tylko w copy z 'ok.'.",
            "roofColor z drona 04.2026 (osiedle/estate-8.jpg); przypisanie do domów: pewność średnia.",
        ],
    },
    "investment": {
        "name": "Osiedle Halo Wawer",
        "developer": "Senn Development",
        "address": "ul. Borków 24B, 04-786 Warszawa (Zerzeń, Wawer)",
        "coords": {"lat": 52.18928, "lon": 21.14675, "source": "OSM Nominatim"},
        "salesStart": "2026-04-24",
        "completion": "2026-11",
        "floorHeight": 2.64,
        "orientation": {
            "gardens": "S (azymut ~180°)",
            "fronts": "N (dojazd ciągiem pieszo-jezdnym od północy)",
            "entry": "wjazd/wyjazd od wschodu, przy domu A",
            "rowAxis": "z zachodu na wschód: G F E (szereg) · D C (bliźniak) · B A (bliźniak)",
        },
        "phone": "+48 733 80 90 90",
        "sitePlanImage": {"src": "zrodla/plan/site-plan.png", "width": 1920, "height": 1248,
                          "view": "z lotu ptaka od frontu (kamera od północy, wschód po lewej)"},
        "features": ["ogrzewanie podłogowe w całym domu", "podwójna ściana międzylokalowa 43 cm",
                     "okna przesuwne HS na ogród", "światłowód", "poddasze do 50 m²", "ogrody od południa"],
    },
    "layouts": layouts,
    "houses": houses,
    "styles": [
        {"id": "s1", "name": "Jasna skandynawska", "desc": "len, jasny dąb, bouclé", "swatches": ["#e2d9c8", "#d4ab74", "#f1ece3"], "scenario": "Rodzina 2+2"},
        {"id": "s4", "name": "Japandi", "desc": "jesion, papier ryżowy, czerń", "swatches": ["#cdb48e", "#efe7d8", "#23211f"], "scenario": "Para + gabinet"},
        {"id": "s3", "name": "Grafitowa", "desc": "antracyt, czarny dąb, marmur", "swatches": ["#3b3b3d", "#5a4434", "#e7e4df"], "scenario": "Para + pokój gościnny"},
    ],
    "timeOfDay": [
        {"id": "rano", "label": "Rano", "date": "2027-09-21T08:30+02:00", "sunAzimuth": 114.4, "sunElevation": 18.7, "threeDir": [0.863, 0.320, 0.391],
         "note": "niskie słońce z ESE: oświetla szczyty wschodnie i muska ogrody"},
        {"id": "dzien", "label": "Dzień", "date": "2027-09-21T15:30+02:00", "sunAzimuth": 232.4, "sunElevation": 26.1, "threeDir": [-0.712, 0.440, 0.548],
         "note": "ciepłe popołudnie z SW: słońce wpada przez okno HS do salonu (52° od normalnej elewacji S); zgodne z renderami Kreatora i hero"},
        {"id": "noc", "label": "Noc", "date": "2027-09-21T19:15+02:00", "sunAzimuth": 279.6, "sunElevation": -6.6, "threeDir": [-0.979, -0.115, -0.166],
         "note": "niebieska godzina: niebo zmierzchu + ciepłe światła w oknach i kule ogrodowe (jak visualization-2/-6)"},
    ],
}
with open(out, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)
print("written", out)
