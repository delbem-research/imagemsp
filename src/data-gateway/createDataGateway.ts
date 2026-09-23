import type { PointLayerId } from '@/config/pointLayers';

import { readStaticMapsData } from '../data-source-static/readStaticMapsData';
import { readStaticPoints } from '../data-source-static/readStaticPoints';
import type { MapsDataContract, PointsContract } from './schema';
import { toAppMapsData } from './transformers/toAppMapsData';
import { toAppPoints } from './transformers/toAppPoints';

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns the canonical maps data. */
  getMapsData: () => Promise<MapsDataContract>;
  /** Returns one map point layer as a GeoJSON FeatureCollection. */
  getPoints: (layer: PointLayerId) => Promise<PointsContract>;
};

const KNOWN_SOURCES = ['static'] as const;
type KnownSource = (typeof KNOWN_SOURCES)[number];

const isKnownSource = (value: string): value is KnownSource => {
  return (KNOWN_SOURCES as readonly string[]).includes(value);
};

/**
 * Creates the data gateway. Source selection is internal, driven by the
 * `DATA_SOURCE` environment variable (defaults to `'static'`).
 *
 * @returns A gateway exposing canonical read functions.
 * @throws If `DATA_SOURCE` is set to a value outside {@link KNOWN_SOURCES}.
 *
 * @example
 * const gateway = createDataGateway();
 * const mapsData = await gateway.getMapsData();
 * // { ...maps data... }
 */
export const createDataGateway = (): DataGateway => {
  const raw = process.env['DATA_SOURCE'] ?? 'static';

  if (!isKnownSource(raw)) {
    throw new Error(
      `[data-gateway] Unknown DATA_SOURCE: "${raw}". Known: ${KNOWN_SOURCES.join(', ')}.`
    );
  }

  if (raw === 'static') {
    return {
      getMapsData: async () => {
        const source = await readStaticMapsData();
        return toAppMapsData(source);
      },
      getPoints: async (layer) => {
        const source = await readStaticPoints(layer);
        return toAppPoints({ layer, source });
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};
