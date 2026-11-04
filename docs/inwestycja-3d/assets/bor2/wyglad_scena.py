"""Światło, niebo, render i kamery porównawcze dla zewnętrza BOR2 (tylko do renderów kontrolnych w Blenderze;
światło w aplikacji liczy 55 w czasie rzeczywistym, do GLB nic stąd nie trafia).

Słońce: Zerzeń 52,189 N, 21.09 15:30 CEST, az. 232,4°, wys. 26,1° (docs/inwestycja-3d/02-materialy-3d.md §6).
Układ SketchUpa: X = wschód, Y = północ, Z = góra.

Uruchomienie w Blenderze (MCP): exec(open(r"<ten plik>", encoding="utf-8").read())
"""
import math
import os

import bpy
from mathutils import Vector

SC = bpy.context.scene
HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    r"D:\3D_Kamil\demo_halowawer\docs\inwestycja-3d\assets\bor2"

# kierunek DO słońca w układzie Blendera (x=E, y=N, z=up)
AZ, EL = math.radians(232.4), math.radians(26.1)
SUN_DIR = Vector((math.sin(AZ) * math.cos(EL), math.cos(AZ) * math.cos(EL), math.sin(EL)))

SUN_STRENGTH = 4.2
SKY_STRENGTH = 0.12
EXPOSURE = 0.0
HDRI_STRENGTH = 1.0


def wyglad_coll():
    c = bpy.data.collections.get("WYGLAD_RENDER")
    if c is None:
        c = bpy.data.collections.new("WYGLAD_RENDER")
        SC.collection.children.link(c)
    return c


def link(ob):
    col = wyglad_coll()
    if ob.name not in col.objects:
        col.objects.link(ob)


def sun():
    ob = bpy.data.objects.get("WYGLAD_Slonce")
    if ob is None:
        ld = bpy.data.lights.new("WYGLAD_Slonce", "SUN")
        ob = bpy.data.objects.new("WYGLAD_Slonce", ld)
        link(ob)
    ob.data.energy = SUN_STRENGTH
    ob.data.color = (1.0, 0.89, 0.76)          # popołudniowe, lekko złote
    ob.data.angle = math.radians(0.8)
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(SUN_DIR)
    ob.location = (60, 10, 40)
    return ob


def world():
    w = SC.world or bpy.data.worlds.new("WYGLAD_Swiat")
    SC.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    types = [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items]
    for t in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE", "PREETHAM"):
        if t in types:
            sky.sky_type = t
            break
    for attr, val in (("sun_disc", False), ("sun_elevation", EL), ("air_density", 1.0),
                      ("dust_density", 1.5), ("ozone_density", 1.0), ("altitude", 100.0)):
        if hasattr(sky, attr):
            setattr(sky, attr, val)
    if hasattr(sky, "sun_rotation"):
        # 0 = słońce od +X (wschód)?, w praktyce sprawdzane w podglądzie; azymut liczony od N zgodnie z ruchem wskazówek
        sky.sun_rotation = math.radians(90.0) - AZ
    if hasattr(sky, "sun_direction"):
        sky.sun_direction = SUN_DIR
    bg.inputs["Strength"].default_value = SKY_STRENGTH
    nt.links.new(sky.outputs[0], bg.inputs[0])
    # światło otoczenia z tego samego HDRI co aplikacja (Lighting.tsx), niebo tylko jako tło kamery
    import os
    hdr = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "public", "explorer", "3d", "hdri", "zawiszy_czarnego_512.hdr"))
    if os.path.exists(hdr):
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdr, check_existing=True)
        bg2 = nt.nodes.new("ShaderNodeBackground")
        bg2.inputs["Strength"].default_value = HDRI_STRENGTH
        nt.links.new(env.outputs[0], bg2.inputs[0])
        lp = nt.nodes.new("ShaderNodeLightPath")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
        nt.links.new(bg2.outputs[0], mix.inputs[1])
        nt.links.new(bg.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
    else:
        nt.links.new(bg.outputs[0], out.inputs[0])
    print("sky", sky.sky_type)


def render():
    r = SC.render
    try:
        r.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        try:
            r.engine = "BLENDER_EEVEE"
        except TypeError as e:
            print(e)
    r.resolution_x, r.resolution_y = 1920, 1248
    r.resolution_percentage = 50
    ee = SC.eevee
    for attr, val in (("taa_render_samples", 64), ("use_shadows", True), ("use_raytracing", True),
                      ("shadow_ray_count", 2), ("shadow_step_count", 8), ("use_gtao", True),
                      ("fast_gi_method", "GLOBAL_ILLUMINATION")):
        if hasattr(ee, attr):
            try:
                setattr(ee, attr, val)
            except (TypeError, ValueError):
                pass
    vs = SC.view_settings
    looks = [i.identifier for i in vs.bl_rna.properties["view_transform"].enum_items]
    vs.view_transform = "AgX" if "AgX" in looks else "Filmic"
    try:
        vs.look = "AgX - Base Contrast" if vs.view_transform == "AgX" else "None"
    except TypeError:
        pass
    vs.exposure = EXPOSURE


def camera(name, loc, rot_deg, lens=35.0, shift=(0.0, 0.0)):
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        link(ob)
    ob.location = loc
    ob.rotation_mode = "XYZ"
    ob.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    ob.data.lens = lens
    ob.data.sensor_width = 36
    ob.data.shift_x, ob.data.shift_y = shift
    ob.data.clip_end = 2000
    return ob


def cameras():
    # visualization-1: ogrody od południa, bliźniak D·C frontalnie, oko ~1,7 m, perspektywa 2-punktowa
    # para D·C: x 65,6–82,0; elewacja ogrodowa y ≈ 42–43,6; grunt z ≈ 0,4
    camera("WYGLAD_wiz1", (73.8, 19.0, 2.1), (90, 0, 0), lens=35, shift=(0.0, 0.2))
    # visualization-3: front od północy, para D·C
    camera("WYGLAD_wiz3", (73.8, 77.0, 2.1), (90, 0, 180), lens=35, shift=(0.0, 0.2))
    # visualization-5: szereg G·F·E od północnego wschodu (front), lekki skos
    # szereg G·F·E: x 33,4–56,0; front y ≈ 57–60
    camera("WYGLAD_wiz5", (63.0, 76.0, 2.0), (90, 0, 136), lens=30, shift=(0.0, 0.15))


sun()
world()
render()
cameras()
print("scena gotowa; sun dir", tuple(round(v, 3) for v in SUN_DIR))
