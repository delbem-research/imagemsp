import { OFFER_SERVICES } from '@/config/offer';

import type { DistrictCounts, OfferService } from '../schema';

/** A zero for every service, the start of each area's tally. */
export const noServices = (): Record<OfferService, number> => {
  return Object.fromEntries(
    OFFER_SERVICES.map((service) => {
      return [service, 0];
    })
  ) as Record<OfferService, number>;
};

/**
 * An aggregated area's empty sum for one year, ready for {@link addCounts}.
 *
 * @param params.geometryId - The area's feature id.
 * @param params.name - The area's name.
 * @param params.year - The year summed.
 * @returns Counts at zero.
 */
export const emptyCounts = ({
  geometryId,
  name,
  year,
}: {
  geometryId: number;
  name: string;
  year: number;
}): DistrictCounts => {
  return {
    geometryId,
    name,
    year,
    count65to69: 0,
    count70to74: 0,
    count75plus: 0,
    total: 0,
    services: noServices(),
  };
};

/**
 * Adds one district's counts into its area's running sum.
 *
 * @param sum - The area's sum for the entry's year, mutated.
 * @param entry - The district's counts.
 */
export const addCounts = (sum: DistrictCounts, entry: DistrictCounts): void => {
  sum.count65to69 += entry.count65to69;
  sum.count70to74 += entry.count70to74;
  sum.count75plus += entry.count75plus;
  sum.total += entry.total;
  for (const service of OFFER_SERVICES) {
    sum.services[service] += entry.services[service];
  }
};
