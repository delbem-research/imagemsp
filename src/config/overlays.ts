// Type only: this registry also runs in the API route, which must not pull in
// the icon registry's client-side `addIcon` calls.
import type { IconName } from '@/components/map/lib/icons';

/**
 * The overlays the map offers in its "Camadas" control, drawn on top of the
 * choropleth: GeoSampa facilities and stops as pins, and parks as polygons.
 *
 * This registry is the single place an overlay is declared: the route, the
 * client store and the spec all iterate it, so adding one is an entry here plus
 * its snapshot (a CSV through `scripts/generatePointsData.ts` for points, a
 * generator of its own for polygons) and its tooltip line in `data-gateway`.
 */

/** Overlays drawn as points, each built from a CSV in `data/raw/`. */
export const POINT_OVERLAY_IDS = [
  'hospitais',
  'urgencia',
  'samu',
  'ubs',
  'ambulatorios',
  'saude-mental',
  'dst-aids',
  'vigilancia',
  'animais',
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
  /** Fixed colour: a pin's fill, or a polygon's fill and outline. */
  color: string;
};

export type PointOverlayConfig = OverlayBase & {
  id: PointOverlayId;
  kind: 'point';
  /**
   * Icon drawn inside the overlay's pin — for the health and service overlays
   * the same one the sidebar shows for that offer, so a pin and its indicator
   * read as the same thing.
   */
  icon: IconName;
  /** Pin width, in pixels; its height follows the teardrop's shape. */
  pinSize: number;
  /**
   * Whether every pin is drawn even where it collides with another. `false`
   * lets MapLibre drop the colliding ones, which come back as the map zooms in.
   */
  allowOverlap: boolean;
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
 * Colours are one hue per overlay and deliberately none of them blue: the
 * choropleth underneath is a blue ramp (`LEGEND_COLORS`), and a blue mark would
 * vanish into the darker districts. With this many overlays some hues sit
 * close; the ones meant to be read together are the ones kept apart — the
 * emergency care (hospitals, urgência, SAMU) in the red family, the rest of
 * the health network in distinct hues around it. The parks' green is darker and
 * less saturated than the UBS points' so the two read apart.
 *
 * Bus stops are smaller than the other pins and the only ones allowed to
 * collide away: there are 22 thousand of them, and drawn all at once they would
 * pave the city over. MapLibre keeps a readable spread of them at city zoom and
 * brings back the rest as the map zooms in; every other overlay keeps all its
 * pins at any zoom.
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
    // Filled, unlike the sidebar's outline cross: the hospitals are the most
    // prominent pins, and a solid cross reads better at pin size.
    icon: 'ph:first-aid-fill',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'urgencia',
    kind: 'point',
    label: 'UPA',
    color: '#9C1C1C',
    icon: 'ph:pulse',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'samu',
    kind: 'point',
    label: 'Bases do SAMU',
    color: '#00897B',
    icon: 'ph:siren',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'ubs',
    kind: 'point',
    label: 'UBS',
    color: '#2E9E5B',
    icon: 'ph:first-aid-kit',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'ambulatorios',
    kind: 'point',
    label: 'Ambulatórios especializados',
    color: '#F28E2B',
    icon: 'ph:stethoscope',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'saude-mental',
    kind: 'point',
    label: 'Saúde mental',
    color: '#B279A2',
    icon: 'ph:brain',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'dst-aids',
    kind: 'point',
    label: 'Unidades DST/AIDS',
    color: '#FF9DA7',
    icon: 'ph:test-tube',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'vigilancia',
    kind: 'point',
    label: 'Vigilância em saúde',
    color: '#4D4D00',
    icon: 'ph:shield-check',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'animais',
    kind: 'point',
    label: 'Animais (zoonoses e hospitais veterinários)',
    color: '#9BBB2F',
    icon: 'ph:paw-print',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'restaurantes',
    kind: 'point',
    label: 'Restaurantes públicos',
    color: '#D63A8A',
    icon: 'ph:fork-knife',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'esporte',
    kind: 'point',
    label: 'Locais de esporte públicos',
    color: '#8C564B',
    icon: 'ph:soccer-ball',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'estacoes',
    kind: 'point',
    label: 'Estações de metrô e trem',
    color: '#7B3FA0',
    icon: 'ph:train',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'terminais',
    kind: 'point',
    label: 'Terminais de ônibus',
    color: '#3D3D3D',
    icon: 'ph:bus',
    pinSize: 22,
    allowOverlap: true,
  },
  {
    id: 'pontos-onibus',
    kind: 'point',
    label: 'Pontos de ônibus',
    color: '#E0A100',
    icon: 'ph:traffic-sign',
    pinSize: 16,
    allowOverlap: false,
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
