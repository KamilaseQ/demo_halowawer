"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useExplorer } from "../../../state/store";
import { BONE_DEFS, buildCat, TAIL_SEGMENTS, type CatArrays } from "./body";

/* ==========================================================================
   Easter egg: a cat that lives on the living-room sofa. It sits, scratches
   behind an ear, gets up, turns and strolls to another seat. Poses come from
   two-bone IK on paw targets, so the paws stay on the cushions whatever the
   body does. It only animates in the walkthrough while it is on screen
   (frameloop="demand": idle otherwise) and casts no sun shadow, so it never
   re-renders the shadow map.
   ========================================================================== */

/** Seat line the cat walks along (plan metres): cushion crowns ~0.47, sunk a little. */
const SEAT_Y = 0.464;
const SEAT_Z = 3.18;
const SPOTS = [1.4, 2.1, 2.8];
/** Facing the room (toward the salon viewpoint). */
const FACE_ROOM = Math.PI;

/* ---------- mesh ---------- */

let cached: CatArrays | null = null;

function useCatMesh() {
  const built = useMemo(() => {
    const a = (cached ??= buildCat());
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(a.normal, 3));
    g.setAttribute("color", new THREE.BufferAttribute(a.color, 3));
    g.setAttribute("skinIndex", new THREE.BufferAttribute(a.skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(a.skinWeight, 4));
    g.setIndex(new THREE.BufferAttribute(a.index, 1));
    g.addGroup(0, a.furCount, 0);
    g.addGroup(a.furCount, a.index.length - a.furCount, 1);

    // Short plush coat: matte with a soft sheen rim. Eyes: glossy, they catch the windows.
    const fur = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color("#c4cbd6"), sheenRoughness: 0.45, name: "furn:catFur" });
    const eye = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, name: "furn:catEye" });

    const bones = BONE_DEFS.map((d) => Object.assign(new THREE.Bone(), { name: d.name }));
    const byName: Record<string, THREE.Bone> = Object.fromEntries(bones.map((b) => [b.name, b]));
    BONE_DEFS.forEach((d, i) => {
      const p = d.parent ? BONE_DEFS.find((x) => x.name === d.parent)!.at : [0, 0, 0];
      bones[i].position.set(d.at[0] - p[0], d.at[1] - p[1], d.at[2] - p[2]);
      if (d.parent) byName[d.parent].add(bones[i]);
    });
    const mesh = new THREE.SkinnedMesh(g, [fur, eye]);
    mesh.add(bones[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // The root bone carries the cat around; the bind-pose bounds would not follow it.
    mesh.frustumCulled = false;
    mesh.name = "cat";
    return { mesh, bones: byName, materials: [fur, eye] };
  }, []);
  useEffect(
    () => () => {
      built.mesh.geometry.dispose();
      built.materials.forEach((m) => m.dispose());
    },
    [built],
  );
  return built;
}

/* ---------- IK ---------- */

const _pq = new THREE.Quaternion();
const _d = new THREE.Vector3();
const _r = new THREE.Vector3();

/** Rotates `bone` so its child joint lies along `dir` (world). Bones are bound with identity rotation. */
function aim(bone: THREE.Bone, child: THREE.Bone, dir: THREE.Vector3) {
  bone.parent!.getWorldQuaternion(_pq).invert();
  _d.copy(dir).applyQuaternion(_pq).normalize();
  _r.copy(child.position).normalize();
  bone.quaternion.setFromUnitVectors(_r, _d);
  bone.updateMatrixWorld(true);
}

const _A = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _K = new THREE.Vector3();
const _E = new THREE.Vector3();
const _t = new THREE.Vector3();

