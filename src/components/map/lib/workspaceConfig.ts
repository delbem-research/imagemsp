import type { GeovisWorkspaceConfig } from '@ttoss/geovis-workspace';

import { ICONS } from '@/components/map/lib/icons';
import type {
  Category,
  Group,
  OfferCategory,
  OfferService,
} from '@/components/map/lib/indicators';
import {
  MAP_LEVEL_IDS,
  MAP_LEVELS,
  type MapLevel,
} from '@/components/map/lib/mapLevels';
import {
  isOfferCategory,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_IDS,
  OFFER_LABELS,
  OFFER_YEAR,
} from '@/config/offer';

/** Menu ids used by the GeovisWorkspace left sidebar and selection record. */
export const LEVEL_MENU_ID = 'level';
export const CATEGORY_MENU_ID = 'category';
export const GROUP_MENU_ID = 'group';
export const YEAR_MENU_ID = 'year';

/**
 * Section ids, which double as the tab labels here.
 *
 * These carry display text on purpose. With no section declaring
 * `header.title` the sidebar draws no header band, and geovis-workspace then
 * labels each tab with `header.title ?? section.id` — for its hover tooltip and
 * for its accessible name alike. The id is the only lever left: declaring a
 * title to name one tab would bring the band back for every section. Keep them
 * human-readable, and keep them out of the selection record — a section id is
 * not a `menuId`, so nothing downstream parses these strings.
 */
const VARIATIONS_SECTION_ID = 'Variações';
const TIMELINE_SECTION_ID = 'Linha do tempo';

const CATEGORY_OPTIONS: { value: Category; label: string; icon: string }[] = [
  {
    value: 'cumulative-total',
    label: 'taxa cumulativa (% do total)',
    // A slice of the whole population.
    icon: ICONS.chartPieSlice,
  },
  {
    value: 'cumulative-65plus',
    label: 'proporção cumulativa (% da pop 65+)',
    // A proportion measured inside a subset, not the whole.
    icon: ICONS.chartDonut,
  },
  {
    value: '5year-65plus',
    label: 'faixa (% da pop 65+)',
    // A closed band rather than a cumulative total.
    icon: ICONS.chartBar,
  },
  // Facilities rather than people, one category per kind of service.
  {
    value: 'health-65plus',
    label: 'serviços de saúde (por 10 mil idosos)',
    icon: ICONS.heartbeat,
  },
  {
    value: 'food-65plus',
    label: 'serviços de alimentação (por 10 mil idosos)',
    icon: ICONS.forkKnife,
  },
  {
    value: 'leisure-65plus',
    label: 'serviços de lazer (por 10 mil idosos)',
    icon: ICONS.soccerBall,
  },
];

/**
 * The categories painted along the timeline — every one but the offer
 * indicators, which are fixed to {@link OFFER_YEAR}. The timeline tab is
 * enabled for these only.
 */
const TIMELINE_CATEGORIES: Category[] = CATEGORY_OPTIONS.map((option) => {
  return option.value;
}).filter((category) => {
  return !isOfferCategory(category);
});

/**
 * Builds a per-offer-category table from one value per category.
 *
 * @param value - The value for one category.
 * @returns The value for every offer category.
 */
const byOfferCategory = <T>(
  value: (category: OfferCategory) => T
): Record<OfferCategory, T> => {
  return Object.fromEntries(
    OFFER_CATEGORY_IDS.map((category) => {
      return [category, value(category)];
    })
  ) as Record<OfferCategory, T>;
};

/**
 * One entry per service of an offer category, e.g. its menu label or title.
 *
 * @param category - The offer category.
 * @param value - The entry for one service.
 * @returns `service → entry` for the category's services.
 */
const byService = <T>(
  category: OfferCategory,
  value: (service: OfferService) => T
): Partial<Record<Group, T>> => {
  return Object.fromEntries(
    OFFER_CATEGORIES[category].map((service) => {
      return [service, value(service)];
    })
  );
};

/** Geographic level options, one per {@link MapLevel}. */
const LEVEL_OPTIONS: { value: MapLevel; label: string; icon: string }[] =
  MAP_LEVEL_IDS.map((level) => {
    return {
      value: level,
      label: MAP_LEVELS[level].label,
      // Many small areas vs a few large ones.
      icon: level === 'distrito' ? ICONS.squaresFour : ICONS.polygon,
    };
  });

/** Age-group options available for each category (cascading menu). */
export const GROUP_OPTIONS: Record<
  Category,
  { value: Group; label: string }[]
