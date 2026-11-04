"""Szybkie ujęcia z kamer SketchUpa (Workbench, tekstury) do identyfikacji pomieszczeń.

    blender --background <plik.blend> --python wnetrze_kamery.py -- <katalog> <prefiks> [szer=960] [wys=540] [kamera ...]
    kamera "plan:Z" = rzut z góry przycięty na wysokości Z (ortho), np. plan:2.0
"""
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out_dir, prefix = args[0], args[1]
rest = args[2:]
W, H = 960, 540
names = []
for a in rest:
    if a.startswith("szer="):
        W = int(a[5:])
    elif a.startswith("wys="):
        H = int(a[4:])
    else:
        names.append(a)
os.makedirs(out_dir, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "TEXTURE"
sh.show_shadows = False
sh.show_cavity = True
sh.cavity_type = "WORLD"
sh.show_backface_culling = False
scene.display.render_aa = "8"
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 85
cams = [o for o in scene.objects if o.type == "CAMERA"]
if not names:
    names = [c.name for c in cams]


def shoot(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("KAMERY zapisano", path)


deps = bpy.context.evaluated_depsgraph_get()
lo, hi = Vector((1e18,) * 3), Vector((-1e18,) * 3)
for inst in deps.object_instances:
    if inst.object.type != "MESH":
        continue
    for c in inst.object.bound_box:
        p = inst.matrix_world @ Vector(c)
        lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))

for name in names:
    safe = "".join(ch if ch.isalnum() else "_" for ch in name)
    if name.startswith("plan:"):
        z = float(name[5:])
        cd = bpy.data.cameras.new("plan")
        cd.type = "ORTHO"
        size = hi - lo
        cd.ortho_scale = max(size.x * W / H if False else size.x, size.y) * 1.05
        cd.ortho_scale = max(size.x, size.y * W / H) * 1.05 if W >= H else max(size.x * H / W, size.y) * 1.05
        cd.clip_start = 0.01
        cd.clip_end = z - lo.z + 1
        cam = bpy.data.objects.new("plan", cd)
        scene.collection.objects.link(cam)
        cam.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, z)
        cam.rotation_euler = (0, 0, 0)
        scene.camera = cam
        shoot(os.path.join(out_dir, "%s-plan_%s.jpg" % (prefix, safe[5:])))
        continue
    if name.startswith("widok:"):
        v = [float(x) for x in name[6:].split(",")]
        cd = bpy.data.cameras.new("widok")
        cd.lens = 16 if len(v) < 7 else v[6]
        cd.clip_start = 0.05
        cam = bpy.data.objects.new("widok", cd)
        scene.collection.objects.link(cam)
        cam.location = v[:3]
        cam.rotation_euler = Vector(v[3:6]).to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        shoot(os.path.join(out_dir, "%s-widok_%s.jpg" % (prefix, "_".join("%g" % x for x in v[:3]).replace(".", "p"))))
        continue
    if name.startswith("przekroj:"):
        _, ax, v = name.split(":")
        v = float(v)
        cd = bpy.data.cameras.new("sec")
        cd.type = "ORTHO"
        size = hi - lo
        horiz = size.y if ax == "x" else size.x
        cd.ortho_scale = max(horiz, size.z * W / H) * 1.05
        cd.clip_start = 0.0
        cd.clip_end = 100
        cam = bpy.data.objects.new("sec", cd)
        scene.collection.objects.link(cam)
        c = (lo + hi) / 2
        if ax == "x":  # patrzy w +X (na wschód), w obrazie: prawo = -Y? -> obracamy tak, by prawo = +Y... patrzy na wschód: prawo = południe
            cam.location = (v, c.y, c.z)
            cam.rotation_euler = (1.5708, 0, -1.5708)
        else:  # patrzy w +Y (na północ), prawo = +X
            cam.location = (c.x, v, c.z)
            cam.rotation_euler = (1.5708, 0, 0)
        scene.camera = cam
        shoot(os.path.join(out_dir, "%s-przekroj_%s_%s.jpg" % (prefix, ax, str(v).replace(".", "_"))))
        continue
    ob = bpy.data.objects.get(name)
    if ob is None or ob.type != "CAMERA":
        print("KAMERY brak", name)
        continue
    ob.data.clip_start = 0.05
    ob.data.clip_end = 500
    scene.camera = ob
    shoot(os.path.join(out_dir, "%s-%s.jpg" % (prefix, safe)))
print("KAMERY granice", tuple(round(v, 2) for v in lo), tuple(round(v, 2) for v in hi))
