/**
 * Recomputes the `distrito` column of the GeoSampa point CSVs in
 * `src/data-source-static/data/raw/` against the official district mesh, and
 * drops the rows that fall outside the city.
 *
 * Every CSV ends with `longitude,latitude,distrito`. Only that last column is
 * rewritten; every other cell is written back as read, so the diff of a run
 * shows exactly which points changed district and which left the file.
 *
 * Run it after a CSV is replaced, before `scripts/generatePointsData.ts`:
 *
 * ```bash
 * node scripts/assignDistricts.ts                       # every *_geosampa.csv
 * node scripts/assignDistricts.ts ubs_geosampa.csv      # one file
 * ```
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { loadOfficialDistricts } from './lib/officialDistricts.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const RAW_DIR = path.join(ROOT, 'src/data-source-static/data/raw');
const MAPS_DATA = path.join(ROOT, 'src/data-source-static/data/maps-data.json');

/** The columns every point CSV ends with. */
const LOCATION_COLUMNS = ['longitude', 'latitude', 'distrito'];

/** The CSVs were written with CRLF line endings; keep them. */
const EOL = '\r\n';

/**
 * Splits one CSV line into cells, honouring double-quoted fields.
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
 * Quotes a cell only when it needs it, as the CSVs were written: a cell with a
 * comma, a quote or a line break.
 *
 * @param cell - The cell's text.
 * @returns The cell as it goes in the file.
 *
 * @example
 * quoteCell('R. DR CESARIO MOTTA JR, 112'); // '"R. DR CESARIO MOTTA JR, 112"'
 */
const quoteCell = (cell: string): string => {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

const districtAt = await loadOfficialDistricts(MAPS_DATA);

const requested = process.argv.slice(2);
const files =
  requested.length > 0
    ? requested
    : readdirSync(RAW_DIR).filter((file) => {
        return file.endsWith('_geosampa.csv');
      });

for (const file of files) {
  const csvPath = path.join(RAW_DIR, file);
  const lines = readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => {
      return line !== '';
    });
  const header = splitCsvLine(lines[0] ?? '');

  if (
    header.slice(-LOCATION_COLUMNS.length).join(',') !==
    LOCATION_COLUMNS.join(',')
  ) {
    throw new Error(
      `[assignDistricts] ${file} does not end with ${LOCATION_COLUMNS.join(',')}`
    );
  }

  const kept: string[] = [lines[0] as string];
  const moved: string[] = [];
  const dropped: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const longitude = Number(cells[cells.length - 3]);
    const latitude = Number(cells[cells.length - 2]);
    const previous = cells[cells.length - 1];
    const district = districtAt([longitude, latitude]);

    if (!district) {
      dropped.push(cells[0] ?? '');
      continue;
    }

    if (district !== previous) {
      moved.push(`${cells[0]}: ${previous} → ${district}`);
    }

    cells[cells.length - 1] = district;
    kept.push(cells.map(quoteCell).join(','));
  }

  writeFileSync(csvPath, `${kept.join(EOL)}${EOL}`, 'utf8');

  console.log(
    `[assignDistricts] ${file}: ${kept.length - 1} rows, ${moved.length} changed district, ${dropped.length} outside the city`
  );

  for (const change of moved) {
    console.log(`    ${change}`);
  }

  for (const name of dropped) {
    console.log(`    dropped: ${name}`);
  }
}
