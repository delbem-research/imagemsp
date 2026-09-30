import type {
  AgeGroup,
  Category,
  Group,
} from '@/components/map/lib/indicators';
import { isMapLevel, type MapLevel } from '@/components/map/lib/mapLevels';
import {
  OPACITY_MENU_ID,
  RAMP_MENU_ID,
} from '@/components/map/lib/settingsSection';
import {
  AGE_MENU_ID,
  AGE_OPTIONS,
  ageFor,
  CATEGORY_MENU_ID,
  CUMULATIVE_AGE_OPTIONS,
  getDefaultService,
  GROUP_MENU_ID,
  LEVEL_MENU_ID,
  YEAR_MENU_ID,
} from '@/components/map/lib/workspaceConfig';
import { isOfferCategory, OFFER_YEAR } from '@/config/offer';

/*
 * The map's selection — what the sidebar picks — and how it moves: the year it
 * opens on, how the sidebar's reports update it, and the year it paints.
 * Pure, so `MapsView` only holds it in state.
 */

/**
 * Projection year the map opens on: the present-day one when the series carries
 * it, otherwise the first year available. Chosen over `years[0]` so the first
 * paint describes the city as it is now rather than as it was in 2000, and the
 * timeline can be played in either direction from there.
 */
const INITIAL_YEAR = 2025;

/**
 * Resolves the year the map opens on from the years the snapshot carries.
 *
 * @param years - Projection years, ascending.
 * @returns {@link INITIAL_YEAR} when present, else the earliest year.
 *
 * @example
 * initialYear([2000, 2025, 2050]); // 2025
 * initialYear([2010, 2020]); // 2010
 */
export const initialYear = (years: number[]): number => {
  return years.includes(INITIAL_YEAR) ? INITIAL_YEAR : (years[0] ?? 0);
};

/**
 * What the sidebar selects: level, indicator, the offer indicators' service
 * (`group`), year, age group, and the choropleth's ramp and opacity (the
 * "Configurações" tab). The age group is every indicator's: the share
 * indicators read it as their numerator, the offer ones as the population
 * their rate is set against (see {@link seriesGroupOf}).
 *
 * `ramp` and `opacity` are kept exactly as their controls publish them. Those
 * controls hold their own value and republish whenever `variables` differs
 * from it, so a normalised echo would make the two correct each other forever.
 */
export type Selection = {
  level: MapLevel;
  category: Category;
  group: Group;
  year: number;
  age: AgeGroup;
  ramp: string;
  opacity: string;
};

/** Whether a reported value is one of the age groups, of either list. */
const isAgeGroup = (value: string | undefined): value is AgeGroup => {
  return [...AGE_OPTIONS, ...CUMULATIVE_AGE_OPTIONS].some((option) => {
    return option.value === value;
  });
};

/**
 * The series a selection paints, as the indicator tables key it: the service
 * for an offer indicator, the age group for a share one.
 *
 * @param selection - The selection.
 * @returns The `group` key of `SERIES_RATIOS`, `MAP_TITLES` and the breaks.
 *
 * @example
 * seriesGroupOf({ ...selection, category: 'cumulative-total', age: '75' }); // '75'
 * seriesGroupOf({ ...selection, category: 'health-65plus', group: 'ubs' }); // 'ubs'
 */
export const seriesGroupOf = (
  selection: Pick<Selection, 'category' | 'group' | 'age'>
): Group => {
  return isOfferCategory(selection.category) ? selection.group : selection.age;
};

/**
 * The selection as the sidebar reads it back — its `variables`, one string per
 * menu id. The inverse of {@link nextSelection}.
 *
 * @param selection - The current selection.
 * @returns The workspace's `variables`.
 *
 * @example
 * selectionVariables(selection)[YEAR_MENU_ID]; // '2025'
 */
export const selectionVariables = (
  selection: Selection
): Record<string, string> => {
  return {
    [LEVEL_MENU_ID]: selection.level,
    [CATEGORY_MENU_ID]: selection.category,
    [GROUP_MENU_ID]: selection.group,
    // The timeline publishes and reads its value as a string.
    [YEAR_MENU_ID]: String(selection.year),
    [AGE_MENU_ID]: selection.age,
    // Echoed exactly as their controls published them (see `Selection`).
    [RAMP_MENU_ID]: selection.ramp,
    [OPACITY_MENU_ID]: selection.opacity,
  };
};

/**
 * The selection after the sidebar reports its menus' values.
 *
 * The level, the year and the age group are axes of their own: switching any
 * of them never resets the rest — the age group is kept across indicators,
 * which all list the same ages, except that the share of the 65+ has no
 * "Todos" and lands on its first band instead (see `ageFor`). A new offer
 * category resets the service to its first one, since the services depend on
 * it (cascading behaviour) — but not the year, which would otherwise undo the
 * user's place in the animation on every menu click.
 *
 * @param params.prev - The current selection.
 * @param params.next - The sidebar's values, keyed by menu id. The timeline
 * reports its year as a string on every tick; one the snapshot does not carry
 * is dropped rather than painted, since no area has rows for it and the map
 * would go blank.
 * @param params.years - Projection years the snapshot carries.
 * @returns The next selection.
 *
 * @example
 * nextSelection({ prev, next: { category: 'health-65plus' }, years });
 * // { ...prev, category: 'health-65plus', group: 'ubs' }
 */
export const nextSelection = ({
  prev,
  next,
  years,
}: {
  prev: Selection;
  next: Record<string, string | undefined>;
  years: number[];
}): Selection => {
  const reportedYear = Number(next[YEAR_MENU_ID]);
  const year = years.includes(reportedYear) ? reportedYear : prev.year;

  const reportedLevel = next[LEVEL_MENU_ID];
  const level = isMapLevel(reportedLevel) ? reportedLevel : prev.level;

  const category = (next[CATEGORY_MENU_ID] ?? prev.category) as Category;
  const group = !isOfferCategory(category)
    ? prev.group
    : category === prev.category
      ? ((next[GROUP_MENU_ID] ?? prev.group) as Group)
      : getDefaultService(category);

  const reportedAge = next[AGE_MENU_ID];
  const age = ageFor({
    category,
    age: isAgeGroup(reportedAge) ? reportedAge : prev.age,
  });

  const ramp = next[RAMP_MENU_ID] ?? prev.ramp;
  const opacity = next[OPACITY_MENU_ID] ?? prev.opacity;

  return { level, category, group, year, age, ramp, opacity };
};

/**
 * The year the map paints for a selection.
 *
 * The offer indicators pair today's facilities with one projection year, so
 * they paint {@link OFFER_YEAR} whatever the timeline holds — or the opening
 * year, should a snapshot lack it. The timeline's own year is not touched: its
 * tab is disabled meanwhile, and picking a share indicator again resumes it
 * where it was.
 *
 * @param params.category - The selected category.
 * @param params.year - The timeline's year.
 * @param params.years - Projection years the snapshot carries.
 * @returns The year to paint.
 *
 * @example
 * paintedYearFor({ category: 'food-65plus', year: 2050, years }); // 2025
 */
export const paintedYearFor = ({
  category,
  year,
  years,
}: {
  category: Category;
  year: number;
  years: number[];
}): number => {
  if (!isOfferCategory(category)) {
    return year;
  }

  return years.includes(OFFER_YEAR) ? OFFER_YEAR : initialYear(years);
};
