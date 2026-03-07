'use client';

import { Sidebar } from '@/components/features/Sidebar';
import { MobileSidebar } from '@/components/features/MobileSidebar';
import { CommandPalette, useCommandPalette } from '@/components/features/CommandPalette';
import { ErrorBoundary } from '@/components/features/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open, setOpen } = useCommandPalette();

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar (hamburger) */}
      <MobileSidebar />

      <main className="flex-1 overflow-y-auto bg-background">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  );
}
