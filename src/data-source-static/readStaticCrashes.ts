import type { StaticCrashesDataSource } from './types';

const AGE_BANDS = new Set(['65-69', '70-74', '75']);

/** A crash: two finite coordinates, then a non-empty list of age bands. */
const isCrash = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length !== 3) return false;
  const [longitude, latitude, bands] = value as unknown[];
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Array.isArray(bands) &&
    bands.length > 0 &&
    bands.every((band) => {
      return AGE_BANDS.has(band as string);
    })
  );
};

/**
 * Returns true when `value` matches the expected `StaticCrashesDataSource`
 * shape: an integer `ano` and an `acidentes` array of crashes, each
 * `[longitude, latitude, ageBands]`.
 */
const isStaticCrashesDataSource = (
  value: unknown
): value is StaticCrashesDataSource => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const source = value as Record<string, unknown>;

  return (
    Number.isInteger(source['ano']) &&
    Array.isArray(source['acidentes']) &&
    source['acidentes'].every(isCrash)
  );
};

/**
 * Reads and validates the static traffic crash snapshot.
 *
 * Imported on demand, like the other overlay snapshots: the crashes are
 * requested only when their toggle is turned on, so the module stays out of
 * every other request.
 *
 * @returns The raw source record from `data/heat/acidentes.json`.
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const { ano, acidentes } = await readStaticCrashes();
 * // 2024, [[-46.74931, -23.53816, ['70-74']], ...]
 */
export const readStaticCrashes = async (): Promise<StaticCrashesDataSource> => {
  const parsed: unknown = (await import('./data/heat/acidentes.json')).default;

  if (!isStaticCrashesDataSource(parsed)) {
    throw new Error(
      '[data-source-static] heat/acidentes.json has an unexpected shape'
    );
  }

  return parsed;
};
