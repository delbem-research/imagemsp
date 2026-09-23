import { isPointLayerId } from '@/config/pointLayers';

import { gateway } from '../../../../gateway';

/**
 * Serves one map point layer on demand. The map requests a layer only when the
 * reader turns it on in the "Camadas" control, so none of them weighs on the
 * page's initial payload.
 *
 * @param _request - Unused.
 * @param context.params - The `[layer]` segment, one of `POINT_LAYER_IDS`.
 * @returns The layer as a GeoJSON FeatureCollection, or 404 for an unknown id.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ layer: string }> }
) => {
  const { layer } = await params;

  if (!isPointLayerId(layer)) {
    return Response.json(
      { error: `Unknown layer "${layer}"` },
      { status: 404 }
    );
  }

  const points = await gateway.getPoints(layer);
  return Response.json(points);
};
