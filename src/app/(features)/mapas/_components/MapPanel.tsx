import { GeoVisCanvas, useGeoVis } from '@ttoss/geovis';
import * as React from 'react';

import { POINT_LAYERS } from '@/config/pointLayers';

import { pointLayerSpecId } from './pointLayers';
import { pointLayersStore } from './pointLayersStore';

/**
 * The workspace's `map` slot, replacing a default that is nothing but the same
 * canvas at the same size.
 *
 * It exists because an override renders INSIDE the geovis provider tree, the
 * only place `useGeoVis()` resolves — and the geovis layer control announces a
 * toggle nowhere else: it has no callback, it just flips the layer's `visible`
 * in the runtime's spec. `MapsView` renders `<GeovisWorkspace>` and so sits
 * outside that tree; this component relays each flip to
 * {@link pointLayersStore}, which fetches a layer on its first activation.
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

  // A string, so the effect below re-runs only when a toggle actually flips —
  // not on every timeline tick, which rebuilds `spec.layers` each time.
  const visibleLayers = POINT_LAYERS.filter((config) => {
    return (
      spec.layers.find((layer) => {
        return layer.id === pointLayerSpecId(config.id);
      })?.visible !== false
    );
  })
    .map((config) => {
      return config.id;
    })
    .join(',');

  React.useEffect(() => {
    const visible = new Set(visibleLayers.split(','));

    for (const config of POINT_LAYERS) {
      pointLayersStore.setActive(config.id, visible.has(config.id));
    }
  }, [visibleLayers]);

  return <GeoVisCanvas style={{ width: '100%', height: '100%' }} />;
};

export default MapPanel;
