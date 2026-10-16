import type { Metadata } from 'next';

import { pageOpenGraph } from '@/config/metadata';

import ContactEmailBlock from './_components/ContactEmailBlock';
import ContactHero from './_components/ContactHero';
import RelatedLinks from './_components/RelatedLinks';
import ScopeNotice from './_components/ScopeNotice';
import SubjectPrefixList from './_components/SubjectPrefixList';

const TITLE = 'Contato | IMAGEM:SP';
const DESCRIPTION =
  'Entre em contato com a equipe do IMAGEM:SP para dúvidas sobre o projeto, dados, parcerias, imprensa, acessibilidade e oportunidades.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/contato',
  },
  openGraph: pageOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/contato',
  }),
};

/**
 * Contact page — textual page for reaching the IMAGEM:SP team.
 *
 * No form, no captcha, no upload. One official email with subject prefixes
 * for manual triage, a response time estimate, a scope notice, and related
 * self-serve links.
 *
 * @example
 * // Rendered at route /contato
 */
export default function Page() {
  return (
    <>
      <ContactHero />
      <ContactEmailBlock />
      <SubjectPrefixList />
      <ScopeNotice />
      <RelatedLinks />
    </>
  );
}
