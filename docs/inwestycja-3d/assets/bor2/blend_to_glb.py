"""Eksport .blend -> .glb pod three.js (drei useGLTF(url, false, true)).

Uruchomienie:
    blender --background <plik.blend> --python blend_to_glb.py -- <wyjscie.glb> [opcje klucz=wartosc]

Opcje (domyślne w nawiasach):
    tekstury=1024   maks. bok tekstury w px (jak drzewa.glb)
    kamery=1        eksport kamer ze scen SketchUpa (punkty widokowe)
    scal=1          łączenie siatek: jeden obiekt na grupę najwyższego poziomu,
                    w środku podział na prymitywy wg materiału -> mało draw calli
    rozbij=a,b      grupy, które zamiast w jeden obiekt są dzielone na swoje dzieci
                    (np. rozbij=domki -> każdy dom osobno, do podświetlania/klikania)
    drobne=1500     przy rozbijaniu: dzieci z mniejszą liczbą trójkątów trafiają
                    razem do jednego obiektu "<grupa>__drobne"
    instancje=1     EXT_mesh_gpu_instancing (działa, gdy scal=0)
    kolekcja=NAZWA  eksport tylko tej kolekcji (np. DOM_1); kamery tylko te, które stoją
                    w obrysie eksportowanej geometrii
    pomin=a,b       pomiń obiekty o tych nazwach na dowolnym poziomie zagnieżdżenia
    budzet=0        docelowa liczba trójkątów w całym pliku (0 = bez upraszczania).
                    Budżet jest dzielony między unikalne siatki proporcjonalnie do
                    "widoczności" = przekątna obiektu x liczba wystąpień; siatki, które
                    mieszczą się w przydziale, zostają nietknięte (ściany, podłogi),
                    a najmocniej upraszczane są drobne, przesadnie gęste detale
                    (żarówki, książki, figurki). Decimate/Collapse. Pełna geometria
                    zostaje w .blend.
    min_tris=150    minimalna liczba trójkątów na wystąpienie przy upraszczaniu
    kompresja=1     kompresja meshopt; 0 = bez kompresji, gdy plik idzie dalej do
                    gltf-transform (wnetrza.ps1), żeby nie kwantyzować geometrii dwa razy

Wszystko dzieje się na kopii w pamięci - plik .blend nie jest zapisywany.
- pomija kolekcję NIE_EKSPORTUJ (materiały robocze: próbniki kolorów, podkłady DWG),
- usuwa puste znaczniki przekrojów SketchUpa,
- naprawia fałszywą przezroczystość: importer SKP podpina kanał alfa tekstury
  pod Alpha materiału także dla JPG bez alfy, przez co glTF dostaje alphaMode BLEND
  (w three.js: błędy sortowania i wolniejsze renderowanie),
- zmniejsza duże tekstury, eksportuje GLB: Y-up, meshopt, WebP.
Bez Draco - projekt ładuje modele z meshopt (src/components/explorer/three/furniture/core/models.tsx).
"""
import os
import sys
import time

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
dst = os.path.abspath(argv[0])
opts = dict(a.split("=", 1) for a in argv[1:] if "=" in a)
MAX_PX = int(opts.get("tekstury", 1024))
WITH_CAMERAS = opts.get("kamery", "1") != "0"
MERGE = opts.get("scal", "1") != "0"
SPLIT = {s for s in opts.get("rozbij", "").split(",") if s}
SMALL_TRIS = int(opts.get("drobne", 1500))
GPU_INSTANCES = opts.get("instancje", "1") != "0"
ONLY_COLLECTION = opts.get("kolekcja")
SKIP_NAMES = {s for s in opts.get("pomin", "").split(",") if s}
BUDGET = int(opts.get("budzet", 0))
MIN_TRIS = int(opts.get("min_tris", 150))
COMPRESS = opts.get("kompresja", "1") != "0"
SKIP_COLLECTION = "NIE_EKSPORTUJ"

scene = bpy.context.scene


def log(*a):
    print("GLB", *a)


