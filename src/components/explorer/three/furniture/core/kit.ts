import * as THREE from "three";
import type { MaterialKey } from "../../materials/MaterialsProvider";
import { boxAt, merge, matrix, type Geo, type SoftBoxOpts, type Vec3T } from "./geometry";
import type { CustomKey } from "./materials";

/* ==========================================================================
   Kit: collects furniture parts per material and merges them into one
   geometry per material (one draw call per material per piece of furniture).
   ========================================================================== */

export type FurnKey = MaterialKey | CustomKey;

/** Vertex-coloured buckets keep their `color` attribute when merged. */
const COLORED = new Set<FurnKey>(["decor", "foliage"]);

export type BuiltKit = { key: FurnKey; geometry: Geo }[];

export class Kit {
  private parts = new Map<FurnKey, Geo[]>();

  add(key: FurnKey, g: Geo, pos?: Vec3T, rot?: Vec3T, scale?: number | Vec3T): this {
    if (pos || rot || scale !== undefined) g.applyMatrix4(matrix(pos, rot, scale));
    let list = this.parts.get(key);
    if (!list) {
      list = [];
      this.parts.set(key, list);
    }
    list.push(g);
    return this;
  }

  /** Axis-aligned box from world extents; UVs continue across boxes when `worldUV` is set. */
  box(key: FurnKey, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: SoftBoxOpts & { worldUV?: boolean } = {}): this {
    const { worldUV, ...rest } = o;
    const opts: SoftBoxOpts = worldUV ? { ...rest, uvOffset: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] } : rest;
    return this.add(key, boxAt(x0, x1, y0, y1, z0, z1, opts));
  }

  /** Merges another kit's parts, optionally transformed. */
  include(other: Kit, pos?: Vec3T, rot?: Vec3T): this {
    const m = pos || rot ? matrix(pos, rot) : null;
    for (const [key, list] of other.parts) for (const g of list) this.add(key, m ? g.clone().applyMatrix4(m) : g.clone());
    return this;
  }

  build(): BuiltKit {
    const out: BuiltKit = [];
    for (const [key, list] of this.parts) {
      if (!list.length) continue;
      out.push({ key, geometry: merge(list, COLORED.has(key)) });
    }
    return out;
  }

  triangles(): number {
    let n = 0;
    for (const list of this.parts.values()) for (const g of list) n += (g.getIndex()?.count ?? g.getAttribute("position").count) / 3;
    return n;
  }
}

export function disposeKit(kit: BuiltKit) {
  for (const p of kit) p.geometry.dispose();
}

/** Transform helper for instanced placements. */
export function instanceMatrix(pos: Vec3T, rotY = 0, scale = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(scale, scale, scale),
  );
}
