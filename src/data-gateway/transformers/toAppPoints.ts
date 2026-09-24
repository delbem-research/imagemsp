import type { PointOverlayId } from '@/config/overlays';

import type { StaticPointsDataSource } from '../../data-source-static/types';
import type { OverlayContract } from '../schema';

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
  PointOverlayId,
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
  // A sports centre's type repeats its category before the slash
  // (`Centro Esportivo/Balneário`), so only the part after it is kept; a
  // community club's type already reads on its own.
  esporte: (a) => {
    const tipo = a['tipo'] ?? '';
    const prefix = 'Centro Esportivo/';

    // Split at the first slash only: the rest carries slashes of its own
    // (`Centro Educacional e Esportivo - CE/CEE`).
    return tipo.startsWith(prefix)
      ? joinDetail(['Centro Esportivo', tipo.slice(prefix.length)])
      : tipo;
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
 * @returns Canonical {@link OverlayContract}.
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
  layer: PointOverlayId;
  source: StaticPointsDataSource;
}): OverlayContract => {
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
