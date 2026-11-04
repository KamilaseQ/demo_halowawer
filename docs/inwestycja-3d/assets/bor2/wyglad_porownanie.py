"""Zestawienie render Blendera | oryginał dewelopera (zwykły Python + Pillow, poza Blenderem).

python wyglad_porownanie.py <render.png> <oryginal.jpg> <wyjscie.jpg> [etykieta]
Drukuje też próbki kolorów w tych samych punktach (ułamki kadru) z obu obrazów.
"""
import sys

from PIL import Image, ImageDraw

render, orig, out = sys.argv[1:4]
label = sys.argv[4] if len(sys.argv) > 4 else ""
a = Image.open(render).convert("RGB")
b = Image.open(orig).convert("RGB")
H = 620
a = a.resize((round(a.width * H / a.height), H))
b = b.resize((round(b.width * H / b.height), H))
im = Image.new("RGB", (a.width + b.width + 10, H + 28), "white")
im.paste(a, (0, 28))
im.paste(b, (a.width + 10, 28))
d = ImageDraw.Draw(im)
d.text((8, 8), f"Blender (BOR2) {label}", fill="black")
d.text((a.width + 18, 8), "wizualizacja dewelopera", fill="black")
im.save(out, quality=88)
print("zapisano", out)
