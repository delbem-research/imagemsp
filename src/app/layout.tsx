import type { Metadata } from 'next';
import {
  Atkinson_Hyperlegible,
  Montserrat,
  Source_Code_Pro,
  Source_Sans_3,
  Source_Serif_4,
} from 'next/font/google';

import { Providers } from './providers';

/**
 * Primary UI/body face — Source Sans 3.
 * Registered as CSS variable --font-sans consumed by the Chakra theme.
 */
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * Brand heading face — Montserrat.
 * Used for display, h1, h2 and all large brand-level titles.
 * Registered as --font-heading.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

/**
 * Editorial body face — Source Serif 4.
 * Used for institutional long-form text (About pages, editorial passages).
 * Registered as --font-editorial.
 */
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-editorial',
  display: 'swap',
  // Not preloaded: no page renders it on first paint, so a preload is fetched
  // and then flagged unused. It still loads, on demand, when text uses it.
  preload: false,
});

/**
 * Accessibility face — Atkinson Hyperlegible.
 * Used in data-text-size accessibility mode.
 * Registered as --font-atkinson.
 */
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
  // Not preloaded: only the accessibility mode reads it (see Source Serif 4).
  preload: false,
});

/**
 * Monospace / data face — Source Code Pro.
 * Used for code blocks, tabular data, metadata values, and IDs.
 * Registered as --font-mono.
 */
const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
  // Not preloaded: only a few data readouts use it, off most pages' first
  // paint (see Source Serif 4).
  preload: false,
});

export const metadata: Metadata = {
  title: 'IMAGEM:SP — Mapa Interativo do Envelhecimento',
  description:
    'Atlas digital de inteligência territorial sobre o envelhecimento em São Paulo. Dados públicos para apoiar compreensão, pesquisa, planejamento e políticas baseadas em evidências.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${montserrat.variable} ${sourceSerif.variable} ${atkinson.variable} ${sourceCodePro.variable}`}
    >
      <head>
        {/*
         * Flash-prevention: sets data-text-size before first paint so the correct
         * font-size is already applied when the browser lays out the page.
         * Runs synchronously in <head> — no React, no hydration wait.
         * try/catch guards against restricted localStorage in some private-browsing modes.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('IMAGEM:SP-text-size');if(s==='large'||s==='extra-large'){document.documentElement.setAttribute('data-text-size',s);}}catch(e){}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } } :root { --text-scale: 1; } html[data-text-size="large"] { --text-scale: 1.125; } html[data-text-size="extra-large"] { --text-scale: 1.25; }',
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
