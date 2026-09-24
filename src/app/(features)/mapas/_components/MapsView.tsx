'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
// Side-effect import: registers the Lucide icons GeovisWorkspace renders by
// name, so they resolve from the bundle instead of the Iconify API at runtime.
import '@/components/map/lib/icons';

import { Box } from '@chakra-ui/react';
import type { MapHoverInfo, VisualizationSpec } from '@ttoss/geovis';
import { GeovisWorkspace } from '@ttoss/geovis-workspace';
import { I18nProvider } from '@ttoss/react-i18n';
import { BruttalTheme } from '@ttoss/theme/Bruttal';
import * as React from 'react';
import { ThemeUIProvider } from 'theme-ui';

import type { Category, Group } from '@/components/map/lib/indicators';
import {
  DISTRICTS_CENTER,
  FALLBACK_ZOOM,
  fitZoom,
} from '@/components/map/lib/mapCamera';
import { LEGEND_COLORS } from '@/components/map/lib/mapConfig';
import {
  isMapLevel,
  MAP_LEVEL_IDS,
  MAP_LEVELS,
  type MapLevel,
} from '@/components/map/lib/mapLevels';
import {
  buildElderlyHistogram,
  buildMapRows,
} from '@/components/map/lib/mapRows';
import {
  buildWorkspaceConfig,
  CATEGORY_MENU_ID,
  getDefaultGroup,
  GROUP_MENU_ID,
  LEVEL_MENU_ID,
  MAP_TITLES,
  mapDescription,
  YEAR_MENU_ID,
} from '@/components/map/lib/workspaceConfig';
import LoadingIndicator from '@/components/ui/LoadingIndicator';
import { OFFER_YEAR } from '@/config/offer';
import { thresholdsFor } from '@/config/thresholds';
import type { MapsDataContract } from '@/data-gateway/schema';

import { legendLabelFormat, legendReference } from './mapLegend';
import MapPanel from './MapPanel';
import { renderTooltipContent, TOOLTIP_STYLE } from './mapTooltips';
import { buildOverlays, LAYER_CONTROL } from './overlays';
import { type OverlaysSnapshot, overlaysStore } from './overlaysStore';
import {
  emptyViewportSnapshot,
  MAP_HEIGHT,
  mapViewportSnapshot,
  sidebarCoversMap,
  sidebarFitsBesideMap,
  subscribeToOrientation,
  subscribeToSidebarBreakpoint,
} from './viewportStores';

/**
 * Bruttal theme scoped for the GeovisWorkspace sidebars only.
 *
 * theme-ui's <ThemeUIProvider>, when top-level (our app root is Chakra, not
 * theme-ui), renders <RootStyles> which injects the theme's `styles.root` onto
 * the document GLOBALLY — `* { box-sizing }`, `html { ...styles.root }` and,
 * crucially, `html a { font-family, color, text-decoration }`. That leaks into
 * sibling components like the header's "explorar o mapa" button.
 *
 * `config.useRootStyles: false` makes theme-ui skip that global injection
 * entirely (it returns null). The sidebars style themselves via `sx` against
 * the theme context, so they keep their look; only the page-wide root styles
 * are suppressed. Color custom properties (`--theme-ui-*`, namespaced) stay on
 * so sidebar colors still resolve.
 */
const scopedSidebarTheme = {
  ...BruttalTheme,
  config: {
    ...BruttalTheme.config,
    useRootStyles: false,
  },
};

const LEGEND_ID = 'pop-legend';

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
 * @param params.level - The geographic level to paint.
 * @param params.category - The demographic category to visualize.
 * @param params.group - The age group to visualize.
 * @param params.year - The projection year to visualize — for an offer
 * indicator, the fixed year it is painted for, whatever the timeline says.
 * @param params.overlays - The overlays' toggles and loaded data.
 * @returns A complete VisualizationSpec for GeoVis rendering.
 */
