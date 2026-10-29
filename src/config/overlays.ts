// Type only: this registry also runs in the API route, which must not pull in
// the icon registry's client-side `addIcon` calls.
import type { IconName } from '@/components/map/lib/icons';

/**
 * The overlays the map offers in its "Camadas" control, drawn on top of the
 * choropleth: GeoSampa facilities and stops as pins, the cycle network as
 * lines, and parks and the health territories as polygons.
 *
 * This registry is the single place an overlay is declared: the route, the
 * client store and the spec all iterate it, so adding one is an entry here plus
 * its snapshot (a CSV through `scripts/generatePointsData.ts` for points, a
 * generator of its own for lines and polygons) and its tooltip line in `data-gateway`.
 */

/**
 * Overlays drawn as points, each built from a CSV in `data/raw/` — most from
 * GeoSampa, the organic fairs and urban gardens from Sampa+Rural and the
 * private hospitals from CNES.
 */
export const POINT_OVERLAY_IDS = [
  'hospitais',
  'hospitais-privados',
  'urgencia',
  'samu',
  'ubs',
  'ambulatorios',
  'saude-mental',
  'dst-aids',
  'vigilancia',
  'animais',
  'restaurantes',
  'feiras',
  'feiras-organicas',
  'mercados',
  'hortas',
  'esporte',
  'sesc',
  'estacoes',
  'terminais',
  'bicicletarios',
  'vagas-idoso',
  'vagas-especiais',
  'pontos-onibus',
] as const;

export type PointOverlayId = (typeof POINT_OVERLAY_IDS)[number];

/**
 * The health territories drawn as overlays, each a polygon snapshot generated
 * by `scripts/generateHealthTerritoriesData.ts`: the UBS catchment areas and
 * the Saúde da Família coverage. The coordinations (CRS) and supervisions (STS)
 * above them are levels of the choropleth instead (see `mapLevels`).
 */
export const TERRITORY_OVERLAY_IDS = [
  'abrangencia-ubs',
  'saude-familia',
] as const;

export type TerritoryOverlayId = (typeof TERRITORY_OVERLAY_IDS)[number];

/** Every overlay, points, lines and polygons alike. */
export const OVERLAY_IDS = [
  'parques',
  'ciclovias',
  ...TERRITORY_OVERLAY_IDS,
  ...POINT_OVERLAY_IDS,
] as const;

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
 * @returns `true` for the facility and stop layers, `false` for the cycle
 * lanes, the parks and the health territories.
 *
 * @example
 * isPointOverlayId('ubs'); // true
 */
export const isPointOverlayId = (id: OverlayId): id is PointOverlayId => {
  return (POINT_OVERLAY_IDS as readonly string[]).includes(id);
};

/**
 * Whether an overlay is one of the health territories.
 *
 * @param id - The overlay.
 * @returns `true` for the UBS catchment and Saúde da Família layers.
 *
 * @example
 * isTerritoryOverlayId('abrangencia-ubs'); // true
 * isTerritoryOverlayId('parques'); // false
 */
export const isTerritoryOverlayId = (
  id: OverlayId
): id is TerritoryOverlayId => {
  return (TERRITORY_OVERLAY_IDS as readonly string[]).includes(id);
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
  /**
   * Width, in pixels, of the box geovis stands the pin in — a little over the
   * 30 px pins its search around a pin drops in, so the overlay's own pins read
   * as the larger marks.
   */
  pinSize: number;
  /**
   * Whether every pin is drawn even where it collides with another. `false`
   * lets MapLibre drop the colliding ones, which come back as the map zooms in.
   */
  allowOverlap: boolean;
};

export type LineOverlayConfig = OverlayBase & {
  id: 'ciclovias';
  kind: 'line';
  /** Line width, in pixels. */
  lineWidth: number;
  /**
   * The secondary line (`detail`) of the features drawn dashed rather than
   * solid — the ciclorrotas, which share the road instead of having a lane.
   */
  dashedDetail?: string;
};

export type PolygonOverlayConfig = OverlayBase & {
  id: Exclude<OverlayId, PointOverlayId | 'ciclovias'>;
  kind: 'polygon';
  /** Fill opacity, from `0` (outline only) to `1` (solid). */
  fillOpacity: number;
  /** Outline width, in pixels. */
  lineWidth: number;
};

