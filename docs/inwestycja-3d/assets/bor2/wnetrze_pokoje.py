"""Uzupełnia brakujące pomieszczenia wnętrza (proste, ale kompletne): ściany z otworami, stropy,
okna, drzwi, łazienka/WC, kilka mebli z tej samej biblioteki materiałów.

    blender --background <dom1-web.blend> --python wnetrze_pokoje.py -- dom1 [zapisz=<wyjscie.blend>]

Elementy w wnetrze_konfig.KONFIG[dom]["pokoje"] (współrzędne świata modelu, metry):
  ("sciana", kond, (x0, y0, x1, y1), (z0, z1), [(a0, a1, oz0, oz1), ...], zewn)
        prostopadłościan ściany; otwory wzdłuż dłuższego boku (a = x albo y);
        zewn = "+x"/"-x"/"+y"/"-y" - lico zewnętrzne dostaje TYNK_ZEWN (domek dla lalek)
  ("plyta", kond, (x0, y0, x1, y1), (z0, z1), mat, wezel)   strop / posadzka / dowolna bryła
  ("okno", kond, os, (lico_wew, lico_zew), (a0, a1), (z0, z1), szprosy)  rama + szyba w otworze
  ("drzwi", kond, os, (lico0, lico1), (a0, a1), z0, strona)  ościeżnica + skrzydło otwarte 90°
  ("lozko"|"szafa"|"biurko"|"wc"|"umywalka"|"prysznic"|"dywan"|"wanna", kond, (x0, y0, x1, y1), z0, ...)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wnetrze_wspolne as W  # noqa: E402
from wnetrze_konfig import KONFIG  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
KEY = args[0]
opts = dict(a.split("=", 1) for a in args[1:] if "=" in a)
C = KONFIG[KEY]
DOM = C["dom"]
root = bpy.data.objects["WNETRZE_" + DOM]
NODES = {o.name: o for o in root.children_recursive if o.type == "MESH"}
TILES = {"PODLOGA": 2.0, "DAB": 1.0, "DAB_CIEMNY": 1.0, "TKANINA": 0.25, "PLYTKA_PODL": 1.2,
         "ZASLONA": 0.18, "FIRANA": 0.12}
TKANINA_MEAN = 0.83
PIECES = {}  # nazwa węzła -> lista (bmesh) - zbierane, potem dołączane
CX = (C["obrys"][0] + C["obrys"][1]) / 2
CY = (C["obrys"][2] + C["obrys"][3]) / 2


def mat(name):
    m = bpy.data.materials.get(name)
    if m is None or m.get("bib") != name:
        spec = dict(W.BIB[name])
        if name in C.get("tex", {}):
            spec["tex"] = C["tex"][name]
        m = W.make_material(name, spec)
    return m


def node_name(kond, wezel):
    return "SCHODY" if wezel == "SCHODY" else "KOND_%d__%s" % (kond, wezel)


def add_box(kond, wezel, lo, hi, mname, tint=None, outward=None, rot=None):
    """Prostopadłościan lo..hi (świat). outward: wektor - lica zwrócone na zewnątrz dostają TYNK_ZEWN."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    lo, hi = Vector(lo), Vector(hi)
    c, s = (lo + hi) / 2, hi - lo
    for v in bm.verts:
        v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z))
        if rot is not None:
            pivot, ang = rot
            p = v.co + c - Vector(pivot)
            ca, sa = math.cos(ang), math.sin(ang)
            v.co = Vector((pivot[0] + p.x * ca - p.y * sa, pivot[1] + p.x * sa + p.y * ca, p.z + pivot[2])) - c
        v.co += c
    PIECES.setdefault(node_name(kond, wezel), []).append((bm, mname, tint, outward))


