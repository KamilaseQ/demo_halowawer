"""Inwentaryzacja wnętrza (.blend z importu SKP): hierarchia, materiały z trójkątami
(po instancjach), kamery, poziomy podłóg/sufitów.

    blender --background <plik.blend> --python wnetrze_inwentarz.py -- <wyjscie.json> [KOLEKCJA]
"""
import json
import math
import sys
from collections import defaultdict

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
coll_name = args[1] if len(args) > 1 else None
scene = bpy.context.scene


def parts(ob, world, path):
    if ob.type == "MESH" and ob.data and len(ob.data.polygons):
        yield ob, world, path
    coll = ob.instance_collection if ob.instance_type == "COLLECTION" else None
    if coll is not None:
        base = world @ Matrix.Translation(-coll.instance_offset)
        for child in coll.all_objects:
            if child.parent is None or child.parent.name not in coll.all_objects:
                pass
            yield from parts(child, base @ child.matrix_world, path + [child.name])


roots = [o for o in scene.objects if o.parent is None and o.type != "CAMERA"]
if coll_name:
    keep = set(bpy.data.collections[coll_name].all_objects)
    roots = [o for o in roots if o in keep]

mat_tris = defaultdict(int)
mat_info = {}
top_tris = defaultdict(int)
top_bounds = {}
floor_z = defaultdict(float)  # z -> area of upward faces
ceil_z = defaultdict(float)
mesh_uses = defaultdict(int)
mesh_tris_map = {}
n_parts = 0
all_lo, all_hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)


def visit_all(ob, mw, top):
    global n_parts, all_lo, all_hi
    for src, w, path in parts(ob, mw, [ob.name]):
        n_parts += 1
        me = src.data
        mesh_uses[me.name] += 1
        if me.name not in mesh_tris_map:
            mesh_tris_map[me.name] = sum(len(p.vertices) - 2 for p in me.polygons)
        slots = [s.material for s in src.material_slots]
        lo, hi = top_bounds.get(top, (Vector((1e9,) * 3), Vector((-1e9,) * 3)))
        for c in src.bound_box:
            p = w @ Vector(c)
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
        top_bounds[top] = (lo, hi)
        all_lo = Vector(map(min, all_lo, lo)); all_hi = Vector(map(max, all_hi, hi))
        nm = w.to_3x3().inverted_safe().transposed()
        for p in me.polygons:
            t = len(p.vertices) - 2
            m = slots[p.material_index] if p.material_index < len(slots) else None
            mn = m.name if m else "(brak)"
            mat_tris[mn] += t
            top_tris[top] += t
            n = (nm @ p.normal).normalized()
            if abs(n.z) > 0.98:
                area = p.area * abs(w.determinant()) ** (2 / 3)
                if area > 0.5:
                    z = round((w @ p.center).z, 2)
                    if n.z > 0:
                        floor_z[z] += area
                    else:
                        ceil_z[z] += area


for r in roots:
    visit_all(r, r.matrix_world, r.name)
    for c in r.children_recursive:
        visit_all(c, c.matrix_world, r.name)


def mat_desc(m):
    d = {"tris": mat_tris[m.name]}
    if m.use_nodes:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        imgs = [n.image.name + " %dx%d" % tuple(n.image.size) for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
        d["img"] = imgs
        if b:
            bc = b.inputs["Base Color"]
            if not bc.is_linked:
                d["rgb"] = [round(v, 3) for v in bc.default_value[:3]]
            a = b.inputs["Alpha"]
            d["alpha"] = "tex" if a.is_linked else round(a.default_value, 2)
    d["diffuse"] = [round(v, 3) for v in m.diffuse_color]
    return d


mats = {}
for name, t in sorted(mat_tris.items(), key=lambda kv: -kv[1]):
    m = bpy.data.materials.get(name)
    mats[name] = mat_desc(m) if m else {"tris": t}

cams = []
for c in scene.objects:
    if c.type != "CAMERA":
        continue
    d = c.matrix_world.to_3x3() @ Vector((0, 0, -1))
    cams.append({"name": c.name, "loc": [round(v, 2) for v in c.matrix_world.translation],
                 "dir": [round(v, 2) for v in d], "lens": round(c.data.lens, 1),
                 "fov_deg": round(math.degrees(c.data.angle), 1)})

res = {
    "file": bpy.data.filepath,
    "bounds": [[round(v, 2) for v in all_lo], [round(v, 2) for v in all_hi]],
    "parts": n_parts,
    "tris_instanced": sum(top_tris.values()),
    "unique_meshes": len(mesh_tris_map),
    "tris_unique": sum(mesh_tris_map.values()),
    "tops": {k: {"tris": v, "lo": [round(x, 2) for x in top_bounds[k][0]], "hi": [round(x, 2) for x in top_bounds[k][1]]}
             for k, v in sorted(top_tris.items(), key=lambda kv: -kv[1])},
    "floor_z": {str(k): round(v, 1) for k, v in sorted(floor_z.items()) if v > 2},
    "ceil_z": {str(k): round(v, 1) for k, v in sorted(ceil_z.items()) if v > 2},
    "materials": mats,
    "cameras": cams,
    "collections": [c.name for c in bpy.data.collections],
    "heavy_meshes": sorted([(n, mesh_tris_map[n], mesh_uses[n], mesh_tris_map[n] * mesh_uses[n]) for n in mesh_tris_map], key=lambda x: -x[3])[:40],
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=1)
print("INWENTARZ zapisano", out, res["tris_instanced"], len(mats))
