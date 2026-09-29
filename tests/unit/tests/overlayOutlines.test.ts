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
      return layer.id === 'coordenadorias-saude-overlay-outline';
    });

    expect(outline).toMatchObject({
      sourceId: 'coordenadorias-saude',
      geometry: 'line',
      paint: { lineColor: '#1A1A1A', lineWidth: 3 },
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
