import { Box, Text } from '@chakra-ui/react';
import type {
  DataSource,
  HoverTooltipConfig,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import {
  type OverlayConfig,
  overlayDrawOrder,
  type OverlayId,
  OVERLAYS,
} from '@/config/overlays';
import type { OverlayContract, OverlayProperties } from '@/data-gateway/schema';

import type { OverlaysSnapshot } from './overlaysStore';

/**
 * Spec id of an overlay's map layer. Its source takes the bare overlay id.
 *
 * @param overlay - The overlay.
 * @returns The layer id used in `spec.layers` and in the control's items.
 *
 * @example
 * overlaySpecId('ubs'); // 'ubs-overlay'
 */
export const overlaySpecId = (overlay: OverlayId): string => {
  return `${overlay}-overlay`;
};

/**
 * What a source holds until its features arrive. Every overlay has to exist in
 * the spec from the first paint, loaded or not: the geovis control greys out an
 * item whose layers are all absent, so without it there would be no way to
 * turn the overlay on in the first place.
 */
const EMPTY_COLLECTION: OverlayContract = {
  type: 'FeatureCollection',
  features: [],
};

/** Pale ground shared by every control thumbnail. */
const THUMB_GROUND = "<rect width='64' height='64' fill='rgb(234,238,227)'/>";

/**
 * Thumbnail of a control item, inline so it needs no request: for a point
 * overlay a few dots in its colour, like the kitchens' in cozsolidarias; for a
 * polygon overlay two filled, outlined patches, like it draws on the map.
 *
 * @param config - The overlay.
 * @returns An SVG data URI.
 */
const thumbnail = (config: OverlayConfig): string => {
  const color = encodeURIComponent(config.color);

  const marks =
    config.kind === 'point'
      ? [
          [20, 24],
          [42, 36],
          [28, 48],
        ]
          .map(([cx, cy]) => {
            return `<circle cx='${cx}' cy='${cy}' r='6' fill='${color}' stroke='white' stroke-width='1.5'/>`;
          })
          .join('')
      : `<path d='M8 14 L30 8 L36 28 L14 34 Z' fill='${color}' fill-opacity='${config.fillOpacity}' stroke='${color}' stroke-width='2'/><path d='M34 38 L56 34 L54 56 L30 52 Z' fill='${color}' fill-opacity='${config.fillOpacity}' stroke='${color}' stroke-width='2'/>`;

  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>${THUMB_GROUND}${marks}</svg>`;
};

/**
 * Renders the hover card of one overlay feature: its name, then its secondary
 * line.
 *
 * @param feature - The hovered feature's properties, when found.
 * @returns Tooltip JSX content.
 */
const renderOverlayTooltip = (feature: OverlayProperties | undefined) => {
  if (!feature) {
    return null;
  }

  return (
    <Box display="flex" flexDirection="column" gap="1" minWidth="200px">
      <Text fontWeight="bold" fontSize="md" lineHeight="tight">
        {feature.name}
      </Text>
      {feature.detail && (
        <Text fontSize="xs" color="text.muted" lineHeight="tight">
          {feature.detail}
        </Text>
      )}
    </Box>
  );
};

/**
 * The part of an overlay's layer that depends on what it draws.
 *
 * Points copy the kitchen points of cozsolidarias — small, nearly opaque, with
 * a light halo so each one reads over both the pale basemap and the dark end of
 * the choropleth — in the overlay's own fixed colour. `click: {}` is what gives
 * them a tooltip at all: geovis only hover-tracks point layers that declare it.
 *
 * Polygons are a fill plus an outline in the overlay's colour, at the
 * overlay's own opacity. `hoverPaint` does for them what `click` does
 * for points: geovis hover-tracks a polygon layer that declares it (or a
 * legend), and it thickens the outline of the park under the cursor.
 */
const drawing = (
  config: OverlayConfig
): Pick<VisualizationLayer, 'geometry' | 'paint' | 'click' | 'hoverPaint'> => {
  if (config.kind === 'point') {
    return {
      geometry: 'point',
      paint: {
        circleColor: config.color,
        circleRadius: config.radius,
        circleOpacity: 0.9,
        circleStrokeColor: '#FAF9F7',
        circleStrokeWidth: config.strokeWidth,
      },
      click: {},
    };
  }

  return {
    geometry: 'polygon',
    paint: {
      fillColor: config.color,
      fillOpacity: config.fillOpacity,
      lineColor: config.color,
    },
    hoverPaint: { lineColor: config.color, lineWidth: 2.5 },
  };
};

/**
 * Builds one overlay's map layer.
 *
 * `visible` is written into the spec rather than left to the control, so the
 * spec `MapsView` rebuilds on every timeline tick already agrees with the
 * toggle. Left unset, each rebuild would show the layer for a frame before the
 * control hid it again.
 */
const buildLayer = ({
  config,
  collection,
  visible,
  tooltipStyle,
}: {
  config: OverlayConfig;
  collection: OverlayContract;
  visible: boolean;
  tooltipStyle: HoverTooltipConfig['style'];
}): VisualizationLayer => {
  const byId = new Map(
    collection.features.map((feature) => {
      return [feature.id, feature.properties] as const;
    })
  );

  return {
    id: overlaySpecId(config.id),
    sourceId: config.id,
    visible,
    ...drawing(config),
    hoverTooltip: {
      render: (info: MapHoverInfo) => {
        return renderOverlayTooltip(byId.get(Number(info.featureId)));
      },
      style: tooltipStyle,
    },
  };
};

/**
 * Builds the sources and layers of every overlay.
 *
 * Layers are returned in {@link overlayDrawOrder}: polygons beneath points,
 * and within each kind the control's first item on top.
 *
 * @param params.layers - The store's snapshot: toggles and loaded data.
 * @param params.tooltipStyle - Card style shared with the area tooltip.
 * @returns The sources and layers to append to the spec.
 *
 * @example
 * buildOverlays({ layers: overlaysStore.getSnapshot(), tooltipStyle });
 * // { sources: [{ id: 'parques', ... }, ...], layers: [{ id: 'pontos-onibus-overlay', visible: false, ... }, ...] }
 */
export const buildOverlays = ({
  layers,
  tooltipStyle,
}: {
  layers: OverlaysSnapshot;
  tooltipStyle: HoverTooltipConfig['style'];
}): { sources: DataSource[]; layers: VisualizationLayer[] } => {
  const sources: DataSource[] = OVERLAYS.map((config) => {
    return {
      id: config.id,
      type: 'geojson',
      data: layers.data[config.id] ?? EMPTY_COLLECTION,
    };
  });

  const mapLayers = overlayDrawOrder(OVERLAYS).map((config) => {
    return buildLayer({
      config,
      collection: layers.data[config.id] ?? EMPTY_COLLECTION,
      visible: layers.active[config.id],
      tooltipStyle,
    });
  });

  return { sources, layers: mapLayers };
};

/**
 * The spec-driven "Camadas" control. `<GeoVisProvider>` mounts it as a
 * floating button in the map's bottom-left corner whenever `spec.control` is
 * present, as in the `SpecDrivenLayerControl` story of ttoss.
 *
 * Every overlay starts off: they sit on top of the choropleth, not in place of
 * it, and turning one on is what triggers its request.
 */
export const LAYER_CONTROL: NonNullable<VisualizationSpec['control']> = {
  id: 'camadas',
  label: 'Camadas',
  icon: 'lucide:layers',
  position: 'bottom-left',
  // The left sidebar card's own inset (theme space `3` = 0.75rem), so the
  // button lines up with the card when the sidebar is closed.
  offset: 12,
  trigger: 'hover',
  items: OVERLAYS.map((config) => {
    return {
      id: config.id,
      label: config.label,
      thumbnail: thumbnail(config),
      layers: [overlaySpecId(config.id)],
      defaultActive: false,
    };
  }),
};
