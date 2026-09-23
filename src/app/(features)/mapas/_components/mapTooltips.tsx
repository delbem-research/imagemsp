import { Box, Text } from '@chakra-ui/react';

import type { Category, Group } from '@/components/map/lib/indicators';
import { getBandIndex, LEGEND_COLORS } from '@/components/map/lib/mapConfig';
import type { MapDataRow } from '@/data-gateway/schema';

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
 * Generates dynamic tooltip text based on selected category and group.
 *
 * @param category - The demographic category.
 * @param group - The age group.
 * @returns Descriptive text for the tooltip value line.
 */
const getTooltipText = (category: Category, group: Group): string => {
  const ageLabels: Record<Group, string> = {
    '65': '65+',
    '70': '70+',
    '75': '75+',
    '65-69': '65 a 69 anos',
    '70-74': '70 a 74 anos',
  };

  const contextLabels: Record<Category, string> = {
    'cumulative-total': 'do total',
    'cumulative-65plus': 'da pop 65+',
    '5year-65plus': 'da pop 65+',
  };

  return `População com idade ${ageLabels[group]} ${contextLabels[category]}`;
};

/**
 * Renders the tooltip content for a district feature.
 *
 * @param params.featureId - The feature ID from the hover event.
 * @param params.rowLookup - Map of geometryId to MapDataRow.
 * @param params.category - Current selected category.
 * @param params.group - Current selected group.
 * @param params.thresholds - The active series' class breaks, so the swatch is
 * read off the same scale the layer is painted with.
 * @returns Tooltip JSX content.
 */
export const renderTooltipContent = ({
  featureId,
  rowLookup,
  category,
  group,
  thresholds,
}: {
  featureId: string | number;
  rowLookup: Map<number, MapDataRow>;
  category: Category;
  group: Group;
  thresholds: number[];
}) => {
  const row = rowLookup.get(Number(featureId));
  const bandIndex =
    row != null ? getBandIndex({ value: row.value, thresholds }) : null;
  const swatchColor =
    bandIndex != null
      ? LEGEND_COLORS[bandIndex]
      : 'var(--chakra-colors-border-subtle)';

  return (
    <Box display="flex" flexDirection="column" gap="2" minWidth="200px">
      {/* District name */}
      <Text fontWeight="bold" fontSize="md" lineHeight="tight">
        {row?.name ?? String(featureId)}
      </Text>

      {/* Value with color swatch */}
      {row && (
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
              {(row.value * 100).toFixed(1)}% {getTooltipText(category, group)}
            </Text>
          </Box>
          {row.count != null && row.totalCount != null && (
            <Text fontSize="xs" color="text.muted" lineHeight="tight" pl="22px">
              ({row.count.toLocaleString('pt-BR')} de{' '}
              {row.totalCount.toLocaleString('pt-BR')} pessoas)
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
