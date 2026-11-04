"""Eksport zewnętrza BOR2 do GLB według kontraktu z 55 (src/components/explorer).

    blender --background bor2-zewnetrze-wyglad.blend --python wyglad_eksport.py -- <wyjscie.glb> [tekstury=1024]

Węzły najwyższego poziomu (układ SketchUpa -> glTF: X = wschód, Y = góra, Z = południe, metry, bez centrowania):
    DOM_A … DOM_G   cała bryła domu (ściany, dach, okna, drzwi, brama, taras, pompa ciepła), scalona po materiale
    KONTEKST        sąsiednie budynki, jeden szary materiał "KONTEKST" (duchy)
    ZIEMIA          teren, drogi, kostka, podjazdy, geokrata (55 i tak podmienia shaderami gruntu)
    ZIELEN          drzewa ze SketchUpa
    OGRODZENIA      płoty panelowe, murki, śmietniki, skrzynki, latarnie (kolizje spaceru)
    PKT_*           kamery na wysokości oczu (punkty spaceru), WIDOK_* kamery z góry

Klasyfikacja per ściana: (ścieżka instancji w hierarchii SKP, materiał). Plik .blend nie jest zapisywany.
Mapowanie domów zweryfikowane z PZT i houses.json (b6, docs/inwestycja-3d/05-odbior-bor2.md).
"""
import os
import re
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DST = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(bpy.data.filepath), "bor2-zewnetrze.glb")
OPTS = dict(a.split("=", 1) for a in argv[1:] if "=" in a)
MAX_PX = int(OPTS.get("tekstury", 1024))
# meshopt w eksporterze Blendera zapisuje pozycje stratnie (filtr z ok. 10-bitową mantysą: przy x 64–128 m
# krok 1/16 m = do ±3 cm -> szczeliny i z-fighting w architekturze). Domyślnie bez meshopt: float32.
MESHOPT = OPTS.get("meshopt", "0") == "1"

scene = bpy.context.scene

HOUSES = {  # komponent SKP -> węzeł
    "Component#88": "DOM_A",
    "Component#57": "DOM_B",
    "Component#119": "DOM_C",
    "Component#94": "DOM_D",
    "Component#35": "DOM_E",
    "Component#39": "DOM_F",
    "Component#40": "DOM_G",
}
# obrys W–E brył (x, m), z depsgraphu
HOUSE_X = {
    "DOM_G": (33.4, 40.9), "DOM_F": (40.9, 48.4), "DOM_E": (48.5, 56.0),
    "DOM_D": (65.6, 73.8), "DOM_C": (73.8, 82.0), "DOM_B": (91.6, 99.8), "DOM_A": (99.8, 108.0),
}
KONTEKST_TOP = re.compile(r"^(Component#7(\.\d+)?|Group#3|Group#4|Group#5|Group#19)$")
ZIELEN_TOP = {"Group#65"}
DROP_TOP = {"Group#2"}          # prostokąt łąki 130x110 m: 55 ma własny grunt
ZIEMIA_MATS = {"OTOCZENIE 1", "DROGA WEWNĘTRZNA", "ASFALT", "GEOKRATA BETONOWA",
               "[Asphalt Stamped Brick]1", "SKP Default"}
OGRODZENIE_MATS = {"[Translucent Glass Gray]"}
GROUP_ORDER = ["DOM_A", "DOM_B", "DOM_C", "DOM_D", "DOM_E", "DOM_F", "DOM_G",
               "TARASY", "ZIEMIA", "ZIELEN", "OGRODZENIA",
               "OGRODZENIA_GEO", "OGRODZENIA_PANEL", "OGRODZENIE_KOLIZJA"]   # + KONTEKST_1..n (po jednym na budynek)
TARAS = re.compile(r"^Component#(92|100)(\.\d+)?$")      # tarasy z desek/płyt w komponentach domów
SKIP_COLLECTIONS = {"NIE_EKSPORTUJ", "WYGLAD_RENDER", "ZIELEN_ZNACZNIKI"}
MARKERS = "ZIELEN_ZNACZNIKI"   # puste węzły roślin (wyglad_zielen.py) -> węzeł ZIELEN_ZNACZNIKI


