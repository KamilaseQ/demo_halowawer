"""Prostokąty przęseł płotu z oryginalnego bor2-zewnetrze.blend -> JSON (do siatki kolizji OGRODZENIE_KOLIZJA).

    blender --background bor2-zewnetrze.blend --python wyglad_plot_kolizja.py -- plot_przesla.json

Przęsło w SKP to cienka bryła z dwoma licami: zostaje jedno lico na przęsło (pary przeciwnych lic < 12 cm).
Wynik: lista przęseł [[x,y,z] x 4] w układzie świata SketchUpa (X = wschód, Y = północ, Z = góra).
"""
import json
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1]
MAT = "[Translucent Glass Gray]"
dg = bpy.context.evaluated_depsgraph_get()
faces = []
for inst in dg.object_instances:
    ob = inst.object
    if ob.type != "MESH":
        continue
    names = [s.material.name if s.material else "" for s in ob.material_slots]
    if MAT not in names:
        continue
    M = inst.matrix_world
    R = M.to_3x3()
    for p in ob.data.polygons:
        if p.material_index >= len(names) or names[p.material_index] != MAT or p.area < 0.2:
            continue
        n = (R @ p.normal).normalized()
        if abs(n.z) > 0.5:
            continue
        vs = [M @ ob.data.vertices[v].co for v in p.vertices]
        c = sum(vs, vs[0] * 0) / len(vs)
        faces.append((n, c, [list(map(float, v)) for v in vs]))
kept = []
for n, c, vs in faces:
    if any(n.dot(n2) < -0.99 and abs((c - c2).dot(n)) < 0.12 and (c - c2).length < 1.0 for n2, c2, _ in kept):
        continue
    kept.append((n, c, vs))
json.dump([vs for _, _, vs in kept], open(out, "w"), indent=0)
print("PLOT przesla:", len(faces), "lic ->", len(kept), "przesel")
