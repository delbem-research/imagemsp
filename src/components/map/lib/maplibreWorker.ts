import { setWorkerUrl } from 'maplibre-gl';

/*
 * maplibre-gl 6 finds its worker beside its own module, from `import.meta.url`.
 * Bundled into a `_next/static/chunks/` file, that module no longer sits next
 * to `maplibre-gl-worker.mjs`, so the guessed URL 404s and the map never
 * loads. The literal `new URL(…, import.meta.url)` makes webpack emit the
 * worker as an asset and hand back its served URL.
 *
 * Side-effect module: import it before anything creates a map.
 */
setWorkerUrl(
  new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href
);
