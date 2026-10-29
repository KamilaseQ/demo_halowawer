"use client";

import { Suspense, useLayoutEffect, type ReactNode } from "react";
import * as THREE from "three";

/* ==========================================================================
   What the stage is still waiting for: suspended subtrees (GLB models, HDRIs),
   tracked async work (panorama PMREMs) and everything requested through
   three's loading manager (textures, models, HDRIs). The scene gate reveals or
   swaps the scene only when all of it is idle, so nothing streams in visibly.
   ========================================================================== */

const state = { pending: 0, busy: false, loaded: 0, total: 0 };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const manager = THREE.DefaultLoadingManager;
manager.onStart = (_url, loaded, total) => {
  state.busy = true;
  state.loaded = loaded;
  state.total = total;
  notify();
};
manager.onProgress = (_url, loaded, total) => {
  state.loaded = loaded;
  state.total = total;
  notify();
};
manager.onLoad = () => {
  state.busy = false;
  state.loaded = state.total;
  notify();
};
manager.onError = () => notify();

export function subscribeLoading(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function loadingIdle() {
  return state.pending === 0 && !state.busy;
}

/** Items finished / requested since `base` (a value of `loadedCount()` taken earlier). */
export function loadingProgress(base: number) {
  const total = state.total - base;
  return total > 0 ? Math.min(1, (state.loaded - base) / total) : 1;
}

export const loadedCount = () => state.loaded;

/** Counts a promise as pending scene work until it settles. */
export function track<T>(work: Promise<T>): Promise<T> {
  state.pending++;
  notify();
  const done = () => {
    state.pending--;
    notify();
  };
  work.then(done, done);
  return work;
}

function Pending() {
  useLayoutEffect(() => {
    state.pending++;
    notify();
    return () => {
      state.pending--;
      notify();
    };
  }, []);
  return null;
}

/** Suspense boundary whose fallback counts as "still loading" for the scene gate. */
export function Deferred({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Pending />}>{children}</Suspense>;
}

/* ---------- images ---------- */

/*
 * Images decode off the main thread (createImageBitmap), so a texture upload never stalls a frame on
 * JPEG decoding. Bitmaps are flipped at decode time and uploaded without colour conversion: the same
 * pixels as TextureLoader's flipY upload. Same browser gate as three's GLTFLoader (Safari < 17 and
 * Firefox < 98 have broken ImageBitmap options).
 */
function bitmapsSupported() {
  if (typeof createImageBitmap === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  const safariVersion = safari ? Number(ua.match(/Version\/(\d+)/)?.[1] ?? -1) : -1;
  const firefoxVersion = ua.includes("Firefox") ? Number(ua.match(/Firefox\/(\d+)\./)?.[1] ?? -1) : -1;
  return !(safari && safariVersion < 17) && !(firefoxVersion !== -1 && firefoxVersion < 98);
}

type Image = ImageBitmap | HTMLImageElement;

let bitmapLoader: THREE.ImageBitmapLoader | null | undefined;
let imageLoader: THREE.ImageLoader | undefined;
const images = new Map<string, Promise<Image>>();

export function loadImage(url: string): Promise<Image> {
  let p = images.get(url);
  if (!p) {
    if (bitmapLoader === undefined) {
      bitmapLoader = bitmapsSupported() ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" }) : null;
    }
    imageLoader ??= new THREE.ImageLoader();
    p = (bitmapLoader ?? imageLoader).loadAsync(url) as Promise<Image>;
    p.catch(() => images.delete(url));
    images.set(url, p);
  }
  return p;
}

/** Drops a decoded image that is no longer needed on the CPU side (e.g. a panorama turned into a PMREM). */
export function forgetImage(url: string) {
  const p = images.get(url);
  images.delete(url);
  void p?.then((image) => isBitmap(image) && (image as ImageBitmap).close(), () => {});
}

const isBitmap = (image: unknown) => typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;

/** Gives a texture an image from loadImage(), oriented like TextureLoader's output. */
export function setImage(texture: THREE.Texture, image: Image) {
  texture.image = image;
  texture.flipY = !isBitmap(image);
  texture.needsUpdate = true;
  return texture;
}

/** One GPU source per image file, shared by every texture made from it (each file uploads once). */
const sources = new Map<string, THREE.TextureSource<unknown>>();

/** Texture for an image file that fills in when the image arrives (TextureLoader.load semantics, decoded off-thread). */
export function lazyTexture(url: string, onLoad?: (texture: THREE.Texture) => void, onError?: (e: unknown) => void) {
  const texture = new THREE.Texture();
  let source = sources.get(url);
  if (!source) {
    source = new THREE.TextureSource(null);
    sources.set(url, source);
  }
  texture.source = source;
  loadImage(url)
    .then((image) => {
      texture.flipY = !isBitmap(image);
      if (source.data !== image) {
        source.data = image;
        texture.needsUpdate = true;
      } else {
        // The shared image is already in (and maybe uploaded): only this texture is new.
        texture.version++;
      }
      onLoad?.(texture);
    })
    .catch((e) => {
      /* Missing asset: the material renders without this map. */
      onError?.(e);
    });
  return texture;
}

/** lazyTexture() as a promise that resolves once the image is in. */
export function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => void lazyTexture(url, resolve, reject));
}

/* ---------- GPU upload ---------- */

const TEXTURE_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "alphaMap",
  "emissiveMap",
  "bumpMap",
  "lightMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularIntensityMap",
  "specularColorMap",
  "transmissionMap",
  "thicknessMap",
] as const;

/** Every texture referenced by the materials under `root`. */
export function sceneTextures(root: THREE.Object3D) {
  const out = new Set<THREE.Texture>();
  const add = (m: THREE.Material) => {
    const rec = m as unknown as Record<string, unknown>;
    for (const k of TEXTURE_KEYS) {
      const t = rec[k];
      if (t instanceof THREE.Texture && t.image) out.add(t);
    }
    const uniforms = (m as THREE.ShaderMaterial).uniforms;
    if (uniforms) for (const u of Object.values(uniforms)) if (u?.value instanceof THREE.Texture && u.value.image) out.add(u.value);
  };
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(add);
    else add(mat);
  });
  return out;
}

const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Uploads textures to the GPU in short slices (~6 ms each) so the main thread stays responsive.
 * Textures sharing a source upload once. `alive()` aborts a superseded run. `pace`, if given, is awaited
 * before every texture instead (background prefetch: one upload at a time, only while the stage rests).
 */
export async function uploadTextures(
  gl: THREE.WebGLRenderer,
  textures: Iterable<THREE.Texture>,
  alive: () => boolean = () => true,
  pace?: () => Promise<void>,
) {
  let slice = performance.now();
  for (const t of textures) {
    if (pace) await pace();
    if (!alive()) return false;
    gl.initTexture(t);
    if (!pace && performance.now() - slice > 6) {
      await yieldTask();
      slice = performance.now();
    }
  }
  return alive();
}
