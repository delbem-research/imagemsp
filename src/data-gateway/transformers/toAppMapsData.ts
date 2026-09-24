import { OFFER_SERVICES } from '@/config/offer';
import { SERIES_THRESHOLDS } from '@/config/thresholds';

import type {
  StaticMapsDataSource,
  StaticSubprefeiturasDataSource,
} from '../../data-source-static/types';
import type {
  DistrictCounts,
  MapsDataContract,
  OfferService,
  Subprefeitura,
} from '../schema';

/** Facilities per service, keyed by district name as the point CSVs spell it. */
export type ServiceCounts = Record<OfferService, Map<string, number>>;

/** A zero for every service, the start of each area's tally. */
const noServices = (): Record<OfferService, number> => {
  return Object.fromEntries(
    OFFER_SERVICES.map((service) => {
      return [service, 0];
    })
  ) as Record<OfferService, number>;
};

/**
 * Asserts every district a facility was counted in is a district of the
 * snapshot. The point CSVs name districts as the snapshot does (they are
 * assigned against the official mesh and renamed to the project's spelling),
 * so a name that matches nothing means a spelling drifted — and its facilities
 * would silently vanish from every rate.
 *
 * @param params.serviceCounts - Facilities per service per district name.
 * @param params.districtNames - The snapshot's district names.
 * @throws On the first district name the snapshot does not carry.
 */
const assertServiceDistricts = ({
  serviceCounts,
  districtNames,
}: {
  serviceCounts: ServiceCounts;
  districtNames: Set<string>;
}): void => {
  for (const service of OFFER_SERVICES) {
    for (const name of serviceCounts[service].keys()) {
      if (!districtNames.has(name)) {
        throw new Error(
          `[data-gateway] ${service} counted in district "${name}", which the maps snapshot does not carry`
        );
      }
    }
  }
};

/**
 * Ascending unique years in `counts`.
 *
 * @param counts - District counts, in any order.
 * @returns The projection years, ascending.
 *
 * @example
 * yearsOf(counts); // [2000, 2005, 2010]
 */
const yearsOf = (counts: DistrictCounts[]): number[] => {
  return [
    ...new Set(
      counts.map((entry) => {
        return entry.year;
      })
    ),
  ].sort((a, b) => {
    return a - b;
  });
};

/**
 * Asserts the years form the evenly spaced series the timeline needs, and that
 * every year carries the same districts.
 *
 * Both are invariants of the generated snapshot (`scripts/generateMapsData.ts`
 * enforces them at build time), re-checked here because this is the boundary a
 * hand-edited or swapped JSON crosses. A year short of districts would paint
 * the missing ones with MapLibre's fallback colour — visually identical to a
 * genuinely low rate.
 *
 * @param counts - District counts for every year.
 * @returns The validated years, ascending.
 * @throws If the years are unevenly spaced or a year is missing districts.
 *
 * @example
 * validateYears(counts); // [2000, 2005, ..., 2050]
 */
const validateYears = (counts: DistrictCounts[]): number[] => {
  const years = yearsOf(counts);

  if (years.length === 0) {
    throw new Error('[data-gateway] toAppMapsData found no projection years');
  }

  const steps = new Set(
    years.slice(1).map((year, index) => {
      return year - (years[index] ?? 0);
    })
  );

  if (steps.size > 1) {
    throw new Error(
      `[data-gateway] projection years are unevenly spaced (${years.join(', ')}); the timeline walks a constant step`
    );
  }

  const districtsPerYear = new Set(
    years.map((year) => {
      return counts.filter((entry) => {
        return entry.year === year;
      }).length;
    })
  );

  if (districtsPerYear.size > 1) {
    throw new Error(
      `[data-gateway] projection years carry different district counts (${[...districtsPerYear].join(', ')}); some year would paint incompletely`
    );
  }

  return years;
};

/**
 * Maps each district to its subprefeitura, asserting the two match one to one.
 *
 * @param params.counts - District counts for every year.
 * @param params.subprefeituras - The subprefeituras and their districts.
 * @returns `district geometryId → subprefeitura id`.
 * @throws Unless every district belongs to exactly one subprefeitura, and every
 * district a subprefeitura names has counts — a district left out would drop
 * its population from the totals without any visible sign.
 */
const matchSubprefeituras = ({
  counts,
  subprefeituras,
}: {
  counts: DistrictCounts[];
  subprefeituras: StaticSubprefeiturasDataSource['subprefeituras'];
}): Map<number, number> => {
  const subByDistrict = new Map<number, number>();

  for (const sub of subprefeituras) {
    for (const districtId of sub.distritos) {
      if (subByDistrict.has(districtId)) {
        throw new Error(
          `[data-gateway] district ${districtId} belongs to more than one subprefeitura`
        );
      }
      subByDistrict.set(districtId, sub.id);
    }
  }

  const districtNames = new Map<number, string>();
  for (const entry of counts) {
    districtNames.set(entry.geometryId, entry.name);
  }

  for (const [districtId, name] of districtNames) {
    if (!subByDistrict.has(districtId)) {
      throw new Error(
        `[data-gateway] district ${districtId} (${name}) belongs to no subprefeitura; its population would be left out`
      );
    }
  }

  for (const districtId of subByDistrict.keys()) {
    if (!districtNames.has(districtId)) {
      throw new Error(
        `[data-gateway] a subprefeitura groups district ${districtId}, which has no counts`
      );
    }
  }

  return subByDistrict;
};

/**
 * Adds one district's counts into its subprefeitura's running sum.
 *
 * @param sum - The subprefeitura's sum for the entry's year, mutated.
 * @param entry - The district's counts.
 */
