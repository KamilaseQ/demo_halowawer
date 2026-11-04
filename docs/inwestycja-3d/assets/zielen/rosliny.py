"""Zestaw roślin z kart (alpha-test) na wspólnym atlasie -> rosliny.blend (źródło eksportu GLB).

Uruchomienie (z katalogu głównego projektu, tylko w tle):
    "D:\\Programy\\Blender\\blender.exe" --background --factory-startup --python \
        docs/inwestycja-3d/assets/zielen/rosliny.py
potem eksport (skrypt projektu, bez scalania, z atlasem 2048):
    "D:\\Programy\\Blender\\blender.exe" --background docs/inwestycja-3d/assets/zielen/rosliny.blend \
        --python docs/inwestycja-3d/assets/bor2/blend_to_glb.py -- docs/inwestycja-3d/assets/zielen/rosliny.glb \
        tekstury=2048 kamery=0 scal=0 instancje=0
(oba kroki robi buduj.ps1).

Każdy wariant = osobny obiekt TYP_n w punkcie (0,0,0), podstawa na z=0 (w glTF y=0), metry.
Jeden materiał "rosliny": atlas.webp (kolor + alfa, MASK 0,5, dwustronny) x kolor wierzchołków COLOR_0
(cień wnętrza kępy + odcień wariantu). Normalne własne: kopuła / kula / prostopadłościan wokół rośliny,
skierowane w górę i na zewnątrz - obie strony karty są oświetlone jak bryła rośliny, bez czarnych spodów.
"""
import json
import math
import os
import random

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ATLAS = json.load(open(os.path.join(HERE, "atlas.json"), encoding="utf-8"))
SIZE = ATLAS["size"]
UP = Vector((0, 0, 1))


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


class Plant:
    """Zbiera karty jednej rośliny (lub grupy roślin): wierzchołki, UV, normalne i cień na wierzchołek.
    `origin` = środek bieżącej kępy w grupie: normalne i cień liczone względem niego."""

    def __init__(self, name, normal_fn, ao_fn, tint=(1, 1, 1)):
        self.name, self.normal_fn, self.ao_fn, self.tint = name, normal_fn, ao_fn, tint
        self.v, self.uv, self.f, self.vn, self.ao = [], [], [], [], []
        self.origin = Vector((0, 0, 0))

    def grid(self, rows, uvs):
        """rows: lista rzędów (każdy: lista Vector), uvs: to samo dla UV; czworokąty między rzędami."""
        base = len(self.v)
        ncol = len(rows[0])
        for r, ur in zip(rows, uvs):
            for p in r:
                p = Vector((p.x, p.y, max(0.0, p.z)))  # nic poniżej gruntu
                q = p - self.origin
                self.v.append(p)
                self.vn.append(self.normal_fn(q))
                self.ao.append(self.ao_fn(q))
            self.uv += ur
        for i in range(len(rows) - 1):
            for j in range(ncol - 1):
                a = base + i * ncol + j
                self.f.append((a, a + 1, a + 1 + ncol, a + ncol))

    def tris(self):
        return 2 * len(self.f)

    def build(self, mat):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(p) for p in self.v], [], self.f)
        uvl = me.uv_layers.new(name="UVMap")
        col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        loop_vi = [0] * len(me.loops)
        me.loops.foreach_get("vertex_index", loop_vi)
        for li, vi in enumerate(loop_vi):
            uvl.data[li].uv = self.uv[vi]
            c = [max(0.0, min(1.0, t * self.ao[vi])) for t in self.tint]
            col.data[li].color = (c[0], c[1], c[2], 1.0)  # liniowe (Blender koduje do sRGB w bajtach)
        me.materials.append(mat)
        me.shade_smooth()
        me.normals_split_custom_set([self.vn[vi] for vi in loop_vi])
        me.update()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def tile_info(name):
    t = ATLAS["tiles"][name]
    mpp, base = t["m_per_px"], t["base_px"]
    cx0, cy0, cx1, cy1 = t["content"]
    cy1 = min(cy1, t["h"] - base)  # dół karty = linia gruntu
    return t, mpp, base, (cx0, cy0, cx1, cy1)


