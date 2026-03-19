'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/features/AdminSidebar';
import { useAuthStore } from '@/store/authStore';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && (!user || user.role !== 'ADMIN')) {
      router.replace('/');
    }
  }, [hydrated, user, router]);

  // Don't render admin content until we confirm user is admin
  if (!hydrated || !user || user.role !== 'ADMIN') {
    return null;
  }

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
