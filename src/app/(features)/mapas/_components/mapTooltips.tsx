import { Box, Text } from '@chakra-ui/react';

import type {
  AgeGroup,
  Category,
  Group,
  OfferService,
} from '@/components/map/lib/indicators';
import { getBandIndex, LEGEND_COLORS } from '@/components/map/lib/mapConfig';
import { OFFER_LABELS } from '@/config/offer';
import type { MapDataRow } from '@/data-gateway/schema';

import { formatRate } from './mapLegend';

/** Card style shared by the district and point-layer hover tooltips. */
export const TOOLTIP_STYLE = {
  background: 'var(--chakra-colors-surface-raised)',
  color: 'var(--chakra-colors-text-primary)',
  border: '1px solid var(--chakra-colors-border-subtle)',
  borderRadius: 'var(--chakra-radii-md)',
  boxShadow: 'var(--chakra-shadows-md)',
  padding: 'var(--chakra-spacing-2) var(--chakra-spacing-3)',
  zIndex: 50,
};

/**
 * Generates dynamic tooltip text for a population-share series.
 *
 * @param category - The demographic category.
 * @param group - The age group.
 * @returns Descriptive text for the tooltip value line.
 */
const getTooltipText = (category: Category, group: AgeGroup): string => {
  const ageLabels: Record<AgeGroup, string> = {
    '65': '65+',
    '70': '70+',
    '75': '75+',
    '65-69': '65 a 69 anos',
    '70-74': '70 a 74 anos',
  };

  const contextLabels: Record<Exclude<Category, 'offer-65plus'>, string> = {
    'cumulative-total': 'do total',
    'cumulative-65plus': 'da pop 65+',
    '5year-65plus': 'da pop 65+',
  };

  if (category === 'offer-65plus') {
    return '';
  }

  return `População com idade ${ageLabels[group]} ${contextLabels[category]}`;
};

/**
 * The value and count lines of the tooltip, which read differently for a
 * population share (`18,7% …` / `(15.169 de 81.060 pessoas)`) and for an offer
 * rate (`1,4 UBS por 10 mil idosos` / `(3 UBS para 21.380 pessoas com 65+)`).
 *
 * @param params.row - The hovered area's row.
 * @param params.category - The indicator category.
 * @param params.group - The age band, or the service.
 * @returns The two lines' text; the second is `null` without counts.
 */
const tooltipLines = ({
  row,
  category,
  group,
}: {
  row: MapDataRow;
  category: Category;
  group: Group;
}): { value: string; counts: string | null } => {
  const hasCounts = row.count != null && row.totalCount != null;

  if (category === 'offer-65plus') {
    const labels = OFFER_LABELS[group as OfferService];
    const count = row.count ?? 0;

    return {
      value: `${formatRate(row.value)} ${labels.many} por 10 mil idosos`,
      counts: hasCounts
        ? `(${count.toLocaleString('pt-BR')} ${count === 1 ? labels.one : labels.many} para ${(row.totalCount ?? 0).toLocaleString('pt-BR')} pessoas com 65+)`
        : null,
    };
  }

  return {
    value: `${(row.value * 100).toFixed(1)}% ${getTooltipText(category, group as AgeGroup)}`,
    counts: hasCounts
      ? `(${(row.count ?? 0).toLocaleString('pt-BR')} de ${(row.totalCount ?? 0).toLocaleString('pt-BR')} pessoas)`
      : null,
  };
};

/**
 * The swatch beside the tooltip's value: the colour of the class the area is
 * painted in, or a neutral border tone when it has no row.
 *
 * @param params.row - The hovered area's row, when found.
 * @param params.thresholds - The active series' class breaks.
 * @returns A CSS colour.
 */
const swatchColorFor = ({
  row,
  thresholds,
}: {
  row: MapDataRow | undefined;
  thresholds: number[];
}): string => {
  const neutral = 'var(--chakra-colors-border-subtle)';

  return row
    ? (LEGEND_COLORS[getBandIndex({ value: row.value, thresholds })] ?? neutral)
    : neutral;
};

/**
 * Renders the tooltip content for an area feature — a district or a
 * subprefeitura.
 *
 * @param params.featureId - The feature ID from the hover event.
 * @param params.rowLookup - Map of geometryId to MapDataRow.
 * @param params.members - For an aggregated level, the districts each area
 * groups, listed under the figures so the reader knows the value is a sum.
 * @param params.category - Current selected category.
 * @param params.group - Current selected group.
 * @param params.thresholds - The active series' class breaks, so the swatch is
 * read off the same scale the layer is painted with.
 * @returns Tooltip JSX content.
 */
export const renderTooltipContent = ({
  featureId,
  rowLookup,
  members,
  category,
  group,
  thresholds,
}: {
  featureId: string | number;
  rowLookup: Map<number, MapDataRow>;
  members?: Map<number, string[]>;
  category: Category;
  group: Group;
  thresholds: number[];
}) => {
  const row = rowLookup.get(Number(featureId));
  const memberNames = members?.get(Number(featureId));
  const lines = row ? tooltipLines({ row, category, group }) : null;
  const swatchColor = swatchColorFor({ row, thresholds });

  return (
    <Box display="flex" flexDirection="column" gap="2" minWidth="200px">
      {/* Area name */}
      <Text fontWeight="bold" fontSize="md" lineHeight="tight">
        {row?.name ?? String(featureId)}
      </Text>

      {/* Value with color swatch */}
      {lines && (
        <Box display="flex" flexDirection="column" gap="1">
          <Box display="flex" alignItems="center" gap="2">
            <Box
              width="14px"
              height="14px"
              borderRadius="2px"
              flexShrink={0}
              bg={swatchColor}
            />
            <Text fontSize="xs" color="text.muted" lineHeight="tight">
              {lines.value}
            </Text>
          </Box>
          {lines.counts && (
            <Text fontSize="xs" color="text.muted" lineHeight="tight" pl="22px">
              {lines.counts}
            </Text>
          )}
        </Box>
      )}

      {memberNames && memberNames.length > 0 && (
        <Text
          fontSize="xs"
          color="text.muted"
          lineHeight="tight"
          maxWidth="260px"
        >
          Distritos: {memberNames.join(', ')}
        </Text>
      )}
    </Box>
  );
};
