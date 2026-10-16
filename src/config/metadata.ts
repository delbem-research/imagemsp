import type { Metadata } from 'next';

import { BRAND_NAME } from './site';

/**
 * The link preview image, drawn by `app/opengraph-image.tsx` and served at
 * `url`. Social networks expect 1200 × 630.
 */
export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'IMAGEM:SP — Mapa Interativo do Envelhecimento de São Paulo, com os 96 distritos da cidade',
};

/**
 * Open Graph fields every page shares. Next merges `openGraph` shallowly — a
 * page that declares its own replaces the layout's whole object, the image
 * `app/opengraph-image.tsx` fills in included — so each page builds its own
 * through {@link pageOpenGraph}, which names the image again.
 */
const OPEN_GRAPH_DEFAULTS = {
  siteName: BRAND_NAME,
  locale: 'pt_BR',
  type: 'website',
  images: [OG_IMAGE],
};

/**
 * A page's Open Graph block: the shared defaults — the preview image among
 * them — plus its own title, description and URL.
 *
 * @param params.title - Title of the link preview.
 * @param params.description - Text under the title in the preview.
 * @param params.path - The page's path, resolved against `metadataBase`.
 * @returns The page's `openGraph` metadata.
 *
 * @example
 * pageOpenGraph({ title: 'Contato | IMAGEM:SP', description, path: '/contato' });
 */
export const pageOpenGraph = ({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): NonNullable<Metadata['openGraph']> => {
  return { ...OPEN_GRAPH_DEFAULTS, title, description, url: path };
};
