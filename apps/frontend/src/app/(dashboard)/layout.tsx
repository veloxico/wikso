'use client';

import { usePathname } from 'next/navigation';
import { UnifiedSidebar } from '@/components/features/UnifiedSidebar';
import { MobileSidebar } from '@/components/features/MobileSidebar';
import { CommandPalette, useCommandPalette } from '@/components/features/CommandPalette';
import { ErrorBoundary } from '@/components/features/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open, setOpen } = useCommandPalette();
  const pathname = usePathname();

  // Admin area has its own sidebar (AdminSidebar rendered in admin layout).
  // Everywhere else the unified sidebar handles all contexts.
  const isAdminContext = pathname.startsWith('/admin');

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar — unified for all non-admin pages */}
      {!isAdminContext && (
        <div className="hidden md:block">
          <UnifiedSidebar />
        </div>
      )}

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
