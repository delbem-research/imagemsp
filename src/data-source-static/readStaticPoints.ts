import type { PointLayerId } from '@/config/pointLayers';

import type { StaticPointsDataSource } from './types';

/**
 * One loader per layer, each a separate dynamic import: a request for the 70
 * public restaurants should not pull the 5 MB bus-stop snapshot into memory.
 */
const SNAPSHOTS: Record<PointLayerId, () => Promise<{ default: unknown }>> = {
  hospitais: () => {
    return import('./data/points/hospitais.json');
  },
  ubs: () => {
    return import('./data/points/ubs.json');
  },
  restaurantes: () => {
    return import('./data/points/restaurantes.json');
  },
  estacoes: () => {
    return import('./data/points/estacoes.json');
  },
  terminais: () => {
    return import('./data/points/terminais.json');
  },
  'pontos-onibus': () => {
    return import('./data/points/pontos-onibus.json');
  },
};

const isPointData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  const atributos = row['atributos'];

  return (
    Number.isFinite(row['id']) &&
    Number.isFinite(row['longitude']) &&
    Number.isFinite(row['latitude']) &&
    typeof row['distrito'] === 'string' &&
    typeof atributos === 'object' &&
    atributos !== null &&
    typeof (atributos as Record<string, unknown>)['nome'] === 'string'
  );
};

/**
 * Returns true when `value` matches the expected `StaticPointsDataSource`
 * shape: a `points` array where every element satisfies {@link isPointData}.
 *
 * @remarks
 * Coordinates are checked to be finite numbers, not just numbers: a `NaN`
 * longitude passes `typeof` and makes MapLibre drop the point without a word.
 */
const isStaticPointsDataSource = (
  value: unknown
): value is StaticPointsDataSource => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)['points'])
  ) {
    return false;
  }
  return ((value as Record<string, unknown>)['points'] as unknown[]).every(
    isPointData
  );
};

/**
 * Reads and validates one point layer's static snapshot.
 *
 * @param layer - The layer to read.
 * @returns The raw source record from `data/points/<layer>.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const ubs = await readStaticPoints('ubs');
 * // { points: [...] }
 */
export const readStaticPoints = async (
  layer: PointLayerId
): Promise<StaticPointsDataSource> => {
  const parsed: unknown = (await SNAPSHOTS[layer]()).default;

  if (!isStaticPointsDataSource(parsed)) {
    throw new Error(
      `[data-source-static] points/${layer}.json has an unexpected shape`
    );
  }

  return parsed;
};