def card(plant, tile, scale=1.0, yaw=0.0, tilt=0.0, bend=0.0, offset=Vector((0, 0, 0)), radial=0.0, segs=3,
         cols=1, lift=0.0, roll=0.0, center_on=None, mirror=False, window=None):
    """Karta z kafla atlasu. Układ lokalny: X - w poprzek karty, Y - na zewnątrz (pochylenie), Z - w górę.
    tilt - pochylenie od pionu na zewnątrz (rad), bend - dodatkowe wygięcie do końca karty,
    yaw - obrót wokół pionu, radial - odsunięcie od osi w kierunku pochylenia,
    center_on - None: podstawa karty w punkcie zaczepienia (kępy); "middle": środek treści w punkcie (korony)."""
    t, mpp, base, (cx0, cy0, cx1, cy1) = tile_info(tile)
    if window:  # fragment kafla (u0, u1, v0, v1 jako ułamki obrysu) - różne karty pokazują różne liście
        u0, u1, v0, v1 = window
        cx0, cx1 = cx0 + (cx1 - cx0) * u0, cx0 + (cx1 - cx0) * u1
        cy0, cy1 = cy0 + (cy1 - cy0) * v0, cy0 + (cy1 - cy0) * v1
    W = t["w"]
    x0 = (cx0 - W / 2) * mpp * scale
    x1 = (cx1 - W / 2) * mpp * scale
    height = (t["h"] - base - cy0) * mpp * scale
    z_start = (t["h"] - base - cy1) * mpp * scale  # zwykle 0
    seg = (height - z_start) / segs
    # profil karty w płaszczyźnie YZ
    prof, ang = [], tilt
    y, z = math.sin(tilt) * z_start, math.cos(tilt) * z_start
    prof.append((y, z))
    for _ in range(segs):
        y += math.sin(ang) * seg
        z += math.cos(ang) * seg
        prof.append((y, z))
        ang += bend / segs
    shift = Vector((0, 0, 0))
    if center_on == "middle":
        mid = ((prof[0][0] + prof[-1][0]) / 2, (prof[0][1] + prof[-1][1]) / 2)
        shift = Vector(((x0 + x1) / 2, mid[0], mid[1]))
    rot = Matrix.Rotation(yaw, 3, "Z") @ Matrix.Rotation(roll, 3, "Y")
    radial_dir = Matrix.Rotation(yaw, 3, "Z") @ Vector((0, 1, 0))
    rows, uvs = [], []
    for k, (py, pz) in enumerate(prof):
        row, urow = [], []
        v_px = cy1 - (cy1 - cy0) * k / segs
        for j in range(cols + 1):
            px = x0 + (x1 - x0) * j / cols
            local = Vector((px, py, pz)) - shift
            row.append(rot @ local + radial_dir * radial + offset + Vector((0, 0, lift)))
            u_px = cx0 + (cx1 - cx0) * (cols - j if mirror else j) / cols
            urow.append(((t["x"] + u_px) / SIZE, 1 - (t["y"] + v_px) / SIZE))
        rows.append(row)
        uvs.append(urow)
    plant.grid(rows, uvs)


def top_card(plant, tile, scale=1.0, height=0.15, dome=0.07, yaw=0.0, offset=Vector((0, 0, 0))):
    """Pozioma, lekko wypukła karta z kafla widzianego z góry (środek kafla = oś kępy)."""
    t, mpp, base, (cx0, cy0, cx1, cy1) = tile_info(tile)
    rot = Matrix.Rotation(yaw, 3, "Z")
    hx = max(abs(cx0 - t["w"] / 2), abs(cx1 - t["w"] / 2))
    rows, uvs = [], []
    for j in range(3):
        row, urow = [], []
        v_px = cy1 - (cy1 - cy0) * j / 2
        for i in range(3):
            u_px = cx0 + (cx1 - cx0) * i / 2
            x = (u_px - t["w"] / 2) * mpp * scale
            y = -(v_px - t["h"] / 2) * mpp * scale
            r2 = min(1.0, (x * x + y * y) / (hx * mpp * scale) ** 2)
            row.append(rot @ Vector((x, y, height + dome * (1 - r2))) + offset)
            urow.append(((t["x"] + u_px) / SIZE, 1 - (t["y"] + v_px) / SIZE))
        rows.append(row)
        uvs.append(urow)
    plant.grid(rows, uvs)


