import type { MapHoverInfo, VisualizationSpec } from '@ttoss/geovis';

import type { Category, Group } from '@/components/map/lib/indicators';
import { DISTRICTS_CENTER } from '@/components/map/lib/mapCamera';
import {
  MAP_LEVEL_IDS,
  MAP_LEVELS,
  type MapLevel,
} from '@/components/map/lib/mapLevels';
import { buildMapRows, offerAgeShare } from '@/components/map/lib/mapRows';
import {
  areaLayerFilter,
  paintedLevelFor,
  subprefeiturasInForce,
} from '@/components/map/lib/subprefeituraDivision';
import {
  DEFAULT_BEARING,
  DEFAULT_EXTRUSION_SCALE,
  DEFAULT_PITCH,
  type MapView,
} from '@/components/map/lib/viewMode';
import { mapDescription, mapTitle } from '@/components/map/lib/workspaceConfig';
import { isOfferCategory, type OfferAgeBand } from '@/config/offer';
import { scaleOfferThresholds, thresholdsFor } from '@/config/thresholds';
import type { MapsDataContract } from '@/data-gateway/schema';

import { legendLabelFormat, legendReference } from './mapLegend';
import type { Selection } from './mapSelection';
import { renderTooltipContent, TOOLTIP_STYLE } from './mapTooltips';
import { buildOverlays } from './overlays';
import type { OverlaysSnapshot } from './overlaysStore';

const LEGEND_ID = 'pop-legend';

/**
 * Height, in metres, of the most populous area at `1×` on the "Altura das
 * extrusões" ladder. The heights are proportional to the population
 * (`'continuous'`), so this sets the scale of the whole mesh; the default `5×`
 * stands Grajaú's ~400 thousand residents 10 km tall at the city-wide zoom.
 */
const EXTRUSION_BASE_HEIGHT = 2000;

/**
 * The spec's fixed part: the engine and the basemap.
 *
 * MapLibre's attribution control — the round button in the map's
 * bottom-right corner — is dropped, as it crowded the legend panel. The
 * basemap credit it carried moves to the legend's own reference footer (see
 * legendReference); the ODbL obligation is satisfied there, not waived.
 */
const BASE_SPEC = {
  engine: 'maplibre' as const,
  basemap: { styleUrl: 'https://tiles.openfreemap.org/styles/positron' },
  attributionControlEnabled: false,
};

/**
 * Both levels' geometries, always in the spec: switching level never
 * refetches one.
 */
const LEVEL_SOURCES = MAP_LEVEL_IDS.map((id) => {
  const { sourceId, geojson } = MAP_LEVELS[id];
  return { id: sourceId, type: 'geojson' as const, data: geojson };
});

/** How long the camera eases between pitches and bearings, in milliseconds. */
const CAMERA_ANGLE_TRANSITION_MS = 600;

/** The "Visualização" choice and its 3D adjustments, as numbers. */
type ViewSettings = {
  view: MapView;
  extrusionScale: number;
  pitch: number;
  bearing: number;
};

/** A published setting as a number, its default when it is not one. */
const numberOr = ({
  value,
  fallback,
}: {
  value: string;
  fallback: number;
}): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * The view settings of a selection, its 3D adjustments parsed from the strings
 * their controls publish — the defaults standing in for any that do not parse.
 *
 * @param selection - The sidebar selection.
 * @returns The settings for `buildSpec`.
 */
export const viewSettingsOf = (
  selection: Pick<Selection, 'view' | 'extrusionScale' | 'pitch' | 'bearing'>
): ViewSettings => {
  return {
    view: selection.view,
    extrusionScale: numberOr({
      value: selection.extrusionScale,
      fallback: DEFAULT_EXTRUSION_SCALE,
    }),
    pitch: numberOr({ value: selection.pitch, fallback: DEFAULT_PITCH }),
    bearing: numberOr({ value: selection.bearing, fallback: DEFAULT_BEARING }),
  };
};

/**
 * The spec's 3D parts. In 3D, on any indicator, each area rises by its total
 * population: a dataset of its own beside the indicator's, so the colour keeps
 * reading the indicator and the height reads how many people live where it is
 * read. In 2D every part is empty, and the angles ease back to a flat,
 * north-up map.
 *
 * @param params.settings - The view and its 3D adjustments.
 * @param params.mapId - The painted level's source id.
 * @param params.mapDataId - The painted level's indicator dataset id.
 * @param params.counts - The painted level's counts, every year.
 * @param params.year - The year painted.
 * @returns The camera angles, the area layer's `extrusion`, the population
 * dataset and the legend's note on the height.
 */
