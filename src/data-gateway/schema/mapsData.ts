/**
 * The categories that paint a population share, along the timeline: an age
 * group's share of the whole population, or of the 65+.
 */
export type ShareCategory = 'cumulative-total' | '5year-65plus';

/**
 * The categories that paint public facilities per 10 thousand residents aged
 * 65+ — health, food and leisure — for one year (see `config/offer`).
 */
export type OfferCategory = 'health-65plus' | 'food-65plus' | 'leisure-65plus';

export type Category = ShareCategory | OfferCategory;

/**
 * The age groups every indicator lists: every elderly resident (`65`, shown
 * as "Todos"), or one of the three bands the counts carry.
 */
export type AgeGroup = '65' | '65-69' | '70-74' | '75';

/**
 * The services of the offer categories: public facilities counted per area and
 * set against its 65+ population. Each is also a point overlay.
 */
export type OfferService =
  | 'ubs'
  | 'hospitais'
  | 'urgencia'
  | 'samu'
  | 'ambulatorios'
  | 'saude-mental'
  | 'dst-aids'
  | 'vigilancia'
  | 'animais'
  | 'restaurantes'
  | 'esporte';

/**
 * The second menu's value: an age band for the share categories, a service for
 * the offer ones.
 */
export type Group = AgeGroup | OfferService;

/** Canonical map data row shape consumed by the app. */
export type MapDataRow = {
  geometryId: number;
  value: number;
  /** District name for tooltip display. */
  name?: string;
  /** Absolute count for the numerator of this rate — people, or facilities for an offer series (tooltip). */
  count?: number;
  /** Absolute population count for the denominator of this rate (tooltip). */
  totalCount?: number;
};

/**
 * Absolute population counts for one area in one projection year — the
 * figures every indicator the map paints is derived from. The area is a
 * district in `MapsDataContract.counts` and a subprefeitura in
 * `MapsDataContract.subprefeituraCounts`; the shape is the same so the same
 * ratios (`components/map/lib/mapRows`) serve both levels.
 *
 * Counts rather than rates: the eight series the app offers are ratios of these
 * four numbers, and the timeline multiplies everything by eleven years.
 * Pre-computing all of them server-side would ship roughly 700 kB of rows to
 * the browser, against 94 kB for the counts, to save 96 divisions per timeline
 * tick. See `components/map/lib/mapRows` for the derivation.
 */
export type DistrictCounts = {
  /** Feature id of the area's polygon in its GeoJSON. */
  geometryId: number;
  /** Area name, for the tooltip. */
  name: string;
  /** Projection year these counts describe. */
  year: number;
  /** Residents aged 65 to 69. */
  count65to69: number;
  /** Residents aged 70 to 74. */
  count70to74: number;
  /** Residents aged 75 or older. */
  count75plus: number;
  /** Residents of every age — the denominator of the `cumulative-total` series. */
  total: number;
  /**
   * Public facilities of each offer service in the area, as mapped
   * today. The same in every year of the series: only the population is
   * projected, which is why the offer indicators are painted for one year.
   */
  services: Record<OfferService, number>;
};

/** Canonical maps data contract consumed by the app. */
export type MapsDataContract = {
  /**
   * Projection years present in `counts`, ascending and evenly spaced. The
   * timeline control derives its `min`, `max` and `step` from this, so the even
   * spacing is an invariant the gateway enforces rather than an observation.
   */
  years: number[];
  thresholds: Record<Category, Partial<Record<Group, number[]>>>;
  /** One entry per district per year. */
  counts: DistrictCounts[];
  /**
   * One entry per subprefeitura per year: the sums of its districts' counts.
   * Summed counts, not averaged rates — a rate is re-derived from these, so a
   * populous district weighs in proportion to its population.
   *
   * Each year is summed into the division in force that year, so a former
   * subprefeitura has entries for its own years only. A year before the
   * division existed (2000) has none.
   */
  subprefeituraCounts: DistrictCounts[];
  /**
   * Every version of every subprefeitura in force at some point of the series,
   * with the districts each one groups and the year it came into force. Pick
   * the ones of a year with {@link versionsInForce}.
   */
  subprefeituras: Subprefeitura[];
};

/**
 * One version of a subprefeitura and the districts it groups, for the map's
 * tooltip. A subprefeitura whose territory changed has one version per shape,
 * all under the same id: Vila Prudente is Vila Prudente-Sapopemba from 2002
 * and Vila Prudente alone from 2013.
 */
export type Subprefeitura = {
  /** Feature id of its polygon in `public/subprefeituras.geojson`. */
  geometryId: number;
  /**
   * The version's own key, `id@validFrom` (see {@link versionKey}) — what the
   * map filters the polygons by, since the versions of one id share it.
   */
  versionKey: string;
  name: string;
  /** Names of the districts it groups, alphabetically. */
  districtNames: string[];
  /** The year this version came into force. */
  validFrom: number;
};

/**
 * The key of one version of a versioned area: its id and the year it came
 * into force. `scripts/generateSubprefeituras.ts` writes the same key into the
 * GeoJSON, which is what lets the map filter the polygons by it.
 *
 * @param area - The area's id and first year.
 * @returns `id@validFrom`.
 *
 * @example
 * versionKey({ id: 18, validFrom: 2002 }); // '18@2002'
 */
export const versionKey = (area: { id: number; validFrom: number }): string => {
  return `${area.id}@${area.validFrom}`;
};

/**
 * The versions of a versioned area set in force in a year — for each id, the
 * one that came into force last, no later than that year. A version ends only
 * when the next version of its id begins, so the areas carry a first year and
 * nothing else. The one rule for it: the map filters polygons by it and the
 * gateway sums counts by it, so the two cannot disagree on a year.
 *
 * @param params.areas - Every version, current and former.
 * @param params.year - The year asked about.
 * @param params.idOf - The id the versions of one area share.
 * @returns One version per id in force; none for a year before any began.
 *
 * @example
 * versionsInForce({ areas, year: 2010, idOf: (sub) => sub.id });
 * // [..., { id: 18, nome: 'Vila Prudente-Sapopemba', validFrom: 2002 }, ...]
 */
export const versionsInForce = <T extends { validFrom: number }>({
  areas,
  year,
  idOf,
}: {
  areas: readonly T[];
  year: number;
  idOf: (area: T) => number;
}): T[] => {
  const latest = new Map<number, T>();

  for (const area of areas) {
    if (area.validFrom > year) continue;
    const current = latest.get(idOf(area));
    if (!current || area.validFrom > current.validFrom) {
      latest.set(idOf(area), area);
    }
  }

  return [...latest.values()];
};