# --- rodzaje brył (normalne i cień wnętrza) ----------------------------------------------
def dome(radius, up=1.15, out=0.75):
    def n(p):
        r = Vector((p.x, p.y, 0))
        k = min(1.0, r.length / max(radius, 1e-3))
        v = (r.normalized() * (out * k) if r.length > 1e-5 else Vector((0, 0, 0))) + UP * up
        return v.normalized()
    return n


def sphere(center, up=0.35):
    def n(p):
        d = p - center
        return (d.normalized() + UP * up).normalized() if d.length > 1e-5 else UP.copy()
    return n


def box(hx, hy, hz, x_weight=0.35):
    def n(p):
        q = Vector((p.x / hx, p.y / hy, max(0.0, (p.z - hz) / hz)))
        v = Vector((math.copysign(abs(q.x) ** 4, q.x) * x_weight, math.copysign(abs(q.y) ** 4, q.y),
                    q.z ** 4 + 0.2))
        return v.normalized()
    return n


def ao_height(h, lo=0.72):
    return lambda p: lo + (1 - lo) * smooth(0.0, 0.55 * h, p.z)


def ao_sphere(center, r, lo=0.62):
    def a(p):
        d = (p - center).length / r
        return lo + (1 - lo) * smooth(0.25, 0.95, d) * (0.75 + 0.25 * smooth(0.0, 0.5 * r, p.z))
    return a


# --- kępy traw i bylin -----------------------------------------------------------------
def tuft(plant, rng, tile, n_up, n_lean, scale=1.0, tilt=(0.35, 0.65), bend=(0.1, 0.35), radial=0.03, yaw0=None,
         segs=3, scale_var=0.12, up_tilt=0.08, at=None, yaw_jit=0.15, cols=1):
    """Kępa z kart: n_up kart prawie pionowych (skrzyżowanych) + n_lean kart pochylonych na zewnątrz.
    at - środek kępy w grupie (normalne liczone względem niego)."""
    at = Vector((0, 0, 0)) if at is None else at
    plant.origin = at
    yaw0 = rng.uniform(0, math.pi) if yaw0 is None else yaw0
    for i in range(n_up):
        card(plant, tile, scale * rng.uniform(1 - scale_var, 1 + scale_var * 0.5), yaw0 + i * math.pi / n_up +
             rng.uniform(-yaw_jit, yaw_jit), rng.uniform(-up_tilt, up_tilt), rng.uniform(-0.1, 0.1),
             at + Vector((rng.gauss(0, 0.012), rng.gauss(0, 0.012), 0)), segs=segs, cols=cols,
             mirror=rng.random() < 0.5)
    for i in range(n_lean):
        card(plant, tile, scale * rng.uniform(1 - scale_var, 1 + scale_var * 0.3),
             yaw0 + (i + 0.5) * 2 * math.pi / n_lean + rng.uniform(-yaw_jit - 0.05, yaw_jit + 0.05),
             rng.uniform(*tilt), rng.uniform(*bend), at, radial=radial * rng.uniform(0.6, 1.4) * scale, segs=segs,
             cols=cols, mirror=rng.random() < 0.5)


def fescue_tuft(plant, rng, at, scale=1.0, side="kepa_sina_a", stalks=False):
    """Kępa kostrzewy: 3 wachlarze pionowe + 6 pochylonych + wypukła karta z góry nad środkiem."""
    if stalks:  # kępa w kwiecie: wachlarze ze źdźbłami kwiatowymi zamiast pionowych
        tuft(plant, rng, "kepa_sina_c", 2, 0, scale=scale * 0.95, at=at, up_tilt=0.12)
        tuft(plant, rng, side, 4, 3, scale=scale, tilt=(0.1, 0.28), bend=(0.0, 0.15), at=at, up_tilt=0.16,
             scale_var=0.28, yaw_jit=0.25)
    else:
        tuft(plant, rng, side, 6, 3, scale=scale, tilt=(0.1, 0.28), bend=(0.0, 0.15), at=at, up_tilt=0.16,
             scale_var=0.28, yaw_jit=0.25)
    plant.origin = at
    top_card(plant, "kepa_sina_gora", scale * rng.uniform(0.85, 0.95), height=0.13 * scale, dome=0.07 * scale,
             yaw=rng.uniform(0, 6.28), offset=at)


