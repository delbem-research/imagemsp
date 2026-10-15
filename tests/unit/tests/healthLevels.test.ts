/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { legendReference } from '@/app/(features)/mapas/_components/mapLegend';
import { buildSpec } from '@/app/(features)/mapas/_components/mapSpec';
import { countsFor, membersFor } from '@/components/map/lib/levelData';
import { MAP_LEVELS } from '@/components/map/lib/mapLevels';
import { mapDescription } from '@/components/map/lib/workspaceConfig';
import { aggregateHealthDivisions } from '@/data-gateway/transformers/aggregateHealthDivisions';
import {
  type ServiceCounts,
  toAppMapsData,
} from '@/data-gateway/transformers/toAppMapsData';
import { readStaticHealthDivisions } from '@/data-source-static/readStaticHealthDivisions';

// `workspaceConfig` reads icon names from `icons.ts`, which also registers the
// icons through `@ttoss/react-icons` — an ESM-only package Jest does not
// transform. The names are all these tests need.
jest.mock('@/components/map/lib/icons', () => {
  return {
    PIN_ICON_DATA: {},
    ICONS: new Proxy(
      {},
      {
        get: (_target, name) => {
          return `icon:${String(name)}`;
        },
      }
    ),
  };
});

const ROOT = path.resolve(__dirname, '../../..');

const NO_SERVICES: ServiceCounts = {
  ubs: new Map([['Grande', 3]]),
  hospitais: new Map(),
  urgencia: new Map(),
  samu: new Map(),
  ambulatorios: new Map(),
  'saude-mental': new Map(),
  'dst-aids': new Map(),
  vigilancia: new Map(),
  animais: new Map(),
  restaurantes: new Map(),
  esporte: new Map(),
};

const district = ({
  geometryId,
  nome,
  ano,
  count65,
  total,
}: {
  geometryId: number;
  nome: string;
  ano: number;
  count65: number;
  total: number;
}) => {
  return {
    ano,
    cod_distr: 80000 + geometryId,
    nome,
    municipio: 'São Paulo',
    geometry_id: geometryId,
    count_65_69: count65,
    count_70_74: 0,
    count_75plus: 0,
    total,
  };
};

/**
 * Three districts, two years: "Pequeno" and "Grande" in one STS, "Outro" in
 * another, both STS in one CRS.
 */
const SOURCE = {
  districts: [2020, 2025].flatMap((ano) => {
    return [
      district({
        geometryId: 1,
        nome: 'Pequeno',
        ano,
        count65: 300,
        total: 1000,
      }),
      district({
        geometryId: 2,
        nome: 'Grande',
        ano,
        count65: 5000,
        total: 50000,
      }),
      district({
        geometryId: 3,
        nome: 'Outro',
        ano,
        count65: 100,
        total: 2000,
      }),
    ];
  }),
};

const SUBPREFEITURAS = {
  subprefeituras: [
    {
      id: 10,
      codigo: '10',
      sigla: 'AA',
      nome: 'Alfa',
      regiao: 'Leste',
      distritos: [1, 2, 3],
      validFrom: 2002,
    },
  ],
};

const DIVISIONS = {
  coordenadorias: [{ id: 7, nome: 'CRS Leste', distritos: [1, 2, 3] }],
  supervisoes: [
    { id: 20, nome: 'STS Alfa', coordenadoria: 7, distritos: [2, 1] },
    { id: 21, nome: 'STS Beta', coordenadoria: 7, distritos: [3] },
  ],
};

const contract = () => {
  return toAppMapsData(SOURCE, SUBPREFEITURAS, NO_SERVICES, DIVISIONS);
};

describe('toAppMapsData — health levels', () => {
  test('sums the districts counts per STS and CRS, every year', () => {
    const data = contract();

    expect(
      data.supervisaoCounts.map(
        ({ geometryId, name, year, count65to69, total }) => {
          return { geometryId, name, year, count65to69, total };
        }
      )
    ).toEqual([
      {
        geometryId: 20,
        name: 'STS Alfa',
        year: 2020,
        count65to69: 5300,
        total: 51000,
      },
      {
        geometryId: 21,
        name: 'STS Beta',
        year: 2020,
        count65to69: 100,
        total: 2000,
      },
      {
        geometryId: 20,
        name: 'STS Alfa',
        year: 2025,
        count65to69: 5300,
        total: 51000,
      },
      {
        geometryId: 21,
        name: 'STS Beta',
        year: 2025,
        count65to69: 100,
        total: 2000,
      },
    ]);
    expect(data.coordenadoriaCounts).toHaveLength(2);
    expect(data.coordenadoriaCounts[0]).toMatchObject({
      geometryId: 7,
      count65to69: 5400,
      total: 53000,
      services: expect.objectContaining({ ubs: 3 }),
    });
  });

  test('lists each area districts alphabetically', () => {
    expect(contract().supervisoes).toEqual([
      {
        geometryId: 20,
        name: 'STS Alfa',
        districtNames: ['Grande', 'Pequeno'],
      },
      { geometryId: 21, name: 'STS Beta', districtNames: ['Outro'] },
    ]);
  });

  test.each([
    [
      'a district in two areas',
      [
        { id: 20, nome: 'A', coordenadoria: 7, distritos: [1, 2, 3] },
        { id: 21, nome: 'B', coordenadoria: 7, distritos: [3] },
      ],
      'belongs to more than one health supervision',
    ],
    [
      'a district in none',
      [{ id: 20, nome: 'A', coordenadoria: 7, distritos: [1, 2] }],
      'belongs to no health supervision',
    ],
    [
      'an area grouping a district with no counts',
      [{ id: 20, nome: 'A', coordenadoria: 7, distritos: [1, 2, 3, 99] }],
      'groups district 99, which has no counts',
    ],
  ])('throws on %s', (_case, supervisoes, message) => {
    expect(() => {
      return aggregateHealthDivisions({
        counts: contract().counts,
        divisions: { ...DIVISIONS, supervisoes },
      });
    }).toThrow(message);
  });
});

