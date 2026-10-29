"use client";

import * as THREE from "three";
import { boxUV, cylinder, disc, lathe, ovalLathe, rod, smoothNormals, softBox, tube } from "../core/geometry";
import { Kit } from "../core/kit";
import { downlight } from "../core/pieces";
import { KitMesh, WallCut, useKit } from "../core/runtime";
import { A, L, W, WEAVE, candle, grassTuft, leafyPlant, planterBox, pot, rug, smallGlobe, vase, wardrobe } from "./parts";
import { CEILING } from "./living";

/* ==========================================================================
   The rest of the ground floor: corridor, wiatrołap (entrance hall), WC,
   technical room, garage (a quiet car silhouette) and the garden terrace.
   ========================================================================== */

/* ---------- corridor (x 4.23–6.41, y 4.08–5.76) ---------- */

function corridor(k: Kit) {
  // Slim oak console on the garage wall with a round mirror above it.
  k.box(W, 4.4, 5.25, 0.78, 0.82, 4.085, 4.36, { r: 0.004, edge: 2, worldUV: true });
  k.box(W, 4.42, 4.46, 0.004, 0.78, 4.1, 4.34, { r: 0.003 });
  k.box(W, 5.19, 5.23, 0.004, 0.78, 4.1, 4.34, { r: 0.003 });
  const ring = new THREE.TorusGeometry(0.33, 0.008, 10, 80);
  k.add("metal", ring.translate(4.83, 1.52, 4.1));
  k.add("mirror", new THREE.CircleGeometry(0.325, 64).translate(4.83, 1.52, 4.096));
  rug(k, 4.45, 6.2, 4.55, 5.35, "rug");
}

/* ---------- wiatrołap (x 6.58–8.29, y 4.08–6.36) ---------- */

function entrance(k: Kit) {
  // Full-height wardrobe on the garage wall, then an open coat niche with a bench and hooks.
  wardrobe(k, 6.6, 7.66, 4.085, 4.66, 2, "z1", 2.4, L);
  k.box(W, 7.7, 8.28, 0.004, 0.42, 4.09, 4.48, { r: 0.006, edge: 2, worldUV: true });
  k.add(A, softBox(0.56, 0.06, 0.36, { r: 0.025, bulge: { top: 0.01 }, step: 0.1, edge: 2, uvScale: WEAVE }), [7.99, 0.45, 4.29]);
  k.box(W, 7.7, 8.28, 1.62, 1.66, 4.085, 4.36, { r: 0.004, worldUV: true });
  for (const x of [7.82, 7.99, 8.16]) k.add("metal", rod([x, 1.5, 4.09], [x, 1.53, 4.17], 0.008, 0.008, 8));
  // A coat and a tote on the hooks.
  k.add(A, softBox(0.42, 0.85, 0.12, { r: 0.05, bulge: { front: 0.03 }, wobble: 0.006, wrinkle: 0.004, step: 0.06, edge: 2, seed: 91, uvScale: WEAVE }), [7.86, 1.08, 4.18], [0.04, 0, 0.03]);
  k.add("wicker", softBox(0.32, 0.36, 0.12, { r: 0.03, bulge: { front: 0.02 }, step: 0.08, edge: 2 }), [8.15, 1.27, 4.17]);
  // Pair of shoes under the bench.
  for (const [x, z] of [
    [7.83, 4.22],
    [7.93, 4.21],
  ])
    k.add("black", softBox(0.09, 0.08, 0.27, { r: 0.035, step: 0.06, edge: 2 }), [x, 0.045, z]);
  // Tall mirror on the WC wall, right of the WC door.
  k.box("black", 7.74, 8.22, 0.35, 2.05, 6.335, 6.36, { r: 0.004 });
  k.add("mirror", new THREE.PlaneGeometry(0.45, 1.67).rotateY(Math.PI), [7.98, 1.2, 6.333]);
  // Doormat inside the front door.
  k.add("wicker", softBox(0.85, 0.012, 0.6, { r: 0.004, edge: 1, step: 4 }), [7.82, 0.006, 5.49]);
  // Plant in the corner by the WC door.
  const soil = pot(k, 6.86, 6.1, 0.17, 0.32, "potWhite");
  leafyPlant(k, [6.86, soil, 6.1], { height: 0.62, spread: 0.24, leaves: 10, leafLen: 0.26, seed: 12 });
}

