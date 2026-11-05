/**
 * @jest-environment node
 */
import { createOverlaysStore } from '@/app/(features)/mapas/_components/overlaysStore';
import {
  isOverlayId,
  isPointOverlayId,
  isTerritoryOverlayId,
  OVERLAY_IDS,
  overlayDrawOrder,
  OVERLAYS,
  POINT_OVERLAY_IDS,
  TERRITORY_OVERLAY_IDS,
} from '@/config/overlays';
import type { OverlayContract } from '@/data-gateway/schema';
import { toAppBikeLanes } from '@/data-gateway/transformers/toAppBikeLanes';
import { toAppCrashes } from '@/data-gateway/transformers/toAppCrashes';
import { toAppParks } from '@/data-gateway/transformers/toAppParks';
import { toAppPoints } from '@/data-gateway/transformers/toAppPoints';
import { toAppTerritories } from '@/data-gateway/transformers/toAppTerritories';

const SANTA_CASA = {
  id: 1,
  longitude: -46.649326,
  latitude: -23.54268301,
  distrito: 'Consolação',
  atributos: {
    nome: 'SANTA CASA DE SÃO PAULO',
    tipo: 'Hospital',
    esfera: 'Privado',
    endereco: 'R. DR CESARIO MOTTA JR, 112',
  },
};

const COLLECTION: OverlayContract = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {
        name: 'SANTA CASA DE SÃO PAULO',
        detail: 'Hospital · Privado',
      },
      geometry: { type: 'Point', coordinates: [-46.649326, -23.54268301] },
    },
  ],
};

/** Resolves once every pending promise callback has run. */
const flushPromises = () => {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
};

describe('overlay registry', () => {
  test('accepts every registered layer and rejects anything else', () => {
    for (const id of OVERLAY_IDS) {
      expect(isOverlayId(id)).toBe(true);
    }
    expect(isOverlayId('clubes')).toBe(false);
  });

  test('tells the point overlays from the polygon ones', () => {
    expect(isPointOverlayId('ubs')).toBe(true);
    expect(isPointOverlayId('parques')).toBe(false);
  });

  test('draws polygons, then heatmaps, then lines, then points, bottom up', () => {
    const kinds = overlayDrawOrder(OVERLAYS).map((overlay) => {
      return overlay.kind;
    });
    const firstHeatmap = kinds.indexOf('heatmap');
    const firstLine = kinds.indexOf('line');
    const firstPoint = kinds.indexOf('point');

    expect(firstHeatmap).toBeGreaterThan(kinds.lastIndexOf('polygon'));
    expect(firstLine).toBeGreaterThan(kinds.lastIndexOf('heatmap'));
    expect(firstPoint).toBeGreaterThan(kinds.lastIndexOf('line'));
  });

  test('keeps the control order within each kind, first item on top', () => {
    const ids = overlayDrawOrder(OVERLAYS).map((overlay) => {
      return overlay.id;
    });

    // Polygons first, bottom to top: the finest territory beneath, the solid
    // parks — first in the control — above them.
    expect(ids.slice(0, 3)).toEqual([
      'saude-familia',
      'abrangencia-ubs',
      'parques',
    ]);
    expect(ids[3]).toBe('acidentes');
    expect(ids[4]).toBe('ciclovias');
    expect(ids[5]).toBe('pontos-onibus');
    expect(ids[ids.length - 1]).toBe('hospitais');
  });
});

describe('readStaticPoints — validation', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('resolves with the parsed data when the snapshot is well-formed', async () => {
    jest.doMock('@/data-source-static/data/points/hospitais.json', () => {
      return { points: [SANTA_CASA] };
    });

    const { readStaticPoints } =
      await import('@/data-source-static/readStaticPoints');

    await expect(readStaticPoints('hospitais')).resolves.toEqual({
      points: [SANTA_CASA],
    });
  });

  test('throws when points is not an array', async () => {
    jest.doMock('@/data-source-static/data/points/hospitais.json', () => {
      return { points: 'not-an-array' };
    });

    const { readStaticPoints } =
      await import('@/data-source-static/readStaticPoints');

    await expect(readStaticPoints('hospitais')).rejects.toThrow(
      '[data-source-static]'
    );
  });

  test('throws when a coordinate is not a finite number', async () => {
    jest.doMock('@/data-source-static/data/points/hospitais.json', () => {
      return { points: [{ ...SANTA_CASA, latitude: Number.NaN }] };
    });

    const { readStaticPoints } =
      await import('@/data-source-static/readStaticPoints');

    await expect(readStaticPoints('hospitais')).rejects.toThrow(
      '[data-source-static]'
    );
  });

  test('every versioned snapshot passes its own validation', async () => {
    // `doMock` survives `resetModules`, so the fixtures above must be lifted.
    jest.dontMock('@/data-source-static/data/points/hospitais.json');

    const { readStaticPoints } =
      await import('@/data-source-static/readStaticPoints');

    for (const layer of POINT_OVERLAY_IDS) {
      const { points } = await readStaticPoints(layer);
      expect(points.length).toBeGreaterThan(0);
    }
  });
});

