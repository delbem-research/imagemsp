/**
 * Generates `src/data-source-static/data/polygons/parques.json`, the snapshot
 * behind the map's parks layer, from GeoSampa.
 *
 * The source is `pde_parque_municipal`: the city's municipal parks as the
 * Plano Diretor maps them. It is the layer GeoSampa could serve when this was
 * written — the fuller `GEOSAMPA_cadparcs_parque_unidade_conservacao`, which
 * adds the state parks (Villa-Lobos, Água Branca, Juventude…) and conservation
 * units, answered 503 from its upstream server. Proposed parks are dropped:
 * the map shows green space a resident can use today, not a plan.
 *
 * Run it whenever GeoSampa updates the layer:
 *
 * ```bash
 * node scripts/generateParksData.ts
 * ```
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  countVertices,
  type PolygonGeometry,
  simplifyGeometry,
} from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/polygons');
const OUT_FILE = path.join(OUT_DIR, 'parques.json');

const LAYER = 'pde_parque_municipal';

const WFS = `https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:${LAYER}`;

/** The only `tx_tipo_situacao_projeto` kept; the rest is `Proposto`. */
const EXISTING = 'Existente';

/**
 * Douglas-Peucker tolerance, in metres. Parks are far smaller than districts —
 * a square block is about 100 m across — so the tolerance is a fraction of the
 * districts', enough to drop the survey-grade detail without squaring off the
 * small urban parks.
 */
const SIMPLIFY_TOLERANCE_M = 8;

type ParkProps = {
  cd_identificador: number;
  nm_parque: string;
  cd_cadparc: string | null;
  tx_tipo_categoria_parque_unidade_conservacao: string;
  tx_tipo_situacao_projeto: string;
};

/** One park of the snapshot; mirrors `StaticParksDataSource.parques`. */
type ParkRow = {
  id: number;
  nome: string;
  categoria: string;
  cadparc: string;
  geometry: PolygonGeometry;
};

const response = await fetch(WFS);

if (!response.ok) {
  throw new Error(
    `[generateParksData] GeoSampa answered ${response.status} for ${LAYER}`
  );
}

const { features } = (await response.json()) as {
  features: { properties: ParkProps; geometry: PolygonGeometry | null }[];
};

const parques: ParkRow[] = features
  .filter((feature) => {
    return feature.properties.tx_tipo_situacao_projeto === EXISTING;
  })
  .map((feature, index) => {
    const props = feature.properties;

    if (!feature.geometry) {
      throw new Error(
        `[generateParksData] park ${props.nm_parque} has no geometry`
      );
    }

    if (!props.nm_parque?.trim()) {
      throw new Error(
        `[generateParksData] park ${props.cd_identificador} has no name, which the tooltip shows`
      );
    }

    return {
      // Sequential rather than GeoSampa's id, like the point layers: small
      // numeric ids are what MapLibre reports on hover and what the tooltip
      // looks the park up by.
      id: index + 1,
      nome: props.nm_parque.trim(),
      categoria: props.tx_tipo_categoria_parque_unidade_conservacao,
      cadparc: props.cd_cadparc ?? '',
      geometry: simplifyGeometry(feature.geometry, SIMPLIFY_TOLERANCE_M),
    };
  });

if (parques.length === 0) {
  throw new Error(
    `[generateParksData] ${LAYER} returned no existing parks; refusing to write an empty layer`
  );
}

mkdirSync(OUT_DIR, { recursive: true });

// Compact, like the point snapshots: indentation would roughly double the
// file, and it is generated, never edited by hand.
writeFileSync(OUT_FILE, `${JSON.stringify({ parques })}\n`, 'utf8');

const vertices = parques.reduce((sum, park) => {
  return sum + countVertices(park.geometry);
}, 0);

console.log(
  `[generateParksData] wrote ${parques.length} parks (${vertices} vertices) to ${path.relative(ROOT, OUT_FILE)}`
);
