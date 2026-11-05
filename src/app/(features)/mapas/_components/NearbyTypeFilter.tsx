'use client';

import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';

import { Icon, ICONS } from '@/components/map/lib/icons';

import type { NearbyTypeCount } from './nearbyTypes';

/**
 * The panel's "Por tipo" section: a bar split by how many places each overlay
 * holds, and a chip per overlay with its count. Picking a chip narrows the
 * list and the map's pins to that overlay — one at a time, picking it again
 * or "Mostrar todos" shows every place — and dims the others.
 */
export const NearbyTypeFilter = ({
  counts,
  typeId,
  onChange,
}: {
  counts: NearbyTypeCount[];
  /** The overlay the list is narrowed to, or `null` for every place. */
  typeId: string | null;
  onChange: (typeId: string | null) => void;
}) => {
  return (
    <Stack
      gap="2.5"
      pt="3"
      pb="3.5"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      <HStack justify="space-between" align="baseline" gap="2">
        <Text
          fontFamily="heading"
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
          color="text.muted"
        >
          Por tipo
        </Text>
        {typeId && (
          <HStack
            as="button"
            onClick={() => {
              onChange(null);
            }}
            gap="1"
            fontSize="xs"
            fontWeight="medium"
            color="brand.fg"
            cursor="pointer"
          >
            <Icon icon={ICONS.xBold} aria-hidden />
            Mostrar todos
          </HStack>
        )}
      </HStack>

      <Flex
        gap="0.5"
        h="2"
        borderRadius="full"
        overflow="hidden"
        bg="surface.inset"
        aria-hidden
      >
        {counts.map(({ overlay, count }) => {
          const dim = typeId !== null && typeId !== overlay.id;
          return (
            <Box
              key={overlay.id}
              title={`${overlay.label} · ${count}`}
              flex={`${count} 1 0`}
              bg={overlay.color}
              opacity={dim ? 0.4 : 1}
              transition="opacity 0.2s, flex-grow 0.4s"
            />
          );
        })}
      </Flex>

      <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="1.5">
        {counts.map(({ overlay, count }) => {
          const on = typeId === overlay.id;
          const dim = typeId !== null && !on;
          return (
            <HStack
              key={overlay.id}
              as="button"
              onClick={() => {
                onChange(on ? null : overlay.id);
              }}
              aria-pressed={on}
              title={`${overlay.label} · ${count}`}
              gap="1.5"
              h="7"
              pl="2.5"
              pr="1"
              borderRadius="full"
              borderWidth="1px"
              borderColor={on ? overlay.color : 'border.subtle'}
              bg={on ? `${overlay.color}1a` : 'surface.raised'}
              opacity={dim ? 0.4 : 1}
              cursor="pointer"
              transition="background 0.15s, border-color 0.15s, opacity 0.15s"
            >
              <Flex color={overlay.color} flexShrink={0}>
                <Icon icon={overlay.icon} aria-hidden />
              </Flex>
              <Text
                flex="1"
                minW="0"
                textAlign="left"
                fontSize="xs"
                fontWeight="medium"
                color="text.primary"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {overlay.label}
              </Text>
              <Flex
                flexShrink={0}
                minW="5"
                h="5"
                px="1.5"
                align="center"
                justify="center"
                borderRadius="full"
                bg={overlay.color}
                color="text.inverse"
                fontFamily="mono"
                fontSize="2xs"
                fontWeight="semibold"
              >
                {count}
              </Flex>
            </HStack>
          );
        })}
      </Grid>
    </Stack>
  );
};
