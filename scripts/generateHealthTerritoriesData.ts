/**
 * Generates the health territories from GeoSampa, in two forms.
 *
 * The coordinations (CRS) and supervisions (STS) are levels of the choropleth,
 * like the districts and subprefeituras:
 *
 * | Output                                         | What it holds                                   |
 * | ---------------------------------------------- | ----------------------------------------------- |
 * | `src/data-source-static/data/health-divisions.json` | each CRS and STS and the districts it groups |
 * | `public/coordenadorias-saude.geojson`          | the 5 CRS polygons                              |
 * | `public/supervisoes-saude.geojson`             | the 26 STS polygons                             |
 *
 * The UBS catchments and the Saúde da Família coverage stay overlays of the
 * "Camadas" control, snapshots in `src/data-source-static/data/polygons/`:
 *
 * | Snapshot              | GeoSampa layer                        |
 * | --------------------- | ------------------------------------- |
 * | `abrangencia-ubs.json` | `equipamento_saude_abrangencia_ubs`  |
 * | `saude-familia.json`   | `equipamento_saude_cobertura_familia` |
 *
 * They nest: the 5 Coordenadorias Regionais de Saúde hold the 26 Supervisões
 * Técnicas, which hold the UBS catchment areas. The Saúde da Família coverage
 * is the part of those areas the family-health teams reach.
 *
 * No GeoSampa layer tags a district with its supervision, so each district is
 * assigned by geometry: the official district polygon (`distrito_municipal`, at
 * full detail) goes to the STS holding the largest share of its area, and the
 * run fails unless that share is at least `MIN_DISTRICT_SHARE` (see `lib/districtsByArea`). The
 * supervisions follow district lines, so every district lands whole — the few
 * percent left over are drawing differences along the borders. The CRS of a
 * district is its STS's, and is checked against the geometry too.
 *
 * Every row carries a display name. The layers spell the coordinations and
 * supervisions in capitals without accents (`BUTANTA`, `SAO MATEUS`), so both
 * are mapped to the city's own spelling, and the run fails on any name missing
 * from the maps — a territory created or renamed upstream cannot reach the map
 * with its raw spelling.
 *
 * Run it whenever GeoSampa updates the layers:
 *
 * ```bash
 * node scripts/generateHealthTerritoriesData.ts
 * ```
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  assignDistricts,
  districtsOf,
  loadDistricts,
} from './lib/districtsByArea.ts';
import {
  countVertices,
  type PolygonGeometry,
  simplifyGeometry,
} from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/polygons');
const OUT_DIVISIONS = path.join(
  ROOT,
  'src/data-source-static/data/health-divisions.json'
);
const OUT_CRS_GEOJSON = path.join(ROOT, 'public/coordenadorias-saude.geojson');
const OUT_STS_GEOJSON = path.join(ROOT, 'public/supervisoes-saude.geojson');

/** The district snapshot, read for each district's name and `geometry_id`. */
const MAPS_DATA = path.join(ROOT, 'src/data-source-static/data/maps-data.json');

const WFS =
  'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:';

/**
 * Douglas-Peucker tolerance, in metres. Half the subprefeituras' 40 m: a UBS
 * catchment is often a few blocks across, and 40 m visibly squared them off.
 * At 20 m the four layers weigh about 1 MB together (the UBS areas alone about
 * half of it), served only when their toggle is turned on.
 */
const SIMPLIFY_TOLERANCE_M = 20;

/**
 * Douglas-Peucker tolerance for the CRS and STS polygons, in metres: the
 * subprefeituras' 40 m, since they are drawn the same way — a level filling the
 * city, not a few blocks' catchment.
 */
const DIVISION_TOLERANCE_M = 40;

const EXPECTED_CRS = 5;
const EXPECTED_STS = 26;
const EXPECTED_DISTRICTS = 96;

/** The coordinations' display names, keyed by GeoSampa's spelling. */
const CRS_NAMES: Record<string, string> = {
  NORTE: 'Norte',
  SUL: 'Sul',
  LESTE: 'Leste',
  OESTE: 'Oeste',
  SUDESTE: 'Sudeste',
};

