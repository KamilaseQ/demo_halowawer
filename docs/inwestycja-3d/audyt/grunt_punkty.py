"""Blender headless: środki ścian elementów przy gruncie z GLB zewnętrza, wg materiału → JSON (układ GLB: x, y, z).

    blender --background --factory-startup --python grunt_punkty.py -- <zewnetrze.glb> <wyjscie.json>
"""
import json
import random
import re
import sys

import bpy

glb, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
KLASY = {  # klasa → wzorce nazw materiałów (runtime/GLB)
    "plot": [r"OGRODZENIE_PRETY", r"OGRODZENIE_PANEL", r"OGRODZENIE_SLUPKI"],
    "geokrata": [r"GEOKRATA"],
    "sciezka": [r"DROGA", r"Asphalt Stamped Brick", r"ASFALT", r"KOSTKA"],
    "taras": [r"PLYTY_TARAS", r"DREWNO", r"TARAS"],
    "murek": [r"^TYNK [ABC]$", r"^BLACHA [ABC]$"],
}
pts = {k: [] for k in KLASY}
houses = {}
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    mw = o.matrix_world
    top = o
    while top.parent:
        top = top.parent
    if top.name.startswith("DOM_"):
        bb = [mw @ v.co for v in o.data.vertices]
        if bb:
            h = houses.setdefault(top.name, [1e9, 1e9, 1e9, -1e9, -1e9, -1e9])
            for v in bb:  # Blender (x, y, z) → GLB (x, z, −y)
                g = (v.x, v.z, -v.y)
                for i in range(3):
                    h[i] = min(h[i], g[i]); h[i + 3] = max(h[i + 3], g[i])
        continue
    me = o.data
    me.calc_loop_triangles()
    rnd = random.Random(7)
    for t in me.loop_triangles:  # punkty na powierzchni: środek + ~1 punkt na 2 m² (duże wielokąty geokraty i ścieżek)
        slot = o.material_slots[t.material_index] if t.material_index < len(o.material_slots) else None
        name = slot.material.name if slot and slot.material else ""
        k = next((k for k, pats in KLASY.items() if any(re.search(pt, name) for pt in pats)), None)
        if not k:
            continue
        a, b, c = (mw @ me.vertices[i].co for i in t.vertices)
        n = 1 if k == "plot" else max(1, int(t.area / 2))
        for _ in range(n):
            u, v = rnd.random(), rnd.random()
            if u + v > 1:
                u, v = 1 - u, 1 - v
            q = a + (b - a) * u + (c - a) * v if n > 1 else (a + b + c) / 3
            pts[k].append([round(q.x, 2), round(q.z, 2), round(-q.y, 2)])
json.dump({"punkty": pts, "domy": houses}, open(out, "w", encoding="utf-8"))
print("GRUNT_OK", {k: len(v) for k, v in pts.items()})