const buildSpec = ({
  data,
  level,
  category,
  group,
  year,
  zoom,
  overlays,
}: {
  data: MapsDataContract;
  level: MapLevel;
  category: Category;
  group: Group;
  year: number;
  zoom: number;
  overlays: OverlaysSnapshot;
}): VisualizationSpec => {
  const areas = MAP_LEVELS[level];
  const rows = buildMapRows({
    counts: level === 'distrito' ? data.counts : data.subprefeituraCounts,
    year,
    category,
    group,
  });

  // geovis MapDataRow is strictly `{ geometryId, value }` and its runtime
  // schema sets `additionalProperties: false`. The derived row also carries
  // `name`, `count` and `totalCount` for the tooltip, so those must be
  // stripped here or the spec is rejected and the map never renders. The
  // tooltip is unaffected: it reads the full rows from `rowLookup` below.
  const mapDataRows = rows.map(({ geometryId, value }) => {
    return { geometryId, value };
  });

  const thresholds = thresholdsFor({ category, group });

  const indicator =
    (MAP_TITLES[category] as Partial<Record<string, string>>)[group] ?? '';
  // The year belongs in the legend's own heading: during playback it is the
  // only thing on screen that changes, and a title that omits it leaves the
  // reader watching colours shift with no idea which year they are looking at.
  const offer = category === 'offer-65plus';
  // An offer title already reads "… POR 10 MIL IDOSOS", so the level follows
  // as "EM CADA …" rather than a second "POR".
  const levelPhrase = `${offer ? 'EM CADA' : 'POR'} ${areas.titleNoun}`;
  const title = indicator
    ? `${indicator} ${levelPhrase} — ${year}`
    : String(year);
  const description = mapDescription({ category, group, level });

  // Lookup used by the spec-driven hover tooltip to resolve a feature's row.
  const rowLookup = new Map(
    rows.map((row) => {
      return [row.geometryId, row] as const;
    })
  );

  // Only the aggregated level lists what each area is made of.
  const members =
    level === 'subprefeitura'
      ? new Map(
          data.subprefeituras.map((sub) => {
            return [sub.geometryId, sub.districtNames] as const;
          })
        )
      : undefined;

  const overlayLayers = buildOverlays({
    layers: overlays,
    tooltipStyle: TOOLTIP_STYLE,
  });
  const anyOverlay = Object.values(overlays.active).some(Boolean);

  return {
    engine: 'maplibre',
    basemap: {
      styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    },
    /*
     * Drops MapLibre's attribution control — the round button in the map's
     * bottom-right corner — which crowded the legend panel. The basemap credit
     * it carried moves to the legend's own reference footer (see
     * legendReference); the ODbL obligation is satisfied there, not waived.
     */
    attributionControlEnabled: false,
    view: {
      center: DISTRICTS_CENTER,
      /*
       * Fitted to the container by the caller, so the whole mesh is framed on
       * any screen. Only ever set once per mount (and again on rotation): geovis
       * syncs `view` on every spec change, so recomputing it as the window
       * resizes would yank the camera away from wherever the user had panned to.
       */
      zoom,
    },
    sources: [
      ...MAP_LEVEL_IDS.map((id) => {
        return {
          id: MAP_LEVELS[id].sourceId,
          type: 'geojson' as const,
          data: MAP_LEVELS[id].geojson,
        };
      }),
      ...overlayLayers.sources,
    ],
    layers: [
      {
        id: areas.layerId,
        sourceId: areas.sourceId,
        geometry: 'polygon',
        mapDataId: areas.mapDataId,
        activeLegendId: LEGEND_ID,
        legends: [
          {
            id: LEGEND_ID,
            title,
            subtitle: description,
            // geovis' provider auto-renders any legend that carries a
            // `position`, so this appears as an overlay in the map's bottom-right
            // corner — replacing the old right sidebar with no extra wiring.
            position: 'bottom-right',
            // Inset from the anchored map edges, in pixels — a single value
            // applies to both axes (geovis defaults to 24).
            //
            // 12 is exactly the left sidebar card's own inset, so the legend
            // keeps the same distance from the map edges as the card does:
            // SidebarOverlay insets it with `padding: [0, "3"]`, and theme
            // space `3` is 0.75rem. No allowance for maplibre's attribution
            // toggle is needed anymore — the spec drops that control (see
            // `attributionControlEnabled` above), which is what previously
            // claimed this same bottom-right corner.
            offset: 12,
            colorBy: {
              type: 'quantitative',
              property: 'value',
              scale: 'threshold',
              thresholds,
              colors: LEGEND_COLORS,
            },
            // Values are proportions in [0, 1]; render each bin as a percent
            // range (`< 5%`, `5% – 10%`, … `> 30%`) instead of raw breaks.
            labelFormat: legendLabelFormat(category),
            reference: legendReference({
              level,
              year,
              years: data.years,
              overlays: anyOverlay,
              offer,
            }),
          },
        ],
        hoverTooltip: {
          render: (info: MapHoverInfo) => {
            return renderTooltipContent({
              featureId: info.featureId,
              rowLookup,
              members,
              category,
              group,
              thresholds,
            });
          },
          style: TOOLTIP_STYLE,
        },
      },
      // Last, so the overlays draw above the area fill.
      ...overlayLayers.layers,
    ],
    control: LAYER_CONTROL,
    mapData: [
      {
        mapDataId: areas.mapDataId,
        mapId: areas.sourceId,
        data: mapDataRows,
      },
    ],
  };
};

