"""Kafle zestawu roślin: renderuje (Cycles, rzut prostokątny, tło przezroczyste) gałązki, kępy traw
i kwiatostany, z których rosliny.py składa rośliny z kart. Każdy kafel to jedno pole atlasu.

Uruchomienie (z katalogu głównego projektu, tylko w tle):
    "D:\\Programy\\Blender\\blender.exe" --background --factory-startup --python \
        docs/inwestycja-3d/assets/zielen/kafle.py -- [nazwa_kafla ...] [probki=64]

Bez nazw renderuje wszystkie kafle do zielen/kafle/<nazwa>.png (RGBA, alfa prosta, sRGB).
Podstawa rośliny (punkt zaczepienia karty) leży na środku, 8 px nad dolną krawędzią kafla
(rosliny.py ucina ten margines w UV, więc karta zaczyna się dokładnie na gruncie).

Materiał źródłowy:
  - elementy zdjęciowe CC0 z Poly Haven (liście, płatki, wiechy) - prostokąty z elementy.json
    (elementy.mjs), naklejane na pojedyncze czworokąty; kolor można przesunąć (barwa/nasycenie/jasność),
  - źdźbła, łodygi i drobne kwiatki - proceduralne wstęgi z kolorem wierzchołków.
Oświetlenie kafla: równomierne niebo 0,9 + miękkie słońce z góry 0,6 - liść zwrócony do kamery ma
jasność ~ albedo, zacienione wnętrze kępy jest ciemniejsze (wbudowane AO).
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OPTS = dict(a.split("=", 1) for a in ARGS if "=" in a)
ONLY = [a for a in ARGS if "=" not in a]
SAMPLES = int(OPTS.get("probki", 64))
OUT = os.path.join(HERE, "kafle")
ELEM = json.load(open(os.path.join(HERE, "elementy.json"), encoding="utf-8"))
UP = Vector((0, 0, 1))
VIEW = Vector((0, 1, 0))  # kamera patrzy wzdłuż +Y (kafle z boku)
CUR_VIEW = [VIEW]  # kierunek patrzenia bieżącego kafla (wstęgi zwracają się do kamery)


def lin(h):
    """'#rrggbb' (sRGB) -> liniowe RGB."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def mul(a, k):
    return tuple(x * k for x in a)


def jitter(rng, c, amount=0.08, hue=0.03):
    """Losowa jasność ±amount i lekkie przesunięcie proporcji kanałów (różne liście/źdźbła)."""
    k = 1 + rng.uniform(-amount, amount)
    return tuple(max(0.0, x * k * (1 + rng.uniform(-hue, hue))) for x in c)


# --- Materiały -------------------------------------------------------------------
_images = {}


def image(rel, noncolor=False):
    key = (rel, noncolor)
    if key not in _images:
        img = bpy.data.images.load(os.path.join(HERE, rel))
        if noncolor:
            img.colorspace_settings.name = "Non-Color"
        _images[key] = img
    return _images[key]


