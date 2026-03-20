'use client';

import { usePathname } from 'next/navigation';
import { UnifiedSidebar } from '@/components/features/UnifiedSidebar';
import { MobileSidebar } from '@/components/features/MobileSidebar';
import { TopSearchBar } from '@/components/features/GlobalSearchDialog';
import { CommandPalette, useCommandPalette } from '@/components/features/CommandPalette';
import { ErrorBoundary } from '@/components/features/ErrorBoundary';
import { PageTransition } from '@/components/features/PageTransition';
import { NewPageButton } from '@/components/features/NewPageButton';

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

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar: search + new page */}
        {!isAdminContext && (
          <div className="flex items-center border-b border-border bg-background px-3 md:px-6 py-2 shrink-0">
            <div className="pl-10 md:pl-0 flex-1 min-w-0">
              <TopSearchBar />
            </div>
            <div className="ml-auto shrink-0">
              <NewPageButton />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-background">
          <ErrorBoundary>
            <PageTransition>
              {children}
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  );
}
