import { COLOR_RAMPS } from '@/components/map/lib/colorRamps';
import type {
  AgeGroup,
  Category,
  OfferService,
} from '@/components/map/lib/indicators';
import { isMapLevel } from '@/components/map/lib/mapLevels';
import {
  AGE_OPTIONS,
  ageFor,
  CUMULATIVE_AGE_OPTIONS,
  DEFAULT_AGE,
  getDefaultService,
} from '@/components/map/lib/workspaceConfig';
import { isOfferCategory, OFFER_CATEGORIES } from '@/config/offer';
import { isOverlayId, OVERLAY_IDS, type OverlayId } from '@/config/overlays';

import type { Selection } from './mapSelection';

/*
 * The map's selection and its switched-on layers, in the address bar, so a map
 * can be shared as a link and open on what the sender was looking at.
 *
 * Pure: `useMapUrlState` reads the address once, on mount, and writes it back
 * on every change. The parameters are named the way the sidebar names things to
 * a reader — a link is something people read, and sometimes edit — and a
 * setting at its default is left out, so an untouched map has a clean address.
 */

/** Each indicator's name in a link. */
const CATEGORY_SLUGS: Record<Category, string> = {
  'cumulative-total': 'taxa-cumulativa',
  'cumulative-65plus': 'proporcao-cumulativa',
  '5year-65plus': 'faixa',
  'health-65plus': 'saude',
  'food-65plus': 'alimentacao',
  'leisure-65plus': 'lazer',
};

/** "Todos" reads better in a link than the `65` it stands for. */
const AGE_SLUGS: Partial<Record<AgeGroup, string>> = { '65': 'todos' };

const OPACITY_RANGE = { min: 30, max: 100 };

/** The parameters this map owns; any other one in the address is left alone. */
const PARAMS = [
  'recorte',
  'indicador',
  'servico',
  'idade',
  'ano',
  'cores',
  'opacidade',
  'camadas',
] as const;

/** What a link carries: a selection, and the layers switched on. */
export type MapUrlState = {
  selection: Selection;
  overlays: OverlayId[];
};

const categoryFrom = (slug: string | null): Category | undefined => {
  return (Object.keys(CATEGORY_SLUGS) as Category[]).find((category) => {
    return CATEGORY_SLUGS[category] === slug;
  });
};

const ageFrom = (slug: string | null): AgeGroup | undefined => {
  const asked = slug === AGE_SLUGS['65'] ? '65' : slug;
  return [...AGE_OPTIONS, ...CUMULATIVE_AGE_OPTIONS].find((option) => {
    return option.value === asked;
  })?.value;
};

const levelFrom = (value: string | null): Selection['level'] | undefined => {
  const asked = value ?? undefined;
  return isMapLevel(asked) ? asked : undefined;
};

/** The service asked for under an offer indicator, or its first one. */
const groupFrom = (
  category: Category,
  slug: string | null
): OfferService | undefined => {
  if (!isOfferCategory(category)) return undefined;
  return (
    OFFER_CATEGORIES[category].find((service) => {
      return service === slug;
    }) ?? getDefaultService(category)
  );
};

const yearFrom = (value: string | null, years: number[]) => {
  const asked = Number(value);
  return years.includes(asked) ? asked : undefined;
};

/** Only a shipped ramp: the reader's own live in their browser alone. */
const isShippedRamp = (id: string | null) => {
  return COLOR_RAMPS.some((ramp) => {
    return ramp.id === id;
  });
};

const rampFrom = (id: string | null) => {
  return id !== null && isShippedRamp(id) ? id : undefined;
};

const opacityFrom = (value: string | null): string | undefined => {
  const asked = Number(value);
  return value !== null &&
    Number.isInteger(asked) &&
    asked >= OPACITY_RANGE.min &&
    asked <= OPACITY_RANGE.max
    ? String(asked)
    : undefined;
};

const overlaysFrom = (value: string | null): OverlayId[] => {
  const asked = new Set((value ?? '').split(','));
  // In registry order, whatever order the link lists them in.
  return OVERLAY_IDS.filter((id) => {
    return asked.has(id) && isOverlayId(id);
  });
};

/**
 * The state a query string asks for, over the map's defaults.
 *
 * Every value is validated, and an invalid one falls back to its default rather
 * than being carried: a link written by hand, or saved before something was
 * renamed, opens on the defaults instead of on nothing. What is left goes
 * through the sidebar's own rules — a service only under an offer indicator
 * (its category's first one otherwise), an age the indicator lists, a year the
 * snapshot carries — so a link can never open on a combination the sidebar
 * could not have produced.
 *
 * @param params.search - `window.location.search`, with or without its `?`.
 * @param params.defaults - The selection the map opens on without a link.
 * @param params.years - The projection years the snapshot carries.
 * @returns The selection and the layers to open on.
 *
 * @example
 * mapUrlStateFromSearch({ search: '?indicador=faixa&idade=75', defaults, years });
 * // { selection: { ...defaults, category: '5year-65plus', age: '75' }, overlays: [] }
 */