const buildExtrusion = ({
  settings: { view, extrusionScale, pitch, bearing },
  mapId,
  mapDataId,
  counts,
  year,
}: {
  settings: ViewSettings;
  mapId: string;
  mapDataId: string;
  counts: MapsDataContract['counts'];
  year: number;
}) => {
  if (view !== '3d') {
    return { angles: { pitch: 0, bearing: 0 }, layer: {}, mapData: [] };
  }

  const populationMapDataId = `${mapDataId}-populacao`;

  return {
    angles: { pitch, bearing },
    layer: {
      // Its own dataset, proportional to the head count: no class breaks, so
      // `'continuous'`. The year's figures, so the prisms grow along the
      // timeline as the city does.
      extrusion: {
        mapDataId: populationMapDataId,
        mode: 'continuous' as const,
        maxHeight: EXTRUSION_BASE_HEIGHT * extrusionScale,
      },
    },
    // A `stateKey` apart from the indicator's: both write the same areas'
    // feature-state.
    mapData: [
      {
        mapDataId: populationMapDataId,
        mapId,
        stateKey: 'population',
        data: counts
          .filter((entry) => {
            return entry.year === year;
          })
          .map((entry) => {
            return { geometryId: entry.geometryId, value: entry.total };
          }),
      },
    ],
    note: 'A altura de cada área é proporcional à sua população total.',
  };
};

/**
 * The area layer's legend, anchored over the map's bottom-right corner.
 *
 * @param params.title - The legend heading.
 * @param params.subtitle - The description below it.
 * @param params.thresholds - The class breaks.
 * @param params.colors - The class colours.
 * @param params.category - The indicator, which sets the label format.
 * @param params.reference - The legend's reference footer.
 * @returns The legend for the area layer's `legends`.
 */
const buildLegend = ({
  title,
  subtitle,
  thresholds,
  colors,
  category,
  reference,
}: {
  title: string;
  subtitle: string;
  thresholds: number[];
  colors: string[];
  category: Category;
  reference: ReturnType<typeof legendReference>;
}) => {
  return {
    id: LEGEND_ID,
    title,
    subtitle,
    // geovis' provider auto-renders any legend that carries a `position`, so
    // this appears as an overlay in the map's bottom-right corner — replacing
    // the old right sidebar with no extra wiring.
    position: 'bottom-right' as const,
    // Inset from the anchored map edges, in pixels — a single value applies
    // to both axes (geovis defaults to 24).
    //
    // 12 is exactly the left sidebar card's own inset, so the legend keeps the
    // same distance from the map edges as the card does: SidebarOverlay insets
    // it with `padding: [0, "3"]`, and theme space `3` is 0.75rem. No
    // allowance for maplibre's attribution toggle is needed anymore — the spec
    // drops that control (see `BASE_SPEC`),
    // which is what previously claimed this same bottom-right corner.
    offset: 12,
    colorBy: {
      type: 'quantitative' as const,
      property: 'value',
      scale: 'threshold' as const,
      thresholds,
      colors,
    },
    // Values are proportions in [0, 1]; render each bin as a percent range
    // (`< 5%`, `5% – 10%`, … `> 30%`) instead of raw breaks.
    labelFormat: legendLabelFormat(category),
    reference,
  };
};

/**
 * The class breaks of an indicator. An offer indicator's are scaled against
 * the district counts at either level, so both share one set of breaks as
 * they do for every series.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.category - The indicator.
 * @param params.group - The age group or service.
 * @param params.year - The year painted.
 * @param params.ages - The offer indicator's age bands.
 * @returns The thresholds for the legend and the tooltip.
 */
const thresholdsOf = ({
  data,
  category,
  group,
  year,
  ages,
}: {
  data: MapsDataContract;
  category: Category;
  group: Group;
  year: number;
  ages: readonly OfferAgeBand[];
}) => {
  const thresholds = thresholdsFor({ category, group });

  return isOfferCategory(category)
    ? scaleOfferThresholds({
        thresholds,
        share: offerAgeShare({ counts: data.counts, year, ages }),
      })
    : thresholds;
};

/**
 * The legend's heading and subtitle.
 *
 * The year belongs in the heading: during playback it is the only thing on
 * screen that changes, and a title that omits it leaves the reader watching
 * colours shift with no idea which year they are looking at. An offer title
 * already reads "… POR 10 MIL IDOSOS", so the level follows as "EM CADA …"
 * rather than a second "POR".
 *
 * @param params.category - The indicator.
 * @param params.group - The age group or service.
 * @param params.ages - The offer indicator's age bands.
 * @param params.level - The level painted.
 * @param params.year - The year painted.
 * @param params.notes - Sentences appended to the subtitle, empty ones dropped.
 * @returns The legend's `title` and `subtitle`.
 */