/* ---------- WC (x 6.58–8.29, y 6.48–7.86) ---------- */

function wcGeo() {
  const body = ovalLathe([[0.18, 0], [0.06, 0], [0.02, 0.05], [0.003, 0.22], [0, 0.3], [0.006, 0.312], [0.03, 0.315], [0.18, 0.315]], 0.18, 0.27, 2.2, 48);
  const lid = ovalLathe([[0.18, 0], [0.01, 0], [0, 0.012], [0.006, 0.024], [0.18, 0.026]], 0.182, 0.268, 2.2, 48).translate(0, 0.318, 0.004);
  return [body, lid];
}

function wc(k: Kit) {
  // Wall-hung bowl on the party wall (facing −y), on a tiled installation box.
  k.box("wallTile", 6.6, 8.28, 0.004, 1.0, 7.66, 7.86, { worldUV: true, r: 0.002, sharp: { top: false } });
  const [body, lid] = wcGeo();
  // ovalLathe's long axis is z; the bowl sticks out of the box toward −y.
  k.add("ceramic", body, [7.25, 0.08, 7.42], [0, Math.PI, 0]);
  k.add("ceramic", lid, [7.25, 0.08, 7.42], [0, Math.PI, 0]);
  // Small basin on an oak shelf on the entrance-side wall (x 8.29), facing −x.
  k.box(W, 8.0, 8.29, 0.78, 0.82, 6.6, 7.2, { r: 0.004, worldUV: true });
  k.add("ceramic", ovalLathe([[0.12, 0], [0.05, 0], [0.02, 0.02], [0.003, 0.08], [0, 0.11], [0.006, 0.12], [0.014, 0.116], [0.025, 0.08], [0.05, 0.035], [0.12, 0.03]], 0.17, 0.12, 2.4, 40), [8.13, 0.82, 6.9], [0, Math.PI / 2, 0]);
  k.add("metal", rod([8.29, 1.05, 6.9], [8.18, 1.05, 6.9], 0.009, 0.009, 10));
  // Towel ring.
  k.add("metal", new THREE.TorusGeometry(0.09, 0.006, 8, 40).rotateY(Math.PI / 2).translate(8.27, 1.0, 7.38));
  k.add("towel", softBox(0.04, 0.3, 0.16, { r: 0.015, step: 0.06, edge: 2 }), [8.25, 0.86, 7.38]);
  // Flush plate on the installation box.
  k.box("metal", 7.15, 7.35, 0.8, 0.95, 7.645, 7.66, { r: 0.004 });
}

function wcMirror(k: Kit) {
  k.add("mirror", new THREE.CircleGeometry(0.22, 48).rotateY(-Math.PI / 2), [8.285, 1.42, 6.9]);
  k.add("metal", new THREE.TorusGeometry(0.222, 0.006, 8, 64).rotateY(Math.PI / 2).translate(8.284, 1.42, 6.9));
}

/* ---------- technical room (x 5.41–6.41, y 5.88–7.86) ---------- */

function technical(k: Kit) {
  // Domestic hot water tank and the heat-pump hydrobox.
  k.add("ceramicMatte", lathe([[0, 0.004], [0.29, 0.004], [0.3, 0.03], [0.3, 1.62], [0.27, 1.68], [0, 1.7]], { segments: 40 }), [5.78, 0, 7.45]);
  k.box("ceramicMatte", 5.95, 6.4, 0.9, 1.75, 6.02, 6.4, { r: 0.012, edge: 2 });
  k.add("steel", rod([6.1, 0.9, 6.2], [6.1, 0.3, 6.2], 0.012, 0.012, 8));
  k.add("steel", rod([6.25, 0.9, 6.2], [6.25, 0.3, 6.2], 0.012, 0.012, 8));
}

/* ---------- garage (x 4.23–9.48, y 0.39–3.9) ---------- */

