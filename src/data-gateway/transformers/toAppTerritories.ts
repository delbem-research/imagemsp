import type { StaticTerritoriesDataSource } from '../../data-source-static/types';
import type { OverlayContract } from '../schema';

/**
 * Transforms a source-native health-territory snapshot into the canonical
 * overlay contract, the same one the parks and the point layers use, so the
 * map draws and labels all of them the same way.
 *
 * @param source - Raw record from data-source-static.
 * @returns Canonical {@link OverlayContract} of territory polygons, each
 * labelled with its name and its kind and place (the tooltip's two lines).
 * @throws If the snapshot carries no territories — an empty layer would read
 * as a city with no health network.
 *
 * @example
 * toAppTerritories(source);
 * // { type: 'FeatureCollection', features: [{ id: 1, properties: { name: 'CRS Oeste', detail: 'Coordenadoria Regional de Saúde' }, geometry: { type: 'Polygon', ... } }] }
 */
export const toAppTerritories = (
  source: StaticTerritoriesDataSource
): OverlayContract => {
  if (source.territorios.length === 0) {
    throw new Error(
      '[data-gateway] toAppTerritories received an empty snapshot'
    );
  }

  return {
    type: 'FeatureCollection',
    features: source.territorios.map((territory) => {
      return {
        type: 'Feature',
        id: territory.id,
        properties: { name: territory.nome, detail: territory.detalhe },
        geometry: territory.geometry,
      };
    }),
  };
};
