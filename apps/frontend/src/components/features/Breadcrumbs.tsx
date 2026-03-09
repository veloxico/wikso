'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('breadcrumbs.ariaLabel')}
      className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}
    >
      <Link
        href="/spaces"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">{t('breadcrumbs.home')}</span>
      </Link>

      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href ? (
            <Link
              href={item.href}
              className="max-w-[200px] truncate hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="max-w-[200px] truncate text-foreground font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
