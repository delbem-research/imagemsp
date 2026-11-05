import type { StaticCrashesDataSource } from '../../data-source-static/types';
import type { OverlayContract } from '../schema';

/**
 * Transforms the source-native crash snapshot into the canonical overlay
 * contract, as points the map's heatmap draws the density of.
 *
 * A heatmap shows where crashes crowd, never one crash: it has no tooltip, so
 * the features carry no name or detail of their own. Each crash is one point
 * per age band of its older people hurt, carrying its `faixa`, which the
 * heatmap filters by; the first of them also carries `todos: 1`, which is what
 * the heatmap keeps when every band is picked, so a crash with people of two
 * bands still heats its place once.
 *
 * @param source - Raw record from data-source-static.
 * @returns Canonical {@link OverlayContract} of crash points, numbered in the
 * snapshot's order.
 * @throws If the snapshot carries no crashes — an empty heatmap would look
 * exactly like a city without them.
 *
 * @example
 * toAppCrashes({ ano: 2024, acidentes: [[-46.74931, -23.53816, ['70-74']]] });
 * // { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, properties: { name: '', detail: '', faixa: '70-74', todos: 1 }, geometry: { type: 'Point', coordinates: [-46.74931, -23.53816] } }] }
 */
export const toAppCrashes = (
  source: StaticCrashesDataSource
): OverlayContract => {
  if (source.acidentes.length === 0) {
    throw new Error('[data-gateway] toAppCrashes received an empty snapshot');
  }

  return {
    type: 'FeatureCollection',
    features: source.acidentes
      .flatMap(([longitude, latitude, bands]) => {
        return bands.map((faixa, index) => {
          return {
            faixa,
            todos: index === 0 ? 1 : 0,
            coordinates: [longitude, latitude] as [number, number],
          };
        });
      })
      .map(({ faixa, todos, coordinates }, index) => {
        return {
          type: 'Feature' as const,
          id: index + 1,
          properties: { name: '', detail: '', faixa, todos },
          geometry: { type: 'Point' as const, coordinates },
        };
      }),
  };
};
