import { Box, List, Stack, Text } from '@chakra-ui/react';
import type { Metadata } from 'next';

import Container from '@/components/ui/Container';
import { pageOpenGraph } from '@/config/metadata';

const TITLE = 'Termos de Uso — IMAGEM:SP';
const DESCRIPTION =
  'Termos de uso do IMAGEM:SP, mapa interativo do envelhecimento de São Paulo.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: pageOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/termos',
  }),
};

/** "Uso permitido" section — allowed uses and prohibitions. */
const TermosUsoSection = () => {
  return (
    <Stack gap={3}>
      <Text as="h2" textStyle="h4" color="text.primary">
        3. Uso permitido
      </Text>
      <Text>O usuário pode acessar e utilizar o conteúdo para:</Text>
      <List.Root ps={4} gap={2}>
        <List.Item>
          Pesquisa acadêmica e análise de políticas públicas.
        </List.Item>
        <List.Item>Jornalismo e comunicação de interesse público.</List.Item>
        <List.Item>Mobilização comunitária e uso educacional.</List.Item>
        <List.Item>
          Citação e reprodução parcial, desde que atribuída a fonte.
        </List.Item>
      </List.Root>
      <Text>É vedado:</Text>
      <List.Root ps={4} gap={2}>
        <List.Item>
          Uso comercial sem autorização expressa da equipe do projeto.
        </List.Item>
        <List.Item>
          Reprodução sistemática de conjuntos de dados para redistribuição sem
          acordo prévio.
        </List.Item>
        <List.Item>
          Qualquer uso que possa induzir o público a erro sobre a origem ou o
          significado dos dados.
        </List.Item>
      </List.Root>
    </Stack>
  );
};

/**
 * Terms of use page — governs access and use of the IMAGEM:SP platform.
 *
 * Uses project text tokens throughout (`text.primary`, `text.muted`, `textStyle`).
 * Rendered inside `LegalLayout` (compact header, no nav, footer).
 *
 * @example
 * // Rendered at route /termos
 */
const TermosPage = () => {
  return (
    <Container>
      <Box maxW="100ch" mx="auto" py={{ base: 10, md: 16 }}>
        <Stack gap={10}>
          <Stack gap={2}>
            <Text as="h1" textStyle="h1" color="text.primary">
              Termos de Uso
            </Text>
            <Text textStyle="metadata" color="text.muted">
              Última atualização: maio de 2026
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              1. Objeto e aceitação
            </Text>
            <Text>
              Os presentes Termos de Uso regem o acesso e a utilização da
              plataforma IMAGEM:SP (&quot;Plataforma&quot;), mantida no âmbito
              do Projeto IMAGEM:SP FAPESP. Ao acessar ou utilizar a Plataforma,
              o usuário declara ter lido, compreendido e concordado com estes
              Termos.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              2. Descrição da Plataforma
            </Text>
            <Text>
              A Plataforma é um atlas digital público de indicadores
              territoriais sobre o envelhecimento em São Paulo, desenvolvido
              para fins de pesquisa, transparência e políticas públicas baseadas
              em evidências. Disponibiliza mapas, indicadores, análises
              territoriais e documentação metodológica sobre a população idosa
              no município de São Paulo.
            </Text>
          </Stack>

          <TermosUsoSection />

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              4. Propriedade intelectual
            </Text>
            <Text>
              O conteúdo editorial, os textos analíticos e as visualizações
              desenvolvidas pela equipe do projeto estão licenciados sob
              Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), salvo
              indicação contrária. Os dados primários provenientes de fontes
              governamentais são de domínio público. O logotipo e a identidade
              visual do Programa IMAGEM:SP pertencem ao Ministério do
              Desenvolvimento e Assistência Social, Família e Combate à Fome
              (MDS).
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              5. Qualidade e limitações dos dados
            </Text>
            <Text>
              A Plataforma integra dados de fontes públicas sujeitos a
              limitações de cobertura, periodicidade e completude. As
              informações são fornecidas &quot;como estão&quot;, sem garantia de
              exatidão absoluta. A equipe emprega metodologias documentadas para
              coleta, validação e tratamento — o usuário deve considerar as
              notas metodológicas antes de usar os dados em publicações ou
              decisões.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              6. Limitação de responsabilidade
            </Text>
            <Text>
              A equipe do Projeto IMAGEM:SP não se responsabiliza por danos
              diretos ou indiretos decorrentes do uso ou da impossibilidade de
              uso da Plataforma, nem pela eventual incorreção de dados
              provenientes de fontes externas devidamente identificadas.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              7. Links externos
            </Text>
            <Text>
              A Plataforma pode conter links para sites de terceiros. Esses
              links são fornecidos apenas para conveniência e não implicam
              endosso de seu conteúdo.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              8. Modificações
            </Text>
            <Text>
              Estes Termos podem ser alterados a qualquer tempo. As alterações
              entram em vigor na data de sua publicação. O uso continuado da
              Plataforma após a publicação das alterações constitui aceitação
              dos novos Termos.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              9. Lei aplicável e foro
            </Text>
            <Text>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o
              foro da Comarca de São Paulo/SP para resolução de conflitos
              decorrentes deste instrumento.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              10. Contato
            </Text>
            <Text>
              Dúvidas e solicitações podem ser encaminhadas pelo formulário
              disponível na página Contato.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
};

export default TermosPage;
