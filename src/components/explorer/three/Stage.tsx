"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { ARRANGEMENTS, getHouse, has3dInterior, houses, houseTag, type FinishId, type HouseId } from "@/lib/estate";
import { modelFor } from "@/lib/estate/geometry";
import { ESTATE_CENTER, PLACEMENTS } from "@/lib/estate/geometry/site";
import { CameraRig } from "./camera/CameraRig";
import { cameraControls } from "./camera/controls";
import { Effects } from "./Effects";
import { EstateWorld } from "./estate/EstateWorld";
import { labelAnchor } from "./estate/labels";
import { bor2Version, subscribeBor2 } from "./bor2/exterior";
import { HouseWorld } from "./house/HouseWorld";
import { Bor2HouseWorld } from "./bor2/Bor2HouseWorld";
import { EstateWalk } from "./bor2/EstateWalk";
import { bor2Enabled } from "./bor2/exterior";
import { BOR2_OFFSET } from "@/lib/estate/geometry/bor2";
import { SceneLabels, type SceneLabel } from "./labels/SceneLabels";
import { Lighting } from "./lighting/Lighting";
import { Deferred } from "./loading";
import { MaterialsProvider } from "./materials/MaterialsProvider";
import { Prefetch } from "./prefetch";
import { SceneGate } from "./SceneGate";
import { houseFrame } from "./space";
import { registerStageCommands, useExplorer, withDissolve } from "../state/store";
import { deviceTier } from "../tier";
import { perfFlag } from "../perf";
import { setCoverage } from "./coverage";

/** A GPU copy of the frame just drawn (still intact in the drawing buffer at this point). */
function copyCanvas(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return copy;
}

/**
 * QA/audit API (dev, or ?debug=1): every object's origin (userData.source on its nearest tagged ancestor:
 * bor2 · proc · zielen · wnetrze · okolica · ui), visibility switches by name, and a free camera.
 */
function explorerDebug(scene: THREE.Scene, invalidate: () => void) {
  const sourceOf = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData?.source) return p.userData.source as string;
    return "proc";
  };
  const visible = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const round = (v: number) => Math.round(v * 100) / 100;
  const pathOf = (o: THREE.Object3D) => {
    const parts: string[] = [];
    for (let p: THREE.Object3D | null = o; p && p !== scene; p = p.parent) if (p.name) parts.unshift(p.name);
    return parts.join("/");
  };
  return {
    /** What the visitor is looking at: device tier and post quality (screenshots from the client). */
    info() {
      const s = useExplorer.getState();
      return { tier: deviceTier(), postQuality: deviceTier() === "lite" ? "low" : s.postQuality, view: s.view, house: s.house, mode: s.mode, timeOfDay: s.timeOfDay };
    },
    dumpScene() {
      scene.updateMatrixWorld(true);
      const out: unknown[] = [];
      const box = new THREE.Box3();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const g = mesh.geometry;
        const count = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
        const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
        box.setFromObject(mesh);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        out.push({
          name: mesh.name || mesh.parent?.name || "",
          path: pathOf(mesh),
          source: sourceOf(mesh),
          material: mats.map((m) => m.name || m.type),
          sourceMaterial: (mesh.userData.sourceMaterial as string[] | undefined) ?? null,
          bbox: box.isEmpty() ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map(round),
          triangles: Math.round((count / 3) * instances),
          instances,
          visible: visible(mesh),
          pickOnly: mats.every((m) => !m.visible),
        });
      });
      return out;
    },
    setFlags({ ukryj = [], pokaz = [] }: { ukryj?: string[]; pokaz?: string[] }) {
      for (const n of ukryj) scene.getObjectsByProperty("name", n).forEach((o) => (o.visible = false));
      for (const n of pokaz) scene.getObjectsByProperty("name", n).forEach((o) => (o.visible = true));
      invalidate();
    },
    /** GLB frame (like ujecia-porownawcze.json) unless `estate: true`; fov = vertical degrees; shift = lens shift. */
    setCamera({ pos, target, fov = 45, shift = 0, near = 0.05, estate = false }: { pos: number[]; target: number[]; fov?: number; shift?: number; near?: number; estate?: boolean }) {
      const o = estate ? [0, 0, 0] : BOR2_OFFSET;
      const to = (p: number[]): [number, number, number] => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
      useExplorer.setState({ shot: { id: "debug", position: to(pos), target: to(target), yfov: fov, shift, near }, shotReady: false, introDone: true, entry: "model" });
    },
  };
}