describe('parks', () => {
  afterEach(() => {
    jest.resetModules();
  });

  const IBIRAPUERA = {
    id: 1,
    nome: 'Ibirapuera',
    categoria: 'Parque Urbano',
    cadparc: 'PQ_VM_01',
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-46.66, -23.59],
          [-46.65, -23.59],
          [-46.65, -23.58],
          [-46.66, -23.59],
        ] as [number, number][],
      ],
    },
  };

  test('toAppParks labels each park with its name and category', () => {
    expect(toAppParks({ parques: [IBIRAPUERA] })).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { name: 'Ibirapuera', detail: 'Parque Urbano' },
          geometry: IBIRAPUERA.geometry,
        },
      ],
    });
  });

  test('toAppParks throws on an empty snapshot', () => {
    expect(() => {
      return toAppParks({ parques: [] });
    }).toThrow('[data-gateway]');
  });

  test('readStaticParks rejects a park without a polygon', async () => {
    jest.doMock('@/data-source-static/data/polygons/parques.json', () => {
      return {
        parques: [
          { ...IBIRAPUERA, geometry: { type: 'Point', coordinates: [0, 0] } },
        ],
      };
    });

    const { readStaticParks } =
      await import('@/data-source-static/readStaticParks');

    await expect(readStaticParks()).rejects.toThrow('[data-source-static]');
  });

  test('the versioned parks snapshot passes its own validation', async () => {
    // `doMock` survives `resetModules`, so the fixture above must be lifted.
    jest.dontMock('@/data-source-static/data/polygons/parques.json');

    const { readStaticParks } =
      await import('@/data-source-static/readStaticParks');
    const { parques } = await readStaticParks();

    expect(parques.length).toBeGreaterThan(0);
  });
});

describe('cycle network', () => {
  afterEach(() => {
    jest.resetModules();
  });

  const BROOKLIN = {
    id: 1,
    nome: 'CICLORROTA BROOKLIN',
    tipo: 'Ciclorrota',
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-46.68493, -23.63591],
        [-46.68499, -23.63591],
      ] as [number, number][],
    },
  };

  test('is a line overlay, neither a point nor a territory', () => {
    expect(isOverlayId('ciclovias')).toBe(true);
    expect(isPointOverlayId('ciclovias')).toBe(false);
    expect(isTerritoryOverlayId('ciclovias')).toBe(false);
    expect(
      OVERLAYS.find((overlay) => {
        return overlay.id === 'ciclovias';
      })?.kind
    ).toBe('line');
  });

  test('toAppBikeLanes labels each stretch with its name and type', () => {
    expect(toAppBikeLanes({ ciclovias: [BROOKLIN] })).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { name: 'CICLORROTA BROOKLIN', detail: 'Ciclorrota' },
          geometry: BROOKLIN.geometry,
        },
      ],
    });
  });

  test('toAppBikeLanes throws on an empty snapshot', () => {
    expect(() => {
      return toAppBikeLanes({ ciclovias: [] });
    }).toThrow('[data-gateway]');
  });

  test.each([
    ['a point', { type: 'Point', coordinates: [0, 0] }],
    ['a one-position line', { type: 'LineString', coordinates: [[0, 0]] }],
    ['an empty multi-line', { type: 'MultiLineString', coordinates: [] }],
  ])(
    'readStaticBikeLanes rejects a stretch drawn as %s',
    async (_, geometry) => {
      jest.doMock('@/data-source-static/data/lines/ciclovias.json', () => {
        return { ciclovias: [{ ...BROOKLIN, geometry }] };
      });

      const { readStaticBikeLanes } =
        await import('@/data-source-static/readStaticBikeLanes');

      await expect(readStaticBikeLanes()).rejects.toThrow(
        '[data-source-static]'
      );
    }
  );

  test('readStaticBikeLanes accepts a multi-line stretch', async () => {
    const multi = {
      ...BROOKLIN,
      geometry: {
        type: 'MultiLineString',
        coordinates: [BROOKLIN.geometry.coordinates],
      },
    };
    jest.doMock('@/data-source-static/data/lines/ciclovias.json', () => {
      return { ciclovias: [multi] };
    });

    const { readStaticBikeLanes } =
      await import('@/data-source-static/readStaticBikeLanes');

    await expect(readStaticBikeLanes()).resolves.toEqual({
      ciclovias: [multi],
    });
  });

  test('the versioned cycle network snapshot passes its own validation', async () => {
    // `doMock` survives `resetModules`, so the fixtures above must be lifted.
    jest.dontMock('@/data-source-static/data/lines/ciclovias.json');

    const { readStaticBikeLanes } =
      await import('@/data-source-static/readStaticBikeLanes');
    const { ciclovias } = await readStaticBikeLanes();

    expect(ciclovias.length).toBeGreaterThan(0);
    expect(
      new Set(
        ciclovias.map((lane) => {
          return lane.tipo;
        })
      )
    ).toEqual(
      new Set(['Ciclovia', 'Ciclofaixa', 'Ciclorrota', 'Ciclopassarela'])
    );
  });
});