const addCounts = (sum: DistrictCounts, entry: DistrictCounts): void => {
  sum.count65to69 += entry.count65to69;
  sum.count70to74 += entry.count70to74;
  sum.count75plus += entry.count75plus;
  sum.total += entry.total;
  for (const service of OFFER_SERVICES) {
    sum.services[service] += entry.services[service];
  }
};

/**
 * Sums district counts into subprefeitura counts, year by year.
 *
 * Counts are summed and nothing is averaged: the map re-derives every rate from
 * these sums, so a subprefeitura's 65+ share is its districts' 65+ residents
 * over their residents, each district weighing by its population. Averaging the
 * districts' rates instead would let a district of 10 thousand count as much as
 * one of 400 thousand.
 *
 * @param params.counts - District counts for every year.
 * @param params.subprefeituras - The subprefeituras and their districts.
 * @returns The subprefeitura counts and the tooltip's district lists.
 * @throws If districts and subprefeituras do not match one to one (see
 * {@link matchSubprefeituras}).
 *
 * @example
 * aggregateSubprefeituras({ counts, subprefeituras });
 * // { subprefeituraCounts: [{ geometryId: 24, name: 'Mooca', year: 2000, ... }], subprefeituras: [...] }
 */
const aggregateSubprefeituras = ({
  counts,
  subprefeituras,
}: {
  counts: DistrictCounts[];
  subprefeituras: StaticSubprefeiturasDataSource['subprefeituras'];
}): {
  subprefeituraCounts: DistrictCounts[];
  subprefeituras: Subprefeitura[];
} => {
  const subByDistrict = matchSubprefeituras({ counts, subprefeituras });
  const districtNames = new Map(
    counts.map((entry) => {
      return [entry.geometryId, entry.name] as const;
    })
  );

  const subNames = new Map(
    subprefeituras.map((sub) => {
      return [sub.id, sub.nome] as const;
    })
  );
  const sums = new Map<string, DistrictCounts>();

  for (const entry of counts) {
    const subId = subByDistrict.get(entry.geometryId) as number;
    const key = `${entry.year}|${subId}`;
    const sum = sums.get(key) ?? {
      geometryId: subId,
      name: subNames.get(subId) ?? '',
      year: entry.year,
      count65to69: 0,
      count70to74: 0,
      count75plus: 0,
      total: 0,
      services: noServices(),
    };

    addCounts(sum, entry);
    sums.set(key, sum);
  }

  return {
    subprefeituraCounts: [...sums.values()].sort((a, b) => {
      return a.year - b.year || a.geometryId - b.geometryId;
    }),
    subprefeituras: subprefeituras.map((sub) => {
      return {
        geometryId: sub.id,
        name: sub.nome,
        districtNames: sub.distritos
          .map((districtId) => {
            return districtNames.get(districtId) ?? '';
          })
          .sort((a, b) => {
            return a.localeCompare(b, 'pt-BR');
          }),
      };
    }),
  };
};

/**
 * Transforms a source-native maps data record into the canonical app contract.
 *
 * @remarks
 * Renames the source's snake_case fields to the app's shape and keeps the
 * absolute counts as they are — the eight indicator series are derived from
 * them per selection by `components/map/lib/mapRows`, not precomputed here.
 * Thresholds are injected from {@link SERIES_THRESHOLDS} rather than read from
 * JSON, keeping classification decisions in the application layer.
 *
 * Subprefeitura counts are the sums of their districts' counts, computed here
 * once per request rather than stored, so the two levels cannot disagree.
 * Facility counts ride on every year's row: they are today's network, the same
 * whatever year the population is projected for.
 *
 * @param source - Raw district record from data-source-static.
 * @param subprefeiturasSource - Raw subprefeitura record from
 * data-source-static.
 * @param serviceCounts - Facilities per offer service per district name,
 * counted from the point snapshots.
 * @returns Canonical {@link MapsDataContract}.
 * @throws If the snapshot's years are unusable by the timeline (see
 * {@link validateYears}), the districts and subprefeituras do not match one to
 * one (see {@link aggregateSubprefeituras}), or a facility was counted in a
 * district the snapshot does not carry.
 *
 * @example
 * const contract = toAppMapsData(source, subprefeiturasSource, serviceCounts);
 * // { years: [2000, ..., 2050], thresholds: { ... }, counts: [ ... ], subprefeituraCounts: [ ... ], subprefeituras: [ ... ] }
 */
export const toAppMapsData = (
  source: StaticMapsDataSource,
  subprefeiturasSource: StaticSubprefeiturasDataSource,
  serviceCounts: ServiceCounts
): MapsDataContract => {
  if (source.districts.length === 0) {
    throw new Error(
      '[data-gateway] toAppMapsData received an empty districts array'
    );
  }

  assertServiceDistricts({
    serviceCounts,
    districtNames: new Set(
      source.districts.map((district) => {
        return district.nome;
      })
    ),
  });

  const counts: DistrictCounts[] = source.districts.map((district) => {
    return {
      geometryId: district.geometry_id,
      name: district.nome,
      year: district.ano,
      count65to69: district.count_65_69,
      count70to74: district.count_70_74,
      count75plus: district.count_75plus,
      total: district.total,
      services: Object.fromEntries(
        OFFER_SERVICES.map((service) => {
          return [service, serviceCounts[service].get(district.nome) ?? 0];
        })
      ) as Record<OfferService, number>,
    };
  });

  return {
    years: validateYears(counts),
    thresholds: SERIES_THRESHOLDS,
    counts,
    ...aggregateSubprefeituras({
      counts,
      subprefeituras: subprefeiturasSource.subprefeituras,
    }),
  };
};
