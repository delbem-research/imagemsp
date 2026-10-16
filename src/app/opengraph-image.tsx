import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

import {
  type DistrictCollection,
  districtPaths,
} from '@/components/og/districtPaths';
import { OG_IMAGE } from '@/config/metadata';

/**
 * The link preview image every route shares: what a social network shows when
 * a link to the site is pasted. Next prerenders it at build time. Pages that
 * declare their own `openGraph` name it through `pageOpenGraph`, since theirs
 * replaces the one this file would otherwise fill in.
 */

export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.type;

const INK = '#2F2D3A';
const INK_MUTED = '#625D68';
const AZURE = '#17629F';
const AZURE_TINT = '#C6E2FF';
const SURFACE = '#FAF7F2';

const MAP_WIDTH = 420;
const MAP_HEIGHT = 560;

const readFromRoot = (...segments: string[]) => {
  return readFile(join(process.cwd(), ...segments));
};

export default async function OpengraphImage() {
  const [logo, geojson, heading, headingSemi, body] = await Promise.all([
    readFromRoot('public', 'imagem-logo-completo-rgb.svg'),
    readFromRoot('public', 'distrito-municipal-v2.geojson'),
    readFromRoot('src', 'assets', 'og', 'Montserrat-ExtraBold.woff'),
    readFromRoot('src', 'assets', 'og', 'Montserrat-SemiBold.woff'),
    readFromRoot('src', 'assets', 'og', 'SourceSans3-Regular.woff'),
  ]);

  const paths = districtPaths({
    collection: JSON.parse(geojson.toString('utf8')) as DistrictCollection,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  });

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: SURFACE,
        padding: '56px 64px 56px 72px',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingRight: 40,
        }}
      >
        <img
          src={`data:image/svg+xml;base64,${logo.toString('base64')}`}
          width={284}
          height={120}
          alt=""
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: 'Montserrat',
              fontWeight: 800,
              fontSize: 58,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: INK,
            }}
          >
            Mapa Interativo do Envelhecimento de São Paulo
          </div>
          <div
            style={{
              marginTop: 24,
              fontFamily: 'Source Sans 3',
              fontSize: 28,
              lineHeight: 1.35,
              color: INK_MUTED,
            }}
          >
            Dados públicos sobre população idosa, serviços, mobilidade, saúde e
            moradia em cada território.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: AZURE,
              marginRight: 16,
            }}
          />
          <div
            style={{
              fontFamily: 'Montserrat',
              fontWeight: 600,
              fontSize: 24,
              color: AZURE,
            }}
          >
            imagemsp.triangulos.tech
          </div>
        </div>
      </div>

      <svg
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        style={{ alignSelf: 'center' }}
      >
        {paths.map((d) => {
          return (
            <path
              key={d}
              d={d}
              fill={AZURE_TINT}
              stroke={AZURE}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Montserrat', data: heading, weight: 800, style: 'normal' },
        { name: 'Montserrat', data: headingSemi, weight: 600, style: 'normal' },
        { name: 'Source Sans 3', data: body, weight: 400, style: 'normal' },
      ],
    }
  );
}
