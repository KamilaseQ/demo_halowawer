"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { damp } from "maath/easing";
import { getHouse, type HouseId, type LevelId } from "@/lib/estate";
import { PLACEMENTS } from "@/lib/estate/geometry/site";
import type { HouseModel } from "@/lib/estate/geometry/types";
import { estateWalkModel, modelMirrored } from "@/lib/estate/geometry";
import { houseFrame, mirrorNode, shotVecs, toEstate, toHouse, type HouseFrame } from "../space";
import { registerCameraControls, walkClip } from "./controls";
import { ESTATE_INTRO, ESTATE_LIMITS, ESTATE_SHOT, nodeLook, shotLook, verticalFov, type Look } from "./shots";
import { useExplorer } from "../../state/store";

const { ACTION } = CameraControlsImpl;

export type Rig = "estate" | "house" | "walk";
type Space = "estate" | "house";

/** Field of view per rig. Walk derives vertical FOV from a fixed horizontal FOV (stable across aspect ratios). */
function targetFov(rig: Rig, aspect: number, nodeHfov?: number) {
  const { clamp } = THREE.MathUtils;
  // A node may carry its own lens (render-matched); free walking eases back to the wide interior lens.
  if (rig === "walk") return clamp(verticalFov(nodeHfov ?? 74, aspect), nodeHfov ? 20 : 48, 78);
  // Orbit views keep a minimum horizontal FOV so portrait phones still see the whole model.
  if (rig === "house") return clamp(Math.max(34, verticalFov(60, aspect)), 34, 66);
  return clamp(Math.max(28, verticalFov(48, aspect)), 28, 64);
}

function configure(c: CameraControlsImpl, rig: Rig, model: HouseModel | null, mirrored: boolean, level: LevelId | null, walkLevel: LevelId) {
  const walk = rig === "walk";
  c.azimuthRotateSpeed = walk ? -0.32 : 0.7;
  c.polarRotateSpeed = walk ? -0.32 : 0.7;
  c.dollyToCursor = !walk;
  c.mouseButtons.left = ACTION.ROTATE;
  c.mouseButtons.right = walk ? ACTION.NONE : ACTION.TRUCK;
  c.mouseButtons.middle = walk ? ACTION.NONE : ACTION.DOLLY;
  c.mouseButtons.wheel = walk ? ACTION.ZOOM : ACTION.DOLLY;
  c.touches.one = ACTION.TOUCH_ROTATE;
  c.touches.two = walk ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY_TRUCK;
  c.touches.three = ACTION.NONE;
  c.minZoom = 1;
  c.maxZoom = walk ? 2.2 : 1;
  if (!walk) void c.zoomTo(1, true);
  c.minAzimuthAngle = -Infinity;
  c.maxAzimuthAngle = Infinity;

  if (walk) {
    c.minDistance = 0.001;
    c.maxDistance = Infinity;
    c.minPolarAngle = THREE.MathUtils.degToRad(35);
    c.maxPolarAngle = THREE.MathUtils.degToRad(150);
    if (model) {
      const [x0, y0, x1, y1] = model.bounds;
      const elevation = model.levels.find((l) => l.level === walkLevel)?.elevation ?? 0;
      const eye = elevation + model.walk.eyeHeight;
      const [z0, z1] = mirrored ? [-y1, -y0] : [y0, y1];
      // Outdoors the eye rides the terrain (the walk clipper sets its height): only a loose vertical band.
      const [ylo, yhi] = model.walk.terrain ? [0.5, 4.5] : [eye - 0.6, eye + 0.2];
      c.setBoundary(new THREE.Box3(new THREE.Vector3(x0, ylo, z0), new THREE.Vector3(x1, yhi, z1)));
    }
    return;
  }

  c.setBoundary(undefined);
  if (rig === "house") {
    c.minDistance = level === null ? 7 : 7;
    c.maxDistance = 48;
    c.minPolarAngle = THREE.MathUtils.degToRad(8);
    c.maxPolarAngle = THREE.MathUtils.degToRad(level === null ? 86 : 72);
    return;
  }
  c.minDistance = ESTATE_LIMITS.minDistance;
  c.maxDistance = ESTATE_LIMITS.maxDistance;
  c.minPolarAngle = ESTATE_LIMITS.minPolar;
  c.maxPolarAngle = ESTATE_LIMITS.maxPolar;
}

