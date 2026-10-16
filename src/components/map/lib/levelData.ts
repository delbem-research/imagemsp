import type {
  AreaMembers,
  DistrictCounts,
  MapsDataContract,
} from '@/data-gateway/schema';

import type { MapLevel } from './mapLevels';
import { subprefeiturasInForce } from './subprefeituraDivision';

/*
 * What the maps data holds for each level: the counts it paints, and, for a
 * level that groups districts, which districts each of its areas groups.
 */

/**
 * A level's counts, every year.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The level painted.
 * @returns The districts' own counts, or the sums of an aggregated level.
 *
 * @example
 * countsFor({ data, level: 'supervisao-saude' }); // data.supervisaoCounts
 */
export const countsFor = ({
  data,
  level,
}: {
  data: MapsDataContract;
  level: MapLevel;
}): DistrictCounts[] => {
  const byLevel: Record<MapLevel, DistrictCounts[]> = {
    distrito: data.counts,
    subprefeitura: data.subprefeituraCounts,
    'supervisao-saude': data.supervisaoCounts,
    'coordenadoria-saude': data.coordenadoriaCounts,
  };

  return byLevel[level];
};

/** `geometryId → district names`, the tooltip's lookup. */
const membersMap = (
  areas: Pick<AreaMembers, 'geometryId' | 'districtNames'>[]
): Map<number, string[]> => {
  return new Map(
    areas.map((area) => {
      return [area.geometryId, area.districtNames] as const;
    })
  );
};

/**
 * The districts each area of an aggregated level groups, listed in its
 * tooltip so the reader knows the value is a sum.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The level painted.
 * @param params.year - The year painted: the subprefeituras' districts are
 * those of the version in force that year, since one id can have had several.
 * @returns `geometryId → district names`, or `undefined` for the districts
 * themselves.
 */
export const membersFor = ({
  data,
  level,
  year,
}: {
  data: MapsDataContract;
  level: MapLevel;
  year: number;
}): Map<number, string[]> | undefined => {
  if (level === 'distrito') {
    return undefined;
  }

  const byLevel: Record<Exclude<MapLevel, 'distrito'>, () => AreaMembers[]> = {
    subprefeitura: () => {
      return subprefeiturasInForce({ data, year });
    },
    'supervisao-saude': () => {
      return data.supervisoes;
    },
    'coordenadoria-saude': () => {
      return data.coordenadorias;
    },
  };

  return membersMap(byLevel[level]());
};
