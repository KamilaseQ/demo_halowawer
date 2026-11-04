"""Przygotowanie tekstur wnętrz (zwykły Python + Pillow + numpy, bez Blendera).

    python -I wnetrze_tekstury.py

Wejście: wnetrza-tex/zrodla/skp_*.png (tekstury wyjęte z modelu SKP dewelopera)
         public/explorer/3d/textures/* (CC0, opis i licencje w public/explorer/3d/manifest.json)
Wyjście: wnetrza-tex/*.jpg (1024 px) - przebarwione pod rendery dewelopera.
Kolory docelowe (sRGB, średnia tekstury) dobrane z renderów public/explorer/gallery/interior-*.jpg.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "wnetrza-tex", "zrodla")
OUT = os.path.join(HERE, "wnetrza-tex")
PUB = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "public", "explorer", "3d", "textures"))


def lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def load(p, size=1024):
    im = Image.open(p).convert("RGB")
    if max(im.size) > size:
        k = size / max(im.size)
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255


def save(a, name, q=90):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, name), quality=q)
    print("TEX", name, a.shape[:2], (a.reshape(-1, 3).mean(0) * 255).round().astype(int))


def recolor(a, target_srgb, desat=0.0):
    """Wzmocnienie per kanał w przestrzeni liniowej tak, by średnia = target; opcjonalnie desaturacja."""
    L = lin(a)
    if desat:
        g = L.mean(axis=2, keepdims=True)
        L = L * (1 - desat) + g * desat
    t = lin(np.array(target_srgb, dtype=np.float64) / 255)
    L = L * (t / L.reshape(-1, 3).mean(0))
    return srgb(L)


# Tkanina: szara tekstura lnu znormalizowana do jasnej (średnia ~0,92 sRGB), kolor nadaje COLOR_0.
f = load(os.path.join(PUB, "fabric036", "color.jpg"))
g = f.mean(axis=2, keepdims=True)
g = (g - g.mean()) * 1.7 + 0.92
save(np.repeat(g, 3, axis=2), "tkanina.jpg")
save(load(os.path.join(PUB, "fabric036", "normal.jpg")), "tkanina_n.jpg", 92)

def planks(a, tile_m=2.0, width_m=0.19, seed=7):
    """Deski: fugi wzdłużne co ~19 cm, łączenia czołowe w losowych miejscach, +-5 % jasności na deskę.
    Słoje tekstury SKP biegną pionowo (v) -> deski wzdłuż v (= oś Y świata, jak na renderze interior-4)."""
    rng = np.random.default_rng(seed)
    h, w = a.shape[:2]
    n = max(1, round(tile_m / width_m))
    out = a.copy()
    edges = np.linspace(0, w, n + 1).astype(int)
    for i in range(n):
        x0, x1 = edges[i], edges[i + 1]
        cuts = np.sort(rng.uniform(0, h, rng.integers(1, 3)))
        segs = np.concatenate([[0], cuts, [h]]).astype(int)
        for j in range(len(segs) - 1):
            out[segs[j]:segs[j + 1], x0:x1] *= rng.uniform(0.94, 1.05)
            out[max(segs[j] - 1, 0):segs[j] + 1, x0:x1] *= 0.72      # łączenie czołowe
        out[:, x0:x0 + 2] *= 0.70                                    # fuga
    return np.clip(out, 0, 1)


save(planks(recolor(load(os.path.join(SRC, "skp_podloga_d1.png")), (218, 188, 148), 0.05)), "podloga_d1.jpg")
# dom2: render ma ciemniejszy, miodowy dąb niż dom1 (int-2: jodełka ~#a0805d w scenie)
save(recolor(load(os.path.join(SRC, "skp_podloga_d2.png")), (196, 160, 120), 0.1), "podloga_d2.jpg")
save(recolor(load(os.path.join(SRC, "skp_dab_d2.png")), (178, 128, 82), 0.1), "dab_d2.jpg")
save(recolor(load(os.path.join(SRC, "skp_dab_d1.png")), (218, 190, 156), 0.3), "dab_d1.jpg")
save(recolor(load(os.path.join(PUB, "black_oak_veneer", "color.jpg")), (96, 74, 58)), "dab_ciemny.jpg")
save(recolor(load(os.path.join(PUB, "travertine009", "color.jpg")), (222, 214, 200), 0.3), "plytka_podl.jpg")

# Lamele (ryflowane panele ścian dom1): mapa normalnych 512 px = 16 półokrągłych żeberek po 3 cm (kafel 0,48 m),
# zamiast 566 osobnych listew z SKP (ok. 30k trójkątów i paski w lightmapie).
n = 512
x = (np.arange(n) + 0.5) / n * 16 % 1.0 * 2 - 1          # -1..1 w obrębie żeberka
theta = np.clip(x, -0.92, 0.92) * np.radians(68)
nx = np.sin(theta)
nz = np.cos(theta)
groove = np.abs(x) > 0.92                                  # wąski rowek między żeberkami
nx = np.where(groove, -np.sign(x) * 0.6, nx)
nz = np.where(groove, 0.8, nz)
img = np.zeros((n, n, 3))
img[..., 0] = (nx[None, :] + 1) / 2
img[..., 1] = 0.5
img[..., 2] = (nz[None, :] + 1) / 2
Image.fromarray((img * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "lamele_n.png"))
print("TEX lamele_n.png", img.shape[:2])

# Liście (karta liścia eukaliptusa z SKP): tekstura nie ma kanału alfa - tło jest białe i nieprzezroczyste,
# przez co rośliny wyglądały jak białe kartki. Alfa z odległości od bieli, kolor przyciemniony do zieleni.
lf = np.asarray(Image.open(os.path.join(SRC, "skp_lisc.png")).convert("RGB")).astype(np.float64) / 255
white = lf.min(axis=2)
alpha = np.clip((0.93 - white) / 0.08, 0, 1)
leaf = recolor(lf, (92, 122, 80), 0.0)
rgba = np.concatenate([leaf, alpha[..., None]], axis=2)
Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(OUT, "liscie.png"))
print("TEX liscie.png", rgba.shape[:2], "alfa>0.5: %.0f%%" % (100 * (alpha > 0.5).mean()))
