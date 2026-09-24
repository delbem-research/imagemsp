/**
 * Central icon registry for the IMAGEM:SP app.
 *
 * Convention:
 *   - UI navigation / menus  → Phosphor regular (line)  e.g. "ph:caret-left"
 *   - Interactive controls   → Phosphor bold            e.g. "ph:caret-left-bold"
 *   - Active / highlight     → Phosphor fill            e.g. "ph:caret-left-fill"
 *   - Map pins / POI markers → Maki                     e.g. "maki:hospital"
 *   - Vendored (geovis)      → Lucide                   e.g. "lucide:circle"
 *
 * Add icons here before use to avoid Iconify API calls in production.
 * Import path: @iconify/icons-<prefix>/<icon-name>
 */
// Lucide — NOT used by our own components. @ttoss/geovis-workspace renders
// these names directly and ships no addIcon of its own, so without registering
// them here the workspace sidebar would fetch them from the Iconify API at
// runtime. `lucide:circle` is the fallback for every sidebar variation AND
// every section header, so it always renders; the rest cover the sidebar
// toggle, carousel, collapse and the filter/timeline/locator controls.
import lucideChevronDown from '@iconify/icons-lucide/chevron-down';
import lucideChevronLeft from '@iconify/icons-lucide/chevron-left';
import lucideChevronRight from '@iconify/icons-lucide/chevron-right';
import lucideChevronsLeft from '@iconify/icons-lucide/chevrons-left';
import lucideCircle from '@iconify/icons-lucide/circle';
import lucideLayers from '@iconify/icons-lucide/layers';
import lucideLayoutList from '@iconify/icons-lucide/layout-list';
import lucidePause from '@iconify/icons-lucide/pause';
import lucidePlay from '@iconify/icons-lucide/play';
import lucideSearch from '@iconify/icons-lucide/search';
import lucideSlidersHorizontal from '@iconify/icons-lucide/sliders-horizontal';
import lucideX from '@iconify/icons-lucide/x';
import lucideZoomIn from '@iconify/icons-lucide/zoom-in';
// Phosphor — double caret (bold for toggle buttons)
// Phosphor — variacoes de faixa etaria na sidebar do mapa
import phArrowsInLineHorizontal from '@iconify/icons-ph/arrows-in-line-horizontal';
import phBuildings from '@iconify/icons-ph/buildings';
import phCalendarBlank from '@iconify/icons-ph/calendar-blank';
import phCaretDoubleLeftBold from '@iconify/icons-ph/caret-double-left-bold';
import phCaretDoubleRightBold from '@iconify/icons-ph/caret-double-right-bold';
// Phosphor — line style (menus, labels, decorative)
import phCaretLeft from '@iconify/icons-ph/caret-left';
// Phosphor — navigation (bold for WCAG AAA on interactive controls)
import phCaretLeftBold from '@iconify/icons-ph/caret-left-bold';
import phCaretRight from '@iconify/icons-ph/caret-right';
import phCaretRightBold from '@iconify/icons-ph/caret-right-bold';
// Phosphor — sidebar do mapa (cabecalhos de secao e variacoes de indicador)
import phChartBar from '@iconify/icons-ph/chart-bar';
import phChartDonut from '@iconify/icons-ph/chart-donut';
import phChartPieSlice from '@iconify/icons-ph/chart-pie-slice';
import phClock from '@iconify/icons-ph/clock';
import phFirstAid from '@iconify/icons-ph/first-aid';
import phFirstAidKit from '@iconify/icons-ph/first-aid-kit';
import phForkKnife from '@iconify/icons-ph/fork-knife';
import phGauge from '@iconify/icons-ph/gauge';
import phMapTrifold from '@iconify/icons-ph/map-trifold';
import phPlusCircle from '@iconify/icons-ph/plus-circle';
import phPolygon from '@iconify/icons-ph/polygon';
import phSoccerBall from '@iconify/icons-ph/soccer-ball';
import phSquaresFour from '@iconify/icons-ph/squares-four';
import phStorefront from '@iconify/icons-ph/storefront';
import phUsersThree from '@iconify/icons-ph/users-three';
import { addIcon, Icon } from '@ttoss/react-icons';

