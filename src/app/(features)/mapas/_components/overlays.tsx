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
  type LineOverlayConfig,
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
 * Spec id of a translucent polygon overlay's outline layer (see
 * {@link hasOutlineLayer}).
 *
 * @param overlay - The overlay.
 * @returns The outline layer's id.
 *
 * @example
 * overlayOutlineId('abrangencia-ubs'); // 'abrangencia-ubs-overlay-outline'
 */
const overlayOutlineId = (overlay: OverlayId): string => {
  return `${overlaySpecId(overlay)}-outline`;
};

/**
 * Spec id of a line overlay's dashed layer (see {@link hasDashedLayer}).
 *
 * @param overlay - The overlay.
 * @returns The dashed layer's id.
 *
 * @example
 * overlayDashedId('ciclovias'); // 'ciclovias-overlay-dashed'
 */
const overlayDashedId = (overlay: OverlayId): string => {
  return `${overlaySpecId(overlay)}-dashed`;
};

/**
 * Whether a line overlay draws some of its features dashed, on a layer of
 * their own: MapLibre's `line-dasharray` holds for a whole layer, so the
 * dashed features — the ciclorrotas — are filtered out of the solid layer and
 * into a second one over the same source.
 */
const hasDashedLayer = (
  config: OverlayConfig
): config is LineOverlayConfig & { dashedDetail: string } => {
  return config.kind === 'line' && config.dashedDetail !== undefined;
};

/** Dash and gap lengths, in line widths, of a dashed line overlay. */
const DASH_PATTERN = [2, 1.5];

/**
 * Whether a polygon overlay draws its outline as a layer of its own.
 *
 * geovis draws a polygon as a MapLibre `fill` layer, whose outline is the
 * fill's own `fill-outline-color`: MapLibre paints it at the fill's opacity and
 * one pixel wide, whatever `lineWidth` says. That is fine for the solid parks,
 * but an outline-only territory (`fillOpacity: 0`) would vanish altogether,
 * and a tinted one would get a faint hairline. Those get a `line` layer over
 * the same source instead — MapLibre strokes polygon rings on a line layer, at
 * the width asked for — while their fill layer stays, transparent or tinted,
 * for the hover and the tooltip.
 */
