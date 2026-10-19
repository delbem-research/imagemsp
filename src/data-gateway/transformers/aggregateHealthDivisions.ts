import type { StaticHealthDivisionsDataSource } from '../../data-source-static/types';
import type { AreaMembers, DistrictCounts } from '../schema';
import { addCounts, emptyCounts } from './countSums';

/** A CRS or STS as the static snapshot carries it. */
type Division = StaticHealthDivisionsDataSource['coordenadorias'][number];

/**
 * Maps each district to the one area grouping it.
 *
 * @param params.districtNames - `geometryId → name` of every district with
 * counts.
 * @param params.areas - The CRS or the STS.
 * @param params.what - What the areas are, for the error messages.
 * @returns `district geometryId → area`.
 * @throws Unless every district belongs to exactly one area and every district
 * an area names has counts — a district left out would drop its population
 * from the totals without any visible sign, and one counted twice would
 * inflate two.
 */
const matchDistricts = ({
  districtNames,
  areas,
  what,
}: {
  districtNames: Map<number, string>;
  areas: Division[];
  what: string;
}): Map<number, Division> => {
  const areaByDistrict = new Map<number, Division>();

  for (const area of areas) {
    for (const districtId of area.distritos) {
      if (!districtNames.has(districtId)) {
        throw new Error(
          `[data-gateway] a ${what} groups district ${districtId}, which has no counts`
        );
      }
      if (areaByDistrict.has(districtId)) {
        throw new Error(
          `[data-gateway] district ${districtId} belongs to more than one ${what}`
        );
      }
      areaByDistrict.set(districtId, area);
    }
  }

  for (const [districtId, name] of districtNames) {
    if (!areaByDistrict.has(districtId)) {
      throw new Error(
        `[data-gateway] district ${districtId} (${name}) belongs to no ${what}; its population would be left out`
      );
    }
  }

  return areaByDistrict;
};

/**
 * Sums district counts into one health division's areas, every year into
 * today's division (GeoSampa keeps no history of it).
 *
 * Counts are summed and nothing is averaged, as for the subprefeituras: the
 * map re-derives every rate from these sums, so each district weighs by its
 * population.
 *
 * @param params.counts - District counts for every year.
 * @param params.areas - The CRS or the STS.
 * @param params.what - What the areas are, for the error messages.
 * @returns The areas' counts, by year then id, and the tooltip's district
 * lists.
 * @throws If districts and areas do not match one to one (see
 * {@link matchDistricts}).
 */
const aggregateDivision = ({
  counts,
  areas,
  what,
}: {
  counts: DistrictCounts[];
  areas: Division[];
  what: string;
}): { counts: DistrictCounts[]; members: AreaMembers[] } => {
  const districtNames = new Map(
    counts.map((entry) => {
      return [entry.geometryId, entry.name] as const;
    })
  );
  const areaByDistrict = matchDistricts({ districtNames, areas, what });
  const sums = new Map<string, DistrictCounts>();

  for (const entry of counts) {
    const area = areaByDistrict.get(entry.geometryId) as Division;
    const key = `${entry.year}|${area.id}`;
    const sum =
      sums.get(key) ??
      emptyCounts({ geometryId: area.id, name: area.nome, year: entry.year });

    addCounts(sum, entry);
    sums.set(key, sum);
  }

  return {
    counts: [...sums.values()].sort((a, b) => {
      return a.year - b.year || a.geometryId - b.geometryId;
    }),
    members: areas.map((area) => {
      return {
        geometryId: area.id,
        name: area.nome,
        districtNames: area.distritos
          .map((districtId) => {
            return districtNames.get(districtId) ?? '';
          })
          .sort((a, b) => {
            return a.localeCompare(b, 'pt-BR');
          }),
      };
    }),
  };
};

/**
 * Sums district counts into the health supervisions (STS) and coordinations
 * (CRS), the two health levels of the map.
 *
 * @param params.counts - District counts for every year.
 * @param params.divisions - The CRS and STS and the districts each groups.
 * @returns The contract's STS and CRS counts and district lists.
 * @throws If either division does not match the districts one to one.
 *
 * @example
 * aggregateHealthDivisions({ counts, divisions });
 * // { supervisaoCounts: [...], coordenadoriaCounts: [...], supervisoes: [...], coordenadorias: [...] }
 */
export const aggregateHealthDivisions = ({
  counts,
  divisions,
}: {
  counts: DistrictCounts[];
  divisions: StaticHealthDivisionsDataSource;
}) => {
  const supervisoes = aggregateDivision({
    counts,
    areas: divisions.supervisoes,
    what: 'health supervision',
  });
  const coordenadorias = aggregateDivision({
    counts,
    areas: divisions.coordenadorias,
    what: 'health coordination',
  });

  return {
    supervisaoCounts: supervisoes.counts,
    coordenadoriaCounts: coordenadorias.counts,
    supervisoes: supervisoes.members,
    coordenadorias: coordenadorias.members,
  };
};