def _node(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def mat_photo(model, hue=0.5, sat=1.0, val=1.0):
    """Tekstura zdjęciowa z maską; kolor = HSV(tekstura) x kolor wierzchołka 'Col'."""
    name = "%s|%.3f|%.3f|%.3f" % (model, hue, sat, val)
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    info = ELEM[model]
    out = _node(nt, "ShaderNodeOutputMaterial")
    tex = _node(nt, "ShaderNodeTexImage", image=image(info["diff"]))
    msk = _node(nt, "ShaderNodeTexImage", image=image(info["mask"], True))
    hs = _node(nt, "ShaderNodeHueSaturation")
    hs.inputs["Hue"].default_value = hue
    hs.inputs["Saturation"].default_value = sat
    hs.inputs["Value"].default_value = val
    vc = _node(nt, "ShaderNodeVertexColor", layer_name="Col")
    vm = _node(nt, "ShaderNodeVectorMath", operation="MULTIPLY")
    dif = _node(nt, "ShaderNodeBsdfDiffuse")
    tr = _node(nt, "ShaderNodeBsdfTransparent")
    mx = _node(nt, "ShaderNodeMixShader")
    L = nt.links.new
    L(tex.outputs["Color"], hs.inputs["Color"])
    L(hs.outputs["Color"], vm.inputs[0])
    L(vc.outputs["Color"], vm.inputs[1])
    L(vm.outputs[0], dif.inputs["Color"])
    # maski Poly Haven mają półprzezroczyste smugi wokół liści: próg z wąskim przejściem (gładka krawędź)
    mr = _node(nt, "ShaderNodeMapRange", clamp=True)
    mr.inputs["From Min"].default_value = 0.4
    mr.inputs["From Max"].default_value = 0.6
    L(msk.outputs["Color"], mr.inputs["Value"])
    L(mr.outputs["Result"], mx.inputs[0])
    L(tr.outputs[0], mx.inputs[1])
    L(dif.outputs[0], mx.inputs[2])
    L(mx.outputs[0], out.inputs["Surface"])
    return m


def mat_vcol():
    m = bpy.data.materials.get("vcol")
    if m:
        return m
    m = bpy.data.materials.new("vcol")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = _node(nt, "ShaderNodeOutputMaterial")
    vc = _node(nt, "ShaderNodeVertexColor", layer_name="Col")
    dif = _node(nt, "ShaderNodeBsdfDiffuse")
    nt.links.new(vc.outputs["Color"], dif.inputs["Color"])
    nt.links.new(dif.outputs[0], out.inputs["Surface"])
    return m


# --- Geometria ---------------------------------------------------------------------
class Builder:
    def __init__(self):
        self.v, self.f, self.uv, self.col, self.mi, self.mats = [], [], [], [], [], []

    def _m(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def quad(self, corners, uvs, cols, mat):
        i = len(self.v)
        self.v += [tuple(c) for c in corners]
        self.f.append((i, i + 1, i + 2, i + 3))
        self.uv += uvs
        self.col += cols if isinstance(cols, list) else [cols] * 4
        self.mi.append(self._m(mat))

    def build(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        uvl = me.uv_layers.new(name="UVMap")
        for li, uv in enumerate(self.uv):
            uvl.data[li].uv = uv
        ca = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for li, c in enumerate(self.col):
            ca.data[li].color = (c[0], c[1], c[2], 1.0)
        for m in self.mats:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.mi)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def element(b, model, idx, base, d, n, length, col, mat, flip=False, width_k=1.0):
    """Element zdjęciowy (liść/płatek/wiecha) jako czworokąt: od `base` wzdłuż `d`, płaszczyzna ~ prostopadła do `n`."""
    e = ELEM[model]["items"][idx]
    W, H = ELEM[model]["size"]
    d = d.normalized()
    if CUR_VIEW[0].z == 0 and abs(base.x) + length > XLIM[0]:  # liść przy krawędzi kafla: przesunięcie do środka
        base = Vector((math.copysign(max(0.0, XLIM[0] - length), base.x), base.y, base.z))
    side = d.cross(n)
    if side.length < 1e-6:
        side = d.orthogonal()
    side.normalize()
    L = length
    w = L * e["wid"] / e["len"] * width_k
    ca, sa = math.cos(e["ang"]), math.sin(e["ang"])
    sgn = -1 if flip else 1
    corners, uvs = [], []
    for t, s in ((0, -1), (0, 1), (1, 1), (1, -1)):
        corners.append(base + d * (t * L) + side * (s * w / 2))
        u = (t - 0.5) * e["len"] * sgn
        v = s * 0.5 * e["wid"]
        px = e["cx"] + u * ca - v * sa
        py = e["cy"] + u * sa + v * ca
        uvs.append((px / W, 1 - py / H))
    b.quad(corners, uvs, col, mat)


def ribbon(b, pts, widths, cols, twist=0.0, view=None):
    """Wstęga wzdłuż łamanej (źdźbło, łodyga) zwrócona do kamery, z opcjonalnym skręceniem."""
    view = view or CUR_VIEW[0]
    mat = mat_vcol()
    n = len(pts)
    mx = max(abs(p.x) for p in pts)
    if mx > XLIM[0]:  # łuk wychodzi poza kafel: ściśnięcie w poziomie zamiast ucięcia na krawędzi
        k = XLIM[0] / mx
        pts = [Vector((p.x * k, p.y, p.z)) for p in pts]
    mz = max(p.z for p in pts)
    if mz > ZLIM[0]:
        k = ZLIM[0] / mz
        pts = [Vector((p.x, p.y, p.z * k)) for p in pts]
    if CUR_VIEW[0].z != 0:  # kafel z góry: ograniczenie także w osi Y obrazu
        my = max(abs(p.y) for p in pts)
        if my > XLIM[0]:
            k = XLIM[0] / my
            pts = [Vector((p.x, p.y * k, p.z)) for p in pts]
    left, right = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        s = d.cross(view)
        if s.length < 1e-6:
            s = Vector((1, 0, 0))
        s.normalize()
        if twist:
            s = Matrix.Rotation(twist, 3, d) @ s
        left.append(p - s * (widths[i] / 2))
        right.append(p + s * (widths[i] / 2))
    for i in range(n - 1):
        b.quad([left[i], right[i], right[i + 1], left[i + 1]], [(0, 0)] * 4,
               [cols[i], cols[i], cols[i + 1], cols[i + 1]], mat)


def curve(base, d0, length, segs=6, bend=0.0, droop=0.0):
    """Punkty łuku: start `base`, kierunek `d0`, zgięcie `bend` rad na całej długości (na zewnątrz),
    `droop` - dodatkowe opadanie końcówki (grawitacja)."""
    d = d0.normalized()
    h = Vector((d.x, d.y, 0))
    axis = UP.cross(h).normalized() if h.length > 1e-4 else Vector((0, 1, 0))
    pts, ds = [base.copy()], length / segs
    for _ in range(segs):
        pts.append(pts[-1] + d * ds)
        d = (Matrix.Rotation(bend / segs, 3, axis) @ d).normalized()
        if droop:
            d = (d + Vector((0, 0, -droop / segs))).normalized()
    return pts


def blade(b, rng, base, theta, phi, length, width, c_base, c_tip, bend=0.3, droop=0.0, segs=7, tip_k=0.12,
          twist=None):
    d0 = Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))
    pts = curve(base, d0, length, segs, bend, droop)
    n = len(pts)
    widths = [width * max(tip_k, (1 - i / (n - 1)) ** 0.8) for i in range(n)]
    cols = [mix(c_base, c_tip, (i / (n - 1)) ** 0.9) for i in range(n)]
    ribbon(b, pts, widths, cols, twist=rng.uniform(-0.9, 0.9) if twist is None else twist)
    return pts


def disk_dir(rng, max_theta, depth=0.35):
    """Kierunek w wachlarzu: kąt od pionu do max_theta, głównie w płaszczyźnie karty (XZ)."""
    th = max_theta * math.sqrt(rng.random())
    side = rng.choice((-1, 1))
    phi = (0 if side > 0 else math.pi) + rng.uniform(-depth, depth)
    return th, phi


# --- Kafle ---------------------------------------------------------------------------
TILES = {}
XLIM = [1.0]  # połowa szerokości bieżącego kafla z marginesem (render())
ZLIM = [9.0]  # wysokość bieżącego kafla nad podstawą z marginesem


def tile(name, px, width_m, view="side"):
    def deco(fn):
        TILES[name] = (fn, px, width_m, view)
        return fn
    return deco


