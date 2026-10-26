/**
 * @jest-environment node
 */
import {
  distanceInMetres,
  toAppNearbyPoints,
} from '@/data-gateway/transformers/toAppNearbyPoints';

/** Praça da Sé. */
const ORIGIN = { lat: -23.5503, lng: -46.6339 };

/** Metres in one degree of latitude. */
const METRES_PER_DEGREE = 111_195;

/** A UBS `metres` north of the origin. */
const ubsNorthBy = (id: number, metres: number) => {
  return {
    id,
    longitude: ORIGIN.lng,
    latitude: ORIGIN.lat + metres / METRES_PER_DEGREE,
    distrito: 'Sé',
    atributos: { nome: `UBS ${id}`, tipo: 'UBS', esfera: 'Municipal' },
  };
};

const source = {
  points: [
    ubsNorthBy(1, 0),
    ubsNorthBy(2, 400),
    ubsNorthBy(3, 1500),
    ubsNorthBy(4, 2500),
  ],
};

describe('toAppNearbyPoints', () => {
  test('keeps the points inside the radius, leaving out the searched spot', () => {
    const nearby = toAppNearbyPoints({
      layer: 'ubs',
      source,
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby).toEqual([
      {
        id: 'ubs:2',
        lngLat: [source.points[1].longitude, source.points[1].latitude],
        name: 'UBS 2',
        detail: 'UBS · Municipal',
        categoryId: 'ubs',
        distance: expect.closeTo(400, 0),
      },
    ]);
  });

  test('a widened search answers only the ring beyond the first one', () => {
    const nearby = toAppNearbyPoints({
      layer: 'ubs',
      source,
      query: { ...ORIGIN, radiusMin: 1000, radius: 2000 },
    });

    expect(
      nearby.map((point) => {
        return point.id;
      })
    ).toEqual(['ubs:3']);
  });
});

describe('distanceInMetres', () => {
  test('measures a degree of latitude as about 111 km', () => {
    expect(
      distanceInMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    ).toBeCloseTo(111_195, -1);
  });
});
