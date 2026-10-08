import { Point3D } from '../types';

export function calculateDistance3D(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateDeltas(p1: Point3D, p2: Point3D) {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const dz = Math.abs(p2.z - p1.z);
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  const verticalDistance = dy;
  const direct3DDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return { dx, dy, dz, horizontalDistance, verticalDistance, direct3DDistance };
}

export function calculateAngle3Points(p1: Point3D, vertex: Point3D, p3: Point3D): number {
  // Vector v1 = p1 - vertex
  const v1 = {
    x: p1.x - vertex.x,
    y: p1.y - vertex.y,
    z: p1.z - vertex.z
  };
  // Vector v2 = p3 - vertex
  const v2 = {
    x: p3.x - vertex.x,
    y: p3.y - vertex.y,
    z: p3.z - vertex.z
  };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 0;
  let cosTheta = dot / (mag1 * mag2);
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function calculatePolygonPerimeter(points: Point3D[]): number {
  if (points.length < 2) return 0;
  // Two points form a single segment, not a there-and-back loop
  if (points.length === 2) return calculateDistance3D(points[0], points[1]);
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const nextIdx = (i + 1) % points.length;
    // Don't close loop if calculating open path unless length >= 3 and intended
    perimeter += calculateDistance3D(points[i], points[nextIdx]);
  }
  return perimeter;
}

export function calculatePathLength(points: Point3D[]): { total: number; segments: number[] } {
  if (points.length < 2) return { total: 0, segments: [] };
  let total = 0;
  const segments: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = calculateDistance3D(points[i], points[i + 1]);
    segments.push(d);
    total += d;
  }
  return { total, segments };
}

// 3D polygon area calculation using Newell's method for arbitrary 3D coplanar/semi-coplanar planes
export function calculatePolygonArea3D(points: Point3D[]): number {
  const n = points.length;
  if (n < 3) return 0;

  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];

    normalX += (curr.y - next.y) * (curr.z + next.z);
    normalY += (curr.z - next.z) * (curr.x + next.x);
    normalZ += (curr.x - next.x) * (curr.y + next.y);
  }

  const normalMagnitude = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
  return 0.5 * normalMagnitude;
}

