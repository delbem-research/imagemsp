/**
 * @jest-environment node
 */
import { defaultSelection } from '@/app/(features)/mapas/_components/mapSelection';
import {
  mapUrlFor,
  mapUrlParams,
  mapUrlStateFromSearch,
} from '@/app/(features)/mapas/_components/mapUrlState';

// `mapSelection` reaches `icons.ts`, which registers the icons through
// `@ttoss/react-icons` — an ESM-only package Jest does not transform.
jest.mock('@/components/map/lib/icons', () => {
  return {
    ICONS: new Proxy(
      {},
      {
        get: (_, name) => {
          return String(name);
        },
      }
    ),
  };
});

const years = [2010, 2020, 2030];
const defaults = defaultSelection(years);

const read = (search: string) => {
  return mapUrlStateFromSearch({ search, defaults, years });
};

describe('mapUrlStateFromSearch', () => {
  test('an address without parameters opens on the defaults', () => {
    expect(read('')).toEqual({ selection: defaults, overlays: [] });
  });

  test('reads every parameter', () => {
    expect(
      read(
        '?recorte=subprefeitura&indicador=faixa&idade=75&ano=2020&cores=verdes&opacidade=60&camadas=samu,hospitais'
      )
    ).toEqual({
      selection: {
        ...defaults,
        level: 'subprefeitura',
        category: '5year-65plus',
        age: '75',
        year: 2020,
        ramp: 'verdes',
        opacity: '60',
      },
      // In registry order, not the link's.
      overlays: ['hospitais', 'samu'],
    });
  });

  test('drops invalid values to their defaults', () => {
    expect(
      read(
        '?recorte=bairro&indicador=nada&idade=12&ano=1999&cores=meus&opacidade=5&camadas=nada'
      )
    ).toEqual({ selection: defaults, overlays: [] });
  });

  test('reads "todos" as every age', () => {
    expect(read('?idade=todos').selection.age).toBe('65');
  });

  test('moves an age the indicator does not list to its first one', () => {
    expect(
      read('?indicador=proporcao-cumulativa&idade=65-69').selection.age
    ).toBe('70');
  });

  test('reads a service under an offer indicator only', () => {
    expect(read('?indicador=saude&servico=samu').selection.group).toBe('samu');
    expect(read('?indicador=saude&servico=nada').selection.group).toBe('ubs');
    expect(read('?servico=samu').selection.group).toBe(defaults.group);
  });
});

describe('mapUrlParams', () => {
  test('an untouched map has no parameters', () => {
    expect(
      mapUrlParams({ state: { selection: defaults, overlays: [] }, defaults })
    ).toEqual([]);
  });

  test('leaves the year out under an offer indicator', () => {
    expect(
      mapUrlParams({
        state: {
          selection: {
            ...defaults,
            category: 'health-65plus',
            group: 'samu',
            year: 2020,
          },
          overlays: [],
        },
        defaults,
      })
    ).toEqual([
      ['indicador', 'saude'],
      ['servico', 'samu'],
    ]);
  });

  test('leaves a ramp the reader built out', () => {
    expect(
      mapUrlParams({
        state: { selection: { ...defaults, ramp: 'custom-1' }, overlays: [] },
        defaults,
      })
    ).toEqual([]);
  });

  test("writes an age away from the indicator's first one", () => {
    expect(
      mapUrlParams({
        state: {
          selection: { ...defaults, category: 'cumulative-65plus', age: '75' },
          overlays: [],
        },
        defaults,
      })
    ).toEqual([
      ['indicador', 'proporcao-cumulativa'],
      ['idade', '75'],
    ]);
  });

  test('round-trips through the address', () => {
    const state = read(
      '?recorte=subprefeitura&indicador=faixa&idade=70-74&ano=2030&cores=roxos&opacidade=80&camadas=hospitais'
    );
    const search = new URLSearchParams(
      mapUrlParams({ state, defaults })
    ).toString();

    expect(read(search)).toEqual(state);
  });
});

describe('mapUrlFor', () => {
  test('replaces the map parameters and keeps the rest', () => {
    expect(
      mapUrlFor({
        href: 'https://x.test/mapas?idade=75&utm=a#topo',
        state: {
          selection: { ...defaults, age: '70-74' },
          overlays: ['hospitais', 'samu'],
        },
        defaults,
      })
    ).toBe('/mapas?utm=a&idade=70-74&camadas=hospitais,samu#topo');
  });

  test('an untouched map has a clean address', () => {
    expect(
      mapUrlFor({
        href: 'https://x.test/mapas?idade=75',
        state: { selection: defaults, overlays: [] },
        defaults,
      })
    ).toBe('/mapas');
  });
});
