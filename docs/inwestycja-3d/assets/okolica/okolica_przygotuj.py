"""Krok 3/5: OSM -> geometria duchów w układzie modelu BOR2 (Python systemowy, numpy + Pillow).

Uruchomienie:
    python -I okolica_przygotuj.py dane/osm-overpass.json dane/bor2-obrysy.json dane/okolica-dane.json [podglad/okolica-plan.jpg]

Co robi:
1. Georeferencja. Lon/lat -> lokalny ENU (elipsoida WGS84, promienie M i N w punkcie adresowym).
   Dopasowanie sztywne (obrót + przesunięcie, bez skali) środków 8 sąsiadów zamodelowanych
   w BOR2 do ich obrysów w OSM. Wynik i reszty idą do "georef" w pliku wyjściowym.
2. Wybór: budynki ze środkiem do R_BUD od środka osiedla, drogi przycięte do R_DROGI,
   bez sąsiadów z BOR2 i bez niczego, co nachodzi na osiedle (strefy z bor2-obrysy.json).
3. Bryły: obrys z OSM wyciągnięty w górę, dach liczony jako pole wysokości nad prostokątem
   o najmniejszym polu (OBB): dwuspadowy (kalenica wzdłuż dłuższego boku), czterospadowy
   (obrys prawie kwadratowy albo nieprostokątny) albo płaski (duże i niemieszkalne).
   Połówki bliźniaków / segmenty (stykające się domy) dostają wspólny dach.
4. Drogi: pasy wg klasy (szerokości w SZEROKOSC), parkingi jako wielokąty, boisko z liniami.
5. Drzewa: punkty w zadrzewieniach OSM (siatka heksagonalna, ok. 1 drzewo / 40 m2, z jitterem),
   szpalery co 7 m, pojedyncze drzewa; bez punktów na budynkach, drogach, osiedlu i sąsiadach.
Wyjście: JSON z siatkami (wierzchołki X,Y,Z modelu BOR2 + ściany), metadane i punkty drzew.
"""
import json
import math
import sys

import numpy as np

OSM, OBRYSY, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PLAN = sys.argv[4] if len(sys.argv) > 4 else None

# --- Parametry -------------------------------------------------------------------
LAT0, LON0 = 52.18928, 21.14675          # punkt adresowy Borków 24B (Nominatim)
SRODEK = (70.7, 48.6)                     # środek rzędu domów w układzie BOR2
R_BUD = 420.0                             # promień budynków (środek obrysu)
R_DROGI = 450.0                           # promień dróg, parkingów i drzew
R_BLISKO = 240.0                          # bliżej: osobna bryła DUCH_###; dalej: scalone ćwiartki
KONDYGNACJA = 3.0
SPADEK = 35.0                             # nachylenie dachów domów
SPADEK_GOSP = 25.0                        # budynki gospodarcze, garaże
MAKS_WZNIOS = 4.5                         # maks. wysokość dachu nad okapem
Z_SPOD = -0.3                             # ściany zaczynają się lekko pod terenem
Z_DROGI = 0.02
Z_PARKING = 0.015
Z_BOISKO = 0.02
Z_LINIE = 0.03
DRZEWO_M2 = 40.0
SZPALER_M = 7.0

# Pary: sąsiad w BOR2 -> budynek OSM (way id). Ustalone na mapie, potwierdzone resztami < 0,5 m.
PARY = {"Component#7": 899631023, "Component#7.001": 899631022, "Component#7.002": 899631021,
        "Component#7.003": 899631020, "Group#3": 962326212, "Group#4": 962326175,
        "Group#5": 962326225, "Group#19": 1415910219}

SZEROKOSC = {  # m, pas jezdni (bez chodników - chodniki w OSM są osobnymi liniami)
    "primary": 9.0, "secondary": 8.0, "tertiary": 7.0, "unclassified": 5.5, "residential": 5.5,
    "living_street": 5.0, "service": 3.5, "track": 3.0, "pedestrian": 4.0,
    "cycleway": 2.0, "footway": 1.6, "path": 1.2, "bridleway": 1.5,
}
SERVICE = {"driveway": 3.0, "parking_aisle": 5.0, "alley": 3.5}

DOM = {"house", "detached", "semidetached_house", "bungalow", "residential", "terrace",
       "construction", "yes", "farm", "cabin", "static_caravan", "villa"}
GOSP = {"outbuilding", "garage", "garages", "shed", "farm_auxiliary", "greenhouse", "carport",
        "hut", "barn", "roof", "kiosk", "toilets"}
NIEMIESZK = {"industrial", "warehouse", "retail", "commercial", "office", "school", "kindergarten",
             "hotel", "apartments", "public", "service", "supermarket", "church", "civic",
             "hospital", "sports_hall", "transportation", "university", "dormitory"}

# --- Geodezja --------------------------------------------------------------------
A_WGS, F_WGS = 6378137.0, 1 / 298.257223563
E2 = F_WGS * (2 - F_WGS)
_s = math.sin(math.radians(LAT0))
R_N = A_WGS / math.sqrt(1 - E2 * _s * _s)                 # promień w pierwszym wertykale
R_M = A_WGS * (1 - E2) / (1 - E2 * _s * _s) ** 1.5         # promień południka
COSLAT = math.cos(math.radians(LAT0))


def enu(lat, lon):
    return (math.radians(lon - LON0) * R_N * COSLAT, math.radians(lat - LAT0) * R_M)


def latlon(e, n):
    return (LAT0 + math.degrees(n / R_M), LON0 + math.degrees(e / (R_N * COSLAT)))


# --- Geometria 2D -----------------------------------------------------------------
def area(p):
    return 0.5 * sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p))) * -1


def centroid(p):
    a = cx = cy = 0.0
    for i in range(len(p)):
        x0, y0 = p[i]
        x1, y1 = p[(i + 1) % len(p)]
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    if abs(a) < 1e-9:
        return (sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p))
    return (cx / (3 * a), cy / (3 * a))


def hull(points):
    pts = sorted(set((round(x, 4), round(y, 4)) for x, y in points))
    if len(pts) < 3:
        return pts

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def buffer_convex(poly, r, k=16):
    pts = []
    for x, y in poly:
        for i in range(k):
            a = 2 * math.pi * i / k
            pts.append((x + r * math.cos(a), y + r * math.sin(a)))
    return hull(pts)


