import type { StaticParksDataSource } from './types';

const isPolygonGeometry = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const geometry = value as Record<string, unknown>;

  return (
    (geometry['type'] === 'Polygon' || geometry['type'] === 'MultiPolygon') &&
    Array.isArray(geometry['coordinates']) &&
    geometry['coordinates'].length > 0
  );
};

const isParkData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    Number.isInteger(row['id']) &&
    typeof row['nome'] === 'string' &&
    typeof row['categoria'] === 'string' &&
    typeof row['cadparc'] === 'string' &&
    isPolygonGeometry(row['geometry'])
  );
};

/**
 * Returns true when `value` matches the expected `StaticParksDataSource`
 * shape: a `parques` array where every element satisfies {@link isParkData}.
 */
const isStaticParksDataSource = (
  value: unknown
): value is StaticParksDataSource => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)['parques'])
  ) {
    return false;
  }
  return ((value as Record<string, unknown>)['parques'] as unknown[]).every(
    isParkData
  );
};

/**
 * Reads and validates the static parks snapshot.
 *
 * Imported on demand, like the point snapshots: the parks are requested only
 * when their toggle is turned on, so the module stays out of every other
 * request.
 *
 * @returns The raw source record from `data/polygons/parques.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { parques } = await readStaticParks();
 * // [{ id: 1, nome: 'Ibirapuera', categoria: 'Parque Urbano', ... }, ...]
 */
export const readStaticParks = async (): Promise<StaticParksDataSource> => {
  const parsed: unknown = (await import('./data/polygons/parques.json'))
    .default;

  if (!isStaticParksDataSource(parsed)) {
    throw new Error(
      '[data-source-static] polygons/parques.json has an unexpected shape'
    );
  }

  return parsed;
};
