import { OFFER_SERVICES } from '@/config/offer';
import {
  isPointOverlayId,
  isTerritoryOverlayId,
  type OverlayId,
  POINT_OVERLAY_IDS,
} from '@/config/overlays';

import { readStaticBikeLanes } from '../data-source-static/readStaticBikeLanes';
import { readStaticHealthDivisions } from '../data-source-static/readStaticHealthDivisions';
import { readStaticMapsData } from '../data-source-static/readStaticMapsData';
import { readStaticParks } from '../data-source-static/readStaticParks';
import { readStaticPoints } from '../data-source-static/readStaticPoints';
import { readStaticSubprefeituras } from '../data-source-static/readStaticSubprefeituras';
import { readStaticTerritories } from '../data-source-static/readStaticTerritories';
import type {
  MapsDataContract,
  NearbyContract,
  NearbyQuery,
  OverlayContract,
} from './schema';
import { toAppBikeLanes } from './transformers/toAppBikeLanes';
import {
  type ServiceCounts,
  toAppMapsData,
} from './transformers/toAppMapsData';
import { toAppNearbyPoints } from './transformers/toAppNearbyPoints';
import { toAppParks } from './transformers/toAppParks';
import { toAppPoints } from './transformers/toAppPoints';
import { toAppTerritories } from './transformers/toAppTerritories';

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns the canonical maps data. */
  getMapsData: () => Promise<MapsDataContract>;
  /**
   * Returns one map overlay (points, cycle lanes, parks or a health territory) as a GeoJSON
   * FeatureCollection.
   */
  getOverlay: (layer: OverlayId) => Promise<OverlayContract>;
  /**
   * Returns the points of every point overlay inside a ring around a point,
   * nearest first.
   */
  getNearbyPoints: (query: NearbyQuery) => Promise<NearbyContract>;
};

/**
 * Counts each offer service's facilities per district, from the point
 * snapshots' `distrito` column. Only the four offer services are read — the
 * 5 MB bus-stop snapshot is never loaded for this.
 *
 * @returns Facilities per service, keyed by district name.
 *
 * @example
 * const counts = await countStaticServices();
 * counts.ubs.get('Sé'); // 4
 */
const countStaticServices = async (): Promise<ServiceCounts> => {
  const entries = await Promise.all(
    OFFER_SERVICES.map(async (service) => {
      const { points } = await readStaticPoints(service);
      const byDistrict = new Map<string, number>();

      for (const point of points) {
        byDistrict.set(
          point.distrito,
          (byDistrict.get(point.distrito) ?? 0) + 1
        );
      }

      return [service, byDistrict] as const;
    })
  );

  return Object.fromEntries(entries) as ServiceCounts;
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
        const [source, subprefeituras, serviceCounts, healthDivisions] =
          await Promise.all([
            readStaticMapsData(),
            readStaticSubprefeituras(),
            countStaticServices(),
            readStaticHealthDivisions(),
          ]);
        return toAppMapsData(
          source,
          subprefeituras,
          serviceCounts,
          healthDivisions
        );
      },
      getOverlay: async (layer) => {
        if (isPointOverlayId(layer)) {
          const source = await readStaticPoints(layer);
          return toAppPoints({ layer, source });
        }

        if (isTerritoryOverlayId(layer)) {
          return toAppTerritories(await readStaticTerritories(layer));
        }

        if (layer === 'ciclovias') {
          return toAppBikeLanes(await readStaticBikeLanes());
        }

        return toAppParks(await readStaticParks());
      },
      getNearbyPoints: async (query) => {
        const nearby = await Promise.all(
          POINT_OVERLAY_IDS.map(async (layer) => {
            const source = await readStaticPoints(layer);
            return toAppNearbyPoints({ layer, source, query });
          })
        );

        return nearby.flat().sort((a, b) => {
          return a.distance - b.distance;
        });
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};
