/**
 * @jest-environment node
 */
import { legendLabelFormat } from '@/app/(features)/mapas/_components/mapLegend';
import { buildMapRows } from '@/components/map/lib/mapRows';
import {
  buildWorkspaceConfig,
  GROUP_OPTIONS,
} from '@/components/map/lib/workspaceConfig';
import { OFFER_SERVICES } from '@/config/offer';
import { thresholdsFor } from '@/config/thresholds';
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

/** 21,380 residents aged 65+ and three UBS: 1.4 UBS per 10 thousand. */
const AREA: DistrictCounts = {
  geometryId: 1,
  name: 'Cidade Tiradentes',
  year: 2025,
  count65to69: 10000,
  count70to74: 6000,
  count75plus: 5380,
  total: 200000,
  services: { ubs: 3, hospitais: 0, restaurantes: 1, esporte: 7 },
};

describe('offer indicators — rates', () => {
  test('a rate is facilities per 10 thousand residents aged 65+', () => {
    const [row] = buildMapRows({
      counts: [AREA],
      year: 2025,
      category: 'offer-65plus',
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
      category: 'offer-65plus',
      group: 'hospitais',
    });

    expect(row?.value).toBe(0);
  });

  test('every service has class breaks whose first class holds only zero', () => {
    for (const service of OFFER_SERVICES) {
      const breaks = thresholdsFor({
        category: 'offer-65plus',
        group: service,
      });

      expect(breaks).toHaveLength(6);
      expect(breaks[0]).toBeGreaterThan(0);
      expect(breaks[0]).toBeLessThan(0.01);
    }
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
  const config = (category: 'offer-65plus' | 'cumulative-total') => {
    return buildWorkspaceConfig({
      level: 'distrito',
      category,
      group: category === 'offer-65plus' ? 'ubs' : '65',
      years: [2000, 2025, 2050],
      defaultYear: 2025,
      elderlyHistogram: [],
      sidebarInitiallyOpen: true,
    });
  };

  test('the timeline tab is enabled for every category but the offer one', () => {
    const timeline = config('cumulative-total').leftSidebar?.sections?.find(
      (section) => {
        return section.enabledWhen !== undefined;
      }
    );

    expect(timeline?.enabledWhen?.values).toEqual([
      'cumulative-total',
      'cumulative-65plus',
      '5year-65plus',
    ]);
  });

  test('the offer category lists the four services in its second menu', () => {
    expect(
      GROUP_OPTIONS['offer-65plus'].map((option) => {
        return option.value;
      })
    ).toEqual(['ubs', 'hospitais', 'restaurantes', 'esporte']);
  });

  test('the offer legend labels plain numbers and names the zero class', () => {
    const format = legendLabelFormat('offer-65plus');

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
