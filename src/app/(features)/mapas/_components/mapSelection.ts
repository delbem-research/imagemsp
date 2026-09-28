import type {
  AgeGroup,
  Category,
  Group,
} from '@/components/map/lib/indicators';
import { isMapLevel, type MapLevel } from '@/components/map/lib/mapLevels';
import {
  AGE_MENU_ID,
  CATEGORY_MENU_ID,
  getDefaultGroup,
  GROUP_MENU_ID,
  LEVEL_MENU_ID,
  OFFER_AGE_OPTIONS,
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
 * What the sidebar selects: level, indicator, band or service, year, and the
 * offer indicators' age group — the population their rate is set against,
 * picked in a menu of its own since their `group` is the service.
 */
export type Selection = {
  level: MapLevel;
  category: Category;
  group: Group;
  year: number;
  age: AgeGroup;
};

/** Whether a reported value is one of the offer indicators' age groups. */
const isOfferAge = (value: string | undefined): value is AgeGroup => {
  return OFFER_AGE_OPTIONS.some((option) => {
    return option.value === value;
  });
};

/**
 * The selection after the sidebar reports its menus' values.
 *
 * The level, the year and the offer age group are axes of their own: switching
 * any of them never resets the rest — the age group is kept across offer
 * indicators, which all list the same ages. A new category resets the group to the category's first option,
 * since the groups available depend on it (cascading behaviour) — but not the
 * year, which would otherwise undo the user's place in the animation on every
 * menu click.
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
  const group =
    category === prev.category
      ? ((next[GROUP_MENU_ID] ?? prev.group) as Group)
      : getDefaultGroup(category);

  const reportedAge = next[AGE_MENU_ID];
  const age = isOfferAge(reportedAge) ? reportedAge : prev.age;

  return { level, category, group, year, age };
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