describe('traffic crashes', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('are a heatmap overlay, neither a point nor a territory', () => {
    expect(isOverlayId('acidentes')).toBe(true);
    expect(isPointOverlayId('acidentes')).toBe(false);
    expect(isTerritoryOverlayId('acidentes')).toBe(false);
    expect(
      OVERLAYS.find((overlay) => {
        return overlay.id === 'acidentes';
      })?.kind
    ).toBe('heatmap');
  });

  test('toAppCrashes makes a crash one unlabelled point per age band, the first of them `todos`', () => {
    expect(
      toAppCrashes({
        ano: 2024,
        acidentes: [
          [-46.74931, -23.53816, ['70-74']],
          [-46.71528, -23.69871, ['65-69', '75']],
        ],
      })
    ).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { name: '', detail: '', faixa: '70-74', todos: 1 },
          geometry: { type: 'Point', coordinates: [-46.74931, -23.53816] },
        },
        {
          type: 'Feature',
          id: 2,
          properties: { name: '', detail: '', faixa: '65-69', todos: 1 },
          geometry: { type: 'Point', coordinates: [-46.71528, -23.69871] },
        },
        {
          type: 'Feature',
          id: 3,
          properties: { name: '', detail: '', faixa: '75', todos: 0 },
          geometry: { type: 'Point', coordinates: [-46.71528, -23.69871] },
        },
      ],
    });
  });

  test('toAppCrashes throws on an empty snapshot', () => {
    expect(() => {
      return toAppCrashes({ ano: 2024, acidentes: [] });
    }).toThrow('[data-gateway]');
  });

  test.each([
    ['a year that is not an integer', { ano: '2024', acidentes: [] }],
    ['crashes that are not a list', { ano: 2024, acidentes: {} }],
    ['a crash with one coordinate', { ano: 2024, acidentes: [[-46.7]] }],
    [
      'a coordinate that is not a number',
      { ano: 2024, acidentes: [[-46.7, 'x', ['75']]] },
    ],
    [
      'a crash with no age band',
      { ano: 2024, acidentes: [[-46.7, -23.5, []]] },
    ],
    [
      'an age band the app does not have',
      { ano: 2024, acidentes: [[-46.7, -23.5, ['60-64']]] },
    ],
    ['no snapshot at all', null],
  ])('readStaticCrashes rejects %s', async (_, snapshot) => {
    jest.doMock('@/data-source-static/data/heat/acidentes.json', () => {
      return snapshot;
    });

    const { readStaticCrashes } =
      await import('@/data-source-static/readStaticCrashes');

    await expect(readStaticCrashes()).rejects.toThrow('[data-source-static]');
  });

  test('the versioned crash snapshot passes its own validation, inside the city', async () => {
    // `doMock` survives `resetModules`, so the fixtures above must be lifted.
    jest.dontMock('@/data-source-static/data/heat/acidentes.json');

    const { readStaticCrashes } =
      await import('@/data-source-static/readStaticCrashes');
    const { ano, acidentes } = await readStaticCrashes();

    expect(ano).toBe(2024);
    // The crashes with a person aged 65 or more hurt or killed: over a
    // thousand in 2024, each with at least one age band.
    expect(acidentes.length).toBeGreaterThan(1_000);
    expect(
      acidentes.every(([, , bands]) => {
        return bands.length > 0;
      })
    ).toBe(true);
    // The city's own bounding box: the generator drops anything outside its
    // districts.
    expect(
      acidentes.every(([longitude, latitude]) => {
        return (
          longitude > -46.83 &&
          longitude < -46.36 &&
          latitude > -24.01 &&
          latitude < -23.35
        );
      })
    ).toBe(true);
  });
});

