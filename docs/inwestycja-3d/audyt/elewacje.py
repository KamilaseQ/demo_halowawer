"""Zestaw „ELEWACJE Z BLISKA”: domy A, C, E, G × (ogród, front, narożnik ze szczytem) × (3 m, 8 m), oko 1,65 m.

    python elewacje.py pozy  <grunt-punkty-v8.json> <wyjscie_pozy.json>
    python elewacje.py arkusz <pozy.json> <katalog_runtime> <wyjscie.jpg> [katalog_runtime_poprzedni]

Arkusz: wiersz = dom × widok; kolumny: detal z renderu (wycinek tego samego elementu) | runtime 8 m | runtime 3 m | (poprzednio 3 m).
Wycinki renderów (ułamki kadru) przypisane wg ustaleń pary/kamery (defekty.json → rozstrzygniecia).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

GAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "public", "explorer", "gallery")
DOMY = {"A": "E", "C": "E", "E": "E", "G": "W"}  # strona wolnego szczytu
WYCINKI = {  # (dom, widok) → (plik, [x0, y0, x1, y1], opis)
    ("A", "ogrod"): ("visualization-1", [0.50, 0.33, 0.88, 0.82], "vis-1: elewacja ogrodowa A (para B·A)"),
    ("A", "front"): ("visualization-4", [0.10, 0.52, 0.42, 0.78], "vis-4: front A z bramą segmentową"),
    ("A", "naroznik"): ("visualization-4", [0.06, 0.36, 0.30, 0.80], "vis-4: szczyt wschodni A"),
    ("C", "ogrod"): ("visualization-1", [0.50, 0.33, 0.88, 0.82], "vis-1 (analog: ogród bliźniaka, para B·A)"),
    ("C", "front"): ("visualization-3", [0.20, 0.45, 0.50, 0.86], "vis-3: front C — wejście + brama"),
    ("C", "naroznik"): ("visualization-1", [0.00, 0.30, 0.20, 0.80], "vis-1 lewy brzeg: szczyt wschodni C"),
    ("E", "ogrod"): ("visualization-6", [0.38, 0.52, 0.58, 0.80], "vis-6: ogród szeregu (zmierzch)"),
    ("E", "front"): ("visualization-5", [0.10, 0.32, 0.45, 0.78], "vis-5: front E od ulicy"),
    ("E", "naroznik"): ("visualization-5", [0.04, 0.22, 0.30, 0.78], "vis-5: szczyt wschodni E"),
    ("G", "ogrod"): ("visualization-6", [0.04, 0.50, 0.30, 0.80], "vis-6: ogród G (zmierzch)"),
    ("G", "front"): ("visualization-5", [0.55, 0.36, 0.96, 0.80], "vis-5: front G — bordowy podcień"),
    ("G", "naroznik"): ("estate-4", [0.45, 0.22, 1.00, 0.80], "estate-4 (budowa): szczyt zachodni G"),
}
WIDOKI = ["ogrod", "front", "naroznik"]


def pozy(src, out):
    d = json.load(open(src, encoding="utf-8"))["domy"]
    P = []
    for h, side in DOMY.items():
        x0, y0, z0, x1, y1, z1 = d[f"DOM_{h}"]
        cx, cz, g = (x0 + x1) / 2, (z0 + z1) / 2, y0
        xf = x1 if side == "E" else x0
        sx = 1 if side == "E" else -1
        for dist in (8, 3):
            fov = 50 if dist == 8 else 62
            P += [
                {"id": f"el-{h}-ogrod-{dist}m", "pozycja": [cx, g + 1.65, z1 + dist], "cel": [cx, g + (2.4 if dist == 8 else 1.9), z1], "yfov": fov},
                {"id": f"el-{h}-front-{dist}m", "pozycja": [cx, g + 1.65, z0 - dist], "cel": [cx, g + (2.2 if dist == 8 else 1.5), z0], "yfov": fov},
                {"id": f"el-{h}-naroznik-{dist}m", "pozycja": [xf + sx * dist * 0.8, g + 1.65, z1 + dist * 0.6], "cel": [xf, g + (2.8 if dist == 8 else 2.0), cz + (z1 - cz) * 0.4], "yfov": fov},
            ]
    for p in P:
        p["pozycja"] = [round(v, 2) for v in p["pozycja"]]
        p["cel"] = [round(v, 2) for v in p["cel"]]
        p.update(dom=p["id"].split("-")[1], rodzaj="elewacja", azymut=None)
    json.dump({"opis": "Elewacje z bliska", "kadr": {"w": 960, "h": 600}, "pozy": P}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(P), "pozy")


def arkusz(pz, rt, out, prev=None):
    W, H = 420, 262
    cols = ["render (detal)", "runtime 8 m", "runtime 3 m"] + (["poprzednio 3 m"] if prev else [])
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    rows = [(h, v) for h in DOMY for v in WIDOKI]
    im = Image.new("RGB", (len(cols) * (W + 4), len(rows) * (H + 20)), "white")
    d = ImageDraw.Draw(im)
    for r, (h, v) in enumerate(rows):
        y = r * (H + 20)
        f, box, opis = WYCINKI[(h, v)]
        ref = Image.open(os.path.join(GAL, f + ".jpg")).convert("RGB")
        rw, rh = ref.size
        crop = ref.crop((int(box[0] * rw), int(box[1] * rh), int(box[2] * rw), int(box[3] * rh)))
        crop.thumbnail((W, H))
        im.paste(crop, (0, y + 20))
        d.text((4, y + 3), f"{h} {v} · {opis}", fill="black", font=font)
        for c, (lab, folder, dist) in enumerate([(cols[1], rt, 8), (cols[2], rt, 3)] + ([(cols[3], prev, 3)] if prev else []), start=1):
            p = os.path.join(folder, f"el-{h}-{v}-{dist}m.jpg")
            x = c * (W + 4)
            if os.path.exists(p):
                im.paste(Image.open(p).convert("RGB").resize((W, H)), (x, y + 20))
            d.text((x + 4, y + 3), f"{h} {v} · {lab}", fill="black", font=font)
    im.save(out, quality=82)
    print("arkusz ->", out)


if __name__ == "__main__":
    if sys.argv[1] == "pozy":
        pozy(sys.argv[2], sys.argv[3])
    else:
        arkusz(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