/** Wires imperative commands (frame freeze/capture, zoom). */
function StageBridge() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const pending = useRef<((canvas: HTMLCanvasElement) => void)[]>([]);

  useEffect(() => {
    const afterNextFrame = <T,>(read: (canvas: HTMLCanvasElement) => T) =>
      new Promise<T>((resolve) => {
        pending.current.push((canvas) => resolve(read(canvas)));
        invalidate();
      });
    registerStageCommands({
      freeze: () => afterNextFrame(copyCanvas),
      capture: () =>
        afterNextFrame((canvas) => {
          try {
            return canvas.toDataURL("image/jpeg", 0.9);
          } catch {
            return null;
          }
        }),
      zoom: (delta) => {
        const c = cameraControls();
        if (!c) return;
        const s = useExplorer.getState();
        if (s.view === "house" && s.mode === "walk") void c.zoom(delta * 0.6, true);
        else void c.dolly(delta * (s.view === "estate" ? 14 : 5), true);
      },
    });
    return () => registerStageCommands(null);
  }, [invalidate]);

  // Measurement handle for production builds (?debug=1): renderer + scene for GPU-memory and draw-call probes.
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).has("debug");
    if (debug) (window as unknown as { __probe: unknown }).__probe = { gl, scene, state: useExplorer };
    if (debug || process.env.NODE_ENV !== "production") (window as unknown as { __explorerDebug: unknown }).__explorerDebug = explorerDebug(scene, invalidate);
  }, [gl, scene, invalidate]);

  // QA framing: objects the developer's render does not show ("ukryj"), hidden while the shot holds.
  const shot = useExplorer((s) => s.shot);
  useEffect(() => {
    const hidden = (shot?.hide ?? []).flatMap((n) => scene.getObjectsByProperty("name", n));
    hidden.forEach((o) => (o.visible = false));
    invalidate();
    return () => hidden.forEach((o) => (o.visible = true));
  }, [shot, scene, invalidate]);

  // Priority 2 runs after the EffectComposer (priority 1), while the drawing buffer is still intact.
  useFrame(() => {
    if (pending.current.length) pending.current.splice(0).forEach((read) => read(gl.domElement));
  }, 2);

  return null;
}

/**
 * Drops the post stack to its cheaper mode only when the GPU really can't keep up: judged on continuous
 * rendering (camera moves, transitions) of a shown scene, never on the idle gaps of the demand loop.
 * The switch compiles new post shaders (~1 s on Windows), so it never lands mid-gesture: it waits until the
 * camera rests and no pointer is down, then runs under a dissolve (frozen frame, cross-fade).
 */
