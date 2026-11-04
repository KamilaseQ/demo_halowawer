"""Buduje wnętrze domu do three.js z .blend z importu SKP (BOR2_WNĘTRZA).

    blender --background bor2-wnetrze-dom1.blend --python wnetrze_buduj.py -- dom1 <wyjscie.blend> [budzet=330000]

Konfiguracja: wnetrze_konfig.py, materiały: wnetrze_wspolne.py.
Wynik (.blend roboczy, źródło nie jest zmieniane):
  WNETRZE_<dom> (empty)
    KOND_0 (empty) -> KOND_0__PODLOGA, KOND_0__SUFIT, KOND_0__WNETRZE, KOND_0__DETALE, KOND_0__TRANSPARENT
    KOND_1 (empty) -> to samo dla piętra
    SCHODY
    PKT_* (kamery spaceru, 1,65 m nad podłogą)
- materiały SKP przemapowane na bibliotekę (<= 32), UV w metrach dla tekstur kaflowych,
- podłogi/sufity rozpoznawane geometrycznie (poziome lica materiałów "architektonicznych"),
- oczka sufitowe z 3D Warehouse (28k tri) zastąpione walcami 16-bocznymi osadzonymi w suficie,
- decymacja z budżetem trójkątów (jak blend_to_glb.py: najmocniej drobne, gęste detale),
- części zewnętrzne: lica ścian zewnętrznych TYNK_ZEWN, ramy okien od zewnątrz OKNA_ZEWN.
"""
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wnetrze_wspolne as W  # noqa: E402
from wnetrze_konfig import KONFIG  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
KEY, OUT = args[0], os.path.abspath(args[1])
opts = dict(a.split("=", 1) for a in args[2:] if "=" in a)
C = KONFIG[KEY]
BUDGET = int(opts.get("budzet", 330000))
MIN_TRIS = int(opts.get("min_tris", 60))
DOM = C["dom"]
scene = bpy.context.scene
T0 = time.time()


def log(*a):
    print("WN", "%6.1fs" % (time.time() - T0), *a, flush=True)


# --- 1. Części (z rozwinięciem instancji kolekcji) -------------------------------------------
def walk(ob, world, path):
    if ob.type == "MESH" and ob.data and len(ob.data.polygons):
        yield ob, world, path
    coll = ob.instance_collection if ob.instance_type == "COLLECTION" else None
    if coll is not None:
        base = world @ Matrix.Translation(-coll.instance_offset)
        for ch in coll.all_objects:
            yield from walk(ch, base @ ch.matrix_world, path + [ch.name])


coll = bpy.data.collections.get(C["kolekcja"])
keep = set(coll.all_objects) if coll else None
skipc = bpy.data.collections.get("NIE_EKSPORTUJ")
skip_objs = set(skipc.all_objects) if skipc else set()
roots = [o for o in scene.objects if o.parent is None and o.type != "CAMERA"
         and (keep is None or o in keep) and o not in skip_objs]
PARTS = []
for r in roots:
    for top in [r] + list(r.children_recursive):
        for src, mw, path in walk(top, top.matrix_world, [top.name]):
            pts = [mw @ Vector(c) for c in src.bound_box]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            PARTS.append({"src": src, "mw": mw.copy(), "path": path, "lo": lo, "hi": hi})
log("czesci:", len(PARTS))

# Kamery SKP (do porównań z renderami) -> <wyjscie>.kamery.json
import json  # noqa: E402
cams = []
for o in scene.objects:
    if o.type == "CAMERA":
        d = o.matrix_world.to_3x3() @ Vector((0, 0, -1))
        u = o.matrix_world.to_3x3() @ Vector((0, 1, 0))
        cams.append({"name": o.name, "pos": list(o.matrix_world.translation), "dir": list(d), "up": list(u),
                     "hfov": math.degrees(o.data.angle_x), "lens": o.data.lens, "sensor": o.data.sensor_width})
with open(os.path.splitext(OUT)[0] + ".kamery.json", "w", encoding="utf-8") as f:
    json.dump(cams, f, ensure_ascii=False, indent=1)


def base(name):
    return name.split(":")[0].split(".")[0]