/** The supervisions' display names, keyed by GeoSampa's spelling. */
const STS_NAMES: Record<string, string> = {
  BUTANTA: 'Butantã',
  'CAMPO LIMPO': 'Campo Limpo',
  'CAPELA DO SOCORRO': 'Capela do Socorro',
  'CASA VERDE/CACHOEIRINHA': 'Casa Verde/Cachoeirinha',
  'CIDADE TIRADENTES': 'Cidade Tiradentes',
  'ERMELINO MATARAZZO': 'Ermelino Matarazzo',
  'FREGUESIA/BRASILANDIA': 'Freguesia/Brasilândia',
  GUAIANASES: 'Guaianases',
  IPIRANGA: 'Ipiranga',
  'ITAIM PAULISTA': 'Itaim Paulista',
  ITAQUERA: 'Itaquera',
  'LAPA/PINHEIROS': 'Lapa/Pinheiros',
  'MBOI MIRIM': "M'Boi Mirim",
  'MOOCA/ARICANDUVA': 'Mooca/Aricanduva',
  PARELHEIROS: 'Parelheiros',
  PENHA: 'Penha',
  PERUS: 'Perus',
  PIRITUBA: 'Pirituba',
  'SANTANA/TUCURUVI/JACANA/TREMEMBE': 'Santana/Tucuruvi/Jaçanã/Tremembé',
  'SANTO AMARO/CIDADE ADEMAR': 'Santo Amaro/Cidade Ademar',
  'SAO MATEUS': 'São Mateus',
  'SAO MIGUEL': 'São Miguel',
  'SE/SANTA CECILIA': 'Sé/Santa Cecília',
  'VILA MARIA/VILA GUILHERME': 'Vila Maria/Vila Guilherme',
  'VILA MARIANA/JABAQUARA': 'Vila Mariana/Jabaquara',
  'VILA PRUDENTE/SAPOPEMBA': 'Vila Prudente/Sapopemba',
};

type Props = Record<string, string | number | null>;

/** One territory of a snapshot; mirrors `StaticTerritoriesDataSource`. */
type TerritoryRow = {
  id: number;
  nome: string;
  detalhe: string;
  geometry: PolygonGeometry;
};

/**
 * A display name from one of the maps above.
 *
 * @throws On a spelling the map does not know.
 */
const displayName = (
  names: Record<string, string>,
  raw: string | number | null,
  what: string
): string => {
  const name = names[String(raw ?? '').trim()];
  if (!name) {
    throw new Error(
      `[generateHealthTerritoriesData] unknown ${what} "${raw}"; add it to the display names`
    );
  }
  return name;
};

/** `STS Butantã · CRS Oeste`, the line a UBS area's tooltip shows. */
const stsAndCrs = (props: Props): string => {
  const sts = displayName(
    STS_NAMES,
    props['nm_supervisao_tecnica_saude'],
    'STS'
  );
  const crs = displayName(
    CRS_NAMES,
    props['nm_coordenadoria_regional_saude'],
    'CRS'
  );
  return `STS ${sts} · CRS ${crs}`;
};

/** How each overlay snapshot names its rows, and which layer it comes from. */
const SNAPSHOTS: {
  file: string;
  layer: string;
  label: (props: Props) => { nome: string; detalhe: string };
}[] = [
  {
    file: 'abrangencia-ubs.json',
    layer: 'equipamento_saude_abrangencia_ubs',
    label: (props) => {
      return {
        nome: String(props['nm_unidade_basica_saude'] ?? '').trim(),
        detalhe: `Área de abrangência · ${stsAndCrs(props)}`,
      };
    },
  },
  {
    file: 'saude-familia.json',
    layer: 'equipamento_saude_cobertura_familia',
    label: (props) => {
      return {
        nome: String(props['nm_unidade_basica_saude'] ?? '').trim(),
        detalhe: `Saúde da Família · ${stsAndCrs(props)}`,
      };
    },
  },
];

type Feature = { properties: Props; geometry: PolygonGeometry | null };

/**
 * Downloads one GeoSampa layer's features.
 *
 * @param layer - The WFS type name, without the `geoportal:` prefix.
 * @returns The layer's features, in WGS84.
 * @throws If the service answers with anything but a 200.
 */
const fetchLayer = async (layer: string): Promise<Feature[]> => {
  const response = await fetch(`${WFS}${layer}`);

  if (!response.ok) {
    throw new Error(
      `[generateHealthTerritoriesData] GeoSampa answered ${response.status} for ${layer}`
    );
  }

  const { features } = (await response.json()) as { features: Feature[] };
  return features;
};

/** A feature's geometry, which every CRS and STS must have. */
const geometryOf = (feature: Feature, what: string): PolygonGeometry => {
  if (!feature.geometry) {
    throw new Error(`[generateHealthTerritoriesData] ${what} has no geometry`);
  }
  return feature.geometry;
};