def ring(rng, n, r, jitter=0.05):
    """n punktów na okręgu o promieniu r (losowy obrót, rozrzut)."""
    a0 = rng.uniform(0, 6.28)
    return [Vector((math.cos(a0 + i * 6.283 / n) * r + rng.gauss(0, jitter),
                    math.sin(a0 + i * 6.283 / n) * r + rng.gauss(0, jitter), 0)) for i in range(n)]


def fescue_group(name, seed, n, r, scales, side="kepa_sina_a", stalks=(), tint=(1, 1, 1)):
    rng = random.Random(seed)
    p = Plant(name, dome(0.3, 1.1, 0.8), ao_height(0.28, 0.6), tint)
    pts = ring(rng, n, r, 0.07) if n > 1 else [Vector((0, 0, 0))]
    for i, at in enumerate(pts):
        fescue_tuft(p, rng, at, scales[i % len(scales)], side, stalks=i in stalks)
    return p


def perennial(plant, rng, at, flower_tile, scale, n_up=3, n_lean=2, leaves=3, leaf_scale=0.7, tilt=(0.1, 0.3)):
    """Bylina: kwiatostany na kartach pionowych i lekko pochylonych + rozeta liści u podstawy."""
    tuft(plant, rng, flower_tile, n_up, n_lean, scale=scale, tilt=tilt, at=at)
    if leaves:
        tuft(plant, rng, "liscie_bylin", 0, leaves, scale=leaf_scale * scale, tilt=(0.35, 0.65), at=at)


def perennial_group(name, seed, members, h, tint=(1, 1, 1)):
    """members: [(kafel_kwiatów, skala, n_up, n_lean, liście)], ustawione w trójkąt / parę."""
    rng = random.Random(seed)
    p = Plant(name, dome(0.25, 1.2, 0.7), ao_height(h, 0.72), tint)
    n = len(members)
    pts = ring(rng, n, 0.17 if n == 2 else 0.2, 0.03) if n > 1 else [Vector((0, 0, 0))]
    for (tile, sc, n_up, n_lean, leaves), at in zip(members, pts):
        perennial(p, rng, at, tile, sc, n_up, n_lean, leaves)
    return p


def make_tuft(name, rng, parts, h, radius, tint=(1, 1, 1), ao_lo=0.72, up=1.15, out=0.75):
    p = Plant(name, dome(radius, up, out), ao_height(h, ao_lo), tint)
    for args, kw in parts:
        tuft(p, rng, *args, **kw)
    return p


# --- korona krzewu i moduł żywopłotu ------------------------------------------------------
def crown(name, rng, tiles, rx, rz, n_shell, n_inner, card_scale=0.62, tint=(1, 1, 1)):
    center = Vector((0, 0, rz + 0.04))
    p = Plant(name, sphere(center), ao_sphere(center, max(rx, rz)), tint)
    golden = math.pi * (3 - math.sqrt(5))
    pts = []
    for i in range(n_shell):
        zf = 1 - 2 * (i + 0.5) / n_shell
        if zf < -0.7:  # bez spodu korony
            continue
        rr = math.sqrt(max(0.0, 1 - zf * zf))
        a = i * golden
        pts.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zf)))
    for k, d in enumerate(pts):
        pos = center + Vector((d.x * rx, d.y * rx, d.z * rz)) * rng.uniform(0.66, 0.9)
        nrm = (d + Vector((rng.gauss(0, 0.4), rng.gauss(0, 0.4), rng.gauss(0, 0.4)))).normalized()
        # karta prostopadła do nrm: yaw/tilt z kierunku normalnej (karta "patrzy" na zewnątrz)
        yaw = math.atan2(nrm.y, nrm.x) - math.pi / 2
        tilt = math.acos(max(-1.0, min(1.0, nrm.z))) - math.pi / 2
        card(p, tiles[k % len(tiles)], card_scale * rng.uniform(0.85, 1.15), yaw, tilt, rng.uniform(-0.3, 0.3),
             pos, segs=2, cols=2, roll=rng.uniform(-0.8, 0.8), center_on="middle")
    for k in range(n_inner):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) * 0.7)).normalized()
        pos = center + Vector((d.x * rx, d.y * rx, d.z * rz)) * rng.uniform(0.2, 0.5)
        card(p, tiles[k % len(tiles)], card_scale * rng.uniform(1.0, 1.25), rng.uniform(0, 6.28),
             rng.uniform(-0.6, 0.6), 0.0, pos, segs=1, cols=1, roll=rng.uniform(-0.8, 0.8), center_on="middle")
    return p


