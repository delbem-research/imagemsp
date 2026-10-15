import type {
  StaticHealthDivisionsDataSource,
  StaticMapsDataSource,
} from '@/data-source-static/types';

/**
 * A health division with one CRS and one STS grouping every district of a
 * fixture, for the tests about something else: the contract needs both levels,
 * and they must match the districts one to one.
 *
 * @param source - The fixture's district snapshot.
 * @returns The division, its one STS inside its one CRS.
 */
export const oneHealthDivision = (
  source: StaticMapsDataSource
): StaticHealthDivisionsDataSource => {
  const distritos = [
    ...new Set(
      source.districts.map((district) => {
        return district.geometry_id;
      })
    ),
  ].sort((a, b) => {
    return a - b;
  });

  return {
    coordenadorias: [{ id: 1, nome: 'CRS Única', distritos }],
    supervisoes: [{ id: 1, nome: 'STS Única', coordenadoria: 1, distritos }],
  };
};
