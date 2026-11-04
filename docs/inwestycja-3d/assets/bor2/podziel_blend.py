"""Wydziela jedną kolekcję z dużego .blend do osobnego, mniejszego pliku.

Uruchomienie:
    blender --background <duzy.blend> --python podziel_blend.py -- <KOLEKCJA> <wyjscie.blend> [usun_nazwa ...]

- opcjonalne nazwy na końcu: obiekty usuwane z pliku wynikowego na każdym poziomie
  zagnieżdżenia (np. błędnie przeskalowany model z 3D Warehouse),

- zostaje tylko wskazana kolekcja (np. DOM_1) i kamery ze scen SketchUpa,
  które stoją w jej obrysie (+2 m),
- reszta (inne domy, kontekst, podkłady) jest usuwana, a nieużywane dane
  (siatki, materiały, tekstury, definicje komponentów) są czyszczone,
- duży plik źródłowy nie jest zmieniany.
"""
import os
import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
coll_name, dst, remove_names = args[0], os.path.abspath(args[1]), args[2:]
scene = bpy.context.scene
removed = [n for n in remove_names if bpy.data.objects.get(n)]
for n in removed:
    bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
keep_coll = bpy.data.collections[coll_name]
keep = set(keep_coll.all_objects)


def bounds(objs):
    lo, hi = Vector((1e18,) * 3), Vector((-1e18,) * 3)

    def visit(o, mw):
        nonlocal lo, hi
        if o.type == "MESH" and o.data and len(o.data.vertices):
            for c in o.bound_box:
                p = mw @ Vector(c)
                lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
        coll = o.instance_collection if o.instance_type == "COLLECTION" else None
        if coll is not None:
            base = mw @ Matrix.Translation(-coll.instance_offset)
            for ch in coll.all_objects:
                visit(ch, base @ ch.matrix_world)

    for o in objs:
        visit(o, o.matrix_world)
    return lo, hi


lo, hi = bounds([o for o in keep if o.parent is None])
cams = []
for ob in list(scene.objects):
    if ob in keep:
        continue
    p = ob.matrix_world.translation
    if ob.type == "CAMERA" and all(lo[i] - 2 <= p[i] <= hi[i] + 2 for i in range(3)):
        cams.append(ob.name)
        continue
    bpy.data.objects.remove(ob, do_unlink=True)

# Kolekcje sceny inne niż wybrana (puste po usunięciu obiektów).
for child in list(scene.collection.children_recursive):
    if child is not keep_coll and child.name not in {c.name for c in keep_coll.children_recursive}:
        if not child.all_objects:
            bpy.data.collections.remove(child)

bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True, copy=True)
size = os.path.getsize(dst) / 2**20
print("PODZIAL %s -> %s (%.1f MB) | obiekty: %d | usuniete: %s | kamery: %s | wymiary: %s" % (
    coll_name, dst, size, len(keep), removed, cams, tuple(round(v, 1) for v in (hi - lo))))
