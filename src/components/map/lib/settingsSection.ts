import {
  type ColorRamp,
  colorRampOptions,
  DEFAULT_COLOR_RAMP,
  DEFAULT_FILL_OPACITY,
  RAMP_BASE_COLORS,
} from '@/components/map/lib/colorRamps';
import { ICONS } from '@/components/map/lib/icons';
import type { buildViewBlock } from '@/components/map/lib/viewMode';

/** Menu ids of the "Configurações" tab's controls, in the selection record. */
export const RAMP_MENU_ID = 'ramp';
export const OPACITY_MENU_ID = 'opacity';

/**
 * The tab's section id, which is also its label: with no section declaring
 * `header.title`, geovis-workspace names each tab by its id (see the section ids
 * in `workspaceConfig`).
 */
const SETTINGS_SECTION_ID = 'Configurações';

/** What the "Configurações" tab needs from the page that keeps its state. */
export type ColorSettings = {
  /** The ramps the reader built; the page keeps them, as the control asks. */
  customRamps: ColorRamp[];
  /** Adds a ramp the reader finished in the editor. */
  onCreateRamp: (params: { option: ColorRamp }) => void;
  /** Drops a ramp the reader removed. */
  onRemoveRamp: (params: { id: string }) => void;
};

/**
 * The "Configurações" tab: how the choropleth is drawn, not what it shows — a
 * `settings` body, so none of it narrows the data. Three blocks: the view, flat
 * or extruded (`viewBlock`, see `viewMode`), the fill's opacity, for reading
 * the basemap and the overlays through it, then the ramp the classes are read
 * through (the shipped ones, plus any the reader builds).
 *
 * Never gated: every indicator is a choropleth on the same seven classes.
 * Both controls keep their own value once mounted and seed it from
 * `variables`, so the defaults here only cover a first mount.
 *
 * @param params.customRamps - The reader's ramps.
 * @param params.onCreateRamp - Keeps a ramp the reader built.
 * @param params.onRemoveRamp - Drops a ramp the reader removed.
 * @param params.viewBlock - The "Visualização" block, first in the tab.
 * @returns The section for `leftSidebar.sections`.
 */
export const buildSettingsSection = ({
  customRamps,
  onCreateRamp,
  onRemoveRamp,
  viewBlock,
}: ColorSettings & { viewBlock: ReturnType<typeof buildViewBlock> }) => {
  return {
    id: SETTINGS_SECTION_ID,
    header: { icon: ICONS.gearSix },
    body: {
      kind: 'settings' as const,
      blocks: [
        viewBlock,
        {
          id: OPACITY_MENU_ID,
          title: 'Opacidade',
          icon: ICONS.dropHalf,
          control: {
            kind: 'slider' as const,
            menuId: OPACITY_MENU_ID,
            // Floored at 30%: below it the classes stop reading apart.
            min: 30,
            max: 100,
            step: 5,
            defaultValue: DEFAULT_FILL_OPACITY,
            unit: '%',
            endLabels: ['Transparente', 'Opaco'] as [string, string],
            stepButtons: true,
          },
        },
        {
          id: RAMP_MENU_ID,
          title: 'Cor do mapa',
          icon: ICONS.palette,
          control: {
            kind: 'colorRamp' as const,
            menuId: RAMP_MENU_ID,
            defaultValue: DEFAULT_COLOR_RAMP,
            options: colorRampOptions(customRamps),
            // The editor builds a ramp as wide as the first option: the seven
            // classes every series has.
            create: { baseColors: RAMP_BASE_COLORS, onCreate: onCreateRamp },
            onRemove: onRemoveRamp,
          },
        },
      ],
    },
  };
};