# --- 1. Pominięcie kolekcji roboczej -------------------------------------------
skip = bpy.data.collections.get(SKIP_COLLECTION)
if skip is not None:
    names = [o.name for o in skip.all_objects]
    for ob in list(skip.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.collections.remove(skip)
    log("pominieto kolekcje %s: %s" % (SKIP_COLLECTION, names))

if ONLY_COLLECTION:
    keep = bpy.data.collections[ONLY_COLLECTION]
    kept = set(keep.all_objects)
    dropped = 0
    for ob in list(scene.objects):
        if ob.type != "CAMERA" and ob not in kept:
            bpy.data.objects.remove(ob, do_unlink=True)
            dropped += 1
    log("tylko kolekcja %s: %d obiektow, usunieto ze sceny %d" % (ONLY_COLLECTION, len(kept), dropped))

# Obiekty z listy "pomin" usuwamy z pliku w pamięci - znikają też ze wszystkich
# instancji kolekcji (działa przy scal=0 i scal=1).
if SKIP_NAMES:
    gone = [n for n in SKIP_NAMES if bpy.data.objects.get(n)]
    for n in gone:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    log("pominiete obiekty: %s" % gone)

# --- 2. Puste znaczniki przekrojów ---------------------------------------------
removed = 0
for ob in list(scene.objects):
    if ob.type == "EMPTY" and ob.get("skppy_section_plane") is not None and not ob.children and not ob.instance_collection:
        bpy.data.objects.remove(ob, do_unlink=True)
        removed += 1
log("usuniete znaczniki przekrojow:", removed)


# --- 3. Fałszywa przezroczystość ------------------------------------------------
def image_has_alpha(img):
    if img is None:
        return False
    if img.file_format in {"JPEG", "BMP"} or img.channels < 4:
        return False
    if img.alpha_mode == "NONE":
        return False
    try:  # PNG z kanałem alfa: sprawdzamy, czy alfa gdziekolwiek < 1
        px = img.pixels[:]
        return any(a < 0.999 for a in px[3::4])
    except Exception:
        return True


fixed = []
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        continue
    alpha = bsdf.inputs["Alpha"]
    for link in list(alpha.links):
        node = link.from_node
        if node.type == "TEX_IMAGE" and link.from_socket.name == "Alpha" and not image_has_alpha(node.image):
            mat.node_tree.links.remove(link)
            fixed.append(mat.name)
log("naprawiona falszywa przezroczystosc (%d): %s" % (len(fixed), fixed))


# --- 4. Łączenie siatek ---------------------------------------------------------
def mesh_parts(ob, world):
    """(obiekt_mesh, macierz_świata) dla obiektu, z rozwinięciem instancji kolekcji."""
    if ob.name in SKIP_NAMES:
        return
    if ob.type == "MESH" and ob.data and len(ob.data.polygons):
        yield ob, world
    coll = ob.instance_collection if ob.instance_type == "COLLECTION" else None
    if coll is not None:
        base = world @ Matrix.Translation(-coll.instance_offset)
        for child in coll.all_objects:
            yield from mesh_parts(child, base @ child.matrix_world)


_simplified = {}
_ratios = {}  # nazwa siatki -> współczynnik upraszczania (z budżetu)
_tri_stats = [0, 0]  # trójkąty w scenie (z wystąpieniami): przed, po


def mesh_tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def plan_budget(all_parts):
    """Dzieli budżet trójkątów między unikalne siatki (water-filling).

    Przydział siatki i = min(jej koszt, max(minimum, lambda * waga_i)),
    waga = przekątna x liczba wystąpień; lambda dobierana bisekcją tak,
    żeby suma przydziałów = budżet.
    """
    info = {}
    for src, mw in all_parts:
        me = src.data
        d = info.get(me.name)
        if d is None:
            bb = src.bound_box
            diag = (Vector(bb[6]) - Vector(bb[0])).length * max(abs(s) for s in mw.to_scale())
            d = info[me.name] = {"tris": mesh_tris(me), "n": 0, "diag": max(diag, 0.01)}
        d["n"] += 1
    total = sum(d["tris"] * d["n"] for d in info.values())
    if total <= BUDGET:
        log("budzet: %d trojkatow miesci sie w %d - bez upraszczania" % (total, BUDGET))
        return
    items = [(d["tris"] * d["n"], min(d["tris"], MIN_TRIS) * d["n"], d["diag"] * d["n"], name)
             for name, d in info.items()]

    def alloc(lam):
        return sum(min(c, max(f, lam * w)) for c, f, w, _ in items)

    lo, hi = 0.0, 1.0
    while alloc(hi) < BUDGET and hi < 1e12:
        hi *= 2
    for _ in range(60):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if alloc(mid) < BUDGET else (lo, mid)
    for c, f, w, name in items:
        a = min(c, max(f, hi * w))
        if a < c * 0.85:
            _ratios[name] = a / c
    log("budzet: %d -> cel %d trojkatow; upraszczanych siatek %d z %d" % (
        total, BUDGET, len(_ratios), len(items)))


def simplified(src):
    """Siatka do eksportu: oryginał albo uproszczona kopia (cache per siatka)."""
    me = src.data
    if me.name in _simplified:
        return _simplified[me.name]
    result = me
    ratio = _ratios.get(me.name)
    if ratio is not None:
        tmp = bpy.data.objects.new("_decimate", me.copy())
        scene.collection.objects.link(tmp)
        mod = tmp.modifiers.new("decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = max(ratio, 0.001)
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.update()
        ev = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())
        result = bpy.data.meshes.new_from_object(ev)
        tmp_mesh = tmp.data
        bpy.data.objects.remove(tmp, do_unlink=True)
        bpy.data.meshes.remove(tmp_mesh)
    _simplified[me.name] = result
    return result


def build_merged(name, parts, target_coll):
    """Kopiuje części (z ich materiałami) do jednego obiektu i łączy je."""
    temps = []
    for src, mw in parts:
        base = simplified(src)
        _tri_stats[0] += mesh_tris(src.data)
        _tri_stats[1] += mesh_tris(base)
        me = base.copy()
        me.transform(mw)
        if mw.determinant() < 0:
            me.flip_normals()
        tmp = bpy.data.objects.new(name, me)
        target_coll.objects.link(tmp)
        for i, slot in enumerate(src.material_slots):
            if i < len(tmp.material_slots) and slot.link == "OBJECT":
                tmp.material_slots[i].link = "OBJECT"
                tmp.material_slots[i].material = slot.material
        temps.append(tmp)
    if not temps:
        return None
    if len(temps) > 1:
        with bpy.context.temp_override(active_object=temps[0], selected_editable_objects=temps,
                                       selected_objects=temps, object=temps[0]):
            bpy.ops.object.join()
    merged = temps[0]
    merged.data.validate(verbose=False)
    return merged


def tri_count(parts):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o, _ in parts)


