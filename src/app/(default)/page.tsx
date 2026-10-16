import type { Metadata } from 'next';

import { pageOpenGraph } from '@/config/metadata';

import ClosingCtaSection from './_components/ClosingCtaSection';
import DataTrustSection from './_components/DataTrustSection';
import HeroSection from './_components/HeroSection';
import HowItWorksSteps from './_components/HowItWorksSteps';
import RevealQuestionCards from './_components/RevealQuestionCards';
import ThemeCards from './_components/ThemeCards';

export const metadata: Metadata = {
  title: 'IMAGEM:SP — Mapa Inteligente do Envelhecimento de São Paulo',
  description:
    'Plataforma pública para entender o envelhecimento em São Paulo pelo território, com dados sobre população idosa, serviços, mobilidade, saúde, moradia e condições urbanas.',
  openGraph: pageOpenGraph({
    title: 'IMAGEM:SP — Mapa Inteligente do Envelhecimento de São Paulo',
    description:
      'Plataforma pública para entender o envelhecimento em São Paulo pelo território, com dados sobre população idosa, serviços, mobilidade, saúde, moradia e condições urbanas.',
    path: '/',
  }),
};

/**
 * Homepage — three-act editorial sequence that reveals, explains, and builds
 * trust before routing users to the map.
 *
 * Act 1 — Revelation: Hero (project identity, map preview, primary CTAs).
 * Act 2 — Comprehension: territorial questions → eight thematic domains → how it works.
 * Act 3 — Trust: data provenance and methodology → institutional routing.
 *
 * Header and Footer are provided by DefaultLayout (default group layout).
 *
 * @example
 * // Rendered at route /
 */
export default function Page() {
  return (
    <>
      {/* Act 1 — Revelation */}
      <HeroSection />

      {/* Act 2 — Comprehension */}
      <RevealQuestionCards />
      <ThemeCards />
      <HowItWorksSteps />

      {/* Act 3 — Trust */}
      <DataTrustSection />
      <ClosingCtaSection />
    </>
  );
}