function QualityGovernor() {
  const last = useRef(0);
  const samples = useRef<number[]>([]);
  const slow = useRef(0);
  const decided = useRef(false);
  useFrame(() => {
    const now = performance.now();
    const dt = now - last.current;
    last.current = now;
    if (decided.current || dt > 100 || !useExplorer.getState().settled) return;
    const s = samples.current;
    s.push(dt);
    if (s.length < 90) return;
    const median = [...s].sort((a, b) => a - b)[s.length >> 1];
    s.length = 0;
    slow.current = median > 25 ? slow.current + 1 : 0;
    if (slow.current >= 2) decided.current = true;
  });
  useEffect(() => {
    let pressed = false;
    const down = () => void (pressed = true);
    const up = () => void (pressed = false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const timer = window.setInterval(() => {
      const s = useExplorer.getState();
      // At rest: no frame for 0.4 s (the demand loop renders while anything moves), nothing pressed or dissolving.
      if (!decided.current || pressed || !s.settled || s.dissolve || performance.now() - last.current < 400) return;
      window.clearInterval(timer);
      void withDissolve(() => useExplorer.setState({ postQuality: "low" }));
    }, 200);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return null;
}

const setHovered = (id: HouseId | null) => useExplorer.setState({ hovered: id });

/** Hover lives here, so pointer moves over the houses don't re-render the whole stage. */
function EstateScene({ detailed, highlight, onSelect }: { detailed: HouseId | null; highlight: boolean; onSelect: (id: HouseId) => void }) {
  const hovered = useExplorer((s) => s.hovered);
  const selected = useExplorer((s) => s.house);
  return <EstateWorld detailed={detailed} hovered={hovered} selected={selected} highlight={highlight} onHover={setHovered} onSelect={onSelect} />;
}

/** Glass pills over the roofs: "Dom B · 119,8 m² · 1,60 mln zł" (sold houses: a quiet "sprzedany"). */
function HouseLabels({ visible, onSelect }: { visible: boolean; onSelect: (id: HouseId) => void }) {
  const hovered = useExplorer((s) => s.hovered);
  // Anchors move onto the BOR2 volumes once the model is in.
  const bor2 = useSyncExternalStore(subscribeBor2, bor2Version, bor2Version);
  const items: SceneLabel[] = useMemo(
    () =>
      houses.map((h) => ({
        id: `house-${h.id}`,
        // Spec: the label starts with the letter alone ("B · 119,8 m² · 1,60 mln zł"); houseTag starts "Dom" + NBSP.
        text: houseTag(h).slice(4),
        // Neighbours in a pair/row alternate high and low, so all seven tags read at the overview distance.
        position: new THREE.Vector3(...labelAnchor(h.id)).add(new THREE.Vector3(0, LABEL_LIFT[h.id], 0)),
        onClick: () => onSelect(h.id),
        active: hovered === h.id,
        muted: h.status === "sold",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bor2: anchors read the loaded model's boxes
    [hovered, onSelect, bor2],
  );
  return <SceneLabels items={items} visible={visible} stack />;
}

const LABEL_LIFT: Record<HouseId, number> = { A: 0, B: 3.2, C: 0, D: 3.2, E: 0, F: 3.2, G: 0 };

const HOUSE_CENTER = new THREE.Vector3(4.9, 0, 4.1);
const ESTATE_FOCUS = new THREE.Vector3(...ESTATE_CENTER);

export default function Stage({ onSelect }: { onSelect: (id: HouseId) => void }) {
  const view = useExplorer((s) => s.view);
  const houseId = useExplorer((s) => s.house);
  const finish = useExplorer((s) => s.finish);
  const arrangementState = useExplorer((s) => s.arrangement);
  const entry = useExplorer((s) => s.entry);
  // Phones and ≤4 GB devices start on the cheaper post stack (no MSAA, half-res AO) and DPR ≤ 1.5.
  const lite = deviceTier() === "lite";
  const postQuality = useExplorer((s) => s.postQuality);
  const quality = lite ? "low" : postQuality;
  // Cut-out edges: alpha-to-coverage only where the post stack multisamples (see coverage.ts).
  useMemo(() => setCoverage(quality === "high" && !perfFlag("nomsaa")), [quality]);
  useEffect(() => console.info(`[explorer] quality ${quality} (tier ${deviceTier()})`), [quality]);

  const house = view === "house" && houseId ? getHouse(houseId) : undefined;
  const model = useMemo(() => (house && has3dInterior(house) ? modelFor(house) : null), [house]);
  const frame = useMemo(() => (house ? houseFrame(house.id, model) : null), [house, model]);
  const interior = !!model;
  // BOR2: the developer's interior GLB in estate space; otherwise the traced layout with finish styles.
  const bor2 = model?.source === "bor2";
  const procedural = interior && !bor2;
  const mode = useExplorer((s) => s.mode);
  const level = useExplorer((s) => s.level);
  // A BOR2 house keeps its exterior body until you look inside (dollhouse cut or walk).
  const inside = mode === "walk" || (mode === "model" && level !== null);
  const detailed = frame && model ? (bor2 ? (inside ? frame.id : null) : frame.id) : null;
  const focus = useMemo(() => {
    if (!bor2 || !model) return null;
    const [x0, z0, x1, z1] = model.bounds;
    return new THREE.Vector3((x0 + x1) / 2, model.levels[0]?.elevation ?? 0, (z0 + z1) / 2);
  }, [bor2, model]);
  // New scene content (space, house, furniture) goes through the gate again, under the dissolve. So does a new
  // post-stack quality: its passes compile in the frames the gate draws under the cover, not in the next gesture.
  const arrangement = model ? (arrangementState ?? ARRANGEMENTS[model.layout]?.[0]?.id ?? "") : "";
  const gateKey = `${house?.id ?? "estate"}|${model?.layout ?? ""}|${arrangement}|${quality}`;

  const onApplied = useCallback((f: FinishId) => useExplorer.setState({ finishReady: f }), []);
  const tint = useMemo(() => (house ? { facade: PLACEMENTS[house.id].facade, roof: PLACEMENTS[house.id].roof } : undefined), [house]);

  return (
    <Canvas
      // The panel and the DOM labels carry the content; the canvas itself is decorative for assistive tech.
      aria-hidden
      frameloop="demand"
      dpr={lite ? [1, 1.5] : [1, 1.75]}
      // three r186 dropped PCFSoftShadowMap; PCF + shadow.radius gives the soft edge.
      shadows="percentage"
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 30, near: 0.05, far: 1200, position: [122, 92, 150] }}
      onCreated={({ gl, clock }) => {
        gl.toneMapping = THREE.NoToneMapping;
        // frameloop="demand": the first frame after an idle period would get the whole idle time as
        // delta and every spring (camera-controls included) would finish in one step. Clamp it.
        const getDelta = clock.getDelta.bind(clock);
        clock.getDelta = () => Math.min(getDelta(), 1 / 20);
        // A lost context (GPU reset, too many tabs) degrades to stills instead of a black stage.
        gl.domElement.addEventListener("webglcontextlost", () => useExplorer.setState({ fallback: true }), { once: true });
      }}
    >
      {!lite && postQuality === "high" && <QualityGovernor />}

      {/* Interior textures load only where an interior is shown; the estate prefetches them when idle. */}
      <MaterialsProvider finish={finish} textures={procedural} onApplied={onApplied} tint={tint}>
        <Deferred>
          {frame ? (
            <>
              {/* The estate around the house, drawn in house space (inverse placement). */}
              <group rotation-y={-frame.rotationY}>
                <group position={[-frame.origin.x, -frame.origin.y, -frame.origin.z]}>
                  <EstateScene detailed={detailed} highlight={false} onSelect={onSelect} />
                </group>
              </group>
              {model && house && (bor2 ? <Bor2HouseWorld house={house} model={model} /> : <HouseWorld house={house} model={model} />)}
            </>
          ) : (
            <>
              <EstateScene detailed={null} highlight={entry === "model"} onSelect={onSelect} />
              {view === "estate" && mode === "walk" && bor2Enabled() && <EstateWalk />}
            </>
          )}
        </Deferred>
      </MaterialsProvider>
      {!frame && <HouseLabels visible={entry === "model"} onSelect={onSelect} />}

      <Lighting
        interior={interior}
        center={focus ?? (frame ? HOUSE_CENTER : ESTATE_FOCUS)}
        extent={frame ? 16 : 62}
        spaceRotation={frame ? -frame.rotationY : 0}
      />
      <CameraRig model={model} />
      {!perfFlag("nopost") && <Effects interior={interior} quality={quality} />}
      <SceneGate gateKey={gateKey} needsFinish={procedural} />
      <Prefetch interior={interior} />
      <StageBridge />
    </Canvas>
  );
}