/** A generic exterior shot for houses without a traced model: from the garden side, 3/4 view. */
function genericHouseShot(id: HouseId): Look {
  const p = PLACEMENTS[id];
  const [depth, width] = p.size;
  const sign = p.mirrored ? -1 : 1;
  return {
    position: new THREE.Vector3(-15, 7.5, sign * (width / 2 - 9)),
    target: new THREE.Vector3(depth / 2, 3.4, (sign * width) / 2),
  };
}

function lookFor(rig: Rig, house: HouseId | null, model: HouseModel | null, mirrored: boolean, level: LevelId | null, node: string | null): Look | null {
  if (rig === "estate") return shotLook(ESTATE_SHOT);
  // The estate walk has no house: its points carry their own eye heights.
  if (rig === "walk" && model?.walk.terrain) {
    const n = model.walk.nodes.find((x) => x.id === node) ?? model.walk.nodes.find((x) => x.id === model.walk.start)!;
    return nodeLook(n, model.walk.eyeHeight, 0);
  }
  if (!house) return null;
  if (rig === "house") {
    if (!model) return genericHouseShot(house);
    const shot = level === null ? model.shots.exterior : (model.shots.levels[level] ?? model.shots.exterior);
    return shotVecs(mirrored, shot);
  }
  if (!model) return null;
  const n = model.walk.nodes.find((x) => x.id === node) ?? model.walk.nodes.find((x) => x.id === model.walk.start)!;
  const elevation = model.levels.find((l) => l.level === n.level)?.elevation ?? 0;
  return nodeLook(mirrorNode(mirrored, n), elevation + model.walk.eyeHeight, elevation);
}

/** Re-expresses the current camera pose in the other space so the switch is invisible under the dissolve. */
function handoff(c: CameraControlsImpl, frame: HouseFrame, to: "estate" | "house") {
  const p = c.getPosition(new THREE.Vector3());
  const q = c.getTarget(new THREE.Vector3());
  for (const v of [p, q]) {
    if (to === "house") toHouse(frame, v);
    else toEstate(frame, v);
  }
  void c.setLookAt(p.x, p.y, p.z, q.x, q.y, q.z, false);
}

export function rigFor(view: string, mode: string): Rig {
  if (view === "estate") return "estate";
  return mode === "walk" ? "walk" : "house";
}

