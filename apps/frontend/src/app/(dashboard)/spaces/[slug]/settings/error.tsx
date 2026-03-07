'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  useEffect(() => {
    console.error('Settings page error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold">Failed to load settings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message || 'Something went wrong while loading space settings.'}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push(`/spaces/${slug}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to space
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
