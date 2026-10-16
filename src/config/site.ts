/**
 * Fixed project wordmark — the proper name of the project.
 * Not translated; rendered as-is in `Brand`.
 */
export const BRAND_NAME = 'IMAGEM:SP';

/**
 * Expo-out easing curve — the single motion primitive for the design system.
 * Registered as `easings.expoOut` in the Chakra theme.
 * Import here instead of re-declaring in each component.
 *
 * @example
 * transition={`all 0.3s ${EXPO_OUT}`}
 */
export const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

/**
 * Public origin of the site in production. Next resolves every relative
 * metadata URL — the Open Graph image, `og:url`, canonicals — against it, which
 * is what lets a social network fetch the link preview's image.
 */
export const SITE_URL = 'https://imagemsp.triangulos.tech';
