/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isMapLevel } from '@/components/map/lib/mapLevels';
import { buildMapRows } from '@/components/map/lib/mapRows';
import { mapDescription } from '@/components/map/lib/workspaceConfig';
import { isInForce } from '@/data-gateway/schema';
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
      validFrom: 2002,
      validTo: null,
    },
    {
      id: 11,
      codigo: '11',
      sigla: 'BB',
      nome: 'Beta',
      regiao: 'Sul',
      distritos: [3],
      validFrom: 2002,
      validTo: null,
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
        services: {
          ubs: 1,
          hospitais: 0,
          urgencia: 0,
          samu: 0,
          ambulatorios: 0,
          'saude-mental': 0,
          'dst-aids': 0,
          vigilancia: 0,
          animais: 0,
          restaurantes: 0,
          esporte: 0,
        },
      },
      {
        geometryId: 11,
        name: 'Beta',
        year: 2025,
        count65to69: 1000,
        count70to74: 0,
        count75plus: 0,
        total: 20000,
        services: {
          ubs: 0,
          hospitais: 1,
          urgencia: 0,
          samu: 0,
          ambulatorios: 0,
          'saude-mental': 0,
          'dst-aids': 0,
          vigilancia: 0,
          animais: 0,
          restaurantes: 0,
          esporte: 0,
        },
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
      validFrom: 2002,
      validTo: null,
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

  test('throws when two subprefeituras share an id', () => {
    expect(() => {
      return toAppMapsData(
        SOURCE,
        {
          subprefeituras: [
            SUBPREFEITURAS.subprefeituras[0]!,
            { ...SUBPREFEITURAS.subprefeituras[1]!, id: 10 },
          ],
        },
        SERVICES
      );
    }).toThrow('share the id 10');
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

/**
 * The same three districts across a split: until 2012 all three form "Alfa";
 * from 2013 "Alfa" keeps districts 1 and 2 and district 3 forms "Beta". 2000
 * predates the division.
 */
describe('toAppMapsData — a division that changes over the series', () => {
  const years = [2000, 2005, 2010, 2015];
  const source = {
    districts: years.flatMap((year) => {
      return [
        district(1, 'Pequeno', year, 3000, 10000),
        district(2, 'Grande', year, 50000, 500000),
        district(3, 'Outro', year, 1000, 20000),
      ];
    }),
  };
  const [alfa, beta] = SUBPREFEITURAS.subprefeituras;
  const versioned = {
    subprefeituras: [
      { ...alfa!, id: 12, distritos: [1, 2, 3], validTo: 2012 },
      { ...alfa!, validFrom: 2013 },
      { ...beta!, validFrom: 2013 },
    ],
  };

  const areasOf = (year: number) => {
    return toAppMapsData(source, versioned, SERVICES)
      .subprefeituraCounts.filter((entry) => {
        return entry.year === year;
      })
      .map(({ geometryId, total }) => {
        return { geometryId, total };
      });
  };

  test('sums each year into the division in force that year', () => {
    expect(areasOf(2010)).toEqual([{ geometryId: 12, total: 530000 }]);
    expect(areasOf(2015)).toEqual([
      { geometryId: 10, total: 510000 },
      { geometryId: 11, total: 20000 },
    ]);
  });

  test('a year before the division has no subprefeitura counts', () => {
    expect(areasOf(2000)).toEqual([]);
  });

  test('throws when two subprefeituras in force share a district', () => {
    expect(() => {
      return toAppMapsData(
        source,
        {
          subprefeituras: [
            ...versioned.subprefeituras,
            { ...beta!, id: 13, validFrom: 2010, validTo: 2012 },
          ],
        },
        SERVICES
      );
    }).toThrow('more than one subprefeitura in 2010');
  });

  test('throws when a year is only partly covered by the division', () => {
    expect(() => {
      return toAppMapsData(
        source,
        { subprefeituras: versioned.subprefeituras.slice(0, 2) },
        SERVICES
      );
    }).toThrow('belongs to no subprefeitura in 2015');
  });
});

describe('isInForce', () => {
  test('includes both ends and treats a null end as ongoing', () => {
    const former = { validFrom: 2002, validTo: 2012 };
    const current = { validFrom: 2013, validTo: null };

    expect(isInForce(former, 2002)).toBe(true);
    expect(isInForce(former, 2012)).toBe(true);
    expect(isInForce(former, 2013)).toBe(false);
    expect(isInForce(current, 2012)).toBe(false);
    expect(isInForce(current, 2050)).toBe(true);
    expect(isInForce(former, 2000)).toBe(false);
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

  test('throws when a subprefeitura ends before it starts', async () => {
    jest.doMock('@/data-source-static/data/subprefeituras.json', () => {
      return {
        subprefeituras: [
          {
            ...SUBPREFEITURAS.subprefeituras[0],
            validFrom: 2013,
            validTo: 2012,
          },
        ],
      };
    });

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');

    await expect(readStaticSubprefeituras()).rejects.toThrow(
      '[data-source-static]'
    );
  });

  test.each([
    [2000, 0, 0],
    [2010, 31, 96],
    [2015, 32, 96],
    [2025, 32, 96],
  ])(
    'the versioned snapshot in %i: %i subprefeituras grouping %i districts',
    async (year, subCount, districtCount) => {
      // `doMock` survives `resetModules`, so the fixtures above must be lifted.
      jest.dontMock('@/data-source-static/data/subprefeituras.json');

      const { readStaticSubprefeituras } =
        await import('@/data-source-static/readStaticSubprefeituras');
      const { subprefeituras } = await readStaticSubprefeituras();
      const inForce = subprefeituras.filter((sub) => {
        return isInForce(sub, year);
      });
      const districtIds = inForce.flatMap((sub) => {
        return sub.distritos;
      });

      expect(inForce).toHaveLength(subCount);
      expect(districtIds).toHaveLength(districtCount);
      expect(new Set(districtIds).size).toBe(districtCount);
    }
  );

  test('Vila Prudente-Sapopemba splits into Vila Prudente and Sapopemba in 2013', async () => {
    jest.dontMock('@/data-source-static/data/subprefeituras.json');

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');
    const { subprefeituras } = await readStaticSubprefeituras();
    const byName = (nome: string) => {
      return subprefeituras.find((sub) => {
        return sub.nome === nome;
      });
    };
    const former = byName('Vila Prudente-Sapopemba');
    const successors = [byName('Vila Prudente'), byName('Sapopemba')];

    expect(former).toMatchObject({ validFrom: 2002, validTo: 2012 });
    for (const successor of successors) {
      expect(successor).toMatchObject({ validFrom: 2013, validTo: null });
    }
    expect(
      successors
        .flatMap((sub) => {
          return sub?.distritos ?? [];
        })
        .sort((a, b) => {
          return a - b;
        })
    ).toEqual(former?.distritos);
  });

  test('the versioned geometry carries each subprefeitura years, as the JSON does', async () => {
    jest.dontMock('@/data-source-static/data/subprefeituras.json');

    const { readStaticSubprefeituras } =
      await import('@/data-source-static/readStaticSubprefeituras');
    const { subprefeituras } = await readStaticSubprefeituras();
    const geojson = JSON.parse(
      readFileSync(
        path.resolve(__dirname, '../../../public/subprefeituras.geojson'),
        'utf8'
      )
    ) as {
      features: {
        id: number;
        properties: { id: number; validFrom: number; validTo: number | null };
      }[];
    };

    for (const feature of geojson.features) {
      const sub = subprefeituras.find((candidate) => {
        return candidate.id === feature.id;
      });

      // The map filters on `properties.id`, so it must be the feature id.
      expect(feature.properties.id).toBe(feature.id);
      expect(feature.properties.validFrom).toBe(sub?.validFrom);
      expect(feature.properties.validTo).toBe(sub?.validTo);
    }
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
