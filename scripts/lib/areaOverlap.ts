/**
 * Area and overlap of WGS84 polygons, for the scripts that assign the
 * project's districts to a coarser division by geometry rather than by name.
 *
 * Areas are planar, in square metres, on an equirectangular projection centred
 * on São Paulo — off by well under 1% across the city, which is far finer than
 * the share thresholds the assignments are checked against.
 */
import polygonClipping from 'polygon-clipping';

import type { PolygonGeometry, Ring } from './simplifyGeometry.ts';

/** Metres per degree at São Paulo's latitude (~23.6° S). */
const M_PER_DEG_LNG = 102_000;
const M_PER_DEG_LAT = 111_320;

/** The polygons of a geometry, a `Polygon` read as a one-polygon list. */
export const polygonsOf = (geometry: PolygonGeometry): Ring[][] => {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
};

/** Shoelace area of one ring, in m². */
const ringArea = (ring: Ring): number => {
  let twice = 0;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    twice +=
      xj * M_PER_DEG_LNG * (yi * M_PER_DEG_LAT) -
      xi * M_PER_DEG_LNG * (yj * M_PER_DEG_LAT);
  }

  return Math.abs(twice) / 2;
};

/**
 * Area of a list of polygons, holes subtracted.
 *
 * @param polygons - Polygons as rings, the outer ring first.
 * @returns The area, in m².
 */
export const areaOf = (polygons: Ring[][]): number => {
  return polygons.reduce((sum, [outer, ...holes]) => {
    return (
      sum +
      (outer ? ringArea(outer) : 0) -
      holes.reduce((holeSum, hole) => {
        return holeSum + ringArea(hole);
      }, 0)
    );
  }, 0);
};

/** Bounding box of a list of polygons, `[minX, minY, maxX, maxY]`. */
export const bboxOf = (
  polygons: Ring[][]
): [number, number, number, number] => {
  const outer = polygons.flatMap((polygon) => {
    return polygon[0] ?? [];
  });
  const xs = outer.map(([x]) => {
    return x;
  });
  const ys = outer.map(([, y]) => {
    return y;
  });

  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const bboxesMeet = (
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean => {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
};

/** A polygon area with its bounding box precomputed, for {@link shareIn}. */
export type Measured = {
  polygons: Ring[][];
  bbox: [number, number, number, number];
  area: number;
};

/**
 * Precomputes what {@link shareIn} needs of an area.
 *
 * @param polygons - The area's polygons.
 * @returns The polygons with their bounding box and area.
 */
export const measure = (polygons: Ring[][]): Measured => {
  return { polygons, bbox: bboxOf(polygons), area: areaOf(polygons) };
};

/**
 * The share of `part` that lies inside `whole`.
 *
 * @param params.part - The area measured.
 * @param params.whole - The area it is measured against.
 * @returns A share in [0, 1]; 0 without computing the intersection when the
 * bounding boxes do not meet.
 *
 * @example
 * shareIn({ part: measure(district), whole: measure(supervision) }); // 0.992
 */
export const shareIn = ({
  part,
  whole,
}: {
  part: Measured;
  whole: Measured;
}): number => {
  if (part.area === 0 || !bboxesMeet(part.bbox, whole.bbox)) {
    return 0;
  }

  const overlap = polygonClipping.intersection(
    part.polygons as polygonClipping.Geom,
    whole.polygons as polygonClipping.Geom
  ) as Ring[][];

  return areaOf(overlap) / part.area;
};
