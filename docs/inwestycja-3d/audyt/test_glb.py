"""TEST DOSTAWY GLB (przed każdą pętlą wizualną; 59, wnętrza, rośliny): tekstury, UV, przestrzenie barw, kwantyzacja, budżet.

    python test_glb.py <plik.glb> [...] [--json wynik.json]

BŁĄD (czerwony test = dostawa nie idzie do pętli wizualnej):
- normalTexture: średnia R, G poza 0,5 ± 0,1 albo B < 0,80 (czarna/odwrócona/zła przestrzeń barw — D-021, v9);
- baseColorTexture: czarna lub jednolicie ciemna (L < 0,03 albo L < 0,1 przy sd < 0,002) albo > 90 % pikseli czystej czerni/bieli;
- metallicRoughnessTexture: kanał G (roughness) stały 0 albo 1; occlusionTexture: kanał R średnio < 0,05 (czarne AO);
- ten sam obraz w roli sRGB (baseColor, emissive) i liniowej (normal, MR, occlusion) — konflikt colorSpace;
- materiał używa tekstury z texCoord N, a prymityw nie ma TEXCOORD_N (brak UV); indeks tekstury/obrazu poza zakresem;
- POSITION nie jest float32 (stratna kwantyzacja pozycji — D-006).
OSTRZEŻENIE: normal B 0,80–0,90 albo płaska normal mapa (sd < 0,003); albedo > 25 % pikseli czystej czerni/bieli;
occlusion stałe 1; materiał z nazwą domyślną SKP; tekstura > limitu px; MB / trójkąty ponad budzety.json.
Kod wyjścia 1 przy jakimkolwiek BŁĘDZIE. Wymaga numpy i Pillow (WebP/PNG/JPEG).
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRGB_ROLES, LINEAR_ROLES = {"albedo", "emissive"}, {"normal", "mr", "occlusion"}


def load(path):
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        raise ValueError("to nie jest GLB")
    off, js, binc = 12, None, b""
    while off < len(data):
        ln, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return js, binc, len(data)


def tex_source(js, ti):
    tex = js["textures"][ti]
    src = tex.get("source")
    if src is None:
        for ext in tex.get("extensions", {}).values():
            if "source" in ext:
                src = ext["source"]
    return src


def decode(js, binc, src):
    img = js["images"][src]
    if "bufferView" not in img:
        raise ValueError("obraz poza GLB (uri) — niedozwolone w dostawie")
    bv = js["bufferViews"][img["bufferView"]]
    raw = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
    return img.get("name") or f"image{src}", Image.open(io.BytesIO(raw))


def kind_of(path):
    n = os.path.basename(path).lower()
    return "zewnetrze" if "zewnetrze" in n else "wnetrze" if "wnetrze" in n else "inne"


def check(path, budgets):
    js, binc, size = load(path)
    errs, warns = [], []
    B = budgets.get(kind_of(path), budgets["inne"])
    nt, ni = len(js.get("textures", [])), len(js.get("images", []))
    roles, uses = {}, {}  # image → set(roles); (material index, role) → (ti, texCoord)
    for mi, m in enumerate(js.get("materials", [])):
        name = m.get("name", "")
        if not name or name in ("SKP Default", "Material") or name.startswith("Material."):
            warns.append(f"materiał z nazwą domyślną: '{name}'")
        pbr = m.get("pbrMetallicRoughness", {})
        for role, ref in (("albedo", pbr.get("baseColorTexture")), ("mr", pbr.get("metallicRoughnessTexture")), ("normal", m.get("normalTexture")),
                          ("occlusion", m.get("occlusionTexture")), ("emissive", m.get("emissiveTexture"))):
            if not ref:
                continue
            ti = ref["index"]
            if ti >= nt:
                errs.append(f"materiał {name}: {role} wskazuje teksturę {ti} poza zakresem")
                continue
            src = tex_source(js, ti)
            if src is None or src >= ni:
                errs.append(f"materiał {name}: {role} bez obrazu źródłowego")
                continue
            roles.setdefault(src, set()).add(role)
            uses[(mi, role)] = (src, ref.get("texCoord", 0), name)
    for src, rs in roles.items():
        if rs & SRGB_ROLES and rs & LINEAR_ROLES:
            errs.append(f"obraz {js['images'][src].get('name', src)} użyty jako sRGB ({', '.join(sorted(rs & SRGB_ROLES))}) i liniowy ({', '.join(sorted(rs & LINEAR_ROLES))}) — konflikt colorSpace")
    stats = {}
    for (mi, role), (src, tc, mname) in sorted(uses.items(), key=lambda kv: kv[1][0]):
        key = (src, role)
        if key in stats:
            continue
        try:
            iname, im = decode(js, binc, src)
        except Exception as e:  # noqa: BLE001
            errs.append(f"{role} obrazu {src}: {e}")
            continue
        if max(im.size) > B["tekstura_px"]:
            warns.append(f"{role} {iname}: {im.size[0]}×{im.size[1]} px > {B['tekstura_px']}")
        a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
        px = a.reshape(-1, 3)
        mean, std = px.mean(0), px.std(0)
        stats[key] = (iname, mean.round(3).tolist())
        tag = f"{role} {iname} (np. materiał {mname})"
        if role == "normal":
            if abs(mean[0] - 0.5) > 0.1 or abs(mean[1] - 0.5) > 0.1 or mean[2] < 0.80:
                errs.append(f"{tag}: średnia RGB {mean.round(3).tolist()} — oczekiwane ≈ (0,5; 0,5; ≥ 0,9)")
            elif mean[2] < 0.90:
                warns.append(f"{tag}: B = {mean[2]:.2f} (silny relief albo zła normalizacja)")
            if float(std.max()) < 0.003:
                warns.append(f"{tag}: płaska normal mapa (bez detalu)")
        elif role in SRGB_ROLES:
            lum = px @ np.array([0.2126, 0.7152, 0.0722])
            L, sd = float(lum.mean()), float(lum.std())
            pure = float(((lum < 0.02) | (lum > 0.98)).mean())
            if role == "albedo" and (L < 0.03 or (L < 0.1 and sd < 0.002) or pure > 0.9):
                errs.append(f"{tag}: czarne/jednolite albo czysta czerń/biel (L {L:.3f}, sd {sd:.4f}, czyste {pure:.0%})")
            elif role == "albedo" and pure > 0.25:
                warns.append(f"{tag}: {pure:.0%} pikseli czystej czerni/bieli")
        elif role == "mr":
            g = px[:, 1]
            if float(g.std()) < 0.002 and (float(g.mean()) < 0.01 or float(g.mean()) > 0.99):
                errs.append(f"{tag}: roughness stałe {float(g.mean()):.2f}")
        elif role == "occlusion":
            r = px[:, 0]
            if float(r.mean()) < 0.05:
                errs.append(f"{tag}: AO prawie czarne (średnio {float(r.mean()):.3f})")
            elif float(r.std()) < 0.002 and float(r.mean()) > 0.99:
                warns.append(f"{tag}: AO stałe 1 (bez efektu)")
    # UV, quantization, triangles
    acc = js.get("accessors", [])
    mats = js.get("materials", [])
    tri_mesh, quant = {}, set()
    for mi_, mesh in enumerate(js.get("meshes", [])):
        t = 0
        for p in mesh.get("primitives", []):
            at = p.get("attributes", {})
            pos = at.get("POSITION")
            if pos is not None and acc[pos].get("componentType") != 5126:
                quant.add((mesh.get("name", mi_), acc[pos].get("componentType"), acc[pos].get("normalized", False)))
            if p.get("mode", 4) == 4:
                t += (acc[p["indices"]]["count"] if "indices" in p else acc[pos]["count"]) // 3
            m = p.get("material")
            if m is not None:
                for (mi, role), (src, tc, mname) in uses.items():
                    if mi == m and f"TEXCOORD_{tc}" not in at:
                        errs.append(f"mesh {mesh.get('name', mi_)}: materiał {mname} ({role}) wymaga TEXCOORD_{tc}, prymityw go nie ma")
        tri_mesh[mi_] = t
    for q in sorted(quant, key=str)[:10]:
        errs.append(f"mesh {q[0]}: POSITION jako componentType {q[1]}{' (normalized)' if q[2] else ''} — stratna kwantyzacja pozycji")
    drawn = 0
    for n in js.get("nodes", []):
        if "mesh" in n:
            inst = n.get("extensions", {}).get("EXT_mesh_gpu_instancing", {}).get("attributes", {})
            k = acc[next(iter(inst.values()))]["count"] if inst else 1
            drawn += tri_mesh.get(n["mesh"], 0) * k
    file_tris = sum(tri_mesh.values())
    mb = size / 2 ** 20
    if mb > B["MB"]:
        warns.append(f"rozmiar {mb:.1f} MB > budżet {B['MB']} MB")
    if file_tris > B["trojkaty_plik"]:
        warns.append(f"trójkąty w pliku {file_tris:,} > budżet {B['trojkaty_plik']:,}".replace(",", " "))
    if drawn > B["trojkaty_rysowane"]:
        warns.append(f"trójkąty rysowane (z instancjami) {drawn:,} > budżet {B['trojkaty_rysowane']:,}".replace(",", " "))
    # dedupe messages
    errs = list(dict.fromkeys(errs))
    warns = list(dict.fromkeys(warns))
    return {"plik": path, "MB": round(mb, 2), "materialy": len(mats), "tekstury_sprawdzone": len(stats), "trojkaty_plik": file_tris,
            "trojkaty_rysowane": drawn, "bledy": errs, "ostrzezenia": warns, "ok": not errs}


def main():
    args, out = sys.argv[1:], None
    if "--json" in args:
        i = args.index("--json")
        out = args[i + 1]
        args = args[:i] + args[i + 2:]
    budgets = json.load(open(os.path.join(HERE, "budzety.json"), encoding="utf-8"))
    res = [check(p, budgets) for p in args]
    for r in res:
        print(f"== {r['plik']}: {r['MB']} MB, {r['materialy']} materiałów, {r['tekstury_sprawdzone']} tekstur, trójkąty {r['trojkaty_plik']} (rysowane {r['trojkaty_rysowane']})")
        for e in r["bledy"]:
            print("  BŁĄD", e)
        for w in r["ostrzezenia"]:
            print("  ostrzeżenie", w)
        print("  OK" if r["ok"] else "  CZERWONY — dostawa nie idzie do pętli wizualnej")
    if out:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.exit(0 if all(r["ok"] for r in res) else 1)


if __name__ == "__main__":
    main()
