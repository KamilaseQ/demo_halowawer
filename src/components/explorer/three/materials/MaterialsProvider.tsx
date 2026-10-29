"use client";

import { useThree } from "@react-three/fiber";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { FinishId } from "@/lib/estate";
import type { SurfaceSlot } from "@/lib/estate/geometry/types";
import { loadTexture, uploadTextures } from "../loading";
import { useWarmupAxis, type WarmupAxis } from "../warmup";
import { FINISH_SPECS, FIXED, type FixedKey, type SlotSpec } from "./specs";
import { TEXTURE_SETS, type TextureSet } from "./textures";

export type MaterialKey = SurfaceSlot | FixedKey;
type MaterialMap = Record<MaterialKey, THREE.MeshPhysicalMaterial>;

const SLOTS = Object.keys(FINISH_SPECS.s1) as SurfaceSlot[];
const FINISH_IDS = Object.keys(FINISH_SPECS) as FinishId[];

/* ---------- textures ---------- */

function dataTexture(r: number, g: number, b: number, srgb = false) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/* Neutral placeholders keep every material's shader identical across finishes (no recompiles). */
const WHITE = dataTexture(255, 255, 255, true);
const FLAT_NORMAL = dataTexture(128, 128, 255);
const NEUTRAL = dataTexture(255, 255, 255);

type MapKind = "color" | "normal" | "rough" | "ao";
const KINDS: MapKind[] = ["color", "normal", "rough", "ao"];
type SlotMaps = Partial<Record<MapKind, THREE.Texture>>;
type FinishMaps = Partial<Record<SurfaceSlot, SlotMaps>>;

/** One texture per image file; every slot view of it shares its GPU source. */
const bases = new Map<string, Promise<THREE.Texture>>();

function baseTexture(url: string, kind: MapKind) {
  let p = bases.get(url);
  if (!p) {
    p = loadTexture(url).then((t) => {
      t.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    });
    p.catch(() => bases.delete(url));
    bases.set(url, p);
  }
  return p;
}

/** A slot's view of a shared image: its own repeat (real-world tile size) and rotation, one upload per image. */
function slotView(base: THREE.Texture, set: TextureSet, spec: SlotSpec, maxAnisotropy: number) {
  const version = base.source.version;
  const tex = base.clone();
  // clone() flags the shared image for re-upload although it has not changed: keep it uploaded once.
  base.source.version = version;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const repeat = 1 / (spec.tile ?? set.tile ?? 1);
  tex.repeat.set(repeat, repeat);
  tex.rotation = spec.rotation ?? 0;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

/** Each finish's textures, built once and kept: switching back and forth never reloads or re-uploads. */
const finishMaps = new Map<FinishId, Promise<FinishMaps>>();
/** Finishes whose textures are on the GPU of a renderer (a remounted stage has a new context). */
const uploaded = new WeakMap<THREE.WebGLRenderer, Map<FinishId, FinishMaps>>();

function readyMaps(gl: THREE.WebGLRenderer) {
  let m = uploaded.get(gl);
  if (!m) {
    m = new Map();
    uploaded.set(gl, m);
  }
  return m;
}

function finishTextures(finish: FinishId, maxAnisotropy: number) {
  let p = finishMaps.get(finish);
  if (!p) {
    const specs = FINISH_SPECS[finish];
    p = Promise.all(
      SLOTS.map(async (slot) => {
        const spec = specs[slot];
        const set = spec.texture ? TEXTURE_SETS[spec.texture] : undefined;
        if (!set) return [slot, undefined] as const;
        const maps: SlotMaps = {};
        await Promise.all(
          KINDS.map(async (kind) => {
            const url = set[kind];
            if (!url) return;
            try {
              maps[kind] = slotView(await baseTexture(url, kind), set, spec, maxAnisotropy);
            } catch {
              /* Missing asset: this map stays flat. */
            }
          }),
        );
        return [slot, maps] as const;
      }),
    ).then((entries) => Object.fromEntries(entries.filter(([, maps]) => maps)) as FinishMaps);
    finishMaps.set(finish, p);
  }
  return p;
}

/** Loads a finish's textures and uploads them to the GPU in short slices; afterwards it applies in one frame. */
export async function preloadFinish(gl: THREE.WebGLRenderer, finish: FinishId, alive: () => boolean = () => true, pace?: () => Promise<void>) {
  if (readyMaps(gl).has(finish)) return true;
  const maps = await finishTextures(finish, gl.capabilities.getMaxAnisotropy());
  const textures = Object.values(maps).flatMap((m) => Object.values(m ?? {}));
  if (!(await uploadTextures(gl, textures, alive, pace))) return false;
  readyMaps(gl).set(finish, maps);
  return true;
}

/* ---------- material construction ---------- */

function createMaterials(): MaterialMap {
  const map = {} as MaterialMap;
  for (const slot of SLOTS) {
    map[slot] = new THREE.MeshPhysicalMaterial({
      map: WHITE,
      normalMap: FLAT_NORMAL,
      roughnessMap: NEUTRAL,
      aoMap: NEUTRAL,
    });
    map[slot].name = slot;
  }
  for (const key of Object.keys(FIXED) as FixedKey[]) {
    const spec = FIXED[key];
    const m = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: "metalness" in spec ? spec.metalness : 0,
    });
    if (key === "glassReflect") {
      m.transparent = true;
      m.blending = THREE.AdditiveBlending;
      m.depthWrite = false;
      m.envMapIntensity = 1.7;
    }
    if (key === "glass") {
      m.transparent = true;
      m.opacity = FIXED.glass.opacity;
      m.depthWrite = false;
      m.envMapIntensity = 3;
      m.metalness = 0.1;
    }
    m.name = key;
    map[key] = m;
  }
  return map;
}