// Register bundled icons (no API call in production)
addIcon('ph:caret-left-bold', phCaretLeftBold);
addIcon('ph:caret-right-bold', phCaretRightBold);
addIcon('ph:caret-double-left-bold', phCaretDoubleLeftBold);
addIcon('ph:caret-double-right-bold', phCaretDoubleRightBold);
addIcon('ph:caret-left', phCaretLeft);
addIcon('ph:caret-right', phCaretRight);
addIcon('ph:gauge', phGauge);
addIcon('ph:users-three', phUsersThree);
addIcon('ph:chart-pie-slice', phChartPieSlice);
addIcon('ph:chart-donut', phChartDonut);
addIcon('ph:chart-bar', phChartBar);
addIcon('ph:plus-circle', phPlusCircle);
addIcon('ph:arrows-in-line-horizontal', phArrowsInLineHorizontal);
addIcon('ph:calendar-blank', phCalendarBlank);
addIcon('ph:clock', phClock);
addIcon('ph:map-trifold', phMapTrifold);
addIcon('ph:squares-four', phSquaresFour);
addIcon('ph:polygon', phPolygon);
addIcon('ph:buildings', phBuildings);
addIcon('ph:storefront', phStorefront);
addIcon('ph:first-aid-kit', phFirstAidKit);
addIcon('ph:first-aid', phFirstAid);
addIcon('ph:fork-knife', phForkKnife);
addIcon('ph:soccer-ball', phSoccerBall);

// Register the Lucide icons @ttoss/geovis-workspace renders by name
addIcon('lucide:circle', lucideCircle);
addIcon('lucide:chevrons-left', lucideChevronsLeft);
addIcon('lucide:chevron-left', lucideChevronLeft);
addIcon('lucide:chevron-right', lucideChevronRight);
addIcon('lucide:chevron-down', lucideChevronDown);
addIcon('lucide:x', lucideX);
addIcon('lucide:search', lucideSearch);
addIcon('lucide:sliders-horizontal', lucideSlidersHorizontal);
addIcon('lucide:zoom-in', lucideZoomIn);
addIcon('lucide:play', lucidePlay);
addIcon('lucide:pause', lucidePause);
// Not rendered by the workspace: this one is ours, on the variations tab, and
// matches the icon cozsolidarias uses for the same tab.
addIcon('lucide:layout-list', lucideLayoutList);
// Ours too: the trigger of the "Camadas" layer control (`spec.control.icon`),
// which geovis renders by name — the same icon cozsolidarias uses there.
addIcon('lucide:layers', lucideLayers);

export { Icon };

// Icon name constants — use these instead of raw strings to get typo safety
export const ICONS = {
  // Navigation — bold (WCAG AAA: interactive controls)
  caretLeftBold: 'ph:caret-left-bold',
  caretRightBold: 'ph:caret-right-bold',

  // Double caret — bold (toggle sidebars)
  caretDoubleLeftBold: 'ph:caret-double-left-bold',
  caretDoubleRightBold: 'ph:caret-double-right-bold',

  // Navigation — regular (decorative / menu labels)
  caretLeft: 'ph:caret-left',
  caretRight: 'ph:caret-right',

  // Map sidebar — section headers
  mapTrifold: 'ph:map-trifold',
  gauge: 'ph:gauge',
  usersThree: 'ph:users-three',
  calendarBlank: 'ph:calendar-blank',
  clock: 'ph:clock',
  // Lucide by exception (the convention above reserves it for geovis): the
  // variations tab shares its icon with the same tab in cozsolidarias.
  layoutList: 'lucide:layout-list',

  // Map sidebar — indicator variations
  chartPieSlice: 'ph:chart-pie-slice',
  chartDonut: 'ph:chart-donut',
  chartBar: 'ph:chart-bar',

  // Map sidebar — geographic-level variations
  squaresFour: 'ph:squares-four',
  polygon: 'ph:polygon',

  // Map sidebar — offer indicator and its services
  buildings: 'ph:buildings',
  storefront: 'ph:storefront',
  firstAidKit: 'ph:first-aid-kit',
  firstAid: 'ph:first-aid',
  forkKnife: 'ph:fork-knife',
  soccerBall: 'ph:soccer-ball',

  // Map sidebar — age-group variations
  plusCircle: 'ph:plus-circle',
  arrowsInLineHorizontal: 'ph:arrows-in-line-horizontal',
} as const;

export type IconName = (typeof ICONS)[keyof typeof ICONS];
