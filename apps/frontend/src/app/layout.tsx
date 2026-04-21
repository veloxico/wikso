import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/lib/providers';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${geistMono.variable} antialiased`}>
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
