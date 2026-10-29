import type { NearbyQuery } from '@/data-gateway/schema';

import { gateway } from '../../../gateway';

/**
 * The widest ring a search may ask for, in metres. Past it the answer grows
 * with the bus stops — 22 thousand of them city-wide — far beyond what a
 * search around one point is for.
 */
const MAX_RADIUS = 5000;

/**
 * Reads a finite number from a query parameter, `undefined` when it is absent
 * or not one.
 */
const numberParam = (params: URLSearchParams, name: string) => {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/** Whether `value` is a number within `[min, max]`. */
const inRange = (
  value: number | undefined,
  { min, max }: { min: number; max: number }
): value is number => {
  return value !== undefined && value >= min && value <= max;
};

/**
 * Reads the search from the address, or says what is wrong with it.
 *
 * @param params - The request's query parameters.
 * @returns The search, or the message a 400 answers with.
 */
const parseQuery = (
  params: URLSearchParams
): { query: NearbyQuery } | { error: string } => {
  const lat = numberParam(params, 'lat');
  const lng = numberParam(params, 'lng');
  const radius = numberParam(params, 'raio');
  const radiusMin = numberParam(params, 'raio_min') ?? 0;

  if (!inRange(lat, { min: -90, max: 90 })) {
    return { error: '"lat" must be a latitude between -90 and 90' };
  }
  if (!inRange(lng, { min: -180, max: 180 })) {
    return { error: '"lng" must be a longitude between -180 and 180' };
  }
  if (!inRange(radius, { min: 0, max: MAX_RADIUS }) || radius === 0) {
    return {
      error: `"raio" must be in metres, above 0 and up to ${MAX_RADIUS}`,
    };
  }
  if (radiusMin < 0 || radiusMin >= radius) {
    return { error: '"raio_min" must be in metres, from 0 and below "raio"' };
  }

  return { query: { lat, lng, radiusMin, radius } };
};

/**
 * Serves the points of every point overlay — facilities, stations, stops —
 * inside a ring around a point, nearest first: what the map's proximity
 * search drops in around the pin the reader clicked.
 *
 * @param request - `?lat=&lng=&raio=` and, to widen a search already made,
 * `&raio_min=`, the radius it covered; radii in metres.
 * @returns The points as a `NearbyContract`, or 400 for a malformed
 * search.
 *
 * @example
 * // GET /api/servicos?lat=-23.5497&lng=-46.6333&raio=1000
 * // [{ id: 'ubs:12', lngLat: [-46.631, -23.548], name: 'UBS SÉ', detail: 'UBS · Municipal', categoryId: 'ubs', distance: 230 }, ...]
 */
export const GET = async (request: Request) => {
  const parsed = parseQuery(new URL(request.url).searchParams);

  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const nearby = await gateway.getNearbyPoints(parsed.query);
  return Response.json(nearby);
};
