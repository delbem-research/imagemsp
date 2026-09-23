/**
 * The point layers the map offers in its "Camadas" control, one per GeoSampa
 * dataset in `src/data-source-static/data/raw/`.
 *
 * This registry is the single place a layer is declared: the generator, the
 * `/api/camadas/[layer]` route, the client store and the spec all iterate it,
 * so adding a dataset is one entry here plus its CSV (and its tooltip line in
 * `data-gateway/transformers/toAppPoints`).
 */

export const POINT_LAYER_IDS = [
  'hospitais',
  'ubs',
  'restaurantes',
  'estacoes',
  'terminais',
  'pontos-onibus',
] as const;

export type PointLayerId = (typeof POINT_LAYER_IDS)[number];

/**
 * Narrows an arbitrary string — a route segment, say — to a known layer id.
 *
 * @param value - The candidate id.
 * @returns Whether `value` is one of {@link POINT_LAYER_IDS}.
 *
 * @example
 * isPointLayerId('ubs'); // true
 * isPointLayerId('parques'); // false
 */
export const isPointLayerId = (value: string): value is PointLayerId => {
  return (POINT_LAYER_IDS as readonly string[]).includes(value);
};

export type PointLayerConfig = {
  id: PointLayerId;
  /** Text of the layer's toggle in the "Camadas" control. */
  label: string;
  /** Fixed fill colour of the layer's points. */
  color: string;
  /** Point radius, in pixels. */
  radius: number;
  /** Width of the light halo around each point, in pixels. */
  strokeWidth: number;
};

/**
 * The layers, in the order their toggles appear in the control.
 *
 * Colours are one distinct hue per layer and deliberately none of them blue:
 * the choropleth underneath is a blue ramp (`LEGEND_COLORS`), and a blue point
 * would vanish into the darker districts.
 *
 * Bus stops are smaller and thinner-haloed than the rest: there are 22 thousand
 * of them, and at the size of the others they would pave the city over.
 */
export const POINT_LAYERS: readonly PointLayerConfig[] = [
  {
    id: 'hospitais',
    label: 'Localização dos hospitais',
    color: '#E4572E',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'ubs',
    label: 'Unidades Básicas de Saúde (UBS)',
    color: '#2E9E5B',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'restaurantes',
    label: 'Restaurantes públicos',
    color: '#D63A8A',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'estacoes',
    label: 'Estações de metrô e trem',
    color: '#7B3FA0',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'terminais',
    label: 'Terminais de ônibus',
    color: '#3D3D3D',
    radius: 4,
    strokeWidth: 1.2,
  },
  {
    id: 'pontos-onibus',
    label: 'Pontos de ônibus',
    color: '#E0A100',
    radius: 2.5,
    strokeWidth: 0.6,
  },
];
