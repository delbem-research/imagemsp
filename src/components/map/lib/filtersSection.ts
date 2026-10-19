import { ageFor, ageOptionsFor } from '@/components/map/lib/ageOptions';
import { ICONS } from '@/components/map/lib/icons';
import type { AgeGroup, Category } from '@/components/map/lib/indicators';
import {
  MAP_LEVEL_IDS,
  MAP_LEVELS,
  type MapLevel,
} from '@/components/map/lib/mapLevels';

/** Menu id of the "Faixa etária" choice, in the selection record. */
export const AGE_MENU_ID = 'age';

/** Menu id of the "Recortes" choice, in the selection record. */
export const LEVEL_MENU_ID = 'level';

/**
 * The tab's section id, which is also its label: with no section declaring
 * `header.title`, geovis-workspace names each tab by its id (see the section ids
 * in `workspaceConfig`).
 */
const FILTERS_SECTION_ID = 'Filtros';

/**
 * Geographic level options, one per {@link MapLevel}: the level's name, what
 * the division is under it, and how many areas it has on the right. The
 * subprefeituras' count is the one in force in the year painted — 31 until
 * 2012, 32 since — and none before the division existed.
 *
 * @param subprefeituraCount - Subprefeituras in force in the year painted.
 * @returns The "Recortes" options.
 *
 * @example
 * levelOptions(31)[1]?.count; // 31
 * levelOptions(0)[1]?.count; // undefined
 */
export const levelOptions = (
  subprefeituraCount: number
): {
  value: MapLevel;
  label: string;
  sublabel: string;
  count?: number;
}[] => {
  return MAP_LEVEL_IDS.map((level) => {
    const { label, description, count } = MAP_LEVELS[level];
    const inForce =
      level === 'subprefeitura' && subprefeituraCount > 0
        ? subprefeituraCount
        : count;
    return {
      value: level,
      label,
      sublabel: description,
      ...(inForce === undefined ? {} : { count: inForce }),
    };
  });
};

/**
 * The "Recortes" block, first in the "Filtros" tab because it frames the rest:
 * it decides which areas are painted. A `choice` — exactly one level always
 * painted — laid out as a list, each row with what the division is and how
 * many areas it has.
 *
 * @param params.level - The selected level, the choice's default.
 * @param params.subprefeituraCount - See {@link levelOptions}.
 * @returns The block for the filters tab's `filters` body.
 */
const buildLevelBlock = ({
  level,
  subprefeituraCount,
}: {
  level: MapLevel;
  subprefeituraCount: number;
}) => {
  return {
    id: LEVEL_MENU_ID,
    title: 'Recortes',
    icon: ICONS.mapTrifold,
    collapsible: true,
    control: {
      kind: 'choice' as const,
      menuId: LEVEL_MENU_ID,
      layout: 'list' as const,
      options: levelOptions(subprefeituraCount),
      defaultValue: level,
    },
  };
};

/**
 * The "Faixa etária" block every indicator shows, in the "Filtros" tab: one
 * list of ages everywhere (see `AGE_OPTIONS`), minus "Todos" for the share of
 * the 65+, where it would read 100% (see `ageOptionsFor`).
 *
 * A `choice` in a two-column grid: the ages are short labels read at a glance,
 * and the grid shows all four without the scroll a list costs. Exactly one age
 * is always painted, and `menuId` publishes the chosen one under `AGE_MENU_ID`,
 * so `MapsView` reads it unchanged. The choice follows the selection, so the
 * age `ageFor` fits to a new indicator shows as chosen.
 *
 * @param params.category - The indicator, which decides the options.
 * @param params.age - The selected age group, the choice's default.
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
    collapsible: true,
    control: {
      kind: 'choice' as const,
      menuId: AGE_MENU_ID,
      layout: { kind: 'grid' as const, columns: 2 },
      options: ageOptionsFor(category).map((option) => {
        return { value: option.value, label: option.label };
      }),
      defaultValue: ageFor({ category, age }),
    },
  };
};

/**
 * The "Filtros" tab, beside the variations one: the filters that narrow where
 * and whom the chosen indicator counts, apart from the menus that pick the
 * indicator — the geographic level and the age band.
 *
 * @param params.level - The selected geographic level.
 * @param params.subprefeituraCount - See {@link levelOptions}.
 * @param params.category - The indicator, which decides the age options.
 * @param params.age - The selected age group.
 * @returns The section for `leftSidebar.sections`.
 */
export const buildFiltersSection = ({
  level,
  subprefeituraCount,
  category,
  age,
}: {
  level: MapLevel;
  subprefeituraCount: number;
  category: Category;
  age: AgeGroup;
}) => {
  return {
    id: FILTERS_SECTION_ID,
    header: { icon: ICONS.funnel },
    body: {
      kind: 'filters' as const,
      blocks: [
        buildLevelBlock({ level, subprefeituraCount }),
        buildAgeBlock({ category, age }),
      ],
    },
  };
};