/** Two-bone IK: a → b → c reaching `target`, the middle joint bending toward `pole` (world). */
function twoBone(a: THREE.Bone, b: THREE.Bone, c: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  a.getWorldPosition(_A);
  const l1 = b.position.length();
  const l2 = c.position.length();
  _n.subVectors(target, _A);
  const dist = THREE.MathUtils.clamp(_n.length(), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  _n.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _p.copy(pole).addScaledVector(_n, -pole.dot(_n)).normalize();
  _K.copy(_A).addScaledVector(_n, x).addScaledVector(_p, h);
  aim(a, b, _t.subVectors(_K, _A));
  _E.copy(_A).addScaledVector(_n, dist);
  aim(b, c, _t.subVectors(_E, _K));
  return _E;
}

/* ---------- postures ---------- */

type V3 = [number, number, number];

/** Body posture in cat space (+z forward, ground y = 0): pelvis, spine pitches, paw contacts LF, RF, LH, RH. */
type Posture = { py: number; pz: number; pitch: number; spine: number; chest: number; neck: number; head: number; feet: V3[]; meta: number };

const STAND: Posture = {
  py: 0.205,
  pz: -0.115,
  pitch: 0,
  spine: 0,
  chest: 0,
  neck: 0,
  head: 0.1,
  feet: [[0.043, 0, 0.1], [-0.043, 0, 0.1], [0.045, 0, -0.15], [-0.045, 0, -0.15]],
  // Hind metatarsus angle from vertical (standing: near upright, sitting: flat on the cushion).
  meta: 0.37,
};

const SIT: Posture = {
  py: 0.06,
  pz: -0.15,
  pitch: -0.8,
  spine: 0.05,
  chest: 0.2,
  neck: 0.3,
  head: 0.22,
  feet: [[0.036, 0, 0.045], [-0.036, 0, 0.045], [0.052, 0, -0.085], [-0.052, 0, -0.085]],
  meta: 1.5,
};

const lerp = THREE.MathUtils.lerp;

const LEGS = [
  { front: true, s: 1, chain: ["shoulderL", "elbowL", "wristL", "ftoeL"], phase: 0.25 },
  { front: true, s: -1, chain: ["shoulderR", "elbowR", "wristR", "ftoeR"], phase: 0.75 },
  { front: false, s: 1, chain: ["hipL", "kneeL", "hockL", "hpawL", "htoeL"], phase: 0 },
  { front: false, s: -1, chain: ["hipR", "kneeR", "hockR", "hpawR", "htoeR"], phase: 0.5 },
] as const;

/* ---------- behaviour ---------- */

type Activity = "sit" | "scratch" | "turn" | "walk";

/** Gait: stride per cycle, cycles per second, stance share; body speed matches the planted paws. */
const STRIDE = 0.14;
const CADENCE = 1.0;
const DUTY = 0.65;
const SPEED = (STRIDE * CADENCE) / DUTY;

class Brain {
  activity: Activity = "sit";
  timer = 4;
  x: number;
  heading = FACE_ROOM;
  goal: number;
  goalHeading = FACE_ROOM;
  spots: number[];

  constructor(spots: number[] = SPOTS) {
    this.spots = spots;
    this.x = this.goal = spots[Math.min(1, spots.length - 1)];
  }
  /** Smoothed blends. */
  sit = 1;
  walk = 0;
  scratch = 0;
  scratchSide: 1 | -1 = 1;
  phase = 0;
  time = 0;
  blink = 0;
  nextBlink = 3;
  private rnd = 0.37;

  private random() {
    // Deterministic, so every visitor's cat behaves alike (screenshots, QA).
    this.rnd = (this.rnd * 9301 + 0.49297) % 1;
    return this.rnd;
  }

  update(dt: number) {
    this.time += dt;
    this.timer -= dt;
    const a = this.activity;
    if (a === "sit" && this.timer <= 0) {
      if (this.random() < 0.55) this.start("scratch", 2.4);
      else {
        // Pick another seat and turn toward it.
        const options = this.spots.filter((s) => Math.abs(s - this.x) > 0.2);
        this.goal = options[Math.floor(this.random() * options.length)];
        this.goalHeading = this.goal > this.x ? Math.PI / 2 : -Math.PI / 2;
        this.start("turn", 1.1);
      }
    } else if (a === "scratch" && this.timer <= 0) {
      this.start("sit", 2 + this.random() * 2);
    } else if (a === "turn") {
      this.heading = dampAngle(this.heading, this.goalHeading, 0.25, dt);
      if (this.timer <= 0) {
        this.heading = this.goalHeading;
        this.start(Math.abs(this.goal - this.x) > 0.02 ? "walk" : "sit", 4 + this.random() * 3);
        if (this.activity === "sit") this.goal = this.x;
      }
    } else if (a === "walk") {
      const left = this.goal - this.x;
      const step = Math.sign(left) * Math.min(Math.abs(left), SPEED * this.walk * dt + 1e-4);
      this.x += step;
      if (Math.abs(this.goal - this.x) < 0.005) {
        this.x = this.goal;
        this.goalHeading = FACE_ROOM;
        this.start("turn", 1.1);
      }
    }

    const sitting = this.activity === "sit" || this.activity === "scratch";
    this.sit = damp(this.sit, sitting ? 1 : 0, 0.3, dt);
    this.walk = damp(this.walk, this.activity === "walk" || this.activity === "turn" ? 1 : 0, 0.15, dt);
    this.scratch = damp(this.scratch, this.activity === "scratch" ? 1 : 0, 0.18, dt);
    // Gait runs while walking or turning; it parks when the paws are back under the body.
    if (this.walk > 0.02) this.phase = (this.phase + dt * CADENCE) % 1;

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 2.5 + this.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt / 0.16);
  }

  private start(a: Activity, t: number) {
    this.activity = a;
    this.timer = t;
    if (a === "scratch") this.scratchSide = this.random() < 0.5 ? 1 : -1;
  }
}