/**
 * Wrapper styles that make GeovisWorkspace fill its container.
 *
 * Since 0.10.0 GeovisWorkspace nests its flex root inside an extra
 * `position: relative` Box, and that root only carries `min-height: 440px` — it
 * never stretches. So the wrapper has to be filled and the root told to grow,
 * or the map collapses to 440px tall.
 *
 * The wrapper is turned into a flex container instead of sizing the root
 * directly: geovis renders the positioned legend as a SIBLING of that root, and
 * absolutely-positioned elements are not flex items, so `flex: 1` stretches the
 * map while leaving the legend untouched. The card border/radius is dropped via
 * `appearance: "bare"` in the config (see buildWorkspaceConfig), not here.
 *
 * Applied only on the mounted branch — the loading state renders inside its own
 * plain wrapper, since the `& > *` rule here would stretch it into a flex row.
 */
const GEOVIS_FILL_CSS = {
  '& > *': {
    height: '100%',
    width: '100%',
    display: 'flex',
  },
  '& > * > *': {
    flex: 1,
    minWidth: 0,
  },
};

/*
 * Hydration probe for `useSyncExternalStore` below: a store that never changes,
 * reads `false` on the server and `true` on the client. Module-level so the
 * three callbacks keep stable identities across renders.
 */
const subscribeToNothing = () => {
  return () => {};
};
const isClient = () => {
  return true;
};
const isServer = () => {
  return false;
};

export type MapsViewProps = {
  mapsData: MapsDataContract;
};

/**
 * Projection year the map opens on: the present-day one when the series carries
 * it, otherwise the first year available. Chosen over `years[0]` so the first
 * paint describes the city as it is now rather than as it was in 2000, and the
 * timeline can be played in either direction from there.
 */
const INITIAL_YEAR = 2025;

/**
 * Resolves the year the map opens on from the years the snapshot carries.
 *
 * @param years - Projection years, ascending.
 * @returns {@link INITIAL_YEAR} when present, else the earliest year.
 *
 * @example
 * initialYear([2000, 2025, 2050]); // 2025
 * initialYear([2010, 2020]); // 2010
 */
const initialYear = (years: number[]): number => {
  return years.includes(INITIAL_YEAR) ? INITIAL_YEAR : (years[0] ?? 0);
};

/** What the sidebar selects: level, indicator, band or service, and year. */
type Selection = {
  level: MapLevel;
  category: Category;
  group: Group;
  year: number;
};

/**
 * The selection after the sidebar reports its menus' values.
 *
 * The level and the year are axes of their own: switching either never resets
 * the rest. A new category resets the group to the category's first option,
 * since the groups available depend on it (cascading behaviour) — but not the
 * year, which would otherwise undo the user's place in the animation on every
 * menu click.
 *
 * @param params.prev - The current selection.
 * @param params.next - The sidebar's values, keyed by menu id. The timeline
 * reports its year as a string on every tick; one the snapshot does not carry
 * is dropped rather than painted, since no area has rows for it and the map
 * would go blank.
 * @param params.years - Projection years the snapshot carries.
 * @returns The next selection.
 *
 * @example
 * nextSelection({ prev, next: { category: 'offer-65plus' }, years });
 * // { ...prev, category: 'offer-65plus', group: 'ubs' }
 */
