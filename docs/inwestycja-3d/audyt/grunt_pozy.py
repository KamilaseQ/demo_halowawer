"""Ujęcia PRZY GRUNCIE (stała część sweepu i pętli): wzdłuż płotów, ścieżek/podjazdów, geokraty, tarasów, murków.

    python grunt_pozy.py <grunt-pts.json z grunt_punkty.py> <wyjscie_sweep.json> <wyjscie_petla.json> [odstep=15]

Na każdej klasie punkty co ~`odstep` m (zachłanny dobór najdalszych). W punkcie: kierunek lokalny (PCA punktów w promieniu 5 m),
4 ujęcia: wzdłuż na 0,6 m i 1,65 m (kamera 6 m przed punktem, przesunięta 1,2 m w bok, patrzy 6 m za punkt) oraz w poprzek
na 0,6 m i 1,65 m (kamera 5 m z boku). Kamery w bryłach domów są pomijane. Kadr 960×540, yfov 50°.
Plik pętli = podzbiór: po 2 punkty na klasę (najdalsze od siebie), tylko „wzdłuż 0,6 m” i „poprzek 1,65 m”.
"""
import json
import math
import sys

import numpy as np

src, out_sweep, out_loop = sys.argv[1:4]
STEP = float(sys.argv[4]) if len(sys.argv) > 4 else 15.0
d = json.load(open(src, encoding="utf-8"))
houses = list(d["domy"].values())


def in_house(p, pad=0.4):
    return any(h[0] - pad <= p[0] <= h[3] + pad and h[2] - pad <= p[2] <= h[5] + pad and p[1] <= h[4] for h in houses)


def pick(xz, step):
    chosen = []
    order = np.lexsort((xz[:, 1], xz[:, 0]))
    for i in order:
        if all(np.hypot(*(xz[i] - xz[j])) >= step for j in chosen):
            chosen.append(i)
    return chosen


poses, loop = [], []
for klasa, pts in d["punkty"].items():
    P = np.array(pts, dtype=float)
    if len(P) < 3:
        continue
    xz = P[:, [0, 2]]
    idx = pick(xz, STEP)
    for n, i in enumerate(idx):
        near = xz[np.hypot(*(xz - xz[i]).T) < 5]
        if len(near) >= 3:
            c = near - near.mean(0)
            w, v = np.linalg.eigh(c.T @ c)
            along = v[:, -1]
        else:
            along = np.array([1.0, 0.0])
        perp = np.array([-along[1], along[0]])
        g = float(np.percentile(P[np.hypot(*(xz - xz[i]).T) < 5][:, 1], 10))  # poziom gruntu przy punkcie
        p = xz[i]
        shots = {
            "wzdluz-060": (p - along * 6 + perp * 1.2, 0.6, p + along * 6, 0.35),
            "wzdluz-165": (p - along * 6 + perp * 1.2, 1.65, p + along * 6, 0.6),
            "poprzek-060": (p + perp * 5, 0.6, p, 0.4),
            "poprzek-165": (p + perp * 5, 1.65, p, 0.5),
        }
        for kind, (cam, h, tgt, th) in shots.items():
            pos = [round(float(cam[0]), 2), round(g + h, 2), round(float(cam[1]), 2)]
            if in_house(pos):
                pos2 = [round(float(p[0] - perp[0] * 5), 2), round(g + h, 2), round(float(p[1] - perp[1] * 5), 2)] if kind.startswith("poprzek") else None
                if not pos2 or in_house(pos2):
                    continue
                pos = pos2
            pose = {"id": f"grunt-{klasa}-{n + 1:02d}-{kind}", "dom": None, "azymut": None, "rodzaj": f"grunt-{klasa}",
                    "pozycja": pos, "cel": [round(float(tgt[0]), 2), round(g + th, 2), round(float(tgt[1]), 2)], "yfov": 50}
            poses.append(pose)
    # loop subset: 2 most distant picks per class
    if idx:
        far = sorted(idx, key=lambda j: -np.hypot(*(xz[j] - xz[idx[0]])))[:1] + [idx[0]]
        for j in far:
            n = idx.index(j) + 1
            loop += [q for q in poses if q["id"] in (f"grunt-{klasa}-{n:02d}-wzdluz-060", f"grunt-{klasa}-{n:02d}-poprzek-165")]
kadr = {"w": 960, "h": 540}
json.dump({"opis": "Ujęcia przy gruncie (sweep)", "kadr": kadr, "pozy": poses}, open(out_sweep, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"opis": "Ujęcia przy gruncie (pętla)", "kadr": kadr, "pozy": loop}, open(out_loop, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print("sweep:", len(poses), dict(Counter(q["rodzaj"] for q in poses)), "| petla:", len(loop))
