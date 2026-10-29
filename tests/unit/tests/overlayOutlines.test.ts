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

const layers = () => {
  return buildOverlays({
    layers: createOverlaysStore(jest.fn()).getSnapshot(),
    tooltipStyle: {},
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