FESCUE = dict(base=lin("#4a5440"), mid=lin("#737e66"), tip=lin("#9da58e"), dry=lin("#9c8f6e"))


def fescue(b, rng, n=420, h=0.33, spread=1.12, blue=1.0, dry=0.05, around=False, fountain=True):
    for _ in range(n):
        th, phi = disk_dir(rng, spread)
        if around:  # pełna kopuła (kafel z góry)
            phi = rng.uniform(0, 2 * math.pi)
        L = h * rng.uniform(0.8, 1.15) * (1 + 0.15 * th / spread)
        base = Vector((rng.gauss(0, 0.012), rng.gauss(0, 0.012), 0))
        tip = FESCUE["dry"] if rng.random() < dry else mix(FESCUE["mid"], FESCUE["tip"], rng.random())
        tip = jitter(rng, tip, 0.1)
        tip = (tip[0] * (1 - 0.08 * (blue - 1)), tip[1], tip[2] * blue)
        if fountain:  # źdźbła wychodzą stromo i dopiero końcówki miękko opadają na boki
            blade(b, rng, base, th, phi, L, rng.uniform(0.0024, 0.0034), FESCUE["base"], tip,
                  bend=rng.uniform(0.2, 0.7) + th * 1.1, droop=0.35 * th / spread + 0.1, segs=8)
        else:
            blade(b, rng, base, th, phi, L, rng.uniform(0.0024, 0.0034), FESCUE["base"], tip,
                  bend=rng.uniform(0.15, 0.55) + th * 0.35, droop=0.15 * th)


@tile("kepa_sina_a", (512, 256), 0.66)
def t_fescue_a(b, rng):
    fescue(b, rng, n=700, h=0.27, spread=0.8)


def t_fescue_b(b, rng):  # od v2 poza atlasem
    # bardziej zielonkawa, niższa i gęstsza
    global FESCUE
    keep = dict(FESCUE)
    FESCUE.update(mid=lin("#6c7c6c"), tip=lin("#919d88"))
    fescue(b, rng, n=680, h=0.27, blue=0.96, dry=0.08)
    FESCUE = keep


@tile("kepa_sina_gora", (256, 256), 0.5, view="top")
def t_fescue_top(b, rng):
    """Ta sama kępa widziana z góry (karta pozioma nad środkiem kępy - bez "gwiazdy" kart z boku)."""
    fescue(b, rng, n=700, h=0.27, around=True, spread=0.8)


@tile("kepa_sina_c", (512, 512), 0.62)
def t_fescue_c(b, rng):
    # kępa w kwiecie: nad liśćmi słomkowe źdźbła z wąskimi wiechami (jak jasne kłoski na visualization-1)
    fescue(b, rng, n=560, h=0.25, spread=0.8)
    straw, straw2 = lin("#a89a74"), lin("#c2b48e")
    for _ in range(26):
        th, phi = disk_dir(rng, 0.45)
        L = rng.uniform(0.36, 0.47)
        pts = blade(b, rng, Vector((rng.gauss(0, 0.01), rng.gauss(0, 0.01), 0)), th, phi, L, 0.0016,
                    lin("#7c8462"), straw, bend=rng.uniform(0.0, 0.25), segs=6, tip_k=0.6)
        plume(b, rng, pts[-1], (pts[-1] - pts[-2]).normalized(), 0.075, 14, straw, straw2)


def plume(b, rng, top, d, length, n, c1, c2, spread=0.35, size=(0.012, 0.022), width=0.0032):
    """Wąska wiecha: wrzecionowata grupa drobnych kłosków wzdłuż końca źdźbła."""
    for k in range(n):
        t = k / max(1, n - 1)
        p = top - d * (length * t)
        dd = (d + Vector((rng.uniform(-spread, spread), rng.uniform(-spread, spread) * 0.6, 0.2))).normalized()
        q = Vector(p) + Vector((rng.gauss(0, 0.003), 0, 0))
        s = rng.uniform(*size) * (1 - 0.35 * abs(t - 0.4))
        blade(b, rng, q, math.acos(max(-1, min(1, dd.z))), math.atan2(dd.y, dd.x), s,
              width, c1, jitter(rng, c2, 0.08), bend=0.1, segs=2, tip_k=0.3)


GRASS_LEAF = dict(base=lin("#46502f"), mid=lin("#6f7a48"), tip=lin("#9a9a68"))


@tile("trawa_wys_a", (512, 1024), 0.62)
def t_calamagrostis(b, rng):
    """Trzcinnik ostrokwiatowy 'Karl Foerster': pionowa kępa liści do ~0,7 m, wiechy do ~1,15 m."""
    for _ in range(210):
        th, phi = disk_dir(rng, 0.5)
        L = rng.uniform(0.42, 0.74)
        tip = jitter(rng, mix(GRASS_LEAF["mid"], GRASS_LEAF["tip"], rng.random() ** 2), 0.1)
        blade(b, rng, Vector((rng.gauss(0, 0.025), rng.gauss(0, 0.02), 0)), th, phi, L, rng.uniform(0.006, 0.009),
              GRASS_LEAF["base"], tip, bend=rng.uniform(0.1, 0.6) * (0.5 + th), droop=0.2 * th, segs=8)
    stem_c, straw, straw2 = lin("#8d875c"), lin("#a8946e"), lin("#c4b38e")
    for _ in range(42):
        th, phi = disk_dir(rng, 0.2)
        L = rng.uniform(0.8, 0.93)
        base = Vector((rng.gauss(0, 0.03), rng.gauss(0, 0.02), 0))
        pts = blade(b, rng, base, th, phi, L, 0.0028, lin("#5d6540"), stem_c, bend=rng.uniform(-0.08, 0.12),
                    segs=7, tip_k=0.7)
        # wiecha: wąska, pionowa, pierzasta, słomkowo-beżowa (~22 cm)
        plume(b, rng, pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.02, (pts[-1] - pts[-2]).normalized(),
              rng.uniform(0.19, 0.25), 34, straw, straw2, spread=0.22, size=(0.016, 0.03), width=0.0036)