// 2D Polygon area via shoelace formula
export function calculatePolygonArea2D(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// Bounding box volume estimation from a set of 3D points
export function calculateBoundingVolume(points: Point3D[]): {
  volume: number;
  length: number;
  width: number;
  height: number;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} {
  if (points.length === 0) {
    return { volume: 0, length: 0, width: 0, height: 0, min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;
  let minZ = points[0].z, maxZ = points[0].z;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const length = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const width = Math.max(0.01, maxZ - minZ);
  const volume = length * width * height;

  return {
    volume,
    length,
    width,
    height,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

// Smooth exponential filter to reject AR sensor micro-jitter
export function smoothPoint(current: Point3D, target: Point3D, smoothingFactor: number = 0.4): Point3D {
  return {
    x: current.x + (target.x - current.x) * smoothingFactor,
    y: current.y + (target.y - current.y) * smoothingFactor,
    z: current.z + (target.z - current.z) * smoothingFactor,
    screenX: target.screenX,
    screenY: target.screenY
  };
}


// ---------------------------------------------------------------------------
// Sensor-based ray geometry (world frame: x = East, y = Up, z = North)
//
// The camera sits at (0, deviceHeight, 0) above the user's feet. The camera
// looks along the back-of-phone axis, whose world direction is derived from the
// full W3C device-orientation rotation matrix R = Rz(alpha) * Rx(beta) * Ry(gamma).
// A target is found by intersecting that ray with the floor (y = 0) or with a
// vertical plane. All results scale linearly with deviceHeight, which is why a
// single known-length calibration is enough to correct systematic error.
// ---------------------------------------------------------------------------

export interface Vec3 { x: number; y: number; z: number }

export interface CameraBasis {
  forward: Vec3; // direction the camera looks
  right: Vec3;   // screen-right
  up: Vec3;      // screen-up
}

const DEG = Math.PI / 180;

export function normalizeVec(v: Vec3): Vec3 {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Build the camera basis (in app world coordinates) from DeviceOrientation angles. */
export function basisFromOrientation(alphaDeg: number, betaDeg: number, gammaDeg: number, screenAngleDeg = 0): CameraBasis {
  const a = alphaDeg * DEG, b = betaDeg * DEG, g = gammaDeg * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cg = Math.cos(g), sg = Math.sin(g);

  // Rotation matrix rows in (East, North, Up)
  const r00 = ca * cg - sa * sb * sg, r01 = -sa * cb, r02 = ca * sg + sa * sb * cg;
  const r10 = sa * cg + ca * sb * sg, r11 = ca * cb,  r12 = sa * sg - ca * sb * cg;
  const r20 = -cb * sg,               r21 = sb,       r22 = cb * cg;

  // Device axes expressed in the app frame {x: East, y: Up, z: North}
  const ex: Vec3 = { x: r00, y: r20, z: r10 };
  const ey: Vec3 = { x: r01, y: r21, z: r11 };
  const ez: Vec3 = { x: r02, y: r22, z: r12 };
  const neg = (v: Vec3): Vec3 => ({ x: -v.x, y: -v.y, z: -v.z });

  const angle = ((Math.round(screenAngleDeg / 90) * 90) % 360 + 360) % 360;
  let right = ex, up = ey;
  if (angle === 90) { right = neg(ey); up = ex; }
  else if (angle === 180) { right = neg(ex); up = neg(ey); }
  else if (angle === 270) { right = ey; up = neg(ex); }

  return { forward: normalizeVec(neg(ez)), right: normalizeVec(right), up: normalizeVec(up) };
}

/** Angle in degrees the camera axis points below the horizon (negative = above). */
export function depressionDeg(forward: Vec3): number {
  return -Math.asin(Math.max(-1, Math.min(1, forward.y))) / DEG;
}

/** Intersect a ray with the floor plane (y = 0). Returns null if aiming too close to the horizon. */
export function intersectFloor(camPos: Vec3, dir: Vec3, minDepressionDeg = 10): Vec3 | null {
  if (depressionDeg(dir) < minDepressionDeg) return null;
  const t = -camPos.y / dir.y;
  if (!(t > 0) || !Number.isFinite(t)) return null;
  return { x: camPos.x + dir.x * t, y: 0, z: camPos.z + dir.z * t };
}

export interface VerticalPlane {
  px: number; pz: number; // a point on the plane (horizontal coords)
  nx: number; nz: number; // unit horizontal normal
}

/** Vertical plane through a floor point, facing the camera. */
export function verticalPlaneThrough(floorPoint: Vec3, camPos: Vec3): VerticalPlane | null {
  const dx = camPos.x - floorPoint.x;
  const dz = camPos.z - floorPoint.z;
  const m = Math.hypot(dx, dz);
  if (m < 0.2) return null;
  return { px: floorPoint.x, pz: floorPoint.z, nx: dx / m, nz: dz / m };
}

/** Intersect a ray with a vertical plane. Heights may be above or below the camera. */
export function intersectVerticalPlane(camPos: Vec3, dir: Vec3, plane: VerticalPlane): Vec3 | null {
  const denom = dir.x * plane.nx + dir.z * plane.nz;
  if (denom > -0.02) return null; // looking away from, or parallel to, the plane
  const t = ((plane.px - camPos.x) * plane.nx + (plane.pz - camPos.z) * plane.nz) / denom;
  if (!(t > 0) || t > 40 || !Number.isFinite(t)) return null;
  return { x: camPos.x + dir.x * t, y: camPos.y + dir.y * t, z: camPos.z + dir.z * t };
}

/**
 * Expected 1-sigma ranging error (metres) for a floor hit, given device height,
 * depression angle and angular sensor noise. d = h / tan(delta), so
 * dd = h / sin^2(delta) * d(delta).
 */
export function estimateFloorError(deviceHeight: number, depression: number, sigmaDeg = 0.35): number {
  const s = Math.sin(Math.max(3, depression) * DEG);
  return (deviceHeight / (s * s)) * (sigmaDeg * DEG);
}

/** Project a world point into canvas pixels. Returns null if behind the camera. */
export function projectToScreen(
  p: Vec3, camPos: Vec3, basis: CameraBasis, width: number, height: number, vFovDeg = 62
): { x: number; y: number } | null {
  const rel = { x: p.x - camPos.x, y: p.y - camPos.y, z: p.z - camPos.z };
  const zc = dot3(rel, basis.forward);
  if (zc < 0.05) return null;
  const xc = dot3(rel, basis.right);
  const yc = dot3(rel, basis.up);
  const f = (height / 2) / Math.tan((vFovDeg * DEG) / 2);
  return { x: width / 2 + (xc / zc) * f, y: height / 2 - (yc / zc) * f };
}

/** Minimum-area oriented rectangle of a set of floor points (x,z). Returns length >= width. */
export function minAreaRect(points: Vec3[]): { length: number; width: number } {
  if (points.length < 2) return { length: 0, width: 0 };
  let best = { length: 0, width: 0, area: Infinity };
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      const rx = p.x * c - p.z * s;
      const rz = p.x * s + p.z * c;
      minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
      minZ = Math.min(minZ, rz); maxZ = Math.max(maxZ, rz);
    }
    const w = maxX - minX, h = maxZ - minZ;
    if (w * h < best.area) best = { length: Math.max(w, h), width: Math.min(w, h), area: w * h };
  }
  return { length: best.length, width: best.width };
}

/** Median of numbers - robust to the odd bad sensor frame. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
