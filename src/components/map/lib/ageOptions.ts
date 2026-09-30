import type { AgeGroup, Category } from '@/components/map/lib/indicators';

/*
 * The age groups the indicators' "Faixa etária" menus list, and how a request
 * is fitted to the indicator painted.
 */

/**
 * The one list of age groups every indicator's "Faixa etária" menu draws from:
 * every elderly resident ("Todos"), or one of the three bands the counts
 * carry. A share indicator reads the group as its numerator, an offer one as
 * the population its rate is set against (see `offerAgeBands`).
 */
export const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: '65', label: 'Todos' },
  { value: '65-69', label: '65 a 69 anos' },
  { value: '70-74', label: '70 a 74 anos' },
  { value: '75', label: '75 anos ou mais' },
];

/**
 * The ages the cumulative share of the 65+ lists: "X or older", the cuts
 * policies are often drawn at. Its own list, since neither is a band of
 * {@link AGE_OPTIONS} — 70+ is 70–74 and 75+ together.
 */
export const CUMULATIVE_AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: '70', label: '70 anos ou mais' },
  { value: '75', label: '75 anos ou mais' },
];

/** The age group the map opens on: every elderly resident. */
export const DEFAULT_AGE: AgeGroup = '65';

/**
 * The age groups an indicator lists: the whole list, except that the share of
 * the 65+ drops "Todos" — the 65+ as a share of itself is 100% everywhere —
 * and the cumulative share lists its own (see {@link CUMULATIVE_AGE_OPTIONS}).
 *
 * @param category - The indicator.
 * @returns Its options, in {@link AGE_OPTIONS} order.
 *
 * @example
 * ageOptionsFor('5year-65plus').map((option) => option.value); // ['65-69', '70-74', '75']
 */
export const ageOptionsFor = (
  category: Category
): { value: AgeGroup; label: string }[] => {
  if (category === 'cumulative-65plus') return CUMULATIVE_AGE_OPTIONS;
  return category === '5year-65plus'
    ? AGE_OPTIONS.filter((option) => {
        return option.value !== '65';
      })
    : AGE_OPTIONS;
};

/**
 * The age group an indicator paints for a requested one: the request when the
 * indicator lists it, otherwise its first option — so entering the share of
 * the 65+ with "Todos" selected lands on 65–69.
 *
 * @param params.category - The indicator.
 * @param params.age - The requested age group.
 * @returns An age group the indicator lists.
 *
 * @example
 * ageFor({ category: '5year-65plus', age: '65' }); // '65-69'
 */
export const ageFor = ({
  category,
  age,
}: {
  category: Category;
  age: AgeGroup;
}): AgeGroup => {
  const options = ageOptionsFor(category);
  return options.some((option) => {
    return option.value === age;
  })
    ? age
    : (options[0]?.value ?? DEFAULT_AGE);
};