def shrub(name, rng, tiles, size=1.0, tint=(1, 1, 1)):
    """Luźny krzew liściasty: łukowate gałęzie z ziemi (karty zaczepione u podstawy, pochylone na zewnątrz)
    + kilka kart liści we wnętrzu; nieregularny obrys ~1 m."""
    center = Vector((0, 0, 0.45 * size))
    p = Plant(name, sphere(center, 0.45), lambda q: 0.55 + 0.45 * smooth(0.0, 0.55 * size, q.z), tint)
    k = 2.3 * size
    yaw0 = rng.uniform(0, 6.28)
    for i in range(4):  # środek: gałęzie prawie pionowe
        card(p, tiles[i % len(tiles)], k * rng.uniform(0.8, 1.05), yaw0 + i * math.pi / 4 + rng.uniform(-0.3, 0.3),
             rng.uniform(-0.15, 0.15), rng.uniform(-0.1, 0.2), Vector((rng.gauss(0, 0.04), rng.gauss(0, 0.04), 0)),
             segs=3, cols=2, mirror=rng.random() < 0.5)
    for i in range(8):  # obwód: gałęzie pochylone, różnej długości
        card(p, tiles[(i + 1) % len(tiles)], k * rng.uniform(0.6, 0.85),
             yaw0 + i * math.pi / 4 + rng.uniform(-0.35, 0.35), rng.uniform(0.15, 0.45), rng.uniform(0.0, 0.25),
             Vector((0, 0, 0)), radial=0.04 * size, segs=3, cols=2, mirror=rng.random() < 0.5)
    for i in range(6):  # wnętrze: liście z kafla grabu (bez prześwitu przez środek)
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), 0)).normalized() * rng.uniform(0.05, 0.22) * size
        card(p, "grab_liscie", 0.7 * size, rng.uniform(0, 6.28), rng.uniform(-0.5, 0.5), 0.0,
             d + Vector((0, 0, rng.uniform(0.3, 0.6) * size)), segs=1, roll=rng.uniform(-3, 3), center_on="middle")
    return p


def lobed(name, rng, tint=(1, 1, 1)):
    """Krzew o nieregularnym obrysie: 3 nierówne płaty kart liści grabu + gałęzie z ziemi."""
    center = Vector((0, 0, 0.5))
    p = Plant(name, sphere(center, 0.4), ao_sphere(center, 0.55, 0.58), tint)
    for _ in range(3):
        a = rng.uniform(0, 6.28)
        c = Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, rng.uniform(0.42, 0.62)))
        r = rng.uniform(0.27, 0.36)
        for k in range(16):
            d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) * 0.8)).normalized()
            pos = c + d * r * rng.uniform(0.55, 0.95)
            nrm = (d + Vector((rng.gauss(0, 0.4), rng.gauss(0, 0.4), rng.gauss(0, 0.4)))).normalized()
            card(p, "grab_liscie", 0.55 * rng.uniform(0.85, 1.15), math.atan2(nrm.y, nrm.x) - math.pi / 2,
                 math.acos(max(-1.0, min(1.0, nrm.z))) - math.pi / 2, rng.uniform(-0.3, 0.3), pos, segs=2, cols=2,
                 roll=rng.uniform(-3, 3), center_on="middle", mirror=rng.random() < 0.5)
    for i in range(5):
        card(p, "krzew_liscie", 1.8 * rng.uniform(0.75, 1.0), rng.uniform(0, 6.28), rng.uniform(0.1, 0.4),
             rng.uniform(0.0, 0.3), Vector((0, 0, 0)), radial=0.06, segs=3, cols=2, mirror=rng.random() < 0.5)
    return p


