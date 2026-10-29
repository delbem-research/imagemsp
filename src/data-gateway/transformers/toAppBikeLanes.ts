import type { StaticBikeLanesDataSource } from '../../data-source-static/types';
import type { OverlayContract } from '../schema';

/**
 * Transforms the source-native cycle network snapshot into the canonical
 * overlay contract, the same one the points and parks use, so the map labels
 * every overlay the same way.
 *
 * @param source - Raw record from data-source-static.
 * @returns Canonical {@link OverlayContract} of cycle lanes, each labelled with
 * its name and type — the type is also what the map draws a ciclorrota dashed
 * by.
 * @throws If the snapshot carries no stretches — an empty layer would look
 * exactly like a city without cycle lanes.
 *
 * @example
 * toAppBikeLanes(source);
 * // { type: 'FeatureCollection', features: [{ id: 1, properties: { name: 'CICLORROTA BROOKLIN', detail: 'Ciclorrota' }, geometry: { type: 'LineString', ... } }] }
 */
export const toAppBikeLanes = (
  source: StaticBikeLanesDataSource
): OverlayContract => {
  if (source.ciclovias.length === 0) {
    throw new Error('[data-gateway] toAppBikeLanes received an empty snapshot');
  }

  return {
    type: 'FeatureCollection',
    features: source.ciclovias.map((lane) => {
      return {
        type: 'Feature',
        id: lane.id,
        properties: { name: lane.nome, detail: lane.tipo },
        geometry: lane.geometry,
      };
    }),
  };
};
