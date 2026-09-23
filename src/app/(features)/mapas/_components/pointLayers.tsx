import { Box, Text } from '@chakra-ui/react';
import type {
  DataSource,
  HoverTooltipConfig,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import {
  POINT_LAYERS,
  type PointLayerConfig,
  type PointLayerId,
} from '@/config/pointLayers';
import type { PointProperties, PointsContract } from '@/data-gateway/schema';

import type { PointLayersSnapshot } from './pointLayersStore';

/**
 * Spec id of a point layer's map layer. Its source takes the bare layer id.
 *
 * @param layer - The point layer.
 * @returns The layer id used in `spec.layers` and in the control's items.
 *
 * @example
 * pointLayerSpecId('ubs'); // 'ubs-pts'
 */
export const pointLayerSpecId = (layer: PointLayerId): string => {
  return `${layer}-pts`;
};

/**
 * What a source holds until its points arrive. Every layer has to exist in the
 * spec from the first paint, loaded or not: the geovis control greys out an
 * item whose layers are all absent, so without it there would be no way to
 * turn the layer on in the first place.
 */
const EMPTY_COLLECTION: PointsContract = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Thumbnail of a control item, inline so it needs no request: a few points in
 * the layer's colour over a pale ground, like the kitchens' in cozsolidarias.
 *
 * @param color - The layer's point colour.
 * @returns An SVG data URI.
 */
const thumbnail = (color: string): string => {
  const fill = encodeURIComponent(color);
  const dot = (cx: number, cy: number) => {
    return `<circle cx='${cx}' cy='${cy}' r='6' fill='${fill}' stroke='white' stroke-width='1.5'/>`;
  };

  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='rgb(234,238,227)'/>${dot(20, 24)}${dot(42, 36)}${dot(28, 48)}</svg>`;
};

/**
 * Renders the hover card of one point: its name, then its secondary line.
 *
 * @param point - The hovered point's properties, when found.
 * @returns Tooltip JSX content.
 */
const renderPointTooltip = (point: PointProperties | undefined) => {
  if (!point) {
    return null;
  }

  return (
    <Box display="flex" flexDirection="column" gap="1" minWidth="200px">
      <Text fontWeight="bold" fontSize="md" lineHeight="tight">
        {point.name}
      </Text>
      {point.detail && (
        <Text fontSize="xs" color="text.muted" lineHeight="tight">
          {point.detail}
        </Text>
      )}
    </Box>
  );
};

/**
 * Builds one point layer's map layer.
 *
 * The points copy the kitchen points of cozsolidarias — small, nearly opaque,
 * with a light halo so each one reads over both the pale basemap and the dark
 * end of the choropleth — but in the layer's own fixed colour.
 *
 * `click: {}` is what gives the points a tooltip at all: geovis only
 * hover-tracks point layers that declare `click` (polygon layers qualify by
 * their legend instead).
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
  config: PointLayerConfig;
  collection: PointsContract;
  visible: boolean;
  tooltipStyle: HoverTooltipConfig['style'];
}): VisualizationLayer => {
  const byId = new Map(
    collection.features.map((feature) => {
      return [feature.id, feature.properties] as const;
    })
  );

  return {
    id: pointLayerSpecId(config.id),
    sourceId: config.id,
    geometry: 'point',
    visible,
    paint: {
      circleColor: config.color,
      circleRadius: config.radius,
      circleOpacity: 0.9,
      circleStrokeColor: '#FAF9F7',
      circleStrokeWidth: config.strokeWidth,
    },
    click: {},
    hoverTooltip: {
      render: (info: MapHoverInfo) => {
        return renderPointTooltip(byId.get(Number(info.featureId)));
      },
      style: tooltipStyle,
    },
  };
};

/**
 * Builds the sources and layers of every point layer.
 *
 * Layers are returned in reverse control order, so the first toggle's points
 * draw on top: the 22 thousand bus stops, last in the control, end up at the
 * bottom instead of burying the hospitals.
 *
 * @param params.layers - The store's snapshot: toggles and loaded data.
 * @param params.tooltipStyle - Card style shared with the district tooltip.
 * @returns The sources and layers to append to the spec.
 *
 * @example
 * buildPointLayers({ layers: pointLayersStore.getSnapshot(), tooltipStyle });
 * // { sources: [{ id: 'hospitais', ... }, ...], layers: [{ id: 'pontos-onibus-pts', visible: false, ... }, ...] }
 */
export const buildPointLayers = ({
  layers,
  tooltipStyle,
}: {
  layers: PointLayersSnapshot;
  tooltipStyle: HoverTooltipConfig['style'];
}): { sources: DataSource[]; layers: VisualizationLayer[] } => {
  const sources: DataSource[] = POINT_LAYERS.map((config) => {
    return {
      id: config.id,
      type: 'geojson',
      data: layers.data[config.id] ?? EMPTY_COLLECTION,
    };
  });

  const mapLayers = [...POINT_LAYERS].reverse().map((config) => {
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
 * Every layer starts off: they are overlays on the choropleth, not the map's
 * subject, and turning one on is what triggers its request.
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
  items: POINT_LAYERS.map((config) => {
    return {
      id: config.id,
      label: config.label,
      thumbnail: thumbnail(config.color),
      layers: [pointLayerSpecId(config.id)],
      defaultActive: false,
    };
  }),
};
