/**
 * Generates the subprefeitura level of the map from GeoSampa:
 *
 * - `src/data-source-static/data/subprefeituras.json` — the 32 subprefeituras
 *   and which of the project's 96 districts (by `geometry_id`) each one groups;
 * - `public/subprefeituras.geojson` — their polygons, simplified to a weight
 *   close to the district mesh's, with feature ids 1–32 matching the JSON.
 *
 * The correspondence is official, not hand-made: GeoSampa's
 * `distrito_municipal` layer tags every district with its subprefeitura. It is
 * joined to the project's districts by name, because the project's mesh carries
 * no attributes and GeoSampa's district codes are not SEADE's. The names are
 * compared accent- and case-folded, and the run stops unless all 96 match
 * exactly once — a silently unmatched district would drop its population out
 * of its subprefeitura's totals.
 *
 * Run it whenever GeoSampa redraws a boundary or the district snapshot changes:
 *
 * ```bash
 * node scripts/generateSubprefeituras.ts
 * ```
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { foldName } from './lib/officialDistricts.ts';
import {
  countVertices,
  type PolygonGeometry,
  simplifyGeometry,
} from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_JSON = path.join(
  ROOT,
  'src/data-source-static/data/subprefeituras.json'
);
const OUT_GEOJSON = path.join(ROOT, 'public/subprefeituras.geojson');

/** The district snapshot, read for each district's name and `geometry_id`. */
const MAPS_DATA = path.join(ROOT, 'src/data-source-static/data/maps-data.json');

const WFS =
  'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:';

const EXPECTED_SUBPREFEITURAS = 32;
const EXPECTED_DISTRICTS = 96;

/**
 * Douglas-Peucker tolerance, in metres. At 40 m the 32 polygons keep roughly
 * the vertex count of the 96-district mesh (a few thousand), so the two levels
 * weigh about the same and draw with the same level of detail.
 */
const SIMPLIFY_TOLERANCE_M = 40;

/**
 * Display names, keyed by GeoSampa's `nm_subprefeitura`. The layer spells them
 * in capitals and without accents (`BUTANTA`, `SE`, `M BOI MIRIM`), which is
 * not how the city writes them and not what a tooltip should show. The run
 * fails on any name missing here, so a subprefeitura created or renamed
 * upstream cannot reach the map with its raw spelling.
 */
const DISPLAY_NAMES: Record<string, string> = {
  'ARICANDUVA-FORMOSA-CARRAO': 'Aricanduva-Formosa-Carrão',
  BUTANTA: 'Butantã',
  'CAMPO LIMPO': 'Campo Limpo',
  'CAPELA DO SOCORRO': 'Capela do Socorro',
  'CASA VERDE-LIMAO-CACHOEIRINHA': 'Casa Verde-Limão-Cachoeirinha',
  'CIDADE ADEMAR': 'Cidade Ademar',
  'CIDADE TIRADENTES': 'Cidade Tiradentes',
  'ERMELINO MATARAZZO': 'Ermelino Matarazzo',
  'FREGUESIA-BRASILANDIA': 'Freguesia-Brasilândia',
  GUAIANASES: 'Guaianases',
  IPIRANGA: 'Ipiranga',
  'ITAIM PAULISTA': 'Itaim Paulista',
  ITAQUERA: 'Itaquera',
  JABAQUARA: 'Jabaquara',
  'JACANA-TREMEMBE': 'Jaçanã-Tremembé',
  LAPA: 'Lapa',
  'M BOI MIRIM': "M'Boi Mirim",
  MOOCA: 'Mooca',
  PARELHEIROS: 'Parelheiros',
  PENHA: 'Penha',
  'PERUS-ANHANGUERA': 'Perus-Anhanguera',
  PINHEIROS: 'Pinheiros',
  'PIRITUBA-JARAGUA': 'Pirituba-Jaraguá',
  'SANTANA-TUCURUVI': 'Santana-Tucuruvi',
  'SANTO AMARO': 'Santo Amaro',
  'SAO MATEUS': 'São Mateus',
  'SAO MIGUEL': 'São Miguel',
  SAPOPEMBA: 'Sapopemba',
  SE: 'Sé',
  'VILA MARIA-VILA GUILHERME': 'Vila Maria-Vila Guilherme',
  'VILA MARIANA': 'Vila Mariana',
  'VILA PRUDENTE': 'Vila Prudente',
};

type WfsFeature<P> = { properties: P; geometry: PolygonGeometry };

type SubprefeituraProps = {
  cd_identificador_subprefeitura: number;
  cd_subprefeitura: string;
  nm_subprefeitura: string;
  sg_subprefeitura: string;
  nm_regiao_05: string;
};

type DistrictProps = {
  cd_identificador_subprefeitura: number;
  nm_distrito_municipal: string;
};

/** One entry of the generated JSON; mirrors `StaticSubprefeiturasDataSource`. */
type SubprefeituraRow = {
  id: number;
  codigo: string;
  sigla: string;
  nome: string;
  regiao: string;
  distritos: number[];
};

/**
 * Downloads one GeoSampa layer's features.
 *
 * @param layer - The WFS type name, without the `geoportal:` prefix.
 * @returns The layer's features, in WGS84.
 * @throws If the service answers with anything but a 200.
 */
