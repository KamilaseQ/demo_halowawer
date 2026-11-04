"""Scorecard ΔE: rendery dewelopera ↔ obraz runtime/GLB, na regionach z regiony.json.

    python scorecard.py <katalog_obrazow_runtime> [--etykieta "GLB v4"] [--wynik wynik.md] [--pary pary]

- Obraz runtime: <katalog>/<render>.jpg|png, kadr z kamery z ../ujecia-porownawcze.json (zrzuty.mjs).
- Render dewelopera: public/explorer/gallery/<render>.jpg.
- Dla regionu: mediana L*, a*, b* (sRGB D65 → CIELAB) w obu obrazach, ΔE2000 (próg odbioru) i ΔE76.
- ΔL* > 0 = runtime jaśniejszy, ΔC* > 0 = runtime bardziej nasycony.
- Ujęcia nocne (pora "noc") liczymy tylko, gdy obraz runtime ma w nazwie katalogu "noc" albo podano --noc;
  podgląd GLB nie ma pory Noc, więc wtedy są pomijane i opisane w wyniku.
Wymaga: Python 3, numpy, Pillow.
"""
import argparse
import datetime
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
GALLERY = os.path.join(ROOT, "public", "explorer", "gallery")


def srgb_to_lab(rgb):
    """rgb: (..., 3) uint8 → (..., 3) CIELAB (D65, 2°)."""
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de2000(lab1, lab2):
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lm, Cmp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hm = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hm = (h1p + h2p) / 2
    else:
        hm = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * np.cos(np.radians(hm - 30)) + 0.24 * np.cos(np.radians(2 * hm)) + 0.32 * np.cos(np.radians(3 * hm + 6)) - 0.20 * np.cos(np.radians(4 * hm - 63))
    dth = 30 * np.exp(-(((hm - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lm - 50) ** 2 / np.sqrt(20 + (Lm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cmp, 1 + 0.015 * Cmp * T
    Rt = -np.sin(np.radians(2 * dth)) * Rc
    return float(np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)))


def region_lab(img, rect):
    w, h = img.size
    x0, y0, x1, y1 = rect
    box = (round(x0 * w), round(y0 * h), max(round(x1 * w), round(x0 * w) + 1), max(round(y1 * h), round(y0 * h) + 1))
    px = np.asarray(img.crop(box).convert("RGB")).reshape(-1, 3)
    return np.median(srgb_to_lab(px), axis=0), box


def diagnose(dL, dC, de, limit):
    if limit is not None and de <= limit:
        return "OK"
    parts = []
    if abs(dL) >= 5:
        parts.append("za jasno" if dL > 0 else "za ciemno")
    if abs(dC) >= 5:
        parts.append("za nasycone" if dC > 0 else "za szare")
    return ", ".join(parts) or "odcień"


def rel(p):
    try:
        return os.path.relpath(p, HERE).replace(os.sep, "/")
    except ValueError:
        return os.path.abspath(p)


def find_runtime(folder, name):
    for ext in (".jpg", ".png", ".jpeg"):
        p = os.path.join(folder, name + ext)
        if os.path.exists(p):
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runtime")
    ap.add_argument("--etykieta", default="")
    ap.add_argument("--wynik", default=os.path.join(HERE, "wynik.md"))
    ap.add_argument("--pary", default=os.path.join(HERE, "pary"))
    ap.add_argument("--noc", action="store_true", help="obrazy runtime zawierają porę Noc dla ujęć nocnych")
    ap.add_argument("--json", help="zapis wyników per region (do porównań między iteracjami)")
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, "regiony.json"), encoding="utf-8"))
    limits, types = cfg["progi"], cfg["typy"]
    gate = cfg.get("miara", "de76")
    gname = "ΔE76 (ΔE*ab)" if gate == "de76" else "ΔE2000"
    os.makedirs(a.pary, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 15)
    except OSError:
        font = ImageFont.load_default()

    rows, skipped, matrix = [], [], {}
    for shot, spec in cfg["ujecia"].items():
        rt_path = find_runtime(a.runtime, shot)
        if not rt_path:
            skipped.append((shot, "brak obrazu runtime"))
            continue
        if spec["pora"] == "noc" and not a.noc:
            skipped.append((shot, "ujęcie nocne — źródło bez pory Noc"))
            continue
        ref = Image.open(os.path.join(GALLERY, shot + ".jpg")).convert("RGB")
        rt = Image.open(rt_path).convert("RGB")
        W = 960
        refs = ref.resize((W, round(ref.height * W / ref.width)))
        rts = rt.resize((W, round(rt.height * W / rt.width)))
        pair = Image.new("RGB", (2 * W + 8, max(refs.height, rts.height) + 30), "white")
        pair.paste(refs, (0, 30))
        pair.paste(rts, (W + 8, 30))
        d = ImageDraw.Draw(pair)
        d.text((6, 6), f"render: {shot}", fill="black", font=font)
        d.text((W + 14, 6), f"runtime: {a.etykieta or os.path.basename(os.path.normpath(a.runtime))}", fill="black", font=font)
        for r in spec["regiony"]:
            klasa = types[r["typ"]]
            limit = limits.get(klasa)
            lab_ref, _ = region_lab(ref, r["ref"])
            lab_rt, _ = region_lab(rt, r.get("rt", r["ref"]))
            de = de2000(lab_ref, lab_rt)
            de76 = float(np.linalg.norm(lab_rt - lab_ref))
            dL = float(lab_rt[0] - lab_ref[0])
            dC = float(np.hypot(*lab_rt[1:]) - np.hypot(*lab_ref[1:]))
            g = de76 if gate == "de76" else de
            ok = None if limit is None else g <= limit
            rows.append(dict(shot=shot, id=r["id"], typ=r["typ"], klasa=klasa, opis=r.get("opis", ""), de=de, de76=de76, dL=dL, dC=dC,
                             limit=limit, ok=ok, diag=diagnose(dL, dC, g, limit), g=g, lab_ref=lab_ref, lab_rt=lab_rt))
            if klasa != "info":
                cell = matrix.setdefault(r["typ"], {})
                cell[shot] = max(cell.get(shot, 0), g)
            col = (40, 170, 60) if ok else ((200, 40, 40) if ok is False else (60, 110, 220))
            for off, rect in ((0, r["ref"]), (W + 8, r.get("rt", r["ref"]))):
                x0, y0, x1, y1 = rect
                box = [off + x0 * W, 30 + y0 * refs.height if off == 0 else 30 + y0 * rts.height,
                       off + x1 * W, 30 + y1 * refs.height if off == 0 else 30 + y1 * rts.height]
                d.rectangle(box, outline=col, width=3)
                d.text((box[0] + 3, box[1] + 2), f"{r['id']} {g:.0f}", fill=col, font=font)
        pair.save(os.path.join(a.pary, f"{shot}.jpg"), quality=85)

    scored = [r for r in rows if r["ok"] is not None]
    passed = [r for r in scored if r["ok"]]
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    L = [f"# Scorecard ΔE — {a.etykieta or a.runtime}", "",
         f"Stan: {now}. Źródło obrazów: `{rel(a.runtime)}`. Bramka: {gname} median CIELAB regionu (render dewelopera ↔ runtime); ΔE2000 pomocniczo.",
         "Progi odbioru: ściany, dachy, podłogi, sufity ≤ 10; szyby/widok za szybą, zieleń, niebo ≤ 15. Regiony „info” (meble, tekstylia) bez progu.", "",
         f"**Wynik zbiorczy: {len(passed)}/{len(scored)} regionów w progu ({(100 * len(passed) / max(1, len(scored))):.0f}%), średnie {gname} = {np.mean([r['g'] for r in scored]) if scored else float('nan'):.1f}.**", ""]
    # per class
    L += ["## Wg klasy", "", f"| klasa | próg | regionów | w progu | średnie {gname} | najgorszy |", "|---|---|---|---|---|---|"]
    for k in ["sciana", "dach", "podloga", "sufit", "szyba", "zielen", "niebo"]:
        rs = [r for r in scored if r["klasa"] == k]
        if not rs:
            continue
        worst = max(rs, key=lambda r: r["g"])
        L.append(f"| {k} | {limits[k]} | {len(rs)} | {sum(r['ok'] for r in rs)} | {np.mean([r['g'] for r in rs]):.1f} | {worst['shot']}/{worst['id']} {worst['g']:.1f} |")
    # matrix typ × shot
    shots = [s for s in cfg["ujecia"] if any(r["shot"] == s for r in rows)]
    short = {s: s.replace("visualization-", "viz").replace("interior-", "int") for s in shots}
    L += ["", f"## {gname}: typ regionu × ujęcie (✗ = poza progiem)", "", "| typ | " + " | ".join(short[s] for s in shots) + " |", "|---|" + "---|" * len(shots)]
    for typ, cells in matrix.items():
        lim = limits[types[typ]]
        L.append(f"| {typ} | " + " | ".join("" if s not in cells else f"{cells[s]:.0f}{'' if cells[s] <= lim else ' ✗'}" for s in shots) + " |")
    # details
    L += ["", "## Szczegóły", "", "| ujęcie | region | typ | ΔE2000 | ΔE76 | ΔL* | ΔC* | L*a*b* render → runtime | ocena |", "|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lr, lt = r["lab_ref"], r["lab_rt"]
        verdict = "info" if r["ok"] is None else ("✓" if r["ok"] else f"✗ {r['diag']}")
        L.append(f"| {r['shot']} | {r['id']} {('— ' + r['opis']) if r['opis'] else ''} | {r['typ']} | {r['de']:.1f} | {r['de76']:.1f} | {r['dL']:+.0f} | {r['dC']:+.0f} | "
                 f"{lr[0]:.0f}/{lr[1]:.0f}/{lr[2]:.0f} → {lt[0]:.0f}/{lt[1]:.0f}/{lt[2]:.0f} | {verdict} |")
    if skipped:
        L += ["", "## Pominięte", ""] + [f"- {s}: {why}" for s, why in skipped]
    L += ["", f"Pary z regionami: `{rel(a.pary)}/<ujęcie>.jpg` (zielony = w progu, czerwony = poza, niebieski = info)."]
    open(a.wynik, "w", encoding="utf-8").write("\n".join(L) + "\n")
    if a.json:
        out = {"etykieta": a.etykieta, "stan": now, "miara": gate, "w_progu": len(passed), "regionow": len(scored),
               "srednia": float(np.mean([r["g"] for r in scored])) if scored else None, "pominiete": skipped,
               "regiony": [{"shot": r["shot"], "id": r["id"], "typ": r["typ"], "klasa": r["klasa"], "opis": r["opis"], "g": round(r["g"], 2),
                            "de2000": round(r["de"], 2), "dL": round(r["dL"], 1), "dC": round(r["dC"], 1), "limit": r["limit"], "ok": r["ok"],
                            "lab_ref": [round(float(v), 1) for v in r["lab_ref"]], "lab_rt": [round(float(v), 1) for v in r["lab_rt"]]} for r in rows]}
        json.dump(out, open(a.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(passed)}/{len(scored)} w progu -> {a.wynik}")


if __name__ == "__main__":
    sys.exit(main())
