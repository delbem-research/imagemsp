'use client';

import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type * as React from 'react';

import { Icon, ICONS } from '@/components/map/lib/icons';

import { formatDistance, type NearestOfType, travelTimes } from './nearbyTypes';

/** A small uppercase heading, as the panel's sections use. */
const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  return (
    <Text
      px="5"
      pt="3.5"
      pb="1.5"
      fontFamily="heading"
      fontSize="2xs"
      fontWeight="semibold"
      letterSpacing="widest"
      textTransform="uppercase"
      color="text.muted"
    >
      {children}
    </Text>
  );
};

/** One overlay's nearest place: its kind, name, distance and travel times. */
const NearestRow = ({
  nearest,
  onSelect,
}: {
  nearest: NearestOfType;
  onSelect: () => void;
}) => {
  const { overlay, hit } = nearest;
  const { walk, car } = travelTimes(hit.distance);
  return (
    <HStack
      as="button"
      onClick={onSelect}
      title={`${overlay.label}: ${hit.name}`}
      w="full"
      gap="2.5"
      px="5"
      py="2"
      align="center"
      textAlign="left"
      cursor="pointer"
      _hover={{ bg: 'surface.inset' }}
    >
      <Flex
        flexShrink={0}
        w="6"
        h="6"
        align="center"
        justify="center"
        borderRadius="md"
        bg={overlay.color}
        color="text.inverse"
        fontSize="xs"
      >
        <Icon icon={overlay.icon} aria-hidden />
      </Flex>
      <Stack flex="1" minW="0" gap="0">
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="wider"
          textTransform="uppercase"
          color={overlay.color}
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {overlay.label}
        </Text>
        <Text
          fontSize="xs"
          fontWeight="medium"
          color="text.primary"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {hit.name}
        </Text>
      </Stack>
      <Stack flexShrink={0} gap="0" align="flex-end" fontSize="2xs">
        <Text fontFamily="mono" fontSize="xs" color="text.primary">
          {formatDistance(hit.distance)}
        </Text>
        <HStack gap="1.5" color="text.muted" whiteSpace="nowrap">
          <HStack as="span" gap="0.5">
            <Icon icon={ICONS.personSimpleWalk} aria-hidden />
            {walk} min
          </HStack>
          <HStack as="span" gap="0.5">
            <Icon icon={ICONS.car} aria-hidden />
            {car} min
          </HStack>
        </HStack>
      </Stack>
    </HStack>
  );
};

/**
 * The panel's "Mais próximos" section: the nearest place of each kind found,
 * one row per kind with its distance and the time on foot and by car — the
 * overview of what is around, before the full list. Clicking a row opens the
 * place's card on the map and expands its row in the list below.
 */
export const NearbyNearest = ({
  nearest,
  onSelect,
}: {
  /** Each kind's nearest place, as `nearestByType` finds them. */
  nearest: NearestOfType[];
  onSelect: (id: string | number) => void;
}) => {
  if (nearest.length === 0) return null;
  return (
    <Box borderBottomWidth="1px" borderColor="border.subtle">
      <SectionTitle>Mais próximos de cada tipo</SectionTitle>
      <Stack gap="0" pb="2">
        {nearest.map((item) => {
          return (
            <NearestRow
              key={item.overlay.id}
              nearest={item}
              onSelect={() => {
                onSelect(item.hit.id);
              }}
            />
          );
        })}
      </Stack>
      <SectionTitle>Todos os serviços</SectionTitle>
    </Box>
  );
};
