/**
 * The overlays the map offers in its "Camadas" control, drawn on top of the
 * choropleth: GeoSampa facilities and stops as points, and parks as polygons.
 *
 * This registry is the single place an overlay is declared: the route, the
 * client store and the spec all iterate it, so adding one is an entry here plus
 * its snapshot (a CSV through `scripts/generatePointsData.ts` for points, a
 * generator of its own for polygons) and its tooltip line in `data-gateway`.
 */

/** Overlays drawn as points, each built from a CSV in `data/raw/`. */
export const POINT_OVERLAY_IDS = [
  'hospitais',
  'ubs',
  'restaurantes',
  'esporte',
  'estacoes',
  'terminais',
  'pontos-onibus',
] as const;

export type PointOverlayId = (typeof POINT_OVERLAY_IDS)[number];

/** Every overlay, points and polygons alike. */
export const OVERLAY_IDS = ['parques', ...POINT_OVERLAY_IDS] as const;

export type OverlayId = (typeof OVERLAY_IDS)[number];

/**
 * Narrows an arbitrary string — a route segment, say — to a known overlay id.
 *
 * @param value - The candidate id.
 * @returns Whether `value` is one of {@link OVERLAY_IDS}.
 *
 * @example
 * isOverlayId('parques'); // true
 * isOverlayId('clubes'); // false
 */
export const isOverlayId = (value: string): value is OverlayId => {
  return (OVERLAY_IDS as readonly string[]).includes(value);
};

/**
 * Whether an overlay is drawn as points.
 *
 * @param id - The overlay.
 * @returns `true` for the facility and stop layers, `false` for the parks.
 *
 * @example
 * isPointOverlayId('ubs'); // true
 */
export const isPointOverlayId = (id: OverlayId): id is PointOverlayId => {
  return (POINT_OVERLAY_IDS as readonly string[]).includes(id);
};

type OverlayBase = {
  /** Text of the overlay's toggle in the "Camadas" control. */
  label: string;
  /** Fixed colour: a point's fill, or a polygon's outline and tint. */
  color: string;
};

export type PointOverlayConfig = OverlayBase & {
  id: PointOverlayId;
  kind: 'point';
  /** Point radius, in pixels. */
  radius: number;
  /** Width of the light halo around each point, in pixels. */
  strokeWidth: number;
};

export type PolygonOverlayConfig = OverlayBase & {
  id: Exclude<OverlayId, PointOverlayId>;
  kind: 'polygon';
  /** Fill opacity; low, so the choropleth and the points stay readable. */
  fillOpacity: number;
};

export type OverlayConfig = PointOverlayConfig | PolygonOverlayConfig;

/**
 * The overlays, in the order their toggles appear in the control — and, read
 * backwards, the order they are drawn: the first one ends up on top.
 *
 * The parks come first so they draw above everything else. They are tinted,
 * not filled, so the choropleth shows through them and a point inside a park
 * stays visible (and keeps its own tooltip: points win the hover over
 * polygons).
 *
 * Colours are one distinct hue per overlay and deliberately none of them blue:
 * the choropleth underneath is a blue ramp (`LEGEND_COLORS`), and a blue mark
 * would vanish into the darker districts. The parks' green is darker and less
 * saturated than the UBS points' so the two read apart.
 *
 * Bus stops are smaller and thinner-haloed than the other points: there are 22
 * thousand of them, and at the size of the others they would pave the city over.
 */
export const OVERLAYS: readonly OverlayConfig[] = [
  {
    id: 'parques',
    kind: 'polygon',
    label: 'Parques municipais',
    color: '#2F6B2F',
    fillOpacity: 0.35,
  },
  {
    id: 'hospitais',
    kind: 'point',
    label: 'Localização dos hospitais',
    color: '#E4572E',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'ubs',
    kind: 'point',
    label: 'Unidades Básicas de Saúde (UBS)',
    color: '#2E9E5B',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'restaurantes',
    kind: 'point',
    label: 'Restaurantes públicos',
    color: '#D63A8A',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'esporte',
    kind: 'point',
    label: 'Locais de esporte públicos',
    color: '#8C564B',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'estacoes',
    kind: 'point',
    label: 'Estações de metrô e trem',
    color: '#7B3FA0',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'terminais',
    kind: 'point',
    label: 'Terminais de ônibus',
    color: '#3D3D3D',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'pontos-onibus',
    kind: 'point',
    label: 'Pontos de ônibus',
    color: '#E0A100',
    radius: 2.5,
    strokeWidth: 0.6,
  },
];
