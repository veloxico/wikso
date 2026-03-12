'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback, Suspense, lazy } from 'react';
import { PenTool, Trash2, Pencil } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const ExcalidrawCanvas = lazy(() => import('./ExcalidrawCanvas'));

export function ExcalidrawView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const previewSvg = (node.attrs.previewSvg as string) || '';
  const data = (node.attrs.data as string) || '{}';
  const hasContent = data !== '{}' && previewSvg;

  // New blocks open immediately in edit mode
  const [editing, setEditing] = useState(!hasContent);

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

  return (
    <NodeViewWrapper className="excalidraw-block" data-drag-handle={!editing}>
      {editing && isEditable ? (
        <div
          className="excalidraw-block-canvas"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
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
              darkMode={isDark}
            />
          </Suspense>
        </div>
      ) : (
        <>
          <div className="excalidraw-block-toolbar">
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
                e.stopPropagation();
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
