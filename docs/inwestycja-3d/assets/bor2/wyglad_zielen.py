"""Znaczniki zieleni (empties) dla runtime: 55 robi z nich instancje roślin.

Kolekcja ZIELEN_ZNACZNIKI w bor2-zewnetrze-wyglad.blend; eksport (wyglad_eksport.py) zapisuje je jako puste
węzły pod węzłem ZIELEN_ZNACZNIKI. Nazwa = typ rośliny + numer, np. TRAWA_012, BYLINA_040, ZYWOPLOT_007,
KRZEW_003, DRZEWO_SOSNA_02, DRZEWO_BRZOZA_01, DRZEWO_LISCIASTE_01, DRZEWO_OZDOBNE_01.
Obrót Z losowy, skala jednolita = mnożnik wielkości (0,8–1,25). Punkt = podstawa rośliny na gruncie.

Rozmieszczenie wg wizualizacji dewelopera:
  visualization-1: pas traw ozdobnych (miskant, kostrzewa) za południowym płotem ogrodów, byliny i krzewy
                   przy płotach i tarasach, sosna na wschód od C, brzoza i drzewko ozdobne przy D.
  visualization-5: łąka kwietna (byliny + trawy) przed frontowym płotem, duże drzewo liściaste przy E,
                   sosny za szeregiem.
Układ SketchUpa: X = wschód, Y = północ. Deterministyczne (stałe ziarno).
Uruchomienie w Blenderze (MCP): exec(open(r"<ten plik>", encoding="utf-8").read())
"""
import math
import random

import bpy
from mathutils import Vector

RNG = random.Random(52189)
COLL = "ZIELEN_ZNACZNIKI"

# granica południowa ogrodów (płot), z geometrii płotu
SOUTH = [(16.2, 49.2), (40.9, 44.3), (48.4, 42.8), (60.8, 40.3), (73.8, 37.7), (86.8, 35.1), (99.8, 32.6),
         (113.1, 29.9)]
# płot frontowy wzdłuż drogi (od zachodu na wschód)
FRONT = [(20.1, 68.6), (107.9, 52.7)]
# przegrody między ogrodami: x, y_od (płot płd.), y_do (elewacja ogrodowa)
DIVIDERS = [(40.95, 44.3, 48.6), (48.45, 42.8, 47.1), (73.8, 37.8, 43.6), (99.8, 32.6, 37.5)]
# boczne płoty zamykające przerwy między segmentami (wzdłuż X), y
SIDE = [((56.0, 60.8), 49.1), ((60.8, 65.6), 49.1), ((81.9, 86.8), 44.5), ((86.8, 91.6), 44.5),
        ((108.0, 113.8), 39.9)]
# tarasy (x0, x1, y0 = krawędź od ogrodu, y1 = przy elewacji), z geometrii TARASY
TERRACES = [(103.4, 106.9, 35.2, 37.7), (92.7, 96.2, 36.7, 39.2), (77.4, 80.9, 39.8, 42.3),
            (66.7, 70.2, 41.3, 43.8), (51.7, 54.9, 45.2, 47.4), (44.2, 47.4, 46.7, 48.9), (34.5, 37.7, 48.2, 50.4)]
TREES = [
    ("DRZEWO_SOSNA", (86.0, 39.0), 1.1),       # między C i B od ogrodów (visualization-1, prawa strona)
    ("DRZEWO_SOSNA", (87.2, 42.0), 0.95),
    ("DRZEWO_BRZOZA", (61.0, 43.5), 1.0),      # między E i D (visualization-1, lewa strona)
    ("DRZEWO_OZDOBNE", (70.0, 39.3), 0.9),     # drzewko ozdobne w ogrodzie D
    ("DRZEWO_OZDOBNE", (107.3, 32.6), 0.85),   # ogród A, w narożniku (D-020: nie na osi elewacji)
    ("DRZEWO_LISCIASTE", (60.5, 60.0), 1.15),  # przed E od frontu (visualization-5, lewa strona)
    ("DRZEWO_SOSNA", (22.0, 50.5), 1.2),       # sosny w dużym ogrodzie G (tło visualization-5)
    ("DRZEWO_SOSNA", (26.5, 48.5), 1.0),
    ("DRZEWO_SOSNA", (19.5, 54.0), 1.05),
    ("DRZEWO_BRZOZA", (30.0, 47.5), 0.9),
    ("DRZEWO_LISCIASTE", (115.5, 45.0), 1.1),  # przy wjeździe od wschodu
]


