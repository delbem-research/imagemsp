/**
 * @jest-environment node
 */
import {
  buildOverlays,
  LAYER_CONTROL,
} from '@/app/(features)/mapas/_components/overlays';
import { createOverlaysStore } from '@/app/(features)/mapas/_components/overlaysStore';

// `overlays.tsx` reads the pin icons from `icons.ts`, which also registers
// them through `@ttoss/react-icons` — an ESM-only package Jest does not
// transform. The thumbnails fall back to a bare pin without them.
jest.mock('@/components/map/lib/icons', () => {
  return { PIN_ICON_DATA: {} };
});

/** Every age band: what the map's age filter picks for "Todos". */
const ALL_AGES = ['65-69', '70-74', '75'] as const;

const layers = () => {
  return buildOverlays({
    layers: createOverlaysStore(jest.fn()).getSnapshot(),
    tooltipStyle: {},
    ages: ALL_AGES,
  }).layers;
};

describe('polygon overlay outlines', () => {
  test('an outline-only territory is stroked by a line layer at its weight', () => {
    const outline = layers().find((layer) => {
      return layer.id === 'abrangencia-ubs-overlay-outline';
    });

    expect(outline).toMatchObject({
      sourceId: 'abrangencia-ubs',
      geometry: 'line',
      paint: { lineColor: '#4D4D4D', lineWidth: 0.7 },
    });
  });

  test('the outline sits right above its own fill', () => {
    const ids = layers().map((layer) => {
      return layer.id;
    });
    const fill = ids.indexOf('abrangencia-ubs-overlay');

    expect(ids[fill + 1]).toBe('abrangencia-ubs-overlay-outline');
  });

  test('the solid parks keep their fill outline and get no line layer', () => {
    expect(
      layers().some((layer) => {
        return layer.id === 'parques-overlay-outline';
      })
    ).toBe(false);
  });

  test('the control toggles a territory fill and its outline together', () => {
    const item = LAYER_CONTROL.items.find((entry) => {
      return entry.id === 'saude-familia';
    });

    expect(item?.layers).toEqual([
      'saude-familia-overlay',
      'saude-familia-overlay-outline',
    ]);
  });
});

describe('line overlays', () => {
  const byId = (id: string) => {
    return layers().find((layer) => {
      return layer.id === id;
    });
  };

  test('the cycle lanes are solid strokes with a tooltip, leaving out the ciclorrotas', () => {
    expect(byId('ciclovias-overlay')).toMatchObject({
      sourceId: 'ciclovias',
      geometry: 'line',
      paint: { lineColor: '#424242', lineWidth: 3 },
      click: {},
      filter: { property: 'detail', operator: 'neq', value: 'Ciclorrota' },
    });
  });

  test('the ciclorrotas are drawn dashed, right above the solid lanes, with the same tooltip', () => {
    const built = layers();
    const solid = built.find((layer) => {
      return layer.id === 'ciclovias-overlay';
    });
    const dashed = built.find((layer) => {
      return layer.id === 'ciclovias-overlay-dashed';
    });

    expect(dashed).toMatchObject({
      sourceId: 'ciclovias',
      geometry: 'line',
      paint: {
        lineColor: '#424242',
        lineWidth: 3,
        lineDasharray: [2, 1.5],
      },
      filter: { property: 'detail', operator: 'eq', value: 'Ciclorrota' },
    });
    expect(dashed?.hoverTooltip).toBe(solid?.hoverTooltip);

    const ids = built.map((layer) => {
      return layer.id;
    });
    expect(ids[ids.indexOf('ciclovias-overlay') + 1]).toBe(
      'ciclovias-overlay-dashed'
    );
  });

  test('the control toggles the solid and the dashed lanes together', () => {
    const item = LAYER_CONTROL.items.find((entry) => {
      return entry.id === 'ciclovias';
    });

    expect(item?.layers).toEqual([
      'ciclovias-overlay',
      'ciclovias-overlay-dashed',
    ]);
    expect(decodeURIComponent(item?.thumbnail ?? '')).toContain(
      "stroke-dasharray='6 5'"
    );
  });
});

describe('heatmap overlays', () => {
  const heatOf = (
    active: boolean,
    ages: readonly ('65-69' | '70-74' | '75')[] = ALL_AGES
  ) => {
    const store = createOverlaysStore(
      jest.fn(() => {
        return new Promise<never>(() => {});
      })
    );
    store.setActive('acidentes', active);
    return buildOverlays({
      layers: store.getSnapshot(),
      tooltipStyle: {},
      ages,
    }).layers.find((layer) => {
      return layer.id === 'acidentes-overlay';
    });
  };

  test('the crashes draw their density in their ramp, by zoom, with no tooltip', () => {
    const layer = heatOf(false);

    expect(layer).toMatchObject({
      sourceId: 'acidentes',
      geometry: 'heatmap',
      visible: false,
      paint: {
        heatmapColors: ['#FDE68A', '#F97316', '#DC2626', '#7F1D1D'],
        heatmapRadius: [
          [10, 10],
          [13, 24],
          [16, 44],
        ],
        heatmapOpacity: 0.8,
      },
    });
    expect(layer).not.toHaveProperty('hoverTooltip');
    expect(layer).not.toHaveProperty('click');
  });

  test('carries no legend while off', () => {
    const layer = heatOf(false);

    expect(layer).not.toHaveProperty('legends');
    expect(layer).not.toHaveProperty('activeLegendId');
  });

  test('carries a density legend in the bottom-right corner while on', () => {
    const layer = heatOf(true);

    expect(layer?.activeLegendId).toBe('acidentes-overlay-legend');
    expect(layer?.legends).toEqual([
      expect.objectContaining({
        id: 'acidentes-overlay-legend',
        title: 'Acidentes de trânsito',
        position: 'bottom-right',
        colorBy: {
          type: 'density',
          lowLabel: 'Menos acidentes',
          highLabel: 'Mais acidentes',
        },
      }),
    ]);
    expect(layer?.legends?.[0]?.reference).toBe(
      'Fonte: {link:Infosiga|https://infosiga.detran.sp.gov.br}'
    );
  });

  test('every age band keeps one point per crash, and its legend says 65 or more', () => {
    const layer = heatOf(true);

    expect(layer?.filter).toEqual({
      property: 'todos',
      operator: 'eq',
      value: 1,
    });
    expect(layer?.legends?.[0]?.subtitle).toBe(
      'Densidade dos acidentes de trânsito de 2024 com pessoas de 65 anos ou mais feridas ou mortas.'
    );
  });

  test('some age bands keep the points of those bands, and the legend names them', () => {
    const layer = heatOf(true, ['70-74', '75']);

    expect(layer?.filter).toEqual({
      property: 'faixa',
      operator: 'in',
      value: ['70-74', '75'],
    });
    expect(layer?.legends?.[0]?.subtitle).toContain('70 anos ou mais');
  });

  test('the control shows the heat as blots of its ramp', () => {
    const item = LAYER_CONTROL.items.find((entry) => {
      return entry.id === 'acidentes';
    });
    const svg = decodeURIComponent(item?.thumbnail ?? '');

    expect(item?.layers).toEqual(['acidentes-overlay']);
    expect(svg).toContain('radialGradient');
    expect(svg).toContain('#7F1D1D');
  });
});
