'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AiChatPanel } from './AiChatPanel';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Floating "Ask AI" button rendered in the dashboard layout. Toggles the
 * AiChatPanel slide-in sheet.
 */
export function AskAiButton() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('aiChat.askAiButton')}
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground shadow-lg transition hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Sparkles className="size-4" />
        <span className="hidden text-sm font-medium sm:inline">
          {t('aiChat.askAiButton')}
        </span>
      </button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
