"""Arkusze sweepu: pary runtime | Workbench (prawda geometrii), po 4 pary na arkusz.

    python arkusze.py <pozy.json> <katalog_runtime> <katalog_workbench> <katalog_wyjsciowy> [szer_obrazu=480]

Grupy: <dom>-oko, <dom>-gora, spacer-1…; nazwa pliku = grupa.jpg. Opcjonalnie <katalog_poprzedni>: --poprzedni <katalog_runtime_poprzedni>
dodaje trzecią kolumnę (poprzedni sweep) do arkusza „poprzednia vs obecna”.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("pozy")
ap.add_argument("runtime")
ap.add_argument("workbench")
ap.add_argument("out")
ap.add_argument("szer", nargs="?", type=int, default=480)
ap.add_argument("--poprzedni")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
data = json.load(open(a.pozy, encoding="utf-8"))
W = a.szer
H = round(W * data["kadr"]["h"] / data["kadr"]["w"])
try:
    font = ImageFont.truetype("arial.ttf", 14)
except OSError:
    font = ImageFont.load_default()
groups = {}
spacer = [p for p in data["pozy"] if p["rodzaj"] == "spacer"]
for p in data["pozy"]:
    if p["rodzaj"] != "spacer":
        groups.setdefault(f"{p['dom']}-{p['rodzaj']}", []).append(p)
for i in range(0, len(spacer), 4):
    groups[f"spacer-{i // 4 + 1}"] = spacer[i:i + 4]
cols = [("runtime", a.runtime), ("Workbench", a.workbench)] + ([("poprzedni", a.poprzedni)] if a.poprzedni else [])
for name, ps in groups.items():
    for start in range(0, len(ps), 4):
        chunk = ps[start:start + 4]
        sheet = Image.new("RGB", (len(cols) * (W + 4), len(chunk) * (H + 20)), "white")
        d = ImageDraw.Draw(sheet)
        for r, p in enumerate(chunk):
            for c, (label, folder) in enumerate(cols):
                f = os.path.join(folder, p["id"] + ".jpg")
                if os.path.exists(f):
                    sheet.paste(Image.open(f).convert("RGB").resize((W, H)), (c * (W + 4), r * (H + 20) + 20))
                d.text((c * (W + 4) + 4, r * (H + 20) + 3), f"{p['id']} · {label}", fill="black", font=font)
        suffix = "" if len(ps) <= 4 else f"-{start // 4 + 1}"
        sheet.save(os.path.join(a.out, f"{name}{suffix}.jpg"), quality=82)
print("arkusze ->", a.out)
