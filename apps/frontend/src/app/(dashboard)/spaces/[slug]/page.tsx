'use client';

import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useSpace } from '@/hooks/useSpaces';

export default function SpacePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: space } = useSpace(slug);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold">{space?.name || 'Space'}</h2>
        <p className="mt-2 text-muted-foreground">
          Select a page from the sidebar or create a new one.
        </p>
      </div>
    </div>
  );
}