/** One coordination or supervision of the generated JSON. */
type DivisionRow = {
  /** GeoSampa's identifier; also the feature id in the level's GeoJSON. */
  id: number;
  nome: string;
  /** `geometry_id`s of the districts it groups, ascending. */
  distritos: number[];
};

/** A supervision, with the coordination it sits in. */
type SupervisionRow = DivisionRow & { coordenadoria: number };

/** A coordination or supervision as fetched, before its districts are known. */
type Area = { id: number; nome: string; geometry: PolygonGeometry };

/** A level's GeoJSON: one feature per area, with its id and name. */
const levelGeojson = (areas: Area[]) => {
  return {
    type: 'FeatureCollection',
    features: areas.map((area) => {
      return {
        type: 'Feature',
        id: area.id,
        properties: { id: area.id, nome: area.nome },
        geometry: simplifyGeometry(area.geometry, DIVISION_TOLERANCE_M),
      };
    }),
  };
};

/** A coordination, with GeoSampa's spelling its supervisions refer to it by. */
type Coordination = Area & { raw: string };

/** A supervision, with the id of the coordination it sits in. */
type Supervision = Area & { coordenadoria: number };

/** The coordinations, named as the city writes them. */
const toCoordinations = (features: Feature[]): Coordination[] => {
  return features.map(({ properties, geometry }) => {
    const raw = String(properties['nm_coordenadoria_regional_saude']);
    const nome = `CRS ${displayName(CRS_NAMES, raw, 'CRS')}`;
    return {
      id: Number(properties['cd_identificador_coordenadoria_regional_saude']),
      nome,
      raw,
      geometry: geometryOf({ properties, geometry }, nome),
    };
  });
};

/**
 * The supervisions, named as the city writes them, each with its coordination.
 *
 * @throws If a supervision names a coordination the CRS layer does not carry.
 */
const toSupervisions = ({
  features,
  coordinations,
}: {
  features: Feature[];
  coordinations: Coordination[];
}): Supervision[] => {
  return features.map(({ properties, geometry }) => {
    const nome = `STS ${displayName(STS_NAMES, properties['nm_supervisao_tecnica_saude'], 'STS')}`;
    const crs = coordinations.find((candidate) => {
      return candidate.raw === properties['nm_coordenadoria_regional_saude'];
    });
    if (!crs) {
      throw new Error(
        `[generateHealthTerritoriesData] ${nome} sits in "${properties['nm_coordenadoria_regional_saude']}", which the CRS layer does not carry`
      );
    }
    return {
      id: Number(properties['cd_identificador_supervisao_tecnica_saude']),
      nome,
      coordenadoria: crs.id,
      geometry: geometryOf({ properties, geometry }, nome),
    };
  });
};

/**
 * Asserts every district was assigned, and that the CRS its geometry falls in
 * is the one its STS declares.
 *
 * @throws On a district missing or whose two assignments disagree.
 */
const assertNesting = ({
  stsOf,
  crsOf,
  supervisions,
}: {
  stsOf: Map<number, number>;
  crsOf: Map<number, number>;
  supervisions: Supervision[];
}): void => {
  if (stsOf.size !== EXPECTED_DISTRICTS) {
    throw new Error(
      `[generateHealthTerritoriesData] ${stsOf.size} districts were assigned, expected ${EXPECTED_DISTRICTS}`
    );
  }

  for (const [geometryId, stsId] of stsOf) {
    const sts = supervisions.find((candidate) => {
      return candidate.id === stsId;
    });
    if (sts?.coordenadoria !== crsOf.get(geometryId)) {
      throw new Error(
        `[generateHealthTerritoriesData] district ${geometryId} lies in ${sts?.nome}, whose CRS is not the one its geometry falls in`
      );
    }
  }
};

/**
 * The generated JSON's rows: each area with the districts assigned to it.
 *
 * @throws If an area groups no district.
 */
const divisionRows = ({
  coordinations,
  supervisions,
  crsOf,
  stsOf,
}: {
  coordinations: Coordination[];
  supervisions: Supervision[];
  crsOf: Map<number, number>;
  stsOf: Map<number, number>;
}): { coordenadorias: DivisionRow[]; supervisoes: SupervisionRow[] } => {
  const byId = (a: { id: number }, b: { id: number }): number => {
    return a.id - b.id;
  };
  const coordenadorias = coordinations
    .map((crs) => {
      return {
        id: crs.id,
        nome: crs.nome,
        distritos: districtsOf(crsOf, crs.id),
      };
    })
    .sort(byId);
  const supervisoes = supervisions
    .map((sts) => {
      return {
        id: sts.id,
        nome: sts.nome,
        coordenadoria: sts.coordenadoria,
        distritos: districtsOf(stsOf, sts.id),
      };
    })
    .sort(byId);

  const empty = [...supervisoes, ...coordenadorias].find((row) => {
    return row.distritos.length === 0;
  });
  if (empty) {
    throw new Error(
      `[generateHealthTerritoriesData] ${empty.nome} groups no district of the project`
    );
  }

  return { coordenadorias, supervisoes };
};