def hedge(name, rng, tile, length=1.0, depth=0.6, height=1.2, tint=(1, 1, 1), card_scale=1.0):
    """Moduł strzyżonego żywopłotu: dwie warstwy kart na każdej ścianie, wierzch, końce i wnętrze.
    Karty (kafel grabu ~0,45 m, zaokrąglony kwadrat) obracane co 90°: zaokrąglone rogi chowają się pod
    sąsiednimi kartami, a lustro i obrót dają różny układ liści. Karty wystają ~0,1 m poza +-0,5 m długości -
    sąsiednie moduły co 1 m zachodzą na siebie."""
    hx, hy = length / 2, depth / 2
    p = Plant(name, box(hx, hy, height / 2), lambda q: 0.7 + 0.3 * smooth(0.0, 0.45, q.z) *
              (0.8 + 0.2 * smooth(0.0, hy, abs(q.y))), tint)

    def j(a=0.04):
        return rng.uniform(-a, a)

    def roll():
        return rng.randint(0, 3) * math.pi / 2 + j(0.08)

    def face(pos, yaw, tilt, sc, rolled=True):
        card(p, tile, card_scale * sc * rng.uniform(0.95, 1.08), yaw + j(0.06), tilt + j(0.06), 0.0, pos, segs=1,
             cols=1, roll=roll() if rolled else 0.0, center_on="middle", mirror=rng.random() < 0.5)

    for side in (-1, 1):
        yaw = 0.0 if side > 0 else math.pi  # lokalne +Y karty = na zewnątrz
        for x in (-0.36, -0.12, 0.12, 0.36):  # warstwa zewnętrzna
            for z in (0.2, 0.45, 0.7, 0.95):
                face(Vector((x + j(0.03), side * (hy - 0.04) + j(0.03), z + j(0.03))), yaw, 0.0, 1.0)
        for x in (-0.24, 0.0, 0.24):  # warstwa wewnętrzna (wypełnia szczeliny między kartami)
            for z in (0.32, 0.58, 0.84):
                face(Vector((x + j(0.03), side * (hy - 0.13), z + j(0.03))), yaw, 0.0, 1.05)
    for x in (-0.36, -0.12, 0.12, 0.36):  # wierzch: karty poziome
        for yy in (-0.14, 0.14):
            face(Vector((x + j(0.03), yy + j(0.03), height - 0.06 + j(0.015))), rng.randint(0, 3) * math.pi / 2,
                 -math.pi / 2, 1.0, rolled=False)  # obrót wokół własnej osi postawiłby kartę pionowo
    for end in (-1, 1):  # końce (widoczne tylko na początku i końcu szpaleru)
        for z in (0.3, 0.65, 0.98):
            face(Vector((end * (hx - 0.03), j(0.05), z + j())), -end * math.pi / 2, 0.0, 1.0)
    for x in (-0.3, 0.0, 0.3):  # wnętrze: zasłania prześwity
        for z in (0.45, 0.85):
            card(p, tile, card_scale * 0.9, rng.uniform(0, 6.28), j(0.3), 0.0, Vector((x + j(), j(0.05), z)), segs=1,
                 roll=roll(), center_on="middle")
    return p


