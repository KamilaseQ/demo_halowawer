"""Szyby we wnętrzu: w SKP większość okien nie ma szkła, przez co widok ogrodu w three.js jest przepalony.
Dodaje taflę (4 mm, materiał SZKLO, lekko szara, ~15 % krycia) w płaszczyźnie szyby bryły zewnętrznej
dla każdego okna z wnetrza-kontrola/okna-zewn-<dom>.json (bez okien dachowych). Uruchamiać po lightmapach
(węzeł TRANSPARENT nie ma lightmapy), przed wnetrze_glb.py; nadpisuje plik.

    blender --background <domN-lm.blend> --python wnetrze_szyby.py -- domN
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wnetrze_wspolne as W  # noqa: E402
from wnetrze_konfig import KONFIG  # noqa: E402

KEY = sys.argv[sys.argv.index("--") + 1]
C = KONFIG[KEY]
DOM = C["dom"]
wins = json.load(open(os.path.join(HERE, "wnetrza-kontrola", "okna-zewn-%s.json" % DOM), encoding="utf-8"))
skip = set(C.get("szyby_pomin", []))
mat = bpy.data.materials.get("SZKLO") or W.make_material("SZKLO", W.BIB["SZKLO"])
added = {}
for i, w in enumerate(wins):
    if i in skip:
        continue
    ax = 0 if w["x"][1] - w["x"][0] < 0.05 else 1
    lo = Vector((w["x"][0], w["y"][0], w["z"][0]))
    hi = Vector((w["x"][1], w["y"][1], w["z"][1]))
    lo[ax] -= 0.002
    hi[ax] += 0.002
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    c, s = (lo + hi) / 2, hi - lo
    for v in bm.verts:
        v.co = Vector((c.x + v.co.x * s.x, c.y + v.co.y * s.y, c.z + v.co.z * s.z))
    kond = 0 if c.z < C["granica"] else 1
    added.setdefault(kond, []).append(bm)
for kond, bms in added.items():
    me = bpy.data.meshes.new("szyby")
    big = bmesh.new()
    for bm in bms:
        tmp = bpy.data.meshes.new("_t")
        bm.to_mesh(tmp)
        bm.free()
        big.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    big.to_mesh(me)
    big.free()
    me.materials.append(mat)
    me.uv_layers.new(name=W.UV0)
    ca = me.color_attributes.new(W.VCOL, "FLOAT_COLOR", "CORNER")
    ca.data.foreach_set("color", np.ones(len(me.loops) * 4, dtype=np.float32))
    node = bpy.data.objects.get("KOND_%d__TRANSPARENT" % kond)
    ob = bpy.data.objects.new("szyby", me)
    bpy.context.scene.collection.objects.link(ob)
    if node is None:
        continue
    # LM: węzeł mógł dostać drugą warstwę UV - dopasuj
    for uv in node.data.uv_layers[1:]:
        me.uv_layers.new(name=uv.name)
    with bpy.context.temp_override(active_object=node, selected_editable_objects=[node, ob],
                                   selected_objects=[node, ob], object=node):
        bpy.ops.object.join()
    names = []
    for sl in node.material_slots:
        names.append(sl.material.name)
    print("SZYBY KOND_%d: +%d tafli, materialy %s" % (kond, len(bms), names))
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_mainfile(compress=True)
