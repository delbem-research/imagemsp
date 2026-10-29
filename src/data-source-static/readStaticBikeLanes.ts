import type { StaticBikeLanesDataSource } from './types';

const isPosition = (value: unknown): boolean => {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => {
      return Number.isFinite(coordinate);
    })
  );
};

/** A line of at least two positions. */
const isLine = (value: unknown): boolean => {
  return Array.isArray(value) && value.length >= 2 && value.every(isPosition);
};

const isLineGeometry = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const geometry = value as Record<string, unknown>;
  const coordinates = geometry['coordinates'];

  if (geometry['type'] === 'LineString') {
    return isLine(coordinates);
  }

  return (
    geometry['type'] === 'MultiLineString' &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(isLine)
  );
};

const isBikeLaneData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    Number.isInteger(row['id']) &&
    typeof row['nome'] === 'string' &&
    typeof row['tipo'] === 'string' &&
    isLineGeometry(row['geometry'])
  );
};

/**
 * Returns true when `value` matches the expected `StaticBikeLanesDataSource`
 * shape: a `ciclovias` array where every element satisfies
 * {@link isBikeLaneData}.
 */
const isStaticBikeLanesDataSource = (
  value: unknown
): value is StaticBikeLanesDataSource => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)['ciclovias'])
  ) {
    return false;
  }
  return ((value as Record<string, unknown>)['ciclovias'] as unknown[]).every(
    isBikeLaneData
  );
};

/**
 * Reads and validates the static cycle network snapshot.
 *
 * Imported on demand, like the other overlay snapshots: the network is
 * requested only when its toggle is turned on, so the module stays out of
 * every other request.
 *
 * @returns The raw source record from `data/lines/ciclovias.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { ciclovias } = await readStaticBikeLanes();
 * // [{ id: 1, nome: 'CICLORROTA BROOKLIN', tipo: 'Ciclorrota', ... }, ...]
 */
export const readStaticBikeLanes =
  async (): Promise<StaticBikeLanesDataSource> => {
    const parsed: unknown = (await import('./data/lines/ciclovias.json'))
      .default;

    if (!isStaticBikeLanesDataSource(parsed)) {
      throw new Error(
        '[data-source-static] lines/ciclovias.json has an unexpected shape'
      );
    }

    return parsed;
  };