> = {
  'cumulative-total': [
    { value: '65', label: '65 anos ou mais' },
    { value: '70', label: '70 anos ou mais' },
    { value: '75', label: '75 anos ou mais' },
  ],
  'cumulative-65plus': [
    { value: '70', label: '70 anos ou mais' },
    { value: '75', label: '75 anos ou mais' },
  ],
  '5year-65plus': [
    { value: '65-69', label: '65 a 69 anos' },
    { value: '70-74', label: '70 a 74 anos' },
    { value: '75', label: '75 anos ou mais' },
  ],
  ...byOfferCategory((category) => {
    return OFFER_CATEGORIES[category].map((service) => {
      return { value: service, label: OFFER_LABELS[service].menu };
    });
  }),
};

/**
 * Icon per age group. The distinction that matters is cumulative vs closed
 * band: `65`/`70`/`75` mean "X anos ou mais" (open-ended, rendered as `65+`
 * in the tooltip), while `65-69`/`70-74` are bounded on both sides.
 */
const GROUP_ICONS: Record<Group, string> = {
  '65': ICONS.plusCircle,
  '70': ICONS.plusCircle,
  '75': ICONS.plusCircle,
  '65-69': ICONS.arrowsInLineHorizontal,
  '70-74': ICONS.arrowsInLineHorizontal,
  ubs: ICONS.firstAidKit,
  hospitais: ICONS.firstAid,
  restaurantes: ICONS.forkKnife,
  esporte: ICONS.soccerBall,
};

/**
 * Title of an offer indicator in the legend, upper case like the others.
 *
 * @param service - The offer service.
 * @returns E.g. `UBS POR 10 MIL IDOSOS (65+)`.
 */
const offerTitle = (service: OfferService): string => {
  return `${OFFER_LABELS[service].title} POR 10 MIL IDOSOS (65+)`;
};

/**
 * Legend subtitle of an offer indicator. Says outright that the facilities are
 * today's and the population is the projection for {@link OFFER_YEAR}, so the
 * rate is not read as a forecast of the network.
 *
 * @param service - The offer service.
 * @returns The subtitle, with the `{area}` placeholder `mapDescription` fills.
 */
const offerDescription = (service: OfferService): string => {
  const base = `${OFFER_LABELS[service].menu} {area} para cada 10 mil pessoas com 65 anos ou mais — rede atual mapeada pelo GeoSampa sobre a população projetada para ${OFFER_YEAR}.`;

  // The hospital layer is not the city's full universe (see the catalogue's
  // `hospitais_geosampa_incomplete_coverage`); a rate built on it undercounts.
  return service === 'hospitais'
    ? `${base} Só a rede pública e conveniada: hospitais privados não entram.`
    : base;
};

export const MAP_TITLES: Record<Category, Partial<Record<Group, string>>> = {
  'cumulative-total': {
    '65': 'POPULAÇÃO 65+ COMO % DA POPULAÇÃO TOTAL',
    '70': 'POPULAÇÃO 70+ COMO % DA POPULAÇÃO TOTAL',
    '75': 'POPULAÇÃO 75+ COMO % DA POPULAÇÃO TOTAL',
  },
  'cumulative-65plus': {
    '70': '70+ COMO % DA POPULAÇÃO 65+',
    '75': '75+ COMO % DA POPULAÇÃO 65+',
  },
  '5year-65plus': {
    '65-69': '65–69 ANOS COMO % DA POPULAÇÃO 65+',
    '70-74': '70–74 ANOS COMO % DA POPULAÇÃO 65+',
    '75': '75+ COMO % DA POPULAÇÃO 65+',
  },
  ...byOfferCategory((category) => {
    return byService(category, offerTitle);
  }),
};

export const MAP_DESCRIPTIONS: Record<
  Category,
  Partial<Record<Group, string>>
> = {
  'cumulative-total': {
    '65': 'Proporção da população total {area} com 65 anos ou mais.',
    '70': 'Proporção da população total {area} com 70 anos ou mais.',
    '75': 'Proporção da população total {area} com 75 anos ou mais.',
  },
  'cumulative-65plus': {
    '70': 'Proporção da população 65+ que tem 70 anos ou mais.',
    '75': 'Proporção da população 65+ que tem 75 anos ou mais.',
  },
  '5year-65plus': {
    '65-69': 'Parcela da população 65+ na faixa de 65 a 69 anos.',
    '70-74': 'Parcela da população 65+ na faixa de 70 a 74 anos.',
    '75': 'Parcela da população 65+ com 75 anos ou mais.',
  },
  ...byOfferCategory((category) => {
    return byService(category, offerDescription);
  }),
};

/**
 * The legend subtitle for one series at one level. Descriptions that name the
 * area carry an `{area}` placeholder, filled with the level's own wording.
 *
 * @param params.category - The indicator category.
 * @param params.group - The age group within that category.
 * @param params.level - The geographic level painted.
 * @returns The subtitle, or `''` for a series with no description.
 *
 * @example
 * mapDescription({ category: 'cumulative-total', group: '65', level: 'subprefeitura' });
 * // 'Proporção da população total da subprefeitura com 65 anos ou mais.'
 */
