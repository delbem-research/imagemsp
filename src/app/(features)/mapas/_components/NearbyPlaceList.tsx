'use client';

import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import type { ProximityHit } from '@ttoss/geovis';
import * as React from 'react';

import { Icon, ICONS } from '@/components/map/lib/icons';
import { isOpenAt } from '@/components/map/lib/openingHours';
import { OVERLAYS, type PointOverlayConfig } from '@/config/overlays';
import type { NearbyPoint } from '@/data-gateway/schema';

import { formatDistance, travelTimes } from './nearbyTypes';

/** A place the search found, with what `/api/servicos` answered for it. */
type NearbyHit = ProximityHit & NearbyPoint;

/**
 * Whether a hit carries the route's fields: geovis hands back each result as
 * the query answered it, with its distance added, so the address and the
 * phone the route sends ride along.
 */
const isNearbyHit = (hit: ProximityHit): hit is NearbyHit => {
  return 'address' in hit && 'phone' in hit && 'hours' in hit && 'facts' in hit;
};

const POINT_OVERLAYS = OVERLAYS.filter(
  (config): config is PointOverlayConfig => {
    return config.kind === 'point';
  }
);

const overlayOf = (id: string | undefined) => {
  return POINT_OVERLAYS.find((config) => {
    return config.id === id;
  });
};

/** Placeholder rows while the first answer is awaited, fading out. */
const Skeleton = () => {
  return (
    <Stack gap="0" aria-hidden>
      {[1, 0.75, 0.5, 0.3].map((opacity) => {
        return (
          <HStack
            key={opacity}
            gap="3"
            px="5"
            py="3.5"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            opacity={opacity}
            align="flex-start"
          >
            <Box w="8" h="8" borderRadius="md" bg="surface.inset" />
            <Stack flex="1" gap="2" pt="1">
              <Box w="40%" h="2" borderRadius="sm" bg="surface.inset" />
              <Box w="80%" h="2.5" borderRadius="sm" bg="surface.inset" />
            </Stack>
          </HStack>
        );
      })}
    </Stack>
  );
};

/** One labelled line of a place's details. */
const Detail = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  return (
    <>
      <Text
        fontSize="2xs"
        letterSpacing="wider"
        textTransform="uppercase"
        color="text.muted"
      >
        {label}
      </Text>
      <Box fontSize="xs" lineHeight="short" color="text.primary">
        {children}
      </Box>
    </>
  );
};

/**
 * Open or closed right now, from the place's opening hours; nothing for a
 * place without hours the panel can read — most layers have none.
 */
const OpenStatus = ({ hours }: { hours: string }) => {
  const open = isOpenAt({ hours, at: new Date() });
  if (open === null) return null;
  const color = open ? 'state.success.fg' : 'state.warning.fg';
  return (
    <>
      <span aria-hidden>·</span>
      <HStack as="span" gap="1" color={color} whiteSpace="nowrap">
        <Box as="span" w="1.5" h="1.5" borderRadius="full" bg={color} />
        {open ? 'Aberto agora' : 'Fechado agora'}
      </HStack>
    </>
  );
};

/**
 * The expanded part of a row: everything the source says about the place —
 * its type, spaces, line… — then its address, hours, phone and how far it is.
 */
const PlaceDetails = ({ hit }: { hit: ProximityHit }) => {
  const { walk, car } = travelTimes(hit.distance);
  const nearby = isNearbyHit(hit) ? hit : null;
  return (
    <Grid
      templateColumns="5.5rem 1fr"
      columnGap="2.5"
      rowGap="1.5"
      alignItems="baseline"
      pl="16"
      pr="5"
      pb="4"
    >
      {nearby?.facts.map(({ label, value }) => {
        return (
          <Detail key={label} label={label}>
            {value}
          </Detail>
        );
      })}
      {nearby?.address && <Detail label="Endereço">{nearby.address}</Detail>}
      {nearby?.hours && <Detail label="Horário">{nearby.hours}</Detail>}
      {nearby?.phone && (
        <Detail label="Telefone">
          <Text as="span" fontFamily="mono">
            {nearby.phone}
          </Text>
        </Detail>
      )}
      <Detail label="Trajeto">
        <Flex wrap="wrap" columnGap="2.5" rowGap="1">
          <HStack as="span" gap="1">
            <Icon icon={ICONS.personSimpleWalk} aria-hidden />
            {walk} min a pé
          </HStack>
          <HStack as="span" gap="1">
            <Icon icon={ICONS.car} aria-hidden />
            {car} min de carro
          </HStack>
        </Flex>
      </Detail>
    </Grid>
  );
};

