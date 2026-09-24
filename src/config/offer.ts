import type { OfferService } from '@/data-gateway/schema';

/**
 * The `offer-65plus` indicators: public facilities per 10 thousand residents
 * aged 65 or older, per area.
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

/** The services, in menu order. */
export const OFFER_SERVICES: readonly OfferService[] = [
  'ubs',
  'hospitais',
  'restaurantes',
  'esporte',
];

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