# Oczka sufitowe: zapamiętaj pozycje znaczników, usuń wszystkie elementy oczka.
SPOTS = []
if C.get("oczka"):
    rm = set(C["oczka"]["usun"])
    marker = C["oczka"]["znacznik"]
    kept = []
    for p in PARTS:
        b = base(p["src"].name)
        bm = base(p["src"].data.name)
        if b in rm or bm in rm:
            if b == marker or bm == marker:
                SPOTS.append(((p["lo"] + p["hi"]) / 2, p["hi"].z))
            continue
        kept.append(p)
    log("oczka: usunieto %d czesci, znacznikow %d" % (len(PARTS) - len(kept), len(SPOTS)))
    PARTS = kept
PARTS = [p for p in PARTS if p["lo"].z < C["z_max"]]
RM = C.get("usun", [])
if RM:
    n0 = len(PARTS)
    PARTS = [p for p in PARTS if not any(e == r or e.startswith(r + ".") or e.startswith(r + ":")
                                         for e in p["path"] for r in RM)]
    log("usunieto obiekty %s: %d czesci" % (RM, n0 - len(PARTS)))
# Lamele: setki listew 2x3 cm z SKP -> płaskie panele (mapa normalnych LAMELE), czysta lightmapa, mniej trójkątów
LAM = {(e if isinstance(e, str) else e[0]): ("LAMELE" if isinstance(e, str) else e[1]) for e in C.get("lamele", [])}
LAM_PARTS = [p for p in PARTS if base(p["src"].data.name) in LAM or base(p["src"].name) in LAM]
for p in LAM_PARTS:
    p["lam_mat"] = LAM.get(base(p["src"].data.name)) or LAM.get(base(p["src"].name))
# Wszystko poza obrysem ścian zewnętrznych (taras, płotki): bryła zewnętrzna ma własne - inaczej z-fighting
OBR = C["obrys"]
n0 = len(PARTS)

def _outside(p):
    c = (p["lo"] + p["hi"]) / 2
    return c.x < OBR[0] - 0.05 or c.x > OBR[1] + 0.05 or c.y < OBR[2] - 0.05 or c.y > OBR[3] + 0.05


PARTS = [p for p in PARTS if not _outside(p)]
log("poza obrysem: usunieto %d czesci" % (n0 - len(PARTS)))
if LAM_PARTS:
    ids = {id(p) for p in LAM_PARTS}
    PARTS = [p for p in PARTS if id(p) not in ids]
    log("lamele: %d listew -> panele" % len(LAM_PARTS))


# --- 2. Kolory i reguły materiałów -----------------------------------------------------------
def lin2s(v):
    v = max(0.0, min(1.0, v))
    return 255 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)


_srccol = {}


