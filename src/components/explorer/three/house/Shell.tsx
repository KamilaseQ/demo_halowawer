"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { damp } from "maath/easing";
import type { HouseModel, LevelModel } from "@/lib/estate/geometry/types";
import { useMaterials, type MaterialKey } from "../materials/MaterialsProvider";
import type { FloorPointer } from "../walk/Walk";
import { buildDeck, buildLevel, ceilingGeometry, floorGeometry, slabGeometry, type Buckets, type WallBuild } from "./build";

/* ==========================================================================
   House shell: one group per level. In the dollhouse the chosen level is cut
   (camera-facing exterior walls drop to parapet height, ceilings slide away),
   the levels above it and the roof lift off; below it everything stays.
   ========================================================================== */

const CUTAWAY = 1.0;
const OUTDOOR_TOP = -0.025;

/** How a level is shown: whole (walk / exterior), cut open (dollhouse level), or lifted away. */
export type LevelState = "whole" | "cut" | "lifted";

function useBuilt(b: Buckets | null, offsetY = 0) {
  return useMemo(() => {
    if (!b) return [];
    const parts = b.build();
    if (offsetY) for (const [, g] of parts) g.translate(0, -offsetY, 0);
    return parts;
  }, [b, offsetY]);
}

export function Parts({ parts, shadows = true }: { parts: [MaterialKey, THREE.BufferGeometry][]; shadows?: boolean }) {
  const mats = useMaterials();
  useEffect(() => () => parts.forEach(([, g]) => g.dispose()), [parts]);
  return (
    <>
      {parts.map(([key, g]) => (
        <mesh
          key={key}
          geometry={g}
          material={mats[key]}
          castShadow={shadows && key !== "glass"}
          receiveShadow={key !== "glass"}
          renderOrder={key === "glass" ? 2 : 0}
        />
      ))}
      {/* The sky in the windows: a fresnel reflection pass added over the see-through glass. */}
      {parts.map(([key, g]) => (key === "glass" ? <mesh key="reflect" geometry={g} material={mats.glassReflect} renderOrder={3} /> : null))}
    </>
  );
}

/** Slides a group up and hides it once it is out of the way (levels above the dollhouse cut, the roof). */
export function Lift({ lifted, height, children }: { lifted: boolean; height: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (damp(g.position, "y", lifted ? height : 0, 0.28, dt)) invalidate();
    g.visible = g.position.y < height * 0.92;
  });
  return <group ref={group}>{children}</group>;
}

function ExteriorWall({ build, cut }: { build: WallBuild; cut: boolean }) {
  const lower = useBuilt(build.lower);
  const upper = useBuilt(build.upper, build.split);
  const group = useRef<THREE.Group>(null);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);

  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    let target = 1;
    if (cut) {
      // World-space test (the house may be mirrored or placed in the estate).
      const parent = g.parent;
      world.copy(build.center);
      outward.copy(build.outward);
      if (parent) {
        parent.localToWorld(world);
        outward.transformDirection(parent.matrixWorld);
      }
      toCam.subVectors(camera.position, world).setY(0).normalize();
      target = toCam.dot(outward.setY(0).normalize()) > 0.12 ? 0 : 1;
    }
    // Keeps drawing until the wall has landed, also when the camera stops first.
    if (damp(g.scale, "y", target, 0.18, dt)) invalidate();
    g.visible = g.scale.y > 0.01;
  });

  return (
    <>
      <Parts parts={lower} />
      {upper.length > 0 && (
        <group ref={group} position-y={build.split}>
          <Parts parts={upper} />
        </group>
      )}
    </>
  );
}

function InteriorWall({ build }: { build: WallBuild }) {
  const parts = useBuilt(build.lower);
  return <Parts parts={parts} />;
}

function Level({ level, state, onFloorPointer }: { level: LevelModel; state: LevelState; onFloorPointer?: FloorPointer }) {
  const mats = useMaterials();
  const shell = useMemo(() => buildLevel(level, CUTAWAY), [level]);
  const fixtures = useBuilt(shell.fixtures);

  const geo = useMemo(
    () =>
      level.zones.map((z) => {
        const outdoor = z.kind === "terrace";
        return {
          zone: z,
          floor: floorGeometry(z.polygon, (outdoor ? OUTDOOR_TOP : 0) + 0.004),
          ceiling: z.ceiling ? ceilingGeometry(z.polygon, level.ceilingHeight) : null,
        };
      }),
    [level],
  );
  useEffect(
    () => () =>
      geo.forEach(({ floor, ceiling }) => {
        floor.dispose();
        ceiling?.dispose();
      }),
    [geo],
  );

  const ceilingGroup = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const showCeiling = state === "whole";
  useFrame((_, dt) => {
    const g = ceilingGroup.current;
    if (!g) return;
    // Ceilings slide up and away in the dollhouse rather than popping.
    if (damp(g.position, "y", showCeiling ? 0 : 2.5, 0.2, dt)) invalidate();
    g.visible = g.position.y < 2.4;
  });

  return (
    <group position-y={level.elevation}>
      {geo.map(({ zone, floor }) => (
        <mesh
          key={zone.id}
          geometry={floor}
          material={mats[zone.floor]}
          receiveShadow
          userData={{ zone: zone.id, level: level.level, walkable: zone.kind !== "stairs" }}
          onPointerMove={onFloorPointer?.move}
          onPointerOut={onFloorPointer?.leave}
          onClick={onFloorPointer?.click}
        />
      ))}
      <group ref={ceilingGroup}>
        {geo.map(({ zone, ceiling }) =>
          // Ceilings cast shadows so daylight only enters through the openings in walk mode.
          ceiling ? <mesh key={zone.id} geometry={ceiling} material={mats.ceiling} receiveShadow castShadow /> : null,
        )}
      </group>
      {shell.walls.map((w) =>
        w.upper ? (
          <ExteriorWall key={w.wall.id} build={w} cut={state === "cut"} />
        ) : (
          <InteriorWall key={w.wall.id} build={w} />
        ),
      )}
      <Parts parts={fixtures} />
    </group>
  );
}

