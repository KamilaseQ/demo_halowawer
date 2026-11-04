"""Podgląd modelu (Workbench, kolory i tekstury materiałów) bez otwierania okna Blendera.

Uruchomienie:
    blender --background <plik.blend | pusty> --python preview.py -- <katalog_wyjsciowy> <prefiks> [plik.glb] [kamera_skp ...]

- Gdy podasz plik .glb, scena jest czyszczona i renderowany jest ten plik
  (sprawdza dokładnie to, co dostanie three.js).
- Zawsze powstają ujęcia: <prefiks>-34.jpg (z ukosa) i <prefiks>-gora.jpg (z góry).
- Dodatkowo po jednym ujęciu dla każdej podanej kamery ze sceny SketchUpa.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out_dir, prefix = args[0], args[1]
glb = args[2] if len(args) > 2 and args[2].lower().endswith(".glb") else None
cam_names = args[3:] if glb else args[2:]
os.makedirs(out_dir, exist_ok=True)

if glb:
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "TEXTURE"
shading.show_shadows = True
shading.show_cavity = True
shading.cavity_type = "WORLD"
scene.display.render_aa = "8"
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
if scene.world is None:
    scene.world = bpy.data.worlds.new("preview")
scene.world.color = (0.92, 0.93, 0.95)

# Granice geometrii (z instancjami).
deps = bpy.context.evaluated_depsgraph_get()
lo, hi = Vector((1e18,) * 3), Vector((-1e18,) * 3)
for inst in deps.object_instances:
    if inst.object.type != "MESH":
        continue
    for c in inst.object.bound_box:
        p = inst.matrix_world @ Vector(c)
        lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
center, size = (lo + hi) / 2, hi - lo
radius = size.length / 2
print("PREVIEW granice min=%s max=%s" % (tuple(round(v, 2) for v in lo), tuple(round(v, 2) for v in hi)))

cam_data = bpy.data.cameras.new("preview_cam")
cam_data.lens = 35
cam_data.clip_start, cam_data.clip_end = 0.05, radius * 20
cam = bpy.data.objects.new("preview_cam", cam_data)
scene.collection.objects.link(cam)


def shoot(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("PREVIEW zapisano", path)


def aim(direction, dist_factor):
    d = Vector(direction).normalized()
    cam.location = center + d * radius * dist_factor
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()


scene.camera = cam
cam_data.type = "PERSP"
aim((1.0, -1.2, 0.9), 1.9)
shoot(os.path.join(out_dir, prefix + "-34.jpg"))

cam_data.type = "ORTHO"
aspect = scene.render.resolution_x / scene.render.resolution_y
cam_data.ortho_scale = max(size.x, size.y * aspect) * 1.05
cam.location = center + Vector((0, 0, radius * 3))
cam.rotation_euler = (0, 0, 0)
shoot(os.path.join(out_dir, prefix + "-gora.jpg"))

for name in cam_names:
    ob = bpy.data.objects.get(name)
    if ob is None or ob.type != "CAMERA":
        print("PREVIEW brak kamery", name)
        continue
    ob.data.clip_end = max(ob.data.clip_end, radius * 20)
    scene.camera = ob
    safe = "".join(ch if ch.isalnum() else "_" for ch in name)
    shoot(os.path.join(out_dir, "%s-kamera-%s.jpg" % (prefix, safe)))
