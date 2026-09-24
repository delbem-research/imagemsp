import { isOverlayId } from '@/config/overlays';

import { gateway } from '../../../../gateway';

/**
 * Serves one map overlay on demand. The map requests a layer only when the
 * reader turns it on in the "Camadas" control, so none of them weighs on the
 * page's initial payload.
 *
 * @param _request - Unused.
 * @param context.params - The `[layer]` segment, one of `OVERLAY_IDS`.
 * @returns The layer as a GeoJSON FeatureCollection, or 404 for an unknown id.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ layer: string }> }
) => {
  const { layer } = await params;

  if (!isOverlayId(layer)) {
    return Response.json(
      { error: `Unknown layer "${layer}"` },
      { status: 404 }
    );
  }

  const overlay = await gateway.getOverlay(layer);
  return Response.json(overlay);
};
