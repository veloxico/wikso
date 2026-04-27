import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shared page · Wikso',
  description: 'A page shared with you via Wikso.',
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className={fraunces.variable}>{children}</div>;
}
