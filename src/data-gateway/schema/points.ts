/**
 * What the map shows about a point: the two lines of its hover tooltip. The
 * rest of the snapshot (addresses, phones, districts) is not shipped, since
 * nothing on the map reads it.
 */
export type PointProperties = {
  name: string;
  /** Secondary line, e.g. `Hospital · Estadual` or `Metrô · Linha Azul`. */
  detail: string;
};

/** One point as a GeoJSON feature, in WGS84 `[longitude, latitude]`. */
export type PointFeature = {
  type: 'Feature';
  /**
   * Numeric feature id. MapLibre only reports a hovered point that carries
   * one, and it is the key the tooltip looks the point up by.
   */
  id: number;
  properties: PointProperties;
  geometry: { type: 'Point'; coordinates: [number, number] };
};

/**
 * Canonical point-layer contract served by `/api/camadas/[layer]`: a GeoJSON
 * FeatureCollection the map can take as a source's `data` unchanged.
 */
export type PointsContract = {
  type: 'FeatureCollection';
  features: PointFeature[];
};