if MERGE:
    t = time.time()
    out_coll = bpy.data.collections.new("WEB")
    scene.collection.children.link(out_coll)
    tops = [o for o in scene.objects if o.parent is None and o.type in {"MESH", "EMPTY"}]
    units = []  # (nazwa, części)
    for top in tops:
        if top.name in SPLIT and top.instance_collection:
            coll = top.instance_collection
            base = top.matrix_world @ Matrix.Translation(-coll.instance_offset)
            small = []
            for child in coll.objects:
                if child.parent is not None:
                    continue
                parts = list(mesh_parts(child, base @ child.matrix_world))
                for c in child.children_recursive:
                    parts += list(mesh_parts(c, base @ c.matrix_world))
                if not parts:
                    continue
                if tri_count(parts) < SMALL_TRIS:
                    small += parts
                else:
                    units.append(("%s__%s" % (top.name, child.name), parts))
            if small:
                units.append(("%s__drobne" % top.name, small))
        else:
            parts = list(mesh_parts(top, top.matrix_world))
            for c in top.children_recursive:
                parts += list(mesh_parts(c, c.matrix_world))
            if parts:
                units.append((top.name, parts))
    if BUDGET > 0:
        plan_budget([part for _, parts in units for part in parts])
    built = [(n, build_merged(n, p, out_coll)) for n, p in units]
    merged = [m for _, m in built if m]
    # Usunięcie oryginałów ze sceny (kamery zostają), żeby nazwy scalonych
    # obiektów nie dostawały końcówek ".001".
    for ob in list(scene.collection.all_objects):
        if ob.type != "CAMERA" and ob not in merged:
            bpy.data.objects.remove(ob, do_unlink=True)
    for name, ob in built:
        if ob is not None:
            ob.name = name
            ob.data.name = name
    log("scalono %d czesci w %d obiektow w %.1fs: %s" % (
        sum(len(p) for _, p in units), len(merged), time.time() - t, [m.name for m in merged]))
    log("trojkaty w scenie (z wystapieniami): %d -> %d" % tuple(_tri_stats))