describe('health territories', () => {
  afterEach(() => {
    jest.resetModules();
  });

  const UBS_MARSILAC = {
    id: 1,
    nome: 'UBS MARSILAC',
    detalhe: 'Área de abrangência · STS Parelheiros · CRS Sul',
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-46.76, -23.59],
          [-46.65, -23.59],
          [-46.65, -23.5],
          [-46.76, -23.59],
        ] as [number, number][],
      ],
    },
  };

  test('are polygon overlays, told apart from the parks and the points', () => {
    expect(TERRITORY_OVERLAY_IDS.every(isTerritoryOverlayId)).toBe(true);
    expect(isTerritoryOverlayId('parques')).toBe(false);
    expect(isTerritoryOverlayId('ubs')).toBe(false);
    for (const id of TERRITORY_OVERLAY_IDS) {
      expect(isOverlayId(id)).toBe(true);
      expect(isPointOverlayId(id)).toBe(false);
    }
  });

  test('the UBS catchments are an outline only, the CRS and STS no overlay', () => {
    const config = OVERLAYS.find((overlay) => {
      return overlay.id === 'abrangencia-ubs';
    });

    expect(config).toMatchObject({ kind: 'polygon', fillOpacity: 0 });
    // The coordinations and supervisions are levels of the choropleth now.
    expect(TERRITORY_OVERLAY_IDS).toEqual(['abrangencia-ubs', 'saude-familia']);
    expect(isOverlayId('coordenadorias-saude')).toBe(false);
    expect(isOverlayId('supervisoes-saude')).toBe(false);
  });

  test('toAppTerritories labels each territory with its name and detail', () => {
    expect(toAppTerritories({ territorios: [UBS_MARSILAC] })).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: {
            name: 'UBS MARSILAC',
            detail: 'Área de abrangência · STS Parelheiros · CRS Sul',
          },
          geometry: UBS_MARSILAC.geometry,
        },
      ],
    });
  });

  test('toAppTerritories throws on an empty snapshot', () => {
    expect(() => {
      return toAppTerritories({ territorios: [] });
    }).toThrow('[data-gateway]');
  });

  test('readStaticTerritories rejects a territory without a polygon', async () => {
    jest.doMock(
      '@/data-source-static/data/polygons/abrangencia-ubs.json',
      () => {
        return {
          territorios: [
            {
              ...UBS_MARSILAC,
              geometry: { type: 'Point', coordinates: [0, 0] },
            },
          ],
        };
      }
    );

    const { readStaticTerritories } =
      await import('@/data-source-static/readStaticTerritories');

    await expect(readStaticTerritories('abrangencia-ubs')).rejects.toThrow(
      '[data-source-static]'
    );
  });

  test.each([
    ['abrangencia-ubs', 487],
    ['saude-familia', 382],
  ] as const)(
    'the versioned %s snapshot passes its own validation',
    async (layer, count) => {
      jest.dontMock('@/data-source-static/data/polygons/abrangencia-ubs.json');

      const { readStaticTerritories } =
        await import('@/data-source-static/readStaticTerritories');
      const { territorios } = await readStaticTerritories(layer);

      expect(territorios).toHaveLength(count);
    }
  );
});

