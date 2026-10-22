import { OVERLAY_IDS, type OverlayId } from '@/config/overlays';
import type { OverlayContract } from '@/data-gateway/schema';

/**
 * Endpoint serving one overlay (`src/app/api/camadas/[layer]/route.ts`).
 *
 * @param layer - The layer to request.
 * @returns The layer's URL.
 *
 * @example
 * overlayUrl('ubs'); // '/api/camadas/ubs'
 */
export const overlayUrl = (layer: OverlayId): string => {
  return `/api/camadas/${layer}`;
};

/**
 * The layer each side of the split map mode shows — `a` left, `b` right —
 * `null` for a side showing none.
 */
export type SplitSides = { a: OverlayId | null; b: OverlayId | null };

/**
 * State of the overlays, as `useSyncExternalStore` reads it.
 *
 * `active` mirrors each layer's toggle in the "Camadas" control; `data` holds
 * each layer's collection once its first request has settled; `split` is the
 * layer on each side while the map is split in two, `null` for a single map.
 */
export type OverlaysSnapshot = {
  active: Readonly<Record<OverlayId, boolean>>;
  data: Readonly<Partial<Record<OverlayId, OverlayContract>>>;
  split: Readonly<SplitSides> | null;
};

const INITIAL_SNAPSHOT: OverlaysSnapshot = {
  active: Object.fromEntries(
    OVERLAY_IDS.map((id) => {
      return [id, false];
    })
  ) as Record<OverlayId, boolean>,
  data: {},
  split: null,
};

/**
 * Creates the store behind the map's overlays.
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
 * @param fetchOverlay - Loads one overlay; injectable for tests.
 * @returns The store's `subscribe`, snapshot getters and `setActive`.
 *
 * @example
 * const store = createOverlaysStore();
 * store.setActive('ubs', true); // first activation → one request to /api/camadas/ubs
 */
export const createOverlaysStore = (
  fetchOverlay: (layer: OverlayId) => Promise<OverlayContract> = async (
    layer
  ) => {
    const response = await fetch(overlayUrl(layer));

    if (!response.ok) {
      throw new Error(
        `[overlaysStore] ${overlayUrl(layer)} answered ${response.status}`
      );
    }

    return response.json() as Promise<OverlayContract>;
  }
) => {
  let snapshot = INITIAL_SNAPSHOT;
  const inFlight = new Set<OverlayId>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const load = (layer: OverlayId) => {
    inFlight.add(layer);

    fetchOverlay(layer)
      .then((overlay) => {
        snapshot = {
          ...snapshot,
          data: { ...snapshot.data, [layer]: overlay },
        };
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

    getSnapshot: (): OverlaysSnapshot => {
      return snapshot;
    },

    getServerSnapshot: (): OverlaysSnapshot => {
      return INITIAL_SNAPSHOT;
    },

    setActive: (layer: OverlayId, active: boolean) => {
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

    /**
     * Fetches a layer's data without switching it on: a split side draws a
     * layer the "Camadas" control may have off, and switching it on there
     * would put it on the single map and in the link's `camadas` too.
     */
    prefetch: (layer: OverlayId) => {
      if (!snapshot.data[layer] && !inFlight.has(layer)) {
        load(layer);
      }
    },

    /** Records the split sides (or `null` for a single map), for the link. */
    setSplit: (split: SplitSides | null) => {
      const same =
        split === snapshot.split ||
        (split !== null &&
          snapshot.split !== null &&
          split.a === snapshot.split.a &&
          split.b === snapshot.split.b);
      if (same) return;
      snapshot = { ...snapshot, split };
      notify();
    },
  };
};

/** The app's single overlays store, shared by `MapsView` and `MapPanel`. */
export const overlaysStore = createOverlaysStore();