# --- warianty ------------------------------------------------------------------------------
def variants():
    R = lambda s: random.Random(s)  # noqa: E731
    out = []
    # TRAWA_NISKA: kostrzewa sina ~30 cm (Festuca glauca), grupy 2-3 kęp na znacznik (~0,9 m średnicy)
    out.append(fescue_group("TRAWA_NISKA_1", 11, 3, 0.22, (1.0, 0.85, 0.95)))
    out.append(fescue_group("TRAWA_NISKA_2", 12, 2, 0.18, (1.08, 0.92), tint=(0.95, 1.0, 0.92)))
    out.append(fescue_group("TRAWA_NISKA_3", 13, 3, 0.21, (1.0, 0.85, 0.9), stalks=(0,), tint=(1.0, 0.99, 0.97)))
    # TRAWA_WYSOKA: trzcinnik 'Karl Foerster' ~1 m, rozplenica ~0,85 m
    out.append(make_tuft("TRAWA_WYSOKA_1", R(21), [(("trawa_wys_a", 3, 5), dict(tilt=(0.08, 0.22), bend=(0.0, 0.15), segs=4,
                                                                               radial=0.02))], 1.0, 0.3))
    out.append(make_tuft("TRAWA_WYSOKA_2", R(22), [(("trawa_wys_b", 3, 6), dict(tilt=(0.12, 0.3), bend=(0.05, 0.25), segs=4,
                                                                               radial=0.03))], 0.9, 0.35,
                         tint=(1.0, 0.98, 0.95)))
    out.append(make_tuft("TRAWA_WYSOKA_3", R(23), [(("trawa_wys_a", 2, 3), dict(scale=0.85, tilt=(0.1, 0.25), segs=4)),
                                                   (("trawa_wys_b", 1, 3), dict(scale=0.85, tilt=(0.15, 0.3), segs=4))],
                         0.9, 0.32, tint=(0.97, 0.98, 0.95)))
    # BYLINA_*: grupy 2-3 roślin (jak sadzi się byliny na rabacie), ~0,7-0,9 m średnicy
    out.append(perennial_group("BYLINA_BIALA_1", 31, [("bylina_biala_a", 0.85, 3, 2, 3), ("bylina_biala_a", 0.75, 2, 2, 3)], 0.5))
    out.append(perennial_group("BYLINA_BIALA_2", 32, [("bylina_biala_a", 0.75, 3, 2, 3), ("bylina_biala_a", 0.68, 2, 2, 3),
                                                      ("bylina_biala_a", 0.6, 2, 1, 2)], 0.45, tint=(0.98, 0.98, 0.96)))
    out.append(perennial_group("BYLINA_BIALA_3", 33, [("bylina_biala_a", 0.78, 2, 2, 3), ("bylina_fiolet_b", 0.7, 2, 2, 0),
                                                      ("bylina_biala_a", 0.62, 2, 1, 2)], 0.45))
    # BYLINA_ZOLTA (od v2): krwawnik 'Moonshine', rudbekia - żółte byliny z visualization-1
    out.append(perennial_group("BYLINA_ZOLTA_1", 81, [("bylina_zolta_a", 0.8, 3, 2, 2), ("bylina_zolta_a", 0.7, 2, 2, 2),
                                                      ("bylina_zolta_a", 0.62, 2, 1, 2)], 0.48))
    out.append(perennial_group("BYLINA_ZOLTA_2", 82, [("bylina_zolta_b", 0.85, 3, 2, 3), ("bylina_zolta_b", 0.72, 2, 2, 3)], 0.55,
                               tint=(0.98, 0.97, 0.95)))
    out.append(perennial_group("BYLINA_ZOLTA_3", 83, [("bylina_zolta_b", 0.78, 2, 2, 3), ("bylina_zolta_a", 0.7, 2, 2, 2),
                                                      ("bylina_zolta_b", 0.62, 2, 1, 2)], 0.5))
    # PODSZYT (od v2): niska trawa łąkowa 0,2-0,35 m pod i między kępami - pas zwiera się w łąkę
    # PODSZYT: wiele kart pod losowymi kątami i pochyleniami, ciemna podstawa (bez krzyża "X" z bliska)
    def meadow_patch(name, seed, parts, tint=(1, 1, 1)):
        rng = random.Random(seed)
        p = Plant(name, dome(0.35, 1.4, 0.75), ao_height(0.26, 0.55), tint)
        for tile, n_up, n_lean, sc, at in parts:
            tuft(p, rng, tile, n_up, n_lean, scale=sc, tilt=(0.15, 0.7), bend=(0.05, 0.35), segs=2, up_tilt=0.3,
                 scale_var=0.3, yaw_jit=0.5, radial=0.05, at=at)
        return p
    out.append(meadow_patch("PODSZYT_1", 91, [("podszyt_a", 3, 5, 1.0, Vector((0, 0, 0)))]))
    out.append(meadow_patch("PODSZYT_2", 92, [("podszyt_b", 3, 4, 1.0, Vector((0.08, 0.05, 0))),
                                              ("podszyt_a", 2, 3, 0.8, Vector((-0.1, -0.06, 0)))], (1.0, 0.98, 0.94)))
    out.append(meadow_patch("PODSZYT_3", 93, [("podszyt_b", 3, 3, 1.0, Vector((0.14, 0.03, 0))),
                                              ("podszyt_b", 3, 3, 0.9, Vector((-0.14, -0.04, 0)))], (0.97, 0.98, 0.93)))
    out.append(perennial_group("BYLINA_FIOLET_1", 41, [("bylina_fiolet_a", 0.85, 3, 2, 3), ("bylina_fiolet_a", 0.75, 2, 2, 3),
                                                       ("bylina_fiolet_a", 0.7, 2, 1, 2)], 0.45))
    out.append(perennial_group("BYLINA_FIOLET_2", 42, [("bylina_fiolet_b", 0.9, 3, 3, 0), ("bylina_fiolet_b", 0.8, 2, 3, 0)],
                               0.36, tint=(0.98, 0.98, 1.0)))
    out.append(perennial_group("BYLINA_FIOLET_3", 43, [("bylina_fiolet_a", 0.75, 2, 2, 3), ("bylina_fiolet_b", 0.8, 2, 3, 0),
                                                       ("bylina_fiolet_a", 0.65, 2, 1, 2)], 0.4))
    out.append(perennial_group("BYLINA_ROZ_1", 51, [("bylina_roz", 0.9, 3, 2, 3), ("bylina_roz", 0.8, 2, 2, 3)], 0.68))
    out.append(perennial_group("BYLINA_ROZ_2", 52, [("bylina_roz", 0.8, 2, 2, 3), ("bylina_roz", 0.7, 2, 2, 3),
                                                    ("bylina_roz", 0.65, 2, 1, 2)], 0.6, tint=(0.97, 0.97, 0.97)))
    out.append(perennial_group("BYLINA_ROZ_3", 53, [("bylina_roz", 0.8, 2, 2, 3), ("bylina_fiolet_b", 0.75, 2, 3, 0),
                                                    ("bylina_roz", 0.65, 2, 1, 2)], 0.55))
    # KRZEW: kulisty ~1 m (tawuła / irga), grab, kwitnący na biało
    out.append(shrub("KRZEW_1", R(61), ["krzew_liscie"], 1.0))
    out.append(lobed("KRZEW_2", R(62), tint=(0.95, 0.97, 0.93)))
    out.append(shrub("KRZEW_3", R(63), ["krzew_kwiaty", "krzew_liscie"], 1.1))
    # ZYWOPLOT: moduł 1 m x 0,6 m x 1,2 m - grab (2 ułożenia) i ligustr
    out.append(hedge("ZYWOPLOT_1", R(71), "grab_liscie"))
    out.append(hedge("ZYWOPLOT_2", R(72), "grab_liscie", tint=(0.96, 0.98, 0.94)))
    out.append(hedge("ZYWOPLOT_3", R(73), "grab_liscie", tint=(0.8, 0.86, 0.78), card_scale=0.9))
    return out


