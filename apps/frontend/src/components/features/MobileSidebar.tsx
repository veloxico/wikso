'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UnifiedSidebar } from './UnifiedSidebar';
import { AdminSidebar } from './AdminSidebar';

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isAdminContext = pathname.startsWith('/admin');

  // Close the sheet only when clicking on navigation links (<a> tags),
  // not on interactive UI elements like buttons/dropdowns inside the sidebar.
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      setOpen(false);
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden fixed top-3 left-3 z-40">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto" showCloseButton={false}>
        <div onClick={handleClick} className="flex flex-col h-full">
          {isAdminContext ? <AdminSidebar /> : <UnifiedSidebar isMobile />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