export function CameraRig({ model: houseModel }: { model: HouseModel | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const level = useExplorer((s) => s.level);
  const node = useExplorer((s) => s.node);
  const nodeRequest = useExplorer((s) => s.nodeRequest);
  const house = useExplorer((s) => s.house);
  const entry = useExplorer((s) => s.entry);
  const ready = useExplorer((s) => s.ready);
  const shot = useExplorer((s) => s.shot);
  // The estate has its own walk (BOR2 scene cameras, terrain, collisions); in a house the house's model.
  const estateWalk = view === "estate" && mode === "walk";
  const model = estateWalk ? estateWalkModel() : houseModel;
  const rig: Rig = estateWalk && model ? "walk" : rigFor(view, mode === "walk" && !model ? "model" : mode);
  const space: Space = view === "estate" ? "estate" : "house";
  const mirrored = house ? modelMirrored(getHouse(house), model) : false;
  const walkLevel: LevelId = (model?.walk.nodes.find((n) => n.id === node)?.level ?? 0) as LevelId;

  useEffect(() => {
    registerCameraControls(ref.current);
    return () => registerCameraControls(null);
  }, []);

  const lastRig = useRef<Rig | null>(null);
  const lastSpace = useRef<Space | null>(null);
  const lastHouse = useRef<HouseId | null>(null);
  // The estate opens on a slow fly-in once, the first time the 3D maquette is shown.
  const introPending = useRef(true);

  // QA framing: hold the render's camera exactly (no limits, no transition), flag it once a frame shows it.
  useEffect(() => {
    const c = ref.current;
    if (!c || !shot) return;
    c.setBoundary(undefined);
    c.minDistance = 0;
    c.maxDistance = Infinity;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI;
    const [px, py, pz] = shot.position;
    const [tx, ty, tz] = shot.target;
    void c.setLookAt(px, py, pz, tx, ty, tz, false);
    useExplorer.setState({ shotReady: false });
    invalidate();
    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (++frames >= 4 && useExplorer.getState().settled) useExplorer.setState({ shotReady: true });
      else raf = requestAnimationFrame(tick);
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shot, rig, ready, invalidate]);

  useEffect(() => {
    const c = ref.current;
    if (!c || useExplorer.getState().shot) return;
    const prev = lastRig.current;
    const changingRig = prev !== rig;
    // A cleared node in walk mode means free walking: keep the user's pose.
    if (!changingRig && rig === "walk" && node === null) return;
    const look = lookFor(rig, house, model, mirrored, level, node);
    if (!look) return;

    // Crossing between estate space and house space: re-express the pose first.
    const frameHouse = space === "estate" ? lastHouse.current : house;
    if (prev && frameHouse && lastSpace.current && lastSpace.current !== space) handoff(c, houseFrame(frameHouse, houseModel), space);
    lastRig.current = rig;
    lastSpace.current = space;
    if (house) lastHouse.current = house;
    c.normalizeRotations();
    configure(c, rig, model, mirrored, level, walkLevel);

    // Intro: before the maquette is visible, park the camera high and far; the fly-in starts on reveal.
    if (rig === "estate" && introPending.current && (!ready || entry === "photo")) {
      const i = shotLook(ESTATE_INTRO);
      void c.setLookAt(i.position.x, i.position.y, i.position.z, i.target.x, i.target.y, i.target.z, false);
      invalidate();
      return;
    }
    let smooth = changingRig ? 0.55 : 0.38;
    if (rig === "estate" && introPending.current) {
      // The fly-over: a slow spherical arc (camera-controls damps azimuth/polar/radius, so it orbits rather
      // than cutting through). Any drag or wheel takes over mid-flight.
      introPending.current = false;
      smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.01 : 0.85;
      useExplorer.setState({ introDone: true });
    }
    // Spring transitions start from the current pose, so any of them can be interrupted by input.
    c.smoothTime = smooth;
    void c
      .setLookAt(look.position.x, look.position.y, look.position.z, look.target.x, look.target.y, look.target.z, prev !== null)
      .then(() => {
        c.smoothTime = 0.3;
      });
    invalidate();
    // nodeRequest re-runs the effect when the same node is requested again.
  }, [rig, space, model, houseModel, mirrored, level, node, nodeRequest, house, walkLevel, entry, ready, invalidate]);

  // Keyboard walking: arrows / WASD step and turn (desktop + accessibility).
  useEffect(() => {
    if (rig !== "walk") return;
    const onKey = (e: KeyboardEvent) => {
      const c = ref.current;
      const t = e.target as HTMLElement | null;
      if (!c || e.metaKey || e.ctrlKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      const step = k === "arrowup" || k === "w" ? 0.7 : k === "arrowdown" || k === "s" ? -0.7 : 0;
      const turn = k === "arrowleft" || k === "a" ? 0.3 : k === "arrowright" || k === "d" ? -0.3 : 0;
      if (!step && !turn) return;
      e.preventDefault();
      c.smoothTime = 0.3;
      if (step) {
        // Horizontal step along the view azimuth; eye height stays fixed (camera-controls forward() would follow pitch).
        const target = c.getTarget(new THREE.Vector3(), true);
        const a = c.azimuthAngle;
        const to = new THREE.Vector3(target.x - Math.sin(a) * step, target.y, target.z - Math.cos(a) * step);
        // Outdoors walls, fences and the terrain have the last word.
        walkClip()?.(target, to);
        void c.moveTo(to.x, to.y, to.z, true);
      }
      if (turn) void c.rotate(turn, 0, true);
      if (useExplorer.getState().node !== null) useExplorer.setState({ node: null, photo: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rig]);

  /*
   * View window: a lens shift that frames the scene beside the glass panel / above the sheet. Every
   * parameter is damped, so panel changes and rig changes morph the projection smoothly.
   */
  const win = useRef<{ x: number; y: number } | null>(null);
  const gl = useThree((s) => s.gl);

  /*
   * Free stage area: beside the desktop panel/rail, between the mobile top bars and the sheet. Measuring
   * reads layout, so it is cached: re-measured when the stage size or rig changes, when a floating
   * element resizes (sheet drag), and at most every 200 ms while frames run.
   */
  const region = useRef<{ l: number; r: number; t: number; b: number; at: number; key: string } | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      region.current = null;
      invalidate();
    });
    const observed = new WeakSet<Element>();
    const observe = () =>
      document.querySelectorAll("[data-explorer-panel], [data-explorer-rail], [data-entry-controls]").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        ro.observe(el);
      });
    observe();
    const mo = new MutationObserver(observe);
    const root = gl.domElement.closest("section") ?? document.body;
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [gl, invalidate]);

  // Rolling the panel up or down changes the free area without resizing anything observed: measure again
  // now, and once more when the rail has glided to its new place.
  const panelCollapsed = useExplorer((s) => s.panelCollapsed);
  useEffect(() => {
    region.current = null;
    invalidate();
    const t = window.setTimeout(() => {
      region.current = null;
      invalidate();
    }, 720);
    return () => window.clearTimeout(t);
  }, [panelCollapsed, invalidate]);

  const freeRegion = (W: number, H: number) => {
    const key = `${W}x${H}|${rig}`;
    const now = performance.now();
    const cached = region.current;
    if (cached && cached.key === key && now - cached.at < 200) return cached;
    let l = 0;
    let r = W;
    let t = 0;
    let b = H;
    if (rig !== "walk") {
      // The glass header floats over the stage's top edge: frame below it (as the photo entry does).
      t = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--explorer-header")) || 0;
      const canvas = gl.domElement.getBoundingClientRect();
      for (const el of document.querySelectorAll<HTMLElement>("[data-explorer-panel], [data-explorer-rail], [data-entry-controls]")) {
        const rr = el.getBoundingClientRect();
        if (!rr.width || !rr.height || rr.right <= canvas.left || rr.bottom <= canvas.top) continue;
        const x0 = rr.left - canvas.left;
        const x1 = rr.right - canvas.left;
        const y0 = rr.top - canvas.top;
        const y1 = rr.bottom - canvas.top;
        const vertical = rr.height > rr.width;
        if (vertical && x0 < W * 0.4) l = Math.max(l, x1);
        else if (vertical && x0 > W * 0.6) r = Math.min(r, x0);
        else if (y0 > H * 0.4) b = Math.min(b, y0);
        else if (y1 < H * 0.4) t = Math.max(t, y1);
      }
    }
    region.current = { l, r, t, b, at: now, key };
    return region.current;
  };

  // Priority -1: before the frame's other updates, so DOM labels project with this frame's lens.
  // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
  useFrame((_, dt) => {
    const W = size.width;
    const H = size.height;
    if (shot) {
      // The render's lens: vertical FOV, near plane, vertical shift (+ = horizon lower, more sky).
      // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
      camera.fov = shot.yfov;
      camera.near = shot.near;
      camera.aspect = W / H;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      // eslint-disable-next-line react-hooks/immutability -- the three.js camera is mutable by design, not React state
      camera.projectionMatrix.elements[9] += 2 * shot.shift;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      return;
    }
    if (camera.near !== 0.05) camera.near = 0.05;
    const nodeHfov = rig === "walk" ? model?.walk.nodes.find((n) => n.id === node)?.hfov : undefined;
    const fov = targetFov(rig, W / Math.max(1, H), nodeHfov);
    // First-person views stay on-axis; orbit views centre in the free region.
    const { l, r, t, b } = freeRegion(W, H);
    const goal = { x: -((l + r) / 2 - W / 2), y: -((t + b) / 2 - H / 2) };
    if (!win.current) {
      win.current = { ...goal };
       
      camera.fov = fov;
    }
    const w = win.current;
    let moving = damp(camera, "fov", fov, 0.55, dt);
    moving = damp(w, "x", goal.x, 0.3, dt) || moving;
    moving = damp(w, "y", goal.y, 0.3, dt) || moving;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, w.x, w.y, W, H);
    camera.updateProjectionMatrix();
    if (moving) invalidate();
  }, -1);

  return <CameraControls ref={ref} makeDefault smoothTime={0.3} draggingSmoothTime={0.1} />;
}
