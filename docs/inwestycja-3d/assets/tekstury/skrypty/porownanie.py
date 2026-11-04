# Składa podglad/porownanie.jpg: wycinki renderów dewelopera obok zrzutów z three.js.
import os
from PIL import Image, ImageDraw
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(R, "..", "..", "..", "..", "public", "explorer", "gallery")
P = os.path.join(R, "podglad")
def fit(im, w, h):
    s = min(w / im.width, h / im.height); return im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
cells = [
    ("render vis-4: brama A + sciana", Image.open(os.path.join(G, "visualization-4.jpg")).crop((470, 660, 820, 960))),
    ("three.js: 8 m, oczy 1,65 m", Image.open(os.path.join(P, "threejs-8m.jpg"))),
    ("three.js: 3 m", Image.open(os.path.join(P, "threejs-3m.jpg"))),
    ("render vis-1: tynk (taupe)", Image.open(os.path.join(G, "visualization-1.jpg")).crop((1000, 640, 1450, 900))),
    ("three.js: 1 m (tynk #b0a9a1, brama #8a857b)", Image.open(os.path.join(P, "threejs-1m.jpg"))),
    ("three.js: 3 m BEZ tekstur (odniesienie)", Image.open(os.path.join(P, "threejs-3m-bez-tekstur.jpg"))),
]
CW, CH = 720, 450
sheet = Image.new("RGB", (CW * 3, (CH + 24) * 2), "white"); d = ImageDraw.Draw(sheet)
for i, (lab, im) in enumerate(cells):
    x, y = (i % 3) * CW, (i // 3) * (CH + 24)
    t = fit(im.convert("RGB"), CW, CH); sheet.paste(t, (x + (CW - t.width) // 2, y + 24)); d.text((x + 6, y + 6), lab, fill="black")
sheet.save(os.path.join(P, "porownanie.jpg"), quality=88)
print("ok")