def material():
    m = bpy.data.materials.new("rosliny")
    m.use_nodes = True
    m.use_backface_culling = False
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    img = bpy.data.images.load(os.path.join(HERE, "atlas.webp"))
    img.filepath = "//atlas.webp"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mixn = nt.nodes.new("ShaderNodeMix")
    mixn.data_type = "RGBA"
    mixn.blend_type = "MULTIPLY"
    mixn.inputs["Factor"].default_value = 1.0
    a_in = next(s for s in mixn.inputs if s.name == "A" and s.type == "RGBA")
    b_in = next(s for s in mixn.inputs if s.name == "B" and s.type == "RGBA")
    res = next(s for s in mixn.outputs if s.name == "Result" and s.type == "RGBA")
    rnd = nt.nodes.new("ShaderNodeMath")
    rnd.operation = "ROUND"
    L = nt.links.new
    L(tex.outputs["Color"], a_in)
    L(vc.outputs["Color"], b_in)
    L(res, bsdf.inputs["Base Color"])
    L(tex.outputs["Alpha"], rnd.inputs[0])
    L(rnd.outputs[0], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    for name in ("Specular IOR Level", "Specular"):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = 0.3
            break
    return m


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    mat = material()
    stats = {}
    for p in variants():
        ob = p.build(mat)
        zs = [v.z for v in p.v]
        xs = [math.hypot(v.x, v.y) for v in p.v]
        stats[p.name] = {"trojkaty": p.tris(), "wysokosc_m": round(max(zs), 2), "promien_m": round(max(xs), 2),
                         "min_z": round(min(zs), 3)}
        print("ROSLINA %-16s %4d trojkatow, wys. %.2f m, promien %.2f m, min z %.3f" % (
            p.name, p.tris(), max(zs), max(xs), min(zs)))
    out = os.path.join(HERE, "rosliny.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out, relative_remap=True, compress=True)
    json.dump(stats, open(os.path.join(HERE, "rosliny-statystyki.json"), "w", encoding="utf-8"), indent=1)


main()