@tile("trawa_wys_b", (512, 1024), 0.62)
def t_pennisetum(b, rng):
    """Rozplenica / miskant: fontanna łukowatych, wąskich liści do ~0,8 m i jasne, puszyste kłosy."""
    leaf_b, leaf_m, leaf_t = lin("#4f5a3c"), lin("#7d8a5f"), lin("#a7aa82")
    for _ in range(240):
        th, phi = disk_dir(rng, 0.42)
        L = rng.uniform(0.45, 0.78)
        blade(b, rng, Vector((rng.gauss(0, 0.02), rng.gauss(0, 0.02), 0)), th, phi, L, rng.uniform(0.004, 0.0065),
              leaf_b, jitter(rng, mix(leaf_m, leaf_t, rng.random()), 0.1), bend=rng.uniform(0.2, 0.6),
              droop=0.2, segs=8)
    cream, cream2 = lin("#b8ab8c"), lin("#d3c8ad")
    for _ in range(34):
        th, phi = disk_dir(rng, 0.3)
        L = rng.uniform(0.62, 0.86)
        pts = blade(b, rng, Vector((rng.gauss(0, 0.02), rng.gauss(0, 0.02), 0)), th, phi, L, 0.0025,
                    lin("#6a7048"), lin("#a29a70"), bend=rng.uniform(0.15, 0.5), segs=7, tip_k=0.8)
        top, d = pts[-1], (pts[-1] - pts[-2]).normalized()
        # kłos-szczotka: gęste włoski wokół osi, ~12 cm
        Lk = rng.uniform(0.1, 0.15)
        for k in range(150):
            t = rng.random()
            p = top - d * (Lk * t)
            r = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            r = (r - d * r.dot(d)).normalized() + d * 0.6
            hair = rng.uniform(0.012, 0.02) * (1 - 0.6 * abs(t - 0.4))
            q = p + r.normalized() * hair
            c = jitter(rng, mix(cream, cream2, rng.random()), 0.08)
            ribbon(b, [p, q], [0.002, 0.001], [mul(c, 0.8), c])


# --- byliny ---------------------------------------------------------------------------
LEAVES_GREEN = ("periwinkle_plant", (2, 3, 5, 6, 9, 11, 16, 17, 18))
LEAVES_GREY = ("shrub_04", (1, 2, 4, 5, 6, 7, 8, 9))
LEAVES_NARROW = ("shrub_02", (4, 5, 6))
LEAVES_LOBED = ("flower_gazania", (6, 14, 18, 21))
LEAVES_HORNBEAM = ("shrub_01", (9, 13))


def rand_leaf(b, rng, src, base, d, n, L, col=(1, 1, 1), hue=0.5, sat=1.0, val=1.0):
    model, ids = src
    element(b, model, rng.choice(ids), base, d, n, L, jitter(rng, col, 0.12, 0.04), mat_photo(model, hue, sat, val),
            flip=rng.random() < 0.5)


def rand_unit(rng):
    v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
    return v.normalized()


def foliage_mound(b, rng, n=110, h=0.3, w=0.5, srcs=(LEAVES_GREEN, LEAVES_LOBED), size=(0.07, 0.12),
                  col=(1, 1, 1), val=0.95, sat=0.85):
    stem = lin("#56603a")
    for i in range(n):
        th, phi = disk_dir(rng, 1.0, depth=0.6)
        reach = rng.uniform(0.3, 1.0)
        L = (h * 0.9) * reach
        pts = curve(Vector((rng.gauss(0, 0.02), rng.gauss(0, 0.02), 0)),
                    Vector((math.sin(th) * math.cos(phi), math.sin(th) * math.sin(phi), math.cos(th))), L, 3, 0.5)
        ribbon(b, pts, [0.003, 0.0025, 0.002, 0.0015], [stem] * 4)
        tip = pts[-1]
        d = (pts[-1] - pts[-2]).normalized()
        d = (d + rand_unit(rng) * 0.6).normalized()
        nrm = (-VIEW + rand_unit(rng) * 0.8 + UP * 0.6).normalized()
        rand_leaf(b, rng, srcs[i % len(srcs)], tip - d * 0.01, d, nrm, rng.uniform(*size) * (0.7 + 0.5 * reach),
                  col, sat=sat, val=val)


@tile("liscie_bylin", (512, 256), 0.62)
def t_foliage(b, rng):
    foliage_mound(b, rng, n=230, h=0.26, srcs=(LEAVES_GREEN, LEAVES_GREY, LEAVES_NARROW), size=(0.04, 0.07),
                  sat=0.75, val=0.85)


def stems_with_heads(b, rng, n, hmin, hmax, spread, head_fn, stem_c=lin("#5b6a3a"), leaf_src=None, branch=0):
    for _ in range(n):
        th, phi = disk_dir(rng, spread)
        L = rng.uniform(hmin, hmax)
        base = Vector((rng.gauss(0, 0.03), rng.gauss(0, 0.025), 0))
        d0 = Vector((math.sin(th) * math.cos(phi), math.sin(th) * math.sin(phi), math.cos(th)))
        pts = curve(base, d0, L, 6, rng.uniform(-0.15, 0.25), 0.0)
        ribbon(b, pts, [0.0035 - 0.0025 * i / 6 for i in range(7)], [jitter(rng, stem_c, 0.06)] * 7)
        if leaf_src:
            for k in (1, 2):
                p = pts[k]
                dd = (Vector((math.cos(phi + rng.uniform(-1.5, 1.5)), rng.uniform(-0.5, 0.5), 0.6))).normalized()
                rand_leaf(b, rng, leaf_src, p, dd, (-VIEW + UP * 0.5).normalized(), rng.uniform(0.04, 0.07), sat=0.85)
        head_fn(b, rng, pts[-1], (pts[-1] - pts[-2]).normalized())
        for _ in range(branch):
            k = rng.randint(3, 5)
            p = pts[k]
            dd = ((pts[-1] - pts[-2]).normalized() + Vector((rng.uniform(-0.7, 0.7), rng.uniform(-0.3, 0.3), 0))).normalized()
            bp = curve(p, dd, rng.uniform(0.06, 0.14) * (7 - k) / 3, 3, 0.2)
            ribbon(b, bp, [0.0018, 0.0015, 0.0012, 0.001], [stem_c] * 4)
            head_fn(b, rng, bp[-1], (bp[-1] - bp[-2]).normalized())


