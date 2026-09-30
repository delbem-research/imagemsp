import { LEGEND_COLORS } from '@/components/map/lib/mapConfig';

/**
 * The colour ramps the "Configurações" tab offers for the choropleth, and the
 * re-colouring that carries a choice — ramp and opacity — onto the map.
 *
 * Only the colours move. The class breaks (`config/thresholds`) and their
 * labels are the series' own, so a ramp change re-reads the same classes
 * through other colours; it never re-classifies an area.
 */

/** A ramp: seven colours, lightest first, one per choropleth class. */
export type ColorRamp = {
  id: string;
  label: string;
  colors: string[];
  /** Set on the ramps the reader built: only those can be removed. */
  removable?: boolean;
};

/**
 * The ramps the app ships, ColorBrewer sequential single-hue sets at seven
 * classes — the length of every series' scale. Single-hue on purpose: along a
 * ramp that travels between two hues the reader cannot tell which of the two
 * carries the number.
 *
 * Blue leads and is the default: it is the map's own ramp, and the overlay pins
 * were picked to stand out against it. The others trade some of that contrast
 * away — on the greens the UBS and park overlays read closer to the fill — which
 * is the reader's call to make.
 */
export const COLOR_RAMPS: ColorRamp[] = [
  { id: 'azuis', label: 'Azuis', colors: LEGEND_COLORS },
  {
    id: 'verdes',
    label: 'Verdes',
    colors: [
      '#c7e9c0',
      '#a1d99b',
      '#74c476',
      '#41ab5d',
      '#238b45',
      '#006d2c',
      '#00441b',
    ],
  },
  {
    id: 'laranjas',
    label: 'Laranjas',
    colors: [
      '#fdd0a2',
      '#fdae6b',
      '#fd8d3c',
      '#f16913',
      '#d94801',
      '#a63603',
      '#7f2704',
    ],
  },
  {
    id: 'roxos',
    label: 'Roxos',
    colors: [
      '#dadaeb',
      '#bcbddc',
      '#9e9ac8',
      '#807dba',
      '#6a51a3',
      '#54278f',
      '#3f007d',
    ],
  },
  {
    id: 'cinzas',
    label: 'Cinzas',
    colors: [
      '#d9d9d9',
      '#bdbdbd',
      '#969696',
      '#737373',
      '#525252',
      '#252525',
      '#000000',
    ],
  },
];

/** The ramp the map opens on — its own blue. */
export const DEFAULT_COLOR_RAMP = 'azuis';

/** The choropleth's opening opacity, in percent: fully opaque, as before. */
export const DEFAULT_FILL_OPACITY = 100;

/** The base colours the ramp editor offers. */
export const RAMP_BASE_COLORS = [
  { id: 'azul', name: 'Azul', color: '#2171b5' },
  { id: 'verde', name: 'Verde', color: '#238b45' },
  { id: 'laranja', name: 'Laranja', color: '#d94801' },
  { id: 'roxo', name: 'Roxo', color: '#6a51a3' },
  { id: 'vermelho', name: 'Vermelho', color: '#cb181d' },
  { id: 'cinza', name: 'Cinza', color: '#525252' },
];

/**
 * `count` colours spread evenly across `colors`, endpoints included — so a
 * built ramp of another width still fills every class.
 */
const sample = (colors: readonly string[], count: number): string[] => {
  if (colors.length === count) return [...colors];
  if (count <= 1 || colors.length <= 1) {
    return Array.from({ length: count }, () => {
      return colors[colors.length - 1] ?? '#000000';
    });
  }

  return Array.from({ length: count }, (_, index) => {
    return (
      colors[Math.round((index * (colors.length - 1)) / (count - 1))] ??
      '#000000'
    );
  });
};

/**
 * A `#rrggbb` colour at `alpha`, as `rgba()`. Anything else is passed through
 * untouched rather than guessed at.
 */
const withAlpha = (color: string, alpha: number): string => {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!hex) return color;

  const [red, green, blue] = hex.slice(1).map((pair) => {
    return parseInt(pair, 16);
  });
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 * The ramp block's options: the shipped ramps, then the reader's own, which
 * alone can be removed.
 *
 * @param custom - The ramps the reader built, in the order they were added.
 * @returns The options, in listing order.
 *
 * @example
 * colorRampOptions([])[0]; // { id: 'azuis', label: 'Azuis', colors: [...] }
 */
export const colorRampOptions = (custom: ColorRamp[]): ColorRamp[] => {
  return [
    ...COLOR_RAMPS,
    ...custom.map((ramp) => {
      return { ...ramp, removable: true };
    }),
  ];
};

/**
 * The choropleth's class colours for a ramp and an opacity.
 *
 * The opacity rides in the colours, as `rgba()`, rather than in the layer's
 * `fillOpacity`: geovis builds the fill from these same legend colours, so the
 * map and the legend swatches read one list and cannot drift — and a
 * `fillOpacity` on top would multiply with it.
 *
 * @param params.rampId - The chosen ramp; an unknown id (a removed ramp, say)
 * falls back to the default.
 * @param params.custom - The ramps the reader built.
 * @param params.opacity - Opacity in percent, `0`–`100`.
 * @param params.count - How many classes the scale has.
 * @returns One colour per class, lightest first.
 *
 * @example
 * choroplethColors({ rampId: 'verdes', custom: [], opacity: 80, count: 7 });
 * // ['rgba(199, 233, 192, 0.8)', ...]
 */
export const choroplethColors = ({
  rampId,
  custom,
  opacity,
  count = LEGEND_COLORS.length,
}: {
  rampId: string;
  custom: ColorRamp[];
  opacity: number;
  count?: number;
}): string[] => {
  const ramp =
    colorRampOptions(custom).find((option) => {
      return option.id === rampId;
    }) ?? COLOR_RAMPS[0];
  const colors = sample(ramp?.colors ?? LEGEND_COLORS, count);
  const alpha = Math.min(100, Math.max(0, opacity)) / 100;

  return alpha >= 1
    ? colors
    : colors.map((color) => {
        return withAlpha(color, alpha);
      });
};
