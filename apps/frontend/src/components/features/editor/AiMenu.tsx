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
      <div className="wp-bubble relative" data-chrome="bubble">
        {isLoading ? (
          <>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-[color:var(--ink-3)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--accent)]" />
              <span>{t('editor.ai.loading')}</span>
            </span>
            <button type="button" onClick={cancel} aria-label={t('common.cancel')}>
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : showPromptInput ? (
          <>
            <input
              ref={promptInputRef}
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder={t('editor.ai.customPromptPlaceholder') || 'Enter instruction...'}
              className="w-56"
            />
            <button
              type="button"
              onClick={handleCustomPromptSubmit}
              disabled={!customPrompt.trim()}
              className="wp-bubble-accent"
              onMouseDown={(e) => e.preventDefault()}
              aria-label={t('common.save')}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setShowPromptInput(false); setCustomPrompt(''); }}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={t('common.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : showOps ? (
          <>
            {OPERATIONS.map((op) => (
              <button
                key={op.key}
                type="button"
                onClick={() => handleOperation(op.key)}
                className="wp-bubble-text"
                onMouseDown={(e) => e.preventDefault()}
              >
                <op.icon className="h-3.5 w-3.5" />
                {t(op.labelKey)}
              </button>
            ))}
            <span className="sep" />
            <button
              type="button"
              onClick={() => { setShowOps(false); setShowPromptInput(true); }}
              className="wp-bubble-text wp-bubble-accent"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('editor.ai.customPrompt') || 'Custom...'}
            </button>
            <button
              type="button"
              onClick={() => setShowOps(false)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={t('common.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOps(true)}
            className="wp-bubble-text wp-bubble-accent"
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
