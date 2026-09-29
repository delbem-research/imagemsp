/**
 * @jest-environment node
 */
import { legendLabelFormat } from '@/app/(features)/mapas/_components/mapLegend';
import { buildMapRows, offerAgeShare } from '@/components/map/lib/mapRows';
import {
  AGE_MENU_ID,
  ageFor,
  buildWorkspaceConfig,
  GROUP_OPTIONS,
  mapDescription,
  mapTitle,
} from '@/components/map/lib/workspaceConfig';
import {
  isOfferCategory,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_IDS,
  offerAgeBands,
  offerAgesLong,
  offerAgesShort,
} from '@/config/offer';
import { scaleOfferThresholds, thresholdsFor } from '@/config/thresholds';
import type { DistrictCounts } from '@/data-gateway/schema';
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

/** The "Configurações" tab's inputs; no test here builds a ramp. */
const COLOR_SETTINGS = {
  customRamps: [],
  onCreateRamp: jest.fn(),
  onRemoveRamp: jest.fn(),
};

/** 21,380 residents aged 65+ and three UBS: 1.4 UBS per 10 thousand. */
const AREA: DistrictCounts = {
  geometryId: 1,
  name: 'Cidade Tiradentes',
  year: 2025,
  count65to69: 10000,
  count70to74: 6000,
  count75plus: 5380,
  total: 200000,
  services: {
    ubs: 3,
    hospitais: 0,
    urgencia: 0,
    samu: 0,
    ambulatorios: 0,
    'saude-mental': 0,
    'dst-aids': 0,
    vigilancia: 0,
    animais: 0,
    restaurantes: 1,
    esporte: 7,
  },
};

describe('offer indicators — rates', () => {
  test('a rate is facilities per 10 thousand residents aged 65+', () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'health-65plus',
      group: 'ubs',
    });

    expect(row).toEqual({
      geometryId: 1,
      value: 1.4,
      name: 'Cidade Tiradentes',
      count: 3,
      totalCount: 21380,
    });
  });

  test('an area without the service paints zero', () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'health-65plus',
      group: 'hospitais',
    });

    expect(row?.value).toBe(0);
  });

  test('every service has class breaks whose first class holds only zero', () => {
    for (const category of OFFER_CATEGORY_IDS) {
      for (const service of OFFER_CATEGORIES[category]) {
        const breaks = thresholdsFor({ category, group: service });

        expect(breaks).toHaveLength(6);
        expect(breaks[0]).toBeGreaterThan(0);
        expect(breaks[0]).toBeLessThan(0.01);
      }
    }
  });

  test('a service is painted only under its own category', () => {
    expect(() => {
      return buildMapRows({
        counts: [AREA],
        year: 2025,
        category: 'food-65plus',
        group: 'ubs',
      });
    }).toThrow('[mapRows]');
  });
});