/** Structural slabs: ground plinth and the floor between storeys (edge band in facade plaster). */
function useSlabs(model: HouseModel) {
  const mats = useMaterials();
  const geo = useMemo(() => {
    const plinth = slabGeometry(model.footprint, 0, 0.6);
    const floors = model.levels.filter((l) => l.elevation > 0).map((l) => ({ level: l.level, g: slabGeometry(model.footprint, l.elevation, model.slabThickness) }));
    return { plinth, floors };
  }, [model]);
  useEffect(
    () => () => {
      geo.plinth.dispose();
      geo.floors.forEach((f) => f.g.dispose());
    },
    [geo],
  );
  return { geo, mats };
}

type Props = {
  model: HouseModel;
  /** Per-level presentation. */
  states: Partial<Record<number, LevelState>>;
  /** Roof and attic band lifted off (dollhouse). */
  roofLifted: boolean;
  onFloorPointer?: FloorPointer;
  /** The roof (built by the estate's roof generator) and anything else riding on top of the walls. */
  roof?: ReactNode;
  /** Per-level extras (furniture), keyed by level, lifted together with their level. */
  furnishing?: Partial<Record<number, ReactNode>>;
};

export function HouseShell({ model, states, roofLifted, onFloorPointer, roof, furnishing }: Props) {
  const { geo, mats } = useSlabs(model);
  const deck = useMemo(() => {
    const b = model.terraces.map((t) => buildDeck(bbox(t), OUTDOOR_TOP + 0.006));
    const all = b[0];
    for (const other of b.slice(1)) all.merge(other);
    return all ?? null;
  }, [model]);
  const deckParts = useBuilt(deck);
  const top = model.levels[model.levels.length - 1];
  const liftHeight = 9;

  return (
    <group>
      {/* Plinth: the dark base line under the plaster, as on the renders. */}
      <mesh geometry={geo.plinth} material={[mats.wallCut, mats.slabEdge]} receiveShadow />
      <Parts parts={deckParts} />
      {model.levels.map((l) => {
        const state = states[l.level] ?? "whole";
        const slab = geo.floors.find((f) => f.level === l.level);
        return (
          <Lift key={l.level} lifted={state === "lifted"} height={liftHeight}>
            {slab && <mesh geometry={slab.g} material={[mats.wallCut, mats.facade]} receiveShadow castShadow />}
            <Level level={l} state={state} onFloorPointer={onFloorPointer} />
            <group position-y={l.elevation}>{furnishing?.[l.level]}</group>
          </Lift>
        );
      })}
      <Lift lifted={roofLifted} height={liftHeight + 2}>
        <AtticBand model={model} from={top.elevation + top.ceilingHeight} />
        {roof}
      </Lift>
    </group>
  );
}

/** Facade band between the top ceiling and the eaves, attic floor slab and the two gable triangles. */
function AtticBand({ model, from }: { model: HouseModel; from: number }) {
  const mats = useMaterials();
  const geo = useMemo(() => {
    const [x0, y0, x1, y1] = bbox(model.footprint);
    const eaves = model.roof.eaves;
    const ridge = model.roof.ridge - model.roof.thickness;
    const band = new THREE.BoxGeometry(x1 - x0, eaves - from, y1 - y0);
    band.translate((x0 + x1) / 2, (from + eaves) / 2, (y0 + y1) / 2);
    // Gables: triangles in the planes y = y0 and y = y1 (ridge along plan y), extruded to wall thickness.
    const gables: THREE.BufferGeometry[] = [];
    const along = model.roof.ridgeAxis === "y";
    const span = along ? [x0, x1] : [y0, y1];
    const shape = new THREE.Shape([new THREE.Vector2(span[0], eaves), new THREE.Vector2(span[1], eaves), new THREE.Vector2((span[0] + span[1]) / 2, ridge)]);
    for (const at of along ? [y0, y1 - 0.38] : [x0, x1 - 0.38]) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: false });
      if (!along) g.rotateY(-Math.PI / 2);
      g.translate(0, 0, along ? at : 0);
      if (!along) g.translate(at, 0, 0);
      gables.push(g);
    }
    return { band, gables };
  }, [model, from]);
  useEffect(
    () => () => {
      geo.band.dispose();
      geo.gables.forEach((g) => g.dispose());
    },
    [geo],
  );
  return (
    <group>
      <mesh geometry={geo.band} material={mats.facade} castShadow receiveShadow />
      {geo.gables.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.facade} castShadow receiveShadow />
      ))}
    </group>
  );
}

export function bbox(poly: [number, number][]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}
