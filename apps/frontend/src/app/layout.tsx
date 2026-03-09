import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/lib/providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Dokka',
  description: 'Dokka — modern wiki & knowledge base',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