def log(*a):
    print("EKSPORT", *a)


# --- 1. liście: (obiekt mesh, macierz świata, ścieżka nazw instancji) ---------------------------
def leaves(ob, world, path):
    if ob.type == "MESH" and ob.data and len(ob.data.polygons):
        yield ob, world, path
    coll = ob.instance_collection if ob.instance_type == "COLLECTION" else None
    if coll is not None:
        base = world @ Matrix.Translation(-coll.instance_offset)
        for child in coll.all_objects:
            yield from leaves(child, base @ child.matrix_world, path + (child.name,))


skip_objs = set()
for cn in SKIP_COLLECTIONS:
    c = bpy.data.collections.get(cn)
    if c:
        skip_objs |= set(c.all_objects)

tops = [o for o in scene.objects
        if o.parent is None and o.type in {"MESH", "EMPTY"} and o not in skip_objs]
all_leaves = []
for top in tops:
    for ob, mw, path in leaves(top, top.matrix_world, (top.name,)):
        all_leaves.append((ob, mw, path))
log("liscie", len(all_leaves))
KONTEKST_IDS = {}
for top in tops:
    if KONTEKST_TOP.match(top.name):
        KONTEKST_IDS[top.name] = "KONTEKST_%d" % (len(KONTEKST_IDS) + 1)
GROUP_ORDER += list(KONTEKST_IDS.values())
log("kontekst", KONTEKST_IDS)


def center_x(ob, mw):
    cs = [mw @ Vector(c) for c in ob.bound_box]
    return sum(c.x for c in cs) / 8


def house_by_x(x, margin=3.0):
    best = None
    for h, (x0, x1) in HOUSE_X.items():
        if x0 - margin <= x <= x1 + margin:
            d = abs(x - (x0 + x1) / 2)
            if best is None or d < best[0]:
                best = (d, h)
    return best[1] if best else None


def classify(path, mat_name, ob, mw):
    top = path[0]
    if top in DROP_TOP:
        return None
    if top.startswith("KINKIET_"):
        return "DOM_" + top[-1]         # kinkiety przy wejściach (renderowe detale) należą do domu
    if top == "PLOT_PRETY":
        return "OGRODZENIA_GEO"         # D-015: pręty z geometrii (z bliska, do ~8 m)
    if top == "OGRODZENIE_PANEL_LOD":
        return "OGRODZENIA_PANEL"       # D-015: te same przęsła jako płyta z teksturą prętów (z daleka)
    if top == "OGRODZENIE_KOLIZJA":
        return "OGRODZENIE_KOLIZJA"     # niewidoczna: 1 płyta na przęsło do kolizji spaceru (55)
    if KONTEKST_TOP.match(top):
        return KONTEKST_IDS[top]
    if top in ZIELEN_TOP:
        return "ZIELEN"
    if mat_name in OGRODZENIE_MATS:
        return "OGRODZENIA"
    if mat_name in ZIEMIA_MATS:
        return "ZIEMIA"
    if top == "podłoże":
        return "OGRODZENIA" if len(path) > 1 else "ZIEMIA"
    if top == "domki" and len(path) > 1:
        sub = path[1]
        if any(p.startswith("lampa") for p in path):
            return "OGRODZENIA"
        if any(TARAS.match(p) for p in path):
            return "TARASY"
        if sub in HOUSES:
            h = HOUSES[sub]
            x0, x1 = HOUSE_X[h]
            cx = center_x(ob, mw)
            if x0 - 6 <= cx <= x1 + 6:
                return h
            return "OGRODZENIA"
        return "OGRODZENIA"          # pompy ciepła, skrzynki, śmietniki, murki
    return "OGRODZENIA"


