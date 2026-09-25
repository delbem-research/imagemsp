/**
 * Generates the subprefeitura level of the map from GeoSampa:
 *
 * - `src/data-source-static/data/subprefeituras.json` — every subprefeitura the
 *   city has had since 2002, which of the project's 96 districts (by
 *   `geometry_id`) each one groups, and the years it was in force;
 * - `public/subprefeituras.geojson` — their polygons, simplified to a weight
 *   close to the district mesh's, with feature ids matching the JSON and the
 *   same `validFrom`/`validTo` years in each feature's properties.
 *
 * The division changed over the timeline, so the level is versioned rather
 * than drawn once: each subprefeitura carries the first and last year it
 * existed (`validTo: null` while it still does), and the map and the totals
 * pick the ones in force in the year painted. GeoSampa only has today's 32; a
 * former subprefeitura is rebuilt from the current ones it was split into (see
 * {@link FORMER_SUBPREFEITURAS}). No subprefeitura is in force before
 * {@link DIVISION_START}, when there were none.
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

import polygonClipping from 'polygon-clipping';

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

/**
 * The year the subprefeituras were created (Lei 13.399, of 1 August 2002).
 * Before it the city was run by Administrações Regionais, whose limits did not
 * follow the district lines and are not published as a layer, so no earlier
 * year has a subprefeitura division — the map shows the districts instead.
 */
const DIVISION_START = 2002;

/**
 * Subprefeituras that no longer exist, each rebuilt as the union of the current
 * ones it was split into (keyed by GeoSampa's `nm_subprefeitura`). The union is
 * exact, not an approximation: subprefeituras group whole districts, and a
 * split only moves districts between them. A successor starts the year after
 * its predecessor's `validTo`.
 *
 * - Vila Prudente-Sapopemba grouped Vila Prudente, São Lucas and Sapopemba from
 *   2002 until Lei 15.764 (27 May 2013) made Sapopemba a subprefeitura of its
 *   own. Its id, 33, is outside GeoSampa's 1–32.
 *
 * The renames since 2002 (Pirituba → Pirituba/Jaraguá in 2005, Perus →
 * Perus/Anhanguera in 2019, Casa Verde/Cachoeirinha →
 * Casa Verde/Limão/Cachoeirinha in 2023) moved no district and are not
 * versioned.
 */
const FORMER_SUBPREFEITURAS: {
  id: number;
  nome: string;
  validFrom: number;
  validTo: number;
  successors: string[];
}[] = [
  {
    id: 33,
    nome: 'Vila Prudente-Sapopemba',
    validFrom: DIVISION_START,
    validTo: 2012,
    successors: ['VILA PRUDENTE', 'SAPOPEMBA'],
  },
];

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
  /** First year it was in force. */
  validFrom: number;
  /** Last year it was in force, or `null` while it still is. */
  validTo: number | null;
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

/**
 * The year a current subprefeitura came into force: the year after the former
 * one it was split out of ended, or the start of the division.
 */
const validFromOf = (nmSubprefeitura: string): number => {
  const predecessor = FORMER_SUBPREFEITURAS.find((former) => {
    return former.successors.includes(nmSubprefeitura);
  });

  return predecessor ? predecessor.validTo + 1 : DIVISION_START;
};

const currentRows: SubprefeituraRow[] = subprefeituras.map((feature) => {
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
    validFrom: validFromOf(props.nm_subprefeitura),
    validTo: null,
  };
});

const knownIds = new Set(
  currentRows.map((row) => {
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

/**
 * The GeoSampa features of a former subprefeitura's successors.
 *
 * @throws If a successor is not in the layer — renamed or merged upstream —
 * which would otherwise rebuild the former one short of a piece.
 */
const successorFeatures = (
  former: (typeof FORMER_SUBPREFEITURAS)[number]
): WfsFeature<SubprefeituraProps>[] => {
  return former.successors.map((name) => {
    const feature = subprefeituras.find((candidate) => {
      return candidate.properties.nm_subprefeitura === name;
    });

    if (!feature) {
      throw new Error(
        `[generateSubprefeituras] ${former.nome} is rebuilt from "${name}", which GeoSampa no longer carries`
      );
    }

    return feature;
  });
};

const formerRows: SubprefeituraRow[] = FORMER_SUBPREFEITURAS.map((former) => {
  if (knownIds.has(former.id)) {
    throw new Error(
      `[generateSubprefeituras] ${former.nome} reuses id ${former.id}, which GeoSampa gives a current subprefeitura`
    );
  }

  const successors = successorFeatures(former);
  // Code, acronym and region carry over from the first successor, the one
  // that kept the former subprefeitura's seat.
  const first = currentRows.find((row) => {
    return row.id === successors[0]?.properties.cd_identificador_subprefeitura;
  }) as SubprefeituraRow;

  return {
    id: former.id,
    codigo: first.codigo,
    sigla: first.sigla,
    nome: former.nome,
    regiao: first.regiao,
    distritos: currentRows
      .filter((row) => {
        return successors.some((feature) => {
          return feature.properties.cd_identificador_subprefeitura === row.id;
        });
      })
      .flatMap((row) => {
        return row.distritos;
      })
      .sort((a, b) => {
        return a - b;
      }),
    validFrom: former.validFrom,
    validTo: former.validTo,
  };
});

const rows = [...currentRows, ...formerRows].sort((a, b) => {
  return a.id - b.id;
});

/**
 * A former subprefeitura's polygon: its successors' polygons dissolved into
 * one, at full GeoSampa detail — simplified afterwards like any other, so the
 * shared border does not survive as a seam of slivers.
 */
const formerGeometry = (
  former: (typeof FORMER_SUBPREFEITURAS)[number]
): PolygonGeometry => {
  const [first, ...rest] = successorFeatures(former).map((feature) => {
    return feature.geometry.coordinates;
  });

  return {
    type: 'MultiPolygon',
    coordinates: polygonClipping.union(
      first as polygonClipping.Geom,
      ...(rest as polygonClipping.Geom[])
    ),
  };
};

const rawGeometry = new Map<number, PolygonGeometry>([
  ...subprefeituras.map((feature) => {
    return [
      feature.properties.cd_identificador_subprefeitura,
      feature.geometry,
    ] as const;
  }),
  ...FORMER_SUBPREFEITURAS.map((former) => {
    return [former.id, formerGeometry(former)] as const;
  }),
]);

const features = rows.map((row) => {
  return {
    type: 'Feature' as const,
    id: row.id,
    // The id is repeated as a property because MapLibre filters read
    // properties only, and the map filters this layer by id per year.
    properties: {
      id: row.id,
      nome: row.nome,
      validFrom: row.validFrom,
      validTo: row.validTo,
    },
    geometry: simplifyGeometry(
      rawGeometry.get(row.id) as PolygonGeometry,
      SIMPLIFY_TOLERANCE_M
    ),
  };
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
  `[generateSubprefeituras] wrote ${rows.length} subprefeituras (${currentRows.length} current, ${formerRows.length} former; ${subByGeometryId.size} districts) to ${path.relative(ROOT, OUT_JSON)} and ${vertices} vertices to ${path.relative(ROOT, OUT_GEOJSON)}`
);