def inside(pt, poly):
    x, y = pt
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def seg_x(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return (o(a, b, c) * o(a, b, d) < 0) and (o(c, d, a) * o(c, d, b) < 0)


def bbox(p):
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    return (min(xs), min(ys), max(xs), max(ys))


def bb_overlap(a, b, m=0.0):
    return a[0] - m <= b[2] and b[0] - m <= a[2] and a[1] - m <= b[3] and b[1] - m <= a[3]


def overlap(A, B):
    if not bb_overlap(bbox(A), bbox(B)):
        return False
    if any(inside(p, B) for p in A) or any(inside(p, A) for p in B):
        return True
    for i in range(len(A)):
        for j in range(len(B)):
            if seg_x(A[i - 1], A[i], B[j - 1], B[j]):
                return True
    return False


def seg_dist(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    L = ax * ax + ay * ay
    t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / L))
    return math.hypot(p[0] - a[0] - t * ax, p[1] - a[1] - t * ay)


def poly_dist(p, poly):
    return min(seg_dist(p, poly[i - 1], poly[i]) for i in range(len(poly)))


def clean(poly):
    """Bez duplikatu zamykającego, bez punktów < 5 cm od poprzednika i prawie współliniowych; CCW."""
    p = [tuple(q) for q in poly]
    if len(p) > 1 and math.dist(p[0], p[-1]) < 1e-6:
        p = p[:-1]
    out = []
    for q in p:
        if not out or math.dist(q, out[-1]) > 0.05:
            out.append(q)
    if len(out) > 2 and math.dist(out[0], out[-1]) <= 0.05:
        out.pop()
    changed = True
    while changed and len(out) > 3:
        changed = False
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            if abs(cr) < 0.02 * math.dist(a, c):     # odchylenie < 2 cm na metr
                out.pop(i)
                changed = True
                break
    if len(out) >= 3 and area(out) < 0:
        out.reverse()
    return out


def min_rect(points):
    """Prostokąt o najmniejszym polu: (środek, u dłuższy bok, v, L, W)."""
    h = hull(points)
    best = None
    for i in range(len(h)):
        ex, ey = h[i][0] - h[i - 1][0], h[i][1] - h[i - 1][1]
        n = math.hypot(ex, ey)
        if n < 1e-6:
            continue
        u = (ex / n, ey / n)
        v = (-u[1], u[0])
        su = [q[0] * u[0] + q[1] * u[1] for q in h]
        sv = [q[0] * v[0] + q[1] * v[1] for q in h]
        a = (max(su) - min(su)) * (max(sv) - min(sv))
        if best is None or a < best[0] - 1e-9:
            best = (a, u, v, min(su), max(su), min(sv), max(sv))
    _, u, v, u0, u1, v0, v1 = best
    if (u1 - u0) < (v1 - v0):
        u, v = v, (-u[0], -u[1])
        u0, u1, v0, v1 = v0, v1, -u1, -u0
    cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
    c = (cu * u[0] + cv * v[0], cu * u[1] + cv * v[1])
    return c, u, v, u1 - u0, v1 - v0


