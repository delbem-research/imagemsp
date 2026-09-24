import type { LabelFormatSpec } from '@ttoss/geovis';

import type { Category } from '@/components/map/lib/indicators';
import { MAP_LEVELS, type MapLevel } from '@/components/map/lib/mapLevels';

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
 * legendLabelFormat('offer-65plus'); // labels: 'nenhum', '< 1', '1 – 2', …, '> 8'
 */
export const legendLabelFormat = (category: Category): LabelFormatSpec => {
  if (category !== 'offer-65plus') {
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

/**
 * Data-source attribution rendered under the legend swatches. `reference`
 * supports an inline link with the `{link:text|url}` syntax, so the SEADE
 * source keeps its hyperlink, as does GeoSampa for the subprefeitura polygons
 * (the district geometry is plain text).
 *
 * It also carries the basemap credit, because the spec sets
 * `attributionControlEnabled: false` (see `buildSpec` in `MapsView`): OpenFreeMap serves
 * OpenStreetMap-derived tiles under the ODbL, whose attribution requirement
 * does not go away with MapLibre's own control. This is the surface where it is
 * satisfied instead, so the two must be changed together.
 *
 * The active year is interpolated rather than written into the text: with the
 * timeline driving eleven of them, a fixed year in the credit line would go on
 * naming 2025 while the map painted 2050. Every year in the series is a
 * projection — including the ones already past, which are the model's figures
 * for those years and not the censuses taken in them — so the wording says so
 * once, for the whole series.
 *
 * GeoSampa is credited only while the map shows something of it — an overlay,
 * or an offer indicator, whose facilities come from its current mapping — so
 * the footer never cites a source for something the map is not showing.
 *
 * The aggregation and geometry credits follow the level painted: the
 * subprefeitura polygons come from GeoSampa, the district ones do not.
 *
 * @param params.level - The geographic level painted.
 * @param params.year - The projection year currently painted.
 * @param params.years - The projection years available, ascending.
 * @param params.overlays - Whether any overlay is on.
 * @param params.offer - Whether an offer indicator is painted.
 * @returns The reference line for the legend footer.
 *
 * @example
 * legendReference({ level: 'distrito', year: 2025, years: [2000, 2050], overlays: false, offer: false });
 * // 'Fonte dos dados: ... projeção para 2025 (série 2000–2050) ...'
 */
export const legendReference = ({
  level,
  year,
  years,
  overlays,
  offer,
}: {
  level: MapLevel;
  year: number;
  years: number[];
  overlays: boolean;
  offer: boolean;
}): string => {
  const first = years[0] ?? year;
  const last = years[years.length - 1] ?? year;
  // "Equipamentos (rede atual)", "camadas sobrepostas", or both, credited once.
  const geosampaParts = [
    offer ? 'equipamentos (rede atual)' : '',
    overlays ? 'camadas sobrepostas' : '',
  ].filter(Boolean);
  const geosampaWhat = geosampaParts.join(' e ');
  const overlaysCredit =
    geosampaParts.length > 0
      ? ` ${geosampaWhat.charAt(0).toUpperCase()}${geosampaWhat.slice(1)}: {link:GeoSampa|https://geosampa.prefeitura.sp.gov.br}.`
      : '';

  const { dataCredit, geometryCredit } = MAP_LEVELS[level];

  return `Fonte dos dados: {link:${dataCredit} a partir das projeções populacionais por sexo e idade do SEADE|https://repositorio.seade.gov.br/dataset/populacao-residente-municipio-de-sao-paulo-evolucao} — projeção para ${year}, de uma série quinquenal que vai de ${first} a ${last}. Geometria: ${geometryCredit}. Mapa base: {link:OpenFreeMap|https://openfreemap.org/} · {link:OpenStreetMap|https://www.openstreetmap.org/copyright}.${overlaysCredit}`;
};
