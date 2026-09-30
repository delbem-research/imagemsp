/**
 * Generates the four health-territory snapshots behind the map's polygon
 * layers, from GeoSampa, in `src/data-source-static/data/polygons/`:
 *
 * | Snapshot                     | GeoSampa layer                             |
 * | ---------------------------- | ------------------------------------------ |
 * | `coordenadorias-saude.json`  | `equipamento_saude_coordenadoria_regional` |
 * | `supervisoes-saude.json`     | `equipamento_saude_supervisao_tecnica`     |
 * | `abrangencia-ubs.json`       | `equipamento_saude_abrangencia_ubs`        |
 * | `saude-familia.json`         | `equipamento_saude_cobertura_familia`      |
 *
 * They nest: the 5 Coordenadorias Regionais de Saúde hold the 26 Supervisões
 * Técnicas, which hold the UBS catchment areas. The Saúde da Família coverage
 * is the part of those areas the family-health teams reach.
 *
 * Every row carries a display name and a secondary line for the tooltip. The
 * layers spell the coordinations and supervisions in capitals without accents
 * (`BUTANTA`, `SAO MATEUS`), so both are mapped to the city's own spelling, and
 * the run fails on any name missing from the maps — a territory created or
 * renamed upstream cannot reach the map with its raw spelling.
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
  countVertices,
  type PolygonGeometry,
  simplifyGeometry,
} from './lib/simplifyGeometry.ts';

/** Repository root, resolved from this script's own location. */
const ROOT = path.resolve(import.meta.dirname, '..');

const OUT_DIR = path.join(ROOT, 'src/data-source-static/data/polygons');

const WFS =
  'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:';

/**
 * Douglas-Peucker tolerance, in metres. Half the subprefeituras' 40 m: a UBS
 * catchment is often a few blocks across, and 40 m visibly squared them off.
 * At 20 m the four layers weigh about 1 MB together (the UBS areas alone about
 * half of it), served only when their toggle is turned on.
 */
const SIMPLIFY_TOLERANCE_M = 20;

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

/** How each snapshot names its rows, and which layer it comes from. */
const SNAPSHOTS: {
  file: string;
  layer: string;
  label: (props: Props) => { nome: string; detalhe: string };
}[] = [
  {
    file: 'coordenadorias-saude.json',
    layer: 'equipamento_saude_coordenadoria_regional',
    label: (props) => {
      const crs = displayName(
        CRS_NAMES,
        props['nm_coordenadoria_regional_saude'],
        'CRS'
      );
      return { nome: `CRS ${crs}`, detalhe: 'Coordenadoria Regional de Saúde' };
    },
  },
  {
    file: 'supervisoes-saude.json',
    layer: 'equipamento_saude_supervisao_tecnica',
    label: (props) => {
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
      return {
        nome: `STS ${sts}`,
        detalhe: `Supervisão Técnica de Saúde · CRS ${crs}`,
      };
    },
  },
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

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, layer, label } of SNAPSHOTS) {
  const response = await fetch(`${WFS}${layer}`);

  if (!response.ok) {
    throw new Error(
      `[generateHealthTerritoriesData] GeoSampa answered ${response.status} for ${layer}`
    );
  }

  const { features } = (await response.json()) as {
    features: { properties: Props; geometry: PolygonGeometry | null }[];
  };

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
