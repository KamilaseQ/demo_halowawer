"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getHouse, has3dInterior, type HouseId } from "@/lib/estate";
import { levelModel, modelFor, nodeLabel } from "@/lib/estate/geometry";
import type { HouseModel, LevelId } from "@/lib/estate/geometry/types";
import { readPose } from "../three/camera/controls";
import { useExplorer } from "../state/store";
import ui from "../ui/ui.module.css";
import { IconArrowLeft, IconPhoto } from "./icons";
import { renderFor } from "./renders";
import styles from "./controls.module.css";

const MAP_W = 232;

/**
 * Live minimap of the storey you stand on: plan image cropped to the house, node dots, and a view cone
 * that follows the camera. Mirrored houses (A, C) show the plan mirrored, like the house itself.
 */
function MiniMap({ model, level, mirrored, houseId }: { model: HouseModel; level: LevelId; mirrored: boolean; houseId: HouseId }) {
  const marker = useRef<HTMLDivElement>(null);
  const node = useExplorer((s) => s.node);
  const plan = levelModel(model, level)!.plan;
  // Crop to the house and its terrace (the walk bounds also cover the lawn for the garden viewpoint).
  const bounds = useMemo(() => {
    const pts = [...model.footprint, ...model.terraces.flat()];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  }, [model]);
  const pad = 0.6;
  const [bx0, by0, bx1, by1] = [bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad];
  const scale = MAP_W / ((bx1 - bx0) * plan.pxPerMeter);
  const mapH = (by1 - by0) * plan.pxPerMeter * scale;
  const toMap = (x: number, y: number) => [(x - bx0) * plan.pxPerMeter * scale, (y - by0) * plan.pxPerMeter * scale] as const;
  const [ix, iy] = toMap(plan.origin[0], plan.origin[1]);

  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const pose = readPose();
      const el = marker.current;
      if (pose && el) {
        const [mx, my] = toMap(pose.x, mirrored ? -pose.z : pose.z);
        // camera-controls azimuth θ: camera sits at target + (sin θ, cos θ); it looks the opposite way.
        const dz = -Math.cos(pose.azimuth);
        const heading = Math.atan2(mirrored ? -dz : dz, -Math.sin(pose.azimuth));
        const transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) rotate(${heading.toFixed(3)}rad)`;
        // Write only on change: an idle walk then leaves the DOM (and style recalc) alone.
        if (transform !== last) {
          last = transform;
          el.style.transform = transform;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <div className={`${styles.minimap} ${ui.glass}`} style={{ width: MAP_W + 16 }}>
      <div className={styles.minimapInner} style={{ width: MAP_W, height: mapH, transform: mirrored ? "scaleY(-1)" : undefined }}>
        <Image
          src={plan.src}
          alt=""
          loading="eager"
          width={plan.width}
          height={plan.height}
          className={styles.minimapImage}
          style={{ width: plan.width * scale, height: plan.height * scale, transform: `translate(${ix}px, ${iy}px)` }}
        />
        {model.walk.nodes.filter((n) => n.level === level).map((n) => {
          const [x, y] = toMap(n.position[0], n.position[1]);
          return (
            <button
              key={n.id}
              type="button"
              className={styles.minimapDot}
              aria-label={nodeLabel(model, houseId, n)}
              aria-current={node === n.id || undefined}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              onClick={() => useExplorer.getState().goToNode(n.id)}
            />
          );
        })}
        <div ref={marker} className={styles.minimapMarker} aria-hidden>
          <span />
        </div>
      </div>
      {/* Storey switch under the map: jumps to the first point of that storey. */}
      <div className={`${ui.segmented} ${styles.levelSwitch}`} role="group" aria-label="Kondygnacja">
        {model.levels.map((l) => {
          const first = model.walk.nodes.find((n) => n.level === l.level);
          if (!first) return null;
          return (
            <button key={l.level} type="button" className={ui.segment} aria-pressed={l.level === level} onClick={() => useExplorer.getState().goToNode(first.id)}>
              {l.level === 0 ? "Parter" : "Piętro"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Room-to-room jumps on the storey you stand on (the storey switch sits under the minimap). */
function NodeBar({ model, house }: { model: HouseModel; house: HouseId }) {
  const node = useExplorer((s) => s.node);
  const current = model.walk.nodes.find((n) => n.id === node);
  const onLevel = current?.level ?? 0;
  return (
    <nav className={`${styles.nodeBar} ${ui.glass}`} aria-label="Pomieszczenia">
      {model.levels.filter((l) => l.level === onLevel).map((l) => (
        <div key={l.level} className={styles.nodeGroup}>
          <span className={ui.kicker}>{l.level === 0 ? "Parter" : "Piętro"}</span>
          {model.walk.nodes
            .filter((n) => n.level === l.level)
            .map((n) => (
              <button
                key={n.id}
                type="button"
                className={ui.segment}
                aria-pressed={current?.id === n.id}
                onClick={() => useExplorer.getState().goToNode(n.id)}
              >
                {nodeLabel(model, house, n)}
              </button>
            ))}
        </div>
      ))}
    </nav>
  );
}

export function WalkHud() {
  const view = useExplorer((s) => s.view);
  const mode = useExplorer((s) => s.mode);
  const houseId = useExplorer((s) => s.house);
  const node = useExplorer((s) => s.node);
  const finish = useExplorer((s) => s.finish);
  const photo = useExplorer((s) => s.photo);
  const ready = useExplorer((s) => s.ready);
  const [hint, setHint] = useState(false);
  // Touch screens tap, pointers click (this HUD is client-only, so matchMedia is safe here).
  const coarse = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);

  const house = view === "house" ? getHouse(houseId) : undefined;
  const model = useMemo(() => (house && has3dInterior(house) ? modelFor(house) : null), [house]);
  const level = (model?.walk.nodes.find((n) => n.id === node)?.level ?? 0) as LevelId;
  const walking = !!model && mode === "walk";
  const still = walking ? renderFor(node, finish) : null;

  // The hint explains the live scene, so it waits for it (the loading poster carries its own note).
  useEffect(() => {
    if (!walking || !ready) return;
    const show = setTimeout(() => setHint(true), 0);
    const hide = setTimeout(() => setHint(false), 5200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [walking, ready]);

  if (!model || !house || mode !== "walk") return null;

  return (
    <>
      <div className={styles.walkTop}>
        {/* The header keeps "Umów prezentację" visible, so the walk only needs a way out. */}
        <button type="button" className={`${styles.pill} ${ui.glass}`} onClick={() => useExplorer.getState().setMode("model")}>
          <IconArrowLeft size={16} />
          Model 3D
        </button>
      </div>

      {walking && (
        <>
          <MiniMap model={model} level={level} mirrored={house.mirrored} houseId={house.id} />
          <NodeBar model={model} house={house.id} />
          <p className={`${styles.hint} ${ui.glassLight}`} data-hidden={!hint || undefined} onPointerDown={() => setHint(false)}>
            Przeciągnij, aby się rozejrzeć · {coarse ? "Dotknij podłogi" : "Kliknij podłogę"}, aby przejść
          </p>
          {still && (
            <button
              type="button"
              className={`${styles.photoToggle} ${ui.glass}`}
              aria-pressed={photo}
              onClick={() => useExplorer.setState({ photo: !photo })}
            >
              <IconPhoto size={18} />
              {photo ? "Widok 3D" : "Wizualizacja"}
            </button>
          )}
          {still && (
            <div className={styles.photo} data-visible={photo || undefined} aria-hidden={!photo}>
              {/* The renders were made for the B-handed layout: mirrored houses (A, C) see them mirrored too. */}
              <Image
                src={still.src}
                alt={`${still.label}, przykładowa aranżacja`}
                fill
                sizes="100vw"
                className={styles.photoImage}
                style={house.mirrored ? { transform: "scaleX(-1)" } : undefined}
              />
              <span className={styles.photoCaption}>Wizualizacja · przykładowa aranżacja</span>
            </div>
          )}
        </>
      )}
    </>
  );
}
