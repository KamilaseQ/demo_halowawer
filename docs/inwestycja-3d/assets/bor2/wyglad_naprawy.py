"""Naprawy geometrii brył BOR2 w źródłowym .blend (cały model osiedla, wszystkie domy naraz).

1. Tynk zasłaniający okna: model SKP ma w bryłach domów zabłąkane ściany (np. trójkąt w elewacji D),
   które leżą w licu ściany i przechodzą przez otwór okienny -> w renderze i w three.js widać
   trójkąt tynku na szybie. Wykrywamy otwory (ramy OKNA* i szyby SZYBY1 cofnięte 2-60 cm za lico)
   i odejmujemy ich prostokąty od ścian TYNK A/B/C leżących w licu.

Uruchomienie w Blenderze (MCP): exec(open(r"<ten plik>", encoding="utf-8").read())
  zmienna NAPRAW = False -> tylko raport.
"""
import bmesh
import bpy
from mathutils import Matrix, Vector

NAPRAW = globals().get("NAPRAW", True)
HOUSES = {"Component#88": "A", "Component#57": "B", "Component#119": "C", "Component#94": "D",
          "Component#35": "E", "Component#39": "F", "Component#40": "G"}
WALL_MATS = {"TYNK A", "TYNK B", "TYNK C", "TYNK A2", "TYNK B2", "TYNK C2"}   # lico + tylne ściany wnęk
OPEN_MATS = {"OKNA A", "OKNA B", "OKNA C", "SZYBY1"}
RECESS_MATS = {"TYNK A2", "TYNK B2", "TYNK C2"}     # ściany wnęk wejściowych (w głębi do ~1,5 m)
EPS = 1e-4
SHRINK = 0.06
USE_RECESS = False


def leaves(ob, world):
    if ob.type == "MESH" and ob.data and len(ob.data.polygons):
        yield ob, world
    coll = ob.instance_collection if ob.instance_type == "COLLECTION" else None
    if coll is not None:
        base = world @ Matrix.Translation(-coll.instance_offset)
        for child in coll.all_objects:
            yield from leaves(child, base @ child.matrix_world)


def axis_of(n):
    for i in range(3):
        if abs(n[i]) > 0.999:
            return i, (1 if n[i] > 0 else -1)
    return None, 0


def uv_axes(ax):
    return [i for i in range(3) if i != ax]


def merge_rects(rects, tol=0.012):
    rects = [list(r) for r in rects]
    changed = True
    while changed:
        changed = False
        out = []
        while rects:
            a = rects.pop()
            i = 0
            while i < len(rects):
                b = rects[i]
                if a[0] <= b[2] + tol and b[0] <= a[2] + tol and a[1] <= b[3] + tol and b[1] <= a[3] + tol:
                    a = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    rects.pop(i)
                    changed = True
                else:
                    i += 1
            out.append(a)
        rects = out
    return rects


