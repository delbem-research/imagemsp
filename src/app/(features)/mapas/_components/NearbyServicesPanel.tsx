'use client';

import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { type ProximityHit, useGeoVisProximitySearch } from '@ttoss/geovis';
import { useGeovisWorkspace } from '@ttoss/geovis-workspace';
import * as React from 'react';

import { Icon, ICONS } from '@/components/map/lib/icons';
import { isOpenAt } from '@/components/map/lib/openingHours';
import { OVERLAYS, type PointOverlayConfig } from '@/config/overlays';
import type { NearbyPoint } from '@/data-gateway/schema';

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

/** `350 m`, `1,2 km`. */
const formatDistance = (metres: number) => {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
};

/**
 * Rough travel times, in minutes, from the straight-line distance: the route
 * is taken as 30–40% longer, walked at 5 km/h or driven at 25 km/h plus two
 * minutes to park.
 */
const travelTimes = (metres: number) => {
  const km = metres / 1000;
  return {
    walk: Math.max(2, Math.round(km * 1.3 * 12)),
    car: Math.max(2, Math.round(km * 1.4 * 2.4 + 2)),
  };
};

/** The title and the line under it, for where the search stands. */
const headings = ({
  status,
  count,
  radius,
  pending,
}: {
  status: 'idle' | 'loading' | 'done';
  count: number;
  radius: string;
  pending: boolean;
}) => {
  // Shown only while the sidebar slides closed, once the search cleared.
  if (status === 'idle') {
    return {
      title: 'Nenhuma busca',
      sub: 'Clique num pin do mapa para buscar os serviços em volta.',
    };
  }
  if (pending) {
    return {
      title: 'Buscando serviços…',
      sub: `Consultando serviços no raio de ${radius}…`,
    };
  }
  const found = count
    ? `${count} ${count === 1 ? 'serviço' : 'serviços'}`
    : 'Nenhum serviço';
  if (status === 'loading') {
    return {
      title: `${found} em até ${radius}`,
      sub: `Ampliando a busca para ${radius}…`,
    };
  }
  return {
    title: `${found} em até ${radius}`,
    sub: count
      ? 'Ordenados do mais próximo ao mais distante'
      : 'Tente um raio maior',
  };
};

/** Opens the sidebar on each new search, and closes it when one clears. */
const useOpenWithSearch = () => {
  const search = useGeoVisProximitySearch();
  const { setRightSidebarOpen } = useGeovisWorkspace();
  const key = search?.origin ? search.origin.join(',') : null;
  React.useEffect(() => {
    setRightSidebarOpen({ open: key !== null });
  }, [key, setRightSidebarOpen]);
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

  // A pin clicked on the map expands its row: bring it into view.
  React.useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest' });
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
 * The map's right sidebar: the services the search around a pin found,
 * nearest first, in step with the pins it drops on the map — expanding a row
 * opens the place's card on the map, and clicking a pin there expands its
 * row. It opens with each new search and closes when the search clears; its ×
 * only closes it, leaving the search on the map.
 *
 * Mounted as the workspace's `rightSidebar.content`, so it reads the search
 * through `useGeoVisProximitySearch()` from inside the geovis provider.
 *
 * @returns The panel, or `null` when the spec carries no proximity search.
 *
 * @example
 * // In the workspace config:
 * rightSidebar: { content: NearbyServicesPanel }
 */
const NearbyServicesPanel = () => {
  useOpenWithSearch();
  const search = useGeoVisProximitySearch();
  const { setRightSidebarOpen } = useGeovisWorkspace();
  if (!search) return null;

  const { status, results, radius, selectedId } = search;
  // The first answer is still on its way: nothing to count or list yet.
  const pending = status === 'loading' && results.length === 0;
  const radiusLabel = formatDistance(radius);
  const { title, sub } = headings({
    status,
    count: results.length,
    radius: radiusLabel,
    pending,
  });

  return (
    <Flex
      as="aside"
      aria-label="Serviços na região"
      direction="column"
      w="full"
      h="full"
      bg="surface.raised"
      fontFamily="body"
    >
      <Box
        flexShrink={0}
        px="5"
        pt="4"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <HStack justify="space-between" align="flex-start" gap="3">
          <HStack
            gap="1.5"
            pt="1"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="brand.fg"
          >
            <Icon icon={ICONS.mapPin} aria-hidden />
            Busca a partir do pin
          </HStack>
          <Flex
            as="button"
            aria-label="Fechar painel"
            title="Fechar"
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              // Release focus before the sidebar hides itself (aria-hidden).
              event.currentTarget.blur();
              setRightSidebarOpen({ open: false });
            }}
            flexShrink={0}
            w="7"
            h="7"
            mt="-1"
            mr="-1.5"
            align="center"
            justify="center"
            borderRadius="md"
            color="text.muted"
            cursor="pointer"
            transition="color 0.15s, background 0.15s"
            _hover={{ color: 'text.primary', bg: 'surface.inset' }}
          >
            <Icon icon={ICONS.xBold} aria-hidden />
          </Flex>
        </HStack>
        <Text
          as="h2"
          mt="2"
          fontFamily="heading"
          fontSize="lg"
          fontWeight="semibold"
          lineHeight="short"
          color="text.primary"
        >
          {title}
        </Text>
        <Text mt="1" pb="3.5" fontSize="xs" color="text.muted">
          {sub}
        </Text>
      </Box>

      {/* The list scrolls without a visible bar. */}
      <Box flex="1" minH="0" overflowY="auto" scrollbar="hidden">
        {pending && <Skeleton />}
        {status === 'done' && results.length === 0 && (
          <Stack gap="2" px="5" py="5">
            <Text fontSize="sm" fontWeight="medium" color="text.primary">
              Nenhum serviço encontrado neste raio.
            </Text>
            <Text fontSize="xs" lineHeight="tall" color="text.muted">
              Aumente o raio da busca no seletor abaixo do círculo para ver
              serviços mais distantes.
            </Text>
          </Stack>
        )}
        {results.map((hit) => {
          return (
            <PlaceRow
              key={hit.id}
              hit={hit}
              expanded={selectedId === hit.id}
              onToggle={() => {
                search.select(hit.id);
              }}
            />
          );
        })}
      </Box>
    </Flex>
  );
};

export default NearbyServicesPanel;
