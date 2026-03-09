'use client';

import { AdminSidebar } from '@/components/features/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Desktop admin sidebar */}
      <div className="hidden md:block">
        <AdminSidebar />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  );
}
