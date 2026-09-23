import { POINT_LAYER_IDS, type PointLayerId } from '@/config/pointLayers';
import type { PointsContract } from '@/data-gateway/schema';

/**
 * Endpoint serving one point layer (`src/app/api/camadas/[layer]/route.ts`).
 *
 * @param layer - The layer to request.
 * @returns The layer's URL.
 *
 * @example
 * pointLayerUrl('ubs'); // '/api/camadas/ubs'
 */
export const pointLayerUrl = (layer: PointLayerId): string => {
  return `/api/camadas/${layer}`;
};

/**
 * State of the point layers, as `useSyncExternalStore` reads it.
 *
 * `active` mirrors each layer's toggle in the "Camadas" control; `data` holds
 * each layer's collection once its first request has settled.
 */
export type PointLayersSnapshot = {
  active: Readonly<Record<PointLayerId, boolean>>;
  data: Readonly<Partial<Record<PointLayerId, PointsContract>>>;
};

const INITIAL_SNAPSHOT: PointLayersSnapshot = {
  active: Object.fromEntries(
    POINT_LAYER_IDS.map((id) => {
      return [id, false];
    })
  ) as Record<PointLayerId, boolean>,
  data: {},
};

/**
 * Creates the store behind the map's point layers.
 *
 * It is a store rather than component state because two trees need it: the
 * `map` slot override, the only place inside the geovis provider where the
 * toggles can be observed, writes `active`; `MapsView`, which sits outside that
 * provider and builds the spec, reads both fields.
 *
 * Each layer is requested on its first activation only, and its result is
 * kept, so turning it off and on again costs nothing. A failed request is
 * forgotten instead, so the next activation retries it — the layer simply
 * stays empty meanwhile, which reads as "not loaded" rather than as a city
 * without any, since its toggle still shows as on.
 *
 * @param fetchPoints - Loads one layer; injectable for tests.
 * @returns The store's `subscribe`, snapshot getters and `setActive`.
 *
 * @example
 * const store = createPointLayersStore();
 * store.setActive('ubs', true); // first activation → one request to /api/camadas/ubs
 */
export const createPointLayersStore = (
  fetchPoints: (layer: PointLayerId) => Promise<PointsContract> = async (
    layer
  ) => {
    const response = await fetch(pointLayerUrl(layer));

    if (!response.ok) {
      throw new Error(
        `[pointLayersStore] ${pointLayerUrl(layer)} answered ${response.status}`
      );
    }

    return response.json() as Promise<PointsContract>;
  }
) => {
  let snapshot = INITIAL_SNAPSHOT;
  const inFlight = new Set<PointLayerId>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const load = (layer: PointLayerId) => {
    inFlight.add(layer);

    fetchPoints(layer)
      .then((points) => {
        snapshot = { ...snapshot, data: { ...snapshot.data, [layer]: points } };
        notify();
      })
      // A failed request leaves the layer's data unset, which is the whole
      // recovery: the next activation sees nothing loaded and asks again.
      .catch(() => {})
      .finally(() => {
        inFlight.delete(layer);
      });
  };

  return {
    subscribe: (onStoreChange: () => void) => {
      listeners.add(onStoreChange);

      return () => {
        listeners.delete(onStoreChange);
      };
    },

    getSnapshot: (): PointLayersSnapshot => {
      return snapshot;
    },

    getServerSnapshot: (): PointLayersSnapshot => {
      return INITIAL_SNAPSHOT;
    },

    setActive: (layer: PointLayerId, active: boolean) => {
      if (active !== snapshot.active[layer]) {
        snapshot = {
          ...snapshot,
          active: { ...snapshot.active, [layer]: active },
        };
        notify();
      }

      if (active && !snapshot.data[layer] && !inFlight.has(layer)) {
        load(layer);
      }
    },
  };
};

/** The app's single point-layers store, shared by `MapsView` and `MapPanel`. */
export const pointLayersStore = createPointLayersStore();
