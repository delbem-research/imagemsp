import { Box, List, Stack, Text } from '@chakra-ui/react';
import type { Metadata } from 'next';

import Container from '@/components/ui/Container';
import { pageOpenGraph } from '@/config/metadata';

const TITLE = 'Política de Cookies — IMAGEM:SP';
const DESCRIPTION =
  'Política de cookies do IMAGEM:SP: tipos de cookies, finalidades e conformidade com a LGPD.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: pageOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/cookies',
  }),
};

/**
 * Cookie policy page — legal disclosure on cookie types, purpose, and LGPD compliance.
 *
 * Uses project text tokens throughout (`text.primary`, `text.muted`, `textStyle`).
 * Rendered inside `LegalLayout` (compact header, no nav, footer).
 *
 * @example
 * // Rendered at route /cookies
 */
export default function CookiesPage() {
  return (
    <Container>
      <Box maxW="100ch" mx="auto" py={{ base: 10, md: 16 }}>
        <Stack gap={10}>
          <Stack gap={2}>
            <Text as="h1" textStyle="h1" color="text.primary">
              Política de Cookies
            </Text>
            <Text textStyle="metadata" color="text.muted">
              Última atualização: maio de 2026
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              1. O que são cookies
            </Text>
            <Text>
              Cookies são pequenos arquivos de texto armazenados no seu
              dispositivo quando você visita um site. Eles permitem que o site
              reconheça o dispositivo em acessos posteriores e melhore a
              experiência de navegação.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              2. Cookies que utilizamos
            </Text>
            <Text>
              Esta Plataforma utiliza exclusivamente cookies essenciais —
              necessários para o funcionamento técnico do site. Não utilizamos
              cookies de rastreamento, publicidade ou análise comportamental de
              terceiros.
            </Text>
            <Stack
              gap={4}
              ps={4}
              borderLeftWidth="2px"
              borderColor="border.subtle"
            >
              <Stack gap={1}>
                <Text textStyle="body-sm" fontWeight="600" color="text.primary">
                  Cookies de sessão
                </Text>
                <Text textStyle="body-sm" color="text.secondary">
                  Mantêm o estado da navegação durante a visita. São apagados
                  automaticamente ao fechar o navegador.
                </Text>
              </Stack>
              <Stack gap={1}>
                <Text textStyle="body-sm" fontWeight="600" color="text.primary">
                  Cookies de preferência
                </Text>
                <Text textStyle="body-sm" color="text.secondary">
                  Armazenam configurações locais, como filtros e visualizações
                  selecionados pelo usuário. Persistem entre visitas no mesmo
                  dispositivo.
                </Text>
              </Stack>
            </Stack>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              3. Finalidade
            </Text>
            <Text>Os cookies essenciais servem para:</Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                Garantir a navegação entre páginas sem perda de contexto.
              </List.Item>
              <List.Item>
                Lembrar preferências de exibição (ex.: filtros ativos no mapa e
                nas tabelas).
              </List.Item>
              <List.Item>
                Assegurar o correto funcionamento de formulários.
              </List.Item>
            </List.Root>
            <Text>
              Não utilizamos esses dados para identificar usuários
              individualmente nem os compartilhamos com terceiros.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              4. Como gerenciar cookies
            </Text>
            <Text>
              Você pode configurar seu navegador para bloquear ou excluir
              cookies. Veja as instruções para os principais navegadores:
            </Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                <strong>Chrome:</strong> Configurações → Privacidade e segurança
                → Cookies e outros dados do site.
              </List.Item>
              <List.Item>
                <strong>Firefox:</strong> Configurações → Privacidade e
                Segurança → Cookies e dados de sites.
              </List.Item>
              <List.Item>
                <strong>Safari:</strong> Preferências → Privacidade → Gerenciar
                dados de sites.
              </List.Item>
              <List.Item>
                <strong>Edge:</strong> Configurações → Cookies e permissões de
                site → Gerenciar e excluir cookies.
              </List.Item>
            </List.Root>
            <Text>
              O bloqueio de cookies essenciais pode prejudicar o funcionamento
              de algumas funcionalidades da Plataforma.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              5. LGPD e proteção de dados
            </Text>
            <Text>
              Esta Plataforma está comprometida com os princípios da Lei Geral
              de Proteção de Dados (Lei nº 13.709/2018). Os cookies utilizados
              não coletam dados pessoais identificáveis. Para exercer seus
              direitos como titular de dados ou esclarecer dúvidas, utilize o
              formulário na página Contato.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text as="h2" textStyle="h4" color="text.primary">
              6. Atualizações desta política
            </Text>
            <Text>
              Esta política pode ser atualizada para refletir mudanças técnicas
              ou legais. A data de revisão será sempre indicada no topo da
              página. Recomendamos consulta periódica.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
