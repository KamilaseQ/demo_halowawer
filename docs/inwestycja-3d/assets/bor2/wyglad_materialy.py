"""Materiały zewnętrza BOR2 dopasowane do wizualizacji dewelopera (public/explorer/gallery/visualization-*.jpg).

Uruchomienie:
  - w otwartym Blenderze (MCP):  exec(open(r"<ten plik>", encoding="utf-8").read())
  - headless: blender --background bor2-zewnetrze-wyglad.blend --python wyglad_materialy.py -- zapisz

Wszystkie materiały są zgodne z eksporterem glTF (Principled BSDF + ewentualnie Image Texture,
Mapping -> KHR_texture_transform, Normal Map). Bez węzłów proceduralnych, których three.js nie zobaczy.

Schematy kolorów z modelu architekta (SketchUp) zgadzają się z renderami:
  A (domy F i A):  taupe greige, stolarka ciemnozielona, wnęka wejścia szałwiowa
  B (domy E, D, B): jasny ciepły szary, stolarka greige, wnęka szałwiowa
  C (domy G i C):  taupe/beż, stolarka ciemny brąz, wnęka czekoladowa
Kolory (sRGB) próbkowane z visualization-1/3/5, potem skalibrowane w three.js (verify.mjs: NeutralToneMapping,
ciepłe słońce, jak w aplikacji): albedo jest celowo bardziej neutralne niż piksele renderu, bo ciepło
dokłada słońce i odbicie od trawy. Bez tego w /domy tynki wychodzą brzoskwiniowe.
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    r"D:\3D_Kamil\demo_halowawer\docs\inwestycja-3d\assets\bor2"
GRUNT = os.path.normpath(os.path.join(HERE, "..", "grunt"))


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# nazwa materiału SKP -> (kolor sRGB, roughness, metallic)
PALETA = {
    # tynki elewacji
    "TYNK A": ("#b0a9a1", 0.92, 0.0),
    "TYNK B": ("#c9c3ba", 0.92, 0.0),
    "TYNK C": ("#aa9f93", 0.92, 0.0),
    # wnęki wejścia / akcenty (wnęka, drzwi, brama w kolorze akcentu)
    # D-003 (b6, vis-3/vis-4): cała wnęka wejściowa i garażowa = jeden ton, kolor drzwi/stolarki domu
    "TYNK A2": ("#2e3a31", 0.8, 0.0),
    "TYNK B2": ("#8b8a7e", 0.85, 0.0),
    "TYNK C2": ("#5e504b", 0.85, 0.0),
    # stolarka okienna (aluminium/PVC, satyna)
    "OKNA A": ("#2e3a31", 0.45, 0.1),
    "OKNA B": ("#8b8a7e", 0.45, 0.1),     # = TYNK B2 (szałwiowo-greige drzwi, brama, ramy)
    "OKNA C": ("#5e504b", 0.45, 0.05),    # brąz mniej nasycony (w runtime wychodził czerwony)
    # dach na rąbek stojący, kominy w kolorze dachu
    # dachy: na renderach ciepłe (b* +4…+10); w runtime metallic 0,1 odbijał niebo (b* −2…−8) -> metallic 0,
    # albedo cieplejsze przy tej samej jasności (L* 60/66/57), jasność dopiero po świetle 55
    "BLACHA A": ("#989084", 0.42, 0.12),   # blacha: lekki połysk metalu (scorecard b* pilnuje odbicia nieba)
    "BLACHA B": ("#a89f94", 0.42, 0.12),
    "BLACHA C": ("#948778", 0.42, 0.12),
    "Obróbki": ("#8f8980", 0.55, 0.0),
    # drobne elementy domów
    "LATARNIA": ("#3a3a3a", 0.5, 0.3),              # słupki oświetleniowe (w SKP "A03_Pink_Ember")
    # tarasy -> PLYTY_TARAS (tekstura płyt 60x60, funkcja slab_material)
}

# Kontekst (sąsiedzi) -> szare "duchy" (wymaganie klienta, b6): jednolity, matowy, bez tekstur
DUCH = ("#c9c9c6", 1.0, 0.0)
KONTEKST_MAT = ["TYNK BEŻOWY", "DACHÓWKA 1", "DACHÓWKA 2", "ELEWACJA CEGLANA", "BALUSTRADA",
                "[Color M00]"]

# szyby: ciemne, z odbiciem nieba (nie mleczne)
SZYBY = ["SZYBY1"]
# ogrodzenie panelowe (pręty z alfą), antracyt; w SKP materiał zastępczy "[Translucent Glass Gray]"
OGRODZENIE = ["OGRODZENIE_PANEL"]
RENAME = {"[Translucent Glass Gray]": "OGRODZENIE_PANEL", "A03_Pink_Ember": "LATARNIA", "DREWNO": "PLYTY_TARAS"}
# D-004: podjazdy przed garażami (w SKP "SKP Default") -> kostka; 55 mapuje KOSTKA* na swój shader kostki
PODJAZD = ("KOSTKA_PODJAZD", "#b4b1ab", 0.85)

# grunt: tekstury CC0 z ../grunt (ambientCG), kafel w metrach (UV SketchUpa są w metrach)
GRUNT_MAT = {
    # (folder, kafel m, tint, roughness stała albo None = z mapy, specular)
    "OTOCZENIE 1": ("Grass004", 2.5, "#f2f0e0", 1.0, 0.25),
    "DROGA WEWNĘTRZNA": ("PavingStones128", 2.0, "#d8d6d2", None, None),
}
PLASKIE = {
    "ASFALT": ("#4d4d4b", 0.9, 0.0),
}


def principled(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.location = (0, 0)
    nt.links.new(b.outputs[0], out.inputs[0])
    for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "OPAQUE")):
        try:
            setattr(mat, attr, val)
        except (AttributeError, TypeError):
            pass
    return nt, b


def flat(mat, hexc, rough, metal):
    nt, b = principled(mat)
    b.inputs["Base Color"].default_value = lin(hexc)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    mat.diffuse_color = lin(hexc)
    mat.roughness = rough
    return b


def glass(mat):
    b = flat(mat, "#1b2024", 0.04, 0.0)
    b.inputs["IOR"].default_value = 1.52
    # bez alfy: w three.js BLEND = błędy sortowania i mleczny wygląd; szyba ma być ciemna z odbiciem
    return b


def panel_texture(px=512, tile_m=0.75):
    """Panel ogrodzeniowy 3D jako tekstura z alfą (kafel = 0,75 m, tak jak UV SketchUpa dla tego materiału).

    Pręty pionowe co 5 cm (Ø ok. 5 mm), podwójne pręty poziome co 18,75 cm. Ok. 85 % przezroczystości,
    żeby płot był ażurowy także z daleka (gęsta siatka mtex_17467 dawała z daleka czarny pas).
    """
    import numpy as np
    name = "OGRODZENIE_panel_3d"
    im = bpy.data.images.get(name)
    if im is not None:
        bpy.data.images.remove(im)     # zawsze generuj od nowa (parametry mogły się zmienić)
    a = np.zeros((px, px), dtype=np.float32)
    k = px / tile_m
    w = max(3, round(0.007 * k))                  # grubość pręta w px (7 mm: czytelny z daleka przy alphaTest)
    for i in range(int(round(tile_m / 0.05))):    # pionowe co 5 cm
        x = int(round(i * 0.05 * k))
        a[:, x:x + w] = 1
    for j in range(4):                            # poziome podwójne co 18,75 cm
        y = int(round(j * 0.1875 * k))
        for dy in (0, int(round(0.012 * k))):
            a[y + dy:y + dy + w, :] = 1
    rgba = np.zeros((px, px, 4), dtype=np.float32)
    rgba[..., 0:3] = 1.0
    rgba[..., 3] = a
    im = bpy.data.images.new(name, px, px, alpha=True)
    im.alpha_mode = "STRAIGHT"
    im.pixels.foreach_set(rgba.ravel())
    im.file_format = "PNG"
    im.pack()
    return im


def fence(mat, hexc="#3a3c3e"):
    """Ogrodzenie panelowe: tekstura siatki z alfą (mtex_17467.png) x antracyt, alfa MASK (glTF alphaTest).

    Alfa przez Math ROUND -> eksporter glTF zapisuje alphaMode MASK, cutoff 0.5 (bez sortowania w three.js).
    """
    img = panel_texture()
    nt, b = principled(mat)
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Metallic"].default_value = 0.3
    b.inputs["Base Color"].default_value = lin(hexc)
    mat.diffuse_color = lin(hexc)
    if img is None:
        return b
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, 0)
    t = nt.nodes.new("ShaderNodeTexImage"); t.location = (-650, 0); t.image = img
    nt.links.new(tc.outputs["UV"], t.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.location = (-300, 150)
    mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
    nt.links.new(t.outputs["Color"], mix.inputs["A"])
    mix.inputs["B"].default_value = lin(hexc)
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    rnd = nt.nodes.new("ShaderNodeMath"); rnd.location = (-300, -150); rnd.operation = "ROUND"
    nt.links.new(t.outputs["Alpha"], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], b.inputs["Alpha"])
    for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
        try:
            setattr(mat, attr, val)
        except (AttributeError, TypeError):
            pass
    mat.use_backface_culling = False
    return b


def load_img(path, non_color=False):
    name = os.path.basename(os.path.dirname(path)) + "_" + os.path.basename(path)
    im = bpy.data.images.get(name)
    if im is None:
        im = bpy.data.images.load(path)
        im.name = name
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def textured(mat, folder, tile_m, tint, rough_const=None, spec=None):
    d = os.path.join(GRUNT, folder)
    nt, b = principled(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-1100, 0)
    mp = nt.nodes.new("ShaderNodeMapping"); mp.location = (-900, 0)
    s = 1.0 / tile_m
    mp.inputs["Scale"].default_value = (s, s, 1)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    def tex(fname, y, non_color):
        t = nt.nodes.new("ShaderNodeTexImage"); t.location = (-600, y)
        t.image = load_img(os.path.join(d, fname), non_color)
        nt.links.new(mp.outputs[0], t.inputs[0])
        return t

    col = tex("color.jpg", 300, False)
    if tint.lower() != "#ffffff":
        mix = nt.nodes.new("ShaderNodeMix"); mix.location = (-250, 300)
        mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(col.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = lin(tint)
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    else:
        nt.links.new(col.outputs["Color"], b.inputs["Base Color"])
    if rough_const is None:
        rough = tex("roughness.jpg", 0, True)
        nt.links.new(rough.outputs["Color"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough_const
    if spec is not None:
        for k in ("Specular IOR Level", "Specular"):
            if k in b.inputs:
                b.inputs[k].default_value = spec
                break
    nrm = tex("normalgl.jpg", -300, True)
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.location = (-250, -300)
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Metallic"].default_value = 0.0
    return b


# Role materiałów per dom (b6: "każdy dom wg renderu, który go pokazuje; gdzie brak renderu — schemat architekta").
# Eksport (wyglad_eksport.py) przypisuje rolę każdej ścianie: RAMA (rama okna + parapet), OSCIEZE (ościeże okna,
# w SKP TYNK X2 w komponencie okna), WNEKA (ściany wnęki wejściowej w bryle), DRZWI, BRAMA (brama garażowa),
# DACH, OBROBKA, SZCZYT (A: wschodni szczyt). Brak wpisu = materiał schematu architekta.
#   A — vis-4 (ramy wg schematu architekta: ciemna zieleń, decyzja b6), ciemnozielone ościeża i wnęka, jasna brama,
#              oliwkowy szczyt i obróbki,
#              ciemniejszy ciepły szary dach
#   B — vis-4: jasnoszare ramy, jasne ościeża, wnęka oliwkowo-beżowa, jasna brama
#   C — vis-3/vis-1: brąz (ramy, wnęka, drzwi, brama), ościeża ciemny brąz
#   D — vis-3/vis-1: ramy greige, jasne ościeża, wnęka/drzwi/brama szałwia
#   E, F, G — vis-5: E jasna wnęka i ramy greige; F ciemnozielone ramy, szałwiowa wnęka; G bordo
ROLE_COLORS = {
    "A": {"RAMA": "#2e3a31", "OSCIEZE": "#2e3a31", "WNEKA": "#2e3a31", "DRZWI": "#2e3a31", "BRAMA": "#bdb4a9",
          "OBROBKA": "#4f5a45", "DACH": "#857d77", "SZCZYT": "#5f645a"},
    "B": {"RAMA": "#c6c7c8", "OSCIEZE": "#d6d1c8", "WNEKA": "#9e967c", "DRZWI": "#8b8a7e", "BRAMA": "#d8d5ce",
          "DACH": "#928b82"},   # runtime v9 vis-1: dach B o ~15 L* za jasny vs render #c2beb6
    "C": {"RAMA": "#5e504b", "OSCIEZE": "#4a3c37", "WNEKA": "#5e504b", "DRZWI": "#5e504b", "BRAMA": "#5e504b"},
    "D": {"RAMA": "#9a968b", "OSCIEZE": "#d6d1c8", "WNEKA": "#8b8a7e", "DRZWI": "#8b8a7e", "BRAMA": "#8b8a7e"},
    "E": {"RAMA": "#9a968b", "OSCIEZE": "#d6d1c8", "WNEKA": "#d0c9be", "DRZWI": "#9a978f"},
    "F": {"RAMA": "#2e3a31", "OSCIEZE": "#2e3a31", "WNEKA": "#7e806c", "DRZWI": "#2e3a31"},
    "G": {"RAMA": "#5a2f30", "OSCIEZE": "#4a2a2a", "WNEKA": "#6e4d48", "DRZWI": "#5a2f30"},
}
ROLE_PARAMS = {"RAMA": (0.38, 0.05), "DRZWI": (0.4, 0.05), "BRAMA": (0.45, 0.05), "DACH": (0.42, 0.12),
               "OBROBKA": (0.55, 0.0)}


def slab_material(mat, base="#cfcac2", tile_m=1.2, slab_m=0.6, joint_m=0.005, px=1024):
    """Tarasy z wielkoformatowych płyt betonowych 60x60 (vis-1): tekstura proceduralna zapisana w .blend
    (spakowana), kafel 1,2 m = 2x2 płyty, fuga 5 mm, zmienność tonu płyt ±3 %, drobne ziarno."""
    import numpy as np
    name = "PLYTY_TARAS_60x60"
    im = bpy.data.images.get(name)
    if im is not None:
        bpy.data.images.remove(im)
    rng = np.random.default_rng(7)
    c = np.array([int(base[i:i + 2], 16) / 255 for i in (1, 3, 5)], dtype=np.float32)
    k = px / tile_m
    n = int(round(tile_m / slab_m))
    img = np.empty((px, px, 3), dtype=np.float32)
    s = int(round(slab_m * k))
    for i in range(n):
        for j in range(n):
            tone = 1.0 + rng.uniform(-0.03, 0.03)
            img[i * s:(i + 1) * s, j * s:(j + 1) * s] = c * tone
    img *= (1.0 + rng.normal(0, 0.012, (px, px, 1))).astype(np.float32)
    jw = max(2, int(round(joint_m * k)))
    for i in range(n):
        img[i * s:i * s + jw, :] = c * 0.72
        img[:, i * s:i * s + jw] = c * 0.72
    img = np.clip(img, 0, 1)                 # piksele 8-bit zapisywane wprost w sRGB
    rgba = np.ones((px, px, 4), dtype=np.float32)
    rgba[..., :3] = img
    im = bpy.data.images.new(name, px, px, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.update()
    im.file_format = "PNG"
    im.pack()
    nt, b = principled(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / tile_m, 1 / tile_m, 1)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], t.inputs[0])
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Metallic"].default_value = 0.0
    mat.diffuse_color = lin(base)
    return mat


def plaster_textures(px=512, tile_m=1.5, seed=11):
    """Bezszwowe tekstury tynku drobnoziarnistego (szum filtrowany w FFT = periodyczny):
    TYNK_DETAL_ALBEDO (szarość ~0,93–1,0, mnożona przez kolor domu) i TYNK_DETAL_NORMAL (ziarno ~2–3 mm
    + łagodne falowanie). Z 5 m prawie gładko, z 1 m widać fakturę."""
    import numpy as np
    rng = np.random.default_rng(seed)
    f = np.fft.fftfreq(px)
    fx, fy = np.meshgrid(f, f)
    fr = np.sqrt(fx * fx + fy * fy) + 1e-6

    def noise(sigma_px, amp=1.0):
        w = rng.normal(size=(px, px))
        spec = np.fft.fft2(w) * np.exp(-(fr * sigma_px * 2 * np.pi) ** 2 / 2)
        n = np.real(np.fft.ifft2(spec))
        return amp * (n - n.mean()) / (n.std() + 1e-9)

    # albedo: plamy 10–30 cm (±2 %) + ziarno (±1 %)
    alb = 0.965 + 0.0045 * noise(28) + 0.005 * noise(4) + 0.008 * noise(1.0)
    alb = np.clip(alb, 0.9, 1.0)
    # wysokość: ziarno 1–2 px (~3–6 mm), drobne grudki, łagodne falowanie zacierki
    h = 1.0 * noise(0.8) + 0.5 * noise(2.0) + 0.35 * noise(40)
    gy, gx = np.gradient(h)
    k = 0.55
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], -1)
    out = []
    for name, arr, noncolor in (("TYNK_DETAL_ALBEDO", np.repeat(alb[..., None], 3, -1), False),
                                ("TYNK_DETAL_NORMAL", nrm, True)):
        im = bpy.data.images.get(name)
        if im is not None:
            bpy.data.images.remove(im)
        # Uwaga: przestrzeń barw tylko przy tworzeniu (is_data) — zmiana colorspace po wpisaniu pikseli czyści
        # obraz wygenerowany (v9: czarna normal mapa -> elewacje ciemniały/jaśniały zależnie od orientacji).
        # Piksele obrazu 8-bit są zapisywane wprost (albedo w sRGB, normalne liniowo).
        im = bpy.data.images.new(name, px, px, alpha=False, is_data=noncolor)
        rgba = np.ones((px, px, 4), dtype=np.float32)
        rgba[..., :3] = arr
        im.pixels.foreach_set(rgba.astype(np.float32).ravel())
        im.update()
        im.file_format = "PNG"
        im.pack()
        out.append(im)
    srgb2lin = np.where(alb <= 0.04045, alb / 12.92, ((alb + 0.055) / 1.055) ** 2.4)
    return out, tile_m, float(srgb2lin.mean())


def plaster(mat, hexc, rough=0.92, strength=0.35):
    """Tynk: kolor domu x tekstura detalu (glTF: baseColorTexture + baseColorFactor), normal mapa o niskiej sile."""
    (alb, nrm), tile, mean_lin = PLASTER
    nt, b = principled(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / tile, 1 / tile, 1)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    ta = nt.nodes.new("ShaderNodeTexImage"); ta.image = alb
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm
    nt.links.new(mp.outputs[0], ta.inputs[0])
    nt.links.new(mp.outputs[0], tn.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
    c = lin(hexc)
    # kompensacja średniej tekstury, żeby średni kolor ściany = kolor z palety (scorecard bez przesunięcia)
    mix.inputs["B"].default_value = tuple(min(1.0, x / mean_lin) for x in c[:3]) + (1.0,)
    nt.links.new(ta.outputs["Color"], mix.inputs["A"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = strength
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    mat.diffuse_color = c
    return b


PLASTER = None
PLASTER_MATS = {"TYNK A", "TYNK B", "TYNK C"}
PLASTER_ROLES = {"SZCZYT"}          # wnęki jednolite w kolorze stolarki (jak na renderach)


def role_materials():
    """Materiały ról per dom: nazwa '<dom>_<ROLA>' (np. 'A_RAMA'), czytelne w runtime i w rejestrze."""
    out = []
    for h, roles in ROLE_COLORS.items():
        for role, hexc in roles.items():
            name = "%s_%s" % (h, role)
            m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
            r, met = ROLE_PARAMS.get(role, (0.85, 0.0))
            if role in PLASTER_ROLES and PLASTER:
                plaster(m, hexc, rough=r)
            else:
                flat(m, hexc, r, met)
            m.use_fake_user = True      # przeżywa zapis, nawet gdy w .blend nikt go nie używa (używa eksport)
            out.append(name)
    return out


def apply():
    M = bpy.data.materials
    for old, new in RENAME.items():
        if old in M and new not in M:
            M[old].name = new
    if PODJAZD[0] not in M:
        M.new(PODJAZD[0])
    flat(M[PODJAZD[0]], PODJAZD[1], PODJAZD[2], 0.0)
    done = [PODJAZD[0]]
    if "PLYTY_TARAS" in M:
        slab_material(M["PLYTY_TARAS"]); done.append("PLYTY_TARAS")
    global PLASTER
    PLASTER = plaster_textures()
    for name, (h, r, m) in PALETA.items():
        if name in M:
            if name in PLASTER_MATS:
                plaster(M[name], h, rough=r)
            else:
                flat(M[name], h, r, m)
            done.append(name)
    for name in KONTEKST_MAT:
        if name in M:
            flat(M[name], *DUCH); done.append(name)
    for name in SZYBY:
        if name in M:
            glass(M[name]); done.append(name)
    for name in OGRODZENIE:
        if name in M:
            fence(M[name]); done.append(name)
    for name, (folder, tile, tint, rc, sp) in GRUNT_MAT.items():
        if name in M and os.path.isdir(os.path.join(GRUNT, folder)):
            textured(M[name], folder, tile, tint, rc, sp); done.append(name)
    for name, (h, r, m) in PLASKIE.items():
        if name in M:
            flat(M[name], h, r, m); done.append(name)
    # fałszywa przezroczystość: importer SKP podpina alfę tekstury JPG pod Alpha -> glTF BLEND
    fixed = []
    for mat in M:
        if not mat.use_nodes or mat.name in OGRODZENIE:
            continue
        b = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is None:
            continue
        for link in list(b.inputs["Alpha"].links):
            mat.node_tree.links.remove(link)
            fixed.append(mat.name)
        b.inputs["Alpha"].default_value = 1.0
    print("materiały ustawione:", len(done), done, "| bez fałszywej alfy:", fixed)
    print("role per dom:", len(role_materials()))


apply()

if not bpy.app.background:
    pass
elif "--" in sys.argv and "zapisz" in sys.argv[sys.argv.index("--") + 1:]:
    bpy.ops.wm.save_mainfile()
