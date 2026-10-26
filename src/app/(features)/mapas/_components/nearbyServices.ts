import type { ProximitySearch } from '@ttoss/geovis';

import { OVERLAYS, type PointOverlayConfig } from '@/config/overlays';
import type { NearbyContract, NearbyQuery } from '@/data-gateway/schema';

import { overlaySpecId } from './overlays';

/** The route that answers a search around a point. */
const NEARBY_URL = '/api/servicos';

/**
 * Finds the points of every overlay inside a ring around a point — what the
 * map's proximity search asks when a pin is clicked, and again when the reader
 * widens the radius. Each answer is logged to the browser console.
 *
 * @param params - The point and the ring, in metres; `signal` cancels the
 * request when the search is cleared or replaced.
 * @returns The points inside the ring, nearest first.
 * @throws If the route answers with an error.
 *
 * @example
 * await fetchNearbyServices({ lat: -23.55, lng: -46.63, radiusMin: 0, radius: 1000 });
 * // [{ id: 'ubs:12', lngLat: [-46.631, -23.548], name: 'UBS SÉ', ... }]
 */
export const fetchNearbyServices = async ({
  lat,
  lng,
  radiusMin,
  radius,
  signal,
}: NearbyQuery & { signal?: AbortSignal }): Promise<NearbyContract> => {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    raio: String(radius),
  });
  if (radiusMin > 0) params.set('raio_min', String(radiusMin));
  const url = `${NEARBY_URL}?${params.toString()}`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`[nearbyServices] ${url} answered ${response.status}`);
  }

  const nearby = (await response.json()) as NearbyContract;
  // eslint-disable-next-line no-console
  console.log('[nearbyServices]', { lat, lng, radiusMin, radius }, nearby);
  return nearby;
};

const POINT_OVERLAYS = OVERLAYS.filter(
  (config): config is PointOverlayConfig => {
    return config.kind === 'point';
  }
);

/**
 * The map's search around a pin: clicking the pin of any point overlay asks
 * {@link fetchNearbyServices} for the points of every overlay around it, and
 * each answer drops in as a pin in its own overlay's colour and icon.
 */
export const NEARBY_SEARCH: ProximitySearch = {
  layers: POINT_OVERLAYS.map((config) => {
    return overlaySpecId(config.id);
  }),
  query: fetchNearbyServices,
  radii: [1000, 2000, 3000],
  categories: POINT_OVERLAYS.map((config) => {
    return {
      id: config.id,
      label: config.label,
      color: config.color,
      icon: config.icon,
    };
  }),
  labels: { one: 'serviço', other: 'serviços' },
};
