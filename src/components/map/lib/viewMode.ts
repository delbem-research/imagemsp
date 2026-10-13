import { ICONS } from '@/components/map/lib/icons';

/*
 * The 2D/3D view of the choropleth: the "Visualização" block of the
 * "Configurações" tab and the 3D adjustments nested under it.
 */

/** Menu id of the "Visualização" choice, in the selection record. */
export const VIEW_MENU_ID = 'view';

/** The two views the choice offers. */
export type MapView = '2d' | '3d';

/** The view the map opens on: flat, as every indicator reads. */
export const DEFAULT_VIEW: MapView = '2d';

/** Menu ids of the 3D adjustments, nested under the view choice. */
export const HEIGHT_MENU_ID = 'height';
export const EXTRUSION_SCALE_MENU_ID = 'extrusionScale';
export const PITCH_MENU_ID = 'pitch';
export const BEARING_MENU_ID = 'bearing';

/** The one dataset the height reads for now: every resident of the area. */
export const HEIGHT_TOTAL_POPULATION = 'populacao-total';

/**
 * The 3D adjustments' starting values: the top of the height ladder and the
 * steepest pitch, so the first 3D view shows the populations apart at once,
 * with the camera turned 20° to the left so the prisms show a side face.
 */
export const DEFAULT_EXTRUSION_SCALE = 5;
export const DEFAULT_PITCH = 60;
export const DEFAULT_BEARING = 340;

/** The heights the ladder offers, as multiples of the base height. */
const EXTRUSION_SCALES = [1, 2, 3, 4, 5];

/** The camera pitches offered, in degrees. */
const PITCHES = [30, 45, 60];

/**
 * Narrows a sidebar value to a known view.
 *
 * @param value - The value the choice reported.
 * @returns Whether `value` is a {@link MapView}.
 *
 * @example
 * isMapView('3d'); // true
 */
export const isMapView = (value: string | undefined): value is MapView => {
  return value === '2d' || value === '3d';
};

/**
 * The 3D adjustments, nested under the view choice and shown only while it is
 * `3d`: what the height represents, how tall it stands, and the camera's pitch
 * and rotation.
 *
 * "Altura representa" declares one dataset, so the workspace draws it as a
 * read-only card — it names what the height reads without offering a choice
 * that does not exist yet.
 *
 * @returns The sub-blocks of the "Visualização" block.
 */
const buildViewSubBlocks = () => {
  const only3d = { menuId: VIEW_MENU_ID, values: ['3d'] };

  return [
    {
      id: HEIGHT_MENU_ID,
      title: 'Altura representa',
      shownWhen: only3d,
      control: {
        kind: 'choice' as const,
        layout: 'list' as const,
        menuId: HEIGHT_MENU_ID,
        defaultValue: HEIGHT_TOTAL_POPULATION,
        options: [
          {
            value: HEIGHT_TOTAL_POPULATION,
            label: 'População total',
            sublabel: 'Residentes de todas as idades',
            icon: ICONS.usersThree,
            unit: 'habitantes',
          },
        ],
      },
    },
    {
      id: EXTRUSION_SCALE_MENU_ID,
      title: 'Altura das extrusões',
      shownWhen: only3d,
      control: {
        kind: 'slider' as const,
        menuId: EXTRUSION_SCALE_MENU_ID,
        defaultValue: DEFAULT_EXTRUSION_SCALE,
        stops: EXTRUSION_SCALES.map((scale) => {
          return { value: scale, label: `${scale}×` };
        }),
      },
    },
    {
      id: PITCH_MENU_ID,
      title: 'Inclinação da câmera',
      shownWhen: only3d,
      control: {
        kind: 'choice' as const,
        menuId: PITCH_MENU_ID,
        defaultValue: String(DEFAULT_PITCH),
        options: PITCHES.map((pitch) => {
          return { value: String(pitch), label: `${pitch}°` };
        }),
      },
    },
    {
      id: BEARING_MENU_ID,
      title: 'Rotação da câmera',
      hint: 'Arraste o disco para girar o mapa e ver as áreas de outros ângulos.',
      shownWhen: only3d,
      control: {
        kind: 'bearing' as const,
        menuId: BEARING_MENU_ID,
        defaultValue: DEFAULT_BEARING,
      },
    },
  ];
};

/**
 * The "Visualização" block: the map flat, or its areas lifted by their total
 * population, with the 3D adjustments nested under it (see
 * `buildViewSubBlocks`). Offered on every indicator: the height reads the
 * area's residents whatever the colour reads, so it means the same thing on
 * each of them.
 *
 * @returns The block for the "Configurações" tab's `settings` body.
 */
export const buildViewBlock = () => {
  return {
    id: VIEW_MENU_ID,
    title: 'Visualização',
    icon: ICONS.cube,
    control: {
      kind: 'choice' as const,
      menuId: VIEW_MENU_ID,
      defaultValue: DEFAULT_VIEW,
      options: [
        {
          value: '2d',
          label: '2D',
          sublabel: 'Plano',
          glyph: 'flat' as const,
        },
        {
          value: '3d',
          label: '3D',
          sublabel: 'População total',
          glyph: 'extruded' as const,
        },
      ],
    },
    subBlocks: buildViewSubBlocks(),
  };
};
