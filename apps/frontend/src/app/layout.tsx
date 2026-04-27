import type { Metadata } from 'next';
import { Inter, Source_Serif_4, JetBrains_Mono, Caveat } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/lib/providers';

/* ──────────────────────────────────────────────────────────────────
 * Fonts — direct port of the warm-paper design handoff.
 *
 *   Inter            — UI sans (default; user can swap to serif/mono
 *                      via the appearance store, which flips
 *                      `--ui-font` on :root).
 *   Source Serif 4   — body / document text (.wikso-editor) + page
 *                      titles (editorial feel for long-form reading).
 *   JetBrains Mono   — code blocks, inline code, breadcrumbs.
 *   Caveat           — handwritten accents (empty states, dashboard
 *                      hero subline). Used sparingly so it stays
 *                      special.
 *
 * Each is exposed as a `--font-*` CSS variable consumed by the design
 * tokens in globals.css (`--ui-font`, `--body-font`, `--mono-font`,
 * `--hand-font`).
 * ────────────────────────────────────────────────────────────────── */

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wikso',
  description: 'Wikso — modern wiki & knowledge base',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The fonts get registered as CSS variables on <body>. globals.css
  // then reads them into --ui-font / --body-font / --mono-font /
  // --hand-font (using next/font's `variable` field) — this two-step
  // hop lets the appearance store swap the UI font at runtime without
  // re-registering Google Fonts.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Default accent — `Providers` rehydrates the persisted user
      // preference and re-applies these data-attrs on mount, but we
      // ship a sensible default so the first paint isn't a flash of
      // the wrong colour.
      data-accent="terracotta"
      data-uifont="sans"
    >
      <head>
        {/* Bridge the next/font CSS variables into the design tokens
            globals.css consumes. Inlining here (not in globals.css)
            so the font URLs the next/font loader injects into <head>
            stay matched to these variable names. */}
        <style>{`
          :root {
            --ui-font: ${inter.style.fontFamily}, system-ui, sans-serif;
            --body-font: ${sourceSerif.style.fontFamily}, Georgia, serif;
            --mono-font: ${mono.style.fontFamily}, ui-monospace, monospace;
            --hand-font: ${caveat.style.fontFamily}, cursive;
          }
          :root[data-uifont="serif"] { --ui-font: ${sourceSerif.style.fontFamily}, Georgia, serif; }
          :root[data-uifont="mono"]  { --ui-font: ${mono.style.fontFamily}, ui-monospace, monospace; }
        `}</style>
      </head>
      <body
        className={`${inter.variable} ${sourceSerif.variable} ${mono.variable} ${caveat.variable} antialiased`}
      >
        {/* Suppress Hocuspocus WebSocket unhandled promise rejections in dev.
            Must run before Next.js devtools registers its onUnhandledRejection
            handler so stopImmediatePropagation prevents the dev overlay from
            showing "[object Object]" errors from internal reconnection logic. */}
        {process.env.NODE_ENV === 'development' && (
          <Script id="suppress-ws-rejections" strategy="beforeInteractive">{`
            window.addEventListener('unhandledrejection', function(e) {
              var r = e.reason;
              if (r && typeof r === 'object' && !(r instanceof Error) && !(r instanceof DOMException)) {
                e.stopImmediatePropagation();
                e.preventDefault();
              }
            });
          `}</Script>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
