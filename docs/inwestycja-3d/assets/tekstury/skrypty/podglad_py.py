# Szybki podgląd w Pythonie: cieniowanie Lamberta mapą normalnych w świetle smugowym + kafle 4x4.
import sys, os, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
d, base, out = sys.argv[1], sys.argv[2], sys.argv[3]
tint = np.array([int(sys.argv[4][i:i+2], 16) for i in (1, 3, 5)]) / 255 if len(sys.argv) > 4 else np.array([1, 1, 1.0])
def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
col = lin(np.asarray(Image.open(os.path.join(d, base + "_color.webp")).convert("RGB"), dtype=np.float64) / 255)
n = np.asarray(Image.open(os.path.join(d, base + "_normal.jpg")).convert("RGB"), dtype=np.float64) / 255 * 2 - 1
n /= np.linalg.norm(n, axis=-1, keepdims=True)
# słońce 40° do płaszczyzny ściany, z lewej i lekko z góry
a = np.radians(40)
l = np.array([-np.cos(a) * 0.9, np.cos(a) * 0.44, np.sin(a)]); l /= np.linalg.norm(l)
sh = np.clip((n * l).sum(-1), 0, None)[..., None]
img = col / col.mean() * lin(tint) * (0.25 + 1.6 * sh)
img = srgb(img / 1.6)
im = Image.fromarray((img * 255).astype(np.uint8))
H, W = im.size[1], im.size[0]
crop = im.crop((0, 0, 700, 700))
tiles = Image.new("RGB", (W * 4, H * 4))
for i in range(4):
    for j in range(4): tiles.paste(im, (i * W, j * H))
tiles = tiles.resize((1400, 1400), Image.LANCZOS)
sheet = Image.new("RGB", (2100, 1400), "white")
sheet.paste(tiles, (0, 0)); sheet.paste(crop, (1400, 0))
sheet.paste(im.resize((700, 700), Image.LANCZOS), (1400, 700))
sheet.save(out, quality=90)
print("ok", out)
