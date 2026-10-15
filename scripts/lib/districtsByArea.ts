/**
 * Assigns the project's districts to the areas of a coarser division by
 * geometry, for a division no GeoSampa layer tags the districts with: each
 * official district polygon goes to the area holding the largest share of it.
 */
import { readFileSync } from 'node:fs';

import { measure, polygonsOf, shareIn } from './areaOverlap.ts';
import { fetchOfficialDistricts } from './officialDistricts.ts';
import type { PolygonGeometry } from './simplifyGeometry.ts';

/**
 * The least share of a district the area it is assigned to must hold. A
 * division that follows district lines leaves only drawing differences along
 * its borders (the health supervisions' smallest share is about 97%, Bom
 * Retiro); anything under this means a district really is split, and summing
 * it into one area would misplace part of its population.
 */
const MIN_DISTRICT_SHARE = 0.95;

/** The official districts, with the `geometry_id` the project knows them by. */
export type ProjectDistrict = {
  geometryId: number;
  name: string;
  shape: ReturnType<typeof measure>;
};

/**
 * Downloads the official districts and measures them for {@link assignDistricts}.
 *
 * @param mapsDataPath - The project's district snapshot, read for each
 * district's name and `geometry_id`.
 * @returns The 96 districts, at full GeoSampa detail.
 */
export const loadDistricts = async (
  mapsDataPath: string
): Promise<ProjectDistrict[]> => {
  const snapshot = JSON.parse(readFileSync(mapsDataPath, 'utf8')) as {
    districts: { geometry_id: number; nome: string }[];
  };
  const geometryIdOf = new Map(
    snapshot.districts.map((district) => {
      return [district.nome, district.geometry_id] as const;
    })
  );

  return (await fetchOfficialDistricts(mapsDataPath)).map((district) => {
    return {
      geometryId: geometryIdOf.get(district.name) as number,
      name: district.name,
      shape: measure(district.polygons),
    };
  });
};

/**
 * Assigns every project district to the area holding the largest share of its
 * official polygon.
 *
 * @param params.districts - The official districts.
 * @param params.areas - The areas, each with an id.
 * @param params.what - What the areas are, for the error messages.
 * @returns `district geometry_id → area id`, for every district.
 * @throws If a district's largest share is under {@link MIN_DISTRICT_SHARE}.
 */
export const assignDistricts = ({
  districts,
  areas,
  what,
}: {
  districts: ProjectDistrict[];
  areas: { id: number; geometry: PolygonGeometry }[];
  what: string;
}): Map<number, number> => {
  const measured = areas.map((area) => {
    return { area, shape: measure(polygonsOf(area.geometry)) };
  });
  const assigned = new Map<number, number>();

  for (const district of districts) {
    const [best] = measured
      .map(({ area, shape }) => {
        return { area, share: shareIn({ part: district.shape, whole: shape }) };
      })
      .sort((a, b) => {
        return b.share - a.share;
      });

    if (!best || best.share < MIN_DISTRICT_SHARE) {
      throw new Error(
        `[districtsByArea] ${district.name} has at most ${((best?.share ?? 0) * 100).toFixed(1)}% of its area in one ${what}; a split district cannot be summed into one`
      );
    }

    assigned.set(district.geometryId, best.area.id);
  }

  return assigned;
};

/** The districts assigned to one area, ascending. */
export const districtsOf = (
  assigned: Map<number, number>,
  id: number
): number[] => {
  return [...assigned]
    .filter(([, areaId]) => {
      return areaId === id;
    })
    .map(([geometryId]) => {
      return geometryId;
    })
    .sort((a, b) => {
      return a - b;
    });
};
