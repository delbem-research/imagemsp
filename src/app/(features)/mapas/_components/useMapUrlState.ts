import * as React from 'react';

import { OVERLAY_IDS, type OverlayId } from '@/config/overlays';

import { defaultSelection, type Selection } from './mapSelection';
import { mapUrlFor, mapUrlStateFromSearch } from './mapUrlState';
import { buildLayerControl } from './overlays';

/**
 * How long the address waits after the last change before it is rewritten. The
 * timeline changes the year several times a second while it plays, and browsers
 * cap how often `history.replaceState` may be called (Safari throws past 100
 * calls in 30 seconds).
 */
const WRITE_DELAY_MS = 300;

/**
 * The state the map opens on: the address's, over the defaults. Read once — the
 * map is only ever mounted in the browser (see `MapsView`), and after that the
 * selection is the source of truth and the address follows it.
 *
 * @param params.years - The projection years the snapshot carries.
 * @returns The defaults, the selection to open on, and the layer control with
 * the link's layers switched on — the control seeds its toggles once, from
 * `defaultActive`, and `MapPanel` mirrors them into the overlays store.
 */
export const useInitialMapUrlState = ({ years }: { years: number[] }) => {
  const [initial] = React.useState(() => {
    const defaults = defaultSelection(years);
    const state =
      typeof window === 'undefined'
        ? { selection: defaults, overlays: [] as OverlayId[] }
        : mapUrlStateFromSearch({
            search: window.location.search,
            defaults,
            years,
          });

    return {
      defaults,
      selection: state.selection,
      layerControl: buildLayerControl(state.overlays),
    };
  });
  return initial;
};

/**
 * Keeps the address in step with the selection and the switched-on layers, so
 * the link in it opens on what is on screen. Written with `replaceState`, not
 * `pushState`: every click would otherwise be a history entry, and "back"
 * would walk through them instead of leaving the page.
 *
 * @param params.selection - The current selection.
 * @param params.active - Each layer's toggle.
 * @param params.defaults - The selection the map opens on without a link.
 */
export const useMapUrlSync = ({
  selection,
  active,
  defaults,
}: {
  selection: Selection;
  active: Readonly<Record<OverlayId, boolean>>;
  defaults: Selection;
}) => {
  const layers = OVERLAY_IDS.filter((id) => {
    return active[id];
  }).join(',');

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = mapUrlFor({
        href: window.location.href,
        state: {
          selection,
          overlays: layers ? (layers.split(',') as OverlayId[]) : [],
        },
        defaults,
      });
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next !== current) {
        window.history.replaceState(window.history.state, '', next);
      }
    }, WRITE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selection, layers, defaults]);
};
