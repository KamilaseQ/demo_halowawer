"""Pozy kamer systematycznego przeglądu (sweep) osiedla BOR2, układ GLB (Y w górę, metry).

    python pozy.py <wyjscie.json>

Dla każdego domu DOM_A…G: 8 azymutów (0, 45 … 315°; sweep-01 liczony z +X = 100,5°, czyli etykiety obrócone o 10,5° względem kompasu — kolejne sweepy używają tego samego pozy.json dla porównania 1:1) × 2 ujęcia:
  oko  — 1,65 m nad terenem, 8 m od lica elewacji, patrzy na środek domu na wys. 2,5 m;
  gora — 30° z góry, 20 m od środka domu (cel na wys. 3,5 m).
Ujęcia, w których kamera stoi w innym budynku albo widok zasłania sąsiedni segment, są pomijane (z powodem).
Do tego punkty spaceru po osiedlu z GLB (kamery PKT_*), bez duplikatów pozycji.
Wspólne yfov 56,5°, kadr 4:3.
"""
import json
import math
import sys

HOUSES = {  # bbox z bor2-zewnetrze-v5.glb: (min, max)
    "A": ((99.8, 0.1, -47.6), (108.0, 9.4, -37.5)),
    "B": ((91.6, 0.1, -49.1), (99.8, 9.4, -39.0)),
    "C": ((73.8, 0.4, -52.2), (82.0, 9.7, -42.1)),
    "D": ((65.6, 0.4, -53.7), (73.8, 9.7, -43.6)),
    "E": ((48.4, 0.7, -56.8), (56.0, 9.9, -47.1)),
    "F": ((40.9, 0.7, -58.3), (48.5, 9.9, -48.6)),
    "G": ((33.4, 0.7, -59.8), (41.0, 9.9, -50.1)),
}
OBSTACLES = dict(HOUSES)
OBSTACLES.update({
    "KONTEKST_1": ((82.6, 0.2, -20.6), (94.6, 9.7, -10.9)), "KONTEKST_2": ((81.5, 0.2, -13.2), (93.8, 9.7, -3.5)),
    "KONTEKST_3": ((102.0, 0.0, -16.7), (114.2, 9.4, -7.0)), "KONTEKST_4": ((101.1, 0.0, -9.3), (113.1, 9.4, 0.4)),
    "KONTEKST_6": ((43.9, 0.6, -79.6), (59.1, 8.6, -68.1)), "KONTEKST_7": ((22.1, 0.9, -75.1), (28.3, 4.9, -67.0)),
    "KONTEKST_8": ((-0.8, 1.0, -69.9), (15.7, 10.3, -56.1)),
})
PKT = [  # (nazwa, pozycja, kierunek) z GLB v5
    ("PKT_Sceme_10", (31.65, 2.12, -36.84), (0.721, 0.0, -0.693)), ("PKT_Scena_4", (23.91, 2.0, -33.91), (0.736, 0.0, -0.677)),
    ("PKT_Scena_28", (31.26, 2.44, -42.49), (0.589, 0.0, -0.808)), ("PKT_Scene_2", (124.8, 1.65, -68.72), (-0.822, 0.0, 0.569)),
    ("PKT_Scene_3", (123.58, 1.65, -51.4), (-0.94, 0.0, 0.34)), ("PKT_Scene_5", (28.19, 2.35, -73.76), (0.631, 0.0, 0.776)),
    ("PKT_Scene_6", (20.63, 2.5, -67.4), (0.892, 0.0, 0.452)), ("PKT_Scene_7", (121.94, 1.65, -28.16), (-0.883, 0.0, -0.469)),
    ("PKT_Scene_8", (117.69, 1.35, -22.58), (-0.738, 0.0, -0.674)), ("PKT_Scene_9", (64.06, 2.0, -32.1), (-0.719, 0.0, -0.695)),
    ("PKT_Scene_26", (85.27, 1.82, -31.56), (-0.623, 0.0, -0.782)), ("PKT_W1", (121.82, 1.65, -69.21), (-0.831, 0.0, 0.556)),
    ("PKT_W2", (58.33, 2.2, -67.58), (-0.588, 0.0, 0.809)), ("PKT_W3", (87.15, 1.65, -27.22), (0.586, 0.0, -0.81)),
    ("PKT_W4", (73.4, 1.95, -71.15), (0.009, 0.0, 1.0)), ("PKT_W5", (99.81, 1.78, -26.18), (-0.001, 0.0, -1.0)),
    ("PKT_W7", (34.32, 2.37, -25.21), (0.612, 0.0, -0.791)),
]
YFOV = 56.5
COMPASS = {0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW"}


def bearing_dir(deg):
    a = math.radians(deg - 100.5)
    return (math.cos(a), 0.0, math.sin(a))


def inside(p, box, pad=0.3):
    lo, hi = box
    return all(lo[i] - pad <= p[i] <= hi[i] + pad for i in range(3))


def seg_hits(p, q, box):
    """Odcinek p→q przecina bbox (slab test)."""
    lo, hi = box
    t0, t1 = 0.0, 1.0
    for i in range(3):
        d = q[i] - p[i]
        if abs(d) < 1e-9:
            if not lo[i] <= p[i] <= hi[i]:
                return False
            continue
        a, b = (lo[i] - p[i]) / d, (hi[i] - p[i]) / d
        a, b = min(a, b), max(a, b)
        t0, t1 = max(t0, a), min(t1, b)
        if t0 > t1:
            return False
    return True


def main():
    out = sys.argv[1]
    poses, skipped = [], []
    for h, (lo, hi) in HOUSES.items():
        c = [(lo[i] + hi[i]) / 2 for i in range(3)]
        hx, hz = (hi[0] - lo[0]) / 2, (hi[2] - lo[2]) / 2
        g = lo[1]
        for deg in range(0, 360, 45):
            d = bearing_dir(deg)
            ext = abs(d[0]) * hx + abs(d[2]) * hz
            shots = {
                "oko": ((c[0] + d[0] * (ext + 8), g + 1.65, c[2] + d[2] * (ext + 8)), (c[0], g + 2.5, c[2])),
                "gora": ((c[0] + d[0] * 20 * math.cos(math.radians(30)), g + 3.5 + 20 * math.sin(math.radians(30)), c[2] + d[2] * 20 * math.cos(math.radians(30))), (c[0], g + 3.5, c[2])),
            }
            for kind, (cam, tgt) in shots.items():
                pid = f"{h}-{COMPASS[deg]}-{kind}"
                why = next((f"kamera w {n}" for n, b in OBSTACLES.items() if inside(cam, b)), None)
                if not why:
                    # punkt widoku: lico elewacji od strony kamery (kraniec bbox w kierunku kamery)
                    face = (c[0] + d[0] * ext * 0.9, tgt[1], c[2] + d[2] * ext * 0.9)
                    why = next((f"zasłania {n}" for n, b in OBSTACLES.items() if n != h and seg_hits(cam, face, b)), None)
                if why:
                    skipped.append({"id": pid, "powod": why})
                    continue
                poses.append({"id": pid, "dom": h, "azymut": deg, "rodzaj": kind, "pozycja": [round(v, 3) for v in cam], "cel": [round(v, 3) for v in tgt], "yfov": YFOV})
    seen = set()
    for name, p, d in PKT:
        if p in seen:
            continue
        seen.add(p)
        poses.append({"id": name, "dom": None, "azymut": None, "rodzaj": "spacer", "pozycja": list(p), "cel": [round(p[i] + d[i] * 10, 3) for i in range(3)], "yfov": YFOV})
    json.dump({"opis": __doc__.strip().splitlines()[0], "kadr": {"w": 960, "h": 720}, "pozy": poses, "pominiete": skipped}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(poses), "póz,", len(skipped), "pominiętych")


if __name__ == "__main__":
    main()
