import type {
  AgeGroup,
  Category,
  OfferCategory,
  OfferService,
} from '@/data-gateway/schema';

/**
 * The offer indicators: public facilities per 10 thousand residents aged 65 or
 * older, per area, in three categories — health, food and leisure.
 *
 * The facilities are GeoSampa's current mapping, but the population is a
 * projection, so pairing them across the timeline would read as "the network
 * of 2026 against the city of 2050" without saying so. The indicators are
 * therefore painted for one year only, and the timeline is disabled while one
 * is selected (see `buildWorkspaceConfig`).
 */

/** The year every offer indicator is painted for. */
export const OFFER_YEAR = 2025;

/** The population base of the rates: facilities per this many 65+ residents. */
export const OFFER_RATE_BASE = 10_000;

/** The services of each offer category, in menu order. */
export const OFFER_CATEGORIES: Record<OfferCategory, readonly OfferService[]> =
  {
    'health-65plus': [
      'ubs',
      'hospitais',
      'urgencia',
      'samu',
      'ambulatorios',
      'saude-mental',
      'dst-aids',
      'vigilancia',
      'animais',
    ],
    'food-65plus': ['restaurantes'],
    'leisure-65plus': ['esporte'],
  };

/** The offer categories, in menu order. */
export const OFFER_CATEGORY_IDS = Object.keys(
  OFFER_CATEGORIES
) as OfferCategory[];

/** Every service, across the categories. */
export const OFFER_SERVICES: readonly OfferService[] =
  OFFER_CATEGORY_IDS.flatMap((category) => {
    return OFFER_CATEGORIES[category];
  });

/**
 * Whether a category paints an offer indicator rather than a population share.
 *
 * @param category - The category.
 * @returns `true` for health, food and leisure.
 *
 * @example
 * isOfferCategory('food-65plus'); // true
 * isOfferCategory('cumulative-total'); // false
 */
export const isOfferCategory = (
  category: Category
): category is OfferCategory => {
  return category in OFFER_CATEGORIES;
};

/**
 * How each service is named: in the menu, in the legend title (upper case like
 * the title itself), and in the tooltip, singular and plural.
 */
export const OFFER_LABELS: Record<
  OfferService,
  { menu: string; title: string; one: string; many: string }
> = {
  ubs: {
    menu: 'Unidades Básicas de Saúde (UBS)',
    title: 'UBS',
    one: 'UBS',
    many: 'UBS',
  },
  hospitais: {
    menu: 'Hospitais',
    title: 'HOSPITAIS',
    one: 'hospital',
    many: 'hospitais',
  },
  urgencia: {
    menu: 'Urgência/emergência',
    title: 'UNIDADES DE URGÊNCIA/EMERGÊNCIA',
    one: 'unidade de urgência/emergência',
    many: 'unidades de urgência/emergência',
  },
  samu: {
    menu: 'Bases do SAMU',
    title: 'BASES DO SAMU',
    one: 'base do SAMU',
    many: 'bases do SAMU',
  },
  ambulatorios: {
    menu: 'Ambulatórios especializados',
    title: 'AMBULATÓRIOS ESPECIALIZADOS',
    one: 'ambulatório especializado',
    many: 'ambulatórios especializados',
  },
  'saude-mental': {
    menu: 'Saúde mental',
    title: 'UNIDADES DE SAÚDE MENTAL',
    one: 'unidade de saúde mental',
    many: 'unidades de saúde mental',
  },
  'dst-aids': {
    menu: 'Unidades DST/AIDS',
    title: 'UNIDADES DST/AIDS',
    one: 'unidade DST/AIDS',
    many: 'unidades DST/AIDS',
  },
  vigilancia: {
    menu: 'Vigilância em saúde',
    title: 'UNIDADES DE VIGILÂNCIA EM SAÚDE',
    one: 'unidade de vigilância em saúde',
    many: 'unidades de vigilância em saúde',
  },
  animais: {
    menu: 'Hospitais veterinários',
    title: 'HOSPITAIS VETERINÁRIOS',
    one: 'hospital veterinário',
    many: 'hospitais veterinários',
  },
  restaurantes: {
    menu: 'Restaurantes públicos',
    title: 'RESTAURANTES PÚBLICOS',
    one: 'restaurante público',
    many: 'restaurantes públicos',
  },
  esporte: {
    menu: 'Locais de esporte públicos',
    title: 'LOCAIS DE ESPORTE PÚBLICOS',
    one: 'local de esporte público',
    many: 'locais de esporte públicos',
  },
};

