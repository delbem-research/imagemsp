import type { StaticParksDataSource } from '../../data-source-static/types';
import type { OverlayContract } from '../schema';

/**
 * Transforms the source-native parks snapshot into the canonical overlay
 * contract, the same one the point layers use, so the map draws and labels
 * both the same way.
 *
 * @param source - Raw record from data-source-static.
 * @returns Canonical {@link OverlayContract} of park polygons, each labelled
 * with its name and category.
 * @throws If the snapshot carries no parks — an empty layer would look exactly
 * like a city without any.
 *
 * @example
 * toAppParks(source);
 * // { type: 'FeatureCollection', features: [{ id: 1, properties: { name: 'Ibirapuera', detail: 'Parque Urbano' }, geometry: { type: 'MultiPolygon', ... } }] }
 */
export const toAppParks = (source: StaticParksDataSource): OverlayContract => {
  if (source.parques.length === 0) {
    throw new Error('[data-gateway] toAppParks received an empty snapshot');
  }

  return {
    type: 'FeatureCollection',
    features: source.parques.map((park) => {
      return {
        type: 'Feature',
        id: park.id,
        properties: { name: park.nome, detail: park.categoria },
        geometry: park.geometry,
      };
    }),
  };
};