def clip(poly, k, c, keep_less):
    """Sutherland-Hodgman: półpłaszczyzna współrzędnej k (0=u,1=v) względem c."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        pin = p[k] <= c + EPS if keep_less else p[k] >= c - EPS
        qin = q[k] <= c + EPS if keep_less else q[k] >= c - EPS
        if pin:
            out.append(p)
        if pin != qin:
            t = (c - p[k]) / (q[k] - p[k])
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def area2(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
                   for i in range(len(poly)))) / 2 if len(poly) >= 3 else 0.0


def subtract(poly, r):
    u0, v0, u1, v1 = r
    pieces = [clip(poly, 0, u0, True), clip(poly, 0, u1, False)]
    mid = clip(clip(poly, 0, u0, False), 0, u1, True)
    if len(mid) >= 3:
        pieces += [clip(mid, 1, v0, True), clip(mid, 1, v1, False)]
    return [p for p in pieces if area2(p) > 1e-5]


def overlap(poly, r):
    p = poly
    for k, c, less in ((0, r[0], False), (0, r[2], True), (1, r[1], False), (1, r[3], True)):
        p = clip(p, k, c, less)
        if len(p) < 3:
            return 0.0
    return area2(p)


def fix_house(comp_name, letter):
    top = bpy.data.objects["domki"]
    comp = next(o for o in top.instance_collection.objects if o.name == comp_name)
    base = top.matrix_world @ Matrix.Translation(-top.instance_collection.instance_offset)
    parts = list(leaves(comp, base @ comp.matrix_world))
    bodies = [(o, M) for o, M in parts
              if any(s.material and s.material.name in WALL_MATS for s in o.material_slots)]
    report = []
    for body, Mb in bodies:
        Mi = Mb.inverted()
        # otwory w układzie bryły: (oś, znak lica?) -> lista (d, u0, v0, u1, v1)
        open_faces = []
        recess_faces = []   # (oś normalnej, bbox min, bbox max) ścian wnęk
        for o, M in parts:
            ML = Mi @ M
            R = ML.to_3x3()
            for p in o.data.polygons:
                m = o.material_slots[p.material_index].material if p.material_index < len(o.material_slots) else None
                if not m or m.name not in OPEN_MATS | RECESS_MATS:
                    continue
                n = (R @ p.normal).normalized()
                ax, _ = axis_of(n)
                if ax is None:
                    continue
                pts = [ML @ o.data.vertices[v].co for v in p.vertices]
                if m.name in RECESS_MATS:
                    recess_faces.append((ax, [min(q[i] for q in pts) for i in range(3)],
                                         [max(q[i] for q in pts) for i in range(3)]))
                ua, va = uv_axes(ax)
                open_faces.append((ax, pts[0][ax], min(q[ua] for q in pts), min(q[va] for q in pts),
                                   max(q[ua] for q in pts), max(q[va] for q in pts),
                                   0.3 if m.name in RECESS_MATS else 0.02))
        me = body.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        uv_layer = bm.loops.layers.uv.active
        # trójkąty tak, jak trafiają do renderu/GLB (wielokąty SKP z "mostkami" bywają niezgodne z shoelace)
        tris_of = {}
        for tri in bm.calc_loop_triangles():
            tris_of.setdefault(tri[0].face.index, []).append([l.vert.co.copy() for l in tri])
        to_kill, to_add = [], []
        for f in bm.faces:
            m = body.material_slots[f.material_index].material if f.material_index < len(body.material_slots) else None
            # ściany: tynki + duże płaszczyzny w kolorze stolarki (w G tylna ściana wnęki ma materiał OKNA C)
            if not m or not (m.name in WALL_MATS or (m.name in OPEN_MATS - {"SZYBY1"} and f.calc_area() >= 4.0)):
                continue
            ax, sg = axis_of(f.normal)
            if ax is None or ax == 2:      # tylko ściany pionowe (Z = góra)
                continue
            d = f.verts[0].co[ax]
            ua, va = uv_axes(ax)
            # otwory 2-60 cm za licem (w głąb domu = przeciwnie do normalnej)
            # otwory okienne: ramy/szyby 2–60 cm za licem
            rects = merge_rects([r[2:6] for r in open_faces
                                 if r[0] == ax and r[6] < 0.1 and 0.02 <= (d - r[1]) * sg <= 0.6])
            rects = [r for r in rects if min(r[2] - r[0], r[3] - r[1]) >= 0.25]
            # wnęki wejściowe: otwór = rzut ścian bocznych i sufitu wnęki (TYNK X2, prostopadłe do lica),
            # które zaczynają się w licu (do 5 cm) i sięgają w głąb domu do 1,6 m
            rr = []
            for nax, lo, hi in recess_faces:
                if nax == ax:
                    continue
                near = hi[ax] if sg > 0 else lo[ax]      # krawędź ściany wnęki od strony lica
                far = lo[ax] if sg > 0 else hi[ax]
                if abs(near - d) <= 0.05 and 0.3 <= (d - far) * sg <= 1.6:
                    rr.append((lo[ua], lo[va], hi[ua], hi[va]))
            if USE_RECESS:   # wyłączone: przy wielokątach SKP z "mostkami" daje fałszywe trafienia (np. C)
                rects += [r for r in merge_rects(rr, tol=0.05) if min(r[2] - r[0], r[3] - r[1]) >= 0.8]
            if not rects:
                continue
            tris = [[(c[ua], c[va]) for c in t] for t in tris_of.get(f.index, [])]
            # liczy się tylko wnętrze otworu (rama bywa osadzona w murze -> wąski pas na krawędzi to nie błąd)
            hit = [r for r in rects
                   if sum(overlap(t, (r[0] + SHRINK, r[1] + SHRINK, r[2] - SHRINK, r[3] - SHRINK)) for t in tris) > 2e-3]
            if not hit:
                continue
            poly = [(v.co[ua], v.co[va]) for v in f.verts]
            pieces = tris
            for r in hit:
                pieces = [q for p in pieces for q in subtract(p, r)]
            lost = sum(area2(t) for t in tris) - sum(area2(p) for p in pieces)
            report.append((letter, body.name, f.index, len(poly), round(area2(poly), 3), round(lost, 3), len(pieces)))
            to_kill.append(f)
            to_add.append((f, ax, d, ua, va, pieces))
        if NAPRAW and to_kill:
            for f, ax, d, ua, va, pieces in to_add:
                for p in pieces:
                    vs = []
                    for (u, v) in p:
                        co = [0.0, 0.0, 0.0]
                        co[ax], co[ua], co[va] = d, u, v
                        vs.append(bm.verts.new(co))
                    try:
                        nf = bm.faces.new(vs)
                    except ValueError:
                        continue
                    nf.material_index = f.material_index
                    nf.smooth = False
                    if nf.normal.dot(f.normal) < 0:
                        nf.normal_flip()
                    if uv_layer:
                        for loop in nf.loops:
                            loop[uv_layer].uv = (loop.vert.co[ua], loop.vert.co[va])
            bmesh.ops.delete(bm, geom=to_kill, context="FACES")
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            bm.to_mesh(me)
            me.update()
        bm.free()
    return report


def clip_line(poly, a, b, keep_left):
    """Obcięcie wielokąta półpłaszczyzną wyznaczoną prostą a->b (lewa/prawa strona)."""
    def side(p):
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = side(p), side(q)
        pin = sp >= -1e-9 if keep_left else sp <= 1e-9
        qin = sq >= -1e-9 if keep_left else sq <= 1e-9
        if pin:
            out.append(p)
        if pin != qin and abs(sp - sq) > 1e-12:
            t = sp / (sp - sq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def ccw(poly):
    s = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
            for i in range(len(poly)))
    return s > 0


def intersect_convex(p, q):
    out = p
    left = ccw(q)
    for i in range(len(q)):
        out = clip_line(out, q[i], q[(i + 1) % len(q)], left)
        if len(out) < 3:
            return []
    return out


def subtract_convex(p, q):
    """P minus Q dla wypukłego Q: kawałki P po zewnętrznej stronie kolejnych krawędzi Q."""
    pieces, rest = [], p
    left = ccw(q)
    for i in range(len(q)):
        a, b = q[i], q[(i + 1) % len(q)]
        outside = clip_line(rest, a, b, not left)
        if area2(outside) > 1e-6:
            pieces.append(outside)
        rest = clip_line(rest, a, b, left)
        if len(rest) < 3:
            break
    return pieces


def inside_tri(p, t):
    (x1, y1), (x2, y2), (x3, y3) = t
    d1 = (p[0] - x2) * (y1 - y2) - (x1 - x2) * (p[1] - y2)
    d2 = (p[0] - x3) * (y2 - y3) - (x2 - x3) * (p[1] - y3)
    d3 = (p[0] - x1) * (y3 - y1) - (x3 - x1) * (p[1] - y1)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def cover_count(t2, faces, idx):
    """Ile współpłaszczyznowych ścian pokrywa środek największego trójkąta ściany idx."""
    t = max(t2[idx], key=area2)
    c = ((t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3)
    return sum(1 for f in faces if any(inside_tri(c, tt) for tt in t2[f.index]))


def fix_double_cover(body):
    """Ściany SKP z otworami rozbite na kawałki, które mają się znosić (parzysto-nieparzyście):
    ściana leżąca w całości w innej, współpłaszczyznowej ścianie z tym samym materiałem = dziura.
    Usuwamy mniejszą i wycinamy jej obszar z większej. Zwraca liczbę naprawionych par."""
    me = body.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    tris_of = {}
    for tri in bm.calc_loop_triangles():
        tris_of.setdefault(tri[0].face.index, []).append([l.vert.co.copy() for l in tri])
    groups = {}
    for f in bm.faces:
        ax, sg = axis_of(f.normal)
        if ax is None:
            continue
        key = (ax, sg, round(f.verts[0].co[ax], 3), f.material_index)
        groups.setdefault(key, []).append(f)
    kill, add, fixed = set(), [], 0
    for (ax, sg, d, mi), faces in groups.items():
        if len(faces) < 2:
            continue
        ua, va = uv_axes(ax)
        t2 = {f.index: [[(c[ua], c[va]) for c in t] for t in tris_of.get(f.index, [])] for f in faces}
        area = {i: sum(area2(t) for t in ts) for i, ts in t2.items()}
        for small in faces:
            if small.index in kill:
                continue
            for big in faces:
                if big is small or big.index in kill or area[big.index] <= area[small.index]:
                    continue
                inter = sum(area2(intersect_convex(ts, tb)) for ts in t2[small.index] for tb in t2[big.index])
                if area[small.index] > 0.05 and inter >= 0.98 * area[small.index] and                         cover_count(t2, faces, small.index) % 2 == 0:   # parzyście pokryte = dziura
                    pieces = t2[big.index]
                    for ts in t2[small.index]:
                        pieces = [q for p in pieces for q in subtract_convex(p, ts)]
                    kill |= {small.index, big.index}
                    add.append((big, ax, d, ua, va, pieces))
                    fixed += 1
                    break
    if NAPRAW and kill:
        uv_layer = bm.loops.layers.uv.active
        for f, ax, d, ua, va, pieces in add:
            for p in pieces:
                vs = []
                for (u, v) in p:
                    co = [0.0, 0.0, 0.0]
                    co[ax], co[ua], co[va] = d, u, v
                    vs.append(bm.verts.new(co))
                try:
                    nf = bm.faces.new(vs)
                except ValueError:
                    continue
                nf.material_index = f.material_index
                if nf.normal.dot(f.normal) < 0:
                    nf.normal_flip()
                if uv_layer:
                    for loop in nf.loops:
                        loop[uv_layer].uv = (loop.vert.co[ua], loop.vert.co[va])
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index in kill], context="FACES")
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(me)
        me.update()
    bm.free()
    return fixed


def fix_fence_posts(fence_mat="OGRODZENIE_PANEL", post_name="OGRODZENIE_SLUPKI", max_area=0.2):
    """Słupki i kapsle płotu (małe ściany) -> pełny antracyt, panele zostają z teksturą z alfą."""
    fm = bpy.data.materials.get(fence_mat)
    if fm is None:
        return 0
    pm = bpy.data.materials.get(post_name)
    if pm is None:
        pm = bpy.data.materials.new(post_name)
        pm.use_nodes = True
    b = next(n for n in pm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.045, 0.048, 0.052, 1)
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Metallic"].default_value = 0.3
    n = 0
    for me in bpy.data.meshes:
        if fm.name not in [m.name for m in me.materials if m]:
            continue
        fi = [i for i, m in enumerate(me.materials) if m and m.name == fm.name]
        if pm.name not in [m.name for m in me.materials if m]:
            me.materials.append(pm)
        pi = [i for i, m in enumerate(me.materials) if m and m.name == pm.name][0]
        for p in me.polygons:
            if p.material_index in fi and p.area < max_area:
                p.material_index = pi
                n += 1
    return n


def fix_fence_panels(fence_mat="OGRODZENIE_PANEL", tile=0.75):
    """D-001/D-002: przęsło w SKP = cienka bryła z dwoma licami -> pręty widać podwójnie i migoczą.
    Zostaje jedno lico na przęsło (materiał dwustronny), krawędzie poziome przęseł usunięte,
    UV od nowa: U wzdłuż przęsła, V w pionie (pręty zawsze pionowe), kafel 0,75 m jak tekstura."""
    fm = bpy.data.materials.get(fence_mat)
    if fm is None:
        return 0, 0
    removed = kept = 0
    for me in bpy.data.meshes:
        idx = [i for i, m in enumerate(me.materials) if m and m.name == fence_mat]
        if not idx or not me.users:
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UV")
        panel = [f for f in bm.faces if f.material_index in idx]
        kill = set(f for f in panel if abs(f.normal.z) > 0.5)       # górne/dolne krawędzie przęseł
        vert = [f for f in panel if f not in kill and f.calc_area() >= 0.2]
        for f in vert:
            if f in kill:
                continue
            n = f.normal
            c = f.calc_center_median()
            for g in vert:
                if g is f or g in kill:
                    continue
                if n.dot(g.normal) < -0.99 and abs((g.calc_center_median() - c).dot(n)) < 0.12 and                         (g.calc_center_median() - c).length < max(f.calc_area(), 1.0) ** 0.5 * 2:
                    # zostaw lico zwrócone na +X/+Y, usuń przeciwne
                    drop = f if (n.x + n.y) < (g.normal.x + g.normal.y) else g
                    kill.add(drop)
                    break
        for f in vert:
            if f in kill:
                continue
            t = Vector((0, 0, 1)).cross(f.normal)
            t = t.normalized() if t.length > 1e-6 else Vector((1, 0, 0))
            for loop in f.loops:
                co = loop.vert.co
                loop[uv].uv = (co.dot(t) / tile, co.z / tile)
            kept += 1
        removed += len(kill)
        if NAPRAW:
            bmesh.ops.delete(bm, geom=list(kill), context="FACES")
            bm.to_mesh(me)
            me.update()
        bm.free()
    return removed, kept


def fix_driveways(src="SKP Default", dst="KOSTKA_PODJAZD", mesh_names=("podłoże:geometry",)):
    """D-004: podjazdy przed garażami i utwardzenia w podłożu mają nieprzypisany materiał SKP."""
    dm = bpy.data.materials.get(dst)
    n = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.name not in mesh_names or dm is None:
            continue
        me = ob.data
        si = [i for i, m in enumerate(me.materials) if m and m.name == src]
        if not si:
            continue
        if dst not in [m.name for m in me.materials if m]:
            me.materials.append(dm)
        di = [i for i, m in enumerate(me.materials) if m and m.name == dst][0]
        for p in me.polygons:
            if p.material_index in si:
                if NAPRAW:
                    p.material_index = di
                n += 1
    return n


def remove_party_wall_windows():
    """D-013: okna w ścianach wspólnych szeregu i bliźniaków (G/F parter + łazienki E/F/G) -> usunięte.
    Wykrywanie: instancja komponentu z szybą, cienka (< 0,7 m w X), przecinająca płaszczyznę ściany wspólnej."""
    walls = [40.95, 48.45, 73.80, 99.80]
    top = bpy.data.objects["domki"]
    base = top.matrix_world @ Matrix.Translation(-top.instance_collection.instance_offset)
    gone = []

    def scan(coll, M, letter, depth):
        off = Matrix.Translation(-coll.instance_offset)
        for o in list(coll.objects):
            if o.instance_type != "COLLECTION" or not o.instance_collection:
                continue
            ic = o.instance_collection
            W = M @ off @ o.matrix_world
            mats = {s.material.name for ob in ic.all_objects if ob.type == "MESH" for s in ob.material_slots if s.material}
            if "SZYBY1" in mats and not mats & {"TYNK A", "TYNK B", "TYNK C"}:
                Wi = W @ Matrix.Translation(-ic.instance_offset)
                pts = [Wi @ ob.matrix_world @ Vector(v) for ob in ic.all_objects if ob.type == "MESH" for v in ob.bound_box]
                x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
                if x1 - x0 < 0.7 and any(x0 - 0.05 <= w <= x1 + 0.05 for w in walls):
                    gone.append("%s/%s" % (letter, o.name))
                    if NAPRAW:
                        bpy.data.objects.remove(o, do_unlink=True)
                    continue
            if depth < 2:
                scan(ic, W, letter, depth + 1)

    for comp, letter in HOUSES.items():
        c = next(o for o in top.instance_collection.objects if o.name == comp)
        scan(c.instance_collection, base @ c.matrix_world, letter, 0)
    return gone


def build_fence_rods(fence_mat="OGRODZENIE_PANEL", rod_mat="OGRODZENIE_PRETY", step=0.05, rod=0.005, wire=0.004):
    """Płot panelowy 3D z geometrii (b6): pręty pionowe 5 mm co 5 cm, podwójne druty poziome 4 mm na 4 poziomach.
    Zastępuje przęsła z teksturą z alfą (z daleka przerywane kreski). Jeden obiekt PLOT_PRETY w układzie świata."""
    import math
    rm = bpy.data.materials.get(rod_mat) or bpy.data.materials.new(rod_mat)
    rm.use_nodes = True
    b = next(n for n in rm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.040, 0.044, 0.048, 1)
    b.inputs["Roughness"].default_value = 0.5
    b.inputs["Metallic"].default_value = 0.3
    rm.diffuse_color = (0.040, 0.044, 0.048, 1)
    dg = bpy.context.evaluated_depsgraph_get()
    panels = []
    for inst in dg.object_instances:
        ob = inst.object
        if ob.type != "MESH":
            continue
        names = [s.material.name if s.material else "" for s in ob.material_slots]
        if fence_mat not in names:
            continue
        M = inst.matrix_world
        for p in ob.data.polygons:
            if p.material_index < len(names) and names[p.material_index] == fence_mat and p.area >= 0.2:
                vs = [M @ ob.data.vertices[v].co for v in p.vertices]
                panels.append(vs)
    if not panels:
        return 0, 0
    bm = bmesh.new()

    def box(c0, c1, t, n, hw, hn):
        """prostopadłościan od c0 do c1 (oś), przekrój hw wzdłuż t, hn wzdłuż n; bez denek."""
        rings = []
        for c in (c0, c1):
            rings.append([bm.verts.new(c + t * sx * hw + n * sy * hn) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))

    up = Vector((0, 0, 1))
    for vs in panels:
        z0 = min(v.z for v in vs)
        z1 = max(v.z for v in vs)
        bottom = sorted(vs, key=lambda v: v.z)[:2]
        p0, p1 = bottom[0].copy(), bottom[1].copy()
        p0.z = p1.z = z0
        t = p1 - p0
        L = t.length
        if L < 0.1:
            continue
        t.normalize()
        n = t.cross(up).normalized()
        k = max(1, int(L / step))
        for i in range(k):
            c = p0 + t * ((i + 0.5) * L / k)
            box(c, c + up * (z1 - z0), t, n, rod / 2, rod / 2)
        h = z1 - z0
        for zz in (0.08, h * 0.36, h * 0.68, h - 0.04):
            for side in (-1, 1):
                o = n * side * (rod / 2 + wire / 2)
                a = p0 + up * zz + o
                box(a, a + t * L, up, n, wire / 2, wire / 2)
    for f in bm.faces:
        f.smooth = True          # wspólne wierzchołki (o połowę mniejszy GLB), pręt wygląda na okrągły
    me = bpy.data.meshes.get("PLOT_PRETY") or bpy.data.meshes.new("PLOT_PRETY")
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(rm)
    ob = bpy.data.objects.get("PLOT_PRETY") or bpy.data.objects.new("PLOT_PRETY", me)
    ob.data = me
    coll = bpy.data.collections.get("BOR2_ZEWNĘTRZE_MODEL") or bpy.context.scene.collection
    if ob.name not in coll.objects:
        coll.objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    # przęsła z teksturą usuwamy (zostają słupki)
    for mesh in bpy.data.meshes:
        idx = [i for i, m in enumerate(mesh.materials) if m and m.name == fence_mat]
        if not idx or mesh.name == "PLOT_PRETY":
            continue
        bmx = bmesh.new()
        bmx.from_mesh(mesh)
        bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if f.material_index in idx], context="FACES")
        bmx.to_mesh(mesh)
        bmx.free()
        mesh.update()
    return len(panels), tris


def run():
    print("D-013 okna w scianach wspolnych:", remove_party_wall_windows())
    print("D-004 podjazdy SKP Default -> KOSTKA_PODJAZD, scian:", fix_driveways())
    print("D-001/002 przesla plotu: usuniete lica (podwojne/krawedzie), lica z nowym UV:", fix_fence_panels())
    top = bpy.data.objects["domki"]
    base = top.matrix_world @ Matrix.Translation(-top.instance_collection.instance_offset)
    for comp, letter in HOUSES.items():
        c = next(o for o in top.instance_collection.objects if o.name == comp)
        for o, M in leaves(c, base @ c.matrix_world):
            if any(s.material and s.material.name in WALL_MATS for s in o.material_slots):
                n = fix_double_cover(o)
                if n:
                    print("dom %s %s: podwojnie pokryte sciany (dziury) %d" % (letter, o.name, n))
    allrep = []
    for comp, letter in HOUSES.items():
        allrep += fix_house(comp, letter)
    for r in allrep:
        print("dom %s %s twarz %d (%d wierz., %.3f m2): wycieto %.3f m2 -> %d kawalkow" % r)
    print("razem twarzy tynku nachodzacych na otwory:", len(allrep), "| naprawa:", NAPRAW)
    if NAPRAW:
        print("slupki plotu -> OGRODZENIE_SLUPKI:", fix_fence_posts())
        print("plot z pretow (przesla, trojkaty):", build_fence_rods())


run()
