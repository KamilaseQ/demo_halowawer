"""Konwersja SKP -> .blend (Blender 5.2 + rozszerzenie "SketchUp IO" / skppy).

Uruchomienie (w tle, bez okna Blendera):
    blender --background --python skp_to_blend.py -- <wejscie.skp> <wyjscie.blend>

- Komponenty SketchUpa trafiają do Blendera jako instancje kolekcji
  (use_collection_instances), więc powtarzalne elementy nie mnożą obiektów.
- Tekstury są pakowane do .blend, żeby plik był samowystarczalny.
- Na końcu wypisuje statystyki (linie "STAT ...").
"""
import sys
import time

import bpy
from mathutils import Vector

src, dst = sys.argv[sys.argv.index("--") + 1:][:2]

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "METERS"

t = time.time()
result = bpy.ops.import_scene.skp(
    filepath=src,
    use_collection_instances=True,
    import_materials=True,
    import_cameras=True,
    merge_vertices=True,
    smooth_edges=True,
)
print("STAT import=%s czas=%.1fs" % (sorted(result), time.time() - t))

# Tekstury do środka pliku .blend.
unpacked = [i for i in bpy.data.images if i.source == "FILE" and not i.packed_file]
if unpacked:
    try:
        bpy.ops.file.pack_all()
    except RuntimeError as exc:
        print("STAT pakowanie tekstur: blad", exc)

# Statystyki.
objs = list(scene.objects)
by_type = {}
for o in objs:
    by_type[o.type] = by_type.get(o.type, 0) + 1
instancers = [o for o in objs if o.instance_type == "COLLECTION" and o.instance_collection]
meshes = [m for m in bpy.data.meshes if m.users]
tris = sum(sum(len(p.vertices) - 2 for p in m.polygons) for m in meshes)
print("STAT obiekty w scenie=%d %s" % (len(objs), by_type))
print("STAT instancje kolekcji=%d, kolekcje=%d" % (len(instancers), len(bpy.data.collections)))
print("STAT siatki (unikalne)=%d, trojkaty w unikalnych siatkach=%d" % (len(meshes), tris))
print("STAT materialy=%d, obrazy=%d (spakowane=%d)" % (
    len(bpy.data.materials), len(bpy.data.images),
    sum(1 for i in bpy.data.images if i.packed_file)))

# Wymiary całego modelu z uwzględnieniem instancji (przez depsgraph).
deps = bpy.context.evaluated_depsgraph_get()
lo = Vector((1e18, 1e18, 1e18))
hi = -lo
for inst in deps.object_instances:
    ob = inst.object
    if ob.type != "MESH":
        continue
    for c in ob.bound_box:
        p = inst.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, p))
        hi = Vector(map(max, hi, p))
if lo.x < 1e17:
    size = hi - lo
    print("STAT wymiary [m] X=%.2f Y=%.2f Z=%.2f, min=(%.2f, %.2f, %.2f)" % (*size, *lo))

for cam in bpy.data.cameras:
    cam.clip_end = max(cam.clip_end, 2000.0)

bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True)
print("STAT zapisano=%s" % dst)
