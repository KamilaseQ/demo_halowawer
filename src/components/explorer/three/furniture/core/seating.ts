import * as THREE from "three";
import { Kit } from "./kit";
import { arc, circle, lathe, puck, rod, roundRect, softBox, sweep, boxUV, type Vec3T } from "./geometry";

/* ==========================================================================
   Dining furniture: a bentwood oak elbow chair (frame in cabinetWood so it
   follows the finish, seat in fabricAccent) and two tables. Chair local
   frame: seat centre at x = z = 0, facing +z, floor at y = 0.
   ========================================================================== */

const W = "cabinetWood" as const;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function chairKit(): Kit {
  const k = new Kit();
  const seatTop = 0.455;

  // Front legs: round, tapering toward the floor, slightly splayed.
  for (const s of [-1, 1]) k.add(W, rod([s * 0.218, 0.004, 0.2], [s * 0.205, 0.41, 0.178], 0.0145, 0.0185, 9));

  // Rear legs sweep up and back into the curved back rail.
  const R = 0.275;
  const railY = 0.71;
  const legTheta = 0.82; // where the rear legs meet the rail (radians from the back centre)
  const railAt = (t: number): Vec3T => [R * Math.sin(t), railY, -R * Math.cos(t) + 0.02];
  for (const s of [-1, 1]) {
    const top = railAt(s * legTheta);
    const path = [v(s * 0.205, 0.004, -0.235), v(s * 0.205, 0.22, -0.2), v(s * 0.207, 0.42, -0.178), v(top[0], railY - 0.05, top[2]), v(top[0], railY - 0.005, top[2])];
    // Thicker at the seat, slimmer at the floor and where it meets the rail.
    k.add(W, sweep(path, circle(1, 9), { segments: 12, up: [0, 0, 1], scale: (t) => 0.0135 + 0.0045 * Math.sin(Math.PI * Math.min(1, t * 1.3)) }));
  }

  // Bentwood back rail: flat band bent around the sitter, ends forming low arms.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = -1.28 + (2.56 * i) / 14;
    const [x, y, z] = railAt(t);
    pts.push(v(x, y, z));
  }
  k.add(W, sweep(pts, roundRect(0.024, 0.06, 0.009, 1), { segments: 22, up: [0, 1, 0], caps: true }));

  // Central splat from the seat back up into the rail.
  k.add(W, sweep([v(0, 0.44, -0.205), v(0, 0.56, -0.235), v(0, railY - 0.02, -R + 0.03)], roundRect(0.075, 0.014, 0.006, 1), { segments: 6, up: [0, 0, 1], caps: true }));

  // Seat: wooden frame with an upholstered pad.
  k.add(W, softBox(0.47, 0.032, 0.44, { r: 0.012, edge: 1, step: 0.5 }), [0, 0.416, -0.005]);
  k.add("fabricAccent", softBox(0.45, 0.04, 0.42, { r: 0.018, edge: 2, step: 0.14, bulge: { top: 0.008 }, power: 3, uvScale: 2.2 }), [0, seatTop - 0.007, 0]);

  // Side stretchers.
  for (const s of [-1, 1]) k.add(W, rod([s * 0.213, 0.17, 0.19], [s * 0.205, 0.17, -0.215], 0.0085, 0.0085, 6));
  k.add(W, rod([-0.21, 0.19, 0.19], [0.21, 0.19, 0.19], 0.0085, 0.0085, 6));
  return k;
}

/** Rectangular dining table: stone top on two rounded oak slab legs. Long axis along z. */
export function diningTableKit(w: number, len: number, height = 0.75): Kit {
  const k = new Kit();
  const t = 0.03;
  k.add("stone", softBox(w, t, len, { r: 0.008, edge: 2, step: 4 }), [0, height - t / 2, 0]);
  for (const s of [-1, 1]) {
    const z = s * (len / 2 - 0.38);
    k.add(W, softBox(w * 0.56, height - t - 0.004, 0.12, { r: 0.05, edge: 3, step: 0.2, sharp: { top: true } }), [0, (height - t) / 2 + 0.002, z]);
  }
  k.add(W, softBox(0.07, 0.07, len - 0.9, { r: 0.02, edge: 2, step: 0.3 }), [0, height - t - 0.12, 0]);
  return k;
}

/** Round pedestal table: stone top, turned oak column on a disc foot. */
export function roundTableKit(d: number, height = 0.75): Kit {
  const k = new Kit();
  k.add("stone", boxUV(puck(d / 2, 0.028, 0.01, 64)), [0, height - 0.028, 0]);
  k.add(
    W,
    lathe(
      [
        [0, 0.004],
        [0.25, 0.004],
        ...arc(0.25, 0.016, 0.012, -Math.PI / 2, 0, 3),
        [0.24, 0.035],
        [0.09, 0.07],
        [0.065, 0.2],
        [0.06, height - 0.12],
        [0.11, height - 0.05],
        [0.16, height - 0.028],
        [0, height - 0.028],
      ],
      { segments: 48 },
    ),
  );
  return k;
}

/** Writing desk: oak top and slim metal frame. Front faces +z, origin at the centre of its footprint. */
export function deskKit(w: number, d: number, height = 0.75): Kit {
  const k = new Kit();
  k.add(W, softBox(w, 0.028, d, { r: 0.006, edge: 2, step: 4 }), [0, height - 0.014, 0]);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.05);
    k.add("metal", rod([x, 0.004, d / 2 - 0.06], [x, height - 0.028, d / 2 - 0.06], 0.012, 0.012, 10));
    k.add("metal", rod([x, 0.004, -d / 2 + 0.06], [x, height - 0.028, -d / 2 + 0.06], 0.012, 0.012, 10));
    k.add("metal", rod([x, height - 0.05, -d / 2 + 0.06], [x, height - 0.05, d / 2 - 0.06], 0.009, 0.009, 8));
  }
  k.add("metal", rod([-w / 2 + 0.05, height - 0.05, -d / 2 + 0.06], [w / 2 - 0.05, height - 0.05, -d / 2 + 0.06], 0.009, 0.009, 8));
  // Shallow drawer under the top.
  k.add(W, softBox(w * 0.4, 0.07, d - 0.12, { r: 0.004, edge: 1, step: 4 }), [0, height - 0.028 - 0.035, 0]);
  return k;
}
