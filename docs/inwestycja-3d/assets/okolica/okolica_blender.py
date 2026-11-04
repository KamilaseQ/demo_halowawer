"""Krok 4/5: okolica-dane.json -> okolica.glb (+ okolica.blend), Blender headless.

Uruchomienie:
    blender --background --factory-startup --python okolica_blender.py -- dane/okolica-dane.json okolica.glb [okolica.blend]

Węzły GLB (Y-up, ten sam układ co bor2-zewnetrze.glb, bez centrowania; x = wschód, z = -północ):
    OKOLICA                     korzeń; extras: źródło (ODbL), georeferencja, liczby
      DUCH_001 … DUCH_nnn       budynki bliżej niż R_osobne_bryly od środka osiedla, każdy osobno,
                                posortowane wg odległości (001 = najbliższy); extras: osm, typ, dach…
      DUCH_DALEKIE_NE/NW/SE/SW  dalsze budynki scalone w ćwiartki (nie zasłonią osiedla przy orbicie ≤ 230 m)
      TEREN_DROGI               drogi, dojazdy, chodniki, parkingi (2 cm / 1,5 cm nad terenem)
      TEREN_BOISKO              płyta boiska (2 cm)
      BOISKO_LINIE              linie (3 cm) i bramki, materiał DUCH -> ledwo widoczne na DUCH_TEREN
      DRZEWA                    pusty węzeł; extras: punkty drzew (x, z) w zadrzewieniach OSM
Materiały: DUCH (#c9c9c6) i DUCH_TEREN (#b9bab5), roughness 1, metalness 0, bez tekstur, jednostronne.
Geometria float32 bez kompresji (meshopt Blendera jest stratny - patrz komentarz przy eksporcie).
"""
import json
import os
import struct
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], os.path.abspath(argv[1])
BLEND = os.path.abspath(argv[2]) if len(argv) > 2 else None
d = json.load(open(SRC, encoding="utf-8"))
P = d["parametry"]
SX, SY = P["srodek_osiedla"]
R_BLISKO = P["R_osobne_bryly"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = [srgb_to_lin(int(hexcol[i:i + 2], 16)) for i in (1, 3, 5)]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (*rgb, 1.0)
    m.roughness = 1.0
    m.use_backface_culling = True       # glTF doubleSided = false
    return m


DUCH = material("DUCH", "#c9c9c6")
DUCH_TEREN = material("DUCH_TEREN", "#b9bab5")

root = bpy.data.objects.new("OKOLICA", None)
scene.collection.objects.link(root)


def make(name, V, F, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in V], [], [list(f) for f in F])
    me.validate(verbose=False)
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = root
    return ob


def tris(F):
    return sum(len(f) - 2 for f in F)


stats = {"budynki": len(d["budynki"]), "osobne": 0, "scalone": 0, "trojkaty_budynki": 0}
blisko = [b for b in d["budynki"] if b["odl"] <= R_BLISKO]
daleko = [b for b in d["budynki"] if b["odl"] > R_BLISKO]
node_extras = {}
for i, b in enumerate(blisko, 1):
    name = "DUCH_%03d" % i
    make(name, b["v"], b["f"], DUCH)
    node_extras[name] = {"osm": b["osm"], "typ": b["typ"], "kondygnacje": b["kondygnacje"], "dach": b["dach"],
                         "okap": b["okap"], "wysokosc": b["wysokosc"], "odl": b["odl"],
                         **({"w_budowie": True} if b["w_budowie"] else {})}
    stats["trojkaty_budynki"] += tris(b["f"])
stats["osobne"] = len(blisko)
quads = {}
for b in daleko:
    dx, dy = b["srodek"][0] - SX, b["srodek"][1] - SY
    q = ("N" if dy >= 0 else "S") + ("E" if dx >= 0 else "W")
    quads.setdefault(q, []).append(b)
for q, lst in sorted(quads.items()):
    V, F = [], []
    for b in lst:
        o = len(V)
        V += b["v"]
        F += [[o + i for i in f] for f in b["f"]]
    name = "DUCH_DALEKIE_" + q
    make(name, V, F, DUCH)
    node_extras[name] = {"budynkow": len(lst), "osm": [b["osm"] for b in lst]}
    stats["trojkaty_budynki"] += tris(F)
    stats["scalone"] += len(lst)

