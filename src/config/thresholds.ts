import type { Category, Group } from '@/data-gateway/schema';

/**
 * Choropleth class breaks, one set per indicator series.
 *
 * Six breaks per series, which is seven classes — the length of the palette in
 * `components/map/lib/mapConfig`. Values are in the unit the map paints: a
 * fraction for the population shares (`0.15` is 15%), facilities per 10
 * thousand residents aged 65+ for the offer series.
 *
 * Two properties are deliberate:
 *
 * - **Fixed across years.** The timeline animates 2000 to 2050 over the same
 *   breaks, so a colour means the same share in every year and the animation
 *   reads as change in the territory rather than change in the scale. Fitting
 *   breaks per year (Jenks, say) would give each year a prettier map and make
 *   the series meaningless to compare.
 * - **Per series, not global.** Each set spans its own indicator's full-period
 *   range, because the ranges are not comparable: the 65+ share of the total
 *   population runs 1.9%-42.4% over the period, while the 70+ share *of the
 *   elderly population* never leaves 51.3%-78.1%. One shared set leaves most of
 *   the palette unused on most series.
 *
 * These replace the IMAGE:NYC breaks the map previously used for every series
 * (`[0.1, 0.2, 0.4, 0.6, 0.7, 0.8]`), which were calibrated for New York: on
 * São Paulo's districts they left the three top classes unreachable, and in
 * 2000 the whole city fell into two of the seven colours.
 *
 * Classification stays in the app layer, never read from the data source.
 *
 * Consumed by:
 *  - `data-gateway/transformers/toAppMapsData` — injects into `MapsDataContract`
 *  - `app/(features)/mapas/_components/MapsView` — legend breaks and tooltip swatch
 */
export const SERIES_THRESHOLDS: Record<
  Category,
  Partial<Record<Group, number[]>>
> = {
  /** Share of the district's whole population. */
  'cumulative-total': {
    /** 65+ over total. Observed 1.9%-42.4%; 5-point classes. */
    '65': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
    /** 70+ over total. Observed 1.0%-31.3%; shares the 65+ scale, so switching between them shows the smaller share as a lighter map. */
    '70': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
    /** 75+ over total. Observed 0.5%-20.9%; 2.5-point classes, since the 5-point scale would spend four classes on values it never reaches. */
    '75': [0.025, 0.05, 0.075, 0.1, 0.125, 0.15],
  },
  /** Cumulative share of the district's own 65+ population. */
  'cumulative-65plus': {
    /** 70+ over 65+. Observed 51.3%-78.1% — this share never approaches zero, so the scale starts at 50%. */
    '70': [0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
    /** 75+ over 65+. Observed 24.0%-55.7%; 5-point classes. */
    '75': [0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  },
  /** One closed five-year band as a share of the district's 65+ population. */
  '5year-65plus': {
    /** 65-69 over 65+. Observed 21.9%-48.7%; 5-point classes. */
    '65-69': [0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
    /** 70-74 over 65+. Observed 20.7%-31.2% — the narrowest series in the app, so 2-point classes; anything wider paints it a single colour. */
    '70-74': [0.2, 0.22, 0.24, 0.26, 0.28, 0.3],
    /**
     * 75+ over 65+. Identical to `cumulative-65plus/75` — the open top band is
     * both the last closed band and a cumulative one, so the two menu paths
     * compute the same series and must classify it the same way.
     */
    '75': [0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  },
  /**
   * The offer categories (health, food, leisure): public facilities per 10
   * thousand residents aged 65+ (2025), not a share.
   *
   * The first break is a hair above zero, so the lightest class holds exactly
   * the areas with none of the service — a real finding here, not an artefact:
   * 41 of the 96 districts have no hospital in the layer and 52 no public
   * restaurant. The legend names that class "nenhum". The rest follow each
   * service's observed spread across districts.
   */
  'health-65plus': {
    /** UBS. Districts 0–31.5 (median 3.0); subprefeituras 0.8–14.2. */
    ubs: [0.001, 1, 2, 3, 5, 8],
    /** Hospitals. Districts 0–4.3 (median 0.55); subprefeituras 0–1.2. */
    hospitais: [0.001, 0.25, 0.5, 1, 1.5, 2.5],
  },
  'food-65plus': {
    /** Public restaurants. Districts 0–8.2 (median 0); subprefeituras 0–1.6. */
    restaurantes: [0.001, 0.25, 0.5, 1, 2, 4],
  },
  'leisure-65plus': {
    /** Public sports venues. Districts 0–12.0 (median 1.8); subprefeituras 0.8–4.8. */
    esporte: [0.001, 1, 2, 3, 5, 8],
  },
};

/**
 * Class breaks for one indicator series.
 *
 * @param params.category - The indicator category.
 * @param params.group - The age group within that category.
 * @returns The series' six breaks, in the series' own unit.
 * @throws If the pair is not a series the app defines, which would otherwise
 * paint a legend and a fill against different scales.
 *
 * @example
 * thresholdsFor({ category: 'cumulative-total', group: '65' });
 * // [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
 */
export const thresholdsFor = ({
  category,
  group,
}: {
  category: Category;
  group: Group;
}): number[] => {
  const thresholds = SERIES_THRESHOLDS[category][group];

  if (!thresholds) {
    throw new Error(
      `[thresholds] no breaks defined for ${category}/${group}; the legend and the fill would disagree`
    );
  }

  return thresholds;
};
