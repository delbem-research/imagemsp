import type { TerritoryOverlayId } from '@/config/overlays';

import type { StaticTerritoriesDataSource } from './types';

/**
 * One loader per layer, each a separate dynamic import: a request for the 5
 * coordinations should not pull the half-megabyte UBS catchments into memory.
 */
const SNAPSHOTS: Record<
  TerritoryOverlayId,
  () => Promise<{ default: unknown }>
> = {
  'abrangencia-ubs': () => {
    return import('./data/polygons/abrangencia-ubs.json');
  },
  'saude-familia': () => {
    return import('./data/polygons/saude-familia.json');
  },
};

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

const isTerritoryData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    Number.isInteger(row['id']) &&
    typeof row['nome'] === 'string' &&
    typeof row['detalhe'] === 'string' &&
    isPolygonGeometry(row['geometry'])
  );
};

/**
 * Returns true when `value` matches the expected
 * `StaticTerritoriesDataSource` shape: a `territorios` array where every
 * element satisfies {@link isTerritoryData}.
 */
const isStaticTerritoriesDataSource = (
  value: unknown
): value is StaticTerritoriesDataSource => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)['territorios'])
  ) {
    return false;
  }
  return ((value as Record<string, unknown>)['territorios'] as unknown[]).every(
    isTerritoryData
  );
};

/**
 * Reads and validates one health-territory snapshot.
 *
 * Imported on demand, like the parks: a layer is requested only when its
 * toggle is turned on.
 *
 * @param layer - The territory overlay.
 * @returns The raw source record from `data/polygons/<layer>.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { territorios } = await readStaticTerritories('abrangencia-ubs');
 * // [{ id: 1, nome: 'UBS MARSILAC', detalhe: 'Área de abrangência · STS Parelheiros · CRS Sul', ... }, ...]
 */
export const readStaticTerritories = async (
  layer: TerritoryOverlayId
): Promise<StaticTerritoriesDataSource> => {
  const parsed: unknown = (await SNAPSHOTS[layer]()).default;

  if (!isStaticTerritoriesDataSource(parsed)) {
    throw new Error(
      `[data-source-static] polygons/${layer}.json has an unexpected shape`
    );
  }

  return parsed;
};
