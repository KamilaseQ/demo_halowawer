"""Wspólne elementy skryptów wnętrz (Blender): biblioteka materiałów PBR zgodnych z glTF.

Materiały są proste (Principled BSDF + tekstury obrazowe + Color Attribute), żeby eksporter
glTF przeniósł je 1:1 do three.js:
- kolor bazowy: stała albo tekstura (UV "UVMap" = TEXCOORD_0), opcjonalnie x kolor wierzchołków "Col"
  (COLOR_0: jeden materiał DETAL/TKANINA obsługuje wiele kolorów -> mniej materiałów i draw calli),
- normal map (tekstura Non-Color -> Normal Map),
- roughness / metallic / alpha / emisja jako stałe,
- wszystkie dwustronne (SKP ma odwrócone ściany).
Druga mapa UV "LM" (TEXCOORD_1) jest na lightmapy, materiały jej nie używają.
"""
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "wnetrza-tex")
PUB = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "public", "explorer", "3d", "textures"))

UV0, UV1, VCOL = "UVMap", "LM", "Col"


def s2l(c):
    """sRGB 0-255 -> liniowy 0-1."""
    out = []
    for v in c[:3]:
        v = v / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# Biblioteka: nazwa -> parametry.  rgb w sRGB 0-255.  tex: plik w wnetrza-tex/ albo ("pub", "folder/plik").
# tile: rozmiar kafla tekstury w metrach dla UV generowanych (box/planar).
BIB = {
    "PODLOGA":    dict(tex="podloga_d1.jpg", rough=0.42, tile=None),           # tile mierzony z SKP
    "TYNK":       dict(rgb=(238, 235, 229), rough=0.92),
    "TYNK_ZEWN":  dict(rgb=(236, 233, 226), rough=0.95),                      # runtime przemalowuje na elewację
    "OKNA_ZEWN":  dict(rgb=(0x4a, 0x3a, 0x30), rough=0.5),
    "BIALY":      dict(rgb=(230, 224, 214), rough=0.42),       # złamana ciepła biel frontów (#e6e0d6)
    "DAB":        dict(tex="dab_d1.jpg", rough=0.55, tile=None),
    "DAB_CIEMNY": dict(tex="dab_ciemny.jpg", rough=0.5, tile=1.0),
    "DAB_JASNY":  dict(tex="dab_d1.jpg", rough=0.55, tile=1.0),          # dom2: krzesła, fronty kuchni (int-1)
    "RYFLE":      dict(rgb=(234, 234, 230), rough=0.3, normal="lamele_n.png", normal_k=0.8, tile=0.24),
    "SZALWIA":    dict(rgb=(182, 184, 170), rough=0.55),
    "PLYTKI":     dict(rgb=(204, 206, 190), rough=0.25),
    "KAMIEN":     dict(tex=None, rough=0.3, tile=None),                       # tekstura z SKP
    "MARMUR":     dict(tex=None, rough=0.25, tile=None),
    "TKANINA":    dict(tex="tkanina.jpg", normal="tkanina_n.jpg", rough=0.92, tile=0.25, vcol=True),
    "ZASLONA":    dict(rgb=(240, 230, 214), normal="tkanina_n.jpg", rough=0.95, tile=0.18, alpha=0.85,
                       emis=(255, 238, 214), emis_k=0.5),
    "FIRANA":     dict(rgb=(250, 246, 238), normal="tkanina_n.jpg", rough=0.95, tile=0.12, alpha=0.5,
                       emis=(255, 244, 228), emis_k=0.6),
    "LAMPA":      dict(rgb=(246, 244, 240), rough=0.75, emis=(255, 246, 232), emis_k=0.5),
    "METAL":      dict(rgb=(200, 200, 198), rough=0.3, metal=1.0),
    "SZKLO":      dict(rgb=(92, 98, 98), rough=0.05, alpha=0.15),  # przyciemnia widok za oknem o ok. 15 %
    "DETAL":      dict(rgb=(255, 255, 255), rough=0.6, vcol=True),
    "OBRAZ_1":    dict(tex=None, rough=0.7, tile=None),
    "OBRAZ_2":    dict(tex=None, rough=0.7, tile=None),
    "DYWAN":      dict(tex=None, rough=0.95, tile=None),
    "CERAMIKA":   dict(rgb=(246, 246, 244), rough=0.15),
    "PLYTKA_PODL": dict(tex="plytka_podl.jpg", rough=0.35, tile=1.2),
    "LISCIE":     dict(tex="liscie.png", rough=0.7, tile=None, alpha_clip=True),
    "LAMELE":     dict(rgb=(238, 235, 229), rough=0.85, normal="lamele_n.png", normal_k=1.0, tile=0.48),
}
TRANSPARENT = {"SZKLO", "ZASLONA", "FIRANA"}


def load_image(path):
    for im in bpy.data.images:
        if im.filepath and os.path.normcase(bpy.path.abspath(im.filepath)) == os.path.normcase(path):
            return im
    return bpy.data.images.load(path)


def tex_path(t):
    if isinstance(t, tuple):
        return os.path.join(PUB, *t[1].split("/"))
    return os.path.join(TEX, t)