function damp(v: number, to: number, smooth: number, dt: number) {
  return lerp(v, to, 1 - Math.exp(-dt / Math.max(1e-4, smooth)));
}

function dampAngle(v: number, to: number, smooth: number, dt: number) {
  const d = Math.atan2(Math.sin(to - v), Math.cos(to - v));
  return v + d * (1 - Math.exp(-dt / smooth));
}

/* ---------- component ---------- */

const _foot = new THREE.Vector3();
const _w = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _toe = new THREE.Vector3();
const _hock = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler(0, 0, 0, "YXZ");

/**
 * The cat in its own frame: it walks along x between `spots` on a seat line at height `seatY`, depth
 * `seatZ`, facing −z. Place and turn the parent group to put that line on a sofa.
 */
export function Cat({ seatY = SEAT_Y, seatZ = SEAT_Z, spots = SPOTS }: { seatY?: number; seatZ?: number; spots?: number[] } = {}) {
  const { mesh, bones: B } = useCatMesh();
  const spotsKey = spots.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const brain = useMemo(() => new Brain(spots), [spotsKey]);
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const look = useRef({ yaw: 0, pitch: 0 });

  function pose(camera: THREE.Camera, dt: number) {
    const b = brain;
    const root = B.root;
    root.position.set(b.x, seatY, seatZ);
    root.rotation.set(0, b.heading, 0);

    const w = b.sit;
    const P = (k: "py" | "pz" | "pitch" | "spine" | "chest" | "neck" | "head") => lerp(STAND[k], SIT[k], w);
    const bob = Math.sin(b.phase * Math.PI * 4) * 0.004 * b.walk;
    B.pelvis.position.set(0, P("py") + bob, P("pz"));
    B.pelvis.rotation.set(P("pitch"), Math.sin(b.phase * Math.PI * 2) * 0.05 * b.walk, 0);
    B.spine.rotation.set(P("spine"), 0, 0);
    B.chest.rotation.set(P("chest"), 0, 0);

    // Head: follows the visitor while sitting (when they are in front), looks ahead otherwise;
    // tilts toward the scratching paw.
    root.updateMatrixWorld(true);
    let yaw = 0;
    let pitch = 0;
    if (w > 0.5 && b.scratch < 0.1) {
      root.worldToLocal(_cam.copy(camera.position));
      _cam.y -= 0.33;
      if (_cam.z > 0.1) {
        yaw = THREE.MathUtils.clamp(Math.atan2(_cam.x, _cam.z), -0.9, 0.9);
        pitch = THREE.MathUtils.clamp(-Math.atan2(_cam.y, Math.hypot(_cam.x, _cam.z)), -0.5, 0.5);
      }
    }
    const L = look.current;
    L.yaw = dt > 0 ? damp(L.yaw, yaw, 0.18, dt) : L.yaw;
    L.pitch = dt > 0 ? damp(L.pitch, pitch, 0.18, dt) : L.pitch;
    const sc = b.scratch * b.scratchSide;
    B.neck.quaternion.setFromEuler(_e.set(P("neck") + L.pitch * 0.4 + Math.abs(sc) * 0.25, L.yaw * 0.4 + sc * 0.35, 0));
    B.head.quaternion.setFromEuler(_e.set(P("head") + L.pitch * 0.6 + Math.abs(sc) * 0.2, L.yaw * 0.6 + sc * 0.3, sc * 0.45));
    // Blink, and half-closed eyes while scratching (it feels good).
    const lid = Math.max(1 - Math.sin(Math.PI * b.blink) * 0.92, 1 - Math.abs(sc) * 0.6);
    B.eyeL.scale.set(1, lid, 1);
    B.eyeR.scale.set(1, lid, 1);
    // Ears flatten a little toward the scratched side.
    B.earL.rotation.set(0, 0, b.scratchSide > 0 ? -b.scratch * 0.35 : 0);
    B.earR.rotation.set(0, 0, b.scratchSide < 0 ? b.scratch * 0.35 : 0);
    root.updateMatrixWorld(true);

    // Legs.
    const forward = _w.set(Math.sin(b.heading), 0, Math.cos(b.heading));
    for (let i = 0; i < 4; i++) {
      const leg = LEGS[i];
      const st = STAND.feet[i], si = SIT.feet[i];
      const fx = lerp(st[0], si[0], w);
      let fy = 0;
      let fz = lerp(st[2], si[2], w);
      // Gait: swing forward on an arc, then the planted paw slides back under the moving body.
      if (b.walk > 0.001) {
        const ph = (b.phase + leg.phase) % 1;
        const swing = 1 - DUTY;
        let off: number;
        if (ph < swing) {
          const u = ph / swing;
          off = -STRIDE / 2 + STRIDE * (u * u * (3 - 2 * u));
          fy = Math.sin(Math.PI * u) * (leg.front ? 0.03 : 0.026);
        } else off = STRIDE / 2 - (STRIDE * (ph - swing)) / DUTY;
        fz += off * b.walk;
        fy *= b.walk;
      }
      const meta = lerp(STAND.meta, SIT.meta, w);
      const scratching = !leg.front && b.scratch > 0.01 && leg.s === b.scratchSide;

      if (leg.front) {
        const [shoulder, elbow, wrist, toe] = leg.chain.map((n) => B[n]);
        root.localToWorld(_foot.set(fx, fy + 0.022, fz - 0.012));
        twoBone(shoulder, elbow, wrist, _foot, _pole.copy(forward).negate().setY(-0.2));
        root.localToWorld(_toe.set(fx, fy + 0.006, fz + 0.03));
        aim(wrist, toe, _toe.sub(wrist.getWorldPosition(_hock)));
      } else {
        const [hip, knee, hock, paw, toe] = leg.chain.map((n) => B[n]);
        // Ball of the paw, then the hock behind it along the metatarsus.
        root.localToWorld(_foot.set(fx, fy + 0.018, fz - 0.011));
        if (scratching) {
          // Paw up behind the ear, raking quickly.
          const ear = (leg.s > 0 ? B.earL : B.earR).getWorldPosition(_toe);
          const rake = Math.sin(b.time * Math.PI * 2 * 7) * 0.012;
          const side = _pole.set(leg.s, 0, 0).applyQuaternion(root.quaternion);
          _hock.copy(ear).addScaledVector(side, 0.025).addScaledVector(forward, -0.03 + rake).add(_t.set(0, -0.03 + rake * 0.5, 0));
          _foot.lerp(_hock, Math.min(1, b.scratch * 1.15));
        }
        const dir = _t.set(0, -Math.cos(meta), Math.sin(meta)).applyQuaternion(root.quaternion);
        if (scratching) dir.lerp(_E.subVectors(_foot, hip.getWorldPosition(_A)).normalize(), b.scratch).normalize();
        _hock.copy(_foot).addScaledVector(dir, -paw.position.length());
        twoBone(hip, knee, hock, _hock, _pole.copy(forward).setY(0.15));
        aim(hock, paw, _E.subVectors(_foot, hock.getWorldPosition(_A)));
        root.localToWorld(_toe.set(fx, fy + 0.012, fz + 0.02));
        aim(paw, toe, _toe.sub(paw.getWorldPosition(_A)));
      }
    }

    // Tail: carried up in a soft arc when walking, lying along the cushion when sitting; always swaying.
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const sway = Math.sin(b.time * 1.7 - i * 0.55) * (0.05 + 0.02 * i) * (1 - w * 0.6);
      const up = i === 0 ? lerp(1.05, 0.15, w) : i === 1 ? lerp(-0.1, 0.75, w) : lerp(-0.1, 0.05, w);
      const curl = w * (i === 0 ? 0 : 0.28);
      B[`tail${i}`].rotation.set(up, sway + curl, 0, "YXZ");
    }
  }
  useFrame(({ camera }, dt) => {
    const s = useExplorer.getState();
    const active = !reduced && s.mode === "walk" && !s.photo && s.settled;

    // On screen and near enough to notice: only then does the cat keep the frame loop running.
    _sphere.set(_cam.set(brain.x, seatY + 0.2, seatZ), 0.45);
    // The cat's frame may be placed, turned or mirrored by its parents: test in world space.
    mesh.updateWorldMatrix(true, false);
    _sphere.center.applyMatrix4(mesh.matrixWorld);
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const seen = _frustum.intersectsSphere(_sphere) && camera.position.distanceTo(_sphere.center) < 8;
    if (active && seen) brain.update(dt);

    pose(camera, active && seen ? dt : 0);
    if (active && seen) invalidate();
  });


  return <primitive object={mesh} />;
}
