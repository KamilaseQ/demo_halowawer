"""Raport z pliku .glb (bez zależności): rozmiar, rozszerzenia, węzły, draw calle,
trójkąty, materiały, tekstury (format i wymiary), kamery.

Uruchomienie:  python check_glb.py <plik.glb> [kolejny.glb ...]
"""
import json
import struct
import sys
from collections import Counter


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError("to nie jest GLB v2")
    off, gltf, binary = 12, None, b""
    while off < len(data):
        length, kind = struct.unpack_from("<I4s", data, off)
        chunk = data[off + 8:off + 8 + length]
        if kind == b"JSON":
            gltf = json.loads(chunk)
        elif kind == b"BIN\x00":
            binary = chunk
        off += 8 + length
    return data, gltf, binary


def image_size(blob):
    if blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        fourcc = blob[12:16]
        if fourcc == b"VP8 ":
            w, h = struct.unpack_from("<HH", blob, 26)
            return "webp", w & 0x3FFF, h & 0x3FFF
        if fourcc == b"VP8L":
            b = int.from_bytes(blob[21:25], "little")
            return "webp", (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
        if fourcc == b"VP8X":
            return "webp", int.from_bytes(blob[24:27], "little") + 1, int.from_bytes(blob[27:30], "little") + 1
    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack_from(">II", blob, 16)
        return "png", w, h
    if blob[:2] == b"\xff\xd8":
        i = 2
        while i < len(blob):
            marker, size = blob[i + 1], struct.unpack_from(">H", blob, i + 2)[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack_from(">HH", blob, i + 5)
                return "jpeg", w, h
            i += 2 + size
    return "?", 0, 0


def report(path):
    data, g, binary = read_glb(path)
    print("=" * 70)
    print(path)
    print("rozmiar: %.2f MB | generator: %s" % (len(data) / 2**20, g.get("asset", {}).get("generator")))
    print("rozszerzenia uzyte: %s | wymagane: %s" % (g.get("extensionsUsed", []), g.get("extensionsRequired", [])))

    meshes, nodes, acc = g.get("meshes", []), g.get("nodes", []), g.get("accessors", [])

    def tris(prim):
        mode = prim.get("mode", 4)
        if "indices" in prim:
            n = acc[prim["indices"]]["count"]
        else:
            n = acc[prim["attributes"]["POSITION"]]["count"]
        return n // 3 if mode == 4 else 0

    mesh_tris = [sum(tris(p) for p in m["primitives"]) for m in meshes]
    draw_calls = total_tris = instanced_nodes = instances = 0
    for n in nodes:
        if "mesh" not in n:
            continue
        prims = len(meshes[n["mesh"]]["primitives"])
        gpu = n.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        count = acc[gpu["attributes"]["TRANSLATION"]]["count"] if gpu and "TRANSLATION" in gpu["attributes"] else 1
        if gpu:
            instanced_nodes += 1
            instances += count
        draw_calls += prims
        total_tris += mesh_tris[n["mesh"]] * count
    print("wezly: %d | siatki: %d | wezly z siatka: %d | draw calle (przed laczeniem w three.js): ~%d"
          % (len(nodes), len(meshes), sum(1 for n in nodes if "mesh" in n), draw_calls))
    print("GPU instancing: %d wezlow -> %d instancji" % (instanced_nodes, instances))
    print("trojkaty w scenie: %d | w unikalnych siatkach: %d" % (total_tris, sum(mesh_tris)))

    mats = g.get("materials", [])
    blend = Counter(m.get("alphaMode", "OPAQUE") for m in mats)
    print("materialy: %d %s | z teksturami: %d" % (
        len(mats), dict(blend), sum(1 for m in mats if m.get("pbrMetallicRoughness", {}).get("baseColorTexture"))))

    views = g.get("bufferViews", [])
    imgs = []
    for im in g.get("images", []):
        if "bufferView" in im:
            v = views[im["bufferView"]]
            blob = binary[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
            fmt, w, h = image_size(blob)
            imgs.append((im.get("name", "?"), fmt, w, h, len(blob)))
    tex_bytes = sum(i[4] for i in imgs)
    print("tekstury: %d, razem %.2f MB, max %s px" % (
        len(imgs), tex_bytes / 2**20, max((max(i[2], i[3]) for i in imgs), default=0)))
    for name, fmt, w, h, size in sorted(imgs, key=lambda i: -i[4])[:12]:
        print("   %-45s %-4s %4dx%-4d %6.0f KB" % (name[:45], fmt, w, h, size / 1024))
    cams = g.get("cameras", [])
    cam_nodes = [n.get("name") for n in nodes if "camera" in n]
    print("kamery: %d %s" % (len(cams), cam_nodes[:40]))


for p in sys.argv[1:]:
    report(p)
