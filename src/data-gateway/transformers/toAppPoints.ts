import type { PointLayerId } from '@/config/pointLayers';

import type { StaticPointsDataSource } from '../../data-source-static/types';
import type { PointsContract } from '../schema';

/**
 * Turns an all-caps source value into title case (`REDE COZINHA CIDADÃ` →
 * `Rede Cozinha Cidadã`, `ESTADUAL/MUNICIPAL` → `Estadual/Municipal`), so the
 * tooltip's secondary line does not shout. Names are left as the source spells
 * them.
 *
 * @param value - The source value.
 * @returns The value in title case.
 *
 * @example
 * titleCase('BOM PRATO'); // 'Bom Prato'
 */
const titleCase = (value: string): string => {
  return value
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s/-])(\p{L})/gu, (_, sep: string, letter: string) => {
      return sep + letter.toLocaleUpperCase('pt-BR');
    });
};

/** Joins the non-empty parts of a tooltip's secondary line. */
const joinDetail = (parts: (string | undefined)[]): string => {
  return parts
    .filter((part) => {
      return Boolean(part);
    })
    .join(' · ');
};

/**
 * The tooltip's secondary line per layer, built from the snapshot's columns.
 * Which columns a reader sees is an app decision, so it lives here and not in
 * the generator, which keeps every column.
 */
const DETAIL: Record<
  PointLayerId,
  (atributos: Record<string, string>) => string
> = {
  hospitais: (a) => {
    return joinDetail([a['tipo'], a['esfera']]);
  },
  ubs: (a) => {
    return joinDetail([a['tipo'], a['esfera']]);
  },
  restaurantes: (a) => {
    return joinDetail([
      titleCase(a['programa'] ?? ''),
      titleCase(a['esfera'] ?? ''),
    ]);
  },
  estacoes: (a) => {
    return joinDetail([
      a['modal'],
      a['linha'] ? `Linha ${titleCase(a['linha'])}` : undefined,
    ]);
  },
  terminais: (a) => {
    return joinDetail([titleCase(a['tipo'] ?? ''), a['status']]);
  },
  'pontos-onibus': (a) => {
    return a['endereco'] ?? '';
  },
};

/**
 * Transforms a source-native point snapshot into the canonical app contract.
 *
 * @remarks
 * Keeps only what the map's tooltip reads — a name and one secondary line —
 * so the client does not download addresses and phone numbers it never shows.
 * That matters most for the bus stops, whose 22 thousand rows are the bulk of
 * every layer combined.
 *
 * @param params.layer - The layer the snapshot belongs to; picks its
 * secondary line.
 * @param params.source - Raw record from data-source-static.
 * @returns Canonical {@link PointsContract}.
 * @throws If the snapshot carries no points — an empty layer would look
 * exactly like a city without any of them.
 *
 * @example
 * toAppPoints({ layer: 'hospitais', source });
 * // { type: 'FeatureCollection', features: [{ id: 1, properties: { name: 'SANTA CASA DE SÃO PAULO', detail: 'Hospital · Privado' } }] }
 */
export const toAppPoints = ({
  layer,
  source,
}: {
  layer: PointLayerId;
  source: StaticPointsDataSource;
}): PointsContract => {
  if (source.points.length === 0) {
    throw new Error(
      `[data-gateway] toAppPoints received an empty ${layer} snapshot`
    );
  }

  const detail = DETAIL[layer];

  return {
    type: 'FeatureCollection',
    features: source.points.map((point) => {
      return {
        type: 'Feature',
        id: point.id,
        properties: {
          name: point.atributos['nome'] ?? '',
          detail: detail(point.atributos),
        },
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude],
        },
      };
    }),
  };
};
