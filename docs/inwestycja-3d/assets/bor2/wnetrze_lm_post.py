"""Korekta lightmap i ich intensywności bez ponownego wypiekania (zwykły Python + Pillow + numpy).

    python -I wnetrze_lm_post.py <plik.glb> <katalog_lm> [wb=1.0,0.97,0.92] [kond0=1.0] [kond1=1.0]

- balans bieli: mnożniki RGB w przestrzeni liniowej (lightmapa ma niebo niebieskie, rendery - ciepły cień),
  kanał R bez zmian, więc nic się nie przycina,
- intensywność per kondygnacja: mnoży lightMapIntensity w extras węzłów (łata JSON w GLB, dane binarne bez zmian).
Uruchamiać RAZ na świeżo wypieczonych plikach (efekt się kumuluje).
"""
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

glb, lmdir = sys.argv[1], sys.argv[2]
opts = dict(a.split("=", 1) for a in sys.argv[3:] if "=" in a)
wb = np.array([float(v) for v in opts.get("wb", "1.0,0.97,0.92").split(",")])


def lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


for f in sorted(os.listdir(lmdir)):
    if f.endswith(".webp"):
        p = os.path.join(lmdir, f)
        a = np.asarray(Image.open(p).convert("RGB")).astype(np.float64) / 255
        out = srgb(lin(a) * wb)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(p, quality=90, method=6)
        print("LMPOST", f, "wb", wb.tolist())

data = open(glb, "rb").read()
jlen = struct.unpack_from("<I", data, 12)[0]
g = json.loads(data[20:20 + jlen])
for n in g["nodes"]:
    ex = n.get("extras") or {}
    if "lightMap" in ex:
        k = "kond1" if "_kond1" in ex["lightMap"] else "kond0"
        ex["lightMapIntensity"] = round(ex["lightMapIntensity"] * float(opts.get(k, 1.0)), 4)
js = json.dumps(g, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
rest = data[20 + jlen:]
total = 12 + 8 + len(js) + len(rest)
out = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(js), b"JSON") + js + rest
open(glb, "wb").write(out)
print("LMPOST", glb, {k: opts.get(k, 1.0) for k in ("kond0", "kond1")})
