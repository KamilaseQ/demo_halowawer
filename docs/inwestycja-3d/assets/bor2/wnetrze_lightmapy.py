"""Lightmapy wnętrza: drugi kanał UV (atlas na kondygnację) + wypiekanie w Cycles (GPU).

    blender --background <dom1-web.blend> --python wnetrze_lightmapy.py -- dom1 <katalog_lm> [rozm=2048] [probki=512] [zapisz=<wyjscie.blend>]

Kontrakt (uzgodniony z runtime 55):
- lightmapa = niebo bezpośrednio + CAŁE światło pośrednie (także odbite słońce), BEZ bezpośredniego słońca
  (słońce runtime rysuje na żywo z cieniami): L = max(A - B, 0), gdzie
    A = DIFFUSE (direct + indirect, bez koloru) przy niebie + słońcu "Dzień",
    B = DIFFUSE direct przy samym słońcu,
- słońce "Dzień" (21.09, 15:30, Zerzeń): wektor DO słońca w układzie modelu (-0,711, -0,548, 0,440) (az. 232,4°, wys. 26,1°),
  kolor #ffe2c2, natężenie 4,4 (te same jednostki co three.js DirectionalLight: E = I cos θ),
  niebo: gradient #4d86cc (zenit) -> #dfe6ec (horyzont), dolna półsfera ziemia, ~0,8 radiancji,
- UV: TEXCOORD_1 ("LM"), jeden atlas na kondygnację dla węzłów KOND_n__PODLOGA, __SUFIT, __WNETRZE
  (SCHODY w atlasie KOND_0); DETALE, TRANSPARENT bez lightmapy,
- plik: <katalog_lm>/<dom>_kond<n>.webp, 8 bit sRGB, wartość = L / k; extras węzła:
  {"lightMap": "wnetrza-lm/<dom>_kond<n>.webp", "lightMapIntensity": pi * k}
  (three.js: indirectDiffuse = lightMap * intensity * albedo / pi -> 1:1 z Cycles).
"""
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wnetrze_wspolne as W  # noqa: E402
from wnetrze_konfig import KONFIG  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
KEY, LMDIR = args[0], os.path.abspath(args[1])
opts = dict(a.split("=", 1) for a in args[2:] if "=" in a)
SIZE = int(opts.get("rozm", 2048))
SAMPLES = int(opts.get("probki", 512))
# Ekspozycja wnętrza: rendery dewelopera są naświetlone pod wnętrze (ok. 10x jaśniej niż plener),
# więc lightMapIntensity = pi * k * GAIN (runtime dalej skaluje wg pory dnia).
GAIN = float(opts.get("wzmocnienie", 6.5))
C = KONFIG[KEY]
DOM = C["dom"]
SUN = Vector((-0.711, -0.548, 0.440)).normalized()  # georeferencja OSM: X = wschód, Y = północ
T0 = time.time()
os.makedirs(LMDIR, exist_ok=True)
scene = bpy.context.scene


def log(*a):
    print("LM", "%6.1fs" % (time.time() - T0), *a, flush=True)


root = bpy.data.objects["WNETRZE_" + DOM]
nodes = {o.name: o for o in root.children_recursive if o.type == "MESH"}
GROUPS = {}
for k in (0, 1):
    names = ["KOND_%d__PODLOGA" % k, "KOND_%d__SUFIT" % k, "KOND_%d__WNETRZE" % k] + (["SCHODY"] if k == 0 else [])
    GROUPS[str(k)] = [nodes[n] for n in names if n in nodes]
    # drobne meble i detale: osobny atlas (bez niego krzesła/książki są ciemniejsze niż reszta i bez AO)
    if opts.get("detale", "1") != "0" and "KOND_%d__DETALE" % k in nodes:
        GROUPS["%dd" % k] = [nodes["KOND_%d__DETALE" % k]]

