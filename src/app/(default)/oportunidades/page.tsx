import type { Metadata } from 'next';

import { pageOpenGraph } from '@/config/metadata';

import AccessibilityNote from './_components/AccessibilityNote';
import HowSelectionWorks from './_components/HowSelectionWorks';
import OfficialLinks from './_components/OfficialLinks';
import OportunidadesHero from './_components/OportunidadesHero';
import OpportunityList from './_components/OpportunityList';

export const metadata: Metadata = {
  title: 'Oportunidades — Vagas, bolsas e formas de colaboração | IMAGEM:SP',
  description:
    'Veja vagas, bolsas, oportunidades de treinamento técnico e formas de colaboração com o IMAGEM:SP, um atlas digital público sobre envelhecimento, território, dados e políticas públicas em São Paulo.',
  alternates: {
    canonical: '/oportunidades',
  },
  openGraph: pageOpenGraph({
    title: 'Oportunidades — Vagas, bolsas e formas de colaboração | IMAGEM:SP',
    description:
      'Veja vagas, bolsas, oportunidades de treinamento técnico e formas de colaboração com o IMAGEM:SP, um atlas digital público sobre envelhecimento, território, dados e políticas públicas em São Paulo.',
    path: '/oportunidades',
  }),
};

/**
 * Opportunities page — publishes open positions, scholarships, technical
 * training opportunities, and structured ways to express interest in joining
 * or collaborating with IMAGEM:SP.
 *
 * Content is driven entirely by the OPPORTUNITIES data array in `_data/opportunities.ts`.
 * No layout changes are needed when new positions open or close.
 *
 * @example
 * // Rendered at route /oportunidades
 */
export default function Page() {
  return (
    <>
      <OportunidadesHero />
      <OpportunityList />
      <HowSelectionWorks />
      <AccessibilityNote />
      <OfficialLinks />
    </>
  );
}
