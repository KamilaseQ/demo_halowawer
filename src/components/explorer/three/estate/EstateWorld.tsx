"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef, type JSX } from "react";
import type * as THREE from "three";
import type { HouseId } from "@/lib/estate";
import { HOUSE_IDS, estateBuild, isSold } from "./build";
import { HORIZON, INTERIOR_DAY, INTERIOR_NIGHT, SOLD_MIX } from "./materials";
import { useExplorer } from "../../state/store";
import { EstateTrees } from "./trees";
import { HOUSE_INDEX, houseGroup } from "./siteMeshes";

/* ==========================================================================
   The estate maquette: seven houses (warm clay, real roof colours), their
   gardens, drive, planting, trees and clay neighbours on a ground that fades
   into the horizon. Pure geometry and materials: lights, sky, fog, IBL and
   post-processing come from the stage. All meshes and materials are built
   once per page; interaction only changes uniforms and visibility.
   ========================================================================== */

export type EstateWorldProps = {
  /** House shown elsewhere in full interior detail: hide its maquette body (keep its plot, terrace, fence). */
  detailed: HouseId | null;
  hovered: HouseId | null;
  selected: HouseId | null;
  /** Estate overview: availability glass + hover highlight on. House view: plain, calm context. */
  highlight: boolean;
  onHover: (id: HouseId | null) => void;
  onSelect: (id: HouseId) => void;
};

/** Shell intensity per state (sold houses get a faint neutral shell only). */
const GLOW = { selected: 1, hovered: 0.78, sold: 0.4 };
/** Smoothing times of the damped fades, seconds. */
const FADE = { glow: 0.16, sold: 0.35 };

export function EstateWorld({ detailed, hovered, selected, highlight, onHover, onSelect }: EstateWorldProps): JSX.Element {
  const build = useMemo(() => estateBuild(), []);
  const m = build.materials;
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const glow = useRef<Record<HouseId, number>>({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 });

  useMemo(() => {
    const sold = build.shell.material.uniforms.uSold.value as number[];
    // eslint-disable-next-line react-hooks/immutability -- shader uniforms, eased every frame; not React state
    for (const id of HOUSE_IDS) sold[HOUSE_INDEX[id]] = isSold(id) ? 1 : 0;
  }, [build]);

  // The rooms behind the glazing start in the right state (no fade-in from day on a night deep link).
  useMemo(() => {
    const time = useExplorer.getState().timeOfDay;
    // eslint-disable-next-line react-hooks/immutability -- shader uniforms, eased every frame; not React state
    INTERIOR_NIGHT.value = time === "noc" ? 1 : 0;
    // eslint-disable-next-line react-hooks/immutability -- shader uniforms, eased every frame; not React state
    INTERIOR_DAY.value = time === "rano" ? 0.4 : time === "noc" ? 0.12 : 0.44;
  }, []);

  // Props changed: the fades below need frames.
  useEffect(() => invalidate(), [invalidate, detailed, hovered, selected, highlight]);

  // Leave no pointer cursor behind when interaction switches off or the world unmounts.
  useEffect(() => {
    if (!highlight) document.body.style.cursor = "";
  }, [highlight]);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  // eslint-disable-next-line react-hooks/immutability -- shader uniforms, eased every frame; not React state
  useFrame((_, dt) => {
    let moving = false;
    const u = build.shell.material.uniforms.uGlow.value as number[];
    for (const id of HOUSE_IDS) {
      let target = 0;
      if (highlight && id !== detailed) target = id === selected ? GLOW.selected : id === hovered ? GLOW.hovered : 0;
      if (isSold(id)) target *= GLOW.sold;
      if (damp(glow.current, id, target, FADE.glow, dt)) moving = true;
      // eslint-disable-next-line react-hooks/immutability -- shader uniforms, eased every frame; not React state
      u[HOUSE_INDEX[id]] = glow.current[id];
    }
    if (damp(SOLD_MIX, "value", highlight ? 1 : 0, FADE.sold, dt)) moving = true;
    // Rooms behind the glazing follow the time of day: daylight by day, warm lamps at night.
    const time = useExplorer.getState().timeOfDay;
    if (damp(INTERIOR_NIGHT, "value", time === "noc" ? 1 : 0, 0.5, dt)) moving = true;
    if (damp(INTERIOR_DAY, "value", time === "rano" ? 0.4 : time === "noc" ? 0.12 : 0.44, 0.5, dt)) moving = true;
    // The ground melts into the stage's horizon (its fog colour) when it has one.
    const fog = scene.fog as THREE.Fog | THREE.FogExp2 | null;
    if (fog && !HORIZON.value.equals(fog.color)) HORIZON.value.copy(fog.color);
    if (moving) invalidate();
  });

  const handlers = (id: HouseId) =>
    highlight && id !== detailed
      ? {
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(id);
            document.body.style.cursor = "pointer";
          },
          onPointerOut: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(null);
            document.body.style.cursor = "";
          },
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onSelect(id);
          },
        }
      : {};

  return (
    <group name="estate">
      <mesh name="ground" geometry={build.ground.geometry} material={build.ground.material} receiveShadow />
      <mesh name="paving" geometry={build.paving} material={m.paving} receiveShadow />
      <mesh name="grass-pavers" geometry={build.grassPavers} material={m.grassPavers} receiveShadow />
      <mesh name="site" geometry={build.site} material={m.site} castShadow receiveShadow />
      <mesh name="neighbours" geometry={build.neighbours} material={m.clay} castShadow receiveShadow />
      <mesh name="veg-bark" geometry={build.bark} material={m.bark} castShadow receiveShadow />
      <mesh name="veg-foliage" geometry={build.foliage} material={m.foliage} castShadow receiveShadow />
      <primitive object={build.tufts} name="veg-grasses" receiveShadow />
      <EstateTrees />
      <primitive object={build.meadow} name="meadow" />
      {/* Background woodland (far, no shadows): the estate sits in the Wawer pine belt, not on a plain. */}
      <mesh name="forest" geometry={build.forest.geometry} material={build.forest.material} />

      {HOUSE_IDS.map((id) => {
        const g = houseGroup(id);
        const geo = build.houses[id];
        return (
          <group key={id} name={`dom-${id}`} position={g.position} rotation-y={g.rotationY} visible={id !== detailed}>
            <group scale-z={g.mirror}>
              <mesh name="house-body" geometry={geo.opaque} material={m.house} castShadow receiveShadow />
              <mesh name="house-glass" geometry={geo.glass} material={m.glass} receiveShadow />
            </group>
          </group>
        );
      })}

      {/* Invisible pick volumes (envelope of each house): cheap raycasts, stable hover across details. */}
      {HOUSE_IDS.filter((id) => id !== detailed).map((id) => (
        <mesh key={`pick-${id}`} name="pick" geometry={build.houses[id].proxy} material={build.proxyMaterial} {...handlers(id)} />
      ))}

      {/* Transparent last: fence mesh, then the highlight glass. */}
      <mesh name="fences" geometry={build.fences} material={m.fence} receiveShadow renderOrder={1} />
      <mesh name="highlight" geometry={build.shell.geometry} material={build.shell.material} renderOrder={2} frustumCulled={false} />
    </group>
  );
}