def flower_face(rng, d, toward_cam=0.6):
    """Normalna kwiatu: w górę wzdłuż łodygi, przechylona do kamery i losowo."""
    return (d * 0.8 - VIEW * toward_cam + rand_unit(rng) * 0.4).normalized()


def white_flower(b, rng, p, d, size=(0.022, 0.03)):
    n = flower_face(rng, d)
    s = rng.uniform(*size)
    a = n.orthogonal().normalized()
    a = Matrix.Rotation(rng.uniform(0, 6.28), 3, n) @ a
    idx = rng.choice((10, 15))
    e = ELEM["periwinkle_plant"]["items"][idx]
    # kwiat barwinka przebarwiony na biel (lekko kremowy) - kwadrat w płaszczyźnie kwiatu
    element(b, "periwinkle_plant", idx, p - a * (s / 2) + n * 0.002, a, n, s, jitter(rng, (1.0, 0.99, 0.95), 0.05),
            mat_photo("periwinkle_plant", 0.5, 0.06, 1.75))


@tile("bylina_biala_a", (512, 512), 0.62)
def t_white_a(b, rng):
    """Biała bylina o luźnych, rozgałęzionych pędach (gaura / floks): kwiaty 2-3 cm."""
    foliage_mound(b, rng, n=70, h=0.22, srcs=(LEAVES_GREEN, LEAVES_NARROW), size=(0.05, 0.09))
    stems_with_heads(b, rng, 34, 0.32, 0.55, 0.7, lambda b, r, p, d: white_flower(b, r, p, d), branch=2)


def umbel(b, rng, p, d, r=0.035, n=40, col=(1.0, 0.98, 0.92), val=1.7):
    nrm = flower_face(rng, d, 0.5)
    a = nrm.orthogonal().normalized()
    c = nrm.cross(a)
    for _ in range(n):
        rr = r * math.sqrt(rng.random())
        ang = rng.uniform(0, 6.28)
        q = p + a * (rr * math.cos(ang)) + c * (rr * math.sin(ang)) + nrm * (0.012 * (1 - (rr / r) ** 2))
        s = rng.uniform(0.006, 0.009)
        aa = Matrix.Rotation(rng.uniform(0, 6.28), 3, nrm) @ a
        element(b, "periwinkle_plant", rng.choice((10, 15)), q - aa * (s / 2), aa, nrm, s, jitter(rng, col, 0.06),
                mat_photo("periwinkle_plant", 0.5, 0.05, val))


def t_white_b(b, rng):  # krwawnik biały - od v2 poza atlasem (miejsce dla bylin żółtych)
    """Krwawnik (Achillea) o białych, płaskich baldachach na sztywnych łodygach do ~0,6 m."""
    foliage_mound(b, rng, n=80, h=0.22, srcs=(LEAVES_NARROW, LEAVES_GREY), size=(0.05, 0.09), sat=0.8)
    stems_with_heads(b, rng, 16, 0.42, 0.62, 0.45, lambda b, r, p, d: umbel(b, r, p, d, r.uniform(0.03, 0.045)),
                     leaf_src=LEAVES_NARROW, branch=1)


def spike(b, rng, p, d, length, col_a, col_b, whorls=12, per=5, size=(0.006, 0.009), hue=0.5, sat=1.0, val=1.0,
          calyx=lin("#3e2d45"), wk=1.6):
    """Kłos okółków drobnych kwiatków (szałwia / kocimiętka / lawenda)."""
    side = d.cross(VIEW)
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    for k in range(whorls):
        t = k / max(1, whorls - 1)
        q = p - d * (length * (1 - t))
        shrink = 1 - 0.55 * t  # ku czubkowi drobniej
        for j in range(per):
            ang = rng.uniform(0, 6.28)
            out = (side * math.cos(ang) + VIEW * math.sin(ang)).normalized()
            dd = (out + d * 0.6).normalized()
            s = rng.uniform(*size) * shrink
            c = jitter(rng, mix(col_a, col_b, rng.random()), 0.1)
            element(b, "leipoldtia_schultzei", rng.choice((1, 2, 3, 4, 5, 6, 8, 9, 10, 11)), q, dd,
                    (-VIEW + out * 0.3).normalized(), s, c, mat_photo("leipoldtia_schultzei", hue, sat, val), width_k=wk)
        if rng.random() < 0.7:
            ribbon(b, [q, q + d * 0.006], [0.004 * shrink, 0.002], [calyx, calyx])


@tile("bylina_fiolet_a", (512, 512), 0.62)
def t_salvia(b, rng):
    """Szałwia omszona 'Caradonna': sztywne, pionowe kłosy ciemnofioletowe, ~0,5 m."""
    foliage_mound(b, rng, n=80, h=0.2, srcs=(LEAVES_NARROW, LEAVES_GREEN), size=(0.05, 0.085), sat=0.8, val=0.9)
    stems_with_heads(
        b, rng, 30, 0.3, 0.5, 0.35,
        lambda b, r, p, d: spike(b, r, p, d, r.uniform(0.12, 0.18), (1.0, 1.0, 1.0), (0.85, 0.85, 0.95),
                                 whorls=16, per=6, size=(0.009, 0.013), hue=0.42, sat=0.6, val=0.72, wk=3.0),
        stem_c=lin("#4a4a3c"))


