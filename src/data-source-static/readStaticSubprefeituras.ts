import subprefeiturasData from './data/subprefeituras.json';
import type { StaticSubprefeiturasDataSource } from './types';

/**
 * Whether a first and last year in force are usable: whole years, and a last
 * one (`null` while still in force) no earlier than the first.
 */
const isValidity = (validFrom: unknown, validTo: unknown): boolean => {
  if (!Number.isInteger(validFrom)) {
    return false;
  }

  return (
    validTo === null ||
    (Number.isInteger(validTo) && (validTo as number) >= (validFrom as number))
  );
};

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

const isSubprefeituraData = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  const validFrom = row['validFrom'];
  const validTo = row['validTo'];

  return (
    Number.isInteger(row['id']) &&
    typeof row['codigo'] === 'string' &&
    typeof row['sigla'] === 'string' &&
    typeof row['nome'] === 'string' &&
    typeof row['regiao'] === 'string' &&
    isDistrictList(row['distritos']) &&
    isValidity(validFrom, validTo)
  );
};

/**
 * Returns true when `value` matches the expected
 * `StaticSubprefeiturasDataSource` shape: a `subprefeituras` array where every
 * element satisfies {@link isSubprefeituraData}.
 *
 * @remarks
 * An empty `distritos` list is rejected: a subprefeitura grouping nothing would
 * paint with no population behind it, which the map would show as a 0% rate.
 * So is a `validTo` before `validFrom`, a subprefeitura in force in no year.
 */
const isStaticSubprefeiturasDataSource = (
  value: unknown
): value is StaticSubprefeiturasDataSource => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)['subprefeituras'])
  ) {
    return false;
  }
  return (
    (value as Record<string, unknown>)['subprefeituras'] as unknown[]
  ).every(isSubprefeituraData);
};

/**
 * Reads and validates the static subprefeituras snapshot.
 *
 * @returns The raw source record from `data/subprefeituras.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { subprefeituras } = await readStaticSubprefeituras();
 * // [{ id: 1, nome: 'Pirituba-Jaraguá', distritos: [42, 63, 95], ... }, ...]
 */
export const readStaticSubprefeituras =
  async (): Promise<StaticSubprefeiturasDataSource> => {
    const parsed: unknown = subprefeiturasData;

    if (!isStaticSubprefeiturasDataSource(parsed)) {
      throw new Error(
        '[data-source-static] subprefeituras.json has an unexpected shape'
      );
    }

    return parsed;
  };