describe('health levels — the map', () => {
  test('countsFor and membersFor read the level painted', () => {
    const data = contract();

    expect(countsFor({ data, level: 'supervisao-saude' })).toBe(
      data.supervisaoCounts
    );
    expect(countsFor({ data, level: 'coordenadoria-saude' })).toBe(
      data.coordenadoriaCounts
    );
    expect(membersFor({ data, level: 'distrito', year: 2025 })).toBeUndefined();
    expect(
      membersFor({ data, level: 'coordenadoria-saude', year: 2025 })?.get(7)
    ).toEqual(['Grande', 'Outro', 'Pequeno']);
    expect(
      membersFor({ data, level: 'subprefeitura', year: 2025 })?.get(10)
    ).toEqual(['Grande', 'Outro', 'Pequeno']);
  });

  test('the spec paints the STS polygons with their own join', () => {
    const spec = buildSpec({
      data: contract(),
      level: 'supervisao-saude',
      category: 'cumulative-total',
      group: '65',
      year: 2025,
      zoom: 10,
      overlays: { active: {}, data: {} } as never,
      ages: [],
      colors: ['#000', '#111', '#222', '#333', '#444', '#555', '#666'],
      control: { items: [] } as never,
      view: { view: '2d', extrusionScale: 1, pitch: 0, bearing: 0 },
    });
    const level = MAP_LEVELS['supervisao-saude'];
    const layer = spec.layers?.[0];

    expect(
      spec.sources.some((source) => {
        return source.id === level.sourceId;
      })
    ).toBe(true);
    expect(layer).toMatchObject({
      id: level.layerId,
      sourceId: level.sourceId,
      mapDataId: level.mapDataId,
    });
    expect(layer?.legends?.[0]?.title).toContain('POR SUPERVISÃO DE SAÚDE');
    expect(spec.mapData?.[0]).toMatchObject({
      mapDataId: level.mapDataId,
      mapId: level.sourceId,
      data: [
        // 5300 / 51000, rounded as every rate the map paints.
        { geometryId: 20, value: 0.1039 },
        { geometryId: 21, value: 100 / 2000 },
      ],
    });
  });

  test('the legend names the level and credits GeoSampa', () => {
    expect(
      mapDescription({
        category: 'cumulative-total',
        group: '65',
        level: 'coordenadoria-saude',
      })
    ).toBe(
      'Proporção da população total da coordenadoria de saúde com 65 anos ou mais.'
    );
    expect(
      legendReference({
        level: 'supervisao-saude',
        year: 2025,
        years: [2020, 2025],
        overlays: false,
        offer: false,
      })
    ).toContain('Supervisões Técnicas de Saúde de São Paulo');
  });
});

describe('health levels — the versioned snapshot', () => {
  /** Feature ids of a level's GeoJSON in `public/`. */
  const featureIds = (file: string): number[] => {
    const geojson = JSON.parse(
      readFileSync(path.join(ROOT, 'public', file), 'utf8')
    ) as { features: { id: number }[] };
    return geojson.features
      .map((feature) => {
        return feature.id;
      })
      .sort((a, b) => {
        return a - b;
      });
  };

  const ids = (rows: { id: number }[]): number[] => {
    return rows
      .map((row) => {
        return row.id;
      })
      .sort((a, b) => {
        return a - b;
      });
  };

  test('groups all 96 districts once, in 26 STS within 5 CRS', async () => {
    const { coordenadorias, supervisoes } = await readStaticHealthDivisions();
    const once = (rows: { distritos: number[] }[]) => {
      const all = rows.flatMap((row) => {
        return row.distritos;
      });
      return new Set(all).size === all.length ? all.length : -1;
    };

    expect(supervisoes).toHaveLength(26);
    expect(coordenadorias).toHaveLength(5);
    expect(once(supervisoes)).toBe(96);
    expect(once(coordenadorias)).toBe(96);

    // Each STS sits whole inside the CRS it names.
    for (const sts of supervisoes) {
      const crs = coordenadorias.find((candidate) => {
        return candidate.id === sts.coordenadoria;
      });
      expect(crs?.distritos).toEqual(expect.arrayContaining(sts.distritos));
    }
  });

  test('the polygons carry the same ids as the snapshot', async () => {
    const { coordenadorias, supervisoes } = await readStaticHealthDivisions();

    expect(featureIds('supervisoes-saude.geojson')).toEqual(ids(supervisoes));
    expect(featureIds('coordenadorias-saude.geojson')).toEqual(
      ids(coordenadorias)
    );
  });
});

describe('readStaticHealthDivisions — validation', () => {
  // The snapshot is already loaded by the tests above; each mock needs a fresh
  // module registry to take.
  beforeEach(() => {
    jest.resetModules();
  });

  test.each([
    [
      'a CRS with no districts',
      {
        coordenadorias: [{ id: 1, nome: 'CRS', distritos: [] }],
        supervisoes: [],
      },
    ],
    [
      'an STS without its CRS',
      {
        coordenadorias: [],
        supervisoes: [{ id: 1, nome: 'STS', distritos: [1] }],
      },
    ],
    ['a missing level', { coordenadorias: [] }],
  ])('rejects %s', async (_case, snapshot) => {
    jest.doMock('@/data-source-static/data/health-divisions.json', () => {
      return snapshot;
    });

    const { readStaticHealthDivisions: read } =
      await import('@/data-source-static/readStaticHealthDivisions');

    await expect(read()).rejects.toThrow('[data-source-static]');
  });
});
