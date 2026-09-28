/**
 * Generates one snapshot per map point layer, `src/data-source-static/data/points/<layer>.json`,
 * from the GeoSampa CSVs in `src/data-source-static/data/raw/`.
 *
 * Every CSV shares the tail `longitude,latitude,distrito` (see the `distritos_*`
 * entries of `public/dataset_catalogue.json`) and carries its own descriptive
 * columns before it. The snapshot keeps those columns as-is under `atributos`
 * and gives each point a stable numeric id — MapLibre only reports hovered
 * point features that carry one. Choosing which columns reach the tooltip is
 * left to the app (`data-gateway/transformers/toAppPoints`).
 *
 * Run it whenever a source CSV is replaced:
 *
 * ```bash
 * node scripts/generatePointsData.ts            # every layer
 * node scripts/generatePointsData.ts ubs        # one layer
 * ```
 *
 * Coordinates are asserted to fall inside the capital's bounding box: a swapped
 * latitude/longitude pair or a projected (UTM) coordinate would otherwise draw
 * the point in the ocean or off the map, with nothing to say it went wrong.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const RAW_DIR = path.join(ROOT, 'src/data-source-static/data/raw');

/** Where the snapshots consumed by `readStaticPoints` are written. */
const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/points');

/**
 * Source CSV and descriptive columns per layer. Mirrors `POINT_OVERLAY_IDS` in
 * `src/config/overlays.ts`, which this script cannot import (it runs under
 * plain `node`, outside the app's path aliases).
 */
const LAYERS: Record<string, { csv: string; columns: string[] }> = {
  hospitais: {
    csv: 'hospitais_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  ubs: {
    csv: 'ubs_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  urgencia: {
    csv: 'urgencia_emergencia_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  ambulatorios: {
    csv: 'ambulatorios_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  'saude-mental': {
    csv: 'saude_mental_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  'dst-aids': {
    csv: 'dst_aids_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  vigilancia: {
    csv: 'vigilancia_saude_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  animais: {
    csv: 'animais_geosampa.csv',
    columns: [
      'nome',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  samu: {
    csv: 'samu_geosampa.csv',
    columns: [
      'nome',
      'regiao',
      'endereco',
      'suporte_basico',
      'suporte_basico_enfermeiro',
      'suporte_avancado',
      'motolancia',
    ],
  },
  restaurantes: {
    csv: 'restaurantes_publicos_geosampa.csv',
    columns: ['nome', 'programa', 'esfera', 'endereco'],
  },
  esporte: {
    csv: 'esporte_publico_geosampa.csv',
    columns: [
      'nome',
      'categoria',
      'tipo',
      'esfera',
      'endereco',
      'bairro',
      'cep',
      'telefone',
    ],
  },
  estacoes: {
    csv: 'estacoes_metro_trem_geosampa.csv',
    columns: ['nome', 'modal', 'empresa', 'linha', 'situacao'],
  },
  terminais: {
    csv: 'terminais_onibus_geosampa.csv',
    columns: ['nome', 'tipo', 'endereco', 'status'],
  },
  'pontos-onibus': {
    csv: 'pontos_onibus_geosampa.csv',
    columns: ['codigo', 'nome', 'endereco', 'descricao'],
  },
};

/** Columns every CSV ends with, after its descriptive ones. */
const LOCATION_COLUMNS = ['longitude', 'latitude', 'distrito'];

/**
 * Bounding box of the municipality of São Paulo in WGS84, with a small margin.
 * The CSVs were already clipped to the city, so a point outside it is a
 * coordinate problem, not a place in another town.
 */
const SP_BOUNDS = {
  minLng: -46.9,
  maxLng: -46.3,
  minLat: -24.05,
  maxLat: -23.3,
};

/** One point of a generated snapshot; mirrors `StaticPointsDataSource.points`. */
type PointRow = {
  id: number;
  longitude: number;
  latitude: number;
  distrito: string;
  atributos: Record<string, string>;
};

/**
 * Splits one CSV line into cells, honouring double-quoted fields — addresses
 * carry commas (`"R. DR CESARIO MOTTA JR, 112"`), so a plain split would shift
 * every column after them.
 *
 * @param line - One line of the CSV.
 * @returns The line's cells, unquoted.
 *
 * @example
 * splitCsvLine('a,"b, c",d'); // ['a', 'b, c', 'd']
 */
const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);

  return cells;
};