# Kamery: przy eksporcie jednej kolekcji zostają tylko te w obrysie jej geometrii.
if ONLY_COLLECTION:
    lo, hi = Vector((1e18,) * 3), Vector((-1e18,) * 3)
    for top in [o for o in scene.objects if o.parent is None and o.type != "CAMERA"]:
        for src, mw in mesh_parts(top, top.matrix_world):
            for c in src.bound_box:
                p = mw @ Vector(c)
                lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    kept_cams, margin = [], 2.0
    for cam in [o for o in scene.objects if o.type == "CAMERA"]:
        p = cam.matrix_world.translation
        if all(lo[i] - margin <= p[i] <= hi[i] + margin for i in range(3)):
            kept_cams.append(cam.name)
        else:
            bpy.data.objects.remove(cam, do_unlink=True)
    log("kamery w obrysie %s: %s" % (ONLY_COLLECTION, kept_cams))

# --- 5. Tekstury ----------------------------------------------------------------
scaled = []
for img in bpy.data.images:
    if img.source != "FILE" or not img.users:
        continue
    w, h = img.size
    if w and h and max(w, h) > MAX_PX:
        k = MAX_PX / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
        scaled.append("%s %dx%d->%dx%d" % (img.name, w, h, *img.size))
log("zmniejszone tekstury (%d)" % len(scaled))

# WebP nie przyjmuje obrazów w skali szarości (eksporter zapisuje je jako 1 kanał
# i gubi teksturę, a GLB odwołuje się wtedy do nieistniejącego obrazu).
# Rozpoznanie: mniej niż 3 kanały albo 8/16 bitów na piksel (szary / szary+alfa);
# Blender potrafi raportować channels=4 dla szarego JPG, liczy się depth.
import numpy as np  # noqa: E402  (numpy jest w Pythonie Blendera)

gray = []
for img in list(bpy.data.images):
    if img.source != "FILE" or not img.users or img.is_float:
        continue
    if img.channels >= 3 and img.depth not in (8, 16):
        continue
    w, h = img.size
    if not w or not h:
        continue
    ch = img.channels
    px = np.empty(w * h * ch, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, ch)
    rgba = np.ones((w * h, 4), dtype=np.float32)
    if ch >= 3:
        rgba[:, :ch] = px[:, :4]
    else:
        rgba[:, :3] = px[:, :1]
        if ch == 2:
            rgba[:, 3] = px[:, 1]
    has_alpha = ch in (2, 4) and bool((rgba[:, 3] < 0.999).any())
    rgb = bpy.data.images.new(img.name + "_rgb", w, h, alpha=has_alpha)
    rgb.colorspace_settings.name = img.colorspace_settings.name
    rgb.pixels.foreach_set(rgba.ravel())
    rgb.pack()
    img.user_remap(rgb)
    gray.append(img.name)
log("tekstury w skali szarosci zamienione na RGB (%d): %s" % (len(gray), gray))

# --- 6. Eksport -----------------------------------------------------------------
os.makedirs(os.path.dirname(dst), exist_ok=True)
t = time.time()
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_active_scene=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_cameras=WITH_CAMERAS,
    export_lights=False,
    export_extras=False,
    export_gpu_instances=GPU_INSTANCES and not MERGE,
    export_meshopt_compression_enable=COMPRESS,
    export_meshopt_extension="EXT_meshopt_compression",
    export_draco_mesh_compression_enable=False,
    export_animations=False,
)
log("zapisano %s (%.2f MB) w %.1fs" % (dst, os.path.getsize(dst) / 2**20, time.time() - t))