# --- 0. Orientacja lic (Cycles wypieka światło po stronie normalnej; SKP ma odwrócone sufity/podłogi) --
import bmesh  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

occl = [o for o in nodes.values() if not o.name.endswith("__TRANSPARENT")]
_verts, _polys, _off = [], [], 0
for o in occl:
    me = o.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world)
    co = co @ mw[:3, :3].T + mw[:3, 3]
    _verts.extend(map(tuple, co))
    for p in me.polygons:
        _polys.append([v + _off for v in p.vertices])
    _off += len(me.vertices)
bvh = BVHTree.FromPolygons(_verts, _polys)
# 12 kierunków na półsferze (rozkład kosinusowy), do testu "które lico widzi niebo"
HEMI = []
for i in range(12):
    r, a = math.sqrt((i + 0.5) / 12), i * 2.39996
    HEMI.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - r * r)))))
del _verts, _polys
for k, obs in GROUPS.items():
    if k.endswith("d"):
        continue  # drobne obiekty to zamknięte bryły z 3D Warehouse - normalne zwykle dobre, heurystyka by szkodziła
    flipped = total = 0
    for o in obs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.faces.ensure_lookup_table()
        rev = []
        is_ceil, is_floor = o.name.endswith("__SUFIT"), o.name.endswith("__PODLOGA")
        for f in bm.faces:
            if f.calc_area() < 1e-6:
                continue
            c, n = f.calc_center_median(), f.normal
            # sufity zawsze w dół, podłogi w górę (górny strop bez dachu nad nim nie ma czego "trafić")
            if is_ceil and n.z > 0.5:
                rev.append(f)
                continue
            if (is_ceil and n.z < -0.5) or (is_floor and abs(n.z) > 0.5):
                if is_floor and n.z < -0.5:
                    rev.append(f)
                continue
            hf = bvh.ray_cast(c + n * 0.003, n, 1.5)[3]
            if hf is not None and hf <= 0.55:
                hb = bvh.ray_cast(c - n * 0.003, -n, 1.5)[3]
                if hb is None or hb > 3 * hf:
                    rev.append(f)
                continue
            # lico widzi "na zewnątrz" (niebo), a druga strona jest zamknięta (pokój) -> odwrócone lico
            # pojedynczej płaszczyzny ściany/stropu
            if f.calc_area() > 0.05 and bvh.ray_cast(c - n * 0.003, -n, 0.6)[0] is None:
                # (lico zewnętrzne pełnej ściany ma za sobą drugie lico w < 0,6 m - zostaje)
                q = n.to_track_quat("Z", "Y")
                esc_f = sum(1 for d in HEMI if bvh.ray_cast(c + n * 0.003, q @ d, 8.0)[0] is None)
                if esc_f >= 6:
                    esc_b = sum(1 for d in HEMI if bvh.ray_cast(c - n * 0.003, -(q @ d), 8.0)[0] is None)
                    if esc_b <= 2:
                        rev.append(f)
        total += len(bm.faces)
        if rev:
            bmesh.ops.reverse_faces(bm, faces=rev)
            bm.to_mesh(o.data)
        flipped += len(rev)
        bm.free()
    log("orientacja KOND_%s: odwrocono %d z %d lic" % (k, flipped, total))

# --- 1. UV lightmapy -------------------------------------------------------------------------
for k, obs in GROUPS.items():
    t = time.time()
    for o in obs:
        me = o.data
        lm = me.uv_layers.get(W.UV1) or me.uv_layers.new(name=W.UV1)
        me.uv_layers.active = lm
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin_method="FRACTION",
                            margin=float(opts.get("margines", 0.0025)))
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in obs:
        o.data.uv_layers.active = o.data.uv_layers[W.UV0]
        o.data.uv_layers[W.UV0].active_render = True
    log("UV KOND_%s: %s w %.1fs" % (k, [o.name for o in obs], time.time() - t))