V = d["drogi"]["v"] + d["place"]["v"]
o = len(d["drogi"]["v"])
F = d["drogi"]["f"] + [[o + i for i in f] for f in d["place"]["f"]]
make("TEREN_DROGI", V, F, DUCH_TEREN)
stats["trojkaty_drogi"] = tris(F)
make("TEREN_BOISKO", d["boisko"]["v"], d["boisko"]["f"], DUCH_TEREN)
make("BOISKO_LINIE", d["boisko_linie"]["v"], d["boisko_linie"]["f"], DUCH)
stats["trojkaty_boisko"] = tris(d["boisko"]["f"]) + tris(d["boisko_linie"]["f"])
drz = bpy.data.objects.new("DRZEWA", None)
scene.collection.objects.link(drz)
drz.parent = root
stats["trojkaty_razem"] = stats["trojkaty_budynki"] + stats["trojkaty_drogi"] + stats["trojkaty_boisko"]
print("OKOLICA", stats)

if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)

# Bez meshopt: kompresja meshopt eksportera Blendera 5.2 jest stratna (filtr wykładniczy ze wspólnym
# wykładnikiem x/y/z, ok. 11 bitów mantysy) - przy |x| ~ 100 m krok wynosi 1/16 m, przy ~400 m 1/4 m,
# więc drogi 2 cm nad terenem lądowały na z = 0. Float32 bez kompresji: ok. 1,15 MB, bezstratnie.
bpy.ops.export_scene.gltf(
    filepath=DST, export_format="GLB", use_active_scene=True, export_yup=True, export_apply=False,
    export_materials="EXPORT", export_cameras=False, export_lights=False, export_extras=False,
    export_animations=False, export_texcoords=False, export_normals=True,
    export_meshopt_compression_enable=False, export_draco_mesh_compression_enable=False,
)


# --- extras (zaokrąglone liczby) wstrzykiwane do JSON-a GLB --------------------------
def xz(points):
    out = []
    for x, y in points:
        out += [round(x, 1), round(-y, 1)]
    return out


with open(DST, "rb") as fh:
    blob = fh.read()
magic, ver, total = struct.unpack_from("<III", blob, 0)
jlen, jtype = struct.unpack_from("<II", blob, 12)
gl = json.loads(blob[20:20 + jlen].decode("utf-8"))
rest = blob[20 + jlen:]
gl["asset"]["copyright"] = "Dane: (c) OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright)"
drzewa = d["drzewa"]
for n in gl["nodes"]:
    nm = n.get("name")
    if nm == "OKOLICA":
        n["extras"] = {
            "zrodlo": "(c) OpenStreetMap contributors, ODbL 1.0",
            "osm_timestamp": d["osm_timestamp"],
            "uklad": "jak bor2-zewnetrze.glb: x = wschod, y = gora, z = -polnoc (poludnie), metry, bez centrowania",
            "srodek_osiedla_xz": [SX, -SY],
            "georef": d["georef"],
            "liczby": stats,
        }
    elif nm in node_extras:
        n["extras"] = node_extras[nm]
    elif nm == "DRZEWA":
        n["extras"] = {
            "opis": "punkty drzew (x, z) parami; y = 0 (teren). Zadrzewienia OSM natural=wood / landuse=forest, "
                    "ok. 1 drzewo / %g m2 (siatka heksagonalna z jitterem), szpalery natural=tree_row co 7 m, "
                    "pojedyncze natural=tree. Bez punktow na budynkach, drogach, osiedlu i sasiadach BOR2."
                    % P["drzewo_m2"],
            "las_xz": xz(drzewa["las"]),
            "szpaler_xz": xz(drzewa["szpaler"]),
            "pojedyncze_xz": xz(drzewa["pojedyncze"]),
            "obrysy": [{"osm": o["osm"], "drzew": o["drzew"], "pole_m2": o["pole"], "xz": xz(o["obrys"])}
                       for o in drzewa["obrysy"]],
        }
js = json.dumps(gl, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
js += b" " * ((4 - len(js) % 4) % 4)
out = struct.pack("<III", magic, ver, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), jtype) + js + rest
with open(DST, "wb") as fh:
    fh.write(out)
print("OKOLICA zapisano %s (%.3f MB), JSON %d B" % (DST, len(out) / 2 ** 20, len(js)))
