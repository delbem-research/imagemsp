/**
 * The subprefeitura division in force in each year of the timeline.
 *
 * The division changed within the series — created in 2002, Sapopemba split
 * from Vila Prudente in 2013 — so the map does not draw one fixed set of
 * subprefeituras: `public/subprefeituras.geojson` holds every version, and the
 * helpers here pick the ones of the year painted, by the same
 * {@link isInForce} rule the gateway sums the counts with.
 */
import type { LayerFilter } from '@ttoss/geovis';

import { isInForce, type MapsDataContract } from '@/data-gateway/schema';

import type { MapLevel } from './mapLevels';

/**
 * The ids of the subprefeituras in force in a year — what the subprefeitura
 * layer's filter keeps.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.year - The year painted.
 * @returns Their ids; empty for a year before the division existed.
 *
 * @example
 * subprefeituraIdsInForce({ data, year: 2010 }); // [1, 2, …, 31, 33]
 */
export const subprefeituraIdsInForce = ({
  data,
  year,
}: {
  data: MapsDataContract;
  year: number;
}): number[] => {
  return data.subprefeituras
    .filter((sub) => {
      return isInForce(sub, year);
    })
    .map((sub) => {
      return sub.geometryId;
    });
};

/**
 * The first year any subprefeitura was in force — when the division was
 * created.
 */
const divisionStart = (data: MapsDataContract): number => {
  return Math.min(
    ...data.subprefeituras.map((sub) => {
      return sub.validFrom;
    })
  );
};

/**
 * The level the map paints for a selection, and why, when it is not the one
 * selected.
 *
 * Before the subprefeituras were created (2002) there is no division to paint,
 * so a year like 2000 paints the districts instead, and the legend says so.
 * The selection itself is kept: stepping the timeline past 2002 brings the
 * subprefeituras back, just as `MapsView` leaves the timeline's year alone
 * while an offer indicator is painted.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The selected level.
 * @param params.year - The year painted.
 * @returns The level to paint, and the legend note when it differs.
 *
 * @example
 * paintedLevelFor({ data, level: 'subprefeitura', year: 2000 });
 * // { level: 'distrito', note: 'As subprefeituras só foram criadas em 2002: …' }
 */
export const paintedLevelFor = ({
  data,
  level,
  year,
}: {
  data: MapsDataContract;
  level: MapLevel;
  year: number;
}): { level: MapLevel; note?: string } => {
  if (
    level !== 'subprefeitura' ||
    subprefeituraIdsInForce({ data, year }).length > 0
  ) {
    return { level };
  }

  return {
    level: 'distrito',
    note: `As subprefeituras só foram criadas em ${divisionStart(data)}: em ${year}, o mapa mostra os distritos.`,
  };
};

/**
 * The area layer's filter: for the subprefeitura level, the ids in force in the
 * year painted, so a year change swaps the filter and never the geometry. The
 * district level is not versioned and gets none.
 *
 * Filtered by id rather than by `validFrom`/`validTo` directly because a geovis
 * `LayerFilter` compares a single property; the years are resolved here, with
 * the same rule the gateway sums by.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The level painted.
 * @param params.year - The year painted.
 * @returns `{ filter }` to spread into the layer, or `{}`.
 *
 * @example
 * areaLayerFilter({ data, level: 'subprefeitura', year: 2010 });
 * // { filter: { property: 'id', operator: 'in', value: [1, …, 31, 33] } }
 */
export const areaLayerFilter = ({
  data,
  level,
  year,
}: {
  data: MapsDataContract;
  level: MapLevel;
  year: number;
}): { filter?: LayerFilter } => {
  if (level !== 'subprefeitura') {
    return {};
  }

  return {
    filter: {
      property: 'id',
      operator: 'in',
      value: subprefeituraIdsInForce({ data, year }),
    },
  };
};
