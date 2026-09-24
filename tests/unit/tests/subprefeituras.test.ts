/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isMapLevel } from '@/components/map/lib/mapLevels';
import { buildMapRows } from '@/components/map/lib/mapRows';
import { mapDescription } from '@/components/map/lib/workspaceConfig';
import {
  type ServiceCounts,
  toAppMapsData,
} from '@/data-gateway/transformers/toAppMapsData';

// `workspaceConfig` reads icon names from `icons.ts`, which also registers the
// icons through `@ttoss/react-icons` — an ESM-only package Jest does not
// transform. The names are all these tests need.
jest.mock('@/components/map/lib/icons', () => {
  return {
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

/** One UBS in "Pequeno" and one hospital in "Outro"; nothing else. */
const SERVICES: ServiceCounts = {
  ubs: new Map([['Pequeno', 1]]),
  hospitais: new Map([['Outro', 1]]),
  restaurantes: new Map(),
  esporte: new Map(),
};

const district = (
  geometryId: number,
  nome: string,
  ano: number,
  count65: number,
  total: number
) => {
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
 * Two districts of very different size in one subprefeitura: a small one with
 * a high 65+ share (30%) and a large one with a low share (10%). Their mean is
 * 20%; the population-weighted share is 53 thousand over 510 thousand, 10.4%.
 */
const SOURCE = {
  districts: [
    district(1, 'Pequeno', 2025, 3000, 10000),
    district(2, 'Grande', 2025, 50000, 500000),
    district(3, 'Outro', 2025, 1000, 20000),
  ],
};

const SUBPREFEITURAS = {
  subprefeituras: [
    {
      id: 10,
      codigo: '10',
      sigla: 'AA',
      nome: 'Alfa',
      regiao: 'Leste',
      distritos: [1, 2],
    },
    {
      id: 11,
      codigo: '11',
      sigla: 'BB',
      nome: 'Beta',
      regiao: 'Sul',
      distritos: [3],
    },
  ],
};

describe('toAppMapsData — subprefeitura aggregation', () => {
  test('sums the districts counts per subprefeitura and year', () => {
    const contract = toAppMapsData(SOURCE, SUBPREFEITURAS, SERVICES);

    expect(contract.subprefeituraCounts).toEqual([
      {
        geometryId: 10,
        name: 'Alfa',
        year: 2025,
        count65to69: 53000,
        count70to74: 0,
        count75plus: 0,
        total: 510000,
        services: { ubs: 1, hospitais: 0, restaurantes: 0, esporte: 0 },
      },
      {
        geometryId: 11,
        name: 'Beta',
        year: 2025,
        count65to69: 1000,
        count70to74: 0,
        count75plus: 0,
        total: 20000,
        services: { ubs: 0, hospitais: 1, restaurantes: 0, esporte: 0 },
      },
    ]);
  });

  test('the rate painted is weighted by population, not a mean of rates', () => {
    const contract = toAppMapsData(SOURCE, SUBPREFEITURAS, SERVICES);
    const [alfa] = buildMapRows({
      counts: contract.subprefeituraCounts,
      year: 2025,
      category: 'cumulative-total',
      group: '65',
    });

    // 53000 / 510000, rounded to four decimals — not (0.3 + 0.1) / 2 = 0.2.
    expect(alfa?.value).toBe(0.1039);
  });

  test('lists each subprefeitura districts alphabetically', () => {
    const contract = toAppMapsData(SOURCE, SUBPREFEITURAS, SERVICES);

    expect(contract.subprefeituras[0]).toEqual({
      geometryId: 10,
      name: 'Alfa',
      districtNames: ['Grande', 'Pequeno'],
    });
  });

  test('throws when a district belongs to no subprefeitura', () => {
    expect(() => {
      return toAppMapsData(
        SOURCE,
        { subprefeituras: [SUBPREFEITURAS.subprefeituras[0]!] },
        SERVICES
      );
    }).toThrow('belongs to no subprefeitura');
  });

  test('throws when a district belongs to two subprefeituras', () => {
    expect(() => {
      return toAppMapsData(
        SOURCE,
        {
          subprefeituras: [
            ...SUBPREFEITURAS.subprefeituras,
            { ...SUBPREFEITURAS.subprefeituras[1]!, id: 12, distritos: [3] },
          ],
        },
        SERVICES
      );
    }).toThrow('more than one subprefeitura');
  });

  test('throws when a subprefeitura names a district without counts', () => {
    expect(() => {
      return toAppMapsData(
        SOURCE,
        {
          subprefeituras: [
            ...SUBPREFEITURAS.subprefeituras,
            { ...SUBPREFEITURAS.subprefeituras[1]!, id: 12, distritos: [99] },
          ],
        },
        SERVICES
      );
    }).toThrow('has no counts');
  });
});

describe('readStaticSubprefeituras — validation', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('throws when a subprefeitura groups no district', async () => {
    jest.doMock('@/data-source-static/data/subprefeituras.json', () => {
      return {
        subprefeituras: [
          { ...SUBPREFEITURAS.subprefeituras[0], distritos: [] },
        ],
      };
    });

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');

    await expect(readStaticSubprefeituras()).rejects.toThrow(
      '[data-source-static]'
    );
  });

  test('the versioned snapshot groups all 96 districts into 32 subprefeituras', async () => {
    // `doMock` survives `resetModules`, so the fixture above must be lifted.
    jest.dontMock('@/data-source-static/data/subprefeituras.json');

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');
    const { subprefeituras } = await readStaticSubprefeituras();
    const districtIds = subprefeituras.flatMap((sub) => {
      return sub.distritos;
    });

    expect(subprefeituras).toHaveLength(32);
    expect(districtIds).toHaveLength(96);
    expect(new Set(districtIds).size).toBe(96);
  });

  test('the versioned geometry carries one polygon per subprefeitura id', async () => {
    jest.dontMock('@/data-source-static/data/subprefeituras.json');

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');
    const { subprefeituras } = await readStaticSubprefeituras();
    const geojson = JSON.parse(
      readFileSync(
        path.resolve(__dirname, '../../../public/subprefeituras.geojson'),
        'utf8'
      )
    ) as { features: { id: number }[] };

    const featureIds = geojson.features
      .map((feature) => {
        return feature.id;
      })
      .sort((a, b) => {
        return a - b;
      });
    const subIds = subprefeituras
      .map((sub) => {
        return sub.id;
      })
      .sort((a, b) => {
        return a - b;
      });

    expect(featureIds).toEqual(subIds);
  });
});

describe('map levels', () => {
  test('isMapLevel accepts the two levels only', () => {
    expect(isMapLevel('distrito')).toBe(true);
    expect(isMapLevel('subprefeitura')).toBe(true);
    expect(isMapLevel('regiao')).toBe(false);
    expect(isMapLevel(undefined)).toBe(false);
  });

  test('the legend subtitle names the level painted', () => {
    expect(
      mapDescription({
        category: 'cumulative-total',
        group: '65',
        level: 'subprefeitura',
      })
    ).toBe(
      'Proporção da população total da subprefeitura com 65 anos ou mais.'
    );
    expect(
      mapDescription({
        category: 'cumulative-total',
        group: '65',
        level: 'distrito',
      })
    ).toBe('Proporção da população total do distrito com 65 anos ou mais.');
  });
});