# --- 1b. role materiałów per dom (wyglad_materialy.py: ROLE_COLORS -> materiały '<dom>_<ROLA>') ----------
FACADE = {"TYNK A", "TYNK B", "TYNK C"}
ACCENT = {"TYNK A2", "TYNK B2", "TYNK C2"}
FRAMES = {"OKNA A", "OKNA B", "OKNA C"}


def role_of(h, mat, leaf_mats, ob, mw):
    if mat in ACCENT:
        return "OSCIEZE" if "SZYBY1" in leaf_mats else "WNEKA"
    if mat in FRAMES:
        zs = [(mw @ Vector(c)).z for c in ob.bound_box]
        if min(zs) > 8.0:
            return "DACH"                      # nasady kominowe / wywiewki
        if "SZYBY1" in leaf_mats:
            return "RAMA"
        if leaf_mats & FACADE:                 # płaszczyzny w bryle: brama garażowa (A–D) albo wnęka (E–G)
            return "BRAMA" if h in "ABCD" else "WNEKA"
        return "DRZWI" if max(zs) - min(zs) > 1.8 else "RAMA"   # drzwi albo parapet
    if mat.startswith("BLACHA"):
        return "DACH"
    if mat == "Obróbki":
        return "OBROBKA"
    return None


def role_material(g, m, leaf_mats, ob, mw):
    if m is None or not g.startswith("DOM_"):
        return m
    h = g[-1]
    r = role_of(h, m.name, leaf_mats, ob, mw)
    return bpy.data.materials.get("%s_%s" % (h, r)) if r and bpy.data.materials.get("%s_%s" % (h, r)) else m


# --- 2. podział ścian na grupy, kopiowanie w układzie świata ------------------------------------
out_coll = bpy.data.collections.new("WEB")
scene.collection.children.link(out_coll)
pieces = {g: [] for g in GROUP_ORDER}
stats = {g: 0 for g in GROUP_ORDER}
pieces[None] = []
odd = []
for ob, mw, path in all_leaves:
    me = ob.data
    slot_mats = [s.material for s in ob.material_slots]
    groups_per_slot = [classify(path, m.name if m else "", ob, mw) for m in slot_mats] or \
        [classify(path, "", ob, mw)]
    wanted = set(groups_per_slot) - {None}
    for g in wanted:
        me2 = me.copy()
        me2.transform(mw)
        if mw.determinant() < 0:
            me2.flip_normals()
        if len(wanted) > 1:
            bm = bmesh.new()
            bm.from_mesh(me2)
            kill = [f for f in bm.faces
                    if groups_per_slot[min(f.material_index, len(groups_per_slot) - 1)] != g]
            bmesh.ops.delete(bm, geom=kill, context="FACES")
            bm.to_mesh(me2)
            bm.free()
        if not len(me2.polygons):
            bpy.data.meshes.remove(me2)
            continue
        tmp = bpy.data.objects.new(g, me2)
        out_coll.objects.link(tmp)
        leaf_mats = {x.name for x in slot_mats if x}
        for i, m in enumerate(slot_mats):
            if i < len(tmp.material_slots):
                tmp.material_slots[i].link = "OBJECT"
                tmp.material_slots[i].material = role_material(g, m, leaf_mats, ob, mw)
        pieces[g].append(tmp)
        stats[g] += sum(len(p.vertices) - 2 for p in me2.polygons)
        if g == "OGRODZENIA" and len(path) > 1 and path[1] in HOUSES:
            odd.append("/".join(path))
log("trojkaty per grupa", stats)
if odd:
    log("z komponentow domow do OGRODZENIA (poza obrysem domu):", sorted(set(odd))[:20])