def wall(kond, box, z, holes=(), zewn=None):
    x0, y0, x1, y1 = box
    z0, z1 = z
    along_x = (x1 - x0) >= (y1 - y0)
    a0, a1 = (x0, x1) if along_x else (y0, y1)
    out = None
    if zewn:
        out = Vector({"+x": (1, 0, 0), "-x": (-1, 0, 0), "+y": (0, 1, 0), "-y": (0, -1, 0)}[zewn])

    def seg(b0, b1, zz0, zz1):
        if b1 - b0 < 1e-4 or zz1 - zz0 < 1e-4:
            return
        if along_x:
            add_box(kond, "WNETRZE", (b0, y0, zz0), (b1, y1, zz1), "TYNK", outward=out)
        else:
            add_box(kond, "WNETRZE", (x0, b0, zz0), (x1, b1, zz1), "TYNK", outward=out)

    cur = a0
    for h0, h1, hz0, hz1 in sorted(holes):
        seg(cur, h0, z0, z1)
        seg(h0, h1, z0, hz0)
        seg(h0, h1, hz1, z1)
        cur = h1
    seg(cur, a1, z0, z1)


def window(kond, axis, faces, span, z, bars=1, glass=None):
    """Rama (6 cm, w połowie grubości ściany: wewn. pół BIALY, zewn. OKNA_ZEWN), szprosy, szyba, parapet."""
    f_in, f_out = faces
    mid = (f_in + f_out) / 2 if glass is None else glass
    sgn = 1 if f_out > f_in else -1
    a0, a1 = span
    z0, z1 = z
    fw, fd = 0.06, 0.07

    def box(b0, b1, zz0, zz1, d0, d1, m, wez="WNETRZE"):
        lo_d, hi_d = min(d0, d1), max(d0, d1)
        if axis == "y":   # ściana równoległa do X (lico y = const)
            add_box(kond, wez, (b0, lo_d, zz0), (b1, hi_d, zz1), m)
        else:
            add_box(kond, wez, (lo_d, b0, zz0), (hi_d, b1, zz1), m)

    for half, m in ((( mid - sgn * fd / 2), "BIALY"), ((mid + sgn * fd / 2), "OKNA_ZEWN")):
        d0, d1 = mid, half
        box(a0, a0 + fw, z0, z1, d0, d1, m)
        box(a1 - fw, a1, z0, z1, d0, d1, m)
        box(a0 + fw, a1 - fw, z0, z0 + fw, d0, d1, m)
        box(a0 + fw, a1 - fw, z1 - fw, z1, d0, d1, m)
        for i in range(1, bars + 1):
            b = a0 + (a1 - a0) * i / (bars + 1)
            box(b - fw / 2, b + fw / 2, z0 + fw, z1 - fw, d0, d1, m)
    box(a0 + fw, a1 - fw, z0 + fw, z1 - fw, mid - 0.004, mid + 0.004, "SZKLO", "TRANSPARENT")
    # parapet wewnętrzny
    box(a0 - 0.03, a1 + 0.03, z0 - 0.03, z0, f_in - sgn * 0.04, mid, "BIALY")


def door(kond, axis, faces, span, z0, side=1, h=2.05):
    """Ościeżnica + skrzydło otwarte 90° (side: +1/-1 = strona, w którą się otwiera)."""
    f0, f1 = min(faces), max(faces)
    a0, a1 = span
    fw = 0.05

    def box(b0, b1, zz0, zz1, d0, d1, m, wez="WNETRZE"):
        if axis == "y":
            add_box(kond, wez, (b0, d0, zz0), (b1, d1, zz1), m)
        else:
            add_box(kond, wez, (d0, b0, zz0), (d1, b1, zz1), m)

    box(a0 - fw, a0, z0, z0 + h + fw, f0 - 0.01, f1 + 0.01, "BIALY")
    box(a1, a1 + fw, z0, z0 + h + fw, f0 - 0.01, f1 + 0.01, "BIALY")
    box(a0 - fw, a1 + fw, z0 + h, z0 + h + fw, f0 - 0.01, f1 + 0.01, "BIALY")
    wdt = a1 - a0
    face = f1 + 0.01 if side > 0 else f0 - 0.01
    d0, d1 = (face, face + side * wdt) if side > 0 else (face + side * wdt, face)
    box(a0 + 0.005, a0 + 0.045, z0 + 0.01, z0 + h - 0.01, d0, d1, "BIALY", "DETALE")
    # klamka
    hz = z0 + 1.0
    box(a0 + 0.045, a0 + 0.07, hz - 0.01, hz + 0.01, d1 - side * 0.08 - 0.06 if side > 0 else d0 + 0.08,
        d1 - side * 0.08 if side > 0 else d0 + 0.14, "METAL", "DETALE")


