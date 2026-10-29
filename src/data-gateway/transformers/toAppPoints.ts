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
 * GeoSampa's placeholders for an empty type or sphere. They carry nothing a
 * reader can use, so they are left out of the tooltip rather than printed.
 */
const PLACEHOLDERS = new Set(['SEM TIPO', 'SEM ESFERA']);

/**
 * The secondary line of a GeoSampa facility — the layers that share the
 * `equipamento_*` schema: its type and administrative sphere, skipping either
 * when the source leaves a placeholder.
 *
 * @param a - The point's columns.
 * @returns E.g. `Pronto Atendimento · Municipal`.
 */
const equipmentDetail = (a: Record<string, string>): string => {
  return joinDetail(
    [a['tipo'], a['esfera']].filter((part) => {
      return !PLACEHOLDERS.has(part ?? '');
    })
  );
};

/** The SAMU base modalities, in the order the tooltip lists them. */
const SAMU_MODALITIES: [column: string, label: string][] = [
  ['suporte_avancado', 'Suporte avançado'],
  ['suporte_basico', 'Suporte básico'],
  ['suporte_basico_enfermeiro', 'Suporte básico com enfermeiro'],
  ['motolancia', 'Motolância'],
];

/** `1 vaga`, `3 vagas`; empty for a count the source leaves blank. */
const spaces = (count: string | undefined): string => {
  if (!count) return '';
  return `${count} ${count === '1' ? 'vaga' : 'vagas'}`;
};

/** GeoSampa writes the weekdays in capitals and without their accents. */
const WEEKDAYS: Record<string, string> = {
  'SEGUNDA-FEIRA': 'Segunda-feira',
  'TERCA-FEIRA': 'Terça-feira',
  'QUARTA-FEIRA': 'Quarta-feira',
  'QUINTA-FEIRA': 'Quinta-feira',
  'SEXTA-FEIRA': 'Sexta-feira',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};

/** The bike parking kinds, accented as they are not in the source. */
const BIKE_PARKING: Record<string, string> = {
  BICICLETARIO: 'Bicicletário',
  PARACICLO: 'Paraciclo',
};

/** Who an on-street special space is reserved for. */
const SPACE_KINDS: Record<string, string> = {
  IDOSO: 'Idoso',
  DEFICIENTE: 'Pessoa com deficiência',
};

/**
 * An all-caps source sentence in sentence case (`SEGUNDA A SÁBADO 7H-18H` →
 * `Segunda a sábado 7h-18h`): title case would capitalise every `a` and `e`.
 */
const sentenceCase = (value: string): string => {
  const lower = value.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
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
  hospitais: equipmentDetail,
  // From CNES rather than GeoSampa: its kind, and whether it is a company or a
  // philanthropic entity.
  'hospitais-privados': (a) => {
    return joinDetail([a['tipo'], a['natureza']]);
  },
  urgencia: equipmentDetail,
  // The region, then the modalities the base answers with.
  samu: (a) => {
    return joinDetail([
      a['regiao'] ? `Região ${titleCase(a['regiao'])}` : undefined,
      ...SAMU_MODALITIES.filter(([column]) => {
        return a[column] === 'Sim';
      }).map(([, label]) => {
        return label;
      }),
    ]);
  },
  ubs: equipmentDetail,
  ambulatorios: equipmentDetail,
  'saude-mental': equipmentDetail,
  'dst-aids': equipmentDetail,
  vigilancia: equipmentDetail,
  animais: equipmentDetail,
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
  // The weekday it is held, then how many stalls it has.
  feiras: (a) => {
    return joinDetail([
      WEEKDAYS[a['dia'] ?? ''] ?? titleCase(a['dia'] ?? ''),
      a['bancas'] ? `${a['bancas']} bancas` : undefined,
    ]);
  },
  mercados: (a) => {
    return sentenceCase(a['horario'] ?? '');
  },
  // The days and hours it is held, already in sentence case at the source.
  'feiras-organicas': (a) => {
    return a['horario'] ?? '';
  },
  // Who looks after the garden, when the source names a group; else where it is.
  hortas: (a) => {
    return a['responsavel'] || a['bairro'] || '';
  },
  sesc: (a) => {
    return titleCase(a['bairro'] ?? '');
  },
  bicicletarios: (a) => {
    return joinDetail([
      BIKE_PARKING[a['tipo'] ?? ''] ?? titleCase(a['tipo'] ?? ''),
      spaces(a['vagas']),
    ]);
  },
  // An establishment's spaces for older people first, the reason it is listed.
  'vagas-idoso': (a) => {
    return joinDetail([
      a['vagas_idoso'] && a['vagas_idoso'] !== '0'
        ? `${spaces(a['vagas_idoso'])} para idosos`
        : undefined,
      a['vagas_deficiente'] && a['vagas_deficiente'] !== '0'
        ? `${spaces(a['vagas_deficiente'])} para pessoas com deficiência`
        : undefined,
    ]);
  },
  // Named by its address: who it is for, how many, and whether it rotates.
  'vagas-especiais': (a) => {
    return joinDetail([
      SPACE_KINDS[a['tipo'] ?? ''],
      spaces(a['vagas']),
      a['rotativo'] === 'S' ? 'Rotativa' : undefined,
    ]);
  },
  'pontos-onibus': (a) => {
    return a['endereco'] ?? '';
  },
};