const hasOutlineLayer = (
  config: OverlayConfig
): config is OverlayConfig & { kind: 'polygon' } => {
  return config.kind === 'polygon' && config.fillOpacity < 1;
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

/** Dark icon colour for the pins too light to carry a white one. */
const DARK_PIN_ICON = '#1A1A1A';

/**
 * Relative luminance of a `#RRGGBB` colour (WCAG 2), from 0 (black) to 1.
 *
 * @param hex - The colour.
 * @returns Its luminance.
 */
const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The colour of the icon inside a pin: white, unless white falls under 3:1
 * against the pin — the WCAG minimum for a graphic — as on the light pins
 * (the DST/AIDS pink, the bus stops' amber), which then
 * carry a dark icon instead.
 *
 * @param pinColor - The pin's fill, `#RRGGBB`.
 * @returns The icon colour.
 *
 * @example
 * pinIconColor('#2E9E5B'); // '#FFFFFF'
 * pinIconColor('#FF9DA7'); // '#1A1A1A'
 */
const pinIconColor = (pinColor: string): string => {
  const whiteContrast = 1.05 / (luminance(pinColor) + 0.05);
  return whiteContrast >= 3 ? '#FFFFFF' : DARK_PIN_ICON;
};

/**
 * One pin centred on the thumbnail, scaled up from the map's: the overlay's
 * colour, a white outline and its icon, so the card previews exactly the mark
 * the overlay draws.
 */
const pinMark = (config: OverlayConfig & { kind: 'point' }): string => {
  const icon = PIN_ICON_DATA[config.icon];
  const iconColor = pinIconColor(config.color);
  const iconSvg = icon
    ? `<svg x='${PIN_ICON_BOX.x}' y='${PIN_ICON_BOX.y}' width='${PIN_ICON_BOX.size}' height='${PIN_ICON_BOX.size}' viewBox='${icon.left ?? 0} ${icon.top ?? 0} ${icon.width ?? 16} ${icon.height ?? 16}' color='${iconColor}' fill='${iconColor}'>${icon.body}</svg>`
    : '';

  return `<g transform='translate(13 5) scale(1.575)'><path d='${PIN_PATH}' fill='${config.color}' stroke='white' stroke-width='1.5'/>${iconSvg}</g>`;
};

/**
 * Two patches in the overlay's fill and outline, the outline scaled from its
 * map weight so the thumbnails tell thin and thick outlines apart the way the
 * map does.
 */
const polygonMark = (config: OverlayConfig & { kind: 'polygon' }): string => {
  const style = `fill='${config.color}' fill-opacity='${config.fillOpacity}' stroke='${config.color}' stroke-width='${Math.max(1, config.lineWidth * 1.2)}'`;
  return `<path d='M8 14 L30 8 L36 28 L14 34 Z' ${style}/><path d='M34 38 L56 34 L54 56 L30 52 Z' ${style}/>`;
};

/**
 * Two strokes in the overlay's colour, at its map weight scaled up: a solid
 * one, and a dashed one when the overlay dashes some of its features.
 */
const lineMark = (config: LineOverlayConfig): string => {
  const stroke = `fill='none' stroke='${config.color}' stroke-width='${config.lineWidth * 1.5}' stroke-linecap='round'`;
  const dashed = config.dashedDetail
    ? `<path d='M8 52 C24 44 40 58 56 46' ${stroke} stroke-dasharray='6 5'/>`
    : '';
  return `<path d='M8 22 C24 10 40 30 56 16' ${stroke}/>${dashed}`;
};

/** The marks a control thumbnail shows for an overlay, by what it draws. */
const marksOf = (config: OverlayConfig): string => {
  if (config.kind === 'point') return pinMark(config);
  if (config.kind === 'line') return lineMark(config);
  return polygonMark(config);
};

/**
 * Thumbnail of a control item, inline so it needs no request: for a point
 * overlay its pin; for a line overlay its strokes; for a polygon overlay two
 * filled, outlined patches, like it draws on the map.
 *
 * @param config - The overlay.
 * @returns An SVG data URI.
 */
const thumbnail = (config: OverlayConfig): string => {
  const marks = marksOf(config);

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
 * Lines are strokes in the overlay's colour and weight; like the pins, they
 * declare `click: {}` to get a tooltip. A line overlay with dashed features
 * leaves them to its dashed layer (see {@link hasDashedLayer}).
 *
 * Polygons are a fill plus an outline in the overlay's colour, at the
 * overlay's own opacity; a translucent one also gets an outline layer of its
 * own (see {@link hasOutlineLayer}). `hoverPaint` does for them what `click` does
 * for points: geovis hover-tracks a polygon layer that declares it (or a
 * legend), and it thickens the outline of the park under the cursor.
 */
const drawing = (
  config: OverlayConfig
): Pick<
  VisualizationLayer,
  'geometry' | 'paint' | 'click' | 'hoverPaint' | 'filter'
> => {
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

  if (config.kind === 'line') {
    return {
      geometry: 'line',
      paint: { lineColor: config.color, lineWidth: config.lineWidth },
      click: {},
      ...(config.dashedDetail !== undefined && {
        filter: {
          property: 'detail',
          operator: 'neq',
          value: config.dashedDetail,
        },
      }),
    };
  }

  return {
    geometry: 'polygon',
    paint: {
      fillColor: config.color,
      fillOpacity: config.fillOpacity,
      lineColor: config.color,
    },
    // Thicker than the resting outline whatever its weight, so the hovered
    // territory stands out from its neighbours whatever its outline's weight.
    hoverPaint: { lineColor: config.color, lineWidth: config.lineWidth + 2 },
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
 * The outline layer of a translucent polygon overlay: its rings, stroked at
 * the overlay's weight. It carries no tooltip — the fill beneath it does.
 */
const buildOutlineLayer = ({
  config,
  visible,
}: {
  config: OverlayConfig & { kind: 'polygon' };
  visible: boolean;
}): VisualizationLayer => {
  return {
    id: overlayOutlineId(config.id),
    sourceId: config.id,
    visible,
    geometry: 'line',
    paint: { lineColor: config.color, lineWidth: config.lineWidth },
  };
};

/**
 * The dashed twin of a line overlay's layer: the same strokes and tooltip,
 * for the features whose `detail` is the overlay's `dashedDetail`.
 */
const buildDashedLayer = ({
  config,
  layer,
}: {
  config: LineOverlayConfig & { dashedDetail: string };
  layer: VisualizationLayer;
}): VisualizationLayer => {
  return {
    ...layer,
    id: overlayDashedId(config.id),
    paint: { ...layer.paint, lineDasharray: DASH_PATTERN },
    filter: { property: 'detail', operator: 'eq', value: config.dashedDetail },
  };
};

/**
 * The layers an overlay draws besides its own: a translucent polygon's
 * outline, a line overlay's dashed features.
 */
const companionLayers = ({
  config,
  layer,
  visible,
}: {
  config: OverlayConfig;
  layer: VisualizationLayer;
  visible: boolean;
}): VisualizationLayer[] => {
  if (hasOutlineLayer(config)) return [buildOutlineLayer({ config, visible })];
  if (hasDashedLayer(config)) return [buildDashedLayer({ config, layer })];
  return [];
};

/**
 * The ids of every layer an overlay draws, which its control item toggles
 * together.
 */
const overlayLayerIds = (config: OverlayConfig): string[] => {
  if (hasOutlineLayer(config)) {
    return [overlaySpecId(config.id), overlayOutlineId(config.id)];
  }
  if (hasDashedLayer(config)) {
    return [overlaySpecId(config.id), overlayDashedId(config.id)];
  }
  return [overlaySpecId(config.id)];
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
      iconColor: pinIconColor(config.color),
    },
  ];
});

/**
 * Builds the sources, layers and pin images of every overlay.
 *
 * Layers are returned in {@link overlayDrawOrder}: polygons, then lines, then
 * points, and within each kind the control's first item on top.
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

  const mapLayers = overlayDrawOrder(OVERLAYS).flatMap((config) => {
    const visible = layers.active[config.id];
    const layer = buildLayer({
      config,
      collection: layers.data[config.id] ?? EMPTY_COLLECTION,
      visible,
      tooltipStyle,
    });

    // Companions right above their own layer, so they keep its place in the
    // draw order.
    return [layer, ...companionLayers({ config, layer, visible })];
  });

  return { sources, layers: mapLayers, images: PIN_IMAGES };
};

/**
 * The spec-driven "Camadas" control. `<GeoVisProvider>` mounts it as a
 * floating button in the map's bottom-left corner whenever `spec.control` is
 * present, as in the `SpecDrivenLayerControl` story of ttoss.
 *
 * Every overlay starts off — they sit on top of the choropleth, not in place
 * of it, and turning one on is what triggers its request — except the ones a
 * shared link switched on (`active`). The control reads `defaultActive` only
 * for a toggle it has not seen yet, so these seed it once and the reader's own
 * toggling takes over from there.
 *
 * @param active - The overlays to open switched on.
 * @returns The control, for `spec.control`.
 */
export const buildLayerControl = (
  active: readonly OverlayId[]
): NonNullable<VisualizationSpec['control']> => {
  return {
    id: 'camadas',
    label: 'Camadas',
    icon: 'lucide:layers',
    position: 'bottom-left',
    // The left sidebar card's own inset (theme space `3` = 0.75rem), so the
    // button lines up with the card when the sidebar is closed.
    offset: 12,
    trigger: 'hover',
    // Two dozen overlays outgrow the map in a single row of cards: show three —
    // the ones switched on first — and tuck the rest behind a "Ver mais" card.
    maxVisibleItems: 3,
    // Three layers at once: a fourth switches off the one on longest, so the
    // pins of a few services never bury the choropleth under them.
    maxActiveItems: 3,
    items: OVERLAYS.map((config) => {
      return {
        id: config.id,
        label: config.label,
        thumbnail: thumbnail(config),
        // A translucent polygon's outline toggles with its fill, a line
        // overlay's dashed features with its solid ones.
        layers: overlayLayerIds(config),
        defaultActive: active.includes(config.id),
      };
    }),
  };
};

/** The control with every overlay off, as the map opens without a link. */
export const LAYER_CONTROL = buildLayerControl([]);
