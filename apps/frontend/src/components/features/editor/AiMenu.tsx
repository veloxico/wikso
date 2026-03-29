'use client';

import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Sparkles,
  Expand,
  FileText,
  SpellCheck,
  MessageSquare,
  Pencil,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import { useAiTransform } from '@/hooks/useAiTransform';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useTranslation } from '@/hooks/useTranslation';

interface AiMenuProps {
  editor: Editor;
  pageId: string;
}

type AiOperation = 'expand' | 'summarize' | 'fix-grammar' | 'change-tone' | 'custom-prompt';

const OPERATIONS: {
  key: AiOperation;
  labelKey: string;
  icon: typeof Expand;
}[] = [
  { key: 'expand', labelKey: 'editor.ai.expand', icon: Expand },
  { key: 'summarize', labelKey: 'editor.ai.summarize', icon: FileText },
  { key: 'fix-grammar', labelKey: 'editor.ai.fixGrammar', icon: SpellCheck },
  {
    key: 'change-tone',
    labelKey: 'editor.ai.changeTone',
    icon: MessageSquare,
  },
];

export function AiMenu({ editor, pageId }: AiMenuProps) {
  const { t } = useTranslation();
  const { data: aiStatus } = useAiStatus();
  const { transform, isLoading, cancel } = useAiTransform();
  const [showOps, setShowOps] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPromptInput) {
      setTimeout(() => promptInputRef.current?.focus(), 50);
    }
  }, [showPromptInput]);

  if (!aiStatus?.aiEnabled) return null;

  const handleOperation = async (operation: AiOperation, prompt?: string) => {
    const { from, to } = editor.state.selection;
    const selection = editor.state.doc.textBetween(from, to, ' ');
    if (!selection.trim()) return;

    // Get surrounding context (paragraph before and after)
    const resolvedFrom = editor.state.doc.resolve(from);
    const parentStart = resolvedFrom.start();
    const parentEnd = resolvedFrom.end();
    const context = editor.state.doc.textBetween(
      Math.max(0, parentStart),
      Math.min(editor.state.doc.content.size, parentEnd),
      ' ',
    );

    setShowOps(false);
    setShowPromptInput(false);
    setCustomPrompt('');

    try {
      const result = await transform(pageId, selection, operation, context, prompt);
      if (result) {
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent(result)
          .run();
      }
    } catch {
      // error is handled in the hook
    }
  };

  const handleCustomPromptSubmit = () => {
    if (!customPrompt.trim()) return;
    handleOperation('custom-prompt', customPrompt.trim());
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomPromptSubmit();
    }
    if (e.key === 'Escape') {
      setShowPromptInput(false);
      setCustomPrompt('');
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'bottom-start' }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        if (!e.isEditable) return false;
        if (e.isActive('codeBlock')) return false;
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-1 py-0.5 shadow-lg">
        {isLoading ? (
          <>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>{t('editor.ai.loading')}</span>
            </div>
            <button
              type="button"
              onClick={cancel}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : showPromptInput ? (
          <div className="flex items-center gap-1">
            <input
              ref={promptInputRef}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder={t('editor.ai.customPromptPlaceholder') || 'Enter instruction...'}
              className="w-56 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleCustomPromptSubmit}
              disabled={!customPrompt.trim()}
              className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setShowPromptInput(false); setCustomPrompt(''); }}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : showOps ? (
          <>
            {OPERATIONS.map((op) => (
              <button
                key={op.key}
                type="button"
                onClick={() => handleOperation(op.key)}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors whitespace-nowrap"
                onMouseDown={(e) => e.preventDefault()}
              >
                <op.icon className="h-3.5 w-3.5" />
                {t(op.labelKey)}
              </button>
            ))}
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => { setShowOps(false); setShowPromptInput(true); }}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('editor.ai.customPrompt') || 'Custom...'}
            </button>
            <button
              type="button"
              onClick={() => setShowOps(false)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOps(true)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </button>
        )}
      </div>
    </BubbleMenu>
  );
}
