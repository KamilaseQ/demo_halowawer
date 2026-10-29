"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ARRANGEMENTS, getHouse, has3dInterior, houses, houseTag, type FinishId, type HouseId } from "@/lib/estate";
import { modelFor } from "@/lib/estate/geometry";
import { ESTATE_CENTER, PLACEMENTS } from "@/lib/estate/geometry/site";
import { CameraRig } from "./camera/CameraRig";
import { cameraControls } from "./camera/controls";
import { Effects } from "./Effects";
import { EstateWorld } from "./estate/EstateWorld";
import { labelAnchor } from "./estate/labels";
import { HouseWorld } from "./house/HouseWorld";
import { SceneLabels, type SceneLabel } from "./labels/SceneLabels";
import { Lighting } from "./lighting/Lighting";
import { Deferred } from "./loading";
import { MaterialsProvider } from "./materials/MaterialsProvider";
import { Prefetch } from "./prefetch";
import { SceneGate } from "./SceneGate";
import { houseFrame } from "./space";
import { registerStageCommands, useExplorer, withDissolve } from "../state/store";
import { deviceTier } from "../tier";

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
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as unknown as { __probe: unknown }).__probe = { gl, scene, state: useExplorer };
  }, [gl, scene]);

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
    [hovered, onSelect],
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

  const house = view === "house" && houseId ? getHouse(houseId) : undefined;
  const model = useMemo(() => (house && has3dInterior(house) ? modelFor(house) : null), [house]);
  const frame = useMemo(() => (house ? houseFrame(house.id, model) : null), [house, model]);
  const interior = !!model;
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
      <MaterialsProvider finish={finish} textures={interior} onApplied={onApplied} tint={tint}>
        <Deferred>
          {frame ? (
            <>
              {/* The estate around the house, drawn in house space (inverse placement). */}
              <group rotation-y={-frame.rotationY}>
                <group position={[-frame.origin.x, -frame.origin.y, -frame.origin.z]}>
                  <EstateScene detailed={model ? frame.id : null} highlight={false} onSelect={onSelect} />
                </group>
              </group>
              {model && house && <HouseWorld house={house} model={model} />}
            </>
          ) : (
            <EstateScene detailed={null} highlight={entry === "model"} onSelect={onSelect} />
          )}
        </Deferred>
      </MaterialsProvider>
      {!frame && <HouseLabels visible={entry === "model"} onSelect={onSelect} />}

      <Lighting
        interior={interior}
        center={frame ? HOUSE_CENTER : ESTATE_FOCUS}
        extent={frame ? 16 : 62}
        spaceRotation={frame ? -frame.rotationY : 0}
      />
      <CameraRig model={model} />
      <Effects interior={interior} quality={quality} />
      <SceneGate gateKey={gateKey} needsFinish={interior} />
      <Prefetch interior={interior} />
      <StageBridge />
    </Canvas>
  );
}