describe('toAppPoints', () => {
  test('maps each point to a feature with a name and a secondary line', () => {
    expect(
      toAppPoints({ layer: 'hospitais', source: { points: [SANTA_CASA] } })
    ).toEqual(COLLECTION);
  });

  test('title-cases the all-caps values of the secondary line', () => {
    const contract = toAppPoints({
      layer: 'restaurantes',
      source: {
        points: [
          {
            ...SANTA_CASA,
            atributos: {
              nome: 'CAMPO LIMPO',
              programa: 'REDE COZINHA CIDADÃ',
              esfera: 'ESTADUAL/MUNICIPAL',
            },
          },
        ],
      },
    });

    expect(contract.features[0]?.properties.detail).toBe(
      'Rede Cozinha Cidadã · Estadual/Municipal'
    );
  });

  test('describes a station by mode and line', () => {
    const contract = toAppPoints({
      layer: 'estacoes',
      source: {
        points: [
          {
            ...SANTA_CASA,
            atributos: { nome: 'SÉ', modal: 'Metrô', linha: 'AZUL' },
          },
        ],
      },
    });

    expect(contract.features[0]?.properties.detail).toBe('Metrô · Linha Azul');
  });

  test.each([
    [
      'a private hospital by kind and legal nature',
      'hospitais-privados' as const,
      { nome: 'HOSPITAL X', tipo: 'Hospital geral', natureza: 'Filantrópico' },
      'Hospital geral · Filantrópico',
    ],
    [
      'an organic fair by when it is held',
      'feiras-organicas' as const,
      { nome: 'Feira Y', horario: 'Sábado, 7h00 às 13h00' },
      'Sábado, 7h00 às 13h00',
    ],
    [
      'an urban garden by the group behind it',
      'hortas' as const,
      {
        nome: 'Horta Z',
        responsavel: 'Sociedade Amigos do Belém',
        bairro: 'Belém',
      },
      'Sociedade Amigos do Belém',
    ],
    [
      'an urban garden without a group by its neighbourhood',
      'hortas' as const,
      { nome: 'Horta Z', responsavel: '', bairro: 'Tatuapé' },
      'Tatuapé',
    ],
    [
      'a SESC unit by its neighbourhood',
      'sesc' as const,
      { nome: 'SESC POMPÉIA', bairro: 'VILA POMPEIA' },
      'Vila Pompeia',
    ],
    [
      'a Farmácia Popular pharmacy by its name on the map',
      'farmacias-populares' as const,
      { nome: 'RAIA DROGASIL S/A', nome_osm: 'Droga Raia', bairro: 'MOOCA' },
      'Droga Raia',
    ],
    [
      'a Farmácia Popular pharmacy the map has no name for by its neighbourhood',
      'farmacias-populares' as const,
      { nome: 'DROGARIA X LTDA', nome_osm: '', bairro: 'VILA MARIANA' },
      'Vila Mariana',
    ],
    [
      'a private pharmacy by the chain its name does not already say',
      'farmacias-privadas' as const,
      { nome: 'Raia', marca: 'Droga Raia', bairro: 'Mooca' },
      'Droga Raia',
    ],
    [
      'a private pharmacy named after its chain by its neighbourhood',
      'farmacias-privadas' as const,
      { nome: 'Drogasil', marca: 'Drogasil', bairro: 'Pinheiros' },
      'Pinheiros',
    ],
    [
      'a private restaurant by its cuisines, translated',
      'restaurantes-privados' as const,
      { nome: 'Cantina X', cozinha: 'pizza;italian' },
      'Pizzaria · Italiana',
    ],
    [
      'a private restaurant leaving out the cuisines it cannot translate',
      'restaurantes-privados' as const,
      { nome: 'Chi Fu', cozinha: 'chinese;cantonese' },
      'Chinesa',
    ],
    [
      'a private restaurant once per cuisine label',
      'restaurantes-privados' as const,
      { nome: 'Espeto Y', cozinha: 'barbecue;churrasco' },
      'Churrasco',
    ],
    [
      'a private restaurant without a known cuisine by nothing',
      'restaurantes-privados' as const,
      { nome: 'Bar Z', cozinha: 'wood_fired' },
      '',
    ],
  ])('describes %s', (_, layer, atributos, detail) => {
    const contract = toAppPoints({
      layer,
      source: { points: [{ ...SANTA_CASA, atributos }] },
    });

    expect(contract.features[0]?.properties.detail).toBe(detail);
  });

  test('keeps a sports centre type whole after its category', () => {
    const contract = toAppPoints({
      layer: 'esporte',
      source: {
        points: [
          {
            ...SANTA_CASA,
            atributos: {
              nome: 'CENTRO ESPORTIVO SANTO AMARO',
              tipo: 'Centro Esportivo/Centro Educacional e Esportivo - CE/CEE',
            },
          },
        ],
      },
    });

    expect(contract.features[0]?.properties.detail).toBe(
      'Centro Esportivo · Centro Educacional e Esportivo - CE/CEE'
    );
  });

  test('leaves the source placeholders out of a facility line', () => {
    const contract = toAppPoints({
      layer: 'animais',
      source: {
        points: [
          {
            ...SANTA_CASA,
            atributos: {
              nome: 'CENTRO DE CONTROLE DE ZOONOSES',
              tipo: 'SEM TIPO',
              esfera: 'SEM ESFERA',
            },
          },
        ],
      },
    });

    expect(contract.features[0]?.properties.detail).toBe('');
  });

  test('describes a SAMU base by region and the modalities it runs', () => {
    const contract = toAppPoints({
      layer: 'samu',
      source: {
        points: [
          {
            ...SANTA_CASA,
            atributos: {
              nome: 'Hungria',
              regiao: 'NORTE',
              suporte_basico: 'Sim',
              suporte_basico_enfermeiro: 'Sim',
              suporte_avancado: 'Não',
              motolancia: 'Sim',
            },
          },
        ],
      },
    });

    expect(contract.features[0]?.properties.detail).toBe(
      'Região Norte · Suporte básico · Suporte básico com enfermeiro · Motolância'
    );
  });

  test('throws on an empty snapshot', () => {
    expect(() => {
      return toAppPoints({ layer: 'ubs', source: { points: [] } });
    }).toThrow('[data-gateway]');
  });
});