def earclip(poly):
    """Triangulacja wielokąta prostego CCW (indeksy)."""
    idx = list(range(len(poly)))
    tris = []

    def convex(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 1e-9

    def in_tri(p, a, b, c):
        d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])
        d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1])
        d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1])
        neg = d1 < -1e-12 or d2 < -1e-12 or d3 < -1e-12
        pos = d1 > 1e-12 or d2 > 1e-12 or d3 > 1e-12
        return not (neg and pos)
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        n = len(idx)
        found = False
        for k in range(n):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % n]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if not convex(a, b, c):
                continue
            if any(in_tri(poly[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            found = True
            break
        if not found:   # wielokąt zdegenerowany: wachlarz z reszty
            break
    for k in range(1, len(idx) - 1):
        tris.append((idx[0], idx[k], idx[k + 1]))
    return tris


def clip_half(poly, a, b, c):
    """Sutherland-Hodgman: część wielokąta wypukłego, gdzie a*x + b*y + c >= 0."""
    out = []
    for i in range(len(poly)):
        p, q = poly[i - 1], poly[i]
        fp, fq = a * p[0] + b * p[1] + c, a * q[0] + b * q[1] + c
        if fq >= 0:
            if fp < 0:
                t = fp / (fp - fq)
                out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
            out.append(q)
        elif fp >= 0:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


# --- Wczytanie --------------------------------------------------------------------
osm = json.load(open(OSM, encoding="utf-8"))
bor = json.load(open(OBRYSY, encoding="utf-8"))
els = osm["elements"]

# --- 1. Georeferencja -------------------------------------------------------------
ways = {e["id"]: e for e in els if e["type"] == "way"}
src, dst, names = [], [], []
for mk, wid in PARY.items():
    w = ways[wid]
    poly_enu = [enu(g["lat"], g["lon"]) for g in w["geometry"]]
    src.append(centroid(hull(bor["sasiedzi"][mk]["podstawa"])))
    dst.append(centroid(hull(poly_enu)))
    names.append(mk)
src, dst = np.array(src), np.array(dst)
ms, md = src.mean(0), dst.mean(0)
U, S, Vt = np.linalg.svd((src - ms).T @ (dst - md))
D = np.diag([1, np.sign(np.linalg.det(Vt.T @ U.T))])
ROT = Vt.T @ D @ U.T                      # model -> ENU
TR = md - ROT @ ms
res = np.linalg.norm((ROT @ src.T).T + TR - dst, axis=1)
rot_deg = math.degrees(math.atan2(ROT[1, 0], ROT[0, 0]))


def to_model(e, n):
    m = ROT.T @ (np.array([e, n]) - TR)
    return (float(m[0]), float(m[1]))


def ll_model(g):
    return to_model(*enu(g["lat"], g["lon"]))


# Błąd obrysu: średnia odległość wierzchołków obrysu OSM (po transformacji) od otoczki podstawy BOR2
obrys_err = {}
for mk, wid in PARY.items():
    poly = clean([ll_model(g) for g in ways[wid]["geometry"]])
    hb = hull(bor["sasiedzi"][mk]["podstawa"])
    obrys_err[mk] = sum(poly_dist(p, hb) for p in poly) / len(poly)
o_lat, o_lon = latlon(*TR)
georef = {
    "metoda": "dopasowanie sztywne (obrot+przesuniecie) srodkow obrysow 8 sasiadow BOR2 do OSM",
    "obrot_osi_X_ccw_od_wschodu_deg": round(rot_deg, 4),
    "azymut_osi_X_deg": round((90 - rot_deg) % 360, 3),
    "azymut_osi_Y_deg": round((-rot_deg) % 360, 3),
    "poczatek_ukladu_BOR2_lat_lon": [round(o_lat, 7), round(o_lon, 7)],
    "rms_srodki_m": round(float(math.sqrt((res ** 2).mean())), 3),
    "max_srodki_m": round(float(res.max()), 3),
    "reszty_srodkow_m": {n: round(float(r), 3) for n, r in zip(names, res)},
    "sredni_blad_obrysu_m": {k: round(v, 3) for k, v in obrys_err.items()},
}
print("GEOREF", json.dumps(georef, ensure_ascii=False))

# --- 2. Strefy wykluczone -----------------------------------------------------------
pts_os = bor["strefy"]["podłoże"]["obrys"] + bor["strefy"]["domki"]["obrys"]
STREFA_OSIEDLE = hull(pts_os)
STREFY = {"osiedle": STREFA_OSIEDLE, "Group#65": hull(bor["strefy"]["Group#65"]["obrys"])}
for k, v in bor["sasiedzi"].items():
    STREFY[k] = hull(v["obrys"])
STREFY_BUF = {k: buffer_convex(v, 1.0) for k, v in STREFY.items()}   # dla brył, parkingów, boisk
STREFY_BB = {k: bbox(v) for k, v in STREFY.items()}


def w_strefie(pt, margin=0.0):
    """Punkt w strefie wykluczonej albo bliżej niż margin od jej obrysu (obrysy bez bufora)."""
    for k, poly in STREFY.items():
        bb = STREFY_BB[k]
        if bb[0] - margin <= pt[0] <= bb[2] + margin and bb[1] - margin <= pt[1] <= bb[3] + margin:
            if inside(pt, poly) or (margin > 0 and poly_dist(pt, poly) < margin):
                return True
    return False


def dist_srodek(p):
    return math.hypot(p[0] - SRODEK[0], p[1] - SRODEK[1])


# --- 3. Budynki ---------------------------------------------------------------------
def levels_of(t):
    for key in ("building:levels",):
        v = t.get(key)
        if v:
            try:
                return max(1.0, float(str(v).replace(",", ".").split(";")[0]))
            except ValueError:
                pass
    return None


def height_of(t):
    v = t.get("height")
    if v:
        try:
            return float(str(v).replace(",", ".").split()[0].replace("m", ""))
        except ValueError:
            pass
    return None


def rings_of_relation(rel):
    """Zewnętrzne pierścienie relacji multipolygon (sklejanie odcinków po końcach)."""
    segs = [[ll_model(g) for g in m["geometry"]] for m in rel.get("members", [])
            if m.get("role") == "outer" and m.get("geometry")]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while changed and math.dist(cur[0], cur[-1]) > 0.01:
            changed = False
            for i, s in enumerate(segs):
                if math.dist(cur[-1], s[0]) < 0.01:
                    cur += s[1:]
                elif math.dist(cur[-1], s[-1]) < 0.01:
                    cur += s[::-1][1:]
                elif math.dist(cur[0], s[-1]) < 0.01:
                    cur = s[:-1] + cur
                elif math.dist(cur[0], s[0]) < 0.01:
                    cur = s[::-1][:-1] + cur
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        rings.append(cur)
    return rings


raw = []
pominiete = {"sasiad_BOR2": [], "kolizja_z_osiedlem": [], "poza_promieniem": 0}
sasiedzi_ids = set(PARY.values())
for e in els:
    t = e.get("tags", {})
    if "building" not in t or e["type"] not in ("way", "relation"):
        continue
    if e["type"] == "way":
        rings = [[ll_model(g) for g in e["geometry"]]]
    else:
        rings = rings_of_relation(e)
    for ring in rings:
        poly = clean(ring)
        if len(poly) < 3 or abs(area(poly)) < 4.0:
            continue
        c = centroid(poly)
        if dist_srodek(c) > R_BUD:
            pominiete["poza_promieniem"] += 1
            continue
        if e["id"] in sasiedzi_ids:
            pominiete["sasiad_BOR2"].append(e["id"])
            continue
        if any(overlap(poly, z) for z in STREFY_BUF.values()):
            pominiete["kolizja_z_osiedlem"].append(e["id"])
            continue
        raw.append({"id": e["id"], "osm": "%s/%d" % (e["type"], e["id"]), "t": t, "poly": poly, "c": c,
                    "pole": area(poly)})
print("BUDYNKI kandydaci", len(raw), "pominiete", {k: (len(v) if isinstance(v, list) else v) for k, v in pominiete.items()})

# Klasyfikacja
for b in raw:
    t = b["t"]
    typ = t.get("building", "yes")
    b["typ"] = typ
    b["lv"] = levels_of(t)
    b["h_tag"] = height_of(t)
    if typ in GOSP:
        b["klasa"] = "gosp"
    elif typ in NIEMIESZK or (b["lv"] or 0) >= 4 or b["pole"] > 300:
        b["klasa"] = "duzy"
    else:
        b["klasa"] = "dom"
    c, u, v, L, W = min_rect(b["poly"])
    b["obb"] = (c, u, v, L, W)
    b["prost"] = b["pole"] / max(L * W, 1e-6)
    if b["klasa"] == "dom" and L > 25:
        b["klasa"] = "duzy"

# Zespoły stykających się domów (bliźniaki, szeregi) -> wspólny dach
parent = list(range(len(raw)))


def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


domy = [i for i, b in enumerate(raw) if b["klasa"] == "dom"]
for ii, i in enumerate(domy):
    bi = bbox(raw[i]["poly"])
    for j in domy[ii + 1:]:
        if not bb_overlap(bi, bbox(raw[j]["poly"]), 0.5):
            continue
        touch = sum(1 for p in raw[i]["poly"] if poly_dist(p, raw[j]["poly"]) < 0.35)
        if touch >= 2:
            parent[find(i)] = find(j)
zespoly = {}
for i in domy:
    zespoly.setdefault(find(i), []).append(i)


def roof_planes(kind, obb, pitch_deg, eaves):
    """Płaszczyzny dachu: lista (półpłaszczyzny regionu, funkcja wysokości liniowa) w XY modelu."""
    c, u, v, L, W = obb
    k = math.tan(math.radians(pitch_deg))
    rise = k * W / 2
    if rise > MAKS_WZNIOS:
        k = MAKS_WZNIOS / (W / 2)
    # współrzędne lokalne: s = (p-c).u, t = (p-c).v ; boki: t=+W/2, t=-W/2, s=+L/2, s=-L/2
    # odległość od boku j: d = h_j - n_j.(p-c), n_j - normalna zewnętrzna, h_j - pół wymiaru
    sides = [(v, W / 2), ((-v[0], -v[1]), W / 2)]
    if kind == "hip":
        sides += [(u, L / 2), ((-u[0], -u[1]), L / 2)]

    def lin(n, h):
        # d(p) = h - n.(p - c) = (-n.x) x + (-n.y) y + (h + n.c)
        return (-n[0], -n[1], h + n[0] * c[0] + n[1] * c[1])
    ds = [lin(n, h) for n, h in sides]
    planes = []
    for j, dj in enumerate(ds):
        halfs = []
        for i, di in enumerate(ds):
            if i != j:   # region j: d_i - d_j >= 0 (bok j najbliżej)
                halfs.append((di[0] - dj[0], di[1] - dj[1], di[2] - dj[2]))
        hz = (k * dj[0], k * dj[1], eaves + k * dj[2])
        planes.append((halfs, hz))
    return planes, ds, k


def h_at(p, ds, k, eaves):
    return eaves + k * max(0.0, min(d[0] * p[0] + d[1] * p[1] + d[2] for d in ds))


def build_mesh(poly, kind, obb, pitch, eaves, z0, flat_h):
    """Wierzchołki (x,y,z) i ściany (listy indeksów) bryły."""
    V, F, vid = [], [], {}

    def vi(x, y, z):
        key = (round(x, 3), round(y, 3), round(z, 3))
        if key not in vid:
            vid[key] = len(V)
            V.append(key)
        return vid[key]
    if kind == "flat":
        top = lambda p: flat_h  # noqa: E731
        ring = list(poly)
    else:
        planes, ds, k = roof_planes(kind, obb, pitch, eaves)
        top = lambda p: h_at(p, ds, k, eaves)  # noqa: E731
        # wstawienie punktów załamania (przecięcia krawędzi z granicami połaci)
        ring = []
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            ring.append(a)
            ts = []
            for x in range(len(ds)):
                for y in range(x + 1, len(ds)):
                    dx, dy = ds[x], ds[y]
                    fa = (dx[0] - dy[0]) * a[0] + (dx[1] - dy[1]) * a[1] + dx[2] - dy[2]
                    fb = (dx[0] - dy[0]) * b[0] + (dx[1] - dy[1]) * b[1] + dx[2] - dy[2]
                    if fa * fb < 0:
                        tt = fa / (fa - fb)
                        p = (a[0] + tt * (b[0] - a[0]), a[1] + tt * (b[1] - a[1]))
                        dmin = min(d[0] * p[0] + d[1] * p[1] + d[2] for d in ds)
                        dxv = dx[0] * p[0] + dx[1] * p[1] + dx[2]
                        if abs(dxv - dmin) < 1e-6 and 1e-4 < tt < 1 - 1e-4:
                            ts.append(tt)
            for tt in sorted(ts):
                ring.append((a[0] + tt * (b[0] - a[0]), a[1] + tt * (b[1] - a[1])))
    # ściany
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        F.append([vi(a[0], a[1], z0), vi(b[0], b[1], z0), vi(b[0], b[1], top(b)), vi(a[0], a[1], top(a))])
    # dach
    tris = earclip(poly)
    if kind == "flat":
        for i0, i1, i2 in tris:
            F.append([vi(*poly[i], flat_h) for i in (i0, i1, i2)])
    else:
        for i0, i1, i2 in tris:
            tri = [poly[i0], poly[i1], poly[i2]]
            for halfs, hz in planes:
                piece = tri
                for hp in halfs:
                    piece = clip_half(piece, *hp)
                    if len(piece) < 3:
                        break
                if len(piece) < 3 or abs(area(piece)) < 1e-4:
                    continue
                F.append([vi(p[0], p[1], hz[0] * p[0] + hz[1] * p[1] + hz[2]) for p in piece])
    # usuń zdegenerowane ściany (np. ściana o zerowej wysokości)
    F2 = []
    for f in F:
        g = [f[0]] + [x for i, x in enumerate(f[1:], 1) if x != f[i - 1]]
        if len(g) > 1 and g[-1] == g[0]:
            g.pop()
        if len(set(g)) >= 3:
            F2.append(g)
    return V, F2


# Teren BOR2 (Group#2, 130 x 110 m) nie jest płaski: z = 0..1 m (warstwy 1,0/0,78/0,58/0,31/0,12, wyżej
# na zachodzie). Poza nim okolica leży na z = 0; drogi i boisko wchodzące na ten prostokąt kładziemy
# na nim: wysokość = maksimum terenu w promieniu r wokół punktu (rastrowo, 0,5 m), żeby pas nigdy
# nie wszedł pod schodek terenu (po niższej stronie schodka może wisieć do ok. 0,2 m).
TV = np.array(bor["teren"]["v"], dtype=float)
T_CELL = 0.5
T_X0, T_Y0 = TV[:, 0].min(), TV[:, 1].min()
T_X1, T_Y1 = TV[:, 0].max(), TV[:, 1].max()
T_NX, T_NY = int((T_X1 - T_X0) / T_CELL) + 1, int((T_Y1 - T_Y0) / T_CELL) + 1
T_H = np.full((T_NY, T_NX), -np.inf)
_gx = T_X0 + (np.arange(T_NX) + 0.5) * T_CELL
_gy = T_Y0 + (np.arange(T_NY) + 0.5) * T_CELL
for f in bor["teren"]["f"]:
    a, b, c = TV[f[0]], TV[f[1]], TV[f[2]]
    a2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if abs(a2) < 1e-6:        # ściany pionowe schodków
        continue
    i0 = max(0, int((min(a[0], b[0], c[0]) - T_X0) / T_CELL) - 1)
    i1 = min(T_NX - 1, int((max(a[0], b[0], c[0]) - T_X0) / T_CELL) + 1)
    j0 = max(0, int((min(a[1], b[1], c[1]) - T_Y0) / T_CELL) - 1)
    j1 = min(T_NY - 1, int((max(a[1], b[1], c[1]) - T_Y0) / T_CELL) + 1)
    X, Y = np.meshgrid(_gx[i0:i1 + 1], _gy[j0:j1 + 1])
    l1 = ((b[0] - X) * (c[1] - Y) - (b[1] - Y) * (c[0] - X)) / a2
    l2 = ((c[0] - X) * (a[1] - Y) - (c[1] - Y) * (a[0] - X)) / a2
    l3 = 1 - l1 - l2
    m = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
    sub = T_H[j0:j1 + 1, i0:i1 + 1]
    sub[m] = np.maximum(sub[m], (l1 * a[2] + l2 * b[2] + l3 * c[2])[m])
T_H[np.isinf(T_H)] = 0.0


def teren_z(p, r=0.0):
    """Wysokość terenu BOR2 pod punktem (maks. w promieniu r); poza prostokątem terenu BOR2: 0."""
    x, y = p
    if not (T_X0 <= x <= T_X1 and T_Y0 <= y <= T_Y1):
        return 0.0
    i0, i1 = max(0, int((x - r - T_X0) / T_CELL)), min(T_NX - 1, int((x + r - T_X0) / T_CELL))
    j0, j1 = max(0, int((y - r - T_Y0) / T_CELL)), min(T_NY - 1, int((y + r - T_Y0) / T_CELL))
    return max(0.0, float(T_H[j0:j1 + 1, i0:i1 + 1].max()))


def na_terenie(pts, margin=3.0):
    bb = bbox(pts)
    return bb[0] <= T_X1 + margin and bb[2] >= T_X0 - margin and bb[1] <= T_Y1 + margin and bb[3] >= T_Y0 - margin


def zageszczona(pts, step):
    out = [pts[0]]
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        n = max(1, math.ceil(math.dist(a, b) / step))
        out += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)]
    return out


budynki = []
podniesione = []
for root, members in list(zespoly.items()) + [(None, [i]) for i, b in enumerate(raw) if b["klasa"] != "dom"]:
    group = [raw[i] for i in members]
    allp = [p for b in group for p in b["poly"]]
    obb = min_rect(allp) if len(group) > 1 else group[0]["obb"]
    c, u, v, L, W = obb
    lv = max([b["lv"] for b in group if b["lv"]] or [None] if any(b["lv"] for b in group) else [None])
    for b in group:
        klasa = b["klasa"]
        lvb = lv or b["lv"]
        z0 = Z_SPOD
        if klasa == "dom":
            lvb = lvb or 2.0
            eaves = max(2.8, KONDYGNACJA * lvb - 1.0)
            if len(group) > 1:
                kind = "gable"
            elif L / max(W, 1e-6) < 1.15 or b["prost"] < 0.8:
                kind = "hip"
            else:
                kind = "gable"
            if W > 16:
                kind = "flat"
            pitch = SPADEK
            flat_h = KONDYGNACJA * lvb + 0.5
            if b["h_tag"]:
                rise = min(math.tan(math.radians(pitch)) * W / 2, MAKS_WZNIOS)
                eaves = max(2.5, b["h_tag"] - rise)
                flat_h = b["h_tag"]
        elif klasa == "gosp":
            lvb = lvb or 1.0
            eaves = 2.5 + (lvb - 1) * 2.8
            pitch = SPADEK_GOSP
            kind = "gable" if b["pole"] >= 15 and b["typ"] not in ("roof", "carport", "greenhouse") else "flat"
            if b["typ"] == "greenhouse":
                kind = "gable"
            flat_h = eaves + 0.1
            if b["typ"] in ("roof", "carport"):
                z0, flat_h = 2.3, 2.6
            if b["h_tag"]:
                flat_h = b["h_tag"]
                eaves = max(2.2, b["h_tag"] - math.tan(math.radians(pitch)) * W / 2)
        else:
            lvb = lvb or (1.0 if b["typ"] in ("retail", "warehouse", "industrial", "supermarket") else 2.0)
            flat_h = b["h_tag"] or KONDYGNACJA * lvb + 0.6
            if b["typ"] in ("warehouse", "industrial"):
                flat_h = max(flat_h, 6.0)
            if b["typ"] == "retail":
                flat_h = max(flat_h, 4.5)
            kind, pitch, eaves = "flat", 0, flat_h
        # bryła częściowo na terenie BOR2 (południowa krawędź ma 0,3-0,5 m): wysokości liczone od terenu
        dz = max(teren_z(p) for p in b["poly"])
        if dz > 0:
            podniesione.append((b["osm"], round(dz, 2)))
        V, F = build_mesh(b["poly"], kind, obb if len(group) > 1 else b["obb"], pitch, eaves + dz, z0,
                          flat_h + dz)
        ztop = max(p[2] for p in V)
        budynki.append({
            "osm": b["osm"], "typ": b["typ"], "klasa": klasa, "kondygnacje": lvb, "dach": kind,
            "okap": round(eaves if kind != "flat" else flat_h, 2), "wysokosc": round(ztop, 2),
            "zespol": len(group), "w_budowie": b["typ"] == "construction",
            "srodek": [round(b["c"][0], 2), round(b["c"][1], 2)], "odl": round(dist_srodek(b["c"]), 1),
            "pole": round(b["pole"], 1), "v": V, "f": F, "obrys": [[round(x, 2), round(y, 2)] for x, y in b["poly"]],
        })
budynki.sort(key=lambda b: b["odl"])
print("BUDYNKI podniesione o teren BOR2:", podniesione)
print("BUDYNKI", len(budynki), "dachy", {k: sum(1 for b in budynki if b["dach"] == k) for k in ("gable", "hip", "flat")},
      "trojkaty", sum(sum(len(f) - 2 for f in b["f"]) for b in budynki))

# --- 4. Drogi, parkingi, boisko -------------------------------------------------------
BUD_BB = [(bbox(b["obrys"]), b["obrys"]) for b in budynki]



def allowed(p, margin):
    if dist_srodek(p) > R_DROGI:
        return False
    return not w_strefie(p, margin)


def clip_line(pts, margin, step=0.5):
    """Przycięcie polilinii do koła R_DROGI i poza strefy (z marginesem): lista odcinków."""
    runs, cur = [], []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        n = max(1, int(math.dist(a, b) / step))
        for k in range(n + (1 if i == len(pts) - 2 else 0)):
            tt = k / n
            p = (a[0] + tt * (b[0] - a[0]), a[1] + tt * (b[1] - a[1]))
            if allowed(p, margin):
                cur.append(p)
            else:
                if len(cur) >= 2:
                    runs.append(cur)
                cur = []
    if len(cur) >= 2:
        runs.append(cur)
    # uproszczenie: zostaw wierzchołki, gdzie zmienia się kierunek
    out = []
    for r in runs:
        s = [r[0]]
        for k in range(1, len(r) - 1):
            a, b, c = s[-1], r[k], r[k + 1]
            cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            if abs(cr) > 1e-3 * max(math.dist(a, c), 1e-6):
                s.append(b)
        s.append(r[-1])
        if sum(math.dist(s[k], s[k + 1]) for k in range(len(s) - 1)) > 1.0:
            out.append(s)
    return out


def strip(pts, w, zs):
    """Pas o szerokości w wzdłuż polilinii (łączenia ze ścięciem), czworokąty; zs - wysokość w wierzchołkach."""
    V, F = [], []
    h = w / 2
    n = len(pts)
    left, right = [], []
    for i in range(n):
        if i == 0:
            d = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
            L = math.hypot(*d)
            nx, ny = -d[1] / L, d[0] / L
            m = h
        elif i == n - 1:
            d = (pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
            L = math.hypot(*d)
            nx, ny = -d[1] / L, d[0] / L
            m = h
        else:
            d1 = (pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
            d2 = (pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
            L1, L2 = math.hypot(*d1), math.hypot(*d2)
            n1 = (-d1[1] / L1, d1[0] / L1)
            n2 = (-d2[1] / L2, d2[0] / L2)
            mx, my = n1[0] + n2[0], n1[1] + n2[1]
            ml = math.hypot(mx, my)
            if ml < 1e-6:
                mx, my, ml = n1[0], n1[1], 1.0
            nx, ny = mx / ml, my / ml
            cosh = nx * n1[0] + ny * n1[1]
            m = min(h / max(cosh, 1e-3), 2.5 * h)
        left.append((pts[i][0] + nx * m, pts[i][1] + ny * m))
        right.append((pts[i][0] - nx * m, pts[i][1] - ny * m))
    for i in range(n):
        V.append((round(left[i][0], 3), round(left[i][1], 3), round(zs[i], 3)))
        V.append((round(right[i][0], 3), round(right[i][1], 3), round(zs[i], 3)))
    for i in range(n - 1):
        F.append([2 * i + 1, 2 * i + 3, 2 * i + 2, 2 * i])   # CCW od góry
    return V, F


def disc(p, r, z, k=10):
    V = [(round(p[0] + r * math.cos(2 * math.pi * i / k), 3), round(p[1] + r * math.sin(2 * math.pi * i / k), 3), z)
         for i in range(k)]
    return V, [list(range(k))]


class Acc:
    def __init__(self):
        self.V, self.F = [], []

    def add(self, V, F):
        o = len(self.V)
        self.V += [tuple(v) for v in V]
        self.F += [[o + i for i in f] for f in F]

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


drogi = Acc()
node_use = {}
road_list = []
for e in els:
    t = e.get("tags", {})
    hw = t.get("highway")
    if e["type"] != "way" or hw not in SZEROKOSC or "geometry" not in e:
        continue
    if t.get("area") == "yes" or t.get("tunnel") in ("yes", "building_passage") or t.get("indoor") == "yes":
        continue
    w = SZEROKOSC[hw]
    if hw == "service" and t.get("service") in SERVICE:
        w = SERVICE[t["service"]]
    if t.get("width"):
        try:
            w = max(1.0, min(15.0, float(t["width"].replace(",", ".").split()[0])))
        except ValueError:
            pass
    pts = [ll_model(g) for g in e["geometry"]]
    road_list.append((e, w, pts))
    for k in (0, -1):
        node_use.setdefault(e["nodes"][k], []).append((w, pts[k]))
    for nid in e["nodes"][1:-1]:
        node_use.setdefault(nid, []).append((w, None))
n_odc = 0
dl = 0.0
for e, w, pts in road_list:
    for run in clip_line(pts, w / 2 + 0.3):
        if na_terenie(run):
            run = zageszczona(run, 1.5)
        V, F = strip(run, w, [Z_DROGI + teren_z(p, w / 2 + 0.3) for p in run])
        drogi.add(V, F)
        n_odc += 1
        dl += sum(math.dist(run[k], run[k + 1]) for k in range(len(run) - 1))
# krążki w węzłach, gdzie stykają się końce dróg (bez szczelin na załamaniach między odcinkami)
n_kr = 0
for nid, uses in node_use.items():
    ends = [(w, p) for w, p in uses if p is not None]
    if len(uses) >= 2 and ends:
        w = max(u[0] for u in uses)
        p = ends[0][1]
        if allowed(p, w / 2 + 0.3):
            V, F = disc(p, w / 2, round(Z_DROGI + teren_z(p, w / 2 + 0.3), 3))
            drogi.add(V, F)
            n_kr += 1
print("DROGI odcinki", n_odc, "dlugosc %.0f m" % dl, "krazki", n_kr, "trojkaty", drogi.tris())

# parkingi i place (wielokąty)
place = Acc()
n_park = 0
for e in els:
    t = e.get("tags", {})
    if e["type"] != "way" or "geometry" not in e:
        continue
    is_park = t.get("amenity") == "parking" and t.get("parking") not in ("underground", "multi-storey", "rooftop")
    is_area = t.get("highway") in ("pedestrian", "service", "footway") and t.get("area") == "yes"
    if not (is_park or is_area):
        continue
    poly = clean([ll_model(g) for g in e["geometry"]])
    if len(poly) < 3 or dist_srodek(centroid(poly)) > R_DROGI:
        continue
    if any(overlap(poly, z) for z in STREFY_BUF.values()):
        continue
    tris = earclip(poly)
    place.add([(round(p[0], 3), round(p[1], 3), round(Z_PARKING + teren_z(p, 1.0), 3)) for p in poly],
              [list(tr) for tr in tris])
    n_park += 1
print("PARKINGI", n_park, "trojkaty", place.tris())

# boisko(-a)
boisko, linie = Acc(), Acc()
boiska_meta = []


def rect_pts(c, u, v, s0, s1, t0, t1):
    return [(c[0] + u[0] * s + v[0] * t, c[1] + u[1] * s + v[1] * t) for s, t in ((s0, t0), (s1, t0), (s1, t1), (s0, t1))]


def line_quad(acc, a, b, w, z):
    """Linia boiska: pas szerokości w, na terenie BOR2 dzielony co 2 m i kładziony na terenie
    (promień 2,5 m >= zasięg wierzchołków siatki płyty, więc linia nigdy nie wchodzi pod płytę)."""
    d = (b[0] - a[0], b[1] - a[1])
    L = math.hypot(*d)
    if L < 1e-6:
        return
    nx, ny = -d[1] / L * w / 2, d[0] / L * w / 2
    pts = zageszczona([a, b], 2.0) if na_terenie([a, b]) else [a, b]
    V, F = [], []
    for k, p in enumerate(pts):
        zz = round(z + teren_z(p, 2.5), 3)
        V += [(p[0] - nx, p[1] - ny, zz), (p[0] + nx, p[1] + ny, zz)]
        if k:
            F.append([2 * k - 2, 2 * k, 2 * k + 1, 2 * k - 1])
    acc.add(V, F)


def plyta(acc, poly, z):
    """Płyta boiska; gdy wchodzi na teren BOR2 - siatka co 2 m (pasy bez terenu scalone w jeden czworokąt)."""
    if not na_terenie(poly):
        acc.add([(round(p[0], 3), round(p[1], 3), z) for p in poly], [list(tr) for tr in earclip(poly)])
        return
    c, u, v, L, W = min_rect(poly)
    ns, nt = max(1, math.ceil(L / 2)), max(1, math.ceil(W / 2))
    ss = [-L / 2 + L * i / ns for i in range(ns + 1)]
    ts = [-W / 2 + W * j / nt for j in range(nt + 1)]

    def P(s, t):
        return (c[0] + u[0] * s + v[0] * t, c[1] + u[1] * s + v[1] * t)
    for j in range(nt):
        rows = [[P(s, ts[j]) for s in ss], [P(s, ts[j + 1]) for s in ss]]
        zr = [[teren_z(p, 1.0) for p in row] for row in rows]
        if max(max(r) for r in zr) == 0:
            V = [(*rows[0][0], z), (*rows[0][-1], z), (*rows[1][-1], z), (*rows[1][0], z)]
            acc.add([(round(x, 3), round(y, 3), zz) for x, y, zz in V], [[0, 1, 2, 3]])
            continue
        V = [(round(p[0], 3), round(p[1], 3), round(z + zz, 3)) for row, zrow in zip(rows, zr) for p, zz in zip(row, zrow)]
        n = len(ss)
        acc.add(V, [[i, i + 1, n + i + 1, n + i] for i in range(n - 1)])


def box(acc, c, u, v, s0, s1, t0, t1, z0, z1):
    base = rect_pts(c, u, v, s0, s1, t0, t1)
    dz = teren_z(((base[0][0] + base[2][0]) / 2, (base[0][1] + base[2][1]) / 2), 1.0)
    z0, z1 = z0 + dz - (0.1 if dz > 0 else 0), z1 + dz
    V = [(p[0], p[1], z0) for p in base] + [(p[0], p[1], z1) for p in base]
    F = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]
    acc.add(V, F)


for e in els:
    t = e.get("tags", {})
    if e["type"] != "way" or t.get("leisure") != "pitch" or "geometry" not in e:
        continue
    poly = clean([ll_model(g) for g in e["geometry"]])
    if len(poly) < 3 or dist_srodek(centroid(poly)) > R_DROGI:
        continue
    if any(overlap(poly, z) for z in STREFY_BUF.values()):
        continue
    plyta(boisko, poly, Z_BOISKO)
    c, u, v, L, W = min_rect(poly)
    boiska_meta.append({"osm": "way/%d" % e["id"], "sport": t.get("sport"), "dlugosc": round(L, 1), "szerokosc": round(W, 1)})
    if t.get("sport") != "soccer":
        continue
    lw = 0.12
    m = 1.0  # linie 1 m od krawędzi obrysu OSM
    hl, hw = L / 2 - m, W / 2 - m
    corners = rect_pts(c, u, v, -hl, hl, -hw, hw)
    for i in range(4):
        line_quad(linie, corners[i - 1], corners[i], lw, Z_LINIE)
    line_quad(linie, rect_pts(c, u, v, 0, 0, -hw, hw)[0], rect_pts(c, u, v, 0, 0, -hw, hw)[2], lw, Z_LINIE)
    sk = min(1.0, (2 * hw) / 68.0)
    r = 9.15 * sk
    ring = [(c[0] + r * math.cos(2 * math.pi * i / 32), c[1] + r * math.sin(2 * math.pi * i / 32)) for i in range(33)]
    for i in range(32):
        line_quad(linie, ring[i], ring[i + 1], lw, Z_LINIE)
    for sgn in (-1, 1):
        for depth, half in ((16.5 * sk, 20.16 * sk), (5.5 * sk, 9.16 * sk)):
            s_end = sgn * hl
            s_in = sgn * (hl - depth)
            p = rect_pts(c, u, v, s_end, s_in, -half, half)
            line_quad(linie, p[0], p[1], lw, Z_LINIE)
            line_quad(linie, p[1], p[2], lw, Z_LINIE)
            line_quad(linie, p[2], p[3], lw, Z_LINIE)
        # bramka 7,32 x 2,44 (słupki i poprzeczka 12 cm), za linią końcową
        s0 = sgn * hl
        s1 = sgn * (hl + 0.12)
        a, b = min(s0, s1), max(s0, s1)
        box(linie, c, u, v, a, b, -3.78, -3.66, 0.0, 2.44)
        box(linie, c, u, v, a, b, 3.66, 3.78, 0.0, 2.44)
        box(linie, c, u, v, a, b, -3.78, 3.78, 2.32, 2.44)
print("BOISKA", boiska_meta, "trojkaty", boisko.tris(), linie.tris())

# --- 5. Drzewa ----------------------------------------------------------------------
def tree_ok(p, roads_idx):
    if dist_srodek(p) > R_DROGI or w_strefie(p, 3.0):
        return False
    if T_X0 - 2 <= p[0] <= T_X1 + 2 and T_Y0 - 2 <= p[1] <= T_Y1 + 2:   # teren BOR2 (z do 1 m, własna zieleń)
        return False
    for bb, poly in BUD_BB:
        if bb[0] - 1.5 <= p[0] <= bb[2] + 1.5 and bb[1] - 1.5 <= p[1] <= bb[3] + 1.5:
            if inside(p, poly) or poly_dist(p, poly) < 1.5:
                return False
    cx, cy = int(p[0] // 20), int(p[1] // 20)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for a, b, w in roads_idx.get((cx + dx, cy + dy), ()):
                if seg_dist(p, a, b) < w / 2 + 1.0:
                    return False
    return True


roads_idx = {}
for e, w, pts in road_list:
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        n = max(1, int(math.dist(a, b) / 10))
        for i in range(n + 1):
            p = (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)
            key = (int(p[0] // 20), int(p[1] // 20))
            lst = roads_idx.setdefault(key, [])
            if not lst or lst[-1] != (a, b, w):
                lst.append((a, b, w))
pitch_polys = []
for e in els:
    t = e.get("tags", {})
    if e["type"] == "way" and t.get("leisure") in ("pitch", "playground") and "geometry" in e:
        pitch_polys.append(clean([ll_model(g) for g in e["geometry"]]))


def rnd(i, j, s):
    x = math.sin(i * 12.9898 + j * 78.233 + s * 37.719) * 43758.5453
    return x - math.floor(x)


las_pts, las_obrysy = [], []
spacing = math.sqrt(2 * DRZEWO_M2 / math.sqrt(3))
for e in els:
    t = e.get("tags", {})
    if not (t.get("natural") == "wood" or t.get("landuse") == "forest"):
        continue
    if e["type"] == "way" and "geometry" in e:
        rings = [[ll_model(g) for g in e["geometry"]]]
    elif e["type"] == "relation":
        rings = rings_of_relation(e)
    else:
        continue
    for ring in rings:
        poly = clean(ring)
        if len(poly) < 3:
            continue
        bb = bbox(poly)
        # odległość najbliższego punktu prostokąta od środka osiedla
        nx = min(max(SRODEK[0], bb[0]), bb[2])
        ny = min(max(SRODEK[1], bb[1]), bb[3])
        if math.hypot(nx - SRODEK[0], ny - SRODEK[1]) > R_DROGI:
            continue
        n0 = len(las_pts)
        j = 0
        y = bb[1] + spacing * 0.3
        while y <= bb[3]:
            off = (j % 2) * spacing / 2
            x = bb[0] + off + spacing * 0.3
            i = 0
            while x <= bb[2]:
                p = (x + (rnd(i, j, e["id"] % 997) - 0.5) * 2.4, y + (rnd(j, i, e["id"] % 991) - 0.5) * 2.4)
                if inside(p, poly) and tree_ok(p, roads_idx) and not any(inside(p, pp) for pp in pitch_polys):
                    las_pts.append(p)
                x += spacing
                i += 1
            y += spacing * math.sqrt(3) / 2
            j += 1
        if len(las_pts) > n0:
            las_obrysy.append({"osm": "%s/%d" % (e["type"], e["id"]), "drzew": len(las_pts) - n0,
                               "pole": round(abs(area(poly))), "obrys": [[round(x, 1), round(y, 1)] for x, y in poly]})
szpaler_pts = []
for e in els:
    t = e.get("tags", {})
    if e["type"] == "way" and t.get("natural") == "tree_row" and "geometry" in e:
        pts = [ll_model(g) for g in e["geometry"]]
        acc = 0.0
        for k in range(len(pts) - 1):
            a, b = pts[k], pts[k + 1]
            L = math.dist(a, b)
            s = (SZPALER_M - acc) % SZPALER_M if k else 0.0
            while s <= L:
                p = (a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L)
                if tree_ok(p, {}):
                    szpaler_pts.append(p)
                s += SZPALER_M
            acc = (acc + L) % SZPALER_M
pojedyncze = []
for e in els:
    if e["type"] == "node" and e.get("tags", {}).get("natural") == "tree":
        p = to_model(*enu(e["lat"], e["lon"]))
        if tree_ok(p, {}):
            pojedyncze.append(p)
print("DRZEWA las", len(las_pts), "w", len(las_obrysy), "obrysach; szpalery", len(szpaler_pts), "pojedyncze", len(pojedyncze))

# --- Zapis ----------------------------------------------------------------------------
out = {
    "uklad": "BOR2 (SketchUp/Blender): X = wschod, Y = polnoc, Z = gora, metry",
    "zrodlo": "(c) OpenStreetMap contributors, ODbL 1.0",
    "osm_timestamp": osm.get("osm3s", {}).get("timestamp_osm_base"),
    "parametry": {"srodek_osiedla": SRODEK, "R_budynki": R_BUD, "R_drogi_drzewa": R_DROGI, "R_osobne_bryly": R_BLISKO,
                  "kondygnacja_m": KONDYGNACJA, "spadek_domy": SPADEK, "spadek_gosp": SPADEK_GOSP,
                  "drzewo_m2": DRZEWO_M2},
    "georef": georef,
    "pominiete": pominiete,
    "strefy_wykluczone": {k: [[round(x, 2), round(y, 2)] for x, y in v] for k, v in STREFY_BUF.items()},
    "budynki": budynki,
    "drogi": {"v": drogi.V, "f": drogi.F},
    "place": {"v": place.V, "f": place.F},
    "boisko": {"v": boisko.V, "f": boisko.F, "meta": boiska_meta},
    "boisko_linie": {"v": linie.V, "f": linie.F},
    "drzewa": {"las": [[round(x, 1), round(y, 1)] for x, y in las_pts],
               "szpaler": [[round(x, 1), round(y, 1)] for x, y in szpaler_pts],
               "pojedyncze": [[round(x, 1), round(y, 1)] for x, y in pojedyncze],
               "obrysy": las_obrysy},
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ZAPISANO", OUT)

# --- Mapa kontrolna -------------------------------------------------------------------
if PLAN:
    from PIL import Image, ImageDraw
    half, sc = R_DROGI + 10, 2.0
    Wd = int(2 * half * sc)
    img = Image.new("RGB", (Wd, Wd), (236, 238, 232))
    dr = ImageDraw.Draw(img)

    def px(p):
        return ((p[0] - SRODEK[0] + half) * sc, (half - (p[1] - SRODEK[1])) * sc)
    dr.ellipse([px((SRODEK[0] - R_DROGI, SRODEK[1] + R_DROGI)), px((SRODEK[0] + R_DROGI, SRODEK[1] - R_DROGI))],
               outline=(200, 200, 200))
    for o in las_obrysy:
        dr.polygon([px(p) for p in o["obrys"]], outline=(120, 170, 120))
    for acc, col in ((place, (170, 170, 190)), (drogi, (150, 150, 175)), (boisko, (150, 200, 150)), (linie, (255, 255, 255))):
        for f in acc.F:
            dr.polygon([px(acc.V[i]) for i in f], fill=col)
    for b in budynki:
        col = {"gable": (120, 120, 120), "hip": (95, 95, 120), "flat": (70, 70, 70)}[b["dach"]]
        dr.polygon([px(p) for p in b["obrys"]], fill=col, outline=(40, 40, 40))
    for k, poly in STREFY_BUF.items():
        dr.polygon([px(p) for p in poly], outline=(220, 40, 40) if k == "osiedle" else (230, 140, 30))
    for p in las_pts + szpaler_pts + pojedyncze:
        x, y = px(p)
        dr.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(60, 130, 60))
    x, y = px(to_model(0, 0))
    dr.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 0, 0), width=2)
    img.save(PLAN, quality=88)
    print("PLAN", PLAN)