const legendText = ({
  category,
  group,
  ages,
  level,
  year,
  notes,
}: {
  category: Category;
  group: Group;
  ages: readonly OfferAgeBand[];
  level: MapLevel;
  year: number;
  notes: (string | undefined)[];
}) => {
  const indicator = mapTitle({ category, group, ages });
  const levelPhrase = `${isOfferCategory(category) ? 'EM CADA' : 'POR'} ${MAP_LEVELS[level].titleNoun}`;

  return {
    title: indicator ? `${indicator} ${levelPhrase} — ${year}` : String(year),
    subtitle: [mapDescription({ category, group, level, ages }), ...notes]
      .filter(Boolean)
      .join(' '),
  };
};

/**
 * The area layer's spec-driven hover tooltip.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The level painted.
 * @param params.year - The year painted.
 * @param params.rows - The year's full rows, which the tooltip reads.
 * @param params.category - The indicator.
 * @param params.group - The age group or service.
 * @param params.thresholds - The class breaks.
 * @param params.ages - The offer indicator's age bands.
 * @param params.colors - The class colours.
 * @returns The area layer's `hoverTooltip`.
 */
const buildHoverTooltip = ({
  data,
  level,
  year,
  rows,
  ...content
}: {
  data: MapsDataContract;
  level: MapLevel;
  year: number;
  rows: ReturnType<typeof buildMapRows>;
  category: Category;
  group: Group;
  thresholds: number[];
  ages: readonly OfferAgeBand[];
  colors: string[];
}) => {
  // Resolves a feature's row.
  const rowLookup = new Map(
    rows.map((row) => {
      return [row.geometryId, row] as const;
    })
  );

  // Only the aggregated level lists what each area is made of — the districts
  // of the version in force that year, since one id can have had several.
  const members =
    level === 'subprefeitura'
      ? new Map(
          subprefeiturasInForce({ data, year }).map((sub) => {
            return [sub.geometryId, sub.districtNames] as const;
          })
        )
      : undefined;

  return {
    render: (info: MapHoverInfo) => {
      return renderTooltipContent({
        featureId: info.featureId,
        rowLookup,
        members,
        ...content,
      });
    },
    style: TOOLTIP_STYLE,
  };
};

/**
 * The painted level's fill layer: its legend, its hover tooltip and, in 3D,
 * its extrusion.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The level painted.
 * @param params.year - The year painted.
 * @param params.rows - The year's full rows.
 * @param params.thresholds - The class breaks.
 * @param params.extrusion - The spec's 3D parts (see `buildExtrusion`).
 * @param params.notes - Sentences appended to the legend subtitle.
 * @param params.overlays - Whether any overlay is on, for the legend footer.
 * @param params.indicator - The indicator, its group, ages and colours.
 * @returns The area layer for the spec's `layers`.
 */
const buildAreaLayer = ({
  data,
  level,
  year,
  rows,
  thresholds,
  extrusion,
  notes,
  overlays,
  indicator,
}: {
  data: MapsDataContract;
  level: MapLevel;
  year: number;
  rows: ReturnType<typeof buildMapRows>;
  thresholds: number[];
  extrusion: ReturnType<typeof buildExtrusion>;
  notes: (string | undefined)[];
  overlays: boolean;
  indicator: {
    category: Category;
    group: Group;
    ages: readonly OfferAgeBand[];
    colors: string[];
  };
}) => {
  const areas = MAP_LEVELS[level];
  const { category, colors } = indicator;

  return {
    id: areas.layerId,
    sourceId: areas.sourceId,
    geometry: 'polygon' as const,
    ...areaLayerFilter({ data, level, year }),
    mapDataId: areas.mapDataId,
    activeLegendId: LEGEND_ID,
    ...extrusion.layer,
    legends: [
      buildLegend({
        ...legendText({ ...indicator, level, year, notes }),
        thresholds,
        colors,
        category,
        reference: legendReference({
          level,
          year,
          years: data.years,
          overlays,
          offer: isOfferCategory(category),
        }),
      }),
    ],
    hoverTooltip: buildHoverTooltip({
      data,
      level,
      year,
      rows,
      thresholds,
      ...indicator,
    }),
  };
};

