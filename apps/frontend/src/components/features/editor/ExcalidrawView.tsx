'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { PenTool, Trash2, Pencil, GripVertical } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const ExcalidrawCanvas = lazy(() => import('./ExcalidrawCanvas'));

export function ExcalidrawView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const previewSvg = (node.attrs.previewSvg as string) || '';
  const data = (node.attrs.data as string) || '{}';
  const hasContent = data !== '{}' && previewSvg;

  const [editing, setEditing] = useState(!hasContent);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isDark = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;
  const isEditable = editor?.isEditable ?? true;

  const handleSave = useCallback((sceneData: string, svgPreview: string) => {
    updateAttributes({ data: sceneData, previewSvg: svgPreview });
    setEditing(false);
  }, [updateAttributes]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  // Continuously sync drawing data to TipTap node attributes (debounced).
  // This ensures editorInstance.getJSON() always has the latest drawing
  // even if the user saves the page without clicking "Done" first.
  const handleDataChange = useCallback((data: string) => {
    updateAttributes({ data });
  }, [updateAttributes]);

  // Prevent browser native drag from TipTap's draggable="true" ancestor.
  // Uses capture phase to intercept dragstart before it reaches TipTap/browser.
  // Also disables draggable on the TipTap wrapper element while editing.
  useEffect(() => {
    if (!editing) return;

    const el = canvasRef.current;
    if (!el) return;

    // Find TipTap's outer wrapper element (has draggable="true")
    const tiptapWrapper = el.closest('[draggable="true"]') as HTMLElement | null;
    if (tiptapWrapper) {
      tiptapWrapper.draggable = false;
    }

    const preventDrag = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    el.addEventListener('dragstart', preventDrag, true);

    return () => {
      el.removeEventListener('dragstart', preventDrag, true);
      // Restore draggable when leaving edit mode
      if (tiptapWrapper) {
        tiptapWrapper.draggable = true;
      }
    };
  }, [editing]);

  return (
    <NodeViewWrapper className="excalidraw-block">
      {editing && isEditable ? (
        <div ref={canvasRef} className="excalidraw-block-canvas">
          <Suspense fallback={
            <div className="excalidraw-block-loading">
              <div className="excalidraw-spinner" />
              <span>{t('editor.drawingLoading')}</span>
            </div>
          }>
            <ExcalidrawCanvas
              initialData={data}
              onSave={handleSave}
              onCancel={handleCancel}
              onDataChange={handleDataChange}
              darkMode={isDark}
            />
          </Suspense>
        </div>
      ) : (
        <>
          <div className="excalidraw-block-toolbar">
            <div
              data-drag-handle=""
              className="excalidraw-drag-handle"
              contentEditable={false}
            >
              <GripVertical size={14} />
            </div>
            <div className="excalidraw-block-label">
              <PenTool size={14} />
              <span>{t('editor.drawing')}</span>
            </div>
            <div className="excalidraw-block-actions">
              {isEditable && (
                <>
                  <button
                    type="button"
                    className="excalidraw-btn"
                    onClick={() => setEditing(true)}
                    title={t('editor.mermaidEdit')}
                  >
                    <Pencil size={14} />
                    <span>{t('editor.mermaidEdit')}</span>
                  </button>
                  <button
                    type="button"
                    className="excalidraw-btn excalidraw-btn-delete"
                    onClick={deleteNode}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div
            className="excalidraw-block-preview"
            onClick={() => isEditable && setEditing(true)}
            role={isEditable ? 'button' : undefined}
            tabIndex={isEditable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isEditable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setEditing(true);
              }
            }}
          >
            {previewSvg ? (
              <div
                className="excalidraw-block-svg"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : (
              <div className="excalidraw-block-placeholder">
                <PenTool size={32} strokeWidth={1.5} />
                <span>{t('editor.drawingClickToEdit')}</span>
              </div>
            )}
          </div>
        </>
      )}
    </NodeViewWrapper>
  );
}
