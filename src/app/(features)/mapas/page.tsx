import type { Metadata } from 'next';

import { pageOpenGraph } from '@/config/metadata';
import { gateway } from '@/gateway';

import { MapsView } from './_components/MapsView';

const TITLE = 'IMAGEM:SP Mapas — Visualizações demográficas de São Paulo';
const DESCRIPTION =
  'Explore no mapa indicadores do envelhecimento em São Paulo por distrito, subprefeitura e territórios de saúde, por faixa etária e ao longo dos anos.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: pageOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/mapas',
  }),
};

export default async function MapasPage() {
  const mapsData = await gateway.getMapsData();

  return <MapsView mapsData={mapsData} />;
}
