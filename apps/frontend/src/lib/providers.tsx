'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateLanguage();
  }, [hydrateAuth, hydrateLanguage]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {children}
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
