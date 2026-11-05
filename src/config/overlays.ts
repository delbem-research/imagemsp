// Type only: this registry also runs in the API route, which must not pull in
// the icon registry's client-side `addIcon` calls.
import type { ZoomScaled } from '@ttoss/geovis';

import type { IconName } from '@/components/map/lib/icons';

/**
 * The overlays the map offers in its "Camadas" control, drawn on top of the
 * choropleth: GeoSampa facilities and stops as pins, the cycle network as
 * lines, the traffic crashes as a heatmap, and parks and the health
 * territories as polygons.
 *
 * This registry is the single place an overlay is declared: the route, the
 * client store and the spec all iterate it, so adding one is an entry here plus
 * its snapshot (a CSV through `scripts/generatePointsData.ts` for points, a
 * generator of its own for lines and polygons) and its tooltip line in `data-gateway`.
 */

/**
 * Overlays drawn as points, each built from a CSV in `data/raw/` — most from
 * GeoSampa, the organic fairs and urban gardens from Sampa+Rural, the
 * private hospitals from CNES, the private restaurants and pharmacies from
 * OpenStreetMap and the Farmácia Popular pharmacies from the Ministry of
 * Health.
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
  'farmacias-populares',
  'farmacias-privadas',
  'restaurantes',
  'restaurantes-privados',
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

/** Every overlay, points, lines, heatmaps and polygons alike. */
export const OVERLAY_IDS = [
  'parques',
  'ciclovias',
  'acidentes',
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
 * lanes, the crashes, the parks and the health territories.
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

/**
 * An overlay drawn as a heatmap: the density of its points, in a ramp of
 * colours rather than one — so it takes {@link colors} in place of `color`.
 */
export type HeatmapOverlayConfig = Omit<OverlayBase, 'color'> & {
  id: 'acidentes';
  kind: 'heatmap';
  /** The density ramp, lowest density first; zero density is transparent. */
  colors: string[];
  /** Radius of influence of each point, in pixels, fixed or by zoom. */
  radius: ZoomScaled;
  /** Multiplier on the density, fixed or by zoom. */
  intensity: ZoomScaled;
  /** Layer opacity, from `0` to `1`. */
  opacity: number;
  /** Labels under the low and high ends of the legend's gradient. */
  legendLabels: { low: string; high: string };
  /**
   * The legend's subtitle, for the age bands the map's age filter picked
   * (`offerAgesLong`'s words, e.g. `65 anos ou mais`) — it names the snapshot's
   * year too, so it changes with its generator's.
   */
  legendSubtitle: (ages: string) => string;
  /** The legend's source footer: the source's name alone. */
  legendReference: string;
};

export type PolygonOverlayConfig = OverlayBase & {
  id: Exclude<OverlayId, PointOverlayId | 'ciclovias' | 'acidentes'>;
  kind: 'polygon';
  /** Fill opacity, from `0` (outline only) to `1` (solid). */
  fillOpacity: number;
  /** Outline width, in pixels. */
  lineWidth: number;
};

export type OverlayConfig =
  | PointOverlayConfig
  | LineOverlayConfig
  | HeatmapOverlayConfig
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
 * Bus stops, the on-street special parking spaces, the private restaurants
 * and the private pharmacies are smaller than the other pins and the only ones
 * allowed to collide away: there are 22 thousand stops, 3 thousand spaces,
 * 2 thousand restaurants and 700 pharmacies, and drawn all at once they would
 * pave the city over. MapLibre keeps a readable spread of them at city zoom and brings back
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
  {
    id: 'farmacias-populares',
    kind: 'point',
    label: 'Farmácias populares',
    // A vivid green, the pharmacies' own colour, and far enough from the UBS
    // green to tell the two apart.
    color: '#00C853',
    icon: 'ph:pill',
    pinSize: 31,
    allowOverlap: true,
  },
  {
    id: 'farmacias-privadas',
    kind: 'point',
    label: 'Farmácias privadas',
    // The Farmácia Popular pill in mint, as the private hospitals take the
    // public ones' cross in a colour of their own.
    color: '#69F0AE',
    icon: 'ph:pill',
    // Seven hundred of them, crowded in the centre: small, and left to
    // collide away until the map zooms in, like the private restaurants.
    pinSize: 23,
    allowOverlap: false,
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
    id: 'restaurantes-privados',
    kind: 'point',
    label: 'Restaurantes privados',
    // Salmon, warm like the food overlays without nearing the public
    // restaurants' pink or the hospitals' red; a bowl, so the two restaurant
    // layers read apart at a glance.
    color: '#FF8A65',
    icon: 'ph:bowl-food',
    // Two and a half thousand of them, crowded in the centre: small, and left
    // to collide away until the map zooms in, like the bus stops.
    pinSize: 23,
    allowOverlap: false,
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
    id: 'acidentes',
    kind: 'heatmap',
    label: 'Acidentes de trânsito',
    // Only the crashes in which a person aged 65 or more was hurt or killed
    // (see `scripts/generateCrashesData.ts`), filtered by the map's age bands.
    // Yellow to dark red, with no blue in it: the choropleth underneath is a
    // blue ramp, and a blue heat would vanish into the darker districts.
    colors: ['#FDE68A', '#F97316', '#DC2626', '#7F1D1D'],
    // Grows with the zoom, so the heat neither vanishes as the reader zooms in
    // nor smears the city over as they zoom out; the intensity rises with it,
    // as fewer crashes share each pixel up close. Both are set for the 1–2
    // thousand crashes with older people hurt, a sixteenth of all crashes.
    radius: [
      [10, 10],
      [13, 24],
      [16, 44],
    ],
    intensity: [
      [10, 1.6],
      [16, 4],
    ],
    // Translucent, so the choropleth beneath still reads through the heat.
    opacity: 0.8,
    legendLabels: { low: 'Menos acidentes', high: 'Mais acidentes' },
    // The year is `scripts/generateCrashesData.ts`'s `YEAR`.
    legendSubtitle: (ages) => {
      return `Densidade dos acidentes de trânsito de 2024 com pessoas de ${ages} feridas ou mortas.`;
    },
    legendReference: 'Fonte: {link:Infosiga|https://infosiga.detran.sp.gov.br}',
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

export { overlayDrawOrder } from './overlayDrawOrder';