const nextSelection = ({
  prev,
  next,
  years,
}: {
  prev: Selection;
  next: Record<string, string | undefined>;
  years: number[];
}): Selection => {
  const reportedYear = Number(next[YEAR_MENU_ID]);
  const year = years.includes(reportedYear) ? reportedYear : prev.year;

  const reportedLevel = next[LEVEL_MENU_ID];
  const level = isMapLevel(reportedLevel) ? reportedLevel : prev.level;

  const category = (next[CATEGORY_MENU_ID] ?? prev.category) as Category;
  const group =
    category === prev.category
      ? ((next[GROUP_MENU_ID] ?? prev.group) as Group)
      : getDefaultGroup(category);

  return { level, category, group, year };
};

/**
 * The year the map paints for a selection.
 *
 * The offer indicators pair today's facilities with one projection year, so
 * they paint {@link OFFER_YEAR} whatever the timeline holds — or the opening
 * year, should a snapshot lack it. The timeline's own year is not touched: its
 * tab is disabled meanwhile, and picking a share indicator again resumes it
 * where it was.
 *
 * @param params.category - The selected category.
 * @param params.year - The timeline's year.
 * @param params.years - Projection years the snapshot carries.
 * @returns The year to paint.
 *
 * @example
 * paintedYearFor({ category: 'offer-65plus', year: 2050, years }); // 2025
 */
const paintedYearFor = ({
  category,
  year,
  years,
}: {
  category: Category;
  year: number;
  years: number[];
}): number => {
  if (category !== 'offer-65plus') {
    return year;
  }

  return years.includes(OFFER_YEAR) ? OFFER_YEAR : initialYear(years);
};

/**
 * Interactive client component for the demographic maps visualization.
 *
 * Receives pre-fetched canonical maps data from the server component parent and
 * owns the client-side level/category/group/year selection. The GeovisWorkspace
 * renders the map canvas and the left sidebar (category and age-group menus
 * plus the projection-year timeline), driven by the spec and config rebuilt on
 * each selection change — including every timeline tick during playback.
 *
 * @param props.mapsData - Canonical maps data from the gateway.
 */