function applyScalars(m: THREE.MeshPhysicalMaterial, spec: SlotSpec) {
  m.color.set(spec.color);
  m.roughness = spec.roughness;
  m.metalness = spec.metalness ?? 0;
  m.normalScale.setScalar(spec.normalScale ?? 1);
  m.sheen = spec.sheen ?? 0;
  m.sheenColor.set(spec.sheenColor ?? "#ffffff");
  m.sheenRoughness = spec.sheenRoughness ?? 1;
  m.clearcoat = spec.clearcoat ?? 0;
  m.clearcoatRoughness = spec.clearcoatRoughness ?? 0;
  m.envMapIntensity = spec.envMapIntensity ?? 1;
}

function applyScalarsOf(mats: MaterialMap, finish: FinishId) {
  for (const slot of SLOTS) applyScalars(mats[slot], FINISH_SPECS[finish][slot]);
}

function assignMaps(mats: MaterialMap, maps: FinishMaps) {
  for (const slot of SLOTS) {
    const m = mats[slot];
    const set = maps[slot];
    m.map = set?.color ?? WHITE;
    m.normalMap = set?.normal ?? FLAT_NORMAL;
    m.roughnessMap = set?.rough ?? NEUTRAL;
    m.aoMap = set?.ao ?? NEUTRAL;
  }
}

/**
 * Applies a finish. Scalars switch at once; textures too when the finish is preloaded, otherwise they
 * load, upload and swap in together (the dissolve holds the old frame meanwhile).
 */
function applyFinish(gl: THREE.WebGLRenderer, mats: MaterialMap, finish: FinishId, withTextures: boolean, onTextures: () => void) {
  applyScalarsOf(mats, finish);
  for (const slot of SLOTS) mats[slot].userData.finish = finish;
  if (!withTextures) return;
  const ready = readyMaps(gl).get(finish);
  if (ready) {
    assignMaps(mats, ready);
    onTextures();
    return;
  }
  const current = () => mats[SLOTS[0]].userData.finish === finish;
  void preloadFinish(gl, finish, current)
    .then((ok) => {
      // A newer finish may have been applied while this one was loading.
      if (!ok || !current()) return;
      assignMaps(mats, readyMaps(gl).get(finish)!);
      onTextures();
    })
    .catch(() => {
      /* Missing assets: keep the flat colour version. */
    });
}

/* ---------- React API ---------- */

const MaterialsContext = createContext<MaterialMap | null>(null);

type ProviderProps = {
  finish: FinishId;
  /** Interior textures are only needed (and only loaded) where the interior is shown. */
  textures?: boolean;
  /** Called once the finish's textures are on the materials (dissolves wait for it). */
  onApplied?: (finish: FinishId) => void;
  /** Per-scene colour overrides that survive finish changes (e.g. the selected house's facade plaster). */
  tint?: Partial<Record<MaterialKey, string>>;
  children: ReactNode;
};

export function MaterialsProvider({ finish, textures = true, onApplied, tint, children }: ProviderProps) {
  const mats = useMemo(() => createMaterials(), []);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const tintKey = tint ? JSON.stringify(tint) : "";
  const tintRef = useRef(tintKey);
  const applyTint = useCallback(() => {
    if (tintRef.current) for (const [key, color] of Object.entries(JSON.parse(tintRef.current) as Record<MaterialKey, string>)) mats[key as MaterialKey].color.set(color);
  }, [mats]);
  useLayoutEffect(() => {
    tintRef.current = tintKey;
    applyFinish(gl, mats, finish, textures, () => {
      invalidate();
      onApplied?.(finish);
    });
    applyTint();
    invalidate();
  }, [mats, finish, textures, gl, invalidate, onApplied, tintKey, applyTint]);

  // Clearcoat and sheen switch shader features on and off between finishes: compile every finish's variant up front.
  const axis = useMemo<WarmupAxis>(
    () => ({
      states: FINISH_IDS.map((f) => () => applyScalarsOf(mats, f)),
      restore: () => {
        applyScalarsOf(mats, mats[SLOTS[0]].userData.finish as FinishId);
        applyTint();
      },
    }),
    [mats, applyTint],
  );
  useWarmupAxis(axis);

  useEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose();
    },
    [mats],
  );

  return <MaterialsContext.Provider value={mats}>{children}</MaterialsContext.Provider>;
}

/** Shared, finish-aware material for a surface slot (or a fixed material such as glass). */
export function useMaterial(key: MaterialKey) {
  const mats = useContext(MaterialsContext);
  if (!mats) throw new Error("useMaterial must be used inside <MaterialsProvider>");
  return mats[key];
}

export function useMaterials() {
  const mats = useContext(MaterialsContext);
  if (!mats) throw new Error("useMaterials must be used inside <MaterialsProvider>");
  return mats;
}
