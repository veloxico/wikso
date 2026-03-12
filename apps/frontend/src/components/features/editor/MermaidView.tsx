'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Eye, Pencil, Trash2, GitBranch } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function MermaidView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const code = (node.attrs.code as string) || '';
  const [mode, setMode] = useState<'edit' | 'preview'>(code ? 'preview' : 'edit');
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [localCode, setLocalCode] = useState(code);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderContainerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, '_');
  const renderId = `mermaid_${uniqueId}`;
  const mermaidRef = useRef<typeof import('mermaid')['default'] | null>(null);
  const renderCountRef = useRef(0);

  // Sync local code when external changes arrive (collaboration)
  useEffect(() => {
    setLocalCode(node.attrs.code || '');
  }, [node.attrs.code]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Detect dark mode
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;

  const renderDiagram = useCallback(async (mermaidCode: string) => {
    try {
      if (!mermaidRef.current) {
        const mermaidModule = await import('mermaid');
        mermaidRef.current = mermaidModule.default;
      }
      const mermaid = mermaidRef.current;

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: 'inherit',
      });

      // Use stable renderId with counter to avoid collisions but allow cleanup
      renderCountRef.current += 1;
      const currentRenderId = `${renderId}_${renderCountRef.current}`;
      const { svg } = await mermaid.render(currentRenderId, mermaidCode);

      // Clean up the hidden render element that mermaid creates
      const renderEl = document.getElementById(currentRenderId);
      if (renderEl) renderEl.remove();

      setSvgOutput(svg);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSvgOutput('');
      // Clean up any orphaned render elements from mermaid
      if (typeof document !== 'undefined') {
        const orphaned = document.querySelector(`[id^="${renderId}"]`);
        if (orphaned) orphaned.remove();
      }
    }
  }, [isDark, renderId]);

  // Render on mount and when switching to preview
  useEffect(() => {
    if (mode === 'preview' && code) {
      renderDiagram(code);
    }
  }, [mode, code, renderDiagram]);

  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateAttributes({ code: newCode });
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent ProseMirror from capturing keys in the textarea
    e.stopPropagation();
  };

  const isEditable = editor?.isEditable ?? true;

  return (
    <NodeViewWrapper className="mermaid-block" data-drag-handle>
      <div className="mermaid-block-toolbar">
        <div className="mermaid-block-label">
          <GitBranch size={14} />
          <span>Mermaid</span>
        </div>
        <div className="mermaid-block-actions">
          {isEditable && (
            <>
              <button
                type="button"
                className={`mermaid-btn ${mode === 'edit' ? 'active' : ''}`}
                onClick={() => setMode('edit')}
                title={t('editor.mermaidEdit')}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className={`mermaid-btn ${mode === 'preview' ? 'active' : ''}`}
                onClick={() => setMode('preview')}
                title={t('editor.mermaidPreview')}
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="mermaid-btn mermaid-btn-delete"
                onClick={deleteNode}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'edit' && isEditable ? (
        <textarea
          className="mermaid-block-textarea"
          value={localCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="graph TD&#10;  A[Start] --> B[End]"
          spellCheck={false}
        />
      ) : (
        <div className="mermaid-block-preview" ref={renderContainerRef}>
          {error ? (
            <div className="mermaid-block-error">
              <span>{t('editor.mermaidError')}:</span> {error}
            </div>
          ) : svgOutput ? (
            <div dangerouslySetInnerHTML={{ __html: svgOutput }} />
          ) : (
            <div className="mermaid-block-empty">
              {t('editor.mermaidEmpty')}
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
