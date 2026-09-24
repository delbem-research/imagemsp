/**
 * GeoSampa's official district polygons (`distrito_municipal`, 1:5,000), for
 * the scripts that need to know which district a point lies in.
 *
 * The project draws a simplified district mesh (`public/distrito-municipal-v2.geojson`,
 * ~2 thousand vertices) that is fine to look at but wrong to measure against:
 * its neighbours leave slivers between them, some over 60 m wide, and its
 * borders drift off the real ones, so a point near a boundary can land in no
 * district or in the neighbour. The official mesh (~135 thousand vertices,
 * ~4 MB) has neither problem. It is downloaded at generation time and never
 * shipped to the browser.
 */
import { readFileSync } from 'node:fs';

import type { PolygonGeometry, Position, Ring } from './simplifyGeometry.ts';

const WFS =
  'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=geoportal:distrito_municipal';

const EXPECTED_DISTRICTS = 96;

/**
 * Folds a name for comparison: no accents, upper case, apostrophes and hyphens
 * read as spaces, runs of spaces collapsed. GeoSampa spells districts in
 * unaccented capitals (`JARDIM ANGELA`), the project as SEADE does
 * (`Jardim Ângela`).
 *
 * @param name - A district name as either side spells it.
 * @returns The comparison key.
 *
 * @example
 * foldName('Jardim Ângela'); // 'JARDIM ANGELA'
 */
export const foldName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

type District = {
  /** The district's name as the project spells it. */
  name: string;
  bbox: [number, number, number, number];
  polygons: Ring[][];
};

/** Ray-casting point-in-ring test. */
const inRing = ([x, y]: Position, ring: Ring): boolean => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as Position;
    const [xj, yj] = ring[j] as Position;

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

type OfficialFeature = {
  properties: { nm_distrito_municipal: string };
  geometry: PolygonGeometry;
};

/**
 * Turns one official feature into a district named as the project names it,
 * with its bounding box precomputed for the lookup's cheap first test.
 *
 * @param params.feature - A `distrito_municipal` feature.
 * @param params.projectNames - Folded name → project spelling.
 * @returns The district.
 * @throws If the feature's name matches no project district.
 */
const toDistrict = ({
  feature,
  projectNames,
}: {
  feature: OfficialFeature;
  projectNames: Map<string, string>;
}): District => {
  const officialName = feature.properties.nm_distrito_municipal;
  const name = projectNames.get(foldName(officialName));

  if (!name) {
    throw new Error(
      `[officialDistricts] GeoSampa district "${officialName}" matches no district of the project`
    );
  }

  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const outer = polygons.flatMap((polygon) => {
    return polygon[0] ?? [];
  });
  const xs = outer.map(([x]) => {
    return x;
  });
  const ys = outer.map(([, y]) => {
    return y;
  });

  return {
    name,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    polygons,
  };
};

/**
 * Whether a position lies in a district: inside its bounding box, then inside
 * one of its outer rings and none of that ring's holes.
 */
const contains = (district: District, position: Position): boolean => {
  const [x, y] = position;
  const [minX, minY, maxX, maxY] = district.bbox;

  if (x < minX || x > maxX || y < minY || y > maxY) {
    return false;
  }

  return district.polygons.some(([outerRing, ...holes]) => {
    return (
      outerRing !== undefined &&
      inRing(position, outerRing) &&
      !holes.some((hole) => {
        return inRing(position, hole);
      })
    );
  });
};

/**
 * Downloads the official districts and names them as the project does.
 *
 * @param mapsDataPath - The project's district snapshot, read for its names.
 * @returns A lookup from a coordinate to the district it lies in.
 * @throws Unless all 96 official districts match a project district by name.
 *
 * @example
 * const districtAt = await loadOfficialDistricts(MAPS_DATA);
 * districtAt([-46.655783, -23.54127602]); // 'Santa Cecília'
 */
export const loadOfficialDistricts = async (
  mapsDataPath: string
): Promise<(position: Position) => string | undefined> => {
  const snapshot = JSON.parse(readFileSync(mapsDataPath, 'utf8')) as {
    districts: { nome: string }[];
  };
  const projectNames = new Map(
    snapshot.districts.map((district) => {
      return [foldName(district.nome), district.nome] as const;
    })
  );

  const response = await fetch(WFS);

  if (!response.ok) {
    throw new Error(
      `[officialDistricts] GeoSampa answered ${response.status} for distrito_municipal`
    );
  }

  const { features } = (await response.json()) as {
    features: OfficialFeature[];
  };

  const districts = features.map((feature) => {
    return toDistrict({ feature, projectNames });
  });
  const names = new Set(
    districts.map((district) => {
      return district.name;
    })
  );

  if (names.size !== EXPECTED_DISTRICTS) {
    throw new Error(
      `[officialDistricts] expected ${EXPECTED_DISTRICTS} distinct districts, got ${names.size}`
    );
  }

  return (position) => {
    return districts.find((district) => {
      return contains(district, position);
    })?.name;
  };
};