@tile("bylina_fiolet_b", (512, 512), 0.62)
def t_nepeta(b, rng):
    """Kocimiętka / lawenda: szarozielona kopułka z luźnymi, łukowatymi pędami w kolorze lawendy."""
    foliage_mound(b, rng, n=170, h=0.24, srcs=(LEAVES_GREY,), size=(0.03, 0.05), sat=0.55, val=1.0)
    stems_with_heads(
        b, rng, 70, 0.25, 0.4, 0.9,
        lambda b, r, p, d: spike(b, r, p, d, r.uniform(0.1, 0.16), (1.0, 1.0, 1.0), (0.9, 0.92, 1.0),
                                 whorls=14, per=6, size=(0.009, 0.013), hue=0.43, sat=0.42, val=1.1,
                                 calyx=lin("#6c6a7a"), wk=2.6),
        stem_c=lin("#6f7458"), leaf_src=LEAVES_GREY)


def echinacea_head(b, rng, p, d):
    n = flower_face(rng, d, 0.75)
    a = n.orthogonal().normalized()
    c = n.cross(a)
    # płatki: różowe (płatki Leipoldtii przesunięte ku różowi), opadające
    k = rng.randint(12, 15)
    L = rng.uniform(0.032, 0.042)
    droop = rng.uniform(0.25, 0.6)
    for i in range(k):
        ang = i / k * 6.283 + rng.uniform(-0.12, 0.12)
        out = a * math.cos(ang) + c * math.sin(ang)
        dd = (out - n * droop).normalized()
        element(b, "leipoldtia_schultzei", rng.choice((1, 2, 4, 5, 8, 10, 11)), p + out * 0.006, dd,
                (n + dd * 0.0).normalized(), L * rng.uniform(0.85, 1.1), jitter(rng, (1.0, 1.0, 1.0), 0.08),
                mat_photo("leipoldtia_schultzei", 0.53, 0.52, 1.0), width_k=1.5)
    # stożek: środek gazanii przyciemniony ku pomarańczowo-brązowemu
    s = rng.uniform(0.024, 0.03)
    aa = Matrix.Rotation(rng.uniform(0, 6.28), 3, n) @ a
    element(b, "flower_gazania", 12, p - aa * (s / 2) + n * 0.008, aa, n, s, (1.0, 0.85, 0.7),
            mat_photo("flower_gazania", 0.49, 1.0, 0.75))


@tile("bylina_roz", (512, 512), 0.8)
def t_echinacea(b, rng):
    """Jeżówka purpurowa: łodygi do ~0,75 m, różowe, opadające płatki, pomarańczowo-brązowy stożek."""
    foliage_mound(b, rng, n=110, h=0.26, srcs=(LEAVES_GREY, LEAVES_NARROW), size=(0.06, 0.1), sat=0.8, val=0.8)
    stems_with_heads(b, rng, 17, 0.5, 0.74, 0.4, echinacea_head, stem_c=lin("#4f5a34"), leaf_src=LEAVES_GREEN)


@tile("bylina_zolta_a", (512, 512), 0.66)
def t_achillea_yellow(b, rng):
    """Krwawnik 'Moonshine': siarkowożółte, płaskie baldachy nad szarozieloną, pierzastą rozetą, ~0,5 m."""
    foliage_mound(b, rng, n=110, h=0.2, srcs=(LEAVES_NARROW, LEAVES_GREY), size=(0.045, 0.08), sat=0.5, val=0.95)
    stems_with_heads(b, rng, 18, 0.36, 0.56, 0.45,
                     lambda b, r, p, d: umbel(b, r, p, d, r.uniform(0.03, 0.045), 46, col=(1.0, 0.76, 0.22), val=1.6),
                     stem_c=lin("#66704c"), leaf_src=LEAVES_NARROW, branch=1)


def daisy_head(b, rng, p, d):
    """Rudbekia: 12-14 złotożółtych płatków (płatki gazanii przesunięte ku żółci), ciemny stożek."""
    n = flower_face(rng, d, 0.75)
    a = n.orthogonal().normalized()
    c = n.cross(a)
    k = rng.randint(12, 14)
    L = rng.uniform(0.026, 0.034)
    droop = rng.uniform(0.05, 0.3)
    for i in range(k):
        ang = i / k * 6.283 + rng.uniform(-0.1, 0.1)
        out = a * math.cos(ang) + c * math.sin(ang)
        dd = (out - n * droop).normalized()
        element(b, "flower_gazania", rng.choice((1, 2, 3, 7, 9, 10)), p + out * 0.007, dd, n,
                L * rng.uniform(0.9, 1.1), jitter(rng, (1.0, 0.95, 0.75), 0.06),
                mat_photo("flower_gazania", 0.535, 0.85, 1.0), width_k=1.1)
    s = rng.uniform(0.016, 0.02)
    aa = Matrix.Rotation(rng.uniform(0, 6.28), 3, n) @ a
    element(b, "flower_gazania", 16, p - aa * (s / 2) + n * 0.006, aa, n, s, (0.55, 0.45, 0.35),
            mat_photo("flower_gazania", 0.5, 0.6, 0.45))


@tile("bylina_zolta_b", (512, 512), 0.7)
def t_rudbeckia(b, rng):
    """Rudbekia błyszcząca: złote koszyczki z ciemnym środkiem na sztywnych łodygach ~0,6 m, ciemne liście."""
    foliage_mound(b, rng, n=120, h=0.26, srcs=(LEAVES_GREEN, LEAVES_GREY), size=(0.06, 0.1), sat=0.75, val=0.75)
    stems_with_heads(b, rng, 24, 0.42, 0.62, 0.42, daisy_head, stem_c=lin("#4b5632"), leaf_src=LEAVES_GREEN, branch=1)


