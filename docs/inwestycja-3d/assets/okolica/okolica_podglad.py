"""Krok 5/5: podglądy okolicy z BOR2 (Blender headless, EEVEE: słońce z SSE 42°, niebo).

Uruchomienie:
    blender --background --factory-startup --python okolica_podglad.py -- \
        ../bor2/bor2-zewnetrze.glb okolica.glb dane/okolica-dane.json podglad ../../../../public/explorer/gallery

Ujęcia (podglad/):
    okolica-gora.jpg            z góry, cała okolica (koło 450 m) + BOR2, północ u góry
    okolica-gora-osiedle.jpg    z góry, ±160 m wokół osiedla
    okolica-estate3.jpg         kamera zbliżona do drona estate-3, obok zdjęcia
    okolica-estate8.jpg         kamera zbliżona do drona estate-8, obok zdjęcia
Teren (zielonoszara płyta) i drzewa (stożki w punktach z extras DRZEWA) są tylko w podglądzie,
nie ma ich w okolica.glb - runtime ma własny grunt i własne drzewa.

Kamery dronów oszacowane ze zdjęć (ogniskowa ekwiwalent 24 mm -> poziome FOV 73,7°, kadr 4:3):
- estate-3: ściana wspólna bliźniaka D|C w środku kadru, proporcje szerokości elewacji D:C = 1,43
  -> skos 22° do elewacji; okap 6,05 m i podstawa ściany na zdjęciu -> 17,6 m od elewacji, 9,9 m nad terenem.
- estate-8: wysokość, odległość i pochylenie dobrane do położeń kalenic G…A w pionie kadru
  (siatka parametrów, RMS 14 px): 66 m nad terenem, 19 m na wschód od domu A, pochylenie 53°.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler

argv = sys.argv[sys.argv.index("--") + 1:]
BOR2, OKOLICA, DANE, OUT, GALERIA = [os.path.abspath(a) for a in argv[:5]]
os.makedirs(OUT, exist_ok=True)
d = json.load(open(DANE, encoding="utf-8"))
SX, SY = d["parametry"]["srodek_osiedla"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=BOR2)
bpy.ops.import_scene.gltf(filepath=OKOLICA)


def flat_material(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1.0)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    return m


def lin(h):
    c = int(h, 16) / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    return tuple(lin(h[i:i + 2]) for i in (1, 3, 5))


# Workbench pokazuje kolor materiału z diffuse_color: przepisujemy z Base Color (gdy bez tekstury)
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is not None and not bsdf.inputs["Base Color"].is_linked:
        m.diffuse_color = tuple(bsdf.inputs["Base Color"].default_value)

# teren podglądu
me = bpy.data.meshes.new("PODGLAD_TEREN")
R = 520
me.from_pydata([(SX - R, SY - R, -0.03), (SX + R, SY - R, -0.03), (SX + R, SY + R, -0.03), (SX - R, SY + R, -0.03)],
               [], [[0, 1, 2, 3]])
me.materials.append(flat_material("PODGLAD_TEREN", hexrgb("#a3ad95")))
scene.collection.objects.link(bpy.data.objects.new("PODGLAD_TEREN", me))

# drzewa podglądu: stożki 8-boczne (pień 2 m + korona do 13 m)
pts = d["drzewa"]["las"] + d["drzewa"]["szpaler"] + d["drzewa"]["pojedyncze"]
V, F = [], []
for x, y in pts:
    o = len(V)
    V.append((x, y, 13.0))
    for k in range(8):
        a = 2 * math.pi * k / 8
        V.append((x + 2.8 * math.cos(a), y + 2.8 * math.sin(a), 2.0))
    for k in range(8):
        F.append([o, o + 1 + k, o + 1 + (k + 1) % 8])
    F.append([o + 1 + k for k in range(8)][::-1])
me = bpy.data.meshes.new("PODGLAD_DRZEWA")
me.from_pydata(V, [], F)
me.materials.append(flat_material("PODGLAD_DRZEWA", hexrgb("#6f8062")))
scene.collection.objects.link(bpy.data.objects.new("PODGLAD_DRZEWA", me))

for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
scene.eevee.taa_render_samples = 32
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = -0.35
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 86
world = bpy.data.worlds.new("podglad")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = (0.50, 0.62, 0.80, 1.0)
bg.inputs["Strength"].default_value = 1.0
# słońce z SSE, 42° nad horyzontem (jak cienie na estate-3 / estate-8, przybliżenie)
sun = bpy.data.lights.new("slonce", "SUN")
sun.energy = 3.2
sun.angle = math.radians(2.0)
sun_ob = bpy.data.objects.new("slonce", sun)
scene.collection.objects.link(sun_ob)
az, el = math.radians(160), math.radians(42)
sun_ob.rotation_euler = Euler((math.pi / 2 - el, 0, math.pi - az), "XYZ")

cam_data = bpy.data.cameras.new("podglad_cam")
cam_data.clip_start, cam_data.clip_end = 0.1, 3000
cam = bpy.data.objects.new("podglad_cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(path, w, h):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("PODGLAD", path)


def top(path, half, px):
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2 * half
    cam.location = (SX, SY, 600)
    cam.rotation_euler = (0, 0, 0)
    shoot(path, px, px)


def drone(path, loc, az_deg, pitch_deg, hfov_deg=73.7):
    cam_data.type = "PERSP"
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.angle = math.radians(hfov_deg)
    cam.location = loc
    cam.rotation_euler = Euler((math.radians(90 + pitch_deg), 0, math.radians(-az_deg)), "XYZ")
    shoot(path, 1440, 1080)


def side_by_side(render_path, photo_path, out_path):
    """Zdjęcie | render, 2 x 1440 x 1080 (numpy na pikselach Blendera)."""
    a = bpy.data.images.load(photo_path)
    a.scale(1440, 1080)
    b = bpy.data.images.load(render_path)
    pa = np.empty(1440 * 1080 * 4, dtype=np.float32)
    pb = np.empty(1440 * 1080 * 4, dtype=np.float32)
    a.pixels.foreach_get(pa)
    b.pixels.foreach_get(pb)
    pa, pb = pa.reshape(1080, 1440, 4), pb.reshape(1080, 1440, 4)
    out = np.concatenate([pa, np.ones((1080, 12, 4), np.float32), pb], axis=1)
    img = bpy.data.images.new("zestaw", out.shape[1], out.shape[0])
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = out_path
    img.file_format = "JPEG"
    img.save()
    print("PODGLAD", out_path)


top(os.path.join(OUT, "okolica-gora.jpg"), 470, 1800)
top(os.path.join(OUT, "okolica-gora-osiedle.jpg"), 160, 1600)
tmp3 = os.path.join(OUT, "_render-estate3.jpg")
drone(tmp3, (64.3, 28.8, 9.9), 32.5, -17.7)
side_by_side(tmp3, os.path.join(GALERIA, "estate-3.jpg"), os.path.join(OUT, "okolica-estate3.jpg"))
tmp8 = os.path.join(OUT, "_render-estate8.jpg")
drone(tmp8, (123.0, 42.0, 66.0), 280.5, -53.0)
side_by_side(tmp8, os.path.join(GALERIA, "estate-8.jpg"), os.path.join(OUT, "okolica-estate8.jpg"))
for p in (tmp3, tmp8):
    os.remove(p)
