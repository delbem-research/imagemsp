/**
 * Generates `src/data-source-static/data/lines/ciclovias.json`, the snapshot
 * behind the map's cycle network layer, from GeoSampa.
 *
 * The source is `via_bicicleta`: every stretch of the city's cycle network —
 * ciclovias (separated from traffic), ciclofaixas (painted lanes on the road),
 * ciclorrotas (signed routes shared with traffic) and the one ciclopassarela
 * (a cycle footbridge).
 *
 * Run it whenever GeoSampa updates the layer:
 *
 * ```bash
 * node scripts/generateBikeLanesData.ts
 * ```
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  countLineVertices,
  type LineGeometry,
  simplifyLineGeometry,
} from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/lines');
const OUT_FILE = path.join(OUT_DIR, 'ciclovias.json');

const LAYER = 'via_bicicleta';

const WFS = `https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:${LAYER}`;

/**
 * Douglas-Peucker tolerance, in metres. A lane follows its street, so this
 * only drops the survey-grade jitter along a straight run; corners stay put.
 */
const SIMPLIFY_TOLERANCE_M = 3;

/** The source's lower-case types, as the tooltip names them. */
const TYPES: Record<string, string> = {
  ciclovia: 'Ciclovia',
  ciclofaixa: 'Ciclofaixa',
  ciclorrota: 'Ciclorrota',
  ciclopassarela: 'Ciclopassarela',
};

type BikeLaneProps = {
  cd_identificador_ciclovia: number;
  nm_trecho_via_bicicleta: string | null;
  nm_programa: string | null;
  tx_tipo_via_bicicleta: string | null;
};

/** One stretch of the snapshot; mirrors `StaticBikeLanesDataSource.ciclovias`. */
type BikeLaneRow = {
  id: number;
  nome: string;
  tipo: string;
  geometry: LineGeometry;
};

const response = await fetch(WFS);

if (!response.ok) {
  throw new Error(
    `[generateBikeLanesData] GeoSampa answered ${response.status} for ${LAYER}`
  );
}

const { features } = (await response.json()) as {
  features: { properties: BikeLaneProps; geometry: LineGeometry | null }[];
};

const ciclovias: BikeLaneRow[] = features.map((feature, index) => {
  const props = feature.properties;
  const nome = (
    props.nm_trecho_via_bicicleta ??
    props.nm_programa ??
    ''
  ).trim();
  const tipo = TYPES[props.tx_tipo_via_bicicleta ?? ''];

  if (!feature.geometry) {
    throw new Error(
      `[generateBikeLanesData] stretch ${props.cd_identificador_ciclovia} has no geometry`
    );
  }

  if (!nome) {
    throw new Error(
      `[generateBikeLanesData] stretch ${props.cd_identificador_ciclovia} has no name, which the tooltip shows`
    );
  }

  // A new type would be drawn solid and named raw: stop and decide instead.
  if (!tipo) {
    throw new Error(
      `[generateBikeLanesData] stretch ${props.cd_identificador_ciclovia} has an unknown type "${props.tx_tipo_via_bicicleta}"`
    );
  }

  return {
    // Sequential rather than GeoSampa's id, like the other layers: small
    // numeric ids are what MapLibre reports on hover and what the tooltip
    // looks the stretch up by.
    id: index + 1,
    nome,
    tipo,
    geometry: simplifyLineGeometry(feature.geometry, SIMPLIFY_TOLERANCE_M),
  };
});

if (ciclovias.length === 0) {
  throw new Error(
    `[generateBikeLanesData] ${LAYER} returned no stretches; refusing to write an empty layer`
  );
}

mkdirSync(OUT_DIR, { recursive: true });

// Compact, like the other snapshots: it is generated, never edited by hand.
writeFileSync(OUT_FILE, `${JSON.stringify({ ciclovias })}\n`, 'utf8');

const vertices = ciclovias.reduce((sum, lane) => {
  return sum + countLineVertices(lane.geometry);
}, 0);

console.log(
  `[generateBikeLanesData] wrote ${ciclovias.length} stretches (${vertices} vertices) to ${path.relative(ROOT, OUT_FILE)}`
);