def coll():
    c = bpy.data.collections.get(COLL)
    if c is None:
        c = bpy.data.collections.new(COLL)
        bpy.context.scene.collection.children.link(c)
    for o in list(c.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return c


def ground_z(x, y):
    """Wysokość gruntu: promień w dół, trafienia w płoty/rośliny/domy pomijane; zapas = interpolacja."""
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    origin = Vector((x, y, 30.0))
    for _ in range(6):
        hit, loc, nrm, idx, ob, M = sc.ray_cast(dg, origin, Vector((0, 0, -1)))
        if not hit:
            break
        mat = ""
        if ob.material_slots and idx < len(ob.data.polygons):
            m = ob.material_slots[ob.data.polygons[idx].material_index].material
            mat = m.name if m else ""
        if mat in {"OTOCZENIE 1", "DROGA WEWNĘTRZNA", "ASFALT", "GEOKRATA BETONOWA", "SKP Default",
                   "[Asphalt Stamped Brick]1"} and nrm.z > 0.7:
            return loc.z
        origin = loc - Vector((0, 0, 0.01))
    return 0.9 - 0.0108 * (x - 33.0)   # spadek terenu G -> A (z brył: 0,7 … 0,1)


def put(c, kind, idx, x, y, scale):
    ob = bpy.data.objects.new("%s_%03d" % (kind, idx) if not kind.startswith("DRZEWO") else "%s_%02d" % (kind, idx),
                              None)
    ob.empty_display_type = "SPHERE" if not kind.startswith("DRZEWO") else "SINGLE_ARROW"
    ob.empty_display_size = 0.4 if not kind.startswith("DRZEWO") else 3.0
    ob.location = (x, y, ground_z(x, y))
    ob.rotation_euler = (0, 0, RNG.uniform(0, 2 * math.pi))
    ob.scale = (scale, scale, scale)
    c.objects.link(ob)
    return ob


def along(poly, step, offset, jitter=0.25):
    """Punkty wzdłuż łamanej co `step` m, przesunięte o `offset` m w lewo od kierunku (minus = w prawo)."""
    pts = []
    for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        nx, ny = -uy, ux
        t = step / 2
        while t < L:
            j = RNG.uniform(-jitter, jitter)
            pts.append((x0 + ux * (t + j) + nx * offset, y0 + uy * (t + j) + ny * offset))
            t += step
    return pts


# D-008: drzewa >= 4 m od elewacji, krzewy >= 1 m (obrysy brył x0, x1, y_ogród, y_front)
BODIES = [(33.37, 40.97, 50.13, 59.76), (40.92, 48.49, 48.63, 58.26), (48.41, 56.01, 47.13, 56.76),
          (65.59, 73.81, 43.56, 53.66), (73.79, 82.01, 42.06, 52.16), (91.59, 99.81, 38.96, 49.06),
          (99.79, 108.01, 37.46, 47.56)]


def dist_to_bodies(x, y):
    best = 1e9
    for x0, x1, y0, y1 in BODIES:
        dx = max(x0 - x, 0, x - x1)
        dy = max(y0 - y, 0, y - y1)
        best = min(best, math.hypot(dx, dy))
    return best


def run():
    c = coll()
    n = {}

    def add(kind, x, y, s):
        n[kind] = n.get(kind, 0) + 1
        put(c, kind, n[kind], x, y, s)

    # 1–3. rabaty jako naturalne drifty (b6/klient: nie rzędy "jak w szkółce"): grupy 3–9 roślin jednego
    #      prefiksu, rozrzut w elipsie, odstęp min. 0,45 m, nieregularne krawędzie, przerwy w rabacie.
    #      Gatunki w obrębie prefiksu rozdziela wykonawca roślin (zielen/mapowanie.json, plamy na siatce).
    taken = {}

    def free(x, y, dmin=0.45):
        cx, cy = int(x // dmin), int(y // dmin)
        for i in range(cx - 1, cx + 2):
            for j in range(cy - 1, cy + 2):
                for (px, py) in taken.get((i, j), ()):
                    if (px - x) ** 2 + (py - y) ** 2 < dmin * dmin:
                        return False
        taken.setdefault((cx, cy), []).append((x, y))
        return True

    def drift_bed(poly, band, mix, sizes=(3, 9), gap=0.2, spacing=(1.0, 2.2), scale=(0.8, 1.3)):
        """poly: łamana osi rabaty; band: (od, do) odsunięcie w lewo od kierunku (ujemne = w prawo)."""
        for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
            dx, dy = x1 - x0, y1 - y0
            L = math.hypot(dx, dy)
            ux, uy = dx / L, dy / L
            nx, ny = -uy, ux
            t = RNG.uniform(0.2, 1.0)
            while t < L:
                if RNG.random() > gap:                       # przerwy w rabacie
                    kind = "BYLINA" if RNG.random() < mix else "TRAWA"
                    k = RNG.randint(*sizes)
                    off = RNG.uniform(*band)
                    r = 0.32 * math.sqrt(k) + 0.25
                    ang = RNG.uniform(0, math.pi)
                    ex, ey = math.cos(ang), math.sin(ang)
                    cx, cy = x0 + ux * t + nx * off, y0 + uy * t + ny * off
                    placed = 0
                    for _ in range(k * 6):
                        if placed >= k:
                            break
                        a_ = RNG.uniform(0, 2 * math.pi)
                        rr = r * math.sqrt(RNG.random())
                        px = cx + (math.cos(a_) * ex * 1.6 - math.sin(a_) * ey * 0.8) * rr
                        py = cy + (math.cos(a_) * ey * 1.6 + math.sin(a_) * ex * 0.8) * rr
                        # trzymaj się pasa rabaty (miękko) i z dala od elewacji
                        o = (px - x0) * nx + (py - y0) * ny
                        if not (min(band) - 0.35 <= o <= max(band) + 0.35) or dist_to_bodies(px, py) < 0.8:
                            continue
                        if free(px, py):
                            add(kind, px, py, RNG.uniform(*scale))
                            placed += 1
                t += RNG.uniform(*spacing)

    # 1. pas traw ozdobnych i bylin za płotem południowym (visualization-1): na południe od płotu
    drift_bed(SOUTH, (-0.4, -2.6), mix=0.22, sizes=(4, 9), gap=0.08, spacing=(0.9, 1.7))
    # 2. rabata w ogrodach wzdłuż płotu (na północ od płotu), węższa, z przerwami na trawnik
    drift_bed(SOUTH, (0.4, 1.4), mix=0.65, sizes=(3, 7), gap=0.3, spacing=(1.2, 2.4), scale=(0.75, 1.15))
    # 3. łąka kwietna przed frontowym płotem (visualization-5): na północ od płotu, szeroka
    drift_bed(FRONT, (0.4, 3.2), mix=0.7, sizes=(4, 9), gap=0.1, spacing=(0.9, 1.8))
    # 4. niskie żywopłoty na przegrodach między ogrodami (od strony wschodniej przegrody), co 1 m
    for x, y0, y1 in DIVIDERS:
        y = y0 + 0.5
        while y < y1 - 1.5:   # bez ostatnich 1,5 m przy tarasie
            add("ZYWOPLOT", x + 0.35, y, RNG.uniform(0.9, 1.1))
            y += 1.0
    for (x0, x1), y in SIDE:
        x = x0 + 0.5
        while x < x1 - 0.3:
            add("ZYWOPLOT", x, y - 0.35, RNG.uniform(0.9, 1.1))
            x += 1.0
    # 5. tarasy: krzewy na końcach przy elewacji + rabata wzdłuż krawędzi od ogrodu (visualization-1)
    for x0, x1, y0, y1 in TERRACES:
        facade = next(b[2] for b in BODIES if b[0] - 0.5 <= (x0 + x1) / 2 <= b[1] + 0.5)
        for x in (x0 - 0.6, x1 + 0.6):
            y = facade - 1.3
            while dist_to_bodies(x, y) < 1.05:     # szereg schodkowy: odsuń od narożnika sąsiada
                y -= 0.3
            add("KRZEW", x, y, RNG.uniform(0.9, 1.2))   # >= 1 m od elewacji (D-008)
            for _k in range(RNG.randint(2, 4)):         # byliny u stóp krzewu
                px, py = x + RNG.uniform(-0.6, 0.6), y - RNG.uniform(0.4, 1.0)
                if dist_to_bodies(px, py) >= 0.8 and free(px, py):
                    add("BYLINA", px, py, RNG.uniform(0.8, 1.1))
        # rabata przy krawędzi tarasu od ogrodu: 1–2 drifty bylin
        for _ in range(RNG.randint(1, 2)):
            cx = RNG.uniform(x0 + 0.6, x1 - 0.6)
            for _k in range(RNG.randint(3, 5)):
                px, py = cx + RNG.uniform(-0.7, 0.7), y0 - RNG.uniform(0.35, 0.9)
                if free(px, py):
                    add("BYLINA", px, py, RNG.uniform(0.7, 1.0))
    # 6. drzewa
    for kind, (x, y), s in TREES:
        add(kind, x, y, s * RNG.uniform(0.95, 1.05))
    print("znaczniki zieleni:", n, "razem", sum(n.values()))
    bad = [(o.name, round(dist_to_bodies(o.location.x, o.location.y), 2)) for o in c.objects
           if (o.name.startswith("DRZEWO") and dist_to_bodies(o.location.x, o.location.y) < 4.0)
           or (o.name.startswith("KRZEW") and dist_to_bodies(o.location.x, o.location.y) < 1.0)]
    print("D-008 za blisko elewacji:", bad or "brak")


run()
