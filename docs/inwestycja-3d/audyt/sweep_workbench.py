"""Prawda geometrii: te same pozy co sweep runtime, render Blender Workbench z GLB (bez proceduralnych dodatków).

    blender --background --factory-startup --python sweep_workbench.py -- <plik.glb> <pozy.json> <katalog_wyjsciowy>

Kolory = tekstury bazowe GLB (WB_KOLOR=MATERIAL: płaskie kolory materiałów), cavity + kontury obiektów (krawędzie i pozostałości są dobrze widoczne). glTF (x, y, z) → Blender (x, −z, y).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

glb, poses_file, out = sys.argv[sys.argv.index("--") + 1:][:3]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene
for engine in ("BLENDER_WORKBENCH", "BLENDER_WORKBENCH_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = os.environ.get("WB_KOLOR", "TEXTURE")  # TEXTURE: tekstury bazowe (nawierzchnie, płot); MATERIAL: kolory materiałów
sh.show_cavity = True
sh.cavity_type = "BOTH"
sh.show_object_outline = True
sh.show_shadows = False
sh.background_type = "VIEWPORT"
sh.background_color = (0.86, 0.89, 0.9)
data = json.load(open(poses_file, encoding="utf-8"))
scene.render.resolution_x, scene.render.resolution_y = data["kadr"]["w"], data["kadr"]["h"]
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
cam_data = bpy.data.cameras.new("SWEEP")
cam_data.sensor_fit = "VERTICAL"
cam_data.clip_start, cam_data.clip_end = 0.05, 3000
cam = bpy.data.objects.new("SWEEP", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
to_bl = lambda v: Vector((v[0], -v[2], v[1]))
for p in data["pozy"]:
    cam_data.angle_y = math.radians(p["yfov"])
    loc, tgt = to_bl(p["pozycja"]), to_bl(p["cel"])
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out, p["id"] + ".jpg")
    bpy.ops.render.render(write_still=True)
print("WORKBENCH_OK", len(data["pozy"]))
