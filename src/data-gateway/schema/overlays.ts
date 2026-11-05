/**
 * What the map shows about an overlay feature — a facility, a stop, a park or a
 * stretch of cycle lane:
 * the two lines of its hover tooltip. The rest of each snapshot (addresses,
 * phones, districts) is not shipped, since nothing on the map reads it.
 */
export type OverlayProperties = {
  name: string;
  /** Secondary line, e.g. `Hospital · Estadual`, `Metrô · Linha Azul`, `Parque Urbano` or `Ciclofaixa`. */
  detail: string;
  /** A crash's age band, which the heatmap filters by (see `toAppCrashes`). */
  faixa?: string;
  /**
   * `1` on one feature per crash: what the heatmap keeps for every band at
   * once, so a crash with people of two bands heats its place once.
   */
  todos?: number;
};

type Position = [number, number];

/** The geometries an overlay carries, in WGS84 `[longitude, latitude]`. */
export type OverlayGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

/** One overlay feature as GeoJSON. */
export type OverlayFeature = {
  type: 'Feature';
  /**
   * Numeric feature id. MapLibre only reports a hovered feature that carries
   * one, and it is the key the tooltip looks the feature up by.
   */
  id: number;
  properties: OverlayProperties;
  geometry: OverlayGeometry;
};

/**
 * Canonical overlay contract served by `/api/camadas/[layer]`: a GeoJSON
 * FeatureCollection the map can take as a source's `data` unchanged.
 */
export type OverlayContract = {
  type: 'FeatureCollection';
  features: OverlayFeature[];
};
