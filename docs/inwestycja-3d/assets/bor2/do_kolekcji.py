"""Porządkowanie .blend: przenosi obiekty najwyższego poziomu do wskazanej kolekcji i zapisuje plik.

Uruchomienie:
    blender --background <plik.blend> --python do_kolekcji.py -- <KOLEKCJA> [opcje] [<nazwa> ...]

Opcje:
    --wokol <obiekt>   dołącz też wszystkie obiekty najwyższego poziomu, których środek
                       leży w obrysie (XY, +0,5 m) wskazanego obiektu - np. luźne meble w domu
    --ukryj            schowaj kolekcję w widoku (NIE_EKSPORTUJ jest chowana zawsze)

Specjalna kolekcja NIE_EKSPORTUJ: obiekty zostają w pliku, ale blend_to_glb.py je pomija.
W samym Blenderze to samo robi się przeciągnięciem obiektu w Outlinerze (lub klawisz M).
"""
import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
target_name, rest = args[0], args[1:]
around, hide, names = None, target_name == "NIE_EKSPORTUJ", []
i = 0
while i < len(rest):
    if rest[i] == "--wokol":
        around = rest[i + 1]
        i += 2
    elif rest[i] == "--ukryj":
        hide = True
        i += 1
    else:
        names.append(rest[i])
        i += 1

scene = bpy.context.scene


def world_bounds(ob):
    """Obrys obiektu w świecie, z rozwinięciem instancji kolekcji."""
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

    visit(ob, ob.matrix_world)
    return lo, hi


target = bpy.data.collections.get(target_name)
if target is None:
    target = bpy.data.collections.new(target_name)
    scene.collection.children.link(target)

if around:
    ref = bpy.data.objects[around]
    lo, hi = world_bounds(ref)
    m = 0.5
    for ob in scene.objects:
        if ob.parent is not None or ob.type == "CAMERA" or ob.name == around or ob.name in names:
            continue
        if target_name != "NIE_EKSPORTUJ" and any(c.name in {"NIE_EKSPORTUJ"} for c in ob.users_collection):
            continue
        olo, ohi = world_bounds(ob)
        if olo.x > 1e17:
            continue
        c = (olo + ohi) / 2
        if lo.x - m <= c.x <= hi.x + m and lo.y - m <= c.y <= hi.y + m:
            names.append(ob.name)
    names.insert(0, around)

moved, missing = [], []
for name in names:
    ob = bpy.data.objects.get(name)
    if ob is None:
        missing.append(name)
        continue
    for obj in [ob] + list(ob.children_recursive):
        for c in list(obj.users_collection):
            if c is not target:
                c.objects.unlink(obj)
        if obj.name not in target.objects:
            target.objects.link(obj)
    moved.append(name)

layer_coll = next((lc for lc in bpy.context.view_layer.layer_collection.children if lc.collection is target), None)
if layer_coll is not None and hide:
    layer_coll.hide_viewport = True

bpy.context.preferences.filepaths.save_version = 0  # bez kopii .blend1 (tylko w tej sesji)
bpy.ops.wm.save_mainfile(compress=True)
print("KOLEKCJA %s: przeniesiono %d %s | brak: %s" % (target_name, len(moved), moved, missing))