/**
 * The age bands an offer rate can be set against, youngest first — the three
 * closed or open bands the counts carry. The rate's denominator is the sum of
 * the bands the sidebar's age group stands for; all three is the 65+
 * population.
 */
export const OFFER_AGE_BANDS = ['65-69', '70-74', '75'] as const;

export type OfferAgeBand = (typeof OFFER_AGE_BANDS)[number];

/**
 * Each band's ages, for the phrases below: its first age, and its last — none
 * for the open top band.
 */
const BAND_AGES: Record<OfferAgeBand, { from: number; to: number | null }> = {
  '65-69': { from: 65, to: 69 },
  '70-74': { from: 70, to: 74 },
  '75': { from: 75, to: null },
};

/**
 * The bands each age-group option stands for, read by the offer indicators as
 * the population the rate is set against: `65` ("Todos") is every band, and
 * each other option its own band.
 */
const OFFER_AGE_GROUP_BANDS: Record<AgeGroup, readonly OfferAgeBand[]> = {
  '65': OFFER_AGE_BANDS,
  '65-69': ['65-69'],
  '70-74': ['70-74'],
  // Listed by the cumulative share only, never by an offer indicator.
  '70': ['70-74', '75'],
  '75': ['75'],
};

/**
 * The bands an offer rate is set against, for the age group picked in the
 * sidebar.
 *
 * @param age - The age-group option.
 * @returns The bands, youngest first.
 *
 * @example
 * offerAgeBands('65'); // ['65-69', '70-74', '75']
 */
export const offerAgeBands = (age: AgeGroup): readonly OfferAgeBand[] => {
  return OFFER_AGE_GROUP_BANDS[age];
};

/**
 * The bands as runs of consecutive ones, each an age range: 65–69 and 70–74
 * together are 65 to 74, not two ranges.
 */
const ageRuns = (
  bands: readonly OfferAgeBand[]
): { from: number; to: number | null }[] => {
  const runs: { from: number; to: number | null }[] = [];
  let previous = -2;

  for (const band of bands) {
    const index = OFFER_AGE_BANDS.indexOf(band);
    const last = runs[runs.length - 1];
    if (last && index === previous + 1) {
      last.to = BAND_AGES[band].to;
    } else {
      runs.push({ ...BAND_AGES[band] });
    }
    previous = index;
  }

  return runs;
};

/**
 * The bands in short form, for the legend title and the tooltip.
 *
 * @param bands - The selected bands, youngest first.
 * @returns E.g. `65+`, `70+`, `65–74`, `65–69 e 75+`.
 *
 * @example
 * offerAgesShort(['70-74', '75']); // '70+'
 * offerAgesShort(['65-69', '75']); // '65–69 e 75+'
 */
export const offerAgesShort = (bands: readonly OfferAgeBand[]): string => {
  return ageRuns(bands)
    .map(({ from, to }) => {
      return to === null ? `${from}+` : `${from}–${to}`;
    })
    .join(' e ');
};

/**
 * The bands in long form, for the legend subtitle: "pessoas com …".
 *
 * @param bands - The selected bands, youngest first.
 * @returns E.g. `65 anos ou mais`, `65 a 74 anos`.
 *
 * @example
 * offerAgesLong(['65-69', '70-74', '75']); // '65 anos ou mais'
 * offerAgesLong(['65-69']); // '65 a 69 anos'
 */
export const offerAgesLong = (bands: readonly OfferAgeBand[]): string => {
  return ageRuns(bands)
    .map(({ from, to }) => {
      return to === null ? `${from} anos ou mais` : `${from} a ${to} anos`;
    })
    .join(' e ');
};
