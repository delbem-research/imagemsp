/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type DistrictCollection,
  districtPaths,
} from '@/components/og/districtPaths';

const square = (
  x: number,
  y: number
): DistrictCollection['features'][number] => {
  return {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
          [x, y],
        ],
      ],
    },
  };
};

/** Every `x y` pair of a path, as numbers. */
const pointsOf = (d: string) => {
  return [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => {
    return [Number(x), Number(y)];
  });
};

test('draws one closed path per district, north up', () => {
  const [d] = districtPaths({
    collection: { features: [square(0, 0)] },
    width: 100,
    height: 100,
  });

  expect(d).toMatch(/^M.*Z$/);
  // The south-west corner (0, 0) lands at the bottom: y grows downwards.
  expect(pointsOf(d)[0]).toEqual([0, 100]);
});

test('keeps the aspect ratio and centres the drawing in the box', () => {
  // Two squares side by side at the equator: twice as wide as tall.
  const paths = districtPaths({
    collection: { features: [square(0, 0), square(1, 0)] },
    width: 100,
    height: 100,
  });
  const ys = paths.flatMap(pointsOf).map(([, y]) => {
    return y;
  });

  expect(Math.min(...ys)).toBeCloseTo(25, 0);
  expect(Math.max(...ys)).toBeCloseTo(75, 0);
});

test("fits São Paulo's 96 districts inside the preview's map box", () => {
  const collection = JSON.parse(
    readFileSync(
      join(process.cwd(), 'public', 'distrito-municipal-v2.geojson'),
      'utf8'
    )
  ) as DistrictCollection;

  const paths = districtPaths({ collection, width: 420, height: 560 });
  const points = paths.flatMap(pointsOf);

  expect(paths).toHaveLength(96);
  for (const [x, y] of points) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(420);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(560);
  }
});