const fetchLayer = async <P>(layer: string): Promise<WfsFeature<P>[]> => {
  const response = await fetch(`${WFS}${layer}`);

  if (!response.ok) {
    throw new Error(
      `[generateSubprefeituras] GeoSampa answered ${response.status} for ${layer}`
    );
  }

  const body = (await response.json()) as { features: WfsFeature<P>[] };
  return body.features;
};

/**
 * Maps each project district to its subprefeitura's GeoSampa id.
 *
 * @param districts - GeoSampa's `distrito_municipal` features.
 * @returns `geometry_id → cd_identificador_subprefeitura` for all 96 districts.
 * @throws Unless every project district matches exactly one GeoSampa district
 * and vice versa.
 */
const matchDistricts = (
  districts: WfsFeature<DistrictProps>[]
): Map<number, number> => {
  const snapshot = JSON.parse(readFileSync(MAPS_DATA, 'utf8')) as {
    districts: { geometry_id: number; nome: string }[];
  };

  const projectByName = new Map<string, number>();
  for (const district of snapshot.districts) {
    projectByName.set(foldName(district.nome), district.geometry_id);
  }

  if (projectByName.size !== EXPECTED_DISTRICTS) {
    throw new Error(
      `[generateSubprefeituras] maps-data.json has ${projectByName.size} distinct district names, expected ${EXPECTED_DISTRICTS}`
    );
  }

  const subByGeometryId = new Map<number, number>();

  for (const district of districts) {
    const name = district.properties.nm_distrito_municipal;
    const geometryId = projectByName.get(foldName(name));

    if (geometryId === undefined) {
      throw new Error(
        `[generateSubprefeituras] GeoSampa district "${name}" matches no district of the project`
      );
    }

    if (subByGeometryId.has(geometryId)) {
      throw new Error(
        `[generateSubprefeituras] two GeoSampa districts fold to the same name as "${name}"`
      );
    }

    subByGeometryId.set(
      geometryId,
      district.properties.cd_identificador_subprefeitura
    );
  }

  if (subByGeometryId.size !== EXPECTED_DISTRICTS) {
    throw new Error(
      `[generateSubprefeituras] only ${subByGeometryId.size} of the project's ${EXPECTED_DISTRICTS} districts matched GeoSampa`
    );
  }

  return subByGeometryId;
};

const [subprefeituras, districts] = await Promise.all([
  fetchLayer<SubprefeituraProps>('subprefeitura'),
  fetchLayer<DistrictProps>('distrito_municipal'),
]);

if (subprefeituras.length !== EXPECTED_SUBPREFEITURAS) {
  throw new Error(
    `[generateSubprefeituras] GeoSampa returned ${subprefeituras.length} subprefeituras, expected ${EXPECTED_SUBPREFEITURAS}`
  );
}

const subByGeometryId = matchDistricts(districts);

const rows: SubprefeituraRow[] = subprefeituras
  .map((feature) => {
    const props = feature.properties;
    const nome = DISPLAY_NAMES[props.nm_subprefeitura];

    if (!nome) {
      throw new Error(
        `[generateSubprefeituras] no display name for "${props.nm_subprefeitura}"; add it to DISPLAY_NAMES`
      );
    }

    const distritos = [...subByGeometryId]
      .filter(([, subId]) => {
        return subId === props.cd_identificador_subprefeitura;
      })
      .map(([geometryId]) => {
        return geometryId;
      })
      .sort((a, b) => {
        return a - b;
      });

    if (distritos.length === 0) {
      throw new Error(
        `[generateSubprefeituras] ${nome} groups no district of the project`
      );
    }

    return {
      id: props.cd_identificador_subprefeitura,
      codigo: props.cd_subprefeitura,
      sigla: props.sg_subprefeitura,
      nome,
      regiao: props.nm_regiao_05,
      distritos,
    };
  })
  .sort((a, b) => {
    return a.id - b.id;
  });

const knownIds = new Set(
  rows.map((row) => {
    return row.id;
  })
);

for (const subId of subByGeometryId.values()) {
  if (!knownIds.has(subId)) {
    throw new Error(
      `[generateSubprefeituras] a district points at subprefeitura ${subId}, which the subprefeitura layer does not carry`
    );
  }
}

const features = subprefeituras
  .map((feature) => {
    return {
      type: 'Feature' as const,
      id: feature.properties.cd_identificador_subprefeitura,
      properties: null,
      geometry: simplifyGeometry(feature.geometry, SIMPLIFY_TOLERANCE_M),
    };
  })
  .sort((a, b) => {
    return a.id - b.id;
  });

writeFileSync(
  OUT_JSON,
  `${JSON.stringify({ subprefeituras: rows }, null, 2)}\n`,
  'utf8'
);
writeFileSync(
  OUT_GEOJSON,
  `${JSON.stringify({ type: 'FeatureCollection', features })}\n`,
  'utf8'
);

const vertices = features.reduce((sum, feature) => {
  return sum + countVertices(feature.geometry);
}, 0);

console.log(
  `[generateSubprefeituras] wrote ${rows.length} subprefeituras (${subByGeometryId.size} districts) to ${path.relative(ROOT, OUT_JSON)} and ${vertices} vertices to ${path.relative(ROOT, OUT_GEOJSON)}`
);