describe('offer indicators — contract', () => {
  const source = {
    districts: [
      {
        ano: 2025,
        cod_distr: 80001,
        nome: 'Água Rasa',
        municipio: 'São Paulo',
        geometry_id: 1,
        count_65_69: 100,
        count_70_74: 0,
        count_75plus: 0,
        total: 1000,
      },
    ],
  };
  const subprefeituras = {
    subprefeituras: [
      {
        id: 24,
        codigo: '25',
        sigla: 'MO',
        nome: 'Mooca',
        regiao: 'Leste',
        distritos: [1],
      },
    ],
  };
  const services = (ubs: Map<string, number>): ServiceCounts => {
    return {
      ubs,
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
  };

  test('carries each district facility count on every year', () => {
    const contract = toAppMapsData(
      source,
      subprefeituras,
      services(new Map([['Água Rasa', 2]]))
    );

    expect(contract.counts[0]?.services.ubs).toBe(2);
  });

  test('throws on a facility counted in a district the snapshot lacks', () => {
    expect(() => {
      return toAppMapsData(
        source,
        subprefeituras,
        services(new Map([['Agua Rasa', 2]]))
      );
    }).toThrow('which the maps snapshot does not carry');
  });
});

describe('offer indicators — sidebar and legend', () => {
  const config = (category: 'health-65plus' | 'cumulative-total') => {
    return buildWorkspaceConfig({
      level: 'distrito',
      category,
      group: category === 'health-65plus' ? 'ubs' : '65',
      years: [2000, 2025, 2050],
      defaultYear: 2025,
      elderlyHistogram: [],
      colorSettings: COLOR_SETTINGS,
      sidebarInitiallyOpen: true,
    });
  };

  test('the timeline tab is enabled for every category but the offer one', () => {
    const timeline = config('cumulative-total').leftSidebar?.sections?.find(
      (section) => {
        return section.id === 'Linha do tempo';
      }
    );

    expect(timeline?.enabledWhen?.values).toEqual([
      'cumulative-total',
      '5year-65plus',
    ]);
  });

  test('each offer category lists its own services in the second menu', () => {
    const services = (category: keyof typeof GROUP_OPTIONS) => {
      return GROUP_OPTIONS[category].map((option) => {
        return option.value;
      });
    };

    expect(services('health-65plus')).toEqual([
      'ubs',
      'hospitais',
      'urgencia',
      'samu',
      'ambulatorios',
      'saude-mental',
      'dst-aids',
      'vigilancia',
      'animais',
    ]);
    expect(services('food-65plus')).toEqual(['restaurantes']);
    expect(services('leisure-65plus')).toEqual(['esporte']);
  });

  test('tells the offer categories from the share ones', () => {
    expect(OFFER_CATEGORY_IDS.every(isOfferCategory)).toBe(true);
    expect(isOfferCategory('cumulative-total')).toBe(false);
  });

  test('the offer legend labels plain numbers and names the zero class', () => {
    const format = legendLabelFormat('leisure-65plus');

    if (format.type !== 'custom') {
      throw new Error('expected a custom label format');
    }

    expect(format.formatter(null, 0.001, 0)).toBe('nenhum');
    expect(format.formatter(0.001, 1, 1)).toBe('< 1');
    expect(format.formatter(0.25, 0.5, 2)).toBe('0,25 – 0,5');
    expect(format.formatter(8, null, 6)).toBe('> 8');
  });

  test('the share legends keep their percentage labels', () => {
    expect(legendLabelFormat('cumulative-total')).toEqual({
      type: 'percentage',
      decimals: 0,
    });
  });
});

describe('offer indicators — age filter', () => {
  test('each age group stands for the bands it spans', () => {
    expect(offerAgeBands('65')).toEqual(['65-69', '70-74', '75']);
    expect(offerAgeBands('75')).toEqual(['75']);
    expect(offerAgeBands('65-69')).toEqual(['65-69']);
    expect(offerAgeBands('70-74')).toEqual(['70-74']);
  });

  test.each([
    [['65-69', '70-74', '75'], '65+', '65 anos ou mais'],
    [['70-74', '75'], '70+', '70 anos ou mais'],
    [['75'], '75+', '75 anos ou mais'],
    [['65-69', '70-74'], '65–74', '65 a 74 anos'],
    [['70-74'], '70–74', '70 a 74 anos'],
    [['65-69', '75'], '65–69 e 75+', '65 a 69 anos e 75 anos ou mais'],
  ] as const)('names %j as %s', (bands, short, long) => {
    expect(offerAgesShort(bands)).toBe(short);
    expect(offerAgesLong(bands)).toBe(long);
  });

  test('a rate narrowed to some bands divides by their residents only', () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'health-65plus',
      group: 'ubs',
      ages: ['75'],
    });

    // 3 UBS over 5,380 residents aged 75+.
    expect(row).toMatchObject({ value: 5.58, count: 3, totalCount: 5380 });
  });

  test("the share series ignore the offer's age bands", () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'cumulative-total',
      group: '65',
      ages: ['75'],
    });

    expect(row?.totalCount).toBe(200000);
  });

  test("the bands' city-wide share of the 65+ scales the breaks", () => {
    const share = offerAgeShare({ counts: [AREA], year: 2025, ages: ['75'] });

    expect(share).toBeCloseTo(5380 / 21380);
    expect(
      offerAgeShare({ counts: [AREA], year: 2025, ages: offerAgeBands('65') })
    ).toBe(1);
  });

  test('scaled breaks keep the zero class and round to two digits', () => {
    expect(
      scaleOfferThresholds({ thresholds: [0.001, 1, 2, 3, 5, 8], share: 0.5 })
    ).toEqual([0.001, 2, 4, 6, 10, 16]);
    expect(
      scaleOfferThresholds({ thresholds: [0.001, 0.25, 0.5], share: 0.3 })
    ).toEqual([0.001, 0.83, 1.7]);
    expect(scaleOfferThresholds({ thresholds: [0.001, 1], share: 1 })).toEqual([
      0.001, 1,
    ]);
  });

  test('the legend title and subtitle name the bands', () => {
    expect(mapTitle({ category: 'health-65plus', group: 'ubs' })).toBe(
      'UBS POR 10 MIL IDOSOS (65+)'
    );
    expect(
      mapTitle({ category: 'health-65plus', group: 'ubs', ages: ['75'] })
    ).toBe('UBS POR 10 MIL IDOSOS (75+)');
    expect(
      mapDescription({
        category: 'health-65plus',
        group: 'ubs',
        level: 'distrito',
        ages: ['65-69'],
      })
    ).toContain('para cada 10 mil pessoas com 65 a 69 anos');
  });

  test('every indicator ends on the one age menu; only the offer ones list a service', () => {
    const blocks = (
      category: 'health-65plus' | 'cumulative-total' | '5year-65plus',
      age: '75' | '65' = '75'
    ) => {
      const [variations] =
        buildWorkspaceConfig({
          level: 'distrito',
          category,
          group: 'ubs',
          age,
          years: [2025],
          defaultYear: 2025,
          elderlyHistogram: [],
          colorSettings: COLOR_SETTINGS,
          sidebarInitiallyOpen: true,
        }).leftSidebar?.sections ?? [];
      if (variations?.body.kind !== 'filters') {
        throw new Error('expected a filters body');
      }
      return variations.body.blocks;
    };

    const offerBlocks = blocks('health-65plus');
    expect(
      offerBlocks.map((block) => {
        return block.id;
      })
    ).toEqual(['level', 'category', 'group', AGE_MENU_ID]);
    expect(offerBlocks[3]?.control).toMatchObject({
      kind: 'variations',
      menuId: AGE_MENU_ID,
      defaultValue: '75',
    });
    const options = (
      category: 'health-65plus' | 'cumulative-total' | '5year-65plus'
    ) => {
      const age = blocks(category).find((block) => {
        return block.id === AGE_MENU_ID;
      });
      if (age?.control.kind !== 'variations') throw new Error('no age menu');
      return age.control.variations.map((variation) => {
        return variation.label;
      });
    };
    const all = ['Todos', '65 a 69 anos', '70 a 74 anos', '75 anos ou mais'];

    expect(
      blocks('cumulative-total').map((block) => {
        return block.id;
      })
    ).toEqual(['level', 'category', AGE_MENU_ID]);
    expect(options('health-65plus')).toEqual(all);
    expect(options('cumulative-total')).toEqual(all);
    // The 65+ as a share of itself would be 100% everywhere.
    expect(options('5year-65plus')).toEqual(all.slice(1));
  });

  test('the share of the 65+ opens on its first band when "Todos" is selected', () => {
    expect(ageFor({ category: '5year-65plus', age: '65' })).toBe('65-69');
    expect(ageFor({ category: '5year-65plus', age: '75' })).toBe('75');
    expect(ageFor({ category: 'cumulative-total', age: '65' })).toBe('65');
  });

  test('the whole population share lists every band', () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'cumulative-total',
      group: '70-74',
    });

    // 6,000 residents aged 70–74 over 200,000.
    expect(row).toMatchObject({ value: 0.03, count: 6000, totalCount: 200000 });
    expect(
      thresholdsFor({ category: 'cumulative-total', group: '65-69' })
    ).toHaveLength(6);
    expect(
      thresholdsFor({ category: 'cumulative-total', group: '70-74' })
    ).toHaveLength(6);
  });

  test('the sidebar has the variations, the timeline and the settings tabs', () => {
    const sections =
      buildWorkspaceConfig({
        level: 'distrito',
        category: 'health-65plus',
        group: 'ubs',
        years: [2025],
        defaultYear: 2025,
        elderlyHistogram: [],
        colorSettings: COLOR_SETTINGS,
        sidebarInitiallyOpen: true,
      }).leftSidebar?.sections ?? [];

    expect(
      sections.map((section) => {
        return section.id;
      })
    ).toEqual(['Variações', 'Linha do tempo', 'Configurações']);
  });
});
