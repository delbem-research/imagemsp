/**
 * Polygon simplification shared by the scripts that ship GeoSampa polygons to
 * the map. GeoSampa draws at 1:5,000, far finer than a city-wide map needs;
 * these helpers bring a layer down to a weight the browser draws smoothly.
 */

export type Position = [number, number];
export type Ring = Position[];
export type PolygonGeometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

/** Coordinate precision kept: 5 decimals is about 1 m. */
const COORD_DECIMALS = 5;

/** Metres per degree at São Paulo's latitude, for the tolerance in metres. */
const M_PER_DEG_LNG = 102_000;
const M_PER_DEG_LAT = 111_000;

/** Squared distance from `p` to segment `a`–`b`, in metres². */
const segmentDistanceSq = (p: Position, a: Position, b: Position): number => {
  const [px, py] = [p[0] * M_PER_DEG_LNG, p[1] * M_PER_DEG_LAT];
  const [ax, ay] = [a[0] * M_PER_DEG_LNG, a[1] * M_PER_DEG_LAT];
  const [bx, by] = [b[0] * M_PER_DEG_LNG, b[1] * M_PER_DEG_LAT];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const ex = px - ax - t * dx;
  const ey = py - ay - t * dy;

  return ex * ex + ey * ey;
};

/**
 * Douglas-Peucker simplification of one closed ring, iterative so the long
 * rings of the rural south cannot overflow the stack.
 *
 * @param ring - A closed ring (first and last positions equal).
 * @param toleranceM - Largest deviation allowed, in metres.
 * @returns The simplified ring, still closed, never under 4 positions.
 */
const simplifyRing = (ring: Ring, toleranceM: number): Ring => {
  if (ring.length <= 4) {
    return ring;
  }

  const toleranceSq = toleranceM * toleranceM;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;

  const stack: [number, number][] = [[0, ring.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestSq = toleranceSq;

    for (let index = start + 1; index < end; index += 1) {
      const distanceSq = segmentDistanceSq(
        ring[index] as Position,
        ring[start] as Position,
        ring[end] as Position
      );

      if (distanceSq > farthestSq) {
        farthest = index;
        farthestSq = distanceSq;
      }
    }

    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  const simplified = ring.filter((_, index) => {
    return keep[index] === 1;
  });

  // A ring needs three distinct corners plus the closing point to stay a polygon.
  return simplified.length >= 4 ? simplified : ring;
};

/** Rounds a position to {@link COORD_DECIMALS}. */
const roundPosition = ([lng, lat]: Position): Position => {
  const factor = 10 ** COORD_DECIMALS;
  return [Math.round(lng * factor) / factor, Math.round(lat * factor) / factor];
};

/**
 * Simplifies and rounds every ring of a polygon geometry.
 *
 * Each polygon is simplified on its own, so a border shared by two neighbours
 * can come out a little apart on each side — never by more than `toleranceM`.
 *
 * @param geometry - A GeoSampa polygon, in WGS84.
 * @param toleranceM - Largest deviation allowed, in metres.
 * @returns The lighter geometry, same type.
 *
 * @example
 * simplifyGeometry(feature.geometry, 40); // 84 thousand vertices → ~3 thousand, for the 32 subprefeituras
 */
export const simplifyGeometry = (
  geometry: PolygonGeometry,
  toleranceM: number
): PolygonGeometry => {
  const simplifyPolygon = (rings: Ring[]): Ring[] => {
    return rings.map((ring) => {
      return simplifyRing(ring, toleranceM).map(roundPosition);
    });
  };

  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: simplifyPolygon(geometry.coordinates) }
    : {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(simplifyPolygon),
      };
};

/** Counts the positions of a geometry, for the run's summary line. */
export const countVertices = (geometry: PolygonGeometry): number => {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  return polygons.flat().reduce((sum, ring) => {
    return sum + ring.length;
  }, 0);
};
