/**
 * @jest-environment node
 */
import {
  distanceInMetres,
  toAppNearbyPoints,
} from '@/data-gateway/transformers/toAppNearbyPoints';

/** Praça da Sé. */
const ORIGIN = { lat: -23.5503, lng: -46.6339 };

/** Metres in one degree of latitude. */
const METRES_PER_DEGREE = 111_195;

/** A UBS `metres` north of the origin. */
const ubsNorthBy = (id: number, metres: number) => {
  return {
    id,
    longitude: ORIGIN.lng,
    latitude: ORIGIN.lat + metres / METRES_PER_DEGREE,
    distrito: 'Sé',
    atributos: {
      nome: `UBS ${id}`,
      tipo: 'Unidade Básica de Saúde',
      esfera: 'Municipal',
    },
  };
};

const source = {
  points: [
    ubsNorthBy(1, 0),
    ubsNorthBy(2, 400),
    ubsNorthBy(3, 1500),
    ubsNorthBy(4, 2500),
  ],
};

describe('toAppNearbyPoints', () => {
  test('keeps the points inside the radius, leaving out the searched spot', () => {
    const nearby = toAppNearbyPoints({
      layer: 'ubs',
      source,
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby).toEqual([
      {
        id: 'ubs:2',
        lngLat: [source.points[1].longitude, source.points[1].latitude],
        name: 'UBS 2',
        detail: 'Unidade Básica de Saúde · Municipal',
        address: '',
        phone: '',
        hours: '',
        facts: [
          { label: 'Tipo', value: 'Unidade Básica de Saúde' },
          { label: 'Esfera', value: 'Municipal' },
        ],
        categoryId: 'ubs',
        distance: expect.closeTo(400, 0),
      },
    ]);
  });

  test('a widened search answers only the ring beyond the first one', () => {
    const nearby = toAppNearbyPoints({
      layer: 'ubs',
      source,
      query: { ...ORIGIN, radiusMin: 1000, radius: 2000 },
    });

    expect(
      nearby.map((point) => {
        return point.id;
      })
    ).toEqual(['ubs:3']);
  });

  test('joins the address and the neighbourhood, and keeps the phone', () => {
    const point = ubsNorthBy(5, 300);
    const [nearby] = toAppNearbyPoints({
      layer: 'ubs',
      source: {
        points: [
          {
            ...point,
            atributos: {
              ...point.atributos,
              endereco: 'R. Tabatinguera, 200',
              bairro: 'Sé',
              cep: '01001-000',
              telefone: '3241-0000',
            },
          },
        ],
      },
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby).toMatchObject({
      address: 'R. Tabatinguera, 200 · Sé · 01001-000',
      phone: '3241-0000',
    });
  });

  test('lists every labelled fact the source has, as it reads', () => {
    const point = ubsNorthBy(7, 300);
    const [stop, base] = toAppNearbyPoints({
      layer: 'bicicletarios',
      source: {
        points: [
          {
            ...point,
            atributos: {
              nome: 'Bicicletário Luz',
              tipo: 'BICICLETARIO',
              vagas: '40',
              responsavel: 'CPTM',
            },
          },
          {
            ...ubsNorthBy(8, 400),
            atributos: {
              nome: 'Base Sé',
              regiao: 'NORTE',
              suporte_basico: 'Sim',
              suporte_avancado: 'Não',
              motolancia: 'Sim',
            },
          },
        ],
      },
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(stop.facts).toEqual([
      { label: 'Tipo', value: 'Bicicletário' },
      { label: 'Responsável', value: 'CPTM' },
      { label: 'Vagas', value: '40' },
    ]);
    expect(base.facts).toEqual([
      { label: 'Região', value: 'Norte' },
      { label: 'Atendimento', value: 'Suporte básico · Motolância' },
    ]);
  });

  test('says whether a private hospital is philanthropic and serves the SUS', () => {
    const [nearby] = toAppNearbyPoints({
      layer: 'hospitais-privados',
      source: {
        points: [
          {
            ...ubsNorthBy(10, 300),
            atributos: {
              nome: 'Hospital',
              tipo: 'Hospital geral',
              natureza: 'Filantrópico',
              sus: 'Sim',
            },
          },
        ],
      },
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby.facts).toEqual([
      { label: 'Tipo', value: 'Hospital geral' },
      { label: 'Natureza', value: 'Filantrópico' },
      { label: 'Atende SUS', value: 'Sim' },
    ]);
  });

  test('leaves out placeholders and a description repeating the address', () => {
    const point = ubsNorthBy(9, 300);
    const [nearby] = toAppNearbyPoints({
      layer: 'pontos-onibus',
      source: {
        points: [
          {
            ...point,
            atributos: {
              nome: 'Ponto',
              tipo: 'SEM TIPO',
              codigo: '123',
              endereco: 'R. A',
              descricao: 'R. A',
              rotativo: 'S',
            },
          },
        ],
      },
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby.facts).toEqual([
      { label: 'Rotativa', value: 'Sim' },
      { label: 'Código', value: '123' },
    ]);
  });

  test("keeps a market's opening hours", () => {
    const point = ubsNorthBy(6, 300);
    const [nearby] = toAppNearbyPoints({
      layer: 'mercados',
      source: {
        points: [
          {
            ...point,
            atributos: { nome: 'Mercado', horario: 'SEGUNDA A SÁBADO 8H-18H' },
          },
        ],
      },
      query: { ...ORIGIN, radiusMin: 0, radius: 1000 },
    });

    expect(nearby.hours).toBe('SEGUNDA A SÁBADO 8H-18H');
  });
});

describe('distanceInMetres', () => {
  test('measures a degree of latitude as about 111 km', () => {
    expect(
      distanceInMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    ).toBeCloseTo(111_195, -1);
  });
});
