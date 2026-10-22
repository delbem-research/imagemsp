import { GeoVisCanvas, useGeoVis, useGeoVisMapMode } from '@ttoss/geovis';
import * as React from 'react';

import { isOverlayId, OVERLAYS } from '@/config/overlays';

import { splitFromSearch } from './mapUrlState';
import { overlaySpecId } from './overlays';
import { overlaysStore } from './overlaysStore';

/**
 * The workspace's `map` slot, replacing a default that is nothing but the same
 * canvas at the same size.
 *
 * It exists because an override renders INSIDE the geovis provider tree, the
 * only place `useGeoVis()` resolves — and the geovis layer control announces a
 * toggle nowhere else: it has no callback, it just flips the layer's `visible`
 * in the runtime's spec. `MapsView` renders `<GeovisWorkspace>` and so sits
 * outside that tree; this component relays each flip to
 * {@link overlaysStore}, which fetches a layer on its first activation.
 *
 * It relays the "Modo do mapa" state the same way: a link that asks for a split
 * map opens split, on its sides, and the sides chosen afterwards are written
 * to the store so the link carries them.
 *
 * Overriding the slot gives up geovis-workspace's cold-start panel, which
 * covers the window before the first spec resolves. `MapsView` already holds
 * its own loading indicator until the map mounts, so nothing is lost.
 *
 * @returns The map canvas, with the layer toggles relayed to the store.
 *
 * @example
 * // In the workspace config:
 * slots: { map: { component: MapPanel } }
 */
const MapPanel = () => {
  const { spec } = useGeoVis();
  const { enabled, mode, sides, setMode } = useGeoVisMapMode();

  // A string, so the effect below re-runs only when a toggle actually flips —
  // not on every timeline tick, which rebuilds `spec.layers` each time.
  const visibleLayers = OVERLAYS.filter((config) => {
    return (
      spec.layers.find((layer) => {
        return layer.id === overlaySpecId(config.id);
      })?.visible !== false
    );
  })
    .map((config) => {
      return config.id;
    })
    .join(',');

  React.useEffect(() => {
    const visible = new Set(visibleLayers.split(','));

    for (const config of OVERLAYS) {
      overlaysStore.setActive(config.id, visible.has(config.id));
    }
  }, [visibleLayers]);

  // A shared link that asks for a split map opens split, on its sides. Once:
  // after that the reader's own choices are what the link follows.
  const openedFromLink = React.useRef(false);
  React.useEffect(() => {
    if (openedFromLink.current || !enabled) return;
    openedFromLink.current = true;
    const split = splitFromSearch(window.location.search);
    if (split) setMode('split', split);
  }, [enabled, setMode]);

  // Split, each side draws the overlay its picker chose without switching it
  // on in the layer control: its data is fetched here, and the sides go to the
  // store for the link.
  // Empty for a single map, a lone comma for a split with both sides empty.
  const splitSides =
    mode === 'split' ? `${sides.a ?? ''},${sides.b ?? ''}` : '';
  React.useEffect(() => {
    if (!splitSides) {
      overlaysStore.setSplit(null);
      return;
    }
    const [a, b] = splitSides.split(',').map((id) => {
      return isOverlayId(id) ? id : null;
    });
    if (a) overlaysStore.prefetch(a);
    if (b) overlaysStore.prefetch(b);
    overlaysStore.setSplit({ a: a ?? null, b: b ?? null });
  }, [splitSides]);

  return <GeoVisCanvas style={{ width: '100%', height: '100%' }} />;
};

export default MapPanel;
