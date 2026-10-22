'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
// Side-effect import: points maplibre-gl at its bundled worker before any map
// is created (see the module for why the default URL fails).
import '@/components/map/lib/maplibreWorker';
// Side-effect import: registers the Lucide icons GeovisWorkspace renders by
// name, so they resolve from the bundle instead of the Iconify API at runtime.
import '@/components/map/lib/icons';

import { Box } from '@chakra-ui/react';
import { GeovisWorkspace } from '@ttoss/geovis-workspace';
import { I18nProvider } from '@ttoss/react-i18n';
import { BruttalTheme } from '@ttoss/theme/Bruttal';
import * as React from 'react';
import { ThemeUIProvider } from 'theme-ui';

import { FALLBACK_ZOOM, fitZoom } from '@/components/map/lib/mapCamera';
import { buildElderlyHistogram } from '@/components/map/lib/mapRows';
import { subprefeiturasInForce } from '@/components/map/lib/subprefeituraDivision';
import { buildWorkspaceConfig } from '@/components/map/lib/workspaceConfig';
import LoadingIndicator from '@/components/ui/LoadingIndicator';
import { loadLocaleData, LOCALE } from '@/config/i18n';
import { offerAgeBands } from '@/config/offer';
import type { MapsDataContract } from '@/data-gateway/schema';

import MapPanel from './MapPanel';
import {
  nextSelection,
  paintedYearFor,
  type Selection,
  selectionVariables,
  seriesGroupOf,
} from './mapSelection';
import { buildSpec, viewSettingsOf } from './mapSpec';
import { overlaysStore } from './overlaysStore';
import { useColorSettings } from './useColorSettings';
import { useInitialMapUrlState, useMapUrlSync } from './useMapUrlState';
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

/**
 * The zoom that frames the whole mesh in the map's viewport.
 *
 * The viewport is re-read on rotation only (see `subscribeToOrientation`),
 * which is what makes the fit a load-time framing rather than something that
 * fights the user's own panning.
 *
 * @returns The fitted zoom, or the fallback before the viewport is known.
 */
const useFittedZoom = () => {
  const viewport = React.useSyncExternalStore(
    subscribeToOrientation,
    mapViewportSnapshot,
    emptyViewportSnapshot
  );

  return React.useMemo(() => {
    const [width, height] = viewport.split('x').map(Number);

    return width && height ? fitZoom({ width, height }) : FALLBACK_ZOOM;
  }, [viewport]);
};

export type MapsViewProps = {
  mapsData: MapsDataContract;
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
  // A shared link opens on the sender's selection and layers.
  const { defaults, layerControl, ...initial } = useInitialMapUrlState({
    years: mapsData.years,
  });
  // The timeline seeds its year from the config once, so it starts on the
  // link's year too.
  const defaultYear = initial.selection.year;

  const [selection, setSelection] = React.useState<Selection>(
    initial.selection
  );

  const { colors, colorSettings } = useColorSettings({
    ramp: selection.ramp,
    opacity: selection.opacity,
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

  const zoom = useFittedZoom();

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

  // The address follows the selection and the layers switched on.
  useMapUrlSync({
    selection,
    active: overlays.active,
    split: overlays.split,
    defaults,
  });

  const ages = offerAgeBands(selection.age);
  const seriesGroup = seriesGroupOf(selection);

  const paintedYear = paintedYearFor({
    category: selection.category,
    year: selection.year,
    years: mapsData.years,
  });

  const { view, extrusionScale, pitch, bearing } = selection;
  const spec = React.useMemo(() => {
    return buildSpec({
      data: mapsData,
      level: selection.level,
      category: selection.category,
      group: seriesGroup,
      year: paintedYear,
      zoom,
      overlays,
      ages,
      colors,
      control: layerControl,
      view: viewSettingsOf({ view, extrusionScale, pitch, bearing }),
    });
  }, [
    mapsData,
    selection.level,
    selection.category,
    seriesGroup,
    paintedYear,
    zoom,
    overlays,
    ages,
    colors,
    layerControl,
    view,
    extrusionScale,
    pitch,
    bearing,
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
   * re-render the whole sidebar eleven times per run and change nothing. The
   * subprefeitura count feeds it instead: it changes only where the division
   * does.
   */
  const subprefeituraCount = subprefeiturasInForce({
    data: mapsData,
    year: paintedYear,
  }).length;

  const config = React.useMemo(() => {
    const base = buildWorkspaceConfig({
      level: selection.level,
      category: selection.category,
      group: selection.group,
      age: selection.age,
      years: mapsData.years,
      defaultYear,
      elderlyHistogram,
      colorSettings,
      subprefeituraCount,
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
    selection.age,
    mapsData.years,
    defaultYear,
    elderlyHistogram,
    colorSettings,
    subprefeituraCount,
    sidebarInitiallyOpen,
  ]);

  const variables = React.useMemo(() => {
    return selectionVariables(selection);
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
      <I18nProvider locale={LOCALE} loadLocaleData={loadLocaleData}>
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