def src_color(m):
    """Kolor materiału SKP w sRGB 0-255 (stała albo średnia tekstury)."""
    if m is None:
        return (200, 200, 200)
    if m.name in _srccol:
        return _srccol[m.name]
    col = tuple(lin2s(v) for v in m.diffuse_color[:3])
    if m.use_nodes:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        img = next((n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
        if img is not None and img.size[0] > 0:
            try:
                im2 = img.copy()
                im2.scale(32, 32)
                px = np.empty(32 * 32 * im2.channels, dtype=np.float32)
                im2.pixels.foreach_get(px)
                bpy.data.images.remove(im2)
                col = tuple(float(v) * 255 for v in px.reshape(-1, im2.channels)[:, :3].mean(0))
            except Exception:
                pass
        elif b is not None and not b.inputs["Base Color"].is_linked:
            col = tuple(lin2s(v) for v in b.inputs["Base Color"].default_value[:3])
    _srccol[m.name] = col
    return col


def match(path, pref):
    for e in path:
        if e == pref or e.startswith(pref + ".") or e.startswith(pref + ":") or ("#" not in pref and e.startswith(pref)):
            return True
    return False


MAPA = C["mapa"]


def resolve(m, part):
    """-> (nazwa biblioteki, tint sRGB lub None)."""
    name = m.name if m else ""
    v = MAPA.get(name)
    if v is None and m is not None:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m.use_nodes else None
        a = 1.0 if b is None or b.inputs["Alpha"].is_linked else b.inputs["Alpha"].default_value
        met = 0.0 if b is None else b.inputs["Metallic"].default_value
        if a < 0.5:
            v = "SZKLO"
        elif met > 0.5:
            v = "METAL"
        else:
            v = ("DETAL", None)
    if v is None:
        v = ("DETAL", (200, 200, 200))
    if isinstance(v, dict):
        t = v["domyslnie"]
        for pref, tt in v["nazwy"].items():
            if match(part["path"], pref):
                t = tt
                break
        v = t
    lib, tint = (v if isinstance(v, tuple) else (v, None))
    c = (part["lo"] + part["hi"]) / 2
    if c.y < C["taras_y"] and part["lo"].z < C["podlogi"][0] + 0.05 and lib not in {"SZKLO", "OKNO"}:
        return "DETAL", (96, 93, 88)
    if lib in {"DETAL", "TKANINA"} and tint is None:
        tint = src_color(m)
    return lib, tint


# --- 3. Biblioteka materiałów ----------------------------------------------------------------
def skp_image(matname):
    m = bpy.data.materials.get(matname)
    if m is None or not m.use_nodes:
        return None
    return next((n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)


LIB = {}


def lib_mat(name):
    if name not in LIB:
        spec = dict(W.BIB[name])
        img = None
        if name in C.get("tex", {}):
            spec["tex"] = C["tex"][name]
        if name in C.get("skp_tex", {}):
            img = skp_image(C["skp_tex"][name])
        LIB[name] = W.make_material(name, spec, img)
    return LIB[name]


TEXTURED = {n for n, s in W.BIB.items() if s.get("tex") or s.get("normal") or n in C.get("skp_tex", {})}
TKANINA_MEAN = 0.83  # średnia (liniowa) tekstury tkanina.jpg


# --- 4. Pomiar kafli tekstur SKP (metry na 1 UV) ----------------------------------------------
def poly_uv_area(me, uvl):
    n = len(me.polygons)
    ls = np.empty(n, dtype=np.int64)
    lt = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    uv = np.empty(len(me.loops) * 2, dtype=np.float64)
    uvl.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    poly_of = np.repeat(np.arange(n), lt)
    nxt = np.arange(len(me.loops)) + 1
    last = ls + lt - 1
    nxt[last] = ls
    cr = uv[:, 0] * uv[nxt, 1] - uv[nxt, 0] * uv[:, 1]
    return 0.5 * np.abs(np.bincount(poly_of, weights=cr, minlength=n))


TILE = {}
for lib, srcname in C.get("kafel_z", {}).items():
    aw = auv = 0.0
    for p in PARTS:
        me = p["src"].data
        mats = [s.material for s in p["src"].material_slots]
        idx = [i for i, m in enumerate(mats) if m and m.name == srcname]
        if not idx or not me.uv_layers:
            continue
        n = len(me.polygons)
        mi = np.empty(n, dtype=np.int64)
        me.polygons.foreach_get("material_index", mi)
        ar = np.empty(n)
        me.polygons.foreach_get("area", ar)
        sel = np.isin(mi, idx)
        ua = poly_uv_area(me, me.uv_layers[0])
        k = abs(p["mw"].determinant()) ** (2 / 3)
        aw += float(ar[sel].sum() * k)
        auv += float(ua[sel].sum())
    TILE[lib] = math.sqrt(aw / auv) if auv > 1e-9 else 1.0
    log("kafel %s (z %s): %.3f m" % (lib, srcname, TILE[lib]))
for n, s in W.BIB.items():
    if n not in TILE:
        TILE[n] = s.get("tile") or 1.0


# --- 5. Budżet trójkątów (water-filling jak w blend_to_glb.py) --------------------------------
def mesh_tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def weight_of(p):
    """Waga widoczności w budżecie: klosze lamp x4 (gładkie "chmury"), cienkie kable bez upraszczania."""
    dims = p["hi"] - p["lo"]
    if max(dims.x, dims.y) < 0.04 and dims.z > 0.3:
        return 1e6
    names = {s.material.name for s in p["src"].material_slots if s.material}
    if any(MAPA.get(n) == "LAMPA" for n in names):
        return 4.0
    if any(isinstance(MAPA.get(n), tuple) and MAPA.get(n)[0] == "TKANINA" for n in names):
        return 3.0   # sofy, pościel: mniej faset
    return 1.0


info = {}
for p in PARTS:
    me = p["src"].data
    d = info.get(me.name)
    if d is None:
        diag = (p["hi"] - p["lo"]).length
        d = info[me.name] = {"tris": mesh_tris(me), "n": 0, "diag": max(diag, 0.01) * weight_of(p)}
    d["n"] += 1
total = sum(d["tris"] * d["n"] for d in info.values())
RATIO = {}
if total > BUDGET:
    items = [(d["tris"] * d["n"], min(d["tris"], MIN_TRIS) * d["n"], d["diag"] * d["n"], nm) for nm, d in info.items()]

    def alloc(lam):
        return sum(min(c, max(f, lam * w)) for c, f, w, _ in items)

    lo_, hi_ = 0.0, 1.0
    while alloc(hi_) < BUDGET and hi_ < 1e12:
        hi_ *= 2
    for _ in range(60):
        mid = (lo_ + hi_) / 2
        lo_, hi_ = (mid, hi_) if alloc(mid) < BUDGET else (lo_, mid)
    for c, f, w, nm in items:
        a = min(c, max(f, hi_ * w))
        if a < c * 0.85:
            RATIO[nm] = a / c
log("budzet: %d -> %d trojkatow, upraszczanych siatek %d z %d" % (total, BUDGET, len(RATIO), len(info)))

_dec = {}


SMOOTH = math.radians(float(opts.get("kat", 42)))


def _weld(me, dist):
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(me)
    bm.free()


def _decimate(me, r):
    tmp = bpy.data.objects.new("_dec", me)
    scene.collection.objects.link(tmp)
    mod = tmp.modifiers.new("d", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = max(r, 0.002)
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.update()
    ev = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())
    res = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.meshes.remove(me)
    return res


def decimated(src, mw):
    """Kopia siatki: zgrzane wierzchołki (SKP rozcina krawędzie), decymacja wg budżetu,
    cieniowanie gładkie z ostrymi krawędziami powyżej kąta SMOOTH (sofy, pościel, zasłony bez "papieru").
    Gęste siatki z silną decymacją (np. krzesła NURT_KOS 42k tri): najpierw decymacja, potem zgrzewanie -
    kolaps na zgrzanej, niemanifoldowej siatce potrafi się zawiesić."""
    me = src.data
    if me.name in _dec:
        return _dec[me.name]
    t1 = time.time()
    sc = abs(mw.determinant()) ** (1 / 3) or 1.0
    r = RATIO.get(me.name)
    res = me.copy()
    if r is not None and r < 0.15 and mesh_tris(me) > 8000:
        res = _decimate(res, r)
        _weld(res, 0.0004 / sc)
    else:
        _weld(res, 0.0004 / sc)
        if r is not None:
            res = _decimate(res, r)
    res.shade_smooth()
    res.set_sharp_from_angle(angle=SMOOTH)
    if time.time() - t1 > 2:
        log("wolna siatka %s: %.1fs tri %d ratio %s" % (me.name, time.time() - t1, mesh_tris(me), r))
    _dec[me.name] = res
    return res


# --- 6. Budowa części -------------------------------------------------------------------------
NODE_NAMES = {0: "PODLOGA", 1: "SUFIT", 2: "WNETRZE", 3: "DETALE", 4: "TRANSPARENT"}
FL = np.array(C["podlogi"])
CE = np.array(C["sufity"])
OB = C["obrys"]
SB = C["schody"]
ARCH = set(C["arch"])
web = bpy.data.collections.new("WEB")
scene.collection.children.link(web)
BYKEY = {}  # klucz -> lista obiektów tymczasowych
stats = {"tri_src": 0, "tri_out": 0}


def key_name(k):
    if k == 99:
        return "SCHODY"
    kond, wez = divmod(k, 10)
    return "KOND_%d__%s" % (kond, NODE_NAMES[wez])


def set_uvs(me, mode, tile):
    """mode per poly: 0 bez zmian, 1 planar podłogi (XY), 2 box. tile per poly (m)."""
    if not (mode > 0).any():
        return
    n = len(me.polygons)
    ls = np.empty(n, dtype=np.int64)
    lt = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    nr = np.empty(n * 3)
    me.polygons.foreach_get("normal", nr)
    nr = np.abs(nr.reshape(-1, 3))
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    lv = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", lv)
    uvl = me.uv_layers[0]
    uv = np.empty(len(me.loops) * 2)
    uvl.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    pol = np.repeat(np.arange(n), lt)
    m = mode[pol]
    t = tile[pol]
    p = co[lv]
    ax = np.argmax(nr, axis=1)[pol]
    ax = np.where(m == 1, 2, ax)
    u = np.where(ax == 2, p[:, 0], np.where(ax == 0, p[:, 1], p[:, 0]))
    v = np.where(ax == 2, p[:, 1], p[:, 2])
    sel = m > 0
    uv[sel, 0] = u[sel] / t[sel]
    uv[sel, 1] = v[sel] / t[sel]
    uvl.data.foreach_set("uv", uv.ravel())


def split_by_keys(me, keys):
    out = {}
    uniq = [k for k in np.unique(keys) if k >= 0]
    if len(uniq) == 1 and (keys >= 0).all():
        return {int(uniq[0]): me}
    for k in uniq:
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        dele = [f for f in bm.faces if keys[f.index] != k]
        bmesh.ops.delete(bm, geom=dele, context="FACES")
        m2 = me.copy()
        bm.to_mesh(m2)
        bm.free()
        out[int(k)] = m2
    bpy.data.meshes.remove(me)
    return out


def build_part(p):
    src, mw = p["src"], p["mw"]
    me = decimated(src, mw).copy()
    me.transform(mw)
    if mw.determinant() < 0:
        me.flip_normals()
    stats["tri_src"] += mesh_tris(src.data)
    # UV: dokładnie jedna warstwa "UVMap"
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    if not me.uv_layers:
        me.uv_layers.new(name=W.UV0)
    me.uv_layers[0].name = W.UV0
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    n = len(me.polygons)
    if n == 0:
        bpy.data.meshes.remove(me)
        return
    mi = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("material_index", mi)
    nr = np.empty(n * 3)
    me.polygons.foreach_get("normal", nr)
    nr = nr.reshape(-1, 3)
    ce = np.empty(n * 3)
    me.polygons.foreach_get("center", ce)
    ce = ce.reshape(-1, 3)
    slots = [s.material for s in src.material_slots] or [None]
    mi = np.clip(mi, 0, len(slots) - 1)
    res = [resolve(m, p) for m in slots]
    lib = np.array([r[0] for r in res], dtype=object)[mi]
    tint = [r[1] for r in res]
    srcn = np.array([(m.name if m else "") for m in slots], dtype=object)[mi]
    is_arch = np.array([(m is not None and m.name in ARCH) for m in slots])[mi]
    horiz = np.abs(nr[:, 2]) > 0.97
    z = ce[:, 2]
    floor = is_arch & horiz & (np.abs(z[:, None] - FL[None, :]) < 0.03).any(1)
    ceil = is_arch & horiz & ~floor & ((z[:, None] <= CE[None, :] + 0.03) & (z[:, None] >= CE[None, :] - 0.5)).any(1)
    lib = np.where(floor, "PODLOGA", lib)
    lib = np.where(ceil & (lib != "TYNK_ZEWN"), "TYNK", lib)
    # Ramy okien: połowa zewnętrzna -> OKNA_ZEWN
    okno = lib == "OKNO"
    if okno.any():
        c = (p["lo"] + p["hi"]) / 2
        dx = min(abs(c.x - OB[0]), abs(c.x - OB[1]))
        dy = min(abs(c.y - OB[2]), abs(c.y - OB[3]))
        if dx < dy:
            axis, sign, mid = 0, (-1 if abs(c.x - OB[0]) < abs(c.x - OB[1]) else 1), c.x
        else:
            axis, sign, mid = 1, (-1 if abs(c.y - OB[2]) < abs(c.y - OB[3]) else 1), c.y
        outer = (ce[:, axis] - mid) * sign > 0.004
        lib = np.where(okno & outer, "OKNA_ZEWN", np.where(okno, "BIALY", lib))
    # Węzeł
    in_stairs = (p["lo"].x > SB[0] - 0.15 and p["hi"].x < SB[1] + 0.15 and p["lo"].y > SB[2] - 0.15
                 and p["hi"].y < SB[3] + 0.15)
    dims = p["hi"] - p["lo"]
    maxd = max(dims)
    tris = mesh_tris(me)
    small = maxd < 0.6 or (tris > 2500 and maxd < 1.6 and not is_arch.any())
    wez = np.full(n, 3 if small else 2)
    wez = np.where(np.isin(lib, list(W.TRANSPARENT)), 4, wez)
    wez = np.where(floor, 0, np.where(ceil, 1, wez))
    kond = np.where(z < C["granica"], 0, 1)
    keys = kond * 10 + wez
    if in_stairs:
        keys = np.where(floor | ceil, keys, 99)
    keys = np.where(z > C["z_max"], -1, keys)
    # UV
    keep_uv = np.array([(C.get("kafel_z", {}).get(l) == s or C.get("skp_tex", {}).get(l) == s or l == "LISCIE")
                        for l, s in zip(lib, srcn)])
    texd = np.isin(lib, list(TEXTURED))
    mode = np.where(floor, 1, np.where(texd & ~keep_uv, 2, 0))
    tile = np.array([TILE.get(l, 1.0) for l in lib])
    set_uvs(me, mode, tile)
    W.normalize_uv(me)
    # Kolor wierzchołków (DETAL, TKANINA)
    col = np.ones((n, 4), dtype=np.float32)
    for i, (l, tn) in enumerate(res):
        if l in {"DETAL", "TKANINA"} and tint[i] is not None:
            c = np.array(W.s2l(tint[i]))
            if l == "TKANINA":
                c = np.minimum(c / TKANINA_MEAN, 1.0)
            sel = (mi == i) & (lib == l)
            col[sel, :3] = c
    ca = me.color_attributes.new(W.VCOL, "FLOAT_COLOR", "CORNER")
    lt = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("loop_total", lt)
    ca.data.foreach_set("color", np.repeat(col, lt, axis=0).ravel())
    # Materiały biblioteki
    names = sorted(set(lib))
    idx = {nm: i for i, nm in enumerate(names)}
    me.materials.clear()
    for nm in names:
        me.materials.append(lib_mat(nm))
    me.polygons.foreach_set("material_index", np.array([idx[l] for l in lib], dtype=np.int32))
    for k, m2 in split_by_keys(me, keys).items():
        ob = bpy.data.objects.new("_p", m2)
        web.objects.link(ob)
        BYKEY.setdefault(k, []).append(ob)
        stats["tri_out"] += mesh_tris(m2)


VERBOSE_FROM = int(opts.get("gadaj_od", 10**9))
for i, p in enumerate(PARTS):
    t1 = time.time()
    if i >= VERBOSE_FROM:
        log("start %d %s tri %d ratio %s" % (i, " / ".join(p["path"][-2:]), mesh_tris(p["src"].data),
                                          RATIO.get(p["src"].data.name)))
    build_part(p)
    if time.time() - t1 > 3:
        log("wolna czesc %s: %.1fs, tri %d" % (" / ".join(p["path"][-2:]), time.time() - t1, mesh_tris(p["src"].data)))
    if i % 500 == 0:
        log("czesc %d/%d" % (i, len(PARTS)))
log("trojkaty: zrodlo %d -> wynik %d" % (stats["tri_src"], stats["tri_out"]))

# Oczka: walce 16-boczne osadzone w suficie
for c, top in SPOTS:
    zc = min(CE, key=lambda s: abs(s - top))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=C["oczka"]["r"], radius2=C["oczka"]["r"],
                          depth=0.012)
    me = bpy.data.meshes.new("oczko")
    bm.to_mesh(me)
    bm.free()
    me.transform(Matrix.Translation((c.x, c.y, zc - 0.004)))
    me.uv_layers.new(name=W.UV0)
    ca = me.color_attributes.new(W.VCOL, "FLOAT_COLOR", "CORNER")
    ca.data.foreach_set("color", np.ones(len(me.loops) * 4, dtype=np.float32))
    me.materials.append(lib_mat("LAMPA"))
    ob = bpy.data.objects.new("_p", me)
    web.objects.link(ob)
    k = (0 if zc < C["granica"] else 1) * 10 + 3
    BYKEY.setdefault(k, []).append(ob)
log("oczka: %d walcow" % len(SPOTS))

# Panele lamel
groups = {}
for p in LAM_PARTS:
    lo, hi = p["lo"], p["hi"]
    d = hi - lo
    dax = 0 if d.x < d.y else 1                     # oś grubości (normalna panelu)
    plane = round(((lo + hi) / 2)[dax] / 0.05)
    key = (dax, plane, round(lo.z / 0.1), round(hi.z / 0.1), p["lam_mat"])
    groups.setdefault(key, []).append(p)
npan = 0
for (dax, _, _, _, lam_mat), ps in groups.items():
    aax = 1 - dax
    ps.sort(key=lambda p: p["lo"][aax])
    runs, cur = [], [ps[0]]
    for p in ps[1:]:
        if p["lo"][aax] - max(q["hi"][aax] for q in cur) > 0.12:
            runs.append(cur)
            cur = [p]
        else:
            cur.append(p)
    runs.append(cur)
    for run in runs:
        lo = Vector((min(p["lo"].x for p in run), min(p["lo"].y for p in run), min(p["lo"].z for p in run)))
        hi = Vector((max(p["hi"].x for p in run), max(p["hi"].y for p in run), max(p["hi"].z for p in run)))
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        c, sz = (lo + hi) / 2, hi - lo
        for v in bm.verts:
            v.co = Vector((c.x + v.co.x * sz.x, c.y + v.co.y * sz.y, c.z + v.co.z * sz.z))
        me = bpy.data.meshes.new("lamele")
        bm.to_mesh(me)
        bm.free()
        me.shade_flat()
        me.uv_layers.new(name=W.UV0)
        n = len(me.polygons)
        set_uvs(me, np.full(n, 2), np.full(n, TILE.get(lam_mat, 0.48)))
        W.normalize_uv(me)
        ca = me.color_attributes.new(W.VCOL, "FLOAT_COLOR", "CORNER")
        ca.data.foreach_set("color", np.ones(len(me.loops) * 4, dtype=np.float32))
        me.materials.append(lib_mat(lam_mat))
        ob = bpy.data.objects.new("_p", me)
        web.objects.link(ob)
        k = (0 if c.z < C["granica"] else 1) * 10 + 2
        BYKEY.setdefault(k, []).append(ob)
        npan += 1
log("lamele: %d paneli" % npan)

# --- 7. Łączenie w węzły ---------------------------------------------------------------------
for ob in list(scene.objects):
    if ob.users_collection and web not in ob.users_collection:
        bpy.data.objects.remove(ob, do_unlink=True)
for c in list(scene.collection.children):
    if c is not web:
        scene.collection.children.unlink(c)

root = bpy.data.objects.new("WNETRZE_" + DOM, None)
web.objects.link(root)
root["dom"] = DOM
root["zrodlo"] = "BOR2_WNETRZA (SKP) %s, wnetrze_buduj.py" % KEY
konds = {}
for k in (0, 1):
    e = bpy.data.objects.new("KOND_%d" % k, None)
    web.objects.link(e)
    e.parent = root
    e["poziom_podlogi"] = float(C["podlogi"][k])
    konds[k] = e


def compact_materials(me):
    """Usuwa nieużywane sloty materiałów (operator Blendera nie działa w trybie --background)."""
    n = len(me.polygons)
    mi = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get("material_index", mi)
    used = sorted(set(np.unique(mi).tolist()))
    mats = [me.materials[i] for i in used]
    remap = np.zeros(max(used) + 1, dtype=np.int32)
    for j, i in enumerate(used):
        remap[i] = j
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", remap[mi])


NODES = {}
for k, obs in sorted(BYKEY.items()):
    name = key_name(k)
    if len(obs) > 1:
        with bpy.context.temp_override(active_object=obs[0], selected_editable_objects=obs, selected_objects=obs,
                                       object=obs[0]):
            bpy.ops.object.join()
    ob = obs[0]
    ob.name = name
    ob.data.name = name
    ob.parent = root if k == 99 else konds[k // 10]
    compact_materials(ob.data)
    ob.data.validate(verbose=False)
    NODES[name] = ob
    log("wezel %-22s tri=%7d mat=%d %s" % (name, mesh_tris(ob.data), len(ob.material_slots),
                                         [s.material.name for s in ob.material_slots]))

# --- 8. Punkty spaceru -----------------------------------------------------------------------
for name, x, y, kond, d in C["pkt"]:
    cd = bpy.data.cameras.new(name)
    cd.lens_unit = "FOV"
    cd.sensor_fit = "HORIZONTAL"
    cd.angle = math.radians(75)
    cd.clip_start = 0.05
    cd.clip_end = 300
    cam = bpy.data.objects.new(name, cd)
    web.objects.link(cam)
    cam.location = (x, y, C["podlogi"][kond] + 1.65)
    cam.rotation_euler = Vector((d[0], d[1], -0.08)).to_track_quat("-Z", "Y").to_euler()
    cam.parent = root
    cam["kondygnacja"] = kond

bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
mats = sorted({s.material.name for o in NODES.values() for s in o.material_slots})
tri = sum(mesh_tris(o.data) for o in NODES.values())
prims = sum(len(o.material_slots) for o in NODES.values())
log("RAZEM: trojkaty %d | prymitywy %d | materialy %d %s" % (tri, prims, len(mats), mats))
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
log("zapisano", OUT)