export const MapsView = ({ mapsData }: MapsViewProps) => {
  const defaultYear = initialYear(mapsData.years);

  const [selection, setSelection] = React.useState<Selection>({
    level: 'distrito',
    category: 'cumulative-total',
    group: '65',
    year: defaultYear,
  });

  /*
   * GeovisWorkspace mounts maplibre-gl, which only runs in the browser. Gate it
   * behind a hydration flag so the server render (and the matching first client
   * render) paint the loading indicator instead, and the map is created exactly
   * once, client-side.
   *
   * `useSyncExternalStore` rather than the `useState` + `useEffect` idiom: it
   * expresses "which environment is rendering" as a snapshot, which is what the
   * flag actually is, and it does not trip the compiler's
   * `react-hooks/set-state-in-effect` rule.
   */
  const mounted = React.useSyncExternalStore(
    subscribeToNothing,
    isClient,
    isServer
  );

  /*
   * Re-read on rotation only (see `subscribeToOrientation`), which is what makes
   * the fit below a load-time framing rather than something that fights the
   * user's own panning.
   */
  const viewport = React.useSyncExternalStore(
    subscribeToOrientation,
    mapViewportSnapshot,
    emptyViewportSnapshot
  );

  const zoom = React.useMemo(() => {
    const [width, height] = viewport.split('x').map(Number);

    return width && height ? fitZoom({ width, height }) : FALLBACK_ZOOM;
  }, [viewport]);

  /*
   * The sidebar starts open only where it does not cover the map: below the
   * breakpoint it is a full-screen panel, so an open one would make the map's
   * first paint invisible — the user would land on the filters instead of the
   * city.
   *
   * It reaches the workspace through `config.leftSidebar.initialState`, not as a
   * prop: `GeovisWorkspace` owns the open state and exposes no way to control
   * it. Because that config field is read once, when the workspace seeds its
   * state, the user's own toggling is never overridden afterwards.
   */
  const sidebarInitiallyOpen = React.useSyncExternalStore(
    subscribeToSidebarBreakpoint,
    sidebarFitsBesideMap,
    sidebarCoversMap
  );

  /*
   * Written by `MapPanel` when a layer toggle flips, and by the store's own
   * requests when they land (see `overlaysStore`).
   */
  const overlays = React.useSyncExternalStore(
    overlaysStore.subscribe,
    overlaysStore.getSnapshot,
    overlaysStore.getServerSnapshot
  );

  const paintedYear = paintedYearFor({
    category: selection.category,
    year: selection.year,
    years: mapsData.years,
  });

  const spec = React.useMemo(() => {
    return buildSpec({
      data: mapsData,
      level: selection.level,
      category: selection.category,
      group: selection.group,
      year: paintedYear,
      zoom,
      overlays,
    });
  }, [
    mapsData,
    selection.level,
    selection.category,
    selection.group,
    paintedYear,
    zoom,
    overlays,
  ]);

  /*
   * Independent of `selection`: the 65+ total per year is the same series
   * whatever the active indicator, so it is fitted once for the whole session
   * instead of on every timeline tick.
   */
  const elderlyHistogram = React.useMemo(() => {
    return buildElderlyHistogram({
      counts: mapsData.counts,
      years: mapsData.years,
    });
  }, [mapsData]);

  /*
   * Deliberately not keyed on `selection.year`: the sidebar config only seeds
   * the timeline's initial value, so rebuilding it on every playback tick would
   * re-render the whole sidebar eleven times per run and change nothing.
   */
  const config = React.useMemo(() => {
    const base = buildWorkspaceConfig({
      level: selection.level,
      category: selection.category,
      group: selection.group,
      years: mapsData.years,
      defaultYear,
      elderlyHistogram,
      sidebarInitiallyOpen,
    });

    // The `map` slot is overridden here rather than in `buildWorkspaceConfig`,
    // which stays free of this route's components: `MapPanel` is what relays
    // the layer toggles out of the geovis provider (see its docs).
    return {
      ...base,
      slots: { ...base.slots, map: { component: MapPanel } },
    };
  }, [
    selection.level,
    selection.category,
    selection.group,
    mapsData.years,
    defaultYear,
    elderlyHistogram,
    sidebarInitiallyOpen,
  ]);

  const variables = React.useMemo(() => {
    return {
      [LEVEL_MENU_ID]: selection.level,
      [CATEGORY_MENU_ID]: selection.category,
      [GROUP_MENU_ID]: selection.group,
      // The timeline publishes and reads its value as a string.
      [YEAR_MENU_ID]: String(selection.year),
    };
  }, [selection]);

  const handleVariableChange = (next: Record<string, string | undefined>) => {
    setSelection((prev) => {
      return nextSelection({ prev, next, years: mapsData.years });
    });
  };

  if (!mounted) {
    return (
      <Box height={MAP_HEIGHT} width="100%" position="relative">
        <LoadingIndicator label="Carregando mapa" />
      </Box>
    );
  }

  return (
    <Box
      height={MAP_HEIGHT}
      width="100%"
      overflow="hidden"
      css={GEOVIS_FILL_CSS}
    >
      <I18nProvider locale="pt-BR">
        {/*
         * Scope the GeovisWorkspace sidebars to theme-ui's provider ONLY, with
         * global root styles disabled (see scopedSidebarTheme). @ttoss/ui's own
         * <ThemeProvider> is avoided because it also mounts a second Chakra v3
         * system whose global `--chakra-*` variables clobber the app's tokens.
         * The sidebars only use theme-ui primitives (Box/Flex/Heading/
         * IconButton/Link/Text), so the theme-ui context is all they need.
         */}
        <ThemeUIProvider theme={scopedSidebarTheme}>
          <GeovisWorkspace
            config={config}
            visualizationSpec={spec}
            variables={variables}
            onVariableChange={handleVariableChange}
          />
        </ThemeUIProvider>
      </I18nProvider>
    </Box>
  );
};