/**
 * Builds a GeoVis VisualizationSpec for rendering a choropleth map, including a
 * spec-driven hover tooltip on the area layer.
 *
 * Rebuilt on every timeline tick, so the work per call is one pass over the
 * year's areas (`buildMapRows`) — the class breaks are fixed per series and
 * never refitted, which is what keeps a colour comparable across years.
 *
 * Both levels' sources stay in the spec, so switching level never refetches a
 * geometry; only the active level has a fill layer and a join. The two levels
 * share the class breaks: a colour means the same share whether it paints a
 * district or a subprefeitura, at the cost of a flatter subprefeitura map,
 * since summing districts smooths out their extremes.
 *
 * @param params.data - Canonical maps data from the gateway.
 * @param params.level - The geographic level selected. A year with no
 * subprefeitura division paints the districts instead, with a note in the
 * legend subtitle (see `paintedLevelFor`).
 * @param params.category - The demographic category to visualize.
 * @param params.group - The age group to visualize.
 * The subprefeitura level is versioned — the division changed over the
 * series — so its layer is filtered to the subprefeituras in force in the year
 * painted: one GeoJSON holds every version, and a year change only swaps the
 * filter, never the geometry.
 *
 * @param params.year - The projection year to visualize — for an offer
 * indicator, the fixed year it is painted for, whatever the timeline says.
 * @param params.overlays - The overlays' toggles and loaded data.
 * @param params.ages - For an offer indicator, the age bands its rate is set
 * against (its "Faixa etária" menu). Its class breaks are scaled to them, since a
 * narrower population raises every rate.
 * @param params.colors - The class colours, from the "Configurações" tab's
 * ramp and opacity: the legend carries them, and geovis paints the fill from
 * the legend.
 * @param params.control - The "Camadas" control, seeded with the layers a
 * shared link switched on.
 * @param params.view - The "Visualização" choice and its 3D adjustments (see
 * `viewSettingsOf` and `buildExtrusion`).
 * @returns A complete VisualizationSpec for GeoVis rendering.
 */
export const buildSpec = ({
  data,
  level: selectedLevel,
  year,
  zoom,
  overlays,
  control,
  view,
  ...indicator
}: {
  data: MapsDataContract;
  level: MapLevel;
  category: Category;
  group: Group;
  year: number;
  zoom: number;
  overlays: OverlaysSnapshot;
  ages: readonly OfferAgeBand[];
  colors: string[];
  control: NonNullable<VisualizationSpec['control']>;
  view: ViewSettings;
}): VisualizationSpec => {
  const { level, note } = paintedLevelFor({ data, level: selectedLevel, year });
  const areas = MAP_LEVELS[level];
  const counts = level === 'distrito' ? data.counts : data.subprefeituraCounts;
  const rows = buildMapRows({ counts, year, ...indicator });
  const thresholds = thresholdsOf({ data, year, ...indicator });
  const extrusion = buildExtrusion({
    settings: view,
    mapId: areas.sourceId,
    mapDataId: areas.mapDataId,
    counts,
    year,
  });
  const overlayLayers = buildOverlays({
    layers: overlays,
    tooltipStyle: TOOLTIP_STYLE,
  });

  return {
    ...BASE_SPEC,
    view: {
      center: DISTRICTS_CENTER,
      /*
       * Fitted to the container by the caller, so the whole mesh is framed on
       * any screen. Only ever set once per mount (and again on rotation): geovis
       * syncs `view` on every spec change, so recomputing it as the window
       * resizes would yank the camera away from wherever the user had panned to.
       * Only the angles change between the views, so the view sync eases them
       * and leaves the centre and zoom where the reader panned to.
       */
      zoom,
      ...extrusion.angles,
      cameraAngleTransitionMs: CAMERA_ANGLE_TRANSITION_MS,
    },
    sources: [...LEVEL_SOURCES, ...overlayLayers.sources],
    layers: [
      buildAreaLayer({
        data,
        level,
        year,
        rows,
        thresholds,
        extrusion,
        notes: [note, extrusion.note],
        overlays: Object.values(overlays.active).some(Boolean),
        indicator,
      }),
      // Last, so the overlays draw above the area fill.
      ...overlayLayers.layers,
    ],
    control,
    images: overlayLayers.images,
    mapData: [
      // geovis MapDataRow is strictly `{ geometryId, value }` and its runtime
      // schema sets `additionalProperties: false`. The derived row also carries
      // `name`, `count` and `totalCount` for the tooltip, so those must be
      // stripped here or the spec is rejected and the map never renders. The
      // tooltip is unaffected: it reads the full rows.
      {
        mapDataId: areas.mapDataId,
        mapId: areas.sourceId,
        data: rows.map(({ geometryId, value }) => {
          return { geometryId, value };
        }),
      },
      // Only in 3D (see `buildExtrusion`).
      ...extrusion.mapData,
    ],
  };
};