def furniture(kind, kond, box, z0, *extra):
    x0, y0, x1, y1 = box
    if kind == "lozko":
        head = extra[0] if extra else "-y"   # strona wezgłowia
        add_box(kond, "WNETRZE", (x0, y0, z0), (x1, y1, z0 + 0.28), "DAB")
        add_box(kond, "WNETRZE", (x0 + 0.03, y0 + 0.03, z0 + 0.28), (x1 - 0.03, y1 - 0.03, z0 + 0.48), "TKANINA",
                (242, 240, 236))
        if head in ("-y", "+y"):
            yy = y0 if head == "-y" else y1 - 0.1
            add_box(kond, "WNETRZE", (x0, yy, z0), (x1, yy + 0.1, z0 + 0.95), "DAB")
            py0 = y0 + 0.15 if head == "-y" else y1 - 0.55
            add_box(kond, "DETALE", (x0 + 0.1, py0, z0 + 0.48), (x1 - 0.1, py0 + 0.4, z0 + 0.62), "TKANINA",
                    (236, 232, 224))
            cov = (y0 + 0.6, y1 - 0.03) if head == "-y" else (y0 + 0.03, y1 - 0.6)
            add_box(kond, "DETALE", (x0 - 0.01, cov[0], z0 + 0.47), (x1 + 0.01, cov[1], z0 + 0.53), "TKANINA",
                    (206, 198, 186))
        else:
            xx = x0 if head == "-x" else x1 - 0.1
            add_box(kond, "WNETRZE", (xx, y0, z0), (xx + 0.1, y1, z0 + 0.95), "DAB")
            px0 = x0 + 0.15 if head == "-x" else x1 - 0.55
            add_box(kond, "DETALE", (px0, y0 + 0.1, z0 + 0.48), (px0 + 0.4, y1 - 0.1, z0 + 0.62), "TKANINA",
                    (236, 232, 224))
            cov = (x0 + 0.6, x1 - 0.03) if head == "-x" else (x0 + 0.03, x1 - 0.6)
            add_box(kond, "DETALE", (cov[0], y0 - 0.01, z0 + 0.47), (cov[1], y1 + 0.01, z0 + 0.53), "TKANINA",
                    (206, 198, 186))
    elif kind == "szafa":
        h = extra[0] if extra else 2.3
        add_box(kond, "WNETRZE", (x0, y0, z0), (x1, y1, z0 + h), "BIALY")
    elif kind == "biurko":
        add_box(kond, "WNETRZE", (x0, y0, z0 + 0.72), (x1, y1, z0 + 0.75), "DAB")
        w = 0.03
        if (x1 - x0) > (y1 - y0):
            add_box(kond, "DETALE", (x0, y0, z0), (x0 + w, y1, z0 + 0.72), "DAB")
            add_box(kond, "DETALE", (x1 - w, y0, z0), (x1, y1, z0 + 0.72), "DAB")
        else:
            add_box(kond, "DETALE", (x0, y0, z0), (x1, y0 + w, z0 + 0.72), "DAB")
            add_box(kond, "DETALE", (x0, y1 - w, z0), (x1, y1, z0 + 0.72), "DAB")
    elif kind == "dywan":
        add_box(kond, "DETALE", (x0, y0, z0), (x1, y1, z0 + 0.012), "TKANINA", extra[0] if extra else (200, 196, 188))
    elif kind == "wc":
        add_box(kond, "DETALE", (x0, y0, z0), (x1, y1, z0 + 0.40), "CERAMIKA")
        add_box(kond, "DETALE", (x0, y0, z0 + 0.40), (x1, y1, z0 + 0.43), "CERAMIKA")
    elif kind == "umywalka":
        add_box(kond, "DETALE", (x0, y0, z0 + 0.62), (x1, y1, z0 + 0.85), "CERAMIKA")
        add_box(kond, "DETALE", (x0 + 0.05, y0 + 0.05, z0 + 0.1), (x1 - 0.05, y1 - 0.05, z0 + 0.62), "DAB")
    elif kind == "wanna":
        add_box(kond, "WNETRZE", (x0, y0, z0), (x1, y1, z0 + 0.55), "CERAMIKA")
    elif kind == "prysznic":
        add_box(kond, "DETALE", (x0, y0, z0), (x1, y1, z0 + 0.04), "CERAMIKA")
        # szklana ścianka wzdłuż dłuższego boku od strony pokoju
        side = extra[0] if extra else "+x"
        if side in ("+x", "-x"):
            xx = x1 if side == "+x" else x0
            add_box(kond, "TRANSPARENT", (xx - 0.004, y0, z0 + 0.04), (xx + 0.004, y1, z0 + 2.0), "SZKLO")
        else:
            yy = y1 if side == "+y" else y0
            add_box(kond, "TRANSPARENT", (x0, yy - 0.004, z0 + 0.04), (x1, yy + 0.004, z0 + 2.0), "SZKLO")
    elif kind == "lustro":
        add_box(kond, "DETALE", (x0, y0, z0), (x1, y1, z0 + extra[0]), "CERAMIKA")  # METAL odbijał env na czarno
    elif kind == "plytki_sciana":   # okładzina ścian łazienki do wysokości extra[0]
        add_box(kond, "WNETRZE", (x0, y0, z0), (x1, y1, z0 + extra[0]), "CERAMIKA")


