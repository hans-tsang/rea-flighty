/** Great-circle helpers for drawing a route without a map SDK. */

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface LatLon {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points along the great circle from a to b. Longitudes are "unwrapped" so the
 * path is continuous across the antimeridian (values may exceed ±180).
 */
export function greatCirclePoints(a: LatLon, b: LatLon, segments = 64): LatLon[] {
  const φ1 = toRad(a.latitude);
  const λ1 = toRad(a.longitude);
  const φ2 = toRad(b.latitude);
  const λ2 = toRad(b.longitude);
  const d = distanceKm(a, b) / 6371;
  if (d === 0) return [a, b];
  const points: LatLon[] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    let lon = toDeg(Math.atan2(y, x));
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    points.push({ latitude: lat, longitude: lon });
  }
  return points;
}
