import type { PointOverlayId } from '@/config/overlays';

import type { StaticPointsDataSource } from '../../data-source-static/types';
import type { NearbyPoint, NearbyQuery } from '../schema';
import { pointDetail, pointFacts } from './toAppPoints';

/** Mean Earth radius, in metres. */
const EARTH_RADIUS = 6_371_008.8;

const toRadians = (degrees: number) => {
  return (degrees * Math.PI) / 180;
};

/**
 * Great-circle distance between two points, in metres.
 *
 * @example
 * distanceInMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }); // ≈ 111195
 */
export const distanceInMetres = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
};

/**
 * The points of one layer's snapshot inside the ring a search asks for.
 *
 * @remarks
 * The ring's inner edge is exclusive, so a point at the searched spot itself —
 * the facility the reader clicked — is not among the answers, and a widened
 * search never returns a point the narrower one already did.
 *
 * @param params.layer - The layer the snapshot belongs to.
 * @param params.source - Raw record from data-source-static.
 * @param params.query - The point and the ring searched.
 * @returns The points inside the ring, in the snapshot's order.
 *
 * @example
 * toAppNearbyPoints({ layer: 'ubs', source, query: { lat: -23.55, lng: -46.63, radiusMin: 0, radius: 1000 } });
 * // [{ id: 'ubs:12', lngLat: [-46.631, -23.548], name: 'UBS SÉ', detail: 'UBS · Municipal', address: 'R. Tabatinguera, 200 · Sé', phone: '3241-0000', hours: '', facts: [{ label: 'Tipo', value: 'UBS' }, { label: 'Esfera', value: 'Municipal' }], categoryId: 'ubs', distance: 230 }]
 */
export const toAppNearbyPoints = ({
  layer,
  source,
  query,
}: {
  layer: PointOverlayId;
  source: StaticPointsDataSource;
  query: NearbyQuery;
}): NearbyPoint[] => {
  return source.points.flatMap((point) => {
    const distance = distanceInMetres(query, {
      lat: point.latitude,
      lng: point.longitude,
    });

    if (distance <= query.radiusMin || distance > query.radius) {
      return [];
    }

    return [
      {
        id: `${layer}:${point.id}`,
        lngLat: [point.longitude, point.latitude],
        name: point.atributos['nome'] ?? '',
        detail: pointDetail(layer, point.atributos),
        address: [
          point.atributos['endereco'],
          point.atributos['bairro'],
          point.atributos['cep'],
        ]
          .filter(Boolean)
          .join(' · '),
        phone: point.atributos['telefone'] ?? '',
        hours: point.atributos['horario'] ?? '',
        facts: pointFacts(point.atributos),
        categoryId: layer,
        distance,
      },
    ];
  });
};