# --- 3. łączenie per grupa ---------------------------------------------------------------------
def kontekst_mat():
    m = bpy.data.materials.get("KONTEKST") or bpy.data.materials.new("KONTEKST")
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    c = [int("c9c9c6"[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    b.inputs["Base Color"].default_value = tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
                                                 for x in c) + (1,)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Metallic"].default_value = 0.0
    return m


def terrace_slabs(objs):
    """Tarasy w SKP to 20 desek ze szczelinami -> na vis-1 są to płyty: jedna płyta na dom (obrys desek)."""
    clusters = {}
    for o in objs:
        xs = [v.co.x for v in o.data.vertices]
        cx = (min(xs) + max(xs)) / 2
        h = next((k for k, (x0, x1) in HOUSE_X.items() if x0 - 1 <= cx <= x1 + 1), "?")
        clusters.setdefault(h, []).append(o)
    mat = next((s_.material for o in objs for s_ in o.material_slots if s_.material), None)
    out = []
    for h, os_ in clusters.items():
        vs = [v.co for o in os_ for v in o.data.vertices]
        lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        bm = bmesh.new()
        c = [bm.verts.new((x, y, z)) for z in (lo.z, hi.z) for y in (lo.y, hi.y) for x in (lo.x, hi.x)]
        for f in ((4, 5, 7, 6), (0, 1, 5, 4), (1, 3, 7, 5), (3, 2, 6, 7), (2, 0, 4, 6)):   # góra + 4 boki
            bm.faces.new([c[i] for i in f])
        me = bpy.data.meshes.new("TARAS_" + h)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("TARASY", me)
        out_coll.objects.link(ob)
        if mat:
            me.materials.append(mat)
        out.append(ob)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    log("tarasy: %d plyt z %d desek" % (len(out), len(objs)))
    return out


merged = {}
for g in GROUP_ORDER:
    objs = pieces[g]
    if not objs:
        continue
    if g == "TARASY":
        objs = pieces[g] = terrace_slabs(objs)
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs,
                                       selected_objects=objs, object=objs[0]):
            bpy.ops.object.join()
    ob = objs[0]
    me = ob.data
    if g.startswith("DOM_"):
        # obróbki okapu/wiatrownic w kolorze dachu tego domu (rendery i budowa), nie wspólny ciemny kolor
        roof = next((s.material for s in ob.material_slots if s.material and s.material.name.startswith("BLACHA")), None)
        if roof is not None:
            for s in ob.material_slots:
                if s.material and s.material.name == "Obróbki":
                    s.link = "OBJECT"
                    s.material = roof
    sz = bpy.data.materials.get("%s_SZCZYT" % g[-1]) if g.startswith("DOM_") else None
    if sz is not None:
        # wschodni szczyt A w oliwce (vis-4): ściany TYNK A zwrócone na +X przy wschodniej krawędzi bryły
        xmax = max(v.co.x for v in me.vertices)
        slot = [i for i, s_ in enumerate(ob.material_slots) if s_.material and s_.material.name == "TYNK A"]
        if slot:
            ob.data.materials.append(sz)
            si = len(ob.data.materials) - 1
            n = 0
            for p in me.polygons:
                if p.material_index in slot and p.normal.x > 0.99 and p.center.x > xmax - 0.15:
                    p.material_index = si
                    n += 1
            log("szczyt %s: %d scian -> %s" % (g, n, sz.name))
    br = bpy.data.materials.get("%s_BRAMA" % g[-1]) if g.startswith("DOM_") else None
    if br is not None:
        # brama segmentowa (vis-4): 3 poziome fugi między panelami, 2 mm przed licem bramy
        fuga = bpy.data.materials.get(br.name + "_FUGA")
        if fuga is None:
            fuga = br.copy(); fuga.name = br.name + "_FUGA"
            bb = next(n for n in fuga.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bb.inputs["Base Color"].default_value = tuple(c * 0.55 for c in bb.inputs["Base Color"].default_value[:3]) + (1,)
        bi = [i for i, s_ in enumerate(ob.material_slots) if s_.material is br]
        rects = []
        for p in me.polygons:
            if p.material_index in bi and p.area > 3.0 and abs(p.normal.y) > 0.95:
                vs = [me.vertices[v].co for v in p.vertices]
                rects.append((min(v.x for v in vs), max(v.x for v in vs), min(v.z for v in vs), max(v.z for v in vs),
                              vs[0].y + p.normal.y * 0.002, p.normal.y))
        if rects:
            me.materials.append(fuga)
            fi = len(me.materials) - 1
            bm = bmesh.new(); bm.from_mesh(me)
            for x0, x1, z0, z1, y, ny in rects:
                for k in (1, 2, 3):
                    zk = z0 + k * (z1 - z0) / 4
                    q = [bm.verts.new((x, y, z)) for x, z in ((x0 + 0.02, zk - 0.009), (x1 - 0.02, zk - 0.009),
                                                              (x1 - 0.02, zk + 0.009), (x0 + 0.02, zk + 0.009))]
                    f = bm.faces.new(q if ny > 0 else q[::-1])
                    f.material_index = fi
            bm.to_mesh(me); bm.free()
            log("brama %s: %d skrzydel x 3 fugi" % (g, len(rects)))
    if g.startswith("DOM_") or g == "TARASY":
        # box mapping w metrach dla wszystkich ścian domów i tarasów: UV z importu SKP bywają zdegenerowane
        # (np. panele wnęk) -> normal mapa tynku obracała normalne i ściana wychodziła jaśniejsza; tarasy (D-007)
        bm = bmesh.new()
        bm.from_mesh(me)
        uvl = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UV")
        for f in bm.faces:
            ax = max(range(3), key=lambda i: abs(f.normal[i]))
            ua, va = [i for i in range(3) if i != ax]
            for loop in f.loops:
                loop[uvl].uv = (loop.vert.co[ua], loop.vert.co[va])
        bm.to_mesh(me)
        bm.free()
    if g.startswith("KONTEKST"):
        km = kontekst_mat()
        for s in ob.material_slots:
            s.link = "OBJECT"
            s.material = km
    # sloty -> unikalne materiały (jeden prymityw glTF na materiał)
    mats = []
    remap = []
    for s in ob.material_slots:
        m = s.material
        if m not in mats:
            mats.append(m)
        remap.append(mats.index(m))
    idx = np.zeros(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get("material_index", idx)
    if len(remap):
        idx = np.array(remap, dtype=np.int32)[np.clip(idx, 0, len(remap) - 1)]
    ob.data.materials.clear()
    while len(ob.material_slots):
        with bpy.context.temp_override(object=ob):
            bpy.ops.object.material_slot_remove()
    for m in mats:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", idx)
    me.update()
    me.validate(verbose=False)
    merged[g] = ob

# usunięcie oryginałów (zostają kamery, nowe obiekty i znaczniki zieleni)
mc = bpy.data.collections.get(MARKERS)
markers = list(mc.objects) if mc else []
for ob in list(scene.objects):
    if ob.type != "CAMERA" and ob not in merged.values() and ob not in markers:
        bpy.data.objects.remove(ob, do_unlink=True)
if markers:
    root = bpy.data.objects.new("ZIELEN_ZNACZNIKI", None)
    mc.objects.link(root)
    for ob in markers:
        ob.parent = root
    log("znaczniki zieleni", len(markers))
for g, ob in merged.items():
    ob.name = g
    ob.data.name = g
log("wezly", [(g, len(o.data.materials), sum(len(p.vertices) - 2 for p in o.data.polygons)) for g, o in merged.items()])
for g, o in merged.items():
    if g.startswith("DOM_"):
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        log("obrys %s x %.2f-%.2f  y(N) %.2f-%.2f" % (g, min(xs), max(xs), min(ys), max(ys)))

# --- 3b. wypieczone AO (Cycles) na UV2 każdego DOM_* -> glTF occlusionTexture (texCoord 1) -------------
AO = OPTS.get("ao", "1") == "1"
AO_PX = int(OPTS.get("ao_px", 1024))
AO_SAMPLES = int(OPTS.get("ao_samples", 96))
AO_DIST = float(OPTS.get("ao_dist", 1.2))


def gltf_output_group():
    g = bpy.data.node_groups.get("glTF Material Output")
    if g is None:
        g = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        g.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return g


def bake_ao(ob, h):
    me = ob.data
    # kopie materiałów per dom (atlas AO jest per dom); szkło bez AO
    for slot in ob.material_slots:
        m = slot.material
        if m is None or m.name == "SZYBY1":
            continue
        if not m.name.startswith(h + "_"):
            c = m.copy()
            c.name = "%s@%s" % (m.name, h)
            slot.material = c
    if "UV_AO" not in me.uv_layers:
        me.uv_layers.new(name="UV_AO")
    base_uv = me.uv_layers[0].name
    me.uv_layers.active = me.uv_layers["UV_AO"]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    img = bpy.data.images.new("AO_" + ob.name, AO_PX, AO_PX, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    nodes_added = []
    for slot in ob.material_slots:
        m = slot.material
        if m is None or m.name == "SZYBY1":
            continue
        nt = m.node_tree
        uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UV_AO"
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img
        nt.links.new(uvn.outputs["UV"], tn.inputs["Vector"])
        nt.nodes.active = tn
        nodes_added.append((m, tn))
    sc = scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = AO_SAMPLES
    sc.world.light_settings.distance = AO_DIST
    bpy.ops.object.bake(type="AO", margin=6, use_clear=True)   # Cycles piecze w AKTYWNEJ warstwie UV (UV_AO)
    me.uv_layers.active = me.uv_layers[base_uv]
    img.pack()
    grp = gltf_output_group()
    for m, tn in nodes_added:
        nt = m.node_tree
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tn.outputs["Color"], sep.inputs["Color"])
        gn = nt.nodes.new("ShaderNodeGroup"); gn.node_tree = grp
        nt.links.new(sep.outputs[0], gn.inputs["Occlusion"])
    return img


if AO:
    import math
    t = time.time()
    try:
        scene.cycles.device = "GPU"
    except Exception:
        pass
    for g in ("OGRODZENIA_PANEL", "OGRODZENIE_KOLIZJA"):     # nie zasłaniają w AO (warianty/kolizja)
        if g in merged:
            merged[g].hide_render = True
    for g, ob in merged.items():
        if g.startswith("DOM_"):
            bake_ao(ob, g[-1])
            log("AO %s %.1fs" % (g, time.time() - t))

# --- 4. kamery: PKT_ (oczy) / WIDOK_ (z góry) ----------------------------------------------------
cams = []
for cam in [o for o in scene.objects if o.type == "CAMERA"]:
    if cam.name.startswith("WYGLAD_"):
        if cam.name.startswith("WYGLAD_wiz"):
            # kadry wizualizacji dewelopera (visualization-1/3/5): do porównań w runtime, nie punkty spaceru
            cam.name = "KADR_" + cam.name[len("WYGLAD_"):].upper()
            cam.parent = None
            cams.append(cam.name)
        else:
            bpy.data.objects.remove(cam, do_unlink=True)
        continue
    z = cam.matrix_world.translation.z
    base = re.sub(r"[^0-9A-Za-z]+", "_", cam.name).strip("_")
    cam.name = ("PKT_" if z < 4.0 else "WIDOK_") + base
    cam.parent = None
    cams.append(cam.name)
log("kamery", cams)

# --- 5. tekstury: maks. bok, szare -> RGB (WebP) ------------------------------------------------
for img in bpy.data.images:
    if img.source != "FILE" or not img.users:
        continue
    w, h = img.size
    if w and h and max(w, h) > MAX_PX:
        k = MAX_PX / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
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

# --- 6. eksport --------------------------------------------------------------------------------
for c in list(scene.collection.children):
    if c.name != "WEB" and not c.all_objects:
        scene.collection.children.unlink(c)
os.makedirs(os.path.dirname(DST), exist_ok=True)
t = time.time()
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format="GLB",
    use_active_scene=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_cameras=True,
    export_lights=False,
    export_extras=False,
    export_meshopt_compression_enable=MESHOPT,
    export_meshopt_extension="EXT_meshopt_compression",
    export_draco_mesh_compression_enable=False,
    export_animations=False,
)
log("zapisano %s (%.2f MB) w %.1fs" % (DST, os.path.getsize(DST) / 2**20, time.time() - t))
