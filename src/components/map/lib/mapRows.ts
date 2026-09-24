import {
  OFFER_CATEGORIES,
  OFFER_CATEGORY_IDS,
  OFFER_RATE_BASE,
} from '@/config/offer';
import type {
  Category,
  DistrictCounts,
  Group,
  MapDataRow,
  OfferCategory,
  OfferService,
} from '@/data-gateway/schema';

/**
 * The numerator and denominator one indicator series reads off an area's
 * counts: two of its four population figures, or a service's facilities over
 * its 65+ residents.
 */
type SeriesRatio = (counts: DistrictCounts) => {
  count: number;
  totalCount: number;
};

/** Residents aged 65 or older — the denominator of both `*-65plus` categories. */
const elderly = (counts: DistrictCounts): number => {
  return counts.count65to69 + counts.count70to74 + counts.count75plus;
};

/** Residents aged 70 or older. */
const elderly70plus = (counts: DistrictCounts): number => {
  return counts.count70to74 + counts.count75plus;
};

/**
 * Numerator and denominator per indicator series.
 *
 * The category decides the denominator (the district's whole population, or its
 * own 65+ population) and the group decides the numerator, which is cumulative
 * for `65`/`70`/`75` and a closed band for `65-69`/`70-74`. For an offer
 * category the group is one of its services, and the numerator its facilities
 * in the area. Encoded as a table so the map, the legend and the tooltip cannot
 * drift apart: all three read the same entry.
 */
/**
 * One ratio per service of an offer category: its facilities over the area's
 * 65+ residents.
 *
 * @param services - The category's services.
 * @returns The category's row of {@link SERIES_RATIOS}.
 */
const offerRatios = (
  services: readonly OfferService[]
): Partial<Record<Group, SeriesRatio>> => {
  return Object.fromEntries(
    services.map((service) => {
      const ratio: SeriesRatio = (counts) => {
        return { count: counts.services[service], totalCount: elderly(counts) };
      };
      return [service, ratio];
    })
  );
};

/** Builds a per-offer-category table from one value per category. */
const byOfferCategory = <T>(
  value: (category: OfferCategory) => T
): Record<OfferCategory, T> => {
  return Object.fromEntries(
    OFFER_CATEGORY_IDS.map((category) => {
      return [category, value(category)];
    })
  ) as Record<OfferCategory, T>;
};

const SERIES_RATIOS: Record<Category, Partial<Record<Group, SeriesRatio>>> = {
  'cumulative-total': {
    '65': (counts) => {
      return { count: elderly(counts), totalCount: counts.total };
    },
    '70': (counts) => {
      return { count: elderly70plus(counts), totalCount: counts.total };
    },
    '75': (counts) => {
      return { count: counts.count75plus, totalCount: counts.total };
    },
  },
  'cumulative-65plus': {
    '70': (counts) => {
      return { count: elderly70plus(counts), totalCount: elderly(counts) };
    },
    '75': (counts) => {
      return { count: counts.count75plus, totalCount: elderly(counts) };
    },
  },
  '5year-65plus': {
    '65-69': (counts) => {
      return { count: counts.count65to69, totalCount: elderly(counts) };
    },
    '70-74': (counts) => {
      return { count: counts.count70to74, totalCount: elderly(counts) };
    },
    // Identical to `cumulative-65plus/75`: the open top band is at once the last
    // closed band and a cumulative one, so both menu paths land on this ratio.
    '75': (counts) => {
      return { count: counts.count75plus, totalCount: elderly(counts) };
    },
  },
  ...byOfferCategory((category) => {
    return offerRatios(OFFER_CATEGORIES[category]);
  }),
};

/**
 * How each category's ratio becomes the value painted: a fraction, rounded to
 * four decimals (the shares, shown as percentages), or facilities per
 * {@link OFFER_RATE_BASE} residents aged 65+, rounded to two.
 */