def cut_opening(nname, box, z):
    """Wycina otwór (np. na drzwi) w istniejącej geometrii węzła: cięcie płaszczyznami granic otworu
    tylko dla ścian przecinających prostopadłościan, potem usunięcie lic ze środkiem w otworze."""
    ob = NODES[nname]
    x0, y0, x1, y1 = box
    z0, z1 = z
    bm = bmesh.new()
    bm.from_mesh(ob.data)

    def inside(f, pad=0.0):
        c = f.calc_center_median()
        return (x0 - pad <= c.x <= x1 + pad and y0 - pad <= c.y <= y1 + pad and z0 - pad <= c.z <= z1 + pad)

    def touches(f):
        vs = [v.co for v in f.verts]
        return not (max(v.x for v in vs) < x0 or min(v.x for v in vs) > x1 or max(v.y for v in vs) < y0
                    or min(v.y for v in vs) > y1 or max(v.z for v in vs) < z0 or min(v.z for v in vs) > z1)

    planes = [((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, y0, 0), (0, 1, 0)), ((0, y1, 0), (0, 1, 0)),
              ((0, 0, z0), (0, 0, 1)), ((0, 0, z1), (0, 0, 1))]
    for co, no in planes:
        faces = [f for f in bm.faces if touches(f)]
        if not faces:
            continue
        geom = list({e for f in faces for e in f.edges}) + faces + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-5)
    dele = [f for f in bm.faces if inside(f, 0.001)]
    bmesh.ops.delete(bm, geom=dele, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    print("POKOJE wyciecie %s %s: usunieto %d lic" % (nname, box, len(dele)))


for el in C.get("pokoje", []):
    t = el[0]
    if t == "wytnij":
        _, nname, box, z = el
        cut_opening(nname, box, z)
        continue
    if t == "sciana":
        _, kond, box, z, holes, zewn = el
        wall(kond, box, z, holes, zewn)
    elif t == "plyta":
        _, kond, box, z, m, wez = el
        add_box(kond, wez, (box[0], box[1], z[0]), (box[2], box[3], z[1]), m)
    elif t == "okno":
        window(*el[1:])
    elif t == "drzwi":
        _, kond, axis, faces, span, z0, side = el
        door(kond, axis, faces, span, z0, side)
    else:
        furniture(t, *el[1:])


def box_uv_and_col(me, mnames, tints):
    n = len(me.polygons)
    lt = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("loop_total", lt)
    nr = np.empty(n * 3)
    me.polygons.foreach_get("normal", nr)
    nr = np.abs(nr.reshape(-1, 3))
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    lv = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", lv)
    mi = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("material_index", mi)
    pol = np.repeat(np.arange(n), lt)
    p = co[lv]
    ax = np.argmax(nr, axis=1)[pol]
    tile = np.array([TILES.get(mnames[i], 1.0) for i in mi])[pol]
    u = np.where(ax == 2, p[:, 0], np.where(ax == 0, p[:, 1], p[:, 0])) / tile
    v = np.where(ax == 2, p[:, 1], p[:, 2]) / tile
    uvl = me.uv_layers.new(name=W.UV0)
    uvl.data.foreach_set("uv", np.stack([u, v], 1).ravel())
    col = np.ones((n, 4), dtype=np.float32)
    for i, tn in enumerate(tints):
        if tn is not None:
            c = np.array(W.s2l(tn))
            if mnames[i] == "TKANINA":
                c = np.minimum(c / TKANINA_MEAN, 1.0)
            col[mi == i, :3] = c
    ca = me.color_attributes.new(W.VCOL, "FLOAT_COLOR", "CORNER")
    ca.data.foreach_set("color", np.repeat(col, lt, axis=0).ravel())


added = {}
for nname, items in PIECES.items():
    bm_all = bmesh.new()
    mnames, tints = [], []
    for bm, mname, tint, outward in items:
        bm.normal_update()
        for f in bm.faces:
            m2 = mname
            if outward is not None and f.normal.dot(outward) > 0.5:
                m2 = "TYNK_ZEWN"
            k2 = (m2, tint if m2 == mname else None)
            if k2 not in list(zip(mnames, tints)):
                mnames.append(k2[0])
                tints.append(k2[1])
            f.material_index = list(zip(mnames, tints)).index(k2)
        me_tmp = bpy.data.meshes.new("_tmp")
        bm.to_mesh(me_tmp)
        bm.free()
        bm_all.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    me = bpy.data.meshes.new(nname + "_nowe")
    bm_all.to_mesh(me)
    bm_all.free()
    me.shade_flat()
    for m in mnames:
        me.materials.append(mat(m))
    box_uv_and_col(me, mnames, tints)
    W.normalize_uv(me)
    ob = bpy.data.objects.new(nname + "_nowe", me)
    bpy.context.scene.collection.objects.link(ob)
    target = NODES.get(nname)
    if target is None:
        # węzeł nie istniał (np. KOND_1__PODLOGA bez podłogi) - nowy obiekt z tą nazwą
        kond = int(nname[5]) if nname.startswith("KOND_") else 0
        ob.name = nname
        ob.data.name = nname
        ob.parent = bpy.data.objects["KOND_%d" % kond] if nname.startswith("KOND_") else root
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        root.users_collection[0].objects.link(ob)
        NODES[nname] = ob
    else:
        with bpy.context.temp_override(active_object=target, selected_editable_objects=[target, ob],
                                       selected_objects=[target, ob], object=target):
            bpy.ops.object.join()
    added[nname] = len(me.polygons) if target is None else len(items)
    print("POKOJE %s: +%d elementow" % (nname, len(items)))

# Porządek slotów (scalanie mogło zdublować materiały)
for o in NODES.values():
    me = o.data
    n = len(me.polygons)
    mi = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("material_index", mi)
    names = [s.material.name for s in o.material_slots]
    uniq = sorted(set(names[i] for i in np.unique(mi)))
    remap = np.array([uniq.index(nm) if nm in uniq else 0 for nm in names], dtype=np.int32)
    me.materials.clear()  # (czyści też material_index - indeksy ustawiamy po dodaniu slotów)
    for nm in uniq:
        me.materials.append(bpy.data.materials[nm])
    me.polygons.foreach_set("material_index", remap[mi])

# Punkty spaceru z konfiguracji, których jeszcze nie ma (nowe pokoje)
for name, x, y, kond, d in C["pkt"]:
    if bpy.data.objects.get(name):
        continue
    cd = bpy.data.cameras.new(name)
    cd.lens_unit = "FOV"
    cd.sensor_fit = "HORIZONTAL"
    cd.angle = math.radians(75)
    cd.clip_start = 0.05
    cd.clip_end = 300
    cam = bpy.data.objects.new(name, cd)
    root.users_collection[0].objects.link(cam)
    cam.location = (x, y, C["podlogi"][kond] + 1.65)
    cam.rotation_euler = Vector((d[0], d[1], -0.08)).to_track_quat("-Z", "Y").to_euler()
    cam.parent = root
    cam["kondygnacja"] = kond
    print("POKOJE punkt", name)

tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in NODES.values())
prims = sum(len(o.material_slots) for o in NODES.values())
mats = sorted({s.material.name for o in NODES.values() for s in o.material_slots})
print("POKOJE RAZEM: trojkaty %d | prymitywy %d | materialy %d %s" % (tri, prims, len(mats), mats))
dst = opts.get("zapisz")
if dst:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(dst), compress=True)
    print("POKOJE zapisano", dst)