export const mapDescription = ({
  category,
  group,
  level,
}: {
  category: Category;
  group: Group;
  level: MapLevel;
}): string => {
  const template =
    (MAP_DESCRIPTIONS[category] as Partial<Record<string, string>>)[group] ??
    '';

  return template.replace('{area}', MAP_LEVELS[level].ofArea);
};

/** Resolves the default age-group for a category (its first option). */
export const getDefaultGroup = (category: Category): Group => {
  return GROUP_OPTIONS[category][0].value;
};

/**
 * The projection-year timeline, as its own sidebar section.
 *
 * A tab of its own (a `filters` body) as the workspace recommends: it is the
 * only control with playback, and it publishes `variables[YEAR_MENU_ID]` on
 * every auto-advance tick as well as on the steppers.
 *
 * @param params.years - Projection years available, ascending and evenly
 * spaced; drives the timeline's `min`, `max` and `step`.
 * @param params.defaultYear - Year the timeline starts on.
 * @param params.elderlyHistogram - Total 65+ population per year, drawn as the
 * timeline's mini bars.
 * @returns The `Timeline` section for `leftSidebar.sections`.
 *
 * @example
 * buildYearSection({ years: [2000, 2005], defaultYear: 2000, elderlyHistogram: [] });
 */
const buildYearSection = ({
  years,
  defaultYear,
  elderlyHistogram,
}: {
  years: number[];
  defaultYear: number;
  elderlyHistogram: { key: number; count: number }[];
}) => {
  return {
    // The section's own id, distinct from the timeline's `menuId` below: this
    // one labels the tab, while `YEAR_MENU_ID` is the selection channel
    // `MapsView` reads. They were the same string until the tab needed a name.
    id: TIMELINE_SECTION_ID,
    // The offer indicators are fixed to one year, so the timeline would move
    // nothing on the map. Gating the tab (rather than leaving it live) also
    // makes the workspace halt playback and freeze the year, which resumes
    // where it was once a share indicator is picked again.
    enabledWhen: { menuId: CATEGORY_MENU_ID, values: TIMELINE_CATEGORIES },
    // No `title`: with every section untitled the workspace drops the header
    // band altogether (geovis-workspace 0.13), so the tab bar heads the card.
    // The block below carries its own label.
    header: { icon: ICONS.clock },
    body: {
      kind: 'filters' as const,
      blocks: [
        {
          id: YEAR_MENU_ID,
          title: 'Ano da projeção',
          icon: ICONS.calendarBlank,
          control: {
            kind: 'timeline' as const,
            // Same channel as the variation menus: the value arrives in
            // `variables[YEAR_MENU_ID]` as a stringified number.
            menuId: YEAR_MENU_ID,
            min: years[0] ?? defaultYear,
            max: years[years.length - 1] ?? defaultYear,
            // The series is evenly spaced (the gateway rejects it otherwise),
            // so the gap between the first two years is the gap between all.
            step: (years[1] ?? defaultYear) - (years[0] ?? defaultYear),
            defaultValue: defaultYear,
            histogram: elderlyHistogram,
            unitLabel: 'pessoas 65+',
            // Left false deliberately. The workspace's compact playback HUD
            // only exists below 640px, so closing the sidebar on play would
            // carry the pause button off a desktop screen with nothing to
            // replace it, leaving the animation unstoppable.
            closeOnPlay: false,
          },
        },
      ],
    },
  };
};

/**
 * Builds the GeovisWorkspace config (left sidebar sections) for the current
 * selection. The `group` variations depend on `category`, so the config is
 * rebuilt whenever the selection changes (cascading behaviour). The legend and
 * data sources live on the map itself, configured via the geovis spec (see
 * `buildSpec` in `MapsView.tsx`), so there is no right sidebar.
 *
 * Two tabs. The first holds the variation menus as blocks — geographic level,
 * indicator and age band are read together, and the cascade between them is driven by React state
 * in `MapsView`, not by the sidebar's own navigation. The second is the
 * projection-year timeline, which stays in a tab of its own as the workspace
 * recommends: it is the only control with playback, and it publishes
 * `variables[YEAR_MENU_ID]` on every tick, so it has nothing to gain from
 * sitting beside menus that are picked once.
 *
 * Neither section declares `header.title`, so the sidebar draws no header band
 * and the tab bar takes the top of the card, close button included. Navigation
 * rides on the tab icons, and every block heads itself. What names each tab —
 * on hover and for assistive tech — is its section `id`, which is why those
 * ids read as labels (see their declaration).
 *
 * @param params.level - The selected geographic level.
 * @param params.category - The selected demographic category.
 * @param params.group - The selected age group.
 * @param params.years - Projection years available, ascending and evenly
 * spaced; drives the timeline's `min`, `max` and `step`.
 * @param params.defaultYear - Year the timeline starts on. Only the first value
 * — the workspace seeds its timeline state from this once, and the live year
 * travels through `variables` afterwards, so passing the *current* year here
 * would rebuild this whole config on every playback tick for no effect.
 * @param params.elderlyHistogram - Total 65+ population per year, drawn as the
 * timeline's mini bars.
 * @param params.sidebarInitiallyOpen - Whether the left sidebar starts open.
 * `GeovisWorkspace` reads this only once, when it seeds its own state, so later
 * changes cannot reopen a sidebar the user has closed.
 * @returns A GeovisWorkspaceConfig driving the left sidebar.
 */