describe('createOverlaysStore', () => {
  test('starts with every layer inactive and nothing loaded', () => {
    const fetchPoints = jest.fn();
    const store = createOverlaysStore(fetchPoints);

    expect(Object.values(store.getSnapshot().active)).not.toContain(true);
    expect(store.getSnapshot().data).toEqual({});
    expect(fetchPoints).not.toHaveBeenCalled();
  });

  test('fetches a layer on its first activation and keeps the result', async () => {
    const fetchPoints = jest.fn().mockResolvedValue(COLLECTION);
    const store = createOverlaysStore(fetchPoints);
    const listener = jest.fn();
    store.subscribe(listener);

    store.setActive('ubs', true);
    await flushPromises();

    expect(fetchPoints).toHaveBeenCalledWith('ubs');
    expect(store.getSnapshot().active.ubs).toBe(true);
    expect(store.getSnapshot().data.ubs).toEqual(COLLECTION);
    expect(listener).toHaveBeenCalled();

    store.setActive('ubs', false);
    store.setActive('ubs', true);
    await flushPromises();

    expect(fetchPoints).toHaveBeenCalledTimes(1);
  });

  test('loads each layer independently', async () => {
    const fetchPoints = jest.fn().mockResolvedValue(COLLECTION);
    const store = createOverlaysStore(fetchPoints);

    store.setActive('ubs', true);
    store.setActive('estacoes', true);
    await flushPromises();

    expect(fetchPoints).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data.hospitais).toBeUndefined();
  });

  test('does not stack requests while one is in flight', () => {
    const fetchPoints = jest.fn().mockReturnValue(new Promise(() => {}));
    const store = createOverlaysStore(fetchPoints);

    store.setActive('ubs', true);
    store.setActive('ubs', false);
    store.setActive('ubs', true);

    expect(fetchPoints).toHaveBeenCalledTimes(1);
  });

  test('retries on the next activation after a failed request', async () => {
    const fetchPoints = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(COLLECTION);
    const store = createOverlaysStore(fetchPoints);

    store.setActive('ubs', true);
    await flushPromises();

    expect(store.getSnapshot().data.ubs).toBeUndefined();

    store.setActive('ubs', false);
    store.setActive('ubs', true);
    await flushPromises();

    expect(fetchPoints).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data.ubs).toEqual(COLLECTION);
  });

  test('does not notify when the activation does not change', () => {
    const store = createOverlaysStore(jest.fn().mockResolvedValue(COLLECTION));
    const listener = jest.fn();
    store.subscribe(listener);

    store.setActive('ubs', false);

    expect(listener).not.toHaveBeenCalled();
  });
});
