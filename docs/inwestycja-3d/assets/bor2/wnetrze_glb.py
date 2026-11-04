"""Eksport roboczego .blend wnętrza (wnetrze_buduj.py / wnetrze_lightmapy.py) do GLB dla three.js.

    blender --background <dom1-web.blend> --python wnetrze_glb.py -- <wyjscie.glb> [tekstury=1024] [kompresja=1]

- Y-up, metry, pozycje światowe bez zmian (jak blend_to_glb.py), kamery PKT_* jako węzły-kamery,
- extras węzłów (lightMap, lightMapIntensity, dane domu) -> glTF extras,
- kolor wierzchołków tylko dla materiałów, które go używają (DETAL, TKANINA),
- tekstury <= 1024 px, WebP, meshopt; obrazy w skali szarości zamieniane na RGB (WebP ich nie przyjmuje).
"""
import os
import sys
import time

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
dst = os.path.abspath(argv[0])
opts = dict(a.split("=", 1) for a in argv[1:] if "=" in a)
MAX_PX = int(opts.get("tekstury", 1024))
# Domyślnie BEZ meshopt Blendera: koduje pozycje stratnie (~1/16 m przy x ~ 90 m). Kompresja i kwantyzacja
# względem bboxu siatki (14 bit, krok < 1 mm) robi potem gltf-transform meshopt (wnetrze_wszystko.sh).
COMPRESS = opts.get("kompresja", "0") != "0"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wnetrze_wspolne as W  # noqa: E402

# Kolory/roughness/emisja wg aktualnej biblioteki (poprawki bez ponownego wypiekania)
synced = [m.name for m in bpy.data.materials if m.get("bib") and W.sync_material(m)]
print("GLB materialy zsynchronizowane z BIB:", synced)

# Lightmapy nie idą do GLB (osobne pliki) - usuń węzły wypiekania, jeśli zostały.
for m in bpy.data.materials:
    if m.use_nodes:
        for n in [n for n in m.node_tree.nodes if n.get("lm_bake")]:
            m.node_tree.nodes.remove(n)

# Tylko hierarchia WNETRZE_* (bez pomocniczych obiektów wypiekania).
root = next(o for o in bpy.data.objects if o.name.startswith("WNETRZE_") and o.parent is None)
keep = {root} | set(root.children_recursive)
for o in list(bpy.context.scene.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

# COLOR_0 tylko tam, gdzie materiał go używa (DETAL, TKANINA) - reszta to zbędne bajty
VC_MATS = {"DETAL", "TKANINA"}
for o in bpy.context.scene.objects:
    if o.type == "MESH" and not any(s.material and s.material.name in VC_MATS for s in o.material_slots):
        for a in list(o.data.color_attributes):
            o.data.color_attributes.remove(a)

NORMAL_PX = int(opts.get("normalne", 512))
for img in bpy.data.images:
    if img.source != "FILE" or not img.users:
        continue
    w, h = img.size
    limit = NORMAL_PX if img.colorspace_settings.name == "Non-Color" else MAX_PX
    # duże, widoczne z bliska: podłoga, dąb, plakaty - 1024; drobnoziarniste (tkanina, kamień, dywan) - 512
    key = (img.filepath or img.name).lower()
    if not any(k in key for k in ("podloga", "dab", "plakat")):
        limit = min(limit, int(opts.get("tekstury_male", 512)))
    if w and h and max(w, h) > limit:
        k = limit / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
        w, h = img.size
    if w and h and max(w, h) > MAX_PX:
        k = MAX_PX / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
    w, h = img.size
    if w and h and not img.is_float and (img.channels < 3 or img.depth in (8, 16)):
        ch = img.channels
        px = np.empty(w * h * ch, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, ch)
        rgba = np.ones((w * h, 4), dtype=np.float32)
        rgba[:, :3] = px[:, :1] if ch < 3 else px[:, :3]
        rgb = bpy.data.images.new(img.name + "_rgb", w, h, alpha=False)
        rgb.colorspace_settings.name = img.colorspace_settings.name
        rgb.pixels.foreach_set(rgba.ravel())
        rgb.pack()
        img.user_remap(rgb)

t = time.time()
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_active_scene=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_image_quality=88,
    export_cameras=True,
    export_lights=False,
    export_extras=True,
    export_vertex_color="MATERIAL",
    export_normals=True,
    export_tangents=False,
    export_meshopt_compression_enable=COMPRESS,
    export_meshopt_extension="EXT_meshopt_compression",
    export_draco_mesh_compression_enable=False,
    export_animations=False,
)
print("GLB zapisano %s (%.2f MB) w %.1fs" % (dst, os.path.getsize(dst) / 2**20, time.time() - t))