/**
 * One place: its overlay, name and distance — and whether it is open, when
 * its hours are known — expanding into its details.
 */
const PlaceRow = ({
  hit,
  expanded,
  onToggle,
}: {
  hit: ProximityHit;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const overlay = overlayOf(hit.categoryId);
  const color = overlay?.color ?? 'var(--chakra-colors-text-muted)';
  const hours = isNearbyHit(hit) ? hit.hours : '';
  const ref = React.useRef<HTMLDivElement>(null);

  // An expanded row — opened here or from its pin on the map — scrolls to the
  // top of the list, its details in view below it. Only the list scrolls: the
  // page around it, which `scrollIntoView` would move too, stays put.
  React.useEffect(() => {
    const row = ref.current;
    if (!expanded || !row) return;
    const list = row.closest<HTMLElement>('[data-nearby-scroll]');
    if (!list) return;
    const top =
      list.scrollTop +
      row.getBoundingClientRect().top -
      list.getBoundingClientRect().top;
    list.scrollTo({ top, behavior: 'smooth' });
  }, [expanded]);

  return (
    <Box
      ref={ref}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg={expanded ? 'surface.inset' : 'transparent'}
      transition="background 0.15s"
    >
      <HStack
        as="button"
        onClick={onToggle}
        aria-expanded={expanded}
        w="full"
        gap="3"
        px="5"
        py="3.5"
        align="flex-start"
        textAlign="left"
        cursor="pointer"
        _hover={{ bg: 'surface.inset' }}
      >
        <Flex
          flexShrink={0}
          w="8"
          h="8"
          align="center"
          justify="center"
          borderRadius="md"
          bg={color}
          color="text.inverse"
        >
          {overlay && <Icon icon={overlay.icon} aria-hidden />}
        </Flex>
        <Stack flex="1" minW="0" gap="0.5">
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wider"
            textTransform="uppercase"
            color={color}
          >
            {overlay?.label}
          </Text>
          <Text
            fontSize="sm"
            fontWeight="medium"
            lineHeight="short"
            color="text.primary"
          >
            {hit.name}
          </Text>
          <HStack gap="2" mt="0.5" fontSize="xs" color="text.muted">
            <Text
              as="span"
              whiteSpace="nowrap"
              fontFamily="mono"
              color="text.primary"
            >
              {formatDistance(hit.distance)}
            </Text>
            {hours && <OpenStatus hours={hours} />}
          </HStack>
        </Stack>
        <Flex
          flexShrink={0}
          pt="2"
          color="text.muted"
          transition="transform 0.2s"
          transform={expanded ? 'rotate(180deg)' : 'none'}
        >
          <Icon icon={ICONS.caretDown} aria-hidden />
        </Flex>
      </HStack>
      {expanded && <PlaceDetails hit={hit} />}
    </Box>
  );
};

/**
 * The panel's list: placeholder rows while the first answer is awaited, a
 * note when the radius holds nothing, else the places nearest first —
 * narrowed to `typeId` when a type is picked.
 */
const NearbyPlaceList = ({
  pending,
  status,
  results,
  typeId,
  selectedId,
  onSelect,
}: {
  pending: boolean;
  status: 'idle' | 'loading' | 'done';
  results: ProximityHit[];
  /** The overlay the list is narrowed to, or `null` for every place. */
  typeId: string | null;
  selectedId: string | number | null;
  onSelect: (id: string | number) => void;
}) => {
  if (pending) return <Skeleton />;
  if (status === 'done' && results.length === 0) {
    return (
      <Stack gap="2" px="5" py="5">
        <Text fontSize="sm" fontWeight="medium" color="text.primary">
          Nenhum serviço encontrado neste raio.
        </Text>
        <Text fontSize="xs" lineHeight="tall" color="text.muted">
          Aumente o raio da busca no seletor abaixo do círculo para ver serviços
          mais distantes.
        </Text>
      </Stack>
    );
  }
  return (
    <>
      {results
        .filter((hit) => {
          return typeId === null || hit.categoryId === typeId;
        })
        .map((hit) => {
          return (
            <PlaceRow
              key={hit.id}
              hit={hit}
              expanded={selectedId === hit.id}
              onToggle={() => {
                onSelect(hit.id);
              }}
            />
          );
        })}
    </>
  );
};

export default NearbyPlaceList;
