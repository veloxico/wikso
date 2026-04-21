'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  type KeyboardEvent,
} from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { GitBranch, Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';

/* --------------------------------------------------------------------------
 * Mermaid singleton — module-level so initialize() only runs once per tab.
 * The module is dynamically imported on first render to keep the ~800 kB
 * mermaid bundle out of the main chunk.
 * ------------------------------------------------------------------------*/
type MermaidModule = typeof import('mermaid')['default'];

let mermaidPromise: Promise<MermaidModule> | null = null;
let currentTheme: 'dark' | 'default' | null = null;

async function loadMermaid(theme: 'dark' | 'default'): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default);
  }
  const mermaid = await mermaidPromise;
  if (currentTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
    currentTheme = theme;
  }
  return mermaid;
}

const DEBOUNCE_MS = 300;

export function MermaidNodeView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const code = (node.attrs.code as string) ?? '';
  const isEditable = editor?.isEditable ?? true;

  const [localCode, setLocalCode] = useState(code);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  // Keep a stable id for the render target to avoid DOM collisions.
  const uniqueId = useId().replace(/:/g, '_');
  const renderIdPrefix = `mermaid_${uniqueId}`;
  const renderCounterRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reactive dark-mode tracking so preview re-renders with the right palette.
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false,
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Propagate external changes (e.g. remote collaborators) into the textarea.
  useEffect(() => {
    setLocalCode((prev) => (prev === code ? prev : code));
  }, [code]);

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const renderDiagram = useCallback(
    async (source: string) => {
      const trimmed = source.trim();
      if (!trimmed) {
        setSvgOutput('');
        setRenderError(null);
        return;
      }
      try {
        const mermaid = await loadMermaid(isDark ? 'dark' : 'default');
        renderCounterRef.current += 1;
        const currentId = `${renderIdPrefix}_${renderCounterRef.current}`;
        const { svg } = await mermaid.render(currentId, trimmed);
        // mermaid leaves a hidden element behind — remove it to keep the DOM clean.
        const leftover = typeof document !== 'undefined'
          ? document.getElementById(currentId)
          : null;
        if (leftover) leftover.remove();
        const sanitized = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        setSvgOutput(sanitized);
        setRenderError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRenderError(message);
        setSvgOutput('');
        if (typeof document !== 'undefined') {
          const currentId = `${renderIdPrefix}_${renderCounterRef.current}`;
          const leftover = document.getElementById(currentId);
          if (leftover) leftover.remove();
        }
      }
    },
    [isDark, renderIdPrefix],
  );

  // Render whenever the code attribute or theme changes.
  useEffect(() => {
    renderDiagram(code);
  }, [code, renderDiagram]);

  const handleCodeChange = useCallback(
    (next: string) => {
      setLocalCode(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateAttributes({ code: next });
      }, DEBOUNCE_MS);
    },
    [updateAttributes],
  );

  // Prevent ProseMirror from intercepting typing/navigation inside the textarea.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  }, []);

  // Read-only (published page) path: only render the SVG.
  if (!isEditable) {
    return (
      <NodeViewWrapper
        className="mermaid-node mermaid-node--readonly rounded-lg border border-border bg-muted/30 my-4 overflow-hidden"
        data-type="mermaid-block"
      >
        <div className="flex items-center justify-center p-4 min-h-[80px] overflow-auto">
          {renderError ? (
            <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-semibold">
                {t('mermaid.renderError')}
              </span>
              : {renderError}
            </div>
          ) : svgOutput ? (
            <div
              className="mermaid-node__svg max-w-full"
              // svgOutput is already sanitized with DOMPurify's SVG profile above.
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="mermaid-node rounded-lg border border-border bg-muted/30 my-4 overflow-hidden"
      data-type="mermaid-block"
      data-drag-handle
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground select-none">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{t('mermaid.previewTitle')}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={deleteNode}
          title={t('common.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Split view: source (left) + preview (right) */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="flex flex-col">
          <textarea
            className={cn(
              'min-h-[180px] w-full resize-y bg-card px-3 py-2',
              'font-mono text-xs leading-relaxed text-foreground',
              'outline-none border-0 focus:ring-0',
            )}
            value={localCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('mermaid.editPlaceholder')}
            spellCheck={false}
            aria-label={t('mermaid.editPlaceholder')}
          />
        </div>

        <div className="relative flex flex-col">
          <div className="flex flex-1 items-center justify-center overflow-auto p-3 min-h-[180px]">
            {renderError ? (
              <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <div className="font-semibold mb-0.5">
                  {t('mermaid.renderError')}
                </div>
                <div className="whitespace-pre-wrap break-words opacity-90">{renderError}</div>
              </div>
            ) : svgOutput ? (
              <div
                className="mermaid-node__svg max-w-full"
                // svgOutput is already sanitized via DOMPurify's SVG profile.
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('mermaid.editPlaceholder')}
              </span>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export default MermaidNodeView;
