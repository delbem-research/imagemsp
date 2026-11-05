import type { OverlayConfig } from './overlays';

/**
 * The order the overlays are drawn in, bottom first: polygons, then heatmaps,
 * then lines, then points — a solid park never covers the cycle lane through
 * it, nor the heat of the crashes the lane or a facility. Within each
 * kind the control's order holds, read backwards — its first item draws on top
 * — which leaves the 22 thousand bus stops, last in the control, beneath the
 * other points instead of burying the hospitals.
 *
 * @param overlays - The overlays, in control order.
 * @returns The same overlays, in draw order.
 *
 * @example
 * overlayDrawOrder(OVERLAYS).map((overlay) => overlay.id);
 * // ['saude-familia', ..., 'parques', 'acidentes', 'ciclovias', 'pontos-onibus', ..., 'hospitais']
 */
export const overlayDrawOrder = (
  overlays: readonly OverlayConfig[]
): OverlayConfig[] => {
  const bottomFirst = [...overlays].reverse();

  return [
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'polygon';
    }),
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'heatmap';
    }),
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'line';
    }),
    ...bottomFirst.filter((overlay) => {
      return overlay.kind === 'point';
    }),
  ];
};
