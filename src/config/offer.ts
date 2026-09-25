import type {
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
    menu: 'Animais (zoonoses e hospitais veterinários)',
    title: 'EQUIPAMENTOS PARA ANIMAIS',
    one: 'equipamento para animais',
    many: 'equipamentos para animais',
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