/** GeoSampa's one-letter flags. */
const YES_NO: Record<string, string> = { S: 'Sim', N: 'Não' };

/** A column's value as the details read it; `''` leaves the line out. */
type FactFormat = (value: string, atributos: Record<string, string>) => string;

const asIs: FactFormat = (value) => {
  return value;
};

/**
 * Title case for a value the source writes in capitals only (`BOM PRATO`);
 * one already in mixed case (`Unidade Básica de Saúde`) is kept as written.
 */
const calm: FactFormat = (value) => {
  return value === value.toLocaleUpperCase('pt-BR') ? titleCase(value) : value;
};

/** {@link calm}, leaving out GeoSampa's placeholders (`SEM TIPO`). */
const known: FactFormat = (value, atributos) => {
  return PLACEHOLDERS.has(value) ? '' : calm(value, atributos);
};

/**
 * The columns a place's expanded details list, in order, each with its label
 * and how its value reads. A point shows those of them it has; its name,
 * address, phone and hours are shown on their own.
 */
const FACTS: [column: string, label: string, format: FactFormat][] = [
  ['categoria', 'Categoria', calm],
  [
    'tipo',
    'Tipo',
    (value, atributos) => {
      return (
        BIKE_PARKING[value] ?? SPACE_KINDS[value] ?? known(value, atributos)
      );
    },
  ],
  ['programa', 'Programa', calm],
  ['natureza', 'Natureza', asIs],
  ['sus', 'Atende SUS', asIs],
  ['esfera', 'Esfera', known],
  ['modal', 'Modal', asIs],
  ['linha', 'Linha', calm],
  ['empresa', 'Operadora', asIs],
  ['situacao', 'Situação', sentenceCase],
  ['status', 'Situação', sentenceCase],
  ['regiao', 'Região', calm],
  ['responsavel', 'Responsável', asIs],
  [
    'dia',
    'Dia',
    (value) => {
      return WEEKDAYS[value] ?? titleCase(value);
    },
  ],
  ['bancas', 'Bancas', asIs],
  ['vagas', 'Vagas', asIs],
  ['vagas_idoso', 'Vagas idoso', asIs],
  ['vagas_deficiente', 'Vagas PcD', asIs],
  [
    'rotativo',
    'Rotativa',
    (value) => {
      return YES_NO[value] ?? value;
    },
  ],
  ['area', 'Área', calm],
  ['codigo', 'Código', asIs],
  // A bus stop's description mostly repeats its address.
  [
    'descricao',
    'Descrição',
    (value, atributos) => {
      return value === atributos['endereco'] ? '' : value;
    },
  ],
];

/**
 * Every labelled fact the source has about one point, for its expanded
 * details — and, for a SAMU base, the modalities it answers with.
 *
 * @param atributos - The point's columns.
 * @returns The facts in {@link FACTS} order, those without a value left out.
 *
 * @example
 * pointFacts({ tipo: 'PARACICLO', vagas: '10', responsavel: 'CPTM' });
 * // [{ label: 'Tipo', value: 'Paraciclo' }, { label: 'Responsável', value: 'CPTM' }, { label: 'Vagas', value: '10' }]
 */
export const pointFacts = (
  atributos: Record<string, string>
): { label: string; value: string }[] => {
  const facts = FACTS.flatMap(([column, label, format]) => {
    const raw = atributos[column]?.trim();
    const value = raw ? format(raw, atributos) : '';
    return value ? [{ label, value }] : [];
  });
  const modalities = SAMU_MODALITIES.filter(([column]) => {
    return atributos[column] === 'Sim';
  }).map(([, label]) => {
    return label;
  });
  return modalities.length
    ? [...facts, { label: 'Atendimento', value: modalities.join(' · ') }]
    : facts;
};

/**
 * The tooltip's secondary line of one point.
 *
 * @param layer - The layer the point belongs to.
 * @param atributos - The point's columns.
 * @returns E.g. `Hospital · Estadual` or `Metrô · Linha Azul`.
 *
 * @example
 * pointDetail('hospitais', { tipo: 'Hospital', esfera: 'Estadual' }); // 'Hospital · Estadual'
 */
export const pointDetail = (
  layer: PointOverlayId,
  atributos: Record<string, string>
): string => {
  return DETAIL[layer](atributos);
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