/**
 * Writes the CRS and STS levels: the districts each groups, checked as
 * described in the file header, and their polygons.
 *
 * @throws If GeoSampa does not carry {@link EXPECTED_CRS} coordinations and
 * {@link EXPECTED_STS} supervisions, a district is split, an area groups no
 * district, or a supervision's coordination disagrees with the geometry.
 */
const writeDivisions = async (): Promise<void> => {
  const [crsFeatures, stsFeatures, districts] = await Promise.all([
    fetchLayer('equipamento_saude_coordenadoria_regional'),
    fetchLayer('equipamento_saude_supervisao_tecnica'),
    loadDistricts(MAPS_DATA),
  ]);

  if (
    crsFeatures.length !== EXPECTED_CRS ||
    stsFeatures.length !== EXPECTED_STS
  ) {
    throw new Error(
      `[generateHealthTerritoriesData] GeoSampa returned ${crsFeatures.length} CRS and ${stsFeatures.length} STS, expected ${EXPECTED_CRS} and ${EXPECTED_STS}; the "Recorte" labels count them`
    );
  }

  const coordinations = toCoordinations(crsFeatures);
  const supervisions = toSupervisions({ features: stsFeatures, coordinations });
  const stsOf = assignDistricts({
    districts,
    areas: supervisions,
    what: 'STS',
  });
  const crsOf = assignDistricts({
    districts,
    areas: coordinations,
    what: 'CRS',
  });
  assertNesting({ stsOf, crsOf, supervisions });

  const rows = divisionRows({ coordinations, supervisions, crsOf, stsOf });
  writeFileSync(OUT_DIVISIONS, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  for (const [file, areas] of [
    [OUT_CRS_GEOJSON, coordinations],
    [OUT_STS_GEOJSON, supervisions],
  ] as const) {
    writeFileSync(file, `${JSON.stringify(levelGeojson(areas))}\n`, 'utf8');
  }

  console.log(
    `[generateHealthTerritoriesData] wrote ${rows.coordenadorias.length} CRS and ${rows.supervisoes.length} STS (${stsOf.size} districts) to ${path.relative(ROOT, OUT_DIVISIONS)}, ${path.relative(ROOT, OUT_CRS_GEOJSON)} and ${path.relative(ROOT, OUT_STS_GEOJSON)}`
  );
};

/** Writes the UBS catchment and Saúde da Família overlay snapshots. */
const writeOverlays = async (): Promise<void> => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const { file, layer, label } of SNAPSHOTS) {
    const features = await fetchLayer(layer);

    const territorios: TerritoryRow[] = features.map((feature, index) => {
      const { nome, detalhe } = label(feature.properties);

      if (!feature.geometry) {
        throw new Error(
          `[generateHealthTerritoriesData] ${layer}: "${nome}" has no geometry`
        );
      }
      if (!nome) {
        throw new Error(
          `[generateHealthTerritoriesData] ${layer}: feature ${index} has no name, which the tooltip shows`
        );
      }

      return {
        // Sequential rather than GeoSampa's id, like the parks: small numeric
        // ids are what MapLibre reports on hover and what the tooltip looks the
        // territory up by.
        id: index + 1,
        nome,
        detalhe,
        geometry: simplifyGeometry(feature.geometry, SIMPLIFY_TOLERANCE_M),
      };
    });

    if (territorios.length === 0) {
      throw new Error(
        `[generateHealthTerritoriesData] ${layer} returned no features; refusing to write an empty layer`
      );
    }

    const outFile = path.join(OUT_DIR, file);
    // Compact, like the other snapshots: generated, never edited by hand.
    writeFileSync(outFile, `${JSON.stringify({ territorios })}\n`, 'utf8');

    const vertices = territorios.reduce((sum, row) => {
      return sum + countVertices(row.geometry);
    }, 0);

    console.log(
      `[generateHealthTerritoriesData] wrote ${territorios.length} territories (${vertices} vertices) to ${path.relative(ROOT, outFile)}`
    );
  }
};

await writeDivisions();
await writeOverlays();
