import { Box, Text } from '@chakra-ui/react';
import type {
  DataSource,
  HoverTooltipConfig,
  MapHoverInfo,
  PinImage,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import { PIN_ICON_DATA } from '@/components/map/lib/icons';
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
 * Id of a point overlay's pin in `spec.images`, which its layer draws through
 * `paint.iconImage`.
 *
 * @param overlay - The overlay.
 * @returns The image id.
 *
 * @example
 * overlayPinId('ubs'); // 'ubs-pin'
 */
const overlayPinId = (overlay: OverlayId): string => {
  return `${overlay}-pin`;
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
 * The pin's teardrop, in a 24 × 30 box — the same shape geovis draws on the map
 * — and where its icon sits inside it.
 */
const PIN_PATH =
  'M12 29.25C12 29.25 1.5 19 1.5 12a10.5 10.5 0 1 1 21 0c0 7-10.5 17.25-10.5 17.25z';
const PIN_ICON_BOX = { x: 5.5, y: 5.5, size: 13 };

/**
 * One pin centred on the thumbnail, scaled up from the map's: the overlay's
 * colour, a white outline and its icon, so the card previews exactly the mark
 * the overlay draws.
 */
const pinMark = (config: OverlayConfig & { kind: 'point' }): string => {
  const icon = PIN_ICON_DATA[config.icon];
  const iconSvg = icon
    ? `<svg x='${PIN_ICON_BOX.x}' y='${PIN_ICON_BOX.y}' width='${PIN_ICON_BOX.size}' height='${PIN_ICON_BOX.size}' viewBox='${icon.left ?? 0} ${icon.top ?? 0} ${icon.width ?? 16} ${icon.height ?? 16}' color='white' fill='white'>${icon.body}</svg>`
    : '';

  return `<g transform='translate(13 5) scale(1.575)'><path d='${PIN_PATH}' fill='${config.color}' stroke='white' stroke-width='1.5'/>${iconSvg}</g>`;
};

/**
 * Thumbnail of a control item, inline so it needs no request: for a point
 * overlay its pin; for a polygon overlay two filled, outlined patches, like it
 * draws on the map.
 *
 * @param config - The overlay.
 * @returns An SVG data URI.
 */
const thumbnail = (config: OverlayConfig): string => {
  const marks =
    config.kind === 'point'
      ? pinMark(config)
      : `<path d='M8 14 L30 8 L36 28 L14 34 Z' fill='${config.color}' fill-opacity='${config.fillOpacity}' stroke='${config.color}' stroke-width='2'/><path d='M34 38 L56 34 L54 56 L30 52 Z' fill='${config.color}' fill-opacity='${config.fillOpacity}' stroke='${config.color}' stroke-width='2'/>`;

  // Encoded whole: icon bodies carry double quotes and `#` colours.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>${THUMB_GROUND}${marks}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
 * Points are pins: a `symbol` layer drawing the overlay's pin from
 * `spec.images` at each feature, anchored by its tip so the tip — not the
 * pin's middle — sits on the place. `click: {}` is what gives them a tooltip at
 * all: geovis only hover-tracks non-polygon layers that declare it.
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
      geometry: 'symbol',
      paint: {
        iconImage: overlayPinId(config.id),
        iconAnchor: 'bottom',
        iconAllowOverlap: config.allowOverlap,
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
 * The pin of every point overlay, in its colour with its icon, for
 * `spec.images`. Fixed for the app's lifetime, so geovis builds each pin once
 * and keeps it across the spec rebuilds of every timeline tick.
 */
const PIN_IMAGES: PinImage[] = OVERLAYS.flatMap((config) => {
  if (config.kind !== 'point') return [];
  return [
    {
      id: overlayPinId(config.id),
      kind: 'pin',
      icon: config.icon,
      color: config.color,
      size: config.pinSize,
    },
  ];
});

/**
 * Builds the sources, layers and pin images of every overlay.
 *
 * Layers are returned in {@link overlayDrawOrder}: polygons beneath points,
 * and within each kind the control's first item on top.
 *
 * @param params.layers - The store's snapshot: toggles and loaded data.
 * @param params.tooltipStyle - Card style shared with the area tooltip.
 * @returns The sources and layers to append to the spec, and the pin images
 * its point layers draw.
 *
 * @example
 * buildOverlays({ layers: overlaysStore.getSnapshot(), tooltipStyle });
 * // { sources: [{ id: 'parques', ... }, ...], layers: [{ id: 'pontos-onibus-overlay', visible: false, ... }, ...], images: [{ id: 'hospitais-pin', ... }, ...] }
 */
export const buildOverlays = ({
  layers,
  tooltipStyle,
}: {
  layers: OverlaysSnapshot;
  tooltipStyle: HoverTooltipConfig['style'];
}): {
  sources: DataSource[];
  layers: VisualizationLayer[];
  images: PinImage[];
} => {
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

  return { sources, layers: mapLayers, images: PIN_IMAGES };
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
  // Fifteen overlays outgrow the map in a single row of cards: show the first
  // three and tuck the rest behind a "Ver mais" card.
  maxVisibleItems: 3,
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
