import healthDivisionsData from './data/health-divisions.json';
import type { StaticHealthDivisionsDataSource } from './types';

/** Whether a district list is non-empty and all whole-number ids. */
const isDistrictList = (distritos: unknown): boolean => {
  return (
    Array.isArray(distritos) &&
    distritos.length > 0 &&
    distritos.every((id) => {
      return Number.isInteger(id);
    })
  );
};

const isHealthDivisionData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    Number.isInteger(row['id']) &&
    typeof row['nome'] === 'string' &&
    isDistrictList(row['distritos'])
  );
};

const isSupervisionData = (value: unknown): boolean => {
  return (
    isHealthDivisionData(value) &&
    Number.isInteger((value as Record<string, unknown>)['coordenadoria'])
  );
};

/** Whether `rows` is an array whose every element passes `isRow`. */
const isArrayOf = (
  rows: unknown,
  isRow: (value: unknown) => boolean
): boolean => {
  return Array.isArray(rows) && rows.every(isRow);
};

/**
 * Returns true when `value` matches the expected
 * `StaticHealthDivisionsDataSource` shape.
 *
 * @remarks
 * An empty `distritos` list is rejected: a territory grouping nothing would
 * paint with no population behind it, which the map would show as a 0% rate.
 */
const isStaticHealthDivisionsDataSource = (
  value: unknown
): value is StaticHealthDivisionsDataSource => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isArrayOf(record['coordenadorias'], isHealthDivisionData) &&
    isArrayOf(record['supervisoes'], isSupervisionData)
  );
};

/**
 * Reads and validates the static health-divisions snapshot.
 *
 * @returns The raw source record from `data/health-divisions.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { coordenadorias, supervisoes } = await readStaticHealthDivisions();
 * // coordenadorias: [{ id: 2, nome: 'CRS Leste', distritos: [...] }, ...]
 */
export const readStaticHealthDivisions =
  async (): Promise<StaticHealthDivisionsDataSource> => {
    const parsed: unknown = healthDivisionsData;

    if (!isStaticHealthDivisionsDataSource(parsed)) {
      throw new Error(
        '[data-source-static] health-divisions.json has an unexpected shape'
      );
    }

    return parsed;
  };