MEADOW = dict(base=lin("#38432a"), mid=lin("#6c7a43"), tip=lin("#8f915c"), dry=lin("#a89a70"))


def meadow(b, rng, n, h, spread=1.15, dry=0.15, stalks=12):
    """Trawa łąkowa (podszyt): zielone źdźbła ze słomkowymi końcami, część suchych, kilka kłosków."""
    for _ in range(n):
        th, phi = disk_dir(rng, spread, depth=0.5)
        L = h * rng.uniform(0.45, 1.05) * (1 - 0.45 * th / spread)
        tip = MEADOW["dry"] if rng.random() < dry else mix(MEADOW["mid"], MEADOW["tip"], rng.random() ** 1.5)
        blade(b, rng, Vector((rng.gauss(0, 0.05), rng.gauss(0, 0.02), 0)), th, phi, L, rng.uniform(0.0028, 0.0042),
              MEADOW["base"], jitter(rng, tip, 0.1), bend=rng.uniform(0.2, 0.7) + th * 0.4, droop=0.3 * th, segs=6)
    straw, straw2 = lin("#a29470"), lin("#bdae88")
    for _ in range(stalks):
        th, phi = disk_dir(rng, 0.5)
        pts = blade(b, rng, Vector((rng.gauss(0, 0.06), rng.gauss(0, 0.02), 0)), th, phi, h * rng.uniform(1.0, 1.25),
                    0.0016, lin("#6f7449"), straw, bend=rng.uniform(0.0, 0.3), segs=5, tip_k=0.6)
        plume(b, rng, pts[-1], (pts[-1] - pts[-2]).normalized(), 0.05, 10, straw, straw2, size=(0.008, 0.015))


@tile("podszyt_a", (512, 256), 0.76)
def t_meadow_a(b, rng):
    """Szeroka, niska kępa trawy łąkowej 0,2-0,35 m (podszyt między kępami ozdobnymi)."""
    meadow(b, rng, 820, 0.3)


@tile("podszyt_b", (256, 256), 0.46)
def t_meadow_b(b, rng):
    """Mniejsza, bardziej słomkowa kępka trawy łąkowej (~0,25 m)."""
    global MEADOW
    keep = dict(MEADOW)
    MEADOW.update(mid=lin("#758049"), tip=lin("#9c9765"))
    meadow(b, rng, 480, 0.25, dry=0.25, stalks=8)
    MEADOW = keep


# --- krzewy i żywopłot --------------------------------------------------------------
def leaf_cluster(b, rng, srcs, n, rx, rz, size, cz=0.242, face_cam=0.9, sat=0.85, val=0.95, col=(1, 1, 1),
                 twigs=True, square=False):
    twig = lin("#5a4a36")
    center = Vector((0, 0, cz))
    if twigs:
        for _ in range(9):
            a = rng.uniform(0, 6.28)
            end = center + Vector((math.cos(a) * rx * 0.6, 0.05, math.sin(a) * rz * 0.6))
            start = center + (end - center) * 0.1
            ribbon(b, [start, (start + end) / 2, end], [0.006, 0.004, 0.002], [twig] * 3)
    for i in range(n):
        # punkt w elipsie, gęściej ku środkowi, poszarpany brzeg
        r = math.sqrt(rng.random()) * rng.uniform(0.85, 1.05)
        a = rng.uniform(0, 6.28)
        if square:  # superelipsa |x|^4 + |z|^4 <= 1: prawie kwadrat o zaokrąglonych rogach
            ca, sa = math.cos(a), math.sin(a)
            k = (ca ** 4 + sa ** 4) ** -0.25
            r *= k
        p = center + Vector((math.cos(a) * rx * r, rng.uniform(-0.06, 0.06), math.sin(a) * rz * r))
        d = (Vector((math.cos(a), 0, math.sin(a))) * 0.5 + rand_unit(rng)).normalized()
        nrm = (-VIEW * face_cam + rand_unit(rng) * 0.6 + UP * 0.3).normalized()
        # liście w głębi ciemniejsze (cień wnętrza krzewu)
        depth = 1 - 0.25 * (p.y + 0.06) / 0.12
        L = rng.uniform(*size)
        rand_leaf(b, rng, srcs[i % len(srcs)], p - d * (L * 0.5 * r), d, nrm, L, mul(col, depth), sat=sat, val=val)


