'use client';

import Link from 'next/link';
import { Plus, Globe, Lock, User } from 'lucide-react';
import { useSpaces } from '@/hooks/useSpaces';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { SpaceType } from '@/types';

const spaceTypeIcon: Record<string, React.ElementType> = {
  PUBLIC: Globe,
  PRIVATE: Lock,
  PERSONAL: User,
};

export default function SpacesPage() {
  const { data: spaces, isLoading, error } = useSpaces();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spaces</h1>
          <p className="text-muted-foreground mt-1">Your knowledge base workspaces</p>
        </div>
        <Link href="/spaces/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Space
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="mt-2 h-4 w-48 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load spaces. Please try again.
        </div>
      )}

      {spaces && spaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Globe className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No spaces yet</h3>
          <p className="mb-4 text-muted-foreground">Create your first space to get started.</p>
          <Link href="/spaces/new">
            <Button>Create Space</Button>
          </Link>
        </div>
      )}

      {spaces && spaces.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => {
            const Icon = spaceTypeIcon[space.type] || Globe;
            return (
              <Link key={space.id} href={`/spaces/${space.slug}`}>
                <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg">{space.name}</CardTitle>
                    </div>
                    {space.description && (
                      <CardDescription className="line-clamp-2">{space.description}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
