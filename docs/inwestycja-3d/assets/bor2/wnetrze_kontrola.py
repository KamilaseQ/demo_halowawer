"""Kontrola L1 wnętrza (headless, na roboczym .blend po wnetrze_pokoje/lightmapy):

    blender --background <domN-lm.blend> --python wnetrze_kontrola.py -- domN <okna_zewn.json> <raport.json>

1. Dziury: z każdego punktu PKT_* 4000 promieni na sferze. Promień, który nie trafia w nic (wylatuje ze
   wnętrza), jest dopuszczalny tylko wtedy, gdy przecina obrys bryły w otworze okiennym bryły zewnętrznej
   (prostokąty szyb z bor2-zewnetrze.blend +-12 cm) albo leci w dół przez otwór schodów. Reszta = dziura.
   Szkło i firany są przezroczyste dla testu (pomijane).
2. Okna: każdy prostokąt szyby bryły zewnętrznej musi mieć we wnętrzu ramę (lica OKNA_ZEWN) w odległości
   <= 3 cm od płaszczyzny szyby i pokrycie otworu >= 90 %.
3. Wysokości: podłoga -> sufit nad każdym PKT (w świetle).
okna_zewn.json: [{"x": [x0, x1], "y": [y0, y1], "z": [z0, z1]}, ...] (wnetrze_okna_zewn.py).
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wnetrze_konfig import KONFIG  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
KEY, WIN, OUT = args[0], args[1], args[2]
C = KONFIG[KEY]
root = bpy.data.objects["WNETRZE_" + C["dom"]]
SKIP_MATS = {"SZKLO", "FIRANA", "ZASLONA"}
verts, polys, pmat, off = [], [], [], 0
for o in root.children_recursive:
    if o.type != "MESH":
        continue
    me = o.data
    mw = o.matrix_world
    verts.extend(tuple(mw @ v.co) for v in me.vertices)
    names = [s.material.name if s.material else "" for s in o.material_slots]
    for p in me.polygons:
        polys.append([i + off for i in p.vertices])
        pmat.append(names[p.material_index] if p.material_index < len(names) else "")
    off += len(me.vertices)
keep = [i for i, m in enumerate(pmat) if m not in SKIP_MATS]
bvh = BVHTree.FromPolygons(verts, [polys[i] for i in keep])
kmat = [pmat[i] for i in keep]
wins = json.load(open(WIN, encoding="utf-8"))
OB = C["obrys"]
SB = C["schody"]


def in_window(p, pad=0.12):
    """Punkt wyjścia na obrysie leży w otworze okna: w płaszczyźnie szyby +-pad, wzdłuż normalnej <= 0,7 m."""
    for w in wins:
        ax = 0 if w["x"][1] - w["x"][0] < 0.05 else 1
        if abs(p[ax] - (w["xy"[ax]][0] + w["xy"[ax]][1]) / 2) > 0.7:
            continue
        o = 1 - ax
        if (w["xy"[o]][0] - pad <= p[o] <= w["xy"[o]][1] + pad and w["z"][0] - pad <= p.z <= w["z"][1] + pad):
            return True
    return False


def exit_point(o, d):
    """Punkt wyjścia promienia z obrysu bryły (prostopadłościan obrys x [podłoga, sufit+0,5])."""
    tmax = 1e9
    lo = Vector((OB[0], OB[2], C["podlogi"][0] - 0.3))
    hi = Vector((OB[1], OB[3], C["sufity"][-1] + 0.5))
    for i in range(3):
        if abs(d[i]) > 1e-9:
            t = ((hi[i] if d[i] > 0 else lo[i]) - o[i]) / d[i]
            tmax = min(tmax, t)
    return o + d * tmax


def fib_sphere(n):
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1)


rep = {"dom": C["dom"], "punkty": {}, "okna": []}
dirs = fib_sphere(4000)
for cam in [o for o in root.children_recursive if o.type == "CAMERA" and o.name.startswith("PKT_")]:
    o = cam.matrix_world.translation.copy()
    holes = []
    for d in dirs:
        d = Vector(d)
        hit = bvh.ray_cast(o, d, 60.0)
        if hit[0] is not None:
            continue
        e = exit_point(o, d)
        if in_window(e):
            continue
        if d.z < -0.3 and SB[0] - 0.2 <= e.x <= SB[1] + 0.2 and SB[2] - 0.2 <= e.y <= SB[3] + 0.2:
            continue
        holes.append([round(e.x, 2), round(e.y, 2), round(e.z, 2)])
    up = bvh.ray_cast(o, Vector((0, 0, 1)), 10)
    dn = bvh.ray_cast(o, Vector((0, 0, -1)), 10)
    h = (up[0].z - dn[0].z) if up[0] is not None and dn[0] is not None else None
    rep["punkty"][cam.name] = {"pozycja": [round(v, 2) for v in o], "dziury_promienie": len(holes),
                               "dziury_przyklady": holes[:12], "wysokosc_w_swietle": round(h, 3) if h else None,
                               "sufit": kmat[up[2]] if up[0] is not None else None}
    print("KONTROLA %s: dziury %d, wysokosc %s" % (cam.name, len(holes), h))

# Okna: rama wnętrza (OKNA_ZEWN) przy płaszczyźnie szyby bryły
frame_pts = [Vector(np.mean([verts[i] for i in polys[k]], axis=0)) for k in range(len(polys)) if pmat[k] == "OKNA_ZEWN"]
fp = np.array([tuple(v) for v in frame_pts]) if frame_pts else np.zeros((0, 3))
for w in wins:
    ax = 0 if w["x"][1] - w["x"][0] < 0.02 else 1          # oś normalnej szyby
    plane = (w["x"][0] + w["x"][1]) / 2 if ax == 0 else (w["y"][0] + w["y"][1]) / 2
    other = 1 - ax
    lo_o, hi_o = (w["y"] if ax == 0 else w["x"])
    sel = fp[(np.abs(fp[:, ax] - plane) < 0.35) & (fp[:, other] > lo_o - 0.3) & (fp[:, other] < hi_o + 0.3)
             & (fp[:, 2] > w["z"][0] - 0.3) & (fp[:, 2] < w["z"][1] + 0.3)] if len(fp) else fp
    if not len(sel):
        rep["okna"].append({"szyba": w, "rama": None, "uwaga": "BRAK RAMY we wnetrzu"})
        print("KONTROLA okno %s: BRAK ramy" % w)
        continue
    d_plane = float(np.median(sel[:, ax]) - plane)
    span = [float(sel[:, other].min()), float(sel[:, other].max())]
    zs = [float(sel[:, 2].min()), float(sel[:, 2].max())]
    rep["okna"].append({"szyba": w, "rama_plaszczyzna_odchylka_m": round(d_plane, 3),
                        "rama_zakres": [round(v, 3) for v in span], "rama_z": [round(v, 3) for v in zs]})
    print("KONTROLA okno os=%s szyba %s: odchylka plaszczyzny ramy %.3f m, rama %s z %s" % (
        "xy"[ax], [round(v, 2) for v in (w["x"] + w["y"] + w["z"])], d_plane, [round(v, 2) for v in span],
        [round(v, 2) for v in zs]))
json.dump(rep, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("KONTROLA zapisano", OUT)
