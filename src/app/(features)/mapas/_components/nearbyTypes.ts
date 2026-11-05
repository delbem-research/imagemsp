import { type ProximityHit, useGeoVisProximitySearch } from '@ttoss/geovis';
import * as React from 'react';

import { OVERLAYS, type PointOverlayConfig } from '@/config/overlays';

const POINT_OVERLAYS = OVERLAYS.filter(
  (config): config is PointOverlayConfig => {
    return config.kind === 'point';
  }
);

/** One overlay among the places found, and how many of them it holds. */
export type NearbyTypeCount = { overlay: PointOverlayConfig; count: number };

/**
 * How many of the places found belong to each overlay, in the overlays' own
 * order, leaving out the overlays with none.
 *
 * @example
 * countByType(results); // [{ overlay: { id: 'ubs', … }, count: 3 }, …]
 */
export const countByType = (results: ProximityHit[]): NearbyTypeCount[] => {
  return POINT_OVERLAYS.map((overlay) => {
    const count = results.filter((hit) => {
      return hit.categoryId === overlay.id;
    }).length;
    return { overlay, count };
  }).filter(({ count }) => {
    return count > 0;
  });
};

/**
 * The type the list and the map are narrowed to, kept by the map's proximity
 * search (`categoryId` / `setCategory`), so the list and the pins always agree:
 * picking a chip takes the other types' pins off the map too. Each new search
 * starts unfiltered; a radius without the picked type shows every place again.
 *
 * @returns The overlay id kept, or `null` for every place, and the setter for
 * the chips.
 */
export const useNearbyTypeFilter = ({
  counts,
}: {
  counts: NearbyTypeCount[];
}) => {
  const search = useGeoVisProximitySearch();
  const picked = search?.categoryId ?? null;
  const present =
    picked !== null &&
    counts.some(({ overlay }) => {
      return overlay.id === picked;
    });
  const setCategory = search?.setCategory;

  // A radius without the picked type: show every place again, pins included.
  React.useEffect(() => {
    if (picked !== null && !present && counts.length > 0) {
      setCategory?.(null);
    }
  }, [picked, present, counts.length, setCategory]);

  const setTypeId = React.useCallback(
    (next: string | null) => {
      setCategory?.(next);
    },
    [setCategory]
  );
  return { typeId: present ? picked : null, setTypeId };
};

/** `350 m`, `1,2 km`. */
export const formatDistance = (metres: number) => {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
};

/**
 * Rough travel times, in minutes, from the straight-line distance: the route
 * is taken as 30–40% longer, walked at 5 km/h or driven at 25 km/h plus two
 * minutes to park.
 */
export const travelTimes = (metres: number) => {
  const km = metres / 1000;
  return {
    walk: Math.max(2, Math.round(km * 1.3 * 12)),
    car: Math.max(2, Math.round(km * 1.4 * 2.4 + 2)),
  };
};

/** The nearest place of one overlay, with its overlay. */
export type NearestOfType = {
  overlay: PointOverlayConfig;
  hit: ProximityHit;
};

/**
 * The nearest place of each overlay among the places found — `results` come
 * nearest first, so each overlay's first one — in the order of `counts`.
 *
 * @example
 * nearestByType({ results, counts }); // [{ overlay: { id: 'ubs', … }, hit: { name: 'UBS 1', distance: 350, … } }, …]
 */
export const nearestByType = ({
  results,
  counts,
}: {
  results: ProximityHit[];
  counts: NearbyTypeCount[];
}): NearestOfType[] => {
  return counts.flatMap(({ overlay }) => {
    const hit = results.find((candidate) => {
      return candidate.categoryId === overlay.id;
    });
    return hit ? [{ overlay, hit }] : [];
  });
};
