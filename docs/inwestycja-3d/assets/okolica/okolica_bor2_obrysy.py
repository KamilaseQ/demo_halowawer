"""Krok 2/5: obrysy z modelu BOR2 potrzebne okolicy (Blender headless, tylko odczyt .blend).

Uruchomienie:
    blender --background ../bor2/bor2-zewnetrze.blend --python okolica_bor2_obrysy.py -- dane/bor2-obrysy.json

Zapisuje (układ modelu BOR2: X = wschód, Y = północ, Z = góra, metry):
- "sasiedzi":  dla każdego sąsiada zamodelowanego w BOR2 (KONTEKST: Component#7 x4, Group#3/4/5/19)
               otoczka wypukła wierzchołków podstawy bryły (z0 .. z0+0,65 m), z0, zmax
- "strefy":    otoczki wypukłe grup osiedla (podłoże, domki, Group#65 = zieleń/płoty NW, Group#2 = teren)
               -> strefy, na które okolica nie może wchodzić
- "teren":     trójkąty terenu BOR2 (Group#2) -> drogi i boisko wchodzące na ten teren są na nim kładzione
Nic nie jest zapisywane do .blend.
"""
import json
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1]
SASIEDZI = ["Group#5", "Group#19", "Group#3", "Group#4",
            "Component#7", "Component#7.001", "Component#7.002", "Component#7.003"]
STREFY = ["podłoże", "domki", "Group#65", "Group#2"]


def top_of(ob):
    while ob.parent is not None:
        ob = ob.parent
    return ob


def hull(points):
    pts = sorted(set((round(x, 3), round(y, 3)) for x, y in points))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


deps = bpy.context.evaluated_depsgraph_get()
pts = {}
teren_v, teren_f = [], []   # trójkąty terenu BOR2 (Group#2) w układzie świata
for inst in deps.object_instances:
    ob = inst.object
    if ob.type != "MESH":
        continue
    src = inst.parent.original if inst.is_instance and inst.parent else ob.original
    key = top_of(src).name
    if key not in SASIEDZI and key not in STREFY:
        continue
    mw = inst.matrix_world.copy()
    lst = pts.setdefault(key, [])
    for v in ob.data.vertices:
        p = mw @ v.co
        lst.append((p.x, p.y, p.z))
    if key == "Group#2":
        me = ob.data
        me.calc_loop_triangles()
        o = len(teren_v)
        teren_v += [tuple(round(c, 3) for c in (mw @ v.co)) for v in me.vertices]
        teren_f += [[o + i for i in t.vertices] for t in me.loop_triangles]

res = {"uklad": "BOR2 (SketchUp): X = wschod, Y = polnoc, Z = gora, metry", "sasiedzi": {}, "strefy": {}}
for k in SASIEDZI:
    lst = pts[k]
    z0 = min(p[2] for p in lst)
    base = [(p[0], p[1]) for p in lst if p[2] <= z0 + 0.65]
    res["sasiedzi"][k] = {"podstawa": hull(base), "obrys": hull([(p[0], p[1]) for p in lst]),
                          "z0": round(z0, 3), "zmax": round(max(p[2] for p in lst), 3)}
for k in STREFY:
    lst = pts.get(k, [])
    res["strefy"][k] = {"obrys": hull([(p[0], p[1]) for p in lst]),
                        "zmin": round(min(p[2] for p in lst), 3), "zmax": round(max(p[2] for p in lst), 3),
                        # gęsta próbka punktów (co ~0,5 m siatki) do mapy kontrolnej
                        "punkty": sorted(set((round(p[0] * 2) / 2, round(p[1] * 2) / 2) for p in lst))}
res["teren"] = {"opis": "Group#2: teren BOR2 130 x 110 m, schodkowy/pochyly, z = 0..1 m (wyzej na zachodzie)",
                "v": teren_v, "f": teren_f}
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("OBRYSY zapisano", out, {k: len(v["podstawa"]) for k, v in res["sasiedzi"].items()})
