/**
 * @jest-environment node
 */
import { createOverlaysStore } from '@/app/(features)/mapas/_components/overlaysStore';
import {
  isOverlayId,
  isPointOverlayId,
  OVERLAY_IDS,
  overlayDrawOrder,
  OVERLAYS,
  POINT_OVERLAY_IDS,
} from '@/config/overlays';
import type { OverlayContract } from '@/data-gateway/schema';
import { toAppParks } from '@/data-gateway/transformers/toAppParks';
import { toAppPoints } from '@/data-gateway/transformers/toAppPoints';

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

  test('draws every polygon beneath every point', () => {
    const kinds = overlayDrawOrder(OVERLAYS).map((overlay) => {
      return overlay.kind;
    });
    const firstPoint = kinds.indexOf('point');

    expect(kinds.slice(firstPoint)).not.toContain('polygon');
  });

  test('keeps the control order within each kind, first item on top', () => {
    const ids = overlayDrawOrder(OVERLAYS).map((overlay) => {
      return overlay.id;
    });

    expect(ids[0]).toBe('parques');
    expect(ids[1]).toBe('pontos-onibus');
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
