import { ageFor, ageOptionsFor } from '@/components/map/lib/ageOptions';
import { ICONS } from '@/components/map/lib/icons';
import type { AgeGroup, Category } from '@/components/map/lib/indicators';
import {
  MAP_LEVEL_IDS,
  MAP_LEVELS,
  type MapLevel,
} from '@/components/map/lib/mapLevels';

/** Menu id of the "Faixa etária" chips, in the selection record. */
export const AGE_MENU_ID = 'age';

/** Menu id of the "Recorte" chips, in the selection record. */
export const LEVEL_MENU_ID = 'level';

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
 * Icon per level in the "Recorte" chips: many small areas for the districts, a
 * few large ones for the subprefeituras, and their own pair for the health
 * divisions, so the two kinds of grouping read apart.
 */
const LEVEL_ICONS: Record<MapLevel, string> = {
  distrito: ICONS.squaresFour,
  subprefeitura: ICONS.polygon,
  'supervisao-saude': ICONS.hexagon,
  'coordenadoria-saude': ICONS.shapes,
};

/**
 * Geographic level options, one per {@link MapLevel}. The subprefeitura label
 * carries the count in force in the year painted, as the districts' carries its
 * fixed 96 — 31 until 2012, 32 since — and none before the division existed.
 *
 * @param subprefeituraCount - Subprefeituras in force in the year painted.
 * @returns The "Recorte" chips' options.
 *
 * @example
 * levelOptions(31)[1]?.label; // 'Subprefeituras (31)'
 * levelOptions(0)[1]?.label; // 'Subprefeituras'
 */
export const levelOptions = (
  subprefeituraCount: number
): { value: MapLevel; label: string; icon: string }[] => {
  return MAP_LEVEL_IDS.map((level) => {
    const counted = level === 'subprefeitura' && subprefeituraCount > 0;
    return {
      value: level,
      label: counted
        ? `${MAP_LEVELS[level].label} (${subprefeituraCount})`
        : MAP_LEVELS[level].label,
      icon: LEVEL_ICONS[level],
    };
  });
};

/**
 * The "Recorte" block, first in the "Filtros" tab because it frames the rest:
 * it decides which areas are painted. Chips like the ages', a required single
 * choice; one column, since the level labels are too long to share a row.
 *
 * @param params.level - The selected level, the chips' default.
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
    title: 'Recorte',
    icon: ICONS.mapTrifold,
    control: {
      kind: 'chips' as const,
      menuId: LEVEL_MENU_ID,
      options: levelOptions(subprefeituraCount).map((option) => {
        return { id: option.value, label: option.label, icon: option.icon };
      }),
      multiple: false,
      required: true,
      defaultSelected: [level],
      layout: { kind: 'grid' as const, columns: 1 },
    },
  };
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
