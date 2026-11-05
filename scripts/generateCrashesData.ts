/**
 * Generates `src/data-source-static/data/heat/acidentes.json`, the snapshot
 * behind the map's traffic crash heatmap, from INFOSIGA-SP (DETRAN-SP,
 * CC BY 4.0).
 *
 * The source is the `sinistros` table, one row per crash with its
 * coordinates, joined to the `pessoas` table, one row per person involved with
 * their age and injury. The snapshot keeps the crashes of {@link YEAR} in the
 * city that fall inside an official district and in which **a person aged 65
 * or more was hurt or killed** (`gravidade_lesao` leve, grave or fatal) — the
 * danger the streets hold for the public the map is about. Confirmed crashes
 * only: the notifications (`NOTIFICACAO`), a third of the rows, are reports
 * still unconfirmed as crashes.
 *
 * Each crash is its position and the age bands of its older people hurt —
 * `65-69`, `70-74`, `75` (75 or more), the app's own bands — so the map's age
 * filter narrows the heat. People unhurt, or of unknown age, do not count.
 *
 * DETRAN-SP's own download (`infosiga.detran.sp.gov.br/rest/painel/download/
 * file/dados_infosiga.zip`) refuses requests from outside its dashboard, so
 * the archive comes from the monthly mirror of the `infosigasp` R package,
 * the same file republished. The 140 MB archive is downloaded at generation
 * time and never versioned.
 *
 * Run it when a new year is wanted, or to refresh the current one:
 *
 * ```bash
 * node scripts/generateCrashesData.ts
 * ```
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadOfficialDistricts } from './lib/officialDistricts.ts';
import { readZipEntry } from './lib/readZipEntry.ts';
import type { Position } from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/heat');
const OUT_FILE = path.join(OUT_DIR, 'acidentes.json');
const MAPS_DATA = path.join(ROOT, 'src/data-source-static/data/maps-data.json');

const ARCHIVE =
  'https://github.com/viniciusoike/infosigasp/releases/download/data-current/dados_infosiga.zip';

/** The year mapped, and the archive file that holds it. */
const YEAR = '2024';
const ENTRY = 'sinistros_2022-2024.csv';
const PEOPLE_ENTRY = 'pessoas_2022-2024.csv';

/** The injuries that count: a person unhurt, or of unknown injury, does not. */
const HURT = new Set(['LEVE', 'GRAVE', 'FATAL']);

/** The app's age bands for an age of 65 or more (see `OFFER_AGE_BANDS`). */
type AgeBand = '65-69' | '70-74' | '75';

const AGE_BANDS: AgeBand[] = ['65-69', '70-74', '75'];

/** The band of an age of 65 or more, `null` for a younger one. */
const ageBand = (age: number): AgeBand | null => {
  if (age < 65) return null;
  if (age < 70) return '65-69';
  if (age < 75) return '70-74';
  return '75';
};

/** How the source spells the city in `municipio`. */
const CITY = 'SAO PAULO';

/** Rows that report a crash still unconfirmed, left out of the map. */
const NOTIFICATION = 'NOTIFICACAO';

/** Five decimals: about a metre, finer than the source's own geocoding. */
const PRECISION = 1e5;

/**
 * Splits one line of the source into cells, honouring double-quoted fields:
 * a few addresses carry the `;` the file is separated by.
 *
 * @param line - One line of the CSV.
 * @returns The line's cells, unquoted.
 *
 * @example
 * splitCsvLine('a;"b; c";d'); // ['a', 'b; c', 'd']
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
    } else if (char === ';') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);

  return cells;
};

/** A coordinate as the source writes it, with a decimal comma. */
const parseCoordinate = (value: string | undefined): number => {
  return Number((value ?? '').replace(',', '.'));
};

const round = (value: number): number => {
  return Math.round(value * PRECISION) / PRECISION;
};

const response = await fetch(ARCHIVE);

if (!response.ok) {
  throw new Error(
    `[generateCrashesData] the archive mirror answered ${response.status}`
  );
}

const zip = Buffer.from(await response.arrayBuffer());

/** An archive table's lines, and its columns by name. */
const readTable = (name: string) => {
  const lines = readZipEntry({ zip, name }).toString('latin1').split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? '');
  const column = (columnName: string): number => {
    const index = header.indexOf(columnName);
    if (index === -1) {
      throw new Error(
        `[generateCrashesData] ${name} has no column ${columnName}`
      );
    }
    return index;
  };
  return { lines, column };
};

/**
 * The age bands of the people aged 65 or more hurt or killed in each crash,
 * by crash id.
 */
const olderHurtByCrash = (): Map<string, Set<AgeBand>> => {
  const { lines, column } = readTable(PEOPLE_ENTRY);
  const CRASH = column('id_sinistro');
  const AGE = column('idade');
  const INJURY = column('gravidade_lesao');
  const bands = new Map<string, Set<AgeBand>>();
  for (const line of lines.slice(1)) {
    if (line === '') continue;
    const cells = splitCsvLine(line);
    if (!HURT.has(cells[INJURY] ?? '')) continue;
    const age = Number.parseInt(cells[AGE] ?? '', 10);
    const band = Number.isFinite(age) ? ageBand(age) : null;
    if (!band) continue;
    const crash = cells[CRASH] ?? '';
    bands.set(crash, (bands.get(crash) ?? new Set()).add(band));
  }
  return bands;
};

const olderHurt = olderHurtByCrash();
const { lines, column } = readTable(ENTRY);

const ID_COLUMN = column('id_sinistro');
const YEAR_COLUMN = column('ano_sinistro');
const CITY_COLUMN = column('municipio');
const RECORD_COLUMN = column('tipo_registro');
const LATITUDE_COLUMN = column('latitude');
const LONGITUDE_COLUMN = column('longitude');

const districtAt = await loadOfficialDistricts(MAPS_DATA);

const acidentes: [...Position, AgeBand[]][] = [];
let withoutPosition = 0;
let outsideCity = 0;
let withoutOlderHurt = 0;

for (const line of lines.slice(1)) {
  if (line === '') continue;
  const cells = splitCsvLine(line);

  if (
    cells[YEAR_COLUMN] !== YEAR ||
    cells[CITY_COLUMN] !== CITY ||
    cells[RECORD_COLUMN] === NOTIFICATION
  ) {
    continue;
  }

  const bands = olderHurt.get(cells[ID_COLUMN] ?? '');
  if (!bands) {
    withoutOlderHurt += 1;
    continue;
  }

  const position: Position = [
    parseCoordinate(cells[LONGITUDE_COLUMN]),
    parseCoordinate(cells[LATITUDE_COLUMN]),
  ];

  if (!position.every(Number.isFinite) || position.includes(0)) {
    withoutPosition += 1;
    continue;
  }

  // A crash geocoded outside the city — a highway kilometre placed in the
  // next municipality, a swapped coordinate — would heat a place it never
  // happened in.
  if (!districtAt(position)) {
    outsideCity += 1;
    continue;
  }

  acidentes.push([
    round(position[0]),
    round(position[1]),
    AGE_BANDS.filter((band) => {
      return bands.has(band);
    }),
  ]);
}

if (acidentes.length === 0) {
  throw new Error(`[generateCrashesData] no crash found in ${CITY} in ${YEAR}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  `${JSON.stringify({ ano: Number(YEAR), acidentes })}\n`
);

console.log(
  `[generateCrashesData] ${acidentes.length} crashes in ${YEAR} with a person aged 65+ hurt → ${path.relative(ROOT, OUT_FILE)} (${withoutOlderHurt} without one, ${withoutPosition} without a position, ${outsideCity} outside the city)`
);
