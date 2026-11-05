import { legendReference } from '@/app/(features)/mapas/_components/mapLegend';

describe('legendReference', () => {
  test('names only the sources, Seade and the basemap, on the district map', () => {
    expect(
      legendReference({ level: 'distrito', overlays: false, offer: false })
    ).toBe(
      'Fonte: {link:Seade|https://repositorio.seade.gov.br/dataset/populacao-residente-municipio-de-sao-paulo-evolucao} · {link:OpenStreetMap|https://www.openstreetmap.org/copyright}'
    );
  });

  test.each([
    ['an overlay is on', { level: 'distrito', overlays: true, offer: false }],
    [
      'an offer indicator is painted',
      { level: 'distrito', overlays: false, offer: true },
    ],
    [
      "the polygons are GeoSampa's",
      { level: 'subprefeitura', overlays: false, offer: false },
    ],
  ] as const)('adds GeoSampa while %s', (_name, params) => {
    expect(legendReference(params)).toContain(
      ' · {link:GeoSampa|https://geosampa.prefeitura.sp.gov.br} · '
    );
  });
});
