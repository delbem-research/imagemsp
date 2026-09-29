/**
 * @jest-environment node
 */
import {
  choroplethColors,
  COLOR_RAMPS,
  colorRampOptions,
  DEFAULT_COLOR_RAMP,
} from '@/components/map/lib/colorRamps';
import { LEGEND_COLORS } from '@/components/map/lib/mapConfig';
import {
  OPACITY_MENU_ID,
  RAMP_MENU_ID,
} from '@/components/map/lib/settingsSection';
import { buildWorkspaceConfig } from '@/components/map/lib/workspaceConfig';

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

const CUSTOM = {
  id: 'minha',
  label: 'Minha',
  colors: ['#ffffff', '#ff0000', '#000000'],
};

describe('color ramps', () => {
  test('every shipped ramp has one colour per choropleth class', () => {
    for (const ramp of COLOR_RAMPS) {
      expect(ramp.colors).toHaveLength(LEGEND_COLORS.length);
    }
  });

  test("the default ramp at full opacity is the map's own blue", () => {
    expect(
      choroplethColors({ rampId: DEFAULT_COLOR_RAMP, custom: [], opacity: 100 })
    ).toEqual(LEGEND_COLORS);
  });

  test('an unknown ramp falls back to the default', () => {
    expect(
      choroplethColors({ rampId: 'removida', custom: [], opacity: 100 })
    ).toEqual(LEGEND_COLORS);
  });

  test('the opacity rides in the colours as rgba', () => {
    const [lightest] = choroplethColors({
      rampId: 'azuis',
      custom: [],
      opacity: 60,
    });

    expect(lightest).toBe('rgba(198, 219, 239, 0.6)');
  });

  test("a built ramp is re-sampled to the scale's seven classes", () => {
    const colors = choroplethColors({
      rampId: 'minha',
      custom: [CUSTOM],
      opacity: 100,
    });

    expect(colors).toHaveLength(7);
    expect(colors[0]).toBe('#ffffff');
    expect(colors[3]).toBe('#ff0000');
    expect(colors[6]).toBe('#000000');
  });

  test('only the ramps the reader built can be removed', () => {
    const options = colorRampOptions([CUSTOM]);

    expect(
      options
        .filter((option) => {
          return option.removable;
        })
        .map((option) => {
          return option.id;
        })
    ).toEqual(['minha']);
  });
});

describe('settings tab', () => {
  test('holds the ramp and opacity controls, with the reader ramps listed', () => {
    const onCreateRamp = jest.fn();
    const onRemoveRamp = jest.fn();
    const settings = buildWorkspaceConfig({
      level: 'distrito',
      category: 'cumulative-total',
      group: '65',
      years: [2025],
      defaultYear: 2025,
      elderlyHistogram: [],
      colorSettings: { customRamps: [CUSTOM], onCreateRamp, onRemoveRamp },
      sidebarInitiallyOpen: true,
    }).leftSidebar?.sections?.find((section) => {
      return section.id === 'Configurações';
    });

    expect(settings?.enabledWhen).toBeUndefined();
    if (settings?.body.kind !== 'settings') {
      throw new Error('expected a settings body');
    }
    const [opacity, ramp] = settings.body.blocks;
    expect(ramp?.control).toMatchObject({
      kind: 'colorRamp',
      menuId: RAMP_MENU_ID,
      defaultValue: DEFAULT_COLOR_RAMP,
      onRemove: onRemoveRamp,
      create: { onCreate: onCreateRamp },
    });
    if (ramp?.control.kind !== 'colorRamp') {
      throw new Error('expected a colour-ramp control');
    }
    expect(
      ramp.control.options.map((option) => {
        return option.id;
      })
    ).toEqual(['azuis', 'verdes', 'laranjas', 'roxos', 'cinzas', 'minha']);
    expect(opacity?.control).toMatchObject({
      kind: 'slider',
      menuId: OPACITY_MENU_ID,
      min: 30,
      max: 100,
      defaultValue: 100,
      unit: '%',
    });
  });
});