/** Stylised car silhouette: soft graphite body, dark glass greenhouse, wheels. Nose toward the garden. */
function car(k: Kit) {
  const cx = 6.98, cz = 2.12;
  const len = 4.45, wid = 1.84;
  // Lower body with a gentle wedge (bulged sides and bonnet).
  const body = softBox(len, 0.62, wid, { r: 0.2, edge: 4, step: 0.12, bulge: { top: 0.05, x: 0.06, z: 0.035 }, power: 2.4 });
  const pos = body.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    // Lower the nose and the tail a little: a quiet, aerodynamic profile.
    const x = pos.getX(i) / (len / 2);
    const y = pos.getY(i);
    if (y > 0) pos.setY(i, y - 0.09 * x * x * (y / 0.31) + (x < 0 ? 0.0 : -0.02 * x));
  }
  smoothNormals(body);
  k.add("carPaint", body, [cx, 0.54, cz]);
  // Greenhouse: dark glass band with a painted roof.
  k.add("screen", softBox(2.35, 0.42, 1.5, { r: 0.18, edge: 4, step: 0.15, bulge: { top: 0.03, x: 0.12 }, power: 2 }), [cx + 0.25, 0.98, cz]);
  k.add("carPaint", softBox(1.85, 0.06, 1.38, { r: 0.03, edge: 3, step: 0.2, bulge: { top: 0.02 } }), [cx + 0.3, 1.19, cz]);
  // Wheels.
  for (const wx of [cx - 1.42, cx + 1.42])
    for (const s of [-1, 1]) {
      const z = cz + s * (wid / 2 - 0.1);
      k.add("black", cylinder(0.34, 0.23, 36).rotateX(Math.PI / 2).translate(wx, 0.34, z - 0.115));
      k.add("steel", disc(0.22, 32).rotateX((s * Math.PI) / 2).translate(wx, 0.34, z + s * 0.117));
    }
}

function garage(k: Kit) {
  car(k);
  // Low storage run under the garage window (gable wall), below the dollhouse cut.
  k.box(L, 5.7, 8.7, 0.1, 0.92, 0.39, 0.85, { r: 0.003 });
  k.box("black", 5.75, 8.65, 0.004, 0.1, 0.42, 0.8);
  for (let i = 0; i < 5; i++) k.box("gap", 5.7 + i * 0.6 - 0.001, 5.7 + i * 0.6 + 0.001, 0.12, 0.9, 0.849, 0.852, { r: 0 });
  // Garage batten light under the ceiling.
  k.box("ceramicMatte", 6.2, 7.6, CEILING - 0.05, CEILING, 2.1, 2.18, { r: 0.01 });
  k.box("glowLamp", 6.22, 7.58, CEILING - 0.052, CEILING - 0.05, 2.11, 2.17, { r: 0 });
}

/* ---------- terrace (x −2.0–0, y 1.05–4.52; deck top at −0.025) ---------- */

const DECK = -0.025;

/** Teak garden armchair with cushions. Local: faces +z. */
function teakChair(): Kit {
  const k = new Kit();
  const T = "teak" as const;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.box(T, sx * 0.29 - 0.022, sx * 0.29 + 0.022, 0, sz > 0 ? 0.6 : 0.6, sz * 0.27 - 0.022, sz * 0.27 + 0.022, { r: 0.006 });
  // Arms, seat frame and slats.
  for (const sx of [-1, 1]) k.box(T, sx * 0.29 - 0.03, sx * 0.29 + 0.03, 0.6, 0.625, -0.33, 0.31, { r: 0.008 });
  for (let i = 0; i < 6; i++) k.box(T, -0.27, 0.27, 0.38, 0.4, -0.25 + i * 0.1, -0.21 + i * 0.1, { r: 0.004 });
  k.box(T, -0.27, 0.27, 0.34, 0.38, 0.24, 0.27, { r: 0.004 });
  // Reclined slatted back.
  const back = new Kit();
  for (let i = 0; i < 5; i++) back.box(T, -0.27, 0.27, 0.05 + i * 0.1, 0.09 + i * 0.1, -0.012, 0.012, { r: 0.004 });
  for (const sx of [-1, 1]) back.box(T, sx * 0.27 - 0.02, sx * 0.27 + 0.02, 0, 0.56, -0.016, 0.016, { r: 0.005 });
  k.include(back, [0, 0.38, -0.28], [-0.22, 0, 0]);
  // Cushions in outdoor canvas.
  k.add("towel", softBox(0.52, 0.08, 0.5, { r: 0.035, bulge: { top: 0.012 }, power: 3, step: 0.1, edge: 2 }), [0, 0.445, 0.0]);
  k.add("towel", softBox(0.5, 0.42, 0.07, { r: 0.03, bulge: { front: 0.015 }, power: 3, step: 0.1, edge: 2 }), [0, 0.68, -0.22], [-0.22, 0, 0]);
  return k;
}

