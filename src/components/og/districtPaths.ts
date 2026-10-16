/**
 * Projects São Paulo's district polygons into SVG paths for the link preview
 * image. An equirectangular projection scaled by the cosine of the mean
 * latitude is enough at a city's extent, and keeps the module free of a
 * projection library.
 */

type Position = [number, number];

type PolygonFeature = {
  geometry: { type: 'Polygon'; coordinates: Position[][] };
};

/** The subset of a districts FeatureCollection this module reads. */
export type DistrictCollection = { features: PolygonFeature[] };

/**
 * One SVG path per district, fitted inside a `width` × `height` box with the
 * aspect ratio kept and the drawing centred.
 *
 * @param params.collection - The districts, as `public/distrito-municipal-v2.geojson`.
 * @param params.width - Width of the box, in pixels.
 * @param params.height - Height of the box, in pixels.
 * @returns The paths' `d` attributes, in the collection's order.
 *
 * @example
 * districtPaths({ collection, width: 400, height: 520 })[0]; // 'M12.3 40.1L…Z'
 */
export const districtPaths = ({
  collection,
  width,
  height,
}: {
  collection: DistrictCollection;
  width: number;
  height: number;
}): string[] => {
  const positions = collection.features.flatMap((feature) => {
    return feature.geometry.coordinates.flat();
  });
  const lons = positions.map(([lon]) => {
    return lon;
  });
  const lats = positions.map(([, lat]) => {
    return lat;
  });
  const minLon = Math.min(...lons);
  const maxLat = Math.max(...lats);
  const minLat = Math.min(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const spanX = (Math.max(...lons) - minLon) * kx;
  const spanY = maxLat - minLat;
  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const point = ([lon, lat]: Position) => {
    const x = offsetX + (lon - minLon) * kx * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };

  return collection.features.map((feature) => {
    return feature.geometry.coordinates
      .map((ring) => {
        return `M${ring.map(point).join('L')}Z`;
      })
      .join('');
  });
};