export type OverlayConfig =
  | PointOverlayConfig
  | LineOverlayConfig
  | PolygonOverlayConfig;

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
 * close; the ones meant to be read together are the ones kept apart. The health
 * network is spread across the widest hue gaps — hospitals and urgência in the
 * red family, SAMU violet, UBS green, animal care a dark petrol — each at least ~25
 * CIEDE2000 from every other health overlay, so any mix of them stays legible.
 * The looser pairs are across groups that are rarely shown together (SAMU's
 * violet sits nearest the metro stations' purple). The parks' green is darker
 * and less saturated than the UBS points' so the two read apart.
 *
 * Bus stops and the on-street special parking spaces are smaller than the
 * other pins and the only ones allowed to collide away: there are 22 thousand
 * stops and 3 thousand spaces, and drawn all at once they would pave the city
 * over. MapLibre keeps a readable spread of them at city zoom and brings back
 * the rest as the map zooms in; every other overlay keeps all its pins at any
 * zoom.
 */
export const OVERLAYS: readonly OverlayConfig[] = [
  {
    id: 'parques',
    kind: 'polygon',
    label: 'Parques municipais',
    color: '#2F6B2F',
    fillOpacity: 1,
    lineWidth: 1,
  },
  {
    id: 'hospitais',
    kind: 'point',
    label: 'Localização dos hospitais',
    color: '#E4572E',
    // Filled, unlike the sidebar's outline cross: the hospitals are the most
    // prominent pins, and a solid cross reads better at pin size.
    icon: 'ph:first-aid-fill',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'hospitais-privados',
    kind: 'point',
    label: 'Hospitais privados',
    // The public hospitals' cross in a wine of its own, so the two networks
    // read as hospitals and still apart.
    color: '#880E4F',
    icon: 'ph:first-aid-fill',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'urgencia',
    kind: 'point',
    label: 'UPA',
    color: '#9C1C1C',
    icon: 'ph:pulse',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'samu',
    kind: 'point',
    label: 'Bases do SAMU',
    color: '#9214FF',
    icon: 'ph:siren',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'ubs',
    kind: 'point',
    label: 'UBS',
    color: '#2E9E5B',
    icon: 'ph:first-aid-kit',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'ambulatorios',
    kind: 'point',
    label: 'Ambulatórios especializados',
    color: '#F28E2B',
    icon: 'ph:stethoscope',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'saude-mental',
    kind: 'point',
    label: 'Saúde mental',
    color: '#B279A2',
    icon: 'ph:brain',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'dst-aids',
    kind: 'point',
    label: 'Unidades DST/AIDS',
    color: '#FF9DA7',
    icon: 'ph:test-tube',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'vigilancia',
    kind: 'point',
    label: 'Vigilância em saúde',
    color: '#4D4D00',
    icon: 'ph:shield-check',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'animais',
    kind: 'point',
    label: 'Hospital veterinário',
    color: '#0F5357',
    icon: 'ph:paw-print',
    pinSize: 31,
    allowOverlap: true,
  },
  // The health territories. The 487 UBS catchments are a thin outline only,
  // so the choropleth still reads through them and the crowded pin palette is
  // left alone. The Saúde da Família coverage alone is tinted: what it says is
  // where the teams reach and where they do not, and a fill is what shows the
  // gaps.
  {
    id: 'abrangencia-ubs',
    kind: 'polygon',
    label: 'Abrangência UBS',
    color: '#4D4D4D',
    fillOpacity: 0,
    lineWidth: 0.7,
  },
  {
    id: 'saude-familia',
    kind: 'polygon',
    label: 'Saúde da família',
    color: '#D95F02',
    fillOpacity: 0.25,
    lineWidth: 1,
  },
  {
    id: 'restaurantes',
    kind: 'point',
    label: 'Restaurantes públicos',
    color: '#D63A8A',
    icon: 'ph:fork-knife',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'feiras',
    kind: 'point',
    label: 'Feiras livres',
    color: '#689F38',
    icon: 'ph:carrot',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'feiras-organicas',
    kind: 'point',
    label: 'Feiras orgânicas',
    color: '#2E7D32',
    icon: 'ph:leaf',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'mercados',
    kind: 'point',
    label: 'Mercados municipais',
    color: '#00897B',
    icon: 'ph:basket',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'hortas',
    kind: 'point',
    label: 'Hortas urbanas',
    color: '#33691E',
    icon: 'ph:plant',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'esporte',
    kind: 'point',
    label: 'Locais de esporte públicos',
    color: '#8C564B',
    icon: 'ph:soccer-ball',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'sesc',
    kind: 'point',
    label: 'Unidades do SESC',
    color: '#8E24AA',
    icon: 'ph:ticket',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'estacoes',
    kind: 'point',
    label: 'Estações de metrô e trem',
    color: '#7B3FA0',
    icon: 'ph:train',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'terminais',
    kind: 'point',
    label: 'Terminais de ônibus',
    color: '#3D3D3D',
    icon: 'ph:bus',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'ciclovias',
    kind: 'line',
    label: 'Ciclovias e ciclofaixas',
    // Dark grey, quiet over the choropleth's blues. Lines never read as pins,
    // so it can sit near the bus terminals' grey without the two mixing up.
    color: '#424242',
    // Wider than the territories' outlines: the cursor has to land on the
    // line itself for its tooltip.
    lineWidth: 3,
    dashedDetail: 'Ciclorrota',
  },
  {
    id: 'bicicletarios',
    kind: 'point',
    label: 'Bicicletários e paraciclos',
    color: '#EC407A',
    icon: 'ph:bicycle',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'vagas-idoso',
    kind: 'point',
    label: 'Vagas para idosos em estabelecimentos',
    color: '#9E9D24',
    icon: 'ph:car-profile',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'vagas-especiais',
    kind: 'point',
    label: 'Vagas especiais na rua',
    color: '#78909C',
    icon: 'ph:wheelchair',
    pinSize: 23,
    allowOverlap: false,
  },
  {
    id: 'pontos-onibus',
    kind: 'point',
    label: 'Pontos de ônibus',
    color: '#E0A100',
    icon: 'ph:traffic-sign',
    pinSize: 23,
    allowOverlap: false,
  },
];

/**
 * The order the overlays are drawn in, bottom first: polygons, then lines,
 * then points — a solid park never covers the cycle lane through it, nor
 * either of them a facility. Within each
 * kind the control's order holds, read backwards — its first item draws on top
 * — which leaves the 22 thousand bus stops, last in the control, beneath the
 * other points instead of burying the hospitals.
 *
 * @param overlays - The overlays, in control order.
 * @returns The same overlays, in draw order.
 *
 * @example
 * overlayDrawOrder(OVERLAYS).map((overlay) => overlay.id);
 * // ['saude-familia', ..., 'parques', 'pontos-onibus', ..., 'hospitais']
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
      return overlay.kind === 'line';
    }),
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'point';
    }),
  ];
};
