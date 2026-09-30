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
 *   population runs 1.9%-42.4% over the period, while the 70-74 share of it
 *   never passes 11.1%. One shared set leaves most of the palette unused on
 *   most series.
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
    /** 65-69 over total. Observed 0.8%-13.2% (districts; subprefeituras 1.2%-11.0%); 2-point classes. */
    '65-69': [0.02, 0.04, 0.06, 0.08, 0.1, 0.12],
    /** 70-74 over total. Observed 0.6%-11.1% (districts; subprefeituras 0.7%-10.6%); 1.5-point classes, since 2-point ones would leave the top class empty. */
    '70-74': [0.015, 0.03, 0.045, 0.06, 0.075, 0.09],
    /** 75+ over total. Observed 0.5%-20.9%; 2.5-point classes, since the 5-point scale would spend four classes on values it never reaches. */
    '75': [0.025, 0.05, 0.075, 0.1, 0.125, 0.15],
  },
  /** "X or older" as a share of the district's own 65+ population. */
  'cumulative-65plus': {
    /** 70+ over 65+. Observed 51.3%-78.1% — this share never approaches zero, so the scale starts at 50%. */
    '70': [0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
    /**
     * 75+ over 65+. The same series as `5year-65plus/75` — the open top band is
     * both the last band and a cumulative one — so it classifies the same way.
     */
    '75': [0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
  },
  /** One age band as a share of the district's 65+ population. */
  '5year-65plus': {
    /** 65-69 over 65+. Observed 21.9%-48.7%; 5-point classes. */
    '65-69': [0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
    /** 70-74 over 65+. Observed 20.7%-31.2% — the narrowest series in the app, so 2-point classes; anything wider paints it a single colour. */
    '70-74': [0.2, 0.22, 0.24, 0.26, 0.28, 0.3],
    /** 75+ over 65+. Observed 24.0%-55.7%; 5-point classes. */
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
    /** Urgência/emergência. Districts 0–4.1 (median 0); subprefeituras 0–1.5. */
    urgencia: [0.001, 0.25, 0.5, 0.75, 1, 1.5],
    /** SAMU bases. Districts 0–10.5 (median 0.51); subprefeituras 0.13–1.5. */
    samu: [0.001, 0.25, 0.5, 0.75, 1, 1.5],
    /** Specialised outpatient clinics. Districts 0–12.4 (median 0.71); subprefeituras 0.22–2.8. */
    ambulatorios: [0.001, 0.5, 1, 1.5, 2, 3],
    /** Mental health. Districts 0–4.2 (median 0.72); subprefeituras 0.35–2.1. */
    'saude-mental': [0.001, 0.5, 1, 1.5, 2, 3],
    /** DST/AIDS units. Districts 0–4.1 (median 0); subprefeituras 0–0.5. */
    'dst-aids': [0.001, 0.2, 0.4, 0.6, 0.8, 1.5],
    /** Health surveillance. Districts 0–8.2 (median 0); subprefeituras 0–0.96. */
    vigilancia: [0.001, 0.2, 0.4, 0.6, 0.8, 1.5],
    /**
     * Animal care. Only 4 facilities, so 92 of the 96 districts sit in the
     * "nenhum" class. Districts 0–1.4; subprefeituras 0–0.35.
     */
    animais: [0.001, 0.1, 0.2, 0.3, 0.5, 1],
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

/**
 * Rounds a break to two significant digits, so a scaled legend reads `0,83`
 * rather than `0,8264`.
 */
const roundBreak = (value: number): number => {
  return Number(value.toPrecision(2));
};

/**
 * An offer series' breaks for a narrower population than the 65+ they are
 * calibrated for: every break divided by that population's share of the 65+,
 * since the rate is divided by it too. Without this, filtering to 75+ (about a
 * third of the 65+) would triple every rate and push the map into the darkest
 * classes.
 *
 * The first break is kept as is: it sits a hair above zero so the lightest
 * class holds only the areas without the service, whatever the population.
 *
 * @param params.thresholds - The series' 65+ breaks.
 * @param params.share - The selected bands' share of the 65+, in (0, 1].
 * @returns The scaled breaks, rounded to two significant digits.
 *
 * @example
 * scaleOfferThresholds({ thresholds: [0.001, 1, 2, 3, 5, 8], share: 0.5 });
 * // [0.001, 2, 4, 6, 10, 16]
 */
export const scaleOfferThresholds = ({
  thresholds,
  share,
}: {
  thresholds: number[];
  share: number;
}): number[] => {
  if (share >= 1) return thresholds;
  return thresholds.map((value, index) => {
    return index === 0 ? value : roundBreak(value / share);
  });
};
