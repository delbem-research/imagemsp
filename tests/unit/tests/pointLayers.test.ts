/**
 * @jest-environment node
 */
import { createPointLayersStore } from '@/app/(features)/mapas/_components/pointLayersStore';
import { isPointLayerId, POINT_LAYER_IDS } from '@/config/pointLayers';
import type { PointsContract } from '@/data-gateway/schema';
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

const COLLECTION: PointsContract = {
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

describe('isPointLayerId', () => {
  test('accepts every registered layer and rejects anything else', () => {
    for (const id of POINT_LAYER_IDS) {
      expect(isPointLayerId(id)).toBe(true);
    }
    expect(isPointLayerId('parques')).toBe(false);
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

    for (const layer of POINT_LAYER_IDS) {
      const { points } = await readStaticPoints(layer);
      expect(points.length).toBeGreaterThan(0);
    }
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

  test('throws on an empty snapshot', () => {
    expect(() => {
      return toAppPoints({ layer: 'ubs', source: { points: [] } });
    }).toThrow('[data-gateway]');
  });
});

describe('createPointLayersStore', () => {
  test('starts with every layer inactive and nothing loaded', () => {
    const fetchPoints = jest.fn();
    const store = createPointLayersStore(fetchPoints);

    expect(Object.values(store.getSnapshot().active)).not.toContain(true);
    expect(store.getSnapshot().data).toEqual({});
    expect(fetchPoints).not.toHaveBeenCalled();
  });

  test('fetches a layer on its first activation and keeps the result', async () => {
    const fetchPoints = jest.fn().mockResolvedValue(COLLECTION);
    const store = createPointLayersStore(fetchPoints);
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
    const store = createPointLayersStore(fetchPoints);

    store.setActive('ubs', true);
    store.setActive('estacoes', true);
    await flushPromises();

    expect(fetchPoints).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data.hospitais).toBeUndefined();
  });

  test('does not stack requests while one is in flight', () => {
    const fetchPoints = jest.fn().mockReturnValue(new Promise(() => {}));
    const store = createPointLayersStore(fetchPoints);

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
    const store = createPointLayersStore(fetchPoints);

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
    const store = createPointLayersStore(
      jest.fn().mockResolvedValue(COLLECTION)
    );
    const listener = jest.fn();
    store.subscribe(listener);

    store.setActive('ubs', false);

    expect(listener).not.toHaveBeenCalled();
  });
});
