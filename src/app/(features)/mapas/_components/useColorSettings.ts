import * as React from 'react';

import {
  choroplethColors,
  type ColorRamp,
  DEFAULT_FILL_OPACITY,
} from '@/components/map/lib/colorRamps';
import type { ColorSettings } from '@/components/map/lib/settingsSection';

/**
 * The "Configurações" tab's state and what it paints with.
 *
 * The reader's own ramps live here: the ramp control reports a finished ramp
 * and leaves keeping it to the page, since the selection carries one string per
 * key and a ramp is a name and its colours. The chosen ramp and opacity travel
 * in the selection, as the controls publish them.
 *
 * @param params.ramp - The chosen ramp's id, from the selection.
 * @param params.opacity - The chosen opacity in percent, as the slider
 * publishes it (a string).
 * @returns The class colours to paint the choropleth with, and the tab's
 * ramps and handlers for `buildWorkspaceConfig`.
 */
export const useColorSettings = ({
  ramp,
  opacity,
}: {
  ramp: string;
  opacity: string;
}): { colors: string[]; colorSettings: ColorSettings } => {
  const [customRamps, setCustomRamps] = React.useState<ColorRamp[]>([]);

  const colors = React.useMemo(() => {
    return choroplethColors({
      rampId: ramp,
      custom: customRamps,
      opacity: Number(opacity) || DEFAULT_FILL_OPACITY,
    });
  }, [ramp, opacity, customRamps]);

  // Memoised on the ramps alone, so the sidebar config — which depends on it —
  // is rebuilt when a ramp is added or removed, not on every render.
  const colorSettings = React.useMemo<ColorSettings>(() => {
    return {
      customRamps,
      onCreateRamp: ({ option }) => {
        setCustomRamps((current) => {
          return [...current, option];
        });
      },
      onRemoveRamp: ({ id }) => {
        setCustomRamps((current) => {
          return current.filter((entry) => {
            return entry.id !== id;
          });
        });
      },
    };
  }, [customRamps]);

  return { colors, colorSettings };
};