def make_material(name, spec, image=None):
    """Tworzy materiał biblioteki. image: gotowy bpy Image (np. tekstura z SKP) zamiast spec['tex']."""
    old = bpy.data.materials.get(name)
    if old is not None:
        old.name = "skp_" + name
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in {"BSDF_PRINCIPLED", "OUTPUT_MATERIAL"}:
            nt.nodes.remove(n)
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = spec.get("rgb", (255, 255, 255))
    b.inputs["Base Color"].default_value = (*s2l(rgb), 1.0)
    b.inputs["Roughness"].default_value = spec.get("rough", 0.6)
    b.inputs["Metallic"].default_value = spec.get("metal", 0.0)
    for nm in ("Specular IOR Level", "Specular"):
        if nm in b.inputs:
            b.inputs[nm].default_value = 0.5
            break
    if image is None and spec.get("tex"):
        image = load_image(tex_path(spec["tex"]))
    base_src = None
    if image is not None:
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = UV0
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = image
        tx.interpolation = "Linear"
        nt.links.new(uvn.outputs["UV"], tx.inputs["Vector"])
        base_src = tx.outputs["Color"]
    if spec.get("vcol"):
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = VCOL
        if base_src is not None:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(base_src, mix.inputs[6])
            nt.links.new(vc.outputs["Color"], mix.inputs[7])
            base_src = mix.outputs[2]
        else:
            base_src = vc.outputs["Color"]
    if base_src is not None:
        nt.links.new(base_src, b.inputs["Base Color"])
    if spec.get("alpha_clip") and image is not None:
        rnd = nt.nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        nt.links.new(tx.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], b.inputs["Alpha"])
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            m.blend_method = "CLIP"
    if spec.get("normal"):
        uvn2 = nt.nodes.new("ShaderNodeUVMap")
        uvn2.uv_map = UV0
        nx = nt.nodes.new("ShaderNodeTexImage")
        nx.image = load_image(tex_path(spec["normal"]))
        nx.image.colorspace_settings.name = "Non-Color"
        nt.links.new(uvn2.outputs["UV"], nx.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.uv_map = UV0
        nm.inputs["Strength"].default_value = spec.get("normal_k", 1.0)
        nt.links.new(nx.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    a = spec.get("alpha", 1.0)
    b.inputs["Alpha"].default_value = a
    if a < 1.0:
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            m.blend_method = "BLEND"
    if spec.get("emis"):
        ec = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[ec].default_value = (*s2l(spec["emis"]), 1.0)
        b.inputs["Emission Strength"].default_value = spec.get("emis_k", 1.0)
    m["bib"] = name
    return m


def bake_image_node(mat, image, uv_name=UV1):
    """Dodaje (lub podmienia) aktywny węzeł obrazu do wypiekania, na UV lightmapy."""
    nt = mat.node_tree
    node = next((n for n in nt.nodes if n.get("lm_bake") and n.type == "TEX_IMAGE"), None)
    if node is None:
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = uv_name
        uvn["lm_bake"] = 1
        node = nt.nodes.new("ShaderNodeTexImage")
        node["lm_bake"] = 1
        nt.links.new(uvn.outputs["UV"], node.inputs["Vector"])
    node.image = image
    nt.nodes.active = node
    node.select = True
    return node


def remove_bake_nodes(mat):
    nt = mat.node_tree
    for n in [n for n in nt.nodes if n.get("lm_bake")]:
        nt.nodes.remove(n)


def normalize_uv(me, layer=UV0):
    """Przesuwa UV o całkowite kafle (wygląd bez zmian), żeby wartości były blisko 0 -
    kwantyzacja TEXCOORD (KHR_mesh_quantization) nie gubi wtedy precyzji."""
    import numpy as np
    uvl = me.uv_layers.get(layer)
    if uvl is None or not len(me.loops):
        return
    uv = np.empty(len(me.loops) * 2)
    uvl.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    uv -= np.floor(uv.min(axis=0))
    uvl.data.foreach_set("uv", uv.ravel())


def sync_material(m):
    """Uaktualnia stałe parametry materiału biblioteki (kolor, roughness, alpha, emisja) wg BIB -
    pozwala poprawić kolory bez ponownego wypiekania lightmap."""
    spec = BIB.get(m.get("bib", ""))
    if not spec or not m.use_nodes:
        return False
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if b is None:
        return False
    if not b.inputs["Base Color"].is_linked:
        b.inputs["Base Color"].default_value = (*s2l(spec.get("rgb", (255, 255, 255))), 1.0)
    b.inputs["Roughness"].default_value = spec.get("rough", 0.6)
    if not b.inputs["Alpha"].is_linked:
        b.inputs["Alpha"].default_value = spec.get("alpha", 1.0)
    if spec.get("emis"):
        ec = "Emission Color" if "Emission Color" in b.inputs else "Emission"
        b.inputs[ec].default_value = (*s2l(spec["emis"]), 1.0)
        b.inputs["Emission Strength"].default_value = spec.get("emis_k", 1.0)
    if spec.get("alpha_clip") and spec.get("tex"):
        tx = next((n for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and not n.get("lm_bake")
                   and n.image and n.image.colorspace_settings.name != "Non-Color"), None)
        path = tex_path(spec["tex"])
        if tx is not None and os.path.normcase(bpy.path.abspath(tx.image.filepath)) != os.path.normcase(path):
            tx.image = load_image(path)
    return True
