"""Szybka pętla po dostawie: zrzuty /domy?kadr= → scorecard ΔE → regresje względem poprzedniej iteracji → arkusz → trend.

    python petla.py --etykieta "v6 + okolica" [--url "http://localhost:3142/domy{dom}?kadr={id}&pora={pora}&czysty=1"]
    python petla.py --etykieta "v5" --z-katalogu <katalog_z_gotowymi_zrzutami>     (import bez robienia zrzutów)

Wynik w iteracje/NN/: runtime/ (zrzuty 960 px), wynik.md, wynik.json, pary/, arkusz.jpg (render | teraz | poprzednio
dla ujęć szybkiej pętli), arkusz-elewacje.jpg (A/C/E/G × ogród/front/narożnik, detal z renderu | 8 m | 3 m | poprzednio), arkusz-grunt.jpg (18 ujęć przy gruncie z audyt/grunt-petla.json: teraz | poprzednio), regresje.md; dopisuje wiersz do trend.md. Regres = region gorszy o ΔE > 3 (ta sama miara bramki).
"""
import argparse
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
GALLERY = os.path.join(ROOT, "public", "explorer", "gallery")
IT = os.path.join(HERE, "iteracje")
SZYBKIE = ["visualization-1", "visualization-2", "visualization-3", "visualization-4", "interior-4", "interior-8", "interior-2", "interior-7"]
REGRES = 3.0
GRUNT = os.path.join(ROOT, "docs", "inwestycja-3d", "audyt", "grunt-petla.json")
ELEW = os.path.join(ROOT, "docs", "inwestycja-3d", "audyt", "elewacje-pozy.json")


def node():
    return shutil.which("node") or "C:/Program Files/nodejs/node.exe"


def last_iteration():
    nums = sorted(int(os.path.basename(p)) for p in glob.glob(os.path.join(IT, "[0-9][0-9]")) if os.path.exists(os.path.join(p, "wynik.json")))
    return nums[-1] if nums else None


