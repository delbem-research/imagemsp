/**
 * The geographic levels the choropleth can be drawn at, and what changes
 * between them. Everything else — the indicator, the age band, the year, the
 * class breaks — is shared, so switching level only swaps the areas painted.
 */

export type MapLevel = 'distrito' | 'subprefeitura';

export const MAP_LEVEL_IDS: readonly MapLevel[] = ['distrito', 'subprefeitura'];

/**
 * Narrows a sidebar value to a known level.
 *
 * @param value - The value the level menu reported.
 * @returns Whether `value` is a {@link MapLevel}.
 *
 * @example
 * isMapLevel('subprefeitura'); // true
 */
export const isMapLevel = (value: string | undefined): value is MapLevel => {
  return (MAP_LEVEL_IDS as readonly (string | undefined)[]).includes(value);
};

export type MapLevelConfig = {
  /** Menu option label. */
  label: string;
  /** Spec ids: each level has its own source, layer and join. */
  sourceId: string;
  layerId: string;
  mapDataId: string;
  /** Polygons of the level, served from `public/`. */
  geojson: string;
  /** The level in the legend title, upper case like the title itself. */
  titleNoun: string;
  /** "of the area" in the legend subtitle (`do distrito`, `da subprefeitura`). */
  ofArea: string;
  /** How the legend footer credits the data aggregation and the geometry. */
  dataCredit: string;
  geometryCredit: string;
};

export const MAP_LEVELS: Record<MapLevel, MapLevelConfig> = {
  distrito: {
    label: 'Distritos (96)',
    sourceId: 'sp-districts',
    layerId: 'sp-districts-fill',
    mapDataId: 'pop-data',
    geojson: '/distrito-municipal-v2.geojson',
    titleNoun: 'DISTRITO',
    ofArea: 'do distrito',
    dataCredit: 'Dados agregados por distrito municipal',
    geometryCredit: 'Distritos Municipais de São Paulo',
  },
  subprefeitura: {
    label: 'Subprefeituras (32)',
    sourceId: 'sp-subprefeituras',
    layerId: 'sp-subprefeituras-fill',
    mapDataId: 'pop-data-subprefeituras',
    geojson: '/subprefeituras.geojson',
    titleNoun: 'SUBPREFEITURA',
    ofArea: 'da subprefeitura',
    dataCredit:
      'Dados agregados por subprefeitura, somando os distritos municipais',
    geometryCredit:
      'Subprefeituras de São Paulo ({link:GeoSampa|https://geosampa.prefeitura.sp.gov.br})',
  },
};