export const mapUrlStateFromSearch = ({
  search,
  defaults,
  years,
}: {
  search: string;
  defaults: Selection;
  years: number[];
}): MapUrlState => {
  const params = new URLSearchParams(search);

  const category = categoryFrom(params.get('indicador')) ?? defaults.category;

  const selection: Selection = {
    level: levelFrom(params.get('recorte')) ?? defaults.level,
    category,
    group: groupFrom(category, params.get('servico')) ?? defaults.group,
    year: yearFrom(params.get('ano'), years) ?? defaults.year,
    age: ageFor({
      category,
      age: ageFrom(params.get('idade')) ?? defaults.age,
    }),
    ramp: rampFrom(params.get('cores')) ?? defaults.ramp,
    opacity: opacityFrom(params.get('opacidade')) ?? defaults.opacity,
  };

  return { selection, overlays: overlaysFrom(params.get('camadas')) };
};

/** A value for the address, or `null` when it is the default and left out. */
const unlessDefault = (
  value: string | number,
  fallback: string | number
): string | null => {
  return value === fallback ? null : String(value);
};

/**
 * The query parameters for a state: only the settings away from their
 * defaults, and only the ones that mean something for the indicator painted —
 * no service under a share indicator, no year under an offer one (they paint a
 * fixed year). A ramp the reader built is left out too: it lives in the
 * sender's browser alone, so the link opens on the default ramp instead.
 *
 * @param params.state - The selection and the layers switched on.
 * @param params.defaults - The selection the map opens on without a link.
 * @returns The parameters, in a fixed order; empty for an untouched map.
 *
 * @example
 * mapUrlParams({ state: { selection: { ...defaults, age: '75' }, overlays: ['ubs'] }, defaults });
 * // [['idade', '75'], ['camadas', 'ubs']]
 */
export const mapUrlParams = ({
  state: { selection, overlays },
  defaults,
}: {
  state: MapUrlState;
  defaults: Selection;
}): [string, string][] => {
  const offer = isOfferCategory(selection.category);
  // The first age the indicator lists, which is where a link without one lands.
  const defaultAge = ageFor({ category: selection.category, age: DEFAULT_AGE });

  const entries: [string, string | null][] = [
    ['recorte', unlessDefault(selection.level, defaults.level)],
    [
      'indicador',
      unlessDefault(
        CATEGORY_SLUGS[selection.category],
        CATEGORY_SLUGS[defaults.category]
      ),
    ],
    ['servico', offer ? selection.group : null],
    [
      'idade',
      unlessDefault(
        AGE_SLUGS[selection.age] ?? selection.age,
        AGE_SLUGS[defaultAge] ?? defaultAge
      ),
    ],
    ['ano', offer ? null : unlessDefault(selection.year, defaults.year)],
    [
      'cores',
      isShippedRamp(selection.ramp)
        ? unlessDefault(selection.ramp, defaults.ramp)
        : null,
    ],
    ['opacidade', unlessDefault(selection.opacity, defaults.opacity)],
    ['camadas', overlays.length > 0 ? overlays.join(',') : null],
  ];

  return entries.filter((entry): entry is [string, string] => {
    return entry[1] !== null;
  });
};

/**
 * The address for a state: the current one with this map's parameters
 * replaced, and anything else in it — other parameters, the hash — kept.
 *
 * @param params.href - The current address.
 * @param params.state - The selection and the layers switched on.
 * @param params.defaults - The selection the map opens on without a link.
 * @returns The new address, relative (path, query and hash).
 *
 * @example
 * mapUrlFor({ href: 'https://x/mapas', state, defaults }); // '/mapas?idade=75'
 */
export const mapUrlFor = ({
  href,
  state,
  defaults,
}: {
  href: string;
  state: MapUrlState;
  defaults: Selection;
}): string => {
  const url = new URL(href);
  for (const param of PARAMS) {
    url.searchParams.delete(param);
  }
  for (const [param, value] of mapUrlParams({ state, defaults })) {
    url.searchParams.set(param, value);
  }
  // Commas separate the layers; kept readable rather than escaped as %2C.
  const query = url.searchParams.toString().replace(/%2C/g, ',');
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
};