export const buildWorkspaceConfig = ({
  level,
  category,
  group,
  years,
  defaultYear,
  elderlyHistogram,
  sidebarInitiallyOpen,
}: {
  level: MapLevel;
  category: Category;
  group: Group;
  years: number[];
  defaultYear: number;
  elderlyHistogram: { key: number; count: number }[];
  sidebarInitiallyOpen: boolean;
}): GeovisWorkspaceConfig => {
  return {
    // The page owns the framing (full-bleed map filling the viewport), so drop
    // the workspace own card border and radius.
    appearance: 'bare',
    // The right sidebar is never configured here, but that alone does not
    // drop it: `hasRightSidebar` is derived from slot CONTENT, not from
    // `config.rightSidebar`. The `metadata` slot auto-fills from
    // `spec.sources` (always non-empty for us) and `inspector` fills on any
    // map click, so the open-sidebar button would show regardless. Declaring
    // the slots hidden is the only way out — hidden always wins over content.
    slots: {
      legend: { hidden: true },
      warnings: { hidden: true },
      inspector: { hidden: true },
      metadata: { hidden: true },
    },
    leftSidebar: {
      /*
       * This is the ONLY way to decide whether the sidebar starts open:
       * `GeovisWorkspace` owns that state itself (`useState` seeded from this
       * field) and takes no prop for it — `isLeftSidebarOpen` belongs to
       * `GeovisWorkspaceProvider`, which is a different, lower-level export.
       *
       * Being read once, at seed time, is what makes it safe to derive from the
       * viewport: the value stops mattering after the first mount, so widening
       * the window never reopens a sidebar the user has closed.
       */
      initialState: sidebarInitiallyOpen ? 'open' : 'closed',
      sections: [
        {
          id: VARIATIONS_SECTION_ID,
          header: { icon: ICONS.layoutList },
          /*
           * All three menus in one tab, as `variations` controls inside a
           * `filters` body (geovis-workspace 0.12). They are read together — the age band
           * only means something against a chosen indicator — and as separate
           * `variations` bodies each would claim a tab of its own, so crossing
           * from one to the other cost a tab switch.
           *
           * The blocks carry fixed headers: geovis-workspace 0.13 stopped
           * collapsing filter blocks unless they declare `collapsible`, and
           * neither opts in — both lists stay open, so the age band sits below
           * the indicator list rather than behind a chevron.
           */
          body: {
            kind: 'filters',
            blocks: [
              {
                // First, because it frames the rest: it decides which areas
                // are painted, before the indicator decides what they show.
                id: LEVEL_MENU_ID,
                title: 'Recorte',
                icon: ICONS.mapTrifold,
                control: {
                  kind: 'variations',
                  menuId: LEVEL_MENU_ID,
                  variations: LEVEL_OPTIONS,
                  defaultValue: level,
                },
              },
              {
                id: CATEGORY_MENU_ID,
                title: 'Indicador',
                icon: ICONS.gauge,
                control: {
                  kind: 'variations',
                  // `menuId` is the key this control writes into `variables`, so
                  // it must stay in sync with the selection record in `MapsView`.
                  menuId: CATEGORY_MENU_ID,
                  variations: CATEGORY_OPTIONS,
                  defaultValue: category,
                },
              },
              {
                id: GROUP_MENU_ID,
                // The second menu lists age bands, or services for the offer
                // indicator; its heading follows.
                title: isOfferCategory(category) ? 'Serviço' : 'Faixa etária',
                icon: isOfferCategory(category)
                  ? ICONS.storefront
                  : ICONS.usersThree,
                control: {
                  kind: 'variations',
                  menuId: GROUP_MENU_ID,
                  // Cascading: the options depend on the active category, so
                  // this list is rebuilt whenever it changes (see the note on
                  // this builder).
                  variations: GROUP_OPTIONS[category].map((option) => {
                    return { ...option, icon: GROUP_ICONS[option.value] };
                  }),
                  defaultValue: group,
                },
              },
            ],
          },
        },
        buildYearSection({ years, defaultYear, elderlyHistogram }),
      ],
    },
  };
};