# --- 2. Scena wypiekania: niebo, słońce, teren -----------------------------------------------
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
# OPTIX w Blenderze 5.2 nie kompiluje jąder na tym sterowniku ("unimplemented PTX intrinsics") -> CUDA
for dev_type in opts.get("urzadzenie", "CUDA,OPTIX").split(","):
    try:
        prefs.compute_device_type = dev_type
        prefs.get_devices()
        if any(d.type == dev_type for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == dev_type
            break
    except Exception:
        continue
scene.cycles.device = "GPU"
log("urzadzenie:", prefs.compute_device_type, [d.name for d in prefs.devices if d.use])
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6
scene.cycles.glossy_bounces = 2
scene.cycles.transparent_max_bounces = 16
scene.cycles.transmission_bounces = 4
scene.render.bake.margin = 6
scene.render.bake.margin_type = "EXTEND"

world = bpy.data.worlds.new("niebo_lm")
scene.world = world
world.use_nodes = True
wt = world.node_tree
for n in list(wt.nodes):
    if n.type != "OUTPUT_WORLD":
        wt.nodes.remove(n)
out = next(n for n in wt.nodes if n.type == "OUTPUT_WORLD")
bg = wt.nodes.new("ShaderNodeBackground")
geo = wt.nodes.new("ShaderNodeTexCoord")
sep = wt.nodes.new("ShaderNodeSeparateXYZ")
ramp = wt.nodes.new("ShaderNodeValToRGB")
wt.links.new(geo.outputs["Generated"], sep.inputs[0])
# Generated w świecie = kierunek; z w [-1, 1] -> mapa koloru: ziemia / horyzont / zenit
mapr = wt.nodes.new("ShaderNodeMapRange")
mapr.inputs["From Min"].default_value = -1.0
mapr.inputs["From Max"].default_value = 1.0
wt.links.new(sep.outputs["Z"], mapr.inputs["Value"])
wt.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
cr = ramp.color_ramp
cr.elements[0].position = 0.0
cr.elements[0].color = (*W.s2l((92, 98, 70)), 1)      # ziemia pod horyzontem (trawa/żwir)
cr.elements[1].position = 0.5
cr.elements[1].color = (*W.s2l((150, 150, 135)), 1)
e = cr.elements.new(0.505)
e.color = (*W.s2l((223, 230, 236)), 1)               # horyzont
e = cr.elements.new(1.0)
e.color = (*W.s2l((77, 134, 204)), 1)                # zenit
wt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
SKY = float(opts.get("niebo", 0.8))
bg.inputs["Strength"].default_value = SKY
wt.links.new(bg.outputs["Background"], out.inputs["Surface"])

sun_d = bpy.data.lights.new("slonce_lm", "SUN")
sun_d.energy = float(opts.get("slonce", 4.4))
sun_d.color = W.s2l((0xff, 0xe2, 0xc2))
sun_d.angle = math.radians(0.53)
sun_o = bpy.data.objects.new("slonce_lm", sun_d)
scene.collection.objects.link(sun_o)
sun_o.rotation_euler = (-SUN).to_track_quat("-Z", "Y").to_euler()

# Teren: trawnik wokół domu (światło odbite od ogrodu wpada przez okna)
bpy.ops.mesh.primitive_plane_add(size=300, location=(sum(C["obrys"][:2]) / 2, sum(C["obrys"][2:]) / 2,
                                                     C["podlogi"][0] - 0.18))
ground = bpy.context.active_object
ground.name = "teren_lm"
gm = bpy.data.materials.new("teren_lm")
gm.use_nodes = True
gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
gb.inputs["Base Color"].default_value = (*W.s2l((105, 120, 72)), 1)
gb.inputs["Roughness"].default_value = 1.0
ground.data.materials.append(gm)

# Zasłony w wypiekaniu bardziej przepuszczalne niż w GLB (len przepuszcza i rozprasza światło): inaczej
# ściana nad oknem za zasłoną wychodzi jak ciemna plama (pokój dziecka, int-8).
BAKE_ALPHA = {"ZASLONA": 0.35, "FIRANA": 0.15}
alpha_saved = {}
for nm, a in BAKE_ALPHA.items():
    m = bpy.data.materials.get(nm)
    if m and m.use_nodes:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is not None and not b.inputs["Alpha"].is_linked:
            alpha_saved[nm] = b.inputs["Alpha"].default_value
            b.inputs["Alpha"].default_value = a

# Emisja lamp wyłączona na czas wypiekania (dzień); zapamiętana do przywrócenia.
emis = {}
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if b is not None and b.inputs["Emission Strength"].default_value > 0:
        emis[m.name] = b.inputs["Emission Strength"].default_value
        b.inputs["Emission Strength"].default_value = 0.0


# --- 3. Wypiekanie ---------------------------------------------------------------------------
def bake(obs, img, passes):
    for o in scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
        for s in o.material_slots:
            W.bake_image_node(s.material, img)
    bpy.context.view_layer.objects.active = obs[0]
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter=passes, use_clear=True, margin=6, uv_layer=W.UV1,
                        target="IMAGE_TEXTURES")
    log("bake %s %s %.1fs" % (img.name, sorted(passes), time.time() - t))
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(img.size[1], img.size[0], 4)