/**
 * Parses one layer's CSV into snapshot rows, numbering them in file order.
 *
 * @param params.csvPath - Absolute path to the CSV.
 * @param params.columns - The layer's descriptive columns, in order.
 * @returns One entry per data line.
 * @throws If the header is not `columns` followed by {@link LOCATION_COLUMNS},
 * or a line is short of columns.
 *
 * @example
 * parseRows({ csvPath: '/abs/ubs_geosampa.csv', columns: ['nome', ...] });
 * // [{ id: 1, longitude: -46.58, latitude: -23.55, distrito: 'Água Rasa', atributos: { nome: 'AMA/UBS ÁGUA RASA ...' } }]
 */
const parseRows = ({
  csvPath,
  columns,
}: {
  csvPath: string;
  columns: string[];
}): PointRow[] => {
  const expected = [...columns, ...LOCATION_COLUMNS];
  const lines = readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => {
      return line.trim() !== '';
    });
  const header = splitCsvLine(lines[0] ?? '');

  if (header.join(',') !== expected.join(',')) {
    throw new Error(
      `[generatePointsData] ${path.basename(csvPath)}: unexpected header ${header.join(',')}`
    );
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line).map((cell) => {
      return cell.trim();
    });

    if (cells.length !== expected.length) {
      throw new Error(
        `[generatePointsData] ${path.basename(csvPath)}: line ${index + 2} has ${cells.length} columns, expected ${expected.length}`
      );
    }

    const atributos = Object.fromEntries(
      columns.map((column, position) => {
        return [column, cells[position] ?? ''];
      })
    );

    return {
      id: index + 1,
      longitude: Number(cells[columns.length]),
      latitude: Number(cells[columns.length + 1]),
      distrito: cells[columns.length + 2] ?? '',
      atributos,
    };
  });
};

/**
 * Asserts every point can be drawn and labelled: a name for the tooltip, a
 * district, and a coordinate inside the city.
 *
 * @param params.layer - Layer id, for the error messages.
 * @param params.points - Parsed snapshot rows.
 * @throws If the CSV is empty or any row breaks one of those invariants.
 *
 * @example
 * validate({ layer: 'ubs', points }); // throws on a UBS with latitude -46.6
 */
const validate = ({
  layer,
  points,
}: {
  layer: string;
  points: PointRow[];
}): void => {
  if (points.length === 0) {
    throw new Error(`[generatePointsData] ${layer}: the CSV has no rows`);
  }

  for (const point of points) {
    if (!point.atributos['nome'] || !point.distrito) {
      throw new Error(
        `[generatePointsData] ${layer}: point ${point.id} is missing its name or district`
      );
    }

    const { longitude, latitude } = point;
    const inCity =
      longitude >= SP_BOUNDS.minLng &&
      longitude <= SP_BOUNDS.maxLng &&
      latitude >= SP_BOUNDS.minLat &&
      latitude <= SP_BOUNDS.maxLat;

    if (!inCity) {
      throw new Error(
        `[generatePointsData] ${layer}: point ${point.id} (${point.atributos['nome']}) sits at ${longitude}, ${latitude}, outside São Paulo — swapped or projected coordinates?`
      );
    }
  }
};

const requested = process.argv.slice(2);
const layers = requested.length > 0 ? requested : Object.keys(LAYERS);

mkdirSync(OUT_DIR, { recursive: true });

for (const layer of layers) {
  const config = LAYERS[layer];

  if (!config) {
    throw new Error(
      `[generatePointsData] unknown layer "${layer}". Known: ${Object.keys(LAYERS).join(', ')}`
    );
  }

  const points = parseRows({
    csvPath: path.join(RAW_DIR, config.csv),
    columns: config.columns,
  });

  validate({ layer, points });

  const outFile = path.join(OUT_DIR, `${layer}.json`);

  // Compact rather than indented: the bus-stop snapshot alone is 22 thousand
  // points, and pretty-printing would roughly double its size in the repo.
  writeFileSync(outFile, `${JSON.stringify({ points })}\n`, 'utf8');

  console.log(
    `[generatePointsData] wrote ${points.length} points to ${path.relative(ROOT, outFile)}`
  );
}
