// Shared math: seeded RNG, clamps, allocation-free ray tests, LOS.
// Hot loops reuse the exported temp vectors — nothing here allocates per call.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const V1 = new THREE.Vector3();
export const V2 = new THREE.Vector3();
export const V3 = new THREE.Vector3();
export const V4 = new THREE.Vector3();

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

// Deterministic RNG (mulberry32) so ?shot= staging is reproducible.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ray vs sphere. Returns distance along the ray, or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}

// Ray vs axis-aligned box {min:Vector3,max:Vector3}. Returns distance, or -1.
export function rayAABB(ox, oy, oz, dx, dy, dz, box, maxDist) {
  let tmin = 0, tmax = maxDist;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const mn = [box.min.x, box.min.y, box.min.z], mx = [box.max.x, box.max.y, box.max.z];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return -1;
    } else {
      let t1 = (mn[i] - o[i]) / d[i];
      let t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// True when the segment a->b is blocked by any box in `boxes` (LOS test).
// `smokes` is an optional array of {x,y,z,r} smoke spheres that also block sight.
export function segmentBlocked(ax, ay, az, bx, by, bz, boxes, smokes) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 1;
  const nx = dx / len, ny = dy / len, nz = dz / len;
  for (let i = 0; i < boxes.length; i += 1) {
    if (rayAABB(ax, ay, az, nx, ny, nz, boxes[i], len) >= 0) return true;
  }
  if (smokes) {
    for (let i = 0; i < smokes.length; i += 1) {
      const s = smokes[i];
      if (raySphere(ax, ay, az, nx, ny, nz, s.x, s.y, s.z, s.r) >= 0) return true;
    }
  }
  return false;
}

// Yaw (radians, YXZ order) that looks from a toward b.
export function yawTo(ax, az, bx, bz) { return Math.atan2(-(bx - ax), -(bz - az)); }
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
