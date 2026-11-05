'use client';

import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { useGeoVisProximitySearch } from '@ttoss/geovis';
import { useGeovisWorkspace } from '@ttoss/geovis-workspace';
import * as React from 'react';

import { Icon, ICONS } from '@/components/map/lib/icons';

import { NearbyNearest } from './NearbyNearest';
import NearbyPlaceList from './NearbyPlaceList';
import { NearbyTypeFilter } from './NearbyTypeFilter';
import {
  countByType,
  formatDistance,
  nearestByType,
  useNearbyTypeFilter,
} from './nearbyTypes';

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

/**
 * The map's right sidebar: the services the search around a pin found,
 * nearest first, in step with the pins it drops on the map — expanding a row
 * opens the place's card on the map, and clicking a pin there expands its
 * row. Its "Por tipo" chips narrow the list, and the pins on the map, to one
 * kind of place; above the list, "Mais próximos" names each kind's nearest
 * place with its distance and travel times. It opens with each new search and closes when the search
 * clears; its × only closes it, leaving the search on the map.
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
  const counts = React.useMemo(() => {
    return countByType(search?.results ?? []);
  }, [search?.results]);
  const { typeId, setTypeId } = useNearbyTypeFilter({ counts });
  // The overview of each kind's nearest place, while no kind is picked: with
  // one picked, the list below is already that kind, nearest first.
  const nearest = React.useMemo(() => {
    return typeId === null
      ? nearestByType({ results: search?.results ?? [], counts })
      : [];
  }, [typeId, search?.results, counts]);
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
            {search.fromPoint
              ? 'Busca a partir do ponto'
              : 'Busca a partir do pin'}
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
        {!pending && counts.length > 0 && (
          <NearbyTypeFilter
            counts={counts}
            typeId={typeId}
            onChange={setTypeId}
          />
        )}
      </Box>

      {/* The list scrolls without a visible bar. */}
      <Box
        data-nearby-scroll
        flex="1"
        minH="0"
        overflowY="auto"
        scrollbar="hidden"
      >
        {!pending && (
          <NearbyNearest
            nearest={nearest}
            onSelect={(id) => {
              // Opens the place's card; a row whose card is open stays open.
              if (search.selectedId !== id) search.select(id);
            }}
          />
        )}
        <NearbyPlaceList
          pending={pending}
          status={status}
          results={results}
          typeId={typeId}
          selectedId={selectedId}
          onSelect={search.select}
        />
      </Box>
    </Flex>
  );
};

export default NearbyServicesPanel;
