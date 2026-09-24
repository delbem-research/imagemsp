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
  /** Fixed colour: a point's fill, or a polygon's fill and outline. */
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
  /** Fill opacity, from `0` (outline only) to `1` (solid). */
  fillOpacity: number;
};

export type OverlayConfig = PointOverlayConfig | PolygonOverlayConfig;

/**
 * The overlays, in the order their toggles appear in the control. How they
 * stack on the map is {@link overlayDrawOrder}'s call, not this order's.
 *
 * The parks are solid: a tint let the choropleth wash them out until they were
 * hard to tell apart. That is safe because polygons always draw beneath the
 * points, so a facility inside a park stays on top of it.
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
    fillOpacity: 1,
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
    label: 'UBS',
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

/**
 * The order the overlays are drawn in, bottom first: every polygon beneath
 * every point, so a solid park never covers a facility inside it. Within each
 * kind the control's order holds, read backwards — its first item draws on top
 * — which leaves the 22 thousand bus stops, last in the control, beneath the
 * other points instead of burying the hospitals.
 *
 * @param overlays - The overlays, in control order.
 * @returns The same overlays, in draw order.
 *
 * @example
 * overlayDrawOrder(OVERLAYS).map((overlay) => overlay.id);
 * // ['parques', 'pontos-onibus', 'terminais', ..., 'hospitais']
 */
export const overlayDrawOrder = (
  overlays: readonly OverlayConfig[]
): OverlayConfig[] => {
  const bottomFirst = [...overlays].reverse();

  return [
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'polygon';
    }),
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'point';
    }),
  ];
};