TMP = opts.get("tmp", os.path.join(os.environ.get("TEMP", LMDIR), "wnetrze_lm_tmp"))
os.makedirs(TMP, exist_ok=True)
_dn = {}


def denoise(arr):
    """OIDN (węzeł Denoise kompozytora) na atlasie lightmapy: osobna, pusta scena Workbench,
    obraz wejściowy EXR -> Denoise (HDR) -> wyjście EXR."""
    h, w = arr.shape[:2]
    pin, pout = os.path.join(TMP, "dn_in.exr"), os.path.join(TMP, "dn_out.exr")
    im = bpy.data.images.new("dn_in", w, h, alpha=True, float_buffer=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = arr
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = pin
    im.file_format = "OPEN_EXR"
    im.save()
    bpy.data.images.remove(im)
    if not _dn:
        sc = bpy.data.scenes.new("odszumianie")
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.render.resolution_percentage = 100
        ng = bpy.data.node_groups.new("odszumianie", "CompositorNodeTree")
        sc.compositing_node_group = ng
        ni = ng.nodes.new("CompositorNodeImage")
        dn = ng.nodes.new("CompositorNodeDenoise")
        try:
            dn.inputs["HDR"].default_value = True
        except Exception:
            pass
        out = ng.nodes.new("NodeGroupOutput")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        ng.links.new(ni.outputs["Image"], dn.inputs["Image"])
        ng.links.new(dn.outputs["Image"], out.inputs[0])
        sc.render.use_compositing = True
        sc.render.image_settings.file_format = "OPEN_EXR"
        cam = bpy.data.objects.new("dn_cam", bpy.data.cameras.new("dn_cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
        _dn.update(scene=sc, img_node=ni)
    sc = _dn["scene"]
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.filepath = pout
    src = bpy.data.images.load(pin, check_existing=False)
    _dn["img_node"].image = src
    bpy.ops.render.render(write_still=True, scene=sc.name)
    res = bpy.data.images.load(pout, check_existing=False)
    px = np.empty(w * h * 4, dtype=np.float32)
    res.pixels.foreach_get(px)
    bpy.data.images.remove(res)
    bpy.data.images.remove(src)
    return px.reshape(h, w, 4)[..., :3]


def srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


results = {}
for k, obs in GROUPS.items():
    imgA = bpy.data.images.new("%s_kond%s_A" % (DOM, k), SIZE, SIZE, alpha=True, float_buffer=True)
    imgB = bpy.data.images.new("%s_kond%s_B" % (DOM, k), SIZE, SIZE, alpha=True, float_buffer=True)
    bg.inputs["Strength"].default_value = SKY
    sun_d.energy = float(opts.get("slonce", 4.4))
    A = bake(obs, imgA, {"DIRECT", "INDIRECT"})
    bg.inputs["Strength"].default_value = 0.0
    B = bake(obs, imgB, {"DIRECT"})
    L = np.maximum(A[..., :3] - B[..., :3], 0.0)
    cover = A[..., 3] > 0.5
    if opts.get("odszum", "1") != "0":
        t = time.time()
        L = np.maximum(denoise(L), 0.0)
        log("odszumianie KOND_%s %.1fs" % (k, time.time() - t))
    # Rendery dewelopera mają neutralny balans bieli: ciepłe odbicie od dębowej podłogi barwi sufity
    # na pomarańczowo - nasycenie lightmapy ograniczone (NASYC = 1 bez zmian).
    lum = (L * np.array([0.2126, 0.7152, 0.0722])).sum(axis=2, keepdims=True)
    L = np.maximum(lum + (L - lum) * float(opts.get("nasycenie", 0.3)), 0.0)
    k99 = float(np.percentile(L[cover].max(axis=1), 99.7)) if cover.any() else 1.0
    kk = max(k99, 1e-3)
    enc = srgb(L / kk)
    rgba = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    rgba[..., :3] = enc
    out_img = bpy.data.images.new("%s_kond%s" % (DOM, k), SIZE, SIZE, alpha=False)
    out_img.colorspace_settings.name = "Non-Color"  # wartości już zakodowane sRGB
    out_img.pixels.foreach_set(rgba.ravel())
    path = os.path.join(LMDIR, "%s_kond%s.webp" % (DOM, k))
    out_img.filepath_raw = path
    out_img.file_format = "WEBP"
    try:
        out_img.save(quality=int(opts.get("jakosc", 90)))
    except TypeError:
        out_img.save()
    # surowe A i B (EXR) do kontroli i ponownego kodowania bez wypiekania (poza repo)
    if opts.get("surowe"):
        for im in (imgA, imgB):
            im.filepath_raw = os.path.join(opts["surowe"], im.name + ".exr")
            os.makedirs(opts["surowe"], exist_ok=True)
            im.file_format = "OPEN_EXR"
            im.save()
    rel = "wnetrza-lm/%s_kond%s.webp" % (DOM, k)
    for o in obs:
        o["lightMap"] = rel
        o["lightMapIntensity"] = round(math.pi * kk * GAIN, 4)
    results[k] = {"plik": rel, "k": kk, "kB": os.path.getsize(path) // 1024,
                  "srednia_L": float(L[cover].mean()) if cover.any() else 0}
    log("KOND_%s: k=%.3f intensywnosc=%.3f (wzmocnienie %.1f), %d kB, srednia L=%.3f, mediana L=%.3f" % (
        k, kk, math.pi * kk * GAIN, GAIN, results[k]["kB"], results[k]["srednia_L"],
        float(np.median(L[cover].mean(axis=1))) if cover.any() else 0))

# --- 4. Sprzątanie i zapis -------------------------------------------------------------------
for m in bpy.data.materials:
    if m.use_nodes:
        W.remove_bake_nodes(m)
        if m.name in emis:
            b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            b.inputs["Emission Strength"].default_value = emis[m.name]
for nm, a in alpha_saved.items():
    b = next(n for n in bpy.data.materials[nm].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Alpha"].default_value = a
root["slonce_dzien"] = list(SUN)
root["lightmapa_wzmocnienie"] = GAIN
root["lightmapy"] = str({k: v["plik"] for k, v in results.items()})
for o in (ground, sun_o):
    bpy.data.objects.remove(o, do_unlink=True)
dst = opts.get("zapisz")
if dst:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(dst), compress=True)
    log("zapisano", dst)