const SERIES_SCALE: Record<Category, { base: number; decimals: number }> = {
  'cumulative-total': { base: 1, decimals: 4 },
  'cumulative-65plus': { base: 1, decimals: 4 },
  '5year-65plus': { base: 1, decimals: 4 },
  ...byOfferCategory(() => {
    return { base: OFFER_RATE_BASE, decimals: 2 };
  }),
};

/**
 * Rate on a base, rounded, guarding a zero denominator.
 *
 * Four decimals on base 1 is what the offline snapshot used to apply before
 * the counts moved to the client, so the shares the map paints are unchanged.
 *
 * @param params.numerator - Population in the band, or facilities.
 * @param params.denominator - Population the numerator is set against.
 * @param params.base - Units of denominator per value (`1` for a share).
 * @param params.decimals - Decimals kept.
 * @returns The rate, or `0` when there is nobody to divide by.
 *
 * @example
 * safeRate({ numerator: 15169, denominator: 81060, base: 1, decimals: 4 }); // 0.1871
 * safeRate({ numerator: 3, denominator: 21380, base: 10000, decimals: 2 }); // 1.4
 */
const safeRate = ({
  numerator,
  denominator,
  base,
  decimals,
}: {
  numerator: number;
  denominator: number;
  base: number;
  decimals: number;
}): number => {
  const factor = 10 ** decimals;

  return denominator > 0
    ? Math.round(((numerator * base) / denominator) * factor) / factor
    : 0;
};

/**
 * Derives the map's value rows for one year and one indicator series.
 *
 * Called on every timeline tick, so it stays a single pass over the year's
 * districts (96 divisions) with no allocation beyond the rows themselves.
 *
 * @param params.counts - Every district/year entry from the gateway.
 * @param params.year - The projection year to paint.
 * @param params.category - The indicator category.
 * @param params.group - The age group within that category.
 * @returns One {@link MapDataRow} per area in that year, carrying the rate
 * plus the absolute figures the tooltip shows — for an offer series, the
 * facilities and the 65+ population.
 * @throws If the category/group pair is not a series the app defines.
 *
 * @example
 * buildMapRows({ counts, year: 2025, category: 'cumulative-total', group: '65' });
 * // [{ geometryId: 1, value: 0.1871, name: 'Água Rasa', count: 15169, totalCount: 81060 }, ...]
 */
export const buildMapRows = ({
  counts,
  year,
  category,
  group,
}: {
  counts: DistrictCounts[];
  year: number;
  category: Category;
  group: Group;
}): MapDataRow[] => {
  const ratio = SERIES_RATIOS[category][group];

  if (!ratio) {
    throw new Error(
      `[mapRows] no ratio defined for ${category}/${group}; the map would paint nothing`
    );
  }

  const scale = SERIES_SCALE[category];
  const rows: MapDataRow[] = [];

  for (const entry of counts) {
    if (entry.year !== year) {
      continue;
    }

    const { count, totalCount } = ratio(entry);

    rows.push({
      geometryId: entry.geometryId,
      value: safeRate({ numerator: count, denominator: totalCount, ...scale }),
      name: entry.name,
      count,
      totalCount,
    });
  }

  return rows;
};

/**
 * Total 65+ population per year, for the timeline's mini histogram.
 *
 * @param params.counts - Every district/year entry from the gateway.
 * @param params.years - The projection years, ascending.
 * @returns One `{ key, count }` per year, in the shape the timeline control
 * reads.
 *
 * @example
 * buildElderlyHistogram({ counts, years: [2000, 2005] });
 * // [{ key: 2000, count: 670274 }, { key: 2005, count: 784835 }]
 */
export const buildElderlyHistogram = ({
  counts,
  years,
}: {
  counts: DistrictCounts[];
  years: number[];
}): { key: number; count: number }[] => {
  const totals = new Map<number, number>();

  for (const entry of counts) {
    totals.set(entry.year, (totals.get(entry.year) ?? 0) + elderly(entry));
  }

  return years.map((year) => {
    return { key: year, count: totals.get(year) ?? 0 };
  });
};
