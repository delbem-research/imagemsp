import type { PointOverlayId } from '@/config/overlays';

/**
 * What a search around a point asks for: the point, and the ring around it to
 * search, in metres. The first search covers the whole disc (`radiusMin` is
 * `0`); widening it asks only for the ring beyond what was already searched.
 */
export type NearbyQuery = {
  lat: number;
  lng: number;
  /** Inner edge of the ring, exclusive. */
  radiusMin: number;
  /** Outer edge of the ring, inclusive. */
  radius: number;
};

/**
 * One point overlay feature — a facility, a station, a stop — inside the ring
 * searched, shaped as the map's proximity search takes it.
 */
export type NearbyPoint = {
  /**
   * `<layer>:<feature id>`: feature ids only number the features of one
   * layer, and the search answers from all of them at once.
   */
  id: string;
  /** Where the point is, `[longitude, latitude]`. */
  lngLat: [number, number];
  name: string;
  /** The tooltip's secondary line for the same feature. */
  detail: string;
  /** The layer the point belongs to — the search's category for it. */
  categoryId: PointOverlayId;
  /** Distance from the searched point, in metres. */
  distance: number;
};

/**
 * Canonical contract served by `/api/servicos`: the points of every point
 * overlay inside the ring searched, nearest first.
 */
export type NearbyContract = NearbyPoint[];
