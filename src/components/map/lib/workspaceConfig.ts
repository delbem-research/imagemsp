import type { GeovisWorkspaceConfig } from '@ttoss/geovis-workspace';

import { ICONS } from '@/components/map/lib/icons';
import type { Category, Group } from '@/components/map/lib/indicators';

/** Menu ids used by the GeovisWorkspace left sidebar and selection record. */
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
];

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
};

export const MAP_DESCRIPTIONS: Record<
  Category,
  Partial<Record<Group, string>>
> = {
  'cumulative-total': {
    '65': 'Proporção da população total do distrito com 65 anos ou mais.',
    '70': 'Proporção da população total do distrito com 70 anos ou mais.',
    '75': 'Proporção da população total do distrito com 75 anos ou mais.',
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
 * Two tabs. The first holds both variation menus as blocks — indicator and age
 * band are read together, and the cascade between them is driven by React state
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
  category,
  group,
  years,
  defaultYear,
  elderlyHistogram,
  sidebarInitiallyOpen,
}: {
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
           * Both menus in one tab, as `variations` controls inside a `filters`
           * body (geovis-workspace 0.12). They are read together — the age band
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
                title: 'Faixa etária',
                icon: ICONS.usersThree,
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
