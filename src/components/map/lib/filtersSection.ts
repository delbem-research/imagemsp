import { ageFor, ageOptionsFor } from '@/components/map/lib/ageOptions';
import { ICONS } from '@/components/map/lib/icons';
import type { AgeGroup, Category } from '@/components/map/lib/indicators';

/** Menu id of the "Faixa etária" chips, in the selection record. */
export const AGE_MENU_ID = 'age';

/**
 * The tab's section id, which is also its label: with no section declaring
 * `header.title`, geovis-workspace names each tab by its id (see the section ids
 * in `workspaceConfig`).
 */
const FILTERS_SECTION_ID = 'Filtros';

/**
 * Icon per age group. The distinction that matters is open vs closed: `65`
 * ("Todos") and `75` are "X anos ou mais", while `65-69`/`70-74` are bounded
 * on both sides.
 */
export const AGE_ICONS: Record<AgeGroup, string> = {
  '65': ICONS.plusCircle,
  '70': ICONS.plusCircle,
  '75': ICONS.plusCircle,
  '65-69': ICONS.arrowsInLineHorizontal,
  '70-74': ICONS.arrowsInLineHorizontal,
};

/**
 * The "Faixa etária" block every indicator shows, in the "Filtros" tab: one
 * list of ages everywhere (see `AGE_OPTIONS`), minus "Todos" for the share of
 * the 65+, where it would read 100% (see `ageOptionsFor`).
 *
 * Chips rather than a variations list: the ages are short labels read at a
 * glance, and a two-column grid shows all four without the scroll a list
 * costs. `multiple: false` with `required` makes them a required single
 * choice — exactly one age is always painted — and `menuId` publishes the
 * chosen id under `AGE_MENU_ID` as the list did, so `MapsView` reads it
 * unchanged. With a `menuId` the chips also follow the selection, so the age
 * `ageFor` fits to a new indicator shows as active.
 *
 * @param params.category - The indicator, which decides the options.
 * @param params.age - The selected age group, the chips' default.
 * @returns The block for the filters tab's `filters` body.
 */
const buildAgeBlock = ({
  category,
  age,
}: {
  category: Category;
  age: AgeGroup;
}) => {
  return {
    id: AGE_MENU_ID,
    title: 'Faixa etária',
    icon: ICONS.usersThree,
    control: {
      kind: 'chips' as const,
      menuId: AGE_MENU_ID,
      options: ageOptionsFor(category).map((option) => {
        return {
          id: option.value,
          label: option.label,
          icon: AGE_ICONS[option.value],
        };
      }),
      multiple: false,
      required: true,
      defaultSelected: [ageFor({ category, age })],
      layout: { kind: 'grid' as const, columns: 2 },
    },
  };
};

/**
 * The "Filtros" tab, beside the variations one: the filters that narrow what
 * the chosen indicator counts, apart from the menus that pick the indicator.
 * Today that is the age band alone.
 *
 * @param params.category - The indicator, which decides the age options.
 * @param params.age - The selected age group.
 * @returns The section for `leftSidebar.sections`.
 */
export const buildFiltersSection = ({
  category,
  age,
}: {
  category: Category;
  age: AgeGroup;
}) => {
  return {
    id: FILTERS_SECTION_ID,
    header: { icon: ICONS.funnel },
    body: {
      kind: 'filters' as const,
      blocks: [buildAgeBlock({ category, age })],
    },
  };
};
