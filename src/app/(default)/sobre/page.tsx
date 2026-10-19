import type { Metadata } from 'next';

import { pageOpenGraph } from '@/config/metadata';

import AboutCtaSection from './_components/AboutCtaSection';
import AboutHero from './_components/AboutHero';
import AudienceSection from './_components/AudienceSection';
import DifferenceSection from './_components/DifferenceSection';
import OriginSection from './_components/OriginSection';
import PrinciplesSection from './_components/PrinciplesSection';
import WhatIsSection from './_components/WhatIsSection';
import WhySection from './_components/WhySection';

export const metadata: Metadata = {
  title: 'Sobre o IMAGEM:SP — Mapa Inteligente do Envelhecimento de São Paulo',
  description:
    'Conheça o IMAGEM:SP, uma plataforma pública de inteligência territorial sobre o envelhecimento em São Paulo, criada para apoiar pesquisa, planejamento, políticas públicas e compreensão social.',
  openGraph: pageOpenGraph({
    title:
      'Sobre o IMAGEM:SP — Mapa Inteligente do Envelhecimento de São Paulo',
    description:
      'Conheça o IMAGEM:SP, uma plataforma pública de inteligência territorial sobre o envelhecimento em São Paulo, criada para apoiar pesquisa, planejamento, políticas públicas e compreensão social.',
    path: '/sobre',
  }),
};

/**
 * About page — institutional narrative for IMAGEM:SP.
 *
 * Explains what the project is, why it exists, who it serves, where it comes
 * from, and which principles guide it. Routes users to the map, methodology,
 * participation, and contact.
 *
 * @example
 * // Rendered at route /sobre
 */
export default function Page() {
  return (
    <>
      <AboutHero />
      <WhySection />
      <WhatIsSection />
      <DifferenceSection />
      <AudienceSection />
      <OriginSection />
      <PrinciplesSection />
      <AboutCtaSection />
    </>
  );
}
