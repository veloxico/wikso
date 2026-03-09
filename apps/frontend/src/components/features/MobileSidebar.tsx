'use client';

import { useState } from 'react';
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden fixed top-3 left-3 z-40">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <div onClick={() => setOpen(false)}>
          {isAdminContext ? <AdminSidebar /> : <UnifiedSidebar />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
