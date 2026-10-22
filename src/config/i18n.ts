import type { I18nProvider } from '@ttoss/react-i18n';
import type * as React from 'react';

/**
 * The map's interface text comes from the `@ttoss/*` packages, written in
 * English and translated in their own catalogs. `pnpm i18n` (run on install)
 * merges those catalogs with `i18n/lang/pt-BR.json` — the translations the
 * packages lack — into `i18n/compiled/`, which this loads.
 */

/** The locale the map renders in. */
export const LOCALE = 'pt-BR';

type LoadLocaleData = NonNullable<
  React.ComponentProps<typeof I18nProvider>['loadLocaleData']
>;
type Messages = Awaited<ReturnType<LoadLocaleData>>;

/**
 * The compiled messages for a locale; empty for one without a catalog, which
 * then renders the packages' English defaults.
 *
 * @param locale - The locale `I18nProvider` asks for.
 * @returns The messages, keyed by id.
 *
 * @example
 * <I18nProvider locale={LOCALE} loadLocaleData={loadLocaleData} />
 */
export const loadLocaleData: LoadLocaleData = async (locale) => {
  if (locale !== LOCALE) return {};
  const { default: messages } = await import('../../i18n/compiled/pt-BR.json');
  // The JSON is typed loosely (`type: number`); it is the compiler's output,
  // so it has the shape react-intl reads.
  return messages as unknown as Messages;
};