def sheet(cur_dir, prev_dir, out, label_now, label_prev):
    W = 480
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    rows = []
    for shot in SZYBKIE:
        ref = Image.open(os.path.join(GALLERY, shot + ".jpg")).convert("RGB")
        H = round(W * ref.height / ref.width)
        cells = [("render", ref)]
        for lab, d in ((label_now, cur_dir), (label_prev, prev_dir)):
            p = os.path.join(d, shot + ".jpg") if d else None
            cells.append((lab, Image.open(p).convert("RGB") if p and os.path.exists(p) else None))
        rows.append((shot, H, cells))
    total = sum(H + 22 for _, H, _ in rows)
    im = Image.new("RGB", (3 * (W + 4), total), "white")
    d = ImageDraw.Draw(im)
    y = 0
    for shot, H, cells in rows:
        for c, (lab, img) in enumerate(cells):
            x = c * (W + 4)
            if img is None:
                d.rectangle([x, y + 22, x + W, y + 22 + H], fill=(235, 235, 235))
                d.text((x + 10, y + 22 + H // 2), "brak w runtime", fill=(120, 120, 120), font=font)
            else:
                im.paste(img.resize((W, H)), (x, y + 22))
            d.text((x + 4, y + 4), f"{shot} · {lab}", fill="black", font=font)
        y += H + 22
    im.save(out, quality=82)


def grunt_sheet(cur, prev, out, label_now, label_prev):
    poses = json.load(open(GRUNT, encoding="utf-8"))["pozy"]
    W, H = 480, 270
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    im = Image.new("RGB", (2 * (W + 4), len(poses) * (H + 20)), "white")
    d = ImageDraw.Draw(im)
    for r, p in enumerate(poses):
        for c, (lab, folder) in enumerate(((label_now, cur), (label_prev, prev))):
            f = os.path.join(folder, p["id"] + ".jpg") if folder else None
            x, y = c * (W + 4), r * (H + 20)
            if f and os.path.exists(f):
                im.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y + 20))
            d.text((x + 4, y + 3), f"{p['id']} · {lab}", fill="black", font=font)
    im.save(out, quality=80)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--etykieta", required=True)
    ap.add_argument("--url", default="http://localhost:3142/domy{dom}?kadr={id}&pora={pora}&czysty=1")
    ap.add_argument("--z-katalogu", help="gotowe zrzuty runtime zamiast robienia nowych")
    ap.add_argument("--nr", type=int)
    a = ap.parse_args()
    prev = last_iteration()
    nr = a.nr if a.nr is not None else (prev + 1 if prev is not None else 1)
    d = os.path.join(IT, f"{nr:02d}")
    rt = os.path.join(d, "runtime")
    os.makedirs(rt, exist_ok=True)
    t0 = datetime.datetime.now()
    if a.z_katalogu:
        for f in glob.glob(os.path.join(a.z_katalogu, "*.jpg")):
            shutil.copy(f, rt)
    else:
        subprocess.run([node(), os.path.join(HERE, "zrzuty.mjs"), "domy", rt, f"url={a.url}"], check=True, cwd=ROOT)
    subprocess.run([sys.executable, os.path.join(HERE, "scorecard.py"), rt, "--noc", "--etykieta", f"iteracja {nr:02d}: {a.etykieta}",
                    "--wynik", os.path.join(d, "wynik.md"), "--pary", os.path.join(d, "pary"), "--json", os.path.join(d, "wynik.json")], check=True)
    cur = json.load(open(os.path.join(d, "wynik.json"), encoding="utf-8"))
    prev_dir, regs, impr = None, [], []
    if prev is not None and prev != nr:
        pj = json.load(open(os.path.join(IT, f"{prev:02d}", "wynik.json"), encoding="utf-8"))
        prev_dir = os.path.join(IT, f"{prev:02d}", "runtime")
        old = {(r["shot"], r["id"]): r for r in pj["regiony"]}
        for r in cur["regiony"]:
            o = old.get((r["shot"], r["id"]))
            if not o or r["klasa"] == "info":
                continue
            delta = r["g"] - o["g"]
            (regs if delta > REGRES else impr if delta < -REGRES else []).append((delta, r, o))
    regs.sort(key=lambda t: -t[0])
    impr.sort(key=lambda t: t[0])
    if not a.z_katalogu and os.path.exists(GRUNT):
        subprocess.run([node(), os.path.join(ROOT, "docs", "inwestycja-3d", "audyt", "sweep_runtime.mjs"), GRUNT, os.path.join(d, "grunt")], check=True, cwd=ROOT)
        pg = os.path.join(IT, f"{prev:02d}", "grunt") if prev is not None else None
        grunt_sheet(os.path.join(d, "grunt"), pg if pg and os.path.exists(pg) else None, os.path.join(d, "arkusz-grunt.jpg"),
                    f"teraz ({nr:02d})", f"poprzednio ({prev:02d})" if pg and os.path.exists(pg) else "poprzednio (brak)")
    if not a.z_katalogu and os.path.exists(ELEW):
        audyt = os.path.join(ROOT, "docs", "inwestycja-3d", "audyt")
        subprocess.run([node(), os.path.join(audyt, "sweep_runtime.mjs"), ELEW, os.path.join(d, "elewacje")], check=True, cwd=ROOT)
        pe = os.path.join(IT, f"{prev:02d}", "elewacje") if prev is not None else None
        cmd = [sys.executable, os.path.join(audyt, "elewacje.py"), "arkusz", ELEW, os.path.join(d, "elewacje"), os.path.join(d, "arkusz-elewacje.jpg")]
        if pe and os.path.exists(pe):
            cmd.append(pe)
        subprocess.run(cmd, check=True)
    sheet(rt, prev_dir, os.path.join(d, "arkusz.jpg"), f"teraz ({nr:02d})", f"poprzednio ({prev:02d})" if prev_dir else "poprzednio (brak)")
    L = [f"# Iteracja {nr:02d}: {a.etykieta}", "", f"Wynik: {cur['w_progu']}/{cur['regionow']} w progu, średnie {cur['srednia']:.1f}."
         + (f" Poprzednio (iteracja {prev:02d}) — porównanie poniżej." if prev_dir else ""), "",
         f"## Regresje (pogorszenie > {REGRES} ΔE)", ""]
    L += [f"- **{r['shot']} / {r['id']}** ({r['typ']}): {o['g']:.1f} → {r['g']:.1f} (+{dl:.1f}); ΔL* {r['dL']:+.0f}, ΔC* {r['dC']:+.0f}" for dl, r, o in regs] or ["- brak"]
    L += ["", f"## Poprawy (o > {REGRES} ΔE)", ""]
    L += [f"- {r['shot']} / {r['id']} ({r['typ']}): {o['g']:.1f} → {r['g']:.1f} ({dl:.1f})" for dl, r, o in impr] or ["- brak"]
    worst = sorted([r for r in cur["regiony"] if r["ok"] is False], key=lambda r: -r["g"])[:8]
    L += ["", "## Największe odchyłki teraz", ""] + [f"- {r['shot']} / {r['id']} ({r['typ']}): ΔE {r['g']:.1f}, ΔL* {r['dL']:+.0f}, ΔC* {r['dC']:+.0f}" for r in worst]
    open(os.path.join(d, "regresje.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    trend = os.path.join(HERE, "trend.md")
    if not os.path.exists(trend):
        open(trend, "w", encoding="utf-8").write("# Trend scorecardu ΔE (runtime /domy ↔ rendery)\n\nBramka ΔE76 (ΔE*ab); progi: ściany/dachy/podłogi/sufity ≤ 10, szyby/zieleń/niebo ≤ 15. Szczegóły: `iteracje/NN/`.\n\n"
                                                 "| iteracja | czas | stan | w progu | średnie ΔE | regresje > 3 | poprawy > 3 |\n|---|---|---|---|---|---|---|\n")
    with open(trend, "a", encoding="utf-8") as f:
        f.write(f"| {nr:02d} | {t0:%Y-%m-%d %H:%M} | {a.etykieta} | {cur['w_progu']}/{cur['regionow']} ({100 * cur['w_progu'] / max(1, cur['regionow']):.0f}%) | {cur['srednia']:.1f} | {len(regs)} | {len(impr)} |\n")
    print(f"iteracja {nr:02d}: {cur['w_progu']}/{cur['regionow']}, srednie {cur['srednia']:.1f}, regresje {len(regs)}, poprawy {len(impr)} ({(datetime.datetime.now() - t0).seconds} s)")
    for dl, r, o in regs:
        print(f"  REGRES {r['shot']}/{r['id']} {o['g']:.1f} -> {r['g']:.1f}")


if __name__ == "__main__":
    main()