function terrace(k: Kit) {
  // Outdoor rug, a round teak table for two and two armchairs at the far end of the deck.
  const tx = -1.0, tz = 3.65;
  k.add("rug", softBox(1.6, 0.01, 2.0, { r: 0.004, edge: 1, step: 4 }), [tx, DECK + 0.006, tz]);
  k.add("teak", boxUV(lathe([[0, 0.7], [0.39, 0.7], [0.4, 0.71], [0.4, 0.73], [0.39, 0.74], [0, 0.74]], { segments: 48 })), [tx, DECK, tz]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    k.box("teak", tx + Math.cos(a) * 0.24 - 0.022, tx + Math.cos(a) * 0.24 + 0.022, DECK, DECK + 0.7, tz + Math.sin(a) * 0.24 - 0.022, tz + Math.sin(a) * 0.24 + 0.022, { r: 0.006 });
  }
  const chair = teakChair();
  k.include(chair, [tx, DECK, tz - 0.66], [0, 0, 0]);
  k.include(chair, [tx, DECK, tz + 0.66], [0, Math.PI, 0]);
  // Lantern and a carafe on the table.
  vase(k, [tx + 0.1, DECK + 0.74, tz - 0.08], "bottle", 0.6, "glassTint");
  candle(k, [tx - 0.12, DECK + 0.74, tz + 0.1], 0.04, 0.1);
  // Planter with ornamental grass in the corner by the gable, a second by the facade.
  const s1 = planterBox(k, -1.72, 1.3, 0.24, 0.5, DECK);
  grassTuft(k, [-1.72, s1, 1.3], 0.75, 120, 3);
  const s2 = planterBox(k, -0.3, 4.32, 0.18, 0.42, DECK);
  grassTuft(k, [-0.3, s2, 4.32], 0.6, 90, 8);
}

/** Wall lights either side of the HS door on the garden facade (on the exterior wall, above the cut). */
function facadeLights(k: Kit) {
  for (const z of [0.72, 4.86]) {
    k.box("metal", -0.06, 0.0, 1.95, 2.25, z - 0.05, z + 0.05, { r: 0.01, edge: 2 });
    k.box("glowLamp", -0.062, -0.058, 1.98, 2.22, z - 0.03, z + 0.03, { r: 0 });
  }
}

/* ---------- components ---------- */

export function entryKit(k: Kit) {
  corridor(k);
  entrance(k);
  wc(k);
  technical(k);
  garage(k);
  terrace(k);
}

export function entryCeiling(k: Kit) {
  downlight(k, 5.3, 4.92, CEILING);
  downlight(k, 7.45, 7.15, CEILING);
  smallGlobe(k, 7.45, 5.25, 2.2, 0.16, CEILING);
}

export function Entry() {
  const mirror = useKit(() => {
    const k = new Kit();
    wcMirror(k);
    return k;
  });
  const lamps = useKit(() => {
    const k = new Kit();
    facadeLights(k);
    return k;
  });
  return (
    <group>
      <WallCut wall="wejscie" at={1.0}>
        <KitMesh kit={mirror} castShadow={false} />
      </WallCut>
      <WallCut wall="ogrod" at={1.0}>
        <KitMesh kit={lamps} castShadow={false} />
      </WallCut>
    </group>
  );
}

export { boxUV, tube };
