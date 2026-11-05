import type { LabelFormatSpec } from '@ttoss/geovis';

import type { Category } from '@/components/map/lib/indicators';
import type { MapLevel } from '@/components/map/lib/mapLevels';
import { isOfferCategory } from '@/config/offer';

/** A number as the legend and tooltip print it: pt-BR, at most two decimals. */
export const formatRate = (value: number): string => {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
};

/**
 * How the legend labels its classes. The population shares are fractions and
 * print as percentages; the offer rates are facilities per 10 thousand 65+
 * residents and print as plain numbers, with the first class — below a first
 * break set a hair above zero (see `config/thresholds`) — named for what it
 * holds: areas with none of the service.
 *
 * @param category - The indicator category painted.
 * @returns The legend's `labelFormat`.
 *
 * @example
 * legendLabelFormat('health-65plus'); // labels: 'nenhum', '< 1', '1 – 2', …, '> 8'
 */
export const legendLabelFormat = (category: Category): LabelFormatSpec => {
  if (!isOfferCategory(category)) {
    return { type: 'percentage', decimals: 0 };
  }

  return {
    type: 'custom',
    formatter: (lower, upper, index) => {
      if (index === 0) {
        return 'nenhum';
      }
      if (index === 1 && upper !== null) {
        return `< ${formatRate(upper)}`;
      }
      if (upper === null) {
        return `> ${formatRate(lower ?? 0)}`;
      }
      return `${formatRate(lower ?? 0)} – ${formatRate(upper)}`;
    },
  };
};

/** The sources the legend footer can name, each linked to its own site. */
const SOURCES = {
  seade:
    '{link:Seade|https://repositorio.seade.gov.br/dataset/populacao-residente-municipio-de-sao-paulo-evolucao}',
  geosampa: '{link:GeoSampa|https://geosampa.prefeitura.sp.gov.br}',
  openStreetMap: '{link:OpenStreetMap|https://www.openstreetmap.org/copyright}',
};

/**
 * Data-source attribution rendered under the legend swatches: only the
 * sources' names, each linked (`{link:text|url}`) — what the data is and how
 * it was aggregated is the legend's subtitle's and the catalogue's to say.
 *
 * - **Seade**, for the population series every indicator is drawn from.
 * - **GeoSampa**, while the map shows something of it: the subprefeitura and
 *   health polygons, an overlay, or an offer indicator, whose facilities come
 *   from its current mapping. The district polygons are not credited to it.
 * - **OpenStreetMap**, for the basemap: the spec sets
 *   `attributionControlEnabled: false` (see `BASE_SPEC` in `mapSpec`), and
 *   OpenFreeMap's tiles are OpenStreetMap data under the ODbL, whose
 *   attribution this footer gives instead. The two must change together.
 *
 * @param params.level - The geographic level painted.
 * @param params.overlays - Whether any overlay is on.
 * @param params.offer - Whether an offer indicator is painted.
 * @returns The reference line for the legend footer.
 *
 * @example
 * legendReference({ level: 'distrito', overlays: false, offer: false });
 * // 'Fonte: {link:Seade|…} · {link:OpenStreetMap|…}'
 */
export const legendReference = ({
  level,
  overlays,
  offer,
}: {
  level: MapLevel;
  overlays: boolean;
  offer: boolean;
}): string => {
  const geosampa = level !== 'distrito' || overlays || offer;
  const sources = [
    SOURCES.seade,
    geosampa ? SOURCES.geosampa : '',
    SOURCES.openStreetMap,
  ].filter(Boolean);
  return `Fonte: ${sources.join(' · ')}`;
};
