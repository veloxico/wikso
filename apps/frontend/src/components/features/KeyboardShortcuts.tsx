'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    description: string;
    keys: string[];
  }>;
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: t('shortcuts.editorFormatting'),
      shortcuts: [
        { description: t('shortcuts.bold'), keys: ['Ctrl', 'B'] },
        { description: t('shortcuts.italic'), keys: ['Ctrl', 'I'] },
        { description: t('shortcuts.underline'), keys: ['Ctrl', 'U'] },
        { description: t('shortcuts.strikethrough'), keys: ['Ctrl', 'Shift', 'X'] },
        { description: t('shortcuts.code'), keys: ['Ctrl', 'E'] },
        { description: t('shortcuts.link'), keys: ['Ctrl', 'K'] },
        { description: t('shortcuts.heading1'), keys: ['Ctrl', 'Alt', '1'] },
        { description: t('shortcuts.heading2'), keys: ['Ctrl', 'Alt', '2'] },
        { description: t('shortcuts.heading3'), keys: ['Ctrl', 'Alt', '3'] },
        { description: t('shortcuts.bulletList'), keys: ['Ctrl', 'Shift', '8'] },
        { description: t('shortcuts.orderedList'), keys: ['Ctrl', 'Shift', '7'] },
        { description: t('shortcuts.taskList'), keys: ['Ctrl', 'Shift', '9'] },
        { description: t('shortcuts.blockquote'), keys: ['Ctrl', 'Shift', 'B'] },
        { description: t('shortcuts.codeBlock'), keys: ['Ctrl', 'Alt', 'C'] },
        { description: t('shortcuts.horizontalRule'), keys: ['---'] },
        { description: t('shortcuts.undo'), keys: ['Ctrl', 'Z'] },
        { description: t('shortcuts.redo'), keys: ['Ctrl', 'Shift', 'Z'] },
      ],
    },
    {
      title: t('shortcuts.navigation'),
      shortcuts: [
        { description: t('shortcuts.commandPalette'), keys: ['Ctrl', 'K'] },
        { description: t('shortcuts.search'), keys: ['Ctrl', '/'] },
        { description: t('shortcuts.newPage'), keys: ['Ctrl', 'N'] },
      ],
    },
    {
      title: t('shortcuts.general'),
      shortcuts: [
        { description: t('shortcuts.keyboardShortcuts'), keys: ['Ctrl', '/'] },
        { description: t('shortcuts.save'), keys: ['Ctrl', 'S'] },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        </DialogHeader>
        {/* Each shortcut row uses the new `.wp-kbd` paper-stamp primitive
            instead of raw Tailwind. The keycap now carries a two-layer
            shadow + gradient that reads as "pressed into paper" — matches
            the rest of the warm-paper design language. Joiner "+" uses
            `.wp-kbd-joiner` so it sits on the UI font (not mono) and
            softens the visual weight between caps. */}
        <div className="space-y-6 py-2">
          {shortcutGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{group.title}</h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, shortcutIndex) => (
                  <div key={shortcutIndex} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="inline-flex items-center">
                          <kbd className="wp-kbd">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && <span className="wp-kbd-joiner">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          {t('shortcuts.openHint') || 'Open this dialog any time with'}{' '}
          <kbd className="wp-kbd">Ctrl</kbd>
          <span className="wp-kbd-joiner">+</span>
          <kbd className="wp-kbd">/</kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}
