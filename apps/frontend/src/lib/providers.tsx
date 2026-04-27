'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useAppearanceStore } from '@/store/appearanceStore';

/**
 * Paper-stamp toast icons — replace Sonner's flat lucide checks/x's with
 * tiny `<span>` "rubber stamp" marks that match the warm-paper system.
 * Each is a circle with a hand-set glyph rotated a few degrees so it
 * reads as a real ink stamp rather than a generic notification icon.
 *
 * Color is sourced from the design tokens already exposed via
 * `[data-sonner-toaster]` (success → accent, error → danger). The 8°/
 * −6° rotations are deliberate; uniform alignment would feel synthetic.
 */
const StampIcon = ({ glyph, kind }: { glyph: string; kind: 'success' | 'error' | 'warn' | 'info' }) => (
  <span
    className={`wp-toast-stamp wp-toast-stamp-${kind}`}
    aria-hidden="true"
  >
    {glyph}
  </span>
);

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);
  const hydrateAppearance = useAppearanceStore((s) => s.hydrate);

  // Re-apply persisted appearance on first mount so the user's chosen
  // accent / font kicks in before any UI paints. Layout sets a sensible
  // default on <html> for SSR; this just upgrades it to the saved one.
  useEffect(() => {
    hydrateAuth();
    hydrateLanguage();
    hydrateAppearance();
  }, [hydrateAuth, hydrateLanguage, hydrateAppearance]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 1 minute "fresh" window matches the request rate of most
            // dashboard hooks. Adding gcTime so React Query actively
            // evicts unused query data after 10 minutes — protects
            // against the slow accumulation flagged in the leak audit
            // when users navigate through many pages with unique IDs.
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Default to system so the warm-paper light theme is the
          first-paint default for most users. The appearance store's
          accent/font preferences layer on top via data-* attrs. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <Toaster
          position="bottom-right"
          icons={{
            success: <StampIcon glyph="✓" kind="success" />,
            error: <StampIcon glyph="!" kind="error" />,
            warning: <StampIcon glyph="!" kind="warn" />,
            info: <StampIcon glyph="i" kind="info" />,
          }}
          toastOptions={{
            classNames: {
              toast: 'wp-toast',
              title: 'wp-toast-title',
              description: 'wp-toast-desc',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