def branch_spray(b, rng, n_branch, srcs, size, leaves_per, flowers=0, spread=0.62, length=(0.26, 0.42),
                 sat=0.8, val=0.92):
    """Wiązka łukowatych gałązek z liśćmi od podstawy (środek dołu kafla): nieregularny obrys krzewu."""
    twig = lin("#5b4a37")
    tips = []
    for _ in range(n_branch):
        th, phi = disk_dir(rng, spread, depth=0.7)
        L = rng.uniform(*length)
        pts = curve(Vector((rng.gauss(0, 0.01), rng.gauss(0, 0.01), 0)),
                    Vector((math.sin(th) * math.cos(phi), math.sin(th) * math.sin(phi), math.cos(th))), L, 6,
                    rng.uniform(0.1, 0.45), 0.2 * th)
        ribbon(b, pts, [0.007 - 0.0009 * i for i in range(7)], [twig] * 7)
        tips.append(pts)
        # boczne gałązki
        for k in (3, 4, 5):
            if rng.random() < 0.6:
                d = ((pts[k] - pts[k - 1]).normalized() + rand_unit(rng) * 0.8).normalized()
                sp = curve(pts[k], d, L * rng.uniform(0.2, 0.35), 3, 0.2)
                ribbon(b, sp, [0.003, 0.0025, 0.002, 0.0015], [twig] * 4)
                tips.append(sp)
    for pts in tips:
        n = len(pts)
        for i in range(leaves_per):
            t = 0.35 + 0.65 * (i + rng.random()) / leaves_per  # liście na zewnętrznych 2/3 gałązki
            k = min(n - 2, int(t * (n - 1)))
            p = pts[k].lerp(pts[k + 1], t * (n - 1) - k)
            d = ((pts[k + 1] - pts[k]).normalized() + rand_unit(rng) * 0.9).normalized()
            nrm = (-VIEW + rand_unit(rng) * 0.7 + UP * 0.4).normalized()
            rand_leaf(b, rng, srcs[i % len(srcs)], p, d, nrm, rng.uniform(*size) * (0.75 + 0.35 * t), sat=sat, val=val)
    for _ in range(flowers):  # baldaszki białych kwiatów wzdłuż górnej strony łuków
        pts = rng.choice(tips)
        k = rng.randint(len(pts) // 2, len(pts) - 1)
        umbel(b, rng, pts[k] + Vector((0, -0.01, 0.01)), UP, rng.uniform(0.015, 0.024), n=14, col=(1.0, 1.0, 0.96))


@tile("krzew_liscie", (512, 512), 0.56)
def t_shrub(b, rng):
    """Łukowate gałązki z drobnymi liśćmi (tawuła / irga) - karty krzewu zaczepione u podstawy."""
    branch_spray(b, rng, 17, (LEAVES_GREY, LEAVES_GREEN), (0.034, 0.052), 20)


@tile("grab_liscie", (512, 512), 0.5)
def t_hornbeam(b, rng):
    """Liście grabu (ząbkowane, ~5-7 cm) gęsto, jak strzyżona ściana żywopłotu."""
    leaf_cluster(b, rng, (LEAVES_HORNBEAM,), 560, 0.205, 0.205, (0.05, 0.07), face_cam=1.2, sat=0.72, val=0.72,
                 col=(0.92, 0.95, 0.85), twigs=False, square=True)


@tile("krzew_kwiaty", (512, 512), 0.56)
def t_shrub_flowers(b, rng):
    """Tawuła van Houtte'a: łukowate gałązki z liśćmi i baldaszkami białych kwiatów."""
    branch_spray(b, rng, 16, (LEAVES_GREY, LEAVES_GREEN), (0.03, 0.048), 17, flowers=40)


# --- Render --------------------------------------------------------------------------
def setup_scene():
    sc = bpy.context.scene
    for o in list(bpy.data.objects):  # domyślna scena (sześcian, lampa, kamera)
        bpy.data.objects.remove(o, do_unlink=True)
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 0
    sc.cycles.transmission_bounces = 0
    sc.cycles.transparent_max_bounces = 128
    sc.render.film_transparent = True
    sc.render.filter_size = 1.2
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    world = bpy.data.worlds.new("niebo")
    sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.9
    sun = bpy.data.lights.new("slonce", "SUN")
    sun.energy = 0.6 * math.pi  # irradiancja tak, by liść zwrócony w górę miał ~1,1 x albedo
    sun.angle = math.radians(45)
    so = bpy.data.objects.new("slonce", sun)
    so.rotation_euler = (math.radians(20), 0, 0)
    sc.collection.objects.link(so)
    return sc


def render(sc, name, fn, px, width_m, base_px=8, view="side"):
    for o in list(bpy.data.objects):
        if o.type != "LIGHT":
            bpy.data.objects.remove(o, do_unlink=True)
    rng = random.Random(sum(map(ord, name)) * 7919)
    XLIM[0] = width_m / 2 * 0.96
    ZLIM[0] = (px[1] - base_px - 4) * width_m / px[0] if view == "side" else 9.0
    CUR_VIEW[0] = VIEW if view == "side" else Vector((0, 0, -1))
    b = Builder()
    fn(b, rng)
    ob = b.build(name)
    W, H = px
    xs = [abs(v[0]) for v in b.v]
    zs = [v[2] for v in b.v]
    lim_x, lim_z = width_m / 2, H * width_m / W - base_px * width_m / W
    if max(xs) > lim_x * 0.985 or max(zs) > lim_z * 0.985:
        print("UWAGA %s: geometria poza kaflem (x %.3f / %.3f, z %.3f / %.3f)" % (name, max(xs), lim_x, max(zs), lim_z))
    mpp = width_m / W
    h_m = H * mpp
    cd = bpy.data.cameras.new("kamera")
    cd.type = "ORTHO"
    cd.ortho_scale = max(width_m, h_m)
    cd.clip_start, cd.clip_end = 0.1, 100
    cam = bpy.data.objects.new("kamera", cd)
    if view == "side":
        cam.location = (0, -20, h_m / 2 - base_px * mpp)
        cam.rotation_euler = (math.pi / 2, 0, 0)
    else:  # z góry: obraz X = świat X, obraz w górę = świat +Y, środek kafla = oś kępy
        cam.location = (0, 0, 20)
        cam.rotation_euler = (0, 0, 0)
        base_px = 0
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 100
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("KAFEL %s: %d czworokatow, %dx%d px, %.3f m/px" % (name, len(b.f), W, H, mpp))
    return {"px": [W, H], "m_per_px": mpp, "base_px": base_px, "widok": view}


def main():
    os.makedirs(OUT, exist_ok=True)
    sc = setup_scene()
    meta_path = os.path.join(OUT, "kafle.json")
    meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    for name, (fn, px, width_m, view) in TILES.items():
        if ONLY and name not in ONLY:
            continue
        meta[name] = render(sc, name, fn, px, width_m, view=view)
    json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1)


main()
